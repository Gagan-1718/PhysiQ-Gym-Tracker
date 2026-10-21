'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Calculator } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Stepper } from '@/components/ui/Stepper';
import { cn, kg } from '@/lib/format';
import type { RepMaxRow } from '@/types/database';

interface Result {
  oneRm: number;
  table: RepMaxRow[];
}

/**
 * 1RM calculator. The estimate and the whole rep-max table come from the database
 * (CALL sp_rep_max_table: fn_calculate_1rm plus a recursive CTE), not from JavaScript.
 */
export function OneRepMaxCalculator({ defaultWeight = 60, defaultReps = 8 }: { defaultWeight?: number | null; defaultReps?: number | null }) {
  const [weight, setWeight] = useState<number | null>(defaultWeight ?? 60);
  const [reps, setReps] = useState<number | null>(defaultReps ?? 8);

  // Debounce: query once the numbers stop changing
  const [query, setQuery] = useState<{ weight: number; reps: number } | null>(null);
  useEffect(() => {
    if (!weight || weight <= 0 || !reps || reps < 1) return setQuery(null);
    const id = setTimeout(() => setQuery({ weight, reps }), 250);
    return () => clearTimeout(id);
  }, [weight, reps]);

  const { data, error } = useSWR<Result>(query ? `/api/calc/one-rep-max?weight=${query.weight}&reps=${query.reps}` : null);

  return (
    <>
      <SectionHeader title="1RM calculator" />
      <Card>
        <p className="text-footnote text-fg-3">Enter any set to see your estimated one-rep max and what you could lift for other rep counts.</p>
        {/* Stacked on the very smallest phones, where two steppers side by side leave the number only ~16px wide */}
        <div className="mt-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
          <div>
            <p className="mb-1.5 px-1 text-footnote font-medium text-fg-2">Weight</p>
            <Stepper size="md" label="calculator weight" value={weight} onChange={setWeight} step={2.5} min={0.5} max={999} unit="kg" decimals />
          </div>
          <div>
            <p className="mb-1.5 px-1 text-footnote font-medium text-fg-2">Reps</p>
            <Stepper size="md" label="calculator reps" value={reps} onChange={setReps} step={1} min={1} max={30} />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <p className="text-footnote text-fg-3">Estimated 1RM</p>
            <p className="font-round text-[34px] font-extrabold leading-none" aria-live="polite">
              {data ? kg(data.oneRm) : '–'}
              <span className="text-base text-fg-3"> kg</span>
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-[15px] text-train">{error.message}</p>}

        {data && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Estimated weight for each rep count">
            {data.table.map((row) => (
              <li
                key={row.reps}
                className={cn('rounded-xl p-2.5 text-center', row.reps === query?.reps ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-surface-2')}
              >
                <p className={cn('text-footnote', row.reps === query?.reps ? 'text-fg-2' : 'text-fg-3')}>{row.reps} {row.reps === 1 ? 'rep' : 'reps'}</p>
                <p className="font-round text-lg font-extrabold">{kg(row.weight_kg)}</p>
                <p className={cn('text-[11px] font-semibold', row.reps === query?.reps ? 'text-fg-2' : 'text-fg-3')}>{row.pct_of_one_rm}%</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-footnote text-fg-3">Epley formula: weight × (1 + reps ÷ 30). Most accurate up to about 10 reps.</p>
      </Card>
    </>
  );
}
