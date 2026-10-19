import type { CityData, RoadSegment } from '../../world/types';
import { laneOffset } from '../../world/CityGenerator';
import { MinHeap, segmentsIntersect } from '../../core/math';

export interface Lane {
  id: number;
  link: number;
  seg: number;
  dir: 1 | -1;
  idx: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  dx: number;
  dz: number;
  rx: number;
  rz: number;
  length: number;
  from: number;
  to: number;
  speed: number;
  axis: 'v' | 'h';
  left: number;
  right: number;
  out: number[];
  parking: boolean;
}

export interface Connector {
  id: number;
  inter: number;
  from: number; // lane id
  to: number; // lane id
  turn: 'L' | 'S' | 'R';
  pts: Float32Array;
  cum: Float32Array;
  length: number;
  conflicts: number[];
  axis: 'v' | 'h';
}

export interface Link {
  id: number;
  seg: number;
  dir: 1 | -1;
  from: number;
  to: number;
  lanes: number[];
  next: number[]; // link ids reachable at the end
  length: number;
  speed: number;
}

export class RoadGraph {
  lanes: Lane[] = [];
  conns: Connector[] = [];
  links: Link[] = [];
  /** connectors arriving at each intersection */
  interConns: number[][] = [];
  /** blocked links (events) */
  closed = new Set<number>();
  /** extra cost on links (accidents) */
  penalty = new Map<number, number>();

  constructor(public city: CityData) {
    const segs = city.segments;
    for (const s of segs) {
      for (const dir of [1, -1] as const) {
        const link: Link = {
          id: s.id * 2 + (dir === 1 ? 0 : 1),
          seg: s.id,
          dir,
          from: dir === 1 ? s.a : s.b,
          to: dir === 1 ? s.b : s.a,
          lanes: [],
          next: [],
          length: s.length,
          speed: s.speedLimit,
        };
        this.links[link.id] = link;
        if (!s.exists) continue;
        for (let k = 0; k < s.lanesPerDir; k++) this.addLane(s, dir, k, link);
      }
    }
    for (const l of this.lanes) {
      // neighbours within same link: idx 0 inner (left), higher idx outer (right)
      const link = this.links[l.link];
      l.left = l.idx > 0 ? link.lanes[l.idx - 1] : -1;
      l.right = l.idx < link.lanes.length - 1 ? link.lanes[l.idx + 1] : -1;
    }
    for (let i = 0; i < city.intersections.length; i++) this.interConns[i] = [];
    this.buildConnectors();
    this.buildConflicts();
  }

  private addLane(s: RoadSegment, dir: 1 | -1, k: number, link: Link) {
    const vert = s.orient === 'v';
    const dx = vert ? 0 : dir;
    const dz = vert ? dir : 0;
    const rx = -dz;
    const rz = dx;
    const off = laneOffset(s, k);
    const sx = dir === 1 ? s.x0 : s.x1;
    const sz = dir === 1 ? s.z0 : s.z1;
    const ex = dir === 1 ? s.x1 : s.x0;
    const ez = dir === 1 ? s.z1 : s.z0;
    const lane: Lane = {
      id: this.lanes.length,
      link: link.id,
      seg: s.id,
      dir,
      idx: k,
      x0: sx + rx * off,
      z0: sz + rz * off,
      x1: ex + rx * off,
      z1: ez + rz * off,
      dx,
      dz,
      rx,
      rz,
      length: s.length,
      from: link.from,
      to: link.to,
      speed: s.speedLimit,
      axis: s.orient,
      left: -1,
      right: -1,
      out: [],
      parking: s.parking,
    };
    this.lanes.push(lane);
    link.lanes.push(lane.id);
  }

  private buildConnectors() {
    const city = this.city;
    for (const inLink of this.links) {
      if (!inLink || !inLink.lanes.length) continue;
      const inter = inLink.to;
      for (const outLink of this.links) {
        if (!outLink || !outLink.lanes.length) continue;
        if (outLink.from !== inter) continue;
        if (outLink.seg === inLink.seg) continue; // no u-turns
        const li = this.lanes[inLink.lanes[0]];
        const lo = this.lanes[outLink.lanes[0]];
        const dot = li.dx * lo.dx + li.dz * lo.dz;
        const cross = li.dx * lo.dz - li.dz * lo.dx;
        const turn: Connector['turn'] = dot > 0.5 ? 'S' : cross > 0 ? 'R' : 'L';
        inLink.next.push(outLink.id);
        const nIn = inLink.lanes.length;
        const nOut = outLink.lanes.length;
        const pairs: [number, number][] = [];
        if (turn === 'S') {
          for (let k = 0; k < nIn; k++) pairs.push([k, Math.min(k, nOut - 1)]);
        } else if (turn === 'L') pairs.push([0, 0]);
        else pairs.push([nIn - 1, nOut - 1]);
        for (const [ki, ko] of pairs) {
          const a = this.lanes[inLink.lanes[ki]];
          const b = this.lanes[outLink.lanes[ko]];
          const pts: number[] = [];
          const N = turn === 'S' ? 2 : 10;
          let cx = 0;
          let cz = 0;
          if (turn !== 'S') {
            if (a.dx === 0) {
              cx = a.x1;
              cz = b.z0;
            } else {
              cx = b.x0;
              cz = a.z1;
            }
          }
          for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            if (turn === 'S') {
              pts.push(a.x1 + (b.x0 - a.x1) * t, a.z1 + (b.z0 - a.z1) * t);
            } else {
              const u = 1 - t;
              pts.push(u * u * a.x1 + 2 * u * t * cx + t * t * b.x0, u * u * a.z1 + 2 * u * t * cz + t * t * b.z0);
            }
          }
          const cum = new Float32Array(N);
          for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
          const c: Connector = {
            id: this.conns.length,
            inter,
            from: a.id,
            to: b.id,
            turn,
            pts: new Float32Array(pts),
            cum,
            length: cum[N - 1],
            conflicts: [],
            axis: a.axis,
          };
          this.conns.push(c);
          a.out.push(c.id);
          this.interConns[inter].push(c.id);
        }
      }
    }
    void city;
  }

  private buildConflicts() {
    for (const list of this.interConns) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = this.conns[list[i]];
          const b = this.conns[list[j]];
          if (a.from === b.from) continue;
          let hit = a.to === b.to;
          if (!hit) {
            outer: for (let p = 0; p < a.pts.length / 2 - 1; p++) {
              for (let q = 0; q < b.pts.length / 2 - 1; q++) {
                if (
                  segmentsIntersect(
                    a.pts[p * 2], a.pts[p * 2 + 1], a.pts[p * 2 + 2], a.pts[p * 2 + 3],
                    b.pts[q * 2], b.pts[q * 2 + 1], b.pts[q * 2 + 2], b.pts[q * 2 + 3],
                  )
                ) {
                  hit = true;
                  break outer;
                }
              }
            }
          }
          if (hit) {
            a.conflicts.push(b.id);
            b.conflicts.push(a.id);
          }
        }
      }
    }
  }

  /** Position & heading along a connector at distance s. */
  connPose(c: Connector, s: number, out: { x: number; z: number; yaw: number }) {
    const n = c.cum.length;
    if (s <= 0) {
      out.x = c.pts[0];
      out.z = c.pts[1];
      out.yaw = Math.atan2(c.pts[2] - c.pts[0], c.pts[3] - c.pts[1]);
      return out;
    }
    let i = 1;
    while (i < n - 1 && c.cum[i] < s) i++;
    const s0 = c.cum[i - 1];
    const s1 = c.cum[i];
    const t = Math.min(1, (s - s0) / Math.max(1e-4, s1 - s0));
    const x0 = c.pts[(i - 1) * 2];
    const z0 = c.pts[(i - 1) * 2 + 1];
    const x1 = c.pts[i * 2];
    const z1 = c.pts[i * 2 + 1];
    out.x = x0 + (x1 - x0) * t;
    out.z = z0 + (z1 - z0) * t;
    out.yaw = Math.atan2(x1 - x0, z1 - z0);
    return out;
  }

  /** Connector from a lane into a link (null if none). */
  connTo(laneId: number, linkId: number): Connector | null {
    const l = this.lanes[laneId];
    for (const cid of l.out) {
      const c = this.conns[cid];
      if (this.lanes[c.to].link === linkId) return c;
    }
    return null;
  }

  /** Lanes of a link that can turn into the next link. */
  lanesFor(linkId: number, nextLink: number): number[] {
    const out: number[] = [];
    for (const lid of this.links[linkId].lanes) if (this.connTo(lid, nextLink)) out.push(lid);
    return out;
  }

  /** Dijkstra over directed links (no u-turns). Returns link ids from start to goal inclusive. */
  route(startLink: number, goalLink: number, congestion?: (l: number) => number): number[] | null {
    if (startLink === goalLink) return [startLink];
    const dist = new Map<number, number>();
    const prev = new Map<number, number>();
    const heap = new MinHeap<number>();
    dist.set(startLink, 0);
    heap.push(startLink, 0);
    let iter = 0;
    while (heap.size && iter++ < 5000) {
      const cur = heap.pop()!;
      if (cur === goalLink) break;
      const d = dist.get(cur)!;
      const link = this.links[cur];
      for (const nx of link.next) {
        if (this.closed.has(nx)) continue;
        const nl = this.links[nx];
        const turnCost = this.turnCost(cur, nx);
        const cost = d + nl.length / nl.speed + turnCost + (this.penalty.get(nx) ?? 0) + (congestion ? congestion(nx) : 0);
        if (cost < (dist.get(nx) ?? Infinity)) {
          dist.set(nx, cost);
          prev.set(nx, cur);
          heap.push(nx, cost);
        }
      }
    }
    if (!prev.has(goalLink)) return null;
    const path = [goalLink];
    let c = goalLink;
    while (c !== startLink) {
      c = prev.get(c)!;
      path.push(c);
    }
    return path.reverse();
  }

  turnCost(a: number, b: number) {
    const la = this.lanes[this.links[a].lanes[0]];
    const lb = this.lanes[this.links[b].lanes[0]];
    if (!la || !lb) return 0;
    const dot = la.dx * lb.dx + la.dz * lb.dz;
    if (dot > 0.5) return 0;
    const cross = la.dx * lb.dz - la.dz * lb.dx;
    return cross > 0 ? 3 : 6;
  }

  /** Nearest lane to a point (optionally only lanes whose direction roughly matches yaw). */
  nearestLane(x: number, z: number, yaw?: number): { lane: Lane; s: number; d: number } | null {
    let best: { lane: Lane; s: number; d: number } | null = null;
    for (const l of this.lanes) {
      if (yaw !== undefined) {
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        if (fx * l.dx + fz * l.dz < 0.5) continue;
      }
      const t = Math.max(0, Math.min(l.length, (x - l.x0) * l.dx + (z - l.z0) * l.dz));
      const px = l.x0 + l.dx * t;
      const pz = l.z0 + l.dz * t;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = { lane: l, s: t, d };
    }
    return best;
  }
}
