import { addMinutes, dateOf, diffSeconds, endFocus, focusChoices, newId, runningFocus, startFocus } from '@star/core';
import type { AppData, LocalDateTime } from '@star/core';
import { useState } from 'preact/hooks';
import { useNow } from './hooks.ts';
import type { Store } from './store.ts';

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Running({ store, data, sessionId }: { store: Store; data: AppData; sessionId: string }) {
  const now = useNow(1000);
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const task = session.taskId ? data.tasks.find((t) => t.id === session.taskId) : undefined;
  const left = diffSeconds(addMinutes(session.startedAt, session.plannedMinutes), now);
  const worked = Math.floor(diffSeconds(now, session.startedAt) / 60);
  const tooShort = worked < Math.min(data.settings.minSessionMinutes, session.plannedMinutes);

  return (
    <section class="focus-card running">
      <div>
        <div class="focus-label">Focusing{task ? ` on ${task.title}` : ''}</div>
        <div class="focus-clock" aria-live="off">
          {clock(left)}
        </div>
      </div>
      <button
        type="button"
        class="chip"
        title={tooShort ? `Stopping before ${data.settings.minSessionMinutes} minutes will not count` : 'Stop and keep the minutes worked'}
        onClick={() => void store.apply((d, at) => endFocus(d, sessionId, at))}
      >
        {tooShort ? 'Cancel' : 'Stop early'}
      </button>
    </section>
  );
}

/** Start a focus session, or watch the one that is running. */
export function FocusCard({ store, data, now }: { store: Store; data: AppData; now: LocalDateTime }) {
  const [taskId, setTaskId] = useState('');
  const [minutes, setMinutes] = useState<number | null>(null);

  const session = runningFocus(data, now);
  if (session && now < addMinutes(session.startedAt, session.plannedMinutes)) {
    return <Running store={store} data={data} sessionId={session.id} />;
  }

  const choices = focusChoices(data.tasks, dateOf(now));
  const length = minutes ?? data.settings.focusMinutes;
  const picked = choices.some((t) => t.id === taskId) ? taskId : '';

  const start = (event: Event) => {
    event.preventDefault();
    const input: { taskId?: string; minutes: number } = { minutes: Math.min(180, Math.max(1, Math.round(length))) };
    if (picked) input.taskId = picked;
    void store.apply((d, at) => startFocus(d, input, newId(), at));
  };

  return (
    <form class="focus-card" onSubmit={start}>
      <select value={picked} aria-label="What are you working on?" onChange={(e) => setTaskId((e.target as HTMLSelectElement).value)}>
        <option value="">Any work</option>
        {choices.map((t) => (
          <option value={t.id}>{t.title}</option>
        ))}
      </select>
      <label class="minutes">
        <input
          type="number"
          min={1}
          max={180}
          value={length}
          aria-label="Minutes"
          onInput={(e) => setMinutes(Number((e.target as HTMLInputElement).value) || 0)}
        />
        min
      </label>
      <button type="submit" class="chip primary">
        Start focus
      </button>
    </form>
  );
}
