import type { LocalDate, LocalDateTime } from './dates.ts';

// ---------------------------------------------------------------- tasks

/**
 * homework    something set by a teacher, with a due date
 * exam        a test of any size (exam, test, mock, quiz)
 * goal_short  something I want done soon, may have a date
 * goal_long   a long term aim, usually no date
 * revision    a planned revision day for one exam
 */
export type TaskKind = 'homework' | 'exam' | 'goal_short' | 'goal_long' | 'revision';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  /** Subject name from the built in list, for example 'Chemistry'. */
  subject?: string;
  /** Day it is due, or the day of the exam. */
  due?: LocalDate;
  /** When it was ticked off. */
  doneAt?: LocalDateTime;
  /** Set on a suggested revision day that I chose to skip. */
  skippedAt?: LocalDateTime;
  /** For revision tasks: the exam they belong to. */
  examId?: string;
  /** For revision tasks: how many days before the exam. */
  revisionOffset?: number;
  createdAt: LocalDateTime;

  // Sync bookkeeping. Newest updatedAt wins. A deleted record is kept with
  // deletedAt set, so the delete can travel to the other device.
  updatedAt: number;
  deletedAt?: number;
}

// ------------------------------------------------------------- sessions

/**
 * focus   a timer session. Running while endedAt is missing.
 * manual  revision I did away from the timer and logged by hand.
 */
export type SessionKind = 'focus' | 'manual';

export interface Session {
  id: string;
  kind: SessionKind;
  /** What I was working on, if I picked something. */
  taskId?: string;
  subject?: string;
  startedAt: LocalDateTime;
  plannedMinutes: number;
  endedAt?: LocalDateTime;
  /** Minutes that count. 0 while the session is still running. */
  minutes: number;

  updatedAt: number;
  deletedAt?: number;
}

// ------------------------------------------------------------- settings

export interface QuietWindow {
  label: string;
  /** Weekdays the window starts on. 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** 'HH:MM'. If `to` is earlier than `from`, the window runs past midnight. */
  from: string;
  to: string;
}

export interface Settings {
  /** Homework due today starts to worry the star from this time. */
  afternoonTime: string;
  /** After this time, a day with nothing done can make the star grumpy. */
  eveningTime: string;
  /** Time of the morning reminder on exam days. */
  morningTime: string;
  /** An exam this many days away or closer counts as near. */
  examWarningDays: number;
  /** A goal untouched for this many days gets a gentle mention. */
  goalStaleDays: number;
  /** Default focus session length. */
  focusMinutes: number;
  /** A focus session stopped earlier than this is thrown away. */
  minSessionMinutes: number;
  /** Suggested revision days, counted back from the exam. */
  revisionOffsets: number[];
  /** How long the star celebrates after I finish something. */
  celebrateSeconds: number;
  /** After finishing something the star stays positive for this long, whatever else is due. */
  afterglowMinutes: number;
  quietHours: QuietWindow[];
  snoozeUntil?: LocalDateTime;
  /** Days off. The star sleeps and my streak is not broken. */
  daysOff: LocalDate[];

  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  afternoonTime: '15:00',
  eveningTime: '19:00',
  morningTime: '07:30',
  examWarningDays: 3,
  goalStaleDays: 7,
  focusMinutes: 25,
  minSessionMinutes: 10,
  revisionOffsets: [7, 3, 1],
  celebrateSeconds: 8,
  afterglowMinutes: 30,
  quietHours: [
    { label: 'School', days: [1, 2, 3, 4, 5], from: '08:30', to: '15:00' },
    { label: 'Night', days: [0, 1, 2, 3, 4, 5, 6], from: '22:00', to: '07:00' },
  ],
  daysOff: [],
  updatedAt: 0,
};

// ----------------------------------------------------------------- data

/** Everything one person owns. This is what gets stored and synced. */
export interface AppData {
  tasks: Task[];
  sessions: Session[];
  settings: Settings;
}

export function emptyData(): AppData {
  return { tasks: [], sessions: [], settings: structuredCloneSettings(DEFAULT_SETTINGS) };
}

function structuredCloneSettings(s: Settings): Settings {
  return {
    ...s,
    revisionOffsets: [...s.revisionOffsets],
    quietHours: s.quietHours.map((q) => ({ ...q, days: [...q.days] })),
    daysOff: [...s.daysOff],
  };
}

// ----------------------------------------------------------------- mood

export const MOODS = ['neutral', 'happy', 'proud', 'celebrate', 'worried', 'grumpy', 'sleepy', 'focus'] as const;
export type Mood = (typeof MOODS)[number];

export type ReasonCode =
  | 'focus'
  | 'just_finished'
  | 'snooze'
  | 'day_off'
  | 'quiet_hours'
  | 'overdue'
  | 'overdue_but_active'
  | 'evening_nothing_done'
  | 'due_today'
  | 'exam_no_revision'
  | 'did_something'
  | 'all_clear'
  | 'exam_today'
  | 'stale_goal'
  | 'goal_past_date'
  | 'next_up'
  | 'nothing_due';

export interface MoodResult {
  mood: Mood;
  /** What the star says. Short, plain, names the task and the date. */
  message: string;
  /** Why this mood was picked, in plain words. */
  reason: string;
  /** The same reason as a fixed code, for apps and tests. */
  code: ReasonCode;
  /** The task the message is about, if any. */
  taskId?: string;
  /**
   * The next moment the mood could change just because time passed.
   * Apps set one timer for this instead of checking every second.
   */
  nextCheckAt: LocalDateTime;
}
