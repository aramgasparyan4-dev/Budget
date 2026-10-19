// Headless drift handling check: the real DrivableVehicle on a flat Rapier ground.
// Run: npx tsx scripts/drift-test.ts            (asserts, all Near Miss cars)
//      npx tsx scripts/drift-test.ts 3 1 trace  (prints a trace for one car, assist on/off)
import * as THREE from 'three';
import { initRapier, Physics } from '../src/engine/Physics';
import { DrivableVehicle } from '../src/game/DrivableVehicle';

await initRapier();
const trace = process.argv[4] === 'trace';
let failed = 0;

function drive(type: number, assist: boolean) {
  const physics = new Physics();
  physics.addStaticBox(0, -1, 0, 3000, 1, 3000, 0, undefined, 1.0);
  const car = new DrivableVehicle(physics, type, 0, 0.02, 0, 0, new THREE.Color(0xff0000), 'player');
  car.driftAssist = assist;
  const keys = new Set<string>();
  const input = { down: (c: string) => keys.has(c), hit: () => false } as never;
  const h = 1 / 60;
  let t = 0;
  const log: Record<string, { speed: number; slip: number; drifting: boolean }[]> = {};
  const run = (secs: number, ks: string[], label: string) => {
    keys.clear();
    for (const k of ks) keys.add(k);
    const rows: { speed: number; slip: number; drifting: boolean }[] = (log[label] = []);
    for (let i = 0; i < Math.round(secs / h); i++) {
      car.control(h, input, true);
      physics.world.step(physics.events);
      t += h;
      const v = car.body.linvel();
      rows.push({ speed: Math.hypot(v.x, v.z) * 3.6, slip: car.slipAngle, drifting: car.drifting });
      if (trace && i % 15 === 0) console.log(`${label.padEnd(14)} t=${t.toFixed(2)} ${(Math.hypot(v.x, v.z) * 3.6).toFixed(0)}km/h slip=${car.slipAngle.toFixed(0)}° drifting=${car.drifting}`);
    }
  };
  run(5, ['KeyW'], 'accelerate');
  run(0.25, ['KeyW', 'KeyA', 'Space'], 'kick');
  run(2, ['KeyW', 'KeyA'], 'hold');
  run(1, ['KeyW', 'KeyD'], 'counter');
  run(1.5, ['KeyW'], 'straight');
  car.dispose();
  return log;
}

const check = (name: string, ok: boolean, info: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(info)}`);
  if (!ok) failed++;
};

if (trace) {
  drive(Number(process.argv[2] ?? 3), process.argv[3] !== '0');
  process.exit(0);
}
for (const type of [3, 8, 4, 0]) {
  const name = `type ${type}`;
  const log = drive(type, true);
  const hold = log.hold.slice(30); // after the slide has built up
  const minSlip = Math.min(...hold.map((r) => Math.abs(r.slip)));
  const maxSlip = Math.max(...hold.map((r) => Math.abs(r.slip)));
  const v0 = log.kick[0].speed;
  const vEnd = log.hold[log.hold.length - 1].speed;
  check(`${name}: drift holds an angle while steering into it`, hold.every((r) => r.drifting) && minSlip > 15 && maxSlip < 45, { minSlip: +minSlip.toFixed(1), maxSlip: +maxSlip.toFixed(1) });
  check(`${name}: keeps most of its speed`, vEnd > v0 * 0.65, { v0: Math.round(v0), vEnd: Math.round(vEnd) });
  const out = log.straight[log.straight.length - 1];
  check(`${name}: counter-steer and straightening end the drift with grip back`, !out.drifting && Math.abs(out.slip) < 3, out);
  const base = drive(type, false);
  const baseMax = Math.max(...base.hold.map((r) => Math.abs(r.slip)));
  check(`${name}: without the assist (Echo City) the car still grips`, baseMax < 8 && !base.hold.some((r) => r.drifting), { baseMax: +baseMax.toFixed(1) });
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
