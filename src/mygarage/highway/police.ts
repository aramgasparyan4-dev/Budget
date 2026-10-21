// How a police car drives in the chase. Pure logic (no rendering or physics) so it can be tested.
//
// It drives along the road like a person would: pure pursuit toward a point ahead in the lane it
// has picked, braking for corners from the road's own curvature, and for whatever is in its way.
// It picks its lane by how much free road each one has, downtown the other direction's lanes
// included (for a police car with its lights on, that is allowed). Behind you it closes in fast;
// close up it aims at your back corner to spin you, drops back a little after each hit and comes
// again, and in front of you it brakes in your path.
// Stuck against something, it backs off and tries again; stuck for good, it says so.
import { Path, laneLat, latBetween, aheadOf } from './road';
import type { Driver, HCar } from './traffic';

export interface CopCar {
  x: number;
  z: number;
  yaw: number;
  /** forward m/s */
  speed: number;
  wheelBase: number;
  /** steering lock at this speed, radians */
  maxSteer: number;
}

export interface CopOutput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

/** something in the road, in the police car's road frame */
interface Thing {
  /** metres ahead (negative: behind) */
  d: number;
  lat: number;
  /** speed along the road (negative: coming the other way) */
  v: number;
  len: number;
  width: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** road curvature at s (1/m, positive to the left) */
export function curvature(p: Path, s: number) {
  const pc = p.pieceAt(s);
  return pc.k0 + ((pc.k1 - pc.k0) * clamp(s - pc.s0, 0, pc.len)) / pc.len;
}

/** sideways grip a police car corners on (m/s²) */
const A_LAT = 8;
const DECEL = 7;

/** the fastest it can go here and still make every corner within braking distance */
export function cornerLimit(p: Path, s: number, v: number, aLat = A_LAT) {
  let allow = Infinity;
  const reach = (v * v) / (2 * DECEL) + 25;
  for (let d = 0; d <= reach; d += 5) {
    const ss = s + d;
    if (ss > p.length) break;
    const k = Math.abs(curvature(p, ss));
    if (k < 1e-5) continue;
    const vmax = Math.sqrt(aLat / k);
    allow = Math.min(allow, Math.sqrt(vmax * vmax + 2 * DECEL * Math.max(0, d - 4)));
  }
  return allow;
}

export class CopDriver {
  /** where across the road it is heading for */
  tLat = laneLat(1);
  private laneHold = 0;
  private stuckT = 0;
  private reverseT = 0;
  /** seconds it has been unable to get anywhere: the chase gives up on it after a while */
  hopeless = 0;
  /** which side of you it goes for when it rams (it swaps after a hit) */
  pitSide: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  /** why it is going the speed it is (for debugging) */
  limit: 'chase' | 'corner' | 'follow' | 'stop' = 'chase';
  /** touching you: how long; and how long it backs off for after a hit */
  private contactT = 0;
  backoffT = 0;

  /**
   * One frame. `me` is where the car is on the road (from Highway.locate), `you` the car it is
   * after (null: hold position), `traffic` the cars around, `others` the other police.
   */
  update(dt: number, me: Driver, car: CopCar, you: Driver | null, traffic: HCar[], others: Driver[], top: number): CopOutput {
    const p = me.path;
    const street = p.street(me.s);
    const gap = street ? (p.companionGap(me.s) ?? 0.3) : null;
    const W = p.compLanes * 3.4;
    const minLat = street ? -(gap! + W) + 1.1 : 0.9;
    const maxLat = p.rightEdge(me.s) - 0.9;

    // --- what is in the road, in my frame
    const things: Thing[] = [];
    for (const c of traffic) {
      const d = aheadOf(p, me.s, c.path, c.s);
      if (d === null || d < -12 || d > 140) continue;
      let lat: number | null;
      let v = c.v;
      if (c.oncoming) {
        // only downtown is the other way within reach
        if (!street || !c.path.street(Math.max(0, c.s))) continue;
        const ol = c.path.oncomingLat(c.lane, c.s);
        lat = ol === null ? null : latBetween(ol, c.path, p);
        v = -c.v;
      } else lat = latBetween(c.lat, c.path, p);
      if (lat === null) continue;
      things.push({ d, lat, v, len: c.len, width: c.width });
    }
    for (const o of others) {
      if (o === me) continue;
      const d = aheadOf(p, me.s, o.path, o.s);
      const lat = latBetween(o.lat, o.path, p);
      if (d === null || lat === null || d < -8 || d > 100) continue;
      things.push({ d, lat, v: o.v, len: o.len, width: o.width });
    }
    // free road ahead in a corridor at `lat` (an oncoming car counts by where we would meet it)
    const vMe = Math.max(car.speed, 6);
    const free = (lat: number, half = 0) => {
      let best = 140;
      let lv = top;
      for (const t of things) {
        if (t.d < -1) continue;
        if (Math.abs(t.lat - lat) > (t.width + me.width) / 2 + 0.35 + half) continue;
        const raw = t.d - (t.len + me.len) / 2;
        const eff = t.v < -1 ? (raw * vMe) / (vMe - t.v) : raw;
        if (eff < best) {
          best = Math.max(0, eff);
          lv = Math.max(0, t.v);
        }
      }
      return { dist: best, v: lv };
    };

    // --- where it wants to be across the road
    const gapToYou = you ? aheadOf(p, me.s, you.path, you.s) : null;
    const yourLat = you ? latBetween(you.lat, you.path, p) : null;
    let want = this.tLat;
    const touching = (me.len + (you?.len ?? 4.6)) / 2 + 0.9;
    if (you && gapToYou !== null && yourLat !== null) {
      // a hit: hang back a moment, off to one side, then come again
      if (Math.abs(gapToYou) < touching && Math.abs(yourLat - me.lat) < 2.6) this.contactT += dt;
      else this.contactT = Math.max(0, this.contactT - dt);
      if (this.contactT > 0.45) {
        this.contactT = 0;
        this.backoffT = 1.4 + Math.random() * 1.6;
        this.pitSide = Math.random() < 0.5 ? 1 : -1;
      }
      if (this.backoffT > 0) {
        this.backoffT -= dt;
        want = yourLat + this.pitSide * 2.2;
      } else if (gapToYou > 0 && gapToYou < 16) want = yourLat + this.pitSide * 0.9; // the back corner
      else want = yourLat; // further back, or in front: right in your way
    }
    // the lanes it could use, and how much road each has
    const cands: number[] = [];
    const n = Math.floor(p.lanes(me.s) + 0.4);
    for (let i = 0; i < n; i++) if (p.laneOpen(i, me.s + 30)) cands.push(laneLat(i));
    if (street && gap !== null) for (let i = 0; i < p.compLanes; i++) cands.push(-(gap + laneLat(i)));
    this.laneHold -= dt;
    const direct = clamp(want, minLat, maxLat);
    const straight = free(direct);
    const closeIn = you && gapToYou !== null && gapToYou > 0 && gapToYou < 45 && straight.dist >= gapToYou - 8 && this.backoffT <= 0;
    if (closeIn) {
      // nothing between us: straight at you
      this.tLat = direct;
    } else if (this.laneHold <= 0 || free(this.tLat).dist < 30) {
      let best = this.tLat;
      let bestScore = -Infinity;
      for (const c of cands) {
        const f = free(c).dist;
        // the other direction's lanes only when ours are blocked and theirs are clear a long way
        const score = f - Math.abs(c - want) * 2.5 + (Math.abs(c - this.tLat) < 0.5 ? 8 : 0) - (c < 0 ? (f > 100 ? 40 : 200) : 0);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (Math.abs(best - this.tLat) > 0.5) this.laneHold = 1.1;
      this.tLat = best;
    }
    this.tLat = clamp(this.tLat, minLat, maxLat);

    // --- steering: pure pursuit toward a point ahead at that lateral position
    const look = clamp(7 + car.speed * 0.55, 9, 36);
    const tp = p.pose(Math.min(p.length, me.s + look), this.tLat);
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const dx = tp.x - car.x;
    const dz = tp.z - car.z;
    const fwd = dx * fx + dz * fz;
    const right = dx * -fz + dz * fx;
    const alpha = Math.atan2(-right, Math.max(0.5, fwd));
    const ld = Math.max(4, Math.hypot(dx, dz));
    const delta = Math.atan2(2 * car.wheelBase * Math.sin(alpha), ld);
    let steer = clamp(delta / Math.max(0.05, car.maxSteer), -1, 1);

    // --- speed
    let allow = top;
    this.limit = 'chase';
    if (!you) {
      allow = 0;
      this.limit = 'stop';
    } else if (gapToYou !== null) {
      // closing in from behind, quicker the further back; in front, it slows into your path
      if (this.backoffT > 0) allow = Math.min(top, Math.max(0, you.v + clamp((gapToYou - 13) * 0.5, -6, 4)));
      else if (gapToYou > 0) allow = Math.min(top, Math.max(0, you.v) + clamp(gapToYou * 0.18, 3, 30));
      else allow = Math.min(top, Math.max(5, you.v - 4));
    }
    const corner = cornerLimit(p, me.s, car.speed);
    if (corner < allow) {
      allow = corner;
      this.limit = 'corner';
    }
    // what is ahead where it is now and where it is going (it takes a moment to get across)
    const a1 = free(this.tLat, -0.2);
    const a2 = free(me.lat, -0.2);
    const ahead = a2.dist < a1.dist ? a2 : a1;
    // ramming you is the point: you are not something to brake for
    const isYou = closeIn && gapToYou !== null && ahead.dist >= gapToYou - (me.len + (you?.len ?? 4.5)) / 2 - 1;
    if (!isYou && ahead.dist < 140) {
      // stop in the room there is, allowing half a second to react (the car ahead may brake too)
      const T = 0.5;
      const v = -DECEL * T + Math.sqrt(DECEL * DECEL * T * T + ahead.v * ahead.v + 2 * DECEL * Math.max(0, ahead.dist - 6));
      if (v < allow) {
        allow = v;
        this.limit = 'follow';
      }
    }
    let throttle = 0;
    let brake = 0;
    if (car.speed > allow + 1.5) brake = clamp((car.speed - allow) / 5, 0.25, 1);
    else if (car.speed < allow - 0.5) throttle = clamp((allow - car.speed) / 3, 0.4, 1);

    // --- stuck against something: back off, steering the other way, then try again
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      return { throttle: 0, brake: car.speed > 1 ? 1 : 0.9, steer: -steer, handbrake: false };
    }
    const stuck = car.speed < 1 && allow > 3;
    this.stuckT = stuck ? this.stuckT + dt : Math.max(0, this.stuckT - dt);
    this.hopeless = stuck ? this.hopeless + dt : Math.max(0, this.hopeless - dt * 0.5);
    if (this.stuckT > 1.6) {
      this.stuckT = 0;
      this.reverseT = 1.3;
      this.laneHold = 0;
    }
    // facing the wrong way (spun out): turn hard toward the road
    if (fwd < 0) steer = Math.sign(-right) || 1;
    return { throttle, brake, steer, handbrake: false };
  }
}
