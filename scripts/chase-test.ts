// Unit checks for the police chase: the road (motorway, town, docks), the two-way downtown traffic
// and the police driver.
// Run with `npx tsx scripts/chase-test.ts`
import { RoadGen, Path, CHASE_BOUND, CHASE_MOTORWAY, CHASE_TOWN, DOCKS_GATE, JUNCTION_W, laneLat } from '../src/mygarage/highway/road';
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
  gen.extend(root, Infinity);
  let worstHead = 0;
  let maxJump = 0;
  let switches = 0;
  let minStreetR = Infinity;
  let badJunction = 0;
  let junctions = 0;
  let tunnels = 0;
  let townTunnels = 0;
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
    if (p.tunnel) tunnels++;
    if (p.tunnel && p.street) townTunnels++;
    if (p.street) for (const k of [p.k0, p.k1]) if (Math.abs(k) > 1e-9) minStreetR = Math.min(minStreetR, 1 / Math.abs(k));
    for (const j of p.junctions) {
      junctions++;
      // cross streets sit on straights, with room either side inside the piece
      if (Math.abs(p.k0) > 1e-9 || Math.abs(p.k1) > 1e-9 || j < JUNCTION_W / 2 + 4 || j > p.len - JUNCTION_W / 2 - 4) badJunction++;
    }
  }
  const town = root.pieces.find((p) => p.street)!;
  const docks = root.pieces[root.pieces.length - 1];
  check('the chase road ends: no forks, and nothing laid past the docks', root.children === null && root.plan.done && root.finish !== null);
  const len = root.length;
  gen.extend(root, Infinity);
  check('asking for more road lays none', root.length === len, { len, now: root.length });
  check('motorway first, then town: one switch, never back', switches === 1 && !root.pieces[0].street, switches);
  check(`the motorway runs about ${CHASE_MOTORWAY / 1000} km, the town about ${CHASE_TOWN / 1000} km`, town.s0 > CHASE_MOTORWAY && town.s0 < CHASE_MOTORWAY + 1200 && docks.s0 - town.s0 > CHASE_TOWN - 50 && docks.s0 - town.s0 < CHASE_TOWN + 600, { town: town.s0, docks: docks.s0 });
  check('the road ends at the docks, gates near the start of them', docks.zone === 'docks' && docks.street && root.finish === docks.s0 + DOCKS_GATE && root.length - root.finish! > 200, { zone: docks.zone, finish: root.finish, length: root.length });
  check('pieces join up', maxJump < 0.01, maxJump);
  check('its heading stays within the bound of where it started', worstHead <= CHASE_BOUND + 1e-6, worstHead);
  check('downtown corners are tight (40-115 m)', minStreetR >= 40 && minStreetR < 116, minStreetR);
  check('cross streets on straights, with room', junctions > 5 && badJunction === 0, { junctions, badJunction });
  check('tunnels on the motorway, none in town', tunnels > 0 && townTunnels === 0, { tunnels, townTunnels });
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
  // every seed gets there in the same few kilometres
  const lens: number[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const g = new RoadGen(seed, 'chase');
    const r = g.root({ x: 0, z: 0, h: 0 });
    g.extend(r, Infinity);
    lens.push(Math.round(r.finish ?? -1));
  }
  check('every seed: the dock gates 4-6 km down the road', lens.every((l) => l > 4000 && l < 6000), lens);
}

// ------------------------------------------------------------------ traffic downtown
{
  const gen = new RoadGen(77, 'chase');
  const root = gen.root({ x: 0, z: 0, h: 0 });
  gen.extend(root, Infinity);
  // a straight stretch of town, well clear of the motorway
  const T = root.pieces.find((p) => p.street && p.s0 > root.pieces.find((q) => q.street)!.s0 + 200 && p.k0 === 0 && p.k1 === 0 && p.len > 120)!.s0;
  const tr = new Traffic(new Rand(3));
  // an oncoming car heading for someone stopped in its lane, 60 m away
  const c = tr.spawn(root, T + 100, 0, true)!;
  const ol = root.oncomingLat(0, T + 40)!;
  const you: Driver = { path: root, s: T + 40, lat: ol, v: 0, len: 4.6, width: 1.9 };
  c.v = 13;
  for (let i = 0; i < 400; i++) tr.update(1 / 30, you);
  check('downtown, a car coming the other way stops for you in its lane', c.s > T + 40 + 3 && c.v < 0.5, { s: c.s - T, v: c.v });
  // and our way: city speeds
  const t2 = new Traffic(new Rand(5));
  const a = t2.spawn(root, T, 1)!;
  for (let i = 0; i < 300; i++) t2.update(1 / 30, null);
  check('downtown traffic keeps to city speeds', a.v < 16.5 && a.v > 9, a.v);
  // a police car with its lights on behind: the car ahead moves over
  const t3 = new Traffic(new Rand(9));
  const b = t3.spawn(root, T + 40, 0)!;
  const cop: Driver = { path: root, s: T, lat: laneLat(0), v: 25, len: 4.75, width: 1.88 };
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
  gen.extend(root, Infinity);
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

// ------------------------------------------------------------------ boxing you in
{
  // the same simple car model; you are stopped on a straight bit of motorway
  const gen = new RoadGen(2024, 'chase');
  const root = gen.root({ x: 0, z: 0, h: 0.2 });
  gen.extend(root, Infinity);
  const straight = root.pieces.find((p) => !p.street && p.k0 === 0 && p.k1 === 0 && p.len > 200 && p.s0 > 300)!;
  const run = (copS: number, copV: number, youV: number, seconds: number) => {
    const you: Driver = { path: root, s: straight.s0 + 120, lat: laneLat(1), v: youV, len: 4.6, width: 1.9 };
    const start = root.pose(copS === 0 ? you.s : you.s + copS, laneLat(1));
    const car = { x: start.x, z: start.z, yaw: start.h, v: copV };
    const me: Driver = { path: root, s: you.s + copS, lat: laneLat(1), v: copV, len: 4.75, width: 1.88 };
    const ai = new CopDriver();
    const dt = 1 / 30;
    let minBrakeGap = Infinity;
    let maxAllowAhead = 0;
    for (let i = 0; i < seconds * 30; i++) {
      you.s += you.v * dt;
      const ms = 0.58 / (1 + Math.abs(car.v) / 13);
      const out = ai.update(dt, me, { x: car.x, z: car.z, yaw: car.yaw, speed: car.v, wheelBase: 2.85, maxSteer: ms }, you, [], [me], 45);
      car.v += (out.throttle * 6.5 - out.brake * 9 - (out.handbrake ? 9 : 0) - 0.002 * car.v * car.v) * dt;
      car.v = Math.max(0, car.v);
      car.yaw += ((car.v * Math.tan(out.steer * ms)) / 2.85) * dt;
      car.x += Math.sin(car.yaw) * car.v * dt;
      car.z += Math.cos(car.yaw) * car.v * dt;
      const pr = root.project(car.x, car.z, me.s);
      me.s = pr.s;
      me.lat = pr.lat;
      me.v = car.v;
      if (me.s > you.s) maxAllowAhead = Math.max(maxAllowAhead, car.v);
      if (out.brake > 0.5) minBrakeGap = Math.min(minBrakeGap, me.s - you.s);
    }
    return { gap: me.s - you.s, v: car.v, lat: me.lat - you.lat, minBrakeGap, maxAllowAhead };
  };
  // coming up fast from 80 m behind a stopped car: it pulls up right behind and stays there
  const behind = run(-80, 28, 0, 8);
  check('you stopped: a police car from behind pulls up on your bumper and stays', behind.gap > -10 && behind.gap < -3 && behind.v < 1, behind);
  // one just ahead when you stop: it stops in front of you, it does not drive off
  const ahead = run(12, 8, 0, 6);
  check('you stopped: a police car just ahead stops in front of you', ahead.gap > 4 && ahead.gap < 25 && ahead.v < 1, ahead);
  // you at speed with one ahead in your lane: it brakes in your path (you close on it)
  const front = run(20, 25, 25, 2);
  check('a police car ahead of you at speed brakes in your path', front.gap < 20 - 6 && front.v < 25 - 4, front);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
