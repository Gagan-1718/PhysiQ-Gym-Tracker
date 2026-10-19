'use client';

import { useEffect } from 'react';

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };

/** Keep the screen on while `active` (gym use: no unlocking between sets). Silently skipped where unsupported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!active || !nav.wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') sentinel = await nav.wakeLock!.request('screen');
        if (cancelled) await sentinel?.release();
      } catch {
        // Battery saver or permissions: not critical
      }
    };
    // The lock is dropped whenever the tab is hidden, so take it again on return
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
