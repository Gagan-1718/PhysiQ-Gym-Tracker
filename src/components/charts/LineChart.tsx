'use client';

import { useId, useRef, useState } from 'react';
import { compactTick, linear, niceTicks } from './scale';
import { useWidth } from './use-width';

export interface Point {
  key: string;
  date: string; // short label for axis/tooltip
  value: number;
  detail?: string;
}

/**
 * Single-series line: 2px line, 10% area wash, end dot with a surface ring,
 * crosshair that snaps to the nearest point, hidden data table.
 */
export function LineChart({
  data,
  color,
  unit,
  title,
  height = 200,
  reference,
}: {
  data: Point[];
  color: string;
  unit: string;
  title: string;
  height?: number;
  /** Optional horizontal marker, e.g. the next target */
  reference?: { value: number; label: string };
}) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLElement>();
  const H = height;
  const pad = { top: 16, right: 16, bottom: 26, left: 44 };

  const values = data.map((d) => d.value).concat(reference ? [reference.value] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = Math.max(hi - lo, Math.abs(hi) * 0.05, 1);
  const ticks = niceTicks(lo - spread * 0.15, hi + spread * 0.15, 3);
  const x = linear(0, Math.max(1, data.length - 1), pad.left, W - pad.right);
  const y = linear(ticks[0], ticks[ticks.length - 1], H - pad.bottom, pad.top);

  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = data.length ? `${path} L${x(data.length - 1)},${H - pad.bottom} L${x(0)},${H - pad.bottom} Z` : '';

  function onMove(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.left) / (W - pad.left - pad.right)) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
    if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
  }

  const last = data[data.length - 1];
  const tip = active !== null ? data[active] : null;

  return (
    <figure ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W} height={H} className="block touch-pan-y overflow-visible outline-none"
        role="img"
        aria-label={`${title}. Use the left and right arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.16} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-3 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {compactTick(t)}
            </text>
          </g>
        ))}
        {reference && (
          <g>
            <line x1={pad.left} x2={W - pad.right} y1={y(reference.value)} y2={y(reference.value)} stroke="#F5F5F7" strokeOpacity={0.35} strokeWidth={1} />
            <text x={W - pad.right} y={y(reference.value) - 6} textAnchor="end" className="fill-fg-2 text-[11px] font-semibold">
              {reference.label}
            </text>
          </g>
        )}
        {data.length > 1 && <path d={area} fill={`url(#${id}-wash)`} />}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.length > 0 && (
          <>
            <text x={pad.left} y={H - 8} className="fill-fg-3 text-[11px]">
              {data[0].date}
            </text>
            {data.length > 1 && (
              <text x={W - pad.right} y={H - 8} textAnchor="end" className="fill-fg-3 text-[11px]">
                {last.date}
              </text>
            )}
            {/* end dot with a 2px surface ring */}
            <circle cx={x(data.length - 1)} cy={y(last.value)} r={5.5} fill="#0D0D0F" />
            <circle cx={x(data.length - 1)} cy={y(last.value)} r={4} fill={color} />
          </>
        )}
        {tip && active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={pad.top} y2={H - pad.bottom} stroke="#F5F5F7" strokeOpacity={0.25} strokeWidth={1} />
            <circle cx={x(active)} cy={y(tip.value)} r={6} fill="#0D0D0F" />
            <circle cx={x(active)} cy={y(tip.value)} r={4.5} fill={color} />
          </g>
        )}
      </svg>
      {tip && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-xl"
          style={{ left: `${Math.min(82, Math.max(18, (x(active) / W) * 100))}%` }}
        >
          <p className="tabular text-[15px] font-bold">
            {tip.value.toLocaleString()} {unit}
          </p>
          <p className="text-footnote text-fg-2">
            {tip.date}
            {tip.detail ? ` · ${tip.detail}` : ''}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.date}</th>
              <td>
                {d.value} {unit}
              </td>
              {d.detail && <td>{d.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
