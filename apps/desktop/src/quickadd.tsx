// The small window that Ctrl+Shift+A opens: type one line, press Enter.

import '@star/ui/style.css';
import './windows.css';
import { QuickAdd, Store } from '@star/ui';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getPlatform } from './platform.ts';
import type { Platform } from './platform.ts';

function QuickAddWindow({ store, platform }: { store: Store; platform: Platform }) {
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => platform.onWindowShown(() => setResetKey((n) => n + 1)), [platform]);

  return (
    <div class="quick-window">
      <QuickAdd
        store={store}
        large
        autoFocus
        resetKey={resetKey}
        onAdded={() => platform.hideSelf()}
        onEscape={() => platform.hideSelf()}
      />
      <p class="hint">Enter adds it. Esc closes.</p>
    </div>
  );
}

async function main() {
  const platform = getPlatform();
  const store = new Store(platform.backend);
  await store.init();
  render(<QuickAddWindow store={store} platform={platform} />, document.getElementById('root')!);
}

void main();
