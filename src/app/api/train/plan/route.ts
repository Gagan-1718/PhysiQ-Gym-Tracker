import { ApiError, ok, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { Exercise } from '@/types/database';

// GET /api/train/plan?day=<split_day_id> — the exercises of the last session on this
// split day, in the order they were done, so "Start Pull" opens a pre-filled workout.
export const GET = route(async (req) => {
  const me = await requireUser();
  const day = Number(new URL(req.url).searchParams.get('day'));
  if (!Number.isInteger(day) || day <= 0) throw new ApiError(400, 'Invalid split day.');

  const exercises = await select<Exercise & { working_sets: number }>(
    `SELECT e.id, e.name, e.muscle_group_id, mg.name AS muscle_group, e.equipment_needed, e.instructions,
            CAST(SUM(s.is_warmup = FALSE) AS UNSIGNED) AS working_sets
     FROM sets s
     JOIN exercises e      ON e.id = s.exercise_id
     JOIN muscle_groups mg ON mg.id = e.muscle_group_id
     WHERE s.session_id = (
         SELECT ws.id FROM workout_sessions ws
         WHERE ws.user_id = ? AND ws.split_day_id = ?
         ORDER BY ws.session_date DESC, ws.id DESC
         LIMIT 1
     )
     GROUP BY e.id, e.name, e.muscle_group_id, mg.name, e.equipment_needed, e.instructions
     ORDER BY MIN(s.id)`,
    [me.id, day]
  );
  return ok({ exercises: exercises.map((e) => ({ ...e, working_sets: Number(e.working_sets) })) });
});
