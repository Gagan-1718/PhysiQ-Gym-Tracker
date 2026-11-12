'use client';

import useSWR from 'swr';
import { fetcher } from './client';
import { e1rm } from './format';
import { createDraft, makeSet, newKey, type DraftExercise, type DraftSet, type WorkoutDraft } from './workout-draft';
import type { Exercise, ExerciseContext, ExerciseMuscle, MuscleGroup } from '@/types/database';

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

export type ExerciseInput = Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment_needed'> &
  Partial<Pick<Exercise, 'media_key' | 'instructions' | 'weight_step_kg' | 'muscles'>>;

/** mysql2 usually parses the JSON_ARRAYAGG column already; accept a string just in case. */
const parseMuscles = (m: unknown): ExerciseMuscle[] | null =>
  typeof m === 'string' ? (JSON.parse(m) as ExerciseMuscle[]) : Array.isArray(m) ? (m as ExerciseMuscle[]) : null;

/**
 * Ramping sets: every working set is `step` kg heavier than the one before.
 * With history the LAST set lands on the database's overload target (the top set);
 * the first time the FIRST set is the starting weight from fn_starting_weight.
 * Reps go down as the weight goes up (12, 10, 8 ...), ending at the target reps.
 */
export function rampSets(base: number | null, topReps: number, count: number, step: number, baseIsTop: boolean) {
  return Array.from({ length: count }, (_, i) => {
    const fromTop = count - 1 - i;
    const weight = base === null ? null : Math.max(0, baseIsTop ? base - step * fromTop : base + step * i);
    const reps = step > 0 ? Math.min(20, topReps + 2 * fromTop) : topReps;
    return { weight, reps };
  });
}

/**
 * Build an exercise with sets pre-filled from the database:
 * - working sets ramp up by the exercise's weight step to the overload target
 *   (sp_estimate_next_target), or up from a body-weight-based start the first time
 * - a warm-up is added if last session had one
 * - set count follows the routine, else last session, else 3
 */
export function buildExercise(
  exercise: ExerciseInput,
  ctx: ExerciseContext | undefined,
  opts: { targetSets?: number; restSeconds?: number; superset?: string | null; repTarget?: number } = {}
): DraftExercise {
  const lastWorking = ctx?.last.filter((s) => !s.is_warmup) ?? [];
  const lastWarmup = ctx?.last.find((s) => s.is_warmup);
  const workingCount = opts.targetSets ?? (lastWorking.length || 3);
  const step = Number(exercise.weight_step_kg ?? 0);
  const hasHistory = ctx?.target.last_weight != null;
  const target = ctx?.target.suggested_weight ?? lastWorking[0]?.weight ?? null;
  // With history the top set follows the procedure's reps; first time, finish at 8 (or the routine's goal)
  const topReps = hasHistory ? ctx!.target.suggested_reps : (opts.repTarget ?? (step > 0 ? 8 : ctx?.target.suggested_reps ?? 10));

  const sets: DraftSet[] = [];
  if (lastWarmup) sets.push(makeSet({ weight: lastWarmup.weight, reps: lastWarmup.reps, warmup: true }));
  for (const s of rampSets(target, topReps, workingCount, step, hasHistory)) sets.push(makeSet(s));

  return {
    key: newKey(),
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment_needed,
    mediaKey: exercise.media_key ?? null,
    instructions: exercise.instructions ?? null,
    weightStep: step,
    muscles: parseMuscles(exercise.muscles),
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
  exercises?: { exercise: ExerciseInput; targetSets?: number; restSeconds?: number; superset?: string | null; repTarget?: number }[];
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
