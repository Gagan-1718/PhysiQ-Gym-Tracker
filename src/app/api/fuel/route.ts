import { z } from 'zod';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { callRows } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { DailyFuel } from '@/types/database';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(raw: string | null): string {
  if (!raw || !DATE.test(raw)) throw new ApiError(400, 'Pass date=YYYY-MM-DD (your local date).');
  return raw;
}

// GET /api/fuel?date=YYYY-MM-DD — targets + progress via CALL sp_get_daily_fuel
export const GET = route(async (req) => {
  const me = await requireUser();
  const date = checkDate(new URL(req.url).searchParams.get('date'));
  const [fuel] = await callRows<DailyFuel>('sp_get_daily_fuel', [me.id, date]);
  return ok(fuel);
});

const LogSchema = z
  .object({
    date: z.string().regex(DATE),
    proteinDelta: z.number().int().min(-500).max(500).default(0),
    waterDelta: z.number().int().min(-5000).max(5000).default(0),
  })
  .refine((v) => v.proteinDelta !== 0 || v.waterDelta !== 0, 'nothing to log');

// POST /api/fuel — add/subtract protein and water via CALL sp_log_fuel (clamped in the database)
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = LogSchema.parse(await readJson(req));
  const [fuel] = await callRows<DailyFuel>('sp_log_fuel', [me.id, body.date, body.proteinDelta, body.waterDelta]);
  return ok(fuel);
});
