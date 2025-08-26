import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/manifests
router.get('/', async (req, res) => {
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

// POST /api/manifests
router.post('/', async (req, res) => {
  const { warehouseId, origin, destination, eta, flightNo } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO manifests (warehouse_id, origin, destination, eta, flight_no, status) 
       VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
      [warehouseId, JSON.stringify(origin), JSON.stringify(destination), eta, flightNo]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Manifest error:', error);
    res.status(500).json({ error: 'Failed to create manifest' });
  }
});

// POST /api/manifests/:id/items
router.post('/:id/items', async (req, res) => {
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

export default router;