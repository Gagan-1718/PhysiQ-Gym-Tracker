'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { localDateISO, localDateTime, uuid } from './format';
import type { LastPerformanceSet, OverloadTarget } from '@/types/database';

/**
 * The in-progress workout lives on the device (localStorage) until "Finish",
 * so a refresh, a dead tab or no signal in the gym never loses sets. Finishing
 * sends everything to MySQL in one ACID transaction.
 * Drafts are stored per user id, so a shared device never mixes accounts.
 */

export interface DraftSet {
  key: string;
  weight: number | null;
  reps: number | null;
  warmup: boolean;
  done: boolean;
  rpe: number | null;
  /** Set beat the previous best estimated 1RM when it was ticked */
  pr?: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  /** Demonstration frames in public/exercises/<mediaKey>/ (optional: older drafts lack it) */
  mediaKey?: string | null;
  instructions?: string | null;
  /** kg added to the next working set after one is done (exercises.weight_step_kg) */
  weightStep?: number;
  /** Body-map regions the exercise works (exercise_muscles) */
  muscles?: { code: string; label?: string; role: 'primary' | 'secondary' }[] | null;
  restSeconds: number;
  superset: string | null;
  target: OverloadTarget | null;
  last: LastPerformanceSet[];
  lastDate: string | null;
  prE1rm: number | null;
  sets: DraftSet[];
}

export interface WorkoutDraft {
  version: 1;
  userId: number;
  /** Idempotency key sent with the save (workout_sessions.client_ref) */
  clientRef: string;
  startedAt: string; // local 'YYYY-MM-DD HH:MM:SS'
  startedAtMs: number;
  sessionDate: string; // local 'YYYY-MM-DD'
  splitDayId: number | null;
  bodyPart: string;
  routineId: string | null;
  notes: string;
  exercises: DraftExercise[];
  restEndsAt: number | null; // epoch ms
  restTotal: number; // seconds of the running rest timer
  /** 'plan' = choosing and ordering exercises (clock not started); 'guided' = training one exercise at a time.
   *  Missing on drafts saved by older versions, which were already in progress: treated as 'guided'. */
  phase?: 'plan' | 'guided';
  /** Index of the exercise on screen in guided mode */
  current?: number;
  /** Key of the set being performed right now (full-screen demonstration + Done).
   *  Anything else means the next set's weight is being chosen. */
  active?: string | null;
  /** Body weight before / after the workout (kg). undefined = not asked yet, null = skipped */
  weightBefore?: number | null;
  weightAfter?: number | null;
  /** Last time anything changed (epoch ms); the clock stops after a long pause */
  lastActivityMs?: number;
}

/** The workout clock stops after this long without any activity (the member most likely left). */
export const IDLE_PAUSE_MS = 30 * 60 * 1000;
/** An unfinished workout this old (since its last activity) is offered to finish or discard. */
export const STALE_MS = 4 * 60 * 60 * 1000;

/**
 * Training time shown on the clock. It does not run while planning, and it stops
 * IDLE_PAUSE_MS after the last activity, so a forgotten workout never counts for hours.
 */
export function workoutClock(d: WorkoutDraft, now: number): { seconds: number; paused: boolean; stale: boolean; started: boolean } {
  const last = d.lastActivityMs ?? d.startedAtMs;
  const stale = now - last > STALE_MS;
  if (d.phase === 'plan') return { seconds: 0, paused: false, stale, started: false };
  const paused = now - last > IDLE_PAUSE_MS;
  const end = paused ? last : now;
  return { seconds: Math.max(0, Math.floor((end - d.startedAtMs) / 1000)), paused, stale, started: true };
}

/** When the workout really ended: now, or the last activity if the clock had stopped. */
export function workoutEndMs(d: WorkoutDraft, now: number): number {
  const last = d.lastActivityMs ?? d.startedAtMs;
  return now - last > IDLE_PAUSE_MS ? last : now;
}

/** Leave planning: the clock starts now and the first exercise is shown. */
export function startGuided(d: WorkoutDraft): WorkoutDraft {
  const now = new Date();
  return { ...d, phase: 'guided', current: 0, startedAt: localDateTime(now), startedAtMs: now.getTime(), sessionDate: localDateISO(now) };
}

const keyFor = (userId: number) => `physiq.workout-draft.v1.${userId}`;
const listeners = new Set<() => void>();
const cache = new Map<number, { raw: string | null; value: WorkoutDraft | null }>();

function read(userId: number): WorkoutDraft | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(userId));
  } catch {
    return cache.get(userId)?.value ?? null; // storage blocked: fall back to memory
  }
  const hit = cache.get(userId);
  if (hit && hit.raw === raw) return hit.value; // stable reference for useSyncExternalStore
  let value: WorkoutDraft | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as WorkoutDraft) : null;
    value = parsed?.version === 1 && parsed.userId === userId ? parsed : null;
  } catch {
    value = null;
  }
  cache.set(userId, { raw, value });
  return value;
}

function write(userId: number, draft: WorkoutDraft | null) {
  const raw = draft ? JSON.stringify(draft) : null;
  cache.set(userId, { raw, value: draft });
  try {
    if (raw) window.localStorage.setItem(keyFor(userId), raw);
    else window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Storage full or blocked: the in-memory cache still holds the draft for this tab
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key?.startsWith('physiq.workout-draft') && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

let counter = 0;
export const newKey = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function makeSet(from?: Partial<DraftSet>): DraftSet {
  return { weight: null, reps: null, warmup: false, done: false, rpe: null, ...from, key: newKey() };
}

export function createDraft(userId: number, init: { splitDayId: number | null; bodyPart: string; routineId?: string | null }): WorkoutDraft {
  const now = new Date();
  return {
    version: 1,
    userId,
    clientRef: uuid(),
    startedAt: localDateTime(now),
    startedAtMs: now.getTime(),
    sessionDate: localDateISO(now),
    splitDayId: init.splitDayId,
    bodyPart: init.bodyPart,
    routineId: init.routineId ?? null,
    notes: '',
    exercises: [],
    restEndsAt: null,
    restTotal: 0,
    phase: 'plan',
    current: 0,
    lastActivityMs: now.getTime(),
  };
}

/** Non-reactive read, e.g. to decide on a redirect right after hydration. */
export function peekDraft(userId: number): WorkoutDraft | null {
  return read(userId);
}

/** Reactive access to the current user's draft plus an updater. */
export function useWorkoutDraft(userId: number | undefined) {
  const draft = useSyncExternalStore(
    subscribe,
    () => (userId ? read(userId) : null),
    () => null
  );
  const update = useCallback(
    (next: WorkoutDraft | null | ((d: WorkoutDraft) => WorkoutDraft)) => {
      if (!userId) return;
      const current = read(userId);
      if (typeof next === 'function') {
        // Every change counts as activity, which keeps the workout clock running
        if (current) write(userId, { ...next(current), lastActivityMs: Date.now() });
      } else {
        write(userId, next);
      }
    },
    [userId]
  );
  return [draft, update] as const;
}

/** Totals for the summary: only completed working sets count, like the database volume trigger. */
export function draftStats(draft: WorkoutDraft) {
  let doneSets = 0;
  let volume = 0;
  for (const ex of draft.exercises) {
    for (const s of ex.sets) {
      if (!s.done || s.warmup || s.weight === null || s.reps === null) continue;
      doneSets += 1;
      volume += s.weight * s.reps;
    }
  }
  return { doneSets, volume, exercises: draft.exercises.length };
}
