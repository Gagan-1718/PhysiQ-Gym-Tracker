#!/usr/bin/env node
/*
 * Generates docs/DATA_DICTIONARY.md from the live physiq_db catalogue
 * (information_schema), so the dictionary can never drift from the schema.
 *
 * Usage: npm run docs:dictionary   (after npm run db:init)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');

const ROOT = path.join(__dirname, '..');
loadEnvConfig(ROOT);
const DB = process.env.MYSQL_DATABASE || 'physiq_db';

const TABLE_ORDER = [
  'users', 'muscle_groups', 'exercises', 'splits', 'split_days', 'split_day_muscles',
  'workout_sessions', 'sets', 'personal_records', 'body_measurements', 'user_daily_fuel', 'admin_audit_logs',
];

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  });

  const [columns] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, COLUMN_COMMENT, GENERATION_EXPRESSION
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [DB]
  );
  const [fks] = await conn.query(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB]
  );
  const [checks] = await conn.query(
    `SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
     FROM information_schema.TABLE_CONSTRAINTS tc
     JOIN information_schema.CHECK_CONSTRAINTS cc
       ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
     WHERE tc.TABLE_SCHEMA = ? AND tc.CONSTRAINT_TYPE = 'CHECK'
     ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME`,
    [DB]
  );
  const [indexes] = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
            GROUP_CONCAT(CONCAT(COLUMN_NAME, IF(COLLATION = 'D', ' DESC', '')) ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS cols
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?
     GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME = 'PRIMARY' DESC, INDEX_NAME`,
    [DB]
  );
  const [tableComments] = await conn.query(
    `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [DB]
  );
  const [routines] = await conn.query(
    `SELECT ROUTINE_TYPE, ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_TYPE, ROUTINE_NAME`,
    [DB]
  );
  const [triggers] = await conn.query(
    `SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
     FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`,
    [DB]
  );
  await conn.end();

  const views = tableComments.filter((t) => t.TABLE_TYPE === 'VIEW').map((t) => t.TABLE_NAME).sort();
  const fkOf = (t, c) => fks.find((f) => f.TABLE_NAME === t && f.COLUMN_NAME === c);

  const out = [];
  out.push('# PhysiQ Data Dictionary');
  out.push('');
  out.push('> Generated from the live `information_schema` by `npm run docs:dictionary`. Do not edit by hand.');
  out.push('');
  out.push(`**MySQL:** ${TABLE_ORDER.length} tables, ${views.length} views, ${routines.filter((r) => r.ROUTINE_TYPE === 'PROCEDURE').length} procedures, ` +
    `${routines.filter((r) => r.ROUTINE_TYPE === 'FUNCTION').length} functions, ${triggers.length} triggers.`);
  out.push('**MongoDB:** `custom_routines`, `journey_stories` (validators in `database/mongodb/`).');
  out.push('');

  TABLE_ORDER.forEach((table, i) => {
    out.push(`## ${i + 1}. \`${table}\``);
    out.push('');
    out.push('| Column | Type | Null | Default | Key | Notes |');
    out.push('|---|---|---|---|---|---|');
    for (const c of columns.filter((col) => col.TABLE_NAME === table)) {
      const fk = fkOf(table, c.COLUMN_NAME);
      const notes = [
        c.EXTRA && c.EXTRA !== 'DEFAULT_GENERATED' ? c.EXTRA.replace('DEFAULT_GENERATED ', '') : '',
        c.GENERATION_EXPRESSION ? `= ${c.GENERATION_EXPRESSION}` : '',
        fk ? `FK → \`${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\` ON DELETE ${fk.DELETE_RULE}` : '',
        c.COLUMN_COMMENT,
      ].filter(Boolean).join('; ');
      out.push(`| \`${c.COLUMN_NAME}\` | ${esc(c.COLUMN_TYPE)} | ${c.IS_NULLABLE === 'YES' ? 'yes' : 'no'} | ${esc(c.COLUMN_DEFAULT ?? '')} | ${c.COLUMN_KEY} | ${esc(notes)} |`);
    }
    const tableChecks = checks.filter((ck) => ck.TABLE_NAME === table);
    if (tableChecks.length) {
      out.push('');
      // Double-backtick code spans, because the clauses themselves contain backticks
      const clause = (ck) => esc(ck.CHECK_CLAUSE).replace(/\\'/g, "'");
      out.push('**Checks:** ' + tableChecks.map((ck) => `\`${ck.CONSTRAINT_NAME}\`: \`\` ${clause(ck)} \`\``).join(' · '));
    }
    const tableIndexes = indexes.filter((ix) => ix.TABLE_NAME === table);
    out.push('');
    out.push('**Indexes:** ' + tableIndexes.map((ix) => `\`${ix.INDEX_NAME}\`${ix.NON_UNIQUE ? '' : ' (unique)'} (${ix.cols})`).join(' · '));
    out.push('');
  });

  out.push('## Views');
  out.push('');
  out.push(views.map((v) => `- \`${v}\``).join('\n'));
  out.push('');
  out.push('## Stored routines');
  out.push('');
  out.push(routines.map((r) => `- ${r.ROUTINE_TYPE.toLowerCase()} \`${r.ROUTINE_NAME}\``).join('\n'));
  out.push('');
  out.push('## Triggers');
  out.push('');
  out.push('| Trigger | Timing | Event | Table |');
  out.push('|---|---|---|---|');
  for (const t of triggers) out.push(`| \`${t.TRIGGER_NAME}\` | ${t.ACTION_TIMING} | ${t.EVENT_MANIPULATION} | \`${t.EVENT_OBJECT_TABLE}\` |`);
  out.push('');

  const target = path.join(ROOT, 'docs', 'DATA_DICTIONARY.md');
  fs.writeFileSync(target, out.join('\n'));
  console.log(`Wrote ${path.relative(ROOT, target)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
