'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * First-login app tour. Q, the PhysiQ coach (design/coach-poster.png, cut out), pops up and chats with the new member:
 * one short line per feature, the screen dimmed around the part of the app being shown,
 * and the member answers by tapping a reply. Finishing or skipping calls onDone, which
 * stores users.tour_completed_at (migration 004) so the tour shows only once.
 *
 * Targets are elements with a data-tour attribute (Today's cards, the tab bar / sidebar links).
 */
interface Step {
  /** data-tour value to spotlight; none = the whole screen dims */
  target?: string;
  say: string;
  reply: string;
}

const steps = (name: string | null): Step[] => [
  { say: `Hey${name ? ` ${name}` : ''}! I'm Q, your PhysiQ coach.`, reply: 'Hi Q!' },
  { target: 'up-next', say: "This is your next workout. I pick what's ready to train.", reply: 'Smart' },
  { target: 'up-next', say: "Tap Start. I'll weigh you in, then guide every set.", reply: 'Then?' },
  { target: 'nav-train', say: 'Pick a weight, watch the move, tap Done. Repeat.', reply: 'Easy' },
  { target: 'recovery', say: 'Sore muscles get time off. I track recovery for you.', reply: 'Nice' },
  { target: 'nav-fuel', say: 'Log meals and water here. I do the protein math.', reply: 'Got it' },
  { target: 'nav-progress', say: 'PRs, lifts and weigh-ins. All on graphs.', reply: 'Love it' },
  { say: "That's the tour. Now go lift something heavy!", reply: "Let's go 💪" },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8; // room around the spotlighted element

/** The visible element for a data-tour value (the tab bar on phones, the sidebar on laptops) */
function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function AppTour({ name, onDone }: { name: string | null; onDone: () => void }) {
  const reduce = useReducedMotion();
  const script = useRef(steps(name)).current;
  const [i, setI] = useState(0);
  // How much of line i is on screen (kept per line, so a new line never starts "fully typed")
  const [progress, setProgress] = useState({ i: 0, n: 0 });
  const [echo, setEcho] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vh, setVh] = useState(800);
  const replyRef = useRef<HTMLButtonElement>(null);
  const step = script[i];
  const last = i === script.length - 1;
  const typed = progress.i === i ? progress.n : 0;
  const fullyTyped = typed >= step.say.length;
  const finishTyping = () => setProgress({ i, n: step.say.length });

  // Typewriter: a character every 22 ms (all at once for reduced motion)
  useEffect(() => {
    if (reduce) {
      setProgress({ i, n: step.say.length });
      return;
    }
    const t = setInterval(
      () => setProgress((p) => (p.i !== i ? { i, n: 1 } : p.n >= step.say.length ? p : { i, n: p.n + 1 })),
      22
    );
    return () => clearInterval(t);
  }, [i, step.say, reduce]);

  useEffect(() => {
    if (fullyTyped) replyRef.current?.focus({ preventScroll: true });
  }, [fullyTyped, i]);

  // Follow the spotlighted element (it may still be loading, scrolling or resizing)
  useEffect(() => {
    let scrolled = false;
    const track = () => {
      setVh(window.innerHeight);
      const el = step.target ? findTarget(step.target) : null;
      if (!el) return setRect(null);
      if (!scrolled) {
        scrolled = true;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    track();
    const t = setInterval(track, 120);
    return () => clearInterval(t);
  }, [step.target, reduce]);

  // The page behind stays put; Escape skips the tour
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  const answer = useCallback(() => {
    if (echo) return;
    navigator.vibrate?.(10);
    setEcho(step.reply);
    setTimeout(
      () => {
        setEcho(null);
        if (last) onDone();
        else setI((n) => n + 1);
      },
      reduce ? 150 : 550
    );
  }, [echo, step.reply, last, onDone, reduce]);

  // Q talks from the top when the spotlight is low on the screen (the tab bar), else from the bottom
  const atTop = rect !== null && rect.top + rect.height / 2 > vh * 0.5;
  const hole = rect ?? { top: vh / 2, left: typeof window === 'undefined' ? 0 : window.innerWidth / 2, width: 0, height: 0 };

  return (
    <div role="dialog" aria-modal="true" aria-label="App tour with Q, your coach" className="fixed inset-0 z-[60]">
      {/* Dim everything except the spotlight (a huge shadow around a transparent hole) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl"
        initial={false}
        animate={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        transition={reduce ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 260 }}
        style={{ boxShadow: '0 0 0 200vmax rgba(0,0,0,0.78)' }}
      >
        {rect && <span className="absolute inset-0 rounded-2xl ring-2 ring-accent motion-safe:animate-pulse" />}
      </motion.div>
      {/* Taps outside the conversation finish the typing, nothing else */}
      <div aria-hidden className="absolute inset-0" onClick={finishTyping} />

      <button
        type="button"
        onClick={onDone}
        className="press absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex items-center gap-1 rounded-full bg-surface-2/90 px-3 py-1.5 text-footnote font-semibold text-fg-2 hover:text-fg"
      >
        Skip tour <X className="h-3.5 w-3.5" />
      </button>

      <motion.div
        className={
          atTop
            ? 'absolute inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] px-4 md:left-64'
            : 'absolute inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] px-4 md:bottom-8 md:left-64'
        }
        initial={false}
        layout={!reduce}
      >
        <div className="relative mx-auto max-w-md">
          {/* Q's line, held up by his open hand */}
          <div className="relative z-10 ml-[7rem] sm:ml-36">
            <p className="mb-1 text-right text-eyebrow uppercase text-accent">
              Q · {i + 1}/{script.length}
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                onClick={finishTyping}
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="relative w-full rounded-[1.25rem] rounded-bl-md border border-line bg-surface-2 px-4 py-3 text-left text-[17px] font-semibold leading-snug text-fg shadow-2xl shadow-black"
              >
                {/* Full text keeps the bubble's size steady while it types */}
                <span className="invisible" aria-hidden>
                  {step.say}
                </span>
                <span className="absolute inset-x-4 top-3" aria-hidden>
                  {step.say.slice(0, typed)}
                </span>
                <span className="sr-only" aria-live="polite">
                  {step.say}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative -mt-12 flex items-start">
            {/* Q: jumps in, floats and glows while idle, and presents every new line with his open hand */}
            <motion.div
              className="relative w-[13rem] shrink-0 sm:w-60"
              initial={reduce ? false : { y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 140 }}
            >
              <motion.span
                aria-hidden
                className="absolute bottom-0 left-[8%] right-[35%] top-[22%] rounded-full bg-accent/40 blur-3xl"
                animate={reduce ? undefined : { opacity: [0.4, 0.85, 0.4], scale: [0.94, 1.05, 0.94] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
                <motion.img
                  key={i}
                  src="/brand/coach.webp"
                  alt="Q, the PhysiQ coach"
                  width={480}
                  height={404}
                  initial={false}
                  animate={reduce ? undefined : { rotate: [0, 3, -1, 0], y: [0, -8, 0, 0] }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  // The picture ends at his waist: fade that edge out instead of a hard line
                  style={{
                    transformOrigin: '25% 100%',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 72%, transparent 98%)',
                    maskImage: 'linear-gradient(to bottom, #000 72%, transparent 98%)',
                  }}
                  className="relative h-auto w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.9)]"
                />
              </motion.div>
            </motion.div>

            {/* The member's side of the conversation */}
            <div className="flex min-h-12 min-w-0 flex-1 justify-end pt-16">
              <AnimatePresence mode="wait">
                {echo ? (
                  <motion.p
                    key="echo"
                    initial={reduce ? false : { opacity: 0, scale: 0.8, x: 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-[1.25rem] rounded-br-md bg-accent-solid px-4 py-3 text-[16px] font-semibold text-white"
                  >
                    {echo}
                  </motion.p>
                ) : (
                  fullyTyped && (
                    <motion.button
                      key={`reply-${i}`}
                      ref={replyRef}
                      type="button"
                      onClick={answer}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="press whitespace-nowrap rounded-full border-2 border-accent bg-black/60 px-5 py-2.5 text-[16px] font-bold text-fg"
                    >
                      {step.reply}
                    </motion.button>
                  )
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
