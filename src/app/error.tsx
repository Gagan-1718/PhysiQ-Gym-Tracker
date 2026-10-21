'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { LogoMark } from '@/components/shell/Logo';

/** Last-resort screen for an unexpected error inside a page. Shown instead of a blank page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <LogoMark size={56} />
      <h1 className="mt-6 text-title">Something went wrong</h1>
      <p className="mt-2 text-[15px] text-fg-2">
        This screen hit an unexpected problem. Your data is safe: anything you were logging is kept on this device.
      </p>
      {error.digest && <p className="mt-2 text-footnote text-fg-3">Reference: {error.digest}</p>}
      <div className="mt-8 grid w-full gap-3">
        <button
          onClick={reset}
          className="press inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-black"
        >
          <RotateCw className="h-5 w-5" /> Try again
        </button>
        <a href="/" className="press inline-flex h-12 items-center justify-center rounded-2xl bg-surface-3 text-[15px] font-medium text-fg">
          Back to Today
        </a>
      </div>
    </main>
  );
}
