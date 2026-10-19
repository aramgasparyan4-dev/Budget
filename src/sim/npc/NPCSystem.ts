import type { BusinessType, CityData } from '../../world/types';
import { RNG, hash01 } from '../../core/rng';
import { clamp } from '../../core/math';
import { Clock, inHours, MIN_PER_DAY } from '../Clock';
import { Economy } from '../economy/Economy';
import { SidewalkNav, pathLength } from '../nav/SidewalkNav';
import { Activity, ActivityKind, Memory, MemoryType, NPC, newRel, Place, Rel, Trip } from './types';
import { npcName } from './Population';
import { VEHICLES } from '../vehicles';

export interface NPCHooks {
  onDepart?: (n: NPC, trip: Trip) => void;
  onArrive?: (n: NPC, place: Place) => void;
  onNews?: (headline: string, body: string, cat: string, place?: Place) => void;
  onMessage?: (n: NPC, text: string, kind: 'invite' | 'thanks' | 'angry' | 'chat' | 'request' | 'news') => void;
}

export interface WeatherView {
  rain: number;
  storm: number;
  temp: number;
}

const EAT_TYPES: BusinessType[] = ['cafe', 'restaurant', 'fastfood'];
const SHOP_TYPES: BusinessType[] = ['clothing', 'electronics', 'bookstore', 'pharmacy', 'salon'];
const NIGHT_TYPES: BusinessType[] = ['bar', 'nightclub'];

export const placeKey = (p: Place) => (p.k === 'b' ? p.id : -1 - p.id);

const ACTIVITY_TEXT: Record<ActivityKind, string> = {
  sleep: 'sleeping',
  home: 'relaxing at home',
  work: 'working',
  eat: 'having a meal',
  eatHome: 'cooking at home',
  groceries: 'buying groceries',
  shop: 'shopping',
  social: 'hanging out with a friend',
  visit: 'visiting a friend',
  leisure: 'taking a stroll',
  nightlife: 'out for drinks',
  gym: 'working out',
  cinema: 'at the movies',
  jobhunt: 'looking for work',
  errand: 'running errands',
  event: 'at a city event',
  school: 'at school',
  appointment: 'meeting someone',
  drive: 'driving around',
};

export class NPCSystem {
  present = new Map<number, Set<number>>();
  venues = new Map<BusinessType, number[]>();
  doors: { x: number; z: number }[] = [];
  nav: SidewalkNav;
  rng: RNG;
  private cursor = 0;
  weather: WeatherView = { rain: 0, storm: 0, temp: 18 };
  gathering: { place: Place; until: number; name: string } | null = null;
  playerPos = { x: 0, z: 0 };
  hooks: NPCHooks = {};
  /** extra game minutes added to car trips crossing affected areas */
  trafficPenalty: { x: number; z: number; r: number; minutes: number }[] = [];
  lastDay = -1;
  lastHour = -1;
  stats = { updates: 0, inTransit: 0 };

  constructor(public city: CityData, public npcs: NPC[], public econ: Economy, public clock: Clock, seed: number) {
    this.nav = new SidewalkNav(city);
    this.rng = new RNG(seed ^ 0xb0a7);
    for (const b of city.buildings) this.doors.push(b.door);
    for (const b of city.businesses) {
      let list = this.venues.get(b.type);
      if (!list) this.venues.set(b.type, (list = []));
      list.push(b.id);
    }
    econ.attachEmployees(npcs);
  }

  // ------------------------------------------------------------------ helpers
  placePos(p: Place) {
    if (p.k === 'b') return this.doors[p.id];
    const o = this.city.outdoor[p.id];
    return { x: o.x, z: o.z };
  }
  placeName(p: Place) {
    if (p.k === 'o') return this.city.outdoor[p.id].name;
    const b = this.city.buildings[p.id];
    return b.name ?? b.address;
  }
  homeBuilding(n: NPC) {
    return this.city.homes[n.home].building;
  }
  homePlace(n: NPC): Place {
    return { k: 'b', id: this.homeBuilding(n) };
  }
  workPlace(n: NPC): Place | null {
    if (!n.job) return null;
    return { k: 'b', id: this.city.businesses[n.job.biz].building };
  }
  describe(n: NPC) {
    if (n.trip) return `heading to ${this.placeName(n.trip.to)}`;
    return ACTIVITY_TEXT[n.activity.kind] ?? 'busy';
  }
  isAt(n: NPC, p: Place) {
    return !!n.loc && n.loc.k === p.k && n.loc.id === p.id;
  }
  presentAt(p: Place): number[] {
    const s = this.present.get(placeKey(p));
    return s ? [...s] : [];
  }
  private enter(n: NPC, p: Place) {
    const k = placeKey(p);
    let s = this.present.get(k);
    if (!s) this.present.set(k, (s = new Set()));
    s.add(n.id);
    n.loc = p;
    if (n.job && p.k === 'b' && this.city.businesses[n.job.biz].building === p.id && n.activity.kind === 'work') this.econ.biz[n.job.biz].staffPresent++;
  }
  /** staff on shift, recounted from who is actually at work (the enter/leave counters drift when an
   *  activity changes before the worker leaves) */
  recountStaff() {
    for (const s of this.econ.biz) s.staffPresent = 0;
    for (const n of this.npcs) if (n.job && !n.trip && n.activity.kind === 'work' && this.isAt(n, this.workPlace(n)!)) this.econ.biz[n.job.biz].staffPresent++;
  }
  private leave(n: NPC) {
    if (!n.loc) return;
    this.present.get(placeKey(n.loc))?.delete(n.id);
    if (n.job && n.loc.k === 'b' && this.city.businesses[n.job.biz].building === n.loc.id && n.activity.kind === 'work') {
      const s = this.econ.biz[n.job.biz];
      s.staffPresent = Math.max(0, s.staffPresent - 1);
    }
    n.loc = null;
  }
  rel(n: NPC, other: number): Rel {
    if (other < 0) return n.relPlayer;
    let r = n.rel.get(other);
    if (!r) n.rel.set(other, (r = newRel()));
    return r;
  }

  addMemory(n: NPC, type: MemoryType, who: number[], importance: number, valence: number, place?: number, note?: string) {
    const m: Memory = { t: this.clock.t, type, who, importance, valence, place, note };
    n.memories.push(m);
    n.mood = clamp(n.mood + valence * importance * 0.25, -1, 1);
    if (n.memories.length > 36) {
      // forget the weakest memory
      let wi = 0;
      let ws = Infinity;
      for (let i = 0; i < n.memories.length; i++) {
        const s = this.strength(n.memories[i]);
        if (s < ws) {
          ws = s;
          wi = i;
        }
      }
      n.memories.splice(wi, 1);
    }
    return m;
  }
  /** memory strength decays with time; important memories last much longer */
  strength(m: Memory) {
    const ageDays = (this.clock.t - m.t) / MIN_PER_DAY;
    const tau = 1.5 + m.importance * 12;
    return m.importance * Math.exp(-ageDays / tau);
  }
  recall(n: NPC, filter: (m: Memory) => boolean, min = 0.05) {
    return n.memories.filter((m) => filter(m) && this.strength(m) > min).sort((a, b) => this.strength(b) - this.strength(a));
  }
  /** overall feeling about the player from memories + relationship */
  attitude(n: NPC) {
    const r = n.relPlayer;
    let mem = 0;
    for (const m of n.memories) if (m.who.includes(-1)) mem += m.valence * this.strength(m);
    return clamp(r.friend / 100 + r.trust / 200 - r.rival / 150 + mem * 0.6, -1, 1);
  }

  dist(a: Place, b: Place) {
    const pa = this.placePos(a);
    const pb = this.placePos(b);
    return Math.abs(pa.x - pb.x) + Math.abs(pa.z - pb.z);
  }

  /** travel estimate in game minutes */
  travel(n: NPC, from: Place, to: Place, hour: number): { mode: Trip['mode']; minutes: number } {
    const d = this.dist(from, to) * 1.05;
    if (d < 5) return { mode: 'walk', minutes: 1 };
    const walk = d / 78 + 1;
    if (n.ownsCar && d > 650) {
      const rush = (hour > 7.2 && hour < 9.2) || (hour > 16.4 && hour < 18.8) ? 1.45 : 1;
      let pen = 0;
      const pa = this.placePos(from);
      const pb = this.placePos(to);
      for (const p of this.trafficPenalty) {
        const mx = (pa.x + pb.x) / 2;
        const mz = (pa.z + pb.z) / 2;
        if (Math.hypot(p.x - mx, p.z - mz) < p.r + d / 2) pen += p.minutes;
      }
      return { mode: 'car', minutes: (d / 380) * rush + 4 + pen };
    }
    if (d > 1300) return { mode: 'bus', minutes: d / 240 + 7 };
    return { mode: 'walk', minutes: walk };
  }

  // ------------------------------------------------------------------ schedule
  shiftToday(n: NPC, now: number): { start: number; end: number; biz: number } | null {
    if (!n.job) return null;
    const j = this.city.businesses[n.job.biz].jobs[n.job.slot];
    if (!j) return null;
    const day = Math.floor(now / MIN_PER_DAY);
    for (const d of [day, day - 1]) {
      if (!j.days.includes(d % 7)) continue;
      const start = d * MIN_PER_DAY + j.start * 60;
      const end = d * MIN_PER_DAY + j.end * 60;
      if (now < end) return { start, end, biz: n.job.biz };
    }
    return null;
  }

  /** A human-readable plan of the day for dialogue / phone. */
  todaySchedule(n: NPC): { time: string; what: string }[] {
    const out: { time: string; what: string }[] = [];
    const fmt = (h: number) => {
      const hh = Math.floor(((h % 24) + 24) % 24);
      const mm = Math.round((h - Math.floor(h)) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
    };
    out.push({ time: fmt(n.wake), what: 'Wake up' });
    if (n.job) {
      const j = this.city.businesses[n.job.biz].jobs[n.job.slot];
      const today = this.clock.weekday;
      if (j.days.includes(today)) {
        out.push({ time: fmt(j.start - 0.6), what: `Commute to ${this.city.businesses[n.job.biz].name}` });
        out.push({ time: fmt(j.start), what: `Work (${n.title})` });
        if (j.end - j.start >= 7) out.push({ time: fmt(j.start + (j.end - j.start) / 2), what: 'Lunch break' });
        out.push({ time: fmt(j.end), what: 'Leave work' });
      } else out.push({ time: fmt(n.wake + 2), what: 'Day off' });
    } else if (n.occupation === 'Student') out.push({ time: '08:00', what: 'Classes' });
    else if (n.occupation === 'Unemployed') out.push({ time: fmt(n.wake + 1.5), what: 'Job hunting' });
    if (n.traits.sociability > 0.6) out.push({ time: '19:00', what: 'See friends' });
    else out.push({ time: '18:30', what: 'Errands or shopping' });
    if (n.appointment && !n.appointment.done) {
      const h = (n.appointment.t % MIN_PER_DAY) / 60;
      out.push({ time: fmt(h), what: `Meet ${n.appointment.with === -1 ? 'you' : 'a friend'} at ${this.placeName(n.appointment.place)}` });
    }
    out.push({ time: fmt(n.bed), what: 'Sleep' });
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }

  // ------------------------------------------------------------------ venues
  pickVenue(n: NPC, types: BusinessType[], from: Place, maxDist = 1400): number {
    const h = this.clock.hour;
    const wd = this.clock.weekday;
    const pf = this.placePos(from);
    const reach = n.ownsCar ? 1100 : 520;
    const cands: { id: number; w: number }[] = [];
    for (const t of types) {
      for (const id of this.venues.get(t) ?? []) {
        if (!this.econ.isOpen(id, h, wd)) continue;
        const def = this.city.businesses[id];
        const door = this.doors[def.building];
        const d = Math.abs(door.x - pf.x) + Math.abs(door.z - pf.z);
        if (d > maxDist) continue;
        const s = this.econ.biz[id];
        const price = this.econ.price(id);
        if (price > n.money * 0.4 && price > 3) continue;
        const want = 0.75 + n.wealth * 0.8;
        const priceFit = 1 - Math.min(0.8, Math.abs(def.priceLevel * s.priceMul - want) * 0.8);
        const fav = n.favorites.includes(id) ? 1.7 : 1;
        const novelty = n.favorites.includes(id) ? 1 : 1 + n.traits.curiosity * 0.5;
        const w = Math.exp(-d / reach) * (0.4 + s.reputation) * priceFit * fav * novelty * (0.6 + this.rng.next() * 0.8);
        cands.push({ id, w });
      }
    }
    if (!cands.length) return -1;
    cands.sort((a, b) => b.w - a.w);
    const top = cands.slice(0, 6);
    return this.rng.weighted(
      top.map((c) => c.id),
      top.map((c) => c.w),
    );
  }

  pickOutdoor(n: NPC, from: Place, kinds: ('park' | 'plaza' | 'promenade')[]): number {
    const pf = this.placePos(from);
    const cands: { id: number; w: number }[] = [];
    for (const o of this.city.outdoor) {
      if (!kinds.includes(o.kind as 'park')) continue;
      const d = Math.abs(o.x - pf.x) + Math.abs(o.z - pf.z);
      cands.push({ id: o.id, w: Math.exp(-d / (n.ownsCar ? 900 : 450)) * (0.5 + this.rng.next()) });
    }
    if (!cands.length) return -1;
    cands.sort((a, b) => b.w - a.w);
    const top = cands.slice(0, 5);
    return this.rng.weighted(
      top.map((c) => c.id),
      top.map((c) => c.w),
    );
  }

  // ------------------------------------------------------------------ decision
  choose(n: NPC, now: number, opts: { maxDist?: number; local?: boolean } = {}): Activity {
    const hour = (now % MIN_PER_DAY) / 60;
    const wd = Math.floor(now / MIN_PER_DAY) % 7;
    const weekend = wd >= 5;
    const here: Place = n.loc ?? (n.trip ? n.trip.to : this.homePlace(n));
    const home = this.homePlace(n);
    const t = n.traits;
    const N = n.needs;
    const rain = this.weather.rain;
    const mk = (kind: ActivityKind, place: Place, mins: number, biz?: number, withId?: number): Activity => ({ kind, place, until: now + mins, started: now, biz, with: withId });

    if (!opts.local) {
      // appointment (with player or friend)
      const ap = n.appointment;
      if (ap && !ap.done) {
        const tr = this.travel(n, here, ap.place, hour).minutes;
        if (now >= ap.t - tr - 6 && now < ap.t + 50) return mk('appointment', ap.place, Math.max(30, ap.t + 75 - now), undefined, ap.with);
        if (now >= ap.t + 50) {
          ap.done = true;
          if (ap.with === -1 && !ap.arrived) {
            this.addMemory(n, 'stood_up_by_player', [-1], 0.75, -0.8, ap.place.k === 'b' ? ap.place.id : undefined);
            n.relPlayer.trust -= 15;
            n.relPlayer.friend -= 10;
            this.hooks.onMessage?.(n, this.rng.pick(["I waited for you... you never showed up.", "Guess you forgot about me. Thanks a lot.", "I was at the place we agreed. Where were you?"]), 'angry');
          }
          n.appointment = null;
        }
      }
      // an imminent shift beats the sleep window (the alarm went off)
      {
        const sh = this.shiftToday(n, now);
        if (sh) {
          const wp = this.workPlace(n)!;
          const tr = this.travel(n, here, wp, hour).minutes;
          if (now >= sh.start - tr - 30 && now < sh.end - 20) {
            return mk('work', wp, Math.max(15, sh.end - Math.max(now, sh.start)) + Math.max(0, sh.start - now), sh.biz);
          }
        }
      }
      // sleep window
      const bedH = n.bed % 24;
      const wakeH = n.wake % 24;
      const lateWeekend = weekend && t.sociability > 0.6 && hour > 21 && hour < 24 + (n.age < 35 ? 2 : 0);
      if (inHours(hour, bedH, wakeH < bedH ? wakeH + 24 : wakeH) && !lateWeekend) {
        let wakeAt = Math.floor(now / MIN_PER_DAY) * MIN_PER_DAY + wakeH * 60 + (weekend ? 60 * (1 - t.ambition) : 0);
        if (wakeAt <= now) wakeAt += MIN_PER_DAY;
        // set the alarm early enough for the next shift
        const nextShift = this.shiftToday(n, wakeAt + 240);
        if (nextShift && nextShift.start > now) {
          const wp = this.workPlace(n)!;
          const commute = this.travel(n, home, wp, nextShift.start / 60 % 24).minutes;
          wakeAt = Math.min(wakeAt, nextShift.start - commute - 40 - t.ambition * 20);
        }
        return mk('sleep', home, Math.max(20, wakeAt - now));
      }
      if (N.energy < 0.12) return mk('sleep', home, 300);
      // work
      const shift = this.shiftToday(n, now);
      if (shift) {
        const wp = this.workPlace(n)!;
        const tr = this.travel(n, here, wp, hour).minutes;
        const early = 10 + t.ambition * 20;
        const skip = n.mood < -0.6 && t.ambition < 0.3 && hash01(n.id, Math.floor(now / MIN_PER_DAY)) < 0.25;
        if (!skip && now >= shift.start - tr - early && now < shift.end - 20) {
          // lunch break in the middle of long shifts
          const mid = (shift.start + shift.end) / 2;
          if (N.hunger < 0.45 && now > mid - 40 && now < mid + 30 && this.isAt(n, wp)) {
            const biz = this.pickVenue(n, ['cafe', 'fastfood', 'restaurant'], wp, 420);
            if (biz >= 0) return mk('eat', { k: 'b', id: this.city.businesses[biz].building }, 40, biz);
          }
          const overtime = t.ambition > 0.75 ? 30 + this.rng.next() * 45 : 0;
          return mk('work', wp, Math.max(15, shift.end + overtime - Math.max(now, shift.start)) + Math.max(0, shift.start - now), shift.biz);
        }
      }
      if (n.occupation === 'Student' && !weekend && hour >= 7.5 && hour < 14.5) {
        const schools = this.venues.get('school') ?? [];
        if (schools.length) {
          const sb = schools[n.id % schools.length];
          return mk('school', { k: 'b', id: this.city.businesses[sb].building }, (15 - hour) * 60);
        }
      }
      // city events
      const g = this.gathering;
      if (g && now < g.until - 30) {
        const d = this.dist(here, g.place);
        const w = t.sociability * 0.8 + t.curiosity * 0.6 - d / 1500;
        if (w > 0.55 && rain < 0.5) return mk('event', g.place, Math.min(g.until - now, 60 + this.rng.next() * 90));
      }
    }

    // ---- utility for flexible activities
    const maxD = opts.maxDist ?? 1600;
    const options: { a: () => Activity | null; w: number }[] = [];
    const mealTime = (hour > 7 && hour < 9.5) || (hour > 11.8 && hour < 14) || (hour > 18 && hour < 21) ? 1 : 0.35;
    const hungry = Math.pow(1 - N.hunger, 2);
    options.push({
      w: hungry * 2.6 * mealTime * (0.6 + n.wealth * 0.8),
      a: () => {
        const types: BusinessType[] = hour < 10.5 ? ['cafe', 'fastfood'] : hour > 17 ? ['restaurant', 'fastfood', 'bar'] : EAT_TYPES;
        const biz = this.pickVenue(n, types, here, maxD);
        return biz >= 0 ? mk('eat', { k: 'b', id: this.city.businesses[biz].building }, 30 + this.rng.next() * 35, biz) : null;
      },
    });
    options.push({ w: hungry * 2.2 * (n.groceries > 0 ? 1 : 0.1) * (1.2 - n.wealth * 0.5), a: () => mk('eatHome', home, 35) });
    options.push({
      w: n.groceries < 2 && hour > 8 && hour < 21 ? 0.9 : 0.05,
      a: () => {
        const biz = this.pickVenue(n, ['grocery', 'convenience'], here, maxD);
        return biz >= 0 ? mk('groceries', { k: 'b', id: this.city.businesses[biz].building }, 25 + this.rng.next() * 15, biz) : null;
      },
    });
    options.push({
      w: (1 - N.fun) * (0.4 + t.curiosity * 0.5) * (n.money > 150 ? 1 : 0.2) * (hour > 10 && hour < 20 ? 1 : 0.1) * (weekend ? 1.5 : 1),
      a: () => {
        const biz = this.pickVenue(n, SHOP_TYPES, here, maxD);
        return biz >= 0 ? mk('shop', { k: 'b', id: this.city.businesses[biz].building }, 25 + this.rng.next() * 30, biz) : null;
      },
    });
    options.push({
      w: (1 - N.fun) * (0.5 + t.curiosity * 0.5) * (1 - rain * 0.85) * (hour > 7 && hour < 21 ? 1 : 0.15) * (1 + (this.weather.temp > 20 ? 0.3 : 0)),
      a: () => {
        const o = this.pickOutdoor(n, here, hour > 18 ? ['plaza', 'promenade'] : ['park', 'promenade', 'plaza']);
        return o >= 0 ? mk('leisure', { k: 'o', id: o }, 40 + this.rng.next() * 70) : null;
      },
    });
    const youngFactor = clamp(1.3 - n.age / 60, 0.2, 1.2);
    options.push({
      w: (1 - N.social) * t.sociability * youngFactor * (hour >= 19.5 || hour < 2 ? 1.6 : 0) * (weekend || wd === 4 ? 1.6 : 0.8) * (n.money > 60 ? 1 : 0),
      a: () => {
        const biz = this.pickVenue(n, NIGHT_TYPES, here, maxD);
        return biz >= 0 ? mk('nightlife', { k: 'b', id: this.city.businesses[biz].building }, 90 + this.rng.next() * 150, biz) : null;
      },
    });
    options.push({
      w: (1 - N.social) * (0.4 + t.sociability) * 1.1 * (hour > 10 && hour < 22 ? 1 : 0.2),
      a: () => this.planSocial(n, now, here, maxD),
    });
    options.push({
      w: t.ambition * 0.45 * ((hour > 6 && hour < 9) || (hour > 17 && hour < 21) ? 1 : 0.2) * (n.age < 60 ? 1 : 0.3),
      a: () => {
        const biz = this.pickVenue(n, ['gym'], here, maxD);
        return biz >= 0 ? mk('gym', { k: 'b', id: this.city.businesses[biz].building }, 60 + this.rng.next() * 30, biz) : null;
      },
    });
    options.push({
      w: (1 - N.fun) * 0.5 * (hour > 17 && hour < 22 ? 1 : 0) * (weekend ? 1.6 : 0.6) * (n.money > 40 ? 1 : 0),
      a: () => {
        const biz = this.pickVenue(n, ['cinema'], here, maxD);
        return biz >= 0 ? mk('cinema', { k: 'b', id: this.city.businesses[biz].building }, 130, biz) : null;
      },
    });
    if (!n.job && n.occupation !== 'Retired' && n.occupation !== 'Student') {
      options.push({
        w: (wd < 5 && hour > 9 && hour < 17 ? 1.8 : 0.1) * (0.5 + t.ambition),
        a: () => {
          const biz = this.findOpening(n, here);
          return biz >= 0 ? mk('jobhunt', { k: 'b', id: this.city.businesses[biz].building }, 45 + this.rng.next() * 45, biz) : null;
        },
      });
    }
    options.push({
      w: 0.25 * (hour > 9 && hour < 17 && !weekend ? 1 : 0.1),
      a: () => {
        const biz = this.pickVenue(n, ['bank', 'pharmacy', 'salon', 'cityhall'], here, maxD);
        return biz >= 0 ? mk('errand', { k: 'b', id: this.city.businesses[biz].building }, 20 + this.rng.next() * 25, biz) : null;
      },
    });
    options.push({ w: opts.local ? 0.05 : 0.55 + rain * 0.8 + (hour > 21 ? 0.8 : 0) + (1 - t.curiosity) * 0.3, a: () => mk('home', home, 50 + this.rng.next() * 70) });

    // personality noise & choice
    for (let k = 0; k < 3; k++) {
      const pick = this.rng.weighted(options, options.map((o) => Math.max(0, o.w) * (0.75 + this.rng.next() * 0.5)));
      const act = pick.a();
      if (act) return act;
      pick.w = 0;
    }
    return mk('home', home, 60);
  }

  private planSocial(n: NPC, now: number, here: Place, maxD: number): Activity | null {
    // find a friend who is free and arrange to meet
    const friends = [...n.rel.entries()].filter(([, r]) => r.friend > 35).map(([id]) => this.npcs[id]);
    this.rng.shuffle(friends);
    for (const f of friends.slice(0, 4)) {
      if (!f || f.trip || f.activity.kind === 'work' || f.activity.kind === 'sleep' || f.activity.kind === 'appointment') continue;
      if (f.proxy !== 'none') continue;
      const hour = (now % MIN_PER_DAY) / 60;
      const types: BusinessType[] = hour > 19 ? ['bar', 'restaurant'] : ['cafe', 'restaurant'];
      const biz = this.pickVenue(n, types, here, maxD);
      let place: Place;
      if (biz >= 0) place = { k: 'b', id: this.city.businesses[biz].building };
      else if (f.loc && f.loc.k === 'b' && f.loc.id === this.homeBuilding(f)) place = f.loc;
      else continue;
      const mins = 60 + this.rng.next() * 90;
      // friend joins
      f.activity = { kind: 'social', place, until: now + mins + 20, started: now, biz: biz >= 0 ? biz : undefined, with: n.id };
      if (!this.isAt(f, place)) this.startTrip(f, place, now);
      return { kind: biz >= 0 ? 'social' : 'visit', place, until: now + mins, started: now, biz: biz >= 0 ? biz : undefined, with: f.id };
    }
    return null;
  }

  findOpening(n: NPC, here: Place): number {
    let best = -1;
    let bd = Infinity;
    for (const b of this.city.businesses) {
      if (this.econ.openings(b.id) <= 0) continue;
      if (b.type === 'school' && n.age < 24) continue;
      const d = this.dist(here, { k: 'b', id: b.building }) * (0.7 + this.rng.next() * 0.6);
      if (d < bd) {
        bd = d;
        best = b.id;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ trips
  startTrip(n: NPC, to: Place, now: number) {
    const from: Place = n.loc ?? (n.trip ? n.trip.to : this.homePlace(n));
    if (n.trip) {
      // re-route an ongoing trip from its destination
      n.trip = null;
    }
    const hour = (now % MIN_PER_DAY) / 60;
    const tv = this.travel(n, from, to, hour);
    this.leave(n);
    const trip: Trip = { from, to, mode: tv.mode, depart: now, arrive: now + tv.minutes };
    n.trip = trip;
    // activity duration counts from arrival
    const dur = n.activity.until - n.activity.started;
    n.activity.started = trip.arrive;
    n.activity.until = trip.arrive + Math.max(10, dur);
    if (tv.mode === 'car' && hour > 7.2 && hour < 9.2 && n.activity.kind === 'work' && n.traits.patience < 0.35 && this.rng.chance(0.3)) {
      this.addMemory(n, 'stuck_in_traffic', [], 0.2, -0.3);
      n.stress = clamp(n.stress + 0.08, 0, 1);
    }
    this.hooks.onDepart?.(n, trip);
  }

  /** compute (and cache) the pedestrian path of a trip */
  tripPath(n: NPC) {
    const tr = n.trip;
    if (!tr) return null;
    if (tr.path) return tr.path;
    const accessOf = (p: Place) => (p.k === 'b' ? this.city.buildings[p.id].access : this.city.outdoor[p.id].access);
    const fd = this.placePos(tr.from);
    const td = this.placePos(tr.to);
    tr.path = this.nav.path(fd, accessOf(tr.from), td, accessOf(tr.to));
    tr.pathLen = pathLength(tr.path);
    return tr.path;
  }

  /** abstract position along an ongoing trip (for the map and proxy spawning) */
  tripPos(n: NPC, now: number) {
    const tr = n.trip!;
    const f = clamp((now - tr.depart) / Math.max(1, tr.arrive - tr.depart), 0, 1);
    const a = this.placePos(tr.from);
    const b = this.placePos(tr.to);
    if (tr.mode === 'walk' && tr.path) {
      const L = tr.pathLen ?? 1;
      let d = f * L;
      for (let i = 1; i < tr.path.length; i++) {
        const p0 = tr.path[i - 1];
        const p1 = tr.path[i];
        const l = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        if (d <= l) {
          const t = l > 0 ? d / l : 0;
          return { x: p0.x + (p1.x - p0.x) * t, z: p0.z + (p1.z - p0.z) * t, f, d: f * L };
        }
        d -= l;
      }
    }
    // manhattan interpolation for cars / buses
    const mx = Math.abs(b.x - a.x);
    const mz = Math.abs(b.z - a.z);
    const tot = mx + mz || 1;
    const d = f * tot;
    if (d < mx) return { x: a.x + Math.sign(b.x - a.x) * d, z: a.z, f, d };
    return { x: b.x, z: a.z + Math.sign(b.z - a.z) * (d - mx), f, d };
  }

  arrive(n: NPC, now: number) {
    const tr = n.trip;
    if (!tr) return;
    n.trip = null;
    this.enter(n, tr.to);
    const a = n.activity;
    this.hooks.onArrive?.(n, tr.to);
    // lateness
    if (a.kind === 'work') {
      const sh = this.shiftToday(n, now);
      if (sh && now > sh.start + 8) {
        n.lateCount++;
        this.addMemory(n, 'late_for_work', [], 0.3, -0.4, tr.to.id);
        n.stress = clamp(n.stress + 0.1, 0, 1);
        if (n.lateCount > 8 && n.traits.ambition < 0.3 && this.rng.chance(0.2)) this.fire(n, 'Repeatedly late for work');
      }
    }
    if (a.kind === 'appointment' && n.appointment) n.appointment.arrived = true;
    this.onActivityStart(n, now);
  }

  private onActivityStart(n: NPC, now: number) {
    const a = n.activity;
    if (a.biz !== undefined && (a.kind === 'eat' || a.kind === 'shop' || a.kind === 'groceries' || a.kind === 'nightlife' || a.kind === 'gym' || a.kind === 'cinema' || a.kind === 'social' || a.kind === 'errand')) {
      const def = this.city.businesses[a.biz];
      if (def.type === 'bank' || def.type === 'cityhall') return;
      const paid = this.econ.purchase(a.biz, n, a.kind === 'nightlife' ? 1.6 : 1);
      if (paid > 0) {
        if (a.kind === 'groceries') n.groceries += def.type === 'grocery' ? 7 : 2;
        if (a.kind === 'eat' || a.kind === 'social' || a.kind === 'nightlife') n.needs.hunger = Math.min(1, n.needs.hunger + 0.55);
        if (!n.favorites.includes(a.biz)) {
          if (this.rng.chance(0.25 + this.econ.biz[a.biz].reputation * 0.3)) {
            n.favorites.push(a.biz);
            if (n.favorites.length > 5) n.favorites.shift();
          }
          if (this.rng.chance(0.3)) this.addMemory(n, 'visited_business', [], 0.12, 0.3, def.building, def.name);
        }
      } else {
        this.addMemory(n, 'bad_service', [], 0.25, -0.4, def.building, def.name);
        n.favorites = n.favorites.filter((f) => f !== a.biz);
        a.until = Math.min(a.until, now + 5);
      }
    }
    if (a.kind === 'jobhunt' && a.biz !== undefined) {
      const chance = 0.25 + n.traits.confidence * 0.3 + n.traits.ambition * 0.15;
      if (this.econ.openings(a.biz) > 0 && this.rng.chance(chance)) this.hire(n, a.biz);
    }
    if (a.kind === 'eatHome' && n.groceries > 0) {
      n.groceries--;
      n.needs.hunger = Math.min(1, n.needs.hunger + 0.6);
    }
    if (a.kind === 'event') this.addMemory(n, 'attended_event', [], 0.3, 0.5, undefined, this.gathering?.name);
  }

  hire(n: NPC, biz: number) {
    const def = this.city.businesses[biz];
    const s = this.econ.biz[biz];
    // choose the slot with most vacancy
    let slot = 0;
    let best = -Infinity;
    def.jobs.forEach((j, i) => {
      const filled = s.employees.filter((e) => this.npcs[e]?.job?.slot === i).length;
      const v = j.count - filled;
      if (v > best) {
        best = v;
        slot = i;
      }
    });
    const j = def.jobs[slot];
    n.job = { biz, slot };
    n.occupation = j.role;
    n.title = j.role;
    n.wage = j.wage;
    n.fired = false;
    s.employees.push(n.id);
    this.addMemory(n, 'got_job', [], 0.7, 0.8, def.building, def.name);
    if (n.goal.kind === 'job') n.goal.done = true;
    n.stress = clamp(n.stress - 0.3, 0, 1);
  }

  fire(n: NPC, reason: string) {
    if (!n.job) return;
    const s = this.econ.biz[n.job.biz];
    s.employees = s.employees.filter((e) => e !== n.id);
    const def = this.city.businesses[n.job.biz];
    this.addMemory(n, 'lost_job', [], 0.85, -0.85, def.building, reason);
    n.job = null;
    n.occupation = 'Unemployed';
    n.title = 'Unemployed';
    n.wage = 0;
    n.fired = true;
    n.goal = { kind: 'job', target: 0, done: false };
    n.stress = clamp(n.stress + 0.4, 0, 1);
  }

  handleClosure(biz: number) {
    const s = this.econ.biz[biz];
    for (const id of [...s.employees]) {
      const n = this.npcs[id];
      if (!n?.job) continue;
      this.fire(n, `${this.city.businesses[biz].name} closed down`);
      n.memories[n.memories.length - 1].type = 'business_closed';
    }
    s.employees = [];
  }

  // ------------------------------------------------------------------ update
  warmup() {
    const now = this.clock.t;
    for (const n of this.npcs) {
      n.lastUpdate = now;
      const act = this.choose(n, now);
      n.activity = act;
      if (!this.isAt(n, act.place)) {
        // start the day either already at the destination or part-way there
        if (this.rng.chance(0.55)) {
          n.loc = null;
          this.enter(n, act.place);
        } else {
          const from = n.loc ?? this.homePlace(n);
          n.loc = null;
          this.enter(n, from);
          this.startTrip(n, act.place, now - this.rng.next() * 10);
        }
      } else {
        n.loc = null;
        this.enter(n, act.place);
      }
    }
  }

  tick(realDt: number) {
    const now = this.clock.t;
    const count = Math.min(this.npcs.length, Math.ceil((this.npcs.length * realDt) / 0.6) + 1);
    for (let i = 0; i < count; i++) {
      const n = this.npcs[this.cursor];
      this.cursor = (this.cursor + 1) % this.npcs.length;
      this.updateNPC(n, now);
    }
    // hourly / daily
    const hour = Math.floor(this.clock.hour);
    const day = this.clock.day;
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.econ.weather.rain = this.weather.rain;
      this.econ.weather.storm = this.weather.storm;
      this.recountStaff();
      this.econ.hourly(hour, this.clock.weekday);
    }
    if (day !== this.lastDay) {
      if (this.lastDay >= 0) this.daily(day);
      this.lastDay = day;
    }
    let inT = 0;
    for (const n of this.npcs) if (n.trip) inT++;
    this.stats.inTransit = inT;
  }

  updateNPC(n: NPC, now: number) {
    this.stats.updates++;
    const dm = Math.max(0, now - n.lastUpdate);
    n.lastUpdate = now;
    if (dm <= 0) return;
    if (n.hold > 0) return; // talking with player
    const hrs = dm / 60;
    const a = n.activity;
    const N = n.needs;
    // needs
    if (a.kind === 'sleep' && !n.trip) N.energy = Math.min(1, N.energy + hrs * 0.15);
    else N.energy = Math.max(0, N.energy - hrs * (a.kind === 'work' || a.kind === 'gym' ? 0.065 : 0.045));
    if (a.kind !== 'sleep') N.hunger = Math.max(0, N.hunger - hrs * 0.075);
    else N.hunger = Math.max(0, N.hunger - hrs * 0.02);
    const socialGain = a.kind === 'social' || a.kind === 'visit' || a.kind === 'nightlife' || a.kind === 'event' || a.kind === 'appointment' ? 0.3 : a.kind === 'work' || a.kind === 'school' ? 0.04 : 0;
    N.social = clamp(N.social + hrs * (socialGain - 0.035 * (0.5 + n.traits.sociability)), 0, 1);
    const funGain = a.kind === 'leisure' || a.kind === 'cinema' || a.kind === 'nightlife' || a.kind === 'shop' || a.kind === 'event' ? 0.28 : a.kind === 'home' ? 0.06 : 0;
    N.fun = clamp(N.fun + hrs * (funGain - 0.03), 0, 1);
    // work pay
    if (!n.trip && a.kind === 'work' && n.job && n.loc && this.isAt(n, this.workPlace(n)!)) {
      this.econ.payWage(n, hrs);
      n.shiftsWorked += hrs / 8;
      if (n.goal.kind === 'promotion' && !n.goal.done && n.shiftsWorked > n.goal.target) this.promote(n);
    }
    // mood
    const needAvg = (N.hunger + N.energy + N.social + N.fun) / 4;
    const money = n.money < 100 ? -0.25 : n.money > 3000 ? 0.1 : 0;
    let memo = 0;
    for (let i = Math.max(0, n.memories.length - 6); i < n.memories.length; i++) memo += n.memories[i].valence * this.strength(n.memories[i]) * 0.3;
    const target = clamp((needAvg - 0.5) * 1.2 + money + memo - n.stress * 0.4 + (n.job || n.occupation !== 'Unemployed' ? 0 : -0.15) - this.weather.storm * 0.1, -1, 1);
    n.mood += (target - n.mood) * Math.min(1, hrs * 0.6);
    n.stress = clamp(n.stress - hrs * 0.01, 0, 1);

    // trips
    if (n.trip) {
      if (n.proxy !== 'none') return; // visible body controls arrival
      if (now >= n.trip.arrive) this.arrive(n, now);
      return;
    }
    // weather interrupt for outdoor activities
    if (n.loc && n.loc.k === 'o' && this.weather.rain > 0.45 && a.kind !== 'event') {
      if (this.rng.chance(0.3)) this.addMemory(n, 'got_wet', [], 0.1, -0.2);
      a.until = now;
    }
    // social interactions with others present
    if (n.loc) this.socialize(n, dm, now);
    // urgent needs interrupt flexible activities; work shifts interrupt almost anything
    const interruptible = a.kind !== 'work' && a.kind !== 'sleep' && a.kind !== 'appointment';
    const urgent = (N.hunger < 0.12 && a.kind !== 'eat' && a.kind !== 'eatHome' && a.kind !== 'sleep') || (interruptible && this.shiftSoon(n, now));
    if (now >= a.until || urgent) {
      if (a.kind === 'appointment' && n.appointment) {
        n.appointment.done = true;
      }
      if (a.kind === 'social' || a.kind === 'visit') {
        if (a.with !== undefined && a.with >= 0) {
          const f = this.npcs[a.with];
          const r = this.rel(n, a.with);
          r.friend = clamp(r.friend + 3, -100, 100);
          r.fam = clamp(r.fam + 4, 0, 100);
          r.last = now;
          if (this.rng.chance(0.3)) this.addMemory(n, 'chat_npc', [a.with], 0.2, 0.5, n.loc?.k === 'b' ? n.loc.id : undefined, npcName(f));
        }
      }
      const next = this.choose(n, now);
      n.activity = next;
      if (!this.isAt(n, next.place)) this.startTrip(n, next.place, now);
      else this.onActivityStart(n, now);
    }
  }

  private shiftSoon(n: NPC, now: number) {
    const sh = this.shiftToday(n, now);
    if (!sh || n.activity.kind === 'work') return false;
    const wp = this.workPlace(n)!;
    const here = n.loc ?? this.homePlace(n);
    const tr = this.travel(n, here, wp, (now % MIN_PER_DAY) / 60).minutes;
    return now > sh.start - tr - 15 && now < sh.end - 30;
  }

  private promote(n: NPC) {
    n.goal.done = true;
    n.wage = Math.round(n.wage * 1.18);
    if (!n.title.startsWith('Senior')) n.title = `Senior ${n.title}`;
    this.addMemory(n, 'promoted', [], 0.8, 0.9, this.workPlace(n)?.id, n.title);
  }

  private socialize(n: NPC, dm: number, now: number) {
    if (!n.loc) return;
    const set = this.present.get(placeKey(n.loc));
    if (!set || set.size < 2) return;
    const p = 0.35 * (0.3 + n.traits.sociability) * Math.min(3, dm / 15);
    if (!this.rng.chance(p)) return;
    const ids = [...set];
    const oid = ids[Math.floor(this.rng.next() * ids.length)];
    if (oid === n.id) return;
    const o = this.npcs[oid];
    if (!o || o.activity.kind === 'sleep' || n.activity.kind === 'sleep') return;
    // strangers rarely strike up conversations; acquaintances and friends often do
    const known = n.rel.get(oid);
    if ((!known || known.fam < 5) && !this.rng.chance(0.2 + n.traits.confidence * 0.2)) return;
    const r = this.rel(n, oid);
    const r2 = this.rel(o, n.id);
    const t1 = n.traits;
    const t2 = o.traits;
    const compat = 1 - (Math.abs(t1.sociability - t2.sociability) + Math.abs(t1.kindness - t2.kindness) + Math.abs(t1.curiosity - t2.curiosity)) / 3;
    const ageFit = 1 - Math.min(1, Math.abs(n.age - o.age) / 40);
    const pos = compat * 0.55 + ageFit * 0.2 + (n.mood + o.mood) * 0.12 + (t1.kindness + t2.kindness) * 0.2 - 0.42 - (2 - t1.patience - t2.patience) * 0.12 + (r.friend / 200) + (this.rng.next() - 0.5) * 0.3 - r.rival / 200;
    const first = r.fam < 1;
    const place = n.loc.k === 'b' ? n.loc.id : undefined;
    for (const [rel, me, other] of [
      [r, n, o],
      [r2, o, n],
    ] as const) {
      rel.fam = clamp(rel.fam + 4, 0, 100);
      rel.last = now;
      if (pos > 0) {
        rel.friend = clamp(rel.friend + 2 + pos * 8, -100, 100);
        rel.trust = clamp(rel.trust + 1 + pos * 3, -100, 100);
        rel.rival = Math.max(0, rel.rival - 2);
      } else {
        rel.friend = clamp(rel.friend + pos * 14, -100, 100);
        rel.rival = clamp(rel.rival - pos * 10, 0, 100);
      }
      if (first && this.rng.chance(0.2)) this.addMemory(me, 'met_npc', [other.id], 0.2, 0.2, place, npcName(other));
      else if (pos < -0.2) this.addMemory(me, 'argued_npc', [other.id], 0.45, -0.6, place, npcName(other));
    }
    // romance between compatible singles
    const single = (x: NPC) => ![...x.rel.values()].some((q) => q.tag === 'partner');
    if (pos > 0.15 && single(n) && single(o) && n.age > 20 && o.age > 20 && Math.abs(n.age - o.age) < 14 && hash01(Math.min(n.id, o.id), Math.max(n.id, o.id), 77) > 0.6) {
      r.romance = clamp(r.romance + 4 + pos * 6, 0, 100);
      r2.romance = r.romance;
      if (r.romance > 70 && r.friend > 45) {
        r.tag = 'partner';
        r2.tag = 'partner';
        this.addMemory(n, 'dated_npc', [o.id], 0.85, 0.9, place, npcName(o));
        this.addMemory(o, 'dated_npc', [n.id], 0.85, 0.9, place, npcName(n));
        if (n.goal.kind === 'partner') n.goal.done = true;
        if (o.goal.kind === 'partner') o.goal.done = true;
      }
    }
  }

  daily(day: number) {
    const wd = (day - 1) % 7;
    const events = this.econ.daily(day, this.npcs);
    for (const e of events) {
      if (e.kind === 'closure') {
        const b = this.city.businesses[e.biz];
        this.handleClosure(e.biz);
        this.hooks.onNews?.(`${b.name} closes its doors`, `After weeks of losses, ${b.name} on ${this.city.buildings[b.building].street} has shut down. Its staff are now looking for work.`, 'business', { k: 'b', id: b.building });
      } else if (e.kind === 'opening') {
        const b = this.city.businesses[e.biz];
        this.hooks.onNews?.(`${b.name} reopens under new management`, `${b.name} is hiring again at ${this.city.buildings[b.building].address}.`, 'business', { k: 'b', id: b.building });
      } else if (e.kind === 'shortage') {
        this.hooks.onNews?.('Supply shortage drives prices up', 'Warehouses and factories cannot keep up with demand. Shops across Echo City are raising prices.', 'economy');
      }
    }
    for (const n of this.npcs) {
      // rent on mondays, pensions / benefits
      if (wd === 0) {
        const h = this.city.homes[n.home];
        const share = h.rent / Math.max(1, this.npcs.filter((m) => m.home === n.home).length > 1 ? 2 : 1);
        n.money -= share;
        if (n.occupation === 'Retired') n.money += 420;
        if (n.occupation === 'Unemployed') n.money += 260;
        if (n.occupation === 'Student') n.money += 120;
        if (n.occupation === 'Freelancer') n.money += 500 + n.traits.ambition * 600;
      }
      if (n.money < 0) n.stress = clamp(n.stress + 0.1, 0, 1);
      // goals
      if (n.goal.kind === 'car' && !n.goal.done && !n.ownsCar && n.money > n.goal.target * 1.1) {
        n.money -= n.goal.target;
        n.ownsCar = true;
        n.goal.done = true;
        this.addMemory(n, 'bought_car', [], 0.75, 0.85, undefined, VEHICLES[n.carType].name);
      }
      if (n.goal.done && this.rng.chance(0.15)) {
        // pick a fresh goal
        n.goal = n.money < 500 ? { kind: 'save', target: 1500, done: false } : n.ownsCar ? { kind: 'friends', target: 4, done: false } : { kind: 'car', target: VEHICLES[0].price, done: false };
      }
    }
  }

  serialize() {
    return this.npcs.map((n) => ({
      id: n.id,
      job: n.job,
      occupation: n.occupation,
      title: n.title,
      wage: n.wage,
      money: Math.round(n.money),
      ownsCar: n.ownsCar,
      mood: n.mood,
      stress: n.stress,
      needs: n.needs,
      groceries: n.groceries,
      goal: n.goal,
      activity: n.activity,
      loc: n.loc,
      trip: n.trip ? { ...n.trip, path: undefined } : null,
      rel: [...n.rel.entries()],
      relPlayer: n.relPlayer,
      memories: n.memories,
      knowsPlayer: n.knowsPlayer,
      hasNumber: n.hasNumber,
      lateCount: n.lateCount,
      shiftsWorked: n.shiftsWorked,
      appointment: n.appointment,
      favorites: n.favorites,
      lastTalk: n.lastTalk,
    }));
  }

  restore(data: ReturnType<NPCSystem['serialize']>) {
    this.present.clear();
    for (const d of data) {
      const n = this.npcs[d.id];
      if (!n) continue;
      Object.assign(n, {
        job: d.job,
        occupation: d.occupation,
        title: d.title,
        wage: d.wage,
        money: d.money,
        ownsCar: d.ownsCar,
        mood: d.mood,
        stress: d.stress,
        needs: d.needs,
        groceries: d.groceries,
        goal: d.goal,
        activity: d.activity,
        trip: d.trip,
        rel: new Map(d.rel),
        relPlayer: d.relPlayer,
        memories: d.memories,
        knowsPlayer: d.knowsPlayer,
        hasNumber: d.hasNumber,
        lateCount: d.lateCount,
        shiftsWorked: d.shiftsWorked,
        appointment: d.appointment,
        favorites: d.favorites,
        lastTalk: d.lastTalk,
        proxy: 'none',
        hold: 0,
        lastUpdate: this.clock.t,
      });
      n.loc = null;
      if (d.loc) this.enter(n, d.loc);
    }
    this.econ.attachEmployees(this.npcs);
    this.recountStaff();
  }
}
