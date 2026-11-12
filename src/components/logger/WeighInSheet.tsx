'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { WeightPicker } from './WeightPicker';

/**
 * Body weight before the workout starts or after it ends (workout_sessions.weight_before /
 * weight_after, migration 004). Starts at the last known weight; Skip saves nothing.
 */
export function WeighInSheet({
  when,
  initial,
  onDone,
  onClose,
}: {
  /** null = closed */
  when: 'before' | 'after' | null;
  initial: number | null;
  /** The weight, or null when skipped */
  onDone: (kg: number | null) => void;
  onClose: () => void;
}) {
  const [kg, setKg] = useState<number | null>(initial);
  // Each time the sheet opens it starts from the latest known weight
  useEffect(() => {
    if (when) setKg(initial);
  }, [when, initial]);

  return (
    <Sheet
      open={when !== null}
      onClose={onClose}
      title={when === 'after' ? 'Weigh out' : 'Weigh in'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="w-28 shrink-0" onClick={() => onDone(null)}>
            Skip
          </Button>
          <Button size="lg" className="flex-1" disabled={kg === null} onClick={() => onDone(kg)}>
            Continue
          </Button>
        </div>
      }
    >
      <p className="flex items-center gap-2 text-[15px] text-fg-2">
        <Scale className="h-4 w-4 shrink-0 text-water" />
        {when === 'after' ? 'Step on the scale again. What do you weigh now?' : 'Before you start: what do you weigh?'}
      </p>
      <WeightPicker
        className="mt-4 h-72"
        value={kg}
        onChange={setKg}
        label={when === 'after' ? 'body weight after' : 'body weight before'}
        unit="kg body weight"
        step={0.1}
        min={30}
        max={300}
        major={1}
      />
    </Sheet>
  );
}
