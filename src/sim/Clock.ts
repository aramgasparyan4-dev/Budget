export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MIN_PER_DAY = 24 * 60;

/** Simulation clock in game minutes since Monday (day 1) 00:00. */
export class Clock {
  t: number;
  /** game seconds per real second */
  scale = 30;
  constructor(startMinutes = 8 * 60) {
    this.t = startMinutes;
  }
  advance(realDt: number) {
    const dm = (realDt * this.scale) / 60;
    this.t += dm;
    return dm;
  }
  get day() {
    return Math.floor(this.t / MIN_PER_DAY) + 1;
  }
  get weekday() {
    return Math.floor(this.t / MIN_PER_DAY) % 7;
  }
  get weekdayName() {
    return WEEKDAYS[this.weekday];
  }
  get minuteOfDay() {
    return this.t % MIN_PER_DAY;
  }
  get hour() {
    return this.minuteOfDay / 60;
  }
  get isWeekend() {
    return this.weekday >= 5;
  }
  label() {
    return fmtTime(this.minuteOfDay);
  }
}

export function fmtTime(minOfDay: number) {
  const m = Math.floor(minOfDay) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function fmtDayTime(t: number) {
  const day = Math.floor(t / MIN_PER_DAY);
  return `${WEEKDAYS[day % 7].slice(0, 3)} ${fmtTime(t % MIN_PER_DAY)}`;
}

/** hour within [start,end) allowing overnight ranges (end > 24) */
export function inHours(hour: number, start: number, end: number) {
  if (end <= 24) return hour >= start && hour < end;
  return hour >= start || hour < end - 24;
}
