import { z } from 'zod';
import { ok, readJson, route } from '@/lib/api';
import { execute, select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { BodyMeasurement } from '@/types/database';

// GET /api/body — measurement history, oldest first (for charts)
export const GET = route(async () => {
  const me = await requireUser();
  const rows = await select<BodyMeasurement>(
    'SELECT id, recorded_on, weight, waist, chest, arms FROM body_measurements WHERE user_id = ? ORDER BY recorded_on',
    [me.id]
  );
  return ok(rows);
});

const metric = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
const MeasurementSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight: metric(30, 300),
    waist: metric(40, 200),
    chest: metric(50, 200),
    arms: metric(15, 80),
  })
  .refine((m) => [m.weight, m.waist, m.chest, m.arms].some((v) => v !== null && v !== undefined), 'log at least one measurement');

// POST /api/body — one entry per day: UNIQUE (user_id, recorded_on) turns a second
// log on the same day into an update of the values that were sent
export const POST = route(async (req) => {
  const me = await requireUser();
  const m = MeasurementSchema.parse(await readJson(req));
  await execute(
    `INSERT INTO body_measurements (user_id, recorded_on, weight, waist, chest, arms)
     VALUES (?, ?, ?, ?, ?, ?) AS new_row
     ON DUPLICATE KEY UPDATE
       weight = COALESCE(new_row.weight, body_measurements.weight),
       waist  = COALESCE(new_row.waist,  body_measurements.waist),
       chest  = COALESCE(new_row.chest,  body_measurements.chest),
       arms   = COALESCE(new_row.arms,   body_measurements.arms)`,
    [me.id, m.date, m.weight ?? null, m.waist ?? null, m.chest ?? null, m.arms ?? null]
  );
  return ok({ saved: m.date }, 201);
});
