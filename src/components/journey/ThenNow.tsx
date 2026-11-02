'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { kg, shortDate } from '@/lib/format';
import type { JourneyStory } from '@/types/database';

/**
 * "Then and now": the first and latest progress photo with a draggable reveal.
 * Compared by eye, no image-analysis, so it is honest about what it shows.
 */
export function ThenNow({ first, latest }: { first: JourneyStory; latest: JourneyStory }) {
  const [pos, setPos] = useState(50);
  const delta = first.weight_snapshot !== null && latest.weight_snapshot !== null ? Math.round((latest.weight_snapshot - first.weight_snapshot) * 10) / 10 : null;

  return (
    <Card>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-eyebrow uppercase text-fg-3">Then and now</p>
          <p className="text-headline">
            {shortDate(first.date)} → {shortDate(latest.date)}
          </p>
        </div>
        {delta !== null && (
          <p className="rounded-full bg-water/15 px-2.5 py-1 text-footnote font-semibold text-water">
            {delta > 0 ? '+' : ''}
            {kg(delta)} kg
          </p>
        )}
      </div>

      <div className="relative mt-3 aspect-[3/4] max-h-[26rem] w-full select-none overflow-hidden rounded-2xl bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-authenticated images */}
        <img src={latest.photo_url!} alt={`Latest photo, ${latest.date}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={first.photo_url!}
          alt={`First photo, ${first.date}`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow" style={{ left: `${pos}%` }}>
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-black text-black shadow-lg">↔</span>
        </div>
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold backdrop-blur">Then</span>
        <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold backdrop-blur">Now</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Reveal: drag between the first and the latest photo"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
    </Card>
  );
}
