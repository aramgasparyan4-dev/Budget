import * as THREE from 'three';
import { game, DEFAULT_SEED } from './Game';
import { useStore } from '../state/store';
import { installAutosave, readSave, restoreSession, saveGame, SAVE_VERSION, SlotId } from './SaveSystem';
import { OUTFITS } from './PlayerState';
import type { HumanLook } from '../render/Human';
import { DISTRICT_INFO } from '../world/types';

export interface NewGameOptions {
  name: string;
  look: HumanLook;
  seed: number;
  skipTutorial: boolean;
}

const progress = (p: number, t: string) => useStore.getState().setLoading(p, t);

export async function boot() {
  const st = useStore.getState();
  st.setScreen('loading');
  await game.loadWorld(DEFAULT_SEED, progress);
  progress(1, 'Ready');
  game.startMenu();
  useStore.getState().setScreen('menu');
}

async function ensureWorld(seed: number) {
  if (game.worldSeed === seed && game.city) return;
  useStore.getState().setScreen('loading');
  await game.loadWorld(seed, progress);
}

function homeSpawn() {
  const city = game.city!;
  const home = city.buildings[city.playerHome];
  const out = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][home.facing];
  return { x: home.door.x + out[0] * 2.5, z: home.door.z + out[1] * 2.5, yaw: Math.atan2(out[0], out[1]), out };
}

function introText() {
  const c = game.city!;
  const district = DISTRICT_INFO[c.buildings[c.playerHome].district].name;
  return {
    title: 'Welcome to Echo City',
    body: `You have $250, a small apartment in ${district}, and an entire city full of opportunities, people and secrets. Everyone here has a job, a routine and a memory. What kind of life will you build?`,
    place: district,
  };
}

export async function startNewGame(o: NewGameOptions) {
  const st = useStore.getState();
  st.setOverlay(null);
  await ensureWorld(o.seed);
  const s = game.newSession(8 * 60 + 30);
  s.setupGameplay();
  s.player.name = o.name.trim() || 'Alex';
  const starter = OUTFITS.find((x) => x.id === 'starter')!;
  o.look.shirt.setHex(starter.shirt);
  o.look.pants.setHex(starter.pants);
  s.player.look = o.look;
  const sp = homeSpawn();
  s.spawnPlayer(sp.x, sp.z, sp.yaw);
  installAutosave(game);
  // intro: a slow descent from above the neighbourhood to the player at their front door
  const p = new THREE.Vector3(sp.x, 0, sp.z);
  const from = new THREE.Vector3(sp.x + sp.out[0] * 140 + 60, 95, sp.z + sp.out[1] * 140 + 40);
  const to = new THREE.Vector3(sp.x - Math.sin(sp.yaw) * 4.6, 2.3, sp.z - Math.cos(sp.yaw) * 4.6);
  game.cam.yaw = sp.yaw;
  game.cam.pitch = 0.18;
  game.cam.startCinematic(from, to, new THREE.Vector3(p.x, 20, p.z), new THREE.Vector3(p.x, 1.4, p.z), 9);
  useStore.getState().setIntro(introText());
  useStore.getState().setOverlay('intro');
  useStore.getState().setScreen('game');
  if (o.skipTutorial) s.objectives?.skipTutorial();
  s.player.flags.skipTutorial = o.skipTutorial;
}

/** dismiss the intro card and hand control to the player */
export function beginPlay() {
  const s = game.session;
  const st = useStore.getState();
  st.setIntro(null);
  st.setOverlay(null);
  if (!s) return;
  game.cam.mode = 'foot';
  game.cam.snap();
  if (!s.player.flags.skipTutorial) s.objectives?.start();
  else s.setObjective('Explore Echo City', 'Open the Jobs app (TAB) to start earning');
  s.notify('Tip', 'Click the game to capture the mouse. TAB opens your phone.', 'info');
  game.input.requestLock();
}

export async function loadSlot(slot: SlotId): Promise<boolean> {
  const st = useStore.getState();
  const data = await readSave(slot);
  if (!data) {
    st.notify({ title: 'Save not found', kind: 'warning' });
    return false;
  }
  if (data.version !== SAVE_VERSION) {
    st.notify({ title: 'Incompatible save', body: `Version ${data.version}, expected ${SAVE_VERSION}`, kind: 'warning' });
    return false;
  }
  st.setOverlay(null);
  st.setLoading(0.05, 'Loading save');
  st.setScreen('loading');
  await new Promise((r) => setTimeout(r, 30));
  await ensureWorld(data.seed);
  progress(0.95, 'Restoring the city');
  await new Promise((r) => setTimeout(r, 0));
  try {
    restoreSession(game, data);
  } catch (e) {
    console.error(e);
    st.notify({ title: 'Failed to load save', body: String((e as Error).message ?? e), kind: 'warning' });
    quitToMenu();
    return false;
  }
  installAutosave(game);
  useStore.getState().setScreen('game');
  useStore.getState().notify({ title: 'Game loaded', body: data.label, kind: 'info' });
  return true;
}

export async function saveSlot(slot: SlotId) {
  try {
    const m = await saveGame(game, slot);
    if (m) useStore.getState().notify({ title: 'Game saved', body: m.label, kind: 'info' });
    return m;
  } catch (e) {
    useStore.getState().notify({ title: 'Save failed', body: String((e as Error).message ?? e), kind: 'warning' });
    return null;
  }
}

export function quitToMenu() {
  game.autosave = null;
  game.input.exitLock();
  const st = useStore.getState();
  st.setOverlay(null);
  st.setIntro(null);
  game.startMenu();
  st.setScreen('menu');
}

// handles for automated tests and the browser console
(window as unknown as { __flow: object }).__flow = { startNewGame, beginPlay, loadSlot, saveSlot, quitToMenu };
