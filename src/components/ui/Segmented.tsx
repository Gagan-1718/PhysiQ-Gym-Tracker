'use client';

import { cn } from '@/lib/format';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label: string;
}

/**
 * iOS-style segmented control with a sliding selection pill.
 *
 * The pill slides with a plain CSS transform (segments are equal width). It must
 * not use framer-motion's shared `layoutId`: inside a bottom sheet, a layout
 * animation can leave AnimatePresence waiting forever, so the closed sheet's
 * overlay stays in the DOM and blocks every tap.
 */
export function Segmented<T extends string>({ value, onChange, options, className, label }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className={cn('relative flex rounded-xl bg-surface-2 p-1', className)}>
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 rounded-lg bg-surface-4 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn('relative z-10 h-9 flex-1 rounded-lg text-sm font-semibold transition-colors', active ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
