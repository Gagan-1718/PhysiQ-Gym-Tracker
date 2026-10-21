'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { localDateISO } from '@/lib/format';
import { notifyOverdueOnce } from '@/lib/notifications';
import type { OverdueAlert } from '@/types/database';

const DISMISS_KEY = 'physiq.overdue-dismissed';

function dismissedToday(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === localDateISO();
  } catch {
    return false;
  }
}

/**
 * App-wide banner: shown whenever a split day is overdue (rule lives in
 * view_split_day_status). Dismissing hides it until tomorrow. Also fires the
 * once-a-day browser notification if the user turned reminders on.
 */
export function OverdueBanner() {
  const { data } = useSWR<{ alerts: OverdueAlert[] }>('/api/alerts', { revalidateOnFocus: true, refreshInterval: 15 * 60 * 1000 });
  const [hidden, setHidden] = useState(true); // hidden until we know it was not dismissed (no flash)
  useEffect(() => setHidden(dismissedToday()), []);

  const worst = data?.alerts[0];
  useEffect(() => {
    if (worst) void notifyOverdueOnce(worst);
  }, [worst]);

  if (!worst || hidden) return null;
  const extra = data!.alerts.length - 1;

  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-3 rounded-2xl border border-recover/30 bg-recover/10 py-2.5 pl-3.5 pr-2"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-recover" aria-hidden />
      <p className="min-w-0 flex-1 text-[15px] leading-snug text-fg">
        <span className="font-semibold">{worst.body_part}</span> is {worst.days_since} days overdue
        {extra > 0 && <span className="whitespace-nowrap text-fg-2"> · +{extra} more</span>}
      </p>
      <Link
        href={`/train?day=${worst.split_day_id}`}
        className="press flex h-9 shrink-0 items-center gap-1 rounded-full bg-recover px-3.5 text-sm font-bold text-black"
      >
        Train <ArrowRight className="h-4 w-4" />
      </Link>
      <button
        aria-label="Dismiss until tomorrow"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, localDateISO());
          } catch {
            // ignore
          }
          setHidden(true);
        }}
        className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-2 hover:bg-white/10 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
