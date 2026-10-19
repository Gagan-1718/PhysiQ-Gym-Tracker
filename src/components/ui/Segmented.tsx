'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/format';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  label: string;
}

/** iOS-style segmented control with a sliding selection pill. */
export function Segmented<T extends string>({ value, onChange, options, className, label }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-xl bg-surface-2 p-1', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn('relative h-9 flex-1 rounded-lg text-sm font-semibold transition-colors', active ? 'text-fg' : 'text-fg-3 hover:text-fg-2')}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-surface-4"
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
