import {
  KIND_LABEL,
  completeTask,
  deleteTask,
  editTask,
  formatDay,
  logManual,
  moveToTomorrow,
  newId,
  reopenTask,
  startFocus,
} from '@star/core';
import type { LocalDate, Task, TaskKind } from '@star/core';
import { useState } from 'preact/hooks';
import type { Store } from './store.ts';

export function dueText(task: Task, today: LocalDate): string {
  if (!task.due) return 'No date';
  const day = formatDay(task.due, today);
  if (task.kind === 'exam') return day.charAt(0).toUpperCase() + day.slice(1);
  if (task.due < today && !task.doneAt) return `Was due ${day}`;
  return `Due ${day}`;
}

/** Buttons to log revision or work done away from the timer. */
export function LogMinutes({ store, taskId, label }: { store: Store; taskId: string; label: string }) {
  return (
    <div class="log-minutes">
      <span>{label}</span>
      {[15, 30, 45, 60].map((minutes) => (
        <button
          type="button"
          class="chip"
          onClick={() => void store.apply((data, at) => logManual(data, { taskId, minutes }, newId(), at))}
        >
          {minutes} min
        </button>
      ))}
    </div>
  );
}

interface Props {
  store: Store;
  task: Task;
  today: LocalDate;
  /** Show the kind in front of the date. On by default. */
  showKind?: boolean;
  /** Hide the tick box (used for exams, which pass by themselves). */
  noCheck?: boolean;
}

const KINDS: TaskKind[] = ['homework', 'exam', 'goal_short', 'goal_long', 'revision'];

export function TaskRow({ store, task, today, showKind = true, noCheck }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due ?? '');
  const [kind, setKind] = useState<TaskKind>(task.kind);

  const done = task.doneAt !== undefined;
  const late = !done && task.due !== undefined && task.due < today && task.kind !== 'exam';
  const canLog = task.kind === 'exam' || task.kind === 'revision' || task.kind === 'goal_short' || task.kind === 'goal_long';

  const toggleEditor = () => {
    setTitle(task.title);
    setDue(task.due ?? '');
    setKind(task.kind);
    setOpen(!open);
  };

  const save = (event: Event) => {
    event.preventDefault();
    const clean = title.trim();
    if (clean.length === 0) return;
    void store.apply((data, at) => editTask(data, task.id, { title: clean, due: due === '' ? null : due, kind }, at));
    setOpen(false);
  };

  return (
    <li class={`task${done ? ' done' : ''}${late ? ' late' : ''}${open ? ' open' : ''}`} data-task-id={task.id}>
      <div class="task-line">
        {!noCheck && (
          <input
            type="checkbox"
            checked={done}
            aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
            onChange={() => void store.apply((data, at) => (done ? reopenTask(data, task.id, at) : completeTask(data, task.id, at)))}
          />
        )}
        <button type="button" class="task-main" onClick={toggleEditor} title="Edit">
          <span class="task-title">{task.title}</span>
          <span class="task-meta">
            {showKind ? `${KIND_LABEL[task.kind]} · ` : ''}
            {dueText(task, today)}
          </span>
        </button>
        {late && (
          <button type="button" class="chip warn" onClick={() => void store.apply((data, at) => moveToTomorrow(data, task.id, at))}>
            Move to tomorrow
          </button>
        )}
        {!done && (
          <button
            type="button"
            class="chip"
            title={`Start a focus session on ${task.title}`}
            onClick={() => void store.apply((data, at) => startFocus(data, { taskId: task.id }, newId(), at))}
          >
            Focus
          </button>
        )}
      </div>

      {open && (
        <form class="task-editor" onSubmit={save}>
          <input type="text" value={title} aria-label="Title" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
          <div class="row">
            <label>
              Date
              <input type="date" value={due} onInput={(e) => setDue((e.target as HTMLInputElement).value)} />
            </label>
            <label>
              Kind
              <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as TaskKind)}>
                {KINDS.map((k) => (
                  <option value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </label>
          </div>
          {canLog && !done && <LogMinutes store={store} taskId={task.id} label="I worked on this for" />}
          <div class="row end">
            <button
              type="button"
              class="chip danger"
              onClick={() => void store.apply((data, at) => deleteTask(data, task.id, at))}
            >
              Delete
            </button>
            <span class="grow" />
            <button type="button" class="chip" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" class="chip primary">
              Save
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
