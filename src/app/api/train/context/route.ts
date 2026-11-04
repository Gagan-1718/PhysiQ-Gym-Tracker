import { ApiError, ok, route } from '@/lib/api';
import { callOut, select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { ExerciseContext, LastPerformanceSet, OverloadTarget } from '@/types/database';

// GET /api/train/context?ids=1,2,3 — everything the logger needs per exercise:
//   target  <- CALL sp_estimate_next_target (OUT params)
//   last    <- sets of the most recent session with that exercise (window function)
//   pr      <- view_personal_records_detailed
export const GET = route(async (req) => {
  const me = await requireUser();
  const raw = new URL(req.url).searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0 || ids.length > 20) throw new ApiError(400, 'Pass 1–20 exercise ids.');

  const [targets, lastSets, prs] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        callOut<OverloadTarget>('sp_estimate_next_target', [me.id, id], [
          'suggested_weight',
          'suggested_reps',
          'last_weight',
          'last_reps',
          'last_date',
          'rationale',
        ])
      )
    ),
    select<LastPerformanceSet & { exercise_id: number }>(
      `WITH ranked AS (
         SELECT s.exercise_id, s.session_id,
                ROW_NUMBER() OVER (PARTITION BY s.exercise_id ORDER BY ws.session_date DESC, ws.id DESC) AS rn
         FROM sets s
         JOIN workout_sessions ws ON ws.id = s.session_id
         WHERE ws.user_id = ? AND s.exercise_id IN (?)
         GROUP BY s.exercise_id, s.session_id, ws.session_date, ws.id
       )
       SELECT s.exercise_id, s.set_number, s.weight, s.reps, s.is_warmup
       FROM ranked r
       JOIN sets s ON s.session_id = r.session_id AND s.exercise_id = r.exercise_id
       WHERE r.rn = 1
       ORDER BY s.exercise_id, s.set_number`,
      [me.id, ids]
    ),
    select<{ exercise_id: number; weight: number; reps: number; estimated_1rm: number }>(
      'SELECT exercise_id, weight, reps, estimated_1rm FROM view_personal_records_detailed WHERE user_id = ? AND exercise_id IN (?)',
      [me.id, ids]
    ),
  ]);

  const context: Record<number, ExerciseContext> = {};
  ids.forEach((id, i) => {
    const t = targets[i];
    context[id] = {
      target: {
        suggested_weight: t.suggested_weight === null ? null : Number(t.suggested_weight),
        suggested_reps: Number(t.suggested_reps),
        last_weight: t.last_weight === null ? null : Number(t.last_weight),
        last_reps: t.last_reps === null ? null : Number(t.last_reps),
        last_date: t.last_date,
        rationale: t.rationale,
      },
      last: lastSets.filter((s) => s.exercise_id === id).map(({ exercise_id: _x, ...s }) => ({ ...s, is_warmup: Boolean(s.is_warmup) })),
      pr: prs.find((p) => p.exercise_id === id) ?? null,
    };
  });
  return ok(context);
});
