'use client';

import Link from 'next/link';
import useSWRInfinite from 'swr/infinite';
import { ChevronLeft, ChevronRight, Dumbbell, Trophy } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { compact, minutesBetween, parseLocalDate, relativeDay } from '@/lib/format';
import type { SessionSummary } from '@/types/database';

interface Page {
  sessions: SessionSummary[];
  nextCursor: string | null;
}

function weekLabel(iso: string) {
  const d = parseLocalDate(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const thisMonday = new Date();
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
  const weeks = Math.round((thisMonday.getTime() - monday.getTime()) / (7 * 86_400_000));
  if (weeks === 0) return 'This week';
  if (weeks === 1) return 'Last week';
  return `Week of ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export default function HistoryPage() {
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<Page>((index, previous) => {
    if (previous && !previous.nextCursor) return null;
    return index === 0 ? '/api/workouts?limit=15' : `/api/workouts?limit=15&before=${previous!.nextCursor}`;
  });
  const sessions = data?.flatMap((p) => p.sessions) ?? [];
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  const groups: [string, SessionSummary[]][] = [];
  for (const s of sessions) {
    const label = weekLabel(s.session_date);
    const last = groups[groups.length - 1];
    if (last?.[0] === label) last[1].push(s);
    else groups.push([label, [s]]);
  }

  return (
    <>
      <header className="pb-3 pt-4">
        <Link href="/train" className="press -ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 text-[17px] text-accent">
          <ChevronLeft className="h-5 w-5" /> Train
        </Link>
        <h1 className="mt-1 text-large-title">History</h1>
      </header>

      {error && <ErrorNote message={error.message} onRetry={() => mutate()} />}
      {!data && !error && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}
      {data && sessions.length === 0 && (
        <EmptyState
          icon={<Dumbbell className="h-5 w-5" />}
          title="No workouts yet"
          body="Your finished sessions show up here."
          action={<ButtonLink href="/train">Start training</ButtonLink>}
        />
      )}

      {groups.map(([label, items]) => (
        <section key={label} className="mb-6">
          <p className="mb-2 mt-4 px-1 text-eyebrow uppercase text-fg-3">{label}</p>
          <ul className="overflow-hidden rounded-card border border-line bg-surface-1">
            {items.map((s) => {
              const minutes = minutesBetween(s.started_at, s.ended_at);
              return (
                <li key={s.id} className="border-b border-line last:border-0">
                  <Link href={`/history/${s.id}`} className="press flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-train/15 text-train">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-headline">
                        {s.body_part}
                        {s.pr_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                            <Trophy className="h-3 w-3" /> {s.pr_count} PR{s.pr_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-footnote text-fg-3">
                        {relativeDay(s.session_date)} · {s.exercise_count} exercises · {s.working_sets} sets{minutes ? ` · ${minutes} min` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-round text-lg font-extrabold">{compact(s.total_volume)}</p>
                      <p className="text-[11px] font-semibold text-fg-3">KG</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-fg-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hasMore && (
        <Button variant="secondary" block loading={isValidating} onClick={() => setSize(size + 1)}>
          Load more
        </Button>
      )}
    </>
  );
}
