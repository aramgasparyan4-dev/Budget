/* Neural Kick — game state and rules (no drawing here). */
(function (g) {
  'use strict';
  const NK = g.NK, C = NK.C, T = C.T, PW = C.PW, PH = C.PH, TAU = Math.PI * 2;
  const S = (NK.S = {
    state: 'menu', which: 0, L: null, p: null, view: { w: 640, h: 400 }, cam: { x: 0, y: 0 },
    parts: [], pops: [], en: [], trail: [], t: 0, clock: 0, coins: 0, deaths: 0, maxH: 0,
    rot: 0, spinV: 0, spinT: 0, sqx: 1, sqy: 1, shake: 0, bump: {}, springT: {}, accent: '#fff',
  });
  const sfx = (n) => NK.sfx && NK.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);

  function puff(x, y, n, color, speed, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * speed;
      S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(2, 5), grav: grav || 0 });
    }
  }
  NK.puff = puff;

  function spawnPlayer() {
    S.p = NK.newPlayer(S.spawn.x, S.spawn.y);
    S.p.ev = [];
    S.rot = 0; S.spinV = 0; S.spinT = 0; S.sqx = S.sqy = 1; S.trail = []; S.slideT = 0;
  }
  function spawnEnemies() {
    S.en = S.L.enemies.map((e) => e.type === 'E'
      ? { type: 'E', x: e.x, y: e.y + T / 2 - 10, w: 24, h: 20, vx: -55, dead: 0, t: 0 }
      : { type: 'F', x0: e.x, y0: e.y, x: e.x, y: e.y, w: 24, h: 22, dead: 0, t: (e.x * 0.013) % TAU });
  }

  function camTarget() {
    const p = S.p, v = S.view, L = S.L, lw = L.w * T, lh = L.h * T;
    let x = p.x + PW / 2 + p.facing * 36 - v.w / 2;
    let y = p.y + PH / 2 - v.h * (L.mode === 'tower' ? 0.62 : 0.56);
    x = lw <= v.w ? (lw - v.w) / 2 : Math.max(0, Math.min(lw - v.w, x));
    y = Math.min(lh - v.h + (S.padB || 0), y);
    return { x, y };
  }

  NK.startLevel = function (which, seed) {
    const L = which === 'tower' ? NK.buildTower(seed || ((Math.random() * 1e9) | 0)) : NK.buildLevel(NK.LEVELS[which]);
    S.which = which; S.L = L; S.state = 'play'; S.t = 0; S.coins = 0; S.deaths = 0;
    S.parts = []; S.pops = []; S.bump = {}; S.springT = {}; S.shake = 0; S.dieT = 0; S.winT = 0; S.reported = false;
    S.spawn = { x: L.start.x, y: L.start.y }; S.maxH = 0; S.baseY = L.start.y + PH;
    spawnPlayer(); spawnEnemies();
    const c = camTarget(); S.cam.x = c.x; S.cam.y = c.y;
  };

  function kill() {
    const p = S.p;
    if (S.state !== 'play') return;
    p.dead = true; S.state = 'dead'; S.dieT = 0.8; S.deaths++; S.shake = 12;
    puff(p.x + PW / 2, p.y + PH / 2, 26, S.accent, 320, 0.7, 500);
    puff(p.x + PW / 2, p.y + PH / 2, 10, '#ffffff', 200, 0.5, 300);
    sfx('die');
  }

  function handleEvents() {
    const p = S.p, L = S.L, cx = p.x + PW / 2, fy = p.y + PH;
    for (const ev of p.ev) {
      const type = ev[0], a = ev[1], b = ev[2];
      if (type === 'jump') { sfx('jump'); S.sqx = 0.72; S.sqy = 1.32; puff(cx, fy, 5, 'rgba(255,255,255,0.7)', 70, 0.3); }
      else if (type === 'kick') {
        sfx('kick'); S.spinV = (-a * TAU) / 0.42; S.spinT = 0.42; S.sqx = 1.25; S.sqy = 0.8;
        puff(a < 0 ? p.x : p.x + PW, p.y + PH / 2, 7, 'rgba(255,255,255,0.8)', 110, 0.35);
      } else if (type === 'land') { sfx('land'); S.sqx = 1.32; S.sqy = 0.7; puff(cx, fy, 6, 'rgba(255,255,255,0.6)', 80, 0.3); }
      else if (type === 'bonk') {
        if (L.grid[b][a] === '?') {
          L.grid[b][a] = 'U'; S.coins++; S.bump[a + ',' + b] = 0.2;
          S.pops.push({ x: a * T + T / 2, y: b * T - 6, t: 0 });
          sfx('coin');
        }
      } else if (type === 'spring') { S.springT[a + ',' + b] = 0.3; sfx('spring'); S.sqx = 0.7; S.sqy = 1.4; S.spinT = 0; S.rot = 0; }
      else if (type === 'die') kill();
    }
    p.ev.length = 0;
  }

  function stepEnemies(dt, inp) {
    const p = S.p, L = S.L;
    for (const e of S.en) {
      if (e.dead > 0) { e.dead += dt; continue; }
      e.t += dt;
      if (e.type === 'E') {
        const nx = e.x + e.vx * dt, fx = nx + Math.sign(e.vx) * (e.w / 2);
        const ahead = NK.tileAt(L, Math.floor(fx / T), Math.floor(e.y / T));
        const below = NK.tileAt(L, Math.floor(fx / T), Math.floor((e.y + e.h / 2 + 4) / T));
        if (NK.isSolid(ahead) || ahead === '^' || !(NK.isSolid(below) || below === '-')) e.vx = -e.vx;
        else e.x = nx;
      } else {
        e.x = e.x0 + Math.sin(e.t * 1.1) * 78;
        e.y = e.y0 + Math.sin(e.t * 2.4) * 9;
      }
      if (S.state !== 'play') continue;
      const ex = e.x - e.w / 2, ey = e.y - e.h / 2;
      if (p.x < ex + e.w && p.x + PW > ex && p.y < ey + e.h && p.y + PH > ey) {
        if (p.vy > 0 && p.y + PH - ey < 15) {
          e.dead = 0.001; p.vy = inp.jump ? -C.JUMP * 0.92 : -C.STOMP; p.cut = false; p.onGround = false;
          S.sqx = 1.25; S.sqy = 0.78; S.shake = 4;
          puff(e.x, e.y, 10, e.type === 'E' ? '#ff6b7a' : '#cdb8ff', 160, 0.4, 300);
          sfx('stomp');
        } else kill();
      }
    }
    S.en = S.en.filter((e) => e.dead < 0.35);
  }

  function stepPickups() {
    const p = S.p, L = S.L, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const c of L.coins) {
      if (!c.got && Math.abs(cx - c.x) < 21 && Math.abs(cy - c.y) < 21) {
        c.got = true; S.coins++; puff(c.x, c.y, 6, '#ffd75e', 90, 0.35); sfx('coin');
      }
    }
    for (const k of L.checks) {
      if (!k.on && Math.abs(cx - k.x) < 22 && cy > k.y - 70 && cy < k.y + 4) {
        k.on = true; S.spawn = { x: k.x - PW / 2, y: k.y - PH };
        puff(k.x, k.y - 40, 14, '#7cf0c8', 150, 0.5); sfx('check');
      }
    }
    const G = L.goal;
    if (G && Math.abs(cx - G.x) < 24 && Math.abs(cy - G.y) < 28) {
      S.state = 'win'; S.winT = 0; S.reported = false;
      puff(G.x, G.y, 30, S.accent, 300, 0.9); puff(G.x, G.y, 20, '#ffd75e', 220, 0.8);
      sfx('win');
    }
  }

  function stepAnim(dt) {
    const p = S.p, k = Math.min(1, dt * 11);
    S.sqx += (1 - S.sqx) * k; S.sqy += (1 - S.sqy) * k;
    if (S.spinT > 0) {
      S.rot += S.spinV * dt; S.spinT -= dt;
      if (S.spinT <= 0 || p.onGround || p.sliding) { S.spinT = 0; S.rot = 0; }
    } else {
      const target = p.sliding ? 0 : (p.vx / C.RUN) * (p.onGround ? 0.13 : 0.22);
      S.rot += (target - S.rot) * Math.min(1, dt * 14);
    }
    if (S.spinT > 0 || Math.abs(p.vx) > 300 || p.vy < -800) {
      S.trail.push({ x: p.x + PW / 2, y: p.y + PH / 2, rot: S.rot, life: 0.22 });
    }
    for (const t of S.trail) t.life -= dt;
    S.trail = S.trail.filter((t) => t.life > 0);
    if (p.sliding) {
      S.slideT -= dt;
      if (S.slideT <= 0) {
        S.slideT = 0.07;
        S.parts.push({ x: p.wallDir < 0 ? p.x : p.x + PW, y: p.y + 4, vx: -p.wallDir * 20, vy: -30, life: 0.3, max: 0.3, color: 'rgba(255,255,255,0.55)', size: 3, grav: 0 });
      }
    }
  }

  function stepCamera(dt) {
    const c = camTarget(), k = Math.min(1, dt * 7);
    S.cam.x += (c.x - S.cam.x) * k;
    if (S.L.mode === 'tower') S.cam.y = Math.min(S.cam.y, S.cam.y + (c.y - S.cam.y) * k);
    else S.cam.y += (c.y - S.cam.y) * Math.min(1, dt * 6);
  }

  function stepFx(dt) {
    for (const q of S.parts) { q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (S.parts.length) S.parts = S.parts.filter((q) => q.life > 0);
    for (const q of S.pops) q.t += dt;
    if (S.pops.length) S.pops = S.pops.filter((q) => q.t < 0.5);
    for (const k in S.bump) { S.bump[k] -= dt; if (S.bump[k] <= 0) delete S.bump[k]; }
    for (const k in S.springT) { S.springT[k] -= dt; if (S.springT[k] <= 0) delete S.springT[k]; }
    S.shake = Math.max(0, S.shake - dt * 40);
  }

  NK.step = function (dt, inp) {
    S.clock += dt;
    if (!S.L) return;
    if (S.state === 'play') {
      const p = S.p;
      S.t += dt;
      NK.stepPlayer(p, inp, dt, S.L);
      handleEvents();
      if (S.state === 'play') { stepEnemies(dt, inp); }
      if (S.state === 'play') stepPickups();
      if (S.L.mode === 'tower') {
        S.maxH = Math.max(S.maxH, Math.floor((S.baseY - (p.y + PH)) / T));
        if (S.state === 'play' && p.y > S.cam.y + S.view.h + 24) kill();
      }
      stepAnim(dt); stepCamera(dt);
    } else if (S.state === 'dead') {
      stepEnemies(dt, inp);
      S.dieT -= dt;
      if (S.dieT <= 0) {
        if (S.L.mode === 'tower') { S.state = 'over'; if (NK.onEnd) NK.onEnd('over'); }
        else { spawnPlayer(); spawnEnemies(); S.state = 'play'; }
      }
    } else if (S.state === 'win') {
      S.winT += dt;
      if (S.winT > 1.0 && !S.reported) { S.reported = true; if (NK.onEnd) NK.onEnd('win'); }
    }
    if (S.state !== 'paused') stepFx(dt);
  };

  /* Send the player back to the last checkpoint (the R key). */
  NK.retry = function () { if (S.state === 'play' && S.L.mode !== 'tower') kill(); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
