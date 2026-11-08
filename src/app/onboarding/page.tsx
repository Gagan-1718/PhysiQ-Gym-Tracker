'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, Info } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { HeightField, WeightField } from '@/components/ui/UnitFields';
import { useToast } from '@/components/ui/Toast';
import { LogoMark } from '@/components/shell/Logo';
import { send } from '@/lib/client';
import { cn, localDateISO } from '@/lib/format';
import { blendGoals } from '@/lib/goals';
import { SPLIT_TEMPLATES } from '@/lib/split-templates';
import { GOALS, type Goal } from '@/types/database';

const STEPS = ['goal', 'body', 'split'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [goals, setGoals] = useState<Goal[]>(['hypertrophy']);
  const [height, setHeight] = useState<number | null>(175);
  const [weight, setWeight] = useState<number | null>(72);
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

    try {
      await send('/api/me', 'PATCH', { goal: goalPlan.goal, height, starting_weight: weight });
      if (weight) {
        // The first body-weight entry, so Progress → Body has a starting point
        await send('/api/body', 'POST', { date: localDateISO(), weight }).catch(() => {});
      }
      await send('/api/splits', 'POST', { name: template.name, minRestDays: template.minRestDays, days: template.days });
      router.replace('/');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
      setSaving(false);
    }
  }

  const firstName = session?.user?.name?.split(' ')[0];

  const goalPlan = blendGoals(goals);

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
                  Pick one or more. This sets your daily calories, and you can change it anytime in Profile.
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

                {goals.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4"
                    aria-live="polite"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-headline">{goalPlan.title}</p>
                      <span className="rounded-full bg-accent-solid px-2.5 py-0.5 text-xs font-semibold text-white">{goalPlan.calories}</span>
                    </div>
                    <p className="mt-1 text-[15px] text-fg-2">{goalPlan.blurb}</p>
                  </motion.div>
                )}
              </>
            )}

            {STEPS[step] === 'body' && (
              <>
                <h1 className="text-large-title">Your body</h1>
                <p className="mb-4 mt-2 text-[17px] text-fg-2">
                  Protein and water targets follow your body weight: 2 g and 40 ml per kg.
                </p>

                <div className="space-y-5">
                  <HeightField value={height} onChange={setHeight} />
                  <WeightField value={weight} onChange={setWeight} />

                  {weight && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-line bg-surface-1 p-4">
                          <p className="text-footnote text-fg-3">Protein / day</p>
                          <p className="tabular mt-1 font-display text-3xl font-extrabold text-protein">
                            {Math.round(weight * 2)}
                            <span className="text-base text-fg-2"> g</span>
                          </p>
                        </div>
                        <div className="rounded-2xl border border-line bg-surface-1 p-4">
                          <p className="text-footnote text-fg-3">Water / day</p>
                          <p className="tabular mt-1 font-display text-3xl font-extrabold text-water">
                            {(Math.round((weight * 40) / 50) * 0.05).toFixed(1)}
                            <span className="text-base text-fg-2"> L</span>
                          </p>
                        </div>
                      </div>

                      <p className="flex gap-2 px-1 text-footnote text-fg-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        2 g of protein per kg supports muscle growth and recovery; 40 ml of water per kg keeps you hydrated through training.
                      </p>
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
