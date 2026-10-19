const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, inRollback, createUser, createSplit, createSession, addSet, exerciseId, one, callOut } = require('./helpers');

after(() => pool.end());

const nextBodyPart = (conn, userId) =>
  callOut(conn, 'sp_get_next_body_part', [userId], ['split_day_id', 'body_part', 'days_since', 'status']);
const target = (conn, userId, exId) =>
  callOut(conn, 'sp_estimate_next_target', [userId, exId], [
    'suggested_weight', 'suggested_reps', 'last_weight', 'last_reps', 'last_date', 'rationale',
  ]);

test('fn_calculate_1rm implements Epley and handles edge cases', () =>
  inRollback(async (conn) => {
    const r = await one(conn, 'SELECT fn_calculate_1rm(100, 1) a, fn_calculate_1rm(100, 10) b, fn_calculate_1rm(80, 5) c, fn_calculate_1rm(50, 0) d');
    assert.deepEqual(r, { a: 100, b: 133.33, c: 93.33, d: 0 });
  }));

test('sp_get_next_body_part falls back to Full Body without an active split', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const rec = await nextBodyPart(conn, userId);
    assert.equal(rec.body_part, 'Full Body');
    assert.equal(rec.status, 'new');
    assert.equal(rec.split_day_id, null);
  }));

test('sp_get_next_body_part prefers never-trained days, in split order', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const { days } = await createSplit(conn, userId);
    await createSession(conn, { userId, splitDayId: days.Push, daysAgo: 5 });
    const rec = await nextBodyPart(conn, userId);
    assert.equal(rec.body_part, 'Pull');
    assert.equal(rec.status, 'new');
  }));

test('sp_get_next_body_part ranks overdue > ready > recovering and reports statuses', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const { days } = await createSplit(conn, userId);
    await createSession(conn, { userId, splitDayId: days.Push, daysAgo: 1 });
    await createSession(conn, { userId, splitDayId: days.Legs, daysAgo: 3, bodyPart: 'Legs' });
    await createSession(conn, { userId, splitDayId: days.Pull, daysAgo: 6, bodyPart: 'Pull' });

    const rec = await nextBodyPart(conn, userId);
    assert.deepEqual([rec.body_part, rec.days_since, rec.status], ['Pull', 6, 'overdue']);

    const [rows] = await conn.query(
      'SELECT body_part, status, days_until_ready FROM view_split_day_status WHERE user_id = ? ORDER BY priority_rank',
      [userId]
    );
    assert.deepEqual(rows, [
      { body_part: 'Pull', status: 'overdue', days_until_ready: 0 },
      { body_part: 'Legs', status: 'ready', days_until_ready: 0 },
      { body_part: 'Push', status: 'recovering', days_until_ready: 1 },
    ]);
  }));

test('sp_get_next_body_part ignores inactive splits', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    await createSplit(conn, userId, [['Upper', 2]], false);
    assert.equal((await nextBodyPart(conn, userId)).body_part, 'Full Body');
  }));

test('sp_estimate_next_target: 10+ reps -> +2.5 kg at 8 reps', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const s = await createSession(conn, { userId, daysAgo: 2 });
    await addSet(conn, s, bench, { n: 1, reps: 12, weight: 40, warmup: true });
    await addSet(conn, s, bench, { n: 2, reps: 10, weight: 80 });
    await addSet(conn, s, bench, { n: 3, reps: 8, weight: 80 });
    const t = await target(conn, userId, bench);
    assert.equal(t.suggested_weight, 82.5);
    assert.equal(t.suggested_reps, 8);
    assert.equal(t.last_weight, 80);
    assert.equal(t.last_reps, 10);
  }));

test('sp_estimate_next_target: under 10 reps -> same weight, +1 rep, using the latest session', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await addSet(conn, await createSession(conn, { userId, daysAgo: 9 }), bench, { reps: 10, weight: 100 });
    await addSet(conn, await createSession(conn, { userId, daysAgo: 2 }), bench, { reps: 6, weight: 85 });
    const t = await target(conn, userId, bench);
    assert.equal(t.suggested_weight, 85);
    assert.equal(t.suggested_reps, 7);
  }));

test('sp_estimate_next_target: bodyweight adds a rep; no history leaves weight to the user', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const pullUp = await exerciseId(conn, 'Pull-Up');
    const fresh = await target(conn, userId, pullUp);
    assert.equal(fresh.suggested_weight, null);
    assert.equal(fresh.suggested_reps, 10);

    await addSet(conn, await createSession(conn, { userId }), pullUp, { reps: 12, weight: 0 });
    const t = await target(conn, userId, pullUp);
    assert.equal(t.suggested_weight, 0);
    assert.equal(t.suggested_reps, 13);
  }));

test('daily fuel targets come from the latest body weight and goal', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn, { starting_weight: 70, goal: 'fat_loss' });
    await conn.query(
      'INSERT INTO body_measurements (user_id, recorded_on, weight) VALUES (?, DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 80)',
      [userId]
    );
    const [[[fuel]]] = await conn.query('CALL sp_get_daily_fuel(?, CURRENT_DATE)', [userId]);
    assert.equal(fuel.protein_target_g, 160); // 80 kg * 2 g
    assert.equal(fuel.water_target_ml, 3200); // 80 kg * 40 ml
    assert.equal(fuel.calorie_target, 80 * 33 - 400);
    assert.equal(fuel.body_weight_kg, 80);
  }));

test('sp_log_fuel adds and subtracts, clamping at zero', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    await conn.query('CALL sp_log_fuel(?, CURRENT_DATE, 40, 500)', [userId]);
    const [[[after]]] = await conn.query('CALL sp_log_fuel(?, CURRENT_DATE, 25, -800)', [userId]);
    assert.equal(after.protein_logged_g, 65);
    assert.equal(after.water_logged_ml, 0);
  }));

test("past days keep their fuel targets; today's follow a new weigh-in", () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn, { starting_weight: 70 });
    await conn.query('CALL sp_ensure_daily_fuel(?, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY))', [userId]);
    await conn.query('CALL sp_ensure_daily_fuel(?, CURRENT_DATE)', [userId]);
    await conn.query('INSERT INTO body_measurements (user_id, recorded_on, weight) VALUES (?, DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 90)', [userId]);
    await conn.query('CALL sp_ensure_daily_fuel(?, DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY))', [userId]);
    await conn.query('CALL sp_ensure_daily_fuel(?, CURRENT_DATE)', [userId]);

    const [rows] = await conn.query(
      'SELECT DATEDIFF(CURRENT_DATE, fuel_date) AS ago, protein_target_g FROM user_daily_fuel WHERE user_id = ? ORDER BY fuel_date',
      [userId]
    );
    assert.deepEqual(rows, [
      { ago: 2, protein_target_g: 140 },
      { ago: 0, protein_target_g: 180 },
    ]);
  }));

test('view_weekly_summary and view_weekly_muscle_volume aggregate a week correctly', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const row = await exerciseId(conn, 'Seated Cable Row');
    // Two sessions in the current ISO week (today, and today again as a second session)
    const s1 = await createSession(conn, { userId });
    await addSet(conn, s1, bench, { n: 1, reps: 10, weight: 40, warmup: true });
    await addSet(conn, s1, bench, { n: 2, reps: 5, weight: 100 });
    const s2 = await createSession(conn, { userId, bodyPart: 'Pull' });
    await addSet(conn, s2, row, { n: 1, reps: 10, weight: 50 });

    const week = await one(conn, 'SELECT * FROM view_weekly_summary WHERE user_id = ?', [userId]);
    assert.equal(week.sessions_completed, 2);
    assert.equal(week.total_volume, 500 + 500);
    assert.equal(week.working_sets, 2);

    const [muscles] = await conn.query(
      'SELECT muscle_group, working_sets, volume FROM view_weekly_muscle_volume WHERE user_id = ? ORDER BY muscle_group',
      [userId]
    );
    assert.deepEqual(muscles, [
      { muscle_group: 'Back', working_sets: 1, volume: 500 },
      { muscle_group: 'Chest', working_sets: 1, volume: 500 },
    ]);
  }));
