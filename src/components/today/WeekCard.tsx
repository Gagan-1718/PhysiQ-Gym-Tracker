'use client';

import { ColumnChart } from '@/components/charts/ColumnChart';
import { Card } from '@/components/ui/Card';
import { MONTHS, compact, parseLocalDate } from '@/lib/format';
import type { WeeklySummary } from '@/types/database';

/** Last 8 ISO weeks, filling weeks without training with zeros. */
export function lastWeeks(weeks: WeeklySummary[], thisWeekStart: string, count = 8) {
  const byStart = new Map(weeks.map((w) => [w.week_start, w]));
  const start = parseLocalDate(thisWeekStart);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() - (count - 1 - i) * 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const w = byStart.get(iso);
    return {
      key: iso,
      label: i === count - 1 ? 'Now' : `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      value: w ? Math.round(w.total_volume) : 0,
      detail: w ? `${w.sessions_completed} sessions · ${w.working_sets} sets` : 'No training',
      highlight: i === count - 1,
    };
  });
}

export function WeekCard({ weeks, thisWeekStart, thisWeek }: { weeks: WeeklySummary[]; thisWeekStart: string; thisWeek: WeeklySummary | null }) {
  const stats = [
    ['Volume', thisWeek ? compact(thisWeek.total_volume) : '0', 'kg'],
    ['Sets', String(thisWeek?.working_sets ?? 0), ''],
    ['Time', String(thisWeek?.minutes_trained ?? 0), 'min'],
  ];
  return (
    <Card>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value, unit]) => (
          <div key={label}>
            <p className="text-footnote text-fg-3">{label}</p>
            <p className="font-round text-2xl font-extrabold">
              {value}
              {unit && <span className="text-sm font-bold text-fg-3"> {unit}</span>}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-1 mt-5 text-footnote font-medium text-fg-2">Weekly volume, last 8 weeks</p>
      <ColumnChart data={lastWeeks(weeks, thisWeekStart)} color="#FA2D55" unit="kg" height={140} title="Training volume per week, last 8 weeks" />
    </Card>
  );
}
