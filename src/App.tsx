import { useEffect } from 'react';
import { GameCanvas } from './scene/GameCanvas';
import { useStore, Overlay } from './state/store';
import { game } from './game/Game';
import { boot } from './game/flow';
import { HUD } from './ui/HUD';
import { DialogueUI } from './ui/DialogueUI';
import { ShopUI, MiniGameUI, SleepUI, FadeOverlay, PerfOverlay } from './ui/Modals';
import { Phone } from './ui/Phone';
import { MapOverlay } from './ui/MapView';
import { LoadingScreen, MainMenu, PauseMenu, IntroOverlay } from './ui/Menus';
import { useShop, useDialogue, useMiniGame } from './state/uiStores';

// handles for automated tests and the browser console
Object.assign(window, { __store: useStore, __ui: { useShop, useDialogue, useMiniGame } });

/** overlays that own the keyboard while open (they close themselves) */
const MODAL: Overlay[] = ['dialogue', 'shop', 'minigame', 'intro', 'newgame'];

function openOverlay(o: Overlay) {
  useStore.getState().setOverlay(o);
  game.input.exitLock();
}
function closeOverlay() {
  useStore.getState().setOverlay(null);
  game.input.requestLock();
}

function useGlobalKeys() {
  useEffect(() => {
    let pausedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (st.screen !== 'game' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const ov = st.overlay;
      if (e.code === 'F3') {
        e.preventDefault();
        st.updateSettings((s) => (s.gameplay.showPerf = !s.gameplay.showPerf));
        return;
      }
      if (MODAL.includes(ov)) return;
      const s = game.session;
      if (!s || s.skipping) return;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (ov === 'phone') closeOverlay();
        else if (ov === null || ov === 'map') {
          st.setPhoneApp('home');
          openOverlay('phone');
          s.objectives?.event('phone');
          game.audio.ui('open');
        }
      } else if (e.code === 'KeyM') {
        if (ov === 'map') closeOverlay();
        else if (ov === null || ov === 'phone') {
          openOverlay('map');
          game.audio.ui('open');
        }
      } else if (e.code === 'KeyI') {
        if (ov === null) {
          st.setPhoneApp('bag');
          openOverlay('phone');
          s.objectives?.event('phone');
        }
      } else if (e.code === 'Escape') {
        if (ov === 'phone' || ov === 'map' || ov === 'sleep') closeOverlay();
        else if (ov === null) {
          openOverlay('pause');
          pausedAt = performance.now();
        } else if (ov === 'pause') {
          // the browser already released the pointer for this same Esc press
          if (performance.now() - pausedAt > 250) closeOverlay();
        }
        // settings/saveload/controls panels handle their own Esc (back to pause)
      }
    };
    // capture phase: decide before modal UIs (dialogue, shop) handle the same key
    window.addEventListener('keydown', onKey, { capture: true });
    // losing pointer lock while playing (Esc in most browsers) pauses the game
    game.input.onUnlock = () => {
      const st = useStore.getState();
      if (st.screen === 'game' && st.overlay === null && game.session && !game.session.skipping) {
        st.setOverlay('pause');
        pausedAt = performance.now();
      }
    };
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);
}

function useSettingsSync() {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.settings !== prev.settings) game.applySettings(s.settings);
        // any overlay opening releases the mouse
        if (s.overlay && !prev.overlay) game.input.exitLock();
      }),
    [],
  );
}

function useAutosaveTimer() {
  useEffect(() => {
    const id = setInterval(() => {
      const st = useStore.getState();
      const s = game.session;
      if (st.screen === 'game' && st.overlay === null && s && !s.background && s.mode !== 'none' && s.fade === 0) game.autosave?.();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
}

export default function App() {
  const screen = useStore((s) => s.screen);
  useGlobalKeys();
  useSettingsSync();
  useAutosaveTimer();
  useEffect(() => {
    const t = setInterval(() => {
      if (game.attached) {
        clearInterval(t);
        boot();
      }
    }, 50);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onPointerDown={(e) => {
        // clicking the 3D view while playing captures the mouse
        const st = useStore.getState();
        if (st.screen === 'game' && st.overlay === null && (e.target as HTMLElement).tagName === 'CANVAS') game.input.requestLock();
      }}
    >
      <GameCanvas />
      {screen === 'game' && (
        <div className="absolute inset-0 pointer-events-none">
          <HUD />
          <PerfOverlay />
          <Phone />
          <MapOverlay />
          <DialogueUI />
          <ShopUI />
          <MiniGameUI />
          <SleepUI />
          <IntroOverlay />
          <PauseMenu />
        </div>
      )}
      {screen === 'menu' && <MainMenu />}
      {screen === 'loading' && <LoadingScreen />}
      {screen !== 'loading' && <FadeOverlay />}
      {screen === 'menu' && <PerfOverlay />}
    </div>
  );
}
