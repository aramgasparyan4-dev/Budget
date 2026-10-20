// Race progress rules, no physics: checkpoints in order, no credit off the route or for shortcuts,
// wrong-way detection, finish. Run: npx tsx scripts/race-unit-test.ts
import { generateCity } from '../src/world/CityGenerator';
import { planRoute, Progress, compareProgress, freeSpot, laneSet } from '../src/mygarage/race';

const city = generateCity(20261019);
let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : JSON.stringify(info)}`);
  if (!ok) failed++;
};

const route = planRoute(city, 4242);
const cps = route.checkpoints;
check('route ends at the finish checkpoint', cps[cps.length - 1].finish && Math.abs(cps[cps.length - 1].s - route.length) < 0.01, cps[cps.length - 1]);
check(
  'checkpoints are in order along the route',
  cps.every((c, i) => i === 0 || c.s > cps[i - 1].s),
  cps.map((c) => Math.round(c.s)),
);
check('first leg has room for a two-car grid', route.lanesAt(0) === 2 && laneSet(2).filter((l) => l > 0).length === 2);

/** drive a Progress along the route at `lane` metres right of the line, in 2 m steps */
function drive(p: Progress, from: number, to: number, lane = 2) {
  const passed: number[] = [];
  for (let s = from; s <= to; s += 2) {
    const a = route.at(s);
    const k = p.update(a.x - a.dz * lane, a.z + a.dx * lane, Math.atan2(a.dx, a.dz), 20);
    if (k >= 0) passed.push(k);
  }
  return passed;
}

{
  const p = new Progress(route);
  const passed = drive(p, 0, route.length);
  check('driving the route passes every checkpoint once, in order', passed.length === cps.length && passed.every((k, i) => k === i), passed);
  check('and finishes', p.finished && p.next === cps.length);
}
{
  // a car far off the route (another street) makes no progress
  const p = new Progress(route);
  drive(p, 0, 60);
  const s0 = p.s;
  const a = route.at(300);
  p.update(a.x + 60, a.z + 60, 0, 20);
  check('no progress off the route', p.s === s0 && p.off > 18, {
    s: p.s,
    s0,
    off: p.off,
  });
}
{
  // jumping ahead past a checkpoint (a shortcut) is capped at that checkpoint until it is driven through
  const p = new Progress(route);
  drive(p, 0, 10);
  const first = cps[0];
  const a = route.at(first.s + 120);
  p.update(a.x, a.z, Math.atan2(a.dx, a.dz), 20);
  check('a shortcut gains nothing past the next checkpoint', p.next <= 1 && p.s <= first.s + 1 + 1e-6, { s: p.s, cp: first.s, next: p.next });
}
{
  const p = new Progress(route);
  const a = route.at(80);
  p.update(a.x - a.dz * 2, a.z + a.dx * 2, Math.atan2(-a.dx, -a.dz), 15);
  check('driving against the route is wrong way', p.wrongWay);
  p.update(a.x - a.dz * 2, a.z + a.dx * 2, Math.atan2(a.dx, a.dz), 15);
  check('and the right way is not', !p.wrongWay);
}
{
  const a = new Progress(route);
  const b = new Progress(route);
  drive(a, 0, 400);
  drive(b, 0, 300);
  check('further along leads', compareProgress(a, b, null, null) > 0 && compareProgress(b, a, null, null) < 0);
  check('a finisher beats anyone still racing', compareProgress(b, a, 90, null) > 0 && compareProgress(a, b, null, 90) < 0);
  check('earlier finish wins', compareProgress(a, b, 80, 95) > 0 && compareProgress(a, b, 99, 95) < 0);
}
{
  // a reset spot keeps clear of cars and lands on our side of the road
  const p = route.at(200);
  const blockers = [0, 4, 8, 12].map((d) => {
    const q = route.at(200 + d);
    return { x: q.x - q.dz * 2.25, z: q.z + q.dx * 2.25 };
  });
  const spot = freeSpot(route, 200, blockers);
  const clear = blockers.every((o) => Math.hypot(o.x - spot.x, o.z - spot.z) > 9);
  check('reset spot is clear of the queue and on our side', clear && spot.lane > 0 && spot.s >= 200, { spot, p });
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
