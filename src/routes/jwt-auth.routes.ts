import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import {v4 as uuidv4} from 'uuid';
import { Router } from 'express';

interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}
interface LoginResponse {
    user:{
        id: string;
        email: string;
        fullName: string;
        role: string;
    }
    token: string;
    refreshToken: string;
}

export class JwtAuthService {
    private readonly JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_key';
    private readonly REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_secret_key';
    private readonly TOKEN_EXPIRATION = '1h';
    private readonly REFRESH_EXPIRY = '7d';

    // Register a new user with email and password
    async register(userData: {
        email:string;
        password:string;
        fullName:string;
        phone?:string;
        role?:string;
    }): Promise<LoginResponse> {
        const {email, password, fullName, phone, role='customer'} = userData; // Changed default from 'user' to 'customer'

        //check if user already exists
        const existingUser = await pool.query('SELECT id FROM accounts WHERE email=$1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        //hash password
        const passwordHash = await bcrypt.hash(password, 12);
        const userId = uuidv4();

// Create user
    const result = await pool.query(`
      INSERT INTO accounts (id, email, full_name, phone, role, password_hash, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, email, full_name, role, created_at
    `, [userId, email.toLowerCase(), fullName, phone, role, passwordHash]);

    const user = result.rows[0];

    // Generate tokens
    const { token, refreshToken } = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      token,
      refreshToken
    };
  }

  /**
   * Login user with email/password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Get user by email
    const result = await pool.query(`
      SELECT id, email, full_name, role, password_hash, is_active, last_login_at
      FROM accounts 
      WHERE email = $1
    `, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const { token, refreshToken } = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Update last login and store refresh token
    await Promise.all([
      pool.query('UPDATE accounts SET last_login_at = NOW() WHERE id = $1', [user.id]),
      this.storeRefreshToken(user.id, refreshToken)
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      token,
      refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, this.REFRESH_SECRET) as TokenPayload;
      
      // Verify refresh token exists in database
      const result = await pool.query(`
        SELECT rt.user_id, a.email, a.role, a.is_active
        FROM refresh_tokens rt
        JOIN accounts a ON rt.user_id = a.id
        WHERE rt.token = $1 AND rt.expires_at > NOW() AND rt.is_active = true
      `, [refreshToken]);

      if (result.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const user = result.rows[0];
      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      // Generate new tokens
      const tokens = this.generateTokens({
        userId: user.user_id,
        email: user.email,
        role: user.role
      });

      // Invalidate old refresh token and store new one
      await Promise.all([
        pool.query('UPDATE refresh_tokens SET is_active = false WHERE token = $1', [refreshToken]),
        this.storeRefreshToken(user.user_id, tokens.refreshToken)
      ]);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify JWT access token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // Optional: Verify user still exists and is active
      const result = await pool.query(
        'SELECT id, is_active FROM accounts WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        throw new Error('User not found or inactive');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET is_active = false WHERE token = $1',
      [refreshToken]
    );
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM accounts WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all refresh tokens
    await Promise.all([
      pool.query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]),
      pool.query('UPDATE refresh_tokens SET is_active = false WHERE user_id = $1', [userId])
    ]);
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(payload: TokenPayload): { token: string; refreshToken: string } {
    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_EXPIRATION,
      issuer: 'store2door',
      audience: 'store2door-client'
    });

    const refreshToken = jwt.sign(payload, this.REFRESH_SECRET, {
      expiresIn: this.REFRESH_EXPIRY,
      issuer: 'store2door',
      audience: 'store2door-client'
    });

    return { token, refreshToken };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await pool.query(`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `, [userId, refreshToken, expiresAt]);

    // Clean up old refresh tokens for this user (keep only last 5)
    await pool.query(`
      UPDATE refresh_tokens 
      SET is_active = false 
      WHERE user_id = $1 
      AND id NOT IN (
        SELECT id FROM refresh_tokens 
        WHERE user_id = $1 AND is_active = true 
        ORDER BY created_at DESC 
        LIMIT 5
      )
    `, [userId]);
  }
}

// Export singleton instance
export default Router();