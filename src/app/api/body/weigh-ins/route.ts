import { ok, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { WeighIn } from '@/types/database';

// GET /api/body/weigh-ins — body weight before and after the last 30 weighed workouts, oldest first
export const GET = route(async () => {
  const me = await requireUser();
  const rows = await select<WeighIn>(
    `SELECT id, session_date, body_part, weight_before, weight_after
     FROM (SELECT id, session_date, body_part, weight_before, weight_after
           FROM workout_sessions
           WHERE user_id = ? AND (weight_before IS NOT NULL OR weight_after IS NOT NULL)
           ORDER BY session_date DESC, id DESC
           LIMIT 30) AS latest
     ORDER BY session_date, id`,
    [me.id]
  );
  return ok(rows);
});
