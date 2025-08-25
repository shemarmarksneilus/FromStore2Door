import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { verifyFirebaseToken } from '../middleware/auth';

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

export default router;