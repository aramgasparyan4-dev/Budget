/* Sundown Protocol — the things that make the frontier feel alive: title cards and dialogue,
   riding partners, the lasso, camping, roadside events, weather, dust and smoke. No DOM here. */
(function (g) {
  'use strict';
  const SD = g.SD, K = SD.K;
  const sfx = (n) => SD.sfx && SD.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- cinematics ---------- */
  SD.cineTitle = (kicker, text, dur) => { const ci = SD.G.cine; ci.title = { kicker, text, t: 0, dur: dur || 3.4 }; ci.banner = null; };
  SD.talk = function (lines) { for (const l of lines) SD.G.cine.queue.push({ who: l[0], text: l[1], t: Math.max(2.4, l[1].length * 0.062) }); };
  let lastRegion = null;
  function stepCine(dt) {
    const G = SD.G, ci = G.cine;
    ci.bars += ((ci.title || G.duel ? 1 : 0) - ci.bars) * Math.min(1, dt * 5);
    if (ci.bars < 0.02) ci.bars = 0;
    if (ci.title) { ci.title.t += dt; if (ci.title.t > ci.title.dur) ci.title = null; }
    if (ci.banner) { ci.banner.t += dt; if (ci.banner.t > 4) ci.banner = null; }
    if (ci.sub) { ci.sub.t -= dt; if (ci.sub.t <= 0) ci.sub = null; }
    if (!ci.sub && ci.queue.length && !ci.title) ci.sub = ci.queue.shift();
    const r = SD.regionAt(G.p.x);
    if (r.id !== lastRegion) { if (lastRegion && !ci.title) ci.banner = { text: r.name, t: 0 }; lastRegion = r.id; }
  }

  /* ---------- weather ---------- */
  function stepWeather(dt) {
    const G = SD.G, w = G.weather;
    w.t -= dt;
    if (w.t <= 0) {
      const r = SD.regionAt(G.p.x).id, v = Math.random();
      w.next = v < 0.62 ? 'clear' : v < 0.84 ? 'rain' : r === 'plains' || r === 'gulch' ? 'dust' : 'clear';
      w.t = rand(70, 150);
    }
    if (w.next && w.next !== w.kind) { w.amt -= dt * 0.25; if (w.amt <= 0) { w.kind = w.next; w.amt = 0; } }
    else if (w.kind !== 'clear') w.amt = Math.min(1, w.amt + dt * 0.2);
    w.flash = Math.max(0, w.flash - dt);
    if (w.kind === 'rain' && w.amt > 0.6 && Math.random() < dt * 0.06) { w.flash = 0.3; sfx('thunder'); }
  }

  /* ---------- dust, smoke ---------- */
  SD.dust = function (x, y, n, col, up) {
    for (let i = 0; i < n; i++) SD.G.parts.push({ x: x + rand(-4, 4), y: y - rand(0, 3), vx: rand(-26, 26), vy: rand(-34, -8) - (up || 0), life: rand(0.5, 1), max: 1, color: col, size: rand(2.5, 5.5), grav: -14, soft: true, a: 0.42 });
  };
  let smokeT = 0;
  function stepFx(dt) {
    const G = SD.G, p = G.p, h = G.horse;
    if (h.onGround && Math.abs(h.vx) > 250 && Math.random() < dt * 26) SD.dust(h.x - h.face * 16, h.y, 1, '#d9bf96');
    if (!p.mounted && p.onGround && (p.roll > 0 || Math.abs(p.vx) > 170) && Math.random() < dt * 12) SD.dust(p.x - p.face * 6, p.y, 1, '#d9bf96');
    for (const a of G.actors) if ((a.kind === 'rider' || a.kind === 'ally' || a.kind === 'coach') && !a.dead && Math.abs(a.vx) > 220 && Math.random() < dt * 20) SD.dust(a.x - a.face * 16, a.y, 1, '#d9bf96');
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = 0.3;
      for (const b of SD.BUILDINGS) if (b.kind === 'house' && Math.abs(b.x - p.x) < 900) SD.dust(b.x + b.w - 32, b.gy - b.h * 0.8 - 42, 1, '#cfc9c2', 22);
      for (const L of SD.PROPS) if (L.k === 'fire' && Math.abs(L.x - p.x) < 900) SD.dust(L.x, SD.ground(L.x) - 24, 1, '#b9b2aa', 26);
      if (G.camp && Math.abs(G.camp.x - p.x) < 900) SD.dust(G.camp.x + 16, SD.ground(G.camp.x) - 22, 1, '#b9b2aa', 26);
    }
  }

  /* ---------- lasso ---------- */
  SD.throwLasso = function (ang) {
    const G = SD.G, o = SD.gunOrigin();
    if (G.loop || G.rope) { if (G.rope) { G.rope = null; SD.say('Rope let go.', 1.2); } return; }
    G.loop = { x: o.x, y: o.y, vx: Math.cos(ang) * 640, vy: Math.sin(ang) * 640 - 60, t: 0.44 };
    sfx('rope');
  };
  function stepLasso(dt) {
    const G = SD.G, p = G.p, L = G.loop;
    if (L) {
      L.t -= dt; L.vy += 500 * dt; L.x += L.vx * dt; L.y += L.vy * dt;
      for (const a of G.actors) {
        if (a.dead || a.inside || a.out || !a.human || a.kind === 'foreman' || a.team === 'ally' || a.kind === 'coach') continue;
        const b = SD.boxOf(a);
        if (L.x > b[0] - 12 && L.x < b[0] + b[2] + 12 && L.y > b[1] - 12 && L.y < b[1] + b[3] + 6) {
          if (a.kind === 'rider') { a.kind = 'bandit'; a.w = 16; a.h = 40; }
          a.roped = 7; a.state = 'roped'; a.vx = 0; a.alert = true; G.rope = a; G.loop = null;
          SD.say('Roped. Get close and press E to hogtie.', 2.2); sfx('rope');
          if (a.team === 'town') SD.crime(1, a);
          return;
        }
      }
      if (L.t <= 0 || L.y > SD.ground(L.x)) G.loop = null;
    }
    const r = G.rope;
    if (r && (r.dead || r.out || r.inside || r.roped <= 0 || Math.abs(r.x - p.x) > 330)) G.rope = null;
  }

  /* ---------- extra actors: riding partners, roped folk, the stagecoach ---------- */
  Object.assign(SD.KINDS, {
    ally: { team: 'ally', hp: 9999, w: 44, h: 68, human: true, speed: 560, gun: [16, 0.5, 6, 1.5, 1500, 0.03], range: [0, 620] },
    coach: { team: 'prop', hp: 9999, w: 70, h: 60 },
  });
  SD.extraAI = function (a, dt, p) {
    const G = SD.G;
    if (a.out) { a.vx = 0; SD.moveBody(a, dt); return true; }
    if (a.roped > 0) { a.roped -= dt; a.vx *= 0.8; if (a.roped <= 0) { a.state = 'idle'; a.alert = true; } SD.moveBody(a, dt); return true; }
    if (a.kind === 'coach') { a.t += dt; SD.moveBody(a, dt); if (a.vx && Math.abs(a.x - p.x) > 1500) a.gone = true; return true; }
    if (a.victim) { a.t += dt; a.vx = 0; a.face = Math.sign(p.x - a.x) || 1; SD.moveBody(a, dt); return true; }
    if (a.kind !== 'ally') return false;
    a.t += dt; a.cd -= dt;
    if (a.leaving) { a.alert = false; a.face = Math.sign(SD.SPOTS.sheriff - a.x) || 1; a.vx += (a.face * 420 - a.vx) * Math.min(1, dt * 3); if (a.blocked && a.onGround) a.vy = -K.HJUMP; SD.moveBody(a, dt); if (Math.abs(a.x - p.x) > 1500 || Math.abs(a.x - SD.SPOTS.sheriff) < 30) a.gone = true; return true; }
    let foe = null, fd = 640;
    for (const e of G.actors) { if (e.dead || e.out || e.inside || e.team !== 'gang' || !(e.alert || Math.abs(e.x - a.x) < 420)) continue; const d = Math.abs(e.x - a.x); if (d < fd) { fd = d; foe = e; } }
    const home = p.x - p.face * (a.slot || 90), dx = home - a.x;
    if (foe && Math.abs(dx) < 520) {
      a.alert = true; a.face = Math.sign(foe.x - a.x) || a.face; a.vx *= Math.max(0, 1 - 5 * dt);
      const gx = a.x + a.face * 8, gy = a.y - 46, tx = foe.x, ty = foe.y - foe.h * 0.6;
      if (a.state === 'aim') {
        a.st -= dt; a.ax = tx; a.ay = ty;
        if (a.st <= 0) { const ang = Math.atan2(ty - gy, tx - gx); SD.shoot(gx + Math.cos(ang) * 12, gy + Math.sin(ang) * 12, ang + rand(-0.03, 0.03), 1500, 16, 'a', 900, tx, ty); a.muzzle = 0.06; sfx('eshot'); a.state = 'idle'; a.cd = rand(0.7, 1.3); }
      } else if (a.cd <= 0) { a.state = 'aim'; a.st = 0.5; a.ax = tx; a.ay = ty; }
    } else {
      a.alert = false; a.state = 'idle';
      const want = Math.abs(dx) < 46 ? 0 : Math.sign(dx) * Math.min(560, Math.abs(dx) * 2.2 + 60);
      a.vx += (want - a.vx) * Math.min(1, dt * 3.2);
      if (Math.abs(a.vx) > 12) a.face = Math.sign(a.vx);
      if (a.blocked && a.onGround) a.vy = -K.HJUMP;
      if (Math.abs(dx) > 1700) { a.x = p.x - p.face * 500; a.y = SD.ground(a.x); }
    }
    SD.moveBody(a, dt);
    return true;
  };
  SD.addAlly = function (name, x, slot, o) { return SD.spawn('ally', x, Object.assign({ name, slot, persist: true, tag: 'ally', hat: '#2a2622', shirt: '#b9a27a', law: true }, o)); };
  SD.dismissAllies = function () { for (const a of SD.G.actors) if (a.kind === 'ally') a.leaving = true; };

  /* ---------- camp ---------- */
  SD.tryCamp = function () {
    const G = SD.G, p = G.p;
    if (G.camp && Math.abs(G.camp.x - p.x) < 90) { SD.on('camp'); return; }
    if (SD.inTown(p.x) || p.x < 800) { SD.say('Too close to town to make camp.', 2); return; }
    if (!p.onGround && !p.mounted) return;
    if (G.actors.some((a) => !a.dead && a.alert && (a.team === 'gang' || a.bite || a.team === 'law') && Math.abs(a.x - p.x) < 700)) { SD.say('Not with enemies around.', 2); return; }
    if (p.mounted) SD.dismount();
    G.camp = { x: Math.max(900, Math.min(SD.WORLD_W - 200, p.x + 30)) };
    SD.say('Camp made.', 1.6); sfx('equip'); SD.on('camp');
  };

  /* ---------- roadside events ---------- */
  let evT = 50;
  SD.eventSoon = (t) => { evT = t; };
  function stepEvents(dt) {
    const G = SD.G, p = G.p, ev = G.event;
    if (ev) {
      const foes = G.actors.filter((a) => a.tag === 'ev' && !a.dead && !a.out);
      if (!ev.done) {
        for (const a of foes) if (!a.alert && Math.abs(a.x - p.x) < 380) a.alert = true;
        if (!foes.length) {
          ev.done = true;
          const v = ev.victim;
          if (v && !v.dead) { v.surrender = false; v.bubble = { text: ev.kind === 'coach' ? 'Much obliged, stranger. Take this.' : 'Thought I was done for. Thank you.', t: 4 }; SD.save.money += ev.pay; SD.save.rep = Math.min(100, SD.save.rep + 4); SD.emit('reward', { money: ev.pay, rep: 4, why: ev.kind === 'coach' ? 'Stagecoach saved' : 'Stranger rescued' }); }
          ev.t = 4;
        }
      } else {
        ev.t -= dt;
        if (ev.t <= 0) { for (const a of G.actors) { if (a.kind === 'coach' && a.tag === 'evp') a.vx = a.face * 230; if (a === ev.victim) { if (ev.kind === 'coach') a.gone = true; else { a.victim = false; a.leaving = true; } } } G.event = null; evT = rand(110, 190); }
      }
      if (G.event && Math.abs(ev.x - p.x) > 2400) { for (const a of G.actors) if (a.tag === 'ev' || a.tag === 'evp') a.gone = true; G.event = null; evT = rand(60, 120); }
      return;
    }
    if (SD.save.mission < 1 || G.duel || SD.inTown(p.x) || p.x < 3000 || p.x > SD.WORLD_W - 1300) return;
    evT -= dt;
    if (evT > 0) return;
    const side = Math.abs(p.vx) > 20 ? Math.sign(p.vx) : p.face, x = p.x + side * 980;
    if (x < 2950 || x > SD.WORLD_W - 500 || Math.abs(x - SD.SPOTS.camp) < 500 || Math.abs(x - SD.SPOTS.shack) < 300 || (x > 6500 && x < 7100) || x > 9000) { evT = 12; return; }
    if (Math.random() < 0.55) {
      const c = SD.spawn('coach', x, { tag: 'evp', face: -side, persist: true });
      const v = SD.spawn('folk', x - side * 70, { tag: 'evp', victim: true, surrender: true, persist: true, x0: x - 50, x1: x + 50 });
      SD.gangAt(x - side * 130, ['bandit', 'bandit', 'knife'], { tag: 'ev', persist: true, face: side });
      G.event = { kind: 'coach', x, victim: v, pay: 25 + SD.save.day * 2, coach: c };
      SD.say('Gunshots ahead. A stagecoach is being robbed.', 3);
    } else {
      const night = SD.save.hour >= 20 || SD.save.hour < 5;
      const v = SD.spawn('folk', x, { tag: 'evp', victim: true, surrender: true, persist: true, x0: x - 40, x1: x + 40 });
      SD.gangAt(x - side * 90, night ? ['wolf', 'wolf', 'wolf'] : ['coyote', 'coyote', 'coyote'], { tag: 'ev', persist: true });
      G.event = { kind: 'stranger', x, victim: v, pay: 10 };
      SD.say('Someone is shouting for help up ahead.', 3);
    }
  }

  /* slow the last shot of a fight */
  SD.listen((n, a) => {
    if (n !== 'kill' || !a.tag || !a.human || a.team !== 'gang') return;
    const G = SD.G;
    if (!G.actors.some((o) => o !== a && o.tag === a.tag && !o.dead && !o.out)) G.slow = 0.75;
  });

  SD.stepExtras = function (dt, wdt) {
    stepCine(dt); stepWeather(dt); stepFx(wdt); stepLasso(wdt); stepEvents(wdt);
    const G = SD.G;
    G.flash = Math.max(0, G.flash - dt * 3);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
