import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// POST /api/tally-sheets
router.post('/', async (req, res) => {
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

// POST /api/tally-sheets/:id/items
router.post('/:id/items', async (req, res) => {
  const { id } = req.params;
  const { trackingNo, countedQty, expectedQty, discrepancyNote } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO tally_sheet_items (tally_sheet_id, tracking_no, counted_qty, expected_qty, discrepancy_note) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, trackingNo, countedQty, expectedQty, discrepancyNote]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tally item' });
  }
});

export default router;