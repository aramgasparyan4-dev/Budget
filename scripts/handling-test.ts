// Turning help (handlingAssist) on every garage car, on a flat Rapier ground: tighter turns and less
// sliding at city speeds, settles after a flick, and the drift still works with it on.
// Run: npx tsx scripts/handling-test.ts
import * as THREE from 'three';
import { initRapier, Physics } from '../src/engine/Physics';
import { DrivableVehicle } from '../src/game/DrivableVehicle';
import { ARCHETYPES } from '../src/mygarage/garage/archetypes';
import { wrapAngle } from '../src/core/math';

await initRapier();
let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(info)}`);
  if (!ok) failed++;
};

const h = 1 / 60;
function rig(type: number, assist: boolean) {
  const physics = new Physics();
  physics.addStaticBox(0, -1, 0, 3000, 1, 3000, 0, undefined, 1.0);
  const car = new DrivableVehicle(physics, type, 0, 0.02, 0, 0, new THREE.Color(0xff0000), 'player');
  car.driftAssist = true;
  car.handlingAssist = assist;
  const keys = new Set<string>();
  const input = { down: (c: string) => keys.has(c), hit: () => false } as never;
  const step = (ks: string[]) => {
    keys.clear();
    for (const k of ks) keys.add(k);
    car.control(h, input, true);
    physics.world.step(physics.events);
  };
  /** get up to speed (km/h) in a straight line */
  const launch = (kmh: number) => {
    for (let i = 0; i < 60 * 15 && car.speed * 3.6 < kmh; i++) step(['KeyW']);
  };
  return { car, step, launch, done: () => car.dispose() };
}

/** two seconds of full left lock, holding the speed (km/h) with the throttle */
function turn(type: number, assist: boolean, kmh: number) {
  const r = rig(type, assist);
  r.launch(kmh);
  let maxSlip = 0;
  let turned = 0;
  let dist = 0;
  let last = r.car.yaw;
  for (let i = 0; i < 120; i++) {
    r.step(r.car.speed * 3.6 < kmh ? ['KeyW', 'KeyA'] : ['KeyA']);
    turned += wrapAngle(r.car.yaw - last);
    dist += r.car.speed * h;
    last = r.car.yaw;
    if (i > 30) maxSlip = Math.max(maxSlip, Math.abs(r.car.slipAngle));
  }
  // turning radius in metres: smaller is a tighter turn
  const out = { radius: Math.round(dist / Math.abs(turned)), maxSlip: Math.round(maxSlip), kmh: Math.round(r.car.speed * 3.6) };
  r.done();
  return out;
}

for (const kmh of [50, 80]) {
  const rows = ARCHETYPES.map((a) => ({ id: a.id, off: turn(a.type, false, kmh), on: turn(a.type, true, kmh) }));
  for (const r of rows)
    console.log(
      `  ${kmh} km/h ${r.id.padEnd(10)} off r=${String(r.off.radius).padStart(3)} m slip ${String(r.off.maxSlip).padStart(2)}°   on r=${String(r.on.radius).padStart(3)} m slip ${String(r.on.maxSlip).padStart(2)}°`,
    );
  check(
    `at ${kmh} km/h every car turns tighter with the assist (radius at least 12% smaller)`,
    rows.every((r) => r.on.radius <= r.off.radius * 0.88),
    rows.map((r) => [r.id, r.off.radius, r.on.radius]),
  );
  check(
    `and stays planted (at most 3 degrees more slip, never over 12)`,
    rows.every((r) => r.on.maxSlip <= Math.min(12, r.off.maxSlip + 3)),
    rows.map((r) => [r.id, r.off.maxSlip, r.on.maxSlip]),
  );
}

// a flick of the wheel at speed, then straight: the car settles instead of fishtailing
{
  const res = ARCHETYPES.map((a) => {
    const r = rig(a.type, true);
    r.launch(70);
    for (let i = 0; i < 18; i++) r.step(['KeyW', 'KeyD']);
    for (let i = 0; i < 60; i++) r.step(['KeyW']);
    const yawRate = Math.abs(r.car.body.angvel().y);
    const slip = Math.abs(r.car.slipAngle);
    r.done();
    return { id: a.id, yawRate: +yawRate.toFixed(3), slip: Math.round(slip) };
  });
  check(
    'after a flick the car is straight again within a second',
    res.every((x) => x.yawRate < 0.08 && x.slip < 4),
    res,
  );
}

// the drift still kicks in and holds with the assist on
{
  const res = ARCHETYPES.map((a) => {
    const r = rig(a.type, true);
    r.launch(65);
    let maxSlip = 0;
    let drifting = false;
    for (let i = 0; i < 15; i++) r.step(['KeyW', 'KeyA', 'Space']);
    for (let i = 0; i < 60; i++) {
      r.step(['KeyW', 'KeyA']);
      drifting ||= r.car.drifting;
      maxSlip = Math.max(maxSlip, Math.abs(r.car.slipAngle));
    }
    r.done();
    return { id: a.id, drifting, maxSlip: Math.round(maxSlip) };
  });
  check(
    'Space + steer still drifts every car',
    res.every((x) => x.drifting && x.maxSlip > 12),
    res,
  );
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
