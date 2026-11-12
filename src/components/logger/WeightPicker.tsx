'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/format';

const PX_PER_STEP = 20; // one tick every 20 px
const HALF_RULER_PX = 360; // ruler drawn above and below the needle

const round2 = (n: number) => Math.round(n * 100) / 100;
const buzz = (ms: number) => typeof navigator !== 'undefined' && navigator.vibrate?.(ms);

/**
 * A weight chosen with the thumb: a big number (tap to type it), − / + one step, and a tall
 * vertical ruler. Swipe the ruler up for more, down for less (like scrolling a list of
 * weights); the value snaps to the step and buzzes on every labelled mark. The ruler is a
 * real vertical slider for screen readers and the arrow keys.
 * Used for each set's weight (2.5 kg steps) and for the body-weight weigh-ins (0.1 kg).
 */
export function WeightPicker({
  value,
  onChange,
  label,
  unit,
  step = 2.5,
  min = 0,
  max = 500,
  major = 10,
  className,
}: {
  value: number | null;
  onChange: (kg: number) => void;
  /** Names the controls, e.g. "set 2 weight" or "body weight before" */
  label: string;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  /** kg between labelled marks on the ruler (a shorter mark halfway) */
  major?: number;
  className?: string;
}) {
  const kg = value ?? min;
  // The latest value, updated at once: quick drags and key presses must not start from a stale number
  const latest = useRef(kg);
  latest.current = kg;
  const drag = useRef<{ y: number; start: number } | null>(null);
  const [text, setText] = useState(value === null ? '' : String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(value === null ? '' : String(value));
  }, [value, editing]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const snap = (n: number) => clamp(round2(Math.round(n / step) * step));
  const set = (next: number) => {
    const v = snap(next);
    const prev = latest.current;
    if (v === prev) return;
    latest.current = v;
    if (Math.floor(v / major) !== Math.floor(prev / major)) buzz(6); // a tick on every labelled mark
    onChange(v);
  };
  const commit = (raw: string) => {
    setEditing(false);
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(clamp(round2(n)));
    else setText(value === null ? '' : String(value));
  };

  const pxPerKg = PX_PER_STEP / step;
  const stepsPerMajor = Math.max(1, Math.round(major / step));
  const reach = Math.ceil(HALF_RULER_PX / PX_PER_STEP);
  const at = Math.round(kg / step);
  const ticks: { i: number; t: number }[] = [];
  for (let i = at - reach; i <= at + reach; i++) {
    const t = round2(i * step);
    if (t >= min && t <= max) ticks.push({ i, t });
  }

  return (
    <div className={cn('flex min-h-0 items-stretch gap-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <input
          aria-label={label}
          inputMode="decimal"
          value={text}
          placeholder="–"
          onFocus={(e) => {
            setEditing(true);
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          style={{ width: `${Math.max(text.length, 1) + 0.4}ch` }}
          className="tabular min-w-0 max-w-full bg-transparent text-center font-display text-[64px] font-extrabold leading-none text-fg placeholder:text-fg-3 focus:outline-none"
        />
        <p className="mt-1 text-[15px] font-semibold text-fg-3">{unit}</p>
        <div className="mt-5 flex gap-3">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={`${dir < 0 ? 'Decrease' : 'Increase'} ${label}`}
              disabled={dir < 0 ? kg <= min : kg >= max}
              onClick={() => {
                buzz(8);
                set(latest.current + dir * step);
              }}
              className="press flex h-12 w-20 items-center justify-center gap-0.5 rounded-2xl bg-surface-2 text-[15px] font-bold text-fg-2 hover:text-fg disabled:opacity-30"
            >
              {dir < 0 ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {step}
            </button>
          ))}
        </div>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Slide to change ${label}`}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={kg}
        aria-valuetext={`${kg} kg`}
        onKeyDown={(e) => {
          const by = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: major, PageDown: -major }[e.key];
          if (by !== undefined) {
            e.preventDefault();
            set(latest.current + by);
          } else if (e.key === 'Home') {
            e.preventDefault();
            set(min);
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, start: latest.current };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          // The ruler follows the finger: pushing it up brings the heavier numbers below to the needle
          set(drag.current.start + (drag.current.y - e.clientY) / pxPerKg);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="relative w-24 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        {ticks.map(({ i, t }) => {
          const isMajor = i % stepsPerMajor === 0;
          const isMid = !isMajor && stepsPerMajor % 2 === 0 && i % (stepsPerMajor / 2) === 0;
          return (
            <div key={i} className="absolute inset-x-0 flex items-center" style={{ top: `calc(50% + ${(t - kg) * pxPerKg}px)`, transform: 'translateY(-50%)' }}>
              <span className={cn('block h-px', isMajor ? 'w-6 bg-fg-2' : isMid ? 'w-4 bg-fg-3' : 'w-2.5 bg-surface-4')} />
              {isMajor && <span className="tabular ml-2 text-[13px] font-semibold text-fg-2">{t}</span>}
            </div>
          );
        })}
        {/* The needle */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-accent shadow-[0_0_10px_rgba(255,59,48,0.8)]" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface-2 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-2 to-transparent" />
      </div>
    </div>
  );
}
