// End-to-end test for Near Miss in headless Chromium.
// Usage: npm run dev (in another shell), then: node scripts/e2e-nearmiss.mjs
// Cars are placed with the traffic system's own spawn() so passes and crashes happen on cue; the game is
// advanced with window.__nm.simulate() because software WebGL draws ~1 frame a second.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = process.env.URL ?? 'http://localhost:5173/near-miss.html?preset=low';
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

await page.goto(URL);

await step('loads to the title screen', async () => {
  await page.waitForSelector('#btn-drive', { timeout: 240000 });
  await ev(HELPERS);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title.png' });
  return ev(() => ({ phase: __t.g().phase, traffic: __t.g().traffic.vehicles.length }));
});

await step('pick a car and conditions, countdown, then drive', async () => {
  await page.click('#car-0');
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
    return { c0, still: +still.toFixed(2), c1, speed: +g.car.forwardSpeed.toFixed(1), car: g.car.label, clock: +g.scorer.time.toFixed(1) };
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
    return { spawned, near: g.scorer.nearMisses - n0, mult: g.scorer.mult, combo: Math.round(g.scorer.comboPoints), phase: g.phase, minD: +minD.toFixed(2) };
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
    return { oncoming: +(g.scorer.oncomingSec - s0).toFixed(2), hud: __t.st().hud.oncoming, combo: Math.round(g.scorer.comboPoints) };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/out/nm-e2e-oncoming.png' });
  assert(r.oncoming > 0.9 && r.hud && r.combo > 0, JSON.stringify(r));
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

await step('hitting a stopped car at speed wrecks the run', async () => {
  const r = await ev(() => {
    const g = __t.g();
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
  const r = await ev(() => ({ result: __t.st().result, best: __t.st().best.length }));
  assert(r.result && r.result.reason === 'wrecked' && r.result.nearMisses >= 1 && r.result.rank >= 1 && r.best >= 1, JSON.stringify(r));
  return { score: r.result.score, rank: r.result.rank, nearMisses: r.result.nearMisses, top: r.result.topSpeed };
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
    return { reason: r.reason, score: r.score };
  });
});

await step('Esc on results goes back to the title, with the run on the leaderboard', async () => {
  await ev(() => __t.press('Escape'));
  await page.waitForSelector('#btn-drive', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/nm-e2e-title-best.png' });
  return ev(() => ({ phase: __t.g().phase, best: __t.st().best.map((b) => b.score) }));
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

await step('no runtime errors', async () => {
  assert(errors.length === 0, errors.slice(0, 5).join('\n---\n'));
});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
