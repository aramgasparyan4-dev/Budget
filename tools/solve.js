/* Level check: a best-first search drives the real player physics (run, jump,
   wall kick only; no perks, no roll) to prove that generated floors can be
   walked from the start to the exit door without touching spikes.
   Run: node tools/solve.js [seeds]   (default 60 seeds x 3 floors) */
'use strict';
const path = require('path');
for (const f of ['core', 'data', 'levels']) require(path.join(__dirname, '../js/' + f + '.js'));
const NK = globalThis.NK, C = NK.C;

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

function solve(L, maxNodes) {
  const HOLD = 6, acts = [], D = L.door;
  for (const dir of [1, 0, -1]) for (const jump of [1, 0]) acts.push({ dir, jump });
  const h = (p) => Math.abs(p.x - D.x) + Math.abs(p.y + C.PH - D.y) * 0.5;
  const open = new Heap(), seen = new Set();
  const p0 = NK.newPlayer(L.start.x, L.start.y);
  open.push({ p: p0, j: 0, f: h(p0), d: 0 });
  let n = 0, best = Infinity;
  while (open.size && n < maxNodes) {
    const cur = open.pop(); n++;
    if (Math.abs(cur.p.x + C.PW / 2 - D.x) < 24 && Math.abs(cur.p.y + C.PH - D.y) < 40) return { ok: true, nodes: n, t: (cur.d * HOLD) / 120 };
    for (const a of acts) {
      const p = Object.assign({}, cur.p);
      const inp = { left: a.dir < 0, right: a.dir > 0, down: false, jump: !!a.jump, jumpPressed: false };
      let dead = false;
      for (let i = 0; i < HOLD && !dead; i++) {
        inp.jumpPressed = i === 0 && a.jump && !cur.j;
        NK.stepPlayer(p, inp, C.DT, L);
        if (p.spiked) dead = true;
      }
      if (dead) continue;
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

const seeds = Number(process.argv[2]) || 60;
let bad = 0, total = 0, tsum = 0;
for (let depth = 0; depth < 3; depth++) {
  for (let s = 1; s <= seeds; s++) {
    const L = NK.genFloor(depth, s), res = solve(L, 2e6);
    total++;
    if (res.ok) tsum += res.t;
    else { bad++; console.log('FAIL floor', depth, 'seed', s, L.w + 'x' + L.h, 'closest', Math.round(res.best)); }
  }
  console.log(NK.FLOORS[depth].name.padEnd(14), 'checked', seeds, 'seeds');
}
console.log(bad ? bad + ' of ' + total + ' floors FAILED' : 'all ' + total + ' floors reachable, avg straight-run time ' + (tsum / total).toFixed(1) + 's');
process.exit(bad ? 1 : 0);
