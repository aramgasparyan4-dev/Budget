// Quick add parser: turns one typed line into a task.
//
//   parseQuickAdd('maths ex 4.2 due fri', '2026-11-13')
//     -> { kind: 'homework', title: 'Maths ex 4.2', due: '2026-11-20', subject: 'Maths' }
//
// `today` is passed in, so the parser never reads the clock.

import { addDays, addMonths, makeDate, weekdayOf } from './dates.ts';
import type { LocalDate } from './dates.ts';
import { detectSubject } from './subjects.ts';
import type { TaskKind } from './types.ts';

export interface ParsedTask {
  kind: TaskKind;
  title: string;
  due?: LocalDate;
  subject?: string;
  /** The part of the text that was read as the date, for showing in the UI. */
  dateText?: string;
}

// ------------------------------------------------------------ word lists

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const TODAY_WORDS = new Set(['today', 'tod', 'tonight']);
const TOMORROW_WORDS = new Set(['tomorrow', 'tmrw', 'tmr', 'tmw', 'tomoz']);

/** Words that sit in front of a date and are not part of the title. */
const CONNECTORS = new Set(['due', 'by', 'on', 'for', 'until', 'till', 'before']);
/** Connectors that make it certain the next thing is a date. */
const STRONG_CONNECTORS = new Set(['due', 'by', 'on', 'until', 'till', 'before']);

/** After one of these, a number like 4.2 or 3/4 is a reference, not a date. */
const REFERENCE_WORDS = new Set([
  'ex', 'exercise', 'exercises', 'page', 'pages', 'p', 'pg', 'pp', 'q', 'qs',
  'question', 'questions', 'chapter', 'ch', 'chap', 'unit', 'section', 'sec',
  'task', 'tasks', 'part', 'no', 'number', 'worksheet', 'ws', 'paper', 'topic',
  'lesson', 'module', 'problem', 'problems', 'set', 'book', 'vol',
]);

const EXAM_WORDS = new Set([
  'exam', 'exams', 'examination', 'test', 'mock', 'mocks', 'quiz',
  'midterm', 'midterms', 'final', 'finals', 'assessment', 'olympiad',
]);

/** If one of these is present, the line is something to do, not an exam. */
const HOMEWORK_WORDS = new Set([
  'hw', 'h/w', 'homework', 'coursework', 'worksheet', 'draft', 'essay',
  'corrections', 'revise', 'revision', 'study', 'prep', 'prepare',
  'practice', 'practise', 'notes', 'project',
]);

const GOAL_PREFIXES: Array<[words: string[], kind: TaskKind]> = [
  [['long', 'term', 'goal'], 'goal_long'],
  [['long-term', 'goal'], 'goal_long'],
  [['longterm', 'goal'], 'goal_long'],
  [['long', 'goal'], 'goal_long'],
  [['lt', 'goal'], 'goal_long'],
  [['short', 'term', 'goal'], 'goal_short'],
  [['short-term', 'goal'], 'goal_short'],
  [['short', 'goal'], 'goal_short'],
  [['st', 'goal'], 'goal_short'],
  [['goal'], 'goal_short'],
];

// --------------------------------------------------------------- tokens

interface Token {
  /** Exactly what was typed. */
  raw: string;
  /** Lower case, with brackets and trailing punctuation removed. */
  w: string;
}

function tokenize(input: string): Token[] {
  return input
    .trim()
    .split(/\s+/)
    .filter((raw) => raw.length > 0)
    .map((raw) => ({
      raw,
      w: raw.toLowerCase().replace(/^[("'[]+/, '').replace(/[)"'\],.;:!?]+$/, ''),
    }));
}

// ---------------------------------------------------------------- dates

interface DateMatch {
  start: number;
  len: number;
  date: LocalDate;
  /** A bare number like 20.11 or 20th. Only accepted in some positions. */
  ambiguous: boolean;
}

/** The next time this weekday comes round. Today's own weekday means a week from now. */
function upcomingWeekday(today: LocalDate, weekday: number, allowToday = false): LocalDate {
  let ahead = (weekday - weekdayOf(today) + 7) % 7;
  if (ahead === 0 && !allowToday) ahead = 7;
  return addDays(today, ahead);
}

/** The weekday in the week after this one (weeks start on Monday). */
function weekdayNextWeek(today: LocalDate, weekday: number): LocalDate {
  const toNextMonday = ((1 - weekdayOf(today) + 7) % 7) || 7;
  const fromMonday = (weekday + 6) % 7;
  return addDays(today, toNextMonday + fromMonday);
}

/** Day and month with no year: this year, or next year if that day has passed. */
function resolveDayMonth(day: number, month: number, today: LocalDate): LocalDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = makeDate(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return makeDate(year + 1, month, day);
}

function parseDayNumber(w: string): { day: number; ordinal: boolean } | null {
  const m = /^(\d{1,2})(st|nd|rd|th)?$/.exec(w);
  if (!m) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  return { day, ordinal: m[2] !== undefined };
}

function parseYear(w: string | undefined): number | null {
  if (!w || !/^\d{4}$/.test(w)) return null;
  const y = Number(w);
  return y >= 2000 && y <= 2100 ? y : null;
}

function matchDateAt(tokens: Token[], i: number, today: LocalDate): DateMatch | null {
  const t0 = tokens[i];
  if (!t0) return null;
  const w0 = t0.w;
  const w1 = tokens[i + 1]?.w;
  const w2 = tokens[i + 2]?.w;
  const w3 = tokens[i + 3]?.w;
  const hit = (len: number, date: LocalDate | null, ambiguous = false): DateMatch | null =>
    date ? { start: i, len, date, ambiguous } : null;

  // day after tomorrow
  if (w0 === 'day' && w1 === 'after' && w2 !== undefined && TOMORROW_WORDS.has(w2)) {
    return hit(3, addDays(today, 2));
  }

  // next week, next month, next friday, this friday
  if (w0 === 'next' && w1 !== undefined) {
    if (w1 === 'week' || w1 === 'wk') return hit(2, addDays(today, 7));
    if (w1 === 'month') return hit(2, addMonths(today, 1));
    const wd = WEEKDAYS[w1];
    if (wd !== undefined) return hit(2, weekdayNextWeek(today, wd));
  }
  if (w0 === 'this' && w1 !== undefined) {
    const wd = WEEKDAYS[w1];
    if (wd !== undefined) return hit(2, upcomingWeekday(today, wd, true));
  }

  // in 3 days, in 2 weeks, in a month
  if (w0 === 'in' && w1 !== undefined && w2 !== undefined) {
    const n = /^\d{1,3}$/.test(w1) ? Number(w1) : NUMBER_WORDS[w1];
    if (n !== undefined) {
      if (/^days?$/.test(w2)) return hit(3, addDays(today, n));
      if (/^(weeks?|wks?)$/.test(w2)) return hit(3, addDays(today, n * 7));
      if (/^months?$/.test(w2)) return hit(3, addMonths(today, n));
    }
  }

  // 20 nov, 20th of november, 20 nov 2027
  const dayFirst = parseDayNumber(w0);
  if (dayFirst) {
    const skipOf = w1 === 'of' ? 1 : 0;
    const monthWord = skipOf ? w2 : w1;
    const month = monthWord !== undefined ? MONTHS[monthWord] : undefined;
    if (month !== undefined) {
      const year = parseYear(skipOf ? w3 : w2);
      if (year !== null) return hit(3 + skipOf, makeDate(year, month, dayFirst.day));
      return hit(2 + skipOf, resolveDayMonth(dayFirst.day, month, today));
    }
  }

  // jan 12, nov 20th, january 12 2027
  const monthFirst = MONTHS[w0];
  if (monthFirst !== undefined && w1 !== undefined) {
    const day = parseDayNumber(w1);
    if (day) {
      const year = parseYear(w2);
      if (year !== null) return hit(3, makeDate(year, monthFirst, day.day));
      return hit(2, resolveDayMonth(day.day, monthFirst, today));
    }
  }

  // single words
  if (TODAY_WORDS.has(w0)) return hit(1, today);
  if (TOMORROW_WORDS.has(w0)) return hit(1, addDays(today, 1));

  const weekday = WEEKDAYS[w0];
  // 'SAT' in capitals is the exam, not Saturday.
  if (weekday !== undefined && !(w0 === 'sat' && t0.raw.startsWith('SAT'))) {
    return hit(1, upcomingWeekday(today, weekday));
  }

  // 2026-11-20
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w0);
  if (iso) return hit(1, makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3])));

  // 20.11, 20/11, 20.11.26, 20/11/2026 (day first)
  const numeric = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/.exec(w0);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (numeric[3] !== undefined) {
      const y = Number(numeric[3]);
      return hit(1, makeDate(y < 100 ? 2000 + y : y, month, day));
    }
    return hit(1, resolveDayMonth(day, month, today), true);
  }

  // the 20th, 20th
  if (w0 === 'the' && w1 !== undefined) {
    const d = parseDayNumber(w1);
    if (d?.ordinal) return hit(2, nextDayOfMonth(d.day, today));
  }
  if (dayFirst?.ordinal) return hit(1, nextDayOfMonth(dayFirst.day, today), true);

  return null;
}

/** The next time the calendar shows this day number, today included. */
function nextDayOfMonth(day: number, today: LocalDate): LocalDate | null {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  for (let i = 0; i < 12; i++) {
    const m = ((month - 1 + i) % 12) + 1;
    const y = year + Math.floor((month - 1 + i) / 12);
    const date = makeDate(y, m, day);
    if (date && date >= today) return date;
  }
  return null;
}

function findDate(tokens: Token[], today: LocalDate): DateMatch | null {
  const all: DateMatch[] = [];
  for (let i = 0; i < tokens.length; ) {
    const m = matchDateAt(tokens, i, today);
    if (m) {
      all.push(m);
      i += m.len;
    } else {
      i++;
    }
  }

  const before = (m: DateMatch): string | undefined => tokens[m.start - 1]?.w;
  const afterStrong = (m: DateMatch): boolean => STRONG_CONNECTORS.has(before(m) ?? '');
  const hasClearDate = all.some((m) => !m.ambiguous);

  const usable = all.filter((m) => {
    if (!m.ambiguous) return true;
    if (afterStrong(m)) return true;
    // A bare number only counts as a date at the very start or end of the
    // line, when nothing clearer is there and it is not 'ex 4.2' or 'page 3/4'.
    if (hasClearDate) return false;
    if (REFERENCE_WORDS.has(before(m) ?? '')) return false;
    return m.start === 0 || m.start + m.len === tokens.length;
  });

  return usable.find(afterStrong) ?? usable[usable.length - 1] ?? null;
}

// ----------------------------------------------------------------- main

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function parseQuickAdd(input: string, today: LocalDate): ParsedTask {
  let tokens = tokenize(input);

  // 'goal ...' and 'long goal ...' at the start pick the kind.
  let kind: TaskKind | null = null;
  for (const [words, goalKind] of GOAL_PREFIXES) {
    if (words.every((w, i) => tokens[i]?.w === w)) {
      kind = goalKind;
      tokens = tokens.slice(words.length);
      break;
    }
  }

  // Pull the date out of the line.
  const match = findDate(tokens, today);
  let dateText: string | undefined;
  if (match) {
    dateText = tokens
      .slice(match.start, match.start + match.len)
      .map((t) => t.raw)
      .join(' ');
    let from = match.start;
    if (CONNECTORS.has(tokens[from - 1]?.w ?? '')) from--;
    if (from > 0 && tokens[from - 1]?.w === 'is' && tokens[from]?.w === 'due') from--;
    tokens = [...tokens.slice(0, from), ...tokens.slice(match.start + match.len)];
  }

  // Tidy loose ends left behind, like a trailing 'due' or '-'.
  while (tokens.length > 0) {
    const last = tokens[tokens.length - 1]!;
    if (CONNECTORS.has(last.w) || /^[-–@,:]*$/.test(last.raw)) tokens = tokens.slice(0, -1);
    else break;
  }
  while (tokens.length > 0 && /^[-–,:]*$/.test(tokens[0]!.raw)) tokens = tokens.slice(1);

  const words = tokens.map((t) => t.w);
  if (kind === null) {
    const looksLikeExam = words.some((w) => EXAM_WORDS.has(w));
    const looksLikeHomework = words.some((w) => HOMEWORK_WORDS.has(w));
    kind = looksLikeExam && !looksLikeHomework ? 'exam' : 'homework';
  }

  let title = tokens
    .map((t) => t.raw)
    .join(' ')
    .replace(/[,;:]+$/, '')
    .trim();
  if (title.length === 0) {
    title = kind === 'exam' ? 'Exam' : kind === 'homework' ? 'Homework' : 'Goal';
  }

  const result: ParsedTask = { kind, title: capitalise(title) };
  if (match) {
    result.due = match.date;
    result.dateText = dateText;
  }
  const subject = detectSubject(words);
  if (subject) result.subject = subject;
  return result;
}
