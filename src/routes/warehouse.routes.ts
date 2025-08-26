import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/warehouses
router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM warehouses ORDER BY name');
  res.json(result.rows);
});

// POST /api/warehouses
router.post('/', async (req, res) => {
  const { name, type, address, timezone } = req.body;
  const result = await pool.query(
    'INSERT INTO warehouses (name, type, address, timezone) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, type, JSON.stringify(address), timezone]
  );
  res.status(201).json(result.rows[0]);
});

export default router;