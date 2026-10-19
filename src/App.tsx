import { useEffect } from 'react';
import { GameCanvas } from './scene/GameCanvas';
import { useStore } from './state/store';
import { game, DEFAULT_SEED } from './game/Game';
import { randomLook } from './render/Human';
import { CURB_H } from './world/types';

(window as unknown as { __store: typeof useStore }).__store = useStore;

async function boot() {
  const st = useStore.getState();
  st.setScreen('loading');
  await game.loadWorld(DEFAULT_SEED, (p, t) => useStore.getState().setLoading(p, t));
  useStore.getState().setLoading(1, 'Ready');
  game.startMenu();
  useStore.getState().setScreen('menu');
}

function startNewGame() {
  const city = game.city!;
  const home = city.buildings[city.playerHome];
  const out = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][home.facing];
  const x = home.door.x + out[0] * 2.5;
  const z = home.door.z + out[1] * 2.5;
  const yaw = Math.atan2(out[0], out[1]);
  game.spawnPlayer(randomLook(Math.random, false), x, CURB_H, z, yaw);
  game.mode = 'game';
  useStore.getState().setScreen('game');
  game.input.requestLock();
}

export default function App() {
  const screen = useStore((s) => s.screen);
  const progress = useStore((s) => s.loadingProgress);
  const text = useStore((s) => s.loadingText);
  const perf = useStore((s) => s.perf);
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
    <div className="relative w-full h-full">
      <GameCanvas />
      {screen === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink">
          <div className="text-4xl font-semibold tracking-[0.5em]">ECHO CITY</div>
          <div className="mt-6 w-72 h-1 bg-white/10 rounded overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-3 text-sm text-white/50">{text}</div>
        </div>
      )}
      {screen === 'menu' && (
        <div className="absolute left-16 top-1/3">
          <div className="text-6xl font-semibold tracking-[0.35em] text-shadow">ECHO CITY</div>
          <button id="btn-new" className="mt-10 text-2xl hover:text-accent" onClick={startNewGame}>
            New Game
          </button>
        </div>
      )}
      <div id="perf" className="absolute right-2 top-2 text-xs font-mono text-white/70">
        {perf.fps} fps · {perf.drawCalls} draws · {perf.detailChunks} chunks
      </div>
    </div>
  );
}
