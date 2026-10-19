'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useElapsed } from '@/lib/use-elapsed';
import { clock } from '@/lib/format';
import { useWorkoutDraft } from '@/lib/workout-draft';

/** Floating "workout in progress" pill above the tab bar, like a music mini-player. */
export function ActiveWorkoutBar() {
  const { data: session } = useSession();
  const [draft] = useWorkoutDraft(session?.user?.id);
  const elapsed = useElapsed(draft?.startedAtMs ?? null);

  return (
    <AnimatePresence>
      {draft && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.5rem)] z-40 md:inset-x-auto md:bottom-6 md:right-6 md:w-80"
        >
          <Link
            href="/train/session"
            className="press flex items-center gap-3 rounded-2xl border border-accent/25 bg-surface-2/95 px-4 py-3 shadow-2xl shadow-black/70 backdrop-blur-xl"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{draft.bodyPart} workout</p>
              <p className="text-footnote text-fg-2">In progress · tap to resume</p>
            </div>
            <span className="tabular font-round text-lg font-extrabold text-accent">{clock(elapsed)}</span>
            <ChevronRight className="h-5 w-5 text-fg-3" />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
