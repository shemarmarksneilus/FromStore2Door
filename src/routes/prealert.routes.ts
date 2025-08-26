import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// POST /api/pre-alerts
router.post('/', async (req, res) => {
  const { customerId, trackingNo, senderName, senderAddr, description, expectedDate } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO pre_alerts (customer_id, tracking_no, sender_name, sender_addr, description, expected_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customerId, trackingNo, senderName, JSON.stringify(senderAddr), description, expectedDate]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Pre-alert error:', error);
    res.status(500).json({ error: 'Failed to create pre-alert' });
  }
});

// GET /api/pre-alerts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pa.*, a.full_name as customer_name 
      FROM pre_alerts pa 
      LEFT JOIN accounts a ON pa.customer_id = a.id 
      ORDER BY pa.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pre-alerts' });
  }
});

export default router;