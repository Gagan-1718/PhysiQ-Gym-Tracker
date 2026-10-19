import { cn } from '@/lib/format';

/** PhysiQ mark: three nested activity rings with a tail, reading as a "Q". */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="pq-train" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B3123A" />
          <stop offset="1" stopColor="#FA2D55" />
        </linearGradient>
        <linearGradient id="pq-protein" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6FA312" />
          <stop offset="1" stopColor="#B6F23B" />
        </linearGradient>
        <linearGradient id="pq-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E7FA0" />
          <stop offset="1" stopColor="#2DD4F5" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" transform="rotate(-90 24 24)">
        <circle cx="24" cy="24" r="19" stroke="url(#pq-train)" strokeWidth="5" strokeDasharray="105 120" />
        <circle cx="24" cy="24" r="12.5" stroke="url(#pq-protein)" strokeWidth="5" strokeDasharray="62 79" />
        <circle cx="24" cy="24" r="6" stroke="url(#pq-water)" strokeWidth="5" strokeDasharray="26 38" />
      </g>
      <path d="M33 33 L42 42" stroke="#FA2D55" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[19px] font-bold tracking-[-0.02em]', className)}>
      Physi<span className="text-accent">Q</span>
    </span>
  );
}
