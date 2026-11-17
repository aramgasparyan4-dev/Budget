// Where the phone keeps the data: the browser's own storage, on the phone.
// Nothing here needs the internet.

import type { Backend } from '@star/ui';

const KEY = 'star.data';

export const phoneBackend: Backend = {
  load: async () => localStorage.getItem(KEY) ?? '',
  save: async (text) => localStorage.setItem(KEY, text),
  // Fires when the app is open in a second tab and that tab changed something.
  onExternalChange: (callback) => {
    window.addEventListener('storage', (event) => {
      if (event.key === KEY) callback();
    });
  },
};

/** Asks the browser not to clear the data when the phone runs low on space. */
export function keepDataSafe(): void {
  void navigator.storage?.persist?.().catch(() => false);
}
