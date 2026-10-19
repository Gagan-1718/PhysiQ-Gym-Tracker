const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '..', '..'));

const TEST_USER = 2_000_000_000; // never a real MySQL id
let client;
let db;

before(async () => {
  client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'physiq');
});

after(async () => {
  await db.collection('custom_routines').deleteMany({ user_id: TEST_USER });
  await db.collection('journey_stories').deleteMany({ user_id: TEST_USER });
  await client.close();
});

const isValidationError = (err) => err.code === 121 || assert.fail(`expected validation error, got ${err.code}: ${err.message}`);
const routine = (overrides = {}) => ({
  user_id: TEST_USER,
  name: `Routine ${Math.random()}`,
  exercises: [{ exercise_id: 1, name: 'Barbell Bench Press', target_sets: 3, rep_min: 6, rep_max: 10 }],
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

test('custom_routines accepts a valid nested routine', async () => {
  const res = await db.collection('custom_routines').insertOne(routine({ focus: 'Push' }));
  assert.ok(res.insertedId);
});

test('custom_routines rejects an empty exercise list', async () => {
  await assert.rejects(db.collection('custom_routines').insertOne(routine({ exercises: [] })), isValidationError);
});

test('custom_routines rejects a string user id and out-of-range targets', async () => {
  await assert.rejects(db.collection('custom_routines').insertOne(routine({ user_id: '1' })), isValidationError);
  await assert.rejects(
    db.collection('custom_routines').insertOne(
      routine({ exercises: [{ exercise_id: 1, name: 'Bench', target_sets: 99 }] })
    ),
    isValidationError
  );
});

test('custom_routines names are unique per user', async () => {
  await db.collection('custom_routines').insertOne(routine({ name: 'Same Name' }));
  await assert.rejects(
    db.collection('custom_routines').insertOne(routine({ name: 'Same Name' })),
    (err) => err.code === 11000
  );
});

test('journey_stories validates dates and moods but allows extra fields', async () => {
  const base = { user_id: TEST_USER, date: '2026-10-19', kind: 'workout_journal', created_at: new Date() };
  await db.collection('journey_stories').insertOne({ ...base, mood: 4, tags: ['pr'], playlist: 'Phonk mix' });
  await assert.rejects(db.collection('journey_stories').insertOne({ ...base, date: '19/10/2026' }), isValidationError);
  await assert.rejects(db.collection('journey_stories').insertOne({ ...base, mood: 9 }), isValidationError);
  await assert.rejects(db.collection('journey_stories').insertOne({ ...base, kind: 'selfie' }), isValidationError);
});
