import { toLocalDateTime } from '@star/core';
import type { AppData, LocalDateTime } from '@star/core';
import { useEffect, useState } from 'preact/hooks';
import type { Store } from './store.ts';

/** Re-draws the component whenever the data changes. */
export function useData(store: Store): AppData {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((n) => n + 1)), [store]);
  return store.data;
}

/** The current time, refreshed every `everyMs`. */
export function useNow(everyMs: number): LocalDateTime {
  const [now, setNow] = useState(() => toLocalDateTime(new Date()));
  useEffect(() => {
    setNow(toLocalDateTime(new Date()));
    const timer = setInterval(() => setNow(toLocalDateTime(new Date())), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
