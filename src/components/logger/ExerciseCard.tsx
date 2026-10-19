'use client';

import { AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, Target, Trophy } from 'lucide-react';
import { kg, shortDate } from '@/lib/format';
import type { DraftExercise, DraftSet } from '@/lib/workout-draft';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  exercise: DraftExercise;
  onSetChange: (setKey: string, patch: Partial<DraftSet>) => void;
  onToggle: (setKey: string) => void;
  onSetMenu: (setKey: string) => void;
  onAddSet: () => void;
  onMenu: () => void;
}

export function ExerciseCard({ exercise: ex, onSetChange, onToggle, onSetMenu, onAddSet, onMenu }: ExerciseCardProps) {
  const t = ex.target;
  const lastWorking = ex.last.filter((s) => !s.is_warmup);
  let working = 0;
  const done = ex.sets.filter((s) => s.done).length;

  return (
    <section className="rounded-card border border-line bg-surface-1 p-3.5 sm:p-5" aria-label={ex.name}>
      <header className="flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-headline leading-tight">{ex.name}</h2>
          <p className="text-footnote text-fg-3">
            {ex.muscleGroup} · {ex.equipment}
            {ex.superset && ` · Superset ${ex.superset}`}
            {done > 0 && <span className="text-accent"> · {done}/{ex.sets.length} done</span>}
          </p>
        </div>
        <button onClick={onMenu} aria-label={`${ex.name} options`} className="press -mr-1 -mt-1 rounded-full p-2 text-fg-3 hover:bg-surface-2 hover:text-fg">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {(t?.suggested_weight !== null && t?.suggested_weight !== undefined) || ex.prE1rm ? (
        <div className="mt-3 flex flex-wrap gap-2 px-0.5">
          {t && t.suggested_weight !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.12] px-2.5 py-1 text-xs font-semibold text-accent" title={t.rationale}>
              <Target className="h-3.5 w-3.5" /> Target {kg(t.suggested_weight)} kg × {t.suggested_reps}
            </span>
          )}
          {ex.prE1rm !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
              <Trophy className="h-3.5 w-3.5" /> Best e1RM {kg(ex.prE1rm)} kg
            </span>
          )}
        </div>
      ) : null}
      {t && <p className="mt-2 px-0.5 text-footnote text-fg-3">{t.rationale}</p>}
      {lastWorking.length > 0 && ex.lastDate && (
        <p className="mt-0.5 px-0.5 text-footnote text-fg-3">
          Last ({shortDate(ex.lastDate)}): {lastWorking.map((s) => `${kg(s.weight)}×${s.reps}`).join(' · ')}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 px-1 text-eyebrow uppercase text-fg-3 sm:gap-2" aria-hidden>
        <span className="w-9 text-center">Set</span>
        <span className="flex-[1.2] text-center">kg</span>
        <span className="flex-1 text-center">Reps</span>
        <span className="w-11 text-center">Done</span>
      </div>
      <div className="mt-1 space-y-1">
        <AnimatePresence initial={false}>
          {ex.sets.map((s) => {
            const label = s.warmup ? 'W' : String(++working);
            return (
              <SetRow
                key={s.key}
                set={s}
                label={label}
                bodyweight={ex.equipment === 'Bodyweight'}
                onChange={(patch) => onSetChange(s.key, patch)}
                onToggle={() => onToggle(s.key)}
                onOpenMenu={() => onSetMenu(s.key)}
              />
            );
          })}
        </AnimatePresence>
      </div>
      <button onClick={onAddSet} className="press mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold text-fg-2 hover:bg-surface-2 hover:text-fg">
        <Plus className="h-4 w-4" /> Add set
      </button>
    </section>
  );
}
