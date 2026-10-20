// End-to-end test for Near Miss in headless Chromium.
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
    // move first, then clear the streets around where we landed
    g.car.teleport(p.x, 0.02, p.z, p.yaw);
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

await step('pick a car and conditions, countdown, then drive', async () => {
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
      c0,
      still: +still.toFixed(2),
      c1,
      speed: +g.car.forwardSpeed.toFixed(1),
      car: g.car.label,
      clock: +g.scorer.time.toFixed(1),
    };
  });
  assert(r.c0 === 'countdown' && r.c1 === 'run', JSON.stringify(r));
  assert(Math.abs(r.still) < 0.5, 'car moved during countdown');
  assert(r.speed > 12, 'too slow ' + r.speed);
  assert(r.clock < 40, 'clock not running');
  return r;
});

await step('passing a car in the next lane scores a near miss', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(28);
    const spawned = __t.spawnRel(32, 3.5, true);
    if (!spawned) throw new Error('no lane to the right');
    const n0 = g.scorer.nearMisses;
    const other = g.traffic.vehicles.find((v) => v.id === spawned.id);
    // hold it in its lane (traffic changes lanes before turns, which would make this check random)
    other.state = 'stopped';
    let minD = 1e9;
    __t.down('KeyW');
    for (let i = 0; i < 40 && g.scorer.nearMisses === n0; i++) {
      __t.sim(0.1);
      minD = Math.min(minD, Math.hypot(other.x - g.car.pos.x, other.z - g.car.pos.z));
    }
    __t.up('KeyW');
    return {
      spawned,
      near: g.scorer.nearMisses - n0,
      mult: g.scorer.mult,
      combo: Math.round(g.scorer.comboPoints),
      phase: g.phase,
      minD: +minD.toFixed(2),
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scripts/out/nm-e2e-nearmiss.png' });
  assert(r.near >= 1 && r.mult >= 2 && r.combo > 0, JSON.stringify(r));
  return r;
});

await step('combo banks into the score', async () => {
  return ev(() => {
    const g = __t.g();
    const before = g.scorer.score;
    const pending = Math.round(g.scorer.comboPoints * g.scorer.mult);
    __t.sim(5);
    // a new combo may already have started (a red light, another pass), so only check the bank landed
    if (g.scorer.score < before + pending) throw new Error(`score ${before} -> ${g.scorer.score}, expected +${pending}`);
    return { pending, score: g.scorer.score };
  });
});

await step('boost adds power and drains the meter', async () => {
  return ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(20);
    g.scorer.boost = 1;
    __t.down('KeyW');
    __t.down('ShiftLeft');
    __t.sim(1);
    const power = g.car.powerMul;
    const fov = g.cam.baseFov;
    __t.up('ShiftLeft');
    __t.up('KeyW');
    if (power < 1.5 || g.scorer.boost >= 1) throw new Error(`power ${power} boost ${g.scorer.boost}`);
    return { power, boost: +g.scorer.boost.toFixed(2), fov: +fov.toFixed(1) };
  });
});

await step('driving against traffic counts as oncoming', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true, true);
    __t.launch(20);
    const s0 = g.scorer.oncomingSec;
    __t.down('KeyW');
    __t.sim(1);
    __t.up('KeyW');
    return {
      oncoming: +(g.scorer.oncomingSec - s0).toFixed(2),
      hud: __t.st().hud.oncoming,
      combo: Math.round(g.scorer.comboPoints),
    };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-oncoming.png' });
  assert(r.oncoming > 0.9 && r.hud && r.combo > 0, JSON.stringify(r));
  return r;
});

await step('Space + steer drifts: scored drift, skid marks, smoke', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.place(true);
    __t.launch(26);
    const d0 = g.scorer.drifts;
    let maxSlip = 0;
    let wasDrifting = false;
    let hudDrift = false;
    // a kick and a flick back: about 0.75 s of drift that stays on a 15 m wide road
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
        hudDrift = hudDrift || __t.st().hud.drifting;
      }
      for (const k of keys) __t.up(k);
    }
    const ev = g.scorer.drifts > d0;
    return {
      phase: g.phase,
      wasDrifting,
      hudDrift,
      maxSlip: Math.round(maxSlip),
      drifts: g.scorer.drifts - d0,
      skids: g.skids.count,
      smoke: g.smoke.live,
      stillDrifting: g.car.drifting,
      combo: Math.round(g.scorer.comboPoints),
      ev,
    };
  });
  assert(r.phase === 'run', 'crashed while drifting: ' + JSON.stringify(r));
  assert(r.wasDrifting && r.maxSlip > 12 && r.drifts >= 1 && r.skids > 5 && !r.stillDrifting, JSON.stringify(r));
  return r;
});

await step('drift in progress on screen (smoke, marks, readout)', async () => {
  await ev(() => {
    const g = __t.g();
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
    // the slow renderer kept the keys held for a while: start a fresh run for the steps that follow
    g.startRun();
    __t.sim(3.3);
    return r;
  });
  assert(r.skids > 0, JSON.stringify(r));
  return r;
});

await step('Esc pauses (clock stops) and resumes', async () => {
  return ev(() => {
    const g = __t.g();
    __t.press('Escape');
    const paused = __t.st().paused;
    const t0 = g.scorer.time;
    __t.sim(1);
    const t1 = g.scorer.time;
    __t.press('Escape');
    if (!paused || t0 !== t1 || __t.st().paused) throw new Error(JSON.stringify({ paused, t0, t1 }));
    return { paused, frozen: t0 === t1 };
  });
});

await step('first big hit damages the car (smoke, hazards, slower) but the run goes on', async () => {
  const r = await ev(() => {
    const g = __t.g();
    if (g.phase !== 'run') {
      g.startRun();
      __t.sim(3.3);
    }
    __t.place(true);
    __t.launch(26);
    const s = __t.spawnRel(28, 0, true);
    if (!s) throw new Error('no lane ahead');
    const tv = g.traffic.vehicles.find((v) => v.id === s.id);
    tv.v = 0;
    g.traffic.crash(tv, 60);
    __t.down('KeyW');
    for (let i = 0; i < 60 && !g.scorer.damaged && g.phase === 'run'; i++) __t.sim(0.1);
    __t.sim(0.6);
    return {
      phase: g.phase,
      damaged: g.scorer.damaged,
      hud: __t.st().hud.damaged,
      hazards: g.car.hazards,
      health: Math.round(g.scorer.health),
      hudHealth: Math.round(__t.st().hud.health),
      smoke: g.engineSmoke.live,
      power: +g.car.powerMul.toFixed(2),
      top: +g.car.topMul.toFixed(2),
    };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scripts/out/nm-e2e-damaged.png' });
  await ev(() => __t.up('KeyW'));
  assert(r.phase === 'run' && r.damaged && r.hud && r.hazards === r.health < 35 && r.smoke > 0 && r.power < 1 && r.top < 1, JSON.stringify(r));
  assert(r.health > 0 && r.health < 60 && r.hudHealth === r.health, 'condition ' + JSON.stringify(r));
  return r;
});

await step('a second big hit wrecks the damaged car', async () => {
  const r = await ev(() => {
    const g = __t.g();
    __t.sim(2);
    __t.place(true);
    __t.launch(26);
    const s = __t.spawnRel(28, 0, true);
    if (!s) throw new Error('no lane ahead');
    const tv = g.traffic.vehicles.find((v) => v.id === s.id);
    tv.v = 0;
    g.traffic.crash(tv, 60);
    __t.down('KeyW');
    for (let i = 0; i < 60 && g.phase === 'run'; i++) __t.sim(0.1);
    __t.up('KeyW');
    return { phase: g.phase, over: g.scorer.over };
  });
  assert(r.phase === 'wreck' && r.over === 'wrecked', JSON.stringify(r));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scripts/out/nm-e2e-wreck.png' });
  return r;
});

await step('results screen with stats and a ranked score', async () => {
  await ev(() => __t.sim(3));
  await page.waitForSelector('#btn-again', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-results.png' });
  const r = await ev(() => ({
    result: __t.st().result,
    best: __t.st().best.length,
  }));
  // a wreck that scored nothing does not go on the leaderboard
  assert(r.result && r.result.reason === 'wrecked' && (r.result.score > 0 ? r.result.rank >= 1 : r.result.rank === 0), JSON.stringify(r));
  const cta = await ev(() => document.querySelector('#btn-again')?.textContent);
  assert(/fix your car/i.test(cta ?? ''), 'a wreck should lead to the workshop: ' + cta);
  const g = r.result.garage;
  assert(g && g.health === 0 && g.damage === 100 && g.repair > 0 && (await page.$('#garage-result')), 'garage result ' + JSON.stringify(g));
  return {
    score: r.result.score,
    rank: r.result.rank,
    nearMisses: r.result.nearMisses,
    top: r.result.topSpeed,
  };
});

await step('the wreck stays wrecked: it will not start until repaired', async () => {
  const r = await ev(() => {
    const g = __t.g();
    const health = window.__garage.getState().setup().progress.health;
    g.startRun();
    const phase = g.phase;
    return { health, phase, notice: window.__garage.getState().notice };
  });
  assert(r.health === 0 && r.phase === 'title' && /repair/i.test(r.notice), JSON.stringify(r));
  return r;
});

await step('repair spends coins and gets it running again', async () => {
  const before = await ev(() => window.__garage.getState().save.coins);
  await page.click('#btn-repair');
  const r = await ev(() => ({
    coins: window.__garage.getState().save.coins,
    health: window.__garage.getState().setup().progress.health,
    card: document.querySelector('#garage-health')?.textContent,
  }));
  assert(r.coins < before && r.health >= 10 && r.card === `${Math.round(r.health)}%`, JSON.stringify({ before, ...r }));
  // back to the results screen state the next step starts from
  await ev(() => {
    const g = __t.g();
    g.startRun();
    __t.sim(3.3);
    g.scorer.time = 0.1;
    __t.sim(0.3);
  });
  return { before, ...r };
});

await step('R restarts from the results screen', async () => {
  return ev(() => {
    const g = __t.g();
    g.traffic.maxVehicles = 160;
    __t.press('KeyR');
    const p = g.phase;
    __t.sim(3.3);
    if (p !== 'countdown' || g.phase !== 'run' || g.scorer.score !== 0) throw new Error(JSON.stringify({ p, now: g.phase }));
    return { phase: g.phase };
  });
});

await step('running out of time ends the run and banks the combo', async () => {
  return ev(() => {
    const g = __t.g();
    g.scorer.comboPoints = 500;
    g.scorer.mult = 3;
    g.scorer.time = 0.2;
    __t.sim(0.5);
    const r = __t.st().result;
    if (g.phase !== 'results' || !r || r.reason !== 'time' || r.score !== 1500) throw new Error(JSON.stringify({ phase: g.phase, r }));
    // 1 coin per 20 points for this car
    if (!r.garage || r.garage.coins !== 75) throw new Error('coins ' + JSON.stringify(r.garage));
    return { reason: r.reason, score: r.score, coins: r.garage.coins };
  });
});

await step('Esc on results goes back to the title, with the run on the leaderboard', async () => {
  await ev(() => __t.press('Escape'));
  await page.waitForSelector('#btn-drive', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title-best.png' });
  return ev(() => ({
    phase: __t.g().phase,
    best: __t.st().best.map((b) => b.score),
  }));
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
    for (let i = 0; i < 40 && g.scorer.crashes === 0; i++) __t.sim(0.05);
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

await step('highway: no clock, traffic to weave through, near misses and crashes count', async () => {
  await ev(() => __t.g().toTitle());
  await page.waitForSelector('#mode-highway', { timeout: 20000 });
  await pickCar('demo-toyota-land-cruiser');
  await page.click('#mode-highway');
  await page.click('#btn-drive');
  const r = await ev(() => {
    const g = __t.g();
    const hw = g.highway;
    const car = g.car;
    const go = (v) => {
      car.body.setLinvel({ x: v, y: 0, z: 0 }, true);
      car.lastVel.set(v, 0, 0);
    };
    const clear = () => {
      for (const c of [...hw.cars]) if (c.dir === 1 && Math.abs(c.x - car.pos.x) < 220) hw.cars.splice(hw.cars.indexOf(c), 1);
    };
    __t.sim(3.3);
    const start = { onHighway: g.onHighway, cars: hw.cars.length, z: car.pos.z, phase: g.phase };
    // well past the time attack clock: still going
    __t.down('KeyW');
    clear();
    __t.sim(4);
    const timeBefore = g.scorer.time;
    for (let i = 0; i < 70; i++) {
      clear();
      __t.sim(1);
    }
    const noClock = { phase: g.phase, elapsed: Math.round(g.scorer.elapsed), time: g.scorer.time, timeBefore, distance: Math.round(g.scorer.distance) };
    // a slower car in the next lane: passing it close is a near miss
    clear();
    go(40);
    const lane = Math.round((car.pos.z + 4600 - 1.8) / 3.4 - 0.5);
    const c1 = hw.trySpawn(1, car.pos.x + 45, lane > 0 ? lane - 1 : lane + 1);
    c1.vDes = c1.v = 15;
    c1.cool = 99;
    const n0 = g.scorer.nearMisses;
    __t.sim(3);
    const near = g.scorer.nearMisses - n0;
    // let the combo bank (a crash would lose it)
    for (let i = 0; i < 5; i++) {
      clear();
      __t.sim(1);
    }
    const banked = g.scorer.score;
    // a car stopped in our lane: a hard crash that damages the car and stops the other one
    clear();
    go(38);
    const c2 = hw.trySpawn(1, car.pos.x + 30, lane);
    c2.vDes = c2.v = 8;
    c2.cool = 99;
    const h0 = g.scorer.health;
    __t.sim(2.5);
    __t.up('KeyW');
    return { start, noClock, near, banked, crash: { h0, health: g.scorer.health, crashed: c2.crashed, phase: g.phase } };
  });
  await page.screenshot({ path: 'scripts/out/nm-e2e-highway.png' });
  assert(r.start.onHighway && r.start.cars > 15 && r.start.z < -4000 && r.start.phase === 'run', JSON.stringify(r.start));
  assert(r.noClock.phase === 'run' && r.noClock.elapsed > 70 && r.noClock.time === r.noClock.timeBefore && r.noClock.distance > 1500, JSON.stringify(r.noClock));
  assert(r.near >= 1 && r.banked > 0, 'near misses ' + r.near + ', banked ' + r.banked);
  assert(r.crash.health < r.crash.h0 && r.crash.crashed && r.crash.phase === 'run', JSON.stringify(r.crash));
  const hud = await ev(() => !!document.querySelector('#hud-distance'));
  assert(hud, 'distance on the HUD');
  return r;
});

await step('highway: End drive banks the combo, pays coins and keeps its own best', async () => {
  await ev(() => __t.g().togglePause());
  await page.waitForSelector('#btn-end', { timeout: 10000 });
  const coins0 = await ev(() => window.__garage.getState().save.coins);
  await page.click('#btn-end');
  await page.waitForSelector('#btn-again', { timeout: 10000 });
  const r = await ev(() => ({
    result: __t.st().result,
    best: __t.st().bestHighway.length,
    coins: window.__garage.getState().save.coins,
    title: document.querySelector('#results')?.textContent,
  }));
  await page.screenshot({ path: 'scripts/out/nm-e2e-highway-results.png' });
  assert(r.result.mode === 'highway' && r.result.reason === 'ended' && r.result.score > 0 && r.best >= 1 && r.coins > coins0 && /Drive over/.test(r.title), JSON.stringify({ ...r, title: r.title?.slice(0, 40) }));
  await page.click('#btn-title');
  const back = await ev(() => ({ onHighway: __t.g().onHighway, phase: __t.g().phase, showroom: !!__t.g().showroom, hidden: !__t.g().highway.group.visible }));
  assert(!back.onHighway && back.phase === 'title' && back.hidden, JSON.stringify(back));
  await ev(() => __t.st().set({ mode: 'score' }));
  return { score: r.result.score, coins: r.coins - coins0, back };
});

await step('high score shows on the loading screen after a reload', async () => {
  const best = await ev(() => __t.st().best[0]?.score ?? 0);
  await page.reload();
  await page.waitForSelector('#high-score', { timeout: 60000 });
  const r = await ev(() => ({
    phase: window.__nmStore.getState().phase,
    text: document.querySelector('#high-score').textContent,
  }));
  await page.screenshot({ path: 'scripts/out/nm-e2e-loading.png' });
  assert(best > 0 && r.text.includes(best.toLocaleString('en-US')) && r.text.includes('Races won'), JSON.stringify({ best, ...r }));
  await page.waitForSelector('#btn-drive', { timeout: 240000 });
  const t = await ev(() => document.querySelector('#high-score')?.textContent);
  assert(t && t.includes(best.toLocaleString('en-US')), 'title: ' + t);
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
