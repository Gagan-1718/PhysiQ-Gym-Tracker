'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { send } from '@/lib/client';
import type { FoodCategory, FoodItem, MealType } from '@/types/database';

type SheetMode = 'library' | 'quick' | 'create';

const CATEGORY_OPTIONS: { value: 'all' | FoodCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meals', label: 'Meals' },
  { value: 'protein', label: 'Protein' },
  { value: 'grains_carbs', label: 'Carbs' },
  { value: 'dairy_eggs', label: 'Dairy & Eggs' },
  { value: 'drinks_supps', label: 'Shakes' },
  { value: 'fruits_veg', label: 'Fruits & Veg' },
  { value: 'fats_nuts', label: 'Fats & Nuts' },
];

const SERVING_MULTIPLIERS = [0.5, 1, 1.5, 2];

export function AddMealSheet({
  open,
  mealType,
  onMealTypeChange,
  onClose,
  onLogLibraryFood,
  onLogQuickMeal,
}: {
  open: boolean;
  mealType: MealType;
  onMealTypeChange: (m: MealType) => void;
  onClose: () => void;
  onLogLibraryFood: (foodId: number, servings: number, mealType: MealType) => Promise<void>;
  onLogQuickMeal: (payload: {
    mealType: MealType;
    foodName: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<SheetMode>('library');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | FoodCategory>('all');
  const [servings, setServings] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-entry & create-food state
  const [name, setName] = useState('');
  const [servingLabel, setServingLabel] = useState('1 serving');
  const [newCategory, setNewCategory] = useState<FoodCategory>('meals');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const { data, mutate: mutateFoods } = useSWR<{ foods: FoodItem[] }>(
    open ? '/api/foods' : null
  );

  const foods = (data?.foods ?? []).filter((f) => {
    if (category !== 'all' && f.category !== category) return false;
    if (search.trim() && !f.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const resetForm = () => {
    setName('');
    setServingLabel('1 serving');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setError(null);
  };

  const handleLibraryPick = async (food: FoodItem) => {
    setBusy(true);
    setError(null);
    try {
      await onLogLibraryFood(food.id, servings, mealType);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleQuickOrCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !calories) {
      setError('Enter a food name and calories.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cal = Math.round(Number(calories) || 0);
      const pro = Number(proteinG) || 0;
      const carb = Number(carbsG) || 0;
      const fat = Number(fatG) || 0;

      if (mode === 'create') {
        const created = await send<FoodItem>('/api/foods', 'POST', {
          name: name.trim(),
          category: newCategory,
          servingLabel: servingLabel.trim() || '100 g',
          servingGrams: 100,
          calories: cal,
          proteinG: pro,
          carbsG: carb,
          fatG: fat,
        });
        await mutateFoods();
        await onLogLibraryFood(created.id, 1, mealType);
      } else {
        await onLogQuickMeal({
          mealType,
          foodName: name.trim(),
          servingLabel: servingLabel.trim() || '1 serving',
          calories: cal,
          proteinG: pro,
          carbsG: carb,
          fatG: fat,
        });
      }
      resetForm();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Log Food & Macros">
      <div className="space-y-4">
        <Segmented<MealType>
          label="Meal slot"
          value={mealType}
          onChange={onMealTypeChange}
          options={[
            { value: 'breakfast', label: 'Breakfast' },
            { value: 'lunch', label: 'Lunch' },
            { value: 'dinner', label: 'Dinner' },
            { value: 'snack', label: 'Snack' },
          ]}
        />

        <Segmented<SheetMode>
          label="Entry mode"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'library', label: 'Food Library' },
            { value: 'quick', label: 'Quick Macros' },
            { value: 'create', label: 'New Food' },
          ]}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-train/15 px-3 py-2 text-xs font-semibold text-train">
            {error}
          </p>
        )}

        {mode === 'library' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
              <input
                type="search"
                aria-label="Search foods"
                placeholder="Search chicken, oats, whey, rice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-[15px] text-fg placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
              />
            </div>

            {/* Category filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-train text-white'
                        : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Serving multiplier */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
              <span className="text-xs font-semibold text-fg-2">Portion multiplier</span>
              <div className="flex gap-1">
                {SERVING_MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setServings(m)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      servings === m
                        ? 'bg-fg text-black'
                        : 'bg-surface-3 text-fg-2 hover:text-fg'
                    }`}
                  >
                    {m}×
                  </button>
                ))}
              </div>
            </div>

            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-surface-2 px-3">
              {foods.map((food) => {
                const scaledCal = Math.round(food.calories * servings);
                const scaledPro = Math.round(food.protein_g * servings);
                const scaledCarb = Math.round(food.carbs_g * servings);
                const scaledFat = Math.round(food.fat_g * servings);
                return (
                  <li key={food.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">
                        {food.name}
                        {food.user_id !== null && (
                          <span className="ml-1.5 rounded bg-surface-4 px-1.5 py-0.5 text-[10px] font-bold text-fg-2">
                            Custom
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-fg-3">
                        {servings !== 1 ? `${servings} × ` : ''}
                        {food.serving_label} · <span className="text-fg-2">{scaledPro}g P</span> ·{' '}
                        {scaledCarb}g C · {scaledFat}g F
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleLibraryPick(food)}
                      className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-train px-3 text-xs font-bold text-white disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" /> {scaledCal} kcal
                    </button>
                  </li>
                );
              })}
              {foods.length === 0 && (
                <li className="py-6 text-center text-sm text-fg-3">
                  No matching foods found. Use Quick Macros or New Food to add it.
                </li>
              )}
            </ul>
          </div>
        ) : (
          <form onSubmit={handleQuickOrCreateSubmit} className="space-y-3">
            <Field
              label="Food or meal name"
              placeholder="e.g. Double Chicken Wrap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Serving size label"
                placeholder="1 wrap (280 g)"
                value={servingLabel}
                onChange={(e) => setServingLabel(e.target.value)}
              />
              <Field
                label="Calories"
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                suffix="kcal"
                placeholder="480"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                required
              />
            </div>

            {mode === 'create' && (
              <div>
                <label htmlFor="new-food-category" className="mb-1.5 block px-1 text-footnote font-medium text-fg-2">
                  Category
                </label>
                <select
                  id="new-food-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as FoodCategory)}
                  className="h-12 w-full rounded-field border border-line bg-surface-2 px-4 text-[16px] text-fg"
                >
                  <option value="meals">Complete Meals</option>
                  <option value="protein">Protein</option>
                  <option value="grains_carbs">Grains & Carbs</option>
                  <option value="dairy_eggs">Dairy & Eggs</option>
                  <option value="drinks_supps">Drinks & Supplements</option>
                  <option value="fruits_veg">Fruits & Veg</option>
                  <option value="fats_nuts">Fats & Nuts</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <Field
                label="Protein"
                type="number"
                inputMode="decimal"
                min={0}
                max={500}
                step="0.5"
                suffix="g"
                placeholder="42"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
              />
              <Field
                label="Carbs"
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step="0.5"
                suffix="g"
                placeholder="45"
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
              />
              <Field
                label="Fat"
                type="number"
                inputMode="decimal"
                min={0}
                max={500}
                step="0.5"
                suffix="g"
                placeholder="14"
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
              />
            </div>

            <Button type="submit" loading={busy} className="w-full">
              {mode === 'create' ? 'Save to Library & Log Meal' : 'Log Meal'}
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
