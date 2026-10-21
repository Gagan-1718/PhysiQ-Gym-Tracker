'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MiniRing } from '@/components/ui/Rings';
import { useToast } from '@/components/ui/Toast';
import { clock } from '@/lib/format';
import { useCountdown } from '@/lib/use-elapsed';

let audio: AudioContext | null = null;

/** Call from a tap handler: browsers only allow audio after a user gesture. */
export function primeAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio?.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function chime() {
  if (!audio) return;
  const now = audio.currentTime;
  [0, 0.18].forEach((offset, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 0 ? 880 : 1320;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    osc.connect(gain).connect(audio!.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.18);
  });
}

interface RestTimerProps {
  endsAt: number | null;
  total: number;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
}

/** Floating rest countdown; vibrates and chimes when rest is over. */
export function RestTimer({ endsAt, total, onAdjust, onSkip }: RestTimerProps) {
  const toast = useToast();
  const left = useCountdown(endsAt);
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (endsAt === null || left > 0 || firedFor.current === endsAt) return;
    firedFor.current = endsAt;
    navigator.vibrate?.([220, 120, 220]);
    chime();
    toast('Rest over. Next set!');
    onSkip();
  }, [left, endsAt, onSkip, toast]);

  return (
    <AnimatePresence>
      {endsAt !== null && left > 0 && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="pb-safe fixed inset-x-0 bottom-0 z-40 px-3 md:left-64"
          role="timer"
          aria-label={`Rest ${clock(left)} remaining`}
        >
          <div className="mx-auto mb-2 flex max-w-xl items-center gap-3 rounded-[1.4rem] border border-line bg-surface-2/95 p-2.5 pl-3 shadow-2xl shadow-black backdrop-blur-xl">
            <MiniRing progress={total ? left / total : 0} color="#2DD4F5" size={40} stroke={5} />
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow uppercase text-fg-3">Rest</p>
              <p className="tabular font-round text-[26px] font-extrabold leading-none text-water">{clock(left)}</p>
            </div>
            <button onClick={() => onAdjust(-15)} className="press h-11 rounded-xl bg-surface-3 px-3 text-[15px] font-semibold text-fg-2 hover:text-fg">
              −15
            </button>
            <button onClick={() => onAdjust(15)} className="press h-11 rounded-xl bg-surface-3 px-3 text-[15px] font-semibold text-fg-2 hover:text-fg">
              +15
            </button>
            <button onClick={onSkip} className="press h-11 rounded-xl bg-water px-4 text-[15px] font-bold text-black">
              Skip
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
