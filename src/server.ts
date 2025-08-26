import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './config/database';
import { Request, Response, NextFunction } from 'express';
import warehouseRoutes from './routes/warehouse.routes';
import packageRoutes from './routes/packages.routes';
import manifestRoutes from './routes/manifests.routes';
import preAlertRoutes from './routes/prealert.routes';
import tallyRoutes from './routes/tally.routes';

dotenv.config({ path: '.env.development' });

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ========== PART 1 ENDPOINTS ==========

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      status: 'OK', 
      timestamp: result.rows[0].current_time,
      environment: process.env.NODE_ENV,
      phase: 'Phase 2 Ready'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Database test
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM accounts) as accounts,
        (SELECT COUNT(*) FROM warehouses) as warehouses,
        (SELECT COUNT(*) FROM packages) as packages,
        (SELECT COUNT(*) FROM manifests) as manifests
    `);
    
    res.json({ 
      message: 'Phase 2 Database Ready',
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database test failed' });
  }
});

// ========== PART 2 ENDPOINTS ==========

// === WAREHOUSE MANAGEMENT ===
app.use('/api/warehouses', warehouseRoutes);
app.get('/api/warehouses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, wo.name as operator_name 
      FROM warehouses w 
      LEFT JOIN warehouse_operators wo ON w.operator_id = wo.id 
      ORDER BY w.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

app.post('/api/warehouses', async (req, res) => {
  const { name, type, address, timezone, operatorId } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO warehouses (name, type, address, timezone, operator_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type, JSON.stringify(address), timezone, operatorId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// === PACKAGE MANAGEMENT ===
app.use('/api/packages', packageRoutes);
app.post('/api/packages/receive', async (req, res) => {
  const { 
    trackingNo, 
    warehouseId, 
    weight, 
    dimensions, 
    contents, 
    declaredValue,
    customerId 
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO packages (
        tracking_no, warehouse_id, customer_id, weight_kg, length_cm, 
        width_cm, height_cm, declared_value_usd, contents, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'received') 
      RETURNING *`,
      [trackingNo, warehouseId, customerId, weight, dimensions.length, 
       dimensions.width, dimensions.height, declaredValue, JSON.stringify(contents)]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to receive package' });
  }
});

app.get('/api/packages/:trackingNo', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, w.name as warehouse_name 
      FROM packages p 
      JOIN warehouses w ON p.warehouse_id = w.id 
      WHERE p.tracking_no = $1
    `, [req.params.trackingNo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const { warehouseId, status, customerId } = req.query;
    let query = `
      SELECT p.*, w.name as warehouse_name, a.full_name as customer_name
      FROM packages p
      JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN accounts a ON p.customer_id = a.id
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    if (warehouseId) {
      conditions.push(`p.warehouse_id = $${paramCount}`);
      values.push(warehouseId);
      paramCount++;
    }
    
    if (status) {
      conditions.push(`p.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    
    if (customerId) {
      conditions.push(`p.customer_id = $${paramCount}`);
      values.push(customerId);
      paramCount++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// === MANIFEST MANAGEMENT ===
app.use('/api/manifests', manifestRoutes);
app.get('/api/manifests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, w.name as warehouse_name 
      FROM manifests m 
      JOIN warehouses w ON m.warehouse_id = w.id 
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manifests' });
  }
});

app.post('/api/manifests', async (req, res) => {
  const { warehouseId, origin, destination, eta, flightNo } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO manifests (warehouse_id, origin, destination, eta, flight_no, status) 
       VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
      [warehouseId, JSON.stringify(origin), JSON.stringify(destination), eta, flightNo]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create manifest' });
  }
});

app.post('/api/manifests/:id/items', async (req, res) => {
  const { id } = req.params;
  const { trackingNo, description, pieces, weight, value } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO manifest_items (manifest_id, tracking_no, description, pieces, weight_kg, value_usd) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, trackingNo, description, pieces, weight, value]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add item to manifest' });
  }
});

// === PRE-ALERTS ===
app.use('/api/pre-alerts', preAlertRoutes);
app.post('/api/pre-alerts', async (req, res) => {
  const { customerId, trackingNo, senderName, senderAddr, description, expectedDate } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO pre_alerts (customer_id, tracking_no, sender_name, sender_addr, description, expected_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customerId, trackingNo, senderName, JSON.stringify(senderAddr), description, expectedDate]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pre-alert' });
  }
});

app.get('/api/pre-alerts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pa.*, a.full_name as customer_name 
      FROM pre_alerts pa 
      JOIN accounts a ON pa.customer_id = a.id 
      ORDER BY pa.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pre-alerts' });
  }
});

// === TALLY SHEETS ===
app.use('/api/tally-sheets', tallyRoutes);
app.post('/api/tally-sheets', async (req, res) => {
  const { warehouseId, manifestId } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO tally_sheets (warehouse_id, manifest_id) VALUES ($1, $2) RETURNING *',
      [warehouseId, manifestId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tally sheet' });
  }
});

// Error handlers


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Ready - http://localhost:${PORT}`);
});
