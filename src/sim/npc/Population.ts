import * as THREE from 'three';
import { RNG } from '../../core/rng';
import type { CityData, DistrictId } from '../../world/types';
import { DISTRICT_INFO } from '../../world/types';
import { personName } from '../../world/names';
import { randomLook } from '../../render/Human';
import { NPC, newRel, Goal, Rel } from './types';
import { VEHICLES } from '../vehicles';

export const POPULATION = 640;

function setRel(a: NPC, b: NPC, r: Partial<Rel>) {
  const ra = a.rel.get(b.id) ?? newRel();
  const rb = b.rel.get(a.id) ?? newRel();
  Object.assign(ra, r);
  Object.assign(rb, r);
  a.rel.set(b.id, ra);
  b.rel.set(a.id, rb);
}

/** Deterministically generate the city's residents from the world seed. */
export function generatePopulation(city: CityData, seed: number, count = POPULATION): NPC[] {
  const rng = new RNG(seed ^ 0x5eed);
  const npcs: NPC[] = [];
  const homeCap = new Map<number, number>();
  for (const h of city.homes) homeCap.set(h.id, h.capacity);
  homeCap.set(city.playerHomeId, 0);

  // ---- choose jobs: at least one worker per business, then fill large employers
  const slots: { biz: number; slot: number; wage: number; role: string }[] = [];
  const bizOrder = rng.shuffle(city.businesses.map((b) => b.id));
  for (const id of bizOrder) {
    const b = city.businesses[id];
    if (!b.jobs.length) continue;
    const j = Math.floor(rng.next() * b.jobs.length);
    slots.push({ biz: id, slot: j, wage: b.jobs[j].wage, role: b.jobs[j].role });
  }
  const extra: { biz: number; slot: number; wage: number; role: string }[] = [];
  for (const b of city.businesses) {
    b.jobs.forEach((j, si) => {
      for (let k = 1; k < j.count; k++) extra.push({ biz: b.id, slot: si, wage: j.wage, role: j.role });
    });
  }
  rng.shuffle(extra);
  const workerTarget = Math.round(count * 0.74);
  while (slots.length < workerTarget && extra.length) slots.push(extra.pop()!);
  slots.length = Math.min(slots.length, workerTarget);

  const makeNPC = (id: number, job: (typeof slots)[number] | null, occupation: string, ageRange: [number, number]): NPC => {
    const r = rng.fork(id * 7 + 13);
    const female = r.chance(0.5);
    const { first, last } = personName(r, female);
    const age = r.int(ageRange[0], ageRange[1]);
    const wage = job ? job.wage : occupation === 'Retired' ? 14 : occupation === 'Student' ? 4 : 0;
    const wealth = Math.min(1, Math.max(0, (wage - 12) / 55 + r.range(-0.12, 0.12)));
    const traits = {
      sociability: r.trait(),
      ambition: r.trait(),
      patience: r.trait(),
      confidence: r.trait(),
      kindness: r.trait(0.55),
      risk: r.trait(0.45),
      curiosity: r.trait(),
    };
    const look = randomLook(() => r.next(), female, wealth);
    const ownsCar = r.chance(0.14 + wealth * 0.85) && age >= 19;
    const carType = wealth > 0.85 && r.chance(0.35) ? 3 : wealth > 0.55 ? r.pick([1, 2, 2]) : r.pick([0, 0, 1]);
    const spec = VEHICLES[carType];
    const sleepShift = job && city.businesses[job.biz].jobs[job.slot].start >= 17 ? 6 : 0;
    const wake = 6 + r.range(0, 1.6) + (1 - traits.ambition) * 0.8 + sleepShift;
    const bed = 22 + r.range(-0.5, 1.5) + traits.sociability * 0.6 + sleepShift;
    const n: NPC = {
      id,
      first,
      last,
      female,
      age,
      occupation,
      job: job ? { biz: job.biz, slot: job.slot } : null,
      home: -1,
      traits,
      look,
      money: Math.round(200 + wage * r.range(40, 260) * (0.5 + traits.ambition)),
      wage,
      ownsCar,
      carType,
      carColor: spec.palette[Math.floor(r.next() * spec.palette.length)],
      mood: r.range(-0.1, 0.4),
      stress: r.range(0, 0.3),
      needs: { hunger: r.range(0.5, 0.9), energy: r.range(0.6, 1), social: r.range(0.3, 0.9), fun: r.range(0.3, 0.9) },
      groceries: r.int(0, 6),
      goal: { kind: 'save', target: 1000, done: false },
      activity: { kind: 'home', place: { k: 'b', id: 0 }, until: 0, started: 0 },
      loc: null,
      trip: null,
      rel: new Map(),
      relPlayer: newRel(),
      memories: [],
      knowsPlayer: false,
      hasNumber: false,
      lastUpdate: 0,
      wake,
      bed,
      lateCount: 0,
      shiftsWorked: r.int(0, 200),
      title: occupation,
      appointment: null,
      favorites: [],
      proxy: 'none',
      hold: 0,
      lastTalk: -9999,
      requestOpen: false,
      wealth,
    };
    return n;
  };

  let id = 0;
  for (const s of slots) npcs.push(makeNPC(id++, s, s.role, [19, 64]));
  const rest = count - npcs.length;
  for (let k = 0; k < rest; k++) {
    const roll = rng.next();
    if (roll < 0.34) npcs.push(makeNPC(id++, null, 'Student', [17, 24]));
    else if (roll < 0.72) npcs.push(makeNPC(id++, null, 'Retired', [65, 86]));
    else if (roll < 0.86) npcs.push(makeNPC(id++, null, 'Freelancer', [22, 50]));
    else npcs.push(makeNPC(id++, null, 'Unemployed', [19, 58]));
  }

  // ---- homes: wealth tiers pick districts
  const homesByTier: number[][] = [[], [], []];
  for (const h of city.homes) {
    if (h.id === city.playerHomeId) continue;
    const b = city.buildings[h.building];
    const tier = h.quality > 0.9 ? 2 : DISTRICT_INFO[b.district].wealth > 0.65 || h.quality > 0.7 ? 1 : 0;
    homesByTier[tier].push(h.id);
  }
  for (const t of homesByTier) rng.shuffle(t);
  const pickHome = (n: NPC) => {
    const tier = n.wealth > 0.78 ? 2 : n.wealth > 0.45 ? 1 : 0;
    for (const t of [tier, tier - 1, tier + 1, 0, 1, 2]) {
      const list = homesByTier[t];
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const hid = list[i];
        const cap = homeCap.get(hid) ?? 0;
        if (cap > 0) {
          homeCap.set(hid, cap - 1);
          if (cap - 1 <= 0) list.splice(i, 1);
          return hid;
        }
      }
    }
    return city.homes[0].id;
  };
  // households: some npcs share homes with a partner/roommate
  const unhoused = rng.shuffle([...npcs]);
  for (const n of unhoused) {
    if (n.home >= 0) continue;
    n.home = pickHome(n);
    const cap = homeCap.get(n.home) ?? 0;
    if (cap > 0 && rng.chance(0.45)) {
      // find a compatible housemate
      const mate = unhoused.find((m) => m.home < 0 && m !== n && Math.abs(m.age - n.age) < 12 && Math.abs(m.wealth - n.wealth) < 0.35);
      if (mate) {
        mate.home = n.home;
        homeCap.set(n.home, cap - 1);
        const partner = n.age > 22 && mate.age > 22 && rng.chance(0.65);
        setRel(n, mate, partner
          ? { fam: 95, friend: 78, trust: 70, romance: 82, tag: 'partner' }
          : { fam: 80, friend: 45, trust: 40, tag: 'roommate' });
      }
    }
  }

  // ---- coworkers, neighbours, friends
  const byBiz = new Map<number, NPC[]>();
  const byBuilding = new Map<number, NPC[]>();
  for (const n of npcs) {
    if (n.job) {
      let a = byBiz.get(n.job.biz);
      if (!a) byBiz.set(n.job.biz, (a = []));
      a.push(n);
    }
    const b = city.homes[n.home].building;
    let a2 = byBuilding.get(b);
    if (!a2) byBuilding.set(b, (a2 = []));
    a2.push(n);
  }
  for (const list of byBiz.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].rel.has(list[j].id)) continue;
        setRel(list[i], list[j], { fam: rng.int(20, 70), friend: rng.int(-10, 40), trust: rng.int(0, 35), prof: rng.int(20, 70), tag: 'coworker' });
      }
  }
  for (const list of byBuilding.values()) {
    for (let i = 0; i < list.length && i < 10; i++)
      for (let j = i + 1; j < list.length && j < 10; j++) {
        if (list[i].rel.has(list[j].id)) continue;
        if (rng.chance(0.55)) setRel(list[i], list[j], { fam: rng.int(10, 45), friend: rng.int(-5, 25), tag: 'neighbor' });
      }
  }
  for (const n of npcs) {
    const k = Math.round(1 + n.traits.sociability * 3);
    for (let f = 0; f < k; f++) {
      const o = npcs[Math.floor(rng.next() * npcs.length)];
      if (o === n || n.rel.has(o.id)) continue;
      if (Math.abs(o.age - n.age) > 18) continue;
      setRel(n, o, { fam: rng.int(45, 90), friend: rng.int(40, 85), trust: rng.int(30, 75), tag: 'friend' });
    }
    // an occasional rival
    if (rng.chance(0.12)) {
      const o = npcs[Math.floor(rng.next() * npcs.length)];
      if (o !== n && !n.rel.has(o.id)) setRel(n, o, { fam: rng.int(30, 60), friend: rng.int(-60, -25), rival: rng.int(45, 80) });
    }
  }

  // ---- goals
  for (const n of npcs) {
    const r = rng.fork(n.id + 999);
    let goal: Goal;
    const partner = [...n.rel.values()].some((x) => x.tag === 'partner');
    if (n.occupation === 'Unemployed') goal = { kind: 'job', target: 0, done: false };
    else if (!n.ownsCar && n.wage > 18 && r.chance(0.5)) goal = { kind: 'car', target: VEHICLES[n.wealth > 0.5 ? 1 : 0].price, done: false };
    else if (!partner && n.traits.sociability > 0.55 && n.age < 45 && r.chance(0.5)) goal = { kind: 'partner', target: 0, done: false };
    else if (n.traits.ambition > 0.65 && n.job) goal = { kind: 'promotion', target: n.shiftsWorked + 60, done: false };
    else if (n.traits.sociability < 0.35) goal = { kind: 'friends', target: 3, done: false };
    else if (n.traits.ambition > 0.7 && n.wealth > 0.6) goal = { kind: 'business', target: 40000, done: false };
    else goal = { kind: 'save', target: Math.round(n.money * 2 + 1000), done: false };
    n.goal = goal;
    // starting place: home
    n.loc = { k: 'b', id: city.homes[n.home].building };
    n.activity = { kind: 'home', place: n.loc, until: 0, started: 0 };
  }
  void THREE;
  return npcs;
}

export function npcName(n: NPC) {
  return `${n.first} ${n.last}`;
}

export function districtOfHome(city: CityData, n: NPC): DistrictId {
  return city.buildings[city.homes[n.home].building].district;
}
