import { ApiError, ok, route } from '@/lib/api';
import { execute, select, selectOne } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';
import type { SessionSet, SessionSummary } from '@/types/database';

type Ctx = { params: { id: string } };

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid workout id.');
  return id;
}

// GET /api/workouts/:id — one session with its sets, PR flags and journal
export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = parseId(params.id);
  const session = await selectOne<Omit<SessionSummary, 'exercise_count' | 'working_sets' | 'pr_count'>>(
    `SELECT id, session_date, body_part, split_day_id, started_at, ended_at, total_volume, notes
     FROM workout_sessions WHERE id = ? AND user_id = ?`,
    [id, me.id]
  );
  if (!session) throw new ApiError(404, 'Workout not found.');

  const sets = await select<SessionSet>(
    `SELECT s.id, s.exercise_id, e.name AS exercise_name, mg.name AS muscle_group, s.set_number, s.reps, s.weight,
            s.is_warmup, s.rpe, (pr.set_id IS NOT NULL) AS is_pr
     FROM sets s
     JOIN exercises e              ON e.id = s.exercise_id
     JOIN muscle_groups mg         ON mg.id = e.muscle_group_id
     LEFT JOIN personal_records pr ON pr.set_id = s.id
     WHERE s.session_id = ?
     ORDER BY s.id`,
    [id]
  );

  let journal = null;
  try {
    const db = await getMongoDb();
    const doc = await db.collection('journey_stories').findOne({ user_id: me.id, session_id: id });
    if (doc) journal = { mood: doc.mood ?? null, energy: doc.energy ?? null, tags: doc.tags ?? [], caption: doc.caption ?? null };
  } catch (err) {
    console.error('[workouts/:id] journal lookup failed', err);
  }

  return ok({
    session,
    sets: sets.map((s) => ({ ...s, is_warmup: Boolean(s.is_warmup), is_pr: Boolean(s.is_pr) })),
    journal,
  });
});

// DELETE /api/workouts/:id — triggers roll back last-trained dates and rebuild PRs
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = parseId(params.id);
  const res = await execute('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?', [id, me.id]);
  if (res.affectedRows === 0) throw new ApiError(404, 'Workout not found.');
  try {
    const db = await getMongoDb();
    await db.collection('journey_stories').deleteMany({ user_id: me.id, session_id: id });
  } catch (err) {
    console.error('[workouts/:id] journal cleanup failed', err);
  }
  return ok({ deleted: id });
});
