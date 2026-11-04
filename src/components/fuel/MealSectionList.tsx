'use client';

import { Coffee, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { MealLog, MealType } from '@/types/database';

const MEAL_SECTIONS: {
  type: MealType;
  title: string;
  subtitle: string;
  Icon: typeof Coffee;
}[] = [
  { type: 'breakfast', title: 'Breakfast', subtitle: 'Morning fuel & oats', Icon: Coffee },
  { type: 'lunch', title: 'Lunch', subtitle: 'Midday performance meal', Icon: Sun },
  { type: 'dinner', title: 'Dinner', subtitle: 'Evening recovery meal', Icon: Moon },
  { type: 'snack', title: 'Snacks & Shakes', subtitle: 'Pre/post-workout nutrition', Icon: Utensils },
];

export function MealSectionList({
  meals,
  busy,
  onOpenAdd,
  onDeleteMeal,
}: {
  meals: MealLog[];
  busy: boolean;
  onOpenAdd: (mealType: MealType) => void;
  onDeleteMeal: (id: number) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {MEAL_SECTIONS.map(({ type, title, subtitle, Icon }) => {
        const items = meals.filter((m) => m.meal_type === type);
        const totalKcal = items.reduce((s, m) => s + m.calories, 0);
        const totalPro = items.reduce((s, m) => s + m.protein_g, 0);

        return (
          <Card key={type} aria-label={`${title} meals`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-train">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-bold leading-tight text-fg">{title}</h3>
                  <p className="truncate text-xs text-fg-3">
                    {items.length > 0
                      ? `${totalKcal} kcal · ${Math.round(totalPro)}g protein`
                      : subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenAdd(type)}
                className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-surface-2 px-3 text-sm font-semibold text-fg hover:bg-surface-3"
              >
                <Plus className="h-4 w-4 text-train" /> Add
              </button>
            </div>

            {items.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line pt-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-fg">{item.food_name}</p>
                      <p className="mt-0.5 text-xs text-fg-3">
                        {item.servings !== 1 ? `${item.servings} × ` : ''}
                        {item.serving_label} ·{' '}
                        <span className="font-semibold text-fg-2">{Math.round(item.protein_g)}g P</span> ·{' '}
                        <span>{Math.round(item.carbs_g)}g C</span> ·{' '}
                        <span>{Math.round(item.fat_g)}g F</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-sm font-bold text-fg">{item.calories} kcal</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeleteMeal(item.id)}
                        aria-label={`Delete ${item.food_name}`}
                        className="press flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-train"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
