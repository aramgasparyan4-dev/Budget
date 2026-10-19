import * as THREE from 'three';
import type { Session, Interactable } from './Session';
import type { NPC, Place } from '../sim/npc/types';
import { npcName } from '../sim/npc/Population';
import type { DialogueOptionView } from '../state/uiStores';
import type { BusinessType } from '../world/types';
import { CURB_H } from '../world/types';
import { RNG } from '../core/rng';
import { clamp, formatMoney } from '../core/math';
import { MIN_PER_DAY, inHours, fmtTime } from '../sim/Clock';
import type { DrivableVehicle } from './DrivableVehicle';
import { VEHICLES } from '../sim/vehicles';
import { Pose } from '../render/Human';
import { BASE_PRICE } from '../sim/economy/Economy';

export type JobKind = 'food' | 'parcel' | 'taxi' | 'supply' | 'request';

export interface Stop {
  x: number;
  z: number;
  label: string;
  building?: number;
  npc?: number;
  done?: boolean;
}

export interface Job {
  id: number;
  kind: JobKind;
  title: string;
  desc: string;
  pay: number;
  biz?: number;
  npc?: number;
  pickup?: Stop;
  stops: Stop[];
  stage: 'available' | 'pickup' | 'deliver' | 'done' | 'failed';
  limit: number; // real seconds once accepted
  timer: number;
  expires: number;
  item?: string;
  startedAt?: number;
  vehicle?: number;
}

export interface Request {
  id: number;
  npc: number;
  kind: 'deliver' | 'fetch' | 'lend';
  text: string;
  reward: number;
  item?: string;
  itemName?: string;
  shop?: BusinessType[];
  target?: number; // npc to deliver to
  amount?: number;
  repayAt?: number;
  status: 'offered' | 'active' | 'done' | 'failed';
  expires: number;
}

export interface SupplyOffer {
  biz: number;
  goods: string;
  price: number;
  need: number;
}

const GOODS: Record<string, { name: string; types: BusinessType[]; cost: number }> = {
  produce: { name: 'Fresh produce crate', types: ['grocery', 'restaurant', 'fastfood'], cost: 26 },
  beans: { name: 'Coffee beans sack', types: ['cafe'], cost: 22 },
  drinks: { name: 'Drinks case', types: ['bar', 'nightclub', 'convenience'], cost: 30 },
  apparel: { name: 'Apparel box', types: ['clothing'], cost: 60 },
  gadgets: { name: 'Electronics carton', types: ['electronics'], cost: 110 },
  meds: { name: 'Pharmacy supplies', types: ['pharmacy'], cost: 45 },
  books: { name: 'Book shipment', types: ['bookstore'], cost: 35 },
};

let jid = 1;

export class JobSystem {
  available: Job[] = [];
  active: Job | null = null;
  requests: Request[] = [];
  taxi: { vehicle: DrivableVehicle; fare: null | { npc: number; stage: 'hail' | 'ride'; x: number; z: number; dest: Place; start: number; meter: number; hits: number }; nextIn: number; earned: number } | null = null;
  private rng = new RNG(12345);
  private genTimer = 3;
  private markerMeshes: THREE.Mesh[] = [];
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  supplies: SupplyOffer[] = [];
  private lastSupplyDay = -1;
  company: DrivableVehicle | null = null;
  shiftMini: { score: number } | null = null;
  doorbellPeds: { npc: number; t: number }[] = [];

  constructor(private s: Session) {
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x57e3d6, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 60, 16, 1, true), this.beamMat);
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    s.game.scene.add(this.beam);
    s.providers.push(() => this.interactions());
    s.updaters.push((dt, dm) => this.update(dt, dm));
    void this.markerMeshes;
  }

  // ------------------------------------------------------------------ generation
  private bizDoor(id: number) {
    const b = this.s.city.buildings[this.s.city.businesses[id].building];
    return { x: b.door.x, z: b.door.z, building: b.id, label: this.s.city.businesses[id].name, street: b.street };
  }
  private homeDoor(n: NPC) {
    const b = this.s.city.buildings[this.s.city.homes[n.home].building];
    return { x: b.door.x, z: b.door.z, building: b.id, label: `${npcName(n)}, ${b.address}`, street: b.street };
  }

  private generate() {
    const s = this.s;
    const now = s.t;
    const hour = s.clock.hour;
    this.available = this.available.filter((j) => j.expires > now);
    const foodCount = this.available.filter((j) => j.kind === 'food').length;
    // food delivery orders come from real residents who are hungry at home
    if (foodCount < 4) {
      const mealTime = (hour > 11 && hour < 14.5) || (hour > 17.5 && hour < 23);
      const p = s.playerPos();
      for (let tries = 0; tries < 30; tries++) {
        const n = s.npcs[Math.floor(this.rng.next() * s.npcs.length)];
        if (n.trip || !n.loc || n.loc.k !== 'b' || n.loc.id !== s.nsys.homeBuilding(n)) continue;
        if (n.activity.kind === 'sleep' || n.money < 30) continue;
        if (!mealTime && this.rng.chance(0.7)) continue;
        const home = this.homeDoor(n);
        if (Math.hypot(home.x - p.x, home.z - p.z) > 900) continue;
        const biz = s.nsys.pickVenue(n, ['restaurant', 'fastfood', 'cafe'], { k: 'b', id: home.building }, 900);
        if (biz < 0) continue;
        const pick = this.bizDoor(biz);
        const dist = Math.hypot(pick.x - home.x, pick.z - home.z) + Math.hypot(pick.x - p.x, pick.z - p.z) * 0.3;
        const pay = Math.round(7 + dist * 0.016 + (1 - n.wealth) * 0 + n.wealth * 6);
        const food = s.city.businesses[biz];
        this.available.push({
          id: jid++,
          kind: 'food',
          title: `Food delivery · ${food.name}`,
          desc: `${n.first} ${n.last[0]}. ordered from ${food.name}. Deliver to ${home.street}.`,
          pay,
          biz,
          npc: n.id,
          pickup: { x: pick.x, z: pick.z, label: food.name, building: pick.building },
          stops: [{ x: home.x, z: home.z, label: home.label, building: home.building, npc: n.id }],
          stage: 'available',
          limit: Math.round(90 + dist / 3.2),
          timer: 0,
          expires: now + 50,
        });
        break;
      }
    }
    // courier van routes from the depot
    const depot = s.city.landmarks['depot'];
    if (depot !== undefined && !this.available.some((j) => j.kind === 'parcel') && hour > 7 && hour < 20) {
      const db = s.city.buildings[depot];
      const stops: Stop[] = [];
      const used = new Set<number>();
      for (let k = 0; k < 40 && stops.length < 4; k++) {
        const n = s.npcs[Math.floor(this.rng.next() * s.npcs.length)];
        const h = this.homeDoor(n);
        if (used.has(h.building) || Math.hypot(h.x - db.door.x, h.z - db.door.z) > 850) continue;
        used.add(h.building);
        stops.push({ x: h.x, z: h.z, label: h.label, building: h.building, npc: n.id });
      }
      this.available.push({
        id: jid++,
        kind: 'parcel',
        title: 'Courier route · Echo Express',
        desc: `Take a company van and deliver ${stops.length} parcels across the city.`,
        pay: 32 * stops.length + 40,
        pickup: { x: db.door.x, z: db.door.z, label: 'Echo Express depot', building: depot },
        stops,
        stage: 'available',
        limit: 420 + stops.length * 30,
        timer: 0,
        expires: now + 240,
      });
    }
  }

  /** daily supply opportunities: businesses running low on stock */
  private refreshSupplies() {
    const s = this.s;
    this.supplies = [];
    for (const b of s.econ.biz) {
      if (b.closed || b.maxStock <= 0) continue;
      const d = s.city.businesses[b.id];
      if (b.stock / b.maxStock > 0.45 && b.turnedAway < 2) continue;
      const g = Object.entries(GOODS).find(([, v]) => v.types.includes(d.type));
      if (!g) continue;
      const price = Math.round(g[1].cost * s.econ.wholesale * (1.35 + (1 - b.stock / b.maxStock) * 0.5));
      this.supplies.push({ biz: b.id, goods: g[0], price, need: Math.ceil((b.maxStock - b.stock) / 15) });
    }
    this.supplies.sort((a, b) => b.price - a.price);
    this.supplies = this.supplies.slice(0, 12);
  }

  wholesalePrice(goods: string) {
    return Math.round(GOODS[goods].cost * this.s.econ.wholesale);
  }
  goodsName(goods: string) {
    return GOODS[goods]?.name ?? goods;
  }
  goodsList() {
    return Object.entries(GOODS).map(([id, g]) => ({ id, name: g.name, price: this.wholesalePrice(id) }));
  }

  // ------------------------------------------------------------------ accept / progress
  accept(id: number) {
    const s = this.s;
    if (this.active) {
      s.notify('Finish your current job first', undefined, 'warning');
      return false;
    }
    const j = this.available.find((x) => x.id === id);
    if (!j) return false;
    this.available = this.available.filter((x) => x !== j);
    j.stage = 'pickup';
    j.timer = j.limit;
    j.startedAt = s.t;
    this.active = j;
    s.setObjective(j.kind === 'parcel' ? 'Pick up the van at the depot' : `Pick up the order at ${j.pickup!.label}`, `${formatMoney(j.pay)} · ${j.title}`);
    s.setWaypoint(j.pickup!.x, j.pickup!.z, j.pickup!.label);
    s.notify('Job accepted', j.title, 'objective');
    s.objectives?.event('acceptJob');
    return true;
  }

  cancel() {
    const s = this.s;
    if (!this.active) return;
    const j = this.active;
    if (j.item) s.player.removeItem(j.item);
    this.active = null;
    s.setObjective(null);
    s.clearWaypoint();
    s.notify('Job cancelled', j.title, 'warning');
    s.player.reputation -= 1;
    if (j.kind === 'parcel' && this.company) {
      this.s.removeVehicle(this.company);
      this.company = null;
    }
  }

  private fail(reason: string) {
    const s = this.s;
    const j = this.active!;
    if (j.item) s.player.removeItem(j.item);
    this.active = null;
    s.setObjective(null);
    s.clearWaypoint();
    s.notify('Job failed', reason, 'warning');
    if (j.npc !== undefined) {
      const n = s.npcs[j.npc];
      s.nsys.addMemory(n, 'request_failed', [-1], 0.3, -0.5);
      n.relPlayer.trust -= 6;
    }
    if (j.kind === 'parcel' && this.company) {
      s.removeVehicle(this.company);
      this.company = null;
    }
  }

  private pickup() {
    const s = this.s;
    const j = this.active!;
    if (j.kind === 'food') {
      const item = `delivery_${j.id}`;
      if (!s.player.addItem({ id: item, name: `Order for ${s.npcs[j.npc!].first}`, kind: 'delivery', value: 0, meta: { job: j.id } })) {
        s.notify('Your bag is full', 'Drop something first', 'warning');
        return;
      }
      j.item = item;
      s.econ.purchase(j.biz!, null);
      s.game.audio?.ui('click');
    } else if (j.kind === 'parcel') {
      // company van appears at the curb outside the depot
      const b = s.city.buildings[j.pickup!.building!];
      const spot = s.traffic.findSpot(b.door.x, b.door.z, 80);
      const x = spot ? spot.x : b.door.x;
      const z = spot ? spot.z : b.door.z;
      const yaw = spot ? spot.rot : 0;
      if (this.company) s.removeVehicle(this.company);
      this.company = s.spawnVehicle(5, x, z, yaw, 0xf2f2f2, 'company', 'Echo Express Van');
      s.notify('Van ready', 'Your company van is parked outside. Press F to drive.', 'objective');
      j.vehicle = this.company.vid;
    }
    j.stage = 'deliver';
    this.nextStop();
  }

  private nextStop() {
    const s = this.s;
    const j = this.active!;
    const st = j.stops.find((x) => !x.done);
    if (!st) return;
    const left = j.stops.filter((x) => !x.done).length;
    s.setObjective(j.kind === 'parcel' ? `Deliver parcel (${j.stops.length - left + 1}/${j.stops.length})` : `Deliver to ${st.label}`, `${formatMoney(j.pay)} · ${Math.ceil(j.timer)}s left`);
    s.setWaypoint(st.x, st.z, st.label);
  }

  private deliver(st: Stop) {
    const s = this.s;
    const j = this.active!;
    st.done = true;
    const n = st.npc !== undefined ? s.npcs[st.npc] : null;
    if (n) {
      this.doorbell(n, st);
      s.nsys.addMemory(n, 'delivery_from_player', [-1], 0.35, 0.6);
      n.relPlayer.fam += 6;
      n.relPlayer.friend += 4;
      n.relPlayer.trust += 3;
      n.knowsPlayer = true;
    }
    const remaining = j.stops.filter((x) => !x.done).length;
    if (j.kind === 'food') {
      s.player.removeItem(j.item!);
      const fast = j.timer / j.limit;
      const tip = n ? Math.round((n.traits.kindness * 4 + n.wealth * 5) * (0.4 + fast)) : 0;
      s.player.earn(j.pay, `Delivery · ${s.city.businesses[j.biz!].name}`, 'bank', s.t);
      if (tip > 0) s.player.earn(tip, `Tip from ${n!.first}`, 'cash', s.t);
      s.notify('Delivered!', `+${formatMoney(j.pay)}${tip ? ` · tip ${formatMoney(tip)}` : ''}`, 'money');
      this.complete();
    } else if (j.kind === 'parcel') {
      s.player.earn(32, 'Parcel delivered', 'bank', s.t);
      s.notify('Parcel delivered', remaining ? `${remaining} to go` : 'Route complete!', 'money');
      if (!remaining) {
        s.player.earn(40, 'Route bonus · Echo Express', 'bank', s.t);
        this.complete();
      } else this.nextStop();
    }
  }

  private complete() {
    const s = this.s;
    const j = this.active!;
    j.stage = 'done';
    this.active = null;
    s.player.stats.deliveries++;
    s.player.reputation += 1;
    s.setObjective(null);
    s.clearWaypoint();
    s.objectives?.event('jobDone');
    if (j.kind === 'parcel' && this.company) {
      this.company.owner = 'company';
      s.notify('Return the van', 'You can leave the van anywhere — Echo Express will collect it.', 'info');
      const van = this.company;
      this.company = null;
      setTimeout(() => {
        if (s.driving !== van) s.removeVehicle(van);
      }, 120000);
    }
  }

  /** resident briefly opens the door to receive something */
  private doorbell(n: NPC, st: Stop) {
    const s = this.s;
    if (n.proxy !== 'none') return;
    const b = s.city.buildings[st.building!];
    const out = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][b.facing];
    const p = s.peds.makePed(n, b.door.x + out[0] * 0.6, b.door.z + out[1] * 0.6);
    p.state = 'wave';
    p.stateT = 4;
    p.outdoor = -2;
    p.yaw = Math.atan2(out[0], out[1]);
    this.doorbellPeds.push({ npc: n.id, t: 4.5 });
  }

  // ------------------------------------------------------------------ taxi
  startTaxi() {
    const s = this.s;
    const tb = s.city.landmarks['taxi'];
    if (tb === undefined) return;
    const b = s.city.buildings[tb];
    const spot = s.traffic.findSpot(b.door.x, b.door.z, 80);
    const v = s.spawnVehicle(4, spot?.x ?? b.door.x, spot?.z ?? b.door.z, spot?.rot ?? 0, 0xf7c21b, 'taxi', 'Echo Cab');
    this.taxi = { vehicle: v, fare: null, nextIn: 6, earned: 0 };
    s.setObjective('Taxi shift: drive around to find fares', 'Pick up hailing residents and take them where they need to go');
    s.notify('Taxi shift started', 'Your cab is parked outside. Press F to drive.', 'objective');
  }

  endTaxi() {
    const s = this.s;
    if (!this.taxi) return;
    const t = this.taxi;
    if (t.fare?.stage === 'ride') {
      const n = s.npcs[t.fare.npc];
      n.proxy = 'none';
    }
    s.notify('Taxi shift ended', `Earned ${formatMoney(t.earned)} this shift`, 'money');
    const v = t.vehicle;
    this.taxi = null;
    s.setObjective(null);
    s.clearWaypoint();
    if (s.driving === v) s.exitVehicle(true);
    s.removeVehicle(v);
  }

  private updateTaxi(dt: number) {
    const s = this.s;
    const t = this.taxi!;
    if (!s.vehicles.includes(t.vehicle)) {
      this.taxi = null;
      return;
    }
    const inCab = s.driving === t.vehicle;
    if (!t.fare) {
      t.nextIn -= dt;
      if (t.nextIn <= 0 && inCab) {
        // find a pedestrian with a long trip ahead to hail the cab
        const p = s.playerPos();
        let best: import('../sim/npc/Pedestrians').Ped | null = null;
        for (const ped of s.peds.peds) {
          const n = ped.npc;
          if (!n.trip || ped.state !== 'walk') continue;
          const d = Math.hypot(ped.x - p.x, ped.z - p.z);
          if (d < 30 || d > 140) continue;
          const dest = s.nsys.placePos(n.trip.to);
          if (Math.hypot(dest.x - ped.x, dest.z - ped.z) < 300) continue;
          best = ped;
          break;
        }
        t.nextIn = 4;
        if (best) {
          best.state = 'wave';
          best.stateT = 999;
          t.fare = { npc: best.npc.id, stage: 'hail', x: best.x, z: best.z, dest: best.npc.trip!.to, start: s.t, meter: 0, hits: 0 };
          s.setWaypoint(best.x, best.z, `Fare: ${best.npc.first}`);
          s.setObjective(`Pick up ${best.npc.first} (hailing a cab)`, 'Pull up next to them and stop');
          s.game.audio?.ui('notify');
        }
      }
      return;
    }
    const f = t.fare;
    const n = s.npcs[f.npc];
    if (f.stage === 'hail') {
      const ped = s.peds.byNpc.get(n.id);
      if (!ped) {
        t.fare = null;
        s.setObjective('Taxi shift: drive around to find fares');
        s.clearWaypoint();
        return;
      }
      f.x = ped.x;
      f.z = ped.z;
      if (inCab) {
        const v = t.vehicle;
        const d = Math.hypot(v.pos.x - ped.x, v.pos.z - ped.z);
        if (d < 7 && Math.abs(v.forwardSpeed) < 1.5) {
          // passenger gets in
          s.peds.despawn(ped, s.t, false);
          n.proxy = 'car';
          f.stage = 'ride';
          f.start = s.t;
          f.hits = 0;
          const dp = s.nsys.placePos(f.dest);
          s.setWaypoint(dp.x, dp.z, s.nsys.placeName(f.dest));
          s.setObjective(`Drive ${n.first} to ${s.nsys.placeName(f.dest)}`, 'Smooth driving earns better tips');
          s.game.audio?.carDoor();
          s.player.flags.taxiDamage = v.damage;
          s.subtitle(n.first, this.rng.pick([`${s.nsys.placeName(f.dest)}, please.`, `Hi! Can you take me to ${s.nsys.placeName(f.dest)}?`, `${s.nsys.placeName(f.dest)}. I'm running late!`]));
        }
      }
    } else if (f.stage === 'ride') {
      const v = t.vehicle;
      const dp = s.nsys.placePos(f.dest);
      const d = Math.hypot(v.pos.x - dp.x, v.pos.z - dp.z);
      if (d < 22 && Math.abs(v.forwardSpeed) < 1.2) {
        const mins = s.t - f.start;
        const dist = s.nsys.dist(n.trip?.from ?? f.dest, f.dest);
        const fare = Math.round(6 + dist * 0.012);
        const damage = v.damage - Number(s.player.flags.taxiDamage ?? 0);
        const tip = Math.max(0, Math.round((n.traits.kindness * 6 + n.wealth * 8) * (1 - damage * 6) * (mins < dist / 250 + 6 ? 1 : 0.4)));
        s.player.earn(fare, `Taxi fare · ${n.first}`, 'bank', s.t);
        if (tip > 0) s.player.earn(tip, `Taxi tip · ${n.first}`, 'cash', s.t);
        t.earned += fare + tip;
        s.player.stats.fares++;
        s.notify('Fare complete', `+${formatMoney(fare)}${tip ? ` · tip ${formatMoney(tip)}` : ''}`, 'money');
        s.nsys.addMemory(n, 'ride_from_player', [-1], 0.35, damage > 0.05 ? -0.4 : 0.6);
        n.relPlayer.fam += 5;
        n.relPlayer.friend += damage > 0.05 ? -5 : 4;
        n.knowsPlayer = true;
        n.proxy = 'none';
        if (n.trip) s.nsys.arrive(n, s.t);
        t.fare = null;
        t.nextIn = 5;
        s.clearWaypoint();
        s.setObjective('Taxi shift: drive around to find fares', `Shift total ${formatMoney(t.earned)}`);
        s.objectives?.event('jobDone');
      }
    }
  }

  // ------------------------------------------------------------------ employment
  canApply(biz: number): string | null {
    const s = this.s;
    const def = s.city.businesses[biz];
    if (s.player.job) return 'You already have a job (quit first in the Jobs app).';
    if (s.econ.openings(biz) <= 0) return 'No openings right now.';
    if ((def.type === 'office' || def.type === 'bank') && !['business'].includes(this.outfitStyle())) return 'They expect business attire for interviews.';
    return null;
  }
  outfitStyle() {
    return this.s.player.outfits.find((o) => o.id === this.s.player.outfit)?.style ?? 'casual';
  }

  apply(biz: number) {
    const s = this.s;
    const why = this.canApply(biz);
    if (why) {
      s.notify('Application refused', why, 'warning');
      return false;
    }
    const def = s.city.businesses[biz];
    let slot = 0;
    let best = -1;
    def.jobs.forEach((j, i) => {
      const filled = s.econ.biz[biz].employees.filter((e) => s.npcs[e]?.job?.slot === i).length;
      if (j.count - filled > best && j.end - j.start <= 10) {
        best = j.count - filled;
        slot = i;
      }
    });
    const j = def.jobs[slot];
    s.player.job = { biz, role: j.role, wage: j.wage, start: j.start, end: j.end, days: j.days, shifts: 0, late: 0, lastShiftDay: -1, warnings: 0 };
    s.econ.biz[biz].employees.push(-1);
    s.notify(`Hired: ${j.role}`, `${def.name} · ${formatMoney(j.wage)}/h · ${fmtTime(j.start * 60)}–${fmtTime((j.end % 24) * 60)}`, 'objective');
    s.objectives?.event('hired');
    return true;
  }

  quit() {
    const s = this.s;
    const j = s.player.job;
    if (!j) return;
    s.econ.biz[j.biz].employees = s.econ.biz[j.biz].employees.filter((e) => e !== -1);
    s.player.job = null;
    s.notify('You quit your job', undefined, 'info');
  }

  shiftStatus(): { onShift: boolean; label: string } {
    const s = this.s;
    const j = s.player.job;
    if (!j) return { onShift: false, label: 'No job' };
    const wd = s.clock.weekday;
    const h = s.clock.hour;
    const today = j.days.includes(wd) && inHours(h, j.start - 0.5, j.end);
    if (j.lastShiftDay === s.clock.day) return { onShift: false, label: 'Shift done for today' };
    return { onShift: today, label: today ? 'Your shift is now' : `Next shift ${fmtTime(j.start * 60)}` };
  }

  /** called by the interior workstation after the mini-game */
  finishShift(performance: number) {
    const s = this.s;
    const j = s.player.job;
    if (!j) return;
    const now = s.t;
    const dayStart = Math.floor(now / MIN_PER_DAY) * MIN_PER_DAY;
    const shiftStart = dayStart + j.start * 60;
    const shiftEnd = dayStart + j.end * 60;
    const late = now > shiftStart + 15;
    if (late) j.late++;
    const hours = clamp((shiftEnd - Math.max(now, shiftStart)) / 60, 1, 10);
    const pay = Math.round(j.wage * hours * (0.8 + performance * 0.45));
    j.shifts++;
    j.lastShiftDay = s.clock.day;
    s.player.stats.shifts++;
    s.skipTime(Math.max(0, shiftEnd - now), 'Working your shift…', () => {
      s.player.earn(pay, `Wages · ${s.city.businesses[j.biz].name}`, 'bank', s.t);
      s.player.energy = Math.max(0, s.player.energy - 0.25);
      s.player.hunger = Math.max(0, s.player.hunger - 0.25);
      let msg = `${hours.toFixed(1)}h · performance ${Math.round(performance * 100)}%`;
      if (late) msg += ' · you were late';
      if (j.shifts % 5 === 0 && performance > 0.6) {
        j.wage = Math.round(j.wage * 1.12);
        if (!j.role.startsWith('Senior')) j.role = `Senior ${j.role}`;
        s.notify('Promotion!', `You are now ${j.role} at ${formatMoney(j.wage)}/h`, 'objective');
        s.objectives?.event('promoted');
      }
      s.notify('Shift complete', `+${formatMoney(pay)} · ${msg}`, 'money');
      s.objectives?.event('shift');
    });
  }

  private checkMissedShift() {
    const s = this.s;
    const j = s.player.job;
    if (!j) return;
    const wd = s.clock.weekday;
    const h = s.clock.hour;
    if (!j.days.includes(wd)) return;
    if (h > (j.end % 24) - 0.1 && h < (j.end % 24) + 0.3 && j.lastShiftDay !== s.clock.day && !s.player.flags[`missed_${s.clock.day}`]) {
      s.player.flags[`missed_${s.clock.day}`] = true;
      j.warnings++;
      if (j.warnings >= 3) {
        s.notify('You were fired', `${s.city.businesses[j.biz].name} let you go after missed shifts.`, 'warning');
        this.quit();
      } else s.notify('Missed shift', `Your manager at ${s.city.businesses[j.biz].name} is not happy (${j.warnings}/3).`, 'warning');
    }
  }

  // ------------------------------------------------------------------ requests
  offerRequest(n: NPC): string | null {
    const s = this.s;
    if (this.requests.some((r) => r.npc === n.id && (r.status === 'active' || r.status === 'offered'))) return null;
    const att = s.nsys.attitude(n);
    if (att < -0.2) return null;
    const roll = this.rng.next();
    let req: Request | null = null;
    if (n.money < 160 && roll < 0.5) {
      const amount = Math.round(30 + this.rng.next() * 50);
      req = { id: jid++, npc: n.id, kind: 'lend', text: `Honestly? I'm short for rent this week. Could you spare $${amount}? I'll pay you back.`, reward: Math.round(amount * 1.25), amount, status: 'offered', expires: s.t + 30 };
    } else if (roll < 0.75) {
      const friends = [...n.rel.entries()].filter(([, r]) => r.friend > 35).map(([id]) => s.npcs[id]);
      const f = friends[Math.floor(this.rng.next() * friends.length)];
      if (f) {
        const addr = s.city.buildings[s.nsys.homeBuilding(f)].address;
        req = {
          id: jid++,
          npc: n.id,
          kind: 'deliver',
          text: `Actually yes — could you drop this package off at ${f.first}'s place? ${addr}. I'll give you $25.`,
          reward: 25,
          item: `pkg_${n.id}_${f.id}`,
          itemName: `Package for ${f.first}`,
          target: f.id,
          status: 'offered',
          expires: s.t + 30,
        };
      }
    }
    if (!req) {
      const wants: [string, string, BusinessType[]][] = [
        ['coffee', 'a coffee', ['cafe']],
        ['sandwich', 'a sandwich', ['cafe', 'convenience', 'fastfood']],
        ['flowers', 'some flowers', ['convenience', 'grocery']],
        ['medicine', 'some painkillers', ['pharmacy', 'convenience']],
      ];
      const w = wants[Math.floor(this.rng.next() * wants.length)];
      req = {
        id: jid++,
        npc: n.id,
        kind: 'fetch',
        text: `Could you get me ${w[1]}? I can't get away right now. I'll pay you back double.`,
        reward: 0,
        item: w[0],
        itemName: w[1],
        shop: w[2],
        status: 'offered',
        expires: s.t + 30,
      };
    }
    this.requests.push(req);
    n.requestOpen = true;
    return req.text;
  }

  dialogueOptions(n: NPC): DialogueOptionView[] {
    const s = this.s;
    const out: DialogueOptionView[] = [];
    for (const r of this.requests) {
      if (r.npc !== n.id) continue;
      if (r.status === 'offered') {
        out.push({ id: `req_accept_${r.id}`, label: r.kind === 'lend' ? `Lend $${r.amount}` : "Sure, I'll do it", disabled: r.kind === 'lend' && s.player.money < (r.amount ?? 0) });
        out.push({ id: `req_decline_${r.id}`, label: 'Sorry, I can\'t' });
      } else if (r.status === 'active' && r.kind === 'fetch' && s.player.has(r.item!)) {
        out.push({ id: `req_give_${r.id}`, label: `Here's ${r.itemName}` });
      }
    }
    for (const r of this.requests) {
      if (r.status === 'active' && r.kind === 'deliver' && r.target === n.id && s.player.has(r.item!)) out.push({ id: `req_handover_${r.id}`, label: `Hand over the package from ${s.npcs[r.npc].first}` });
    }
    return out;
  }

  handleDialogue(n: NPC, id: string, say: (who: 'npc' | 'you', text: string) => void): boolean {
    const s = this.s;
    const m = /^req_(accept|decline|give|handover)_(\d+)$/.exec(id);
    if (!m) return false;
    const r = this.requests.find((x) => x.id === Number(m[2]));
    if (!r) return true;
    const asker = s.npcs[r.npc];
    if (m[1] === 'decline') {
      say('you', "Sorry, I can't right now.");
      say('npc', asker.traits.kindness > 0.5 ? 'No worries, I understand.' : 'Figures.');
      r.status = 'failed';
      asker.requestOpen = false;
      asker.relPlayer.friend -= 2;
      return true;
    }
    if (m[1] === 'accept') {
      if (r.kind === 'lend') {
        if (!s.player.pay(r.amount!, `Loan to ${npcName(asker)}`, s.t)) return true;
        say('you', `Here's $${r.amount}.`);
        say('npc', 'You are a lifesaver. Seriously. I will pay you back soon, I promise.');
        asker.money += r.amount!;
        r.status = 'active';
        r.repayAt = s.t + 60 * (24 + this.rng.next() * 30);
        asker.relPlayer.trust += 12;
        asker.relPlayer.friend += 10;
        s.nsys.addMemory(asker, 'paid_by_player', [-1], 0.6, 0.8);
        if (!asker.hasNumber) {
          asker.hasNumber = true;
          if (!s.player.contacts.includes(asker.id)) s.player.contacts.push(asker.id);
        }
        return true;
      }
      if (r.kind === 'deliver') {
        if (!s.player.addItem({ id: r.item!, name: r.itemName!, kind: 'delivery', value: 0 })) {
          say('npc', 'Oh — your bag looks full.');
          return true;
        }
        say('you', "Sure, I'll take it.");
        say('npc', 'Thank you! They live close by. I owe you.');
        const f = s.npcs[r.target!];
        const door = s.city.buildings[s.nsys.homeBuilding(f)].door;
        s.setWaypoint(door.x, door.z, `${f.first}'s place`);
        s.setObjective(`Deliver ${r.itemName}`, s.city.buildings[s.nsys.homeBuilding(f)].address);
      } else {
        say('you', "I'll get it for you.");
        say('npc', `Thanks! Any ${r.shop!.join(' or ')} should have it. I'll be around.`);
        s.setObjective(`Buy ${r.itemName} for ${asker.first}`, `Bring it back to ${asker.first}`);
      }
      r.status = 'active';
      return true;
    }
    if (m[1] === 'give') {
      s.player.removeItem(r.item!);
      const price = Math.round((BASE_PRICE[r.shop![0]] ?? 8) * 1.2);
      const pay = price * 2;
      say('you', `Here's ${r.itemName}.`);
      say('npc', 'Amazing! Here, take this. Thank you so much.');
      s.player.earn(pay, `Paid back by ${asker.first}`, 'cash', s.t);
      this.finishRequest(r, asker);
      return true;
    }
    if (m[1] === 'handover') {
      s.player.removeItem(r.item!);
      say('you', `${asker.first} asked me to bring you this.`);
      say('npc', `Oh! That's from ${asker.first}? Thanks for bringing it over.`);
      n.relPlayer.friend += 5;
      n.relPlayer.fam += 6;
      n.knowsPlayer = true;
      s.player.earn(r.reward, `Favour for ${asker.first}`, 'bank', s.t);
      this.finishRequest(r, asker);
      return true;
    }
    return true;
  }

  private finishRequest(r: Request, asker: NPC) {
    const s = this.s;
    r.status = 'done';
    asker.requestOpen = false;
    asker.relPlayer.friend += 12;
    asker.relPlayer.trust += 12;
    asker.relPlayer.fam += 8;
    s.nsys.addMemory(asker, 'helped_by_player', [-1], 0.65, 0.9);
    s.player.stats.requests++;
    s.player.reputation += 2;
    s.setObjective(null);
    s.clearWaypoint();
    s.notify('Favour complete', `${npcName(asker)} appreciates it`, 'relationship');
    s.objectives?.event('request');
    s.nsys.hooks.onMessage?.(asker, this.rng.pick(['Thanks again for today. You are good people.', 'Hey, thank you so much for helping me out earlier!']), 'thanks');
  }

  private updateRequests() {
    const s = this.s;
    for (const r of this.requests) {
      if (r.status === 'offered' && s.t > r.expires) {
        r.status = 'failed';
        s.npcs[r.npc].requestOpen = false;
      }
      if (r.status === 'active' && r.kind === 'lend' && r.repayAt && s.t > r.repayAt) {
        const n = s.npcs[r.npc];
        const honest = n.traits.kindness * 0.6 + n.traits.patience * 0.2 + 0.3 > 0.45;
        r.status = 'done';
        n.requestOpen = false;
        if (honest) {
          s.player.earn(r.reward, `Repaid by ${npcName(n)}`, 'bank', s.t);
          s.nsys.hooks.onMessage?.(n, `Paid you back — with a little extra. Thank you for trusting me. (+$${r.reward})`, 'thanks');
          n.relPlayer.trust += 10;
          s.objectives?.event('request');
        } else {
          s.nsys.hooks.onMessage?.(n, "I know I owe you... things have been really tough. I'm sorry.", 'chat');
          n.relPlayer.trust -= 5;
        }
      }
    }
    this.requests = this.requests.filter((r) => r.status === 'offered' || r.status === 'active' || s.t - r.expires < 600);
  }

  // ------------------------------------------------------------------ interactions
  private interactions(): Interactable[] {
    const s = this.s;
    const out: Interactable[] = [];
    if (s.mode === 'interior') return out;
    const p = s.playerPos();
    const near = (x: number, z: number, r = 3.2) => Math.hypot(x - p.x, z - p.z) < r;
    const j = this.active;
    if (j && s.mode === 'foot') {
      if (j.stage === 'pickup' && j.pickup && near(j.pickup.x, j.pickup.z)) {
        out.push({ key: 'KeyE', text: j.kind === 'parcel' ? 'Start courier route' : `Pick up order`, sub: j.pickup.label, dist: 0, priority: 20, action: () => this.pickup() });
      }
      if (j.stage === 'deliver') {
        const st = j.stops.find((x) => !x.done);
        if (st && near(st.x, st.z)) out.push({ key: 'KeyE', text: j.kind === 'parcel' ? 'Deliver parcel' : 'Deliver order', sub: st.label, dist: 0, priority: 20, action: () => this.deliver(st) });
      }
    }
    // package deliveries for favours: knock on the recipient's door
    for (const r of this.requests) {
      if (r.status !== 'active' || r.kind !== 'deliver' || !s.player.has(r.item!)) continue;
      const f = s.npcs[r.target!];
      const door = s.city.buildings[s.nsys.homeBuilding(f)].door;
      if (s.mode === 'foot' && near(door.x, door.z)) {
        out.push({
          key: 'KeyE',
          text: `Knock: deliver ${r.itemName}`,
          dist: 0,
          priority: 19,
          action: () => {
            const home = f.loc && f.loc.k === 'b' && f.loc.id === s.nsys.homeBuilding(f);
            if (!home) {
              s.notify('Nobody answers', `${f.first} isn't home. Try later, or find them around town.`, 'info');
              return;
            }
            s.player.removeItem(r.item!);
            const asker = s.npcs[r.npc];
            this.doorbell(f, { x: door.x, z: door.z, label: '', building: s.nsys.homeBuilding(f) });
            f.relPlayer.fam += 6;
            f.relPlayer.friend += 4;
            f.knowsPlayer = true;
            s.player.earn(r.reward, `Favour for ${asker.first}`, 'bank', s.t);
            this.finishRequest(r, asker);
          },
        });
      }
    }
    // job buildings
    if (s.mode === 'foot') {
      const tb = s.city.landmarks['taxi'];
      if (tb !== undefined) {
        const d = s.city.buildings[tb].door;
        if (near(d.x, d.z, 3.5)) {
          if (!this.taxi) out.push({ key: 'KeyF', text: 'Start a taxi shift', sub: 'Echo Cabs · earn fares and tips', dist: 0, priority: 8, action: () => this.startTaxi() });
          else out.push({ key: 'KeyF', text: 'End taxi shift', dist: 0, priority: 8, action: () => this.endTaxi() });
        }
      }
      // supply sales at shop doors
      for (const sup of this.supplies) {
        const d = this.bizDoor(sup.biz);
        if (!near(d.x, d.z, 3.2)) continue;
        const item = s.player.inventory.find((i) => i.id === `goods_${sup.goods}`);
        if (item) out.push({ key: 'KeyF', text: `Sell ${GOODS[sup.goods].name} for ${formatMoney(sup.price)}`, sub: `${d.label} is low on stock`, dist: 0, priority: 9, action: () => this.sellSupply(sup) });
      }
    }
    return out;
  }

  buyGoods(goods: string) {
    const s = this.s;
    const price = this.wholesalePrice(goods);
    if (!s.player.pay(price, `Wholesale: ${GOODS[goods].name}`, s.t)) {
      s.notify('Not enough money', undefined, 'warning');
      return;
    }
    if (!s.player.addItem({ id: `goods_${goods}`, name: GOODS[goods].name, kind: 'goods', value: price })) {
      s.player.earn(price, 'Refund', 'cash', s.t);
      s.notify('Your bag is full', undefined, 'warning');
      return;
    }
    s.notify('Bought supplies', `${GOODS[goods].name} for ${formatMoney(price)}`, 'money');
  }

  sellSupply(sup: SupplyOffer) {
    const s = this.s;
    if (!s.player.removeItem(`goods_${sup.goods}`)) return;
    s.player.earn(sup.price, `Sold ${GOODS[sup.goods].name} to ${s.city.businesses[sup.biz].name}`, 'bank', s.t);
    const b = s.econ.biz[sup.biz];
    b.stock = Math.min(b.maxStock, b.stock + 15);
    b.cash -= sup.price;
    sup.need--;
    if (sup.need <= 0 || b.stock > b.maxStock * 0.6) this.supplies = this.supplies.filter((x) => x !== sup);
    s.player.stats.trades++;
    s.notify('Supplies sold', `+${formatMoney(sup.price)}`, 'money');
    s.objectives?.event('trade');
  }

  // ------------------------------------------------------------------ update
  update(dt: number, dm: number) {
    const s = this.s;
    this.genTimer -= dt;
    if (this.genTimer <= 0) {
      this.genTimer = 4;
      this.generate();
    }
    if (s.clock.day !== this.lastSupplyDay) {
      this.lastSupplyDay = s.clock.day;
      this.refreshSupplies();
    }
    const j = this.active;
    if (j && (j.stage === 'pickup' || j.stage === 'deliver')) {
      j.timer -= dt;
      if (j.timer <= 0) this.fail('Out of time');
      else if (j.stage === 'deliver') {
        const st = j.stops.find((x) => !x.done);
        if (st && s.objective) s.objective.sub = `${formatMoney(j.pay)} · ${Math.ceil(j.timer)}s left`;
      } else if (s.objective) s.objective.sub = `${formatMoney(j.pay)} · ${Math.ceil(j.timer)}s to pick up`;
    }
    if (this.taxi) this.updateTaxi(dt);
    this.updateRequests();
    if (dm > 0) this.checkMissedShift();
    // doorbell visitors go back inside
    for (const d of this.doorbellPeds) d.t -= dt;
    for (const d of this.doorbellPeds.filter((x) => x.t <= 0)) {
      const ped = s.peds.byNpc.get(d.npc);
      if (ped) s.peds.despawn(ped, s.t, false);
    }
    this.doorbellPeds = this.doorbellPeds.filter((x) => x.t > 0);
    // waypoint beam
    const wp = s.waypoint;
    if (wp && s.mode !== 'interior') {
      this.beam.visible = true;
      this.beam.position.set(wp.x, 30, wp.z);
      const d = Math.hypot(wp.x - s.playerPos().x, wp.z - s.playerPos().z);
      this.beamMat.opacity = clamp(0.12 + d / 300, 0.15, 0.45) * (0.8 + 0.2 * Math.sin(s.game.time * 3));
      if (d < 4 && !this.active && !s.objective) s.clearWaypoint();
    } else this.beam.visible = false;
    void CURB_H;
    void VEHICLES;
  }

  serialize() {
    return { requests: this.requests, playerJobActive: null };
  }
  restore(d: ReturnType<JobSystem['serialize']>) {
    this.requests = d.requests ?? [];
    for (const r of this.requests) if (r.status === 'offered' || r.status === 'active') this.s.npcs[r.npc].requestOpen = true;
  }

  dispose() {
    this.s.game.scene.remove(this.beam);
  }
}
