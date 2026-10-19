/*
 * Shared helpers for the database test suite (node:test).
 * Every test runs inside a transaction that is ROLLED BACK at the end, so the
 * suite can run against the real physiq_db without changing any data.
 */
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '..', '..'));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'physiq_db',
  connectionLimit: 4,
  dateStrings: true,
  decimalNumbers: true,
});

async function inRollback(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    return await fn(conn);
  } finally {
    await conn.rollback();
    await conn.query('SET @app_user_id = NULL');
    conn.release();
  }
}

async function createUser(conn, overrides = {}) {
  const user = {
    name: 'Test Lifter',
    email: `test-${crypto.randomUUID()}@physiq.test`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuuJ9Qm7jzYbE9mN1ZbX0aQe8m6fHn5y2',
    role: 'member',
    goal: 'hypertrophy',
    starting_weight: 75,
    ...overrides,
  };
  const [res] = await conn.query('INSERT INTO users SET ?', [user]);
  return res.insertId;
}

/** days: [[label, minRestDays], ...] -> { splitId, days: { label: id } } */
async function createSplit(conn, userId, days = [['Push', 2], ['Pull', 2], ['Legs', 2]], active = true) {
  const [split] = await conn.query('INSERT INTO splits (user_id, split_name, is_active) VALUES (?, ?, ?)', [
    userId,
    'Test Split',
    active,
  ]);
  const ids = {};
  for (const [i, [label, rest]] of days.entries()) {
    const [d] = await conn.query(
      'INSERT INTO split_days (split_id, body_part, day_order, min_rest_days) VALUES (?, ?, ?, ?)',
      [split.insertId, label, i + 1, rest]
    );
    ids[label] = d.insertId;
  }
  return { splitId: split.insertId, days: ids };
}

async function createSession(conn, { userId, splitDayId = null, daysAgo = 0, bodyPart = 'Push' }) {
  const [res] = await conn.query(
    `INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part)
     VALUES (?, ?, DATE_SUB(CURRENT_DATE, INTERVAL ? DAY), ?)`,
    [userId, splitDayId, daysAgo, bodyPart]
  );
  return res.insertId;
}

async function addSet(conn, sessionId, exerciseId, { n = 1, reps, weight, warmup = false }) {
  const [res] = await conn.query(
    'INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, exerciseId, n, reps, weight, warmup]
  );
  return res.insertId;
}

async function exerciseId(conn, name) {
  const [[row]] = await conn.query('SELECT id FROM exercises WHERE name = ?', [name]);
  if (!row) throw new Error(`Exercise not seeded: ${name}`);
  return row.id;
}

async function one(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows[0];
}

/** CALL a procedure with OUT params and read them back as an object. */
async function callOut(conn, proc, inParams, outNames) {
  const outs = outNames.map((n) => `@${n}`).join(', ');
  const placeholders = inParams.map(() => '?').join(', ');
  await conn.query(`CALL ${proc}(${placeholders}${inParams.length ? ', ' : ''}${outs})`, inParams);
  return one(conn, `SELECT ${outNames.map((n) => `@${n} AS ${n}`).join(', ')}`);
}

module.exports = { pool, inRollback, createUser, createSplit, createSession, addSet, exerciseId, one, callOut };
