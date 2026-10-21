'use client';

import { useId, useState } from 'react';
import { compactTick, linear, niceTicks } from './scale';
import { useWidth } from './use-width';

export interface Column {
  key: string;
  label: string; // x-axis label
  value: number;
  detail: string; // tooltip line, e.g. "4 sessions · 48 sets"
  highlight?: boolean;
}

/**
 * Single-series column chart: ≤24px columns, 4px rounded tops square at the
 * baseline, hairline grid, per-column hover/focus tooltip, hidden data table.
 */
export function ColumnChart({ data, color, unit, height = 180, title }: { data: Column[]; color: string; unit: string; height?: number; title: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLElement>();
  const H = height;
  const pad = { top: 12, right: 8, bottom: 26, left: 40 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max, 3);
  const y = linear(0, ticks[ticks.length - 1], H - pad.bottom, pad.top);
  const band = (W - pad.left - pad.right) / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.55);
  // When bands are narrow, label every other column (counting back from the last) so labels never collide
  const labelEvery = band < 46 ? 2 : 1;

  const column = (v: number, i: number) => {
    const x = pad.left + band * i + (band - barW) / 2;
    const top = y(v);
    const base = H - pad.bottom;
    const h = Math.max(0, base - top);
    const r = Math.min(4, h, barW / 2);
    // rounded data-end, square baseline
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const tip = active !== null ? data[active] : null;
  const tipX = active !== null ? ((pad.left + band * active + band / 2) / W) * 100 : 0;

  return (
    <figure ref={wrapRef} className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="sr-only">
        {title}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block overflow-visible" role="img" aria-label={title} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-3 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {compactTick(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.key}>
            {d.value > 0 && <path d={column(d.value, i)} fill={color} opacity={active === null || active === i ? (d.highlight ? 1 : 0.7) : 0.35} />}
            {(data.length - 1 - i) % labelEvery === 0 && (
              <text x={pad.left + band * i + band / 2} y={H - 8} textAnchor="middle" className={d.highlight ? 'fill-fg text-[11px] font-semibold' : 'fill-fg-3 text-[11px]'}>
                {d.label}
              </text>
            )}
            {/* Hit target: the whole band, bigger than the mark */}
            <rect
              x={pad.left + band * i}
              y={pad.top}
              width={band}
              height={H - pad.top - pad.bottom}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${d.label}: ${d.value.toLocaleString()} ${unit}. ${d.detail}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-pointer outline-none"
            />
          </g>
        ))}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-xl"
          style={{ left: `${Math.min(85, Math.max(15, tipX))}%` }}
        >
          <p className="tabular text-[15px] font-bold">
            {tip.value.toLocaleString()} {unit}
          </p>
          <p className="text-footnote text-fg-2">
            {tip.label} · {tip.detail}
          </p>
        </div>
      )}
      {/* wrapped: a bare <table> ignores sr-only's 1px width and makes the page scroll sideways on narrow phones */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>
                {d.value} {unit}
              </td>
              <td>{d.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
