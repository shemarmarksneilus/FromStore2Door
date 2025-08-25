import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class AccountService {
  async createAccount(data: {
    email: string;
    fullName: string;
    role: string;
  }) {
    const query = `
      INSERT INTO accounts (id, email, full_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name, role, created_at
    `;
    
    const result = await pool.query(query, [
      uuidv4(),
      data.email,
      data.fullName,
      data.role
    ]);
    
    return result.rows[0];
  }

  async getAccountById(id: string) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async getAccountByFirebaseUid(uid: string) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE firebase_uid = $1',
      [uid]
    );
    return result.rows[0];
  }
}
