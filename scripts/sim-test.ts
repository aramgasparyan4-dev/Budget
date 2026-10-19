import { generateCity } from '../src/world/CityGenerator';
import { generatePopulation } from '../src/sim/npc/Population';
import { NPCSystem } from '../src/sim/npc/NPCSystem';
import { Economy } from '../src/sim/economy/Economy';
import { Clock } from '../src/sim/Clock';
const city = generateCity(20261019);
let t0 = performance.now();
const npcs = generatePopulation(city, 20261019);
console.log('population', npcs.length, 'ms', (performance.now() - t0).toFixed(0));
const occ: Record<string, number> = {};
for (const n of npcs) occ[n.occupation] = (occ[n.occupation] ?? 0) + 1;
console.log('top occupations', Object.entries(occ).sort((a, b) => b[1] - a[1]).slice(0, 12));
console.log('car owners', npcs.filter((n) => n.ownsCar).length, 'avg friends', (npcs.reduce((s, n) => s + [...n.rel.values()].filter((r) => r.friend > 35).length, 0) / npcs.length).toFixed(1));
const clock = new Clock(8 * 60 + 30);
const econ = new Economy(city);
const sys = new NPCSystem(city, npcs, econ, clock, 1);
let news = 0;
sys.hooks.onNews = (h) => { news++; if (news < 12) console.log('NEWS', h); };
sys.warmup();
t0 = performance.now();
const dt = 0.5;
clock.scale = 30;
let lastH = -1;
const days = Number(process.argv[2] ?? 3);
while (clock.t < 8 * 60 + 30 + days * 1440) {
  clock.advance(dt);
  sys.tick(dt);
  const h = Math.floor(clock.hour);
  if (h !== lastH && h % 3 === 0) {
    lastH = h;
    const acts: Record<string, number> = {};
    for (const n of npcs) { const k = n.trip ? 'transit:' + n.trip.mode : n.activity.kind; acts[k] = (acts[k] ?? 0) + 1; }
    const top = Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`D${clock.day} ${clock.label()} ${top}`);
  } else if (h !== lastH) lastH = h;
}
console.log('sim ms', (performance.now() - t0).toFixed(0), 'updates', sys.stats.updates);
const money = npcs.map((n) => n.money).sort((a, b) => a - b);
console.log('npc money p10/p50/p90', money[64].toFixed(0), money[320].toFixed(0), money[576].toFixed(0), 'NaN?', npcs.some((n) => !isFinite(n.money) || !isFinite(n.mood)));
const cash = econ.biz.map((b) => b.cash).sort((a, b) => a - b);
console.log('biz cash p10/p50/p90', cash[Math.floor(cash.length * 0.1)].toFixed(0), cash[Math.floor(cash.length / 2)].toFixed(0), cash[Math.floor(cash.length * 0.9)].toFixed(0), 'closed', econ.biz.filter((b) => b.closed).length);
console.log('econ history', econ.history);
console.log('unemployed', npcs.filter((n) => n.occupation === 'Unemployed').length, 'memories avg', (npcs.reduce((s, n) => s + n.memories.length, 0) / npcs.length).toFixed(1));
const memTypes: Record<string, number> = {};
for (const n of npcs) for (const m of n.memories) memTypes[m.type] = (memTypes[m.type] ?? 0) + 1;
console.log('memory types', memTypes);
console.log('couples', npcs.filter((n) => [...n.rel.values()].some((r) => r.tag === 'partner')).length);
