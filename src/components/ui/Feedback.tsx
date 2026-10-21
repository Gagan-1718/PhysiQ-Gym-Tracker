import { cn } from '@/lib/format';

/** Shimmering placeholder while data loads */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-card bg-surface-1', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-fg-2">{icon}</div>
      <p className="text-headline">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[15px] text-fg-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-train/30 bg-train/10 px-4 py-3 text-[15px] text-train">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}
