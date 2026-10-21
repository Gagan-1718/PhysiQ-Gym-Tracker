import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, selectOne, withTransaction } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';
import type { User } from '@/types/database';

// GET /api/me — profile + whether onboarding is still needed
export const GET = route(async () => {
  const me = await requireUser();
  const user = await selectOne<User & { has_active_split: number }>(
    `SELECT u.id, u.name, u.email, u.role, u.goal, u.height, u.starting_weight, u.weekly_goal, u.created_at,
            EXISTS (SELECT 1 FROM splits s WHERE s.user_id = u.id AND s.is_active) AS has_active_split
     FROM users u WHERE u.id = ?`,
    [me.id]
  );
  if (!user) throw new ApiError(401, 'Account no longer exists.');
  const { has_active_split, ...profile } = user;
  return ok({ ...profile, needsOnboarding: !has_active_split });
});

const ProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    goal: z.enum(['hypertrophy', 'strength', 'fat_loss', 'maintenance']),
    height: z.number().min(100).max(250).nullable(),
    starting_weight: z.number().min(30).max(300).nullable(),
    weekly_goal: z.number().int().min(1).max(7),
  })
  .partial()
  .strict();

// PATCH /api/me — update name, goal and body metrics
export const PATCH = route(async (req) => {
  const me = await requireUser();
  const changes = ProfileSchema.parse(await readJson(req));
  if (Object.keys(changes).length === 0) throw new ApiError(400, 'Nothing to update.');
  // Column names come from the zod schema keys above, values are parameterised
  await execute('UPDATE users SET ? WHERE id = ?', [changes, me.id]);
  return ok({ updated: Object.keys(changes) });
});

const DeleteSchema = z.object({ password: z.string().min(1) });

// DELETE /api/me — delete the account in both stores (password confirmation required)
export const DELETE = route(async (req) => {
  const me = await requireUser();
  const { password } = DeleteSchema.parse(await readJson(req));
  const row = await selectOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [me.id]);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new ApiError(403, 'Password is incorrect.');

  // MySQL first: FK cascades remove splits, sessions, sets, PRs, measurements and fuel.
  await withTransaction((conn) => execute('DELETE FROM users WHERE id = ?', [me.id], conn));
  // Then the documents that reference this user id from MongoDB.
  const db = await getMongoDb();
  await Promise.all([
    db.collection('custom_routines').deleteMany({ user_id: me.id }),
    db.collection('journey_stories').deleteMany({ user_id: me.id }),
  ]);
  return ok({ deleted: true });
});
