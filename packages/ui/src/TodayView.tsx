import { acceptRevision, dateOf, formatDay, newId, skipRevision, suggestRevision, todayGroups } from '@star/core';
import type { AppData, LocalDateTime, Task } from '@star/core';
import { FocusCard } from './FocusCard.tsx';
import type { Store } from './store.ts';
import { TaskRow } from './TaskRow.tsx';

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Group({ title, tasks, store, today, tone }: { title: string; tasks: Task[]; store: Store; today: string; tone?: string }) {
  if (tasks.length === 0) return null;
  return (
    <section class={`group${tone ? ` ${tone}` : ''}`}>
      <h2>{title}</h2>
      <ul>
        {tasks.map((task) => (
          <TaskRow key={task.id} store={store} task={task} today={today} />
        ))}
      </ul>
    </section>
  );
}

/** Suggested revision days, waiting for a yes or no. */
export function Suggestions({ store, data, today }: { store: Store; data: AppData; today: string }) {
  const suggestions = suggestRevision(data.tasks, data.settings, today);
  if (suggestions.length === 0) return null;
  return (
    <section class="group suggestions">
      <h2>Suggested revision days</h2>
      <ul>
        {suggestions.map((s) => (
          <li class="task" key={`${s.examId}-${s.offset}`}>
            <div class="task-line">
              <span class="task-main static">
                <span class="task-title">{s.title}</span>
                <span class="task-meta">
                  {capital(formatDay(s.due, today))} · {s.offset} {s.offset === 1 ? 'day' : 'days'} before
                </span>
              </span>
              <button type="button" class="chip primary" onClick={() => void store.apply((d, at) => acceptRevision(d, s, newId(), at))}>
                Add
              </button>
              <button type="button" class="chip" onClick={() => void store.apply((d, at) => skipRevision(d, s, newId(), at))}>
                Skip
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TodayView({ store, data, now }: { store: Store; data: AppData; now: LocalDateTime }) {
  const today = dateOf(now);
  const g = todayGroups(data.tasks, today);
  const nothing =
    g.overdue.length + g.today.length + g.tomorrow.length + g.week.length + g.later.length + g.undated.length + g.doneToday.length === 0;

  return (
    <div class="view">
      <FocusCard store={store} data={data} now={now} />
      <Suggestions store={store} data={data} today={today} />
      <Group title="Overdue" tasks={g.overdue} store={store} today={today} tone="late" />
      <Group title="Today" tasks={g.today} store={store} today={today} />
      <Group title="Tomorrow" tasks={g.tomorrow} store={store} today={today} />
      <Group title="Next 7 days" tasks={g.week} store={store} today={today} />
      <Group title="Later" tasks={g.later} store={store} today={today} />
      <Group title="No date" tasks={g.undated} store={store} today={today} />
      <Group title="Done today" tasks={g.doneToday} store={store} today={today} />
      {nothing && <p class="empty">Nothing here yet. Type something in the box above, for example "maths hw fri".</p>}
    </div>
  );
}
