import { useEffect, useRef } from 'react';
import type { DrillStep } from './drill';

/** Starts the exercise once, as soon as the drill says so. */
export function useDrillStart(drill: DrillStep | undefined, begin: () => void) {
  const started = useRef(false);
  const start = drill?.start ?? false;
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);
}
