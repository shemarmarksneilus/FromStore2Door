import admin from '../config/firebase';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  /**
   * Creates a new account or returns an existing one based on Firebase UID.
   * @param firebaseUser - Object containing uid, email, optional name, and optional role.
   * @returns The account record from the database.
   */
  async createOrUpdateUser(firebaseUser: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
  }) {
    // Check if user exists
    const existing = await pool.query(
      'SELECT * FROM accounts WHERE firebase_uid = $1',
      [firebaseUser.uid]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new account
    const query = `
      INSERT INTO accounts (id, firebase_uid, email, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      uuidv4(),
      firebaseUser.uid,
      firebaseUser.email,
      firebaseUser.name || firebaseUser.email,
      firebaseUser.role || 'customer'
    ]);
    
    return result.rows[0];
  }

  /**
   * Retrieves an account by its Firebase UID.
   * @param uid - The Firebase UID of the user.
   * @returns The account record if found, otherwise undefined.
   */
  async getUserByFirebaseUid(uid: string) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE firebase_uid = $1',
      [uid]
    );
    return result.rows[0];
  }
}