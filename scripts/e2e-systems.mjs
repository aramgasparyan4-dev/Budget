// Second end-to-end pass over the deeper systems: employment shifts, taxi fares, the car dealership,
// owning a business, banking, city events, map waypoints and changing graphics settings mid-game.
// Usage: npm run dev (in another shell), then: node scripts/e2e-systems.mjs
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
    await page.evaluate(() => window.__t?.s() && window.__t.reset());
    const info = await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${info ? ' ' + JSON.stringify(info) : ''}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
  }
}
const ev = (fn, arg) => page.evaluate(fn, arg);
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};
const HELPERS = `
window.__t = {
  g: () => window.__echo,
  s: () => window.__echo.session,
  st: () => window.__store.getState(),
  down: (code, key) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: key ?? code, bubbles: true })),
  up: (code, key) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: key ?? code, bubbles: true })),
  press: (code, key) => { window.__t.down(code, key); window.__t.up(code, key); },
  sim: (sec) => window.__echo.simulate(sec),
  waitSkip: () => { const s = window.__echo.session; for (let i = 0; i < 80 && (s.skipping || s.fade > 0.01); i++) window.__echo.simulate(0.25); },
  front: (b, d = 1.4) => { const o = [[0,-1],[1,0],[0,1],[-1,0]][b.facing]; return { x: b.door.x + o[0] * d, z: b.door.z + o[1] * d, yaw: Math.atan2(-o[0], -o[1]) }; },
  tp: (x, z, yaw = 0) => { const s = window.__echo.session; s.ctl.teleport(x, 0.2, z, yaw); window.__echo.cam.yaw = yaw; },
  enter: (b) => {
    const f = window.__t.front(b);
    window.__t.tp(f.x, f.z, f.yaw);
    window.__t.sim(0.3);
    const prompt = window.__echo.session.current.e?.text;
    window.__t.press('KeyE', 'e');
    window.__t.sim(2.5);
    return prompt;
  },
  station: (id) => {
    const s = window.__echo.session;
    const st = s.interiors.current.layout.stations.find((x) => x.id === id);
    if (!st) return null;
    s.ctl.teleport(st.x, s.ctl.pos.y, st.z + 0.5, Math.PI);
    window.__t.sim(0.3);
    return s.current.e?.text ?? null;
  },
  reset: () => {
    const s = window.__echo.session;
    if (s.dialogue.active) s.dialogue.end();
    s.minigame?.cancel();
    window.__ui.useShop.getState().set(null);
    window.__store.getState().setOverlay(null);
    if (s.driving) s.exitVehicle(true);
    s.interiors?.forceExit();
    window.__t.waitSkip();
  },
  click: (re) => {
    const el = [...document.querySelectorAll('.glass button')].find((b) => re.test(b.textContent) && !b.disabled);
    if (!el) return null;
    el.click();
    return el.textContent;
  },
  leave: () => {
    window.__t.station('exit');
    window.__t.press('KeyE', 'e');
    window.__t.sim(2.5);
    return window.__echo.session.mode;
  },
};
`;

await page.goto(URL);
await step('boot and start a game (tutorial skipped)', async () => {
  await page.waitForSelector('#btn-new', { timeout: 240000 });
  await ev(HELPERS);
  await page.click('#btn-new');
  await page.waitForSelector('#in-name');
  await page.click('text=Skip tutorial');
  await page.click('#btn-start');
  await page.waitForSelector('#btn-begin', { timeout: 60000 });
  await page.click('#btn-begin');
  const r = await ev(() => ({ mode: __t.s().mode, tut: __t.s().objectives.tutorial, obj: __t.st().hud.objective }));
  assert(r.mode === 'foot' && r.tut === false, JSON.stringify(r));
  return r;
});

await step('bank: deposit at the teller', async () => {
  const r = await ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    const b = c.buildings[c.landmarks.bank];
    // banks keep office hours
    s.clock.t = Math.floor(s.clock.t / 1440) * 1440 + 11 * 60;
    __t.sim(0.5);
    const prompt = __t.enter(b);
    if (s.mode !== 'interior') throw new Error('bank closed? ' + prompt);
    const st = __t.station('teller') ?? __t.station('atm');
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    return { prompt, station: st, overlay: __t.st().overlay, cash: s.player.cash, bank: s.player.bank };
  });
  assert(r.overlay === 'shop', 'bank menu did not open ' + JSON.stringify(r));
  await page.waitForTimeout(800);
  const clicked = await ev(() => __t.click(/Deposit \$50/));
  const after = await ev(() => ({ cash: __t.s().player.cash, bank: __t.s().player.bank }));
  assert(clicked, 'no deposit button');
  assert(after.bank === r.bank + 50 && after.cash === r.cash - 50, 'deposit wrong ' + JSON.stringify({ r, after }));
  return { station: r.station, cash: [r.cash, after.cash], bank: [r.bank, after.bank] };
});

await step('employment: apply, work a shift (mini-game), get paid', async () => {
  return ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    // a café with an opening
    const biz = c.businesses.find((b) => b.type === 'cafe' && s.econ.openings(b.id) > 0 && !s.econ.biz[b.id].closed);
    if (!biz) throw new Error('no café hiring');
    if (!s.jobs.apply(biz.id)) throw new Error('apply refused');
    const j = s.player.job;
    // jump to the next shift start on a working day
    let t = Math.floor(s.clock.t / 1440) * 1440 + j.start * 60 + 5;
    while (!j.days.includes(Math.floor(t / 1440) % 7) || t < s.clock.t) t += 1440;
    s.clock.t = t;
    __t.sim(0.5);
    const prompt = __t.enter(c.buildings[biz.building]);
    if (s.mode !== 'interior') throw new Error('could not enter workplace: ' + prompt);
    const wp = __t.station('work');
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    if (__t.st().overlay !== 'minigame') throw new Error(`mini-game did not start (station: ${wp}, status: ${s.jobs.shiftStatus().label})`);
    const mg = s.minigame;
    const bank0 = s.player.bank;
    let rounds = 0;
    while (mg.active && rounds < 20) {
      const r = mg.rounds[mg.i];
      __t.press('Digit' + (r.correct + 1), String(r.correct + 1));
      __t.sim(1);
      rounds++;
    }
    __t.waitSkip();
    __t.sim(0.5);
    const paid = s.player.bank - bank0;
    const mode = s.mode;
    if (mode === 'interior') __t.leave();
    if (paid <= 0) throw new Error('no wage paid');
    return { role: j.role, wage: j.wage, workPrompt: wp, rounds, paid, shifts: j.shifts, hour: +s.clock.hour.toFixed(1) };
  });
});

await step('taxi shift: start, pick up a hailing resident, drop off', async () => {
  return ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    s.clock.t = Math.floor(s.clock.t / 1440) * 1440 + 1440 + 9 * 60; // next morning, lots of people walking
    __t.sim(1);
    const tb = c.buildings[c.landmarks.taxi];
    const f = __t.front(tb, 1.2);
    __t.tp(f.x, f.z, f.yaw);
    __t.sim(0.3);
    const prompt = s.current.f?.text;
    __t.press('KeyF', 'f');
    __t.sim(0.3);
    const taxi = s.jobs.taxi;
    if (!taxi) throw new Error('taxi shift did not start: ' + prompt);
    s.enterVehicle(taxi.vehicle);
    // wait for a fare to appear (needs pedestrians 30-140 m away on long trips)
    let tries = 0;
    while (!taxi.fare && tries++ < 60) __t.sim(1);
    if (!taxi.fare) throw new Error('no fare hailed after 60 s');
    // drive up to the passenger (teleport the cab beside them, stopped)
    const ped = s.peds.byNpc.get(taxi.fare.npc);
    taxi.vehicle.teleport(ped.x + 3, 0.02, ped.z, taxi.vehicle.yaw);
    __t.sim(1.5);
    if (taxi.fare?.stage !== 'ride') throw new Error('passenger did not get in: ' + taxi.fare?.stage);
    const dest = s.nsys.placePos(taxi.fare.dest);
    const money0 = s.player.money;
    taxi.vehicle.teleport(dest.x + 6, 0.02, dest.z + 6, taxi.vehicle.yaw);
    __t.sim(1.5);
    const earned = s.player.money - money0;
    if (earned <= 0) throw new Error('no fare paid; stage ' + taxi.fare?.stage);
    s.exitVehicle(true);
    s.jobs.endTaxi();
    return { prompt, earned, fares: s.player.stats.fares };
  });
});

await step('dealership: buy a car, it is parked outside and drivable', async () => {
  const r = await ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    s.player.bank += 30000;
    const b = c.buildings[c.landmarks.dealership];
    s.clock.t = Math.floor(s.clock.t / 1440) * 1440 + 12 * 60;
    __t.sim(0.5);
    const prompt = __t.enter(b);
    if (s.mode !== 'interior') throw new Error('dealership closed? ' + prompt);
    const st = s.interiors.current.layout.stations.find((x) => x.id.startsWith('car_'));
    s.ctl.teleport(st.x + 2.4, s.ctl.pos.y, st.z, Math.PI);
    __t.sim(0.3);
    const p2 = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    return { prompt: p2, overlay: __t.st().overlay };
  });
  assert(r.overlay === 'shop', 'dealer did not open: ' + r.prompt);
  await page.waitForTimeout(800);
  const bought = await ev(() => __t.click(/km\/h/));
  await page.waitForTimeout(300);
  const d = await ev(() => {
    const s = __t.s();
    __t.reset();
    const v = s.vehicles.find((x) => x.owner === 'player');
    if (!v) throw new Error('no car bought');
    const door = v.doorPoint(1);
    s.ctl.teleport(door.x, 0.2, door.z, 0);
    __t.sim(0.3);
    const fp = s.current.f?.text;
    __t.press('KeyF', 'f');
    __t.sim(0.3);
    const mode = s.mode;
    __t.down('KeyW');
    __t.sim(2);
    __t.up('KeyW');
    const sp = Math.abs(v.forwardSpeed);
    s.exitVehicle(true);
    return { car: v.label, enterPrompt: fp, mode, speed: +sp.toFixed(1), owned: s.player.vehicles.length };
  });
  assert(d.mode === 'vehicle' && d.speed > 2, JSON.stringify(d));
  return { station: r.prompt, clicked: bought?.slice(0, 30), ...d };
});

await step('own a business: buy a storefront, earn daily profit', async () => {
  const r = await ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    s.player.bank += 200000;
    const b = c.buildings.find((x) => x.forSale);
    if (!b) throw new Error('no storefront for sale');
    const f = __t.front(b, 1.3);
    __t.tp(f.x, f.z, f.yaw);
    __t.sim(0.3);
    const prompt = s.current.e?.text;
    __t.press('KeyE', 'e');
    __t.sim(0.2);
    return { prompt, overlay: __t.st().overlay, n0: c.businesses.length };
  });
  assert(r.overlay === 'shop', 'purchase dialog did not open: ' + r.prompt);
  await page.waitForTimeout(800);
  await ev(() => __t.click(/Café/));
  const d = await ev(() => {
    const s = __t.s();
    const c = __t.g().city;
    const id = s.player.business;
    if (id === null) throw new Error('business not created');
    const bank0 = s.player.bank;
    s.skipTime(60 * 48, 'test');
    __t.waitSkip();
    __t.sim(1);
    const st = s.econ.biz[id];
    const cafes = s.econ.biz.filter((x) => c.businesses[x.id].type === 'cafe' && x.owner === 'npc' && !x.closed && x.history.length);
    const avg = Math.round(cafes.reduce((a, x) => a + x.history[x.history.length - 1], 0) / Math.max(1, cafes.length));
    return { name: c.businesses[id].name, staff: st.employees.length, history: st.history.slice(-3).map((x) => Math.round(x)), avgNpcCafe: avg, bankDelta: Math.round(s.player.bank - bank0), businesses: c.businesses.length };
  });
  assert(d.businesses === r.n0 + 1, 'business count');
  return { prompt: r.prompt, ...d };
});

let snapshot = null;
await step('save and reload keeps job, car and business', async () => {
  snapshot = await ev(async () => {
    const s = __t.s();
    await window.__flow.saveSlot('slot2');
    return { job: s.player.job?.biz, cars: s.player.vehicles.length, business: s.player.business, name: s.business.def?.name, bizCount: __t.g().city.businesses.length };
  });
  await ev(() => window.__flow.quitToMenu());
  const reverted = await ev(() => __t.g().city.businesses.length);
  await page.waitForSelector('#btn-continue', { timeout: 30000 });
  await ev(async () => {
    await window.__flow.loadSlot('slot2');
  });
  await ev(() => __t.sim(1));
  const r = await ev(() => {
    const s = __t.s();
    return { job: s.player.job?.biz, cars: s.player.vehicles.length, spawned: s.vehicles.filter((v) => v.owner === 'player').length, business: s.player.business, name: s.business.def?.name, bizCount: __t.g().city.businesses.length, econ: s.econ.biz.length };
  });
  assert(reverted === snapshot.bizCount - 1, `city not reverted on quit (${reverted} vs ${snapshot.bizCount})`);
  assert(r.job === snapshot.job && r.cars === snapshot.cars && r.spawned === snapshot.cars, 'job/cars ' + JSON.stringify(r));
  assert(r.business === snapshot.business && r.name === snapshot.name && r.bizCount === snapshot.bizCount && r.econ === r.bizCount, 'business ' + JSON.stringify({ r, snapshot }));
  return r;
});

await step('city events: accident, outage, construction make the news', async () => {
  return ev(() => {
    const s = __t.s();
    const n0 = s.player.news.length;
    s.events.accident(true);
    s.events.outage();
    s.events.construction();
    s.events.gathering();
    __t.sim(1);
    const kinds = s.events.events.map((e) => e.kind);
    return { kinds, news: s.player.news.length - n0, headline: s.player.news[0]?.headline };
  });
});

await step('map: click sets a waypoint', async () => {
  await ev(() => __t.press('KeyM', 'm'));
  await page.waitForTimeout(1500);
  const box = await page.locator('canvas.cursor-grab').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 120, box.y + box.height / 2 - 60);
  const wp = await ev(() => __t.s().waypoint);
  await page.screenshot({ path: 'scripts/out/sys-map.png' });
  await ev(() => __t.press('KeyM', 'm'));
  assert(wp, 'no waypoint');
  return wp;
});

await step('change graphics preset mid-game (low → high → low)', async () => {
  await ev(() => __t.st().applyPreset('high'));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'scripts/out/sys-high.png' });
  const r = await ev(() => ({ shadows: __t.g().renderer.shadowMap.enabled, postFX: __t.st().settings.graphics.postFX }));
  await ev(() => __t.st().applyPreset('low'));
  await page.waitForTimeout(3000);
  assert(r.shadows && r.postFX, JSON.stringify(r));
  return r;
});

await step('no runtime errors', async () => {
  assert(errors.length === 0, errors.slice(0, 5).join('\n---\n'));
});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
