import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool, testConnection } from './config/database';
import { Request, Response, NextFunction } from 'express';

// Import routes
import jwtAuthRoutes from './routes/jwt-auth.routes';
import accountRoutes from './routes/accounts.routes';
import warehouseRoutes from './routes/warehouse.routes';
import packageRoutes from './routes/packages.routes';
import manifestRoutes from './routes/manifests.routes';
import preAlertRoutes from './routes/prealert.routes';
import tallyRoutes from './routes/tally.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';

dotenv.config({ path: '.env.development' });

const app = express();

// Test database connection on startup
testConnection();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      status: 'OK', 
      timestamp: result.rows[0].current_time,
      environment: process.env.NODE_ENV,
      phase: 'JWT Auth Ready'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Routes
app.use('/api/auth', jwtAuthRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/manifests', manifestRoutes);
app.use('/api/pre-alerts', preAlertRoutes);
app.use('/api/tally-sheets', tallyRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /api/auth/register - Register user`);
  console.log(`   POST /api/auth/login - Login user`);
  console.log(`   POST /api/auth/refresh - Refresh token`);
  console.log(`   GET  /api/auth/me - Get current user`);
});

export default app;