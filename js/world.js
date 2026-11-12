/* Sundown Protocol — the world: terrain, places, props, cover. No DOM here.
   Coordinates: x grows east, y grows down, the ground in town sits at y = 0. */
(function (g) {
  'use strict';
  const SD = (g.SD = g.SD || {});

  SD.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SD.WORLD_W = 10400;
  const KEYS = [
    [0, 0], [760, 0], [2700, 0], [3000, -24], [3350, 8], [3800, -30], [4250, 0], [4700, -46], [5000, -12],
    [5200, 26], [5700, 26], [6000, -18], [6400, 0], [6650, 0], [6950, 0], [7300, -34], [7800, -12],
    [8300, -50], [8800, -92], [9200, -112], [10400, -112],
  ];
  SD.ground = function (x) {
    if (x <= 0) return 0;
    for (let i = 1; i < KEYS.length; i++) {
      const k1 = KEYS[i];
      if (x <= k1[0]) {
        const k0 = KEYS[i - 1], t = (x - k0[0]) / (k1[0] - k0[0]);
        return k0[1] + (k1[1] - k0[1]) * (1 - Math.cos(t * Math.PI)) / 2;
      }
    }
    return KEYS[KEYS.length - 1][1];
  };
  SD.BRIDGE = { x0: 6650, x1: 6950 };

  SD.REGIONS = [
    { id: 'rail', name: 'Copperhead Rail Yard', x0: 0, x1: 760 },
    { id: 'town', name: 'Copperhead Flats', x0: 760, x1: 2700 },
    { id: 'plains', name: 'Saltbrush Plains', x0: 2700, x1: 4800 },
    { id: 'gulch', name: 'Rattler Gulch', x0: 4800, x1: 6400 },
    { id: 'river', name: 'Bitterroot Crossing', x0: 6400, x1: 7800 },
    { id: 'mine', name: "Widow's Hill", x0: 7800, x1: 10400 },
  ];
  SD.regionAt = (x) => SD.REGIONS.find((r) => x < r.x1) || SD.REGIONS[SD.REGIONS.length - 1];
  SD.inTown = (x) => x > 700 && x < 2760;

  /* Buildings are facades behind the action. Doors on the useful ones open a menu. */
  SD.BUILDINGS = [
    { kind: 'station', name: 'DEPOT', x: 120, w: 260, h: 118, col: '#6d4c3d' },
    { kind: 'house', name: '', x: 812, w: 150, h: 104, col: '#8a6a4f' },
    { kind: 'sheriff', name: 'SHERIFF', x: 1000, w: 200, h: 128, col: '#7a5a43', door: true },
    { kind: 'store', name: 'GENERAL STORE', x: 1236, w: 224, h: 140, col: '#5f6f5a', door: true },
    { kind: 'saloon', name: 'SALOON', x: 1496, w: 262, h: 176, col: '#8b4a3a', door: true },
    { kind: 'bank', name: 'BANK', x: 1800, w: 180, h: 150, col: '#6a6470', door: true },
    { kind: 'doctor', name: 'DOCTOR', x: 2020, w: 160, h: 120, col: '#7d7a6a', door: true },
    { kind: 'stable', name: 'STABLE', x: 2220, w: 220, h: 112, col: '#6b4630' },
    { kind: 'house', name: '', x: 2480, w: 150, h: 98, col: '#7b5e48' },
    { kind: 'shack', name: '', x: 3560, w: 130, h: 86, col: '#5c4636' },
    { kind: 'minehead', name: "WIDOW'S MINE", x: 9640, w: 230, h: 150, col: '#4a3a33' },
  ];
  for (const b of SD.BUILDINGS) { b.gy = SD.ground(b.x + b.w / 2); b.doorX = b.x + b.w / 2; }

  SD.SPOTS = {
    fence: 900, sheriff: 1100, store: 1348, saloon: 1627, doctor: 2100, stable: 2330, shack: 3640,
    camp: 5450, river: 6800, mine: 9450, mineDoor: 9755, duel: 1700, respawn: 2100,
    ambush: [3250, 4450, 7350, 8250],
  };

  /* Solid cover: blocks walking and bullets. */
  const BOX = [
    ['barrel', 1474, 22, 28], ['barrel', 1772, 22, 28], ['crate', 1960, 30, 30], ['crate', 2458, 30, 30], ['trough', 1188, 40, 18],
    ['rock', 3150, 46, 26], ['rock', 3500, 40, 22], ['crate', 3720, 30, 30], ['rock', 4150, 48, 28], ['rock', 4560, 40, 24],
    ['rock', 5010, 50, 30], ['wagon', 5250, 86, 30], ['crate', 5420, 30, 30], ['crate', 5600, 30, 30], ['rock', 5810, 44, 28], ['crate', 6110, 30, 30],
    ['log', 7150, 60, 16], ['rock', 7500, 44, 26],
    ['cart', 8400, 44, 28], ['crate', 8700, 30, 30], ['rock', 8920, 50, 30], ['cart', 9110, 44, 28], ['crate', 9310, 30, 30], ['crate', 9520, 30, 30],
  ];
  SD.SOLIDS = BOX.map(([k, x, w, h]) => {
    const gy = Math.max(SD.ground(x), SD.ground(x + w));
    return { k, x, w, h, y: gy - h };
  });

  /* Decoration, generated once from a fixed seed so the world is the same every visit. */
  const rnd = SD.rng(1849), P = [];
  const near = (x, d) => SD.SOLIDS.some((b) => x > b.x - d && x < b.x + b.w + d) || SD.BUILDINGS.some((b) => x > b.x - 20 && x < b.x + b.w + 20);
  for (let x = 2760; x < 6400; x += 120 + rnd() * 220) if (!near(x, 30)) P.push({ k: rnd() < 0.75 ? 'cactus' : 'deadtree', x, s: 0.8 + rnd() * 0.5, v: (rnd() * 3) | 0 });
  for (let x = 40; x < SD.WORLD_W; x += 70 + rnd() * 160) if (!SD.inTown(x) && (x < SD.BRIDGE.x0 - 20 || x > SD.BRIDGE.x1 + 20)) P.push({ k: 'bush', x, s: 0.6 + rnd() * 0.6, v: (rnd() * 3) | 0 });
  for (let x = 6420; x < 8600; x += 60 + rnd() * 120) if ((x < 6600 || x > 7010) && !near(x, 20)) P.push({ k: 'pine', x, s: 0.8 + rnd() * 0.6, v: (rnd() * 3) | 0 });
  for (let x = 860; x < 2680; x += 262) P.push({ k: 'lamp', x, s: 1, v: 0 });
  for (let x = 400; x < 760; x += 40) P.push({ k: 'fence', x, s: 1, v: 0 });
  for (let x = 862; x < 980; x += 40) P.push({ k: 'fence', x: x + 0, s: 1, v: 1 });
  P.push({ k: 'tower', x: 560, s: 1, v: 0 }, { k: 'windmill', x: 2960, s: 1, v: 0 });
  P.push({ k: 'sign', x: 790, s: 1, v: 0, t: 'COPPERHEAD FLATS' }, { k: 'sign', x: 4870, s: 1, v: 0, t: 'RATTLER GULCH' }, { k: 'sign', x: 7860, s: 1, v: 0, t: "WIDOW'S MINE" });
  for (let i = 0; i < 5; i++) P.push({ k: 'grave', x: 2700 + i * 26, s: 1, v: i % 2 });
  P.push({ k: 'tent', x: 5330, s: 1, v: 0 }, { k: 'tent', x: 5680, s: 1.1, v: 1 }, { k: 'fire', x: 5520, s: 1, v: 0 });
  P.push({ k: 'post', x: 1468, s: 1, v: 0 }, { k: 'post', x: 2300, s: 1, v: 0 });
  P.sort((a, b) => a.x - b.x);
  SD.PROPS = P;

  /* Light sources at night: lamps, the campfire, the saloon windows. */
  SD.LIGHTS = P.filter((p) => p.k === 'lamp' || p.k === 'fire').map((p) => ({ x: p.x, y: SD.ground(p.x) - (p.k === 'lamp' ? 58 : 10), r: p.k === 'fire' ? 170 : 120 }));
  SD.LIGHTS.push({ x: 1627, y: -70, r: 160 }, { x: 9755, y: SD.ground(9755) - 40, r: 140 });

  /* Day/night: one game hour lasts HOUR real seconds. */
  SD.HOUR = 25;
})(typeof globalThis !== 'undefined' ? globalThis : this);
