'use client';

import { Plus } from 'lucide-react';
import { Rings } from '@/components/ui/Rings';
import { kg } from '@/lib/format';
import type { DailyFuel } from '@/types/database';

const TRAIN = { color: '#FA2D55', deep: '#B3123A' };
const PROTEIN = { color: '#B6F23B', deep: '#6FA312' };
const WATER = { color: '#2DD4F5', deep: '#0E7FA0' };

function Metric({ label, value, target, unit, color }: { label: string; value: string; target: string; unit: string; color: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-fg-2">
        <span className="h-[3px] w-3.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 font-round text-[26px] font-extrabold leading-none text-fg">
        {value}
        <span className="text-[15px] font-bold text-fg-3">
          /{target} {unit}
        </span>
      </p>
    </div>
  );
}

function QuickAdd({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 text-[15px] font-semibold text-fg hover:bg-surface-3 disabled:opacity-40"
    >
      <Plus className="h-4 w-4 text-fg-3" />
      {label}
    </button>
  );
}

/** Apple-style rings: training sessions vs weekly goal, protein and water vs daily targets. */
export function ActivityCard({
  sessions,
  goal,
  fuel,
  onLog,
}: {
  sessions: number;
  goal: number;
  fuel: DailyFuel | undefined;
  onLog: (proteinDelta: number, waterDelta: number) => void;
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
          <Metric label="Train" value={String(sessions)} target={String(goal)} unit="this week" color={TRAIN.color} />
          <Metric label="Protein" value={fuel ? String(fuel.protein_logged_g) : '–'} target={fuel ? String(fuel.protein_target_g) : '–'} unit="g" color={PROTEIN.color} />
          <Metric
            label="Water"
            value={fuel ? kg(Math.round(fuel.water_logged_ml / 100) / 10) : '–'}
            target={fuel ? kg(Math.round(fuel.water_target_ml / 100) / 10) : '–'}
            unit="L"
            color={WATER.color}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
        <p className="text-footnote font-medium text-fg-3">Protein</p>
        <p className="text-footnote font-medium text-fg-3">Water</p>
        <div className="flex gap-1.5">
          <QuickAdd label="10 g" onClick={() => onLog(10, 0)} disabled={!fuel} />
          <QuickAdd label="25 g" onClick={() => onLog(25, 0)} disabled={!fuel} />
        </div>
        <div className="flex gap-1.5">
          <QuickAdd label="250" onClick={() => onLog(0, 250)} disabled={!fuel} />
          <QuickAdd label="500" onClick={() => onLog(0, 500)} disabled={!fuel} />
        </div>
      </div>
      {fuel && (
        <p className="mt-3 text-footnote text-fg-3">
          Targets from {kg(fuel.body_weight_kg)} kg · {fuel.calorie_target.toLocaleString()} kcal for your goal
        </p>
      )}
    </section>
  );
}
