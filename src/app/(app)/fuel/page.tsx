'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Card';
import { ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { MacroSummaryCard } from '@/components/fuel/MacroSummaryCard';
import { MealSectionList } from '@/components/fuel/MealSectionList';
import { WaterTrackerCard } from '@/components/fuel/WaterTrackerCard';
import { AddMealSheet } from '@/components/fuel/AddMealSheet';
import { send } from '@/lib/client';
import { localDateISO, parseLocalDate, relativeDay, shortDate } from '@/lib/format';
import type { MealType, NutritionResponse } from '@/types/database';

function shiftDate(iso: string, deltaDays: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + deltaDays);
  return localDateISO(d);
}

export default function FuelPage() {
  const toast = useToast();
  const today = useMemo(() => localDateISO(), []);
  const [date, setDate] = useState(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMealType, setSheetMealType] = useState<MealType>('breakfast');
  const [busy, setBusy] = useState(false);

  const { data, error, mutate } = useSWR<NutritionResponse>(`/api/nutrition?date=${date}`);

  const isToday = date >= today;

  const openMealSheet = (type: MealType) => {
    setSheetMealType(type);
    setSheetOpen(true);
  };

  const handleLogLibraryFood = async (foodId: number, servings: number, mealType: MealType) => {
    await send('/api/nutrition/meals', 'POST', {
      date,
      mealType,
      foodId,
      servings,
    });
    await mutate();
    toast('Meal logged');
  };

  const handleLogQuickMeal = async (payload: {
    mealType: MealType;
    foodName: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => {
    await send('/api/nutrition/meals', 'POST', {
      date,
      ...payload,
      servings: 1,
    });
    await mutate();
    toast('Meal logged');
  };

  const handleDeleteMeal = async (id: number) => {
    setBusy(true);
    try {
      await send(`/api/nutrition/meals?id=${id}`, 'DELETE');
      await mutate();
      toast('Meal removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete meal', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddWater = async (amountMl: number, containerLabel: string) => {
    setBusy(true);
    try {
      await send('/api/nutrition/water', 'POST', {
        date,
        amountMl,
        containerLabel,
      });
      await mutate();
      toast(`+${amountMl} ml logged`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not log water', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWater = async (id: number) => {
    setBusy(true);
    try {
      await send(`/api/nutrition/water?id=${id}`, 'DELETE');
      await mutate();
      toast('Water entry removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete entry', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 pb-4 pt-4">
        <div>
          <p className="text-eyebrow uppercase text-fg-3">Nutrition & Hydration</p>
          <h1 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.025em] sm:text-large-title">
            Fuel & Water
          </h1>
        </div>

        {/* Date stepper */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-1 p-1">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="press flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="min-w-[6.5rem] px-2 text-center text-xs font-bold text-fg"
          >
            {relativeDay(date)}
            <span className="block text-[10px] font-medium text-fg-3">{shortDate(date)}</span>
          </button>
          <button
            type="button"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="press flex h-9 w-9 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error && <ErrorNote message={error.message} onRetry={() => mutate()} />}

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : (
        <>
          <MacroSummaryCard fuel={data.fuel} />

          <SectionHeader
            title="Meals"
            action={
              <Button size="sm" onClick={() => openMealSheet('snack')}>
                <Plus className="h-4 w-4" /> Log Food
              </Button>
            }
          />
          <MealSectionList meals={data.meals} busy={busy} onOpenAdd={openMealSheet} onDeleteMeal={handleDeleteMeal} />

          <SectionHeader title="Water" />
          <WaterTrackerCard
            fuel={data.fuel}
            waterLogs={data.waterLogs}
            busy={busy}
            onAddWater={handleAddWater}
            onDeleteWater={handleDeleteWater}
          />
        </>
      )}

      <AddMealSheet
        open={sheetOpen}
        mealType={sheetMealType}
        onMealTypeChange={setSheetMealType}
        onClose={() => setSheetOpen(false)}
        onLogLibraryFood={handleLogLibraryFood}
        onLogQuickMeal={handleLogQuickMeal}
      />
    </>
  );
}
