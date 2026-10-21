'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Feedback';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/format';
import { useLibrary } from '@/lib/training';
import type { Exercise } from '@/types/database';

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => Promise<void>;
  addedIds: number[];
  /** Muscles of today's split day, shown first */
  focusMuscles: string[];
  focusLabel: string;
}

export function ExercisePicker({ open, onClose, onPick, addedIds, focusMuscles, focusLabel }: ExercisePickerProps) {
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>(focusMuscles.length ? 'focus' : 'all');
  const [adding, setAdding] = useState<number | null>(null);

  const results = useMemo(() => {
    const all = library.data?.exercises ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      if (q) return e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q) || e.equipment_needed.toLowerCase().includes(q);
      if (filter === 'focus') return focusMuscles.includes(e.muscle_group);
      if (filter === 'all') return true;
      return e.muscle_group === filter;
    });
  }, [library.data, query, filter, focusMuscles]);

  const groups = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of results) map.set(e.muscle_group, [...(map.get(e.muscle_group) ?? []), e]);
    return [...map.entries()];
  }, [results]);

  async function pick(e: Exercise) {
    setAdding(e.id);
    try {
      await onPick(e);
      setQuery('');
      onClose();
    } finally {
      setAdding(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise" className="h-[88dvh] sm:h-[80vh] sm:max-w-xl">
      <div className="sticky top-0 z-10 -mx-5 bg-surface-1 px-5 pb-3">
        <label className="relative block">
          <span className="sr-only">Search exercises</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 44 exercises"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-[16px] placeholder:text-fg-3 focus:border-accent/60 focus:outline-none"
          />
        </label>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {focusMuscles.length > 0 && (
            <Chip active={filter === 'focus' && !query} onClick={() => { setFilter('focus'); setQuery(''); }}>
              {focusLabel}
            </Chip>
          )}
          <Chip active={filter === 'all' && !query} onClick={() => { setFilter('all'); setQuery(''); }}>
            All
          </Chip>
          {library.data?.muscleGroups.map((m) => (
            <Chip key={m.id} active={filter === m.name && !query} onClick={() => { setFilter(m.name); setQuery(''); }}>
              {m.name}
            </Chip>
          ))}
        </div>
      </div>

      {!library.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : results.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-fg-3">No exercise matches “{query}”.</p>
      ) : (
        groups.map(([muscle, items]) => (
          <div key={muscle} className="mb-4">
            <p className="mb-1 px-1 text-eyebrow uppercase text-fg-3">{muscle}</p>
            <ul className="overflow-hidden rounded-2xl bg-surface-2">
              {items.map((e) => {
                const added = addedIds.includes(e.id);
                return (
                  <li key={e.id} className="border-b border-line last:border-0">
                    <button
                      onClick={() => pick(e)}
                      disabled={added || adding !== null}
                      className={cn('press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-3', added && 'opacity-50')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium">{e.name}</p>
                        <p className="text-footnote text-fg-3">{e.equipment_needed}</p>
                      </div>
                      {adding === e.id ? <Spinner className="h-5 w-5 text-accent" /> : added ? <Check className="h-5 w-5 text-accent" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </Sheet>
  );
}
