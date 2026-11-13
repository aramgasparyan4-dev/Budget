import { evaluateMood, liveTasks } from '@star/core';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ExamsView } from './ExamsView.tsx';
import { GoalsView } from './GoalsView.tsx';
import { useData, useNow } from './hooks.ts';
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
  /** Bumping this number puts the cursor back in the quick add box. */
  focusKey?: number;
  onClose?: () => void;
  /** Extra settings that only one app has. */
  settingsExtra?: ComponentChildren;
}

/** The whole list screen: face and message, quick add, and the four tabs. */
export function CompanionApp({ store, focusKey, onClose, settingsExtra }: Props) {
  const data = useData(store);
  const now = useNow(20_000);
  const [tab, setTab] = useState<Tab>('today');
  const mood = evaluateMood(data.tasks, data.sessions, data.settings, now);
  const isNew = liveTasks(data.tasks).length === 0;

  return (
    <div class="companion">
      <header class="top">
        <StarFace mood={mood.mood} size={64} id="head" />
        <p class="message">{isNew ? WELCOME : mood.message}</p>
        {onClose && (
          <button type="button" class="close" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <QuickAdd store={store} autoFocus resetKey={focusKey} onEscape={onClose} />
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
