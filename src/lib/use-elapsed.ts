'use client';

import { useEffect, useState } from 'react';

/** The current time, refreshed once per second while `active` (for clocks). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Seconds until `endMs` (0 when null or past), ticking 4x per second for a smooth countdown. */
export function useCountdown(endMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endMs) clearInterval(id); // stop ticking once the countdown is over
    }, 250);
    return () => clearInterval(id);
  }, [endMs]);
  return endMs === null ? 0 : Math.max(0, Math.ceil((endMs - now) / 1000));
}
