import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * MySQL access layer.
 * - One pool per process (kept on globalThis so dev hot-reload does not leak pools)
 * - DATE / DATETIME come back as strings ('2026-10-19'), never shifted by JS timezones
 * - DECIMAL comes back as number
 * - Connects as the least-privilege application account (MYSQL_APP_USER, role physiq_app:
 *   DML + EXECUTE, no DDL) when configured; the admin account is only for building the database
 * - multipleStatements is OFF: one statement per call limits SQL-injection blast radius
 * - All values go through placeholders (?), never string concatenation
 */
const globalForMySQL = globalThis as unknown as { physiqPool?: Pool };

export function getPool(): Pool {
  if (!globalForMySQL.physiqPool) {
    globalForMySQL.physiqPool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_APP_USER || process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_APP_USER ? (process.env.MYSQL_APP_PASSWORD ?? '') : (process.env.MYSQL_PASSWORD ?? ''),
      database: process.env.MYSQL_DATABASE || 'physiq_db',
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      dateStrings: true,
      decimalNumbers: true,
      multipleStatements: false,
    });
  }
  return globalForMySQL.physiqPool;
}

type Queryable = Pool | PoolConnection;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mysql2 accepts any escapable value
type Params = any[];

/** SELECT returning rows. */
export async function select<T>(sql: string, params: Params = [], db: Queryable = getPool()): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

/** SELECT returning the first row or null. */
export async function selectOne<T>(sql: string, params: Params = [], db: Queryable = getPool()): Promise<T | null> {
  const rows = await select<T>(sql, params, db);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE. */
export async function execute(sql: string, params: Params = [], db: Queryable = getPool()): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(sql, params);
  return result;
}

/** CALL a procedure that returns a result set; yields the first result set's rows. */
export async function callRows<T>(proc: string, params: Params, db: Queryable = getPool()): Promise<T[]> {
  const placeholders = params.map(() => '?').join(', ');
  const [results] = await db.query<RowDataPacket[][]>(`CALL ${proc}(${placeholders})`, params);
  return (results[0] ?? []) as T[];
}

/**
 * CALL a procedure with OUT parameters. CALL and the SELECT of the @variables
 * must run on the same connection, so this borrows one from the pool.
 */
export async function callOut<T extends object>(
  proc: string,
  inParams: Params,
  outNames: (keyof T & string)[]
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    const ins = inParams.map(() => '?');
    const outs = outNames.map((n) => `@out_${n}`);
    await conn.query(`CALL ${proc}(${[...ins, ...outs].join(', ')})`, inParams);
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT ${outNames.map((n) => `@out_${n} AS ${n}`).join(', ')}`);
    return rows[0] as T;
  } finally {
    conn.release();
  }
}

/**
 * Run fn inside BEGIN ... COMMIT; any thrown error triggers ROLLBACK.
 * actingUserId sets @app_user_id for the audit triggers on this connection
 * and is always cleared before the connection goes back to the pool.
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
  options: { actingUserId?: number } = {}
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    if (options.actingUserId) await conn.query('SET @app_user_id = ?', [options.actingUserId]);
    await conn.beginTransaction();
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    if (options.actingUserId) await conn.query('SET @app_user_id = NULL').catch(() => undefined);
    conn.release();
  }
}
