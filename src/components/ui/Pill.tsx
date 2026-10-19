import { cn } from '@/lib/format';
import type { DayStatus } from '@/types/database';

export const STATUS_META: Record<DayStatus, { label: string; text: string; bg: string; color: string }> = {
  overdue: { label: 'Overdue', text: 'text-train', bg: 'bg-train/15', color: '#FA2D55' },
  ready: { label: 'Ready', text: 'text-accent', bg: 'bg-accent/15', color: '#B6F23B' },
  recovering: { label: 'Recovering', text: 'text-recover', bg: 'bg-recover/15', color: '#FFB020' },
  new: { label: 'Not started', text: 'text-water', bg: 'bg-water/15', color: '#2DD4F5' },
};

export function StatusPill({ status, className }: { status: DayStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', meta.bg, meta.text, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

/** Toggleable filter chip */
export function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'press h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
        active ? 'bg-fg text-black' : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
