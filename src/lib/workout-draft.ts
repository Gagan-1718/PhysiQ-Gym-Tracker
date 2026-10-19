'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { localDateISO, localDateTime } from './format';
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
}

export interface DraftExercise {
  key: string;
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  restSeconds: number;
  superset: string | null;
  target: OverloadTarget | null;
  last: LastPerformanceSet[];
  sets: DraftSet[];
}

export interface WorkoutDraft {
  version: 1;
  userId: number;
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
  };
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
        if (current) write(userId, next(current));
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
