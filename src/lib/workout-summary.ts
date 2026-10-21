import { select, selectOne } from './mysql';

export interface SavedPR {
  exercise_id: number;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number;
}

/**
 * What the database computed for a session after a write: total volume (set by the
 * sets triggers), the number of working sets, and the personal records whose best
 * set belongs to this session (found by the PR triggers).
 */
export async function summariseSession(sessionId: number, userId: number) {
  const session = await selectOne<{ total_volume: number; working_sets: number }>(
    `SELECT ws.total_volume, (SELECT COUNT(*) FROM sets s WHERE s.session_id = ws.id AND s.is_warmup = FALSE) AS working_sets
     FROM workout_sessions ws WHERE ws.id = ? AND ws.user_id = ?`,
    [sessionId, userId]
  );
  const prs = await select<SavedPR>(
    `SELECT exercise_id, exercise_name, weight, reps, estimated_1rm
     FROM view_personal_records_detailed WHERE user_id = ? AND session_id = ? ORDER BY exercise_name`,
    [userId, sessionId]
  );
  return { sessionId, totalVolume: session?.total_volume ?? 0, workingSets: Number(session?.working_sets ?? 0), prs };
}
