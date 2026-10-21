'use client';

import { useEffect, useState } from 'react';

/** Seconds since `startMs`, ticking once per second (0 when null). */
export function useElapsed(startMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);
  return startMs === null ? 0 : Math.max(0, Math.floor((now - startMs) / 1000));
}

/** Seconds until `endMs` (0 when null or past), ticking 4x per second for a smooth countdown. */
export function useCountdown(endMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endMs]);
  return endMs === null ? 0 : Math.max(0, Math.ceil((endMs - now) / 1000));
}
