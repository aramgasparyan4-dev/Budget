/* Sundown Protocol — bodies, the player, the horse, guns, bullets, damage. No DOM here.
   Actors use x = centre, y = feet. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;
  const K = (SD.K = {
    G: 1900, RUN: 190, ACC: 1700, FRIC: 2200, JUMP: 600, ROLL: 360, ROLLT: 0.32, ROLLCD: 0.55,
    TROT: 300, GALLOP: 540, HACC: 900, HJUMP: 640, SADDLE: 33, DT: 1 / 120,
  });
  SD.GUNS = {
    revolver: { name: 'Revolver', dmg: 26, clip: 6, every: 0.26, reload: 1.3, spread: 0.02, speed: 2100, range: 950, ammo: 'pistol', pellets: 1, kick: 2 },
    rifle: { name: 'Repeater', dmg: 58, clip: 8, every: 0.55, reload: 2.1, spread: 0.006, speed: 2700, range: 1500, ammo: 'rifle', pellets: 1, kick: 4 },
    shotgun: { name: 'Scattergun', dmg: 15, clip: 2, every: 0.38, reload: 1.7, spread: 0.16, speed: 1600, range: 380, ammo: 'shells', pellets: 7, kick: 7 },
    lasso: { name: 'Lasso', dmg: 0, clip: 1, every: 0.4, reload: 0, spread: 0, speed: 0, range: 0, ammo: 'none', pellets: 0, kick: 0 },
  };
  SD.AMMO_NAMES = { pistol: 'pistol rounds', rifle: 'rifle rounds', shells: 'shells' };

  const emit = (n, d) => SD.on && SD.on(n, d);
  const sfx = (n) => SD.sfx && SD.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);
  SD.emit = emit;

  SD.defaultSave = () => ({
    money: 15, rep: 0, hour: 9, day: 1, x: 1560, mission: 0, kills: 0, fine: 0, bounty: null, bountiesDone: 0,
    guns: { revolver: true, rifle: false, shotgun: false }, clip: { revolver: 6, rifle: 8, shotgun: 2 },
    ammo: { pistol: 36, rifle: 0, shells: 0 }, tonics: 1, pelts: { rabbit: 0, deer: 0, coyote: 0, wolf: 0 }, meat: 0, food: 0, robbed: 0,
  });

  SD.newGame = function (save) {
    const x = save.x || 1560;
    SD.save = save;
    SD.G = {
      p: { x, y: SD.ground(x), vx: 0, vy: 0, w: 18, h: 20, face: 1, onGround: true, roll: 0, rollCd: 0, crouch: false, mounted: false,
        hp: 100, maxhp: 100, iframes: 0, aim: 0, fireCd: 0, reload: 0, gun: 'revolver', knife: 0, carry: null, dead: false, flash: 0 },
      horse: { x: x - 60, y: SD.ground(x - 60), vx: 0, vy: 0, w: 50, h: 34, face: 1, onGround: true, mode: 'idle', t: 0, stam: 100 },
      actors: [], bullets: [], booms: [], parts: [], nums: [], marks: [], time: 0, oc: 40, ocOn: false, ocFire: 0,
      wanted: 0, calm: 0, shake: 0, msg: null, near: null, duel: null, scale: 1, muzzle: 0, kick: 0, flash: 0, slow: 0,
      cine: { bars: 0, want: 0, title: null, banner: null, sub: null, queue: [] }, weather: { kind: 'clear', amt: 0, flash: 0, t: 60 }, camp: null, rope: null, loop: null,
    };
    return SD.G;
  };

  /* ---------- effects ---------- */
  SD.puff = function (x, y, n, color, speed, life, grav) {
    const P = SD.G.parts;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * speed;
      P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(1.5, 4), grav: grav || 0 });
    }
  };
  SD.popup = (x, y, text, color, big) => SD.G.nums.push({ x: x + rand(-5, 5), y, text, color, big, t: 0 });
  SD.say = (text, secs) => { SD.G.msg = { text, t: secs || 2.6 }; };

  /* ---------- body physics against terrain and cover ---------- */
  SD.moveBody = function (a, dt) {
    const S = SD.SOLIDS, hw = a.w / 2;
    let nx = Math.max(hw + 4, Math.min(SD.WORLD_W - hw - 4, a.x + a.vx * dt));
    a.blocked = 0;
    for (const b of S) {
      if (a.y > b.y + 3 && a.y - a.h < b.y + b.h) {
        if (nx + hw > b.x && a.x + hw <= b.x + 0.5 && a.vx >= 0) { nx = b.x - hw; a.blocked = 1; }
        else if (nx - hw < b.x + b.w && a.x - hw >= b.x + b.w - 0.5 && a.vx <= 0) { nx = b.x + b.w + hw; a.blocked = -1; }
      }
    }
    if (a.blocked) a.vx = 0;
    a.x = nx;
    a.vy = Math.min(a.vy + K.G * dt, 1400);
    let floor = SD.ground(a.x);
    for (const b of S) if (a.x + hw > b.x + 2 && a.x - hw < b.x + b.w - 2 && a.y <= b.y + 1 && b.y < floor) floor = b.y;
    const ny = a.y + a.vy * dt, was = a.onGround;
    if (ny >= floor || (was && a.vy >= 0 && floor - ny < 14)) {
      if (!was && a.vy > 500) emit('land', a);
      a.y = floor; a.vy = 0; a.onGround = true;
    } else { a.y = ny; a.onGround = false; }
  };

  /* ---------- bullets ---------- */
  function segBox(x0, y0, dx, dy, bx, by, bw, bh) {
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy], q = [x0 - bx, bx + bw - x0, y0 - by, by + bh - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return -1; }
      else {
        const r = q[i] / p[i];
        if (p[i] < 0) { if (r > t1) return -1; if (r > t0) t0 = r; } else { if (r < t0) return -1; if (r < t1) t1 = r; }
      }
    }
    return t0;
  }
  SD.segBox = segBox;
  SD.shoot = function (x, y, ang, speed, dmg, team, range, tx, ty) {
    SD.G.bullets.push({ x, y, px: x, py: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, team, life: range / speed, tx, ty });
  };
  SD.boxOf = (a) => [a.x - a.w / 2, a.y - a.h, a.w, a.h];

  SD.stepBullets = function (dt) {
    const G = SD.G, p = G.p;
    for (const b of G.bullets) {
      b.px = b.x; b.py = b.y;
      const dx = b.vx * dt, dy = b.vy * dt;
      let best = 1, hit = null, kind = null;
      for (const s of SD.SOLIDS) { const t = segBox(b.x, b.y, dx, dy, s.x, s.y, s.w, s.h); if (t >= 0 && t < best) { best = t; kind = 'wall'; hit = s; } }
      if (b.team !== 'e') {
        for (const a of G.actors) {
          if (a.dead || a.inside || a.team === 'ally' || a.kind === 'coach') continue;
          const bx = SD.boxOf(a);
          // bullets pass innocent people unless the player aimed right at them
          if ((a.team === 'town' || (a.team === 'law' && !G.wanted)) && !(b.tx > bx[0] - 14 && b.tx < bx[0] + bx[2] + 14 && b.ty > bx[1] - 14 && b.ty < bx[1] + bx[3] + 14)) continue;
          const t = segBox(b.x, b.y, dx, dy, bx[0], bx[1], bx[2], bx[3]);
          if (t >= 0 && t < best) { best = t; kind = 'actor'; hit = a; }
        }
      } else if (!p.dead) {
        const t = segBox(b.x, b.y, dx, dy, p.x - p.w / 2, p.y - p.h, p.w, p.h);
        if (t >= 0 && t < best) { best = t; kind = 'player'; }
      }
      const ex = b.x + dx * best, ey = b.y + dy * best;
      if (!kind && ey > SD.ground(ex)) { kind = 'ground'; }
      b.x = ex; b.y = ey; b.life -= dt;
      if (kind === 'wall' || kind === 'ground') { SD.puff(ex, ey, 4, kind === 'ground' ? '#c9a46b' : '#e8d3a8', 90, 0.25, 300); b.life = 0; if (kind === 'wall') sfx('ric'); }
      else if (kind === 'actor') {
        const head = hit.human && ey < hit.y - hit.h * 0.72;
        SD.damage(hit, b.dmg * (head ? 2 : 1), Math.sign(b.vx), { head, gun: true });
        b.life = 0;
      } else if (kind === 'player') { SD.hurtPlayer(b.dmg, Math.sign(b.vx)); b.life = 0; }
    }
    G.bullets = G.bullets.filter((b) => b.life > 0);
  };

  /* ---------- damage ---------- */
  SD.damage = function (a, dmg, dir, o) {
    const G = SD.G;
    if (a.dead) return;
    o = o || {};
    dmg = Math.round(dmg);
    if (a.surrender) { a.hp = 0; }
    else if (a.canSurrender && !o.head && a.hp - dmg <= a.maxhp * 0.3) {
      a.hp = Math.max(1, Math.min(a.hp - dmg, Math.round(a.maxhp * 0.3)));
      a.surrender = true; a.state = 'surrender'; a.vx = 0;
      SD.say(a.name + ' gives up. Press E to tie them up.'); emit('surrender', a);
    } else a.hp -= dmg;
    a.flash = 0.12; a.hitT = 0.25;
    if (!a.surrender || a.hp <= 0) { a.vx += dir * 120; a.alert = true; }
    SD.popup(a.x, a.y - a.h - 6, o.head ? 'HEADSHOT' : String(dmg), o.head ? '#ffd166' : '#ffffff', o.head);
    SD.puff(a.x, a.y - a.h * (o.head ? 0.85 : 0.5), o.head ? 10 : 6, a.human ? '#b3261e' : '#8c2f1e', 140, 0.35, 500);
    if (o.gun && o.head) G.oc = Math.min(100, G.oc + 12);
    if (SD.onHurtActor) SD.onHurtActor(a, o);
    sfx('hit');
    if (a.hp <= 0) SD.killActor(a, o);
  };

  SD.killActor = function (a, o) {
    const G = SD.G;
    a.dead = true; a.deadT = 0; a.vx = 0; a.surrender = false; a.flash = 0;
    if (a.human) a.loot = { money: a.team === 'town' ? (1 + Math.random() * 4) | 0 : a.team === 'law' ? 0 : (3 + Math.random() * 9) | 0, ammo: Math.random() < 0.6 ? 6 : 0 };
    else a.loot = { pelt: a.kind };
    G.oc = Math.min(100, G.oc + 6);
    SD.save.kills++;
    emit('kill', a);
  };

  SD.hurtPlayer = function (dmg, dir) {
    const G = SD.G, p = G.p;
    if (p.dead || p.iframes > 0 || p.roll > 0 || G.duel) return false;
    dmg = Math.round(dmg);
    p.hp -= dmg; p.iframes = 0.35; p.flash = 0.15;
    if (!p.mounted) { p.vx += (dir || -p.face) * 140; }
    G.shake = Math.max(G.shake, 6);
    SD.popup(p.x, p.y - 26, '-' + dmg, '#ff6b5e', true);
    SD.puff(p.x, p.y - 10, 7, '#d97757', 160, 0.35, 400);
    sfx('hurt');
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.mounted = false; G.horse.mode = 'idle'; SD.puff(p.x, p.y - 10, 26, '#d97757', 260, 0.8, 500); emit('playerDead'); }
    return true;
  };

  /* ---------- the player's gun ---------- */
  SD.gunOrigin = () => { const p = SD.G.p; return { x: p.x + p.face * 6, y: p.y - (p.crouch ? 7 : 11) }; };
  SD.fireShot = function (ang, exact, tx, ty, mult) {
    const G = SD.G, p = G.p, gun = SD.GUNS[p.gun], o = SD.gunOrigin(), sv = SD.save;
    sv.clip[p.gun]--;
    for (let i = 0; i < gun.pellets; i++) {
      const s = exact ? 0 : gun.spread * (gun.pellets > 1 ? (i / (gun.pellets - 1) - 0.5) * 2 + rand(-0.2, 0.2) : rand(-1, 1));
      SD.shoot(o.x + Math.cos(ang) * 14, o.y + Math.sin(ang) * 14, ang + s, gun.speed, gun.dmg * (mult || 1), 'p', gun.range, tx == null ? p.aimX : tx, ty == null ? p.aimY : ty);
    }
    G.muzzle = 0.06; G.kick = gun.kick; G.shake = Math.max(G.shake, gun.kick * 0.8);
    SD.puff(o.x + Math.cos(ang) * 18, o.y + Math.sin(ang) * 18, 4, 'rgba(230,230,230,0.6)', 60, 0.4, -40);
    sfx('shot_' + p.gun);
    emit('shot');
  };
  function tryFire(ang) {
    const p = SD.G.p, sv = SD.save, gun = SD.GUNS[p.gun];
    if (p.reload > 0 || p.fireCd > 0 || p.roll > 0) return;
    if (sv.clip[p.gun] <= 0) { if (sv.ammo[gun.ammo] > 0) startReload(); else { sfx('dry'); p.fireCd = 0.3; SD.say('Out of ' + SD.AMMO_NAMES[gun.ammo] + '. Buy more at the store.'); } return; }
    SD.fireShot(ang, false);
    p.fireCd = gun.every;
  }
  function startReload() {
    const p = SD.G.p, sv = SD.save, gun = SD.GUNS[p.gun];
    if (p.gun === 'lasso' || p.reload > 0 || sv.clip[p.gun] >= gun.clip || sv.ammo[gun.ammo] <= 0) return;
    p.reload = gun.reload; sfx('reload');
  }
  function finishReload() {
    const p = SD.G.p, sv = SD.save, gun = SD.GUNS[p.gun];
    const n = Math.min(gun.clip - sv.clip[p.gun], sv.ammo[gun.ammo]);
    sv.clip[p.gun] += n; sv.ammo[gun.ammo] -= n;
  }

  /* inp: left right down jump roll fire fireHeld reload knife tonic call gun aimX aimY */
  SD.stepPlayer = function (dt, inp) {
    const G = SD.G, p = G.p, h = G.horse, sv = SD.save;
    if (p.dead) return;
    p.iframes -= dt; p.rollCd -= dt; p.fireCd -= dt; p.flash -= dt; p.knife -= dt;
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) finishReload(); }
    if (inp.gun && (sv.guns[inp.gun] || inp.gun === 'lasso') && inp.gun !== p.gun) { p.gun = inp.gun; p.reload = 0; p.fireCd = 0.2; sfx('equip'); }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const o = SD.gunOrigin();
    p.aim = Math.atan2(inp.aimY - o.y, inp.aimX - o.x); p.aimX = inp.aimX; p.aimY = inp.aimY;
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

    if (p.mounted) {
      const fast = inp.sprint && h.stam > 5;
      const top = fast ? K.GALLOP : K.TROT;
      h.stam = Math.max(0, Math.min(100, h.stam + (fast && dir ? -22 : 14) * dt));
      if (dir) { h.face = dir; h.vx += dir * K.HACC * dt; if (Math.abs(h.vx) > top) h.vx -= Math.sign(h.vx) * Math.min(Math.abs(h.vx) - top, 1200 * dt); }
      else { const f = 700 * dt; h.vx = Math.abs(h.vx) <= f ? 0 : h.vx - Math.sign(h.vx) * f; }
      if (inp.jump && h.onGround) { h.vy = -K.HJUMP; h.onGround = false; sfx('neigh'); }
      else if (h.blocked && h.onGround && dir) { h.vy = -K.HJUMP * 0.86; h.onGround = false; } // Biscuit hops low obstacles on his own
      SD.moveBody(h, dt);
      p.x = h.x; p.y = h.y - K.SADDLE; p.vx = h.vx; p.onGround = true; p.crouch = false;
    } else {
      p.crouch = inp.down && p.onGround && p.roll <= 0;
      p.h = p.crouch ? 13 : 20;
      if (inp.roll && p.rollCd <= 0 && p.onGround) { p.roll = K.ROLLT; p.rollDir = dir || p.face; p.rollCd = K.ROLLCD; sfx('roll'); }
      if (p.roll > 0) { p.roll -= dt; p.vx = p.rollDir * K.ROLL; }
      else {
        const top = K.RUN * (p.crouch ? 0.4 : 1) * (p.reload > 0 ? 0.8 : 1);
        if (dir) { p.vx += dir * K.ACC * dt; if (Math.abs(p.vx) > top) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - top, 2400 * dt); }
        else { const f = K.FRIC * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
        if (inp.jump && p.onGround) { p.vy = -K.JUMP; p.onGround = false; sfx('jump'); }
      }
      SD.moveBody(p, dt);
    }
    if (inp.reload) startReload();
    if (p.gun === 'lasso') { if (inp.fire && p.fireCd <= 0 && p.roll <= 0 && !G.ocOn) { SD.throwLasso(p.aim); p.fireCd = 0.4; } }
    else if ((inp.fire || inp.fireHeld) && !G.ocOn) tryFire(p.aim);
    if (inp.knife && p.knife < -0.2 && !p.mounted) {
      p.knife = 0.25; sfx('swing');
      for (const a of G.actors) {
        if (a.dead || a.inside) continue;
        const dx = a.x - p.x;
        if (Math.sign(dx || p.face) === p.face && Math.abs(dx) < 34 + a.w / 2 && Math.abs(a.y - p.y) < 30) SD.damage(a, 45, p.face, { knife: true });
      }
    }
    if (inp.tonic) {
      const heal = (amt) => { const n = Math.min(amt, p.maxhp - p.hp); p.hp += n; SD.popup(p.x, p.y - 26, '+' + n, '#8fe388', true); sfx('drink'); };
      if (p.hp >= p.maxhp) { /* nothing to heal */ }
      else if (sv.food > 0) { sv.food--; heal(35); }
      else if (sv.tonics > 0) { sv.tonics--; heal(60); }
      else SD.say('Nothing to eat or drink. Buy tonic or cook meat at a camp.');
    }
    if (inp.call && !p.mounted) {
      if (Math.abs(h.x - p.x) > 1600) { h.x = Math.max(30, Math.min(SD.WORLD_W - 30, p.x - p.face * 700)); h.y = SD.ground(h.x) - 4; }
      h.mode = 'come'; sfx('whistle'); SD.say('Biscuit is coming.', 1.6);
    }
  };

  SD.mount = function () {
    const G = SD.G, p = G.p, h = G.horse;
    p.mounted = true; h.mode = 'ridden'; p.roll = 0; p.carryDrop = false; sfx('neigh');
  };
  SD.dismount = function () {
    const G = SD.G, p = G.p, h = G.horse;
    p.mounted = false; h.mode = 'idle'; p.y = h.y; p.x = h.x + 18 * -h.face; p.vx = 0; p.vy = 0; p.h = 20;
  };

  SD.stepHorse = function (dt) {
    const G = SD.G, h = G.horse, p = G.p;
    h.t += dt;
    if (h.mode === 'ridden') return;
    if (h.mode === 'come') {
      const dx = p.x - h.x;
      if (Math.abs(dx) < 46) h.mode = 'idle';
      else { h.face = Math.sign(dx); h.vx += h.face * K.HACC * dt; if (Math.abs(h.vx) > 460) h.vx = h.face * 460; if (h.blocked && h.onGround) h.vy = -K.HJUMP; }
    }
    if (h.mode === 'idle') { const f = 900 * dt; h.vx = Math.abs(h.vx) <= f ? 0 : h.vx - Math.sign(h.vx) * f; }
    h.stam = Math.min(100, h.stam + 14 * dt);
    SD.moveBody(h, dt);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
