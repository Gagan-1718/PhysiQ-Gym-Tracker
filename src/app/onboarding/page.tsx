'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, Info } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { useToast } from '@/components/ui/Toast';
import { LogoMark } from '@/components/shell/Logo';
import { send } from '@/lib/client';
import { cn } from '@/lib/format';
import { SPLIT_TEMPLATES } from '@/lib/split-templates';
import { GOALS, type Goal } from '@/types/database';

const STEPS = ['goal', 'body', 'split'] as const;

type HeightUnit = 'cm' | 'ft_in';
type WeightUnit = 'kg' | 'lbs';

function getCombinedGoalSummary(selected: Goal[]): { title: string; blurb: string; surplusText: string } {
  const hasHypertrophy = selected.includes('hypertrophy');
  const hasStrength = selected.includes('strength');
  const hasFatLoss = selected.includes('fat_loss');

  if (hasHypertrophy && hasStrength && hasFatLoss) {
    return {
      title: 'Ultimate Hybrid Athlete',
      blurb: 'Balanced periodization: muscle growth stimulus, heavy compound overload, and lean fat loss.',
      surplusText: 'Maintenance / +100 kcal',
    };
  }
  if (hasHypertrophy && hasStrength) {
    return {
      title: 'Powerbuilding Focus',
      blurb: 'Simultaneous hypertrophy and raw mechanical strength overload on compound lifts.',
      surplusText: '+250 kcal surplus · High protein',
    };
  }
  if (hasHypertrophy && hasFatLoss) {
    return {
      title: 'Body Recomposition',
      blurb: 'Pack on dense muscle while steadily trimming body fat with high protein intake.',
      surplusText: '-100 kcal deficit · 2.2 g/kg protein',
    };
  }
  if (hasStrength && hasFatLoss) {
    return {
      title: 'Strength Cut',
      blurb: 'Preserve 1RM strength and neuromuscular power while burning fat.',
      surplusText: '-300 kcal deficit · High intensity',
    };
  }
  if (hasHypertrophy) {
    return {
      title: 'Pure Hypertrophy',
      blurb: 'Maximal muscle mass accrual with a standard caloric surplus.',
      surplusText: '+300 kcal surplus',
    };
  }
  if (hasStrength) {
    return {
      title: 'Pure Strength',
      blurb: 'Focus on nervous system adaptation and moving maximum weight.',
      surplusText: '+200 kcal surplus',
    };
  }
  if (hasFatLoss) {
    return {
      title: 'Fat Loss',
      blurb: 'Steady caloric deficit while preserving lean muscle mass.',
      surplusText: '-400 kcal deficit',
    };
  }
  return {
    title: 'Maintenance',
    blurb: 'Fuel hard training and maintain steady body composition.',
    surplusText: 'Eat at maintenance (0 kcal)',
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [goals, setGoals] = useState<Goal[]>(['hypertrophy']);
  const [height, setHeight] = useState<number | null>(175);
  const [weight, setWeight] = useState<number | null>(72);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [templateId, setTemplateId] = useState('ppl');
  const [saving, setSaving] = useState(false);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  const toggleGoal = (val: Goal) => {
    if (val === 'maintenance') {
      setGoals(['maintenance']);
      return;
    }
    setGoals((prev) => {
      const withoutMaint = prev.filter((g) => g !== 'maintenance');
      if (withoutMaint.includes(val)) {
        if (withoutMaint.length === 1) return withoutMaint; // keep at least one
        return withoutMaint.filter((g) => g !== val);
      }
      return [...withoutMaint, val];
    });
  };

  async function finish() {
    const template = SPLIT_TEMPLATES.find((t) => t.id === templateId)!;
    setSaving(true);

    // Resolve primary goal for the database schema
    const primaryGoal: Goal = goals.includes('hypertrophy')
      ? 'hypertrophy'
      : goals.includes('strength')
      ? 'strength'
      : goals.includes('fat_loss')
      ? 'fat_loss'
      : 'maintenance';

    try {
      await send('/api/me', 'PATCH', { goal: primaryGoal, height, starting_weight: weight });
      await send('/api/splits', 'POST', { name: template.name, minRestDays: template.minRestDays, days: template.days });
      router.replace('/');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
      setSaving(false);
    }
  }

  const firstName = session?.user?.name?.split(' ')[0];

  // Height conversion helpers for imperial ft/in
  const totalInches = Math.round((height ?? 175) / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  // Weight conversion helpers for imperial lbs
  const weightLbs = weight ? Math.round(weight * 2.20462) : 159;

  const combinedStrategy = getCombinedGoalSummary(goals);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-safe">
      <header className="flex h-14 items-center justify-between">
        {step > 0 ? (
          <button onClick={() => go(-1)} className="press -ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-[17px] text-accent">
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
        ) : (
          <LogoMark size={36} />
        )}
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={cn('h-1.5 rounded-full transition-all duration-300', i === step ? 'w-6 bg-accent' : i < step ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-surface-4')} />
          ))}
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={STEPS[step]}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="pb-6 pt-4"
          >
            {STEPS[step] === 'goal' && (
              <>
                <h1 className="text-large-title">{firstName ? `Hi ${firstName}.` : 'Welcome.'} What’s the goal?</h1>
                <p className="mb-4 mt-2 text-[17px] text-fg-2">
                  Select one or more targets. PhysiQ blends your calories and programming accordingly.
                </p>

                <div className="grid gap-3" role="group" aria-label="Fitness goals">
                  {GOALS.map((g) => {
                    const isSelected = goals.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() => toggleGoal(g.value)}
                        className={cn(
                          'press flex items-center justify-between rounded-2xl border p-4 text-left transition-colors',
                          isSelected ? 'border-accent bg-accent/10' : 'border-line bg-surface-1 hover:bg-surface-2'
                        )}
                      >
                        <span>
                          <span className="block text-headline">{g.label}</span>
                          <span className="text-[15px] text-fg-2">{g.blurb}</span>
                        </span>
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
                            isSelected ? 'bg-accent-solid text-white' : 'border border-surface-4'
                          )}
                        >
                          {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live blended strategy feedback when multiple goals are selected */}
                {goals.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-accent">Combined Strategy</span>
                      <span className="rounded-full bg-accent-solid px-2 py-0.5 text-[11px] font-semibold text-white">
                        {combinedStrategy.surplusText}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-fg">{combinedStrategy.title}</p>
                    <p className="mt-0.5 text-xs text-fg-2">{combinedStrategy.blurb}</p>
                  </motion.div>
                )}
              </>
            )}

            {STEPS[step] === 'body' && (
              <>
                <h1 className="text-large-title">Your body</h1>
                <p className="mb-4 mt-2 text-[17px] text-fg-2">
                  Protein and water targets scale directly with your body weight.
                </p>

                <div className="space-y-5">
                  {/* Height input with cm / ft+in toggle */}
                  <div>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-footnote font-medium text-fg-2">Height</p>
                      <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setHeightUnit('cm')}
                          className={cn(
                            'rounded-md px-2.5 py-1 font-semibold transition-colors',
                            heightUnit === 'cm' ? 'bg-surface-4 text-fg' : 'text-fg-3 hover:text-fg-2'
                          )}
                        >
                          cm
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeightUnit('ft_in')}
                          className={cn(
                            'rounded-md px-2.5 py-1 font-semibold transition-colors',
                            heightUnit === 'ft_in' ? 'bg-surface-4 text-fg' : 'text-fg-3 hover:text-fg-2'
                          )}
                        >
                          ft / in
                        </button>
                      </div>
                    </div>

                    {heightUnit === 'cm' ? (
                      <Stepper label="height" value={height} onChange={setHeight} step={1} min={100} max={250} unit="cm" />
                    ) : (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="mb-1 text-caption text-fg-3">Feet</p>
                            <Stepper
                              label="height feet"
                              value={feet}
                              onChange={(f) => {
                                const val = f ?? 5;
                                setHeight(Math.round((val * 12 + inches) * 2.54));
                              }}
                              step={1}
                              min={3}
                              max={7}
                              unit="ft"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-caption text-fg-3">Inches</p>
                            <Stepper
                              label="height inches"
                              value={inches}
                              onChange={(inc) => {
                                const val = inc ?? 0;
                                setHeight(Math.round((feet * 12 + val) * 2.54));
                              }}
                              step={1}
                              min={0}
                              max={11}
                              unit="in"
                            />
                          </div>
                        </div>
                        <p className="text-right text-caption text-fg-3">≈ {height} cm ({feet}&apos;{inches}&quot;)</p>
                      </div>
                    )}
                  </div>

                  {/* Weight input with kg / lbs toggle */}
                  <div>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-footnote font-medium text-fg-2">Weight</p>
                      <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setWeightUnit('kg')}
                          className={cn(
                            'rounded-md px-2.5 py-1 font-semibold transition-colors',
                            weightUnit === 'kg' ? 'bg-surface-4 text-fg' : 'text-fg-3 hover:text-fg-2'
                          )}
                        >
                          kg
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeightUnit('lbs')}
                          className={cn(
                            'rounded-md px-2.5 py-1 font-semibold transition-colors',
                            weightUnit === 'lbs' ? 'bg-surface-4 text-fg' : 'text-fg-3 hover:text-fg-2'
                          )}
                        >
                          lbs
                        </button>
                      </div>
                    </div>

                    {weightUnit === 'kg' ? (
                      <Stepper label="weight" value={weight} onChange={setWeight} step={0.5} min={30} max={300} unit="kg" decimals />
                    ) : (
                      <div className="space-y-1.5">
                        <Stepper
                          label="weight in lbs"
                          value={weightLbs}
                          onChange={(lbs) => {
                            if (lbs === null) setWeight(null);
                            else setWeight(Math.round((lbs / 2.20462) * 10) / 10);
                          }}
                          step={1}
                          min={66}
                          max={660}
                          unit="lbs"
                        />
                        <p className="text-right text-caption text-fg-3">≈ {weight?.toFixed(1)} kg ({weightLbs} lbs)</p>
                      </div>
                    )}
                  </div>

                  {/* Dynamic target cards with metric/imperial breakdown */}
                  {weight && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-line bg-surface-1 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-footnote text-fg-3">Protein / day</p>
                            <span className="text-[11px] font-semibold text-protein">
                              {weightUnit === 'kg' ? '2.0 g/kg' : '~0.91 g/lb'}
                            </span>
                          </div>
                          <p className="tabular mt-1 font-display text-3xl font-extrabold text-protein">
                            {Math.round(weight * 2)}
                            <span className="text-base text-fg-2"> g</span>
                          </p>
                        </div>
                        <div className="rounded-2xl border border-line bg-surface-1 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-footnote text-fg-3">Water / day</p>
                            <span className="text-[11px] font-semibold text-water">
                              {weightUnit === 'kg' ? '40 ml/kg' : `~${Math.round((weight * 40) / 29.5735)} fl oz`}
                            </span>
                          </div>
                          <p className="tabular mt-1 font-display text-3xl font-extrabold text-water">
                            {(Math.round((weight * 40) / 50) * 0.05).toFixed(1)}
                            <span className="text-base text-fg-2"> L</span>
                          </p>
                        </div>
                      </div>

                      {/* Educational explanation of what these metrics are */}
                      <div className="flex gap-2.5 rounded-xl border border-line/60 bg-surface-1/70 p-3 text-xs leading-relaxed text-fg-3">
                        <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold text-fg-2">How PhysiQ calculates these targets:</p>
                          <p>
                            • <strong className="text-fg-2">Protein (2 g/kg or ~0.9 g/lb):</strong> Gold-standard sports science dose to maximize muscle protein synthesis and prevent catabolism.
                          </p>
                          <p>
                            • <strong className="text-fg-2">Water (40 ml/kg):</strong> Preserves blood volume, joint lubrication, intracellular hydration, and maximum gym power output.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {STEPS[step] === 'split' && (
              <>
                <h1 className="text-large-title">Pick your split</h1>
                <p className="mb-6 mt-2 text-[17px] text-fg-2">No fixed weekdays. Miss a day and PhysiQ just picks what’s most overdue.</p>
                <div className="grid gap-3" role="radiogroup">
                  {SPLIT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={templateId === t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={cn(
                        'press rounded-2xl border p-4 text-left transition-colors',
                        templateId === t.id ? 'border-accent bg-accent/10' : 'border-line bg-surface-1 hover:bg-surface-2'
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-headline">{t.name}</span>
                        <span className="text-footnote text-fg-3">{t.days.length} days</span>
                      </span>
                      <span className="mt-0.5 block text-[15px] text-fg-2">{t.blurb}</span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {t.days.map((d) => (
                          <span key={d.label} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-fg-2">
                            {d.label}
                          </span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="pb-safe sticky bottom-0 bg-gradient-to-t from-black via-black to-transparent pt-6">
        {step < STEPS.length - 1 ? (
          <Button size="lg" block onClick={() => go(1)} disabled={STEPS[step] === 'body' && (!height || !weight)}>
            Continue
          </Button>
        ) : (
          <Button size="lg" block onClick={finish} loading={saving}>
            Start training
          </Button>
        )}
      </div>
    </div>
  );
}
