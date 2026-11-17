import { addMinutes, closeExpiredFocus, diffSeconds, evaluateMood, toLocalDateTime } from '@star/core';
import type { AppData, LocalDateTime, MoodResult } from '@star/core';
import { useEffect, useRef, useState } from 'preact/hooks';
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

export interface MoodOptions {
  /**
   * Log a focus session by itself when its time is up. Exactly one part of
   * an app should do this: on the desktop it is the star window, on the
   * phone it is the main screen.
   */
  closeFocus?: boolean;
  /** Called after a focus session was logged, for a sound or a buzz. */
  onFocusEnd?: () => void;
}

/**
 * The star's mood right now, kept up to date without polling: it is worked
 * out again when the data changes, when the page comes back to the front,
 * and by one timer set for the moment the mood could next change.
 */
export function useMood(store: Store, options: MoodOptions = {}): { mood: MoodResult; now: LocalDateTime } {
  const compute = () => {
    const now = toLocalDateTime(new Date());
    return { now, mood: evaluateMood(store.data.tasks, store.data.sessions, store.data.settings, now) };
  };
  const [state, setState] = useState(compute);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let timer = 0;

    const run = () => {
      clearTimeout(timer);
      const next = compute();

      if (latest.current.closeFocus) {
        const expired = store.data.sessions.some(
          (s) => !s.deletedAt && s.kind === 'focus' && !s.endedAt && addMinutes(s.startedAt, s.plannedMinutes) <= next.now,
        );
        if (expired) {
          // Saving the change calls run() again through the subscription.
          void store.apply((data, at) => closeExpiredFocus(data, at)).then(() => latest.current.onFocusEnd?.());
          return;
        }
      }

      setState(next);
      const wait = Math.min(60_000, Math.max(300, diffSeconds(next.mood.nextCheckAt, next.now) * 1000 + 300));
      timer = window.setTimeout(run, wait);
    };

    const onVisible = () => {
      if (!document.hidden) run();
    };

    run();
    const unsubscribe = store.subscribe(run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [store]);

  return state;
}
