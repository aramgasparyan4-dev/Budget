// Race mode: a route through the street grid, progress along it, and the rival's driver.
// Route planning and progress are pure (no rendering) so they can be tested in Node.
import type { CityData } from '../world/types';
import { interId } from '../world/CityGenerator';
import { RNG } from '../core/rng';
import { clamp } from '../core/math';

/** grid directions: 0 = N (-z), 1 = E (+x), 2 = S (+z), 3 = W (-x) */
const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface Checkpoint {
  x: number;
  z: number;
  s: number; // distance along the route
  dir: [number, number]; // direction of travel through it
  finish: boolean;
}

export interface RoutePoint {
  x: number;
  z: number;
}

/** A polyline through the city with the distance along it. */
export class Route {
  readonly s: number[] = [];
  readonly length: number;
  constructor(
    readonly pts: RoutePoint[],
    readonly checkpoints: Checkpoint[],
    /** road half-width at each checkpoint (for gates) */
    readonly widths: number[],
    /** lanes per direction on each leg (polyline segment) */
    readonly legLanes: number[] = [],
  ) {
    let acc = 0;
    this.s.push(0);
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      this.s.push(acc);
    }
    this.length = acc;
  }

  /** point and unit direction at distance s */
  at(s: number): { x: number; z: number; dx: number; dz: number; seg: number } {
    s = clamp(s, 0, this.length);
    let i = 1;
    while (i < this.pts.length - 1 && this.s[i] < s) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const L = this.s[i] - this.s[i - 1] || 1;
    const t = (s - this.s[i - 1]) / L;
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      dx: (b.x - a.x) / L,
      dz: (b.z - a.z) / L,
      seg: i - 1,
    };
  }

  /**
   * Distance along the route of the point nearest to (x, z), searching segments near `hint`
   * (progress only moves forward a little at a time, which also stops a car being credited for a
   * stretch of route it is merely close to).
   */
  project(x: number, z: number, hint = 0): { s: number; lat: number; dist: number } {
    let best = { s: 0, lat: 0, dist: Infinity };
    let i0 = 0;
    while (i0 < this.pts.length - 2 && this.s[i0 + 1] < hint - 60) i0++;
    for (let i = i0; i < this.pts.length - 1; i++) {
      if (this.s[i] > hint + 260) break;
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const L = this.s[i + 1] - this.s[i] || 1;
      const dx = (b.x - a.x) / L;
      const dz = (b.z - a.z) / L;
      const t = clamp((x - a.x) * dx + (z - a.z) * dz, 0, L);
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best.dist) {
        // lateral: positive = right of travel (right of (dx, dz) is (-dz, dx))
        best = {
          s: this.s[i] + t,
          lat: (x - px) * -dz + (z - pz) * dx,
          dist: d,
        };
      }
    }
    return best;
  }

  /** lanes per direction on the leg at distance s */
  lanesAt(s: number): number {
    return this.legLanes[this.at(s).seg] ?? 1;
  }

  /** the next corner (direction change) after distance s: its distance along the route and turn angle */
  nextCorner(s: number): { s: number; angle: number } | null {
    for (let i = 1; i < this.pts.length - 1; i++) {
      if (this.s[i] <= s) continue;
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const c = this.pts[i + 1];
      const a1 = Math.atan2(b.x - a.x, b.z - a.z);
      const a2 = Math.atan2(c.x - b.x, c.z - b.z);
      let d = Math.abs(a2 - a1);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.2) return { s: this.s[i], angle: d };
    }
    return null;
  }
}

/**
 * Plan a route of about `target` metres through existing streets: straight legs of 2-5 blocks
 * joined by left and right turns, never crossing itself, staying a block in from the edge.
 */
export function planRoute(city: CityData, seed: number, target = 1700): Route {
  const rng = new RNG(seed);
  const n = city.n;
  const at = (i: number, j: number) => city.intersections[interId(city, i, j)];
  const segOk = (it: { arms: number[] }, d: number) => {
    const sid = it.arms[d];
    return sid >= 0 && city.segments[sid].exists;
  };
  for (let attempt = 0; attempt < 400; attempt++) {
    let i = 1 + Math.floor(rng.next() * (n - 1));
    let j = 1 + Math.floor(rng.next() * (n - 1));
    let dir = Math.floor(rng.next() * 4);
    // start on an avenue or boulevard so two cars fit side by side on the grid
    const s0 = at(i, j).arms[dir];
    if (s0 < 0 || city.segments[s0].lanesPerDir < 2) continue;
    const path: { i: number; j: number }[] = [{ i, j }];
    const dirs: number[] = [];
    const seen = new Set([`${i},${j}`]);
    let len = 0;
    let ok = true;
    let legs = 0;
    while (len < target) {
      const blocks = 2 + Math.floor(rng.next() * 4);
      let moved = 0;
      for (let b = 0; b < blocks; b++) {
        const it = at(i, j);
        if (!segOk(it, dir)) break;
        const ni = i + DIRS[dir][0];
        const nj = j + DIRS[dir][1];
        // stay off the outer ring of the grid and never revisit
        if (ni < 1 || nj < 1 || ni > n - 1 || nj > n - 1 || seen.has(`${ni},${nj}`)) break;
        const a = at(i, j);
        const c = at(ni, nj);
        len += Math.hypot(c.x - a.x, c.z - a.z);
        i = ni;
        j = nj;
        seen.add(`${i},${j}`);
        path.push({ i, j });
        dirs.push(dir);
        moved++;
      }
      if (moved === 0) {
        ok = false;
        break;
      }
      legs++;
      if (len >= target) break;
      // turn left or right, whichever is open
      const turns = rng.next() < 0.5 ? [(dir + 1) % 4, (dir + 3) % 4] : [(dir + 3) % 4, (dir + 1) % 4];
      const next = turns.find((d) => {
        const ni = i + DIRS[d][0];
        const nj = j + DIRS[d][1];
        return segOk(at(i, j), d) && ni >= 1 && nj >= 1 && ni <= n - 1 && nj <= n - 1 && !seen.has(`${ni},${nj}`);
      });
      if (next === undefined) {
        ok = false;
        break;
      }
      dir = next;
    }
    if (!ok || len < target * 0.8 || legs < 3 || path.length < 4) continue;
    return buildRoute(city, path, dirs);
  }
  throw new Error('no route found');
}

function buildRoute(city: CityData, path: { i: number; j: number }[], dirs: number[]): Route {
  const at = (p: { i: number; j: number }) => city.intersections[interId(city, p.i, p.j)];
  const first = at(path[0]);
  const d0 = DIRS[dirs[0]];
  const lastI = at(path[path.length - 2]);
  const dl = DIRS[dirs[dirs.length - 1]];
  // start 25 m into the first block; finish halfway along the final block
  const start = { x: first.x + d0[0] * 25, z: first.z + d0[1] * 25 };
  const end = at(path[path.length - 1]);
  const finish = { x: (lastI.x + end.x) / 2, z: (lastI.z + end.z) / 2 };
  const pts: RoutePoint[] = [start];
  const legLanes: number[] = [city.segments[first.arms[dirs[0]]].lanesPerDir];
  for (let k = 1; k < path.length - 1; k++) {
    // keep corners only: straight-through intersections add nothing to the line
    const turn = dirs[k] !== dirs[k - 1];
    if (turn) {
      const it = at(path[k]);
      pts.push({ x: it.x, z: it.z });
      legLanes.push(city.segments[it.arms[dirs[k]]].lanesPerDir);
    }
  }
  pts.push(finish);
  // checkpoints: every corner, every second straight-through intersection, and the finish
  const cps: Checkpoint[] = [];
  const widths: number[] = [];
  const tmp = new Route(pts, [], []);
  let sinceLast = 0;
  for (let k = 1; k < path.length - 1; k++) {
    const turn = dirs[k] !== dirs[k - 1];
    sinceLast++;
    if (!turn && sinceLast < 2) continue;
    sinceLast = 0;
    // the gate stands just past the intersection (and its crosswalk), across the street we leave on
    const it = at(path[k]);
    const d = DIRS[dirs[k]];
    const h = (d[0] !== 0 ? it.hx : it.hz) + 5;
    cps.push({
      x: it.x + d[0] * h,
      z: it.z + d[1] * h,
      s: 0,
      dir: d,
      finish: false,
    });
    widths.push(city.segments[it.arms[dirs[k]]].hw);
  }
  cps.push({ x: finish.x, z: finish.z, s: tmp.length, dir: dl, finish: true });
  const seg = city.segments[lastI.arms[dirs[dirs.length - 1]]];
  widths.push(seg ? seg.hw : 7);
  // project() searches forward from a hint; recompute s for checkpoints with a sweeping hint
  let hint = 0;
  for (const c of cps) {
    if (!c.finish) c.s = tmp.project(c.x, c.z, hint).s;
    hint = c.s;
  }
  return new Route(pts, cps, widths, legLanes);
}

// ------------------------------------------------------------------ rival driver

export interface DriverCar {
  x: number;
  z: number;
  yaw: number;
  speed: number; // forward m/s
  wheelBase: number;
  maxSteer: number; // at the current speed, radians
  grip: number;
}

export interface Obstacle {
  x: number;
  z: number;
  v: number; // speed along its own heading
  yaw: number;
}

export interface DriverOutput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

/** lane centres right of the route line: own side first, then the oncoming side for overtaking */
const LANES_ARTERIAL = [2.25, 5.75, -2.25, -5.75];
const LANES_LOCAL = [1.75, -1.75];
export function laneSet(lanesPerDir: number): number[] {
  return lanesPerDir > 1 ? LANES_ARTERIAL : LANES_LOCAL;
}
/** the lane in `set` nearest to `lane` on the same side of the road */
function sameSide(set: number[], lane: number): number {
  let best = set[0];
  for (const o of set) if (Math.sign(o) === Math.sign(lane) && Math.abs(o - lane) < Math.abs(best - lane)) best = o;
  return best;
}

/**
 * Drives a car along a Route: pure pursuit on the chosen lane, braking for corners from a speed
 * profile, for traffic it cannot get round and for cars about to cross its path, and switching
 * lanes (including into oncoming lanes on straights) to overtake.
 */
export class RivalDriver {
  s = 0;
  lane = LANES_ARTERIAL[0];
  private laneHold = 0;
  private leg = -1;
  stuckT = 0;
  /** seconds of "dazed" after a big hit: brakes, then carries on */
  stunT = 0;
  /** 0.85 easy .. 1.05 hard: scales top speed and corner speed */
  skill = 0.95;
  /** hard speed limit in m/s (the race eases a rival that is far ahead) */
  cap = Infinity;
  /** why the last update limited speed (for debugging) */
  limit: 'top' | 'corner' | 'follow' | 'cross' = 'top';
  private reverseT = 0;
  private waitT = 0;
  private banLane = 0;
  private banT = 0;

  constructor(public route: Route) {}

  /** forget everything after the car was put back on the route at distance s in `lane` */
  reset(s: number, lane: number) {
    this.s = s;
    this.lane = lane;
    this.leg = -1;
    this.stuckT = this.waitT = this.reverseT = this.banT = this.stunT = 0;
    this.laneHold = 1;
  }

  update(dt: number, car: DriverCar, obstacles: Obstacle[]): DriverOutput {
    const r = this.route;
    const p = r.project(car.x, car.z, this.s);
    if (p.s > this.s) this.s = p.s;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.stuckT = 0;
      return { throttle: 0, brake: 1, steer: 0, handbrake: false };
    }

    const here = r.at(this.s);
    const set = laneSet(r.legLanes[here.seg] ?? 1);
    if (here.seg !== this.leg) {
      // new leg (or first call): keep to the same side, on a lane this road has
      this.leg = here.seg;
      this.lane = sameSide(set, this.lane);
    }
    const corner = r.nextCorner(this.s);
    const toCorner = corner ? corner.s - this.s : Infinity;

    // --- lane choice: the lane with the most free road ahead
    const rx = -here.dz;
    const rz = here.dx;
    const free = set.map(() => 90);
    // what is ahead where the car actually is (it may still be moving over to its new lane)
    const carLat = p.lat;
    let freeCar = 90;
    let blockSpeed = Infinity;
    for (const o of obstacles) {
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      const lon = dx * here.dx + dz * here.dz;
      if (lon < -4 || lon > 90) continue;
      const lat = (o.x - here.x) * rx + (o.z - here.z) * rz;
      const ov = o.v * (Math.sin(o.yaw) * here.dx + Math.cos(o.yaw) * here.dz);
      // an oncoming car closes the gap from both ends: count it by when we would meet
      const v = Math.max(car.speed, 6);
      const eff = ov < -1 ? (lon * v) / (v - ov) : lon;
      set.forEach((off, k) => {
        if (Math.abs(lat - off) < 2.4 && eff < free[k]) free[k] = Math.max(0, eff);
      });
      const inLane = Math.abs(lat - this.lane) < 2.4;
      const inPath = lon > 0 && Math.abs(lat - carLat) < 2.3;
      if (inPath && lon < freeCar) freeCar = lon;
      if ((inLane || inPath) && lon > 0 && lon < 45) blockSpeed = Math.min(blockSpeed, ov);
    }
    this.laneHold -= dt;
    if (this.laneHold <= 0 && toCorner > 14) {
      let best = set.indexOf(this.lane);
      let bestScore = -Infinity;
      set.forEach((off, k) => {
        // stay put unless another lane is clearly better; keep right; leave oncoming lanes well before a corner
        const score = free[k] + (off === this.lane ? 10 : 0) + (off > 0 ? 6 : toCorner < 40 ? -60 : 0) + (this.banT > 0 && off === this.banLane ? -200 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = k;
        }
      });
      if (set[best] !== this.lane) {
        this.lane = set[best];
        this.laneHold = 1.2;
      }
    }

    // --- steering: pure pursuit toward a point ahead on the chosen lane
    const look = clamp(6 + car.speed * 0.5, 7, 30);
    const tp = r.at(this.s + look);
    let laneT = tp.seg === here.seg ? this.lane : sameSide(laneSet(r.legLanes[tp.seg] ?? 1), this.lane);
    if (toCorner < 18) laneT *= 0.6; // tighten up through corners
    const tx = tp.x - tp.dz * laneT;
    const tz = tp.z + tp.dx * laneT;
    const dx = tx - car.x;
    const dz = tz - car.z;
    const fwd = dx * fx + dz * fz;
    const right = dx * -fz + dz * fx;
    const alpha = Math.atan2(-right, Math.max(0.5, fwd)); // positive: target to the left
    const ld = Math.max(4, Math.hypot(dx, dz));
    const delta = Math.atan2(2 * car.wheelBase * Math.sin(alpha), ld);
    const steer = clamp(delta / Math.max(0.05, car.maxSteer), -1, 1);

    // --- speed: brake for the next corner, for traffic we cannot get round, and for crossing cars
    const top = Math.min(60 * this.skill, this.cap);
    const decel = 6.5;
    let allow = top;
    this.limit = 'top';
    if (corner) {
      const cornerV = (corner.angle > 1.2 ? 12 : 17) * this.skill * Math.sqrt(car.grip / 2.6);
      const v = Math.sqrt(cornerV * cornerV + 2 * decel * Math.max(0, toCorner - 8));
      if (v < allow) {
        allow = v;
        this.limit = 'corner';
      }
    }
    const ahead = Math.min(free[set.indexOf(this.lane)], freeCar);
    if (ahead < 90) {
      const gap = ahead - 6.5;
      const follow = Math.max(0, isFinite(blockSpeed) ? blockSpeed : 0);
      const v = Math.sqrt(follow * follow + 2 * decel * Math.max(0, gap));
      if (v < allow) {
        allow = v;
        this.limit = 'follow';
      }
    }
    const cross = this.crossing(car, obstacles);
    if (cross < Infinity) {
      const v = Math.sqrt(2 * decel * Math.max(0, cross - 5));
      if (v < allow) {
        allow = v;
        this.limit = 'cross';
      }
    }
    let throttle = 0;
    let brake = 0;
    if (car.speed > allow + 1.5) brake = clamp((car.speed - allow) / 5, 0.25, 1);
    else if (car.speed < allow - 0.5) throttle = clamp((allow - car.speed) / 3, 0.35, 1);

    // --- held up by something close that is not moving (a car stopped across the road, an oncoming
    // car that stopped for us, a long queue): try another lane, backing up first if we are nose to
    // nose; if that does not work either, report stuck and the game puts the car back on the route
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      this.stuckT += dt * 0.5;
      return {
        throttle: 0,
        brake: car.speed > 1 ? 1 : 0.8,
        steer: -steer,
        handbrake: false,
      };
    }
    const held = car.speed < 1 && throttle === 0 && ahead < 14 && (this.limit === 'follow' || this.limit === 'cross');
    if (held) this.waitT += dt;
    else if (car.speed > 3) this.waitT = 0;
    if (held && this.waitT > 2.5 && this.banT <= 0) {
      this.banLane = this.lane;
      this.banT = 5;
      this.laneHold = 0;
      if (ahead < 7.5) this.reverseT = 1.2;
    }
    this.banT -= dt;

    if ((car.speed < 1.2 && throttle > 0) || this.waitT > 4) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt * 2);

    return { throttle, brake, steer, handbrake: false };
  }

  /**
   * Distance we would cover before meeting a car that is about to cross or cut into our path
   * (both extrapolated over the next 2.4 s), or Infinity. Cars ahead going our way are left to
   * the follow logic.
   */
  private crossing(car: DriverCar, obstacles: Obstacle[]): number {
    const r = this.route;
    const v = Math.max(car.speed, 4);
    const here = r.at(this.s);
    let best = Infinity;
    for (const o of obstacles) {
      const ox = o.x - car.x;
      const oz = o.z - car.z;
      if (ox * ox + oz * oz > 70 * 70) continue;
      const ofx = Math.sin(o.yaw);
      const ofz = Math.cos(o.yaw);
      // same direction and in our lane: following, not crossing
      const lat = (o.x - here.x) * -here.dz + (o.z - here.z) * here.dx;
      if (ofx * here.dx + ofz * here.dz > 0.7 && Math.abs(lat - this.lane) < 2.4) continue;
      for (let t = 0.25; t <= 2.4; t += 0.25) {
        const d = v * t;
        const m = r.at(this.s + d);
        const mx = m.x - m.dz * this.lane;
        const mz = m.z + m.dx * this.lane;
        const px = o.x + ofx * o.v * t;
        const pz = o.z + ofz * o.v * t;
        if ((mx - px) ** 2 + (mz - pz) ** 2 < 2.6 * 2.6) {
          if (d < best) best = d;
          break;
        }
      }
    }
    return best;
  }
}

/**
 * Where to put a car back on the route: the first spot at or after distance s, on its own side of
 * the road, with nothing within `clear` metres (so it does not land in the queue it was stuck in).
 */
export function freeSpot(route: Route, s: number, obstacles: { x: number; z: number }[], clear = 9): { s: number; lane: number; x: number; z: number; yaw: number } {
  const end = route.length - 10;
  for (let d = s; d < end; d += 4) {
    const p = route.at(d);
    for (const lane of laneSet(route.lanesAt(d)).filter((l) => l > 0)) {
      const x = p.x - p.dz * lane;
      const z = p.z + p.dx * lane;
      if (obstacles.every((o) => (o.x - x) ** 2 + (o.z - z) ** 2 > clear * clear)) return { s: d, lane, x, z, yaw: Math.atan2(p.dx, p.dz) };
    }
  }
  const p = route.at(s);
  const lane = laneSet(route.lanesAt(s))[0];
  return {
    s,
    lane,
    x: p.x - p.dz * lane,
    z: p.z + p.dx * lane,
    yaw: Math.atan2(p.dx, p.dz),
  };
}

/**
 * Traffic for a race: light. About 30 cars round you at the game's rush-hour clock (it was about
 * 95), so there is something to weave past without a car at every corner. They appear at least
 * 90 m away, never right in front of you.
 */
export const RACE_TRAFFIC = {
  maxVehicles: 25,
  spawnInterval: 0.08,
  spawnAttempts: 16,
  spawnRadius: { min: 90, max: 260, despawn: 300 },
};

/**
 * A car's progress through a race: distance along the route and the next checkpoint. Progress only
 * counts while the car is on the route, and stops at a checkpoint it has not been through yet, so a
 * shortcut down another street gains nothing.
 */
export class Progress {
  s = 0;
  next = 0;
  finished = false;
  /** metres from the route line (Infinity before the first update) */
  off = Infinity;
  /** heading against the route */
  wrongWay = false;

  constructor(readonly route: Route) {}

  get checkpoint(): Checkpoint | null {
    return this.route.checkpoints[this.next] ?? null;
  }

  /** returns the index of a checkpoint passed by this update, or -1 */
  update(x: number, z: number, yaw: number, speed: number): number {
    if (this.finished) return -1;
    const r = this.route;
    const p = r.project(x, z, this.s);
    this.off = p.dist;
    const here = r.at(p.s);
    this.wrongWay = speed > 4 && Math.sin(yaw) * here.dx + Math.cos(yaw) * here.dz < -0.5;
    if (p.dist > 18) return -1;
    const cp = r.checkpoints[this.next];
    this.s = Math.min(p.s, cp.s + 1);
    if (p.s >= cp.s - 1.5 && p.dist < r.widths[this.next] + 6) {
      this.next++;
      if (cp.finish) this.finished = true;
      return this.next - 1;
    }
    return -1;
  }
}

/** 1 if a is ahead of b, -1 if behind (finished cars by finishing order, given as times) */
export function compareProgress(a: Progress, b: Progress, aTime: number | null, bTime: number | null): number {
  if (aTime !== null || bTime !== null) {
    if (aTime === null) return -1;
    if (bTime === null) return 1;
    return aTime <= bTime ? 1 : -1;
  }
  return a.s >= b.s ? 1 : -1;
}
