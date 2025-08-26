import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { verifyFirebaseToken } from '../middleware/auth';
import { pool } from '../config/database';

const router = Router();
const authService = new AuthService();

// Use type assertion
router.post('/sync', verifyFirebaseToken, async (req: any, res) => {
  try {
    const firebaseUser = req.user;
    if (!firebaseUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await authService.createOrUpdateUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: firebaseUser.role,
      name: firebaseUser.email?.split('@')[0] || 'User'
    });

    res.json({ user });
  } catch (error) {
    console.error('Auth sync error:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// GET /api/auth/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;