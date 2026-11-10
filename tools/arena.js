/* Combat check: a simple bot (approach, swing, roll away from wind-ups) fights
   each enemy type on flat ground with the starting sword. Prints time-to-kill
   and damage taken, and fails on any exception. Run: node tools/arena.js */
'use strict';
const path = require('path');
for (const f of ['core', 'data', 'levels', 'game', 'enemies']) require(path.join(__dirname, '../js/' + f + '.js'));
const NK = globalThis.NK, C = NK.C, S = NK.S, T = C.T;

function arena() {
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push('#' + ' '.repeat(38) + '#');
  rows.push('#'.repeat(40), '#'.repeat(40));
  const L = NK.buildLevel({ name: 'arena', chunks: [{ rows }] });
  L.floor = NK.FLOORS[0]; L.depth = 0; L.arena = { x0: T, x1: 39 * T };
  return L;
}

function fight(type, depth, elite) {
  NK.newRun({ up: {} });
  const r = S.run; r.depth = depth;
  const L = arena(), fy = (L.h - 2) * T;
  S.L = L; S.en = []; S.shots = []; S.picks = []; S.items = []; S.state = 'play';
  S.p = NK.newPlayer(8 * T, fy - C.PH); S.p.ev = [];
  const e = NK.spawnEnemy(type, 22 * T, type === 'wisp' ? fy - 60 : fy);
  if (elite) NK.makeElite(e);
  if (type === 'boss') S.boss = e;
  const hp0 = r.hp; let t = 0, rolls = 0;
  const prev = {};
  while (t < 90 && e.hp > 0 && S.state === 'play') {
    const p = S.p, dx = e.x + e.w / 2 - (p.x + C.PW / 2), ad = Math.abs(dx), dir = Math.sign(dx) || 1;
    const inp = { left: false, right: false, down: false, jump: false, jumpPressed: false, atk: false, roll: false, alt: false, heal: false, use: false, downPressed: false };
    const danger = (e.state === 'wind' && e.st < 0.22 && ad < 150) || (e.state === 'attack' && ad < 130 && type !== 'spam');
    const wave = S.shots.some((s) => s.kind === 'wave' && Math.abs(s.x - (p.x + 11)) < 60);
    const bolt = S.shots.some((s) => s.kind === 'bolt' && Math.hypot(s.x - p.x - 11, s.y - p.y - 11) < 70);
    const thru = ad < 170 ? dir : -dir; // roll through close threats, away from far ones
    if (wave && p.onGround) { inp.jump = true; inp.jumpPressed = !prev.jump; }
    else if (bolt && ad < 60) { inp.atk = !prev.atk; p.facing = dir; }
    else if (danger || bolt) { inp.roll = !prev.roll; if (inp.roll) rolls++; if (thru > 0) inp.right = true; else inp.left = true; }
    else if (ad > 40 + e.w / 2) { if (dir > 0) inp.right = true; else inp.left = true; }
    else { inp.atk = !prev.atk; p.facing = dir; if (e.y + e.h < p.y - 10 && p.onGround) { inp.jump = true; inp.jumpPressed = !prev.jump; } }
    if (r.hp < r.maxhp * 0.35 && r.flask > 0) inp.heal = true;
    prev.jump = inp.jump; prev.roll = inp.roll || danger || bolt; prev.atk = inp.atk;
    NK.step(C.DT, inp);
    t += C.DT;
  }
  const lost = hp0 - r.hp + (r.flaskMax - r.flask) * Math.round(r.maxhp * 0.6);
  return { type: (elite ? 'elite ' : '') + type, depth, win: e.hp <= 0, t: t.toFixed(1), lost, alive: S.state === 'play' };
}

const cases = [['bug', 0], ['glitch', 0], ['wisp', 0], ['spam', 0], ['bloat', 1], ['bug', 1, true], ['boss', 2], ['bug', 5], ['bloat', 5]];
let bad = 0;
for (const [type, depth, elite] of cases) {
  const runs = [];
  for (let i = 0; i < 12; i++) runs.push(fight(type, depth, elite));
  const wins = runs.filter((x) => x.win).length;
  const avg = (k) => (runs.reduce((s, x) => s + Number(x[k]), 0) / runs.length).toFixed(1);
  console.log(((elite ? 'elite ' : '') + type).padEnd(11), 'depth', depth, '| bot wins', wins + '/12', '| avg time', avg('t') + 's', '| avg HP lost', avg('lost'));
  if (!wins) bad++;
}
process.exit(bad ? 1 : 0);
