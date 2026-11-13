import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, evaluateMood } from '../src/index.ts';
import type { Session, Settings, Task } from '../src/index.ts';
import { session, settings, task } from './helpers.ts';

// Fixed clock. Wednesday 11 November 2026, 16:00 unless a test says otherwise.
const TODAY = '2026-11-11';
const at = (hm: string, day = TODAY) => `${day}T${hm}:00`;
const NOW = at('16:00');

function mood(tasks: Task[], sessions: Session[] = [], now = NOW, s: Settings = settings()) {
  return evaluateMood(tasks, sessions, s, now);
}

const hw = (title: string, due?: string, extra: Partial<Task> = {}) => task({ kind: 'homework', title, due, ...extra });
const exam = (title: string, due: string, extra: Partial<Task> = {}) => task({ kind: 'exam', title, due, ...extra });

describe('neutral', () => {
  it('with nothing at all', () => {
    const r = mood([]);
    expect(r).toMatchObject({ mood: 'neutral', code: 'nothing_due', message: 'Nothing due soon.' });
  });

  it('names the next task and its date', () => {
    const r = mood([hw('Maths hw', '2026-11-16'), hw('English essay', '2026-11-20')]);
    expect(r).toMatchObject({ mood: 'neutral', code: 'next_up', message: 'Next: Maths hw is due Mon 16 Nov.' });
  });

  it('never brings up something two weeks away, even in the evening', () => {
    const tasks = [exam('Chem exam', '2026-11-25'), hw('History project', '2026-11-26')];
    const r = mood(tasks, [], at('21:00'));
    expect(r).toMatchObject({ mood: 'neutral', code: 'nothing_due' });
  });

  it('wishes luck on the day of an exam instead of nagging', () => {
    const r = mood([exam('Chem exam', TODAY)], [], at('07:30'));
    expect(r).toMatchObject({ mood: 'neutral', code: 'exam_today', message: 'Chem exam is today. Good luck.' });
  });

  it('mentions a goal untouched for 7 days', () => {
    const goal = task({ kind: 'goal_long', title: 'Get an A in chemistry', createdAt: '2026-11-04T10:00:00' });
    const r = mood([goal]);
    expect(r).toMatchObject({
      mood: 'neutral',
      code: 'stale_goal',
      message: 'Your goal "Get an A in chemistry" has been quiet since Wed 4 Nov.',
      taskId: goal.id,
    });
  });

  it('does not mention a goal I worked on this week', () => {
    const goal = task({ kind: 'goal_long', title: 'Get an A in chemistry', createdAt: '2026-10-01T10:00:00' });
    const worked = session({ taskId: goal.id, endedAt: '2026-11-08T17:00:00' });
    expect(mood([goal], [worked]).code).toBe('nothing_due');
    const sixDays = task({ kind: 'goal_short', title: 'Finish notes', createdAt: '2026-11-05T10:00:00' });
    expect(mood([sixDays]).code).toBe('nothing_due');
  });

  it('asks about a goal whose date has passed, without getting grumpy', () => {
    const goal = task({ kind: 'goal_short', title: 'Finish chem notes', due: '2026-11-09' });
    const r = mood([goal], [], at('20:00'));
    expect(r).toMatchObject({ mood: 'neutral', code: 'goal_past_date' });
    expect(r.message).toBe('Finish chem notes was planned for Mon 9 Nov. Pick a new date?');
  });
});

describe('grumpy', () => {
  it('when homework is overdue, and says which and when', () => {
    const late = hw('Maths ex 4.2', '2026-11-10');
    const r = mood([late]);
    expect(r).toMatchObject({ mood: 'grumpy', code: 'overdue', message: 'Maths ex 4.2 was due yesterday.', taskId: late.id });
  });

  it('counts the other overdue items', () => {
    const r = mood([hw('Geo map', '2026-11-09'), hw('Maths ex 4.2', '2026-11-06'), hw('Bio notes', '2026-11-10')]);
    expect(r.message).toBe('Maths ex 4.2 was due Fri 6 Nov. 2 more are overdue too.');
  });

  it('not for an exam, goal or revision day that has passed', () => {
    const tasks = [
      exam('Chem exam', '2026-11-09'),
      task({ kind: 'revision', title: 'Revise for Chem exam', due: '2026-11-08' }),
      task({ kind: 'goal_long', title: 'Read more', due: '2026-11-01', createdAt: '2026-11-10T10:00:00' }),
    ];
    expect(mood(tasks).mood).toBe('neutral');
  });

  it('in the evening when nothing is done and homework is due tomorrow', () => {
    const tasks = [hw('English essay', '2026-11-12')];
    expect(mood(tasks, [], at('18:59')).mood).toBe('neutral');
    const r = mood(tasks, [], at('19:00'));
    expect(r).toMatchObject({
      mood: 'grumpy',
      code: 'evening_nothing_done',
      message: 'Nothing done yet today, and English essay is due tomorrow.',
    });
  });

  it('in the evening when nothing is done and an exam is inside the warning window', () => {
    const chem = exam('Chem exam', '2026-11-14');
    const revisedYesterday = session({ taskId: chem.id, endedAt: '2026-11-10T17:00:00' });
    const r = mood([chem], [revisedYesterday], at('19:30'));
    expect(r).toMatchObject({ mood: 'grumpy', message: 'Nothing done yet today, and Chem exam is on Sat 14 Nov.' });
    // One day further away and it is left alone.
    expect(mood([exam('Chem exam', '2026-11-15')], [], at('19:30')).mood).toBe('neutral');
  });

  it('not in the evening if I did anything today', () => {
    const tasks = [hw('English essay', '2026-11-12'), hw('Bio notes', '2026-11-20', { doneAt: at('13:00') })];
    expect(mood(tasks, [], at('20:00')).mood).toBe('happy');
  });

  it('uses my own evening time', () => {
    const tasks = [hw('English essay', '2026-11-12')];
    expect(mood(tasks, [], at('20:00'), settings({ eveningTime: '21:00' })).mood).toBe('neutral');
  });
});

describe('worried', () => {
  it('when homework is due today and it is after 15:00', () => {
    const tasks = [hw('Maths hw', TODAY)];
    expect(mood(tasks, [], at('14:59')).mood).toBe('neutral');
    expect(mood(tasks, [], at('15:00'))).toMatchObject({ mood: 'worried', code: 'due_today', message: 'Maths hw is due today.' });
    expect(mood([...tasks, hw('Bio hw', TODAY)], [], at('15:00')).message).toBe('Maths hw and 1 more are due today.');
  });

  it('when an exam is within 3 days and there was no revision today or yesterday', () => {
    const chem = exam('Chem exam', '2026-11-14');
    const r = mood([chem]);
    expect(r).toMatchObject({
      mood: 'worried',
      code: 'exam_no_revision',
      message: 'Chem exam is on Sat 14 Nov. No revision today or yesterday.',
      taskId: chem.id,
    });
  });

  it('not when the exam is 4 days away', () => {
    expect(mood([exam('Chem exam', '2026-11-15')]).mood).toBe('neutral');
  });

  it('not when I revised yesterday', () => {
    const chem = exam('Chem exam', '2026-11-14');
    const yesterday = session({ taskId: chem.id, endedAt: '2026-11-10T18:00:00' });
    expect(mood([chem], [yesterday]).mood).toBe('neutral');
    // Two days ago is too long.
    const older = session({ taskId: chem.id, endedAt: '2026-11-09T18:00:00' });
    expect(mood([chem], [older]).mood).toBe('worried');
  });

  it('counts a ticked revision day, a manual session and work on the same subject as revision', () => {
    const chem = exam('Chem exam', '2026-11-14', { subject: 'Chemistry' });
    const revisionDay = task({ kind: 'revision', title: 'Revise for Chem exam', examId: chem.id, doneAt: '2026-11-10T18:00:00' });
    expect(mood([chem, revisionDay]).mood).toBe('neutral');

    const manual = session({ kind: 'manual', taskId: chem.id, endedAt: '2026-11-10T18:00:00' });
    expect(mood([chem], [manual]).mood).toBe('neutral');

    const chemHw = hw('Chem worksheet', '2026-11-20', { subject: 'Chemistry' });
    const onHomework = session({ taskId: chemHw.id, endedAt: '2026-11-10T18:00:00' });
    expect(mood([chem, chemHw], [onHomework]).mood).toBe('neutral');

    const physics = session({ subject: 'Physics', endedAt: '2026-11-10T18:00:00' });
    expect(mood([chem], [physics]).mood).toBe('worried');
  });

  it('checks each near exam on its own', () => {
    const chem = exam('Chem exam', '2026-11-13');
    const bio = exam('Bio test', '2026-11-14');
    const revisedChem = session({ taskId: chem.id, endedAt: '2026-11-10T18:00:00' });
    expect(mood([chem, bio], [revisedChem])).toMatchObject({ mood: 'worried', taskId: bio.id });
  });

  it('instead of grumpy when homework is overdue but I did something today', () => {
    const late = hw('Maths ex 4.2', '2026-11-10');
    const done = hw('Bio notes', '2026-11-20', { doneAt: at('13:00') });
    const r = mood([late, done]);
    expect(r).toMatchObject({
      mood: 'worried',
      code: 'overdue_but_active',
      message: 'Maths ex 4.2 is still overdue. It was due yesterday.',
    });
  });
});

describe('happy and proud', () => {
  it('happy when I did something today and something is due soon', () => {
    const tasks = [hw('Bio notes', '2026-11-20', { doneAt: at('13:00') }), hw('English essay', '2026-11-12')];
    const r = mood(tasks);
    expect(r).toMatchObject({
      mood: 'happy',
      code: 'did_something',
      message: 'Bio notes is done. Next: English essay is due tomorrow.',
    });
  });

  it('proud when I did something and nothing is due today or tomorrow', () => {
    const tasks = [hw('Bio notes', '2026-11-20', { doneAt: at('13:00') }), hw('English essay', '2026-11-13')];
    const r = mood(tasks);
    expect(r).toMatchObject({
      mood: 'proud',
      code: 'all_clear',
      message: 'Bio notes is done. Nothing due today or tomorrow.',
    });
  });

  it('a finished session counts as doing something', () => {
    const goal = task({ kind: 'goal_long', title: 'Learn to touch type' });
    const r = mood([goal], [session({ taskId: goal.id, endedAt: at('13:00') })]);
    expect(r).toMatchObject({ mood: 'proud', message: '25 minutes on Learn to touch type. Nothing due today or tomorrow.' });
  });

  it('sums up when there was more than one thing', () => {
    const tasks = [hw('Bio notes', '2026-11-20', { doneAt: at('12:00') }), hw('Geo map', '2026-11-20', { doneAt: at('13:00') })];
    expect(mood(tasks, [session({ endedAt: at('14:00') })]).message).toBe('3 things done today. Nothing due today or tomorrow.');
  });

  it('mentions a streak of 3 days or more', () => {
    const sessions = ['2026-11-09', '2026-11-10', TODAY].map((d) => session({ endedAt: `${d}T13:00:00` }));
    expect(mood([], sessions).message).toBe('25 minutes of work. Nothing due today or tomorrow. 3 days in a row.');
  });

  it('yesterday does not make today happy', () => {
    const tasks = [hw('Bio notes', '2026-11-20', { doneAt: '2026-11-10T20:00:00' })];
    expect(mood(tasks).mood).toBe('neutral');
  });

  it('stays positive for 30 minutes after finishing something, even with homework overdue', () => {
    const late = hw('Maths ex 4.2', '2026-11-10');
    const done = hw('Bio notes', '2026-11-20', { doneAt: at('15:40') });
    expect(mood([late, done], [], at('16:00'))).toMatchObject({
      mood: 'happy',
      message: 'Bio notes is done. Next: Maths ex 4.2 was due yesterday.',
    });
    expect(mood([late, done], [], at('16:10')).mood).toBe('worried');
  });
});

describe('celebrate', () => {
  it('for a few seconds after finishing a task', () => {
    const tasks = [hw('Maths hw', TODAY, { doneAt: '2026-11-11T16:00:00' })];
    expect(mood(tasks, [], '2026-11-11T16:00:03')).toMatchObject({
      mood: 'celebrate',
      code: 'just_finished',
      message: 'Maths hw is done!',
    });
    expect(mood(tasks, [], '2026-11-11T16:00:07').mood).toBe('celebrate');
    expect(mood(tasks, [], '2026-11-11T16:00:08').mood).toBe('proud');
  });

  it('for a finished focus session', () => {
    const chem = exam('Chem exam', '2026-11-14');
    const s = session({ taskId: chem.id, endedAt: '2026-11-11T16:00:00' });
    expect(mood([chem], [s], '2026-11-11T16:00:02').message).toBe('25 minutes on Chem exam!');
  });

  it('even during quiet hours or a snooze', () => {
    const tasks = [hw('Maths hw', TODAY, { doneAt: '2026-11-11T10:00:00' })];
    expect(mood(tasks, [], '2026-11-11T10:00:02', DEFAULT_SETTINGS).mood).toBe('celebrate');
    expect(mood(tasks, [], '2026-11-11T10:00:02', settings({ snoozeUntil: at('18:00') })).mood).toBe('celebrate');
  });
});

describe('sleepy', () => {
  const late = () => [hw('Maths ex 4.2', '2026-11-10')];

  it('while snoozed, even with homework overdue', () => {
    const r = mood(late(), [], NOW, settings({ snoozeUntil: at('18:30') }));
    expect(r).toMatchObject({ mood: 'sleepy', code: 'snooze', message: 'Snoozed until 18:30.' });
    expect(mood(late(), [], at('18:30'), settings({ snoozeUntil: at('18:30') })).mood).toBe('grumpy');
  });

  it('on a day off', () => {
    const r = mood(late(), [], at('20:00'), settings({ daysOff: [TODAY] }));
    expect(r).toMatchObject({ mood: 'sleepy', code: 'day_off' });
  });

  it('on a day off is still pleased if I work anyway, and never nags', () => {
    const tasks = [...late(), hw('Bio notes', '2026-11-20', { doneAt: at('10:00') })];
    expect(mood(tasks, [], at('20:00'), settings({ daysOff: [TODAY] })).mood).toBe('happy');
  });

  it('during school hours', () => {
    const r = mood(late(), [], at('10:00'), DEFAULT_SETTINGS);
    expect(r).toMatchObject({ mood: 'sleepy', code: 'quiet_hours', message: 'Quiet until 15:00.' });
    expect(mood(late(), [], at('15:00'), DEFAULT_SETTINGS).mood).toBe('grumpy');
  });

  it('not during school hours at the weekend', () => {
    expect(mood([], [], at('10:00', '2026-11-14'), DEFAULT_SETTINGS).mood).toBe('neutral');
  });

  it('at night, on both sides of midnight', () => {
    expect(mood(late(), [], at('21:59'), DEFAULT_SETTINGS).mood).toBe('grumpy');
    expect(mood(late(), [], at('22:00'), DEFAULT_SETTINGS)).toMatchObject({ mood: 'sleepy', message: 'Quiet until 07:00.' });
    expect(mood(late(), [], at('06:59', '2026-11-12'), DEFAULT_SETTINGS).mood).toBe('sleepy');
    expect(mood(late(), [], at('07:00', '2026-11-12'), DEFAULT_SETTINGS).mood).toBe('grumpy');
  });

  it('a night window only runs past midnight after a day it starts on', () => {
    const s = settings({ quietHours: [{ label: 'Night', days: [5], from: '23:00', to: '09:00' }] });
    expect(mood([], [], at('08:00', '2026-11-14'), s).mood).toBe('sleepy'); // Saturday morning, after Friday night
    expect(mood([], [], at('08:00', '2026-11-13'), s).mood).toBe('neutral'); // Friday morning
  });
});

describe('focus', () => {
  const running = (taskId?: string): Session => ({
    id: 'run',
    kind: 'focus',
    taskId,
    startedAt: at('15:50'),
    plannedMinutes: 25,
    minutes: 0,
    updatedAt: 1,
  });

  it('while a focus session is running, and it never nags', () => {
    const late = hw('Maths ex 4.2', '2026-11-10');
    const chem = exam('Chem exam', '2026-11-12');
    const r = mood([late, chem], [running(chem.id)], at('16:00'));
    expect(r).toMatchObject({ mood: 'focus', code: 'focus', message: 'Focusing on Chem exam until 16:15.' });
  });

  it('works without a task picked', () => {
    expect(mood([], [running()], at('16:00')).message).toBe('Focus time until 16:15.');
  });

  it('beats quiet hours and snooze', () => {
    expect(mood([], [running()], at('16:00'), settings({ snoozeUntil: at('18:00') })).mood).toBe('focus');
  });

  it('stops once the planned time is up', () => {
    expect(mood([], [running()], at('16:14')).mood).toBe('focus');
    expect(mood([], [running()], at('16:15')).mood).toBe('neutral');
  });
});

describe('ignored records', () => {
  it('deleted and skipped tasks, deleted sessions and too short sessions do not count', () => {
    const tasks = [
      hw('Deleted hw', '2026-11-10', { deletedAt: 5 }),
      task({ kind: 'revision', title: 'Skipped', due: '2026-11-10', skippedAt: at('09:00') }),
      hw('Deleted but done', '2026-11-20', { doneAt: at('13:00'), deletedAt: 5 }),
    ];
    const sessions = [session({ endedAt: at('13:00'), deletedAt: 5 }), session({ endedAt: at('13:00'), minutes: 0 })];
    expect(mood(tasks, sessions)).toMatchObject({ mood: 'neutral', code: 'nothing_due' });
  });
});

describe('nextCheckAt: when the mood could next change by itself', () => {
  it('is the evening time during the afternoon', () => {
    expect(mood([]).nextCheckAt).toBe(at('19:00'));
  });

  it('is midnight late in the evening', () => {
    expect(mood([], [], at('21:00')).nextCheckAt).toBe('2026-11-12T00:00:00');
  });

  it('is the end of the celebration, then the end of the afterglow', () => {
    const tasks = [hw('Maths hw', TODAY, { doneAt: '2026-11-11T16:00:00' })];
    expect(mood(tasks, [], '2026-11-11T16:00:03').nextCheckAt).toBe('2026-11-11T16:00:08');
    expect(mood(tasks, [], '2026-11-11T16:00:08').nextCheckAt).toBe('2026-11-11T16:30:00');
  });

  it('is the end of a focus session, a snooze or quiet hours', () => {
    const run: Session = { id: 'r', kind: 'focus', startedAt: at('15:50'), plannedMinutes: 25, minutes: 0, updatedAt: 1 };
    expect(mood([], [run]).nextCheckAt).toBe(at('16:15'));
    expect(mood([], [], NOW, settings({ snoozeUntil: at('17:00') })).nextCheckAt).toBe(at('17:00'));
    expect(mood([], [], at('10:00'), DEFAULT_SETTINGS).nextCheckAt).toBe(at('15:00'));
  });
});

describe('purity', () => {
  it('does not change its inputs and gives the same answer twice', () => {
    const tasks = [hw('Maths ex 4.2', '2026-11-10'), exam('Chem exam', '2026-11-13')];
    const sessions = [session({ endedAt: at('13:00') })];
    const s = settings();
    const snapshot = JSON.stringify({ tasks, sessions, s });
    const first = evaluateMood(tasks, sessions, s, NOW);
    const second = evaluateMood(tasks, sessions, s, NOW);
    expect(second).toEqual(first);
    expect(JSON.stringify({ tasks, sessions, s })).toBe(snapshot);
  });
});
