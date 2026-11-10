/* Neural Kick — enemies: spawning, death, and one small state machine per type.
   Every attack has a visible wind-up (state 'wind') so it can be rolled through or interrupted. */
(function (g) {
  'use strict';
  const NK = g.NK, C = NK.C, S = NK.S, PW = C.PW, PH = C.PH;
  const sfx = (n) => NK.sfx && NK.sfx(n);

  NK.spawnEnemy = function (type, cx, floorY) {
    const d = NK.ENEMIES[type], dep = S.run.depth;
    const hp = Math.round(d.hp * (1 + 0.3 * dep));
    const e = {
      type, x: cx - d.w / 2, y: floorY - d.h, w: d.w, h: d.h, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1,
      hp, maxhp: hp, dmg: Math.round(d.dmg * (1 + 0.15 * dep)), state: 'idle', st: 0, t: Math.random() * 3,
      cd: 0.4 + Math.random() * 0.8, flash: 0, stun: 0, armor: !!d.armor, fly: !!d.fly, aggro: false,
      hx: cx - d.w / 2, hy: floorY - d.h, onGround: false, wall: 0, struck: false,
    };
    S.en.push(e);
    return e;
  };
  NK.makeElite = function (e) {
    e.elite = true; e.hp = e.maxhp = Math.round(e.maxhp * 2.6); e.dmg = Math.round(e.dmg * 1.3);
    const h0 = e.h; e.w = Math.round(e.w * 1.25); e.h = Math.round(e.h * 1.25); e.y -= e.h - h0;
  };

  NK.killEnemy = function (e) {
    const d = NK.ENEMIES[e.type], r = S.run, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    r.kills++;
    if (r.vamp && r.hp < r.maxhp) r.hp = Math.min(r.maxhp, r.hp + r.vamp);
    NK.puff(cx, cy, e.type === 'boss' ? 60 : 16, e.type === 'wisp' ? '#d8c8ff' : '#ff6b7a', e.type === 'boss' ? 420 : 220, 0.6, 400);
    NK.dropLoot(cx, cy, (d.gold + r.depth) * (e.elite ? 3 : 1), d.cores + (e.elite ? 4 : 0), e.elite ? 30 : Math.random() < 0.08 ? 15 : 0);
    S.hitstop = Math.max(S.hitstop, e.type === 'boss' ? 0.25 : 0.06);
    if (e.elite) NK.dropWeapon(cx, e.y + e.h, NK.rollWeapon());
    if (e.type === 'boss') {
      S.shake = 16; S.items.push({ kind: 'chip', x: cx, y: e.y + e.h });
      NK.dropWeapon(cx + 50, e.y + e.h, NK.rollWeapon());
      NK.say(d.name + ' terminated. The door is open.'); sfx('win');
      if (NK.onEvent) NK.onEvent('boss');
    } else sfx('kill');
  };

  const overlap = (e) => { const p = S.p; return p.x < e.x + e.w && p.x + PW > e.x && p.y < e.y + e.h && p.y + PH > e.y; };
  const floorAhead = (e, dir) => NK.floorAt(S.L, e.x + e.w / 2 + dir * (e.w / 2 + 6), e.y + e.h);
  function body(e, dt) { e.vy = Math.min(C.MAXFALL, e.vy + C.G * dt); NK.moveBox(e, dt, S.L); }
  function wave(e, dir) { S.shots.push({ kind: 'wave', from: 'e', x: e.x + e.w / 2 + dir * (e.w / 2), y: e.y + e.h, vx: dir * 215, vy: 0, dmg: Math.round(e.dmg * 0.6), life: 0.85 }); }
  function bolt(e, ang, sp) { S.shots.push({ kind: 'bolt', from: 'e', x: e.x + e.w / 2, y: e.y + e.h * 0.35, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: e.dmg, life: 2.6 }); }

  const AI = {
    bug(e, dt, dx, dy) {
      const fast = e.elite ? 140 : 115;
      if (e.state === 'idle') {
        if (e.aggro) {
          e.dir = Math.sign(dx) || e.dir;
          if (Math.abs(dx) > 46) e.vx = floorAhead(e, e.dir) ? e.dir * fast : 0;
          else { e.vx = 0; if (e.cd <= 0 && Math.abs(dy) < 54) { e.state = 'wind'; e.st = 0.38; } }
        } else {
          if (e.wall || !floorAhead(e, e.dir)) e.dir = -e.dir;
          e.vx = e.dir * 45;
        }
      } else if (e.state === 'wind') {
        e.vx = 0; e.st -= dt;
        if (e.st <= 0) { e.state = 'attack'; e.st = 0.22; e.struck = false; sfx('lunge'); }
      } else if (e.state === 'attack') {
        e.vx = floorAhead(e, e.dir) ? e.dir * 310 : 0; e.st -= dt;
        if (!e.struck && overlap(e)) { e.struck = true; NK.hurtPlayer(e.dmg, e.dir); }
        if (e.st <= 0) { e.state = 'idle'; e.cd = 0.75; e.vx = 0; }
      }
      body(e, dt);
    },
    glitch(e, dt, dx) {
      if (e.state === 'idle') {
        if (e.onGround) e.vx = 0;
        if (e.aggro && e.onGround && e.cd <= 0) { e.dir = Math.sign(dx) || e.dir; e.state = 'wind'; e.st = 0.26; }
      } else if (e.state === 'wind') {
        e.st -= dt;
        if (e.st <= 0) { e.state = 'attack'; e.vx = e.dir * Math.max(90, Math.min(200, Math.abs(dx) * 1.5)); e.vy = -540; e.struck = false; e.onGround = false; }
      } else if (e.state === 'attack') {
        if (!e.struck && overlap(e)) { e.struck = true; NK.hurtPlayer(e.dmg, e.dir); }
        if (e.onGround && e.vy >= 0) { e.state = 'idle'; e.cd = e.elite ? 0.5 : 0.85; }
      }
      const was = e.vy;
      body(e, dt);
      if (e.state === 'attack' && was < 0) e.onGround = false;
    },
    wisp(e, dt, dx, dy, dist) {
      let tx, ty;
      if (e.aggro && e.cd <= 0) { tx = (dx / (dist || 1)) * 96; ty = (dy / (dist || 1)) * 96; e.dir = Math.sign(dx) || e.dir; }
      else if (e.aggro) { tx = 0; ty = -20; }
      else { tx = (e.hx + Math.sin(e.t * 0.9) * 34 - e.x) * 2; ty = (e.hy + Math.sin(e.t * 2) * 8 - e.y) * 2; }
      e.vx += (tx - e.vx) * Math.min(1, dt * 3); e.vy += (ty - e.vy) * Math.min(1, dt * 3);
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.cd <= 0 && overlap(e) && NK.hurtPlayer(e.dmg, Math.sign(dx))) { e.vx = -Math.sign(dx) * 180; e.vy = -90; e.cd = 0.9; }
    },
    spam(e, dt, dx, dy, dist) {
      e.vx = 0;
      if (dist < 520) e.dir = Math.sign(dx) || e.dir;
      if (e.state === 'idle') {
        if (e.aggro && e.cd <= 0 && Math.abs(dx) < 420 && Math.abs(dy) < 180) { e.state = 'wind'; e.st = 0.55; }
      } else if (e.state === 'wind') {
        e.st -= dt;
        if (e.st <= 0) {
          bolt(e, Math.atan2(S.p.y + PH / 2 - (e.y + e.h * 0.35), S.p.x + PW / 2 - (e.x + e.w / 2)), 250);
          e.state = 'idle'; e.cd = 1.7; sfx('shoot');
        }
      }
      body(e, dt);
    },
    bloat(e, dt, dx, dy) {
      if (e.state === 'idle') {
        if (e.aggro) {
          e.dir = Math.sign(dx) || e.dir;
          if (Math.abs(dx) > 58) e.vx = floorAhead(e, e.dir) ? e.dir * 58 : 0;
          else { e.vx = 0; if (e.cd <= 0 && Math.abs(dy) < 70) { e.state = 'wind'; e.st = 0.7; } }
        } else {
          if (e.wall || !floorAhead(e, e.dir)) e.dir = -e.dir;
          e.vx = e.dir * 32;
        }
      } else if (e.state === 'wind') {
        e.vx = 0; e.st -= dt;
        if (e.st <= 0) {
          e.state = 'attack'; e.st = 0.9; S.shake = Math.max(S.shake, 7); sfx('boom');
          NK.puff(e.x + e.w / 2 + e.dir * 30, e.y + e.h, 14, 'rgba(255,255,255,0.8)', 200, 0.35);
          const px = S.p.x + PW / 2 - (e.x + e.w / 2);
          if (Math.abs(px) < 74 && Math.abs(S.p.y + PH - (e.y + e.h)) < 60) NK.hurtPlayer(e.dmg, Math.sign(px) || e.dir);
          wave(e, 1); wave(e, -1);
        }
      } else { e.vx = 0; e.st -= dt; if (e.st <= 0) { e.state = 'idle'; e.cd = 0.5; } }
      body(e, dt);
    },
    boss(e, dt, dx) {
      const A = S.L.arena, rage = e.hp < e.maxhp * 0.5, p = S.p;
      if (!e.aggro) { if (A && p.x > A.x0 + 60) { e.aggro = true; e.cd = 1.3; NK.say(NK.ENEMIES.boss.name); sfx('deny'); } e.vx = 0; body(e, dt); return; }
      if (e.state === 'idle') {
        e.vx *= Math.max(0, 1 - 10 * dt); e.dir = Math.sign(dx) || e.dir;
        if (e.cd <= 0 && e.onGround) {
          const r = Math.random();
          e.mode = Math.abs(dx) > 300 ? (r < 0.5 ? 'charge' : 'barrage') : r < 0.4 ? 'leap' : r < 0.75 ? 'charge' : 'barrage';
          e.state = 'wind'; e.st = rage ? 0.42 : 0.6;
        }
      } else if (e.state === 'wind') {
        e.vx = 0; e.st -= dt;
        if (e.st <= 0) {
          e.state = 'attack'; e.struck = false;
          if (e.mode === 'charge') { e.st = 1.1; sfx('lunge'); }
          else if (e.mode === 'leap') { e.vy = -780; e.vx = Math.max(-430, Math.min(430, dx / 0.7)); e.st = 3; e.onGround = false; sfx('jump'); }
          else {
            const base = Math.atan2(p.y - e.y - 10, dx), n = rage ? 7 : 5;
            for (let i = 0; i < n; i++) bolt(e, base + (i - (n - 1) / 2) * 0.17, 235);
            e.st = 0.5; sfx('shoot');
          }
        }
      } else if (e.state === 'attack') {
        e.st -= dt;
        if (e.mode === 'charge') {
          e.vx = e.dir * (rage ? 540 : 450);
          if (e.wall || e.st <= 0 || (A && (e.x <= A.x0 + 2 || e.x + e.w >= A.x1 - 2) && e.st < 0.95)) { e.state = 'rest'; e.st = 0.65; e.vx = 0; S.shake = Math.max(S.shake, 6); }
        } else if (e.mode === 'leap') {
          if (e.onGround && e.vy >= 0 && e.st < 2.9) {
            e.state = 'rest'; e.st = 0.7; e.vx = 0; S.shake = Math.max(S.shake, 10); sfx('boom');
            NK.puff(e.x + e.w / 2, e.y + e.h, 20, 'rgba(255,255,255,0.8)', 260, 0.4);
            wave(e, 1); wave(e, -1);
          }
        } else if (e.st <= 0) { e.state = 'rest'; e.st = 0.6; }
      } else { e.vx = 0; e.st -= dt; if (e.st <= 0) { e.state = 'idle'; e.cd = rage ? 0.35 : 0.8; } }
      const wasUp = e.vy < 0;
      body(e, dt);
      if (wasUp) e.onGround = false;
      if (A) e.x = Math.max(A.x0, Math.min(A.x1 - e.w, e.x));
      if (overlap(e)) NK.hurtPlayer(e.state === 'attack' ? e.dmg : Math.round(e.dmg * 0.6), Math.sign(dx) || 1);
    },
  };

  NK.stepEnemies = function (dt) {
    const p = S.p, pcx = p.x + PW / 2, pcy = p.y + PH / 2;
    for (const e of S.en) {
      if (e.hp <= 0) continue;
      const dx = pcx - (e.x + e.w / 2), dy = pcy - (e.y + e.h / 2), dist = Math.hypot(dx, dy);
      if (dist > 1100 && !e.aggro) continue;
      e.t += dt; e.flash -= dt; e.cd -= dt;
      if (e.type !== 'boss') {
        if (!e.aggro && Math.abs(dx) < 300 && Math.abs(dy) < 120) e.aggro = true;
        else if (e.aggro && dist > 620) e.aggro = false;
      }
      if (e.stun > 0) {
        e.stun -= dt; e.vx *= Math.max(0, 1 - 6 * dt);
        if (e.fly) { e.vy *= Math.max(0, 1 - 6 * dt); e.x += e.vx * dt; e.y += e.vy * dt; } else body(e, dt);
        continue;
      }
      AI[e.type](e, dt, dx, dy, dist);
    }
    if (S.en.some((e) => e.hp <= 0)) S.en = S.en.filter((e) => e.hp > 0);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
