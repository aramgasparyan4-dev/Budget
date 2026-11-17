// Date helpers. Everything here works on plain strings, so nothing depends on
// the time zone of the machine running it.
//
//   LocalDate      '2026-11-20'
//   LocalDateTime  '2026-11-20T16:45:00'   (wall clock time, no zone)
//
// Strings in these formats sort correctly with < and >.

export type LocalDate = string;
export type LocalDateTime = string;

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function dateToMs(date: LocalDate): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return Date.UTC(y, m - 1, d);
}

function msToDate(ms: number): LocalDate {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function dateTimeToMs(dt: LocalDateTime): number {
  const h = Number(dt.slice(11, 13) || 0);
  const mi = Number(dt.slice(14, 16) || 0);
  const s = Number(dt.slice(17, 19) || 0);
  return dateToMs(dt) + ((h * 60 + mi) * 60 + s) * 1000;
}

function msToDateTime(ms: number): LocalDateTime {
  const d = new Date(ms);
  return `${msToDate(ms)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Builds a date, or returns null if it does not exist (for example 30 February). */
export function makeDate(year: number, month: number, day: number): LocalDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The wall clock time of a JavaScript Date, in the machine's own time zone. */
export function toLocalDateTime(d: Date): LocalDateTime {
  return (
    `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function dateOf(dt: LocalDateTime): LocalDate {
  return dt.slice(0, 10);
}

/** Minutes since midnight. */
export function minutesOf(dt: LocalDateTime): number {
  return Number(dt.slice(11, 13)) * 60 + Number(dt.slice(14, 16));
}

/** '19:00' -> 1140 */
export function parseHM(hm: string): number {
  const [h, m] = hm.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

/** '2026-11-20T16:45:00' -> '16:45' */
export function hmOf(dt: LocalDateTime): string {
  return dt.slice(11, 16);
}

export function atTime(date: LocalDate, hm: string): LocalDateTime {
  return `${date}T${hm.length === 5 ? hm : pad(Math.floor(parseHM(hm) / 60)) + ':' + pad(parseHM(hm) % 60)}:00`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return msToDate(dateToMs(date) + days * DAY_MS);
}

/** Same day of the month, some months later. Clamps to the end of a short month. */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  const d = Number(date.slice(8, 10));
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${pad(year, 4)}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** Whole days from b to a. Positive when a is later. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((dateToMs(a) - dateToMs(b)) / DAY_MS);
}

export function addMinutes(dt: LocalDateTime, minutes: number): LocalDateTime {
  return msToDateTime(dateTimeToMs(dt) + minutes * 60_000);
}

export function addSeconds(dt: LocalDateTime, seconds: number): LocalDateTime {
  return msToDateTime(dateTimeToMs(dt) + seconds * 1000);
}

/** Seconds from b to a. Positive when a is later. */
export function diffSeconds(a: LocalDateTime, b: LocalDateTime): number {
  return Math.round((dateTimeToMs(a) - dateTimeToMs(b)) / 1000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(date: LocalDate): number {
  return new Date(dateToMs(date)).getUTCDay();
}

/** 'Fri 20 Nov'. Adds the year when it differs from the year of `today`. */
export function formatDate(date: LocalDate, today?: LocalDate): string {
  const d = new Date(dateToMs(date));
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (today && date.slice(0, 4) !== today.slice(0, 4)) return `${base} ${date.slice(0, 4)}`;
  return base;
}

/** 'today', 'tomorrow', 'yesterday', or 'Fri 20 Nov'. */
export function formatDay(date: LocalDate, today: LocalDate): string {
  const diff = diffDays(date, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return formatDate(date, today);
}

/** 'is due today', 'is due tomorrow', 'is due Fri 20 Nov' style helper: 'on Fri 20 Nov' but plain 'today'. */
export function onDay(date: LocalDate, today: LocalDate): string {
  const diff = diffDays(date, today);
  if (diff >= -1 && diff <= 1) return formatDay(date, today);
  return `on ${formatDate(date, today)}`;
}
