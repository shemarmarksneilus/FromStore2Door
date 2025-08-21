import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env.development file
dotenv.config({ path: '.env.development' });

/**
 * PostgreSQL connection pool.
 * Uses DATABASE_URL from environment variables.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Tests the database connection by attempting to acquire a client from the pool.
 * Logs a success message if connected, otherwise logs the error and exits the process.
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Database connected');
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}