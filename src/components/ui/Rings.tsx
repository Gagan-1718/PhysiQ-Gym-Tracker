'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';

export interface RingSpec {
  /** 0..1 (values above 1 are drawn full) */
  progress: number;
  color: string;
  deep: string;
  label: string;
}

/**
 * Concentric activity rings (outermost first), Apple Fitness style:
 * dim track, gradient arc from deep to bright, rounded caps, animated fill.
 */
export function Rings({ rings, size = 168, stroke = 18, gap = 4 }: { rings: RingSpec[]; size?: number; stroke?: number; gap?: number }) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={rings.map((r) => `${r.label} ${Math.round(r.progress * 100)}%`).join(', ')}
    >
      <defs>
        {rings.map((ring, i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ring.deep} />
            <stop offset="100%" stopColor={ring.color} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((ring, i) => {
        const radius = center - stroke / 2 - i * (stroke + gap);
        const circumference = 2 * Math.PI * radius;
        const p = Math.max(0, Math.min(1, ring.progress));
        return (
          <g key={i} transform={`rotate(-90 ${center} ${center})`}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke={ring.color} strokeOpacity={0.16} strokeWidth={stroke} />
            {p > 0 && (
              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={`url(#${id}-g${i})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: reduce ? circumference * (1 - p) : circumference }}
                animate={{ strokeDashoffset: circumference * (1 - p) }}
                transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.12 * i, ease: [0.2, 0.8, 0.2, 1] }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Single small ring, used inline (e.g. recovery progress of a split day) */
export function MiniRing({ progress, color, size = 36, stroke = 5 }: { progress: number; color: string; size?: number; stroke?: number }) {
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke} />
        {p > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p)}
          />
        )}
      </g>
    </svg>
  );
}
