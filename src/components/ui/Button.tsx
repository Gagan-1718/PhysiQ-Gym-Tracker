import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from '@/lib/format';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'train';
type Size = 'lg' | 'md' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-black font-semibold hover:brightness-105 disabled:bg-surface-3 disabled:text-fg-3',
  secondary: 'bg-surface-3 text-fg font-medium hover:bg-surface-4 disabled:text-fg-3',
  ghost: 'text-fg-2 font-medium hover:bg-surface-2 hover:text-fg disabled:text-fg-3',
  danger: 'bg-train/15 text-train font-semibold hover:bg-train/20',
  train: 'bg-train text-white font-semibold hover:brightness-110',
};

const sizes: Record<Size, string> = {
  lg: 'h-14 px-6 text-[17px] rounded-2xl gap-2.5',
  md: 'h-11 px-5 text-[15px] rounded-xl gap-2',
  sm: 'h-9 px-3.5 text-sm rounded-full gap-1.5',
};

const base =
  'press inline-flex select-none items-center justify-center whitespace-nowrap transition-colors disabled:pointer-events-none';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="h-5 w-5" /> : children}
    </button>
  );
});

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function ButtonLink({ variant = 'primary', size = 'md', block, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], sizes[size], block && 'w-full', className)} {...props} />;
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'press inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
