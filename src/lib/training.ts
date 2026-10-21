'use client';

import useSWR from 'swr';
import { fetcher } from './client';
import { e1rm } from './format';
import { createDraft, makeSet, newKey, type DraftExercise, type DraftSet, type WorkoutDraft } from './workout-draft';
import type { Exercise, ExerciseContext, MuscleGroup } from '@/types/database';

/** Exercise library, cached for the session (it rarely changes). */
export function useLibrary() {
  return useSWR<{ exercises: Exercise[]; muscleGroups: MuscleGroup[] }>('/api/exercises', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10 * 60 * 1000,
  });
}

export async function fetchContexts(ids: number[]): Promise<Record<number, ExerciseContext>> {
  if (ids.length === 0) return {};
  return fetcher<Record<number, ExerciseContext>>(`/api/train/context?ids=${ids.join(',')}`);
}

const defaultRest = (equipment: string) => (equipment === 'Barbell' ? 150 : 90);

/**
 * Build an exercise card with sets pre-filled from the database:
 * - working sets use the overload target (sp_estimate_next_target)
 * - a warm-up is added if last session had one
 * - set count follows the routine, else last session, else 3
 */
export function buildExercise(
  exercise: Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment_needed'>,
  ctx: ExerciseContext | undefined,
  opts: { targetSets?: number; restSeconds?: number; superset?: string | null; repTarget?: number } = {}
): DraftExercise {
  const lastWorking = ctx?.last.filter((s) => !s.is_warmup) ?? [];
  const lastWarmup = ctx?.last.find((s) => s.is_warmup);
  const workingCount = opts.targetSets ?? (lastWorking.length || 3);
  const weight = ctx?.target.suggested_weight ?? lastWorking[0]?.weight ?? null;
  // With history, follow the procedure's target; first time, use the routine's rep goal
  const hasHistory = ctx?.target.last_weight != null;
  const reps = hasHistory ? ctx!.target.suggested_reps : (opts.repTarget ?? ctx?.target.suggested_reps ?? 10);

  const sets: DraftSet[] = [];
  if (lastWarmup) sets.push(makeSet({ weight: lastWarmup.weight, reps: lastWarmup.reps, warmup: true }));
  for (let i = 0; i < workingCount; i++) sets.push(makeSet({ weight, reps }));

  return {
    key: newKey(),
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment_needed,
    restSeconds: opts.restSeconds ?? defaultRest(exercise.equipment_needed),
    superset: opts.superset ?? null,
    target: ctx?.target ?? null,
    last: ctx?.last ?? [],
    lastDate: ctx?.target.last_date ?? null,
    prE1rm: ctx?.pr?.estimated_1rm ?? null,
    sets,
  };
}

/** Best estimated 1RM so far: stored PR or any set already ticked in this workout. */
export function bestSoFar(ex: DraftExercise, exceptKey?: string): number {
  let best = ex.prE1rm ?? 0;
  for (const s of ex.sets) {
    if (s.key === exceptKey || !s.done || s.warmup || s.weight === null || s.reps === null) continue;
    best = Math.max(best, e1rm(s.weight, s.reps));
  }
  return best;
}

export interface StartOptions {
  userId: number;
  splitDayId: number | null;
  bodyPart: string;
  routineId?: string | null;
  exercises?: { exercise: Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment_needed'>; targetSets?: number; restSeconds?: number; superset?: string | null; repTarget?: number }[];
}

/** Create a fresh draft, pre-filling any routine exercises with their database context. */
export async function buildDraft(opts: StartOptions): Promise<WorkoutDraft> {
  const draft = createDraft(opts.userId, { splitDayId: opts.splitDayId, bodyPart: opts.bodyPart, routineId: opts.routineId });
  const items = opts.exercises ?? [];
  if (items.length) {
    const ctx = await fetchContexts(items.map((i) => i.exercise.id));
    draft.exercises = items.map((i) => buildExercise(i.exercise, ctx[i.exercise.id], i));
  }
  return draft;
}
