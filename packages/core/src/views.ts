// Ready-made lists for the screens: which tasks go under which heading.
// Kept here so the desktop panel and the phone app show the same thing.

import { addDays, dateOf, diffDays } from './dates.ts';
import type { LocalDate, LocalDateTime } from './dates.ts';
import { activityEvents, liveTasks } from './mood.ts';
import type { Session, Task, TaskKind } from './types.ts';

export const KIND_LABEL: Record<TaskKind, string> = {
  homework: 'Homework',
  exam: 'Exam',
  goal_short: 'Goal',
  goal_long: 'Long term goal',
  revision: 'Revision',
};

const byDue = (a: Task, b: Task): number => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : a.title.localeCompare(b.title));

export interface TodayGroups {
  /** Past their date and not done. Exams never land here: a past exam is just over. */
  overdue: Task[];
  today: Task[];
  tomorrow: Task[];
  /** The rest of the next 7 days. */
  week: Task[];
  later: Task[];
  /** Homework and short goals with no date. */
  undated: Task[];
  doneToday: Task[];
}

/** Everything for the Today screen. Long term goals live on the Goals screen. */
export function todayGroups(tasks: Task[], today: LocalDate): TodayGroups {
  const groups: TodayGroups = { overdue: [], today: [], tomorrow: [], week: [], later: [], undated: [], doneToday: [] };
  const tomorrow = addDays(today, 1);

  for (const t of liveTasks(tasks)) {
    if (t.doneAt) {
      if (dateOf(t.doneAt) === today) groups.doneToday.push(t);
      continue;
    }
    if (t.kind === 'goal_long') continue;
    if (!t.due) {
      groups.undated.push(t);
    } else if (t.due < today) {
      if (t.kind !== 'exam') groups.overdue.push(t);
    } else if (t.due === today) {
      groups.today.push(t);
    } else if (t.due === tomorrow) {
      groups.tomorrow.push(t);
    } else if (diffDays(t.due, today) <= 7) {
      groups.week.push(t);
    } else {
      groups.later.push(t);
    }
  }

  for (const list of [groups.overdue, groups.today, groups.tomorrow, groups.week, groups.later]) list.sort(byDue);
  groups.undated.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  groups.doneToday.sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1));
  return groups;
}

export interface ExamView {
  exam: Task;
  daysLeft: number;
  /** Revision days I accepted for this exam, soonest first. */
  revision: Task[];
  /** Minutes of revision logged for this exam so far. */
  minutes: number;
}

/** Exams that are today or still to come, soonest first. */
export function upcomingExams(tasks: Task[], sessions: Session[], today: LocalDate): ExamView[] {
  const live = liveTasks(tasks);
  const byId = new Map(live.map((t) => [t.id, t]));
  return live
    .filter((t) => t.kind === 'exam' && !t.doneAt && t.due !== undefined && t.due >= today)
    .sort(byDue)
    .map((exam) => {
      let minutes = 0;
      for (const s of sessions) {
        if (s.deletedAt || !s.endedAt) continue;
        const task = s.taskId ? byId.get(s.taskId) : undefined;
        if (s.taskId === exam.id || task?.examId === exam.id) minutes += s.minutes;
      }
      return {
        exam,
        daysLeft: diffDays(exam.due!, today),
        revision: live.filter((t) => t.examId === exam.id && t.kind === 'revision').sort(byDue),
        minutes,
      };
    });
}

export interface GoalView {
  goal: Task;
  /** When I last worked on it, if ever. */
  lastTouched?: LocalDateTime;
  /** Total minutes logged on it. */
  minutes: number;
}

/** Open goals, short term first. */
export function openGoals(tasks: Task[], sessions: Session[]): GoalView[] {
  const touched = new Map<string, LocalDateTime>();
  for (const e of activityEvents(tasks, sessions)) {
    if (e.taskId && e.type === 'session') touched.set(e.taskId, e.at);
  }
  return liveTasks(tasks)
    .filter((t) => (t.kind === 'goal_short' || t.kind === 'goal_long') && !t.doneAt)
    .sort((a, b) => (a.kind === b.kind ? (a.createdAt < b.createdAt ? -1 : 1) : a.kind === 'goal_short' ? -1 : 1))
    .map((goal) => {
      const view: GoalView = {
        goal,
        minutes: sessions.filter((s) => !s.deletedAt && s.endedAt && s.taskId === goal.id).reduce((n, s) => n + s.minutes, 0),
      };
      const last = touched.get(goal.id);
      if (last) view.lastTouched = last;
      return view;
    });
}

/** Tasks I could start a focus session on: anything open, most urgent first. */
export function focusChoices(tasks: Task[], today: LocalDate): Task[] {
  const open = liveTasks(tasks).filter((t) => !t.doneAt && !(t.kind === 'exam' && t.due !== undefined && t.due < today));
  const dated = open.filter((t) => t.due !== undefined).sort(byDue);
  const undated = open.filter((t) => t.due === undefined);
  return [...dated, ...undated];
}
