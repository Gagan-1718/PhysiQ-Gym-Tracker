import { z } from 'zod';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, select, selectOne, withTransaction } from '@/lib/mysql';
import { summariseSession } from '@/lib/workout-summary';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';
import type { SessionSet, SessionSummary } from '@/types/database';

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid workout id.');
  return id;
}

// GET /api/workouts/:id — one session with its sets, PR flags and journal
export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = parseId((await params).id);
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


const EditSchema = z
  .object({
    notes: z.string().trim().max(500).nullable().optional(),
    sets: z
      .array(
        z.object({
          id: z.number().int().positive(),
          weight: z.number().min(0).max(999.99),
          reps: z.number().int().min(1).max(100),
          rpe: z.number().min(1).max(10).nullable().optional(),
          warmup: z.boolean().optional(),
        })
      )
      .max(80)
      .default([]),
    deleteSetIds: z.array(z.number().int().positive()).max(80).default([]),
  })
  .refine((e) => e.sets.length > 0 || e.deleteSetIds.length > 0 || e.notes !== undefined, 'nothing to change');

// PATCH /api/workouts/:id — correct a saved workout: edit or remove sets, change notes.
// One transaction. The UPDATE/DELETE triggers on `sets` recompute total_volume and the
// personal records, so the app never calculates them. The session row is locked first
// (SELECT ... FOR UPDATE), which serialises two devices editing the same workout.
export const PATCH = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const id = parseId((await params).id);
  const edit = EditSchema.parse(await readJson(req));

  const overlap = edit.sets.find((s) => edit.deleteSetIds.includes(s.id));
  if (overlap) throw new ApiError(400, 'A set cannot be both edited and deleted.');

  await withTransaction(async (conn) => {
    const owned = await select<{ id: number }>('SELECT id FROM workout_sessions WHERE id = ? AND user_id = ? FOR UPDATE', [id, me.id], conn);
    if (owned.length === 0) throw new ApiError(404, 'Workout not found.');

    const touched = [...edit.sets.map((s) => s.id), ...edit.deleteSetIds];
    if (touched.length > 0) {
      const inSession = await select<{ id: number }>('SELECT id FROM sets WHERE session_id = ? AND id IN (?)', [id, touched], conn);
      const known = new Set(inSession.map((r) => r.id));
      if (touched.some((t) => !known.has(t))) throw new ApiError(400, 'One of those sets does not belong to this workout.');
    }

    for (const s of edit.sets) {
      await execute(
        'UPDATE sets SET weight = ?, reps = ?, rpe = ?, is_warmup = COALESCE(?, is_warmup) WHERE id = ? AND session_id = ?',
        [Math.round(s.weight * 100) / 100, s.reps, s.rpe ?? null, s.warmup ?? null, s.id, id],
        conn
      );
    }
    if (edit.deleteSetIds.length > 0) {
      await execute('DELETE FROM sets WHERE session_id = ? AND id IN (?)', [id, edit.deleteSetIds], conn);
    }
    if (edit.notes !== undefined) {
      await execute('UPDATE workout_sessions SET notes = ? WHERE id = ?', [edit.notes || null, id], conn);
    }

    const left = await selectOne<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE session_id = ?', [id], conn);
    if (!left || Number(left.n) === 0) throw new ApiError(400, 'A workout needs at least one set. Delete the workout instead.');
  });

  return ok(await summariseSession(id, me.id));
});

// DELETE /api/workouts/:id — triggers roll back last-trained dates and rebuild PRs
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = parseId((await params).id);
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
