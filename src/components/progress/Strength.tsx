'use client';

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { Dumbbell, Target, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Pill';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { ButtonLink } from '@/components/ui/Button';
import { LineChart } from '@/components/charts/LineChart';
import { OneRepMaxCalculator } from './OneRepMaxCalculator';
import { kg, relativeDay, shortDate } from '@/lib/format';
import type { OverloadTarget, PersonalRecord } from '@/types/database';

interface TrainedExercise {
  exercise_id: number;
  name: string;
  muscle_group: string;
  sessions: number;
  last_date: string;
}

interface ExerciseProgress {
  exercise: { id: number; name: string; muscle_group: string; equipment_needed: string };
  series: { session_date: string; best_e1rm: number; top_weight: number; working_sets: number; volume: number }[];
  pr: PersonalRecord | null;
  target: OverloadTarget;
}

export function Strength() {
  const list = useSWR<TrainedExercise[]>('/api/progress/exercises');
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected === null && list.data?.length) setSelected(list.data[0].exercise_id);
  }, [list.data, selected]);
  const detail = useSWR<ExerciseProgress>(selected ? `/api/progress/exercises/${selected}` : null);

  if (!list.data) return <Skeleton className="h-96" />;
  if (list.data.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Dumbbell className="h-5 w-5" />}
          title="No lifts yet"
          body="Strength trends appear after your first workout."
          action={<ButtonLink href="/train">Start training</ButtonLink>}
        />
        <OneRepMaxCalculator />
      </>
    );
  }

  const d = detail.data;
  const first = d?.series[0]?.best_e1rm;
  const latest = d?.series[d.series.length - 1]?.best_e1rm;
  const change = first && latest ? Math.round(((latest - first) / first) * 1000) / 10 : null;

  return (
    <>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {list.data.map((e) => (
          <Chip key={e.exercise_id} active={selected === e.exercise_id} onClick={() => setSelected(e.exercise_id)}>
            {e.name}
          </Chip>
        ))}
      </div>

      {!d ? (
        <Skeleton className="h-80" />
      ) : (
        <div className={detail.isValidating ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Card>
            <p className="text-footnote text-fg-3">
              {d.exercise.muscle_group} · {d.exercise.equipment_needed}
            </p>
            <h2 className="text-title">{d.exercise.name}</h2>
            <div className="mt-4 flex items-end gap-4">
              <div>
                <p className="text-footnote text-fg-3">Estimated 1RM</p>
                <p className="font-round text-[44px] font-extrabold leading-none">
                  {latest !== undefined ? kg(latest) : '–'}
                  <span className="text-lg text-fg-3"> kg</span>
                </p>
              </div>
              {change !== null && d.series.length > 1 && (
                <p className={`mb-1 rounded-full px-2.5 py-1 text-footnote font-semibold ${change >= 0 ? 'bg-accent/15 text-accent' : 'bg-train/15 text-train'}`}>
                  {change >= 0 ? '+' : ''}
                  {change}% since {shortDate(d.series[0].session_date)}
                </p>
              )}
            </div>
            <div className="mt-4">
              <LineChart
                title={`${d.exercise.name} best estimated 1RM per session`}
                color="#B6F23B"
                unit="kg"
                data={d.series.map((s, i) => ({
                  key: `${s.session_date}-${i}`,
                  date: shortDate(s.session_date),
                  value: s.best_e1rm,
                  detail: `top ${kg(s.top_weight)} kg · ${s.working_sets} sets`,
                }))}
              />
            </div>
          </Card>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.pr && (
              <Card className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-footnote text-fg-3">Personal record · {relativeDay(d.pr.achieved_on)}</p>
                  <p className="font-round text-xl font-extrabold">
                    {kg(d.pr.weight)} kg × {d.pr.reps}
                  </p>
                </div>
              </Card>
            )}
            <Card className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Target className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-footnote text-fg-3">Next target</p>
                <p className="font-round text-xl font-extrabold">
                  {d.target.suggested_weight !== null ? `${kg(d.target.suggested_weight)} kg × ${d.target.suggested_reps}` : `${d.target.suggested_reps} reps`}
                </p>
                <p className="text-footnote text-fg-3">{d.target.rationale}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Seeded from the selected lift's record; remounts when another lift is chosen */}
      <OneRepMaxCalculator key={selected ?? 'none'} defaultWeight={d?.pr?.weight ?? null} defaultReps={d?.pr?.reps ?? null} />
    </>
  );
}
