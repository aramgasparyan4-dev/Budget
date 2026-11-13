// Streak: how many days in a row I did something.
// A day off is skipped. It does not add to the streak and does not break it.

import { addDays, dateOf } from './dates.ts';
import type { LocalDate } from './dates.ts';
import type { Session, Settings, Task } from './types.ts';

export interface Streak {
  /** Days in a row with something done. */
  days: number;
  /** Whether today is already one of them. */
  activeToday: boolean;
}

/** Every day on which something was finished. */
export function activeDays(tasks: Task[], sessions: Session[]): Set<LocalDate> {
  const days = new Set<LocalDate>();
  for (const t of tasks) {
    if (!t.deletedAt && !t.skippedAt && t.doneAt) days.add(dateOf(t.doneAt));
  }
  for (const s of sessions) {
    if (!s.deletedAt && s.endedAt && s.minutes > 0) days.add(dateOf(s.endedAt));
  }
  return days;
}

export function computeStreak(tasks: Task[], sessions: Session[], settings: Settings, today: LocalDate): Streak {
  const active = activeDays(tasks, sessions);
  const off = new Set(settings.daysOff);
  const activeToday = active.has(today);

  let days = activeToday ? 1 : 0;
  // Today is never a miss yet: there is still time. Count back from yesterday.
  let day = addDays(today, -1);
  for (let guard = 0; guard < 3660; guard++) {
    if (active.has(day)) days++;
    else if (!off.has(day)) break;
    day = addDays(day, -1);
  }
  return { days, activeToday };
}
