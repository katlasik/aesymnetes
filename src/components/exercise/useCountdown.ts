import { useEffect, useRef, useState } from 'react';

export interface CountdownSpec {
  /** Restarts the countdown whenever it changes (for example the phase plus the round number). */
  key: string;
  seconds: number;
  onDone: () => void;
}

/**
 * Milliseconds left on the active countdown, or null when none is active.
 * One effect owns the timer, so it is cleared the moment `key` changes and a click and a
 * timeout cannot both act.
 */
export function useCountdown(spec: CountdownSpec | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onDone = useRef<() => void>(() => {});
  onDone.current = spec?.onDone ?? (() => {});
  const key = spec ? `${spec.key}|${spec.seconds}` : null;
  const seconds = spec?.seconds ?? 0;

  useEffect(() => {
    if (key === null) {
      setRemaining(null);
      return;
    }
    const deadline = Date.now() + seconds * 1000;
    setRemaining(deadline - Date.now());
    const id = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        onDone.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [key, seconds]);

  return remaining;
}

/** Whole seconds left, counting down to 0. */
export function wholeSeconds(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}
