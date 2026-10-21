'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft } from 'lucide-react';
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

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [height, setHeight] = useState<number | null>(175);
  const [weight, setWeight] = useState<number | null>(72);
  const [templateId, setTemplateId] = useState('ppl');
  const [saving, setSaving] = useState(false);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  async function finish() {
    const template = SPLIT_TEMPLATES.find((t) => t.id === templateId)!;
    setSaving(true);
    try {
      await send('/api/me', 'PATCH', { goal, height, starting_weight: weight });
      await send('/api/splits', 'POST', { name: template.name, minRestDays: template.minRestDays, days: template.days });
      router.replace('/');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
      setSaving(false);
    }
  }

  const firstName = session?.user?.name?.split(' ')[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-safe">
      <header className="flex h-14 items-center justify-between">
        {step > 0 ? (
          <button onClick={() => go(-1)} className="press -ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-[17px] text-accent">
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
        ) : (
          <LogoMark size={28} />
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
                <p className="mb-6 mt-2 text-[17px] text-fg-2">This sets your daily calories. You can change it anytime.</p>
                <div className="grid gap-3" role="radiogroup">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      role="radio"
                      aria-checked={goal === g.value}
                      onClick={() => setGoal(g.value)}
                      className={cn(
                        'press flex items-center justify-between rounded-2xl border p-4 text-left transition-colors',
                        goal === g.value ? 'border-accent bg-accent/10' : 'border-line bg-surface-1 hover:bg-surface-2'
                      )}
                    >
                      <span>
                        <span className="block text-headline">{g.label}</span>
                        <span className="text-[15px] text-fg-2">{g.blurb}</span>
                      </span>
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', goal === g.value ? 'bg-accent text-black' : 'border border-surface-4')}>
                        {goal === g.value && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {STEPS[step] === 'body' && (
              <>
                <h1 className="text-large-title">Your body</h1>
                <p className="mb-6 mt-2 text-[17px] text-fg-2">Protein and water targets scale with your weight: 2 g/kg and 40 ml/kg.</p>
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 px-1 text-footnote font-medium text-fg-2">Height</p>
                    <Stepper label="height" value={height} onChange={setHeight} step={1} min={100} max={250} unit="cm" />
                  </div>
                  <div>
                    <p className="mb-2 px-1 text-footnote font-medium text-fg-2">Weight</p>
                    <Stepper label="weight" value={weight} onChange={setWeight} step={0.5} min={30} max={300} unit="kg" decimals />
                  </div>
                  {weight && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-surface-1 p-4">
                        <p className="text-footnote text-fg-3">Protein / day</p>
                        <p className="tabular mt-1 font-round text-3xl font-extrabold text-protein">
                          {Math.round(weight * 2)}
                          <span className="text-base text-fg-2"> g</span>
                        </p>
                      </div>
                      <div className="rounded-2xl bg-surface-1 p-4">
                        <p className="text-footnote text-fg-3">Water / day</p>
                        <p className="tabular mt-1 font-round text-3xl font-extrabold text-water">
                          {(Math.round((weight * 40) / 50) * 0.05).toFixed(1)}
                          <span className="text-base text-fg-2"> L</span>
                        </p>
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
