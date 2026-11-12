'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useSession } from 'next-auth/react';
import { ArrowRight, Check, ChevronLeft, Dumbbell, ListChecks, Play, Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';
import { ExerciseCard } from '@/components/logger/ExerciseCard';
import { ExerciseList, isExerciseDone } from '@/components/logger/ExerciseList';
import { ExerciseMedia } from '@/components/logger/ExerciseMedia';
import { ExercisePicker } from '@/components/logger/ExercisePicker';
import { FinishSheet, type JournalInput } from '@/components/logger/FinishSheet';
import { RestTimer, primeAudio } from '@/components/logger/RestTimer';
import { SuccessView, type SaveResult } from '@/components/logger/SuccessView';
import { WeighInSheet } from '@/components/logger/WeighInSheet';
import { WeightPicker } from '@/components/logger/WeightPicker';
import { send } from '@/lib/client';
import { hasExerciseVideo } from '@/lib/exercise-videos';
import { clock, cn, e1rm, kg, localDateTime, shortDate } from '@/lib/format';
import { bestSoFar, buildExercise, fetchContexts } from '@/lib/training';
import { useNow } from '@/lib/use-elapsed';
import { muscleName, musclesFor } from '@/lib/muscles';
import { useWakeLock } from '@/lib/use-wake-lock';
import {
  draftStats,
  makeSet,
  peekDraft,
  startGuided,
  useWorkoutDraft,
  workoutClock,
  workoutEndMs,
  type DraftExercise,
  type DraftSet,
  type WorkoutDraft,
} from '@/lib/workout-draft';
import type { BodyMeasurement, Exercise, SplitDayStatus, User } from '@/types/database';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export default function SessionPage() {
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [draft, setDraft] = useWorkoutDraft(userId);
  const now = useNow(Boolean(draft));
  const time = draft ? workoutClock(draft, now) : { seconds: 0, paused: false, stale: false, started: false };
  const split = useSWR<{ days: SplitDayStatus[] }>('/api/splits');
  // The last known body weight starts the weigh-ins
  const body = useSWR<BodyMeasurement[]>('/api/body');
  const me = useSWR<User>('/api/me');
  const knownWeight = [...(body.data ?? [])].reverse().find((m) => m.weight !== null)?.weight ?? me.data?.starting_weight ?? null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ ex: string; set: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [weighIn, setWeighIn] = useState<'before' | 'after' | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [result, setResult] = useState<{ res: SaveResult; bodyPart: string; elapsed: number; firstTimers: Set<number> } | null>(null);

  const guided = draft?.phase !== 'plan';
  useWakeLock(Boolean(draft) && guided && !result);

  // Nothing in progress (e.g. opened from a bookmark): back to the start screen
  useEffect(() => {
    if (status === 'authenticated' && userId && !result && !peekDraft(userId)) router.replace('/train');
  }, [status, userId, result, router]);

  // A freestyle workout starts empty: open the exercise picker once, straight away
  const pickerPrompted = useRef(false);
  useEffect(() => {
    if (!draft || pickerPrompted.current) return;
    pickerPrompted.current = true;
    if (draft.exercises.length === 0) setPickerOpen(true);
  }, [draft]);

  const update = useCallback((fn: (d: WorkoutDraft) => WorkoutDraft) => setDraft(fn), [setDraft]);
  const patchExercise = useCallback(
    (exKey: string, fn: (e: DraftExercise) => DraftExercise) =>
      update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === exKey ? fn(e) : e)) })),
    [update]
  );

  /** Edit a set; a new weight/reps also flows down to later unticked sets that still had the old value. */
  const patchSet = (exKey: string, setKey: string, patch: Partial<DraftSet>) =>
    patchExercise(exKey, (e) => {
      const idx = e.sets.findIndex((s) => s.key === setKey);
      const old = e.sets[idx];
      return {
        ...e,
        sets: e.sets.map((s, i) => {
          if (i === idx) return { ...s, ...patch };
          if (i < idx || s.done || s.warmup || old.warmup) return s;
          const next = { ...s };
          if ('weight' in patch && s.weight === old.weight) next.weight = patch.weight ?? null;
          if ('reps' in patch && s.reps === old.reps) next.reps = patch.reps ?? null;
          return next;
        }),
      };
    });

  function toggleSet(exKey: string, setKey: string) {
    primeAudio();
    const ex = draft?.exercises.find((e) => e.key === exKey);
    const s = ex?.sets.find((x) => x.key === setKey);
    if (!ex || !s) return;
    if (s.done) {
      patchExercise(exKey, (e) => ({ ...e, sets: e.sets.map((x) => (x.key === setKey ? { ...x, done: false, pr: false } : x)) }));
      return;
    }
    if (s.weight === null) {
      toast('Choose the weight first', 'error');
      return;
    }
    // Reps are not asked during the workout: the set counts its planned reps
    const reps = s.reps ?? ex.target?.suggested_reps ?? 10;
    const isPr = !s.warmup && ex.prE1rm !== null && e1rm(s.weight, reps) > bestSoFar(ex, s.key);
    // Ramping sets: the next working set starts this one's weight plus the exercise's step (5 or 10 kg)
    const step = ex.weightStep ?? 0;
    const doneAt = ex.sets.findIndex((x) => x.key === setKey);
    const nextKey = s.warmup || step <= 0 ? null : ex.sets.find((x, i) => i > doneAt && !x.done && !x.warmup)?.key;
    const nextWeight = Math.min(999.5, s.weight + step);
    update((d) => ({
      ...d,
      active: null,
      restEndsAt: Date.now() + ex.restSeconds * 1000,
      restTotal: ex.restSeconds,
      exercises: d.exercises.map((e) =>
        e.key === exKey
          ? {
              ...e,
              sets: e.sets.map((x) =>
                x.key === setKey ? { ...x, reps, done: true, pr: isPr } : x.key === nextKey ? { ...x, weight: nextWeight } : x
              ),
            }
          : e
      ),
    }));
    navigator.vibrate?.(isPr ? [30, 50, 30, 50, 80] : 15);
    if (isPr) toast(`New PR! ${ex.name} ${kg(s.weight)} kg`);
  }

  function addSet(exKey: string) {
    patchExercise(exKey, (e) => {
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, makeSet({ weight: last?.weight ?? null, reps: last?.reps ?? null })] };
    });
  }

  async function addExercise(exercise: Exercise) {
    try {
      const ctx = await fetchContexts([exercise.id]);
      update((d) => ({ ...d, exercises: [...d.exercises, buildExercise(exercise, ctx[exercise.id])] }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add exercise', 'error');
    }
  }

  const moveExercise = (index: number, dir: -1 | 1) =>
    update((d) => {
      const list = [...d.exercises];
      const j = index + dir;
      if (j < 0 || j >= list.length) return d;
      [list[index], list[j]] = [list[j], list[index]];
      // Keep the exercise on screen the same one after a reorder
      const current = d.current === index ? j : d.current === j ? index : d.current;
      return { ...d, exercises: list, current };
    });

  const removeExercise = (index: number) =>
    update((d) => {
      const exercises = d.exercises.filter((_, i) => i !== index);
      const cur = d.current ?? 0;
      const current = Math.max(0, Math.min(index < cur ? cur - 1 : cur, exercises.length - 1));
      return { ...d, exercises, current };
    });

  const goTo = (index: number) => {
    update((d) => ({ ...d, current: index, active: null }));
    setListOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const skipRest = useCallback(() => update((d) => ({ ...d, restEndsAt: null })), [update]);
  const adjustRest = (seconds: number) =>
    update((d) => (d.restEndsAt ? { ...d, restEndsAt: Math.max(Date.now() + 1000, d.restEndsAt + seconds * 1000), restTotal: Math.max(1, d.restTotal + seconds) } : d));

  /** Finishing asks the weight after the workout first (once), then shows the summary */
  function openFinish() {
    if (draft?.weightAfter === undefined) setWeighIn('after');
    else setFinishOpen(true);
  }

  function weighed(kgValue: number | null) {
    const when = weighIn;
    setWeighIn(null);
    if (when === 'before') update((d) => startGuided({ ...d, weightBefore: kgValue }));
    if (when === 'after') {
      update((d) => ({ ...d, weightAfter: kgValue }));
      setFinishOpen(true);
    }
  }

  async function save(journal: JournalInput, routineName: string | null) {
    if (!draft) return;
    const d = draft;
    const exercises = d.exercises
      .map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets
          .filter((s) => s.done && s.weight !== null && s.reps)
          .map((s) => ({ weight: s.weight!, reps: s.reps!, warmup: s.warmup, rpe: s.rpe })),
      }))
      .filter((e) => e.sets.length > 0);
    try {
      const res = await send<SaveResult>('/api/workouts', 'POST', {
        clientRef: d.clientRef,
        sessionDate: d.sessionDate,
        splitDayId: d.splitDayId,
        bodyPart: d.bodyPart,
        startedAt: d.startedAt,
        // A workout left open ends at its last activity, not hours later
        endedAt: localDateTime(new Date(workoutEndMs(d, Date.now()))),
        notes: d.notes.trim() || null,
        routineId: d.routineId,
        weightBefore: d.weightBefore ?? null,
        weightAfter: d.weightAfter ?? null,
        exercises,
        journal,
      });
      if (routineName) {
        try {
          await send('/api/routines', 'POST', {
            name: routineName,
            focus: d.bodyPart,
            exercises: d.exercises
              .filter((e) => e.sets.some((s) => s.done))
              .map((e) => ({
                exerciseId: e.exerciseId,
                targetSets: Math.max(1, e.sets.filter((s) => s.done && !s.warmup).length),
                restSeconds: e.restSeconds,
                superset: e.superset,
              })),
          });
        } catch (err) {
          res.warnings.push(`Routine not saved: ${err instanceof Error ? err.message : 'error'}`);
        }
      }
      setResult({ res, bodyPart: d.bodyPart, elapsed: time.seconds, firstTimers: new Set(d.exercises.filter((e) => e.prE1rm === null).map((e) => e.exerciseId)) });
      setFinishOpen(false);
      update((x) => ({ ...x, restEndsAt: null }));
      window.scrollTo({ top: 0 });
      void mutate((key) => typeof key === 'string' && (key.startsWith('/api/workouts') || key.startsWith('/api/splits') || key.startsWith('/api/routines') || key.startsWith('/api/progress') || key.startsWith('/api/body')));
    } catch (err) {
      // The draft stays on the device, so nothing is lost; the same clientRef makes a retry safe
      toast(err instanceof Error ? err.message : 'Could not save. Check your connection and try again.', 'error');
    }
  }

  const stats = useMemo(() => (draft ? draftStats(draft) : { doneSets: 0, volume: 0, exercises: 0 }), [draft]);
  const unticked = draft?.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.weight !== null && s.reps).length, 0) ?? 0;
  const focusDay = split.data?.days.find((d) => d.split_day_id === draft?.splitDayId);
  const menuExercise = draft?.exercises.find((e) => e.key === exMenu);
  const menuSetExercise = draft?.exercises.find((e) => e.key === setMenu?.ex);
  const menuSet = menuSetExercise?.sets.find((s) => s.key === setMenu?.set);

  if (result) {
    return (
      <SuccessView
        result={result.res}
        bodyPart={result.bodyPart}
        elapsed={result.elapsed}
        firstTimers={result.firstTimers}
        onDone={() => {
          setDraft(null);
          router.push('/');
        }}
      />
    );
  }
  if (!draft) return null;

  const count = draft.exercises.length;
  const index = Math.max(0, Math.min(draft.current ?? 0, count - 1));
  const current = draft.exercises[index];
  const isLast = index === count - 1;

  const emptyState = (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Dumbbell className="h-6 w-6" />
      </div>
      <p className="text-title">Add your first exercise</p>
      <p className="mt-1 max-w-xs text-[15px] text-fg-2">
        {focusDay ? `Showing ${focusDay.muscles.join(', ').toLowerCase()} first.` : 'Pick anything from the library.'} Targets come from your history.
      </p>
    </div>
  );

  const stage = guided && count > 0;

  // Guided mode shows one set at a time: the first set of this exercise not done yet
  const setIndex = current ? current.sets.findIndex((s) => !s.done) : -1;
  const set = setIndex >= 0 ? current.sets[setIndex] : null;
  const workingTotal = current ? current.sets.filter((s) => !s.warmup).length : 0;
  const setLabel = set ? (set.warmup ? 'W' : String(current.sets.slice(0, setIndex + 1).filter((s) => !s.warmup).length)) : '';
  const setName = set?.warmup ? 'Warm-up' : `Set ${setLabel} of ${workingTotal}`;
  // The set being done right now; otherwise its weight is being chosen
  const performing = Boolean(set) && draft.active === set?.key;
  const muscles = current ? musclesFor(current.muscles, current.muscleGroup) : [];
  const hasVideo = hasExerciseVideo(current?.mediaKey);
  const lastWorking = current?.last.filter((s) => !s.is_warmup) ?? [];
  const unit = current?.equipment === 'Dumbbell' ? 'kg each hand' : 'kg';
  const doneWorking = current ? current.sets.filter((s) => s.done && !s.warmup) : [];
  const hint = !set
    ? ''
    : set.warmup
      ? 'Warm-up: light, easy reps'
      : lastWorking.length
        ? `Last time ${lastWorking.map((s) => kg(s.weight)).join(' · ')} kg`
        : (current.target?.rationale ?? 'First time: pick a weight you can control');
  // Each set's weight is its own: changing it never carries over to the sets after it
  const setWeight = (v: number) => set && patchExercise(current.key, (e) => ({ ...e, sets: e.sets.map((x) => (x.key === set.key ? { ...x, weight: v } : x)) }));
  const startSet = (key: string) => {
    primeAudio();
    update((d) => ({ ...d, active: key, restEndsAt: null }));
  };

  const header = (
    <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b border-line bg-black/85 px-4 py-2.5 pt-safe backdrop-blur-2xl sm:-mx-6 sm:px-6">
      <IconButton label="Discard workout" onClick={() => setDiscardOpen(true)}>
        <X className="h-5 w-5" />
      </IconButton>
      <div className="min-w-0 flex-1 text-center">
        <h1 className="truncate text-headline">{draft.bodyPart}</h1>
        <p className="text-footnote text-fg-3">{guided ? 'Add an exercise to start' : 'Choose your exercises'}</p>
      </div>
      <span className="w-10" aria-hidden />
    </header>
  );

  const clockLine = (
    <p className={cn('tabular font-display text-[15px] font-bold', time.paused ? 'text-fg-3' : 'text-accent')}>
      {clock(time.seconds)}
      {time.paused && <span className="ml-1.5 font-sans text-footnote font-medium">paused</span>}
    </p>
  );

  return (
    <div className={stage ? '' : 'pb-8'}>
      {!stage && header}

      {!guided ? (
        /* ---------- Plan: choose, order and remove exercises, then start ---------- */
        <div className="mt-4 space-y-3">
          {count === 0 ? emptyState : <ExerciseList exercises={draft.exercises} onMove={moveExercise} onRemove={removeExercise} />}
          <Button variant="secondary" size="lg" block onClick={() => setPickerOpen(true)}>
            <Plus className="h-5 w-5" /> Add exercise
          </Button>
          <Button size="lg" block disabled={count === 0} onClick={() => setWeighIn('before')}>
            <Play className="h-5 w-5 fill-current" /> Start workout
          </Button>
        </div>
      ) : count === 0 ? (
        <div className="mt-4 space-y-3">
          {emptyState}
          <Button variant="secondary" size="lg" block onClick={() => setPickerOpen(true)}>
            <Plus className="h-5 w-5" /> Add exercise
          </Button>
        </div>
      ) : (
        /* ---------- Guided, one set at a time: first choose its weight, then do it with the exercise full screen ---------- */
        <div className="fixed inset-0 z-30 flex flex-col bg-black md:left-64">
          {set && performing ? (
            <section aria-label={`${current.name}, ${setName}`} className="relative min-h-0 flex-1 overflow-hidden">
              <div className={cn('absolute inset-x-0', hasVideo ? 'inset-y-0' : 'bottom-28 top-[calc(env(safe-area-inset-top)+8.5rem)]')}>
                <ExerciseMedia key={current.key} fill mediaKey={current.mediaKey} name={current.name} muscle={current.muscleGroup} />
              </div>

              {/* The name on top */}
              <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-3 pb-14 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
                <IconButton label="Change the weight" onClick={() => update((d) => ({ ...d, active: null }))}>
                  <ChevronLeft className="h-5 w-5" />
                </IconButton>
                <div className="min-w-0 flex-1 text-center [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]">
                  <h1 className="text-large-title leading-tight">{current.name}</h1>
                  <p className="mt-1 text-headline">
                    <span className="text-accent">{setName}</span>
                    <span className="text-fg-2">
                      {' · '}
                      {kg(set.weight ?? 0)} {unit}
                    </span>
                  </p>
                  <div className="mt-0.5 flex justify-center">{clockLine}</div>
                </div>
                <span className="w-10 shrink-0" aria-hidden />
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[calc(var(--safe-bottom)+0.75rem)] pt-14">
                <Button size="lg" block className="h-16 text-[19px]" onClick={() => toggleSet(current.key, set.key)}>
                  <Check className="h-6 w-6 shrink-0" /> Done
                </Button>
              </div>
            </section>
          ) : (
            <>
              <div className="shrink-0 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
                <div className="flex items-center gap-2">
                  <IconButton label="Discard workout" onClick={() => setDiscardOpen(true)}>
                    <X className="h-5 w-5" />
                  </IconButton>
                  <div className="min-w-0 flex-1 text-center">
                    <h1 className="truncate text-headline">{draft.bodyPart}</h1>
                    {clockLine}
                  </div>
                  <IconButton label="All exercises" onClick={() => setListOpen(true)}>
                    <ListChecks className="h-5 w-5" />
                  </IconButton>
                  <Button size="sm" className="h-10 px-4" onClick={openFinish}>
                    Finish
                  </Button>
                </div>

                <div className="mt-4 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-footnote font-semibold text-fg-2">
                      Exercise {index + 1} of {count}
                    </p>
                    <div className="-mr-0.5 flex flex-wrap justify-end">
                      {draft.exercises.map((e, i) => (
                        // A 24 px tap target around each small dot
                        <button
                          key={e.key}
                          type="button"
                          onClick={() => goTo(i)}
                          aria-label={`Exercise ${i + 1}: ${e.name}`}
                          aria-current={i === index ? 'step' : undefined}
                          className="press flex h-6 min-w-6 items-center justify-center px-0.5"
                        >
                          <span className={cn('h-2.5 rounded-full transition-all', i === index ? 'w-6 bg-accent' : isExerciseDone(e) ? 'w-2.5 bg-accent/60' : 'w-2.5 bg-surface-4')} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <h2 className="mt-1 text-large-title leading-tight">{current.name}</h2>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Muscles">
                    {muscles.map((m) => (
                      <li
                        key={m.code}
                        className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', m.role === 'primary' ? 'bg-accent-solid text-white' : 'bg-white/10 text-fg-2')}
                      >
                        {muscleName(m)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {set ? (
                <>
                  <div className="mx-4 mt-5 flex items-center gap-2">
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold', set.warmup ? 'bg-recover/15 text-recover' : 'bg-accent/15 text-accent')}>
                      {set.warmup ? 'WARM-UP' : `SET ${setLabel} / ${workingTotal}`}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-footnote text-fg-3">{hint}</p>
                    <button type="button" onClick={() => setSetsOpen(true)} className="press shrink-0 rounded-full px-2 py-1 text-footnote font-semibold text-accent">
                      All sets
                    </button>
                  </div>
                  <WeightPicker className="mx-4 my-4 min-h-0 flex-1" value={set.weight} onChange={setWeight} label={`set ${setLabel} weight`} unit={unit} />
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-solid text-white">
                    <Check className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-title">{current.name} done</p>
                  <p className="mt-1 text-footnote text-fg-3">
                    {doneWorking.length} set{doneWorking.length === 1 ? '' : 's'} · top {kg(Math.max(0, ...doneWorking.map((s) => s.weight ?? 0)))} kg
                  </p>
                  <Button variant="secondary" size="sm" className="mt-5" onClick={() => addSet(current.key)}>
                    <Plus className="h-4 w-4" /> Add a set
                  </Button>
                </div>
              )}

              {/* Rest between sets runs here, while the next weight is chosen */}
              <div className="shrink-0 px-4 pb-[calc(var(--safe-bottom)+0.75rem)]">
                <RestTimer inline endsAt={draft.restEndsAt} total={draft.restTotal} onAdjust={adjustRest} onSkip={skipRest} />
                {set ? (
                  <Button size="lg" block className="h-16 text-[19px]" disabled={set.weight === null} onClick={() => startSet(set.key)}>
                    <Play className="h-5 w-5 shrink-0 fill-current" /> Start {set.warmup ? 'warm-up' : `set ${setLabel}`}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="lg" className="h-16 w-16 shrink-0 px-0" aria-label="Previous exercise" disabled={index === 0} onClick={() => goTo(index - 1)}>
                      <ChevronLeft className="h-6 w-6 shrink-0" />
                    </Button>
                    {isLast ? (
                      <Button size="lg" className="h-16 flex-1 text-[19px]" onClick={openFinish}>
                        <Check className="h-5 w-5 shrink-0" /> Finish workout
                      </Button>
                    ) : (
                      <Button size="lg" className="h-16 min-w-0 flex-1" onClick={() => goTo(index + 1)}>
                        <span className="flex min-w-0 flex-col items-start leading-tight">
                          <span>Next exercise</span>
                          <span className="max-w-full truncate text-xs font-medium text-white">{draft.exercises[index + 1].name}</span>
                        </span>
                        <ArrowRight className="ml-auto h-5 w-5 shrink-0" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Every set of the exercise on screen: edit, untick, warm-up flag, add or delete */}
      <Sheet open={setsOpen && stage} onClose={() => setSetsOpen(false)} title="All sets">
        {current && (
          <ExerciseCard
            exercise={current}
            onSetChange={(setKey, patch) => patchSet(current.key, setKey, patch)}
            onToggle={(setKey) => toggleSet(current.key, setKey)}
            onSetMenu={(setKey) => setSetMenu({ ex: current.key, set: setKey })}
            onAddSet={() => addSet(current.key)}
            onMenu={() => {
              setSetsOpen(false);
              setExMenu(current.key);
            }}
          />
        )}
        {!isLast && (
          <Button
            variant="secondary"
            size="lg"
            block
            className="mt-3"
            onClick={() => {
              setSetsOpen(false);
              goTo(index + 1);
            }}
          >
            Skip to next exercise <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </Sheet>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        addedIds={draft.exercises.map((e) => e.exerciseId)}
        focusMuscles={focusDay?.muscles ?? []}
        focusLabel={`For ${draft.bodyPart}`}
      />

      {/* All exercises during a workout: jump, reorder, remove, add */}
      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="Exercises">
        <ExerciseList exercises={draft.exercises} current={index} onMove={moveExercise} onRemove={removeExercise} onOpen={goTo} />
        <Button
          variant="secondary"
          size="lg"
          block
          className="mt-3"
          onClick={() => {
            setListOpen(false);
            setPickerOpen(true);
          }}
        >
          <Plus className="h-5 w-5" /> Add exercise
        </Button>
        <label className="mt-4 block">
          <span className="mb-1.5 block px-1 text-footnote font-medium text-fg-2">Session notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
            maxLength={500}
            rows={2}
            placeholder="Gym, equipment, anything to remember"
            className="w-full resize-none rounded-2xl border border-line bg-surface-1 px-4 py-3 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
          />
        </label>
      </Sheet>

      {/* Exercise options */}
      <Sheet open={Boolean(menuExercise)} onClose={() => setExMenu(null)} title={menuExercise?.name}>
        {menuExercise && (
          <>
            <p className="mb-2 text-headline">Rest between sets</p>
            <Segmented
              label="Rest time"
              value={String(menuExercise.restSeconds)}
              onChange={(v) => patchExercise(menuExercise.key, (e) => ({ ...e, restSeconds: Number(v) }))}
              options={[60, 90, 120, 150, 180].map((s) => ({ value: String(s), label: s < 120 ? `${s}s` : `${s / 60}m` }))}
            />
            <Button
              variant="danger"
              size="lg"
              block
              className="mt-5"
              onClick={() => {
                removeExercise(draft.exercises.findIndex((e) => e.key === menuExercise.key));
                setExMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove exercise
            </Button>
          </>
        )}
      </Sheet>

      {/* Set options */}
      <Sheet open={Boolean(menuSet)} onClose={() => setSetMenu(null)} title="Set options">
        {menuSet && menuSetExercise && (
          <>
            <label className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
              <span>
                <span className="block text-headline">Warm-up set</span>
                <span className="text-footnote text-fg-3">Not counted in volume or PRs</span>
              </span>
              <input
                type="checkbox"
                checked={menuSet.warmup}
                onChange={(e) => patchSet(menuSetExercise.key, menuSet.key, { warmup: e.target.checked, pr: false })}
                className="h-6 w-6 accent-[#FFB020]"
              />
            </label>
            <p className="mb-2 mt-5 text-headline">Effort (RPE)</p>
            <div className="flex flex-wrap gap-2">
              {RPE_OPTIONS.map((r) => (
                <Chip key={r} active={menuSet.rpe === r} onClick={() => patchSet(menuSetExercise.key, menuSet.key, { rpe: menuSet.rpe === r ? null : r })}>
                  {r}
                </Chip>
              ))}
            </div>
            <Button
              variant="danger"
              size="lg"
              block
              className="mt-6"
              onClick={() => {
                patchExercise(menuSetExercise.key, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== menuSet.key) }));
                setSetMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete set
            </Button>
          </>
        )}
      </Sheet>

      <WeighInSheet
        when={weighIn}
        initial={weighIn === 'after' ? (draft.weightBefore ?? knownWeight) : knownWeight}
        onDone={weighed}
        onClose={() => setWeighIn(null)}
      />

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onSave={save}
        elapsed={time.seconds}
        doneSets={stats.doneSets}
        volume={stats.volume}
        untickedSets={unticked}
        defaultRoutineName={`${draft.bodyPart} routine`}
        fromRoutine={Boolean(draft.routineId)}
        weighIn={{
          before: draft.weightBefore ?? null,
          after: draft.weightAfter ?? null,
          onChange: () => {
            setFinishOpen(false);
            setWeighIn('after');
          },
        }}
      />

      {/* A workout left open for hours: finish it or throw it away instead of counting on */}
      <Sheet open={time.stale && !staleDismissed && !finishOpen && !discardOpen} onClose={() => setStaleDismissed(true)} title="Unfinished workout">
        <p className="text-[15px] text-fg-2">
          This {draft.bodyPart} workout from {shortDate(draft.sessionDate)} has had no activity for a while. The clock stopped at {clock(time.seconds)}.
        </p>
        <div className="mt-6 grid gap-3">
          {stats.doneSets > 0 && (
            <Button
              size="lg"
              onClick={() => {
                setStaleDismissed(true);
                openFinish();
              }}
            >
              Finish and save
            </Button>
          )}
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              setDraft(null);
              router.replace('/train');
            }}
          >
            Discard
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setStaleDismissed(true)}>
            Keep going
          </Button>
        </div>
      </Sheet>

      <Sheet open={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard workout?">
        <p className="text-[15px] text-fg-2">Nothing from this session will be saved.</p>
        <div className="mt-6 grid gap-3">
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              setDraft(null);
              router.replace('/train');
            }}
          >
            Discard
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setDiscardOpen(false)}>
            Keep training
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
