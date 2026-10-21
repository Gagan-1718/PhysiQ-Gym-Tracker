'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/format';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Sticky footer, e.g. a primary action */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Bottom sheet on phones (drag down to dismiss), centred dialog on larger
 * screens. Locks page scroll while open and closes on Escape.
 */
export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const titleId = useId();
  const reduce = useReducedMotion();
  // Portals only after mount: the server renders nothing, so hydration always matches
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-surface-1 sm:max-w-lg sm:rounded-[1.75rem]',
              className
            )}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex shrink-0 cursor-grab justify-center pb-1 pt-2.5 sm:hidden" aria-hidden>
              <div className="h-1.5 w-10 rounded-full bg-surface-4" />
            </div>
            {title && (
              <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2 sm:pt-5">
                <h2 id={titleId} className="text-title">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="press flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-fg-2 hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* Stop drag gestures from hijacking scrolling inside the content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5" onPointerDownCapture={(e) => e.stopPropagation()}>
              {children}
            </div>
            {footer && <div className="pb-safe shrink-0 border-t border-line bg-surface-1 px-5 pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
