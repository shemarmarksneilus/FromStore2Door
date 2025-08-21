import { Router } from 'express';
import { AccountService } from '../services/account.service.js';

const router = Router();
const accountService = new AccountService();

/**
 * GET /api/accounts/:id
 * Retrieves an account by its unique ID.
 * Responds with 404 if not found, or 500 on server error.
 */
router.get('/:id', async (req, res) => {
  try {
    const account = await accountService.getAccountById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/accounts
 * Creates a new account.
 * Requires 'email' and 'fullName' in the request body.
 * Responds with 400 if required fields are missing, or 500 on server error.
 */
router.post('/', async (req, res) => {
  try {
    const { email, fullName, role } = req.body;
    
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and fullName required' });
    }
    
    const account = await accountService.createAccount({
      email,
      fullName,
      role: role || 'customer'
    });
    
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

export default router;