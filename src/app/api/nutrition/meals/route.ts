import { ApiError, ok, readJson, route } from '@/lib/api';
import { callRows } from '@/lib/mysql';
import { LogMealSchema } from '@/lib/schemas';
import { requireUser } from '@/lib/session';
import type { MealLog } from '@/types/database';

// POST /api/nutrition/meals — log a meal from the library or custom quick entry via sp_log_meal
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = LogMealSchema.parse(await readJson(req));

  const [meal] = await callRows<MealLog>('sp_log_meal', [
    me.id,
    body.date,
    body.mealType,
    body.foodId ?? null,
    body.foodName ?? null,
    body.servingLabel ?? '1 serving',
    body.servings,
    body.calories ?? 0,
    body.proteinG,
    body.carbsG,
    body.fatG,
  ]);

  return ok(meal, 201);
});

// DELETE /api/nutrition/meals?id=123 — remove a logged meal via sp_delete_meal
export const DELETE = route(async (req) => {
  const me = await requireUser();
  const idRaw = new URL(req.url).searchParams.get('id');
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, 'Pass a valid meal id (?id=...).');
  }

  const [res] = await callRows<{ deleted: number }>('sp_delete_meal', [me.id, id]);
  if (!res?.deleted) {
    throw new ApiError(404, 'Meal entry not found.');
  }

  return ok({ deleted: true });
});
