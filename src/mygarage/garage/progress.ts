// The garage economy: each car keeps its condition and upgrades between runs; coins are shared.
// Pure functions plus a small localStorage save. A host page can also hand saved progress in and
// receive it back (bridge.ts), so it can live on the player's account instead of in the browser.
import { VEHICLES } from '../../sim/vehicles';
import { ARCHETYPE, Archetype } from './archetypes';
import { archetypeOf, CarTweaks, GarageVehicle, parseVehicle, progressKey, tweaksOf } from './vehicle';

export type UpgradeId = 'engine' | 'gearing' | 'tires' | 'brakes' | 'armor' | 'nitro';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  /** what one level does */
  effect: string;
  /** what the parts search on the host would look for */
  parts: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'engine', name: 'Engine tune', effect: '+7% power', parts: 'engine' },
  { id: 'gearing', name: 'Gearbox', effect: '+5% top speed', parts: 'transmission' },
  { id: 'tires', name: 'Tires', effect: '+5% grip', parts: 'tires' },
  { id: 'brakes', name: 'Brakes', effect: '+12% braking', parts: 'brakes' },
  { id: 'armor', name: 'Body armour', effect: '−9% damage', parts: 'body' },
  { id: 'nitro', name: 'Nitro tank', effect: '−10% boost drain', parts: 'turbo' },
];

export const MAX_LEVEL = 5;
const LEVEL_COST = [250, 600, 1100, 1800, 2800];

export interface CarProgress {
  /** 0-100 */
  health: number;
  upgrades: Record<UpgradeId, number>;
  runs: number;
  bestScore: number;
}

export interface GarageSave {
  version: 1;
  coins: number;
  /** by progressKey() */
  cars: Record<string, CarProgress>;
  /** cars added in the game (host cars come from the host each time) */
  localVehicles: GarageVehicle[];
  activeId: string | null;
}

export const STARTING_COINS = 500;

export function emptySave(): GarageSave {
  return { version: 1, coins: STARTING_COINS, cars: {}, localVehicles: [], activeId: null };
}

export function freshProgress(v: GarageVehicle): CarProgress {
  return { health: tweaksOf(v).startHealth, upgrades: { engine: 0, gearing: 0, tires: 0, brakes: 0, armor: 0, nitro: 0 }, runs: 0, bestScore: 0 };
}

export function progressOf(save: GarageSave, v: GarageVehicle): CarProgress {
  return save.cars[progressKey(v)] ?? freshProgress(v);
}

export function upgradeCost(a: Archetype, level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return Math.round((LEVEL_COST[level] * a.perks.priceMul) / 10) * 10;
}

export function repairCost(a: Archetype, health: number): number {
  return Math.ceil(Math.max(0, 100 - health) * 5 * a.perks.repairMul);
}

/** a wrecked car still drives: it limps out at this condition (repairs on the road are free) */
export const LIMP_HEALTH = 25;

/** the condition a run starts at */
export function startHealth(health: number) {
  return Math.max(LIMP_HEALTH, Math.min(100, health));
}

/** everything the game needs to drive this car */
export interface CarSetup {
  vehicle: GarageVehicle;
  archetype: Archetype;
  type: number;
  tweaks: CarTweaks;
  progress: CarProgress;
  /** multipliers on the physics */
  power: number;
  top: number;
  grip: number;
  brake: number;
  /** damage taken per hit (1 = a two-hit car) */
  damageTaken: number;
  boostDrainMul: number;
  boostGainMul: number;
  startBoost: number;
  cashMul: number;
  scoreMul: number;
  nearMul: number;
  driftMul: number;
  rainPenalty: number;
}

export function carSetup(v: GarageVehicle, p: CarProgress): CarSetup {
  const a = ARCHETYPE[archetypeOf(v).archetype];
  const t = tweaksOf(v);
  const u = p.upgrades;
  const k = a.perks;
  return {
    vehicle: v,
    archetype: a,
    type: a.type,
    tweaks: t,
    progress: p,
    power: t.power * (1 + 0.07 * u.engine),
    top: t.top * (1 + 0.05 * u.gearing),
    grip: t.grip * (1 + 0.05 * u.tires),
    brake: 1 + 0.12 * u.brakes,
    damageTaken: (1 - 0.09 * u.armor) / k.toughness,
    boostDrainMul: k.boostDrainMul * (1 - 0.1 * u.nitro),
    boostGainMul: k.boostGainMul * t.boostGainMul,
    startBoost: Math.min(1, 0.35 + 0.08 * u.nitro),
    cashMul: k.cashMul * t.cashMul,
    scoreMul: k.scoreMul,
    nearMul: k.nearMul,
    driftMul: k.driftMul,
    rainPenalty: k.rainPenalty,
  };
}

/** performance left in a damaged car (power, top speed) */
export function damageFactor(health: number) {
  const h = Math.max(0, Math.min(100, health)) / 100;
  return { power: 0.7 + 0.3 * h, top: 0.82 + 0.18 * h };
}

/** coins for a free-drive run */
export function runCoins(score: number, s: CarSetup): number {
  return Math.round((score / 20) * s.cashMul);
}

/** coins for a highway drive: as a run up to 20,000 points, a quarter of that rate beyond (drives have no end) */
export function highwayCoins(score: number, s: CarSetup): number {
  return Math.round((Math.min(score, 20000) / 20 + Math.max(0, score - 20000) / 80) * s.cashMul);
}

/** coins for a race: a prize for winning (more for a big margin), something for finishing */
export function raceCoins(won: boolean, finished: boolean, margin: number, s: CarSetup): number {
  const base = won ? 400 + Math.min(400, Math.max(0, margin) * 20) : finished ? 120 : 40;
  return Math.round(base * s.cashMul);
}

// ------------------------------------------------------------------ actions (return a new save)

export function withCar(save: GarageSave, v: GarageVehicle, f: (p: CarProgress) => CarProgress): GarageSave {
  const key = progressKey(v);
  return { ...save, cars: { ...save.cars, [key]: f(structuredClone(progressOf(save, v))) } };
}

export type ActionResult = { ok: true; save: GarageSave } | { ok: false; reason: string };

export function buyUpgrade(save: GarageSave, v: GarageVehicle, id: UpgradeId): ActionResult {
  const a = ARCHETYPE[archetypeOf(v).archetype];
  const lvl = progressOf(save, v).upgrades[id];
  const cost = upgradeCost(a, lvl);
  if (cost === null) return { ok: false, reason: 'Already at the top level' };
  if (save.coins < cost) return { ok: false, reason: `Needs ${cost - save.coins} more coins` };
  const s = withCar(save, v, (p) => ({ ...p, upgrades: { ...p.upgrades, [id]: lvl + 1 } }));
  return { ok: true, save: { ...s, coins: save.coins - cost } };
}

export function repair(save: GarageSave, v: GarageVehicle): ActionResult {
  const a = ARCHETYPE[archetypeOf(v).archetype];
  const p = progressOf(save, v);
  const cost = repairCost(a, p.health);
  if (cost === 0) return { ok: false, reason: 'Nothing to fix' };
  if (save.coins >= cost) return { ok: true, save: { ...withCar(save, v, (q) => ({ ...q, health: 100 })), coins: save.coins - cost } };
  // partial repair with what there is
  const per = cost / (100 - p.health);
  const pts = Math.floor(save.coins / per);
  if (pts <= 0) return { ok: false, reason: 'Not enough coins' };
  return { ok: true, save: { ...withCar(save, v, (q) => ({ ...q, health: Math.min(100, q.health + pts) })), coins: save.coins - Math.ceil(pts * per) } };
}

/** after a run: the car's new condition and the coins it earned */
export function finishRun(save: GarageSave, v: GarageVehicle, health: number, coins: number, score: number): GarageSave {
  const s = withCar(save, v, (p) => ({ ...p, health: Math.max(0, Math.min(100, Math.round(health))), runs: p.runs + 1, bestScore: Math.max(p.bestScore, score) }));
  return { ...s, coins: save.coins + Math.max(0, Math.round(coins)) };
}

// ------------------------------------------------------------------ storage

// storage keys keep the game's first name (Near Miss) so existing saves carry over
const KEY = 'near-miss-garage-v1';

export function loadSave(): GarageSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizeSave(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt: start over */
  }
  return emptySave();
}

export function storeSave(s: GarageSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lasts for this visit */
  }
}

/** progress from storage or a host: clamp everything, drop what does not fit */
export function sanitizeSave(raw: unknown): GarageSave {
  const out = emptySave();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  const n = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d);
  out.coins = Math.round(n(o.coins, 0, 1e9, STARTING_COINS));
  if (o.cars && typeof o.cars === 'object') {
    for (const [k, c] of Object.entries(o.cars as Record<string, unknown>).slice(0, 50)) {
      if (!c || typeof c !== 'object' || k.length > 80) continue;
      const cp = c as Record<string, unknown>;
      const up = (cp.upgrades ?? {}) as Record<string, unknown>;
      out.cars[k] = {
        health: n(cp.health, 0, 100, 100),
        upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, Math.round(n(up[u.id], 0, MAX_LEVEL, 0))])) as Record<UpgradeId, number>,
        runs: Math.round(n(cp.runs, 0, 1e7, 0)),
        bestScore: Math.round(n(cp.bestScore, 0, 1e9, 0)),
      };
    }
  }
  if (Array.isArray(o.localVehicles)) {
    out.localVehicles = o.localVehicles
      .slice(0, 20)
      .map((v) => parseVehicle(v, 'local'))
      .filter((v): v is GarageVehicle => v !== null);
  }
  out.activeId = typeof o.activeId === 'string' ? o.activeId.slice(0, 64) : null;
  return out;
}

/** physics spec name for a setup (for debugging and tests) */
export function specName(s: CarSetup) {
  return VEHICLES[s.type].name;
}
