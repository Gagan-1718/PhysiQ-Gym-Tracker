'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

/** Small pill notifications that drop in from the top. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 4500 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border border-line bg-surface-3/95 px-4 py-2.5 text-[15px] font-medium shadow-2xl shadow-black/60 backdrop-blur-xl"
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'error' ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-train" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
