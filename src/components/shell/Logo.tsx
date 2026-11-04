import { cn } from '@/lib/format';

/**
 * The PhysiQ mark: the Q with the lifter, cut from the master logo (design/physiq-logo.png,
 * regenerate with `npm run brand:assets`). The image has a true-black background, so use it
 * on dark backgrounds only (mix-blend-lighten lets the glow behind it show through the image's black).
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.png" width={size} height={size} alt="" aria-hidden className={cn('shrink-0 select-none mix-blend-lighten', className)} draggable={false} />;
}

/** The full logo (mark + wordmark) for the sign-in screens. */
export function LogoFull({ size = 220, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo.webp" width={size} height={size} alt="PhysiQ" className={cn('select-none mix-blend-lighten', className)} draggable={false} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-wordmark text-[22px] font-black italic tracking-[0.01em]', className)}>
      Physi<span className="text-accent">Q</span>
    </span>
  );
}
