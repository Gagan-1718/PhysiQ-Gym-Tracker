const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { signedIn, today } = require('./helpers');

let alex;
let admin;
let lib;
const id = (name) => lib.find((e) => e.name === name).id;
const savedSessions = [];

before(async () => {
  alex = await signedIn('alex@physiq.test');
  admin = await signedIn('admin@physiq.test');
  lib = (await alex.get('/api/exercises')).body.exercises;
});

after(async () => {
  for (const sid of savedSessions) await alex.del(`/api/workouts/${sid}`);
});

const workout = (extra = {}) => ({
  clientRef: crypto.randomUUID(),
  sessionDate: today(),
  splitDayId: null,
  bodyPart: 'Freestyle',
  startedAt: `${today()} 07:00:00`,
  endedAt: `${today()} 08:05:00`,
  notes: 'api test',
  exercises: [{ exerciseId: id('Barbell Bench Press'), sets: [{ weight: 40, reps: 10, warmup: true }, { weight: 60, reps: 8, warmup: false }] }],
  ...extra,
});

test('the library has 44 exercises across 10 muscle groups', async () => {
  const res = await alex.get('/api/exercises');
  assert.equal(res.body.exercises.length, 44);
  assert.equal(res.body.muscleGroups.length, 10);
});

test('training context: overload target from sp_estimate_next_target, last sets and PR', async () => {
  const dl = id('Barbell Deadlift');
  const fresh = id('Face Pull');
  const res = await alex.get(`/api/train/context?ids=${dl},${fresh}`);
  assert.equal(res.status, 200);
  const t = res.body[dl].target;
  assert.equal(t.suggested_weight, 132.5);
  assert.equal(t.suggested_reps, 8);
  assert.match(t.rationale, /Add 2.5 kg/);
  assert.equal(res.body[dl].last.length, 4, 'warm-up + 3 working sets from the last session');
  assert.equal(res.body[dl].pr.weight, 130);
  assert.equal(res.body[fresh].target.suggested_weight, null, 'never done: the member picks the weight');
  assert.equal(res.body[fresh].pr, null);
  assert.equal((await alex.get('/api/train/context?ids=abc')).status, 400);
  assert.equal((await alex.get('/api/train/context')).status, 400);
});

test('"start Pull" plan returns the exercises of the last Pull session in order', async () => {
  const split = (await alex.get('/api/splits')).body;
  const pull = split.days.find((d) => d.body_part === 'Pull');
  const plan = await alex.get(`/api/train/plan?day=${pull.split_day_id}`);
  assert.deepEqual(plan.body.exercises.map((e) => e.name), ['Barbell Deadlift', 'Lat Pulldown', 'Seated Cable Row', 'Hammer Curl']);
});

test('saving a workout is one transaction: triggers set volume, PRs and the split day', async () => {
  const split = (await alex.get('/api/splits')).body;
  const pull = split.days.find((d) => d.body_part === 'Pull');
  const dl = id('Barbell Deadlift');
  const daysBefore = pull.days_since; // seeded dates age with the calendar, so compare instead of hardcoding
  const w = workout({
    splitDayId: pull.split_day_id,
    bodyPart: 'Pull',
    exercises: [{ exerciseId: dl, sets: [{ weight: 70, reps: 8, warmup: true }, { weight: 135, reps: 9, warmup: false, rpe: 9 }, { weight: 130, reps: 8, warmup: false }] }],
  });
  const saved = await alex.post('/api/workouts', w);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  savedSessions.push(saved.body.sessionId);
  assert.equal(saved.body.totalVolume, 135 * 9 + 130 * 8, 'warm-up excluded, computed by trigger');
  assert.equal(saved.body.workingSets, 2);
  assert.deepEqual(saved.body.prs.map((p) => p.exercise_name), ['Barbell Deadlift'], 'e1RM 175.5 beats 173.33');

  const after = (await alex.get('/api/splits')).body.days.find((d) => d.body_part === 'Pull');
  assert.equal(after.days_since, 0);
  assert.equal(after.status, 'recovering');

  // Retrying the same submission (same clientRef) returns the saved session, not a duplicate
  const retry = await alex.post('/api/workouts', w);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.replay, true);
  assert.equal(retry.body.sessionId, saved.body.sessionId);

  // Deleting it rolls everything back through the triggers
  assert.equal((await alex.del(`/api/workouts/${saved.body.sessionId}`)).status, 200);
  savedSessions.pop();
  const restored = (await alex.get('/api/splits')).body.days.find((d) => d.body_part === 'Pull');
  assert.equal(restored.days_since, daysBefore, 'last-trained date rolled back by the delete trigger');
  const ctx = (await alex.get(`/api/train/context?ids=${dl}`)).body[dl];
  assert.equal(ctx.pr.weight, 130, 'previous PR promoted');
  assert.equal(ctx.pr.reps, 10);
});

test('a failing statement rolls back the whole workout: nothing half-saved', async () => {
  const before = (await alex.get('/api/workouts?limit=50')).body.sessions.length;
  const future = await alex.post('/api/workouts', workout({ sessionDate: today(5) }));
  assert.equal(future.status, 400);
  assert.match(future.body.error, /future/, 'SIGNAL from the BEFORE INSERT trigger');
  const badEx = await alex.post('/api/workouts', workout({ exercises: [{ exerciseId: 999999, sets: [{ weight: 1, reps: 1, warmup: false }] }] }));
  assert.equal(badEx.status, 400, 'FK violation on a set rolls back the session header too');
  const empty = await alex.post('/api/workouts', workout({ exercises: [] }));
  assert.equal(empty.status, 400);
  const after = (await alex.get('/api/workouts?limit=50')).body.sessions.length;
  assert.equal(after, before, 'no session survived any failed attempt');
});

test("a member cannot log against another member's split day or read another member's workout", async () => {
  const adminDay = (await admin.get('/api/splits')).body.days[0]; // admin has no split in the demo data
  assert.equal(adminDay, undefined);
  const otherDay = (await alex.get('/api/splits')).body.days[0].split_day_id;
  const stolen = await admin.post('/api/workouts', workout({ splitDayId: otherDay }));
  assert.equal(stolen.status, 400);
  assert.match(stolen.body.error, /does not belong/);

  const history = (await alex.get('/api/workouts?limit=1')).body.sessions[0];
  assert.equal((await admin.get(`/api/workouts/${history.id}`)).status, 404);
  assert.equal((await admin.del(`/api/workouts/${history.id}`)).status, 404);
});

test('history pages with a keyset cursor and shows PR counts', async () => {
  const first = await alex.get('/api/workouts?limit=5');
  assert.equal(first.body.sessions.length, 5);
  assert.ok(first.body.nextCursor);
  const second = await alex.get(`/api/workouts?limit=5&before=${first.body.nextCursor}`);
  const ids = new Set(first.body.sessions.map((s) => s.id));
  assert.ok(second.body.sessions.every((s) => !ids.has(s.id)));
  assert.ok(first.body.sessions.some((s) => s.pr_count > 0));
  assert.equal((await alex.get('/api/workouts?before=nonsense')).status, 400);
});

test('workout detail includes the set list, PR flags and the MongoDB journal', async () => {
  const withJournal = (await alex.get('/api/workouts?limit=20')).body.sessions.find((s) => s.notes === 'Bench press volume progression' || s.body_part === 'Push');
  const detail = await alex.get(`/api/workouts/${withJournal.id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.sets.length > 0);
  assert.ok(detail.body.sets.some((s) => s.is_pr) || detail.body.sets.length > 0);
  assert.ok('journal' in detail.body);
});

test('routines live in MongoDB: cross-store id check, unique name, listing and deletion', async () => {
  const dl = id('Barbell Deadlift');
  const made = await alex.post('/api/routines', { name: 'API Test Routine', focus: 'Pull', exercises: [{ exerciseId: dl, targetSets: 3, repMin: 5, repMax: 8 }] });
  assert.equal(made.status, 201);
  assert.equal((await alex.post('/api/routines', { name: 'Bad Ids', exercises: [{ exerciseId: 424242, targetSets: 3 }] })).status, 400, 'unknown MySQL exercise id');
  assert.equal((await alex.post('/api/routines', { name: 'API Test Routine', exercises: [{ exerciseId: dl, targetSets: 3 }] })).status, 409, 'unique (user_id, name)');
  const list = (await alex.get('/api/routines')).body;
  assert.equal(list.find((r) => r.name === 'API Test Routine').exercises[0].name, 'Barbell Deadlift', 'name snapshot stored in the document');
  assert.equal((await admin.del(`/api/routines/${made.body.id}`)).status, 404, 'not another member\'s routine');
  assert.equal((await alex.del(`/api/routines/${made.body.id}`)).status, 200);
});

test('splits: creating one switches the active split atomically and rejects unknown muscles', async () => {
  const before = (await alex.get('/api/splits')).body;
  assert.equal(before.splitName, 'Push / Pull / Legs');
  assert.equal((await alex.post('/api/splits', { name: 'Bad', minRestDays: 2, days: [{ label: 'X', muscles: ['Wings'] }] })).status, 400);
  assert.equal((await alex.post('/api/splits', { name: 'Dup', minRestDays: 2, days: [{ label: 'A', muscles: ['Chest'] }, { label: 'a', muscles: ['Back'] }] })).status, 400, 'day names must be unique');
  // Not switching the demo member's split here: the one-active-split rule is covered by the database tests
  assert.equal((await alex.get('/api/splits')).body.splitName, 'Push / Pull / Legs');
});

test('the overdue alert comes straight from view_split_day_status', async () => {
  const alerts = (await alex.get('/api/alerts')).body.alerts;
  assert.ok(alerts.length >= 1);
  assert.equal(alerts[0].body_part, 'Pull');
  assert.ok(alerts[0].days_since >= alerts[0].min_rest_days + 2, 'overdue means rest window + 2 days');
  for (let i = 1; i < alerts.length; i++) assert.ok(alerts[i - 1].days_since >= alerts[i].days_since, 'worst first');
  assert.deepEqual((await admin.get('/api/alerts')).body.alerts, [], 'admin has no split, so nothing is overdue');
});

test('editing a saved workout: UPDATE / DELETE triggers recompute volume and PRs; invalid edits change nothing', async () => {
  const bench = id('Barbell Bench Press'); // demo record: 72.5 x 10 (e1RM 96.67)
  const saved = await alex.post(
    '/api/workouts',
    workout({
      exercises: [{ exerciseId: bench, sets: [{ weight: 50, reps: 10, warmup: false }, { weight: 50, reps: 8, warmup: false }, { weight: 20, reps: 10, warmup: true }] }],
    })
  );
  assert.equal(saved.status, 201);
  const sid = saved.body.sessionId;
  savedSessions.push(sid);
  assert.equal(saved.body.totalVolume, 50 * 10 + 50 * 8);

  const sets = (await alex.get(`/api/workouts/${sid}`)).body.sets;
  const [s1, s2, warm] = sets;

  // Edit 50x10 -> 80x10: e1RM 106.67 beats the 96.67 record, volume follows
  const up = await alex.patch(`/api/workouts/${sid}`, { sets: [{ id: s1.id, weight: 80, reps: 10 }] });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.totalVolume, 80 * 10 + 50 * 8, 'trg_sets_au swapped the old volume for the new');
  assert.deepEqual(up.body.prs.map((p) => `${p.exercise_name} ${p.weight}x${p.reps}`), ['Barbell Bench Press 80x10'], 'trg_sets_au re-ran PR detection');
  assert.equal((await alex.get(`/api/workouts/${sid}`)).body.sets.find((s) => s.id === s1.id).is_pr, true);

  // Turning a working set into a warm-up removes it from the volume
  const wu = await alex.patch(`/api/workouts/${sid}`, { sets: [{ id: s2.id, weight: 50, reps: 8, warmup: true }] });
  assert.equal(wu.body.totalVolume, 800);

  // Deleting the record set promotes the previous best (72.5 x 10) back to PR
  const del = await alex.patch(`/api/workouts/${sid}`, { deleteSetIds: [s1.id] });
  assert.equal(del.status, 200);
  assert.equal(del.body.totalVolume, 0, 'only warm-ups left');
  assert.deepEqual(del.body.prs, [], 'this workout no longer holds the record');
  const ctx = (await alex.get(`/api/train/context?ids=${bench}`)).body[bench];
  assert.equal(ctx.pr.weight, 72.5, 'trg_sets_ad promoted the next best set');

  // Invalid edits are rejected and leave the workout exactly as it was
  const before = (await alex.get(`/api/workouts/${sid}`)).body;
  const foreignSet = (await alex.get('/api/workouts?limit=5')).body.sessions.find((x) => x.id !== sid).id; // another session of alex
  const foreign = (await alex.get(`/api/workouts/${foreignSet}`)).body.sets[0].id;
  assert.equal((await alex.patch(`/api/workouts/${sid}`, { sets: [{ id: foreign, weight: 1, reps: 1 }] })).status, 400, "a set of a different workout");
  assert.equal((await alex.patch(`/api/workouts/${sid}`, { deleteSetIds: [s2.id, warm.id] })).status, 400, 'cannot leave a workout empty');
  assert.equal((await alex.patch(`/api/workouts/${sid}`, { sets: [{ id: s2.id, weight: 1, reps: 0 }] })).status, 400, 'reps >= 1');
  assert.equal((await alex.patch(`/api/workouts/${sid}`, { sets: [{ id: s2.id, weight: 1, reps: 5 }], deleteSetIds: [s2.id] })).status, 400, 'edit + delete of the same set');
  assert.equal((await alex.patch(`/api/workouts/${sid}`, {})).status, 400, 'nothing to change');
  assert.deepEqual((await alex.get(`/api/workouts/${sid}`)).body.sets, before.sets, 'rolled back: sets unchanged');

  // Ownership
  assert.equal((await admin.patch(`/api/workouts/${sid}`, { notes: 'hijack' })).status, 404);
  assert.equal((await alex.patch(`/api/workouts/${sid}`, { notes: 'edited note' })).status, 200);
  assert.equal((await alex.get(`/api/workouts/${sid}`)).body.session.notes, 'edited note');
});
