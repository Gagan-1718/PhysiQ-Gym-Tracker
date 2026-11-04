import { z } from 'zod';
import { EQUIPMENT } from '@/types/database';

/** Request schemas shared by more than one route. */
export const ExerciseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  muscleGroupId: z.number().int().positive(),
  equipment: z.enum(EQUIPMENT as [string, ...string[]]),
  instructions: z.string().trim().max(1000).nullable().optional(),
});

export const FOOD_CATEGORIES = [
  'protein',
  'grains_carbs',
  'dairy_eggs',
  'fruits_veg',
  'fats_nuts',
  'drinks_supps',
  'meals',
] as const;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const CreateFoodSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(FOOD_CATEGORIES).default('meals'),
  servingLabel: z.string().trim().min(1).max(50).default('100 g'),
  servingGrams: z.number().int().min(1).max(5000).default(100),
  calories: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(500).default(0),
  carbsG: z.number().min(0).max(1000).default(0),
  fatG: z.number().min(0).max(500).default(0),
});

export const LogMealSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealType: z.enum(MEAL_TYPES).default('snack'),
    foodId: z.number().int().positive().nullable().optional(),
    foodName: z.string().trim().min(1).max(100).optional(),
    servingLabel: z.string().trim().min(1).max(50).optional(),
    servings: z.number().min(0.1).max(20).default(1),
    calories: z.number().int().min(0).max(5000).optional(),
    proteinG: z.number().min(0).max(500).default(0),
    carbsG: z.number().min(0).max(1000).default(0),
    fatG: z.number().min(0).max(500).default(0),
  })
  .refine((v) => v.foodId != null || (v.foodName && v.calories !== undefined), {
    message: 'Provide either foodId or custom foodName + calories.',
  });

export const LogWaterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMl: z.number().int().min(50).max(5000),
  containerLabel: z.string().trim().min(1).max(40).default('Glass'),
});
