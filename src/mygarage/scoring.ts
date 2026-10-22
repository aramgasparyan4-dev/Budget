// Scoring rules. Pure logic (no rendering, physics or DOM) so it can be tested in Node.
//
// Risky driving builds a combo:
//  - near miss: passing a car close (under 1.15 m of side clearance on the chase road's wide lanes,
//    1.7 m in the city), faster than it, without touching
//  - oncoming lane: driving against traffic
//  - drift: a slide held for a while, scored by angle, speed and length; passes made mid-drift count 1.5x
// Every event raises the combo multiplier. The combo banks into the score after a few quiet seconds;
// a scrape loses whatever is unbanked. Hits also cost the car condition (0-100%): a big hit takes
// about half of an average car; tougher cars and body armour take less. Nothing is ever wrecked: a
// car at 0% keeps going, slower and smoking.
//
// A police chase has no clock: it ends when you reach the docks (escaped), are busted, or end it;
// time spent with the police on your tail scores on its own, more at higher heat. In a race a big hit
// stops the car for a moment; near misses and drifts still pop up and still fill the boost bar. Free
// drive scores nothing and takes no damage: the boost just fills up again by itself.

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

export type EventKind = 'near' | 'drift' | 'bank' | 'lost' | 'scrape' | 'bonus' | 'damage' | 'crash' | 'repair' | 'police';

export interface ScoreEvent {
  kind: EventKind;
  label: string;
  sub?: string;
  points: number;
  tier?: 1 | 2 | 3; // near miss closeness
}

export const RULES = {
  comboWindow: 4, // seconds without an event before the combo banks
  maxMult: 10,
  nearGap: 1.7, // metres of side clearance that still count (a lane-centred pass in the next lane is ~1.6)
  closeGap: 0.9,
  insaneGap: 0.4,
  minSpeed: 12, // m/s (43 km/h) for anything to count
  minRelSpeed: 6,
  boostDrain: 0.24, // per second
  boostMul: 1.5,
  bigImpact: 11, // velocity change (m/s) of a big hit
  scrapeImpact: 4.5,
  damageGrace: 1.5, // seconds after a big hit in which further hits are part of the same crash
  bigHitDamage: 52, // condition lost to a big hit on an average car, plus 1.5 per m/s above bigImpact...
  bigHitCap: 70, // ...up to this
  scrapeDamage: 1.2, // condition lost per m/s of a scrape above scrapeImpact
  damagedBelow: 60, // condition under which the car counts as damaged (smoke, slower)
  raceFloor: 10, // a race never takes a car below this
  minDrift: 0.6, // seconds a slide must last to count as a drift
  driftRate: 90, // points per second at 25 degrees and standing speed factor
  driftPassMul: 1.5,
  highwayNearGap: 1.15, // a pass down the middle of the next highway lane leaves ~1.5 m: that is just driving
  threadWindow: 0.6, // seconds between passes on either side that count as threading the needle
  pursuitRate: 15, // chase: points per second with the police after you, per heat level
  freeBoostRefill: 0.06, // free drive: boost back per second
};

export type ScoreMode = 'free' | 'chase' | 'race';
export type EndReason = 'ended' | 'busted' | 'escaped';

interface Track {
  entryLon: number;
  minGap: number;
  touched: boolean;
  lastSeen: number;
}

/** what the car brings to the scoring (from the garage: archetype perks, upgrades, condition) */
export interface ScorerOpts {
  health: number;
  /** condition lost per hit is multiplied by this */
  damageTaken: number;
  scoreMul: number;
  nearMul: number;
  driftMul: number;
  boostGainMul: number;
  boostDrainMul: number;
  startBoost: number;
  /** side clearance that still counts as a near miss (the highway's lanes are wide: tighter there) */
  nearGap: number;
}

export const DEFAULT_OPTS: ScorerOpts = { health: 100, damageTaken: 1, scoreMul: 1, nearMul: 1, driftMul: 1, boostGainMul: 1, boostDrainMul: 1, startBoost: 0.35, nearGap: RULES.nearGap };

export class Scorer {
  readonly opts: ScorerOpts;
  /** condition, 0-100 */
  health: number;
  /** condition lost in this run */
  damageTaken = 0;

  constructor(
    readonly mode: ScoreMode = 'chase',
    opts: Partial<ScorerOpts> = {},
  ) {
    this.opts = { ...DEFAULT_OPTS, ...(mode === 'chase' ? { nearGap: RULES.highwayNearGap } : {}), ...opts };
    this.health = this.opts.health;
    this.boost = this.opts.startBoost;
  }

  /** below the damaged line: smoking, slower */
  get damaged() {
    return this.health < RULES.damagedBelow;
  }

  private gainBoost(x: number) {
    this.boost = Math.min(1, this.boost + x * this.opts.boostGainMul);
  }

  score = 0;
  comboPoints = 0;
  mult = 1;
  comboCount = 0;
  comboT = 0;
  boost = 0.35;
  elapsed = 0;
  over: null | EndReason = null;
  /** chase: points from time in pursuit */
  pursuitPoints = 0;
  /** race: big hits taken */
  crashes = 0;
  private graceT = 0;
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
  private lastNearT = -10;
  private lastNearSide = 0;

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
    if (ctx.boosting && this.boost > 0) this.boost = Math.max(0, this.boost - RULES.boostDrain * this.opts.boostDrainMul * dt);
    // free drive: nothing to score, the boost comes back by itself
    if (this.mode === 'free') {
      if (!ctx.boosting) this.boost = Math.min(1, this.boost + RULES.freeBoostRefill * dt);
      return;
    }

    // continuous risk: oncoming lane
    if (speed > RULES.minSpeed && ctx.oncoming) {
      this.oncomingSec += dt;
      this.addCombo(70 * speedFactor * dt, ctx.boosting, 1.2);
      this.gainBoost(0.05 * dt);
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
      const pts = RULES.driftRate * (a / 25) * speedFactor * this.opts.driftMul * dt;
      this.driftPoints += pts * (ctx.boosting ? RULES.boostMul : 1);
      this.addCombo(pts, ctx.boosting, 1.5);
      this.driftTime += dt;
      this.driftSec += dt;
      this.driftMax = Math.max(this.driftMax, a);
      this.gainBoost(0.08 * (a / 25) * dt);
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
        if (passed && !tr.touched && tr.minGap < this.opts.nearGap && speed > RULES.minSpeed && relSpeed > RULES.minRelSpeed) {
          this.nearMiss(tr.minGap, Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz, speedFactor, ctx.boosting);
          // a close pass on each side in quick succession: threading the needle
          const side = Math.sign(lat) || 1;
          if (this.t - this.lastNearT < RULES.threadWindow && side !== this.lastNearSide) {
            const pts = Math.round((300 * speedFactor * this.opts.nearMul) / 10) * 10;
            this.bump();
            this.addCombo(pts, ctx.boosting);
            this.events.push({ kind: 'bonus', label: 'THREADED', points: Math.round(pts * (ctx.boosting ? RULES.boostMul : 1)) });
            this.lastNearT = -10;
          } else {
            this.lastNearT = this.t;
            this.lastNearSide = side;
          }
        }
      }
    }
    for (const [id, tr] of this.tracks) if (this.t - tr.lastSeen > 1) this.tracks.delete(id);

    // combo banking (in a chase the combo window runs at half speed above 160 km/h)
    if (this.comboPoints > 0) {
      this.comboT -= this.mode === 'chase' && kmh > 160 ? dt * 0.5 : dt;
      if (this.comboT <= 0) this.bank();
    }

    if (this.graceT > 0) this.graceT -= dt;
  }

  private nearMiss(gap: number, headingDot: number, speedFactor: number, boosting: boolean) {
    const tier: 1 | 2 | 3 = gap < RULES.insaneGap ? 3 : gap < RULES.closeGap ? 2 : 1;
    const oncoming = headingDot < -0.5;
    const crossing = Math.abs(headingDot) <= 0.5;
    let pts = 100 * tier * speedFactor * this.opts.nearMul;
    if (oncoming) pts *= 2;
    else if (crossing) pts *= 1.5;
    if (this.driftActive) pts *= RULES.driftPassMul;
    pts = Math.round(pts / 10) * 10;
    this.bump();
    this.addCombo(pts, boosting);
    this.nearMisses++;
    this.closest = Math.min(this.closest, Math.max(0, gap));
    this.gainBoost(0.07 * tier);
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

  /** sitting in a car's slipstream: the boost refills and the combo ticks over */
  slipstream(dt: number, boosting: boolean) {
    if (this.over) return;
    this.gainBoost(0.11 * dt);
    this.addCombo(40 * dt, boosting, 1.5);
  }

  /** chase: the police are after you; it scores straight away, more at higher heat */
  pursuit(dt: number, heat: number) {
    if (this.over) return;
    const pts = RULES.pursuitRate * heat * dt * this.opts.scoreMul;
    this.pursuitPoints += pts;
    this.score += Math.round(this.pursuitPoints) - Math.round(this.pursuitPoints - pts);
  }

  /** a one-off bonus from the game layer (red light, etc.) */
  bonus(label: string, points: number, boosting: boolean) {
    if (this.over) return;
    this.bump();
    this.addCombo(points, boosting);
    this.events.push({ kind: 'bonus', label, points });
  }

  bank() {
    if (this.comboPoints <= 0) return;
    const total = Math.round(this.comboPoints * this.mult * this.opts.scoreMul);
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

  /**
   * A collision; returns what it meant. 'crash' (race): the car stops and carries on. 'damage': a big
   * hit (condition lost, the combo gone). Nothing ever ends the run: a car at 0% keeps going. Free
   * drive takes no damage at all.
   */
  impact(dv: number): 'none' | 'scrape' | 'crash' | 'damage' {
    if (this.over || this.mode === 'free' || dv < RULES.scrapeImpact) return 'none';
    // the rest of a crash that just happened (bouncing off the car we hit) counts as part of it
    if (this.graceT > 0) return 'none';
    const big = dv >= RULES.bigImpact;
    const raw = big ? Math.min(RULES.bigHitCap, RULES.bigHitDamage + (dv - RULES.bigImpact) * 1.5) : (dv - RULES.scrapeImpact) * RULES.scrapeDamage;
    const dmg = raw * this.opts.damageTaken;
    const before = this.health;
    this.health = Math.max(this.mode === 'race' ? Math.min(before, RULES.raceFloor) : 0, before - dmg);
    this.damageTaken += before - this.health;
    const lost = Math.round(this.comboPoints * this.mult * this.opts.scoreMul);
    this.driftActive = false; // the drift's points went with the combo
    this.resetCombo();
    const left = `${Math.round(this.health)}% LEFT`;
    if (big && this.mode === 'race') {
      this.crashes++;
      this.graceT = RULES.damageGrace;
      this.boost = Math.max(0, this.boost - 0.15);
      this.events.push({ kind: 'crash', label: 'CRASHED', sub: left, points: 0 });
      return 'crash';
    }
    if (big) {
      this.graceT = RULES.damageGrace;
      this.boost = Math.max(0, this.boost - 0.3);
      this.events.push({ kind: 'damage', label: 'CAR DAMAGED', sub: left, points: -lost });
      return 'damage';
    }
    if (lost > 0) this.events.push({ kind: 'lost', label: 'COMBO LOST', points: -lost });
    else this.events.push({ kind: 'scrape', label: 'SCRAPE', points: 0 });
    this.boost = Math.max(0, this.boost - 0.2);
    return 'scrape';
  }

  /** a free fix on the road (a wrench pickup): condition back up by `amount`; returns what it gained */
  repair(amount: number) {
    if (this.over) return 0;
    const before = this.health;
    this.health = Math.min(100, this.health + amount);
    const got = this.health - before;
    if (got > 0) this.events.push({ kind: 'repair', label: 'REPAIRED', sub: `${Math.round(this.health)}%`, points: 0 });
    return got;
  }

  /** mark a car as touched so passing it no longer counts */
  touched(id: number) {
    const tr = this.tracks.get(id);
    if (tr) tr.touched = true;
  }

  end(reason: EndReason) {
    if (this.over) return;
    this.over = reason;
    // getting away (or ending the drive) still banks the combo, a drift in progress included; being
    // busted loses it
    if (reason !== 'busted') {
      if (this.driftActive) this.endDrift();
      this.bank();
    } else if (this.comboPoints > 0) {
      this.driftActive = false;
      this.events.push({ kind: 'lost', label: 'COMBO LOST', points: -Math.round(this.comboPoints * this.mult * this.opts.scoreMul) });
      this.resetCombo();
    }
  }
}
