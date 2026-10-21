#!/usr/bin/env node
/*
 * PhysiQ database initialiser — builds both stores from the files in database/.
 *
 *   MySQL:   schema -> procedures -> triggers -> views -> indexes -> seeds
 *   MongoDB: validated collections (custom_routines, journey_stories) + indexes + demo docs
 *
 * Usage:
 *   npm run db:init            first-time setup; refuses to touch an existing physiq_db
 *   npm run db:reset           DROPS physiq_db and the Mongo collections, then rebuilds
 *   add -- --no-demo           skip the demo accounts and training history
 *
 * Reads MYSQL_* and MONGODB_* from .env / .env.local (same files Next.js uses).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { loadEnvConfig } = require('@next/env');

const ROOT = path.join(__dirname, '..');
loadEnvConfig(ROOT);

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const WITH_DEMO = !args.has('--no-demo');
const DB_NAME = 'physiq_db'; // fixed: the SQL files say `USE physiq_db`

const SQL_FILES = [
  'database/schema.sql',
  'database/procedures.sql',
  'database/triggers.sql',
  'database/views.sql',
  'database/indexes.sql',
  'database/roles.sql',
  'database/seeds/exercises.sql',
];
const DEMO_SQL_FILES = ['database/seeds/demo_data.sql'];

const MONGO_COLLECTIONS = [
  {
    name: 'custom_routines',
    schema: 'database/mongodb/custom_routines.schema.json',
    indexes: [
      { key: { user_id: 1, name: 1 }, name: 'uq_user_routine_name', unique: true },
      { key: { user_id: 1, last_used_at: -1 }, name: 'idx_user_last_used' },
    ],
  },
  {
    name: 'journey_stories',
    schema: 'database/mongodb/journey_stories.schema.json',
    indexes: [
      // (user_id, date, _id) matches the feed's ORDER BY and keyset cursor exactly, so no in-memory sort
      { key: { user_id: 1, date: -1, _id: -1 }, name: 'idx_user_timeline' },
      { key: { user_id: 1, tags: 1 }, name: 'idx_user_tags' },
      { key: { session_id: 1 }, name: 'idx_session', sparse: true },
      // Feed filtered by kind (journals / photos / milestones), newest first
      { key: { user_id: 1, kind: 1, date: -1 }, name: 'idx_user_kind_date' },
      // Full-text search over captions and tags (one text index per collection);
      // queries always add user_id, so a member only ever searches their own stories
      { key: { caption: 'text', tags: 'text' }, name: 'txt_caption_tags', weights: { caption: 2, tags: 1 }, default_language: 'english' },
    ],
  },
];

/**
 * Split a .sql file into statements the way the mysql CLI does, honouring
 * `DELIMITER` (a client-side command the server does not understand), quotes
 * and comments. Comments are dropped.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let current = '';
  let i = 0;
  let atLineStart = true;

  const push = () => {
    const stmt = current.trim();
    if (stmt) statements.push(stmt);
    current = '';
  };

  while (i < sql.length) {
    if (atLineStart) {
      const directive = /^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)/i.exec(sql.slice(i));
      if (directive) {
        if (current.trim()) throw new Error(`DELIMITER found inside an unterminated statement: ${current.trim().slice(0, 80)}`);
        delimiter = directive[1];
        i += directive[0].length;
        continue;
      }
    }

    const ch = sql[i];
    const next = sql[i + 1];

    // -- comment (MySQL needs whitespace after the dashes) or # comment
    if ((ch === '-' && next === '-' && (i + 2 >= sql.length || /\s/.test(sql[i + 2]))) || ch === '#') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    // /* block comment */
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    // quoted string / identifier
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && ch !== '`') {
          j += 2;
          continue;
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2; // doubled quote escape
            continue;
          }
          break;
        }
        j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      atLineStart = false;
      continue;
    }
    if (sql.startsWith(delimiter, i)) {
      push();
      i += delimiter.length;
      atLineStart = false;
      continue;
    }

    current += ch;
    atLineStart = ch === '\n';
    i++;
  }
  push();
  return statements;
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  };
}

async function runSqlFile(conn, relPath) {
  const sql = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      err.message = `${relPath}: ${err.message}\n--- statement ---\n${stmt.slice(0, 400)}`;
      throw err;
    }
  }
  console.log(`  ✓ ${relPath} (${statements.length} statements)`);
}

/**
 * Create the least-privilege application account (MySQL 8 role physiq_app, see
 * database/roles.sql). Only when MYSQL_APP_USER is set; otherwise the app keeps
 * using the admin account, which is fine for a quick local trial but not for a real deployment.
 */
function appAccountConfig() {
  const user = process.env.MYSQL_APP_USER;
  if (!user) return null;
  const password = process.env.MYSQL_APP_PASSWORD;
  if (!password) throw new Error('MYSQL_APP_PASSWORD is required when MYSQL_APP_USER is set.');
  if (!/^[A-Za-z0-9_]{1,32}$/.test(user)) throw new Error('MYSQL_APP_USER may only contain letters, digits and underscores.');
  // MySQL keeps users and roles in one namespace ('name'@'%'): an account named like a role would BE the role
  if (/^physiq_(app|readonly)$/i.test(user)) {
    throw new Error(`MYSQL_APP_USER must not be called ${user}: that is the name of a role. Use a different name, for example physiq_web.`);
  }
  const host = process.env.MYSQL_APP_HOST || 'localhost';
  if (!/^[A-Za-z0-9_.%:-]{1,60}$/.test(host)) throw new Error('MYSQL_APP_HOST contains unexpected characters.');
  return { user, password, host };
}

async function createAppAccount(conn, account) {
  if (!account) {
    console.log('  ! MYSQL_APP_USER is not set: the app will connect with the admin account (set it for least privilege)');
    return;
  }
  const { user, password, host } = account;

  // Identifiers cannot be bound as parameters; they are validated above. The password is bound.
  await conn.query(`CREATE USER IF NOT EXISTS '${user}'@'${host}' IDENTIFIED BY ?`, [password]);
  await conn.query(`ALTER USER '${user}'@'${host}' IDENTIFIED BY ?`, [password]); // keeps the password in sync with .env
  await conn.query(`GRANT 'physiq_app' TO '${user}'@'${host}'`);
  await conn.query(`SET DEFAULT ROLE 'physiq_app' TO '${user}'@'${host}'`);
  console.log(`  ✓ application account '${user}'@'${host}' with role physiq_app (DML + EXECUTE only)`);
}

async function initMySQL() {
  // Check the app-account settings first: a typo must not be discovered after the old database was dropped
  const account = appAccountConfig();
  const conn = await mysql.createConnection(mysqlConfig());
  try {
    const [rows] = await conn.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [DB_NAME]);
    if (rows.length && !RESET) {
      throw new Error(
        `Database "${DB_NAME}" already exists. Nothing was changed.\n` +
          `Run "npm run db:reset" to DROP it (all workouts are lost) and rebuild.`
      );
    }
    if (rows.length) {
      console.log(`  ! dropping existing ${DB_NAME}`);
      await conn.query(`DROP DATABASE ${DB_NAME}`);
    }

    const files = WITH_DEMO ? [...SQL_FILES, ...DEMO_SQL_FILES] : SQL_FILES;
    for (const file of files) await runSqlFile(conn, file);
    await createAppAccount(conn, account);

    const [[counts]] = await conn.query(`
      SELECT (SELECT COUNT(*) FROM ${DB_NAME}.exercises) AS exercises,
             (SELECT COUNT(*) FROM ${DB_NAME}.users) AS users,
             (SELECT COUNT(*) FROM ${DB_NAME}.workout_sessions) AS sessions,
             (SELECT COUNT(*) FROM ${DB_NAME}.sets) AS sets_logged,
             (SELECT COUNT(*) FROM ${DB_NAME}.personal_records) AS personal_records`);
    console.log(`  = ${JSON.stringify(counts)}`);
  } finally {
    await conn.end();
  }
}

async function seedMongoDemo(db) {
  const conn = await mysql.createConnection({ ...mysqlConfig(), database: DB_NAME });
  try {
    const [[alex]] = await conn.query("SELECT id FROM users WHERE email = 'alex@physiq.test'");
    if (!alex) return;
    const [exerciseRows] = await conn.query('SELECT id, name FROM exercises');
    const exerciseId = Object.fromEntries(exerciseRows.map((r) => [r.name, r.id]));
    const [sessions] = await conn.query(
      `SELECT id, DATE_FORMAT(session_date, '%Y-%m-%d') AS date, body_part
       FROM workout_sessions WHERE user_id = ? ORDER BY session_date`,
      [alex.id]
    );
    const [weights] = await conn.query(
      `SELECT DATE_FORMAT(recorded_on, '%Y-%m-%d') AS date, weight FROM body_measurements
       WHERE user_id = ? ORDER BY recorded_on`,
      [alex.id]
    );

    const now = new Date();
    const item = (name, sets, repMin, repMax, rest, superset = null) => {
      if (!exerciseId[name]) throw new Error(`Unknown exercise in demo routine: ${name}`);
      return { exercise_id: exerciseId[name], name, target_sets: sets, rep_min: repMin, rep_max: repMax, rest_seconds: rest, superset };
    };
    await db.collection('custom_routines').insertMany([
      {
        user_id: alex.id,
        name: 'Heavy Push',
        focus: 'Push',
        notes: 'Bench first while fresh. Laterals and pushdowns as a superset.',
        exercises: [
          item('Barbell Bench Press', 3, 6, 10, 180),
          item('Incline Dumbbell Press', 3, 8, 12, 120),
          item('Dumbbell Lateral Raise', 3, 10, 15, 60, 'A'),
          item('Triceps Rope Pushdown', 3, 10, 15, 60, 'A'),
        ],
        times_used: 6,
        last_used_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        user_id: alex.id,
        name: 'Back Width',
        focus: 'Pull',
        notes: null,
        exercises: [
          item('Lat Pulldown', 4, 8, 12, 120),
          item('Seated Cable Row', 3, 8, 12, 120),
          item('Face Pull', 3, 12, 20, 60, 'A'),
          item('Hammer Curl', 3, 10, 12, 60, 'A'),
        ],
        times_used: 2,
        last_used_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    const journals = [
      { at: 0, mood: 3, energy: 3, tags: ['first-week', 'controlled'], caption: 'Back on a proper split. Leaving reps in the tank this week.' },
      { at: 4, mood: 4, energy: 4, tags: ['evening', 'pre-workout'], caption: 'Pulls felt strong, grip held up on the last deadlift set.' },
      { at: 8, mood: 2, energy: 2, tags: ['low-sleep'], caption: 'Only 5 hours of sleep. Still showed up, kept it tight.' },
      { at: 12, mood: 5, energy: 5, tags: ['pr', 'bench'], caption: 'Bench flew today. Best session in weeks.' },
      { at: 16, mood: 4, energy: 3, tags: ['deadlift', 'grip'], caption: 'Deadlift smooth; grip was the limiter. Chalk next time.' },
      { at: 18, mood: 4, energy: 4, tags: ['streak'], caption: 'Five weeks consistent. Waist steady, arms up 0.8 cm.' },
    ];
    const weightOn = (date) => {
      let latest = null;
      for (const w of weights) if (w.date <= date) latest = w.weight;
      return latest === null ? null : Number(latest);
    };
    await db.collection('journey_stories').insertMany(
      journals
        .filter((j) => sessions[j.at])
        .map((j) => {
          const s = sessions[j.at];
          return {
            user_id: alex.id,
            date: s.date,
            kind: 'workout_journal',
            session_id: s.id,
            week_number: Math.floor(j.at / 3.8) + 1,
            caption: j.caption,
            mood: j.mood,
            energy: j.energy,
            tags: j.tags,
            weight_snapshot: weightOn(s.date),
            highlights: [{ type: 'focus', label: s.body_part }],
            created_at: new Date(`${s.date}T19:30:00`),
          };
        })
    );
    console.log('  ✓ demo routines and journey stories');
  } finally {
    await conn.end();
  }
}

async function initMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB || 'physiq';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db(dbName);
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const coll of MONGO_COLLECTIONS) {
      const validator = JSON.parse(fs.readFileSync(path.join(ROOT, coll.schema), 'utf8'));
      if (existing.has(coll.name)) await db.collection(coll.name).drop();
      await db.createCollection(coll.name, { validator, validationLevel: 'strict', validationAction: 'error' });
      await db.collection(coll.name).createIndexes(coll.indexes);
      console.log(`  ✓ ${dbName}.${coll.name} (validator + ${coll.indexes.length} indexes)`);
    }
    if (WITH_DEMO) await seedMongoDemo(db);
  } finally {
    await client.close();
  }
}

async function main() {
  console.log(`PhysiQ database init${RESET ? ' (RESET)' : ''}${WITH_DEMO ? '' : ' (no demo data)'}`);
  console.log('MySQL');
  await initMySQL();
  console.log('MongoDB');
  await initMongo();
  console.log('Done.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { splitSqlStatements };
