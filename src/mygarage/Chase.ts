// The police chase: a patrol car spots you, and from then on the police come after you on the
// chase road (downtown streets and motorway, see highway/road.ts). The longer it goes on and the
// more of them you take out, the higher the heat: more cars, faster ones, cars cutting you off from
// up ahead, and roadblocks. Get well away for long enough and you escape (until the next patrol
// spots you); slow right down with a police car on you and you are busted.
//
// The police cars are real cars in the physics (they ram, spin and crash); highway/police.ts
// drives them. DriveGame owns this and turns its events into popups, points and sounds.
import * as THREE from 'three';
import type { Physics } from '../engine/Physics';
import { DrivableVehicle } from '../game/DrivableVehicle';
import { VEHICLES } from '../sim/vehicles';
import type { Highway, Driver } from './Highway';
import { CopDriver } from './highway/police';
import { aheadOf, laneLat } from './highway/road';

export type ChaseState = 'patrol' | 'pursuit' | 'cooldown';

export type ChaseEvent =
  | { kind: 'spotted' }
  | { kind: 'backup' }
  | { kind: 'takedown'; byYou: boolean }
  | { kind: 'escaped' }
  | { kind: 'busted' }
  | { kind: 'roadblock'; dist: number }
  | { kind: 'dodged' }
  | { kind: 'heat'; heat: number };

type Role = 'spotter' | 'pursuit' | 'roadblock';

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
export const HEAT_STEP = 30;
/** escaping: every police car further than this (m) fills the meter, over ESCAPE_T seconds */
export const ESCAPE_FAR = 240;
export const ESCAPE_T = 9;
/** a police car closer than this drains it */
export const ESCAPE_NEAR = 170;
const PAINT = new THREE.Color(0x111827);
const PARKED = { throttle: 0, brake: 0, steer: 0, handbrake: true };

export class Chase {
  cops: Cop[] = [];
  state: ChaseState = 'patrol';
  heat = 1;
  maxHeat = 1;
  time = 0;
  pursuitT = 0;
  totalPursuit = 0;
  longestPursuit = 0;
  /** 0..1: fills while you are well clear of the police */
  escape = 0;
  /** 0..1: fills while you are stopped with a police car on you */
  bust = 0;
  takedowns = 0;
  escapes = 0;
  roadblocks = 0;
  busted = false;
  cooldownT = 0;
  events: ChaseEvent[] = [];
  /** the last few things the police hit (for tuning and tests) */
  hits: { t: number; dv: number; what: string; lat: number; v: number; why: string }[] = [];
  private backupT = 0;
  private blockT = 25;
  /** backup alternates: from behind, then cutting you off from ahead */
  private fromAhead = false;
  private blockId = 0;
  private blocks: { id: number; s: number; touched: boolean; announced: boolean }[] = [];
  /** your car's top speed (m/s): the police are tuned against it */
  private yourTop = 50;
  private yourCar: DrivableVehicle | null = null;

  constructor(
    private physics: Physics,
    private hw: Highway,
  ) {}

  /** a fresh chase: a patrol car waits by the kerb a little way ahead */
  begin(yourTop: number) {
    this.dispose();
    this.yourTop = yourTop;
    this.state = 'patrol';
    this.heat = this.maxHeat = 1;
    this.time = this.pursuitT = this.totalPursuit = this.longestPursuit = 0;
    this.escape = this.bust = 0;
    this.takedowns = this.escapes = this.roadblocks = 0;
    this.busted = false;
    this.blockT = 25;
    this.fromAhead = false;
    this.blocks = [];
    const you = this.hw.you!;
    this.spawnSpotter(you.s + 230);
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
      lights: role !== 'spotter',
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

  /** parked up on the pavement (or the hard shoulder), waiting */
  private spawnSpotter(s: number) {
    const p = this.hw.you!.path;
    for (let k = 0; k < 6; k++) {
      const ss = s + k * 25;
      const pc = p.pieceAt(ss);
      if (pc.junctions.some((j) => Math.abs(ss - pc.s0 - j) < 12)) continue;
      if (this.spawn(ss, p.rightEdge(ss) + 1.6, 'spotter')) return;
    }
  }

  /**
   * Backup: a car coming up from behind, out of sight, at your speed; or (from heat 2, every other
   * one) a car joining from up ahead, going slower than you, to cut you off.
   */
  private spawnBackup() {
    const you = this.hw.you!;
    const p = you.path;
    const ahead = this.fromAhead && this.heat >= 2;
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
    cop.hp -= (dv - 5) * 7.5;
    // hitting the patrol car is one way to get its attention
    if (cop.role === 'spotter' && this.state !== 'pursuit' && this.time - cop.hitByYou < 1.5) this.startPursuit();
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

  private startPursuit() {
    this.state = 'pursuit';
    this.pursuitT = 0;
    this.escape = 0;
    this.backupT = 6;
    for (const c of this.cops) {
      if (c.role === 'spotter') c.role = 'pursuit';
      if (!c.disabled) c.lights = c.car.siren = true;
    }
    this.events.push({ kind: 'spotted' });
  }

  // ------------------------------------------------------------------ every frame
  /** `car` is your car; `you` where it is on the road */
  update(dt: number, you: Driver, car: DrivableVehicle) {
    if (dt <= 0) return;
    this.time += dt;
    this.yourCar = car;
    const hw = this.hw;
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
      if (c.disabled || c.role === 'roadblock' || (c.role === 'spotter' && this.state !== 'pursuit')) {
        // parked (the brake pedal at a standstill would reverse it)
        c.car.aiInput = PARKED;
        continue;
      }
      const chasing = this.state === 'pursuit';
      // the police are tuned against your car: about as fast as it at first, faster as the heat
      // rises, and much faster when they have dropped back (even if you are on the boost)
      const back = behind ?? 0;
      const catchUp = 1 + Math.max(0, Math.min(0.45, (back - 40) / 220));
      const spec = VEHICLES[8];
      let want = this.yourTop * (0.96 + 0.06 * this.heat) * catchUp;
      if (back > 60) want = Math.max(want, Math.abs(car.forwardSpeed) * 1.08);
      c.car.topMul = Math.max(1, want / spec.maxSpeed);
      c.car.powerMul = (1.25 + 0.12 * this.heat) * catchUp * Math.max(1, want / spec.maxSpeed);
      c.ai.aLat = 11 + this.heat * 0.5;
      const ms = c.car.spec.steer / (1 + Math.abs(c.car.forwardSpeed) / 19);
      c.car.aiInput = c.ai.update(
        dt,
        c.d,
        { x: c.car.pos.x, z: c.car.pos.z, yaw: c.car.yaw, speed: c.car.forwardSpeed, wheelBase: c.car.spec.wheelBase, maxSteer: ms },
        chasing ? you : null,
        hw.traffic.cars,
        others,
        c.car.spec.maxSpeed * c.car.topMul,
      );
    }

    const active = this.cops.filter((c) => !c.disabled && c.role !== 'roadblock' && (c.role !== 'spotter' || this.state === 'pursuit'));
    let nearest = Infinity;
    let onYou = 0;
    for (const c of active) {
      const d = c.car.pos.distanceTo(car.pos);
      nearest = Math.min(nearest, d);
      if (d < 10) onYou++;
    }

    if (this.state === 'patrol' || this.state === 'cooldown') {
      if (this.state === 'cooldown') {
        this.cooldownT -= dt;
        // a new patrol car up ahead
        if (this.cooldownT <= 0 && !this.cops.some((c) => c.role === 'spotter')) {
          this.state = 'patrol';
          this.spawnSpotter(you.s + 320);
        }
      }
      // passing the patrol car (or hitting it) starts the chase
      for (const c of this.cops) {
        if (c.role !== 'spotter') continue;
        const d = aheadOf(you.path, you.s, c.d.path, c.d.s);
        if (d !== null && d < 25 && d > -30) {
          this.startPursuit();
          break;
        }
      }
      if (this.state === 'patrol' && !this.cops.some((c) => c.role === 'spotter')) this.spawnSpotter(you.s + 320);
      this.bust = Math.max(0, this.bust - dt);
      return;
    }

    // ---- the pursuit
    this.pursuitT += dt;
    this.totalPursuit += dt;
    this.longestPursuit = Math.max(this.longestPursuit, this.pursuitT);
    const heat = Math.min(5, 1 + Math.floor(this.totalPursuit / HEAT_STEP) + Math.floor(this.takedowns / 2));
    if (heat > this.heat) {
      this.heat = heat;
      this.maxHeat = Math.max(this.maxHeat, heat);
      this.events.push({ kind: 'heat', heat });
    }
    // backup (not while they are losing track of you: then it is down to the ones already after you)
    this.backupT -= dt;
    if (active.length < UNITS[this.heat] && this.backupT <= 0 && this.escape < 0.25) {
      this.backupT = 1.2;
      if (this.spawnBackup()) {
        this.backupT = Math.max(2.5, 7 - this.heat);
        this.events.push({ kind: 'backup' });
      }
    }
    // roadblocks from heat 2
    this.blockT -= dt;
    if (this.heat >= 2 && this.blockT <= 0) {
      this.blockT = 50 - this.heat * 6;
      this.spawnRoadblock(you.s + 520);
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
    // escaping: well clear of every police car for a while (quicker the further away)
    if (nearest > ESCAPE_FAR) this.escape = Math.min(1, this.escape + dt / (nearest > ESCAPE_FAR * 1.75 ? ESCAPE_T * 0.55 : ESCAPE_T));
    else if (nearest < ESCAPE_NEAR) this.escape = Math.max(0, this.escape - dt / 2);
    if (this.escape >= 1) {
      this.escaped();
      return;
    }
    // busted: stopped with a police car on you
    const slow = car.speed < 6;
    if (slow && onYou > 0) this.bust = Math.min(1, this.bust + dt * (0.34 + 0.15 * (onYou - 1)));
    else this.bust = Math.max(0, this.bust - dt * 0.5);
    if (this.bust >= 1 && !this.busted) {
      this.busted = true;
      this.events.push({ kind: 'busted' });
    }
  }

  private escaped() {
    this.state = 'cooldown';
    this.escapes++;
    this.escape = 0;
    this.bust = 0;
    this.cooldownT = 18 + Math.random() * 10;
    // they have lost you: the chasing cars (all well back by now) are gone, a roadblock stays put
    for (const c of [...this.cops]) {
      if (c.role === 'roadblock') c.lights = c.car.siren = false;
      else this.remove(c);
    }
    this.events.push({ kind: 'escaped' });
  }

  private remove(c: Cop) {
    c.car.dispose();
    this.cops.splice(this.cops.indexOf(c), 1);
  }
}
