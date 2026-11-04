import { ok, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';

// GET /api/progress/exercises — exercises this user has trained, most frequent first
export const GET = route(async () => {
  const me = await requireUser();
  const rows = await select<{ exercise_id: number; name: string; muscle_group: string; sessions: number; last_date: string }>(
    `SELECT b.exercise_id, e.name, mg.name AS muscle_group, COUNT(*) AS sessions, MAX(b.session_date) AS last_date
     FROM view_exercise_session_best b
     JOIN exercises e      ON e.id = b.exercise_id
     JOIN muscle_groups mg ON mg.id = e.muscle_group_id
     WHERE b.user_id = ?
     GROUP BY b.exercise_id, e.name, mg.name
     ORDER BY sessions DESC, last_date DESC`,
    [me.id]
  );
  return ok(rows);
});
