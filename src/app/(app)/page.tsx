'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { SectionHeader } from '@/components/ui/Card';
import { ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { UpNextCard } from '@/components/today/UpNextCard';
import { RecoveryStrip } from '@/components/today/RecoveryStrip';
import { greeting, longDate } from '@/lib/format';
import type { Recommendation, SplitDayStatus } from '@/types/database';

interface SplitResponse {
  splitName: string | null;
  days: SplitDayStatus[];
  recommendation: Recommendation;
}

export default function TodayPage() {
  const { data: session } = useSession();
  const split = useSWR<SplitResponse>('/api/splits');
  const firstName = session?.user?.name?.split(' ')[0];
  const initial = session?.user?.name?.[0]?.toUpperCase() ?? '·';

  return (
    <>
      <header className="flex items-end justify-between pb-5 pt-4">
        <div>
          <p className="text-eyebrow uppercase text-fg-3" suppressHydrationWarning>
            {longDate()}
          </p>
          <h1 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.025em] sm:text-large-title" suppressHydrationWarning>
            {firstName ? `${greeting()}, ${firstName}` : 'Today'}</h1>
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

      {!split.data ? (
        <Skeleton className="h-64 rounded-[1.75rem]" />
      ) : (
        <UpNextCard rec={split.data.recommendation} days={split.data.days} />
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
    </>
  );
}
