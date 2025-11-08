import { db, sql as sqlBuilder, type SQL } from '../../../packages/database/dist/index.js';

export { db, sqlBuilder as sql };

export type QueryResultRow = Record<string, unknown>;

export default async function query<T extends QueryResultRow = QueryResultRow>(statement: SQL): Promise<T[]> {
  const result = await db.execute<T>(statement);
  return result.rows as T[];
}