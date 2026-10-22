// Unit checks for the police chase: the road, the two-way downtown traffic and the police driver.
// Run with `npx tsx scripts/chase-test.ts`
import { RoadGen, Path, CHASE_BOUND, JUNCTION_W, laneLat } from '../src/mygarage/highway/road';
import { Traffic, type Driver } from '../src/mygarage/highway/traffic';
import { CopDriver, cornerLimit, curvature } from '../src/mygarage/highway/police';
import { Rand } from '../src/mygarage/highway/road';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info));
  if (!ok) failed++;
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------ the road
{
  const h0 = 0.4;
  const gen = new RoadGen(4242, 'chase');
  const root = gen.root({ x: 0, z: 0, h: h0 });
  gen.extend(root, 40000);
  let worstHead = 0;
  let maxJump = 0;
  let switches = 0;
  let minStreetR = Infinity;
  let badJunction = 0;
  let junctions = 0;
  let streets = 0;
  let tunnels = 0;
  let last = root.pieces[0].street;
  for (const p of root.pieces) {
    for (let i = 0; i < p.hs.length; i++) worstHead = Math.max(worstHead, Math.abs(wrap(p.hs[i] - h0)));
    if (p.index > 0) {
      const q = root.pieces[p.index - 1];
      const e = q.xs.length - 1;
      maxJump = Math.max(maxJump, Math.hypot(q.xs[e] - p.xs[0], q.zs[e] - p.zs[0]));
    }
    if (p.street !== last) switches++;
    last = p.street;
    if (p.street) streets++;
    if (p.tunnel) tunnels++;
    if (p.street) for (const k of [p.k0, p.k1]) if (Math.abs(k) > 1e-9) minStreetR = Math.min(minStreetR, 1 / Math.abs(k));
    for (const j of p.junctions) {
      junctions++;
      // cross streets sit on straights, with room either side inside the piece
      if (Math.abs(p.k0) > 1e-9 || Math.abs(p.k1) > 1e-9 || j < JUNCTION_W / 2 + 4 || j > p.len - JUNCTION_W / 2 - 4) badJunction++;
    }
  }
  check('the chase road goes on (40 km) with no forks', root.length >= 40000 && root.children === null, root.length);
  check('pieces join up', maxJump < 0.01, maxJump);
  check('its heading stays within the bound of where it started', worstHead <= CHASE_BOUND + 1e-6, worstHead);
  check('downtown streets and motorway take turns', switches >= 10 && streets > 50, { switches, streets });
  check('downtown corners are tight (40 m and up)', minStreetR >= 40 && minStreetR < 70, minStreetR);
  check('cross streets on straights, with room', junctions > 40 && badJunction === 0, { junctions, badJunction });
  check('tunnels out of town', tunnels > 0, tunnels);
  // it never comes back across itself: points far apart along it are far apart on the ground
  let close = Infinity;
  const pts: { s: number; x: number; z: number }[] = [];
  for (let s = 0; s < root.length; s += 25) {
    const q = root.pose(s);
    pts.push({ s, x: q.x, z: q.z });
  }
  for (let i = 0; i < pts.length; i++) for (let j = i + 12; j < pts.length; j++) close = Math.min(close, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
  check('it never comes back across itself (300 m apart along it: 150 m apart on the ground)', close > 150, close);
  // two-way downtown, the other direction right beside
  const st = root.pieces.find((p) => p.street && p.companion && p.companion.d0 < 1)!;
  const mid = st.s0 + st.len / 2;
  check('downtown the other way is right beside, two lanes', root.street(mid) && (root.companionGap(mid) ?? 9) < 1 && root.compLanes === 2 && root.oncomingLat(0, mid)! < 0 && root.oncomingLat(0, mid)! > -4);
}

// ------------------------------------------------------------------ traffic downtown
{
  const gen = new RoadGen(77, 'chase');
  const root = gen.root({ x: 0, z: 0, h: 0 });
  gen.extend(root, 3000);
  const tr = new Traffic(new Rand(3));
  // an oncoming car heading for someone stopped in its lane, 60 m away
  const c = tr.spawn(root, 200, 0, true)!;
  const ol = root.oncomingLat(0, 140)!;
  const you: Driver = { path: root, s: 140, lat: ol, v: 0, len: 4.6, width: 1.9 };
  c.v = 13;
  for (let i = 0; i < 400; i++) tr.update(1 / 30, you);
  check('downtown, a car coming the other way stops for you in its lane', c.s > 140 + 3 && c.v < 0.5, { s: c.s, v: c.v });
  // and our way: city speeds
  const t2 = new Traffic(new Rand(5));
  const a = t2.spawn(root, 60, 1)!;
  for (let i = 0; i < 300; i++) t2.update(1 / 30, null);
  check('downtown traffic keeps to city speeds', a.v < 16.5 && a.v > 9, a.v);
  // a police car with its lights on behind: the car ahead moves over
  const t3 = new Traffic(new Rand(9));
  const b = t3.spawn(root, 100, 0)!;
  const cop: Driver = { path: root, s: 60, lat: laneLat(0), v: 25, len: 4.75, width: 1.88 };
  for (let i = 0; i < 150; i++) {
    cop.s = Math.min(b.s - 20, cop.s + cop.v / 30);
    t3.update(1 / 30, null, [cop], [cop]);
  }
  check('traffic moves over for a police car with its lights on', b.lane === 1, { lane: b.lane, lat: b.lat });
}

// ------------------------------------------------------------------ the police driver
{
  // a simple car: bicycle model with a grip limit, driven by the police AI behind a target on the road
  const gen = new RoadGen(2024, 'chase');
  const root = gen.root({ x: 0, z: 0, h: 0.2 });
  gen.extend(root, 9000);
  const target: Driver = { path: root, s: 220, lat: laneLat(1), v: 0, len: 4.6, width: 1.9 };
  const start = root.pose(80, laneLat(0));
  const car = { x: start.x, z: start.z, yaw: start.h, v: 15 };
  const me: Driver = { path: root, s: 80, lat: laneLat(0), v: 15, len: 4.75, width: 1.88 };
  const ai = new CopDriver();
  const dt = 1 / 30;
  let worstOff = 0;
  let closest = Infinity;
  let maxSpeedTarget = 0;
  for (let i = 0; i < 30 * 150; i++) {
    // the target drives the road at a sensible speed for the corners
    const vt = Math.min(24, cornerLimit(root, target.s, target.v, 7.5));
    target.v += Math.max(-7 * dt, Math.min(3 * dt, vt - target.v));
    target.s += target.v * dt;
    maxSpeedTarget = Math.max(maxSpeedTarget, target.v);
    const ms = 0.58 / (1 + Math.abs(car.v) / 13);
    const out = ai.update(dt, me, { x: car.x, z: car.z, yaw: car.yaw, speed: car.v, wheelBase: 2.85, maxSteer: ms }, target, [], [me], 40);
    car.v += (out.throttle * 6.5 - out.brake * 9 - 0.002 * car.v * car.v) * dt;
    car.v = Math.max(0, car.v);
    let yawRate = (car.v * Math.tan(out.steer * ms)) / 2.85;
    const aMax = 9.5;
    if (Math.abs(yawRate * car.v) > aMax) yawRate = (Math.sign(yawRate) * aMax) / Math.max(1, car.v);
    car.yaw += yawRate * dt;
    car.x += Math.sin(car.yaw) * car.v * dt;
    car.z += Math.cos(car.yaw) * car.v * dt;
    const pr = root.project(car.x, car.z, me.s);
    me.s = pr.s;
    me.lat = pr.lat;
    me.v = car.v;
    const street = root.street(me.s);
    const g = root.companionGap(me.s) ?? 0;
    const minLat = street ? -(g + 6.8) : -1.3;
    // the hard shoulder, or downtown the pavement, is allowed; past it is the rail or the buildings
    const maxLat = root.rightEdge(me.s) + (street ? 3.6 : 3);
    worstOff = Math.max(worstOff, minLat - me.lat, me.lat - maxLat);
    closest = Math.min(closest, target.s - me.s);
  }
  check('the police car stays on the road through the corners', worstOff < 0.6, { worstOff, s: me.s });
  check('and catches up with you', closest < 12, closest);
  // a tight corner: it already wants to be slower 30 m before it
  const bend = root.pieces.find((p) => p.street && Math.abs(p.k0) > 1 / 60 && p.k0 === p.k1)!;
  check('it brakes for corners from the road ahead', cornerLimit(root, bend.s0 - 30, 30) < 30 && Math.abs(curvature(root, bend.s0 + 1)) > 1 / 60, cornerLimit(root, bend.s0 - 30, 30));
  void Path;
  void maxSpeedTarget;
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
