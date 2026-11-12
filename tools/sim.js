/* Headless playthrough: a simple bot plays every story mission and a bounty using the real
   game code, to catch crashes and missions that cannot finish. Run: node tools/sim.js */
'use strict';
const path = require('path');
for (const f of ['world', 'actors', 'ai', 'missions', 'game']) require(path.join(__dirname, '../js/' + f + '.js'));
const SD = globalThis.SD, DT = SD.K.DT;
const log = [];
SD.listen((n, d) => { if (n === 'reward') log.push('reward $' + d.money + ' ' + d.why); if (n === 'playerDead') log.push('player died'); });
const sv = SD.defaultSave(); sv.ammo.pistol = 400; sv.tonics = 30;
SD.newGame(sv);
const G = SD.G;
let prevFire = false, t = 0, bad = 0;

function tick(inp) {
  SD.step(DT, Object.assign({ left: false, right: false, down: false, jump: false, roll: false, fire: false, fireHeld: false, reload: false,
    knife: false, tonic: false, call: false, use: false, oc: false, sprint: false, gun: null, aimX: G.p.x + 100, aimY: G.p.y - 11 }, inp));
  t += DT;
}
function fight(tags, secs, opts) {
  opts = opts || {};
  for (let i = 0; i < secs / DT; i++) {
    const p = G.p;
    if (p.dead) { SD.respawn(); log.push('respawned'); }
    const foes = G.actors.filter((a) => !a.dead && !a.inside && tags.includes(a.tag) && !(opts.spare && a.surrender));
    if (!foes.length) return true;
    foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    const f = foes[0], dx = f.x - p.x, inp = {};
    if (Math.abs(dx) > 300) { inp[dx > 0 ? 'right' : 'left'] = true; if (p.vx === 0 && p.onGround) inp.jump = true; }
    else if (p.onGround && Math.random() < 0.004) inp.jump = true;
    if (G.actors.some((a) => a.state === 'aim' && a.st < 0.2 && !a.dead) && Math.random() < 0.5) inp.roll = true;
    inp.aimX = f.x; inp.aimY = opts.body ? f.y - f.h * 0.4 : f.y - f.h * 0.85;
    inp.fire = !prevFire; prevFire = inp.fire;
    if (p.hp < 45) inp.tonic = true;
    if (SD.save.clip[p.gun] === 0) inp.reload = true;
    tick(inp);
  }
  return false;
}
const check = (name, ok) => { console.log(name.padEnd(20), ok ? 'OK' : 'FAIL', '  t=' + t.toFixed(0) + 's  hp=' + G.p.hp); if (!ok) bad++; };
const done = (i) => SD.save.mission > i;
function travel(x) { G.p.x = x; G.p.y = SD.ground(x) - 2; G.p.mounted = false; G.horse.x = x - 50; G.horse.y = SD.ground(x - 50); for (let i = 0; i < 30; i++) tick({}); }

SD.acceptMission(); travel(800); fight(['m0'], 20); tick({});
check('New in Town', done(0));

SD.acceptMission(); travel(SD.SPOTS.camp - 700); fight(['m1'], 240); tick({});
if (!done(1)) console.log('   left:', G.actors.filter((a) => a.tag === 'm1' && !a.dead).map((a) => a.kind + '@' + Math.round(a.x) + ',' + Math.round(a.y) + ' ' + a.state + ' inside=' + !!a.inside + ' hp' + a.hp).join(' | '), 'player', Math.round(G.p.x), Math.round(G.p.y), 'clip', sv.clip.revolver, sv.ammo.pistol);
check('Rattler Run', done(1));

SD.acceptMission(); travel(SD.SPOTS.shack - 700);
fight(['m2g'], 120); fight(['m2'], 120, { body: true, spare: true });
const pete = G.actors.find((a) => a.tag === 'm2');
G.p.x = pete.x; G.p.y = pete.y; tick({}); tick({ use: true });
console.log('   carrying', G.p.carry && G.p.carry.name, 'alive:', !!(G.p.carry && !G.p.carry.dead));
travel(SD.SPOTS.sheriff); console.log('   ' + SD.deliver()); tick({});
check('Two-Bit Pete', done(2));

SD.acceptMission(); travel(SD.SPOTS.river);
for (let k = 0; k < 20000 && (sv.pelts.deer < 2 || sv.pelts.rabbit < 3); k++) {
  const prey = G.actors.find((a) => (a.kind === 'deer' || a.kind === 'rabbit') && !a.dead);
  if (prey) { G.p.x = prey.x - 120; G.p.y = SD.ground(G.p.x); tick({ aimX: prey.x, aimY: prey.y - prey.h / 2, fire: k % 2 === 0, reload: sv.clip.revolver === 0 }); }
  else tick({ right: true });
  const body = G.actors.find((a) => a.dead && a.loot && a.loot.pelt);
  if (body) { G.p.x = body.x; G.p.y = body.y; tick({}); tick({ use: true }); }
  if (G.p.x > 8400) travel(6300);
}
console.log('   pelts', JSON.stringify(sv.pelts));
SD.missionNow().turnIn(); tick({});
check("Hunter's Order", done(3) && sv.guns.rifle);

SD.acceptMission();
let k = 0; while (G.duel && G.duel.stage === 'wait' && k++ < 1000) tick({});
tick({}); tick({ fire: true });
console.log('   duel won:', G.actors.find((a) => a.tag === 'm3').dead);
for (let i = 0; i < 5; i++) tick({});
fight(['m3b'], 120); tick({});
check('High Noon', done(4));

SD.acceptMission(); travel(8000); G.p.gun = 'rifle'; sv.ammo.rifle = 300;
fight(['m5'], 400); tick({});
check("Widow's Mine", done(5));

SD.acceptBounty(SD.makeBounty()); travel(sv.bounty.x - 1200); travel(sv.bounty.x - 600);
fight(['bountyg', 'bounty'], 200);
const b = G.actors.find((a) => a.tag === 'bounty');
if (b) { G.p.x = b.x; G.p.y = b.y; tick({}); tick({ use: true }); travel(SD.SPOTS.sheriff); console.log('   ' + SD.deliver()); }
check('Bounty', !sv.bounty);

travel(1300); const folk = G.actors.find((a) => a.kind === 'folk' && !a.dead); SD.damage(folk, 5, 1, {});
for (let i = 0; i < 240; i++) tick({});
console.log('   crime: wanted', G.wanted, 'lawmen', G.actors.filter((a) => a.kind === 'law' && !a.dead).length, 'fine', sv.fine);
travel(4600); for (let i = 0; i < 32 / DT; i++) tick({ right: true, roll: Math.random() < 0.01 });
check('Lose the law', G.wanted === 0 || G.p.dead);

console.log(log.join('\n'));
console.log('money', sv.money, 'rep', sv.rep, 'kills', sv.kills, 'hour', sv.hour.toFixed(1), 'day', sv.day);
process.exit(bad ? 1 : 0);
