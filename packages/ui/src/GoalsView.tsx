import { dateOf, diffDays, formatDay, openGoals } from '@star/core';
import type { AppData, LocalDateTime } from '@star/core';
import type { Store } from './store.ts';
import { LogMinutes, TaskRow } from './TaskRow.tsx';

export function GoalsView({ store, data, now }: { store: Store; data: AppData; now: LocalDateTime }) {
  const today = dateOf(now);
  const goals = openGoals(data.tasks, data.sessions);

  return (
    <div class="view">
      {goals.map(({ goal, lastTouched, minutes }) => {
        const since = dateOf(lastTouched ?? goal.createdAt);
        const quiet = diffDays(today, since) >= data.settings.goalStaleDays;
        return (
          <section class={`group goal${quiet ? ' quiet' : ''}`} key={goal.id}>
            <ul>
              <TaskRow store={store} task={goal} today={today} />
            </ul>
            <p class="note">
              {lastTouched ? `Last worked on ${formatDay(dateOf(lastTouched), today)}` : 'Not worked on yet'}
              {minutes > 0 ? ` · ${minutes} min in total` : ''}
            </p>
            <LogMinutes store={store} taskId={goal.id} label="I worked on this for" />
          </section>
        );
      })}
      {goals.length === 0 && (
        <p class="empty">No goals yet. Add one like "goal finish chem notes by sun" or "long goal get an A in chemistry".</p>
      )}
    </div>
  );
}
