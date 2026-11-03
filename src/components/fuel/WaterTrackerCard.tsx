'use client';

import { useState } from 'react';
import { Check, Droplets, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Rings } from '@/components/ui/Rings';
import { kg } from '@/lib/format';
import type { DailyFuel, DailyNutritionHistory, WaterLog } from '@/types/database';

const WATER_RING = { color: '#3CC8F2', deep: '#0E7FA0' };

const PRESETS = [
  { amountMl: 250, label: 'Glass', badge: '+250 ml' },
  { amountMl: 500, label: 'Bottle', badge: '+500 ml' },
  { amountMl: 750, label: 'Shaker', badge: '+750 ml' },
];

function shortDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function shortTime(ts: string): string {
  const part = ts.split(' ')[1];
  return part ? part.slice(0, 5) : ts;
}

export function WaterTrackerCard({
  fuel,
  waterLogs,
  history,
  busy,
  onAddWater,
  onDeleteWater,
}: {
  fuel: DailyFuel | undefined;
  waterLogs: WaterLog[];
  history: DailyNutritionHistory[];
  busy: boolean;
  onAddWater: (amountMl: number, containerLabel: string) => Promise<void>;
  onDeleteWater: (id: number) => Promise<void>;
}) {
  const [customMl, setCustomMl] = useState('');

  const loggedMl = fuel?.water_logged_ml ?? 0;
  const targetMl = fuel?.water_target_ml ?? 3000;
  const pct = targetMl > 0 ? Math.round((loggedMl / targetMl) * 100) : 0;
  const remainingMl = Math.max(0, targetMl - loggedMl);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customMl);
    if (!Number.isInteger(val) || val < 50 || val > 5000) return;
    setCustomMl('');
    await onAddWater(val, 'Custom');
  };

  const maxHistoryMl = Math.max(
    targetMl,
    ...history.map((h) => Math.max(h.water_logged_ml, h.water_target_ml)),
    1000
  );

  return (
    <Card aria-label="Hydration tracker">
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <div className="shrink-0">
          <Rings
            size={104}
            stroke={12}
            rings={[{ ...WATER_RING, progress: targetMl > 0 ? loggedMl / targetMl : 0, label: 'Hydration' }]}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-water/15 px-2.5 py-0.5 text-xs font-semibold text-water">
              <Droplets className="h-3.5 w-3.5" /> Hydration
            </span>
            {loggedMl >= targetMl && targetMl > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-water px-2 py-0.5 text-xs font-bold text-black">
                <Check className="h-3 w-3" strokeWidth={3} /> Hydrated
              </span>
            )}
          </div>

          <p className="mt-2 font-display text-[28px] font-extrabold leading-none text-fg sm:text-[32px]">
            {kg(Math.round(loggedMl / 100) / 10)}
            <span className="ml-1 text-[16px] font-bold text-fg-3">
              / {kg(Math.round(targetMl / 100) / 10)} L ({pct}%)
            </span>
          </p>

          <p className="mt-1 text-footnote text-fg-2">
            {remainingMl > 0
              ? `${remainingMl.toLocaleString()} ml left to reach daily goal`
              : 'Daily hydration target complete'}
          </p>
        </div>
      </div>

      {/* Quick-add preset buttons */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.amountMl}
            type="button"
            disabled={busy}
            onClick={() => onAddWater(p.amountMl, p.label)}
            className="press flex flex-col items-center justify-center rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center transition-colors hover:border-water/50 hover:bg-surface-3 disabled:opacity-40"
          >
            <span className="text-sm font-bold text-water">{p.badge}</span>
            <span className="text-[11px] font-medium text-fg-3">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Custom amount form */}
      <form onSubmit={handleCustomSubmit} className="mt-2.5 flex items-center gap-2">
        <label htmlFor="custom-water-ml" className="sr-only">
          Custom water amount in ml
        </label>
        <input
          id="custom-water-ml"
          type="number"
          inputMode="numeric"
          min={50}
          max={5000}
          step={50}
          placeholder="Custom ml (50–5000)"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-[15px] text-fg placeholder:text-fg-3 focus:border-water/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !customMl}
          className="press inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-water px-3.5 text-sm font-bold text-black disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Log
        </button>
      </form>

      {/* 7-day hydration mini bar chart */}
      {history.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between text-footnote">
            <span className="font-semibold text-fg-2">Last 7 days hydration</span>
            <span className="text-fg-3">Goal: {kg(Math.round(targetMl / 100) / 10)} L/day</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {history.map((day) => {
              const hPct = Math.min(100, Math.round((day.water_logged_ml / maxHistoryMl) * 100));
              const metGoal = day.water_logged_ml >= day.water_target_ml && day.water_target_ml > 0;
              return (
                <div key={day.fuel_date} className="flex flex-col items-center">
                  <div className="flex h-20 w-full items-end justify-center rounded-lg bg-surface-2 p-1">
                    <div
                      className="w-full rounded-md transition-all"
                      style={{
                        height: `${Math.max(8, hPct)}%`,
                        background: metGoal ? '#3CC8F2' : 'rgba(60, 200, 242, 0.45)',
                      }}
                      title={`${day.fuel_date}: ${day.water_logged_ml} / ${day.water_target_ml} ml`}
                    />
                  </div>
                  <span className="mt-1 text-[11px] font-medium text-fg-2">{shortDay(day.fuel_date)}</span>
                  <span className="tabular text-[10px] text-fg-3">
                    { (day.water_logged_ml / 1000).toFixed(1) }L
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timestamped log entries */}
      {waterLogs.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-footnote font-semibold text-fg-2">Logged entries ({waterLogs.length})</p>
          <ul className="divide-y divide-line">
            {waterLogs.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-fg">{w.amount_ml} ml</span>
                  <span className="ml-2 text-fg-2">{w.container_label}</span>
                  <span className="ml-2 text-xs text-fg-3">{shortTime(w.logged_at)}</span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeleteWater(w.id)}
                  aria-label={`Delete ${w.amount_ml} ml water entry`}
                  className="press flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-train"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
