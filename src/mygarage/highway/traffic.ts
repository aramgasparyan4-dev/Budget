// Traffic on the highway's road tree. Pure logic (three.js only for colours) so it can be tested.
//
// Cars keep to lanes, follow the car ahead (intelligent driver model), overtake slower cars with
// the indicator on, keep right when the way is clear, merge out of lanes that end or are coned
// off, and pick a branch before each fork (more of them head for the busy side). The other
// direction drives on its own road off to the left (downtown, right beside you: those cars brake
// for whatever is in their lane, you included, and can be hit). You and any police are part of the
// traffic: cars brake for you and will not cut in right on top of you (but will cut in close when
// you come up fast), and they move over for a police car coming up behind with its lights on.
import * as THREE from 'three';
import { VEHICLES } from '../../sim/vehicles';
import { Path, laneLat, latBetween, aheadOf, ZONES, Rand } from './road';

export interface HCar {
  id: number;
  type: number;
  paint: THREE.Color;
  path: Path;
  s: number;
  lane: number;
  lat: number;
  fromLat: number;
  /** lane change progress in seconds (-1: not changing) */
  changeT: number;
  /** indicator on before the move */
  signalT: number;
  cool: number;
  v: number;
  vDes: number;
  acc: number;
  /** the other direction, on the road to the left */
  oncoming: boolean;
  /** which branch it wants at the next fork: 0 left, 1 right */
  prefer: 0 | 1;
  x: number;
  z: number;
  yaw: number;
  wheelRot: number;
  blink: -1 | 0 | 1;
  crashed: boolean;
  spin: number;
  spinV: number;
  slideV: number;
  len: number;
  width: number;
  body: unknown;
}

/** you, in road terms */
export interface Driver {
  path: Path;
  s: number;
  lat: number;
  /** speed along the road */
  v: number;
  len: number;
  width: number;
}

export const CHANGE_T = 2.4;
const CARS = [0, 0, 1, 1, 1, 2, 2, 3, 4];
const HEAVY = [5, 5, 6, 6, 7];
/** desired speed by lane from the left, m/s: 120 km/h in the fast lane down to 75 */
const LANE_SPEED = [33.5, 30.5, 27, 23.5, 21];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class Traffic {
  cars: HCar[] = [];
  private nextId = 1;
  private spawnT = 0;
  /** metres you have driven: the road fills up as you go */
  travelled = 0;
  /** everyone not in the traffic (you, the police) for this update */
  private drivers: Driver[] = [];
  private youDriver: Driver | null = null;

  constructor(private rng: Rand) {}

  reset() {
    this.cars = [];
    this.spawnT = 0;
    this.travelled = 0;
  }

  /** a car to put on the road; null if the spot is taken */
  spawn(path: Path, s: number, lane: number, oncoming = false): HCar | null {
    const r = this.rng;
    if (s < 0 || s > path.length) return null;
    if (!oncoming && !path.laneOpen(lane, s)) return null;
    if (oncoming && (path.companionGap(s) === null || lane >= path.compLanes)) return null;
    for (const o of this.cars) if (o.path === path && o.oncoming === oncoming && o.lane === lane && Math.abs(o.s - s) < 34) return null;
    const heavy = !oncoming && lane >= 2 && r.next() < (lane >= path.lanes(s) - 1.5 ? 0.3 : 0.1);
    const list = heavy ? HEAVY : CARS;
    const type = list[Math.floor(r.next() * list.length)];
    const spec = VEHICLES[type];
    let vDes = (oncoming ? 30 : (LANE_SPEED[lane] ?? 21)) + (r.next() - 0.5) * 4;
    if (heavy) vDes = Math.min(vDes, 23);
    // more cars head for the busier branch
    let prefer: 0 | 1 = r.next() < 0.5 ? 0 : 1;
    const kids = path.children;
    if (kids) {
      const a = ZONES[kids[0].plan.zone].traffic;
      const b = ZONES[kids[1].plan.zone].traffic;
      prefer = r.next() < a / (a + b) ? 0 : 1;
    }
    const lat = oncoming ? 0 : laneLat(lane);
    const c: HCar = {
      id: this.nextId++,
      type,
      paint: new THREE.Color(spec.palette[Math.floor(r.next() * spec.palette.length)]),
      path,
      s,
      lane,
      lat,
      fromLat: lat,
      changeT: -1,
      signalT: 0,
      cool: 2 + r.next() * 5,
      v: vDes * 0.95,
      vDes,
      acc: 0,
      oncoming,
      prefer,
      x: 0,
      z: 0,
      yaw: 0,
      wheelRot: 0,
      blink: 0,
      crashed: false,
      spin: 0,
      spinV: 0,
      slideV: 0,
      len: spec.length,
      width: spec.width,
      body: null,
    };
    this.place(c);
    this.cars.push(c);
    return c;
  }

  /** world position and heading from road position */
  private place(c: HCar) {
    if (c.oncoming) {
      const g = c.path.companionGap(c.s);
      // its road has gone: let it go
      if (g === null) c.s = -1;
      const gap = g ?? 400;
      const p = c.path.pose(c.s, -(gap + laneLat(c.lane)));
      c.x = p.x;
      c.z = p.z;
      c.yaw = p.h + Math.PI + c.spin;
      return;
    }
    const p = c.path.pose(c.s, c.lat);
    c.x = p.x;
    c.z = p.z;
  }

  /** is a lane clear (of cars, you and the police) from `back` metres behind (path, s) to `front` ahead? */
  laneClear(path: Path, lane: number, s: number, back: number, front: number, self: HCar | null, drivers: Driver[] = this.drivers) {
    const lat = laneLat(lane);
    for (const o of this.cars) {
      if (o === self || o.oncoming) continue;
      const d = aheadOf(path, s, o.path, o.s);
      if (d === null || d < -back || d > front) continue;
      const ol = latBetween(o.lat, o.path, path);
      if (ol !== null && (Math.abs(ol - lat) < 2.6 || (o.lane === lane && o.path === path))) return false;
    }
    for (const you of drivers) {
      const d = aheadOf(path, s, you.path, you.s);
      const yl = latBetween(you.lat, you.path, path);
      // a police car coming up fast gets room by its speed (you get cut up close: that is the game)
      const b = you === this.youDriver ? back : Math.max(back, (you.v - (self?.v ?? 0)) * 2.5);
      if (d !== null && yl !== null && d > -b && d < front && Math.abs(yl - lat) < 2.9) return false;
    }
    return true;
  }

  private startChange(c: HCar, target: number) {
    c.blink = target < c.lane ? -1 : 1;
    c.signalT = 0.8;
    c.fromLat = c.lat;
    c.lane = target;
  }

  /** a police car with its lights on right behind: which way to move over (right if there is a lane, else left), or 0 */
  private yieldFor(c: HCar, sirens: Driver[]): number {
    const p = c.path;
    for (const sd of sirens) {
      const d = aheadOf(sd.path, sd.s, p, c.s);
      const sl = latBetween(sd.lat, sd.path, p);
      if (d === null || sl === null || d < 4 || d > 70 || Math.abs(sl - c.lat) > 2.2) continue;
      const n = Math.floor(p.lanes(c.s) + 0.4);
      if (c.lane < n - 1 && p.laneOpen(c.lane + 1, c.s + 40)) return 1;
      if (c.lane > 0) return -1;
    }
    return 0;
  }

  /** what a car has to do about lanes: make way, leave one that ends or is closed, get to its branch */
  private mustMove(c: HCar, yieldDir: number): number {
    const p = c.path;
    if (yieldDir) return yieldDir;
    // the lane ends or is coned off ahead
    for (const d of [40, 140, 260]) {
      if (!p.laneOpen(c.lane, Math.min(p.length, c.s + d))) {
        const left = c.lane - 1;
        const right = c.lane + 1;
        const sAt = Math.min(p.length, c.s + d);
        if (left >= 0 && p.laneOpen(left, sAt)) return -1;
        if (p.laneOpen(right, sAt)) return 1;
        return -1;
      }
    }
    // get over for the branch it wants
    if (p.children && p.length - c.s < 800) {
      const wantLeft = c.prefer === 0;
      if (wantLeft && c.lane >= p.split) return -1;
      if (!wantLeft && c.lane < p.split) return 1;
    }
    return 0;
  }

  /**
   * Move everyone on. `you` is the player (the road fills up with the distance you drive); `others`
   * are other cars outside the traffic that it has to make room for (the police), and `sirens` those
   * of them with their lights on.
   */
  update(dt: number, you: Driver | null, others: Driver[] = [], sirens: Driver[] = []) {
    if (dt <= 0) return;
    if (you) this.travelled += Math.max(0, you.v) * dt;
    this.drivers = you ? [you, ...others] : others;
    this.youDriver = you;
    const r = this.rng;
    for (const c of this.cars) {
      if (c.oncoming) {
        this.oncomingStep(c, dt);
        continue;
      }
      const p = c.path;
      // the car ahead in its lane (or in the one it is moving into), you included
      let gap = Infinity;
      let lv = 0;
      const tLat = laneLat(c.lane);
      for (const o of this.cars) {
        if (o === c || o.oncoming) continue;
        const d = aheadOf(p, c.s, o.path, o.s);
        if (d === null || d <= -1 || d > 260) continue;
        const ol = latBetween(o.lat, o.path, p);
        if (ol === null) continue;
        const w = (o.width + c.width) / 2 + 0.3;
        if (Math.abs(ol - c.lat) > w && Math.abs(ol - tLat) > w) continue;
        const g = d - (o.len + c.len) / 2;
        if (g < gap) {
          gap = g;
          lv = o.v;
        }
      }
      for (const you of this.drivers) {
        const d = aheadOf(p, c.s, you.path, you.s);
        const yl = latBetween(you.lat, you.path, p);
        if (d !== null && yl !== null && d > -1 && d < 260) {
          const w = (you.width + c.width) / 2 + 0.3;
          if (Math.abs(yl - c.lat) < w || Math.abs(yl - tLat) < w) {
            const g = d - (you.len + c.len) / 2;
            if (g < gap) {
              gap = g;
              lv = Math.max(0, you.v);
            }
          }
        }
      }
      // a lane that ends right ahead acts like a stopped car at its end
      if (!p.laneOpen(c.lane, Math.min(p.length, c.s + 60)) && c.changeT < 0) {
        for (let d = 10; d <= 60; d += 10) if (!p.laneOpen(c.lane, c.s + d)) {
          gap = Math.min(gap, d - c.len / 2);
          lv = 0;
          break;
        }
      }
      // speed limits: roadworks and tunnels
      const pc = p.pieceAt(c.s);
      let vDes = c.vDes;
      if (pc.works) {
        const u = c.s - pc.s0;
        if (u > pc.works.from - 80 && u < pc.works.to + 20) vDes = Math.min(vDes, 21);
      }
      if (pc.tunnel) vDes = Math.min(vDes, 29);
      // downtown: city speeds
      if (pc.street) vDes = Math.min(vDes, 12.5 + (c.id % 5) * 0.7);
      if (c.crashed) c.acc = -7;
      else {
        const a = 2.2;
        const b = 3.5;
        let acc = a * (1 - (c.v / vDes) ** 4);
        if (gap < 250) {
          const ss = 4 + Math.max(0, c.v * 1.1 + (c.v * (c.v - lv)) / (2 * Math.sqrt(a * b)));
          acc -= a * (ss / Math.max(0.5, gap)) ** 2;
        }
        c.acc = clamp(acc, -9, a);
        // lanes: forced moves first, then overtaking and keeping right
        c.cool -= dt;
        const yieldDir = sirens.length ? this.yieldFor(c, sirens) : 0;
        if (yieldDir) c.cool = Math.min(c.cool, 0.2);
        if (c.changeT < 0 && c.signalT <= 0 && c.cool <= 0) {
          c.cool = 0.4 + r.next() * 0.5;
          const must = this.mustMove(c, yieldDir);
          let target = -1;
          if (must !== 0) {
            const t = c.lane + must;
            if (this.laneClear(p, t, c.s, 10, 16, c)) target = t;
          } else if (r.next() < 0.35) {
            c.cool = 1.5 + r.next() * 3;
            const n = Math.floor(p.lanes(c.s) + 0.4);
            if (gap < 70 && lv < c.vDes - 2.5) {
              for (const t of r.next() < 0.7 ? [c.lane - 1, c.lane + 1] : [c.lane + 1, c.lane - 1]) {
                if (t < 0 || t >= n || !p.laneOpen(t, c.s + 200)) continue;
                if (p.children && p.length - c.s < 800 && (t < p.split) !== (c.prefer === 0)) continue;
                if (this.laneClear(p, t, c.s, 22, 34, c)) {
                  target = t;
                  break;
                }
              }
            } else if (c.lane < n - 1 && r.next() < 0.2 && c.vDes < (LANE_SPEED[c.lane] ?? 21) - 1 && p.laneOpen(c.lane + 1, c.s + 200) && this.laneClear(p, c.lane + 1, c.s, 30, 60, c)) {
              if (!(p.children && p.length - c.s < 800 && c.lane + 1 >= p.split && c.prefer === 0)) target = c.lane + 1;
            }
          }
          if (target >= 0) this.startChange(c, target);
        }
      }
      // the move across
      let latV = c.slideV;
      if (c.signalT > 0) {
        c.signalT -= dt;
        if (c.signalT <= 0) c.changeT = 0;
      } else if (c.changeT >= 0 && !c.crashed) {
        c.changeT += dt;
        const k = Math.min(1, c.changeT / CHANGE_T);
        const nl = c.fromLat + (laneLat(c.lane) - c.fromLat) * smooth(k);
        latV += (nl - c.lat) / dt;
        c.lat = nl;
        if (k >= 1) {
          c.changeT = -1;
          c.blink = 0;
        }
      }
      if (c.crashed) {
        c.spin += c.spinV * dt;
        c.spinV *= Math.exp(-2.2 * dt);
        c.lat = clamp(c.lat + c.slideV * dt, 0.6, p.rightEdge(c.s) + 1.8);
        c.slideV *= Math.exp(-2.5 * dt);
      }
      c.v = Math.max(0, c.v + c.acc * dt);
      c.s += c.v * dt;
      c.wheelRot += (c.v * dt) / VEHICLES[c.type].wheelRadius;
      // into a branch at the end of the path
      if (c.s >= p.length) {
        if (!p.children) {
          c.s = p.length;
          c.v = 0;
        } else {
          const right = c.lane >= p.split;
          const child = p.children[right ? 1 : 0];
          c.s -= p.length;
          c.lat -= child.offset;
          c.fromLat -= child.offset;
          if (right) c.lane -= p.split;
          c.path = child;
        }
      }
      const pose = c.path.pose(c.s, c.lat);
      c.x = pose.x;
      c.z = pose.z;
      const turn = c.v > 1 ? Math.atan(clamp((c.crashed ? 0 : latV) / c.v, -0.3, 0.3)) : 0;
      c.yaw = pose.h - turn + c.spin;
    }
  }

  /**
   * The other direction: it follows the car ahead in its lane, and downtown (where you can get
   * across to it) it also brakes for whatever is in its lane coming the other way, you included.
   */
  private oncomingStep(c: HCar, dt: number) {
    const p = c.path;
    const street = c.s > 0 && p.street(c.s);
    if (c.crashed) {
      c.acc = -7;
      c.spin += c.spinV * dt;
      c.spinV *= Math.exp(-2.2 * dt);
    } else {
      let gap = Infinity;
      let lv = 0;
      for (const o of this.cars) {
        if (o === c || !o.oncoming || o.path !== p || o.lane !== c.lane) continue;
        const d = c.s - o.s;
        if (d <= 0 || d > 220) continue;
        const g = d - (o.len + c.len) / 2;
        if (g < gap) {
          gap = g;
          lv = o.v;
        }
      }
      const ol = street ? p.oncomingLat(c.lane, c.s) : null;
      if (ol !== null) {
        for (const dr of this.drivers) {
          const d = aheadOf(dr.path, dr.s, p, c.s);
          const dl = latBetween(dr.lat, dr.path, p);
          if (d === null || dl === null || d < -2 || d > 200) continue;
          if (Math.abs(dl - ol) > (dr.width + c.width) / 2 + 0.4) continue;
          const g = d - (dr.len + c.len) / 2;
          if (g < gap) {
            gap = g;
            // something coming at it is as good as a wall
            lv = Math.max(0, -dr.v);
          }
        }
        // traffic going our way that ended up in its lane (a crash)
        for (const o of this.cars) {
          if (o.oncoming || !o.crashed) continue;
          const d = aheadOf(o.path, o.s, p, c.s);
          const lat = latBetween(o.lat, o.path, p);
          if (d === null || lat === null || d < -2 || d > 120 || Math.abs(lat - ol) > 2.4) continue;
          gap = Math.min(gap, d - (o.len + c.len) / 2);
          lv = 0;
        }
      }
      const vDes = street ? Math.min(c.vDes, 12.5 + (c.id % 5) * 0.7) : c.vDes;
      const a = 2.2;
      const b = 3.5;
      let acc = a * (1 - (c.v / vDes) ** 4);
      if (gap < 250) {
        const ss = 4 + Math.max(0, c.v * 1.1 + (c.v * (c.v - lv)) / (2 * Math.sqrt(a * b)));
        acc -= a * (ss / Math.max(0.5, gap)) ** 2;
      }
      c.acc = clamp(acc, -9, a);
    }
    c.v = Math.max(0, c.v + c.acc * dt);
    c.s -= c.v * dt;
    c.wheelRot += (c.v * dt) / VEHICLES[c.type].wheelRadius;
    if (c.s > 0) this.place(c);
  }

  /** keep the road ahead of you busy and let go of cars well behind (call a few times a second) */
  manage(dt: number, you: Driver, youX: number, youZ: number) {
    this.cars = this.cars.filter((c) => {
      const d = aheadOf(you.path, you.s, c.path, c.s);
      const far = Math.hypot(c.x - youX, c.z - youZ);
      const keep = c.oncoming ? (d === null ? far < 450 : d > -320 && d < 1100 && c.s > 0) : d === null ? far < 450 && !c.path.abandoned : d > -260 && d < 1100;
      return keep;
    });
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 0.25;
    const r = this.rng;
    // ours: how many ahead, against how busy it should be here
    let ahead = 0;
    let oncoming = 0;
    for (const c of this.cars) {
      const d = aheadOf(you.path, you.s, c.path, c.s);
      if (d === null || d < 30) continue;
      if (c.oncoming) oncoming++;
      else ahead++;
    }
    const zone = ZONES[you.path.pieceAt(you.s).zone];
    const want = Math.min(40, Math.round((15 + this.travelled / 450) * zone.traffic));
    if (ahead < want) {
      const at = this.along(you.path, you.s + r.range(520, 780));
      if (at) {
        const n = Math.floor(at.path.lanes(at.s) + 0.4);
        this.spawn(at.path, at.s, Math.floor(r.next() * n));
      }
    }
    if (oncoming < 18) {
      const at = this.along(you.path, you.s + r.range(650, 900), true);
      if (at && at.path.companionGap(at.s) !== null && at.path.companionGap(at.s)! < 150) this.spawn(at.path, at.s, Math.floor(r.next() * at.path.compLanes), true);
    }
  }

  /** the point `s` metres along from a path's start, following branches (busier ones more often) */
  along(path: Path, s: number, sameOnly = false): { path: Path; s: number } | null {
    let p = path;
    while (s > p.length) {
      if (!p.children || sameOnly) return null;
      const [a, b] = p.children;
      if (a.abandoned) p = b;
      else if (b.abandoned) p = a;
      else {
        const ta = ZONES[a.plan.zone].traffic;
        const tb = ZONES[b.plan.zone].traffic;
        p = this.rng.next() < ta / (ta + tb) ? a : b;
      }
      s -= p.parent!.length;
    }
    return { path: p, s };
  }

  /** fill the road at the start of a drive (nothing right round you) */
  fill(you: Driver) {
    for (let i = 0; i < 80; i++) {
      const at = this.along(you.path, you.s + 90 + this.rng.next() * 650);
      if (at) this.spawn(at.path, at.s, Math.floor(this.rng.next() * Math.floor(at.path.lanes(at.s) + 0.4)));
    }
    for (let i = 0; i < 30; i++) {
      const at = this.along(you.path, you.s - 200 + this.rng.next() * 1000, true);
      if (at) this.spawn(at.path, at.s, Math.floor(this.rng.next() * at.path.compLanes), true);
    }
  }

  /** you hit it: it skids to a stop with its hazards on, in your way */
  crash(c: HCar, fromLat: number, impact: number) {
    if (c.crashed) return;
    c.crashed = true;
    c.changeT = -1;
    c.signalT = 0;
    c.blink = 0;
    const away = Math.sign(c.lat - fromLat) || 1;
    c.slideV = away * Math.min(4, 1 + impact * 0.2);
    c.spinV = (this.rng.next() < 0.5 ? -1 : 1) * Math.min(1.6, 0.4 + impact * 0.08);
  }

  /** the car right ahead of you in your lane, for the slipstream: gap in metres, or null */
  leaderOf(you: Driver): number | null {
    let best: number | null = null;
    for (const o of this.cars) {
      if (o.oncoming || o.crashed) continue;
      const d = aheadOf(you.path, you.s, o.path, o.s);
      if (d === null || d <= 0 || d > 30) continue;
      const ol = latBetween(o.lat, o.path, you.path);
      if (ol === null || Math.abs(ol - you.lat) > 1.1) continue;
      const g = d - (o.len + you.len) / 2;
      if (best === null || g < best) best = g;
    }
    return best;
  }
}
