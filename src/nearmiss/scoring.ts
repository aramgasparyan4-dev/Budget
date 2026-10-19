// Near Miss scoring rules. Pure logic (no rendering, physics or DOM) so it can be tested in Node.
//
// A run lives on a draining clock. Risky driving refills it and builds a combo:
//  - near miss: passing a car with less than 1.7 m of side clearance, faster than it, without touching
//  - oncoming lane: driving against traffic
//  - drift: a slide held for a while, scored by angle, speed and length; passes made mid-drift count 1.5x
// Every event raises the combo multiplier. The combo banks into the score after a few quiet seconds;
// a scrape loses whatever is unbanked, and a big hit ends the run.

export interface CarState {
  x: number;
  z: number;
  yaw: number; // forward = (sin yaw, cos yaw)
  vx: number;
  vz: number;
  width: number;
  length: number;
}

export interface OtherCar {
  id: number;
  x: number;
  z: number;
  yaw: number;
  v: number; // speed along its heading
  width: number;
  length: number;
}

export interface DriveContext {
  oncoming: boolean; // in a lane against traffic
  drift: { active: boolean; angle: number }; // angle: degrees between nose and travel
  boosting: boolean;
  dt: number;
}

export type EventKind = 'near' | 'drift' | 'bank' | 'lost' | 'scrape' | 'bonus';

export interface ScoreEvent {
  kind: EventKind;
  label: string;
  sub?: string;
  points: number;
  tier?: 1 | 2 | 3; // near miss closeness
}

export const RULES = {
  startTime: 40,
  maxTime: 60,
  comboWindow: 4, // seconds without an event before the combo banks
  maxMult: 10,
  nearGap: 1.7, // metres of side clearance that still count (a lane-centred pass in the next lane is ~1.6)
  closeGap: 0.9,
  insaneGap: 0.4,
  minSpeed: 12, // m/s (43 km/h) for anything to count
  minRelSpeed: 6,
  boostDrain: 0.24, // per second
  boostMul: 1.5,
  scrapeTimePenalty: 3,
  wreckImpact: 11, // velocity change (m/s) that ends the run
  scrapeImpact: 4.5,
  minDrift: 0.6, // seconds a slide must last to count as a drift
  driftRate: 90, // points per second at 25 degrees and standing speed factor
  driftPassMul: 1.5,
};

interface Track {
  entryLon: number;
  minGap: number;
  touched: boolean;
  lastSeen: number;
}

export class Scorer {
  score = 0;
  comboPoints = 0;
  mult = 1;
  comboCount = 0;
  comboT = 0;
  boost = 0.35;
  time = RULES.startTime;
  elapsed = 0;
  over: null | 'wrecked' | 'time' = null;
  // stats
  nearMisses = 0;
  closest = Infinity;
  bestCombo = 0;
  bestBank = 0;
  topSpeed = 0;
  distance = 0;
  oncomingSec = 0;
  driftSec = 0;
  drifts = 0;
  bestDrift = 0;
  longestDrift = 0;
  // the drift in progress
  driftActive = false;
  driftPoints = 0;
  driftTime = 0;
  driftMax = 0;
  events: ScoreEvent[] = [];
  private tracks = new Map<number, Track>();
  private t = 0;

  /** the multiplier applies when the combo banks; boost multiplies points as they are earned */
  private addCombo(points: number, boosting: boolean, keepAlive = RULES.comboWindow) {
    this.comboPoints += points * (boosting ? RULES.boostMul : 1);
    this.comboT = Math.max(this.comboT, keepAlive);
  }

  private bump() {
    this.comboCount++;
    this.mult = Math.min(RULES.maxMult, 1 + this.comboCount);
    this.bestCombo = Math.max(this.bestCombo, this.mult);
  }

  update(car: CarState, others: OtherCar[], ctx: DriveContext) {
    if (this.over) return;
    const dt = ctx.dt;
    this.t += dt;
    this.elapsed += dt;
    const speed = Math.hypot(car.vx, car.vz);
    const kmh = speed * 3.6;
    this.topSpeed = Math.max(this.topSpeed, kmh);
    this.distance += speed * dt;
    const speedFactor = 1 + kmh / 120;

    // boost
    if (ctx.boosting && this.boost > 0) this.boost = Math.max(0, this.boost - RULES.boostDrain * dt);

    // continuous risk: oncoming lane
    if (speed > RULES.minSpeed && ctx.oncoming) {
      this.oncomingSec += dt;
      this.addCombo(70 * speedFactor * dt, ctx.boosting, 1.2);
      this.boost = Math.min(1, this.boost + 0.05 * dt);
      this.time = Math.min(RULES.maxTime, this.time + 0.4 * dt);
    }

    // drifting: points build while sliding (and are lost with the combo on a hit); the drift itself is
    // one event when it ends
    if (ctx.drift.active && speed > 8) {
      if (!this.driftActive) {
        this.driftActive = true;
        this.driftPoints = 0;
        this.driftTime = 0;
        this.driftMax = 0;
      }
      const a = Math.min(60, Math.abs(ctx.drift.angle));
      const pts = RULES.driftRate * (a / 25) * speedFactor * dt;
      this.driftPoints += pts * (ctx.boosting ? RULES.boostMul : 1);
      this.addCombo(pts, ctx.boosting, 1.5);
      this.driftTime += dt;
      this.driftSec += dt;
      this.driftMax = Math.max(this.driftMax, a);
      this.boost = Math.min(1, this.boost + 0.08 * (a / 25) * dt);
      this.time = Math.min(RULES.maxTime, this.time + 0.35 * dt);
    } else if (this.driftActive) this.endDrift();

    // near misses
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const rx = -fz;
    const rz = fx;
    for (const o of others) {
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      if (dx * dx + dz * dz > 30 * 30) continue;
      const lon = dx * fx + dz * fz;
      const lat = dx * rx + dz * rz;
      const rel = o.yaw - car.yaw;
      const c = Math.abs(Math.cos(rel));
      const sn = Math.abs(Math.sin(rel));
      const oHalfLat = (c * o.width + sn * o.length) / 2;
      const oHalfLon = (c * o.length + sn * o.width) / 2;
      const gap = Math.abs(lat) - car.width / 2 - oHalfLat;
      const alongside = Math.abs(lon) < car.length / 2 + oHalfLon + 0.5;
      let tr = this.tracks.get(o.id);
      if (alongside) {
        if (!tr) {
          tr = { entryLon: lon, minGap: gap, touched: false, lastSeen: this.t };
          this.tracks.set(o.id, tr);
        }
        tr.minGap = Math.min(tr.minGap, gap);
        tr.lastSeen = this.t;
        if (gap < 0.05) tr.touched = true;
      } else if (tr) {
        // left the side-by-side zone: did we actually pass it (entered on one end, left at the other)?
        this.tracks.delete(o.id);
        const passed = Math.sign(lon) !== Math.sign(tr.entryLon);
        const ovx = Math.sin(o.yaw) * o.v;
        const ovz = Math.cos(o.yaw) * o.v;
        const relSpeed = Math.hypot(car.vx - ovx, car.vz - ovz);
        if (passed && !tr.touched && tr.minGap < RULES.nearGap && speed > RULES.minSpeed && relSpeed > RULES.minRelSpeed) {
          this.nearMiss(tr.minGap, Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz, speedFactor, ctx.boosting);
        }
      }
    }
    for (const [id, tr] of this.tracks) if (this.t - tr.lastSeen > 1) this.tracks.delete(id);

    // combo banking
    if (this.comboPoints > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.bank();
    }

    // the clock
    this.time -= dt;
    if (this.time <= 0) {
      this.time = 0;
      this.end('time');
    }
  }

  private nearMiss(gap: number, headingDot: number, speedFactor: number, boosting: boolean) {
    const tier: 1 | 2 | 3 = gap < RULES.insaneGap ? 3 : gap < RULES.closeGap ? 2 : 1;
    const oncoming = headingDot < -0.5;
    const crossing = Math.abs(headingDot) <= 0.5;
    let pts = 100 * tier * speedFactor;
    if (oncoming) pts *= 2;
    else if (crossing) pts *= 1.5;
    if (this.driftActive) pts *= RULES.driftPassMul;
    pts = Math.round(pts / 10) * 10;
    this.bump();
    this.addCombo(pts, boosting);
    this.nearMisses++;
    this.closest = Math.min(this.closest, Math.max(0, gap));
    this.boost = Math.min(1, this.boost + 0.07 * tier);
    this.time = Math.min(RULES.maxTime, this.time + 1.5 * tier);
    const label = tier === 3 ? 'INSANE' : tier === 2 ? 'CLOSE CALL' : 'NEAR MISS';
    const parts = [oncoming ? 'ONCOMING' : crossing ? 'CROSS TRAFFIC' : '', this.driftActive ? 'DRIFTING' : ''].filter(Boolean);
    const sub = parts.length ? parts.join(' · ') : undefined;
    this.events.push({ kind: 'near', label, sub, points: Math.round(pts * (boosting ? RULES.boostMul : 1)), tier });
  }

  private endDrift() {
    this.driftActive = false;
    if (this.driftTime < RULES.minDrift) return;
    const pts = Math.round(this.driftPoints);
    this.drifts++;
    this.bestDrift = Math.max(this.bestDrift, pts);
    this.longestDrift = Math.max(this.longestDrift, this.driftTime);
    this.bump();
    this.comboT = Math.max(this.comboT, RULES.comboWindow);
    const label = this.driftMax >= 40 ? 'MASSIVE DRIFT' : this.driftMax >= 28 ? 'BIG DRIFT' : 'DRIFT';
    this.events.push({ kind: 'drift', label, sub: `${Math.round(this.driftMax)}° · ${this.driftTime.toFixed(1)} s`, points: pts });
  }

  /** a one-off bonus from the game layer (red light, etc.) */
  bonus(label: string, points: number, boosting: boolean) {
    if (this.over) return;
    this.bump();
    this.addCombo(points, boosting);
    this.time = Math.min(RULES.maxTime, this.time + 1);
    this.events.push({ kind: 'bonus', label, points });
  }

  bank() {
    if (this.comboPoints <= 0) return;
    const total = Math.round(this.comboPoints * this.mult);
    this.score += total;
    this.bestBank = Math.max(this.bestBank, total);
    this.events.push({ kind: 'bank', label: 'BANKED', sub: `x${this.mult}`, points: total });
    this.resetCombo();
  }

  private resetCombo() {
    this.comboPoints = 0;
    this.comboCount = 0;
    this.mult = 1;
    this.comboT = 0;
  }

  /** a collision; returns what it meant */
  impact(dv: number): 'none' | 'scrape' | 'wreck' {
    if (this.over) return 'none';
    if (dv >= RULES.wreckImpact) {
      this.end('wrecked');
      return 'wreck';
    }
    if (dv < RULES.scrapeImpact) return 'none';
    const lost = Math.round(this.comboPoints * this.mult);
    this.driftActive = false; // the drift's points went with the combo
    if (lost > 0) this.events.push({ kind: 'lost', label: 'COMBO LOST', points: -lost });
    else this.events.push({ kind: 'scrape', label: 'SCRAPE', points: 0 });
    this.resetCombo();
    this.boost = Math.max(0, this.boost - 0.2);
    this.time = Math.max(0, this.time - RULES.scrapeTimePenalty);
    return 'scrape';
  }

  /** mark a car as touched so passing it no longer counts */
  touched(id: number) {
    const tr = this.tracks.get(id);
    if (tr) tr.touched = true;
  }

  end(reason: 'wrecked' | 'time') {
    if (this.over) return;
    this.over = reason;
    // running out of time still banks the combo (a drift in progress counts); a wreck loses it
    if (reason === 'time') {
      if (this.driftActive) this.endDrift();
      this.bank();
    }
    else if (this.comboPoints > 0) {
      this.driftActive = false;
      this.events.push({ kind: 'lost', label: 'COMBO LOST', points: -Math.round(this.comboPoints * this.mult) });
      this.resetCombo();
    }
  }
}
