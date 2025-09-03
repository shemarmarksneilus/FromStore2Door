import { Router } from 'express';
import type { Request, Response } from 'express';
import { jwtAuthService } from '../services/jwt-auth.service';
import { verifyJwtToken, AuthenticatedRequest } from '../middleware/jwt-auth';
import { validate } from '../middleware/validation';
import Joi from 'joi';
import { pool } from '../config/database';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  fullName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').default('customer')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const result = await jwtAuthService.register(req.body);
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        return res.status(409).json({ error: error.message });
      }
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await jwtAuthService.login(email, password);
    
    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid email or password') || 
          error.message.includes('Account is deactivated')) {
        return res.status(401).json({ error: error.message });
      }
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await jwtAuthService.refreshToken(refreshToken);
    
    res.json({
      token: result.token,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me (protected route)
router.get('/me', verifyJwtToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get full user details from database
    const result = await pool.query(`
      SELECT id, email, full_name, phone, role, is_active, 
             is_email_verified, last_login_at, created_at
      FROM accounts 
      WHERE id = $1
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        isEmailVerified: user.is_email_verified,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// POST /api/auth/logout
router.post('/logout', verifyJwtToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken;
    if (refreshToken) {
      await jwtAuthService.logout(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/change-password (protected route)
router.post('/change-password', 
  verifyJwtToken, 
  validate(changePasswordSchema), 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { currentPassword, newPassword } = req.body;
      await jwtAuthService.changePassword(req.user.userId, currentPassword, newPassword);
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Current password is incorrect') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// GET /api/auth/users (admin only)
router.get('/users', verifyJwtToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT id, email, full_name, phone, role, is_active, 
             is_email_verified, last_login_at, created_at
      FROM accounts 
      ORDER BY created_at DESC
    `);
    
    res.json({
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        isEmailVerified: user.is_email_verified,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;