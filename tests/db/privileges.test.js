const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '..', '..'));

// These tests connect as the least-privilege application account (role physiq_app).
// They are skipped when no app account is configured (MYSQL_APP_USER unset).
const skip = process.env.MYSQL_APP_USER ? false : 'MYSQL_APP_USER is not set';
let app;

before(async () => {
  if (skip) return;
  app = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_APP_USER,
    password: process.env.MYSQL_APP_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'physiq_db',
    dateStrings: true,
    decimalNumbers: true,
  });
});

after(async () => {
  await app?.end();
});

// With binary logging on, creating a trigger or routine without SUPER is refused with
// ER_BINLOG_CREATE_ROUTINE_NEED_SUPER before the plain access-denied check; both are refusals.
const denied = (promise) =>
  assert.rejects(
    promise,
    (err) => /DENIED|ACCESS|NEED_SUPER/i.test(err.code) || assert.fail(`expected a refusal, got ${err.code}: ${err.message}`)
  );

test('the app account holds only the physiq_app role', { skip }, async () => {
  const [[row]] = await app.query('SELECT CURRENT_ROLE() AS role');
  assert.match(row.role, /physiq_app/);
  const [grants] = await app.query('SHOW GRANTS');
  const text = JSON.stringify(grants);
  assert.ok(!/ALL PRIVILEGES|WITH GRANT OPTION|SUPER|FILE/i.test(text), 'no broad grants: ' + text);
});

test('it can read and write rows, run routines, and triggers still fire for it', { skip }, async () => {
  const [[users]] = await app.query('SELECT COUNT(*) AS n FROM users');
  assert.ok(users.n >= 2);

  await app.query('START TRANSACTION');
  try {
    const [[chest]] = await app.query("SELECT id FROM muscle_groups WHERE name = 'Chest'");
    await app.query("INSERT INTO exercises (name, muscle_group_id, equipment_needed) VALUES ('Privilege Test Press', ?, 'Machine')", [chest.id]);
    // trg_exercises_ai writes the audit row with the DEFINER's rights, not the app's
    const [[audit]] = await app.query("SELECT COUNT(*) AS n FROM admin_audit_logs WHERE JSON_UNQUOTE(JSON_EXTRACT(details, '$.name')) = 'Privilege Test Press'");
    assert.equal(audit.n, 1, 'the audit trigger fired');
    await app.query('CALL sp_get_next_body_part(1, @a, @b, @c, @d)');
    const [rows] = await app.query('CALL sp_rep_max_table(100, 10)');
    assert.equal(rows[0].length, 12);
  } finally {
    await app.query('ROLLBACK');
  }
});

test('the app cannot see triggers in the system catalogue, but sp_schema_stats (SECURITY DEFINER) reports them', { skip }, async () => {
  const [[direct]] = await app.query("SELECT COUNT(*) AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'physiq_db'");
  assert.equal(direct.n, 0, 'no TRIGGER privilege, so the catalogue shows none');
  const [[[stats]]] = [(await app.query('CALL sp_schema_stats()'))[0]];
  assert.equal(stats.triggers_count, 11);
  assert.equal(stats.tables_count, 12);
  assert.equal(stats.views_count, 5);
});

test('schema changes are refused: DDL, triggers, routines and drops', { skip }, async () => {
  await denied(app.query('CREATE TABLE privilege_test (id INT)'));
  await denied(app.query('ALTER TABLE users ADD COLUMN hacked INT'));
  await denied(app.query('DROP TABLE users'));
  await denied(app.query('TRUNCATE TABLE users'));
  await denied(app.query('DROP DATABASE physiq_db'));
  await denied(app.query('DROP VIEW view_weekly_summary'));
  await denied(app.query('CREATE INDEX idx_privilege_test ON users (name)'));
  await denied(app.query('CREATE TRIGGER trg_privilege_test BEFORE INSERT ON users FOR EACH ROW SET @x = 1'));
  await denied(app.query('CREATE PROCEDURE sp_privilege_test() SELECT 1'));
  await denied(app.query('DROP PROCEDURE sp_get_next_body_part'));
});

test('accounts, grants and other databases are out of reach', { skip }, async () => {
  await denied(app.query('SELECT user, authentication_string FROM mysql.user'));
  await denied(app.query("CREATE USER 'intruder'@'%' IDENTIFIED BY 'x'"));
  await denied(app.query("GRANT ALL ON *.* TO 'physiq_app'@'localhost'"));
  await denied(app.query('SET GLOBAL max_connections = 1'));
  await denied(app.query("SELECT LOAD_FILE('C:/Windows/win.ini')").then(([rows]) => {
    // LOAD_FILE needs the FILE privilege; without it MySQL returns NULL instead of erroring
    const value = Object.values(rows[0])[0];
    if (value === null) throw Object.assign(new Error('NULL'), { code: 'ACCESS_DENIED (FILE privilege missing)' });
  }));
});
