// End-to-end test for MyGarage Drive in headless Chromium: free drive, the race, the police chase
// (motorway, town, docks), the garage, an A4 frame and touch controls.
// Usage: npm run dev (in another shell), then: node scripts/e2e-drive.mjs
// Cars are placed with the traffic system's own spawn() so passes and crashes happen on cue; the game is
// advanced with window.__nm.simulate() because software WebGL draws ~1 frame a second.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = process.env.URL ?? 'http://localhost:5173/?preset=low';
mkdirSync('scripts/out', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${info ? ' ' + JSON.stringify(info) : ''}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
  }
}
const ev = (fn, a) => page.evaluate(fn, a);
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};
const HELPERS = `
window.__t = {
  g: () => window.__nm,
  st: () => window.__nmStore.getState(),
  down: (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })),
  up: (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })),
  press: (code) => { window.__t.down(code); window.__t.up(code); },
  sim: (s) => window.__nm.simulate(s),
  /** quiet streets: no new traffic and nothing within r metres */
  quiet: (r = 90) => {
    const g = window.__nm;
    g.traffic.maxVehicles = 0;
    for (const v of [...g.traffic.vehicles]) if (Math.hypot(v.x - g.car.pos.x, v.z - g.car.pos.z) < r) g.traffic.remove(v);
  },
  /** spawn a sedan on the lane nearest to a point ahead/right of the player */
  spawnRel: (ahead, lateral, sameDir = true) => {
    const g = window.__nm, tr = g.traffic, car = g.car;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), rx = -fz, rz = fx;
    // the point may fall inside an intersection (no lanes there): try a few distances
    for (const a of [ahead, ahead - 8, ahead + 8, ahead - 14, ahead + 16]) {
      const tx = car.pos.x + fx * a + rx * lateral, tz = car.pos.z + fz * a + rz * lateral;
      let best = null, bd = 1e9, bs = 0;
      for (const l of tr.graph.lanes) {
        const dot = l.dx * fx + l.dz * fz;
        if (sameDir ? dot < 0.9 : dot > -0.9) continue;
        const s = (tx - l.x0) * l.dx + (tz - l.z0) * l.dz;
        if (s < 3 || s > l.length - 3) continue;
        const d = Math.hypot(l.x0 + l.dx * s - tx, l.z0 + l.dz * s - tz);
        if (d < bd) { bd = d; best = l; bs = s; }
      }
      if (!best || bd > 2.5) continue;
      const v = tr.spawn(best.id, bs, 1);
      if (v) return { id: v.id, ahead: a, off: +bd.toFixed(2) };
    }
    return null;
  },
  /** put the car on a fixed straight arterial near the middle of the city (forward: lane direction) */
  place: (forward = true, againstTraffic = false) => {
    const g = window.__nm;
    const segs = g.world.city.segments.filter((s) => s.exists && s.cls === 'arterial' && s.length > 70);
    segs.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
    const seg = segs[0];
    let p = g.startPose(seg.id, forward);
    if (againstTraffic) {
      // start of the block, heading along it, but in the lane that runs the other way
      const back = g.startPose(seg.id, false);
      p = seg.orient === 'v' ? { x: back.x, z: p.z, yaw: p.yaw } : { x: p.x, z: back.z, yaw: p.yaw };
    }
    // move first, then clear the streets around where we landed (and any wrench left on the old road)
    g.car.teleport(p.x, 0.02, p.z, p.yaw);
    g.pickups.clear();
    __t.quiet(260);
    window.__nm.simulate(0.2);
    return p;
  },
  /** straighten the car on its road and set it moving */
  launch: (speed) => {
    const car = window.__nm.car;
    const yaw = Math.round(car.yaw / (Math.PI / 2)) * (Math.PI / 2);
    car.teleport(car.pos.x, 0.02, car.pos.z, yaw);
    car.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
    // the car detects impacts from sudden velocity changes: this one is not a crash
    car.lastVel.set(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed);
  },
};
`;

/** pick a car from the garage panel by id (demo cars: demo-bmw-m4, demo-toyota-camry, ...) */
async function pickCar(id) {
  // the "…" on the car card always opens the list of cars
  await page.click('button[aria-label="All cars"]');
  await page.click(`[data-car="${id}"]`);
  await page.waitForTimeout(300);
}

await page.goto(URL);

await step('loads to the title screen', async () => {
  await page.waitForSelector('#btn-drive', { timeout: 240000 });
  await ev(HELPERS);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title.png' });
  return ev(() => ({
    phase: __t.g().phase,
    traffic: __t.g().traffic.vehicles.length,
  }));
});

await step('title: your car parked at the curb, with its garage card', async () => {
  const r = await ev(() => ({
    card: !!document.querySelector('#garage-card'),
    name: document.querySelector('#garage-name')?.textContent,
    type: document.querySelector('#garage-type')?.textContent,
    cars: window.__garage.getState().vehicles().length,
    showroom: !!__t.g().showroom,
    coins: window.__garage.getState().save.coins,
  }));
  assert(r.card && r.name && r.type && r.cars === 10 && r.showroom && r.coins === 500, JSON.stringify(r));
  return r;
});

await step('add your own car with the garage form: it drives as the right type', async () => {
  // with no cars of your own, "Add new vehicle" opens the form straight away
  await page.click('#btn-garage');
  if (!(await page.$('#f-make'))) await page.click('#btn-add-car');
  await page.selectOption('#f-make', 'soueast');
  await page.fill('#f-model', 'DX5');
  await page.selectOption('#f-year', '2024');
  await page.selectOption('#f-color', 'White');
  const match = await ev(() => document.querySelector('#f-match')?.textContent);
  await page.click('#btn-save-car');
  await page.waitForTimeout(400);
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    const out = { name: g.car.label, type: g.car.spec.name, paint: '#' + g.car.paint.getHexString(), phase: g.phase, cars: window.__garage.getState().vehicles().length };
    g.toTitle();
    return out;
  });
  assert(match && match.includes('Crossover'), 'match: ' + match);
  assert(r.name === 'Soueast DX5 2024' && r.type === 'Crossover' && r.paint === '#eeeeea' && r.phase === 'countdown' && r.cars === 11, JSON.stringify(r));
  return { match, ...r };
});

await step('workshop: an engine upgrade costs coins and adds power', async () => {
  await page.click('#btn-workshop');
  const before = await ev(() => ({ coins: window.__garage.getState().save.coins, power: window.__garage.getState().setup().power }));
  await page.click('#up-engine');
  const after = await ev(() => ({
    coins: window.__garage.getState().save.coins,
    power: window.__garage.getState().setup().power,
    level: window.__garage.getState().setup().progress.upgrades.engine,
  }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-workshop.png' });
  await page.keyboard.press('Escape');
  assert(after.level === 1 && after.coins < before.coins && after.power > before.power, JSON.stringify({ before, after }));
  return { before, after };
});

await step('free drive: pick a car and conditions, countdown, then drive; no clock, no score', async () => {
  await pickCar('demo-bmw-m4');
  await page.click('#cond-night');
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    const c0 = g.phase;
    __t.sim(1);
    const still = g.car.forwardSpeed;
    __t.sim(2.4);
    const c1 = g.phase;
    __t.down('KeyW');
    __t.sim(3);
    __t.up('KeyW');
    return {
      mode: g.mode,
      c0,
      still: +still.toFixed(2),
      c1,
      speed: +g.car.forwardSpeed.toFixed(1),
      car: g.car.label,
      onHighway: g.onHighway,
      chase: !!g.chase,
    };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-free.png' });
  const hud = await ev(() => ({
    map: !!document.querySelector('#city-map'),
    distance: !!document.querySelector('#hud-distance'),
    condition: !!document.querySelector('#hud-condition'),
    score: /Score/.test(document.querySelector('#ui')?.textContent ?? ''),
  }));
  assert(r.mode === 'free' && r.c0 === 'countdown' && r.c1 === 'run' && !r.onHighway && !r.chase, JSON.stringify(r));
  assert(Math.abs(r.still) < 0.5, 'car moved during countdown');
  assert(r.speed > 12, 'too slow ' + r.speed);
  assert(hud.map && hud.distance && !hud.condition && !hud.score, 'free drive HUD ' + JSON.stringify(hud));
  return { ...r, hud };
});

await step('free drive: passing a car close scores nothing', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(28);
    const spawned = __t.spawnRel(32, 3.5, true);
    if (!spawned) throw new Error('no lane to the right');
    const other = g.traffic.vehicles.find((v) => v.id === spawned.id);
    other.state = 'stopped';
    let minD = 1e9;
    __t.down('KeyW');
    for (let i = 0; i < 30; i++) {
      __t.sim(0.1);
      minD = Math.min(minD, Math.hypot(other.x - g.car.pos.x, other.z - g.car.pos.z));
    }
    __t.up('KeyW');
    return { near: g.scorer.nearMisses, score: g.scorer.score, combo: Math.round(g.scorer.comboPoints), minD: +minD.toFixed(2), phase: g.phase };
  });
  assert(r.minD < 5 && r.near === 0 && r.score === 0 && r.combo === 0 && r.phase === 'run', JSON.stringify(r));
  return r;
});

await step('free drive: boost adds power and drains, then fills back up by itself', async () => {
  return ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(20);
    g.scorer.boost = 1;
    __t.down('KeyW');
    __t.down('ShiftLeft');
    __t.sim(1);
    const power = g.car.powerMul;
    __t.up('ShiftLeft');
    __t.up('KeyW');
    const drained = g.scorer.boost;
    __t.sim(3);
    const refilled = g.scorer.boost;
    if (power < 1.5 || drained >= 1 || refilled <= drained + 0.1) throw new Error(JSON.stringify({ power, drained, refilled }));
    return { power: +power.toFixed(2), drained: +drained.toFixed(2), refilled: +refilled.toFixed(2) };
  });
});

await step('free drive: Space + steer drifts (skid marks, smoke), for fun only', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(26);
    let maxSlip = 0;
    let wasDrifting = false;
    const seq = [
      [0.15, ['KeyW', 'KeyA', 'Space']],
      [0.15, ['KeyW', 'KeyA']],
      [0.35, ['KeyW', 'KeyD']],
      [1.2, ['KeyW']],
    ];
    for (const [secs, keys] of seq) {
      for (const k of keys) __t.down(k);
      for (let t = 0; t < secs; t += 1 / 30) {
        __t.sim(1 / 30);
        maxSlip = Math.max(maxSlip, Math.abs(g.car.slipAngle));
        wasDrifting = wasDrifting || g.car.drifting;
      }
      for (const k of keys) __t.up(k);
    }
    return { phase: g.phase, wasDrifting, maxSlip: Math.round(maxSlip), skids: g.skids.count, smoke: g.smoke.live, stillDrifting: g.car.drifting, score: g.scorer.score };
  });
  assert(r.phase === 'run', 'drift ended the drive: ' + JSON.stringify(r));
  assert(r.wasDrifting && r.maxSlip > 12 && r.skids > 5 && !r.stillDrifting && r.score === 0, JSON.stringify(r));
  return r;
});

await step('drift in progress on screen (smoke, marks)', async () => {
  await ev(() => {
    __t.place(true);
    __t.launch(26);
    __t.down('KeyW');
    __t.down('KeyA');
    __t.down('Space');
    __t.sim(0.2);
    __t.up('Space');
    __t.sim(0.5);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-drift.png' });
  const r = await ev(() => {
    __t.up('KeyA');
    __t.up('KeyW');
    const g = __t.g();
    const r = { phase: g.phase, smoke: g.smoke.live, skids: g.skids.count };
    // the slow renderer kept the keys held for a while: start a fresh drive for the steps that follow
    g.startRun();
    __t.sim(3.3);
    return r;
  });
  assert(r.skids > 0, JSON.stringify(r));
  return r;
});

await step('Esc pauses (the car stops where it is) and resumes', async () => {
  return ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(15);
    __t.press('Escape');
    const paused = __t.st().paused;
    const p0 = { x: g.car.pos.x, z: g.car.pos.z };
    __t.sim(1);
    const moved = Math.hypot(g.car.pos.x - p0.x, g.car.pos.z - p0.z);
    __t.press('Escape');
    if (!paused || moved > 0.05 || __t.st().paused) throw new Error(JSON.stringify({ paused, moved }));
    return { paused, moved: +moved.toFixed(3) };
  });
});

await step('free drive: a hard crash does no damage and the drive goes on', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(26);
    const s = __t.spawnRel(28, 0, true);
    if (!s) throw new Error('no lane ahead');
    const tv = g.traffic.vehicles.find((v) => v.id === s.id);
    tv.v = 0;
    g.traffic.crash(tv, 60);
    const h0 = g.scorer.health;
    // the hardest impact the car feels (a big hit is 11 m/s and up)
    const onImpact = g.car.onImpact;
    let hit = 0;
    g.car.onImpact = (dv) => {
      hit = Math.max(hit, dv);
      onImpact(dv);
    };
    __t.down('KeyW');
    for (let i = 0; i < 40 && hit < 11; i++) __t.sim(0.1);
    __t.sim(0.5);
    __t.up('KeyW');
    g.car.onImpact = onImpact;
    return { phase: g.phase, h0: Math.round(h0), health: Math.round(g.scorer.health), damaged: g.scorer.damageTaken, hit: +hit.toFixed(1), over: g.scorer.over };
  });
  assert(r.hit >= 11 && r.phase === 'run' && r.health === r.h0 && r.damaged === 0 && r.over === null, JSON.stringify(r));
  return r;
});

await step('free drive: rolled over, it is put back on its wheels', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    const car = g.car;
    const y = car.yaw;
    // upside down, a little off the ground
    car.body.setTranslation({ x: car.pos.x, y: 1.2, z: car.pos.z }, true);
    car.body.setRotation({ x: Math.sin(y), y: 0, z: Math.cos(y), w: 0 }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    __t.sim(0.3);
    const flipped = g.flipT > 0;
    for (let i = 0; i < 30 && g.flipT > 0; i++) __t.sim(0.1);
    __t.sim(0.5);
    const up = 1 - 2 * (car.quat.x * car.quat.x + car.quat.z * car.quat.z);
    return { flipped, up: +up.toFixed(2), phase: g.phase, popups: __t.st().popups.map((p) => p.label), health: Math.round(g.scorer.health) };
  });
  assert(r.flipped && r.up > 0.9 && r.phase === 'run' && r.popups.includes('BACK ON THE ROAD'), JSON.stringify(r));
  return r;
});

await step('free drive: Back to the garage from the pause menu (no results to sit through)', async () => {
  await ev(() => __t.press('Escape'));
  await page.waitForSelector('#btn-quit', { timeout: 10000 });
  const end = await ev(() => !!document.querySelector('#btn-end'));
  await page.click('#btn-quit');
  await page.waitForSelector('#btn-drive', { timeout: 20000 });
  const r = await ev(() => ({ phase: __t.g().phase, result: __t.st().result, high: !!document.querySelector('#high-score') }));
  assert(!end && r.phase === 'title' && r.result === null && !r.high, JSON.stringify({ end, ...r }));
  return r;
});

await step('rain is slippery (lower grip)', async () => {
  await page.click('#cond-rain');
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    __t.sim(3.4);
    return { grip: g.car.gripMul, phase: g.phase };
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'scripts/out/nm-e2e-rain.png' });
  assert(r.grip < 1 && r.phase === 'run', JSON.stringify(r));
  return r;
});

// ------------------------------------------------------------------ race
const RACE = `
window.__r = {
  race: () => window.__nm.race,
  /** put the player on the route at distance s, lane metres right of the line, moving at speed */
  put: (s, lane = 2.25, speed = 0) => {
    const g = window.__nm, r = g.race.route, p = r.at(s);
    const yaw = Math.atan2(p.dx, p.dz);
    g.car.teleport(p.x - p.dz * lane, 0.02, p.z + p.dx * lane, yaw);
    g.car.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
    g.car.lastVel.set(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed);
    g.cam.alignBehind(yaw);
    g.cam.snap();
  },
  /** nothing on the route between s0 and s1 */
  clear: (s0, s1) => {
    const g = window.__nm, r = g.race.route;
    for (const v of [...g.traffic.vehicles]) { const p = r.project(v.x, v.z, s0); if (p.s > s0 - 10 && p.s < s1 + 10 && p.dist < 14) g.traffic.remove(v); }
  },
};
`;

await step('race: two cars on the grid in clearly different colours, held for the countdown', async () => {
  await ev(() => __t.press('Escape'));
  await ev(() => __t.g().toTitle());
  await page.waitForSelector('#mode-race', { timeout: 20000 });
  await page.click('#cond-night');
  await pickCar('demo-bmw-m4');
  await page.click('#mode-race');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title-race.png' });
  await page.click('#btn-drive');
  await ev(RACE);
  const r = await ev(() => {
    const g = __t.g(),
      race = __r.race();
    const a = g.car.paint,
      b = race.rival.paint;
    const dist = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const sideBySide = Math.hypot(g.car.pos.x - race.rival.pos.x, g.car.pos.z - race.rival.pos.z);
    __t.sim(2);
    const still = [g.car.forwardSpeed, race.rival.forwardSpeed].map((v) => +v.toFixed(2));
    return {
      phase: g.phase,
      mode: g.mode,
      colourDistance: +dist.toFixed(2),
      player: '#' + a.getHexString(),
      rival: '#' + b.getHexString(),
      sideBySide: +sideBySide.toFixed(1),
      still,
      checkpoints: race.route.checkpoints.length,
      length: Math.round(race.route.length),
    };
  });
  assert(r.phase === 'countdown' && r.mode === 'race', JSON.stringify(r));
  assert(r.colourDistance > 0.8, 'colours too similar ' + JSON.stringify(r));
  assert(r.sideBySide > 2.5 && r.sideBySide < 5, 'grid ' + r.sideBySide);
  assert(
    r.still.every((v) => Math.abs(v) < 0.5),
    'moved during countdown ' + r.still,
  );
  return r;
});

await step('race: after GO the rival drives the route', async () => {
  const r = await ev(() => {
    const g = __t.g(),
      race = __r.race();
    __t.sim(1.5);
    const phase = g.phase;
    __t.down('KeyW');
    __t.sim(6);
    __t.up('KeyW');
    return {
      phase,
      rivalS: Math.round(race.rivalProgress.s),
      rivalKmh: Math.round(race.rival.forwardSpeed * 3.6),
      playerS: Math.round(race.player.s),
      time: +race.time.toFixed(1),
      hud: __t.st().race,
    };
  });
  assert(r.phase === 'run' && r.rivalS > 40 && r.hud && r.hud.checkpoints > 2, JSON.stringify(r));
  return r;
});

await step('race HUD on screen: position, checkpoints, map, rival tag', async () => {
  await ev(() => {
    const g = __t.g(),
      race = __r.race();
    // drive up behind the rival so it is in view
    __r.put(Math.max(0, race.rivalProgress.s - 22), 2.25, race.rival.forwardSpeed);
    __t.sim(0.3);
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-race.png' });
  const r = await ev(() => ({
    pos: document.querySelector('#race-position')?.textContent,
    cp: document.querySelector('#race-cp')?.textContent,
    map: !!document.querySelector('#race-map'),
    tag: __t.g().rivalTag,
  }));
  assert(r.pos && r.cp && r.map, JSON.stringify(r));
  return r;
});

await step('race: a big crash stops the car dead, the race goes on and control comes back', async () => {
  const r = await ev(() => {
    const g = __t.g(),
      race = __r.race();
    const s0 = race.player.s + 5;
    __r.clear(s0 - 30, s0 + 80);
    __r.put(s0, 2.25, 26);
    const spawned = __t.spawnRel(26, 0, true);
    if (!spawned) throw new Error('no lane ahead');
    const tv = g.traffic.vehicles.find((v) => v.id === spawned.id);
    tv.v = 0;
    g.traffic.crash(tv, 60);
    __t.down('KeyW');
    let stunned = false,
      minSpeed = 99;
    // (a bump earlier in the race may already have counted: wait for this one)
    const c0 = g.scorer.crashes;
    for (let i = 0; i < 40 && g.scorer.crashes === c0; i++) __t.sim(0.05);
    const right = {
      phase: g.phase,
      crashes: g.scorer.crashes,
      stun: +race.stunT.toFixed(2),
    };
    for (let i = 0; i < 6; i++) {
      __t.sim(0.05);
      stunned ||= __t.st().race.stunned;
      minSpeed = Math.min(minSpeed, Math.abs(g.car.forwardSpeed));
    }
    __t.up('KeyW');
    __t.sim(1.2);
    __t.down('KeyS');
    __t.sim(1.2);
    __t.up('KeyS');
    return {
      ...right,
      stunned,
      minSpeed: +minSpeed.toFixed(2),
      after: g.phase,
      reverse: +g.car.forwardSpeed.toFixed(1),
      over: g.scorer.over,
    };
  });
  assert(r.crashes >= 1 && r.phase === 'run' && r.after === 'run' && !r.over, JSON.stringify(r));
  // forwardSpeed lags one physics step, so judge the stop by the lowest speed just after the crash
  assert(r.minSpeed < 2 && r.stun > 0 && r.stunned, 'did not stop: ' + JSON.stringify(r));
  assert(r.reverse < -1, 'no control after the crash: ' + JSON.stringify(r));
  return r;
});

await step('race: driving through the next gate passes the checkpoint', async () => {
  const r = await ev(() => {
    const race = __r.race();
    const k = race.player.next;
    const cp = race.route.checkpoints[k];
    __r.clear(cp.s - 40, cp.s + 30);
    // gates stand just past an intersection: start 9 m before, which is already round any corner
    __r.put(cp.s - 9, 2.25, 12);
    __t.down('KeyW');
    for (let i = 0; i < 30 && race.player.next === k; i++) __t.sim(0.1);
    __t.up('KeyW');
    return {
      before: k,
      after: race.player.next,
      popups: __t.st().popups.map((p) => p.label),
    };
  });
  assert(r.after === r.before + 1, JSON.stringify(r));
  return r;
});

await step('race: T puts you back on the route', async () => {
  const r = await ev(() => {
    const g = __t.g(),
      race = __r.race();
    const p = g.car.pos;
    g.car.teleport(p.x + 40, 0.02, p.z + 40, 0);
    __t.sim(0.2);
    const off0 = +race.player.off.toFixed(1);
    __t.press('KeyT');
    __t.sim(0.2);
    return { off0, off1: +race.player.off.toFixed(1) };
  });
  assert(r.off1 < 6, JSON.stringify(r));
  return r;
});

await step('race: crossing the finish first wins, results show both times', async () => {
  const r = await ev(() => {
    const g = __t.g(),
      race = __r.race();
    const cps = race.route.checkpoints;
    // skip to the last stretch (all checkpoints but the finish already done)
    race.player.next = cps.length - 1;
    race.player.s = cps[cps.length - 1].s - 40;
    __r.clear(race.route.length - 60, race.route.length + 10);
    __r.put(race.route.length - 30, 2.25, 18);
    __t.down('KeyW');
    for (let i = 0; i < 40 && g.phase === 'run'; i++) __t.sim(0.1);
    __t.up('KeyW');
    return {
      phase: g.phase,
      result: __t.st().result?.race,
      stats: __t.st().raceStats,
    };
  });
  await page.waitForSelector('#race-verdict', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scripts/out/nm-e2e-race-win.png' });
  assert(r.phase === 'results' && r.result && r.result.won && r.result.time > 0 && r.result.rivalTime > r.result.time, JSON.stringify(r));
  assert(r.stats.races >= 1 && r.stats.wins >= 1, JSON.stringify(r.stats));
  return r;
});

await step('race: the rival finishing first and the player too slow is a loss', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.press('KeyR'); // same route again
    __t.sim(3.3);
    const race = __r.race();
    const cps = race.route.checkpoints;
    // the rival is nearly home
    const p = race.route.at(race.route.length - 20);
    race.rival.teleport(p.x - p.dz * 2.25, 0.02, p.z + p.dx * 2.25, Math.atan2(p.dx, p.dz));
    race.driver.reset(race.route.length - 20, 2.25);
    race.rivalProgress.next = cps.length - 1;
    race.rivalProgress.s = race.route.length - 20;
    __r.clear(race.route.length - 40, race.route.length + 10);
    for (let i = 0; i < 60 && race.rivalTime === null; i++) __t.sim(0.1);
    const rivalTime = race.rivalTime;
    const hud = __t.st().race;
    __t.sim(31);
    return {
      rivalTime,
      hudLeft: hud.left,
      finished: hud.rivalFinished,
      phase: g.phase,
      result: __t.st().result?.race,
    };
  });
  assert(r.rivalTime !== null && r.finished, JSON.stringify(r));
  assert(r.phase === 'results' && r.result && !r.result.won && r.result.time === null, JSON.stringify(r));
  return r;
});

// ------------------------------------------------------------------ police chase
const CHASE = `
window.__c = {
  /** keep to a lane round the curves (analogue steering, like the race rival); returns when the run ends or time is up */
  drive: (seconds, lane, speed = 34, clearAhead = true, until = () => false) => {
    const g = window.__nm, hw = g.highway, car = g.car;
    for (let t = 0; t < seconds && g.phase === 'run' && !until(); t += 1 / 30) {
      const you = hw.you;
      const n = Math.floor(you.path.lanes(you.s) + 0.4);
      const l = Math.min(lane, n - 1);
      const p = you.path.pose(Math.min(you.path.length - 1, you.s + 18), 3.4 * (l + 0.5));
      let err = Math.atan2(p.x - car.pos.x, p.z - car.pos.z) - car.yaw;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      const v = car.forwardSpeed;
      car.aiInput = { throttle: v < speed ? 1 : 0, brake: v > speed + 3 ? 0.5 : 0, steer: Math.max(-1, Math.min(1, err * 2.2)), handbrake: false };
      if (clearAhead) for (const c of hw.traffic.cars) if (c.path === you.path && c.s > you.s - 10 && c.s - you.s < 90 && (c.oncoming || Math.abs(c.lat - you.lat) < 2.6)) c.s += c.oncoming ? -200 : 150;
      g.update(1 / 30);
    }
    car.aiInput = null;
  },
  /** put the car on the road at s, in a lane, moving */
  put: (s, lane = 1, speed = 15) => {
    const g = window.__nm, hw = g.highway, car = g.car;
    const q = hw.you.path.pose(s, 3.4 * (lane + 0.5));
    car.teleport(q.x, 0.02, q.z, q.h);
    car.body.setLinvel({ x: Math.sin(q.h) * speed, y: 0, z: Math.cos(q.h) * speed }, true);
    car.lastVel.set(Math.sin(q.h) * speed, 0, Math.cos(q.h) * speed);
    g.cam.alignBehind(q.h);
    g.cam.snap();
    hw.traffic.cars = hw.traffic.cars.filter((c) => Math.hypot(c.x - q.x, c.z - q.z) > 60);
    g.update(1 / 30);
  },
};
`;

await step('police chase: motorway first, the police right behind you from GO, the docks at the end of the road', async () => {
  await ev(() => __t.g().toTitle());
  await page.waitForSelector('#mode-chase', { timeout: 20000 });
  await ev(CHASE);
  await pickCar('demo-toyota-land-cruiser');
  await page.click('#mode-chase');
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    const hw = g.highway;
    const ch = g.chase;
    const during = { cops: ch.cops.length, lights: ch.cops.filter((c) => c.lights).length, behind: ch.cops.map((c) => Math.round(hw.you.s - c.d.s)) };
    __t.sim(3.3);
    const you = hw.you;
    const start = {
      profile: hw.profile,
      street: you.path.street(you.s),
      state: ch.state,
      toDocks: Math.round(ch.toDocks),
      forks: you.path.children,
      popups: __t.st().popups.map((p) => p.label),
      hud: __t.st().chase,
    };
    // drive on: they stay with you
    __c.drive(8, 1, 34);
    const near = Math.min(...ch.cops.filter((c) => !c.disabled && c.role === 'pursuit').map((c) => Math.round(c.car.pos.distanceTo(g.car.pos))));
    return { during, start, near, heat: ch.heat, phase: g.phase, progress: +__t.st().chase.progress.toFixed(3) };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scripts/out/nm-e2e-chase.png' });
  const hud = await ev(() => ({
    chase: !!document.querySelector('#hud-chase'),
    docks: document.querySelector('#hud-docks')?.textContent,
    heat: !!document.querySelector('#hud-heat'),
    map: !!document.querySelector('#highway-map'),
  }));
  assert(r.during.cops === 2 && r.during.lights === 2 && r.during.behind.every((d) => d > 40 && d < 100), 'police behind on the line ' + JSON.stringify(r.during));
  assert(r.start.profile === 'chase' && !r.start.street && r.start.state === 'pursuit' && r.start.toDocks > 4000 && r.start.toDocks < 6000 && r.start.forks === null, 'start ' + JSON.stringify(r.start));
  assert(r.start.popups.includes('POLICE ON YOUR TAIL') && r.start.hud?.stage === 'motorway', 'go ' + JSON.stringify(r.start));
  assert(r.phase === 'run' && r.near < 150 && r.progress > 0, 'they follow ' + JSON.stringify(r));
  assert(hud.chase && hud.heat && hud.map && /Docks/.test(hud.docks ?? '') && /Motorway/.test(hud.docks ?? ''), 'HUD ' + JSON.stringify(hud));
  return r;
});

await step('police chase: near misses score on the motorway; a hard hit damages the car but the chase goes on', async () => {
  const r = await ev(() => {
    const g = __t.g();
    const hw = g.highway;
    const car = g.car;
    const clearNear = () => {
      hw.traffic.cars = hw.traffic.cars.filter((c) => c.oncoming || Math.hypot(c.x - car.pos.x, c.z - car.pos.z) > 220);
    };
    const place = (lane, ahead) => {
      for (const d of [ahead, ahead + 12, ahead + 25, ahead - 8]) {
        const at = hw.traffic.along(hw.you.path, hw.you.s + d);
        const c = at && hw.traffic.spawn(at.path, at.s, lane);
        if (c) return c;
      }
      return null;
    };
    clearNear();
    const you = hw.you;
    // the police well back for a moment: traffic moves over for a siren close behind, which would spoil the pass
    g.chase.cops.forEach((c, i) => {
      const q = you.path.pose(Math.max(0, you.s - 320 - i * 25), 3.4 * ((i % 3) + 0.5));
      c.car.teleport(q.x, 0.02, q.z, q.h);
    });
    const lane = Math.max(0, Math.min(Math.round(you.lat / 3.4 - 0.5), Math.floor(you.path.lanes(you.s) + 0.4) - 1));
    let other = lane > 0 ? lane - 1 : lane + 1;
    let c1 = place(other, 45);
    if (!c1) {
      other = lane > 0 ? lane + 1 : lane - 1;
      c1 = place(other, 45);
    }
    c1.lat = c1.fromLat = 3.4 * (other + 0.5) + (other < lane ? 0.65 : -0.65);
    c1.vDes = c1.v = 14;
    c1.cool = 99;
    const n0 = g.scorer.nearMisses;
    // until we are past it (a heavy car takes a while to close a 45 m gap)
    __c.drive(8, lane, 34, false, () => g.scorer.nearMisses > n0 || c1.s < hw.you.s - 8);
    const near = g.scorer.nearMisses - n0;
    const mult = g.scorer.mult;
    // a slow car in our lane: a hard crash
    clearNear();
    const c2 = place(lane, 35);
    c2.vDes = c2.v = 6;
    c2.cool = 99;
    const h0 = g.scorer.health;
    __c.drive(2.5, lane, 36, false);
    return { near, mult, crash: { h0: Math.round(h0), health: Math.round(g.scorer.health), crashed: c2.crashed, phase: g.phase, over: g.scorer.over } };
  });
  assert(r.near >= 1 && r.mult >= 2, 'near misses ' + JSON.stringify(r));
  assert(r.crash.health < r.crash.h0 && r.crash.crashed && r.crash.phase === 'run' && r.crash.over === null, JSON.stringify(r.crash));
  return r;
});

await step('police chase: into town, then the docks; through the gates is ESCAPED', async () => {
  const town = await ev(() => {
    const g = __t.g();
    const hw = g.highway;
    const p = hw.you.path;
    const t0 = p.pieces.find((pc) => pc.street).s0;
    __c.put(t0 + 30, 1, 14);
    __c.drive(1.5, 1, 15);
    return { street: p.street(hw.you.s), stage: __t.st().chase?.stage, popups: __t.st().popups.map((x) => x.label), phase: g.phase };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-chase-town.png' });
  assert(town.street && town.stage === 'town' && town.popups.includes('INTO TOWN') && town.phase === 'run', 'town ' + JSON.stringify(town));
  const docks = await ev(() => {
    const g = __t.g();
    const hw = g.highway;
    __c.put(hw.you.path.finish - 160, 1, 14);
    __c.drive(1.5, 1, 15);
    return { stage: __t.st().chase?.stage, popups: __t.st().popups.map((x) => x.label), toDocks: Math.round(g.chase.toDocks) };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-docks.png' });
  const coins0 = await ev(() => window.__garage.getState().save.coins);
  const r = await ev(() => {
    const g = __t.g();
    const score0 = g.scorer.score;
    __c.drive(20, 1, 16, true);
    return { phase: g.phase, ending: __t.st().ending, escaped: g.chase.escaped, score0, lights: g.chase.cops.filter((c) => c.lights).length };
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-escaped.png' });
  assert(docks.stage === 'docks' && docks.popups.includes('DOCKS AHEAD') && docks.toDocks < 160, 'docks ' + JSON.stringify(docks));
  assert(r.phase === 'ending' && r.ending === 'escaped' && r.escaped && r.lights === 0 && (await page.$('[data-ending="escaped"]')), 'escaped ' + JSON.stringify(r));
  await ev(() => __t.sim(3));
  await page.waitForSelector('#btn-again', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-escaped-results.png' });
  const res = await ev(() => ({ result: __t.st().result, best: __t.st().bestChase.length, coins: window.__garage.getState().save.coins, text: document.querySelector('#results')?.textContent }));
  const rr = res.result;
  assert(rr.mode === 'chase' && rr.reason === 'escaped' && rr.chase.escaped && rr.chase.left === 0 && rr.score > r.score0 && rr.rank >= 1 && res.best >= 1, JSON.stringify(rr));
  assert(rr.garage.coins > 0 && res.coins > coins0 && /Escaped/.test(res.text) && /Made it/.test(res.text) && /Chase again/.test(res.text), 'results ' + JSON.stringify({ coins: res.coins - coins0, text: res.text?.slice(0, 80) }));
  return { town, docks, score: rr.score, coins: rr.garage.coins, chase: rr.chase };
});

await step('R restarts from the results screen', async () => {
  return ev(() => {
    const g = __t.g();
    __t.press('KeyR');
    const p = g.phase;
    const score = g.scorer.score;
    const cops = g.chase.cops.length;
    __t.sim(3.3);
    if (p !== 'countdown' || g.phase !== 'run' || score !== 0 || cops !== 2) throw new Error(JSON.stringify({ p, now: g.phase, score, cops }));
    return { phase: g.phase, score, cops };
  });
});

await step('a car at 0% still drives (it limps out), and a wrench on the road fixes it for free', async () => {
  const r = await ev(() => {
    const g = __t.g();
    g.toTitle();
    window.__garage.getState().finish(0, 0, 0);
    const health = window.__garage.getState().setup().progress.health;
    g.startRun();
    const phase = g.phase;
    const limp = Math.round(g.scorer.health);
    __t.sim(3.3);
    // one turns up on the road ahead of a damaged car
    for (let i = 0; i < 40 && !g.pickups.items.length; i++) __c.drive(0.1, 1, 20);
    const p = g.pickups.items[0];
    const spawned = p ? { ahead: Math.round((p.x - g.car.pos.x) * Math.sin(g.car.yaw) + (p.z - g.car.pos.z) * Math.cos(g.car.yaw)), dist: Math.round(Math.hypot(p.x - g.car.pos.x, p.z - g.car.pos.z)) } : null;
    __t.sim(0.1);
    const hud = __t.st().hud.pickup;
    // drive through it: put it a little way ahead of the car
    if (p) {
      p.x = g.car.pos.x + Math.sin(g.car.yaw) * 12;
      p.z = g.car.pos.z + Math.cos(g.car.yaw) * 12;
    }
    __c.drive(3, 1, 20, true, () => g.scorer.health > limp + 10);
    const popups = __t.st().popups.map((x) => x.label);
    return { health, phase, limp, spawned, hud, after: Math.round(g.scorer.health), popups };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scripts/out/nm-e2e-repair.png' });
  assert(r.health === 0 && r.phase === 'countdown' && r.limp === 25, 'limps out: ' + JSON.stringify(r));
  assert(r.spawned && r.spawned.ahead > 100 && r.hud && r.hud.dist > 100 && Math.abs(r.hud.arrow) < 60, 'a wrench ahead: ' + JSON.stringify(r));
  assert(r.after >= 60 && r.popups.includes('REPAIRED'), 'repaired: ' + JSON.stringify(r));
  return r;
});

await step('police chase: Give up (pause menu) ends it; the results say so', async () => {
  await ev(() => __t.g().togglePause());
  await page.waitForSelector('#btn-end', { timeout: 10000 });
  await page.click('#btn-end');
  await page.waitForSelector('#btn-again', { timeout: 10000 });
  const r = await ev(() => ({ result: __t.st().result, text: document.querySelector('#results')?.textContent }));
  assert(r.result.reason === 'ended' && !r.result.chase.escaped && r.result.chase.left > 0 && /Chase over/.test(r.text) && /km short/.test(r.text), JSON.stringify({ ...r.result, text: r.text?.slice(0, 60) }));
  await page.click('#btn-title');
  const back = await ev(() => ({ onHighway: __t.g().onHighway, phase: __t.g().phase, hidden: !__t.g().highway.group.visible }));
  assert(!back.onHighway && back.phase === 'title' && back.hidden, JSON.stringify(back));
  return { reason: r.result.reason, left: r.result.chase.left, back };
});

await step('repair spends coins and gets it running again', async () => {
  const before = await ev(() => ({ coins: window.__garage.getState().save.coins, health: window.__garage.getState().setup().progress.health }));
  await page.click('#btn-repair');
  const r = await ev(() => ({
    coins: window.__garage.getState().save.coins,
    health: window.__garage.getState().setup().progress.health,
    card: document.querySelector('#garage-health')?.textContent,
  }));
  assert(before.health < 100 && r.coins < before.coins && r.health > before.health && r.card === `${Math.round(r.health)}%`, JSON.stringify({ before, ...r }));
  return { before, ...r };
});

await step('police chase: stopped with the police on you is busted; the results say so', async () => {
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    __t.sim(3.3);
    const ch = g.chase;
    const car = g.car;
    // stop dead with a police car right behind
    car.stop();
    const cop = ch.cops.find((c) => !c.disabled && c.role === 'pursuit');
    const back = { x: car.pos.x - Math.sin(car.yaw) * 7, z: car.pos.z - Math.cos(car.yaw) * 7 };
    cop.car.teleport(back.x, 0.02, back.z, car.yaw);
    let bust = 0;
    for (let i = 0; i < 80 && g.phase === 'run'; i++) {
      car.stop();
      __t.sim(0.1);
      bust = Math.max(bust, ch.bust);
    }
    return { bust: +bust.toFixed(2), ending: __t.st().ending, phase: g.phase };
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-busted.png' });
  assert(r.bust > 0.9 && r.ending === 'busted' && r.phase === 'ending' && (await page.$('[data-ending="busted"]')), JSON.stringify(r));
  await ev(() => __t.sim(3));
  await page.waitForSelector('#btn-again', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-busted-results.png' });
  const res = await ev(() => ({ result: __t.st().result, text: document.querySelector('#results')?.textContent ?? '' }));
  assert(res.result.mode === 'chase' && res.result.reason === 'busted' && /Busted/.test(res.text) && /Takedowns/.test(res.text), JSON.stringify(res.result));
  return { bust: r.bust, chase: res.result.chase, score: res.result.score };
});

await step('Esc on results goes back to the title, with the chase best on show', async () => {
  await ev(() => __t.press('Escape'));
  await page.waitForSelector('#btn-drive', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title-best.png' });
  const r = await ev(() => ({ phase: __t.g().phase, best: __t.st().bestChase.map((b) => b.score), high: document.querySelector('#high-score')?.textContent }));
  assert(r.phase === 'title' && r.best.length >= 1 && r.high && r.high.includes(r.best[0].toLocaleString('en-US')), JSON.stringify(r));
  await ev(() => __t.st().set({ mode: 'free' }));
  return r;
});

await step('the best chase shows on the loading screen after a reload', async () => {
  const best = await ev(() => __t.st().bestChase[0]?.score ?? 0);
  await page.reload();
  await page.waitForSelector('#high-score', { timeout: 60000 });
  const r = await ev(() => ({
    phase: window.__nmStore.getState().phase,
    text: document.querySelector('#high-score').textContent,
  }));
  await page.screenshot({ path: 'scripts/out/nm-e2e-loading.png' });
  assert(best > 0 && r.text.includes('Best chase') && r.text.includes(best.toLocaleString('en-US')) && r.text.includes('Races won'), JSON.stringify({ best, ...r }));
  await page.waitForSelector('#btn-drive', { timeout: 240000 });
  const free = await ev(() => ({ mode: window.__nmStore.getState().mode, high: !!document.querySelector('#high-score') }));
  await ev(() => window.__nmStore.getState().set({ mode: 'chase' }));
  await page.waitForTimeout(300);
  const t = await ev(() => document.querySelector('#high-score')?.textContent);
  assert(free.mode === 'free' && !free.high && t && t.includes(best.toLocaleString('en-US')), 'title: ' + JSON.stringify({ free, t }));
  await ev(() => window.__nmStore.getState().set({ mode: 'free' }));
  return { best, loading: r.phase, title: t };
});

await step("a host link (#garage=...) brings the player's own cars, primary first", async () => {
  const payload = {
    vehicles: [
      { id: 'g-1', make: 'Toyota', model: 'Camry', year: 2016, color: 'black' },
      { id: 'g-2', make: 'Lada (VAZ)', model: '2107', year: 2003, color: 'white', primary: true, condition: 'Damaged', gasEquipment: 'Yes' },
    ],
  };
  const hash = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await page.goto(URL + '#garage=' + hash);
  await page.waitForSelector('#btn-drive', { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-host.png' });
  const r = await ev(() => ({
    cars: window.__garage
      .getState()
      .vehicles()
      .map((v) => v.make + ' ' + v.model),
    name: document.querySelector('#garage-name')?.textContent,
    make: document.querySelector('#garage-make')?.textContent,
    type: document.querySelector('#garage-type')?.textContent,
    health: window.__garage.getState().setup().progress.health,
    cashMul: window.__garage.getState().setup().cashMul,
  }));
  // host cars plus the one added in this browser earlier
  assert(r.cars.includes('Toyota Camry') && r.cars.includes('Lada (VAZ) 2107') && r.name === '2107 2003' && r.make === 'Lada (VAZ)' && r.type === 'Classic', JSON.stringify(r));
  assert(r.health === 60 && r.cashMul > 1, 'garage details: ' + JSON.stringify(r));
  return r;
});

await step('an A4 page (portrait frame): the garage sits under the scene, the drive fits and sees ahead', async () => {
  await ev(HELPERS);
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.waitForTimeout(1500);
  const title = await ev(() => {
    const aside = document.querySelector('aside').getBoundingClientRect();
    const drive = document.querySelector('#btn-drive').getBoundingClientRect();
    return { asideTop: Math.round(aside.top), asideW: Math.round(aside.width), driveBottom: Math.round(drive.bottom), h: innerHeight, w: innerWidth };
  });
  await page.screenshot({ path: 'scripts/out/nm-e2e-a4-title.png' });
  assert(title.asideTop > 300 && title.asideW === title.w && title.driveBottom <= title.h, 'stacked garage ' + JSON.stringify(title));
  await ev(() => __t.st().set({ mode: 'chase' }));
  await page.click('#btn-drive');
  const run = await ev(() => {
    const g = __t.g();
    __t.sim(3.4);
    __t.down('KeyW');
    __t.sim(2);
    __t.up('KeyW');
    const out = [];
    for (const el of document.querySelectorAll('#ui *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)) out.push(el.id || el.tagName);
    }
    return { phase: g.phase, fov: Math.round(g.camera.fov), outside: out.slice(0, 5) };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-a4-drive.png' });
  assert(run.phase === 'run' && run.fov > 80 && run.outside.length === 0, 'drive ' + JSON.stringify(run));
  await ev(() => __t.g().toTitle());
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(800);
  await ev(() => __t.st().set({ mode: 'free' }));
  return { title, run };
});

await step('touch controls drive the car', async () => {
  // one WebGL page at a time: software rendering starves a second page's frames
  await page.goto('about:blank');
  const tp = await browser.newPage({ viewport: { width: 900, height: 420 }, hasTouch: true, isMobile: false });
  tp.on('pageerror', (e) => errors.push(`touch: ${e.message}`));
  await tp.goto(URL + '&touch=1');
  await tp.waitForSelector('#btn-drive', { timeout: 240000 });
  await tp.click('#btn-drive');
  await tp.evaluate(() => window.__nm.simulate(3.3));
  await tp.waitForSelector('#t-gas', { timeout: 20000 });
  const box = await tp.locator('#t-gas').boundingBox();
  await tp.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await tp.mouse.down();
  const r1 = await tp.evaluate(() => {
    window.__nm.simulate(2.5);
    return { speed: +window.__nm.car.forwardSpeed.toFixed(1), held: window.__nm.input.keys.has('KeyW') };
  });
  await tp.mouse.up();
  const r2 = await tp.evaluate(() => ({ held: window.__nm.input.keys.has('KeyW') }));
  await tp.waitForTimeout(1200);
  await tp.screenshot({ path: 'scripts/out/nm-e2e-touch.png' });
  await tp.close();
  assert(r1.held && r1.speed > 8 && !r2.held, JSON.stringify({ r1, r2 }));
  return { ...r1, released: !r2.held };
});

await step('no runtime errors', async () => {
  assert(errors.length === 0, errors.slice(0, 5).join('\n---\n'));
});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
