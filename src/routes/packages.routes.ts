import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/packages
router.get('/', async (req, res) => {
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

// POST /api/packages/receive
router.post('/receive', async (req, res) => {
  const { 
    trackingNo, 
    warehouseId, 
    customerId,
    weight, 
    dimensions, 
    declaredValue,
    contents 
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
    console.error('Package receive error:', error);
    res.status(500).json({ error: 'Failed to receive package' });
  }
});

// GET /api/packages/:trackingNo
router.get('/:trackingNo', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, w.name as warehouse_name, a.full_name as customer_name
      FROM packages p 
      JOIN warehouses w ON p.warehouse_id = w.id 
      LEFT JOIN accounts a ON p.customer_id = a.id 
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

export default router;