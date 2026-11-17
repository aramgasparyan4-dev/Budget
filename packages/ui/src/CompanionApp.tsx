import { liveTasks } from '@star/core';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ExamsView } from './ExamsView.tsx';
import { GoalsView } from './GoalsView.tsx';
import { useData, useMood } from './hooks.ts';
import { LiveStar } from './LiveStar.tsx';
import { QuickAdd } from './QuickAdd.tsx';
import { SettingsView } from './SettingsView.tsx';
import { StarFace } from './StarFace.tsx';
import type { Store } from './store.ts';
import { TodayView } from './TodayView.tsx';

type Tab = 'today' | 'exams' | 'goals' | 'settings';
const TABS: Array<[Tab, string]> = [
  ['today', 'Today'],
  ['exams', 'Exams'],
  ['goals', 'Goals'],
  ['settings', 'Settings'],
];

export const WELCOME = 'Hi. Tell me what homework and exams you have, and I will keep an eye on them with you.';

interface Props {
  store: Store;
  /**
   * 'panel' is the small list window on the desktop. 'phone' fills the
   * screen, with a big moving face at the top.
   */
  variant?: 'panel' | 'phone';
  /** Put the cursor in the quick add box straight away. */
  autoFocusAdd?: boolean;
  /** Bumping this number puts the cursor back in the quick add box. */
  focusKey?: number;
  onClose?: () => void;
  /** Log finished focus sessions here (see useMood). The phone turns this on. */
  closeFocus?: boolean;
  onFocusEnd?: () => void;
  /** Extra settings that only one app has. */
  settingsExtra?: ComponentChildren;
}

/** The whole list screen: face and message, quick add, and the four tabs. */
export function CompanionApp({
  store,
  variant = 'panel',
  autoFocusAdd = true,
  focusKey,
  onClose,
  closeFocus = false,
  onFocusEnd,
  settingsExtra,
}: Props) {
  const data = useData(store);
  const { mood, now } = useMood(store, { closeFocus, ...(onFocusEnd ? { onFocusEnd } : {}) });
  const [tab, setTab] = useState<Tab>('today');
  const isNew = liveTasks(data.tasks).length === 0;

  return (
    <div class={`companion ${variant}`}>
      <header class="top">
        {variant === 'phone' ? <LiveStar mood={mood.mood} size={148} /> : <StarFace mood={mood.mood} size={64} id="head" />}
        <p class="message" aria-live="polite">
          {isNew ? WELCOME : mood.message}
        </p>
        {onClose && (
          <button type="button" class="close" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <QuickAdd store={store} autoFocus={autoFocusAdd} resetKey={focusKey} onEscape={onClose} />
      <nav class="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button type="button" role="tab" aria-selected={tab === id} class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'today' && <TodayView store={store} data={data} now={now} />}
        {tab === 'exams' && <ExamsView store={store} data={data} now={now} />}
        {tab === 'goals' && <GoalsView store={store} data={data} now={now} />}
        {tab === 'settings' && (
          <SettingsView store={store} data={data} now={now}>
            {settingsExtra}
          </SettingsView>
        )}
      </main>
    </div>
  );
}
