'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { StatusPill, STATUS_META } from '@/components/ui/Pill';
import type { Recommendation, SplitDayStatus } from '@/types/database';

function reason(rec: Recommendation, day?: SplitDayStatus) {
  if (rec.status === 'new') return day ? `You haven’t trained ${rec.body_part} on this split yet.` : 'Set up a split to get recommendations.';
  const ago = rec.days_since === 1 ? 'yesterday' : `${rec.days_since} days ago`;
  if (rec.status === 'overdue') return `Last trained ${ago}. That's the longest gap in your split.`;
  if (rec.status === 'ready') return `Last trained ${ago}. Fully recovered and next in line.`;
  return `Everything is still recovering. ${rec.body_part} is the closest to ready.`;
}

/** The adaptive recommendation from sp_get_next_body_part, as the page hero. */
export function UpNextCard({ rec, days }: { rec: Recommendation; days: SplitDayStatus[] }) {
  const day = days.find((d) => d.split_day_id === rec.split_day_id);
  const meta = STATUS_META[rec.status];
  const href = rec.split_day_id ? `/train?day=${rec.split_day_id}` : '/train';

  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface-1 p-5 sm:p-6"
      aria-labelledby="up-next-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-30 blur-[80px]"
        style={{ background: meta.color }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-eyebrow uppercase text-fg-2">
            <Sparkles className="h-3.5 w-3.5" /> Up next
          </p>
          <StatusPill status={rec.status} />
        </div>
        <h2 id="up-next-title" className="mt-3 text-[2.75rem] font-bold leading-none tracking-[-0.03em]">
          {rec.body_part}
        </h2>
        {day && day.muscles.length > 0 && <p className="mt-2 text-[15px] font-medium text-fg-2">{day.muscles.join(' · ')}</p>}
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">{reason(rec, day)}</p>
        <ButtonLink href={href} size="lg" block className="mt-5 sm:w-auto sm:min-w-56">
          Start {rec.body_part} <ArrowRight className="h-5 w-5" />
        </ButtonLink>
      </div>
    </section>
  );
}
