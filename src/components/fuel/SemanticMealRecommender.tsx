'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, ChevronUp, Plus, Search, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { FoodItem, MealType } from '@/types/database';
import type { VectorSearchHit } from '@/lib/vector';

interface MealPromptItem {
  label: string;
  query: string;
}

const MEAL_PROMPTS: MealPromptItem[] = [
  { label: 'High Protein', query: 'High protein post-workout recovery' },
  { label: 'Fat Loss', query: 'Low calorie fat loss filling snack' },
  { label: 'Quick Carbs', query: 'Quick morning complex carbs energy' },
  { label: 'Lean Dinner', query: 'Lean high protein dinner bowl' },
  { label: 'Vegetarian', query: 'Indian vegetarian high protein' },
  { label: 'Low Carb', query: 'Low carb keto fat burner' },
  { label: 'Pre-Workout', query: 'Pre-workout fast digesting carbs' },
  { label: 'Night Snack', query: 'Late night guilt-free casein snack' },
  { label: 'Mass Gainer', query: 'Budget bulk mass gainer meal' },
  { label: 'High Fiber', query: 'High fiber gut health bowl' },
];

interface VectorFoodResponse {
  domain: 'food';
  query: string;
  dimensions: number;
  metric: string;
  results: VectorSearchHit[];
}

export function SemanticMealRecommender({
  busy,
  onQuickLogFood,
}: {
  busy: boolean;
  onQuickLogFood: (foodId: number, mealType: MealType) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [expandedTags, setExpandedTags] = useState(false);

  const url =
    query.trim().length >= 2
      ? `/api/vector/search?domain=food&q=${encodeURIComponent(query.trim())}&k=5`
      : null;

  const { data } = useSWR<VectorFoodResponse>(url);
  const { data: foodsData } = useSWR<{ foods: FoodItem[] }>('/api/foods');

  const defaultStaples = (foodsData?.foods ?? [])
    .filter((f) => ['Chicken & Rice Bowl', 'Chicken Breast (Grilled)', 'Whole Eggs (Boiled/Scrambled)', 'Whey Protein Shake', 'Salmon Fillet (Pan-Seared)'].includes(f.name))
    .slice(0, 5);

  return (
    <Card aria-label="Semantic vector meal recommender">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-water/15 px-2.5 py-0.5 text-xs font-bold text-water">
            <Sparkles className="h-3.5 w-3.5" /> Vector Nutrition Match
          </span>
          <span className="hidden sm:inline text-xs text-fg-3">32-d Cosine Similarity</span>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor="vector-meal-slot" className="sr-only">
            Target meal slot
          </label>
          <select
            id="vector-meal-slot"
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold text-fg"
          >
            <option value="breakfast">→ Breakfast</option>
            <option value="lunch">→ Lunch</option>
            <option value="dinner">→ Dinner</option>
            <option value="snack">→ Snack</option>
          </select>
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
        <input
          type="search"
          aria-label="Semantic meal search"
          placeholder="Search by goal: e.g. high protein low carb recovery..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-[15px] text-fg placeholder:text-fg-3 focus:border-water/60 focus:outline-none"
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {(expandedTags ? MEAL_PROMPTS : MEAL_PROMPTS.slice(0, 4)).map((p) => {
          const active = query === p.query;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setQuery(p.query)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-water text-black'
                  : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setExpandedTags(!expandedTags)}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-fg-3 hover:bg-surface-3 hover:text-fg"
        >
          {expandedTags ? (
            <>
              Less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              +{MEAL_PROMPTS.length - 4} more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {data && data.results.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold text-fg-3">
            Top semantic matches for <span className="text-fg-2">“{data.query}”</span>
          </p>
          <ul className="divide-y divide-line">
            {data.results.map((hit) => {
              const cal = Number(hit.metadata?.calories ?? 0);
              return (
                <li key={hit.entity_id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-fg">{hit.title}</span>
                      <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-bold text-water">
                        {hit.match_pct}% · cos {hit.cosine_similarity.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-3">{hit.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onQuickLogFood(hit.entity_id, mealType)}
                    aria-label={`Log ${hit.title}`}
                    className="press inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent-solid px-2.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> {cal} kcal
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : defaultStaples.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-fg-3">
              Recommended Daily Staples <span className="text-fg-3 font-normal">(select tag or search above)</span>
            </p>
            <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-fg-2 uppercase">Default Staples</span>
          </div>
          <ul className="divide-y divide-line">
            {defaultStaples.map((food) => (
              <li key={food.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold text-fg">{food.name}</span>
                    <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-protein">
                      {food.protein_g}g P
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-3">
                    {food.serving_label} · {food.calories} kcal · {food.carbs_g}g C · {food.fat_g}g F
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onQuickLogFood(food.id, mealType)}
                  aria-label={`Log ${food.name}`}
                  className="press inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent-solid px-2.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> {food.calories} kcal
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
