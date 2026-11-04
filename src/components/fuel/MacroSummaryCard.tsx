'use client';

import { Check, Flame } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Rings } from '@/components/ui/Rings';
import { kg } from '@/lib/format';
import type { DailyFuel } from '@/types/database';

const CAL_RING = { color: '#FF4B2B', deep: '#B01A0E' };
const PRO_RING = { color: '#EDEDF0', deep: '#8B8B93' };
const CARB_RING = { color: '#3CC8F2', deep: '#0E7FA0' };

function MacroBar({
  label,
  logged,
  target,
  color,
}: {
  label: string;
  logged: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((logged / target) * 100)) : 0;
  const hit = target > 0 && logged >= target;
  return (
    <div className="min-w-0">
      {/* Label above the numbers: side by side, three columns on a phone ran them together ("154gCarbs") */}
      <div className="text-footnote">
        <p className="font-semibold text-fg-2">{label}</p>
        <p className="tabular font-semibold text-fg">
          {Math.round(logged)}
          <span className="text-fg-3">/{target}g</span>
        </p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="mt-1 text-[11px] font-medium text-fg-3">
        {hit ? 'Target hit' : `${Math.max(0, Math.round(target - logged))}g left`}
      </p>
    </div>
  );
}

export function MacroSummaryCard({ fuel }: { fuel: DailyFuel | undefined }) {
  const calLogged = fuel?.calories_logged ?? 0;
  const calTarget = fuel?.calorie_target ?? 2500;
  const proLogged = fuel?.protein_logged_g ?? 0;
  const proTarget = fuel?.protein_target_g ?? 150;
  const carbLogged = fuel?.carbs_logged_g ?? 0;
  const carbTarget = fuel?.carbs_target_g ?? 260;
  const fatLogged = fuel?.fat_logged_g ?? 0;
  const fatTarget = fuel?.fat_target_g ?? 70;

  const calRemaining = Math.max(0, calTarget - calLogged);
  const calProgress = calTarget > 0 ? calLogged / calTarget : 0;
  const proProgress = proTarget > 0 ? proLogged / proTarget : 0;
  const carbProgress = carbTarget > 0 ? carbLogged / carbTarget : 0;

  return (
    <Card aria-label="Daily nutrition summary">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="shrink-0">
          <Rings
            size={126}
            stroke={13}
            gap={3}
            rings={[
              { ...CAL_RING, progress: calProgress, label: 'Calories' },
              { ...PRO_RING, progress: proProgress, label: 'Protein' },
              { ...CARB_RING, progress: carbProgress, label: 'Carbs' },
            ]}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-train/15 px-2.5 py-0.5 text-xs font-semibold text-train">
              <Flame className="h-3.5 w-3.5" /> Daily Energy
            </span>
            {calLogged >= calTarget && calTarget > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-protein/15 px-2 py-0.5 text-xs font-bold text-protein">
                <Check className="h-3 w-3" /> Goal reached
              </span>
            )}
          </div>

          <p className="mt-2 font-display text-[30px] font-extrabold leading-none text-fg sm:text-[34px]">
            {calLogged.toLocaleString()}
            <span className="ml-1 text-[16px] font-bold text-fg-3">
              / {calTarget.toLocaleString()} kcal
            </span>
          </p>

          <p className="mt-1.5 text-footnote text-fg-2">
            {calRemaining > 0
              ? `${calRemaining.toLocaleString()} kcal remaining today`
              : `${(calLogged - calTarget).toLocaleString()} kcal over target`}
            {fuel?.body_weight_kg ? ` · scaled for ${kg(fuel.body_weight_kg)} kg` : ''}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <MacroBar label="Protein" logged={proLogged} target={proTarget} color="#EDEDF0" />
        <MacroBar label="Carbs" logged={carbLogged} target={carbTarget} color="#3CC8F2" />
        <MacroBar label="Fat" logged={fatLogged} target={fatTarget} color="#FF9F0A" />
      </div>
    </Card>
  );
}
