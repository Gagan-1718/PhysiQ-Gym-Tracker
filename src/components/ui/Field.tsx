import { forwardRef, useId } from 'react';
import { cn } from '@/lib/format';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  suffix?: string;
}

/** Labelled input. 16px text so iOS Safari never zooms on focus. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, suffix, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block px-1 text-footnote font-medium text-fg-2">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          className={cn(
            'h-12 w-full rounded-field border bg-surface-2 px-4 text-[16px] text-fg placeholder:text-fg-3',
            'transition-colors focus:border-accent/60 focus:outline-none focus:ring-0',
            error ? 'border-train/60' : 'border-line',
            suffix && 'pr-12'
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] text-fg-3">{suffix}</span>
        )}
      </div>
      {(error || hint) && (
        <p id={`${inputId}-msg`} className={cn('mt-1.5 px-1 text-footnote', error ? 'text-train' : 'text-fg-3')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
