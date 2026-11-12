/* Sundown Protocol — people and animals: spawning, behaviour, crime and the law. No DOM here. */
(function (g) {
  'use strict';
  const SD = g.SD, K = SD.K, TAU = Math.PI * 2;
  const sfx = (n) => SD.sfx && SD.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* gun: [damage, aim seconds, rounds, reload s, bullet speed, inaccuracy]   range: [too close, too far] */
  const KINDS = {
    folk: { team: 'town', hp: 40, w: 16, h: 40, human: true, speed: 50 },
    bandit: { team: 'gang', hp: 60, w: 16, h: 40, human: true, speed: 120, gun: [9, 0.6, 6, 1.8, 950, 0.04], range: [170, 380] },
    rifle: { team: 'gang', hp: 70, w: 16, h: 40, human: true, speed: 100, gun: [20, 0.95, 4, 2.4, 1350, 0.02], range: [380, 640] },
    knife: { team: 'gang', hp: 55, w: 16, h: 40, human: true, speed: 175 },
    law: { team: 'law', hp: 80, w: 16, h: 40, human: true, speed: 140, gun: [10, 0.6, 6, 1.7, 1000, 0.035], range: [160, 360] },
    outlaw: { team: 'gang', hp: 150, w: 16, h: 40, human: true, speed: 130, gun: [11, 0.5, 6, 1.6, 1050, 0.035], range: [150, 330], surrender: true },
    duelist: { team: 'gang', hp: 120, w: 16, h: 42, human: true, speed: 140, gun: [14, 0.45, 6, 1.4, 1150, 0.03], range: [150, 320] },
    foreman: { team: 'gang', hp: 650, w: 24, h: 50, human: true, speed: 95, gun: [8, 0.7, 2, 1.5, 900, 0.18], range: [120, 300], pellets: 4 },
    rider: { team: 'gang', hp: 70, w: 44, h: 68, human: true, speed: 330, gun: [8, 0.55, 6, 2, 950, 0.07], range: [120, 520] },
    bottle: { team: 'prop', hp: 1, w: 8, h: 14 },
    rabbit: { team: 'wild', hp: 8, w: 12, h: 9, speed: 270, flee: true },
    deer: { team: 'wild', hp: 45, w: 34, h: 34, speed: 330, flee: true },
    coyote: { team: 'wild', hp: 30, w: 30, h: 18, speed: 255, bite: 8 },
    wolf: { team: 'wild', hp: 50, w: 34, h: 22, speed: 290, bite: 13 },
  };
  SD.KINDS = KINDS;
  const LINES = ['Howdy, little fella.', 'Nice day for it.', 'Watch yourself out past the gulch.', 'That a robot? On a horse?', 'Store\'s got tonic if you need it.', 'Sheriff\'s been looking for help.', 'Evenin\'.'];
  const HATS = ['#3b2a20', '#6b4a2b', '#2d2d33', '#8a6a3f', '#5a2f2a'], SHIRTS = ['#9c3d2e', '#46607a', '#7a6a3a', '#5b7a52', '#8a5a7a', '#c08a3e'];

  SD.spawn = function (kind, x, o) {
    const d = KINDS[kind], G = SD.G;
    const a = Object.assign({
      kind, team: d.team, x, y: SD.ground(x), vx: 0, vy: 0, w: d.w, h: d.h, face: -1, onGround: true, human: !!d.human,
      hp: d.hp, maxhp: d.hp, state: 'idle', t: rand(0, 3), cd: rand(0.4, 1.2), st: 0, clip: d.gun ? d.gun[2] : 0,
      hx: x, alert: false, flash: 0, hat: pick(HATS), shirt: pick(SHIRTS), name: '', canSurrender: !!d.surrender,
    }, o || {});
    a.maxhp = a.hp;
    if (a.y > SD.ground(a.x)) a.y = SD.ground(a.x);
    G.actors.push(a);
    return a;
  };
  SD.gangAt = function (x, list, o) { return list.map((k, i) => SD.spawn(k, x + (i - (list.length - 1) / 2) * 70 + rand(-15, 15), Object.assign({ tag: o && o.tag }, o))); };

  const losBlocked = (x0, y0, x1, y1) => SD.SOLIDS.some((s) => { const t = SD.segBox(x0, y0, x1 - x0, y1 - y0, s.x, s.y, s.w, s.h); return t >= 0 && t < 1; });
  const coverNear = (a, dir) => SD.SOLIDS.some((s) => (dir > 0 ? s.x - (a.x + a.w / 2) : a.x - a.w / 2 - (s.x + s.w)) >= -2 && (dir > 0 ? s.x - (a.x + a.w / 2) : a.x - a.w / 2 - (s.x + s.w)) < 30 && s.h >= 22);

  function walk(a, dt, target, speed) {
    const dir = Math.sign(target - a.x);
    if (Math.abs(target - a.x) < 6) { a.vx *= Math.max(0, 1 - 10 * dt); return 0; }
    a.vx += (dir * speed - a.vx) * Math.min(1, dt * 8);
    if (a.blocked && a.onGround) a.vy = -K.JUMP * (a.kind === 'rider' ? 1.05 : 0.95);
    return dir;
  }

  function gunman(a, dt, p, dx, dist) {
    const d = KINDS[a.kind], gun = d.gun, G = SD.G;
    if (a.state === 'surrender') { a.vx *= 0.8; return; }
    const sees = dist < (a.kind === 'rifle' ? 820 : 560) && Math.abs(p.y - a.y) < 260 && !p.dead;
    if (!a.alert && sees && (a.team !== 'law' || G.wanted > 0)) { a.alert = true; a.cd = Math.max(a.cd, 0.6); }
    if (!a.alert || p.dead) { a.h = d.h; if (Math.random() < dt * 0.3) a.st = a.hx + rand(-70, 70); walk(a, dt, a.st || a.hx, d.speed * 0.3); if (Math.abs(a.vx) > 5) a.face = Math.sign(a.vx); return; }
    a.face = Math.sign(dx) || a.face;
    const gx = a.x + a.face * 8, gy = a.y - a.h * 0.68, tx = p.x, ty = p.y - p.h / 2;
    if (a.state === 'reload') {
      a.st -= dt;
      const cover = coverNear(a, a.face);
      a.h = cover ? Math.round(d.h * 0.6) : d.h;
      if (!cover) walk(a, dt, a.x - a.face * 80, d.speed * 0.6);
      else a.vx *= 0.8;
      if (a.st <= 0) { a.state = 'fight'; a.clip = gun[2]; a.h = d.h; }
      return;
    }
    a.h = d.h;
    if (a.state === 'aim') {
      a.vx *= Math.max(0, 1 - 8 * dt); a.st -= dt;
      if (a.st > 0.16) { a.ax = tx; a.ay = ty; }
      if (a.st <= 0) {
        const ang = Math.atan2(a.ay - gy, a.ax - gx), n = d.pellets || 1;
        for (let i = 0; i < n; i++) SD.shoot(gx + Math.cos(ang) * 12, gy + Math.sin(ang) * 12, ang + rand(-gun[5], gun[5]), gun[4], gun[0], 'e', 1200);
        sfx(a.kind === 'rifle' ? 'eshot2' : 'eshot'); a.muzzle = 0.06;
        a.clip--; a.state = 'fight'; a.cd = rand(0.45, 1.1) * (a.kind === 'foreman' ? 1.4 : 1);
        if (a.clip <= 0) { a.state = 'reload'; a.st = gun[3]; }
      }
      return;
    }
    a.state = 'fight';
    if (a.spread == null) a.spread = rand(0, (d.range[1] - d.range[0]) * 0.7);
    const lo = d.range[0], hi = d.range[1] - a.spread, blocked = losBlocked(gx, gy, tx, ty);
    if (blocked && dist < 150) { walk(a, dt, a.x - Math.sign(dx) * 120, d.speed); if (a.onGround && Math.random() < dt) a.vy = -K.JUMP * 0.9; }
    else if (dist > hi || blocked) walk(a, dt, p.x, d.speed);
    else if (dist < lo && a.kind !== 'foreman') walk(a, dt, a.x - Math.sign(dx) * 120, d.speed * 0.8);
    else a.vx *= Math.max(0, 1 - 8 * dt);
    a.cd -= dt;
    if (a.cd <= 0 && dist < hi + 140 && !blocked) { a.state = 'aim'; a.st = gun[1]; a.ax = tx; a.ay = ty; }
    if (a.kind === 'foreman') {
      a.boomCd = (a.boomCd == null ? 3 : a.boomCd) - dt;
      if (a.boomCd <= 0 && dist > 90) {
        a.boomCd = a.hp < a.maxhp * 0.5 ? 2.2 : 3.4;
        const t = 1.0, vx = dx / t;
        G.booms.push({ x: a.x, y: a.y - a.h, vx: Math.max(-520, Math.min(520, vx)), vy: -620, t: 1.7 });
        sfx('fuse');
      }
    }
  }

  function brawler(a, dt, p, dx, dist) {
    const d = KINDS[a.kind];
    if (!a.alert && dist < 420 && !p.dead) a.alert = true;
    if (!a.alert || p.dead) { walk(a, dt, a.hx, 30); return; }
    a.face = Math.sign(dx) || a.face;
    if (a.state === 'wind') {
      a.vx *= 0.85; a.st -= dt;
      if (a.st <= 0) {
        a.state = 'idle'; a.cd = 0.9;
        if (d.bite) { a.vy = -260; a.vx = a.face * 260; }
        if (Math.abs(dx) < 40 + a.w / 2 && Math.abs(p.y - a.y) < 34) SD.hurtPlayer(d.bite || 14, a.face);
        sfx(d.bite ? 'bite' : 'swing');
      }
      return;
    }
    a.cd -= dt;
    if (dist < 26 + a.w / 2 && a.cd <= 0 && a.onGround) { a.state = 'wind'; a.st = d.bite ? 0.25 : 0.35; return; }
    walk(a, dt, p.x, d.speed);
  }

  function prey(a, dt, p, dx, dist) {
    const d = KINDS[a.kind];
    if (dist < (a.kind === 'deer' ? 260 : 170) || a.hitT > 0) a.flee = 3;
    if (a.flee > 0) { a.flee -= dt; a.face = -Math.sign(dx) || 1; walk(a, dt, a.x + a.face * 300, d.speed); if (a.kind === 'rabbit' && a.onGround && Math.random() < dt * 3) a.vy = -260; }
    else { if (Math.random() < dt * 0.4) a.st = a.hx + rand(-90, 90); const m = walk(a, dt, a.st || a.hx, 40); if (m) a.face = m; }
  }

  function folk(a, dt, p, dx, dist) {
    const G = SD.G;
    a.panic -= dt;
    if (a.panic > 0) { a.face = -Math.sign(dx) || 1; walk(a, dt, Math.max(a.x0, Math.min(a.x1, a.x + a.face * 200)), 135); return; }
    if (dist < 60 && !p.mounted && (!a.said || a.said < G.time - 25)) { a.said = G.time; a.bubble = { text: SD.save.rep <= -40 ? 'Stay away from me.' : pick(LINES), t: 2.6 }; }
    if (dist < 80) { a.vx *= 0.85; a.face = Math.sign(dx) || a.face; return; }
    if (!a.st || Math.abs(a.st - a.x) < 8) { a.wait = (a.wait || 0) - dt; if (a.wait <= 0) { a.st = rand(a.x0, a.x1); a.wait = rand(1, 4); } a.vx *= 0.8; return; }
    a.face = walk(a, dt, a.st, 48) || a.face;
  }

  /* ---------- crime and the law ---------- */
  SD.crime = function (sev, a) {
    const G = SD.G, sv = SD.save;
    const was = G.wanted;
    G.wanted = Math.min(3, G.wanted + sev); G.calm = 0;
    sv.fine += 25 * sev; sv.rep = Math.max(-100, sv.rep - (a && a.team === 'law' ? 8 : 12) * sev);
    if (!was) SD.say('WANTED. Lawmen are on the way.', 3);
    lawWave();
  };
  function lawWave() {
    const G = SD.G, p = G.p, cur = G.actors.filter((a) => a.kind === 'law' && !a.dead).length;
    const want = Math.min(5, G.wanted * 2) - cur;
    for (let i = 0; i < want; i++) {
      const x = SD.inTown(p.x) ? SD.SPOTS.sheriff + rand(-30, 30) : p.x + (i % 2 ? 1 : -1) * rand(560, 760);
      SD.spawn('law', Math.max(40, Math.min(SD.WORLD_W - 40, x)), { alert: true, hat: '#2d2d33', shirt: '#3a4a6a', law: true });
    }
  }
  SD.onHurtActor = function (a, o) {
    const G = SD.G;
    if (a.team === 'town' && !a.crimed) { a.crimed = true; SD.crime(1, a); }
    else if (a.team === 'law' && !G.wanted) SD.crime(1, a);
    for (const f of G.actors) if (f.kind === 'folk' && Math.abs(f.x - G.p.x) < 500) f.panic = 5;
  };
  SD.onShotFired = function () {
    const G = SD.G;
    for (const f of G.actors) {
      if (f.dead) continue;
      const d = Math.abs(f.x - G.p.x);
      if (f.kind === 'folk' && d < 400) f.panic = 4;
      else if (KINDS[f.kind].flee && d < 600) f.flee = 3;
      else if (f.team === 'gang' && d < 700) f.alert = true;
    }
  };

  /* ---------- ecology: keep the world populated near the player ---------- */
  let ecoT = 0, ambushT = 70;
  SD.populate = function (dt) {
    const G = SD.G, p = G.p, hour = SD.save.hour;
    ecoT -= dt;
    if (!G.townBuilt) {
      G.townBuilt = true;
      for (let i = 0; i < 7; i++) { const x0 = 820 + i * 260; SD.spawn('folk', x0 + 60, { x0, x1: x0 + 220, persist: true }); }
    }
    if (ecoT <= 0) {
      ecoT = 2.5;
      const r = SD.regionAt(p.x).id, night = hour >= 20 || hour < 5;
      const wild = G.actors.filter((a) => a.team === 'wild' && !a.dead && Math.abs(a.x - p.x) < 1400).length;
      if (r !== 'town' && r !== 'rail' && wild < 4) {
        const side = Math.random() < 0.5 ? -1 : 1, x = p.x + side * rand(620, 900);
        if (x > 2800 && x < SD.WORLD_W - 60) {
          const roll = Math.random();
          if (night && roll < 0.45) SD.gangAt(x, ['wolf', 'wolf'].slice(0, Math.random() < 0.5 ? 1 : 2));
          else if (roll < 0.45) SD.spawn('rabbit', x);
          else if (roll < 0.75 && r !== 'plains') SD.spawn('deer', x);
          else if (roll < 0.75) SD.spawn('rabbit', x);
          else if (r === 'plains' || r === 'gulch') SD.gangAt(x, ['coyote', 'coyote']);
          else SD.spawn('deer', x);
        }
      }
      if (G.wanted && SD.inTown(p.x)) lawWave();
    }
    // random bandit riders once the player has started the story
    if (SD.save.mission >= 1 && !G.duel && !SD.inTown(p.x) && p.x > 2900) {
      ambushT -= dt;
      if (ambushT <= 0) {
        ambushT = rand(80, 140);
        const side = Math.random() < 0.5 ? -1 : 1, n = Math.random() < 0.5 ? 2 : 3;
        for (let i = 0; i < n; i++) SD.spawn('rider', Math.max(60, Math.min(SD.WORLD_W - 60, p.x + side * (900 + i * 90))), { alert: true });
        SD.say('Riders coming!', 2);
      }
    }
    // despawn far, non-mission actors and old bodies
    G.actors = G.actors.filter((a) => {
      const far = Math.abs(a.x - p.x) > 2600;
      if (a.inside) return true;
      if (a.dead) return a.deadT < 90 && !(far && !a.tag);
      return a.persist || a.tag || !far;
    });
  };

  SD.stepActors = function (dt) {
    const G = SD.G, p = G.p;
    if (G.wanted) {
      const close = G.actors.some((a) => a.kind === 'law' && !a.dead && Math.abs(a.x - p.x) < 800);
      G.calm = close ? 0 : G.calm + dt;
      if (G.calm > 22) { G.wanted = 0; SD.say('You lost the law. You still owe a fine at the sheriff.', 3.2); for (const a of G.actors) if (a.kind === 'law') a.alert = false, a.leaving = true; }
    }
    for (const a of G.actors) {
      a.flash -= dt; a.hitT = (a.hitT || 0) - dt; a.muzzle = (a.muzzle || 0) - dt;
      if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; }
      if (a.inside) continue;
      if (a.dead) { a.deadT += dt; a.vx *= 0.9; SD.moveBody(a, dt); continue; }
      if (a.kind === 'bottle') continue;
      if (SD.extraAI && SD.extraAI(a, dt, p)) continue;
      const dx = p.x - a.x, dist = Math.abs(dx);
      if (G.duel && a.team === 'gang') { a.face = Math.sign(dx) || a.face; a.vx = 0; SD.moveBody(a, dt); continue; }
      if (dist > 1800 && !a.alert) continue;
      a.t += dt;
      if (a.leaving) { walk(a, dt, SD.SPOTS.sheriff, 120); if (Math.abs(a.x - SD.SPOTS.sheriff) < 20 || dist > 1600) a.gone = true; }
      else if (a.kind === 'folk') folk(a, dt, p, dx, dist);
      else if (KINDS[a.kind].flee) prey(a, dt, p, dx, dist);
      else if (a.kind === 'knife' || KINDS[a.kind].bite) brawler(a, dt, p, dx, dist);
      else gunman(a, dt, p, dx, dist);
      SD.moveBody(a, dt);
    }
    G.actors = G.actors.filter((a) => !a.gone);
    // dynamite
    for (const b of G.booms) {
      b.t -= dt; b.vy += K.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const gy = SD.ground(b.x);
      if (b.y > gy) { b.y = gy; b.vy *= -0.35; b.vx *= 0.5; }
      if (b.t <= 0) {
        SD.puff(b.x, b.y - 10, 30, '#ffb347', 320, 0.6); SD.puff(b.x, b.y - 10, 16, '#555', 160, 0.9, -60);
        G.shake = Math.max(G.shake, 12); sfx('boom');
        if (Math.hypot(p.x - b.x, p.y - 10 - b.y) < 95) SD.hurtPlayer(38, Math.sign(p.x - b.x));
      }
    }
    G.booms = G.booms.filter((b) => b.t > 0);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
