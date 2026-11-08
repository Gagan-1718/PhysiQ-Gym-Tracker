'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, Plus, UtensilsCrossed, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/format';
import type { FoodCategory, FoodItem, MealType } from '@/types/database';

/**
 * Build a plate from the food library (the `foods` table, so built-in and the
 * member's own foods), pick a portion and how each part was cooked, and log the
 * whole plate as one meal. Cooking oil is added on top of each food's own
 * macros: oil is pure fat, 9 kcal per gram.
 */
export const COOKING_METHODS = [
  { id: 'none', label: 'No added oil', oilG: 0 },
  { id: 'spray', label: 'Oil spray (+3 g)', oilG: 3 },
  { id: 'pan', label: 'Pan-fried (+7 g)', oilG: 7 },
  { id: 'deep', label: 'Deep-fried (+15 g)', oilG: 15 },
] as const;
type MethodId = (typeof COOKING_METHODS)[number]['id'];

const KCAL_PER_G_FAT = 9;
const PORTIONS = [0.5, 1, 1.5, 2];
const GROUPS: { category: FoodCategory; label: string }[] = [
  { category: 'protein', label: 'Protein' },
  { category: 'dairy_eggs', label: 'Eggs & dairy' },
  { category: 'grains_carbs', label: 'Carbs' },
  { category: 'fruits_veg', label: 'Fruit & veg' },
];
// Limits of the meal_logs columns (and LogMealSchema)
const MAX_NAME = 100;
const MAX_KCAL = 5000;

interface PlateItem {
  food: FoodItem;
  portion: number;
  method: MethodId;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtPortion = (p: number) => `${p}×`;

function plateName(items: PlateItem[]) {
  const names = items.map((i) => (i.portion === 1 ? i.food.name : `${i.food.name} ${fmtPortion(i.portion)}`));
  for (let shown = names.length; shown > 0; shown--) {
    const rest = names.length - shown;
    const name = names.slice(0, shown).join(' + ') + (rest ? ` + ${rest} more` : '');
    if (name.length <= MAX_NAME) return name;
  }
  return `Plate of ${items.length} items`;
}

export function PrepMethodMealBuilder({
  onLogMeal,
}: {
  onLogMeal: (payload: {
    mealType: MealType;
    foodName: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlateItem[]>([]);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [logging, setLogging] = useState(false);
  const { data } = useSWR<{ foods: FoodItem[] }>(open ? '/api/foods' : null);

  const selected = new Set(items.map((i) => i.food.id));

  const toggle = (food: FoodItem) =>
    setItems((prev) => (prev.some((i) => i.food.id === food.id) ? prev.filter((i) => i.food.id !== food.id) : [...prev, { food, portion: 1, method: 'none' }]));
  const patch = (id: number, p: Partial<PlateItem>) => setItems((prev) => prev.map((i) => (i.food.id === id ? { ...i, ...p } : i)));

  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let oil = 0;
    for (const { food, portion, method } of items) {
      const oilG = COOKING_METHODS.find((m) => m.id === method)!.oilG * portion;
      oil += oilG;
      calories += food.calories * portion + oilG * KCAL_PER_G_FAT;
      protein += food.protein_g * portion;
      carbs += food.carbs_g * portion;
      fat += food.fat_g * portion + oilG;
    }
    return { calories: Math.round(calories), protein: round1(protein), carbs: round1(carbs), fat: round1(fat), oil: round1(oil) };
  }, [items]);

  async function logPlate() {
    if (items.length === 0) return;
    if (totals.calories > MAX_KCAL) return toast(`A single meal can be at most ${MAX_KCAL} kcal. Make the portions smaller.`, 'error');
    setLogging(true);
    try {
      await onLogMeal({
        mealType,
        foodName: plateName(items),
        servingLabel: `${items.length} item${items.length === 1 ? '' : 's'}${totals.oil ? `, ${totals.oil} g oil` : ''}`,
        calories: totals.calories,
        proteinG: totals.protein,
        carbsG: totals.carbs,
        fatG: totals.fat,
      });
      setItems([]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not log the plate', 'error');
    } finally {
      setLogging(false);
    }
  }

  return (
    <Card className="p-0 sm:p-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="plate-builder"
        onClick={() => setOpen((o) => !o)}
        className="press flex w-full items-center gap-3 rounded-card p-4 text-left hover:bg-surface-2 sm:p-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <UtensilsCrossed className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline">Build a plate</span>
          <span className="text-footnote text-fg-3">Combine foods and count the cooking oil</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div id="plate-builder" className="space-y-4 border-t border-line p-4 sm:p-5">
          {!data ? (
            <p className="text-footnote text-fg-3">Loading the food library…</p>
          ) : (
            GROUPS.map(({ category, label }) => (
              <div key={category}>
                <p className="mb-1.5 text-footnote font-medium text-fg-2">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(data.foods ?? []).filter((f) => f.category === category).map((food) => {
                    const on = selected.has(food.id);
                    return (
                      <button
                        key={food.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(food)}
                        className={cn(
                          'press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                          on ? 'border-accent bg-accent/15 text-fg' : 'border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
                        )}
                      >
                        {food.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map(({ food, portion, method }) => (
                <li key={food.id} className="rounded-2xl border border-line bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{food.name}</p>
                      <p className="text-xs text-fg-3">
                        1 serving = {food.serving_label} · {food.calories} kcal
                      </p>
                    </div>
                    <button type="button" aria-label={`Remove ${food.name}`} onClick={() => toggle(food)} className="press -mr-1 -mt-1 rounded-full p-2 text-fg-3 hover:bg-surface-3 hover:text-fg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div role="radiogroup" aria-label={`Servings of ${food.name}`} className="flex rounded-lg bg-surface-3 p-0.5">
                      {PORTIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={portion === p}
                          onClick={() => patch(food.id, { portion: p })}
                          className={cn('tabular rounded-md px-2.5 py-1 text-xs font-bold transition-colors', portion === p ? 'bg-surface-4 text-fg' : 'text-fg-2 hover:text-fg')}
                        >
                          {fmtPortion(p)}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label={`How ${food.name} was cooked`}
                      value={method}
                      onChange={(e) => patch(food.id, { method: e.target.value as MethodId })}
                      className="h-9 w-full rounded-lg border border-line bg-surface-3 px-2 text-sm font-semibold text-fg sm:w-auto sm:min-w-[11rem] sm:flex-1"
                    >
                      {COOKING_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-4">
              <p className="tabular font-display text-2xl font-extrabold">
                {totals.calories} <span className="text-sm font-normal text-fg-3">kcal</span>
              </p>
              <p className="tabular mt-0.5 text-footnote text-fg-2">
                {totals.protein} g protein · {totals.carbs} g carbs · {totals.fat} g fat{totals.oil > 0 && ` (${totals.oil} g from oil)`}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="plate-meal" className="sr-only">
                  Log to which meal
                </label>
                <select
                  id="plate-meal"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-fg"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
                <Button className="flex-1" loading={logging} onClick={logPlate}>
                  <Plus className="h-4 w-4" /> Log plate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
