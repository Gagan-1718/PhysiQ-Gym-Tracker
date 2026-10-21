#!/usr/bin/env node
/*
 * Runs every *.test.js in one folder with node:test, one file at a time
 * (the suites share one database, so they must not run in parallel).
 *
 *   node scripts/run-tests.js tests/db
 *   node scripts/run-tests.js tests/api
 *
 * Passing explicit files to `node --test` works on every Node >= 20, unlike
 * directory or glob arguments (Node 24 rejects a bare directory).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/run-tests.js <folder>');
  process.exit(2);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .map((f) => path.join(dir, f));
if (files.length === 0) {
  console.error(`No *.test.js files in ${dir}`);
  process.exit(2);
}
const res = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);
