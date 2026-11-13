import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  emptyData,
  focusChoices,
  openGoals,
  parseAppData,
  stringifyAppData,
  todayGroups,
  upcomingExams,
} from '../src/index.ts';
import { session, task } from './helpers.ts';

const TODAY = '2026-11-11';

describe('saving and loading', () => {
  it('round trips', () => {
    const data = emptyData();
    data.tasks.push(task({ kind: 'homework', title: 'Maths hw', due: '2026-11-13' }));
    data.sessions.push(session({ endedAt: '2026-11-11T16:00:00' }));
    expect(parseAppData(stringifyAppData(data))).toEqual(data);
  });

  it('gives empty data for nothing or rubbish', () => {
    expect(parseAppData('')).toEqual(emptyData());
    expect(parseAppData('{ not json')).toEqual(emptyData());
    expect(parseAppData('[1,2]')).toEqual(emptyData());
  });

  it('fills in settings that an older file does not have', () => {
    const data = parseAppData(JSON.stringify({ tasks: [], sessions: [], settings: { eveningTime: '20:30' } }));
    expect(data.settings.eveningTime).toBe('20:30');
    expect(data.settings.focusMinutes).toBe(DEFAULT_SETTINGS.focusMinutes);
    expect(data.settings.quietHours).toEqual(DEFAULT_SETTINGS.quietHours);
  });

  it('drops records that are not tasks', () => {
    const data = parseAppData(JSON.stringify({ tasks: [{ id: 'a', kind: 'homework', title: 'ok' }, { nope: 1 }, null] }));
    expect(data.tasks.map((t) => t.id)).toEqual(['a']);
  });
});

describe('today screen', () => {
  it('sorts tasks under the right headings', () => {
    const tasks = [
      task({ kind: 'homework', title: 'late', due: '2026-11-09' }),
      task({ kind: 'exam', title: 'old exam', due: '2026-11-09' }),
      task({ kind: 'homework', title: 'today', due: TODAY }),
      task({ kind: 'exam', title: 'tomorrow', due: '2026-11-12' }),
      task({ kind: 'homework', title: 'week', due: '2026-11-18' }),
      task({ kind: 'homework', title: 'later', due: '2026-11-19' }),
      task({ kind: 'homework', title: 'no date' }),
      task({ kind: 'goal_long', title: 'long goal' }),
      task({ kind: 'homework', title: 'done', due: TODAY, doneAt: '2026-11-11T10:00:00' }),
      task({ kind: 'homework', title: 'done before', doneAt: '2026-11-10T10:00:00' }),
      task({ kind: 'homework', title: 'deleted', due: TODAY, deletedAt: 5 }),
    ];
    const g = todayGroups(tasks, TODAY);
    const titles = (list: typeof tasks) => list.map((t) => t.title);
    expect(titles(g.overdue)).toEqual(['late']);
    expect(titles(g.today)).toEqual(['today']);
    expect(titles(g.tomorrow)).toEqual(['tomorrow']);
    expect(titles(g.week)).toEqual(['week']);
    expect(titles(g.later)).toEqual(['later']);
    expect(titles(g.undated)).toEqual(['no date']);
    expect(titles(g.doneToday)).toEqual(['done']);
  });
});

describe('exams and goals screens', () => {
  it('lists upcoming exams with their revision days and minutes', () => {
    const chem = task({ kind: 'exam', title: 'Chem exam', due: '2026-11-14' });
    const rev = task({ kind: 'revision', title: 'Revise for Chem exam', due: '2026-11-13', examId: chem.id });
    const past = task({ kind: 'exam', title: 'Old', due: '2026-11-01' });
    const sessions = [
      session({ taskId: chem.id, endedAt: '2026-11-10T17:00:00', minutes: 25 }),
      session({ taskId: rev.id, endedAt: '2026-11-11T17:00:00', minutes: 30 }),
    ];
    const [view, ...rest] = upcomingExams([chem, rev, past], sessions, TODAY);
    expect(rest).toEqual([]);
    expect(view).toMatchObject({ daysLeft: 3, minutes: 55 });
    expect(view!.revision.map((t) => t.id)).toEqual([rev.id]);
  });

  it('lists open goals with when they were last worked on', () => {
    const short = task({ kind: 'goal_short', title: 'Finish notes' });
    const long = task({ kind: 'goal_long', title: 'Get an A' });
    const done = task({ kind: 'goal_short', title: 'Done', doneAt: '2026-11-10T10:00:00' });
    const sessions = [session({ taskId: long.id, endedAt: '2026-11-08T17:00:00', minutes: 20 })];
    const goals = openGoals([long, short, done], sessions);
    expect(goals.map((g) => g.goal.title)).toEqual(['Finish notes', 'Get an A']);
    expect(goals[1]).toMatchObject({ lastTouched: '2026-11-08T17:00:00', minutes: 20 });
    expect(goals[0]!.lastTouched).toBeUndefined();
  });

  it('offers open tasks for a focus session, most urgent first', () => {
    const tasks = [
      task({ kind: 'goal_long', title: 'goal' }),
      task({ kind: 'homework', title: 'fri', due: '2026-11-13' }),
      task({ kind: 'exam', title: 'past exam', due: '2026-11-01' }),
      task({ kind: 'homework', title: 'overdue', due: '2026-11-09' }),
      task({ kind: 'homework', title: 'done', due: '2026-11-12', doneAt: '2026-11-11T10:00:00' }),
    ];
    expect(focusChoices(tasks, TODAY).map((t) => t.title)).toEqual(['overdue', 'fri', 'goal']);
  });
});
