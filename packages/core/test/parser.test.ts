import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../src/index.ts';

// The fixed "today" for these tests: Wednesday 11 November 2026.
const WED = '2026-11-11';
const FRI = '2026-11-13';

describe('quick add: the nine required cases', () => {
  it('1. "maths hw fri" is homework due next Friday', () => {
    const r = parseQuickAdd('maths hw fri', WED);
    expect(r).toMatchObject({ kind: 'homework', title: 'Maths hw', due: '2026-11-13', subject: 'Maths' });
  });

  it('2. "english essay 20.11" is homework due 20 November', () => {
    const r = parseQuickAdd('english essay 20.11', WED);
    expect(r).toMatchObject({ kind: 'homework', title: 'English essay', due: '2026-11-20' });
  });

  it('3. "chem exam 20 nov" is an exam', () => {
    const r = parseQuickAdd('chem exam 20 nov', WED);
    expect(r).toMatchObject({ kind: 'exam', title: 'Chem exam', due: '2026-11-20', subject: 'Chemistry' });
  });

  it('4. "physics test next week" is an exam 7 days from today', () => {
    const r = parseQuickAdd('physics test next week', WED);
    expect(r).toMatchObject({ kind: 'exam', title: 'Physics test', due: '2026-11-18' });
  });

  it('5. "maths ex 4.2 due fri" keeps 4.2 in the title and is due Friday', () => {
    const r = parseQuickAdd('maths ex 4.2 due fri', WED);
    expect(r).toMatchObject({ kind: 'homework', title: 'Maths ex 4.2', due: '2026-11-13' });
  });

  it('6. "page 3/4 questions" has no date', () => {
    const r = parseQuickAdd('page 3/4 questions', WED);
    expect(r.due).toBeUndefined();
    expect(r).toMatchObject({ kind: 'homework', title: 'Page 3/4 questions' });
  });

  it('7. "long goal get an A in chemistry" is a long term goal with no date', () => {
    const r = parseQuickAdd('long goal get an A in chemistry', WED);
    expect(r.due).toBeUndefined();
    expect(r).toMatchObject({ kind: 'goal_long', title: 'Get an A in chemistry', subject: 'Chemistry' });
  });

  it('8. "history mock jan 12" is an exam next January once that date has passed', () => {
    expect(parseQuickAdd('history mock jan 12', WED)).toMatchObject({ kind: 'exam', due: '2027-01-12' });
    expect(parseQuickAdd('history mock jan 12', '2026-01-05')).toMatchObject({ kind: 'exam', due: '2026-01-12' });
    expect(parseQuickAdd('history mock jan 12', '2026-01-12')).toMatchObject({ due: '2026-01-12' });
  });

  it('9. "final draft of essay fri" is homework, not an exam', () => {
    const r = parseQuickAdd('final draft of essay fri', WED);
    expect(r).toMatchObject({ kind: 'homework', title: 'Final draft of essay', due: '2026-11-13' });
  });
});

describe('quick add: weekdays', () => {
  it('a weekday name means the next one, never today', () => {
    expect(parseQuickAdd('maths hw fri', FRI).due).toBe('2026-11-20');
    expect(parseQuickAdd('maths hw friday', '2026-11-14').due).toBe('2026-11-20');
    expect(parseQuickAdd('maths hw mon', WED).due).toBe('2026-11-16');
  });

  it('"next fri" is the Friday of next week, "this fri" can be today', () => {
    expect(parseQuickAdd('read ch 5 next fri', WED).due).toBe('2026-11-20');
    expect(parseQuickAdd('read ch 5 next mon', WED).due).toBe('2026-11-16');
    expect(parseQuickAdd('read ch 5 this fri', FRI).due).toBe(FRI);
  });

  it('understands the short and long spellings', () => {
    expect(parseQuickAdd('art tues', WED).due).toBe('2026-11-17');
    expect(parseQuickAdd('art thurs', WED).due).toBe('2026-11-12');
    expect(parseQuickAdd('art Wednesday', WED).due).toBe('2026-11-18');
  });

  it('SAT in capitals is the exam, not Saturday', () => {
    const r = parseQuickAdd('SAT practice paper', WED);
    expect(r.due).toBeUndefined();
    expect(r.title).toBe('SAT practice paper');
    expect(parseQuickAdd('bio hw sat', WED).due).toBe('2026-11-14');
  });
});

describe('quick add: other date forms', () => {
  it('today, tomorrow and friends', () => {
    expect(parseQuickAdd('maths hw today', WED)).toMatchObject({ title: 'Maths hw', due: WED });
    expect(parseQuickAdd('bio hw tomorrow', WED).due).toBe('2026-11-12');
    expect(parseQuickAdd('bio hw tmrw', WED).due).toBe('2026-11-12');
    expect(parseQuickAdd('bio hw day after tomorrow', WED)).toMatchObject({ title: 'Bio hw', due: '2026-11-13' });
  });

  it('in N days, weeks or months', () => {
    expect(parseQuickAdd('french quiz in 3 days', WED)).toMatchObject({ kind: 'exam', title: 'French quiz', due: '2026-11-14' });
    expect(parseQuickAdd('essay due in 2 weeks', WED)).toMatchObject({ title: 'Essay', due: '2026-11-25' });
    expect(parseQuickAdd('project in a month', WED).due).toBe('2026-12-11');
    expect(parseQuickAdd('project next month', WED).due).toBe('2026-12-11');
  });

  it('day and month in words, either way round', () => {
    expect(parseQuickAdd('essay 20th of november', WED)).toMatchObject({ title: 'Essay', due: '2026-11-20' });
    expect(parseQuickAdd('essay nov 20th', WED).due).toBe('2026-11-20');
    expect(parseQuickAdd('essay 3 December 2027', WED).due).toBe('2027-12-03');
    expect(parseQuickAdd('essay on 5 nov', WED)).toMatchObject({ title: 'Essay', due: '2027-11-05' });
  });

  it('numbers with dots or slashes, day first', () => {
    expect(parseQuickAdd('geo hw 20/11', WED).due).toBe('2026-11-20');
    expect(parseQuickAdd('geo hw 20/11/2026', WED).due).toBe('2026-11-20');
    expect(parseQuickAdd('geo hw 20.11.27', WED).due).toBe('2027-11-20');
    expect(parseQuickAdd('20.11 geo hw', WED)).toMatchObject({ title: 'Geo hw', due: '2026-11-20' });
    expect(parseQuickAdd('english essay 5.11', WED).due).toBe('2027-11-05');
    expect(parseQuickAdd('essay 2026-12-01', WED).due).toBe('2026-12-01');
  });

  it('the 20th', () => {
    expect(parseQuickAdd('art project the 20th', WED)).toMatchObject({ title: 'Art project', due: '2026-11-20' });
    expect(parseQuickAdd('art project 5th', WED).due).toBe('2026-12-05');
  });

  it('removes the little word in front of the date', () => {
    expect(parseQuickAdd('lab report by fri', WED)).toMatchObject({ title: 'Lab report', due: '2026-11-13' });
    expect(parseQuickAdd('lab report for tomorrow', WED)).toMatchObject({ title: 'Lab report', due: '2026-11-12' });
    expect(parseQuickAdd('lab report is due fri', WED)).toMatchObject({ title: 'Lab report', due: '2026-11-13' });
  });
});

describe('quick add: numbers that are not dates', () => {
  it('leaves exercise and page numbers alone', () => {
    expect(parseQuickAdd('maths ex 4.2', WED)).toMatchObject({ title: 'Maths ex 4.2' });
    expect(parseQuickAdd('maths ex 4.2', WED).due).toBeUndefined();
    expect(parseQuickAdd('read pages 12/13', WED).due).toBeUndefined();
    expect(parseQuickAdd('do q 3.1 and 3.2 for mon', WED)).toMatchObject({ title: 'Do q 3.1 and 3.2', due: '2026-11-16' });
  });

  it('ignores a date that does not exist', () => {
    const r = parseQuickAdd('hw 30.2', WED);
    expect(r.due).toBeUndefined();
    expect(r.title).toBe('Hw 30.2');
  });

  it('a clear date wins over a bare number', () => {
    expect(parseQuickAdd('1.5 worksheet fri', WED)).toMatchObject({ title: '1.5 worksheet', due: '2026-11-13' });
  });
});

describe('quick add: kinds', () => {
  it('exam words', () => {
    for (const text of ['bio test', 'bio mock', 'bio quiz', 'bio midterm', 'physics final dec 10', 'end of unit assessment']) {
      expect(parseQuickAdd(text, WED).kind, text).toBe('exam');
    }
  });

  it('things to do that mention an exam are still homework', () => {
    for (const text of ['revise for chem test thu', 'test corrections', 'practice test paper 2', 'chem exam hw']) {
      expect(parseQuickAdd(text, WED).kind, text).toBe('homework');
    }
  });

  it('goals', () => {
    expect(parseQuickAdd('goal finish chem notes by sun', WED)).toMatchObject({
      kind: 'goal_short',
      title: 'Finish chem notes',
      due: '2026-11-15',
    });
    expect(parseQuickAdd('Goal: read 20 pages a day', WED)).toMatchObject({ kind: 'goal_short', title: 'Read 20 pages a day' });
    expect(parseQuickAdd('long term goal learn to touch type', WED)).toMatchObject({
      kind: 'goal_long',
      title: 'Learn to touch type',
    });
  });

  it('copes with empty and date only input', () => {
    expect(parseQuickAdd('', WED)).toMatchObject({ kind: 'homework', title: 'Homework' });
    expect(parseQuickAdd('   fri  ', WED)).toMatchObject({ kind: 'homework', title: 'Homework', due: '2026-11-13' });
  });

  it('reports the text it read as the date', () => {
    expect(parseQuickAdd('chem exam 20 Nov', WED).dateText).toBe('20 Nov');
  });
});
