const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, inRollback, createUser, createSplit, createSession, addSet, exerciseId, one } = require('./helpers');

after(() => pool.end());

const volume = async (conn, sessionId) =>
  (await one(conn, 'SELECT total_volume FROM workout_sessions WHERE id = ?', [sessionId])).total_volume;
const lastTrained = async (conn, dayId) =>
  (await one(conn, 'SELECT last_trained_date AS d, DATEDIFF(CURRENT_DATE, last_trained_date) AS ago FROM split_days WHERE id = ?', [dayId])).ago;
const prSet = async (conn, userId, exId) =>
  (await one(conn, 'SELECT set_id FROM personal_records WHERE user_id = ? AND exercise_id = ?', [userId, exId]))?.set_id ?? null;

test('total_volume counts working sets only and follows inserts, updates and deletes', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const session = await createSession(conn, { userId });
    const bench = await exerciseId(conn, 'Barbell Bench Press');

    await addSet(conn, session, bench, { n: 1, reps: 10, weight: 40, warmup: true });
    assert.equal(await volume(conn, session), 0);

    const s2 = await addSet(conn, session, bench, { n: 2, reps: 8, weight: 80 });
    await addSet(conn, session, bench, { n: 3, reps: 6, weight: 85 });
    assert.equal(await volume(conn, session), 8 * 80 + 6 * 85);

    await conn.query('UPDATE sets SET reps = 10 WHERE id = ?', [s2]);
    assert.equal(await volume(conn, session), 10 * 80 + 6 * 85);

    await conn.query('UPDATE sets SET is_warmup = TRUE WHERE id = ?', [s2]);
    assert.equal(await volume(conn, session), 6 * 85);

    await conn.query('DELETE FROM sets WHERE session_id = ?', [session]);
    assert.equal(await volume(conn, session), 0);
  }));

test('last_trained_date tracks the latest session and never moves backwards on a backdated log', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const { days } = await createSplit(conn, userId);

    const recent = await createSession(conn, { userId, splitDayId: days.Pull, daysAgo: 2, bodyPart: 'Pull' });
    assert.equal(await lastTrained(conn, days.Pull), 2);

    const older = await createSession(conn, { userId, splitDayId: days.Pull, daysAgo: 9, bodyPart: 'Pull' });
    assert.equal(await lastTrained(conn, days.Pull), 2, 'backdated session must not regress the date');

    await conn.query('DELETE FROM workout_sessions WHERE id = ?', [recent]);
    assert.equal(await lastTrained(conn, days.Pull), 9, 'deleting the latest session rolls back to the previous one');

    await conn.query('UPDATE workout_sessions SET session_date = DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY) WHERE id = ?', [older]);
    assert.equal(await lastTrained(conn, days.Pull), 4, 'editing the date recomputes');

    await conn.query('UPDATE workout_sessions SET split_day_id = ? WHERE id = ?', [days.Legs, older]);
    assert.equal(await lastTrained(conn, days.Pull), null, 'moving the only session away clears the day');
    assert.equal(await lastTrained(conn, days.Legs), 4);
  }));

test('the first working set becomes a PR; warm-ups never do', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const session = await createSession(conn, { userId });
    const bench = await exerciseId(conn, 'Barbell Bench Press');

    await addSet(conn, session, bench, { n: 1, reps: 10, weight: 100, warmup: true });
    assert.equal(await prSet(conn, userId, bench), null);

    const working = await addSet(conn, session, bench, { n: 2, reps: 5, weight: 80 });
    assert.equal(await prSet(conn, userId, bench), working);
  }));

test('PRs are judged by estimated 1RM, so more reps at the same weight counts', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const day1 = await createSession(conn, { userId, daysAgo: 7 });
    const first = await addSet(conn, day1, bench, { reps: 5, weight: 80 }); // 1RM 93.33

    const day2 = await createSession(conn, { userId, daysAgo: 3 });
    await addSet(conn, day2, bench, { n: 1, reps: 3, weight: 82.5 }); // 1RM 90.75 — heavier but not better
    assert.equal(await prSet(conn, userId, bench), first);

    const moreReps = await addSet(conn, day2, bench, { n: 2, reps: 7, weight: 80 }); // 1RM 98.67
    assert.equal(await prSet(conn, userId, bench), moreReps);
  }));

test('an exact tie keeps the PR with the earlier set', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const first = await addSet(conn, await createSession(conn, { userId, daysAgo: 5 }), bench, { reps: 5, weight: 80 });
    await addSet(conn, await createSession(conn, { userId, daysAgo: 1 }), bench, { reps: 5, weight: 80 });
    assert.equal(await prSet(conn, userId, bench), first);
  }));

test('deleting or weakening the PR set promotes the next best set', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const session = await createSession(conn, { userId });
    const good = await addSet(conn, session, bench, { n: 1, reps: 5, weight: 80 });
    const best = await addSet(conn, session, bench, { n: 2, reps: 5, weight: 90 });
    assert.equal(await prSet(conn, userId, bench), best);

    await conn.query('UPDATE sets SET weight = 70 WHERE id = ?', [best]);
    assert.equal(await prSet(conn, userId, bench), good, 'edited down -> previous best is back');

    await conn.query('DELETE FROM sets WHERE id = ?', [good]);
    assert.equal(await prSet(conn, userId, bench), best, 'deleted -> remaining set is the PR');

    await conn.query('DELETE FROM sets WHERE id = ?', [best]);
    assert.equal(await prSet(conn, userId, bench), null, 'no sets left -> no PR');
  }));

test('deleting a whole session (FK cascade) rebuilds PRs from the remaining history', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const squat = await exerciseId(conn, 'Barbell Back Squat');
    const old = await createSession(conn, { userId, daysAgo: 10 });
    const oldBench = await addSet(conn, old, bench, { reps: 5, weight: 80 });
    const latest = await createSession(conn, { userId, daysAgo: 1 });
    await addSet(conn, latest, bench, { reps: 5, weight: 90 });
    await addSet(conn, latest, squat, { reps: 5, weight: 120 });

    await conn.query('DELETE FROM workout_sessions WHERE id = ?', [latest]);
    assert.equal(await prSet(conn, userId, bench), oldBench);
    assert.equal(await prSet(conn, userId, squat), null);
  }));

test('PR tracking is per user', () =>
  inRollback(async (conn) => {
    const a = await createUser(conn);
    const b = await createUser(conn);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    const setA = await addSet(conn, await createSession(conn, { userId: a }), bench, { reps: 5, weight: 60 });
    await addSet(conn, await createSession(conn, { userId: b }), bench, { reps: 5, weight: 140 });
    assert.equal(await prSet(conn, a, bench), setA);
  }));

test('exercise library changes are audited with the acting admin', () =>
  inRollback(async (conn) => {
    const admin = await createUser(conn, { role: 'admin' });
    await conn.query('SET @app_user_id = ?', [admin]);
    const [{ id: chest }] = (await conn.query("SELECT id FROM muscle_groups WHERE name = 'Chest'"))[0];

    const [ins] = await conn.query(
      "INSERT INTO exercises (name, muscle_group_id, equipment_needed) VALUES ('Test Audit Press', ?, 'Machine')",
      [chest]
    );
    await conn.query("UPDATE exercises SET name = 'Test Audit Press v2' WHERE id = ?", [ins.insertId]);
    await conn.query('DELETE FROM exercises WHERE id = ?', [ins.insertId]);

    const [rows] = await conn.query(
      'SELECT action, admin_id, details FROM admin_audit_logs WHERE target_table = ? AND target_id = ? ORDER BY id',
      ['exercises', ins.insertId]
    );
    assert.deepEqual(rows.map((r) => r.action), ['INSERT', 'UPDATE', 'DELETE']);
    assert.ok(rows.every((r) => r.admin_id === admin));
    assert.equal(rows[1].details.before.name, 'Test Audit Press');
    assert.equal(rows[1].details.after.name, 'Test Audit Press v2');
  }));
