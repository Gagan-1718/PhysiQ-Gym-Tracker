import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/format';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-line bg-surface-1 p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  );
}

/** Section title above a group of cards, Apple-style ("Activity", "History >") */
export function SectionHeader({
  title,
  href,
  action,
  className,
}: {
  title: string;
  href?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2.5 mt-7 flex items-end justify-between px-1', className)}>
      <h2 className="text-title text-fg">{title}</h2>
      {href ? (
        <Link href={href} className="-my-2 flex min-h-[2.75rem] items-center text-[15px] font-medium text-accent hover:brightness-110">
          Show more <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('text-eyebrow uppercase text-fg-3', className)}>{children}</p>;
}

/** Big rounded metric: value + unit, Apple Fitness style */
export function Metric({
  value,
  unit,
  className,
  unitClassName,
}: {
  value: React.ReactNode;
  unit?: string;
  className?: string;
  unitClassName?: string;
}) {
  return (
    <span className={cn('tabular font-round font-extrabold leading-none', className)}>
      {value}
      {unit && <span className={cn('ml-0.5 text-[0.45em] font-bold text-fg-2', unitClassName)}>{unit}</span>}
    </span>
  );
}
