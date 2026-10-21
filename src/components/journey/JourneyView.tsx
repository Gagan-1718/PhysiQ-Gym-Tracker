'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { Plus, Search, X } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Pill';
import { EmptyState, ErrorNote, Skeleton } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { LineChart } from '@/components/charts/LineChart';
import { send } from '@/lib/client';
import { MONTHS, parseLocalDate } from '@/lib/format';
import type { JourneyInsights, JourneyStory } from '@/types/database';
import { AddStorySheet } from './AddStorySheet';
import { StoryCard } from './StoryCard';
import { ThenNow } from './ThenNow';

interface Page {
  stories: JourneyStory[];
  nextCursor: string | null;
}

const KINDS = [
  { value: '', label: 'All' },
  { value: 'workout_journal', label: 'Workouts' },
  { value: 'progress_photo', label: 'Photos' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'note', label: 'Notes' },
];

function monthLabel(iso: string) {
  const d = parseLocalDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The "Journey" view of the Progress tab: a MongoDB-backed timeline with filters, search and photos. */
export function JourneyView() {
  const toast = useToast();
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<JourneyStory | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce the search box so we query once the member pauses typing
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(id);
  }, [input]);

  const insights = useSWR<JourneyInsights>('/api/journey/insights');
  const feed = useSWRInfinite<Page>((index, previous) => {
    if (previous && !previous.nextCursor) return null;
    const p = new URLSearchParams({ limit: '12' });
    if (kind) p.set('kind', kind);
    if (tag) p.set('tag', tag);
    if (q) p.set('q', q);
    if (index > 0) p.set('before', previous!.nextCursor!);
    return `/api/journey?${p}`;
  });

  const stories = feed.data?.flatMap((p) => p.stories) ?? [];
  const hasMore = Boolean(feed.data?.[feed.data.length - 1]?.nextCursor);
  const filtered = Boolean(kind || tag || q);

  const months = useMemo(() => {
    const out: [string, JourneyStory[]][] = [];
    for (const s of stories) {
      const label = monthLabel(s.date);
      const last = out[out.length - 1];
      if (last?.[0] === label) last[1].push(s);
      else out.push([label, [s]]);
    }
    return out;
  }, [stories]);

  const refreshAll = () => {
    void feed.mutate();
    void insights.mutate();
  };

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await send(`/api/journey/${toDelete.id}`, 'DELETE');
      toast('Entry deleted');
      setToDelete(null);
      refreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const ins = insights.data;
  const total = ins ? Object.values(ins.counts).reduce((a, b) => a + b, 0) : 0;
  const avgMood = ins && ins.moodByWeek.length ? Math.round((ins.moodByWeek.reduce((a, w) => a + (w.mood ?? 0), 0) / ins.moodByWeek.length) * 10) / 10 : null;

  return (
    <>
      {ins && total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Entries', String(total)],
            ['Photos', String(ins.counts.progress_photo ?? 0)],
            ['Avg mood', avgMood !== null ? `${avgMood}` : '–'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface-1 p-3.5">
              <p className="text-footnote text-fg-3">{label}</p>
              <p className="font-round text-2xl font-extrabold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {ins && ins.moodByWeek.length > 1 && (
        <>
          <SectionHeader title="Mood by week" />
          <Card>
            <LineChart
              title="Average mood by week, 1 to 5"
              color="#B6F23B"
              unit="/ 5"
              height={150}
              domain={[1, 5]}
              data={ins.moodByWeek.map((w) => ({
                key: w.week,
                date: `${parseLocalDate(w.week).getDate()} ${MONTHS[parseLocalDate(w.week).getMonth()]}`,
                value: w.mood ?? 0,
                detail: `${w.entries} ${w.entries === 1 ? 'entry' : 'entries'}`,
              }))}
            />
          </Card>
        </>
      )}

      {ins?.firstPhoto && ins.latestPhoto && (
        <>
          <SectionHeader title="Photos" />
          <ThenNow first={ins.firstPhoto} latest={ins.latestPhoto} />
        </>
      )}

      <SectionHeader title="Timeline" action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>} />

      <label className="relative mb-3 block">
        <span className="sr-only">Search your journey</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search captions and tags"
          className="h-11 w-full rounded-xl border border-line bg-surface-1 pl-10 pr-4 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
        />
      </label>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {KINDS.map((k) => (
          <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
          </Chip>
        ))}
        {tag && (
          <Chip active onClick={() => setTag('')} aria-label={`Remove tag filter ${tag}`}>
            #{tag} <X className="ml-1 inline h-3.5 w-3.5" />
          </Chip>
        )}
      </div>
      {!tag && ins && ins.topTags.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Popular tags">
          {ins.topTags.map((t) => (
            <button key={t.tag} onClick={() => setTag(t.tag)} className="press shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-fg-2 hover:text-fg">
              #{t.tag} <span className="text-fg-3">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {feed.error && <ErrorNote message={feed.error.message} onRetry={() => feed.mutate()} />}
      {!feed.data && !feed.error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {feed.data && stories.length === 0 && (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title={filtered ? 'Nothing matches' : 'Your journey starts here'}
          body={filtered ? 'Try another word, tag or filter. Search finds whole words.' : 'Finish a workout with a journal, add a note, or take a progress photo.'}
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => { setKind(''); setTag(''); setInput(''); }}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add the first entry
              </Button>
            )
          }
        />
      )}

      {months.map(([label, items]) => (
        <section key={label}>
          <p className="mb-2 mt-5 px-1 text-eyebrow uppercase text-fg-3">{label}</p>
          <div className="space-y-3">
            {items.map((s) => (
              <StoryCard key={s.id} story={s} onTag={setTag} onDelete={setToDelete} />
            ))}
          </div>
        </section>
      ))}

      {hasMore && (
        <Button variant="secondary" block className="mt-5" loading={feed.isValidating} onClick={() => feed.setSize(feed.size + 1)}>
          Load more
        </Button>
      )}

      <AddStorySheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={refreshAll} />

      <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title="Delete this entry?">
        <p className="text-[15px] text-fg-2">
          {toDelete?.photo_url ? 'The photo file is permanently removed too.' : 'This cannot be undone.'} Your workout itself is not affected.
        </p>
        <div className="mt-6 grid gap-3">
          <Button variant="danger" size="lg" loading={deleting} onClick={confirmDelete}>
            Delete
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setToDelete(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </>
  );
}
