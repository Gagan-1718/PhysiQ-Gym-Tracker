'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useSession } from 'next-auth/react';
import { ArrowDown, ArrowUp, Dumbbell, Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/Toast';
import { ExerciseCard } from '@/components/logger/ExerciseCard';
import { ExercisePicker } from '@/components/logger/ExercisePicker';
import { FinishSheet, type JournalInput } from '@/components/logger/FinishSheet';
import { RestTimer, primeAudio } from '@/components/logger/RestTimer';
import { SuccessView, type SaveResult } from '@/components/logger/SuccessView';
import { send } from '@/lib/client';
import { clock, e1rm, kg, localDateTime } from '@/lib/format';
import { bestSoFar, buildExercise, fetchContexts } from '@/lib/training';
import { useElapsed } from '@/lib/use-elapsed';
import { useWakeLock } from '@/lib/use-wake-lock';
import { draftStats, makeSet, peekDraft, useWorkoutDraft, type DraftExercise, type DraftSet, type WorkoutDraft } from '@/lib/workout-draft';
import type { Exercise, SplitDayStatus } from '@/types/database';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export default function SessionPage() {
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [draft, setDraft] = useWorkoutDraft(userId);
  const elapsed = useElapsed(draft?.startedAtMs ?? null);
  const split = useSWR<{ days: SplitDayStatus[] }>('/api/splits');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ ex: string; set: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [result, setResult] = useState<{ res: SaveResult; bodyPart: string; elapsed: number; firstTimers: Set<number> } | null>(null);

  useWakeLock(Boolean(draft) && !result);

  // Nothing in progress (e.g. opened from a bookmark): back to the start screen
  useEffect(() => {
    if (status === 'authenticated' && userId && !result && !peekDraft(userId)) router.replace('/train');
  }, [status, userId, result, router]);

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
    if (s.weight === null || !s.reps) {
      toast('Enter the weight and reps first', 'error');
      return;
    }
    const isPr = !s.warmup && ex.prE1rm !== null && e1rm(s.weight, s.reps) > bestSoFar(ex, s.key);
    update((d) => ({
      ...d,
      restEndsAt: Date.now() + ex.restSeconds * 1000,
      restTotal: ex.restSeconds,
      exercises: d.exercises.map((e) =>
        e.key === exKey ? { ...e, sets: e.sets.map((x) => (x.key === setKey ? { ...x, done: true, pr: isPr } : x)) } : e
      ),
    }));
    navigator.vibrate?.(isPr ? [30, 50, 30, 50, 80] : 15);
    if (isPr) toast(`New PR! ${ex.name} ${kg(s.weight)} kg × ${s.reps}`);
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
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 150);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add exercise', 'error');
    }
  }

  const skipRest = useCallback(() => update((d) => ({ ...d, restEndsAt: null })), [update]);
  const adjustRest = (seconds: number) =>
    update((d) => (d.restEndsAt ? { ...d, restEndsAt: Math.max(Date.now() + 1000, d.restEndsAt + seconds * 1000), restTotal: Math.max(1, d.restTotal + seconds) } : d));

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
        endedAt: localDateTime(),
        notes: d.notes.trim() || null,
        routineId: d.routineId,
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
      setResult({ res, bodyPart: d.bodyPart, elapsed, firstTimers: new Set(d.exercises.filter((e) => e.prE1rm === null).map((e) => e.exerciseId)) });
      setFinishOpen(false);
      update((x) => ({ ...x, restEndsAt: null }));
      window.scrollTo({ top: 0 });
      void mutate((key) => typeof key === 'string' && (key.startsWith('/api/workouts') || key.startsWith('/api/splits') || key.startsWith('/api/routines') || key.startsWith('/api/progress')));
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

  return (
    <div className={draft.restEndsAt ? 'pb-28' : 'pb-8'}>
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-line bg-black/85 px-4 py-2.5 pt-safe backdrop-blur-2xl sm:-mx-6 sm:px-6">
        <IconButton label="Discard workout" onClick={() => setDiscardOpen(true)}>
          <X className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-headline">{draft.bodyPart}</h1>
          <p className="tabular font-round text-[15px] font-bold text-accent">{clock(elapsed)}</p>
        </div>
        <Button size="sm" className="h-10 px-4" onClick={() => setFinishOpen(true)}>
          Finish
        </Button>
      </header>

      <div className="mt-4 space-y-3">
        {draft.exercises.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Dumbbell className="h-6 w-6" />
            </div>
            <p className="text-title">Add your first exercise</p>
            <p className="mt-1 max-w-xs text-[15px] text-fg-2">
              {focusDay ? `Showing ${focusDay.muscles.join(', ').toLowerCase()} first.` : 'Pick anything from the library.'} Targets come from your history.
            </p>
          </div>
        ) : (
          draft.exercises.map((ex) => (
            <ExerciseCard
              key={ex.key}
              exercise={ex}
              onSetChange={(setKey, patch) => patchSet(ex.key, setKey, patch)}
              onToggle={(setKey) => toggleSet(ex.key, setKey)}
              onSetMenu={(setKey) => setSetMenu({ ex: ex.key, set: setKey })}
              onAddSet={() => addSet(ex.key)}
              onMenu={() => setExMenu(ex.key)}
            />
          ))
        )}

        <Button variant="secondary" size="lg" block onClick={() => setPickerOpen(true)}>
          <Plus className="h-5 w-5" /> Add exercise
        </Button>

        <label className="block pt-2">
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
      </div>

      <RestTimer endsAt={draft.restEndsAt} total={draft.restTotal} onAdjust={adjustRest} onSkip={skipRest} />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        addedIds={draft.exercises.map((e) => e.exerciseId)}
        focusMuscles={focusDay?.muscles ?? []}
        focusLabel={`For ${draft.bodyPart}`}
      />

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
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(['up', 'down'] as const).map((dir) => (
                <Button
                  key={dir}
                  variant="secondary"
                  onClick={() =>
                    update((d) => {
                      const list = [...d.exercises];
                      const i = list.findIndex((e) => e.key === menuExercise.key);
                      const j = dir === 'up' ? i - 1 : i + 1;
                      if (j < 0 || j >= list.length) return d;
                      [list[i], list[j]] = [list[j], list[i]];
                      return { ...d, exercises: list };
                    })
                  }
                >
                  {dir === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />} Move {dir}
                </Button>
              ))}
            </div>
            <Button
              variant="danger"
              size="lg"
              block
              className="mt-3"
              onClick={() => {
                update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== menuExercise.key) }));
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

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onSave={save}
        elapsed={elapsed}
        doneSets={stats.doneSets}
        volume={stats.volume}
        untickedSets={unticked}
        defaultRoutineName={`${draft.bodyPart} routine`}
        fromRoutine={Boolean(draft.routineId)}
      />

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
