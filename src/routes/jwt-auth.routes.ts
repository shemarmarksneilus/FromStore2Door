import { Router, Request, Response, NextFunction } from 'express';
import { JwtAuthService } from '../services/jwt-auth.service';

const router = Router();
const authService = new JwtAuthService();

/**
 * Middleware to authenticate access tokens
 */
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = await authService.verifyToken(token);
    (req as any).user = payload;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
}

/**
 * Middleware for role-based access
 */
function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    res.json({ user });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user;
    await authService.changePassword(user.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin-only: Get all users
router.get('/users', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await (await import('../config/database')).pool.query(
      'SELECT id, email, full_name, role, created_at FROM accounts ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
