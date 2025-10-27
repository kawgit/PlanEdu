import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './db/schema';
import * as relations from './db/relations';

const connection = neon(process.env.DATABASE_URL!);

export const sql = connection;

// @ts-ignore - Type error with neon-serverless compatibility, but it works at runtime
export const db = drizzle(connection, { schema: { ...schema, ...relations } });

export default db;