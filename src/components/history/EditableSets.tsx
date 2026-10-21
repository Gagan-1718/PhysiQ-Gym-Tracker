'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { Stepper } from '@/components/ui/Stepper';
import { cn } from '@/lib/format';
import type { SessionSet } from '@/types/database';

export interface SetDraft {
  weight: number | null;
  reps: number | null;
  warmup: boolean;
  deleted: boolean;
}

interface EditableSetsProps {
  sets: SessionSet[];
  drafts: Record<number, SetDraft>;
  onChange: (setId: number, patch: Partial<SetDraft>) => void;
}

/** Edit mode for one exercise of a saved workout: weight, reps, warm-up toggle, delete / undo. */
export function EditableSets({ sets, drafts, onChange }: EditableSetsProps) {
  let working = 0;
  return (
    <ul className="mt-3 space-y-1.5">
      {sets.map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        const label = d.warmup ? 'W' : String(++working);
        return (
          <li key={s.id} className={cn('flex items-center gap-1.5 transition-opacity', d.deleted && 'opacity-40')}>
            <button
              type="button"
              onClick={() => onChange(s.id, { warmup: !d.warmup })}
              disabled={d.deleted}
              aria-pressed={d.warmup}
              aria-label={d.warmup ? `Set ${label}: warm-up. Tap to count it as a working set` : `Set ${label}: working set. Tap to mark as warm-up`}
              className={cn('press h-11 w-9 shrink-0 rounded-xl font-round text-[15px] font-extrabold hover:bg-surface-3', d.warmup ? 'text-recover' : 'text-fg-2')}
            >
              {label}
            </button>
            <Stepper
              size="sm"
              label={`set ${label} weight`}
              value={d.weight}
              onChange={(weight) => onChange(s.id, { weight })}
              step={2.5}
              max={999.5}
              decimals
              className="min-w-0 flex-[1.2] bg-surface-3/70"
            />
            <Stepper
              size="sm"
              label={`set ${label} reps`}
              value={d.reps}
              onChange={(reps) => onChange(s.id, { reps })}
              min={1}
              max={100}
              step={1}
              className="min-w-0 flex-1 bg-surface-3/70"
            />
            <button
              type="button"
              onClick={() => onChange(s.id, { deleted: !d.deleted })}
              aria-label={d.deleted ? `Restore set ${label}` : `Delete set ${label}`}
              className={cn('press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', d.deleted ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-fg-3 hover:text-train')}
            >
              {d.deleted ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
