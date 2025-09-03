import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyJwtToken, requireRole, AuthenticatedRequest } from '../middleware/jwt-auth';
import { validate } from '../middleware/validation';
import { createAccountSchema, updateAccountSchema } from '../utils/validation';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(verifyJwtToken);

// GET /api/accounts/me
router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    const result = await pool.query(`
      SELECT id, email, full_name, phone, role, is_active, 
             is_email_verified, last_login_at, created_at
      FROM accounts 
      WHERE id = $1
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    res.json({
      id: account.id,
      email: account.email,
      fullName: account.full_name,
      phone: account.phone,
      role: account.role,
      isActive: account.is_active,
      isEmailVerified: account.is_email_verified,
      lastLoginAt: account.last_login_at,
      createdAt: account.created_at
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// PUT /api/accounts/me
router.put('/me', validate(updateAccountSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, phone } = req.body;
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (fullName) {
      updateFields.push(`full_name = $${paramCount}`);
      values.push(fullName);
      paramCount++;
    }

    if (phone) {
      updateFields.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(req.user.userId);

    const query = `
      UPDATE accounts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, phone, role, updated_at
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    res.json({
      id: account.id,
      email: account.email,
      fullName: account.full_name,
      phone: account.phone,
      role: account.role,
      updatedAt: account.updated_at
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// POST /api/accounts (admin only)
router.post('/', 
  requireRole(['admin']), 
  validate(createAccountSchema), 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, fullName, role = 'customer', phone } = req.body;
      const accountId = uuidv4();

      const result = await pool.query(`
        INSERT INTO accounts (id, email, full_name, phone, role, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id, email, full_name, phone, role, created_at
      `, [accountId, email.toLowerCase(), fullName, phone, role]);

      const account = result.rows[0];
      res.status(201).json({
        id: account.id,
        email: account.email,
        fullName: account.full_name,
        phone: account.phone,
        role: account.role,
        createdAt: account.created_at
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      console.error('Create account error:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
);

// GET /api/accounts/:id (staff and admin)
router.get('/:id', requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT id, email, full_name, phone, role, is_active, 
             is_email_verified, last_login_at, created_at
      FROM accounts 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    res.json({
      id: account.id,
      email: account.email,
      fullName: account.full_name,
      phone: account.phone,
      role: account.role,
      isActive: account.is_active,
      isEmailVerified: account.is_email_verified,
      lastLoginAt: account.last_login_at,
      createdAt: account.created_at
    });
  } catch (error) {
    console.error('Get account by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// PUT /api/accounts/:id (admin only)
router.put('/:id', 
  requireRole(['admin']), 
  validate(updateAccountSchema), 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { fullName, phone, role, isActive } = req.body;
      
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (fullName) {
        updateFields.push(`full_name = $${paramCount}`);
        values.push(fullName);
        paramCount++;
      }

      if (phone) {
        updateFields.push(`phone = $${paramCount}`);
        values.push(phone);
        paramCount++;
      }

      if (role) {
        updateFields.push(`role = $${paramCount}`);
        values.push(role);
        paramCount++;
      }

      if (typeof isActive === 'boolean') {
        updateFields.push(`is_active = $${paramCount}`);
        values.push(isActive);
        paramCount++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE accounts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, full_name, phone, role, is_active, updated_at
      `;

      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const account = result.rows[0];
      res.json({
        id: account.id,
        email: account.email,
        fullName: account.full_name,
        phone: account.phone,
        role: account.role,
        isActive: account.is_active,
        updatedAt: account.updated_at
      });
    } catch (error) {
      console.error('Update account by ID error:', error);
      res.status(500).json({ error: 'Failed to update account' });
    }
  }
);

// GET /api/accounts (staff and admin with pagination)
router.get('/', requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const role = req.query.role as string;
    const search = req.query.search as string;

    let whereClause = '';
    const queryParams: any[] = [limit, offset];
    let paramCount = 3;

    if (role) {
      whereClause += `WHERE role = $${paramCount}`;
      queryParams.push(role);
      paramCount++;
    }

    if (search) {
      const searchClause = `${whereClause ? 'AND' : 'WHERE'} (full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      whereClause += ` ${searchClause}`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    const countQuery = `SELECT COUNT(*) FROM accounts ${whereClause}`;
    const dataQuery = `
      SELECT id, email, full_name, phone, role, is_active, 
             is_email_verified, last_login_at, created_at
      FROM accounts 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, queryParams.slice(2)),
      pool.query(dataQuery, queryParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      accounts: dataResult.rows.map(account => ({
        id: account.id,
        email: account.email,
        fullName: account.full_name,
        phone: account.phone,
        role: account.role,
        isActive: account.is_active,
        isEmailVerified: account.is_email_verified,
        lastLoginAt: account.last_login_at,
        createdAt: account.created_at
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

export default router;