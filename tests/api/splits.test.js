const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { DEMO_PASSWORD, client, today, uniqueEmail } = require('./helpers');

const PPL = {
  name: 'Push / Pull / Legs',
  minRestDays: 2,
  days: [
    { label: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'] },
    { label: 'Pull', muscles: ['Back', 'Biceps'] },
    { label: 'Legs', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'] },
  ],
};
const UPPER_LOWER = {
  name: 'Upper / Lower',
  minRestDays: 2,
  days: [
    { label: 'Upper', muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'] },
    { label: 'Lower', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'] },
  ],
};

test('switching splits carries recovery over, and logging or editing is never blocked by time', async () => {
  const c = client();
  const email = uniqueEmail('split');
  await c.post('/api/auth/register', { name: 'Split Tester', email, password: DEMO_PASSWORD });
  await c.login(email);
  try {
    const lib = (await c.get('/api/exercises')).body.exercises;
    const id = (name) => lib.find((e) => e.name === name).id;

    assert.equal((await c.post('/api/splits', PPL)).status, 201);
    const push = (await c.get('/api/splits')).body.days.find((d) => d.body_part === 'Push');

    const yesterday = today(-1);
    const workout = (extra) => ({ clientRef: crypto.randomUUID(), sessionDate: yesterday, startedAt: null, endedAt: null, ...extra });
    const first = await c.post('/api/workouts', workout({
      splitDayId: push.split_day_id,
      bodyPart: 'Push',
      exercises: [{ exerciseId: id('Barbell Bench Press'), sets: [{ weight: 60, reps: 8, warmup: false }] }],
    }));
    assert.equal(first.status, 201);
    // A second session on the same day is allowed; warm-up sets alone do not count as training a muscle
    const second = await c.post('/api/workouts', workout({
      splitDayId: null,
      bodyPart: 'Freestyle',
      exercises: [{ exerciseId: id('Barbell Back Squat'), sets: [{ weight: 40, reps: 10, warmup: true }] }],
    }));
    assert.equal(second.status, 201, 'two workouts on one day');

    assert.equal((await c.post('/api/splits', UPPER_LOWER)).status, 201);
    const days = (await c.get('/api/splits')).body.days;
    const upper = days.find((d) => d.body_part === 'Upper');
    const lower = days.find((d) => d.body_part === 'Lower');
    assert.equal(upper.last_trained_date, yesterday, 'chest was trained yesterday, so Upper inherits that date');
    assert.equal(lower.last_trained_date, null, 'only warm-up squats: Lower stays untrained');
    assert.equal(upper.status, 'recovering');
    assert.deepEqual(days.map((d) => d.min_rest_days), [2, 2], "the template's rest days are kept");

    // Yesterday's workout can still be corrected
    const sets = (await c.get(`/api/workouts/${first.body.sessionId}`)).body.sets;
    assert.equal((await c.patch(`/api/workouts/${first.body.sessionId}`, { sets: [{ id: sets[0].id, weight: 62.5, reps: 8 }] })).status, 200);
  } finally {
    assert.equal((await c.del('/api/me', { password: DEMO_PASSWORD })).status, 200);
  }
});
