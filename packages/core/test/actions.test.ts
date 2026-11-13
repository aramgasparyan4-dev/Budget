import { describe, expect, it } from 'vitest';
import {
  acceptRevision,
  addTask,
  closeExpiredFocus,
  completeTask,
  computeStreak,
  deleteTask,
  editTask,
  emptyData,
  endFocus,
  evaluateMood,
  logManual,
  moveToTomorrow,
  parseQuickAdd,
  reopenTask,
  runningFocus,
  setDayOff,
  skipRevision,
  snooze,
  clearSnooze,
  startFocus,
  suggestRevision,
} from '../src/index.ts';
import type { AppData } from '../src/index.ts';
import { session, settings, stamp, task } from './helpers.ts';

const TODAY = '2026-11-11';
const at = (hm: string, day = TODAY) => stamp(`${day}T${hm}:00`);

function withTask(text: string, id: string, data: AppData = emptyData()): AppData {
  return addTask(data, parseQuickAdd(text, TODAY), id, at('09:00'));
}

describe('tasks', () => {
  it('adds what the parser read', () => {
    const data = withTask('chem exam 20 nov', 'exam');
    expect(data.tasks[0]).toMatchObject({ id: 'exam', kind: 'exam', title: 'Chem exam', due: '2026-11-20', subject: 'Chemistry' });
  });

  it('ticks off and reopens', () => {
    let data = withTask('maths hw fri', 'hw');
    data = completeTask(data, 'hw', at('16:00'));
    expect(data.tasks[0]!.doneAt).toBe('2026-11-11T16:00:00');
    data = reopenTask(data, 'hw', at('16:05'));
    expect(data.tasks[0]!.doneAt).toBeUndefined();
  });

  it('edits the title and date, and can remove the date', () => {
    let data = withTask('maths hw fri', 'hw');
    data = editTask(data, 'hw', { title: 'Maths hw ex 5', due: '2026-11-16' }, at('10:00'));
    expect(data.tasks[0]).toMatchObject({ title: 'Maths hw ex 5', due: '2026-11-16' });
    data = editTask(data, 'hw', { due: null }, at('10:01'));
    expect(data.tasks[0]!.due).toBeUndefined();
  });

  it('every change gets a newer updatedAt, so sync knows which edit wins', () => {
    const a = withTask('maths hw fri', 'hw');
    const b = editTask(a, 'hw', { title: 'x' }, at('10:00'));
    expect(b.tasks[0]!.updatedAt).toBeGreaterThan(a.tasks[0]!.updatedAt);
  });

  it('moves an overdue item to tomorrow', () => {
    let data = addTask(emptyData(), { kind: 'homework', title: 'Maths ex 4.2', due: '2026-11-09' }, 'hw', at('09:00'));
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:00:00').mood).toBe('grumpy');
    data = moveToTomorrow(data, 'hw', at('16:00'));
    expect(data.tasks[0]!.due).toBe('2026-11-12');
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:00:30').mood).toBe('neutral');
  });

  it('keeps a deleted task as a marker instead of removing it', () => {
    let data = withTask('maths hw fri', 'hw');
    data = deleteTask(data, 'hw', at('10:00'));
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]!.deletedAt).toBeDefined();
    // A deleted task cannot be edited or ticked.
    expect(completeTask(data, 'hw', at('10:01'))).toBe(data);
  });
});

describe('focus timer', () => {
  it('uses the default length and remembers what I picked', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    data = startFocus(data, { taskId: 'exam' }, 's1', at('16:00'));
    expect(data.sessions[0]).toMatchObject({ kind: 'focus', taskId: 'exam', subject: 'Chemistry', plannedMinutes: 25, minutes: 0 });
    expect(runningFocus(data, '2026-11-11T16:10:00')?.id).toBe('s1');
  });

  it('a finished session is logged by itself', () => {
    let data = withTask('chem exam 13 nov', 'exam');
    const before = evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:00:00');
    expect(before.mood).toBe('worried');

    data = startFocus(data, { taskId: 'exam', minutes: 30 }, 's1', at('16:00'));
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:10:00').mood).toBe('focus');

    data = closeExpiredFocus(data, at('16:30'));
    expect(data.sessions[0]).toMatchObject({ endedAt: '2026-11-11T16:30:00', minutes: 30 });
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:30:02').mood).toBe('celebrate');
    // An hour later the exam no longer worries the star: revision was logged,
    // and with the exam two days off nothing is due today or tomorrow.
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T17:30:00').mood).toBe('proud');
  });

  it('closing late still records the planned time, not the time the app was away', () => {
    let data = startFocus(emptyData(), { minutes: 25 }, 's1', at('16:00'));
    data = closeExpiredFocus(data, at('21:00'));
    expect(data.sessions[0]).toMatchObject({ endedAt: '2026-11-11T16:25:00', minutes: 25 });
  });

  it('stopping early counts the minutes worked', () => {
    let data = startFocus(emptyData(), {}, 's1', at('16:00'));
    data = endFocus(data, 's1', at('16:12'));
    expect(data.sessions[0]).toMatchObject({ endedAt: '2026-11-11T16:12:00', minutes: 12 });
    expect(data.sessions[0]!.deletedAt).toBeUndefined();
  });

  it('stopping before 10 minutes throws the session away', () => {
    let data = startFocus(emptyData(), {}, 's1', at('16:00'));
    data = endFocus(data, 's1', at('16:09'));
    expect(data.sessions[0]!.deletedAt).toBeDefined();
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T16:09:01').mood).toBe('neutral');
  });

  it('a short planned session still counts when it runs to the end', () => {
    let data = startFocus(emptyData(), { minutes: 5 }, 's1', at('16:00'));
    data = closeExpiredFocus(data, at('16:05'));
    expect(data.sessions[0]).toMatchObject({ minutes: 5 });
    expect(data.sessions[0]!.deletedAt).toBeUndefined();
  });

  it('a finished session on a revision day ticks it off', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    const [first] = suggestRevision(data.tasks, data.settings, TODAY);
    data = acceptRevision(data, first!, 'rev', at('09:05'));
    data = startFocus(data, { taskId: 'rev' }, 's1', at('16:00'));
    data = closeExpiredFocus(data, at('16:25'));
    expect(data.tasks.find((t) => t.id === 'rev')!.doneAt).toBe('2026-11-11T16:25:00');
  });

  it('a session on homework does not tick the homework off', () => {
    let data = withTask('maths hw fri', 'hw');
    data = startFocus(data, { taskId: 'hw' }, 's1', at('16:00'));
    data = closeExpiredFocus(data, at('16:25'));
    expect(data.tasks[0]!.doneAt).toBeUndefined();
  });

  it('starting a new session closes the one still running', () => {
    let data = startFocus(emptyData(), {}, 's1', at('16:00'));
    data = startFocus(data, {}, 's2', at('16:15'));
    expect(data.sessions.find((s) => s.id === 's1')).toMatchObject({ endedAt: '2026-11-11T16:15:00', minutes: 15 });
    expect(runningFocus(data, '2026-11-11T16:16:00')?.id).toBe('s2');
  });
});

describe('manual revision', () => {
  it('logs revision done away from the timer', () => {
    let data = withTask('chem exam 13 nov', 'exam');
    data = logManual(data, { taskId: 'exam', minutes: 40 }, 'm1', at('16:00'));
    expect(data.sessions[0]).toMatchObject({ kind: 'manual', minutes: 40, startedAt: '2026-11-11T15:20:00', subject: 'Chemistry' });
    expect(evaluateMood(data.tasks, data.sessions, settings(), '2026-11-11T17:00:00').mood).toBe('proud');
  });
});

describe('revision days for exams', () => {
  it('suggests 7, 3 and 1 days before the exam', () => {
    const data = withTask('chem exam 20 nov', 'exam');
    expect(suggestRevision(data.tasks, data.settings, TODAY)).toEqual([
      { examId: 'exam', offset: 7, due: '2026-11-13', title: 'Revise for Chem exam', subject: 'Chemistry' },
      { examId: 'exam', offset: 3, due: '2026-11-17', title: 'Revise for Chem exam', subject: 'Chemistry' },
      { examId: 'exam', offset: 1, due: '2026-11-19', title: 'Revise for Chem exam', subject: 'Chemistry' },
    ]);
  });

  it('leaves out days that have already passed', () => {
    const data = withTask('chem exam 13 nov', 'exam');
    expect(suggestRevision(data.tasks, data.settings, TODAY).map((s) => s.due)).toEqual(['2026-11-12']);
    const tomorrow = withTask('bio test tomorrow', 'exam');
    expect(suggestRevision(tomorrow.tasks, tomorrow.settings, TODAY).map((s) => s.due)).toEqual([TODAY]);
  });

  it('does not ask again after I accept or skip', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    const [a, b, c] = suggestRevision(data.tasks, data.settings, TODAY);
    data = acceptRevision(data, a!, 'r1', at('09:05'));
    data = skipRevision(data, b!, 'r2', at('09:05'));
    expect(suggestRevision(data.tasks, data.settings, TODAY)).toEqual([c]);
    expect(data.tasks.find((t) => t.id === 'r1')).toMatchObject({ kind: 'revision', due: '2026-11-13', examId: 'exam' });
    // Deleting an accepted day does not bring the suggestion back either.
    data = deleteTask(data, 'r1', at('09:10'));
    expect(suggestRevision(data.tasks, data.settings, TODAY)).toEqual([c]);
  });

  it('a skipped day never shows up as overdue or due', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    const [a] = suggestRevision(data.tasks, data.settings, TODAY);
    data = skipRevision(data, a!, 'r1', at('09:05'));
    const r = evaluateMood(data.tasks, data.sessions, settings(), '2026-11-13T16:00:00');
    expect(r.taskId).not.toBe('r1');
  });

  it('moving the exam moves its open revision days', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    const [a, b] = suggestRevision(data.tasks, data.settings, TODAY);
    data = acceptRevision(data, a!, 'r1', at('09:05'));
    data = acceptRevision(data, b!, 'r2', at('09:05'));
    data = completeTask(data, 'r1', at('09:06'));
    data = editTask(data, 'exam', { due: '2026-11-27' }, at('09:10'));
    expect(data.tasks.find((t) => t.id === 'r1')!.due).toBe('2026-11-13'); // already done, stays put
    expect(data.tasks.find((t) => t.id === 'r2')!.due).toBe('2026-11-24');
  });

  it('deleting the exam removes its open revision days', () => {
    let data = withTask('chem exam 20 nov', 'exam');
    const [a] = suggestRevision(data.tasks, data.settings, TODAY);
    data = acceptRevision(data, a!, 'r1', at('09:05'));
    data = deleteTask(data, 'exam', at('09:10'));
    expect(data.tasks.every((t) => t.deletedAt !== undefined)).toBe(true);
  });
});

describe('snooze and days off', () => {
  it('snoozes for a number of minutes and can be cleared', () => {
    let data = snooze(emptyData(), 60, at('16:00'));
    expect(data.settings.snoozeUntil).toBe('2026-11-11T17:00:00');
    data = clearSnooze(data, at('16:10'));
    expect(data.settings.snoozeUntil).toBeUndefined();
  });

  it('turns a day off on and off', () => {
    let data = setDayOff(emptyData(), TODAY, true, at('09:00'));
    data = setDayOff(data, TODAY, true, at('09:01'));
    expect(data.settings.daysOff).toEqual([TODAY]);
    data = setDayOff(data, TODAY, false, at('09:02'));
    expect(data.settings.daysOff).toEqual([]);
  });
});

describe('streak', () => {
  const day = (d: string) => session({ endedAt: `${d}T17:00:00` });

  it('counts days in a row with something done', () => {
    const sessions = [day('2026-11-09'), day('2026-11-10'), day(TODAY)];
    expect(computeStreak([], sessions, settings(), TODAY)).toEqual({ days: 3, activeToday: true });
  });

  it('today is not a miss until it is over', () => {
    const sessions = [day('2026-11-09'), day('2026-11-10')];
    expect(computeStreak([], sessions, settings(), TODAY)).toEqual({ days: 2, activeToday: false });
  });

  it('a missed day breaks it', () => {
    const sessions = [day('2026-11-08'), day('2026-11-10')];
    expect(computeStreak([], sessions, settings(), TODAY).days).toBe(1);
  });

  it('a day off does not break it and does not add to it', () => {
    const sessions = [day('2026-11-07'), day('2026-11-08'), day('2026-11-10')];
    const s = settings({ daysOff: ['2026-11-09'] });
    expect(computeStreak([], sessions, s, TODAY).days).toBe(3);
  });

  it('ticked tasks count too', () => {
    const tasks = [task({ kind: 'homework', title: 'x', doneAt: '2026-11-10T18:00:00' })];
    expect(computeStreak(tasks, [], settings(), TODAY).days).toBe(1);
  });
});
