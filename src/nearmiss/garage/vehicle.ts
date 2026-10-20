// A car from the player's garage: the same fields the Garage "Add a vehicle" form collects, and what
// each one changes in the game. Vehicles can arrive from the host page (see bridge.ts), so parsing
// is strict: unknown fields are dropped, strings are trimmed and capped, enums are normalised.
import { ARCHETYPE, ArchetypeId, ARCHETYPES } from './archetypes';
import { makeName, matchArchetype, MatchResult } from './catalog';

export type Condition = 'not_damaged' | 'damaged';
export type Engine = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'gas';
export type Headlights = 'halogen' | 'xenon' | 'led' | 'laser';
export type Steering = 'left' | 'right';

export interface GarageVehicle {
  /** stable id from the host (or made up locally) */
  id: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  color?: string;
  condition?: Condition;
  engine?: Engine;
  /** LPG / CNG equipment fitted */
  gasEquipment?: boolean;
  steeringWheel?: Steering;
  /** rim diameter, inches */
  wheelSize?: number;
  headlights?: Headlights;
  sunroof?: boolean;
  primary?: boolean;
  /** the player picked a type by hand ("drives like") */
  archetype?: ArchetypeId;
  /** where it came from */
  source?: 'host' | 'local';
}

const str = (v: unknown, max = 40): string | undefined => {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = String(v)
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, max);
  return s || undefined;
};

const pick = <T extends string>(v: unknown, map: Record<string, T>): T | undefined => {
  const s = str(v)
    ?.toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  if (!s) return undefined;
  if (s in map) return map[s];
  for (const [k, val] of Object.entries(map)) if (s.includes(k)) return val;
  return undefined;
};

const ENGINES: Record<string, Engine> = {
  petrol: 'petrol',
  gasoline: 'petrol',
  gas: 'gas',
  benzin: 'petrol',
  diesel: 'diesel',
  hybrid: 'hybrid',
  electric: 'electric',
  ev: 'electric',
  lpg: 'gas',
  cng: 'gas',
  propane: 'gas',
  methane: 'gas',
};
const CONDITIONS: Record<string, Condition> = {
  'not damaged': 'not_damaged',
  undamaged: 'not_damaged',
  new: 'not_damaged',
  good: 'not_damaged',
  damaged: 'damaged',
  'after accident': 'damaged',
  accident: 'damaged',
};
const LIGHTS: Record<string, Headlights> = { halogen: 'halogen', xenon: 'xenon', hid: 'xenon', 'bi xenon': 'xenon', led: 'led', matrix: 'led', laser: 'laser' };
const STEERING: Record<string, Steering> = { left: 'left', lhd: 'left', right: 'right', rhd: 'right' };
const bool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  const s = str(v)?.toLowerCase();
  if (!s) return undefined;
  if (['yes', 'true', '1', 'installed', 'lpg', 'cng', 'has'].includes(s)) return true;
  if (['no', 'false', '0', 'none', 'not installed'].includes(s)) return false;
  return undefined;
};

/** a vehicle from untrusted input, or null if it is not usable (needs at least a make and a model) */
export function parseVehicle(raw: unknown, source: 'host' | 'local' = 'host'): GarageVehicle | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const make = str(o.make);
  const model = str(o.model);
  if (!make || !model) return null;
  const id = (str(o.id, 64) ?? `${make}-${model}-${o.year ?? ''}`).replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 64);
  const yearN = Number(o.year);
  const wheelN = Number(String(o.wheelSize ?? '').replace(/[^0-9.]/g, ''));
  const arch = str(o.archetype);
  const v: GarageVehicle = {
    id,
    make,
    model,
    year: Number.isInteger(yearN) && yearN >= 1940 && yearN <= 2035 ? yearN : undefined,
    vin:
      str(o.vin, 17)
        ?.toUpperCase()
        .replace(/[^A-HJ-NPR-Z0-9]/g, '') || undefined,
    color: str(o.color, 24),
    condition: pick(o.condition, CONDITIONS),
    engine: pick(o.engine, ENGINES),
    gasEquipment: bool(o.gasEquipment),
    steeringWheel: pick(o.steeringWheel, STEERING),
    wheelSize: wheelN >= 12 && wheelN <= 24 ? Math.round(wheelN) : undefined,
    headlights: pick(o.headlights, LIGHTS),
    sunroof: bool(o.sunroof),
    primary: o.primary === true,
    archetype: arch && arch in ARCHETYPE ? (arch as ArchetypeId) : undefined,
    source,
  };
  return v;
}

/** paint colours by name (Garage colour list, English and Russian), or a #rrggbb value */
const PAINT: [RegExp, number][] = [
  [/white|бел|pearl/i, 0xeeeeea],
  [/black|черн/i, 0x141416],
  [/silver|серебр/i, 0xb4b9bf],
  [/gr[ae]y|сер|graphite|asphalt/i, 0x5f656c],
  [/burgundy|cherry|maroon|бордо|вишн/i, 0x6d1424],
  [/red|красн/i, 0xc8102e],
  [/orange|оранж/i, 0xf06a14],
  [/yellow|желт/i, 0xf4c20d],
  [/gold|золот|champagne/i, 0xc9a24a],
  [/beige|бежев|sand/i, 0xcdb891],
  [/brown|корич|bronze/i, 0x5b3a24],
  [/light ?blue|sky|голуб|cyan|turquoise|бирюз/i, 0x5fb4e6],
  [/blue|син|navy/i, 0x1f4fa8],
  [/green|зел|olive|khaki/i, 0x2f6b3a],
  [/purple|violet|фиолет|lilac/i, 0x6a3d9a],
  [/pink|розов/i, 0xe36aa6],
];

export function paintOf(color: string | undefined, fallback: number): number {
  if (!color) return fallback;
  const hex = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) return parseInt(hex[1], 16);
  for (const [re, c] of PAINT) if (re.test(color)) return c;
  return fallback;
}

/** what the garage details do to the car in the game (small: the archetype does the heavy lifting) */
export interface CarTweaks {
  power: number;
  top: number;
  grip: number;
  cashMul: number;
  boostGainMul: number;
  /** condition the car arrives in the first time (0-100) */
  startHealth: number;
  notes: string[];
}

export function tweaksOf(v: GarageVehicle): CarTweaks {
  const t: CarTweaks = { power: 1, top: 1, grip: 1, cashMul: 1, boostGainMul: 1, startHealth: 100, notes: [] };
  if (v.engine === 'diesel') {
    t.power *= 1.06;
    t.top *= 0.97;
    t.notes.push('Diesel: more pull, a little less top speed');
  } else if (v.engine === 'hybrid') {
    t.boostGainMul *= 1.15;
    t.notes.push('Hybrid: boost refills 15% faster');
  }
  if (v.gasEquipment || v.engine === 'gas') {
    t.cashMul *= 1.1;
    t.power *= 0.97;
    t.notes.push('Gas equipment: cheaper to run, 10% more coins');
  }
  if (v.wheelSize) {
    const d = Math.max(-3, Math.min(4, v.wheelSize - 16));
    t.grip *= 1 + d * 0.012;
    if (d >= 2) t.notes.push(`R${v.wheelSize} wheels: a little more grip`);
  }
  if (v.condition === 'damaged') {
    t.startHealth = 60;
    t.notes.push('Listed as damaged: starts at 60% condition');
  }
  return t;
}

/** archetype for a vehicle (the player's own pick wins) */
export function archetypeOf(v: GarageVehicle): MatchResult {
  if (v.archetype) return { archetype: v.archetype, how: 'model' };
  return matchArchetype(v.make, v.model, v.year, v.engine);
}

export function displayName(v: GarageVehicle): string {
  return `${makeName(v.make)} ${v.model}${v.year ? ` ${v.year}` : ''}`;
}

/** progress is kept per car: by VIN when there is one, else by the host's id */
export function progressKey(v: GarageVehicle): string {
  return v.vin && v.vin.length >= 11 ? `vin:${v.vin}` : `id:${v.id}`;
}

/** a garage for people who have not added a car: one of each archetype to try */
export function demoGarage(): GarageVehicle[] {
  const pick: [string, string, number, string][] = [
    ['Toyota', 'Camry', 2018, 'silver'],
    ['Soueast', 'DX5', 2024, 'white'],
    ['Lada (VAZ)', '2107', 1998, 'white'],
    ['BMW', 'M4', 2021, 'blue'],
    ['Volkswagen', 'Golf GTI', 2019, 'red'],
    ['Toyota', 'Land Cruiser', 2016, 'black'],
    ['Toyota', 'Hilux', 2020, 'grey'],
    ['Tesla', 'Model 3', 2022, 'white'],
    ['Mercedes-Benz', 'E-Class', 2017, 'black'],
    ['Hyundai', 'i10', 2015, 'yellow'],
  ];
  return pick.map(([make, model, year, color]) => ({ id: `demo-${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), make, model, year, color, source: 'local' as const }));
}

export { ARCHETYPES };
