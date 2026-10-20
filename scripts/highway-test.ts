// Unit checks for the highway's road: run with `npx tsx scripts/highway-test.ts`
import { RoadGen, Path, LANE_W, laneLat, latBetween, aheadOf, STEP } from '../src/mygarage/highway/road';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info));
  if (!ok) failed++;
};

const gen = new RoadGen(12345);
let path: Path = gen.root({ x: 0, z: 0, h: Math.PI / 2 });
const seen = { tunnel: 0, water: 0, works: 0, forks: 0, overpass: 0, signs: 0, lanes: new Set<number>(), zones: new Set<string>(), companion: 0, curves: 0 };
let maxJump = 0;
let maxHeadJump = 0;
let minR = Infinity;
let forkLaneErr = 0;
let travelled = 0;
let pick = 0;
while (travelled < 60000) {
  for (let k = 0; k < 40 && !path.children; k++) gen.extend(path, path.length + 1000);
  for (const p of path.pieces) {
    if ((p as unknown as { _seen?: boolean })._seen) continue;
    (p as unknown as { _seen?: boolean })._seen = true;
    if (p.tunnel) seen.tunnel++;
    if (p.water) seen.water++;
    if (p.works) seen.works++;
    if (p.overpass !== null) seen.overpass++;
    if (p.sign) seen.signs++;
    if (p.companion) seen.companion++;
    if (Math.abs(p.k0) > 1e-6 || Math.abs(p.k1) > 1e-6) seen.curves++;
    seen.lanes.add(p.n1);
    seen.zones.add(p.zone);
    for (const k of [p.k0, p.k1]) if (Math.abs(k) > 1e-9) minR = Math.min(minR, 1 / Math.abs(k));
    // continuity with the piece before
    if (p.index > 0) {
      const q = path.pieces[p.index - 1];
      const e = q.xs.length - 1;
      maxJump = Math.max(maxJump, Math.hypot(q.xs[e] - p.xs[0], q.zs[e] - p.zs[0]));
      maxHeadJump = Math.max(maxHeadJump, Math.abs(q.hs[e] - p.hs[0]));
    }
  }
  if (path.children) {
    seen.forks++;
    const [l, r] = path.children;
    // every lane carries straight on into one branch or the other
    for (let i = 0; i < path.split + r.pieces[0].n0; i++) {
      const a = path.pose(path.length, laneLat(i));
      const child = i < path.split ? l : r;
      const j = i < path.split ? i : i - path.split;
      const b = child.pose(0, laneLat(j));
      forkLaneErr = Math.max(forkLaneErr, Math.hypot(a.x - b.x, a.z - b.z));
      const back = latBetween(laneLat(j), child, path);
      if (back === null || Math.abs(back - laneLat(i)) > 1e-6) forkLaneErr = 99;
    }
    if (aheadOf(path, path.length - 10, r, 5) !== 15) forkLaneErr = 99;
    travelled += path.length;
    path = path.children[pick++ % 2];
  } else break;
}
check('the road goes on and on (60 km through forks)', travelled >= 60000, travelled);
check('pieces join up: no gaps', maxJump < 0.01, maxJump);
check('pieces join up: no kinks', maxHeadJump < 1e-6, maxHeadJump);
check('curves no tighter than 380 m', minR >= 379, minR);
check('lanes carry straight on into the branches at a fork', forkLaneErr < 0.01, forkLaneErr);
check('tunnels, water, roadworks, overpasses, signs and the other road all turn up', seen.tunnel > 0 && seen.water > 0 && seen.works > 0 && seen.overpass > 3 && seen.signs > 5 && seen.companion > 5, seen);
check('forks every few km', seen.forks >= 7, seen.forks);
// (a branch can start with one or two lanes before it widens)
check('three to five lanes on the open road, and every zone', [3, 4, 5].every((n) => seen.lanes.has(n)) && Math.max(...seen.lanes) <= 5 && seen.zones.size === 5, { lanes: [...seen.lanes], zones: [...seen.zones] });
check('lots of curves', seen.curves > 40, seen.curves);

// projecting a point back onto the road
{
  const p = new RoadGen(7).root({ x: 0, z: 0, h: 0 });
  const g = new RoadGen(7);
  g.extend(p, 4000);
  let err = 0;
  for (let s = 50; s < 3500; s += 37) {
    const lat = ((s * 7) % 13) - 2;
    const q = p.pose(s, lat);
    const pr = p.project(q.x, q.z, s - 20);
    err = Math.max(err, Math.abs(pr.s - s), Math.abs(pr.lat - lat));
  }
  check('a point projects back to where it came from', err < 0.1, err);
  const before = p.pose(1000, 3);
  p.shift(-500, 250);
  const after = p.pose(1000, 3);
  check('shifting moves the whole road', Math.abs(after.x - before.x + 500) < 1e-9 && Math.abs(after.z - before.z - 250) < 1e-9);
  void LANE_W;
  void STEP;
}

// lane rules
{
  const g = new RoadGen(99);
  let p = g.root({ x: 0, z: 0, h: 0 });
  let found = false;
  for (let k = 0; k < 20 && !found; k++) {
    g.extend(p, p.length + 3000);
    for (const pc of p.pieces) {
      if (!pc.works) continue;
      const mid = pc.s0 + (pc.works.full + pc.works.to) / 2;
      found = !p.laneOpen(pc.works.lane, mid) && p.laneOpen(pc.works.lane === 0 ? 1 : 0, mid) && p.laneOpen(pc.works.lane, pc.s0 + pc.len + 5);
      break;
    }
    if (p.children) p = p.children[0];
  }
  check('roadworks close a lane and open it again after', found);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
