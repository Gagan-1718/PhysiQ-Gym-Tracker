'use client';

import { useRef, useState } from 'react';
import { kg, shortDate } from '@/lib/format';
import type { WeighIn } from '@/types/database';
import { compactTick, linear, niceTicks } from './scale';
import { useWidth } from './use-width';

/** Before = blue, after = the app red; checked for colour-blind separation and contrast on the dark card */
export const BEFORE_COLOR = '#1E9FD0';
export const AFTER_COLOR = '#FF4B2B';
const SURFACE = '#0D0D0F';

const diff = (w: WeighIn) => (w.weight_before !== null && w.weight_after !== null ? Math.round((w.weight_after - w.weight_before) * 10) / 10 : null);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${kg(Math.abs(n))}`;

/**
 * One "dumbbell" per workout: the weight before (blue dot) and after (red dot), joined by a
 * thin line, so both the change inside each workout and the trend across workouts show.
 * Hover / tap / arrow keys read one workout; a hidden table carries the same numbers.
 */
export function WeighInChart({ data, height = 200 }: { data: WeighIn[]; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLElement>();
  const H = height;
  const pad = { top: 16, right: 16, bottom: 26, left: 44 };

  const values = data.flatMap((d) => [d.weight_before, d.weight_after]).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = Math.max(hi - lo, 1);
  const ticks = niceTicks(lo - spread * 0.2, hi + spread * 0.2, 3);
  // Workouts are evenly spaced (one slot each), with half a slot of room at both ends
  const x = linear(-0.5, data.length - 0.5, pad.left, W - pad.right);
  const y = linear(ticks[0], ticks[ticks.length - 1], H - pad.bottom, pad.top);

  function onMove(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor(((px - pad.left) / (W - pad.left - pad.right)) * data.length);
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
    if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
  }

  const dot = (cx: number, v: number | null, color: string, r = 4) =>
    v === null ? null : (
      <>
        <circle cx={cx} cy={y(v)} r={r + 2} fill={SURFACE} />
        <circle cx={cx} cy={y(v)} r={r} fill={color} />
      </>
    );
  const tip = active !== null ? data[active] : null;

  return (
    <figure ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block touch-pan-y overflow-visible outline-none"
        role="img"
        aria-label="Body weight before and after each workout. Use the left and right arrow keys to read values."
        tabIndex={0}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-3 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {compactTick(t)}
            </text>
          </g>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={H - pad.bottom} stroke="#F5F5F7" strokeOpacity={0.25} strokeWidth={1} />}
        {data.map((d, i) => (
          <g key={d.id}>
            {d.weight_before !== null && d.weight_after !== null && (
              <line x1={x(i)} x2={x(i)} y1={y(d.weight_before)} y2={y(d.weight_after)} stroke="#919197" strokeWidth={2} strokeLinecap="round" />
            )}
            {dot(x(i), d.weight_before, BEFORE_COLOR, active === i ? 5 : 4)}
            {dot(x(i), d.weight_after, AFTER_COLOR, active === i ? 5 : 4)}
          </g>
        ))}
        {data.length > 0 && (
          <>
            <text x={pad.left} y={H - 8} className="fill-fg-3 text-[11px]">
              {shortDate(data[0].session_date)}
            </text>
            {data.length > 1 && (
              <text x={W - pad.right} y={H - 8} textAnchor="end" className="fill-fg-3 text-[11px]">
                {shortDate(data[data.length - 1].session_date)}
              </text>
            )}
          </>
        )}
      </svg>
      {tip && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-xl"
          style={{ left: `${Math.min(80, Math.max(20, (x(active) / W) * 100))}%` }}
        >
          <p className="text-footnote text-fg-2">
            {tip.body_part} · {shortDate(tip.session_date)}
          </p>
          <p className="tabular mt-0.5 flex items-center gap-1.5 text-[15px] font-bold">
            <span className="h-2 w-2 rounded-full" style={{ background: BEFORE_COLOR }} />
            {kg(tip.weight_before)}
            <span className="font-medium text-fg-3">→</span>
            <span className="h-2 w-2 rounded-full" style={{ background: AFTER_COLOR }} />
            {kg(tip.weight_after)} kg
          </p>
          {diff(tip) !== null && <p className="tabular text-footnote text-fg-2">{signed(diff(tip)!)} kg during the workout</p>}
        </div>
      )}
      {/* wrapped: a bare <table> ignores sr-only's 1px width and makes the page scroll sideways on narrow phones */}
      <div className="sr-only">
        <table>
          <caption>Body weight before and after each workout</caption>
          <thead>
            <tr>
              <th scope="col">Workout</th>
              <th scope="col">Before (kg)</th>
              <th scope="col">After (kg)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <th scope="row">
                  {d.body_part}, {shortDate(d.session_date)}
                </th>
                <td>{kg(d.weight_before)}</td>
                <td>{kg(d.weight_after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Average change from before to after, over the workouts that have both (null if none) */
export function averageChange(data: WeighIn[]): number | null {
  const both = data.map(diff).filter((d): d is number => d !== null);
  return both.length ? Math.round((both.reduce((a, b) => a + b, 0) / both.length) * 10) / 10 : null;
}
export { signed as signedKg };
