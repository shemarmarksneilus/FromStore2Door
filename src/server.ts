import express from 'express';
import dotenv from 'dotenv';
import { pool } from './config/database';

dotenv.config({ path: '.env.development' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      status: 'OK', 
      timestamp: result.rows[0].current_time,
      environment: process.env.NODE_ENV,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/test-db', async (req, res) => {
  try {
    // Check if accounts table exists and has data
    const result = await pool.query(`
      SELECT 
        COUNT(*) as account_count,
        (SELECT COUNT(*) FROM warehouses) as warehouse_count
    `);
    
    res.json({ 
      message: 'Database working',
      accounts: parseInt(result.rows[0].account_count),
      warehouses: parseInt(result.rows[0].warehouse_count)
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      error: 'Database test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start server
async function startServer() {
  try {
    await pool.query('SELECT 1'); // Test connection
    console.log('Database connected');
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

startServer();