'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Feedback';
import { Stepper } from '@/components/ui/Stepper';
import { useToast } from '@/components/ui/Toast';
import { LineChart } from '@/components/charts/LineChart';
import { send } from '@/lib/client';
import { cn, kg, localDateISO, shortDate } from '@/lib/format';
import type { BodyMeasurement } from '@/types/database';

export function Body() {
  const toast = useToast();
  const { data, mutate } = useSWR<BodyMeasurement[]>('/api/body');
  const { mutate: mutateAll } = useSWRConfig();
  const latest = [...(data ?? [])].reverse().find((m) => m.weight !== null);
  const [weight, setWeight] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [circ, setCirc] = useState<{ waist: number | null; chest: number | null; arms: number | null }>({ waist: null, chest: null, arms: null });
  const [saving, setSaving] = useState(false);
  const shownWeight = weight ?? latest?.weight ?? null;

  async function save() {
    setSaving(true);
    try {
      await send('/api/body', 'POST', { date: localDateISO(), weight: shownWeight, ...(more ? circ : {}) });
      toast('Measurement saved');
      setWeight(null);
      setCirc({ waist: null, chest: null, arms: null });
      await mutate();
      // Today's fuel targets follow the new weight (sp_ensure_daily_fuel refreshes today)
      void mutateAll((key) => typeof key === 'string' && key.startsWith('/api/fuel'));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await send(`/api/body/${id}`, 'DELETE');
      await mutate();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
    }
  }

  if (!data) return <Skeleton className="h-96" />;
  const weights = data.filter((m) => m.weight !== null);
  const change = weights.length > 1 ? Math.round((weights[weights.length - 1].weight! - weights[0].weight!) * 10) / 10 : null;

  return (
    <>
      <Card>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-footnote text-fg-3">Body weight</p>
            <p className="font-round text-[44px] font-extrabold leading-none">
              {latest ? kg(latest.weight) : '–'}
              <span className="text-lg text-fg-3"> kg</span>
            </p>
          </div>
          {change !== null && (
            <p className="mb-1 rounded-full bg-water/15 px-2.5 py-1 text-footnote font-semibold text-water">
              {change >= 0 ? '+' : ''}
              {change} kg since {shortDate(weights[0].recorded_on)}
            </p>
          )}
        </div>
        {weights.length > 0 && (
          <div className="mt-4">
            <LineChart
              title="Body weight over time"
              color="#2DD4F5"
              unit="kg"
              data={weights.map((m) => ({ key: m.recorded_on, date: shortDate(m.recorded_on), value: m.weight! }))}
            />
          </div>
        )}
      </Card>

      <SectionHeader title="Log today" />
      <Card>
        <p className="mb-2 text-footnote font-medium text-fg-2">Weight</p>
        <Stepper label="body weight" value={shownWeight} onChange={setWeight} step={0.1} min={30} max={300} unit="kg" decimals />
        <button onClick={() => setMore((m) => !m)} className="-mb-2 mt-2 flex min-h-[2.75rem] items-center gap-1 text-[15px] font-medium text-fg-2 hover:text-fg" aria-expanded={more}>
          Measurements <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} />
        </button>
        {more && (
          <div className="mt-3 grid gap-3">
            {(['waist', 'chest', 'arms'] as const).map((k) => (
              <div key={k}>
                <p className="mb-1.5 text-footnote font-medium capitalize text-fg-2">{k}</p>
                <Stepper size="md" label={k} value={circ[k]} onChange={(v) => setCirc((c) => ({ ...c, [k]: v }))} step={0.5} min={15} max={200} unit="cm" decimals />
              </div>
            ))}
          </div>
        )}
        <Button block size="lg" className="mt-5" loading={saving} disabled={shownWeight === null} onClick={save}>
          Save
        </Button>
        <p className="mt-2 text-center text-footnote text-fg-3">One entry per day; saving again updates today. Fuel targets follow your weight.</p>
      </Card>

      {data.length > 0 && (
        <>
          <SectionHeader title="Entries" />
          <ul className="overflow-hidden rounded-card border border-line bg-surface-1">
            {[...data].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold">{m.weight !== null ? `${kg(m.weight)} kg` : '–'}</p>
                  <p className="truncate text-footnote text-fg-3">
                    {shortDate(m.recorded_on)}
                    {m.waist !== null && ` · waist ${kg(m.waist)}`}
                    {m.chest !== null && ` · chest ${kg(m.chest)}`}
                    {m.arms !== null && ` · arms ${kg(m.arms)}`}
                  </p>
                </div>
                <button onClick={() => remove(m.id)} aria-label={`Delete entry from ${shortDate(m.recorded_on)}`} className="press rounded-full p-2 text-fg-3 hover:bg-surface-2 hover:text-train">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
