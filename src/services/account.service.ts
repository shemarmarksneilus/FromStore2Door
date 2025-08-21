import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class AccountService {
  /**
   * Creates a new account in the database.
   * @param data - Object containing email, fullName, and role.
   * @returns The newly created account record.
   */
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

  /**
   * Retrieves an account by its unique ID.
   * @param id - The UUID of the account.
   * @returns The account record if found, otherwise undefined.
   */
  async getAccountById(id: string) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}