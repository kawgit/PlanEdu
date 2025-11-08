import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { schema, pool };

export type Database = typeof db;
export { sql } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';
