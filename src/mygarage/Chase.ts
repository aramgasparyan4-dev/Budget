// The police chase: a getaway. You start on the motorway with the police right behind you; the
// road takes you into town and finally to the docks (see highway/road.ts): get through the dock
// gates and you have escaped. The longer it goes on and the more of them you take out, the higher
// the heat: more cars, faster ones, cars cutting you off from up ahead, and roadblocks. Slow right
// down with a police car on you and you are busted.
//
// The police cars are real cars in the physics (they ram, spin and crash); highway/police.ts
// drives them. DriveGame owns this and turns its events into popups, points and sounds.
import * as THREE from 'three';
import type { Physics } from '../engine/Physics';
import { DrivableVehicle } from '../game/DrivableVehicle';
import { VEHICLES } from '../sim/vehicles';
import type { Highway, Driver } from './Highway';
import { BOX_SPEED, CopDriver } from './highway/police';
import { aheadOf, laneLat } from './highway/road';

export type ChaseState = 'pursuit' | 'escaped' | 'busted';

export type ChaseEvent =
  | { kind: 'go' }
  | { kind: 'backup' }
  | { kind: 'takedown'; byYou: boolean }
  | { kind: 'town' }
  | { kind: 'docks' }
  | { kind: 'escaped' }
  | { kind: 'busted' }
  | { kind: 'roadblock'; dist: number }
  | { kind: 'dodged' }
  | { kind: 'heat'; heat: number };

type Role = 'pursuit' | 'roadblock';

export interface Cop {
  car: DrivableVehicle;
  d: Driver;
  ai: CopDriver;
  role: Role;
  hp: number;
  disabled: boolean;
  /** lights and siren on */
  lights: boolean;
  /** when you last hit it (seconds of chase time) */
  hitByYou: number;
  /** a roadblock car: which block it belongs to */
  block: number;
  /** chase time it appeared (it settles onto its wheels first: that is not a crash) */
  born: number;
}

/** pursuit cars by heat level */
export const UNITS = [0, 2, 3, 4, 4, 5];
/** seconds of pursuit per heat level */
export const HEAT_STEP = 45;
/** no roadblocks or cars cut in from ahead this close to the dock gates: the end is yours to reach */
const CLEAR_END = 350;
/** a police car within this many metres of you (centre to centre) counts towards busting you */
const BUST_RANGE = 14;
const PAINT = new THREE.Color(0x111827);
const PARKED = { throttle: 0, brake: 0, steer: 0, handbrake: true };

export class Chase {
  cops: Cop[] = [];
  state: ChaseState = 'pursuit';
  heat = 1;
  maxHeat = 1;
  /** seconds since GO */
  time = 0;
  /** 0..1: fills while you are stopped with a police car on you */
  bust = 0;
  takedowns = 0;
  roadblocks = 0;
  busted = false;
  escaped = false;
  /** where you started and where the dock gates are (s on the road) */
  startS = 0;
  events: ChaseEvent[] = [];
  /** the last few things the police hit (for tuning and tests) */
  hits: { t: number; dv: number; what: string; lat: number; v: number; why: string }[] = [];
  private started = false;
  private inTown = false;
  private nearDocks = false;
  private backupT = 0;
  private blockT = 25;
  private blockId = 0;
  private blocks: { id: number; s: number; touched: boolean; announced: boolean }[] = [];
  /** backup alternates: from behind, then cutting you off from ahead */
  private fromAhead = false;
  /** your car's top speed (m/s): the police are tuned against it */
  private yourTop = 50;
  private yourCar: DrivableVehicle | null = null;

  constructor(
    private physics: Physics,
    private hw: Highway,
  ) {}

  /** the dock gates (s on the road), once the road has been laid that far */
  get finish() {
    return this.hw.you?.path.finish ?? null;
  }

  /** metres left to the dock gates */
  get toDocks() {
    const f = this.finish;
    const you = this.hw.you;
    return f === null || !you ? null : Math.max(0, f - you.s);
  }

  /** how far along the way to the docks you are, 0..1 (the whole road is laid at the start) */
  get progress() {
    const f = this.finish;
    const you = this.hw.you;
    if (f === null || !you) return 0;
    return Math.max(0, Math.min(1, (you.s - this.startS) / Math.max(1, f - this.startS)));
  }

  /** where you are: out on the motorway, in town, or at the docks */
  get stage(): 'motorway' | 'town' | 'docks' {
    const you = this.hw.you;
    if (!you) return 'motorway';
    const pc = you.path.pieceAt(you.s);
    return pc.zone === 'docks' ? 'docks' : pc.street ? 'town' : 'motorway';
  }

  /** a fresh chase: two police cars right behind you, lights on, waiting for GO */
  begin(yourTop: number) {
    this.dispose();
    this.yourTop = yourTop;
    this.state = 'pursuit';
    this.heat = this.maxHeat = 1;
    this.time = 0;
    this.bust = 0;
    this.takedowns = this.roadblocks = 0;
    this.busted = this.escaped = false;
    this.started = this.inTown = this.nearDocks = false;
    this.blockT = 25;
    this.backupT = 8;
    this.blocks = [];
    this.fromAhead = false;
    const you = this.hw.you!;
    this.startS = you.s;
    this.spawn(you.s - 60, laneLat(0), 'pursuit');
    this.spawn(you.s - 85, laneLat(2), 'pursuit');
  }

  dispose() {
    for (const c of this.cops) c.car.dispose();
    this.cops = [];
    this.events.length = 0;
  }

  /** the drivers the traffic must make room for, and those of them with lights on */
  drivers(): { all: Driver[]; sirens: Driver[] } {
    const all: Driver[] = [];
    const sirens: Driver[] = [];
    for (const c of this.cops) {
      all.push(c.d);
      if (c.lights && !c.disabled && c.role === 'pursuit') sirens.push(c.d);
    }
    return { all, sirens };
  }

  /** physics-rate control */
  control(h: number) {
    for (const c of this.cops) c.car.control(h, null, true);
  }

  /** move with the highway when it is brought back toward its start */
  shift(dx: number, dz: number) {
    for (const c of this.cops) {
      const t = c.car.body.translation();
      c.car.body.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
      c.car.pos.x += dx;
      c.car.pos.z += dz;
    }
  }

  // ------------------------------------------------------------------ spawning
  private spawn(s: number, lat: number, role: Role, yawOff = 0, speed = 0): Cop | null {
    const you = this.hw.you!;
    const p = you.path;
    if (s < 5 || s > p.length - 5) return null;
    const q = p.pose(s, lat);
    // not on top of anything
    for (const c of this.hw.traffic.cars) if (Math.hypot(c.x - q.x, c.z - q.z) < 9) return null;
    for (const c of this.cops) if (Math.hypot(c.car.pos.x - q.x, c.car.pos.z - q.z) < (role === 'roadblock' ? 3 : 8)) return null;
    const yaw = q.h + yawOff;
    const car = new DrivableVehicle(this.physics, 8, q.x, 0.02, q.z, yaw, PAINT, 'company', 'Police');
    car.headlights = true;
    car.handlingAssist = true;
    if (speed > 0) car.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
    car.lastVel.set(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed);
    const cop: Cop = {
      car,
      d: { path: p, s, lat, v: speed, len: car.spec.length, width: car.spec.width },
      ai: new CopDriver(),
      role,
      hp: 100,
      disabled: false,
      lights: true,
      hitByYou: -10,
      block: -1,
      born: this.time,
    };
    cop.ai.tLat = lat;
    car.siren = cop.lights;
    car.aiInput = PARKED;
    car.onImpact = (dv) => this.copHit(cop, dv);
    this.cops.push(cop);
    return cop;
  }

  /**
   * Backup: a car coming up from behind, out of sight, at your speed; or (from heat 2, every other
   * one) a car joining from up ahead, going slower than you, to cut you off.
   */
  private spawnBackup() {
    const you = this.hw.you!;
    const p = you.path;
    const f = this.finish;
    const ahead = this.fromAhead && this.heat >= 2 && (f === null || you.s + 330 < f - CLEAR_END);
    this.fromAhead = !this.fromAhead;
    for (let k = 0; k < 5; k++) {
      const s = ahead ? you.s + 230 + k * 20 : you.s - 260 - k * 22;
      if (s < 10 || s > p.length - 20) break;
      const n = Math.floor(p.lanes(s) + 0.4);
      const lane = Math.floor(Math.random() * n);
      if (!p.laneOpen(lane, s)) continue;
      if (this.spawn(s, laneLat(lane), 'pursuit', 0, ahead ? Math.max(8, you.v * 0.45) : Math.max(10, you.v))) return true;
    }
    return false;
  }

  /** two or three cars across the road ahead, with one way through */
  private spawnRoadblock(s: number) {
    const p = this.hw.you!.path;
    const n = Math.floor(p.lanes(s) + 0.4);
    if (n < 2) return;
    const street = p.street(s);
    const gap = p.companionGap(s) ?? 0;
    // the lanes across the whole road downtown (both ways), our side on the motorway
    const lats: number[] = [];
    if (street) for (let i = p.compLanes - 1; i >= 0; i--) lats.push(-(gap + laneLat(i)));
    for (let i = 0; i < n; i++) lats.push(laneLat(i));
    const open = Math.floor(Math.random() * lats.length);
    const id = ++this.blockId;
    let placed = 0;
    // angled nose to nose in pairs, staggered so each fills its lane
    lats.forEach((lat, i) => {
      if (i === open) return;
      const c = this.spawn(s + (i % 2) * 5.5, lat, 'roadblock', (i % 2 ? 1 : -1) * 0.35);
      if (c) {
        c.block = id;
        placed++;
      }
    });
    if (placed) {
      this.blocks.push({ id, s, touched: false, announced: false });
      this.roadblocks++;
    }
  }

  // ------------------------------------------------------------------ hits
  private copHit(cop: Cop, dv: number) {
    if (dv < 5 || this.time - cop.born < 1.2) return;
    // a police car hitting traffic crashes that car too (unless it was you it hit)
    const p = cop.car.pos;
    // (by outline distance: whatever is touching it)
    const reach = (x: number, z: number, len: number) => Math.hypot(x - p.x, z - p.z) - (len + cop.car.spec.length) / 2;
    const hc = this.hw.nearest(p.x, p.z, 6);
    const yc = this.yourCar;
    const yours = yc ? reach(yc.pos.x, yc.pos.z, yc.spec.length) : Infinity;
    const dCar = hc ? reach(hc.x, hc.z, hc.len) : Infinity;
    const dCop = this.cops.reduce((m, o) => (o === cop ? m : Math.min(m, reach(o.car.pos.x, o.car.pos.z, o.car.spec.length))), Infinity);
    const near = Math.min(yours, dCar, dCop);
    const what = near > 1.6 ? 'wall' : near === dCar ? (hc!.oncoming ? 'oncoming' : 'traffic') : near === dCop ? 'police' : 'you';
    if (hc && (what === 'traffic' || what === 'oncoming')) this.hw.crash(hc, dv);
    this.hits.push({ t: Math.round(this.time * 10) / 10, dv: Math.round(dv * 10) / 10, what, lat: Math.round(cop.d.lat * 10) / 10, v: Math.round(cop.car.forwardSpeed), why: cop.ai.limit });
    if (this.hits.length > 30) this.hits.shift();
    if (cop.disabled) return;
    // a police car takes a few real crashes to put out of action (bumping you does next to nothing)
    cop.hp -= Math.max(0, dv - 7) * 5;
    if (cop.hp <= 0) {
      cop.disabled = true;
      cop.lights = false;
      cop.car.siren = false;
      cop.car.hazards = true;
      const byYou = this.time - cop.hitByYou < 1.5;
      if (byYou) this.takedowns++;
      this.events.push({ kind: 'takedown', byYou });
    }
  }

  /** you hit a police car (DriveGame works out which) */
  youHit(cop: Cop) {
    cop.hitByYou = this.time;
    cop.ai.pitSide = cop.ai.pitSide === 1 ? -1 : 1;
    const b = this.blocks.find((x) => x.id === cop.block);
    if (b) b.touched = true;
  }

  /** the police car nearest to a point (within maxD metres of its outline) */
  nearest(x: number, z: number, maxD: number): Cop | null {
    let best: Cop | null = null;
    let bd = maxD;
    for (const c of this.cops) {
      const d = Math.hypot(c.car.pos.x - x, c.car.pos.z - z) - c.car.spec.length / 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ every frame
  /** `car` is your car; `you` where it is on the road */
  update(dt: number, you: Driver, car: DrivableVehicle) {
    if (dt <= 0) return;
    if (!this.started) {
      this.started = true;
      this.events.push({ kind: 'go' });
    }
    this.time += dt;
    this.yourCar = car;
    const hw = this.hw;
    const chasing = this.state === 'pursuit';
    // where each police car is, and what it does
    const others = this.cops.map((c) => c.d);
    for (const c of [...this.cops]) {
      const lv = c.car.body.linvel();
      const p = hw.locate(c.d, { x: c.car.pos.x, z: c.car.pos.z, vx: lv.x, vz: lv.z, len: c.car.spec.length, width: c.car.spec.width });
      const behind = aheadOf(c.d.path, c.d.s, you.path, you.s);
      const lost = !p || Math.abs(c.d.lat) > 40 || c.car.pos.y < -5;
      // too far behind, too far ahead, off the road, or stuck for good: gone
      if (lost || (behind !== null && (behind > 420 || behind < -900)) || c.ai.hopeless > 9) {
        this.remove(c);
        continue;
      }
      if (c.disabled || c.role === 'roadblock') {
        // parked (the brake pedal at a standstill would reverse it)
        c.car.aiInput = PARKED;
        continue;
      }
      // the police are tuned against your car: a little slower than it at first (a clean run down
      // an open road pulls away), faster as the heat rises, and quicker when they have dropped well
      // back (so a lead holds at about 150 m, even on the boost)
      const back = behind ?? 0;
      const catchUp = 1 + Math.max(0, Math.min(0.35, (back - 90) / 250));
      const spec = VEHICLES[8];
      let want = this.yourTop * (0.9 + 0.04 * this.heat) * catchUp;
      if (back > 160) want = Math.max(want, Math.abs(car.forwardSpeed) * 1.06);
      c.car.topMul = Math.max(0.6, want / spec.maxSpeed);
      c.car.powerMul = (1.1 + 0.1 * this.heat) * catchUp * Math.max(1, want / spec.maxSpeed);
      c.ai.aLat = 11 + this.heat * 0.5;
      const ms = c.car.spec.steer / (1 + Math.abs(c.car.forwardSpeed) / 19);
      c.car.aiInput = c.ai.update(
        dt,
        c.d,
        { x: c.car.pos.x, z: c.car.pos.z, yaw: c.car.yaw, speed: c.car.forwardSpeed, wheelBase: c.car.spec.wheelBase, maxSteer: ms },
        // once it is over they pull up
        chasing ? you : null,
        hw.traffic.cars,
        others,
        c.car.spec.maxSpeed * c.car.topMul,
      );
    }
    if (!chasing) return;

    // through the dock gates: away
    const f = this.finish;
    if (f !== null && you.s >= f) {
      this.state = 'escaped';
      this.escaped = true;
      for (const c of this.cops) c.lights = c.car.siren = false;
      this.events.push({ kind: 'escaped' });
      return;
    }
    // where you are on the way
    if (!this.inTown && you.path.street(you.s)) {
      this.inTown = true;
      this.events.push({ kind: 'town' });
    }
    if (!this.nearDocks && f !== null && f - you.s < 600) {
      this.nearDocks = true;
      this.events.push({ kind: 'docks' });
    }

    const active = this.cops.filter((c) => !c.disabled && c.role === 'pursuit');
    // police cars right by you (a roadblock's too): they are what busts you
    let onYou = 0;
    for (const c of this.cops) if (!c.disabled && c.car.pos.distanceTo(car.pos) < BUST_RANGE) onYou++;
    const heat = Math.min(5, 1 + Math.floor(this.time / HEAT_STEP) + Math.floor(this.takedowns / 2));
    if (heat > this.heat) {
      this.heat = heat;
      this.maxHeat = Math.max(this.maxHeat, heat);
      this.events.push({ kind: 'heat', heat });
    }
    // backup
    this.backupT -= dt;
    if (active.length < UNITS[this.heat] && this.backupT <= 0) {
      this.backupT = 1.2;
      if (this.spawnBackup()) {
        this.backupT = Math.max(2.5, 7 - this.heat);
        this.events.push({ kind: 'backup' });
      }
    }
    // roadblocks from heat 3 (none in the last stretch before the gates)
    this.blockT -= dt;
    if (this.heat >= 3 && this.blockT <= 0) {
      this.blockT = 50 - this.heat * 6;
      if (f === null || you.s + 520 < f - CLEAR_END) this.spawnRoadblock(you.s + 520);
    }
    for (const b of [...this.blocks]) {
      const d = b.s - you.s;
      if (!b.announced && d < 330) {
        b.announced = true;
        this.events.push({ kind: 'roadblock', dist: Math.round(d) });
      }
      if (d < -12) {
        if (!b.touched) this.events.push({ kind: 'dodged' });
        this.blocks.splice(this.blocks.indexOf(b), 1);
      }
    }
    // busted: stopped with a police car on you; about 3 s with one, quicker with more. It only
    // empties slowly, so rolling forward a metre does not reset it
    const slow = car.speed < BOX_SPEED;
    if (slow && onYou > 0) this.bust = Math.min(1, this.bust + dt * (0.33 + 0.2 * (onYou - 1)));
    else this.bust = Math.max(0, this.bust - dt * 0.4);
    if (this.bust >= 1 && !this.busted) {
      this.busted = true;
      this.state = 'busted';
      this.events.push({ kind: 'busted' });
    }
  }

  private remove(c: Cop) {
    c.car.dispose();
    this.cops.splice(this.cops.indexOf(c), 1);
  }
}
