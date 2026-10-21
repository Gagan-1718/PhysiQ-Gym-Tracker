'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { History } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Feedback';
import { Segmented } from '@/components/ui/Segmented';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { MuscleBars } from '@/components/charts/MuscleBars';
import { RecentPRs } from '@/components/today/RecentPRs';
import { lastWeeks } from '@/components/today/WeekCard';
import type { PersonalRecord, WeeklySummary } from '@/types/database';

interface ProgressResponse {
  weeklyGoal: number;
  thisWeekStart: string;
  weeks: WeeklySummary[];
  muscles: { muscle_group: string; this_week: number; last_week: number }[];
  prs: PersonalRecord[];
  streakWeeks: number;
}

export function Overview() {
  const { data } = useSWR<ProgressResponse>('/api/progress');
  const [picked, setWeek] = useState<'this' | 'last' | null>(null);
  if (!data) return <Skeleton className="h-96" />;
  // Early in the week there is nothing to show yet, so open on last week
  const week = picked ?? (data.muscles.some((m) => m.this_week > 0) ? 'this' : 'last');

  const weeks = lastWeeks(data.weeks, data.thisWeekStart);
  const total = data.weeks.reduce((n, w) => n + w.sessions_completed, 0);
  const rows = data.muscles.map((m) => ({
    name: m.muscle_group,
    sets: week === 'this' ? m.this_week : m.last_week,
    previous: week === 'this' ? m.last_week : m.this_week,
  }));

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Sessions', String(total), '8 wk'],
          ['Streak', String(data.streakWeeks), 'weeks'],
          ['Goal', String(data.weeklyGoal), '/ week'],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-2xl bg-surface-1 p-3.5">
            <p className="text-footnote text-fg-3">{label}</p>
            <p className="font-round text-2xl font-extrabold">
              {value} <span className="text-sm font-bold text-fg-3">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      <SectionHeader title="Weekly volume" />
      <Card>
        <p className="mb-2 text-footnote text-fg-3">Total kg lifted in working sets each week</p>
        <ColumnChart data={weeks} color="#FA2D55" unit="kg" title="Training volume per week, last 8 weeks" />
      </Card>

      <SectionHeader
        title="Sets per muscle"
        action={
          <Segmented
            label="Week"
            value={week}
            onChange={setWeek}
            className="w-44"
            options={[
              { value: 'this', label: 'This wk' },
              { value: 'last', label: 'Last wk' },
            ]}
          />
        }
      />
      <Card>
        <MuscleBars rows={rows} color="#B6F23B" />
      </Card>

      {data.prs.length > 0 && (
        <>
          <SectionHeader title="Personal records" />
          <RecentPRs prs={data.prs} />
        </>
      )}

      <ButtonLink href="/history" variant="secondary" size="lg" block className="mt-6">
        <History className="h-5 w-5" /> Workout history
      </ButtonLink>
    </>
  );
}
