'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { ChevronRight, History, ListChecks, Play, Plus, Trash2 } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { StatusPill } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { fetcher, send } from '@/lib/client';
import { cn, relativeDay } from '@/lib/format';
import { buildDraft, useLibrary } from '@/lib/training';
import { useWorkoutDraft } from '@/lib/workout-draft';
import { SPLIT_TEMPLATES } from '@/lib/split-templates';
import { SemanticExerciseFinder } from '@/components/train/SemanticExerciseFinder';
import type { Exercise, Recommendation, Routine, SplitDayStatus } from '@/types/database';

interface SplitResponse {
  splitName: string | null;
  days: SplitDayStatus[];
  recommendation: Recommendation;
}

function TrainHome() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [draft, setDraft] = useWorkoutDraft(userId);
  const split = useSWR<SplitResponse>('/api/splits');
  const routines = useSWR<Routine[]>('/api/routines');
  const library = useLibrary();
  const [starting, setStarting] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<(() => Promise<void>) | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const autoStarted = useRef(false);

  const startFreestyle = () =>
    start('freestyle', async () =>
      buildDraft({
        userId: userId!,
        splitDayId: null,
        bodyPart: 'Freestyle Workout',
        exercises: [],
      })
    );

  async function applySplit(tId: string) {
    const t = SPLIT_TEMPLATES.find((x) => x.id === tId);
    if (!t) return;
    setSwitching(true);
    try {
      await send('/api/splits', 'POST', { name: t.name, minRestDays: t.minRestDays, days: t.days });
      toast(`Switched split to ${t.name}. Muscles trained within the last 72h are recovering.`);
      await split.mutate();
      setSplitOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change split', 'error');
    } finally {
      setSwitching(false);
    }
  }

  async function start(key: string, build: () => Promise<Parameters<typeof setDraft>[0]>) {
    if (!userId) return;
    const run = async () => {
      setStarting(key);
      try {
        setDraft(await build());
        router.push('/train/session');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not start the workout', 'error');
        setStarting(null);
      }
    };
    // Starting over an unfinished workout needs confirmation
    if (draft) setPendingStart(() => run);
    else await run();
  }

  // Pre-load the exercises from the last session on this day; targets fill in the sets
  const startDay = (day: Pick<SplitDayStatus, 'split_day_id' | 'body_part'>) =>
    start(`day-${day.split_day_id}`, async () => {
      const plan = await fetcher<{ exercises: (Exercise & { working_sets: number })[] }>(`/api/train/plan?day=${day.split_day_id}`);
      return buildDraft({
        userId: userId!,
        splitDayId: day.split_day_id,
        bodyPart: day.body_part,
        exercises: plan.exercises.map((exercise) => ({ exercise, targetSets: exercise.working_sets || undefined })),
      });
    });

  const startRoutine = (r: Routine) =>
    start(`routine-${r.id}`, async () => {
      const byId = new Map(library.data?.exercises.map((e) => [e.id, e]));
      const match = split.data?.days.find((d) => d.body_part.toLowerCase() === (r.focus ?? r.name).toLowerCase());
      return buildDraft({
        userId: userId!,
        splitDayId: match?.split_day_id ?? null,
        bodyPart: match?.body_part ?? r.focus ?? r.name,
        routineId: r.id,
        exercises: r.exercises
          .filter((x) => byId.has(x.exercise_id))
          .map((x) => ({
            exercise: byId.get(x.exercise_id)!,
            targetSets: x.target_sets,
            restSeconds: x.rest_seconds,
            superset: x.superset,
            repTarget: x.rep_min,
          })),
      });
    });

  // Deep link from Today: /train?day=<split_day_id> starts that day right away
  useEffect(() => {
    const dayId = Number(params.get('day'));
    if (autoStarted.current || !dayId || !split.data || !userId) return;
    autoStarted.current = true;
    const day = split.data.days.find((d) => d.split_day_id === dayId);
    if (day && !draft) startDay(day);
    else if (draft) router.replace('/train');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, split.data, userId]);

  async function deleteRoutine(r: Routine) {
    try {
      await send(`/api/routines/${r.id}`, 'DELETE');
      routines.mutate((list) => list?.filter((x) => x.id !== r.id), { revalidate: false });
      toast('Routine deleted');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
    }
  }

  const recId = split.data?.recommendation.split_day_id;

  return (
    <>
      <header className="flex items-end justify-between pb-5 pt-4">
        <h1 className="text-large-title">Train</h1>
        <Link href="/history" className="press flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[15px] font-medium text-fg-2 hover:text-fg">
          <History className="h-4 w-4" /> History
        </Link>
      </header>

      {draft && (
        <Card className="mb-2 flex items-center gap-4 border-accent/30 bg-accent/[0.07]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-solid text-white">
            <Play className="h-5 w-5 fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-headline">{draft.bodyPart} in progress</p>
            <p className="text-[15px] text-fg-2">
              {draft.exercises.length} exercise{draft.exercises.length === 1 ? '' : 's'} · started {draft.startedAt.slice(11, 16)}
            </p>
          </div>
          <Button onClick={() => router.push('/train/session')}>Resume</Button>
        </Card>
      )}

      <SectionHeader
        title="Your split"
        action={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {split.data?.splitName && <span className="hidden sm:inline text-footnote text-fg-3">{split.data.splitName}</span>}
            <Button variant="secondary" size="sm" onClick={() => setSplitOpen(true)} className="h-8 px-2.5 text-xs">
              Change split
            </Button>
          </div>
        }
      />
      {!split.data ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {[...split.data.days]
              .sort((a, b) => a.priority_rank - b.priority_rank)
              .map((day) => {
                const key = `day-${day.split_day_id}`;
                return (
                  <button
                    key={day.split_day_id}
                    onClick={() => startDay(day)}
                    disabled={starting !== null}
                    className="press flex w-full items-center gap-3 px-4 py-4 text-left transition-colors first:rounded-t-card last:rounded-b-card hover:bg-surface-2 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-headline">{day.body_part}</span>
                        {day.split_day_id === recId && <span className="rounded-full bg-accent-solid px-2 py-0.5 text-[11px] font-bold text-white">UP NEXT</span>}
                      </div>
                      <p className="truncate text-footnote text-fg-3">
                        {day.muscles.join(' · ')} {day.last_trained_date && `· ${relativeDay(day.last_trained_date)}`}
                      </p>
                    </div>
                    <StatusPill status={day.status} />
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', starting === key ? 'bg-accent-solid text-white' : 'bg-surface-3 text-fg-2')}>
                      {starting === key ? <span className="h-3 w-3 animate-ping rounded-full bg-black" /> : <Play className="h-4 w-4 fill-current" />}
                    </span>
                  </button>
                );
              })}
          </Card>

          <Button
            variant="secondary"
            block
            className="mt-3 border border-line bg-surface-1 hover:bg-surface-2 whitespace-normal h-auto py-3 px-3 text-sm text-center"
            onClick={startFreestyle}
            disabled={starting !== null}
          >
            <Plus className="h-4 w-4 shrink-0" /> Start Freestyle Workout
          </Button>
        </>
      )}

      <SectionHeader title="Routines" />
      {!routines.data ? (
        <Skeleton className="h-28" />
      ) : routines.data.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="No routines yet"
          body="Finish a workout and save it as a routine to reuse the same exercises."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routines.data.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-headline">{r.name}</p>
                  <p className="text-footnote text-fg-3">
                    {r.exercises.length} exercises{r.times_used ? ` · used ${r.times_used}×` : ''}
                  </p>
                </div>
                <button aria-label={`Delete ${r.name}`} onClick={() => deleteRoutine(r)} className="press -mr-1 rounded-full p-2 text-fg-3 hover:bg-surface-2 hover:text-train">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 line-clamp-2 text-[15px] text-fg-2">{r.exercises.map((e) => e.name).join(' · ')}</p>
              <Button variant="secondary" className="mt-4" loading={starting === `routine-${r.id}`} disabled={!library.data || starting !== null} onClick={() => startRoutine(r)}>
                <Play className="h-4 w-4 fill-current" /> Start
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="lg"
        block
        className="mt-6 border border-dashed border-line"
        disabled={starting !== null}
        onClick={() => start('empty', () => buildDraft({ userId: userId!, splitDayId: null, bodyPart: 'Freestyle' }))}
      >
        <Plus className="h-5 w-5" /> Empty workout
      </Button>

      <SectionHeader title="Exercise & alternative finder" />
      <SemanticExerciseFinder
        exercises={library.data?.exercises ?? []}
        onStartExercise={(exercise) =>
          start(`vec-${exercise.id}`, async () =>
            buildDraft({
              userId: userId!,
              splitDayId: null,
              bodyPart: exercise.muscle_group,
              exercises: [{ exercise, targetSets: 3 }],
            })
          )
        }
      />

      <Sheet open={splitOpen} onClose={() => setSplitOpen(false)} title="Change training split">
        <p className="mb-4 text-[15px] text-fg-2">
          Pick a new split template. Muscles trained within the last 72 hours are automatically placed on recovery cooldown.
        </p>
        <div className="space-y-3">
          {SPLIT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={switching}
              onClick={() => applySplit(t.id)}
              className="press block w-full rounded-2xl border border-line bg-surface-1 p-4 text-left transition-colors hover:border-accent hover:bg-surface-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-headline">{t.name}</span>
                <span className="text-footnote text-fg-3">{t.days.length} days</span>
              </div>
              <p className="mt-0.5 text-xs text-fg-2">{t.blurb}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {t.days.map((d) => (
                  <span key={d.label} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-fg-2">
                    {d.label}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={pendingStart !== null} onClose={() => setPendingStart(null)} title="Workout in progress">
        <p className="text-[15px] text-fg-2">
          You have an unfinished {draft?.bodyPart} workout. Starting a new one discards it.
        </p>
        <div className="mt-6 grid gap-3">
          <Button size="lg" onClick={() => { setPendingStart(null); router.push('/train/session'); }}>
            Resume {draft?.bodyPart}
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={async () => {
              const run = pendingStart;
              setPendingStart(null);
              setDraft(null);
              await run?.();
            }}
          >
            Discard and start new <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export default function TrainPage() {
  return (
    <Suspense>
      <TrainHome />
    </Suspense>
  );
}
