/* Sundown Protocol — one simulation tick: slow-motion targeting, interactions, time of day. No DOM here. */
(function (g) {
  'use strict';
  const SD = g.SD, K = SD.K;
  const sfx = (n) => SD.sfx && SD.sfx(n);
  const listeners = [];
  SD.listen = (f) => listeners.push(f);
  SD.on = (n, d) => { for (const f of listeners) f(n, d); };

  SD.listen((n, a) => {
    const G = SD.G;
    if (n === 'shot') SD.onShotFired();
    else if (n === 'kill') {
      if (a.kind === 'bottle') { a.gone = true; SD.puff(a.x, a.y - 8, 10, '#9fd8c8', 140, 0.4, 500); sfx('glass'); }
      else if (a.team === 'town' || (a.team === 'law' && G.wanted === 0)) SD.crime(1, a);
      if (a.human && a.team === 'gang' && !a.target) G.oc = Math.min(100, G.oc + 4);
    }
  });

  /* ---------- Overclock: hold to slow time, click targets, let go to fire at all of them ---------- */
  function markAt(x, y) {
    const G = SD.G, sv = SD.save;
    if (G.marks.length >= sv.clip[G.p.gun]) { sfx('dry'); return; }
    let best = null;
    for (const a of G.actors) {
      if (a.dead || a.inside) continue;
      const b = SD.boxOf(a);
      if (x > b[0] - 10 && x < b[0] + b[2] + 10 && y > b[1] - 10 && y < b[1] + b[3] + 10) { best = a; break; }
    }
    if (!best) return;
    G.marks.push({ a: best, ox: x - best.x, oy: y - best.y });
    sfx('mark');
  }

  /* ---------- what the E key would do right now ---------- */
  function findNear() {
    const G = SD.G, p = G.p, h = G.horse;
    if (p.dead || G.duel) return null;
    let best = null, bd = 1e9;
    const offer = (d, o) => { if (d < bd) { bd = d; best = o; } };
    for (const a of G.actors) {
      if (a.inside) continue;
      const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5;
      if (d > 48) continue;
      if (a.out) continue;
      if (!a.dead && (a.surrender || a.roped > 0) && !a.victim && !(a.target && p.carry)) offer(d - 30, { kind: 'tie', a, label: a.target ? 'Tie up ' + a.name : 'Hogtie' });
      else if (a.dead && a.target && !p.carry) offer(d - 20, { kind: 'carry', a, label: 'Pick up ' + a.name });
      else if (a.dead && a.loot && a.loot.pelt) offer(d, { kind: 'skin', a, label: 'Skin ' + a.kind });
      else if (a.dead && a.loot && a.human) offer(d, { kind: 'loot', a, label: 'Search body' });
    }
    for (const b of SD.BUILDINGS) {
      if (!b.door) continue;
      const d = Math.abs(b.doorX - p.x);
      if (d < 34) offer(d + 5, { kind: 'door', b, label: (p.carry && b.kind === 'sheriff' ? 'Hand over ' + p.carry.name : 'Enter ' + b.name.toLowerCase()) });
    }
    if (!p.mounted && Math.abs(h.x - p.x) < 50 && Math.abs(h.y - p.y) < 40) offer(Math.abs(h.x - p.x) + 10, { kind: 'mount', label: 'Ride Biscuit' });
    if (G.camp && !p.mounted && Math.abs(G.camp.x - p.x) < 60) offer(30, { kind: 'camp', label: 'Sit by the fire' });
    if (!best && p.mounted) best = { kind: 'dismount', label: 'Get down' };
    return best;
  }

  function use(n) {
    const G = SD.G, p = G.p, sv = SD.save, a = n.a;
    if (n.kind === 'mount') SD.mount();
    else if (n.kind === 'dismount') SD.dismount();
    else if (n.kind === 'tie' && !a.target) { a.out = true; a.roped = 0; a.surrender = false; a.alert = false; G.rope = null; sv.rep = Math.min(100, sv.rep + 1); SD.say('Hogtied and left for the law. Rep +1', 2); sfx('rope'); }
    else if (n.kind === 'tie') { p.carry = a; a.inside = true; a.surrender = false; a.roped = 0; a.tied = true; G.rope = null; SD.say('Tied up ' + a.name + '. Take them to the sheriff.', 2.6); sfx('rope'); }
    else if (n.kind === 'camp') SD.on('camp');
    else if (n.kind === 'carry') { p.carry = a; a.inside = true; SD.say('Carrying ' + a.name + '.', 2); sfx('rope'); }
    else if (n.kind === 'skin') { const meat = a.loot.pelt === 'deer' ? 2 : 1; sv.pelts[a.loot.pelt]++; sv.meat = (sv.meat || 0) + meat; SD.popup(a.x, a.y - 20, '+1 ' + a.loot.pelt + ' pelt, +' + meat + ' meat', '#e8c48c'); a.loot = null; a.gone = true; sfx('skin'); }
    else if (n.kind === 'loot') {
      const L = a.loot; a.loot = null;
      sv.money += L.money; sv.ammo.pistol += L.ammo;
      SD.popup(a.x, a.y - 30, (L.money ? '+$' + L.money : 'Nothing') + (L.ammo ? '  +' + L.ammo + ' rounds' : ''), '#ffd166');
      sfx(L.money ? 'coin' : 'skin');
    } else if (n.kind === 'door') { if (p.mounted) SD.dismount(); p.vx = 0; SD.on('door', n.b); }
  }

  SD.respawn = function () {
    const G = SD.G, p = G.p, sv = SD.save;
    const lost = Math.floor(sv.money * 0.1);
    sv.money -= lost;
    if (p.carry) { const c = p.carry; c.inside = false; c.x = p.x; c.y = SD.ground(p.x); if (!c.dead) { c.surrender = true; c.state = 'surrender'; } p.carry = null; }
    G.wanted = 0;
    for (const a of G.actors) if (a.kind === 'law') a.gone = true;
    Object.assign(p, { x: SD.SPOTS.respawn, y: 0, vx: 0, vy: 0, hp: p.maxhp, dead: false, mounted: false, iframes: 1.5, roll: 0, reload: 0 });
    G.horse.x = SD.SPOTS.respawn - 70; G.horse.y = 0; G.horse.mode = 'idle';
    G.bullets = []; G.booms = []; G.marks = []; G.ocOn = false; G.duel = null; G.rope = null; G.loop = null; G.slow = 0;
    for (const a of G.actors) if (a.alert && Math.abs(a.x - p.x) < 900 && a.team === 'gang') a.alert = false;
    return lost;
  };

  /* inp comes from the page each tick; dt is real seconds */
  SD.step = function (dt, inp) {
    const G = SD.G;
    if (!G) return;
    const p = G.p, sv = SD.save;
    // Overclock
    if (inp.oc && !G.ocOn && G.oc > 8 && !p.dead && !G.duel && sv.clip[p.gun] > 0) { G.ocOn = true; G.marks = []; sfx('ocOn'); }
    if (G.ocOn) {
      G.oc = Math.max(0, G.oc - 18 * dt);
      if (inp.fire) markAt(inp.aimX, inp.aimY);
      if (!inp.oc || G.oc <= 0 || p.dead) { G.ocOn = false; G.ocFire = 0; G.queue = G.marks; G.marks = []; sfx('ocOff'); }
    } else if (G.oc < 30) G.oc = Math.min(30, G.oc + 1.5 * dt);
    if (G.queue && G.queue.length) {
      G.ocFire -= dt;
      if (G.ocFire <= 0) {
        const m = G.queue.shift(), o = SD.gunOrigin();
        if (sv.clip[p.gun] > 0 && !m.a.inside) SD.fireShot(Math.atan2(m.a.y + m.oy - o.y, m.a.x + m.ox - o.x), true, m.a.x + m.ox, m.a.y + m.oy, 2.5); // marked shots hit hard
        G.ocFire = 0.08;
      }
    }
    G.scale = G.ocOn ? 0.22 : G.slow > 0 ? 0.28 : 1;
    if (G.slow > 0) G.slow -= dt;
    const wdt = dt * G.scale;
    G.time += wdt;

    if (G.duel) { SD.stepDuel(wdt, inp); SD.moveBody(p, wdt); }
    else SD.stepPlayer(wdt, G.ocOn ? Object.assign({}, inp, { fire: false, fireHeld: false }) : inp);
    SD.stepHorse(wdt);
    SD.stepActors(wdt);
    SD.stepBullets(wdt);
    SD.populate(wdt);
    SD.stepExtras(dt, wdt);
    if (inp.camp) SD.tryCamp();
    if (p.carry) { p.carry.x = p.x; p.carry.y = p.y; }

    G.near = findNear();
    if (inp.use && G.near) use(G.near);
    SD.stepMission();

    for (const q of G.parts) { q.life -= wdt; q.vy += q.grav * wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; }
    G.parts = G.parts.filter((q) => q.life > 0);
    for (const n of G.nums) n.t += dt;
    G.nums = G.nums.filter((n) => n.t < 0.9);
    if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
    G.shake = Math.max(0, G.shake - dt * 30);
    G.muzzle -= dt; G.kick = Math.max(0, G.kick - dt * 40);

    sv.hour += wdt / SD.HOUR;
    if (sv.hour >= 24) { sv.hour -= 24; sv.day++; }
    sv.x = p.x;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
