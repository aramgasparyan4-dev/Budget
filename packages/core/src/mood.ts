// The mood engine.
//
//   evaluateMood(tasks, sessions, settings, now) -> { mood, message, reason, ... }
//
// A pure function: it reads no clock and no storage. Give it the same input
// and it gives the same answer, which is what makes it easy to test.
//
// The rules are checked from top to bottom and the first match wins:
//
//   1. focus      a focus session is running. Never nags.
//   2. celebrate  something was finished in the last few seconds.
//   3. sleepy     snoozed, quiet hours, or a day off with nothing done.
//   4. happy / proud right after finishing something (the "afterglow").
//   5. grumpy     homework is overdue, or it is evening, nothing is done
//                 today and something is due tomorrow or an exam is near.
//   6. worried    homework is due today and it is afternoon, or an exam is
//                 near with no revision today or yesterday.
//   7. happy / proud because something was done today.
//   8. neutral    everything else.

import {
  addDays,
  addMinutes,
  addSeconds,
  atTime,
  dateOf,
  diffDays,
  diffSeconds,
  formatDate,
  formatDay,
  hmOf,
  minutesOf,
  onDay,
  parseHM,
  weekdayOf,
} from './dates.ts';
import type { LocalDate, LocalDateTime } from './dates.ts';
import { computeStreak } from './streak.ts';
import type { Mood, MoodResult, QuietWindow, ReasonCode, Session, Settings, Task } from './types.ts';

/** How far ahead "Next: ..." looks. Nothing further away is ever mentioned. */
const LOOKAHEAD_DAYS = 13;

// ------------------------------------------------------------- activity

/** One thing I finished: a ticked task or a counted session. */
export interface ActivityEvent {
  at: LocalDateTime;
  type: 'task' | 'session';
  /** Words for the message, for example 'Maths hw is done'. */
  label: string;
  taskId?: string;
}

export function liveTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.deletedAt && !t.skippedAt);
}

/** Sessions that are finished and long enough to count. */
export function countedSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => !s.deletedAt && s.endedAt !== undefined && s.minutes > 0);
}

function minutesText(n: number): string {
  return n === 1 ? '1 minute' : `${n} minutes`;
}

/** Everything finished, oldest first. */
export function activityEvents(tasks: Task[], sessions: Session[]): ActivityEvent[] {
  const live = liveTasks(tasks);
  const byId = new Map(live.map((t) => [t.id, t]));
  const events: ActivityEvent[] = [];

  for (const t of live) {
    if (t.doneAt) events.push({ at: t.doneAt, type: 'task', label: `${t.title} is done`, taskId: t.id });
  }
  for (const s of countedSessions(sessions)) {
    const task = s.taskId ? byId.get(s.taskId) : undefined;
    const what = task?.title ?? s.subject;
    const label = what ? `${minutesText(s.minutes)} on ${what}` : `${minutesText(s.minutes)} of work`;
    const event: ActivityEvent = { at: s.endedAt!, type: 'session', label };
    if (task) event.taskId = task.id;
    events.push(event);
  }

  // Oldest first. When a session and its task finish at the same moment,
  // the session comes last so its message is the one shown.
  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.type === b.type ? 0 : a.type === 'task' ? -1 : 1));
}

// ------------------------------------------------------------- revision

/** Did I revise for this exam on this day? */
export function revisedOn(exam: Task, day: LocalDate, tasks: Task[], sessions: Session[]): boolean {
  const live = liveTasks(tasks);
  const byId = new Map(live.map((t) => [t.id, t]));

  for (const s of countedSessions(sessions)) {
    if (dateOf(s.endedAt!) !== day) continue;
    const task = s.taskId ? byId.get(s.taskId) : undefined;
    if (s.taskId === exam.id || task?.examId === exam.id) return true;
    const subject = s.subject ?? task?.subject;
    if (exam.subject && subject === exam.subject) return true;
  }
  for (const t of live) {
    if (!t.doneAt || dateOf(t.doneAt) !== day || t.kind !== 'revision') continue;
    if (t.examId === exam.id) return true;
    if (exam.subject && t.subject === exam.subject) return true;
  }
  return false;
}

// ---------------------------------------------------------- quiet hours

interface ActiveQuiet {
  window: QuietWindow;
  endsAt: LocalDateTime;
}

function activeQuietWindow(settings: Settings, now: LocalDateTime): ActiveQuiet | null {
  const today = dateOf(now);
  const mins = minutesOf(now);
  const weekday = weekdayOf(today);
  const yesterdayWeekday = (weekday + 6) % 7;

  for (const window of settings.quietHours) {
    const from = parseHM(window.from);
    const to = parseHM(window.to);
    if (from === to) continue;
    if (from < to) {
      if (window.days.includes(weekday) && mins >= from && mins < to) {
        return { window, endsAt: atTime(today, window.to) };
      }
    } else {
      // Runs past midnight.
      if (window.days.includes(weekday) && mins >= from) {
        return { window, endsAt: atTime(addDays(today, 1), window.to) };
      }
      if (window.days.includes(yesterdayWeekday) && mins < to) {
        return { window, endsAt: atTime(today, window.to) };
      }
    }
  }
  return null;
}

/** True when the star should stay silent: snoozed, a day off, or quiet hours. */
export function isQuiet(settings: Settings, now: LocalDateTime): boolean {
  if (settings.snoozeUntil && settings.snoozeUntil > now) return true;
  if (settings.daysOff.includes(dateOf(now))) return true;
  return activeQuietWindow(settings, now) !== null;
}

// ---------------------------------------------------------- next check

function nextCheckAt(
  sessions: Session[],
  settings: Settings,
  now: LocalDateTime,
  lastEvent: ActivityEvent | undefined,
): LocalDateTime {
  const today = dateOf(now);
  const tomorrow = addDays(today, 1);
  const candidates: LocalDateTime[] = [`${tomorrow}T00:00:00`];

  for (const s of sessions) {
    if (!s.deletedAt && s.kind === 'focus' && !s.endedAt) {
      candidates.push(addMinutes(s.startedAt, s.plannedMinutes));
    }
  }
  if (lastEvent) {
    candidates.push(addSeconds(lastEvent.at, settings.celebrateSeconds));
    candidates.push(addMinutes(lastEvent.at, settings.afterglowMinutes));
  }
  if (settings.snoozeUntil) candidates.push(settings.snoozeUntil);
  candidates.push(atTime(today, settings.afternoonTime), atTime(today, settings.eveningTime));
  for (const q of settings.quietHours) {
    candidates.push(atTime(today, q.from), atTime(today, q.to));
  }

  let best = candidates[0]!;
  for (const c of candidates) {
    if (c > now && c < best) best = c;
  }
  return best;
}

// ------------------------------------------------------------ the engine

export function evaluateMood(
  tasks: Task[],
  sessions: Session[],
  settings: Settings,
  now: LocalDateTime,
): MoodResult {
  const today = dateOf(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const mins = minutesOf(now);

  const live = liveTasks(tasks);
  const byId = new Map(live.map((t) => [t.id, t]));
  const open = live.filter((t) => !t.doneAt);
  const byDue = (a: Task, b: Task): number => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : 0);

  const events = activityEvents(tasks, sessions);
  const lastEvent = events[events.length - 1];
  const todayEvents = events.filter((e) => dateOf(e.at) === today);
  const didToday = todayEvents.length > 0;

  const next = nextCheckAt(sessions, settings, now, lastEvent);
  const result = (mood: Mood, code: ReasonCode, message: string, reason: string, taskId?: string): MoodResult => {
    const r: MoodResult = { mood, code, message, reason, nextCheckAt: next };
    if (taskId) r.taskId = taskId;
    return r;
  };

  // ------------------------------------------------------------ 1. focus
  const running = sessions
    .filter(
      (s) =>
        !s.deletedAt &&
        s.kind === 'focus' &&
        !s.endedAt &&
        s.startedAt <= now &&
        now < addMinutes(s.startedAt, s.plannedMinutes),
    )
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  if (running) {
    const task = running.taskId ? byId.get(running.taskId) : undefined;
    const until = hmOf(addMinutes(running.startedAt, running.plannedMinutes));
    return result(
      'focus',
      'focus',
      task ? `Focusing on ${task.title} until ${until}.` : `Focus time until ${until}.`,
      'A focus session is running.',
      task?.id,
    );
  }

  // -------------------------------------------------------- 2. celebrate
  if (lastEvent) {
    const ago = diffSeconds(now, lastEvent.at);
    if (ago >= 0 && ago < settings.celebrateSeconds) {
      return result('celebrate', 'just_finished', `${lastEvent.label}!`, 'You just finished something.', lastEvent.taskId);
    }
  }

  // ------------------------------------------- what is still on my plate
  const dated = open.filter((t) => t.due !== undefined);
  const overdueHomework = dated.filter((t) => t.kind === 'homework' && t.due! < today).sort(byDue);
  const homeworkDueToday = dated.filter((t) => t.kind === 'homework' && t.due === today);
  const homeworkDueTomorrow = dated.filter((t) => t.kind === 'homework' && t.due === tomorrow);
  const upcomingExams = dated.filter((t) => t.kind === 'exam' && t.due! >= today).sort(byDue);
  const examsToday = upcomingExams.filter((t) => t.due === today);
  // Exams that are close, not counting one that is today: on the day itself
  // it is too late for "you should revise", so the star just wishes luck.
  const nearExams = upcomingExams.filter((t) => {
    const days = diffDays(t.due!, today);
    return days >= 1 && days <= settings.examWarningDays;
  });
  // Anything with a date of today or tomorrow, plus overdue homework.
  const dueSoon = [
    ...overdueHomework,
    ...dated.filter((t) => t.kind !== 'goal_long' && (t.due === today || t.due === tomorrow)).sort(byDue),
  ];

  const positive = (): MoodResult => {
    const done =
      todayEvents.length === 1 ? todayEvents[0]!.label : `${todayEvents.length} things done today`;
    if (dueSoon.length === 0) {
      const streak = computeStreak(tasks, sessions, settings, today).days;
      const tail = streak >= 3 ? ` ${streak} days in a row.` : '';
      return result(
        'proud',
        'all_clear',
        `${done}. Nothing due today or tomorrow.${tail}`,
        'You did something today and nothing is due today or tomorrow.',
      );
    }
    const nextTask = dueSoon[0]!;
    const when =
      nextTask.due! < today
        ? `was due ${formatDay(nextTask.due!, today)}`
        : nextTask.kind === 'exam'
          ? `is ${onDay(nextTask.due!, today)}`
          : `is due ${formatDay(nextTask.due!, today)}`;
    return result(
      'happy',
      'did_something',
      `${done}. Next: ${nextTask.title} ${when}.`,
      'You did something today.',
      nextTask.id,
    );
  };

  // ----------------------------------------------------------- 3. sleepy
  if (settings.snoozeUntil && settings.snoozeUntil > now) {
    const until =
      dateOf(settings.snoozeUntil) === today
        ? hmOf(settings.snoozeUntil)
        : `${formatDay(dateOf(settings.snoozeUntil), today)} ${hmOf(settings.snoozeUntil)}`;
    return result('sleepy', 'snooze', `Snoozed until ${until}.`, 'You snoozed the star.');
  }
  const quiet = activeQuietWindow(settings, now);
  if (quiet) {
    return result(
      'sleepy',
      'quiet_hours',
      `Quiet until ${hmOf(quiet.endsAt)}.`,
      `Quiet hours (${quiet.window.label}).`,
    );
  }
  if (settings.daysOff.includes(today)) {
    // A day off never nags. If I work anyway, the star is still pleased.
    if (didToday) return positive();
    return result('sleepy', 'day_off', 'Day off. Back tomorrow.', 'Today is a day off.');
  }

  // -------------------------------------------------------- 4. afterglow
  if (lastEvent && dateOf(lastEvent.at) === today) {
    const ago = diffSeconds(now, lastEvent.at);
    if (ago >= 0 && ago < settings.afterglowMinutes * 60) return positive();
  }

  // ----------------------------------------------------------- 5. grumpy
  const firstOverdue = overdueHomework[0];
  if (firstOverdue) {
    const more = overdueHomework.length - 1;
    const moreText = more === 0 ? '' : more === 1 ? ' 1 more is overdue too.' : ` ${more} more are overdue too.`;
    if (didToday) {
      // Doing things counts for more than not doing them: a day with work
      // in it softens grumpy to worried.
      return result(
        'worried',
        'overdue_but_active',
        `${firstOverdue.title} is still overdue. It was due ${formatDay(firstOverdue.due!, today)}.${moreText}`,
        'Homework is overdue, but you did something today.',
        firstOverdue.id,
      );
    }
    return result(
      'grumpy',
      'overdue',
      `${firstOverdue.title} was due ${formatDay(firstOverdue.due!, today)}.${moreText}`,
      'Homework is overdue.',
      firstOverdue.id,
    );
  }

  if (mins >= parseHM(settings.eveningTime) && !didToday) {
    const dueTomorrow = homeworkDueTomorrow[0];
    if (dueTomorrow) {
      return result(
        'grumpy',
        'evening_nothing_done',
        `Nothing done yet today, and ${dueTomorrow.title} is due tomorrow.`,
        'It is evening, nothing is done today, and homework is due tomorrow.',
        dueTomorrow.id,
      );
    }
    const exam = nearExams[0];
    if (exam) {
      return result(
        'grumpy',
        'evening_nothing_done',
        `Nothing done yet today, and ${exam.title} is ${onDay(exam.due!, today)}.`,
        'It is evening, nothing is done today, and an exam is close.',
        exam.id,
      );
    }
  }

  // ---------------------------------------------------------- 6. worried
  const dueToday = homeworkDueToday[0];
  if (dueToday && mins >= parseHM(settings.afternoonTime)) {
    const more = homeworkDueToday.length - 1;
    const subject = more === 0 ? `${dueToday.title} is` : `${dueToday.title} and ${more} more are`;
    return result(
      'worried',
      'due_today',
      `${subject} due today.`,
      'Homework is due today and it is afternoon.',
      dueToday.id,
    );
  }

  const unrevised = nearExams.find(
    (exam) => !revisedOn(exam, today, tasks, sessions) && !revisedOn(exam, yesterday, tasks, sessions),
  );
  if (unrevised) {
    return result(
      'worried',
      'exam_no_revision',
      `${unrevised.title} is ${onDay(unrevised.due!, today)}. No revision today or yesterday.`,
      'An exam is close and there was no revision today or yesterday.',
      unrevised.id,
    );
  }

  // --------------------------------------------------- 7. happy or proud
  if (didToday) return positive();

  // ---------------------------------------------------------- 8. neutral
  const examToday = examsToday[0];
  if (examToday) {
    return result('neutral', 'exam_today', `${examToday.title} is today. Good luck.`, 'An exam is today.', examToday.id);
  }

  // A goal whose date has gone by. No guilt, just a question.
  const pastGoal = dated.filter((t) => t.kind === 'goal_short' && t.due! < today).sort(byDue)[0];
  if (pastGoal) {
    return result(
      'neutral',
      'goal_past_date',
      `${pastGoal.title} was planned for ${formatDay(pastGoal.due!, today)}. Pick a new date?`,
      'A goal has passed its date.',
      pastGoal.id,
    );
  }

  // A goal I have not touched for a while.
  const lastTouch = new Map<string, LocalDateTime>();
  for (const e of events) {
    if (e.taskId) lastTouch.set(e.taskId, e.at);
  }
  let stale: { task: Task; since: LocalDate } | undefined;
  for (const t of open) {
    if (t.kind !== 'goal_short' && t.kind !== 'goal_long') continue;
    const since = dateOf(lastTouch.get(t.id) ?? t.createdAt);
    if (diffDays(today, since) < settings.goalStaleDays) continue;
    if (!stale || since < stale.since) stale = { task: t, since };
  }
  if (stale) {
    return result(
      'neutral',
      'stale_goal',
      `Your goal "${stale.task.title}" has been quiet since ${formatDate(stale.since, today)}.`,
      `A goal has not been touched for ${settings.goalStaleDays} days or more.`,
      stale.task.id,
    );
  }

  // The next thing coming up, but never something two weeks away.
  const nextTask = dated
    .filter((t) => t.kind !== 'goal_long' && t.due! >= today && diffDays(t.due!, today) <= LOOKAHEAD_DAYS)
    .sort(byDue)[0];
  if (nextTask) {
    const when = nextTask.kind === 'exam' ? `is ${onDay(nextTask.due!, today)}` : `is due ${formatDay(nextTask.due!, today)}`;
    return result('neutral', 'next_up', `Next: ${nextTask.title} ${when}.`, 'Nothing needs attention right now.', nextTask.id);
  }

  return result('neutral', 'nothing_due', 'Nothing due soon.', 'Nothing is due in the next two weeks.');
}
