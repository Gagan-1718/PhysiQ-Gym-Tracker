'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Camera, Dumbbell, NotebookPen, Trash2, Trophy } from 'lucide-react';
import { cn, kg, relativeDay } from '@/lib/format';
import { moodOf } from '@/lib/mood';
import type { JourneyStory } from '@/types/database';

const KIND = {
  workout_journal: { icon: Dumbbell, label: 'Workout', tone: 'bg-train/15 text-train' },
  progress_photo: { icon: Camera, label: 'Progress photo', tone: 'bg-water/15 text-water' },
  milestone: { icon: Trophy, label: 'Milestone', tone: 'bg-gold/15 text-gold' },
  note: { icon: NotebookPen, label: 'Note', tone: 'bg-accent/15 text-accent' },
} as const;

interface StoryCardProps {
  story: JourneyStory;
  onTag: (tag: string) => void;
  onDelete: (story: JourneyStory) => void;
}

/** One entry of the journey timeline. */
export function StoryCard({ story: s, onTag, onDelete }: StoryCardProps) {
  const kind = KIND[s.kind];
  const Icon = kind.icon;
  const mood = moodOf(s.mood);
  const prs = s.highlights.filter((h) => h.type === 'pr');
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article className={cn('rounded-card border bg-surface-1 p-4', s.kind === 'milestone' ? 'border-gold/30 bg-gold/[0.06]' : 'border-line')}>
      <header className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', kind.tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">
            {s.kind === 'milestone' && s.milestone ? `${s.milestone.value} workouts` : s.kind === 'workout_journal' ? (s.highlights.find((h) => h.type === 'focus')?.label ?? 'Workout') : kind.label}
          </p>
          <p className="text-footnote text-fg-3">
            {relativeDay(s.date)}
            {s.weight_snapshot !== null && ` · ${kg(s.weight_snapshot)} kg`}
            {s.photo_angle && ` · ${s.photo_angle}`}
          </p>
        </div>
        {mood && (
          <span className="text-xl" title={mood.label} aria-label={`Mood: ${mood.label}`}>
            {mood.emoji}
          </span>
        )}
        <button
          onClick={() => onDelete(s)}
          aria-label="Delete entry"
          className="press -mr-1.5 rounded-full p-2 text-fg-3 hover:bg-surface-2 hover:text-train"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {s.photo_url && !imgFailed && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-authenticated image */}
          <img
            src={s.photo_url}
            alt={`Progress photo, ${s.photo_angle ?? 'front'} view, ${s.date}`}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="max-h-[28rem] w-full object-cover"
          />
        </div>
      )}
      {s.photo_url && imgFailed && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-footnote text-fg-3">This photo file is no longer available on the server.</p>}

      {s.caption && <p className="mt-3 text-[16px] leading-relaxed text-fg">{s.caption}</p>}

      {prs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prs.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gold/12 px-2.5 py-1 text-xs font-semibold text-gold">
              <Trophy className="h-3 w-3" /> {p.exercise} {p.weight !== undefined && `${kg(p.weight)}×${p.reps}`}
            </span>
          ))}
        </div>
      )}

      {s.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.tags.map((t) => (
            <button key={t} onClick={() => onTag(t)} className="press inline-flex min-h-[2rem] items-center rounded-full bg-surface-3 px-3 text-xs font-semibold text-fg-2 hover:text-fg">
              #{t}
            </button>
          ))}
        </div>
      )}

      {s.session_id && (
        <Link href={`/history/${s.session_id}`} className="-mb-2 mt-1 inline-flex min-h-[2.75rem] items-center text-[15px] font-medium text-accent hover:brightness-110">
          View workout →
        </Link>
      )}
    </article>
  );
}
