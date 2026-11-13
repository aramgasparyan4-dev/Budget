// The list window that opens when you click the star.

import '@star/ui/style.css';
import './windows.css';
import { CompanionApp, Store } from '@star/ui';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getPlatform } from './platform.ts';
import type { Platform, PrefKey, Prefs } from './platform.ts';

/** Settings that belong to this PC: they are not part of the synced data. */
function DesktopSettings({ platform }: { platform: Platform }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    const load = () => void platform.getPrefs().then(setPrefs);
    load();
    platform.onPrefsChanged(load);
  }, [platform]);
  if (!prefs) return null;

  const toggle = (key: PrefKey, label: string, checked: boolean, value: (on: boolean) => boolean | string = (on) => on) => (
    <label class="field">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => platform.setPref(key, value((e.target as HTMLInputElement).checked))} />
    </label>
  );

  return (
    <section class="group desktop-settings">
      <h2>This PC</h2>
      {toggle('size', 'Small star', prefs.size === 'small', (on) => (on ? 'small' : 'normal'))}
      {toggle('autostart', 'Start when I log in', prefs.autostart)}
      {toggle('hideOnFullscreen', 'Hide during full screen apps', prefs.hideOnFullscreen)}
      {toggle('sound', 'Sound when a focus session ends', prefs.sound)}
      <p class="note path">Your data is saved in: {prefs.dataFolder}</p>
      <div class="row">
        <span class="grow" />
        <button type="button" class="chip danger" onClick={() => platform.quit()}>
          Quit Star Companion
        </button>
      </div>
    </section>
  );
}

function Panel({ store, platform }: { store: Store; platform: Platform }) {
  const [focusKey, setFocusKey] = useState(0);
  useEffect(() => {
    platform.onWindowShown(() => setFocusKey((n) => n + 1));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') platform.hideSelf();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [platform]);

  return (
    <CompanionApp
      store={store}
      focusKey={focusKey}
      onClose={() => platform.hideSelf()}
      settingsExtra={<DesktopSettings platform={platform} />}
    />
  );
}

async function main() {
  const platform = getPlatform();
  const store = new Store(platform.backend);
  await store.init();
  render(<Panel store={store} platform={platform} />, document.getElementById('root')!);
}

void main();
