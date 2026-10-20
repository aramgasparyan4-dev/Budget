// End-to-end gameplay test in headless Chromium.
// Usage: npm run dev (in another shell), then: node scripts/e2e.mjs
// Drives the real game: input events are dispatched to the page and the simulation is
// advanced with window.__echo.simulate() because software WebGL renders at ~1-2 fps.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = process.env.URL ?? 'http://localhost:5173/echo-city/?preset=low';
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
    results.push({ name, ok: true, info });
    console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${info ? ' ' + JSON.stringify(info) : ''}`);
  } catch (e) {
    results.push({ name, ok: false, info: String(e.message ?? e) });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
  }
}
const ev = (fn, arg) => page.evaluate(fn, arg);
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};

// helpers injected into the page
const HELPERS = `
window.__t = {
  g: () => window.__echo,
  s: () => window.__echo.session,
  st: () => window.__store.getState(),
  down: (code, key) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: key ?? code, bubbles: true })),
  up: (code, key) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: key ?? code, bubbles: true })),
  press: (code, key) => { window.__t.down(code, key); window.__t.up(code, key); },
  sim: (sec) => window.__echo.simulate(sec),
  pos: () => { const p = window.__echo.session.playerPos(); return { x: p.x, y: p.y, z: p.z }; },
  homeFront: (d = 1.6) => {
    const c = window.__echo.city; const b = c.buildings[c.playerHome];
    const o = [[0,-1],[1,0],[0,1],[-1,0]][b.facing];
    return { x: b.door.x + o[0] * d, z: b.door.z + o[1] * d, yaw: Math.atan2(-o[0], -o[1]), b };
  },
  tp: (x, z, yaw = 0) => { const s = window.__echo.session; s.ctl.teleport(x, 0.2, z, yaw); window.__echo.cam.yaw = yaw; },
};
`;

await page.goto(URL);

await step('boot to main menu', async () => {
  await page.waitForSelector('#btn-new', { timeout: 240000 });
  await ev(HELPERS);
  const st = await ev(() => ({ screen: window.__store.getState().screen, seed: window.__echo.worldSeed, bld: window.__echo.city.buildings.length }));
  assert(st.screen === 'menu', 'screen ' + st.screen);
  return st;
});

await step('new game with character creation', async () => {
  await page.click('#btn-new');
  await page.waitForSelector('#in-name', { timeout: 30000 });
  await page.fill('#in-name', 'Tester');
  await page.screenshot({ path: 'scripts/out/e2e-newgame.png' });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-begin', { timeout: 60000 });
  await ev(() => window.__t.sim(3));
  await page.screenshot({ path: 'scripts/out/e2e-intro.png' });
  await page.click('#btn-begin');
  await ev(() => window.__t.sim(1));
  const r = await ev(() => ({ name: __t.s().player.name, cash: __t.s().player.cash, mode: __t.s().mode, overlay: __t.st().overlay, obj: __t.st().hud.objective }));
  assert(r.name === 'Tester' && r.cash === 250 && r.mode === 'foot' && r.overlay === null, JSON.stringify(r));
  assert(r.obj === 'Look around', 'objective ' + r.obj);
  return r;
});

await step('walk forward (W) and sprint (Shift)', async () => {
  return ev(() => {
    // stand in the middle of the nearest north-south road, facing along it, so nothing is in the way
    const c = __t.g().city;
    const p0 = __t.pos();
    const line = c.vLines.reduce((a, l) => (Math.abs(l.pos - p0.x) < Math.abs(a.pos - p0.x) ? l : a));
    __t.tp(line.pos, p0.z, 0);
    __t.sim(0.3);
    const a = __t.pos();
    __t.down('KeyW');
    __t.sim(2.5);
    const b = __t.pos();
    __t.down('ShiftLeft');
    __t.sim(1.5);
    const sp = __t.s().ctl.speed;
    __t.up('ShiftLeft');
    __t.up('KeyW');
    __t.sim(0.5);
    const walked = Math.hypot(b.x - a.x, b.z - a.z);
    if (walked < 5) throw new Error('walked only ' + walked.toFixed(2));
    if (sp < 6) throw new Error('sprint speed ' + sp.toFixed(2));
    return { walked: +walked.toFixed(1), sprint: +sp.toFixed(1), y: +b.y.toFixed(2) };
  });
});

await step('jump (Space)', async () => {
  return ev(() => {
    __t.sim(0.5);
    const y0 = __t.s().ctl.pos.y;
    __t.press('Space', ' ');
    let peak = y0;
    for (let i = 0; i < 12; i++) {
      __t.sim(0.05);
      peak = Math.max(peak, __t.s().ctl.pos.y);
    }
    __t.sim(1);
    const y1 = __t.s().ctl.pos.y;
    if (peak - y0 < 0.4) throw new Error('jump height ' + (peak - y0).toFixed(2));
    if (Math.abs(y1 - y0) > 0.1) throw new Error('did not land ' + y1);
    return { height: +(peak - y0).toFixed(2) };
  });
});

await step('building collision', async () => {
  return ev(() => {
    const h = __t.homeFront(3);
    __t.tp(h.x, h.z, h.yaw);
    __t.down('KeyW');
    __t.sim(3);
    __t.up('KeyW');
    const p = __t.pos();
    const b = h.b;
    const inside = p.x > b.x0 + 0.2 && p.x < b.x1 - 0.2 && p.z > b.z0 + 0.2 && p.z < b.z1 - 0.2;
    if (inside) throw new Error(`walked into building ${JSON.stringify(p)}`);
    return { p: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, box: [b.x0, b.z0, b.x1, b.z1].map((v) => +v.toFixed(1)) };
  });
});

await step('tutorial steps: look + walk', async () => {
  return ev(() => {
    // look: mouse motion
    for (let i = 0; i < 30; i++) {
      __t.g().input.mouseDX = 20;
      __t.g().update(1 / 30);
    }
    __t.down('KeyW');
    __t.sim(3);
    __t.up('KeyW');
    __t.sim(0.5);
    return { step: __t.s().objectives.step, obj: __t.st().hud.objective };
  });
});

await step('enter and exit apartment (E)', async () => {
  const r = await ev(() => {
    const h = __t.homeFront(1.4);
    __t.tp(h.x, h.z, h.yaw);
    __t.sim(0.3);
    const prompt = __t.s().current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(2.5);
    return { prompt, mode: __t.s().mode, interior: __t.st().hud.interior };
  });
  assert(r.mode === 'interior', 'mode ' + r.mode + ' prompt ' + r.prompt);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/e2e-apartment.png' });
  const r3 = await ev(() => {
    const s = __t.s();
    // stations are in interior-local coordinates around INTERIOR_ORIGIN (0, -300, 0)
    const st = s.interiors.current.layout.stations.find((x) => x.id === 'exit');
    s.ctl.teleport(st.x, s.ctl.pos.y, st.z - 0.3, 0);
    __t.sim(0.3);
    const prompt = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(2.5);
    return { prompt, mode: s.mode };
  });
  assert(r3.mode === 'foot', 'after exit mode ' + r3.mode + ' prompt ' + r3.prompt);
  return { enterPrompt: r.prompt, interior: r.interior, exitPrompt: r3.prompt };
});

await step('phone (TAB) and map (M)', async () => {
  await ev(() => {
    __t.press('Tab');
  });
  await page.waitForTimeout(1500);
  const a = await ev(() => __t.st().overlay);
  await page.screenshot({ path: 'scripts/out/e2e-phone.png' });
  await page.click('button:has(span:text-is("Jobs"))', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/e2e-phone-jobs.png' });
  await ev(() => __t.press('Tab'));
  const b = await ev(() => __t.st().overlay);
  if (b !== null) await ev(() => window.__store.getState().setOverlay(null));
  await ev(() => __t.press('KeyM', 'm'));
  await page.waitForTimeout(2000);
  const c = await ev(() => __t.st().overlay);
  await page.screenshot({ path: 'scripts/out/e2e-map.png' });
  await ev(() => __t.press('KeyM', 'm'));
  const d = await ev(() => __t.st().overlay);
  assert(a === 'phone' && b === null && c === 'map' && d === null, JSON.stringify({ a, b, c, d }));
  return { phoneEvent: await ev(() => __t.s().objectives.step) };
});

await step('food delivery job end-to-end', async () => {
  return ev(() => {
    const s = __t.s();
    let tries = 0;
    while (!s.jobs.available.some((j) => j.kind === 'food') && tries++ < 20) __t.sim(2);
    const j = s.jobs.available.find((x) => x.kind === 'food');
    if (!j) throw new Error('no food job generated');
    const money0 = s.player.money;
    s.jobs.accept(j.id);
    __t.tp(j.pickup.x + 0.8, j.pickup.z + 0.8);
    __t.sim(0.3);
    const p1 = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.3);
    const stage = s.jobs.active?.stage;
    const has = s.player.inventory.some((i) => i.kind === 'delivery');
    const st = j.stops[0];
    __t.tp(st.x + 0.8, st.z + 0.8);
    __t.sim(0.3);
    const p2 = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.3);
    const earned = s.player.money - money0;
    if (stage !== 'deliver' || !has) throw new Error(`pickup failed: prompt=${p1} stage=${stage}`);
    if (earned <= 0 || s.jobs.active) throw new Error(`delivery failed: prompt=${p2} earned=${earned}`);
    return { pickupPrompt: p1, deliverPrompt: p2, earned: +earned.toFixed(2), step: s.objectives.step };
  });
});

let talked = -1;
await step('talk to a resident (E, options 1-9, Esc)', async () => {
  const r = await ev(() => {
    const s = __t.s();
    let tries = 0;
    while (s.peds.peds.filter((p) => p.state === 'walk' || p.state === 'idle').length === 0 && tries++ < 10) __t.sim(2);
    const p = s.peds.peds.find((x) => x.state === 'walk' || x.state === 'idle') ?? s.peds.peds[0];
    if (!p) throw new Error('no pedestrians spawned');
    __t.tp(p.x + 1.2, p.z + 0.4, Math.atan2(-1.2, -0.4));
    __t.sim(0.1);
    const prompt = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    return { prompt, overlay: __t.st().overlay, npc: s.dialogue.target?.npc?.id ?? p.npc.id, active: s.dialogue.active };
  });
  assert(r.overlay === 'dialogue', JSON.stringify(r));
  talked = r.npc;
  await page.waitForTimeout(2000);
  const lines0 = await ev(() => JSON.stringify(__t.s().dialogue.lines));
  await ev(() => __t.press('Digit1', '1'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/e2e-dialogue.png' });
  const lines1 = await ev(() => JSON.stringify(__t.s().dialogue.lines));
  await ev(() => __t.press('Escape', 'Escape'));
  await ev(() => __t.sim(0.3));
  const after = await ev((id) => ({ overlay: __t.st().overlay, fam: __t.s().npcs[id].relPlayer.fam, mem: __t.s().npcs[id].memories.filter((m) => m.type === 'talked_player' || m.type === 'met_player').length }), talked);
  assert(lines1 !== lines0 && lines1.includes('"you"'), `no reply (${lines0} -> ${lines1})`);
  assert(after.overlay === null, 'dialogue did not close: ' + after.overlay);
  assert(after.fam > 0, 'familiarity not increased');
  return { prompt: r.prompt, lines: JSON.parse(lines1).slice(-2), ...after };
});

await step('drive a car (F, W, S, F)', async () => {
  const r = await ev(() => {
    const s = __t.s();
    // place a car mid-block on the nearest north-south road, in the right-hand lane, with no traffic close by
    const c = __t.g().city;
    const p = __t.pos();
    const seg = c.segments.filter((x) => x.exists && x.orient === 'v').reduce((a, x) => (Math.hypot(x.x0 - p.x, (x.z0 + x.z1) / 2 - p.z) < Math.hypot(a.x0 - p.x, (a.z0 + a.z1) / 2 - p.z) ? x : a));
    const best = { x: seg.x0 - 2.2, z: seg.z0 + 8, yaw: 0 };
    for (const tv of [...s.traffic.vehicles]) if (Math.abs(tv.x - best.x) < 12 && tv.z > best.z - 10 && tv.z < best.z + 90) s.traffic.remove(tv);
    s.ctl.teleport(best.x - 2.6, 0.2, best.z, 0);
    const v = s.spawnVehicle(1, best.x, best.z, best.yaw, 0xc0392b, 'player', 'Test Sedan');
    __t.sim(1);
    __t.press('KeyF', 'f');
    __t.sim(0.3);
    const mode = s.mode;
    __t.down('KeyW');
    __t.sim(4);
    const speed = Math.abs(v.forwardSpeed);
    __t.up('KeyW');
    __t.down('KeyS');
    let t = 0;
    while (Math.abs(v.forwardSpeed) > 0.8 && t < 8) { __t.sim(0.25); t += 0.25; }
    __t.up('KeyS');
    __t.sim(0.3);
    const stopped = Math.abs(v.forwardSpeed);
    const hud = __t.st().hud;
    __t.press('KeyF', 'f');
    __t.sim(0.5);
    return { enteredMode: mode, speed: +speed.toFixed(1), brakeTime: t, stopped: +stopped.toFixed(2), speedo: hud.inVehicle, after: s.mode };
  });
  assert(r.enteredMode === 'vehicle', 'enter failed ' + JSON.stringify(r));
  assert(r.speed > 5, 'too slow ' + r.speed);
  assert(r.after === 'foot', 'exit failed');
  return r;
});

await step('buy food inside a café (shop UI)', async () => {
  const r = await ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    const b = c.buildings[c.landmarks.tutorialCafe];
    const o = [[0,-1],[1,0],[0,1],[-1,0]][b.facing];
    __t.tp(b.door.x + o[0] * 1.4, b.door.z + o[1] * 1.4, Math.atan2(-o[0], -o[1]));
    __t.sim(0.3);
    const prompt = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(2.5);
    if (s.mode !== 'interior') throw new Error('could not enter café: ' + prompt);
    const st = s.interiors.current.layout.stations.find((x) => x.id === 'shop');
    s.ctl.teleport(st.x, s.ctl.pos.y, st.z + 0.6, Math.PI);
    __t.sim(0.3);
    const p2 = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    return { prompt, p2, overlay: __t.st().overlay, money: s.player.money, hunger: s.player.hunger, items: s.player.inventory.length };
  });
  assert(r.overlay === 'shop', 'shop did not open: ' + JSON.stringify(r));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/e2e-shop.png' });
  await page.locator('.glass button').first().click();
  const after = await ev(() => ({ money: __t.s().player.money, hunger: __t.s().player.hunger, items: __t.s().player.inventory.length }));
  await ev(() => __t.press('Escape', 'Escape'));
  await ev(() => {
    const s = __t.s();
    const st = s.interiors.current.layout.stations.find((x) => x.id === 'exit');
    s.ctl.teleport(st.x, s.ctl.pos.y, st.z - 0.3, 0);
    __t.sim(0.3);
    __t.press('KeyE', 'e');
    __t.sim(2.5);
  });
  assert(after.money < r.money, 'nothing was charged');
  return { prompt: r.prompt, station: r.p2, spent: +(r.money - after.money).toFixed(2), hunger: [+r.hunger.toFixed(2), +after.hunger.toFixed(2)], items: after.items };
});

await step('rain and night rendering', async () => {
  const r = await ev(() => {
    const s = __t.s();
    s.weather.set('rainy', s.t, true);
    __t.sim(2);
    return { rain: +s.weather.p.rain.toFixed(2), wet: +s.weather.p.wet.toFixed(2), label: __t.st().hud.weather };
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/e2e-rain.png' });
  const n = await ev(() => {
    const s = __t.s();
    s.weather.set('sunny', s.t, true);
    s.clock.t = Math.floor(s.clock.t / 1440) * 1440 + 22 * 60;
    __t.sim(2);
    return { hour: +s.clock.hour.toFixed(1) };
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/e2e-night.png' });
  assert(r.rain > 0.5, 'rain param ' + r.rain);
  return { ...r, ...n };
});

let saved = null;
await step('save to slot 1 (IndexedDB)', async () => {
  saved = await ev(async (id) => {
    const s = __t.s();
    const m = await window.__flow.saveSlot('slot1');
    const p = __t.pos();
    return { meta: m && { label: m.label, money: m.money }, cash: s.player.cash, bank: s.player.bank, t: s.clock.t, x: p.x, z: p.z, step: s.objectives.step, fam: id >= 0 ? s.npcs[id].relPlayer.fam : 0, mems: id >= 0 ? s.npcs[id].memories.length : 0, cars: s.player.vehicles.length, contacts: s.player.contacts.length };
  }, talked);
  assert(saved.meta, 'save returned null');
  return saved;
});

await step('quit to menu and continue (load)', async () => {
  await ev(() => window.__flow.quitToMenu());
  await page.waitForSelector('#btn-continue', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/out/e2e-menu-continue.png' });
  await ev(async () => {
    await window.__flow.loadSlot('slot1');
  });
  await ev(() => __t.sim(0.5));
  const r = await ev((id) => {
    const s = __t.s();
    const p = __t.pos();
    return { cash: s.player.cash, bank: s.player.bank, t: s.clock.t, x: p.x, z: p.z, step: s.objectives.step, fam: id >= 0 ? s.npcs[id].relPlayer.fam : 0, mems: id >= 0 ? s.npcs[id].memories.length : 0, name: s.player.name, cars: s.vehicles.length, mode: s.mode };
  }, talked);
  const d = Math.hypot(r.x - saved.x, r.z - saved.z);
  assert(Math.abs(r.cash - saved.cash) < 0.01 && Math.abs(r.bank - saved.bank) < 0.01, `money ${r.cash}/${r.bank} vs ${saved.cash}/${saved.bank}`);
  assert(d < 4, 'position off by ' + d.toFixed(1));
  assert(Math.abs(r.t - saved.t) < 5, 'clock off');
  assert(r.step === saved.step, 'objective step ' + r.step + ' vs ' + saved.step);
  assert(Math.abs(r.fam - saved.fam) < 0.01, 'relationship lost');
  assert(r.mems >= saved.mems, 'memories lost');
  assert(r.name === 'Tester', 'name ' + r.name);
  assert(r.mode === 'foot', 'mode ' + r.mode);
  return { ...r, posErr: +d.toFixed(2) };
});

await step('pause menu (Esc) freezes time', async () => {
  const r = await ev(() => {
    __t.press('Escape', 'Escape');
    const ov = __t.st().overlay;
    const t0 = __t.s().clock.t;
    __t.sim(2);
    const t1 = __t.s().clock.t;
    return { ov, dt: t1 - t0 };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/out/e2e-pause.png' });
  await page.click('#btn-resume');
  const ov2 = await ev(() => __t.st().overlay);
  assert(r.ov === 'pause' && r.dt === 0 && ov2 === null, JSON.stringify({ ...r, ov2 }));
  return r;
});

await step('sleep at home advances time and restores energy', async () => {
  return ev(() => {
    const s = __t.s();
    s.player.energy = 0.2;
    const t0 = s.clock.t;
    s.sleep(8);
    for (let i = 0; i < 40 && (s.skipping || s.fade > 0.01); i++) __t.sim(0.25);
    return { hours: +((s.clock.t - t0) / 60).toFixed(1), energy: +s.player.energy.toFixed(2) };
  });
});

await step('multi-day simulation stays healthy', async () => {
  return ev(() => {
    const s = __t.s();
    const t0 = performance.now();
    s.skipTime(60 * 30, 'test');
    for (let i = 0; i < 40 && (s.skipping || s.fade > 0.01); i++) __t.sim(0.25);
    __t.sim(3);
    const working = s.npcs.filter((n) => n.activity.kind === 'work').length;
    return { day: s.clock.day, hour: +s.clock.hour.toFixed(1), working, peds: s.peds.peds.length, traffic: s.traffic.vehicles.length, ms: Math.round(performance.now() - t0) };
  });
});

await step('new game with a different city seed', async () => {
  await ev(() => window.__flow.quitToMenu());
  await page.waitForSelector('#btn-new', { timeout: 30000 });
  await page.click('#btn-new');
  await page.waitForSelector('#in-seed');
  await page.fill('#in-seed', '777');
  await page.click('#btn-start');
  await page.waitForSelector('#btn-begin', { timeout: 240000 });
  await page.click('#btn-begin');
  const r = await ev(() => {
    __t.sim(2);
    const s = __t.s();
    return { seed: __t.g().worldSeed, buildings: __t.g().city.buildings.length, businesses: __t.g().city.businesses.length, mode: s.mode, peds: s.peds.peds.length };
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scripts/out/e2e-seed777.png' });
  assert(r.seed === 777 && r.mode === 'foot', JSON.stringify(r));
  return r;
});

await step('performance counters', async () => {
  await page.waitForTimeout(2000);
  return ev(() => __t.st().perf);
});

await page.screenshot({ path: 'scripts/out/e2e-final.png' });
await step('no runtime errors', async () => {
  assert(errors.length === 0, errors.slice(0, 5).join('\n---\n'));
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
