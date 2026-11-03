import { ApiError, ok, route } from '@/lib/api';
import { callRows, select } from '@/lib/mysql';
import { requireUser } from '@/lib/session';
import type { DailyFuel, DailyNutritionHistory, MealLog, NutritionResponse, WaterLog } from '@/types/database';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(raw: string | null): string {
  if (!raw || !DATE.test(raw)) throw new ApiError(400, 'Pass date=YYYY-MM-DD (your local date).');
  return raw;
}

// GET /api/nutrition?date=YYYY-MM-DD — complete daily nutrition & hydration dashboard state
export const GET = route(async (req) => {
  const me = await requireUser();
  const date = checkDate(new URL(req.url).searchParams.get('date'));

  const [[fuel], meals, waterLogs, history] = await Promise.all([
    callRows<DailyFuel>('sp_get_daily_fuel', [me.id, date]),
    select<MealLog>(
      `SELECT id, user_id, DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuel_date,
              meal_type, food_id, food_name, serving_label, servings,
              calories, protein_g, carbs_g, fat_g, logged_at
       FROM meal_logs
       WHERE user_id = ? AND fuel_date = ?
       ORDER BY logged_at ASC, id ASC`,
      [me.id, date]
    ),
    select<WaterLog>(
      `SELECT id, user_id, DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuel_date,
              amount_ml, container_label, logged_at
       FROM water_logs
       WHERE user_id = ? AND fuel_date = ?
       ORDER BY logged_at DESC, id DESC`,
      [me.id, date]
    ),
    select<DailyNutritionHistory>(
      `SELECT DATE_FORMAT(fuel_date, '%Y-%m-%d') AS fuel_date,
              calorie_target, calories_logged,
              protein_target_g, protein_logged_g,
              water_target_ml, water_logged_ml
       FROM view_daily_nutrition_summary
       WHERE user_id = ?
         AND fuel_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
       ORDER BY fuel_date ASC`,
      [me.id, date, date]
    ),
  ]);

  const payload: NutritionResponse = {
    fuel,
    meals,
    waterLogs,
    history,
  };

  return ok(payload);
});
