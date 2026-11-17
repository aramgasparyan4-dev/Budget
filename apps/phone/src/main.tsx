// The phone app. It is the same list screen as on the desktop, full screen,
// with the moving face at the top.

import '@star/ui/style.css';
import './phone.css';
import { CompanionApp, Store } from '@star/ui';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { keepDataSafe, phoneBackend } from './storage.ts';

/** Chrome's "this site can be installed" event. It is not in the standard types yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches;

function PhoneSettings() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return (
    <section class="group">
      <h2>This phone</h2>
      {installed ? (
        <p class="note">Installed. It opens from your home screen and works with no internet.</p>
      ) : prompt ? (
        <button type="button" class="chip primary" onClick={() => void prompt.prompt()}>
          Install on this phone
        </button>
      ) : (
        <p class="note">To install: open Chrome's menu (the three dots) and tap "Add to Home screen" or "Install app".</p>
      )}
      <p class="note">Your data is saved on this phone. It is not shared with your PC yet.</p>
    </section>
  );
}

/** A short buzz and two soft notes when a focus session ends. */
function focusEnded() {
  navigator.vibrate?.([120, 80, 120]);
  try {
    const audio = new AudioContext();
    [660, 880].forEach((frequency, i) => {
      const start = audio.currentTime + i * 0.18;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.12, start + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      tone.connect(volume).connect(audio.destination);
      tone.start(start);
      tone.stop(start + 0.65);
    });
    window.setTimeout(() => void audio.close(), 1500);
  } catch {
    // No sound allowed right now: stay quiet.
  }
}

async function main() {
  const store = new Store(phoneBackend);
  await store.init();
  keepDataSafe();

  // The home screen shortcut "Quick add" opens the app with ?add=1, which
  // puts the cursor straight in the box with the keyboard up.
  const addNow = new URLSearchParams(location.search).has('add');

  render(
    <CompanionApp store={store} variant="phone" autoFocusAdd={addNow} closeFocus onFocusEnd={focusEnded} settingsExtra={<PhoneSettings />} />,
    document.getElementById('root')!,
  );

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    void navigator.serviceWorker.register('./sw.js');
  }
}

void main();
