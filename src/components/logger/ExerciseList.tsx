'use client';

import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-react';
import { ExerciseMedia } from '@/components/logger/ExerciseMedia';
import { cn, kg } from '@/lib/format';
import type { DraftExercise } from '@/lib/workout-draft';

/** "3 sets · 8 reps · 60 kg" from the exercise's first working set */
export function planLine(ex: DraftExercise) {
  const working = ex.sets.filter((s) => !s.warmup);
  const first = working[0];
  const parts = [`${working.length} set${working.length === 1 ? '' : 's'}`];
  if (first?.reps) parts.push(`${first.reps} reps`);
  if (first?.weight) parts.push(`${kg(first.weight)} kg`);
  return parts.join(' · ');
}

export const isExerciseDone = (ex: DraftExercise) => ex.sets.length > 0 && ex.sets.every((s) => s.done || s.warmup) && ex.sets.some((s) => s.done && !s.warmup);

/**
 * The workout's exercises with a still drawing each: reorder, remove, and (in a
 * workout) jump to one. Used to plan before starting and from the guided view.
 */
export function ExerciseList({
  exercises,
  current,
  onMove,
  onRemove,
  onOpen,
}: {
  exercises: DraftExercise[];
  current?: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onOpen?: (index: number) => void;
}) {
  return (
    <ol className="space-y-2">
      {exercises.map((ex, i) => {
        const done = isExerciseDone(ex);
        const body = (
          <>
            <ExerciseMedia still mediaKey={ex.mediaKey} name={ex.name} className="w-20 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-headline">{ex.name}</span>
                {done && <Check className="h-4 w-4 shrink-0 text-accent" aria-label="done" />}
              </span>
              <span className="block truncate text-footnote text-fg-3">{planLine(ex)}</span>
            </span>
          </>
        );
        return (
          <li
            key={ex.key}
            className={cn('flex items-center gap-2 rounded-card border bg-surface-1 p-2', i === current ? 'border-accent/60' : 'border-line')}
          >
            {onOpen ? (
              <button type="button" onClick={() => onOpen(i)} aria-label={`Go to ${ex.name}`} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
            )}
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Move ${ex.name} up`}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                className="press flex h-8 w-8 items-center justify-center rounded-full text-fg-2 hover:bg-surface-2 hover:text-fg disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${ex.name} down`}
                disabled={i === exercises.length - 1}
                onClick={() => onMove(i, 1)}
                className="press flex h-8 w-8 items-center justify-center rounded-full text-fg-2 hover:bg-surface-2 hover:text-fg disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              aria-label={`Remove ${ex.name}`}
              onClick={() => onRemove(i)}
              className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-surface-2 hover:text-train"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
