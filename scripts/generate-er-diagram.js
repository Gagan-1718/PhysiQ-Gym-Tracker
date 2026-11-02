#!/usr/bin/env node
/*
 * Generates docs/diagrams/er-diagram.mmd (Mermaid erDiagram) from the live
 * physiq_db catalogue, so the diagram always matches the real schema:
 * columns, primary / foreign / unique keys and every foreign-key relationship
 * with its cardinality (taken from nullability and uniqueness).
 *
 * Usage: npm run docs:er        (after npm run db:init)
 * Render the .mmd with https://mermaid.live or `npx @mermaid-js/mermaid-cli`.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');

const ROOT = path.join(__dirname, '..');
loadEnvConfig(ROOT);
const DB = process.env.MYSQL_DATABASE || 'physiq_db';

const ORDER = [
  'users', 'splits', 'split_days', 'split_day_muscles', 'muscle_groups', 'exercises',
  'workout_sessions', 'sets', 'personal_records', 'body_measurements', 'user_daily_fuel', 'admin_audit_logs',
];

// Mermaid attribute types cannot contain commas or spaces
const typeName = (columnType) => columnType.replace(/\(.*\)/, '').replace(/\s+unsigned/, '').replace(/\s+/g, '_');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  });
  const q = async (sql) => (await conn.query(sql, [DB]))[0];

  const columns = await q(
    `SELECT TABLE_NAME t, COLUMN_NAME c, COLUMN_TYPE ty, IS_NULLABLE n, COLUMN_KEY k
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const fks = await q(
    `SELECT TABLE_NAME t, COLUMN_NAME c, REFERENCED_TABLE_NAME rt
     FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  const indexRows = await q(
    `SELECT TABLE_NAME t, INDEX_NAME i, COLUMN_NAME c, NON_UNIQUE nu
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?`
  );
  await conn.end();

  // Columns that are UNIQUE on their own: the only column of a unique index or primary key.
  // (A column inside a composite unique index does not make that column unique alone.)
  const byIndex = new Map();
  for (const r of indexRows) {
    if (r.nu !== 0) continue;
    const key = `${r.t}.${r.i}`;
    byIndex.set(key, [...(byIndex.get(key) ?? []), `${r.t}.${r.c}`]);
  }
  const singleUnique = new Set([...byIndex.values()].filter((cols) => cols.length === 1).map((cols) => cols[0]));

  const fkSet = new Set(fks.map((f) => `${f.t}.${f.c}`));
  const colInfo = new Map(columns.map((c) => [`${c.t}.${c.c}`, c]));

  const out = ['erDiagram'];
  for (const table of ORDER) {
    out.push(`  ${table} {`);
    for (const c of columns.filter((x) => x.t === table)) {
      const keys = [];
      if (c.k === 'PRI') keys.push('PK');
      if (fkSet.has(`${c.t}.${c.c}`)) keys.push('FK');
      if (c.k === 'UNI' && !keys.includes('PK')) keys.push('UK');
      out.push(`    ${typeName(c.ty)} ${c.c}${keys.length ? ' ' + keys.join(',') : ''}`);
    }
    out.push('  }');
  }

  out.push('');
  // Declaring relationships in dependency order (parents before children) gives the layout engine
  // the cleanest ranking: user -> split chain first, then the lookup tables, then training data.
  const REL_ORDER = ['splits', 'split_days', 'split_day_muscles', 'exercises', 'workout_sessions', 'sets', 'personal_records', 'body_measurements', 'user_daily_fuel', 'admin_audit_logs'];
  for (const f of fks.sort((a, b) => REL_ORDER.indexOf(a.t) - REL_ORDER.indexOf(b.t) || ORDER.indexOf(a.rt) - ORDER.indexOf(b.rt))) {
    const col = colInfo.get(`${f.t}.${f.c}`);
    const optional = col.n === 'YES';
    const one = singleUnique.has(`${f.t}.${f.c}`); // the FK column is itself unique: at most one child
    const left = '||'; // every child row has exactly one parent when the column is NOT NULL
    const parent = optional ? '|o' : left;
    const child = one ? 'o|' : 'o{';
    out.push(`  ${f.rt} ${parent}--${child} ${f.t} : "${f.c}"`);
  }

  const target = path.join(ROOT, 'docs', 'diagrams', 'er-diagram.mmd');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out.join('\n') + '\n');
  console.log(`Wrote ${path.relative(ROOT, target)} (${ORDER.length} tables, ${fks.length} relationships)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
