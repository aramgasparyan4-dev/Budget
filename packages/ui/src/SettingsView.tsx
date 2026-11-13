import { addDays, atTime, clearSnooze, computeStreak, dateOf, hmOf, setDayOff, snooze, updateSettings } from '@star/core';
import type { AppData, LocalDateTime, QuietWindow, Settings } from '@star/core';
import type { ComponentChildren } from 'preact';
import type { Store } from './store.ts';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Shown Monday first.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  store: Store;
  data: AppData;
  now: LocalDateTime;
  /** Extra settings that only one app has, for example the desktop star's size. */
  children?: ComponentChildren;
}

export function SettingsView({ store, data, now, children }: Props) {
  const s = data.settings;
  const today = dateOf(now);
  const set = (patch: Partial<Omit<Settings, 'updatedAt'>>) => void store.apply((d, at) => updateSettings(d, patch, at));
  const setQuiet = (index: number, patch: Partial<QuietWindow>) =>
    set({ quietHours: s.quietHours.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  const number = (e: Event, min: number, max: number, fallback: number) => {
    const n = Math.round(Number((e.target as HTMLInputElement).value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const time = (e: Event, fallback: string) => (e.target as HTMLInputElement).value || fallback;

  const snoozed = s.snoozeUntil !== undefined && s.snoozeUntil > now;
  const dayOff = s.daysOff.includes(today);
  const streak = computeStreak(data.tasks, data.sessions, s, today);

  return (
    <div class="view settings">
      <section class="group">
        <h2>Right now</h2>
        <p class="note">
          {streak.days > 0 ? `${streak.days} ${streak.days === 1 ? 'day' : 'days'} in a row with something done.` : 'No streak yet. Finish one thing to start it.'}
        </p>
        <div class="row wrap">
          {snoozed ? (
            <button type="button" class="chip primary" onClick={() => void store.apply((d, at) => clearSnooze(d, at))}>
              End snooze (until {hmOf(s.snoozeUntil!)})
            </button>
          ) : (
            <>
              <button type="button" class="chip" onClick={() => void store.apply((d, at) => snooze(d, 30, at))}>
                Snooze 30 min
              </button>
              <button type="button" class="chip" onClick={() => void store.apply((d, at) => snooze(d, 60, at))}>
                Snooze 1 hour
              </button>
              <button
                type="button"
                class="chip"
                onClick={() => set({ snoozeUntil: atTime(addDays(today, 1), s.morningTime) })}
              >
                Snooze until tomorrow
              </button>
            </>
          )}
          <button type="button" class={`chip${dayOff ? ' primary' : ''}`} onClick={() => void store.apply((d, at) => setDayOff(d, today, !dayOff, at))}>
            {dayOff ? 'Today is a day off (undo)' : 'Take today off'}
          </button>
        </div>
      </section>

      <section class="group">
        <h2>Times</h2>
        <label class="field">
          <span>Homework due today worries me from</span>
          <input type="time" value={s.afternoonTime} onChange={(e) => set({ afternoonTime: time(e, s.afternoonTime) })} />
        </label>
        <label class="field">
          <span>My evening starts at</span>
          <input type="time" value={s.eveningTime} onChange={(e) => set({ eveningTime: time(e, s.eveningTime) })} />
        </label>
        <label class="field">
          <span>Warn me this many days before an exam</span>
          <input type="number" min={1} max={14} value={s.examWarningDays} onChange={(e) => set({ examWarningDays: number(e, 1, 14, s.examWarningDays) })} />
        </label>
        <label class="field">
          <span>Focus session length (minutes)</span>
          <input type="number" min={1} max={180} value={s.focusMinutes} onChange={(e) => set({ focusMinutes: number(e, 1, 180, s.focusMinutes) })} />
        </label>
      </section>

      <section class="group">
        <h2>Quiet hours</h2>
        <p class="note">The star sleeps and says nothing during these times.</p>
        {s.quietHours.map((q, index) => (
          <div class="quiet" key={index}>
            <div class="row">
              <input
                type="text"
                value={q.label}
                aria-label="Name"
                onChange={(e) => setQuiet(index, { label: (e.target as HTMLInputElement).value })}
              />
              <button type="button" class="chip danger" onClick={() => set({ quietHours: s.quietHours.filter((_, i) => i !== index) })}>
                Remove
              </button>
            </div>
            <div class="row">
              <input type="time" value={q.from} aria-label="From" onChange={(e) => setQuiet(index, { from: time(e, q.from) })} />
              <span>to</span>
              <input type="time" value={q.to} aria-label="To" onChange={(e) => setQuiet(index, { to: time(e, q.to) })} />
            </div>
            <div class="row">
              {DAY_ORDER.map((day) => (
                <button
                  type="button"
                  class={`day${q.days.includes(day) ? ' on' : ''}`}
                  aria-pressed={q.days.includes(day)}
                  title={DAY_NAMES[day]}
                  onClick={() =>
                    setQuiet(index, { days: q.days.includes(day) ? q.days.filter((d) => d !== day) : [...q.days, day].sort() })
                  }
                >
                  {DAY_LETTERS[day]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          class="chip"
          onClick={() => set({ quietHours: [...s.quietHours, { label: 'Quiet', days: [1, 2, 3, 4, 5], from: '17:00', to: '18:00' }] })}
        >
          Add quiet hours
        </button>
      </section>

      {children}
    </div>
  );
}
