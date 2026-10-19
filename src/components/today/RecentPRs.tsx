import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { kg, relativeDay } from '@/lib/format';
import type { PersonalRecord } from '@/types/database';

export function RecentPRs({ prs }: { prs: PersonalRecord[] }) {
  return (
    <ul className="overflow-hidden rounded-card border border-line bg-surface-1">
      {prs.map((p) => (
        <li key={p.exercise_id} className="border-b border-line last:border-0">
          <Link href={`/history/${p.session_id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Trophy className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold">{p.exercise_name}</p>
              <p className="text-footnote text-fg-3">
                {relativeDay(p.achieved_on)} · e1RM {kg(p.estimated_1rm)} kg
              </p>
            </div>
            <p className="font-round text-lg font-extrabold">
              {kg(p.weight)}
              <span className="text-sm text-fg-3"> × {p.reps}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
