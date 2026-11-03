import { ApiError, ok, readJson, route } from '@/lib/api';
import { callRows } from '@/lib/mysql';
import { LogWaterSchema } from '@/lib/schemas';
import { requireUser } from '@/lib/session';
import type { WaterLog } from '@/types/database';

// POST /api/nutrition/water — log a timestamped hydration entry via sp_log_water
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = LogWaterSchema.parse(await readJson(req));

  const [entry] = await callRows<WaterLog>('sp_log_water', [
    me.id,
    body.date,
    body.amountMl,
    body.containerLabel,
  ]);

  return ok(entry, 201);
});

// DELETE /api/nutrition/water?id=123 — remove a hydration entry via sp_delete_water
export const DELETE = route(async (req) => {
  const me = await requireUser();
  const idRaw = new URL(req.url).searchParams.get('id');
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, 'Pass a valid water log id (?id=...).');
  }

  const [res] = await callRows<{ deleted: number }>('sp_delete_water', [me.id, id]);
  if (!res?.deleted) {
    throw new ApiError(404, 'Water log entry not found.');
  }

  return ok({ deleted: true });
});
