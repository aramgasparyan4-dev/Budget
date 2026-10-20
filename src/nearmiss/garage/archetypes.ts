// The ten kinds of car a garage vehicle can drive as. Each is built on its own physics spec
// (src/sim/vehicles.ts, ids 9-18) and has one thing it is best at, so whatever you own is worth
// driving. Pure data: no rendering or physics here.
import { VEHICLES } from '../../sim/vehicles';

export type ArchetypeId = 'compact' | 'sedan' | 'exec' | 'sports' | 'hatch' | 'crossover' | 'offroad' | 'utility' | 'ev' | 'classic';

export interface Perks {
  /** damage taken is divided by this */
  toughness: number;
  /** repair cost multiplier */
  repairMul: number;
  /** upgrade price multiplier */
  priceMul: number;
  /** coins earned multiplier */
  cashMul: number;
  /** banked score multiplier */
  scoreMul: number;
  /** near-miss points multiplier */
  nearMul: number;
  /** drift points multiplier */
  driftMul: number;
  /** boost refill multiplier */
  boostGainMul: number;
  /** boost drain multiplier (lower lasts longer) */
  boostDrainMul: number;
  /** share of the rain grip penalty that still applies (all-wheel drive shrugs most of it off) */
  rainPenalty: number;
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** physics + body spec in VEHICLES */
  type: number;
  /** what it is best at, one line */
  best: string;
  /** the perk, one line */
  perk: string;
  /** examples people will recognise */
  examples: string;
  perks: Perks;
}

const P = (o: Partial<Perks>): Perks => ({
  toughness: 1,
  repairMul: 1,
  priceMul: 1,
  cashMul: 1,
  scoreMul: 1,
  nearMul: 1,
  driftMul: 1,
  boostGainMul: 1,
  boostDrainMul: 1,
  rainPenalty: 1,
  ...o,
});

export const ARCHETYPES: Archetype[] = [
  {
    id: 'compact',
    name: 'City compact',
    type: 9,
    best: 'Cheapest to keep',
    perk: 'Repairs and upgrades cost half. Small enough for gaps nothing else fits.',
    examples: 'Polo, Yaris, Fit, Spark, Matiz, Smart',
    perks: P({ repairMul: 0.5, priceMul: 0.5 }),
  },
  {
    id: 'sedan',
    name: 'Family sedan',
    type: 10,
    best: 'Earns the most',
    perk: '20% more coins from every run. Nothing to learn, nothing to fear.',
    examples: 'Camry, Corolla, Elantra, Passat, Optima',
    perks: P({ cashMul: 1.2 }),
  },
  {
    id: 'exec',
    name: 'Executive',
    type: 11,
    best: 'Longest boost',
    perk: 'Nitro drains 35% slower. Fast, heavy and planted at speed.',
    examples: 'E-Class, 5 Series, A6, GS, Genesis G80',
    perks: P({ boostDrainMul: 0.65, repairMul: 1.5, priceMul: 1.3, toughness: 1.1 }),
  },
  {
    id: 'sports',
    name: 'Sports coupe',
    type: 12,
    best: 'Top speed and grip',
    perk: 'The fastest car here and the most grip. Fragile and dear to fix.',
    examples: '911, Mustang, Supra, Z4, AMG GT',
    perks: P({ toughness: 0.85, repairMul: 1.8, priceMul: 1.5 }),
  },
  {
    id: 'hatch',
    name: 'Hot hatch',
    type: 13,
    best: 'Agility and drifting',
    perk: 'Drifts score 50% more. The sharpest steering of the lot.',
    examples: 'Golf GTI, Civic Type R, i30 N, Focus ST',
    perks: P({ driftMul: 1.5, priceMul: 1.1 }),
  },
  {
    id: 'crossover',
    name: 'Crossover',
    type: 14,
    best: 'All-weather all-rounder',
    perk: 'All-wheel drive keeps most of its grip in the rain. Tougher than a car.',
    examples: 'RAV4, Tucson, Sportage, CR-V, Soueast DX5',
    perks: P({ toughness: 1.2, rainPenalty: 0.25 }),
  },
  {
    id: 'offroad',
    name: 'Off-roader',
    type: 15,
    best: 'Toughest',
    perk: 'Takes three big hits before it is done. Heavy enough to shove traffic.',
    examples: 'Land Cruiser, Patrol, Pajero, Niva, G-Class',
    perks: P({ toughness: 1.7, rainPenalty: 0.4, priceMul: 1.1 }),
  },
  {
    id: 'utility',
    name: 'Pickup / van',
    type: 16,
    best: 'Big target, big points',
    perk: 'Near misses are worth 30% more because it is so wide. Built for knocks.',
    examples: 'Hilux, L200, Navara, Sprinter, Transit, Gazelle',
    perks: P({ nearMul: 1.3, toughness: 1.4, cashMul: 1.1 }),
  },
  {
    id: 'ev',
    name: 'Electric',
    type: 17,
    best: 'Fastest off the line',
    perk: 'Instant torque, and the boost refills 40% faster (regen).',
    examples: 'Tesla, BYD, Zeekr, Leaf, ID.4, Ioniq 5',
    perks: P({ boostGainMul: 1.4, repairMul: 1.3, priceMul: 1.2, rainPenalty: 0.6 }),
  },
  {
    id: 'classic',
    name: 'Classic',
    type: 18,
    best: 'Legend status',
    perk: 'Every point counts 50% more: it is slow, so it is harder. Old steel takes knocks and is cheap to fix.',
    examples: 'Lada 2107, Volga, Moskvich, W123, old Beetle',
    perks: P({ scoreMul: 1.5, repairMul: 0.6, priceMul: 0.8, toughness: 1.25 }),
  },
];

export const ARCHETYPE: Record<ArchetypeId, Archetype> = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a])) as Record<ArchetypeId, Archetype>;

/** seconds from 0 to 100 km/h on the flat (same force curve and drag as DrivableVehicle) */
export function zeroToHundred(type: number): number {
  const s = VEHICLES[type];
  const knee = s.maxSpeed * (s.torqueKnee ?? 0.32);
  const k = 0.36 * (s.width * s.height) * 0.5;
  let v = 0;
  let t = 0;
  while (v < 27.78 && t < 60) {
    const f = s.engine * Math.min(1, knee / Math.max(v, 1)) - k * v * v;
    v += (f / s.mass) * 0.02;
    t += 0.02;
  }
  return t;
}

/** 0..1 ratings for the stat bars (before upgrades), relative to the best of the ten */
export function ratings(a: Archetype) {
  const all = ARCHETYPES.map((x) => VEHICLES[x.type]);
  const s = VEHICLES[a.type];
  const handling = (v: (typeof all)[number]) => v.grip * v.steer;
  const bestTop = Math.max(...all.map((v) => v.maxSpeed));
  const bestHandling = Math.max(...all.map(handling));
  const bestLaunch = Math.min(...ARCHETYPES.map((x) => zeroToHundred(x.type)));
  const maxTough = Math.max(...ARCHETYPES.map((x) => x.perks.toughness));
  return {
    top: s.maxSpeed / bestTop,
    accel: bestLaunch / zeroToHundred(a.type),
    handling: handling(s) / bestHandling,
    toughness: a.perks.toughness / maxTough,
  };
}
