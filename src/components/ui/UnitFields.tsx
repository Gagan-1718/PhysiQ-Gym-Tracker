'use client';

import { useState } from 'react';
import { Stepper } from '@/components/ui/Stepper';
import { cn } from '@/lib/format';

/** The database always stores metric (cm, kg). Imperial is only a way of typing it in. */
const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.20462;
const HEIGHT_CM = { min: 100, max: 250 };
const WEIGHT_KG = { min: 30, max: 300 };

const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, n));

export function UnitToggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-surface-3 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-2.5 py-1 font-semibold transition-colors', value === o.value ? 'bg-surface-4 text-fg' : 'text-fg-2 hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Height in cm, typed either as cm or as feet + inches. */
export function HeightField({ value, onChange, size = 'lg' }: { value: number | null; onChange: (cm: number | null) => void; size?: 'lg' | 'md' }) {
  const [unit, setUnit] = useState<'cm' | 'ft'>('cm');
  const totalInches = Math.round((value ?? 175) / CM_PER_INCH);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const setImperial = (ft: number, inch: number) => onChange(clamp(Math.round((ft * 12 + inch) * CM_PER_INCH), HEIGHT_CM));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-footnote font-medium text-fg-2">Height</p>
        <UnitToggle label="Height unit" value={unit} onChange={setUnit} options={[{ value: 'cm', label: 'cm' }, { value: 'ft', label: 'ft / in' }]} />
      </div>
      {unit === 'cm' ? (
        <Stepper label="height" value={value} onChange={onChange} step={1} min={HEIGHT_CM.min} max={HEIGHT_CM.max} unit="cm" size={size} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="height feet" value={feet} onChange={(f) => setImperial(f ?? feet, inches)} step={1} min={3} max={8} unit="ft" size="md" />
            <Stepper label="height inches" value={inches} onChange={(i) => setImperial(feet, i ?? 0)} step={1} min={0} max={11} unit="in" size="md" />
          </div>
          <p className="mt-1.5 text-right text-caption text-fg-3">Saved as {value ?? '–'} cm</p>
        </>
      )}
    </div>
  );
}

/** Body weight in kg, typed either as kg or as pounds. */
export function WeightField({ value, onChange }: { value: number | null; onChange: (kg: number | null) => void }) {
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const pounds = value === null ? null : Math.round(value * LB_PER_KG);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-footnote font-medium text-fg-2">Weight</p>
        <UnitToggle label="Weight unit" value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
      </div>
      {unit === 'kg' ? (
        <Stepper label="weight" value={value} onChange={onChange} step={0.5} min={WEIGHT_KG.min} max={WEIGHT_KG.max} unit="kg" decimals />
      ) : (
        <>
          <Stepper
            label="weight in pounds"
            value={pounds}
            onChange={(lb) => onChange(lb === null ? null : clamp(Math.round((lb / LB_PER_KG) * 10) / 10, WEIGHT_KG))}
            step={1}
            min={Math.ceil(WEIGHT_KG.min * LB_PER_KG)}
            max={Math.floor(WEIGHT_KG.max * LB_PER_KG)}
            unit="lb"
          />
          <p className="mt-1.5 text-right text-caption text-fg-3">Saved as {value?.toFixed(1) ?? '–'} kg</p>
        </>
      )}
    </div>
  );
}
