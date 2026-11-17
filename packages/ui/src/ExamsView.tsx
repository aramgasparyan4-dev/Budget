import { dateOf, upcomingExams } from '@star/core';
import type { AppData, LocalDateTime } from '@star/core';
import type { Store } from './store.ts';
import { LogMinutes, TaskRow } from './TaskRow.tsx';
import { Suggestions } from './TodayView.tsx';

function countdown(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function ExamsView({ store, data, now }: { store: Store; data: AppData; now: LocalDateTime }) {
  const today = dateOf(now);
  const exams = upcomingExams(data.tasks, data.sessions, today);

  return (
    <div class="view">
      <Suggestions store={store} data={data} today={today} />
      {exams.map(({ exam, daysLeft, revision, minutes }) => (
        <section class={`group exam${daysLeft <= data.settings.examWarningDays ? ' near' : ''}`} key={exam.id}>
          <h2>
            {countdown(daysLeft)}
            <span class="h2-note">{minutes > 0 ? `${minutes} min revised` : 'No revision logged yet'}</span>
          </h2>
          <ul>
            <TaskRow store={store} task={exam} today={today} showKind={false} noCheck />
            {revision.map((task) => (
              <TaskRow key={task.id} store={store} task={task} today={today} />
            ))}
          </ul>
          <LogMinutes store={store} taskId={exam.id} label="Log revision done elsewhere:" />
        </section>
      ))}
      {exams.length === 0 && <p class="empty">No exams coming up. Add one like "chem exam 20 nov" or "physics test next week".</p>}
    </div>
  );
}
