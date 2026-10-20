// The highway's road: an endless, procedurally laid motorway. Pure geometry and planning (no
// rendering or physics) so it can be tested in Node.
//
// A road is a tree of paths. A path is a chain of pieces; each piece bends with a curvature that
// changes linearly along it (straights, clothoid transitions and arcs), so the road is smooth.
// Positions on a path are (s, lat): metres along it and metres to the right of its reference line,
// which is the left edge of lane 0 (the fast lane). Lanes are LANE_W wide, numbered from the left,
// and are added or dropped on the right with a taper.
//
// Every few kilometres the road forks: the lanes split between a left and a right branch, each a
// path of its own heading somewhere else (the overhead signs say where, and how busy). Once the
// driver is committed to one branch, the other is left to fall behind.
//
// Pieces also carry what is on and around them: the scenery zone, tunnels, water, roadworks that
// close a lane, overpasses, signs, and the road for the other direction off to the left.

export const LANE_W = 3.4;
/** the left guardrail (median side) and the right one past a 3 m shoulder */
export const RAIL_L = -1.3;
export const RAIL_R_OFF = 3.4;
export const STEP = 2;
/** lanes the other way */
export const COMPANION_LANES = 3;

export type Zone = 'fields' | 'forest' | 'coast' | 'desert' | 'city';

export interface ZoneInfo {
  label: string;
  /** relative traffic */
  traffic: number;
  /** what the signs say about it */
  busy: string;
}

export const ZONES: Record<Zone, ZoneInfo> = {
  fields: { label: 'Fields', traffic: 1, busy: 'normal traffic' },
  forest: { label: 'Forest', traffic: 0.85, busy: 'light traffic' },
  coast: { label: 'Coast', traffic: 0.7, busy: 'light traffic' },
  desert: { label: 'Desert', traffic: 0.8, busy: 'light traffic' },
  city: { label: 'City', traffic: 1.55, busy: 'heavy traffic' },
};

export interface Works {
  /** the lane closed in the middle of the piece */
  lane: number;
  /** local s where the cones start closing it, where it is fully closed, and where it opens again */
  from: number;
  full: number;
  to: number;
}

export interface Sign {
  /** local s */
  at: number;
  /** text over the left lanes and (at a fork) over the right ones */
  left: string;
  right?: string;
  /** lanes over the left board at a fork */
  split?: number;
}

export interface Piece {
  path: Path;
  index: number;
  s0: number;
  len: number;
  k0: number;
  k1: number;
  xs: Float64Array;
  zs: Float64Array;
  hs: Float64Array;
  /** lanes at the start and end (a taper in between when they differ) */
  n0: number;
  n1: number;
  zone: Zone;
  tunnel: boolean;
  /** water beside the road (a causeway) */
  water: boolean;
  works: Works | null;
  /** the road the other way: gap between it and ours at the start and end (null: none) */
  companion: { d0: number; d1: number } | null;
  overpass: number | null;
  sign: Sign | null;
  /** the first piece of a branch: no rail on the side facing the other branch until `goreEnd` */
  gore: { side: 'left' | 'right'; end: number; other: Path } | null;
  /** lamps along the median */
  lamps: boolean;
  seed: number;
}

export interface Pose {
  x: number;
  z: number;
  /** heading: forward is (sin h, cos h); the right is (-cos h, sin h) */
  h: number;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

let pathIds = 1;

export class Path {
  readonly id = pathIds++;
  pieces: Piece[] = [];
  length = 0;
  /** a fork at the end: [left, right] */
  children: [Path, Path] | null = null;
  /** lanes that go to the left branch */
  split = 0;
  abandoned = false;
  /** planning state for what comes next */
  plan: Plan;
  /** the lane offset of this path's reference line from its parent's (a right branch starts `split` lanes over) */
  offset = 0;

  constructor(
    readonly parent: Path | null,
    readonly start: Pose,
    lanes: number,
    zone: Zone,
    plan?: Plan,
  ) {
    this.plan = plan ? { ...plan, lanes, zone } : freshPlan(lanes, zone);
  }

  get end(): Pose {
    const p = this.pieces[this.pieces.length - 1];
    if (!p) return this.start;
    const i = p.xs.length - 1;
    return { x: p.xs[i], z: p.zs[i], h: p.hs[i] };
  }

  private last = 0;
  pieceAt(s: number): Piece {
    const ps = this.pieces;
    let i = Math.min(this.last, ps.length - 1);
    while (i > 0 && s < ps[i].s0) i--;
    while (i < ps.length - 1 && s >= ps[i].s0 + ps[i].len) i++;
    this.last = i;
    return ps[i];
  }

  /** the point `lat` metres right of the reference line, `s` metres along */
  pose(s: number, lat = 0): Pose {
    const p = this.pieceAt(s);
    const u = Math.max(0, Math.min(p.len, s - p.s0)) / STEP;
    const i = Math.min(p.xs.length - 2, Math.floor(u));
    const f = u - i;
    const h = p.hs[i] + (p.hs[i + 1] - p.hs[i]) * f;
    const x = p.xs[i] + (p.xs[i + 1] - p.xs[i]) * f;
    const z = p.zs[i] + (p.zs[i + 1] - p.zs[i]) * f;
    return { x: x - Math.cos(h) * lat, z: z + Math.sin(h) * lat, h };
  }

  /** lanes at s (fractional inside a taper) */
  lanes(s: number) {
    const p = this.pieceAt(s);
    if (p.n0 === p.n1) return p.n0;
    return p.n0 + (p.n1 - p.n0) * smooth((s - p.s0) / p.len);
  }

  /** the right edge of the carriageway */
  rightEdge(s: number) {
    return this.lanes(s) * LANE_W;
  }

  /** is lane i open at s (there, and not coned off)? */
  laneOpen(i: number, s: number) {
    if (i < 0 || i > this.lanes(s) - 0.55) return false;
    const p = this.pieceAt(s);
    const w = p.works;
    if (w && w.lane === i) {
      const u = s - p.s0;
      if (u > w.from - 40 && u < w.to) return false;
    }
    return true;
  }

  /** gap to the other direction's road at s, or null where there is none */
  companionGap(s: number): number | null {
    const p = this.pieceAt(s);
    if (!p.companion) return null;
    return p.companion.d0 + (p.companion.d1 - p.companion.d0) * smooth((s - p.s0) / p.len);
  }

  /** nearest point on the path to (x, z), searching around a hint */
  project(x: number, z: number, hint: number, back = 40, ahead = 90): { s: number; lat: number; d: number } {
    let best = { s: hint, lat: 0, d: Infinity };
    const s0 = Math.max(0, hint - back);
    const s1 = Math.min(this.length, hint + ahead);
    for (let s = s0; s <= s1; s += STEP) {
      const c = this.pose(s);
      const dx = x - c.x;
      const dz = z - c.z;
      const along = dx * Math.sin(c.h) + dz * Math.cos(c.h);
      if (Math.abs(along) > STEP * 1.5) continue;
      const lat = -dx * Math.cos(c.h) + dz * Math.sin(c.h);
      const d = Math.abs(lat);
      if (d < best.d) best = { s: Math.max(0, Math.min(this.length, s + along)), lat, d };
    }
    return best;
  }

  /** move everything by (dx, dz) (keeping coordinates small) */
  shift(dx: number, dz: number) {
    for (const p of this.pieces) {
      for (let i = 0; i < p.xs.length; i++) {
        p.xs[i] += dx;
        p.zs[i] += dz;
      }
    }
    (this.start as { x: number }).x += dx;
    (this.start as { z: number }).z += dz;
  }
}

// ------------------------------------------------------------------ planning
interface Plan {
  lanes: number;
  zone: Zone;
  zoneLeft: number;
  nextTunnel: number;
  nextWater: number;
  nextWorks: number;
  nextLanes: number;
  nextOverpass: number;
  nextSign: number;
  nextFork: number;
  /** current gap to the other direction's road (null: none) and how long it stays */
  companion: number | null;
  companionLeft: number;
  lamps: boolean;
}

function freshPlan(lanes: number, zone: Zone): Plan {
  return {
    lanes,
    zone,
    zoneLeft: 2500,
    nextTunnel: 2200,
    nextWater: 3400,
    nextWorks: 1700,
    nextLanes: 2900,
    nextOverpass: 900,
    nextSign: 1300,
    nextFork: 4200,
    companion: 18,
    companionLeft: 3500,
    lamps: false,
  };
}

/** a deterministic random source */
export class Rand {
  constructor(private s: number) {}
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  pick<T>(a: readonly T[]): T {
    return a[Math.floor(this.next() * a.length)];
  }
}

type Spec = Omit<Piece, 'path' | 'index' | 's0' | 'xs' | 'zs' | 'hs'>;

/** Lays road ahead: curves and straights, and decides where tunnels, water, works and forks go. */
export class RoadGen {
  readonly rng: Rand;

  constructor(seed: number) {
    this.rng = new Rand(seed);
  }

  /** a new road starting at a pose */
  root(start: Pose, zone: Zone = 'fields') {
    const p = new Path(null, start, 4, zone);
    // a straight to start on, with nothing in the way
    this.add(p, { ...this.blank(p), len: 600 });
    return p;
  }

  private blank(p: Path): Spec {
    const pl = p.plan;
    return {
      len: 300,
      k0: 0,
      k1: 0,
      n0: pl.lanes,
      n1: pl.lanes,
      zone: pl.zone,
      tunnel: false,
      water: false,
      works: null,
      companion: pl.companion !== null ? { d0: pl.companion, d1: pl.companion } : null,
      overpass: null,
      sign: null,
      gore: null,
      lamps: pl.lamps,
      seed: Math.floor(this.rng.next() * 1e9),
    };
  }

  /** build a piece's samples and append it */
  add(path: Path, spec: Spec) {
    const st = path.end;
    const n = Math.max(2, Math.round(spec.len / STEP) + 1);
    const len = (n - 1) * STEP;
    const xs = new Float64Array(n);
    const zs = new Float64Array(n);
    const hs = new Float64Array(n);
    let x = st.x;
    let z = st.z;
    let h = st.h;
    xs[0] = x;
    zs[0] = z;
    hs[0] = h;
    for (let i = 1; i < n; i++) {
      const u0 = (i - 1) * STEP;
      const um = u0 + STEP / 2;
      const k = (uu: number) => spec.k0 + ((spec.k1 - spec.k0) * uu) / len;
      // heading is the integral of curvature
      const hm = h + ((k(u0) + k(um)) / 2) * (STEP / 2);
      x += Math.sin(hm) * STEP;
      z += Math.cos(hm) * STEP;
      h += ((k(u0) + k(u0 + STEP)) / 2) * STEP;
      xs[i] = x;
      zs[i] = z;
      hs[i] = h;
    }
    const piece: Piece = { ...spec, len, path, index: path.pieces.length, s0: path.length, xs, zs, hs };
    path.pieces.push(piece);
    path.length += len;
    return piece;
  }

  /** lay road until the path reaches `until` metres (or ends at a fork) */
  extend(path: Path, until: number) {
    while (path.length < until && !path.children) this.segment(path);
  }

  private segment(path: Path) {
    const r = this.rng;
    const pl = path.plan;
    const fresh = path.length < 900 && path.parent !== null;
    // a fork: a straight with the signs, then the split
    if (pl.nextFork <= 0 && !fresh) {
      if (pl.companion !== null) {
        // the other road bends away out of sight first
        const sp = this.blank(path);
        this.add(path, { ...sp, len: 360, companion: { d0: pl.companion, d1: 420 } });
        pl.companion = null;
        pl.companionLeft = 2600;
      }
      this.fork(path);
      return;
    }
    const base = this.blank(path);
    const specs: Spec[] = [];
    // lanes come and go
    if (pl.nextLanes <= 0 && !fresh) {
      const opts = [3, 4, 5].filter((n) => n !== pl.lanes);
      const n1 = r.pick(opts);
      specs.push({ ...base, len: 220, n0: pl.lanes, n1 });
      pl.lanes = n1;
      pl.nextLanes = r.range(2400, 4200);
    }
    // the other road: appears from afar, keeps beside us a while, then wanders off
    let comp = base.companion;
    if (pl.companion === null && pl.companionLeft <= 0 && !fresh) {
      const d = r.range(14, 34);
      comp = { d0: 380, d1: d };
      pl.companion = d;
      pl.companionLeft = r.range(2500, 5000);
    } else if (pl.companion !== null && pl.companionLeft <= 0) {
      comp = { d0: pl.companion, d1: 420 };
      pl.companion = null;
      pl.companionLeft = r.range(1800, 3500);
    } else if (pl.companion !== null) comp = { d0: pl.companion, d1: pl.companion };
    const tunnel = pl.nextTunnel <= 0 && (pl.zone === 'forest' || pl.zone === 'desert' || pl.zone === 'fields') && !fresh;
    if (tunnel) pl.nextTunnel = r.range(3500, 6500);
    const water = !tunnel && pl.nextWater <= 0 && pl.zone !== 'city' && pl.zone !== 'desert';
    if (water) pl.nextWater = r.range(pl.zone === 'coast' ? 1500 : 4000, pl.zone === 'coast' ? 3000 : 7000);
    const works = !tunnel && pl.nextWorks <= 0 && pl.lanes >= 3 && !fresh;
    const curve = !works && r.next() < 0.62;
    const lamps = pl.zone === 'city' || tunnel;
    const flags = { zone: pl.zone, tunnel, water, lamps, n0: pl.lanes, n1: pl.lanes };
    if (works) {
      pl.nextWorks = r.range(2600, 4600);
      const len = r.range(460, 640);
      const lane = r.next() < 0.6 ? pl.lanes - 1 : 0;
      specs.push({ ...base, ...flags, len, works: { lane, from: 90, full: 150, to: len - 70 } });
    } else if (curve) {
      // tighter in the hills and on the coast, sweeping elsewhere
      const tight = pl.zone === 'coast' || pl.zone === 'forest';
      const R = r.range(tight ? 380 : 520, tight ? 900 : 1500);
      const k = (r.next() < 0.5 ? 1 : -1) / R;
      const arc = r.range(150, 520);
      specs.push({ ...base, ...flags, len: 100, k0: 0, k1: k });
      specs.push({ ...base, ...flags, len: arc, k0: k, k1: k });
      specs.push({ ...base, ...flags, len: 100, k0: k, k1: 0 });
    } else {
      specs.push({ ...base, ...flags, len: r.range(260, 700) });
    }
    // the gap to the other road changes over the first piece only (and once it has wandered off, it is gone)
    specs.forEach((sp, i) => (sp.companion = !comp ? null : i === 0 ? comp : comp.d1 >= 400 ? null : { d0: comp.d1, d1: comp.d1 }));
    let total = 0;
    for (const sp of specs) {
      // an overpass now and then, on a straight-ish piece
      if (pl.nextOverpass <= total + sp.len && !sp.tunnel && !sp.works && Math.abs(sp.k0) < 1e-6 && Math.abs(sp.k1) < 1e-6 && sp.len > 200) {
        sp.overpass = sp.len * 0.5;
        pl.nextOverpass = r.range(1300, 2600);
      }
      if (pl.nextSign <= total + sp.len && !sp.tunnel && !sp.overpass && sp.len > 220) {
        sp.sign = { at: 60, left: `${ZONES[pl.zone].label}  ${Math.round(r.range(4, 40))} km` };
        pl.nextSign = r.range(1800, 3200);
      }
      this.add(path, sp);
      total += sp.len;
    }
    for (const k of ['zoneLeft', 'nextTunnel', 'nextWater', 'nextWorks', 'nextLanes', 'nextOverpass', 'nextSign', 'nextFork', 'companionLeft'] as const) pl[k] -= total;
    if (pl.zoneLeft <= 0) {
      pl.zone = r.pick((['fields', 'forest', 'coast', 'desert', 'city'] as Zone[]).filter((z) => z !== pl.zone));
      pl.zoneLeft = r.range(2500, 4500);
    }
  }

  /** the signs, then the split: left lanes to one place, right lanes to another */
  private fork(path: Path) {
    const r = this.rng;
    const pl = path.plan;
    const n = pl.lanes;
    const split = n === 3 ? (r.next() < 0.5 ? 1 : 2) : n === 5 ? (r.next() < 0.5 ? 2 : 3) : 2;
    const zones = (['fields', 'forest', 'coast', 'desert', 'city'] as Zone[]).filter((z) => z !== pl.zone);
    const a = r.pick(zones);
    const b = r.pick(zones.filter((z) => z !== a && ZONES[z].busy !== ZONES[a].busy));
    const sp = this.blank(path);
    this.add(path, {
      ...sp,
      len: 520,
      companion: null,
      sign: { at: 140, left: `↖ ${ZONES[a].label} · ${ZONES[a].busy}`, right: `${ZONES[b].label} · ${ZONES[b].busy} ↗`, split },
    });
    pl.nextFork = r.range(4800, 7500);
    const end = path.end;
    const off = split * LANE_W;
    const left = new Path(path, end, split, a, pl);
    const right = new Path(path, { x: end.x - Math.cos(end.h) * off, z: end.z + Math.sin(end.h) * off, h: end.h }, n - split, b, pl);
    right.offset = off;
    path.split = split;
    path.children = [left, right];
    // the branches bend apart: left one to the left (positive curvature), right one to the right
    const K = 1 / 620;
    for (const [c, sign] of [
      [left, 1],
      [right, -1],
    ] as const) {
      const cp = c.plan;
      cp.zone = c === left ? a : b;
      cp.zoneLeft = r.range(2600, 4200);
      cp.companion = null;
      cp.companionLeft = r.range(1600, 2600);
      cp.lamps = cp.zone === 'city';
      const base = { ...this.blank(c), companion: null, zone: cp.zone, lamps: cp.lamps };
      const gore = { side: (c === left ? 'right' : 'left') as 'left' | 'right', end: 56, other: c === left ? right : left };
      this.add(c, { ...base, len: 70, k0: 0, k1: sign * K, gore });
      this.add(c, { ...base, len: 200, k0: sign * K, k1: sign * K });
      this.add(c, { ...base, len: 70, k0: sign * K, k1: 0 });
      // and widen to at least three lanes
      const n1 = Math.max(3, cp.lanes);
      if (n1 !== cp.lanes) this.add(c, { ...base, len: 220, n0: cp.lanes, n1 });
      cp.lanes = n1;
    }
  }
}

/** lane centre */
export const laneLat = (i: number) => LANE_W * (i + 0.5);

/** where a car on `from` at lateral `lat` sits in `to`'s frame (for a parent and its branches) */
export function latBetween(lat: number, from: Path, to: Path) {
  if (from === to) return lat;
  if (from.parent === to) return lat + from.offset;
  if (to.parent === from) return lat - to.offset;
  return null;
}

/**
 * Metres from (pa, sa) forward to (pb, sb) along the road, when b is on the same path or on a
 * branch or parent right next to it; null when they are not on connected paths.
 */
export function aheadOf(pa: Path, sa: number, pb: Path, sb: number) {
  if (pa === pb) return sb - sa;
  if (pb.parent === pa) return pa.length - sa + sb;
  if (pa.parent === pb) return -(sa + (pb.length - sb));
  return null;
}
