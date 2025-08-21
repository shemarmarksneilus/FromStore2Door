
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import accountRoutes from './routes/accounts.routes.js';

// Load environment variables from .env.development file
dotenv.config({ path: '.env.development' });

const app = express();

// Security middleware to set HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// HTTP request logger middleware
app.use(morgan('dev'));

// Parse incoming JSON requests
app.use(express.json());

/**
 * Health check endpoint.
 * Returns status and current timestamp.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Register account routes
app.use('/api/accounts', accountRoutes);


export default app;