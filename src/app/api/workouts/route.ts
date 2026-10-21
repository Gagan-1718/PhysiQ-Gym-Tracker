import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, select, selectOne, withTransaction } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { recordSessionMilestone } from '@/lib/milestones';
import { requireUser } from '@/lib/session';
import type { SessionSummary } from '@/types/database';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const WorkoutSchema = z.object({
  clientRef: z.string().uuid(),
  sessionDate: z.string().regex(DATE),
  splitDayId: z.number().int().positive().nullable(),
  bodyPart: z.string().trim().min(1).max(50),
  startedAt: z.string().regex(DATETIME).nullable(),
  endedAt: z.string().regex(DATETIME).nullable(),
  notes: z.string().trim().max(500).nullable().optional(),
  routineId: z.string().regex(/^[a-f0-9]{24}$/).nullable().optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        sets: z
          .array(
            z.object({
              weight: z.number().min(0).max(999.99),
              reps: z.number().int().min(1).max(100),
              warmup: z.boolean(),
              rpe: z.number().min(1).max(10).nullable().optional(),
            })
          )
          .min(1)
          .max(30),
      })
    )
    .min(1, 'log at least one set')
    .max(20),
  journal: z
    .object({
      mood: z.number().int().min(1).max(5).nullable(),
      energy: z.number().int().min(1).max(5).nullable(),
      tags: z.array(z.string().trim().min(1).max(30)).max(12),
      caption: z.string().trim().max(1000).nullable(),
    })
    .nullable()
    .optional(),
});

interface SavedPR {
  exercise_id: number;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number;
}

async function summarise(sessionId: number, userId: number) {
  const session = await selectOne<{ total_volume: number; working_sets: number }>(
    `SELECT ws.total_volume, (SELECT COUNT(*) FROM sets s WHERE s.session_id = ws.id AND s.is_warmup = FALSE) AS working_sets
     FROM workout_sessions ws WHERE ws.id = ? AND ws.user_id = ?`,
    [sessionId, userId]
  );
  // PR rows that now point at sets of this session = personal records set today (found by the triggers)
  const prs = await select<SavedPR>(
    `SELECT exercise_id, exercise_name, weight, reps, estimated_1rm
     FROM view_personal_records_detailed WHERE user_id = ? AND session_id = ? ORDER BY exercise_name`,
    [userId, sessionId]
  );
  return { sessionId, totalVolume: session?.total_volume ?? 0, workingSets: session?.working_sets ?? 0, prs };
}

// POST /api/workouts — log a finished workout as ONE transaction:
//   INSERT workout_sessions  (trigger: validate, mark split day trained)
//   INSERT sets              (triggers: add volume, detect PRs)
//   COMMIT                   (any failure -> ROLLBACK, nothing half-saved)
// Then (outside the SQL transaction) the optional journal goes to MongoDB.
export const POST = route(async (req) => {
  const me = await requireUser();
  const w = WorkoutSchema.parse(await readJson(req));

  let sessionId: number;
  let replay = false;
  try {
    sessionId = await withTransaction(async (conn) => {
      const session = await execute(
        `INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes, client_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [me.id, w.splitDayId, w.sessionDate, w.bodyPart, w.startedAt, w.endedAt, w.notes || null, w.clientRef],
        conn
      );
      const rows = w.exercises.flatMap((ex) =>
        ex.sets.map((s, i) => [
          session.insertId,
          ex.exerciseId,
          i + 1,
          s.reps,
          Math.round(s.weight * 100) / 100,
          s.warmup,
          s.rpe ?? null,
        ])
      );
      await execute('INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES ?', [rows], conn);
      return session.insertId;
    });
  } catch (err) {
    // Same device submitted this workout before (double tap / network retry): return the saved one
    if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') throw err;
    const existing = await selectOne<{ id: number }>('SELECT id FROM workout_sessions WHERE user_id = ? AND client_ref = ?', [me.id, w.clientRef]);
    if (!existing) throw err;
    sessionId = existing.id;
    replay = true;
  }

  const summary = await summarise(sessionId, me.id);

  // MongoDB side effects are best-effort: the workout itself is already committed in MySQL
  const warnings: string[] = [];
  if (!replay) {
    try {
      const db = await getMongoDb();
      const j = w.journal;
      if (j && (j.mood || j.energy || j.caption || j.tags.length)) {
        await db.collection('journey_stories').insertOne({
          user_id: me.id,
          date: w.sessionDate,
          kind: 'workout_journal',
          session_id: sessionId,
          caption: j.caption,
          mood: j.mood,
          energy: j.energy,
          tags: [...new Set(j.tags.map((t) => t.toLowerCase()))],
          highlights: [
            { type: 'focus', label: w.bodyPart },
            ...summary.prs.map((p) => ({ type: 'pr', exercise: p.exercise_name, weight: p.weight, reps: p.reps })),
          ],
          created_at: new Date(),
        });
      }
      await recordSessionMilestone(me.id, w.sessionDate);
      if (w.routineId) {
        await db
          .collection('custom_routines')
          .updateOne({ _id: new ObjectId(w.routineId), user_id: me.id }, { $inc: { times_used: 1 }, $set: { last_used_at: new Date() } });
      }
    } catch (err) {
      console.error('[workouts] mongo side effect failed', err);
      warnings.push('Workout saved, but the journal entry could not be stored.');
    }
  }

  return ok({ ...summary, replay, warnings }, replay ? 200 : 201);
});

// GET /api/workouts?limit=20&before=2026-10-13_57 — history, newest first (keyset pagination)
export const GET = route(async (req) => {
  const me = await requireUser();
  const params = new URL(req.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 20));
  const before = params.get('before');
  let cursor: [string, number] | null = null;
  if (before) {
    const [date, id] = before.split('_');
    if (!DATE.test(date) || !Number.isInteger(Number(id))) throw new ApiError(400, 'Invalid cursor.');
    cursor = [date, Number(id)];
  }

  const sessions = await select<SessionSummary>(
    `SELECT ws.id, ws.session_date, ws.body_part, ws.split_day_id, ws.started_at, ws.ended_at, ws.total_volume, ws.notes,
            COUNT(DISTINCT s.exercise_id)              AS exercise_count,
            COALESCE(SUM(s.is_warmup = FALSE), 0)      AS working_sets,
            COUNT(pr.set_id)                           AS pr_count
     FROM workout_sessions ws
     LEFT JOIN sets s              ON s.session_id = ws.id
     LEFT JOIN personal_records pr ON pr.set_id = s.id
     WHERE ws.user_id = ? ${cursor ? 'AND (ws.session_date, ws.id) < (?, ?)' : ''}
     GROUP BY ws.id
     ORDER BY ws.session_date DESC, ws.id DESC
     LIMIT ${limit}`,
    cursor ? [me.id, ...cursor] : [me.id]
  );
  const last = sessions[sessions.length - 1];
  return ok({
    sessions: sessions.map((s) => ({ ...s, working_sets: Number(s.working_sets) })),
    nextCursor: sessions.length === limit && last ? `${last.session_date}_${last.id}` : null,
  });
});
