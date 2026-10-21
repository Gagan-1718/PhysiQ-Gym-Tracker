import { ApiError, ok, route } from '@/lib/api';
import { callOut, select, selectOne } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { OverloadTarget, PersonalRecord } from '@/types/database';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/progress/exercises/:id — strength trend (view_exercise_session_best),
// current PR and the next overload target (sp_estimate_next_target)
export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid exercise id.');

  const [exercise, series, pr, target] = await Promise.all([
    selectOne<{ id: number; name: string; muscle_group: string; equipment_needed: string }>(
      'SELECT e.id, e.name, mg.name AS muscle_group, e.equipment_needed FROM exercises e JOIN muscle_groups mg ON mg.id = e.muscle_group_id WHERE e.id = ?',
      [id]
    ),
    select<{ session_date: string; best_e1rm: number; top_weight: number; working_sets: number; volume: number }>(
      `SELECT session_date, best_e1rm, top_weight, working_sets, volume
       FROM view_exercise_session_best WHERE user_id = ? AND exercise_id = ?
       ORDER BY session_date, session_id`,
      [me.id, id]
    ),
    selectOne<PersonalRecord>(
      'SELECT exercise_id, exercise_name, muscle_group, weight, reps, estimated_1rm, achieved_on, session_id FROM view_personal_records_detailed WHERE user_id = ? AND exercise_id = ?',
      [me.id, id]
    ),
    callOut<OverloadTarget>('sp_estimate_next_target', [me.id, id], [
      'suggested_weight',
      'suggested_reps',
      'last_weight',
      'last_reps',
      'last_date',
      'rationale',
    ]),
  ]);
  if (!exercise) throw new ApiError(404, 'Exercise not found.');

  return ok({
    exercise,
    series,
    pr,
    target: {
      ...target,
      suggested_weight: target.suggested_weight === null ? null : Number(target.suggested_weight),
      suggested_reps: Number(target.suggested_reps),
    },
  });
});
