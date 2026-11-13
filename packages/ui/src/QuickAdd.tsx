import { KIND_LABEL, addTask, dateOf, formatDay, newId, parseQuickAdd, toLocalDateTime } from '@star/core';
import type { ParsedTask } from '@star/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Store } from './store.ts';

export function describeParsed(parsed: ParsedTask, today: string): string {
  const when = parsed.due ? (parsed.kind === 'exam' ? `on ${formatDay(parsed.due, today)}` : `due ${formatDay(parsed.due, today)}`) : 'no date';
  return `${KIND_LABEL[parsed.kind]}: ${parsed.title}, ${when.replace(/^on (today|tomorrow)$/, '$1')}`;
}

interface Props {
  store: Store;
  autoFocus?: boolean;
  large?: boolean;
  /** Bumping this number clears the box and puts the cursor in it. */
  resetKey?: number;
  onAdded?: (parsed: ParsedTask) => void;
  onEscape?: () => void;
}

/** One text box. Type "maths hw fri", press Enter, done. */
export function QuickAdd({ store, autoFocus, large, resetKey, onAdded, onEscape }: Props) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const today = dateOf(toLocalDateTime(new Date()));
  const parsed = text.trim().length > 0 ? parseQuickAdd(text, today) : null;

  useEffect(() => {
    if (resetKey !== undefined) setText('');
    if (autoFocus) input.current?.focus();
  }, [resetKey, autoFocus]);

  const submit = (event: Event) => {
    event.preventDefault();
    if (!parsed) return;
    void store.apply((data, at) => addTask(data, parsed, newId(), at));
    setText('');
    onAdded?.(parsed);
  };

  return (
    <form class={`quick-add${large ? ' large' : ''}`} onSubmit={submit}>
      <input
        ref={input}
        type="text"
        value={text}
        placeholder="Add: maths hw fri, chem exam 20 nov, goal read more..."
        aria-label="Quick add"
        autocomplete="off"
        spellcheck={false}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onEscape?.();
        }}
      />
      <div class="quick-add-preview" aria-live="polite">
        {parsed ? describeParsed(parsed, today) : 'Press Enter to add. Dates like fri, tomorrow, 20.11 or 20 nov work.'}
      </div>
    </form>
  );
}
