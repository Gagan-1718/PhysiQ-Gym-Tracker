'use client';

import { useState } from 'react';
import { cn } from '@/lib/format';

/**
 * Weekly working sets per muscle as horizontal bars, with the common
 * hypertrophy dose (10–20 sets/week) shaded as a reference band.
 */
export function MuscleBars({ rows, color }: { rows: { name: string; sets: number; previous: number }[]; color: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(22, ...rows.map((r) => r.sets));
  const pct = (v: number) => `${(v / max) * 100}%`;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 pl-[5.5rem] text-footnote text-fg-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-white/[0.07]" /> 10–20 sets target
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const inZone = r.sets >= 10 && r.sets <= 20;
          return (
            <li
              key={r.name}
              tabIndex={0}
              onPointerEnter={() => setActive(r.name)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(r.name)}
              onBlur={() => setActive(null)}
              aria-label={`${r.name}: ${r.sets} working sets this week, ${r.previous} last week`}
              className="flex items-center gap-3 rounded-lg outline-none"
            >
              <span className={cn('w-[4.75rem] shrink-0 truncate text-[15px]', active === r.name ? 'text-fg' : 'text-fg-2')}>{r.name}</span>
              <div className="relative h-3 flex-1">
                <div className="absolute inset-y-[-3px] rounded-sm bg-white/[0.07]" style={{ left: pct(10), width: pct(10) }} />
                {r.sets > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-700 ease-out"
                    style={{ width: pct(r.sets), background: color, opacity: active && active !== r.name ? 0.4 : inZone ? 1 : 0.75 }}
                  />
                )}
              </div>
              <span className="tabular w-16 shrink-0 text-right text-[15px] font-semibold text-fg">
                {r.sets}
                {active === r.name && <span className="ml-1 text-footnote font-normal text-fg-3">/ {r.previous}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
