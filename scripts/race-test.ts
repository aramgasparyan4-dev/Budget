// Headless race check: the rival driver on real routes with real physics, city collision and dense
// traffic (no rendering). Run: npx tsx scripts/race-test.ts [races=6]
import * as THREE from 'three';
import { initRapier, Physics } from '../src/engine/Physics';
import { generateCity } from '../src/world/CityGenerator';
import { buildPropModels } from '../src/render/propModels';
import { TrafficSystem } from '../src/sim/traffic/TrafficSystem';
import { DrivableVehicle } from '../src/game/DrivableVehicle';
import { VEHICLES } from '../src/sim/vehicles';
import { freeSpot, planRoute, RACE_TRAFFIC, RivalDriver, Route } from '../src/mygarage/race';

await initRapier();
const SEED = 20261019;
const city = generateCity(SEED);
const physics = new Physics();
physics.buildCity(city, buildPropModels(), SEED);
const races = Number(process.argv[2] ?? 6);
let failed = 0;
const check = (name: string, ok: boolean, info: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(info)}`);
  if (!ok) failed++;
};

// routes are valid
for (let k = 0; k < 30; k++) {
  const r = planRoute(city, 1000 + k);
  const turns = r.pts.length - 2;
  const inside = r.pts.every((p) => Math.abs(p.x) < 560 && Math.abs(p.z) < 560);
  if (k < 3 || r.length < 1300 || r.length > 2300 || turns < 2 || !inside)
    check(`route ${k}`, r.length >= 1300 && r.length <= 2300 && turns >= 2 && inside, {
      length: Math.round(r.length),
      turns,
      checkpoints: r.checkpoints.length,
    });
}

function placeOn(route: Route, car: DrivableVehicle, s: number, lane: number) {
  const p = route.at(s);
  car.teleport(p.x + -p.dz * lane, 0.02, p.z + p.dx * lane, Math.atan2(p.dx, p.dz));
}

const results: unknown[] = [];
const only = process.env.ONLY ? Number(process.env.ONLY) : -1;
for (let k = 0; k < races; k++) {
  if (only >= 0 && k !== only) continue;
  const route = planRoute(city, 5000 + k * 17);
  const traffic = new TrafficSystem(city, physics, SEED + k);
  Object.assign(traffic, {
    ...RACE_TRAFFIC,
    spawnRadius: { ...RACE_TRAFFIC.spawnRadius },
  });
  // the rival's car in the game: the sports coupe archetype with the turning help on
  const cars = [12, 12].map((t, i) => new DrivableVehicle(physics, t, 0, 0.02, 0, 0, new THREE.Color(i ? 0x00c8ff : 0xff2a2a), 'player'));
  for (const c of cars) c.handlingAssist = true;
  const drivers = cars.map(() => new RivalDriver(route));
  drivers[0].lane = 2.25;
  drivers[1].lane = 5.75;
  cars.forEach((c, i) => placeOn(route, c, 0, drivers[i].lane));
  let hits = 0;
  let resets = 0;
  const DEBUG = process.env.DEBUG === '1';
  cars.forEach(
    (c, i) =>
      (c.onImpact = (dv) => {
        if (dv <= 9) return;
        hits++;
        if (!DEBUG) return;
        const d = drivers[i];
        const corner = route.nextCorner(d.s);
        const prevCorner =
          route.pts
            .slice(1, -1)
            .map((_, k) => route.s[k + 1])
            .filter((x) => x <= d.s)
            .pop() ?? 0;
        let near = { d: Infinity, state: '', rel: 0, v: 0 };
        for (const v of traffic.vehicles.concat(traffic.parked)) {
          const dd = Math.hypot(v.x - c.pos.x, v.z - c.pos.z);
          if (dd < near.d)
            near = {
              d: dd,
              state: v.state,
              rel: Math.round(((((((v.yaw - c.yaw) * 180) / Math.PI) % 360) + 540) % 360) - 180),
              v: Math.round(v.v),
            };
        }
        const od = Math.hypot(cars[1 - i].pos.x - c.pos.x, cars[1 - i].pos.z - c.pos.z);
        let inter = Infinity;
        for (const it of city.intersections) inter = Math.min(inter, Math.max(Math.abs(it.x - c.pos.x) - it.hx, Math.abs(it.z - c.pos.z) - it.hz));
        const p = route.project(c.pos.x, c.pos.z, d.s);
        console.log(
          `  hit car${i} t=${t.toFixed(1)} dv=${dv.toFixed(1)} s=${Math.round(d.s)} toCorner=${corner ? Math.round(corner.s - d.s) : '-'} sinceCorner=${Math.round(d.s - prevCorner)} lat=${p.lat.toFixed(1)} lane=${d.lane} limit=${d.limit} spd=${Math.round(c.forwardSpeed)} interEdge=${inter.toFixed(1)} nearest=${near.d.toFixed(1)}/${near.state}/rel${near.rel}/v${near.v} other=${od.toFixed(1)}`,
        );
      }),
  );
  const center = new THREE.Vector3();
  const fwd = new THREE.Vector2(0, 1);
  // warm up traffic around the start
  center.set(cars[0].pos.x, 0, cars[0].pos.z);
  for (let i = 0; i < 300; i++) traffic.update(1 / 20, center, fwd, 17.6);
  const h = 1 / 60;
  let t = 0;
  const finish: (number | null)[] = [null, null];
  const prof: Record<string, number> = {};
  while (t < 240 && finish.some((f) => f === null)) {
    center.set((cars[0].pos.x + cars[1].pos.x) / 2, 0, (cars[0].pos.z + cars[1].pos.z) / 2);
    traffic.obstacles.length = 0;
    for (const c of cars)
      traffic.obstacles.push({
        x: c.pos.x,
        z: c.pos.z,
        r: c.spec.width * 0.6 + 0.4,
        kind: 'playerCar',
      });
    traffic.update(h, center, fwd, 17.6);
    traffic.syncBodies(center);
    cars.forEach((c, i) => {
      if (finish[i] !== null) {
        c.aiInput = { throttle: 0, brake: 1, steer: 0, handbrake: false };
        return;
      }
      const other = cars[1 - i];
      const obs = traffic.vehicles.filter((v) => Math.abs(v.x - c.pos.x) < 95 && Math.abs(v.z - c.pos.z) < 95).map((v) => ({ x: v.x, z: v.z, v: v.v, yaw: v.yaw }));
      obs.push({
        x: other.pos.x,
        z: other.pos.z,
        v: other.forwardSpeed,
        yaw: other.yaw,
      });
      const ms = c.spec.steer / (1 + Math.abs(c.forwardSpeed) / 13);
      c.aiInput = drivers[i].update(
        h,
        {
          x: c.pos.x,
          z: c.pos.z,
          yaw: c.yaw,
          speed: c.forwardSpeed,
          wheelBase: c.spec.wheelBase,
          maxSteer: ms,
          grip: c.spec.grip,
        },
        obs,
      );
      if (drivers[i].stuckT > 3) {
        if (DEBUG)
          console.log(
            `  stuck car${i} t=${t.toFixed(1)} s=${Math.round(drivers[i].s)} lat=${route.project(c.pos.x, c.pos.z, drivers[i].s).lat.toFixed(1)} lane=${drivers[i].lane} limit=${drivers[i].limit}`,
          );
        const spot = freeSpot(route, drivers[i].s + 6, [...traffic.vehicles, ...traffic.parked, other.pos]);
        c.teleport(spot.x, 0.02, spot.z, spot.yaw);
        drivers[i].reset(spot.s, spot.lane);
        resets++;
      }
      if (drivers[i].s >= route.length - 3) finish[i] = t;
      const key = Math.abs(c.forwardSpeed) < 1 ? `stopped-${drivers[i].limit}` : drivers[i].limit;
      prof[key] = (prof[key] ?? 0) + h;
    });
    for (const c of cars) c.control(h, null, true);
    physics.world.step(physics.events);
    t += h;
  }
  const avg = route.length / Math.max(...finish.map((f) => f ?? 240));
  const r = {
    route: Math.round(route.length),
    turns: route.pts.length - 2,
    finish: finish.map((f) => (f === null ? null : Math.round(f))),
    avgKmh: Math.round(avg * 3.6),
    hits,
    resets,
  };
  results.push(r);
  console.log(JSON.stringify(r));
  if (DEBUG) console.log('  time by limit', JSON.stringify(Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, Math.round(v)]))));
  cars.forEach((c) => c.dispose());
  traffic.dispose();
}
const done = results.filter((r) => (r as { finish: (number | null)[] }).finish.every((f) => f !== null)).length;
check('rival finishes races', done >= Math.ceil(races * 0.8), { done, races });
const times = results.flatMap((r) => (r as { finish: (number | null)[] }).finish.filter((f): f is number => f !== null)).sort((a, b) => a - b);
check('rival pace', times.length > 0 && times[Math.floor(times.length / 2)] < 190, { median: times[Math.floor(times.length / 2)] });
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
