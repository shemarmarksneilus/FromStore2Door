import axios, { AxiosInstance } from 'axios';
import { pool } from '../config/database';
import {AxiosError} from 'axios';
interface IPackConfig {
  apiUrl: string;
  apiKey: string;
  clientId: string;
  environment: 'production' | 'staging' | 'sandbox';
}

interface IPackOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  status: string;
  items: IPackOrderItem[];
  shippingAddress: any;
  trackingNumber?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  declaredValue?: number;
  createdAt: string;
  updatedAt: string;
}

interface IPackOrderItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  weight?: number;
}

interface IPackInventory {
  sku: string;
  description: string;
  quantity: number;
  location: string;
  lastUpdated: string;
}

interface IPackShipment {
  id: string;
  trackingNumber: string;
  status: string;
  origin: any;
  destination: any;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: IPackTrackingEvent[];
}

interface IPackTrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export class IPackIntegrationService {
  private client: AxiosInstance;
  private config: IPackConfig;
  private lastSyncTimestamp: Date | null = null;

  constructor() {
    this.config = {
      apiUrl: process.env.IPACK_API_URL || 'https://api.ipack.com/v1',
      apiKey: process.env.IPACK_API_KEY || '',
      clientId: process.env.IPACK_CLIENT_ID || '',
      environment: (process.env.IPACK_ENVIRONMENT as any) || 'sandbox'
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Client-ID': this.config.clientId,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Setup response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('iPack API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Test connection to iPack API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('iPack connection test failed:', error);
      return false;
    }
  }

  /**
   * Pull new orders from iPack
   */
  async pullOrders(since?: Date): Promise<IPackOrder[]> {
    try {
      const params: any = {
        limit: 100,
        status: 'active'
      };

      if (since) {
        params.updated_since = since.toISOString();
      }

      const response = await this.client.get('/orders', { params });
      return response.data.orders || [];
    } catch (error) {
      console.error('Failed to pull orders from iPack:', error);
      throw error;
    }
  }

  /**
   * Pull inventory data from iPack
   */
  async pullInventory(warehouseId?: string): Promise<IPackInventory[]> {
    try {
      const params: any = {
        limit: 1000
      };

      if (warehouseId) {
        params.warehouse_id = warehouseId;
      }

      const response = await this.client.get('/inventory', { params });
      return response.data.inventory || [];
    } catch (error) {
      console.error('Failed to pull inventory from iPack:', error);
      throw error;
    }
  }

  /**
   * Pull shipment data from iPack
   */
  async pullShipments(since?: Date): Promise<IPackShipment[]> {
    try {
      const params: any = {
        limit: 100
      };

      if (since) {
        params.updated_since = since.toISOString();
      }

      const response = await this.client.get('/shipments', { params });
      return response.data.shipments || [];
    } catch (error) {
      console.error('Failed to pull shipments from iPack:', error);
      throw error;
    }
  }

  /**
   * Get tracking information for a specific package
   */
  async getTrackingInfo(trackingNumber: string): Promise<IPackShipment | null> {
    try {
      const response = await this.client.get(`/tracking/${trackingNumber}`);
      return response.data.shipment || null;
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
            return null; // Tracking number not found
      }
        console.error('Failed to get tracking info:', error);
        throw error;
    }
  }

  /**
   * Sync orders from iPack to Store2Door database
   */
  async syncOrders(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      // Get last sync timestamp
      const lastSync = await this.getLastSyncTimestamp('orders');
      
      // Pull orders from iPack
      const orders = await this.pullOrders(lastSync?? undefined);
      
      console.log(`Pulled ${orders.length} orders from iPack`);

      for (const order of orders) {
        try {
          await this.syncOrderToDatabase(order);
          synced++;
        } catch (error) {
          console.error(`Failed to sync order ${order.id}:`, error);
          errors++;
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp('orders');

      console.log(`Order sync completed: ${synced} synced, ${errors} errors`);
      return { synced, errors };
    } catch (error) {
      console.error('Order sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync shipments from iPack to Store2Door database
   */
  async syncShipments(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      const lastSync = await this.getLastSyncTimestamp('shipments');
      const shipments = await this.pullShipments(lastSync?? undefined);
      
      console.log(`Pulled ${shipments.length} shipments from iPack`);

      for (const shipment of shipments) {
        try {
          await this.syncShipmentToDatabase(shipment);
          synced++;
        } catch (error) {
          console.error(`Failed to sync shipment ${shipment.id}:`, error);
          errors++;
        }
      }

      await this.updateLastSyncTimestamp('shipments');

      console.log(`Shipment sync completed: ${synced} synced, ${errors} errors`);
      return { synced, errors };
    } catch (error) {
      console.error('Shipment sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync a single order to the database
   */
  private async syncOrderToDatabase(order: IPackOrder): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if customer exists, create if not
      let customerId = await this.findOrCreateCustomer(
        order.customerId, 
        order.customerEmail, 
        order.customerName
      );

      // Find appropriate warehouse (you may need to adjust this logic)
      const warehouse = await client.query(
        'SELECT id FROM warehouses WHERE type = $1 ORDER BY id LIMIT 1',
        ['overseas'] // Assuming iPack orders come from overseas warehouses
      );

      if (warehouse.rows.length === 0) {
        throw new Error('No overseas warehouse found for iPack order');
      }

      const warehouseId = warehouse.rows[0].id;

      // Check if package already exists
      const existingPackage = await client.query(
        'SELECT id FROM packages WHERE tracking_no = $1',
        [order.trackingNumber || order.orderNumber]
      );

      const trackingNo = order.trackingNumber || order.orderNumber;
      const totalWeight = order.weight || order.items.reduce((sum, item) => sum + (item.weight || 0.5), 0);
      const totalValue = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

      if (existingPackage.rows.length === 0) {
        // Create new package
        const packageResult = await client.query(`
          INSERT INTO packages (
            tracking_no, customer_id, warehouse_id, status, weight_kg,
            length_cm, width_cm, height_cm, declared_value_usd, contents,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          trackingNo,
          customerId,
          warehouseId,
          this.mapIPackStatusToStore2Door(order.status),
          totalWeight,
          order.dimensions?.length || 30,
          order.dimensions?.width || 20,
          order.dimensions?.height || 15,
          totalValue,
          JSON.stringify(order.items.map(item => ({
            sku: item.sku,
            description: item.description,
            quantity: item.quantity
          }))),
          new Date(order.createdAt),
          new Date(order.updatedAt)
        ]);

        const packageId = packageResult.rows[0].id;

        // Create package contents
        for (const item of order.items) {
          await client.query(`
            INSERT INTO package_contents (package_id, sku, description, qty, value_usd)
            VALUES ($1, $2, $3, $4, $5)
          `, [packageId, item.sku, item.description, item.quantity, item.totalPrice]);
        }

        // Create package event
        await client.query(`
          INSERT INTO package_events (package_id, event, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          packageId,
          'ipack_sync',
          JSON.stringify({ source: 'iPack', orderId: order.id }),
          new Date()
        ]);
      } else {
        // Update existing package
        const packageId = existingPackage.rows[0].id;
        await client.query(`
          UPDATE packages SET
            status = $1, weight_kg = $2, declared_value_usd = $3,
            contents = $4, updated_at = $5
          WHERE id = $6
        `, [
          this.mapIPackStatusToStore2Door(order.status),
          totalWeight,
          totalValue,
          JSON.stringify(order.items.map(item => ({
            sku: item.sku,
            description: item.description,
            quantity: item.quantity
          }))),
          new Date(order.updatedAt),
          packageId
        ]);

        // Create update event
        await client.query(`
          INSERT INTO package_events (package_id, event, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          packageId,
          'ipack_update',
          JSON.stringify({ source: 'iPack', orderId: order.id, status: order.status }),
          new Date()
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sync a single shipment to the database
   */
  private async syncShipmentToDatabase(shipment: IPackShipment): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Find package by tracking number
      const packageResult = await client.query(
        'SELECT id FROM packages WHERE tracking_no = $1',
        [shipment.trackingNumber]
      );

      if (packageResult.rows.length === 0) {
        console.warn(`Package not found for tracking number: ${shipment.trackingNumber}`);
        return;
      }

      const packageId = packageResult.rows[0].id;

      // Update package status based on shipment status
      const status = this.mapIPackStatusToStore2Door(shipment.status);
      await client.query(
        'UPDATE packages SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, packageId]
      );

      // Create tracking events
      for (const event of shipment.events) {
        await client.query(`
          INSERT INTO package_events (package_id, event, details, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [
          packageId,
          'tracking_update',
          JSON.stringify({
            source: 'iPack',
            status: event.status,
            location: event.location,
            description: event.description
          }),
          new Date(event.timestamp)
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find or create customer in database
   */
  private async findOrCreateCustomer(externalId: string, email: string, name: string): Promise<string> {
    // First try to find by email
    let result = await pool.query(
      'SELECT id FROM accounts WHERE email = $1 AND role = $2',
      [email.toLowerCase(), 'customer']
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create new customer
    const { v4: uuidv4 } = require('uuid');
    const customerId = uuidv4();
    
    result = await pool.query(`
      INSERT INTO accounts (id, email, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, true, NOW())
      RETURNING id
    `, [customerId, email.toLowerCase(), name, 'customer']);

    return result.rows[0].id;
  }

  /**
   * Map iPack status to Store2Door status
   */
  private mapIPackStatusToStore2Door(iPackStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pre_alert',
      'processing': 'received',
      'packed': 'in_warehouse',
      'shipped': 'cleared',
      'in_transit': 'out_for_delivery',
      'delivered': 'delivered',
      'returned': 'returned',
      'cancelled': 'returned'
    };

    return statusMap[iPackStatus.toLowerCase()] || 'received';
  }

  /**
   * Get last sync timestamp for a specific entity type
   */
  private async getLastSyncTimestamp(entityType: string): Promise<Date | null> {
    try {
      const result = await pool.query(
        'SELECT value FROM system_config WHERE key = $1',
        [`ipack_last_sync_${entityType}`]
      );

      if (result.rows.length > 0 && result.rows[0].value?.timestamp) {
        return new Date(result.rows[0].value.timestamp);
      }

      return null;
    } catch (error) {
      console.error('Failed to get last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp for a specific entity type
   */
  private async updateLastSyncTimestamp(entityType: string): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO system_config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at
      `, [
        `ipack_last_sync_${entityType}`,
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]);
    } catch (error) {
      console.error('Failed to update last sync timestamp:', error);
    }
  }

  /**
   * Run full sync of all data types
   */
  async runFullSync(): Promise<{
    orders: { synced: number; errors: number };
    shipments: { synced: number; errors: number };
  }> {
    console.log('Starting full iPack sync...');

    const results = {
      orders: await this.syncOrders(),
      shipments: await this.syncShipments()
    };

    console.log('Full iPack sync completed:', results);
    return results;
  }

  /**
   * Export data to iPack (if needed for two-way sync)
   */
  async exportOrder(packageId: string): Promise<boolean> {
    try {
      // Get package details
      const result = await pool.query(`
        SELECT p.*, a.email, a.full_name
        FROM packages p
        JOIN accounts a ON p.customer_id = a.id
        WHERE p.id = $1
      `, [packageId]);

      if (result.rows.length === 0) {
        throw new Error(`Package ${packageId} not found`);
      }

      const package_ = result.rows[0];

      // Prepare export data
      const exportData = {
        trackingNumber: package_.tracking_no,
        customerEmail: package_.email,
        customerName: package_.full_name,
        weight: package_.weight_kg,
        dimensions: {
          length: package_.length_cm,
          width: package_.width_cm,
          height: package_.height_cm
        },
        declaredValue: package_.declared_value_usd,
        contents: package_.contents,
        status: package_.status
      };

      // Send to iPack
      await this.client.post('/orders/import', exportData);
      
      // Log export event
      await pool.query(`
        INSERT INTO package_events (package_id, event, details, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [
        packageId,
        'exported_to_ipack',
        JSON.stringify(exportData)
      ]);

      return true;
    } catch (error) {
      console.error('Failed to export order to iPack:', error);
      return false;
    }
  }

  /**
   * Set up automatic sync schedule (call this from a cron job)
   */
  async scheduleSync(): Promise<void> {
    try {
      console.log('Running scheduled iPack sync...');
      await this.runFullSync();
    } catch (error: unknown) {
      console.error('Scheduled sync failed:', error);
      let payload: any = {};

      if (error instanceof Error) {
        payload = {
            message: error.message,
            stack: error.stack
        };
    }else {
        payload = {error:String(error)}
    }
      // Log error to system events
      await pool.query(`
        INSERT INTO system_events (event, payload, ts)
        VALUES ($1, $2, NOW())
      `, [
        'ipack_sync_error',
        JSON.stringify(payload)]);
    }
  }
}

// Export singleton instance
export const iPackService = new IPackIntegrationService();

