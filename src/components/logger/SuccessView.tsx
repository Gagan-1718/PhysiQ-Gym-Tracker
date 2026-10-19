'use client';

import { motion } from 'framer-motion';
import { Check, Database, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { clock, compact, kg } from '@/lib/format';

export interface SaveResult {
  sessionId: number;
  totalVolume: number;
  workingSets: number;
  prs: { exercise_id: number; exercise_name: string; weight: number; reps: number; estimated_1rm: number }[];
  warnings: string[];
}

/** Shown after the transaction commits. Every number here was read back from MySQL. */
export function SuccessView({ result, bodyPart, elapsed, firstTimers, onDone }: { result: SaveResult; bodyPart: string; elapsed: number; firstTimers: Set<number>; onDone: () => void }) {
  const realPrs = result.prs.filter((p) => !firstTimers.has(p.exercise_id));
  const firsts = result.prs.filter((p) => firstTimers.has(p.exercise_id));

  return (
    <div className="flex min-h-[80dvh] flex-col items-center pt-10 text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 180 }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-black shadow-[0_0_80px_-10px_rgba(182,242,59,0.6)]"
      >
        <Check className="h-12 w-12" strokeWidth={3.2} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="w-full">
        <h1 className="mt-6 text-large-title">{bodyPart} done</h1>
        <p className="mt-1 text-[17px] text-fg-2">Saved. Your next session adapts to this one.</p>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {[
            ['Volume', `${compact(result.totalVolume)}`, 'kg', 'text-train'],
            ['Sets', String(result.workingSets), '', 'text-accent'],
            ['Time', clock(elapsed), '', 'text-water'],
          ].map(([label, value, unit, color]) => (
            <div key={label} className="rounded-2xl bg-surface-1 p-4">
              <p className="text-footnote text-fg-3">{label}</p>
              <p className={`tabular mt-1 font-round text-2xl font-extrabold ${color}`}>
                {value}
                {unit && <span className="text-sm text-fg-2"> {unit}</span>}
              </p>
            </div>
          ))}
        </div>

        {realPrs.length > 0 && (
          <div className="mt-6 text-left">
            <p className="mb-2 px-1 text-headline">New personal records</p>
            <div className="space-y-2">
              {realPrs.map((p, i) => (
                <motion.div
                  key={p.exercise_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] p-4"
                >
                  <Trophy className="h-6 w-6 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.exercise_name}</p>
                    <p className="text-footnote text-fg-2">
                      {kg(p.weight)} kg × {p.reps} · e1RM {kg(p.estimated_1rm)} kg
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        {firsts.length > 0 && (
          <p className="mt-4 text-[15px] text-fg-2">
            First records set for {firsts.map((p) => p.exercise_name).join(', ')}.
          </p>
        )}

        {result.warnings.map((w) => (
          <p key={w} className="mt-4 rounded-2xl bg-recover/10 p-3 text-[15px] text-recover">
            {w}
          </p>
        ))}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-footnote text-fg-3">
          <Database className="h-3.5 w-3.5" /> One MySQL transaction · volume and PRs by triggers
        </p>
      </motion.div>
      <div className="mt-auto w-full pt-8">
        <Button size="lg" block onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
