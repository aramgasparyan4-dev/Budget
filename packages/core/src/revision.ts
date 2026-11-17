// Revision planning: for each exam, suggest revision days counted back from
// the exam (7, 3 and 1 days before by default). A suggestion is not stored
// until I accept it or skip it.

import { addDays } from './dates.ts';
import type { LocalDate } from './dates.ts';
import { addTask } from './actions.ts';
import type { Stamp } from './actions.ts';
import type { AppData, Settings, Task } from './types.ts';

export interface RevisionSuggestion {
  examId: string;
  /** Days before the exam. */
  offset: number;
  due: LocalDate;
  title: string;
  subject?: string;
}

/** Suggestions that have not been answered yet, soonest first. */
export function suggestRevision(tasks: Task[], settings: Settings, today: LocalDate): RevisionSuggestion[] {
  const out: RevisionSuggestion[] = [];
  const exams = tasks.filter((t) => t.kind === 'exam' && !t.deletedAt && !t.doneAt && t.due && t.due > today);

  for (const exam of exams) {
    for (const offset of settings.revisionOffsets) {
      const due = addDays(exam.due!, -offset);
      if (due < today) continue;
      // Already accepted, skipped or deleted: do not ask again.
      const answered = tasks.some((t) => t.examId === exam.id && t.revisionOffset === offset);
      if (answered) continue;
      const suggestion: RevisionSuggestion = { examId: exam.id, offset, due, title: `Revise for ${exam.title}` };
      if (exam.subject) suggestion.subject = exam.subject;
      out.push(suggestion);
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

export function acceptRevision(data: AppData, s: RevisionSuggestion, id: string, at: Stamp): AppData {
  return addTask(
    data,
    { kind: 'revision', title: s.title, due: s.due, subject: s.subject, examId: s.examId, revisionOffset: s.offset },
    id,
    at,
  );
}

export function skipRevision(data: AppData, s: RevisionSuggestion, id: string, at: Stamp): AppData {
  const next = acceptRevision(data, s, id, at);
  return { ...next, tasks: next.tasks.map((t) => (t.id === id ? { ...t, skippedAt: at.local } : t)) };
}
