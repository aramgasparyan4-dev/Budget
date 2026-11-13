// Everything that changes data. Each function takes the current data and
// returns new data. Nothing here reads the clock or makes ids: the app
// passes in a Stamp and an id, which keeps these easy to test.

import { addDays, addMinutes, dateOf, diffSeconds, toLocalDateTime } from './dates.ts';
import type { LocalDate, LocalDateTime } from './dates.ts';
import type { ParsedTask } from './parser.ts';
import type { AppData, Session, Settings, Task, TaskKind } from './types.ts';

/** One moment, in the two forms the data needs. */
export interface Stamp {
  /** Wall clock time, used for "done today" style logic. */
  local: LocalDateTime;
  /** Milliseconds since 1970, used to decide which edit is newer when syncing. */
  ms: number;
}

export function stampFrom(d: Date): Stamp {
  return { local: toLocalDateTime(d), ms: d.getTime() };
}

declare const crypto: { randomUUID(): string };

export function newId(): string {
  return crypto.randomUUID();
}

function replaceTask(data: AppData, task: Task): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === task.id ? task : t)) };
}

function findTask(data: AppData, id: string): Task | undefined {
  return data.tasks.find((t) => t.id === id && !t.deletedAt);
}

// ---------------------------------------------------------------- tasks

export interface NewTask {
  kind: TaskKind;
  title: string;
  due?: LocalDate;
  subject?: string;
  examId?: string;
  revisionOffset?: number;
}

export function addTask(data: AppData, input: NewTask | ParsedTask, id: string, at: Stamp): AppData {
  const task: Task = { id, kind: input.kind, title: input.title, createdAt: at.local, updatedAt: at.ms };
  if (input.due) task.due = input.due;
  if (input.subject) task.subject = input.subject;
  if ('examId' in input && input.examId) task.examId = input.examId;
  if ('revisionOffset' in input && input.revisionOffset !== undefined) task.revisionOffset = input.revisionOffset;
  return { ...data, tasks: [...data.tasks, task] };
}

export interface TaskPatch {
  title?: string;
  kind?: TaskKind;
  subject?: string | null;
  /** null removes the date. */
  due?: LocalDate | null;
}

export function editTask(data: AppData, id: string, patch: TaskPatch, at: Stamp): AppData {
  const old = findTask(data, id);
  if (!old) return data;

  const task: Task = { ...old, updatedAt: at.ms };
  if (patch.title !== undefined) task.title = patch.title;
  if (patch.kind !== undefined) task.kind = patch.kind;
  if (patch.subject === null) delete task.subject;
  else if (patch.subject !== undefined) task.subject = patch.subject;
  if (patch.due === null) delete task.due;
  else if (patch.due !== undefined) task.due = patch.due;

  let next = replaceTask(data, task);

  // When an exam moves, its revision days that are still open move with it.
  if (task.kind === 'exam' && task.due && task.due !== old.due) {
    next = {
      ...next,
      tasks: next.tasks.map((t) =>
        t.examId === task.id && t.revisionOffset !== undefined && !t.doneAt && !t.skippedAt && !t.deletedAt
          ? { ...t, due: addDays(task.due!, -t.revisionOffset), updatedAt: at.ms }
          : t,
      ),
    };
  }
  return next;
}

export function completeTask(data: AppData, id: string, at: Stamp): AppData {
  const task = findTask(data, id);
  if (!task || task.doneAt) return data;
  return replaceTask(data, { ...task, doneAt: at.local, updatedAt: at.ms });
}

export function reopenTask(data: AppData, id: string, at: Stamp): AppData {
  const task = findTask(data, id);
  if (!task || !task.doneAt) return data;
  const { doneAt: _doneAt, ...rest } = task;
  return replaceTask(data, { ...rest, updatedAt: at.ms });
}

export function deleteTask(data: AppData, id: string, at: Stamp): AppData {
  const task = findTask(data, id);
  if (!task) return data;
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id === id) return { ...t, deletedAt: at.ms, updatedAt: at.ms };
      // Deleting an exam also removes its revision days that are still open.
      if (task.kind === 'exam' && t.examId === id && !t.doneAt && !t.deletedAt) {
        return { ...t, deletedAt: at.ms, updatedAt: at.ms };
      }
      return t;
    }),
  };
}

/** The button on overdue items. */
export function moveToTomorrow(data: AppData, id: string, at: Stamp): AppData {
  return editTask(data, id, { due: addDays(dateOf(at.local), 1) }, at);
}

// ------------------------------------------------------- focus sessions

export function runningFocus(data: AppData, now: LocalDateTime): Session | undefined {
  return data.sessions.find((s) => !s.deletedAt && s.kind === 'focus' && !s.endedAt && s.startedAt <= now);
}

export interface FocusInput {
  taskId?: string;
  /** Leave out to use the default from settings. */
  minutes?: number;
}

export function startFocus(data: AppData, input: FocusInput, id: string, at: Stamp): AppData {
  // Only one session runs at a time: close any that is still open first.
  let next = data;
  const open = runningFocus(next, at.local);
  if (open) next = endFocus(next, open.id, at);

  const session: Session = {
    id,
    kind: 'focus',
    startedAt: at.local,
    plannedMinutes: input.minutes ?? next.settings.focusMinutes,
    minutes: 0,
    updatedAt: at.ms,
  };
  const task = input.taskId ? findTask(next, input.taskId) : undefined;
  if (task) {
    session.taskId = task.id;
    if (task.subject) session.subject = task.subject;
  }
  return { ...next, sessions: [...next.sessions, session] };
}

/**
 * Ends a focus session, whether the timer ran out or I stopped it early.
 * The time worked is capped at the planned length. A session shorter than
 * settings.minSessionMinutes is thrown away. A finished session on a
 * revision task ticks that task off.
 */
export function endFocus(data: AppData, sessionId: string, at: Stamp): AppData {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session || session.deletedAt || session.endedAt) return data;

  const plannedEnd = addMinutes(session.startedAt, session.plannedMinutes);
  const endedAt = at.local < plannedEnd ? at.local : plannedEnd;
  const minutes = Math.max(0, Math.floor(diffSeconds(endedAt, session.startedAt) / 60));
  const counts = minutes >= Math.min(data.settings.minSessionMinutes, session.plannedMinutes);

  const ended: Session = counts
    ? { ...session, endedAt, minutes, updatedAt: at.ms }
    : { ...session, endedAt, minutes: 0, deletedAt: at.ms, updatedAt: at.ms };
  let next: AppData = { ...data, sessions: data.sessions.map((s) => (s.id === sessionId ? ended : s)) };

  if (counts && session.taskId) {
    const task = findTask(next, session.taskId);
    if (task && task.kind === 'revision' && !task.doneAt) {
      next = replaceTask(next, { ...task, doneAt: endedAt, updatedAt: at.ms });
    }
  }
  return next;
}

/** Closes a focus session whose timer ran out while the app was not looking. */
export function closeExpiredFocus(data: AppData, at: Stamp): AppData {
  let next = data;
  for (const s of data.sessions) {
    if (!s.deletedAt && s.kind === 'focus' && !s.endedAt && addMinutes(s.startedAt, s.plannedMinutes) <= at.local) {
      next = endFocus(next, s.id, at);
    }
  }
  return next;
}

// ------------------------------------------------------ manual sessions

export interface ManualInput {
  minutes: number;
  taskId?: string;
  subject?: string;
}

/** "I revised away from the screen." Counts the same as a focus session. */
export function logManual(data: AppData, input: ManualInput, id: string, at: Stamp): AppData {
  const minutes = Math.max(1, Math.round(input.minutes));
  const session: Session = {
    id,
    kind: 'manual',
    startedAt: addMinutes(at.local, -minutes),
    plannedMinutes: minutes,
    endedAt: at.local,
    minutes,
    updatedAt: at.ms,
  };
  const task = input.taskId ? findTask(data, input.taskId) : undefined;
  if (task) session.taskId = task.id;
  const subject = input.subject ?? task?.subject;
  if (subject) session.subject = subject;

  let next: AppData = { ...data, sessions: [...data.sessions, session] };
  if (task && task.kind === 'revision' && !task.doneAt) {
    next = replaceTask(next, { ...task, doneAt: at.local, updatedAt: at.ms });
  }
  return next;
}

// ------------------------------------------------------------- settings

export function updateSettings(data: AppData, patch: Partial<Omit<Settings, 'updatedAt'>>, at: Stamp): AppData {
  return { ...data, settings: { ...data.settings, ...patch, updatedAt: at.ms } };
}

export function snooze(data: AppData, minutes: number, at: Stamp): AppData {
  return updateSettings(data, { snoozeUntil: addMinutes(at.local, minutes) }, at);
}

export function clearSnooze(data: AppData, at: Stamp): AppData {
  const { snoozeUntil: _snoozeUntil, ...rest } = data.settings;
  return { ...data, settings: { ...rest, updatedAt: at.ms } };
}

export function setDayOff(data: AppData, day: LocalDate, off: boolean, at: Stamp): AppData {
  const others = data.settings.daysOff.filter((d) => d !== day);
  return updateSettings(data, { daysOff: off ? [...others, day].sort() : others }, at);
}
