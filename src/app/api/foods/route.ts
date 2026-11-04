import { ok, readJson, route } from '@/lib/api';
import { execute, select, selectOne } from '@/lib/mysql';
import { CreateFoodSchema, FOOD_CATEGORIES } from '@/lib/schemas';
import { requireUser } from '@/lib/session';
import { upsertFoodVector } from '@/lib/vector';
import type { FoodCategory, FoodItem } from '@/types/database';

// GET /api/foods?q=...&category=... — built-in staple foods + signed-in user's custom foods
export const GET = route(async (req) => {
  const me = await requireUser();
  const params = new URL(req.url).searchParams;
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category')?.trim() ?? '';

  const clauses: string[] = ['(user_id IS NULL OR user_id = ?)'];
  const values: unknown[] = [me.id];

  if (category && (FOOD_CATEGORIES as readonly string[]).includes(category)) {
    clauses.push('category = ?');
    values.push(category as FoodCategory);
  }
  if (q) {
    clauses.push('name LIKE ?');
    values.push(`%${q}%`);
  }

  const foods = await select<FoodItem>(
    `SELECT id, user_id, name, category, serving_label, serving_grams,
            calories, protein_g, carbs_g, fat_g
     FROM foods
     WHERE ${clauses.join(' AND ')}
     ORDER BY (user_id IS NOT NULL) DESC, name ASC`,
    values
  );

  return ok({ foods });
});

// POST /api/foods — create a custom food item owned by the signed-in user
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = CreateFoodSchema.parse(await readJson(req));

  const res = await execute(
    `INSERT INTO foods (user_id, name, category, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      me.id,
      body.name,
      body.category,
      body.servingLabel,
      body.servingGrams,
      body.calories,
      body.proteinG,
      body.carbsG,
      body.fatG,
    ]
  );

  const created = await selectOne<FoodItem>(
    `SELECT id, user_id, name, category, serving_label, serving_grams,
            calories, protein_g, carbs_g, fat_g
     FROM foods WHERE id = ?`,
    [res.insertId]
  );

  if (created) {
    await upsertFoodVector(created);
  }

  return ok(created, 201);
});
