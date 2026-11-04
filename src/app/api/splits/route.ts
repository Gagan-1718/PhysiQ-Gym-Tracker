import { z } from 'zod';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, select, withTransaction } from '@/lib/mysql';
import { getRecommendation, getSplitStatus } from '@/lib/queries';
import { requireUser } from '@/lib/session';

// GET /api/splits — active split with each day's recovery status + the recommendation
export const GET = route(async () => {
  const me = await requireUser();
  const [days, recommendation] = await Promise.all([getSplitStatus(me.id), getRecommendation(me.id)]);
  return ok({ splitName: days[0]?.split_name ?? null, days, recommendation });
});

const SplitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  minRestDays: z.number().int().min(0).max(7),
  days: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        muscles: z.array(z.string()).min(1).max(10),
      })
    )
    .min(1)
    .max(7)
    .refine((days) => new Set(days.map((d) => d.label.toLowerCase())).size === days.length, 'day names must be unique'),
});

// POST /api/splits — create and activate a split (one transaction)
export const POST = route(async (req) => {
  const me = await requireUser();
  const split = SplitSchema.parse(await readJson(req));

  const known = await select<{ id: number; name: string }>('SELECT id, name FROM muscle_groups');
  const idByName = new Map(known.map((m) => [m.name, m.id]));
  for (const day of split.days) {
    const unknown = day.muscles.find((m) => !idByName.has(m));
    if (unknown) throw new ApiError(400, `Unknown muscle group: ${unknown}`);
  }

  const splitId = await withTransaction(async (conn) => {
    // Only one split may be active (also enforced by uq_splits_one_active_per_user)
    await execute('UPDATE splits SET is_active = FALSE WHERE user_id = ? AND is_active', [me.id], conn);
    const created = await execute('INSERT INTO splits (user_id, split_name, is_active) VALUES (?, ?, TRUE)', [me.id, split.name], conn);

    for (const [index, day] of split.days.entries()) {
      const dayRow = await execute(
        'INSERT INTO split_days (split_id, body_part, day_order, min_rest_days) VALUES (?, ?, ?, ?)',
        [created.insertId, day.label, index + 1, split.minRestDays],
        conn
      );
      const pairs = [...new Set(day.muscles)].map((m) => [dayRow.insertId, idByName.get(m)]);
      await execute('INSERT INTO split_day_muscles (split_day_id, muscle_group_id) VALUES ?', [pairs], conn);
    }
    return created.insertId;
  });

  return ok({ splitId }, 201);
});
