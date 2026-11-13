import { DEFAULT_SETTINGS } from '../src/index.ts';
import type { Session, Settings, Stamp, Task } from '../src/index.ts';

let counter = 0;
export function id(): string {
  counter += 1;
  return `id-${counter}`;
}

export function task(partial: Partial<Task> & Pick<Task, 'kind' | 'title'>): Task {
  return { id: id(), createdAt: '2026-11-01T12:00:00', updatedAt: 1, ...partial };
}

/** A finished session. `endedAt` is required, the rest has defaults. */
export function session(partial: Partial<Session> & Pick<Session, 'endedAt'>): Session {
  return {
    id: id(),
    kind: 'focus',
    startedAt: partial.endedAt!,
    plannedMinutes: 25,
    minutes: 25,
    updatedAt: 1,
    ...partial,
  };
}

/** Default settings with no quiet hours, so tests can pick any time of day. */
export function settings(partial: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, quietHours: [], daysOff: [], ...partial };
}

export function stamp(local: string): Stamp {
  return { local, ms: Date.UTC(2026, 0, 1) + counter++ };
}
