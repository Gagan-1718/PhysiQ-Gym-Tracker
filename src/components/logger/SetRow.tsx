'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Stepper } from '@/components/ui/Stepper';
import { SET_ACTION, SET_BADGE, SET_REPS, SET_ROW, SET_WEIGHT } from '@/components/ui/set-row-layout';
import { cn } from '@/lib/format';
import type { DraftSet } from '@/lib/workout-draft';

interface SetRowProps {
  set: DraftSet;
  label: string;
  bodyweight: boolean;
  onChange: (patch: Partial<DraftSet>) => void;
  onToggle: () => void;
  onOpenMenu: () => void;
}

/** One set: [badge] [kg −/+] [reps −/+] [✓]. Ticking starts the rest timer. */
export function SetRow({ set, label, bodyweight, onChange, onToggle, onOpenMenu }: SetRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(SET_ROW, 'rounded-2xl p-1 transition-colors', set.done && 'bg-accent/[0.09]')}
    >
      <button
        onClick={onOpenMenu}
        aria-label={`Set ${label} options`}
        className={cn(
          SET_BADGE,
          'press relative flex h-11 w-9 items-center justify-center rounded-xl font-round text-[15px] font-extrabold',
          set.warmup ? 'text-recover' : 'text-fg-2',
          'hover:bg-surface-3'
        )}
      >
        {label}
        {set.pr && <span className="absolute -right-1 -top-1 rounded-full bg-gold px-1 text-[9px] font-black leading-[14px] text-black">PR</span>}
      </button>
      <Stepper
        size="sm"
        label={`set ${label} weight`}
        value={set.weight}
        onChange={(weight) => onChange({ weight })}
        step={bodyweight ? 1 : 2.5}
        max={999.5}
        decimals
        className={cn(SET_WEIGHT, 'bg-surface-3/70')}
      />
      <Stepper
        size="sm"
        label={`set ${label} reps`}
        value={set.reps}
        onChange={(reps) => onChange({ reps })}
        step={1}
        min={1}
        max={100}
        className={cn(SET_REPS, 'bg-surface-3/70')}
      />
      <button
        onClick={onToggle}
        aria-label={set.done ? `Undo set ${label}` : `Complete set ${label}`}
        aria-pressed={set.done}
        className={cn(
          SET_ACTION,
          'press flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
          set.done ? 'bg-accent text-black' : 'bg-surface-3 text-fg-3 hover:text-fg'
        )}
      >
        <Check className="h-5 w-5" strokeWidth={3} />
      </button>
    </motion.div>
  );
}
