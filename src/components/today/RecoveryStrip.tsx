'use client';

import Link from 'next/link';
import { MiniRing } from '@/components/ui/Rings';
import { STATUS_META } from '@/components/ui/Pill';
import { cn } from '@/lib/format';
import type { SplitDayStatus } from '@/types/database';

function caption(day: SplitDayStatus) {
  if (day.days_since === null) return 'Not trained yet';
  if (day.status === 'recovering') return `Ready in ${day.days_until_ready}d`;
  if (day.days_since === 0) return 'Trained today';
  return `${day.days_since}d ago`;
}

/** One tile per split day: recovery ring fills up as min_rest_days elapse. */
export function RecoveryStrip({ days }: { days: SplitDayStatus[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {days.map((day) => {
        const meta = STATUS_META[day.status];
        const progress = day.days_since === null ? 1 : day.min_rest_days === 0 ? 1 : Math.min(1, day.days_since / day.min_rest_days);
        return (
          <Link
            key={day.split_day_id}
            href={`/train?day=${day.split_day_id}`}
            className="press min-w-[9.5rem] snap-start rounded-card border border-line bg-surface-1 p-4 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-start justify-between">
              <MiniRing progress={progress} color={meta.color} />
              <span className={cn('text-xs font-semibold', meta.text)}>{meta.label}</span>
            </div>
            <p className="mt-3 truncate text-headline">{day.body_part}</p>
            <p className="text-footnote text-fg-3">{caption(day)}</p>
          </Link>
        );
      })}
    </div>
  );
}
