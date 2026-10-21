import { getMongoDb } from './mongodb';
import { selectOne } from './mysql';
import { SESSION_MILESTONES, type StoryDoc } from './journey';

/**
 * After a workout is committed in MySQL, add a milestone story to MongoDB when the
 * member's total session count reaches 1, 10, 25, 50, 100 or 250. Best-effort and
 * idempotent: if the story for that count already exists nothing is added.
 */
export async function recordSessionMilestone(userId: number, sessionDate: string): Promise<number | null> {
  const row = await selectOne<{ n: number }>('SELECT COUNT(*) AS n FROM workout_sessions WHERE user_id = ?', [userId]);
  const n = Number(row?.n ?? 0);
  if (!SESSION_MILESTONES.includes(n)) return null;

  const col = (await getMongoDb()).collection<Omit<StoryDoc, '_id'>>('journey_stories');
  const exists = await col.findOne({ user_id: userId, kind: 'milestone', 'milestone.type': 'sessions', 'milestone.value': n });
  if (exists) return null;

  await col.insertOne({
    user_id: userId,
    date: sessionDate,
    kind: 'milestone',
    caption: n === 1 ? 'First workout logged. The journey starts here.' : `${n} workouts logged.`,
    tags: ['milestone'],
    milestone: { type: 'sessions', value: n },
    created_at: new Date(),
  });
  return n;
}
