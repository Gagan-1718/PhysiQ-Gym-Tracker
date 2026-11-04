'use client';

import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { Rings } from '@/components/ui/Rings';
import { kg } from '@/lib/format';
import type { DailyFuel } from '@/types/database';

const TRAIN = { color: '#FF4B2B', deep: '#B01A0E' };
const PROTEIN = { color: '#EDEDF0', deep: '#8B8B93' };
const WATER = { color: '#3CC8F2', deep: '#0E7FA0' };

function Metric({ label, value, target, unit, color, done }: { label: string; value: string; target: string; unit: string; color: string; done?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-fg-2">
        <span className="h-[3px] w-3.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
        {done && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold text-black" style={{ background: color }}>
            <Check className="h-3 w-3" strokeWidth={3} /> Goal hit
          </span>
        )}
      </p>
      <p className="mt-0.5 font-display text-[26px] font-extrabold leading-none text-fg">
        {value}
        <span className="text-[15px] font-bold text-fg-3">
          /{target} {unit}
        </span>
      </p>
    </div>
  );
}

/**
 * Rings: training sessions vs weekly goal, protein and water vs daily targets.
 * Food and water are logged on the Fuel page (meal and water logs, kept in sync by triggers), not here.
 */
export function ActivityCard({
  sessions,
  goal,
  fuel,
}: {
  sessions: number;
  goal: number;
  fuel: DailyFuel | undefined;
}) {
  const protein = fuel ? fuel.protein_logged_g / fuel.protein_target_g : 0;
  const water = fuel ? fuel.water_logged_ml / fuel.water_target_ml : 0;

  return (
    <section className="rounded-[1.75rem] border border-line bg-surface-1 p-5" aria-labelledby="activity-title">
      <h2 id="activity-title" className="sr-only">
        Activity
      </h2>
      <div className="flex items-center gap-5">
        <div className="shrink-0">
          <Rings
            size={138}
            stroke={15}
            gap={3}
            rings={[
              { ...TRAIN, progress: goal ? sessions / goal : 0, label: 'Train' },
              { ...PROTEIN, progress: protein, label: 'Protein' },
              { ...WATER, progress: water, label: 'Water' },
            ]}
          />
        </div>
        <div className="min-w-0 space-y-2.5">
          <Metric label="Train" value={String(sessions)} target={String(goal)} unit="this week" color={TRAIN.color} done={goal > 0 && sessions >= goal} />
          <Metric label="Protein" value={fuel ? String(fuel.protein_logged_g) : '–'} target={fuel ? String(fuel.protein_target_g) : '–'} unit="g" color={PROTEIN.color} done={Boolean(fuel && fuel.protein_logged_g >= fuel.protein_target_g)} />
          <Metric
            label="Water"
            value={fuel ? kg(Math.round(fuel.water_logged_ml / 100) / 10) : '–'}
            target={fuel ? kg(Math.round(fuel.water_target_ml / 100) / 10) : '–'}
            unit="L"
            color={WATER.color}
            done={Boolean(fuel && fuel.water_logged_ml >= fuel.water_target_ml)}
          />
        </div>
      </div>

      {fuel && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <p className="text-footnote text-fg-3">
            {fuel.calories_logged !== undefined
              ? `${fuel.calories_logged.toLocaleString()} / ${fuel.calorie_target.toLocaleString()} kcal · ${kg(fuel.body_weight_kg)} kg`
              : `Targets from ${kg(fuel.body_weight_kg)} kg · ${fuel.calorie_target.toLocaleString()} kcal`}
          </p>
          <Link
            href="/fuel"
            className="press inline-flex h-11 items-center gap-1 rounded-xl bg-surface-2 px-4 text-[15px] font-semibold text-fg hover:bg-surface-3"
          >
            Log food & water <ChevronRight className="h-4 w-4 text-accent" />
          </Link>
        </div>
      )}
    </section>
  );
}
