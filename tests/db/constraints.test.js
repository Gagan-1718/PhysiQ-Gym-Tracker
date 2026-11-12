const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, inRollback, createUser, createSplit, createSession, addSet, exerciseId } = require('./helpers');

after(() => pool.end());

const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code || assert.fail(`${err.code}: ${err.message}`));

test('CHECK constraints reject impossible sets', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const session = await createSession(conn, { userId });
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await rejects(addSet(conn, session, bench, { reps: 0, weight: 60 }), 'ER_CHECK_CONSTRAINT_VIOLATED');
    await rejects(addSet(conn, session, bench, { reps: 5, weight: -5 }), 'ER_CHECK_CONSTRAINT_VIOLATED');
    await rejects(
      conn.query('INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, rpe) VALUES (?, ?, 1, 5, 60, 11)', [session, bench]),
      'ER_CHECK_CONSTRAINT_VIOLATED'
    );
  }));

test('exercise demonstrations (migration 002): every seeded exercise has one, and keys must be lowercase slugs', () =>
  inRollback(async (conn) => {
    const [[seeded]] = await conn.query('SELECT COUNT(*) AS total, COUNT(media_key) AS with_media FROM exercises');
    assert.equal(seeded.with_media, seeded.total, 'all 45 built-in exercises point at their drawings');
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await rejects(conn.query("UPDATE exercises SET media_key = 'Bench Press!' WHERE id = ?", [bench]), 'ER_CHECK_CONSTRAINT_VIOLATED');
    await rejects(conn.query("UPDATE exercises SET media_key = '-bench' WHERE id = ?", [bench]), 'ER_CHECK_CONSTRAINT_VIOLATED');
    await conn.query('UPDATE exercises SET media_key = NULL WHERE id = ?', [bench]); // no photos is allowed
  }));

test('exercise knowledge (migration 003): every exercise has a target muscle, valid weight steps, regions are a closed list', () =>
  inRollback(async (conn) => {
    const [[gaps]] = await conn.query(
      `SELECT COUNT(*) AS n FROM exercises e
       WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles em WHERE em.exercise_id = e.id AND em.role = 'primary')`
    );
    assert.equal(gaps.n, 0, 'each seeded exercise names at least one primary muscle');
    const [[regions]] = await conn.query('SELECT COUNT(*) AS n FROM muscle_regions');
    assert.equal(regions.n, 15);
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await rejects(conn.query("INSERT INTO exercise_muscles VALUES (?, 'wings', 'primary')", [bench]), 'ER_NO_REFERENCED_ROW_2');
    await rejects(conn.query("INSERT INTO exercise_muscles VALUES (?, 'chest', 'secondary')", [bench]), 'ER_DUP_ENTRY');
    await rejects(conn.query('UPDATE exercises SET weight_step_kg = 7.5 WHERE id = ?', [bench]), 'ER_CHECK_CONSTRAINT_VIOLATED');
    // Deleting an exercise takes its muscle links with it (ON DELETE CASCADE)
    const [made] = await conn.query("INSERT INTO exercises (name, muscle_group_id) SELECT 'Test Fly', id FROM muscle_groups WHERE name = 'Chest'");
    await conn.query("INSERT INTO exercise_muscles VALUES (?, 'chest', 'primary')", [made.insertId]);
    await conn.query('DELETE FROM exercises WHERE id = ?', [made.insertId]);
    const [[left]] = await conn.query('SELECT COUNT(*) AS n FROM exercise_muscles WHERE exercise_id = ?', [made.insertId]);
    assert.equal(left.n, 0);
  }));

test('the same set number cannot be logged twice for one exercise in a session', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const session = await createSession(conn, { userId });
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await addSet(conn, session, bench, { n: 1, reps: 5, weight: 60 });
    await rejects(addSet(conn, session, bench, { n: 1, reps: 6, weight: 60 }), 'ER_DUP_ENTRY');
  }));

test('emails are unique and must look like emails', () =>
  inRollback(async (conn) => {
    await createUser(conn, { email: 'dup@physiq.test' });
    await rejects(createUser(conn, { email: 'dup@physiq.test' }), 'ER_DUP_ENTRY');
    await rejects(createUser(conn, { email: 'not-an-email' }), 'ER_CHECK_CONSTRAINT_VIOLATED');
  }));

test('a user can have many splits but only one active split', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    await createSplit(conn, userId, [['A', 2]], true);
    await createSplit(conn, userId, [['B', 2]], false);
    await createSplit(conn, userId, [['C', 2]], false);
    await rejects(createSplit(conn, userId, [['D', 2]], true), 'ER_DUP_ENTRY');
  }));

test('client_ref makes workout submission idempotent per user', () =>
  inRollback(async (conn) => {
    const a = await createUser(conn);
    const b = await createUser(conn);
    const ref = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const insert = (userId) =>
      conn.query("INSERT INTO workout_sessions (user_id, session_date, body_part, client_ref) VALUES (?, CURRENT_DATE, 'Push', ?)", [userId, ref]);
    await insert(a);
    await rejects(insert(a), 'ER_DUP_ENTRY');
    await insert(b); // another user's device may reuse the same id
    await conn.query("INSERT INTO workout_sessions (user_id, session_date, body_part) VALUES (?, CURRENT_DATE, 'Push'), (?, CURRENT_DATE, 'Pull')", [a, a]);
  }));

test('a body measurement needs at least one value', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    await rejects(
      conn.query('INSERT INTO body_measurements (user_id, recorded_on) VALUES (?, CURRENT_DATE)', [userId]),
      'ER_CHECK_CONSTRAINT_VIOLATED'
    );
  }));

test('trigger rejects sessions dated in the future (beyond 1 day of timezone slack)', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    await createSession(conn, { userId, daysAgo: -1 }); // tomorrow is tolerated
    await assert.rejects(createSession(conn, { userId, daysAgo: -3 }), /cannot be in the future/);
  }));

test("trigger rejects logging against another user's split day", () =>
  inRollback(async (conn) => {
    const owner = await createUser(conn);
    const intruder = await createUser(conn);
    const { days } = await createSplit(conn, owner);
    await assert.rejects(createSession(conn, { userId: intruder, splitDayId: days.Push }), /does not belong to this user/);
  }));

test('trigger stops a session being moved to another user', () =>
  inRollback(async (conn) => {
    const a = await createUser(conn);
    const b = await createUser(conn);
    const session = await createSession(conn, { userId: a });
    await assert.rejects(conn.query('UPDATE workout_sessions SET user_id = ? WHERE id = ?', [b, session]), /cannot be moved/);
  }));

test('an exercise that has been trained cannot be deleted (FK RESTRICT)', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const session = await createSession(conn, { userId });
    const bench = await exerciseId(conn, 'Barbell Bench Press');
    await addSet(conn, session, bench, { reps: 5, weight: 60 });
    await rejects(conn.query('DELETE FROM exercises WHERE id = ?', [bench]), 'ER_ROW_IS_REFERENCED_2');
  }));

test('deleting a user cascades to all of their data', () =>
  inRollback(async (conn) => {
    const userId = await createUser(conn);
    const { days } = await createSplit(conn, userId);
    const session = await createSession(conn, { userId, splitDayId: days.Push });
    await addSet(conn, session, await exerciseId(conn, 'Barbell Bench Press'), { reps: 5, weight: 60 });
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    const [[left]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM splits WHERE user_id = ?) AS splits,
              (SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?) AS sessions,
              (SELECT COUNT(*) FROM sets WHERE session_id = ?) AS sets_left,
              (SELECT COUNT(*) FROM personal_records WHERE user_id = ?) AS prs`,
      [userId, userId, session, userId]
    );
    assert.deepEqual(left, { splits: 0, sessions: 0, sets_left: 0, prs: 0 });
  }));
