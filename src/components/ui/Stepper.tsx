'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/format';

interface StepperProps {
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  decimals?: boolean;
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}

/**
 * Big − value + control for sweaty thumbs. The middle is a real input, so the
 * exact number can also be typed (numeric keypad on phones).
 */
export function Stepper({ value, onChange, step, min = 0, max = 999, unit, label, decimals, size = 'lg', className }: StepperProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setText(value === null ? '' : String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const bump = (dir: 1 | -1) => {
    onChange(clamp((value ?? 0) + dir * step));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
  };
  const commit = (raw: string) => {
    if (raw.trim() === '') return onChange(null);
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(value === null ? '' : String(value));
  };

  const h = size === 'lg' ? 'h-14' : 'h-11';
  const w = size === 'lg' ? 'w-14' : size === 'md' ? 'w-11' : 'w-8';
  return (
    <div className={cn('flex items-center rounded-2xl bg-surface-2 focus-within:ring-2 focus-within:ring-accent/50', className)}>
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={value !== null && value <= min}
        aria-label={`Decrease ${label}`}
        className={cn('press flex shrink-0 items-center justify-center rounded-l-2xl text-fg-2 hover:text-fg disabled:opacity-30', h, w)}
      >
        <Minus className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      {/* Tapping anywhere in the centre (not just on the digits) edits the number */}
      <div className={cn('flex min-w-0 flex-1 cursor-text items-center justify-center self-stretch', h)} onClick={() => inputRef.current?.focus()}>
        <div className="flex min-w-0 max-w-full items-baseline">
        <input
          ref={inputRef}
          aria-label={label}
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={text}
          placeholder="–"
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          onFocus={(e) => e.target.select()}
          // Size to the content so the unit sits right next to the number
          style={{ width: `${Math.max(text.length, 1) + 0.6}ch` }}
          className={cn(
            'tabular min-w-0 max-w-full bg-transparent text-center font-round font-extrabold text-fg placeholder:text-fg-3 focus:outline-none',
            size === 'lg' ? 'text-[26px]' : size === 'md' ? 'text-xl' : 'text-lg'
          )}
        />
        {unit && (
          <span aria-hidden className="pl-0.5 text-footnote font-semibold text-fg-3">
            {unit}
          </span>
        )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={value !== null && value >= max}
        aria-label={`Increase ${label}`}
        className={cn('press flex shrink-0 items-center justify-center rounded-r-2xl text-fg-2 hover:text-fg disabled:opacity-30', h, w)}
      >
        <Plus className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
    </div>
  );
}
