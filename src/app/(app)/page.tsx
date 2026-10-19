'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { Flame } from 'lucide-react';
import { SectionHeader } from '@/components/ui/Card';
import { ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { UpNextCard } from '@/components/today/UpNextCard';
import { RecoveryStrip } from '@/components/today/RecoveryStrip';
import { ActivityCard } from '@/components/today/ActivityCard';
import { WeekCard } from '@/components/today/WeekCard';
import { RecentPRs } from '@/components/today/RecentPRs';
import { send } from '@/lib/client';
import { greeting, localDateISO, longDate } from '@/lib/format';
import type { DailyFuel, PersonalRecord, Recommendation, SplitDayStatus, WeeklySummary } from '@/types/database';

interface SplitResponse {
  splitName: string | null;
  days: SplitDayStatus[];
  recommendation: Recommendation;
}

interface ProgressResponse {
  weeklyGoal: number;
  thisWeekStart: string;
  weeks: WeeklySummary[];
  thisWeek: WeeklySummary | null;
  prs: PersonalRecord[];
  streakWeeks: number;
}

export default function TodayPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const today = useMemo(() => localDateISO(), []);
  const split = useSWR<SplitResponse>('/api/splits');
  const progress = useSWR<ProgressResponse>('/api/progress');
  const fuel = useSWR<DailyFuel>(`/api/fuel?date=${today}`);
  const firstName = session?.user?.name?.split(' ')[0];
  const initial = session?.user?.name?.[0]?.toUpperCase() ?? '·';

  // Optimistic: the ring moves instantly; the database's clamped result replaces it
  async function logFuel(proteinDelta: number, waterDelta: number) {
    const current = fuel.data;
    if (!current) return;
    navigator.vibrate?.(10);
    try {
      await fuel.mutate(send<DailyFuel>('/api/fuel', 'POST', { date: today, proteinDelta, waterDelta }), {
        optimisticData: {
          ...current,
          protein_logged_g: current.protein_logged_g + proteinDelta,
          water_logged_ml: current.water_logged_ml + waterDelta,
        },
        rollbackOnError: true,
        revalidate: false,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not log', 'error');
    }
  }

  return (
    <>
      <header className="flex items-end justify-between pb-5 pt-4">
        <div>
          <p className="text-eyebrow uppercase text-fg-3" suppressHydrationWarning>
            {longDate()}
          </p>
          <h1 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.025em] sm:text-large-title" suppressHydrationWarning>
            {firstName ? `${greeting()}, ${firstName}` : 'Today'}
          </h1>
          {Boolean(progress.data?.streakWeeks) && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-train/15 px-3 py-1 text-footnote font-semibold text-train">
              <Flame className="h-3.5 w-3.5" /> {progress.data!.streakWeeks}-week streak
            </p>
          )}
        </div>
        <Link
          href="/profile"
          aria-label="Profile"
          className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface-2 text-[15px] font-bold text-fg md:hidden"
        >
          {initial}
        </Link>
      </header>

      {split.error && <ErrorNote message={split.error.message} onRetry={() => split.mutate()} />}

      {!split.data ? <Skeleton className="h-64 rounded-[1.75rem]" /> : <UpNextCard rec={split.data.recommendation} days={split.data.days} />}

      <SectionHeader title="Activity" />
      {!progress.data ? (
        <Skeleton className="h-60 rounded-[1.75rem]" />
      ) : (
        <ActivityCard sessions={progress.data.thisWeek?.sessions_completed ?? 0} goal={progress.data.weeklyGoal} fuel={fuel.data} onLog={logFuel} />
      )}

      <SectionHeader title="Recovery" action={split.data?.splitName && <span className="text-footnote text-fg-3">{split.data.splitName}</span>} />
      {!split.data ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <RecoveryStrip days={split.data.days} />
      )}

      <SectionHeader title="This week" href="/progress" />
      {!progress.data ? (
        <Skeleton className="h-56" />
      ) : (
        <WeekCard weeks={progress.data.weeks} thisWeekStart={progress.data.thisWeekStart} thisWeek={progress.data.thisWeek} />
      )}

      {progress.data && progress.data.prs.length > 0 && (
        <>
          <SectionHeader title="Recent records" href="/progress" />
          <RecentPRs prs={progress.data.prs.slice(0, 3)} />
        </>
      )}
    </>
  );
}
