import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db/connection.js';
import type { User, CreateUserInput, LoginInput } from '../../types/index.js';

const SALT_ROUNDS = 10;

export async function createUser(input: CreateUserInput): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  
  const result = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.email, passwordHash, input.firstName, input.lastName]
  );
  
  return mapUser(result.rows[0]);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().split('-')[0].toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role || 'customer',
    status: row.status || 'active',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
