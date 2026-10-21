'use client';

import { useSyncExternalStore } from 'react';
import { CloudOff } from 'lucide-react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Pill shown while the device has no connection. The logger keeps working: sets live on the device until Finish. */
export function OfflineBadge() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true // the server (and first hydration) assume online, so markup always matches
  );
  if (online) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-fg-2">
      <CloudOff className="h-5 w-5 shrink-0 text-recover" aria-hidden />
      <span>
        <span className="font-semibold text-fg">You’re offline.</span> Sets stay on this device; you can save the workout once you’re back online.
      </span>
    </div>
  );
}
