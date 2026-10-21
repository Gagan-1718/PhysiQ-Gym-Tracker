const crypto = require('crypto');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { client, signedIn, uniqueEmail, DEMO_PASSWORD, BASE } = require('./helpers');

const cleanup = [];
after(async () => {
  for (const c of cleanup) await c.del('/api/me', { password: DEMO_PASSWORD });
});

test('anonymous visitors: pages redirect to login, APIs answer 401, health shows only a status', async () => {
  const anon = client();
  const page = await anon.req('/');
  assert.equal(page.status, 307);
  assert.match(page.headers.get('location'), /\/login\?callbackUrl=%2F/);
  for (const path of ['/api/me', '/api/splits', '/api/workouts', '/api/progress', '/api/fuel?date=2026-01-01', '/api/exercises', '/api/alerts', '/api/routines', '/api/body']) {
    assert.equal((await anon.get(path)).status, 401, path);
  }
  const health = await anon.get('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok' }, 'no database details for anonymous callers');
});

test('the PWA assets and service worker are public', async () => {
  const anon = client();
  for (const path of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/apple-icon.png', '/icon.svg']) {
    assert.equal((await anon.get(path)).status, 200, path);
  }
  const manifest = (await anon.get('/manifest.webmanifest')).body;
  assert.equal(manifest.display, 'standalone');
});

test('registration validates input, hashes the password, rejects duplicates case-insensitively', async () => {
  const anon = client();
  const email = uniqueEmail('auth');
  assert.equal((await anon.post('/api/auth/register', { name: 'A', email: 'nope', password: '123' })).status, 400);
  assert.equal((await anon.req('/api/auth/register', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  const created = await anon.post('/api/auth/register', { name: 'Auth Tester', email, password: DEMO_PASSWORD });
  assert.equal(created.status, 201);
  const dup = await anon.post('/api/auth/register', { name: 'Auth Tester', email: email.toUpperCase(), password: DEMO_PASSWORD });
  assert.equal(dup.status, 409);
  const c = client();
  await c.login(email);
  cleanup.push(c);
});

test('wrong password and unknown email both fail the same way', async () => {
  const anon = client();
  const { body } = await anon.get('/api/auth/csrf');
  for (const email of ['alex@physiq.test', 'nobody-here@physiq.test']) {
    const res = await anon.req('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: body.csrfToken, email, password: 'definitely-wrong', json: 'true' }),
    });
    assert.equal(res.status, 401, email);
  }
  assert.equal((await anon.get('/api/auth/session')).body.user, undefined);
});

test('a session exposes id, name, email and role; profile edits are validated and cannot change the role', async () => {
  const alex = await signedIn('alex@physiq.test');
  const me = (await alex.get('/api/me')).body;
  assert.equal(me.role, 'member');
  assert.equal(me.needsOnboarding, false);
  assert.equal(me.weekly_goal, 4);

  assert.equal((await alex.patch('/api/me', { role: 'admin' })).status, 400, 'role is not editable');
  assert.equal((await alex.patch('/api/me', { weekly_goal: 9 })).status, 400);
  assert.equal((await alex.patch('/api/me', { height: 50 })).status, 400);
  assert.equal((await alex.patch('/api/me', {})).status, 400, 'nothing to update');
  assert.equal((await alex.patch('/api/me', { weekly_goal: 4 })).status, 200);
});

test('health details, library writes and the audit log are role-gated', async () => {
  const alex = await signedIn('alex@physiq.test');
  const admin = await signedIn('admin@physiq.test');

  const detail = (await alex.get('/api/health')).body;
  assert.equal(detail.status, 'ok');
  assert.equal(detail.mysql.ok, true);
  assert.equal(detail.mongodb.ok, true);
  assert.equal(detail.mysql.value.tables, 12);
  assert.equal(detail.mysql.value.triggers, 11);

  assert.equal((await alex.post('/api/exercises', { name: 'Member Move', muscleGroupId: 1, equipment: 'Machine' })).status, 403);
  assert.equal((await alex.get('/api/admin/audit')).status, 403);
  assert.equal((await alex.del('/api/exercises/1')).status, 403);

  const added = await admin.post('/api/exercises', { name: 'Auth Test Pec Deck', muscleGroupId: 1, equipment: 'Machine' });
  assert.equal(added.status, 201);
  const audit = await admin.get('/api/admin/audit');
  assert.equal(audit.body[0].action, 'INSERT');
  assert.equal(audit.body[0].admin_name, 'PhysiQ Admin', 'the trigger recorded who acted');
  assert.equal((await admin.del(`/api/exercises/${added.body.id}`)).status, 200);

  // A trained exercise cannot be deleted: ON DELETE RESTRICT -> 409 (also with the restricted app account,
  // which receives the short foreign-key error codes)
  const trained = (await alex.get('/api/exercises')).body.exercises.find((e) => e.name === 'Barbell Bench Press');
  assert.equal((await admin.del(`/api/exercises/${trained.id}`)).status, 409);
  const ghost = await admin.post('/api/workouts', { clientRef: crypto.randomUUID(), sessionDate: new Date().toISOString().slice(0, 10), splitDayId: null, bodyPart: 'X', startedAt: null, endedAt: null, exercises: [{ exerciseId: 999999, sets: [{ weight: 1, reps: 1, warmup: false }] }] });
  assert.equal(ghost.status, 400, 'FK violation on a set is a 400, not a 500');
});

test('account deletion needs the password and signs the session out of the data', async () => {
  const email = uniqueEmail('delete');
  const c = client();
  await c.post('/api/auth/register', { name: 'Delete Me', email, password: DEMO_PASSWORD });
  await c.login(email);
  assert.equal((await c.del('/api/me', { password: 'wrong-password' })).status, 403);
  assert.equal((await c.del('/api/me', { password: DEMO_PASSWORD })).status, 200);
  assert.equal((await c.get('/api/me')).status, 401, 'the deleted account no longer resolves');
  assert.ok(BASE);
});

test('data export returns the member\'s own data from both databases and never the password hash', async () => {
  const alex = await signedIn('alex@physiq.test');
  const res = await alex.get('/api/me/export');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="physiq-export-\d{4}-\d{2}-\d{2}\.json"/);
  const data = res.body;
  assert.equal(data.format, 'physiq-export/1');
  assert.equal(data.profile.email, 'alex@physiq.test');
  assert.ok(!JSON.stringify(data).includes('password_hash') && !JSON.stringify(data).includes('$2a$'), 'no credentials in the export');
  assert.ok(data.workouts.length >= 19, 'MySQL workouts');
  assert.ok(data.workouts.every((w) => Array.isArray(w.sets) && w.sets.length > 0), 'sets nested under each workout');
  assert.ok(data.personalRecords.length >= 12 && data.bodyMeasurements.length >= 6 && data.dailyFuel.length >= 7);
  assert.ok(data.journey.length >= 6 && data.routines.length >= 2, 'MongoDB stories and routines');

  const admin = await signedIn('admin@physiq.test');
  const other = (await admin.get('/api/me/export')).body;
  assert.equal(other.profile.email, 'admin@physiq.test');
  assert.equal(other.workouts.length, 0, "never another member's data");
  assert.equal((await client().get('/api/me/export')).status, 401);
});
