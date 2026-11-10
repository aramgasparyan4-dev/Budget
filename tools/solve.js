/* Level check: a best-first search drives the real player physics to prove that
   every level (and a sample of tower seeds) can be finished. Enemies are ignored.
   Run: node tools/solve.js */
'use strict';
const path = require('path');
require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/levels.js'));
const NK = globalThis.NK, C = NK.C, T = C.T;

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

function solve(L, goal, h, maxNodes) {
  const HOLD = 6, acts = [];
  for (const dir of [1, 0, -1]) for (const jump of [1, 0]) acts.push({ dir, jump });
  const open = new Heap(), seen = new Set();
  const p0 = NK.newPlayer(L.start.x, L.start.y);
  open.push({ p: p0, j: 0, f: h(p0), d: 0 });
  let n = 0, best = Infinity;
  while (open.size && n < maxNodes) {
    const cur = open.pop(); n++;
    if (goal(cur.p)) return { ok: true, nodes: n, steps: cur.d * HOLD };
    for (const a of acts) {
      const p = Object.assign({}, cur.p);
      const inp = { left: a.dir < 0, right: a.dir > 0, jump: !!a.jump, jumpPressed: false };
      for (let i = 0; i < HOLD && !p.dead; i++) {
        inp.jumpPressed = i === 0 && a.jump && !cur.j;
        NK.stepPlayer(p, inp, C.DT, L);
      }
      if (p.dead) continue;
      const key = (p.x >> 3) + '|' + (p.y >> 3) + '|' + Math.round(p.vx / 110) + '|' + Math.round(p.vy / 220) + '|' +
        (p.onGround ? 1 : 0) + p.wallDir + a.jump + (p.lock > 0 ? 1 : 0) + (p.cut ? 1 : 0);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = h(p);
      if (f < best) best = f;
      open.push({ p, j: a.jump, f, d: cur.d + 1 });
    }
  }
  return { ok: false, nodes: n, best };
}

let bad = 0;
for (const def of NK.LEVELS) {
  const L = NK.buildLevel(def), G = L.goal;
  const res = solve(L,
    (p) => Math.abs(p.x + C.PW / 2 - G.x) < 22 && Math.abs(p.y + C.PH / 2 - G.y) < 26,
    (p) => Math.abs(p.x - G.x) + Math.abs(p.y - G.y) * 0.5, 4e6);
  console.log(def.name.padEnd(18), L.w + 'x' + L.h, 'tokens', L.coinTotal, res.ok ? 'OK ' + (res.steps / 120).toFixed(1) + 's' : 'FAIL best=' + Math.round(res.best), 'nodes', res.nodes);
  if (!res.ok) bad++;
}
const seeds = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4, 5, 6, 7, 8];
for (const s of seeds) {
  const L = NK.buildTower(s, 260), G = L.goal;
  const res = solve(L, (p) => p.y < G.y + 40, (p) => p.y, 4e6);
  console.log('Tower seed ' + s, L.w + 'x' + L.h, res.ok ? 'OK ' + (res.steps / 120).toFixed(1) + 's' : 'FAIL best row=' + Math.round(res.best / T), 'nodes', res.nodes);
  if (!res.ok) bad++;
}
process.exit(bad ? 1 : 0);
