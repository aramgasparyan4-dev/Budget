import { openDB, IDBPDatabase } from 'idb';
import type { Game } from './Game';
import type { Session } from './Session';
import type { PlayerState } from './PlayerState';
import type { Economy } from '../sim/economy/Economy';
import type { NPCSystem } from '../sim/npc/NPCSystem';
import type { WeatherSystem } from '../sim/Weather';
import type { JobSystem } from './Jobs';
import type { Objectives } from './Objectives';
import type { BusinessManager } from './Business';
import type { EventSystem } from './Events';
import type { Settings } from '../state/settings';
import { useStore } from '../state/store';
import { DISTRICT_INFO } from '../world/types';
import { districtAtPoint } from '../world/CityGenerator';
import { fmtTime } from '../sim/Clock';

export const SAVE_VERSION = 1;
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SaveMeta {
  slot: SlotId;
  savedAt: number;
  seed: number;
  label: string;
  name: string;
  money: number;
  day: number;
  playtime: number;
  thumb: string | null;
}

export interface SaveData extends SaveMeta {
  version: number;
  clock: number;
  pos: { x: number; z: number; yaw: number };
  weather: ReturnType<WeatherSystem['serialize']>;
  player: ReturnType<PlayerState['serialize']>;
  econ: ReturnType<Economy['serialize']>;
  npcs: ReturnType<NPCSystem['serialize']>;
  jobs: ReturnType<JobSystem['serialize']> | null;
  objectives: ReturnType<Objectives['serialize']> | null;
  business: ReturnType<BusinessManager['serialize']>;
  events: ReturnType<EventSystem['serialize']>;
  appointments: Session['appointments'];
  settings: Settings;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = openDB('echo-city', 1, {
      upgrade(d) {
        d.createObjectStore('saves', { keyPath: 'slot' });
        d.createObjectStore('meta', { keyPath: 'slot' });
      },
    });
  return dbp;
}

/** where the player should reappear: outside buildings, beside the car they were driving */
function spawnPoint(s: Session) {
  if (s.mode === 'interior' && s.interiors?.current) {
    const b = s.interiors.current.bld;
    const out = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][b.facing];
    return { x: b.door.x + out[0] * 2.5, z: b.door.z + out[1] * 2.5, yaw: Math.atan2(out[0], out[1]) };
  }
  if (s.driving) {
    const d = s.driving.doorPoint(1);
    return { x: d.x, z: d.z, yaw: s.driving.yaw };
  }
  const p = s.playerPos();
  return { x: p.x, z: p.z, yaw: s.ctl?.yaw ?? 0 };
}

function thumbnail(g: Game): string | null {
  try {
    const src = g.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 135;
    const ctx = c.getContext('2d')!;
    const ar = src.width / src.height;
    const sw = ar > 16 / 9 ? src.height * (16 / 9) : src.width;
    const sh = ar > 16 / 9 ? src.height : src.width / (16 / 9);
    ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 240, 135);
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

export function serializeSession(g: Game, s: Session, slot: SlotId): SaveData {
  const pos = spawnPoint(s);
  // remember where owned cars are parked
  for (const v of s.vehicles) {
    const o = s.player.vehicles.find((x) => x.vid === v.vid);
    if (o) {
      o.x = v.pos.x;
      o.z = v.pos.z;
      o.yaw = v.yaw;
    }
  }
  const district = DISTRICT_INFO[districtAtPoint(s.city, pos.x, pos.z)].name;
  return {
    version: SAVE_VERSION,
    slot,
    savedAt: Date.now(),
    seed: g.worldSeed,
    label: `Day ${s.clock.day} · ${s.clock.weekdayName} ${fmtTime(s.clock.minuteOfDay)} · ${district}`,
    name: s.player.name,
    money: s.player.money,
    day: s.clock.day,
    playtime: s.playtime,
    thumb: thumbnail(g),
    clock: s.clock.t,
    pos,
    weather: s.weather.serialize(),
    player: s.player.serialize(),
    econ: s.econ.serialize(),
    npcs: s.nsys.serialize(),
    jobs: s.jobs?.serialize() ?? null,
    objectives: s.objectives?.serialize() ?? null,
    business: s.business?.serialize() ?? null,
    events: s.events?.serialize() ?? [],
    appointments: s.appointments,
    settings: g.settings,
  };
}

export async function saveGame(g: Game, slot: SlotId): Promise<SaveMeta | null> {
  const s = g.session;
  if (!s || s.background || s.mode === 'none') return null;
  const data = serializeSession(g, s, slot);
  // a JSON round trip drops anything IndexedDB cannot clone (functions, class instances)
  const clean = JSON.parse(JSON.stringify(data)) as SaveData;
  const meta: SaveMeta = { slot, savedAt: data.savedAt, seed: data.seed, label: data.label, name: data.name, money: data.money, day: data.day, playtime: data.playtime, thumb: data.thumb };
  const d = await db();
  const tx = d.transaction(['saves', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('saves').put(clean), tx.objectStore('meta').put(meta), tx.done]);
  return meta;
}

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const d = await db();
    const all = (await d.getAll('meta')) as SaveMeta[];
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function readSave(slot: SlotId): Promise<SaveData | null> {
  const d = await db();
  return ((await d.get('saves', slot)) as SaveData | undefined) ?? null;
}

export async function deleteSave(slot: SlotId) {
  const d = await db();
  const tx = d.transaction(['saves', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('saves').delete(slot), tx.objectStore('meta').delete(slot), tx.done]);
}

/** Rebuild a session from save data. The world for data.seed must already be loaded. */
export function restoreSession(g: Game, data: SaveData): Session {
  const s = g.newSession(data.clock);
  s.setupGameplay();
  s.weather.restore(data.weather);
  s.player.restore(data.player);
  // the player's business adds a business to the city: recreate it before the economy is restored
  if (data.business) {
    const b = s.city.buildings[data.business.building];
    s.business!.create(b, data.business.type, data.business.interior ?? 'store', data.business.name, { priceLevel: data.business.priceLevel });
  }
  s.econ.restore(data.econ);
  s.nsys.restore(data.npcs);
  s.player.business = data.player.business;
  if (data.jobs) s.jobs!.restore(data.jobs);
  if (data.objectives) s.objectives!.restore(data.objectives);
  s.appointments = data.appointments ?? [];
  s.playtime = data.playtime;
  // owned cars
  for (const o of s.player.vehicles) s.spawnVehicle(o.type, o.x, o.z, o.yaw, o.color, 'player', o.label, o.vid);
  s.spawnPlayer(data.pos.x, data.pos.z, data.pos.yaw);
  return s;
}

export function formatPlaytime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** autosave (sleeping, every few in-game hours) — failures are reported but never interrupt play */
export function installAutosave(g: Game) {
  let busy = false;
  g.autosave = () => {
    if (busy) return;
    busy = true;
    saveGame(g, 'auto')
      .then((m) => {
        if (m) useStore.getState().notify({ title: 'Game saved', body: 'Autosave', kind: 'info' });
      })
      .catch((e) => {
        console.warn('autosave failed', e);
        useStore.getState().notify({ title: 'Autosave failed', body: String(e?.message ?? e), kind: 'warning' });
      })
      .finally(() => (busy = false));
  };
}
