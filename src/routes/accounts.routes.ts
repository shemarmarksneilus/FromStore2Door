import { Router } from 'express';
import type { Request, Response } from 'express';
import { AccountService } from '../services/account.service';
import { verifyFirebaseToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createAccountSchema } from '../utils/validation';


const router = Router();
const accountService = new AccountService();

// All routes require authentication
router.use(verifyFirebaseToken);

// GET /api/accounts/me
router.get('/me', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }
    const account = await accountService.getAccountByFirebaseUid(req.user.uid);
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /api/accounts (admin only)
router.post('/', 
  requireRole(['admin']), 
  validate(createAccountSchema), 
  async (req, res) => {
    try {
      const account = await accountService.createAccount(req.body);
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
);

export default router;