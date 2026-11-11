'use client';

import { useMemo, useState } from 'react';
import { Check, Flame, Plus, Sparkles, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/format';
import type { MealType } from '@/types/database';

export type CookingMethodId = 'boiled' | 'grilled' | 'roasted' | 'fried';

export interface CookingMethod {
  id: CookingMethodId;
  label: string;
  oilGrams: number;
  oilKcal: number;
  description: string;
}

export const COOKING_METHODS: CookingMethod[] = [
  {
    id: 'boiled',
    label: 'Boiled / Steamed',
    oilGrams: 0,
    oilKcal: 0,
    description: 'Zero added oil (0 kcal). Pure lean food macros.',
  },
  {
    id: 'grilled',
    label: 'Air-Fried / Grilled',
    oilGrams: 3,
    oilKcal: 27,
    description: 'Light non-stick oil spray (+3g oil, +27 kcal).',
  },
  {
    id: 'roasted',
    label: 'Pan-Roasted / Sautéed',
    oilGrams: 7,
    oilKcal: 63,
    description: 'Home skillet cook with 1 tsp oil (+7g oil, +63 kcal).',
  },
  {
    id: 'fried',
    label: 'Deep-Fried / Crispy',
    oilGrams: 15,
    oilKcal: 135,
    description: 'Submerged fry with high oil absorption (+15g oil, +135 kcal).',
  },
];

export interface BaseStapleFood {
  id: string;
  name: string;
  icon: string;
  category: 'protein' | 'carb' | 'side';
  baseServing: string;
  baseCalories: number;
  baseProteinG: number;
  baseCarbsG: number;
  baseFatG: number;
  supportsPrep: boolean;
}

export const STAPLE_INGREDIENTS: BaseStapleFood[] = [
  {
    id: 'chicken_breast',
    name: 'Chicken Breast',
    icon: '🍗',
    category: 'protein',
    baseServing: '150g raw',
    baseCalories: 165,
    baseProteinG: 31,
    baseCarbsG: 0,
    baseFatG: 3.6,
    supportsPrep: true,
  },
  {
    id: 'fish_fillet',
    name: 'Fish Fillet (Tilapia/Salmon)',
    icon: '🐟',
    category: 'protein',
    baseServing: '150g fillet',
    baseCalories: 140,
    baseProteinG: 30,
    baseCarbsG: 0,
    baseFatG: 2,
    supportsPrep: true,
  },
  {
    id: 'whole_eggs',
    name: 'Whole Eggs',
    icon: '🥚',
    category: 'protein',
    baseServing: '2 large eggs',
    baseCalories: 144,
    baseProteinG: 12.6,
    baseCarbsG: 0.8,
    baseFatG: 9.5,
    supportsPrep: true,
  },
  {
    id: 'egg_whites',
    name: 'Egg Whites',
    icon: '🍳',
    category: 'protein',
    baseServing: '150g whites',
    baseCalories: 78,
    baseProteinG: 16.5,
    baseCarbsG: 1,
    baseFatG: 0.3,
    supportsPrep: true,
  },
  {
    id: 'paneer_tofu',
    name: 'Paneer / Tofu',
    icon: '🧀',
    category: 'protein',
    baseServing: '100g cube',
    baseCalories: 265,
    baseProteinG: 18,
    baseCarbsG: 3,
    baseFatG: 20,
    supportsPrep: true,
  },
  {
    id: 'ground_beef',
    name: 'Lean Ground Beef (93/7)',
    icon: '🥩',
    category: 'protein',
    baseServing: '150g portion',
    baseCalories: 220,
    baseProteinG: 30,
    baseCarbsG: 0,
    baseFatG: 10,
    supportsPrep: true,
  },
  {
    id: 'white_rice',
    name: 'White Basmati Rice',
    icon: '🍚',
    category: 'carb',
    baseServing: '150g cooked',
    baseCalories: 195,
    baseProteinG: 4,
    baseCarbsG: 43,
    baseFatG: 0.5,
    supportsPrep: false,
  },
  {
    id: 'roti_chapati',
    name: 'Whole Wheat Roti',
    icon: '🫓',
    category: 'carb',
    baseServing: '2 rotis',
    baseCalories: 160,
    baseProteinG: 6,
    baseCarbsG: 32,
    baseFatG: 1.5,
    supportsPrep: true, // oil brushed vs dry
  },
  {
    id: 'potatoes',
    name: 'Potatoes / Wedges',
    icon: '🥔',
    category: 'carb',
    baseServing: '200g portion',
    baseCalories: 170,
    baseProteinG: 4,
    baseCarbsG: 37,
    baseFatG: 0.2,
    supportsPrep: true,
  },
  {
    id: 'steamed_veggies',
    name: 'Broccoli & Mixed Veggies',
    icon: '🥦',
    category: 'side',
    baseServing: '150g steamed',
    baseCalories: 50,
    baseProteinG: 3.5,
    baseCarbsG: 8,
    baseFatG: 0.5,
    supportsPrep: true,
  },
];

interface SelectedItemState {
  multiplier: number;
  method: CookingMethodId;
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
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemState>>({
    chicken_breast: { multiplier: 1, method: 'grilled' },
    white_rice: { multiplier: 1, method: 'boiled' },
  });
  const [targetMeal, setTargetMeal] = useState<MealType>('lunch');
  const [logging, setLogging] = useState(false);

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[id]) {
        delete copy[id];
      } else {
        copy[id] = { multiplier: 1, method: 'grilled' };
      }
      return copy;
    });
  };

  const setMethod = (id: string, method: CookingMethodId) => {
    setSelectedItems((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], method } };
    });
  };

  const setMultiplier = (id: string, mult: number) => {
    setSelectedItems((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], multiplier: mult } };
    });
  };

  // Compute live combined totals
  const totals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    const names: string[] = [];

    for (const [id, state] of Object.entries(selectedItems)) {
      const staple = STAPLE_INGREDIENTS.find((s) => s.id === id);
      if (!staple) continue;

      const methodObj = COOKING_METHODS.find((m) => m.id === state.method) ?? COOKING_METHODS[0];
      const mult = state.multiplier;

      const itemCal = (staple.baseCalories + (staple.supportsPrep ? methodObj.oilKcal : 0)) * mult;
      const itemP = staple.baseProteinG * mult;
      const itemC = staple.baseCarbsG * mult;
      const itemF = (staple.baseFatG + (staple.supportsPrep ? methodObj.oilGrams : 0)) * mult;

      calories += itemCal;
      proteinG += itemP;
      carbsG += itemC;
      fatG += itemF;

      const prepLabel = staple.supportsPrep ? ` (${methodObj.label.split(' / ')[0]})` : '';
      names.push(`${staple.name}${prepLabel}`);
    }

    return {
      calories: Math.round(calories),
      proteinG: Math.round(proteinG * 10) / 10,
      carbsG: Math.round(carbsG * 10) / 10,
      fatG: Math.round(fatG * 10) / 10,
      title: names.join(' + ') || 'Custom Compound Meal',
    };
  }, [selectedItems]);

  const handleLogCompoundMeal = async () => {
    if (totals.calories <= 0) return;
    setLogging(true);
    try {
      await onLogMeal({
        mealType: targetMeal,
        foodName: totals.title,
        servingLabel: `${Object.keys(selectedItems).length} items combo`,
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
      });
    } finally {
      setLogging(false);
    }
  };

  return (
    <Card className="space-y-4" aria-label="Cooking Prep and Compound Meal Builder">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-train/15 px-2.5 py-0.5 text-xs font-bold text-train">
              <Utensils className="h-3.5 w-3.5" /> Prep & Compound Meals
            </span>
            <span className="hidden sm:inline text-xs font-semibold text-fg-3">Oil Calorie Multiplier</span>
          </div>
          <p className="mt-1 text-xs text-fg-2">
            Pick staples, choose prep method (boiled vs fried oil weight), and assemble combo plates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="compound-slot" className="text-xs font-semibold text-fg-3">
            Slot:
          </label>
          <select
            id="compound-slot"
            value={targetMeal}
            onChange={(e) => setTargetMeal(e.target.value as MealType)}
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold text-fg"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
      </div>

      {/* Staple item pills */}
      <div>
        <p className="mb-2 text-footnote font-semibold text-fg-2">Select Ingredients / Staples:</p>
        <div className="flex flex-wrap gap-1.5">
          {STAPLE_INGREDIENTS.map((item) => {
            const isSelected = Boolean(selectedItems[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={cn(
                  'press inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                  isSelected
                    ? 'border-accent bg-accent/15 text-white shadow-sm'
                    : 'border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
                )}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-accent" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Items Config List */}
      {Object.keys(selectedItems).length > 0 && (
        <div className="space-y-3 pt-1">
          <p className="text-footnote font-semibold text-fg-3 uppercase tracking-wider text-[11px]">
            Selected Plate Components & Cooking Method:
          </p>

          <div className="space-y-2.5">
            {Object.entries(selectedItems).map(([id, state]) => {
              const staple = STAPLE_INGREDIENTS.find((s) => s.id === id);
              if (!staple) return null;

              return (
                <div
                  key={id}
                  className="rounded-2xl border border-line bg-surface-1 p-3 transition-colors hover:border-surface-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{staple.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-fg">{staple.name}</p>
                        <p className="text-[11px] text-fg-3">
                          Base: {staple.baseServing} · {staple.baseCalories} kcal · {staple.baseProteinG}g P · {staple.baseCarbsG}g C · {staple.baseFatG}g F
                        </p>
                      </div>
                    </div>

                    {/* Portion multiplier */}
                    <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
                      {[0.5, 1, 1.5, 2].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMultiplier(id, m)}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-bold transition-colors',
                            state.multiplier === m
                              ? 'bg-accent-solid text-white'
                              : 'text-fg-3 hover:text-fg'
                          )}
                        >
                          {m}×
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cooking method selection (if supported) */}
                  {staple.supportsPrep && (
                    <div className="mt-2.5 border-t border-line/60 pt-2">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-fg-3">
                          Cooking Method / Oil Weight:
                        </span>
                        <span className="hidden sm:inline text-[11px] text-fg-3">
                          {COOKING_METHODS.find((m) => m.id === state.method)?.description}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {COOKING_METHODS.map((m) => {
                          const isCur = state.method === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setMethod(id, m.id)}
                              className={cn(
                                'press rounded-xl border p-2 text-left transition-colors min-w-0',
                                isCur
                                  ? 'border-water bg-water/10 text-white'
                                  : 'border-line/60 bg-surface-2 text-fg-2 hover:bg-surface-3'
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate text-xs font-bold">{m.label}</span>
                                {isCur && <Check className="h-3 w-3 shrink-0 text-water" />}
                              </div>
                              <span
                                className={cn(
                                  'mt-0.5 block truncate text-[10px] font-semibold',
                                  m.oilGrams === 0 ? 'text-water' : 'text-train'
                                )}
                              >
                                {m.oilGrams === 0 ? '0g oil (0 kcal)' : `+${m.oilGrams}g oil (+${m.oilKcal} kcal)`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Footer Bar */}
      {Object.keys(selectedItems).length > 0 && (
        <div className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                Combined Combo Plate Summary
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-fg">
                {totals.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <span className="font-display text-base font-extrabold text-fg">
                  {totals.calories} <span className="text-xs font-normal text-fg-3">kcal</span>
                </span>
                <span className="font-semibold text-protein">{totals.proteinG}g Protein</span>
                <span className="font-semibold text-water">{totals.carbsG}g Carbs</span>
                <span className="font-semibold text-fg-2">{totals.fatG}g Fat</span>
              </div>
            </div>

            <Button
              size="md"
              loading={logging}
              onClick={handleLogCompoundMeal}
              className="shrink-0 bg-accent-solid text-white hover:bg-accent-solid/90"
            >
              <Plus className="h-4 w-4" /> Log Combo to {targetMeal}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
