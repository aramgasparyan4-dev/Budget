import type { CityData } from '../../world/types';
import { MinHeap } from '../../core/math';

export interface PathPoint {
  x: number;
  z: number;
  /** segment from this point to the next is a crosswalk */
  cross?: { inter: number; axis: 'v' | 'h' };
}

export interface Access {
  edge: number;
  t: number;
  x: number;
  z: number;
}

/** A* over the sidewalk graph (nodes at block corners, edges along sidewalks and crosswalks). */
export class SidewalkNav {
  constructor(private c: CityData) {}

  path(fromDoor: { x: number; z: number }, from: Access, toDoor: { x: number; z: number }, to: Access): PathPoint[] {
    const c = this.c;
    const pts: PathPoint[] = [{ x: fromDoor.x, z: fromDoor.z }, { x: from.x, z: from.z }];
    if (from.edge === to.edge) {
      pts.push({ x: to.x, z: to.z }, { x: toDoor.x, z: toDoor.z });
      return pts;
    }
    const ea = c.swEdges[from.edge];
    const eb = c.swEdges[to.edge];
    const goal = new Map<number, number>();
    goal.set(eb.a, eb.length * to.t);
    goal.set(eb.b, eb.length * (1 - to.t));
    const gx = to.x;
    const gz = to.z;
    const g = new Map<number, number>();
    const prev = new Map<number, number>(); // node -> edge used
    const heap = new MinHeap<number>();
    const startA = ea.length * from.t;
    const startB = ea.length * (1 - from.t);
    g.set(ea.a, startA);
    g.set(ea.b, startB);
    const h = (n: number) => {
      const nd = c.swNodes[n];
      return Math.abs(nd.x - gx) + Math.abs(nd.z - gz);
    };
    heap.push(ea.a, startA + h(ea.a));
    heap.push(ea.b, startB + h(ea.b));
    let best = -1;
    let bestCost = Infinity;
    let iter = 0;
    while (heap.size && iter++ < 4000) {
      const n = heap.pop()!;
      const gn = g.get(n)!;
      if (gn + h(n) * 0.5 > bestCost) break;
      if (goal.has(n)) {
        const total = gn + goal.get(n)!;
        if (total < bestCost) {
          bestCost = total;
          best = n;
        }
      }
      for (const eid of c.swAdj[n]) {
        if (eid === from.edge) continue;
        const e = c.swEdges[eid];
        const m = e.a === n ? e.b : e.a;
        const cost = gn + e.length + (e.kind === 'cross' ? 6 : 0);
        if (cost < (g.get(m) ?? Infinity)) {
          g.set(m, cost);
          prev.set(m, eid);
          heap.push(m, cost + h(m));
        }
      }
    }
    if (best < 0) {
      pts.push({ x: to.x, z: to.z }, { x: toDoor.x, z: toDoor.z });
      return pts;
    }
    // walk back
    const nodes: { n: number; e: number }[] = [];
    let cur = best;
    while (cur !== ea.a && cur !== ea.b) {
      const eid = prev.get(cur)!;
      nodes.push({ n: cur, e: eid });
      const e = c.swEdges[eid];
      cur = e.a === cur ? e.b : e.a;
    }
    nodes.push({ n: cur, e: -1 });
    nodes.reverse();
    for (let i = 0; i < nodes.length; i++) {
      const nd = c.swNodes[nodes[i].n];
      const p: PathPoint = { x: nd.x, z: nd.z };
      const nextEdge = i + 1 < nodes.length ? nodes[i + 1].e : -1;
      if (nextEdge >= 0) {
        const e = c.swEdges[nextEdge];
        if (e.kind === 'cross') p.cross = { inter: e.inter!, axis: e.crossAxis! };
      }
      pts.push(p);
    }
    pts.push({ x: to.x, z: to.z }, { x: toDoor.x, z: toDoor.z });
    return dedupe(pts);
  }
}

function dedupe(pts: PathPoint[]) {
  const out: PathPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.05 && Math.abs(last.z - p.z) < 0.05) {
      if (p.cross) last.cross = p.cross;
      continue;
    }
    out.push(p);
  }
  return out;
}

export function pathLength(pts: PathPoint[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
}

export function pointAlong(pts: PathPoint[], d: number): { x: number; z: number; i: number; yaw: number } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (acc + l >= d) {
      const t = l > 0 ? (d - acc) / l : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, i, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    acc += l;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, z: last.z, i: pts.length - 1, yaw: 0 };
}
