/* Neural Kick — core: constants, level builder, player physics.
   No DOM access in this file, so it also runs under Node for the level solver. */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});
  const T = 32;
  const C = (NK.C = {
    T,
    G: 2200, MAXFALL: 900,
    RUN: 260, ACC_G: 2400, ACC_A: 1500, FRIC_G: 2600, FRIC_A: 300,
    JUMP: 760, CUT: 300,
    SLIDE: 110, WJX: 330, WJY: 720, LOCK: 0.18,
    SPRING: 1150, STOMP: 520,
    COYOTE: 0.09, JBUF: 0.12, WCOY: 0.1,
    PW: 22, PH: 22, DT: 1 / 120,
  });
  const PW = C.PW, PH = C.PH;

  const isSolid = (c) => c === '#' || c === '?' || c === 'U';
  NK.isSolid = isSolid;

  function tileAt(L, tx, ty) {
    if (ty < 0 || ty >= L.h) return ' ';
    if (tx < 0 || tx >= L.w) return '#';
    return L.grid[ty][tx];
  }
  NK.tileAt = tileAt;

  /* ---------- level building ----------
     A level is a row of chunks. Each chunk is a small ASCII picture, bottom
     aligned. `rise` shifts the baseline for every chunk after it. */
  NK.buildLevel = function (def) {
    let x = 0, elev = 0, minE = 0, maxTop = 0;
    const placed = [];
    for (const ch of def.chunks) {
      const rows = ch.rows;
      const w = Math.max.apply(null, rows.map((r) => r.length));
      placed.push({ rows, w, x, elev, signs: ch.signs || [] });
      minE = Math.min(minE, elev);
      maxTop = Math.max(maxTop, elev + rows.length);
      x += w;
      elev += ch.rise || 0;
      minE = Math.min(minE, elev);
    }
    const W = x, H = maxTop - minE + (def.sky == null ? 8 : def.sky);
    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill(' '));
    const signs = [];
    for (const p of placed) {
      const n = p.rows.length;
      const by = H - 1 - (p.elev - minE);
      for (const sg of p.signs) signs.push({ x: (p.x + sg.x) * T, y: (by - (n - 1) + sg.y) * T, text: sg.text });
      for (let i = 0; i < n; i++) {
        const row = p.rows[i], gy = by - (n - 1 - i);
        for (let cx = 0; cx < p.w; cx++) grid[gy][p.x + cx] = row[cx] || ' ';
      }
      const last = p.rows[n - 1];
      for (let cx = 0; cx < p.w; cx++) {
        if (last[cx] === '#') for (let gy = by + 1; gy < H; gy++) grid[gy][p.x + cx] = '#';
      }
    }
    const L = NK.finishLevel(def, grid);
    L.signs = signs;
    return L;
  };

  /* Pull entities out of the grid, leaving only terrain tiles behind. */
  NK.finishLevel = function (def, grid) {
    const L = {
      id: def.id, name: def.name, sub: def.sub || '', mode: def.mode || 'level',
      pal: def.pal || 0, w: grid[0].length, h: grid.length, grid,
      start: { x: T, y: T }, coins: [], enemies: [], checks: [], goal: null, signs: [],
    };
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const c = grid[y][x];
        if (c === 'P') { L.start = { x: x * T + (T - PW) / 2, y: y * T + T - PH }; grid[y][x] = ' '; }
        else if (c === 'o') { L.coins.push({ x: x * T + T / 2, y: y * T + T / 2, got: false }); grid[y][x] = ' '; }
        else if (c === 'E' || c === 'F') { L.enemies.push({ type: c, x: x * T + T / 2, y: y * T + T / 2 }); grid[y][x] = ' '; }
        else if (c === 'C') { L.checks.push({ x: x * T + T / 2, y: y * T + T, on: false }); grid[y][x] = ' '; }
        else if (c === 'G') { L.goal = { x: x * T + T / 2, y: y * T + T / 2 }; grid[y][x] = ' '; }
        else if (c === '?') L.coinTotalBlocks = (L.coinTotalBlocks || 0) + 1;
      }
    }
    L.coinTotal = L.coins.length + (L.coinTotalBlocks || 0);
    return L;
  };

  /* ---------- player ---------- */
  NK.newPlayer = function (x, y) {
    return {
      x, y, vx: 0, vy: 0, onGround: false, wallDir: 0, lastWall: 0, sliding: false,
      coyote: 0, jbuf: 0, wcoy: 0, lock: 0, cut: false, facing: 1, dead: false, ev: null,
    };
  };

  function emit(p, type, a, b) { if (p.ev) p.ev.push([type, a, b]); }

  /* One fixed step. inp = {left, right, jump (held), jumpPressed (edge)}. */
  NK.stepPlayer = function (p, inp, dt, L) {
    if (p.dead) return;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    p.coyote -= dt; p.jbuf -= dt; p.wcoy -= dt; p.lock -= dt;
    if (inp.jumpPressed) p.jbuf = C.JBUF;
    const locked = p.lock > 0;

    // horizontal
    if (dir) {
      p.facing = dir;
      const acc = (p.onGround ? C.ACC_G : C.ACC_A) * (locked ? 0.15 : 1) * dt;
      if (p.vx * dir < C.RUN) p.vx = dir > 0 ? Math.min(C.RUN, p.vx + acc) : Math.max(-C.RUN, p.vx - acc);
    } else if (!locked) {
      const fr = (p.onGround ? C.FRIC_G : C.FRIC_A) * dt;
      p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
    }
    if (p.onGround && Math.abs(p.vx) > C.RUN) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - C.RUN, 900 * dt);

    // gravity + wall slide
    p.vy += C.G * dt;
    p.sliding = !p.onGround && p.wallDir !== 0 && p.vy > 0;
    p.vy = Math.min(p.vy, p.sliding ? C.SLIDE : C.MAXFALL);

    // jump / wall kick
    if (p.jbuf > 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = -C.JUMP; p.cut = true; p.jbuf = 0; p.coyote = 0; p.onGround = false;
        emit(p, 'jump');
      } else if (p.wallDir || p.wcoy > 0) {
        const wd = p.wallDir || p.lastWall;
        p.vx = -wd * C.WJX; p.vy = -C.WJY; p.lock = C.LOCK; p.cut = false;
        p.jbuf = 0; p.wcoy = 0; p.facing = -wd; p.sliding = false;
        emit(p, 'kick', wd);
      }
    }
    if (p.cut && !inp.jump && p.vy < -C.CUT) p.vy = -C.CUT;
    if (p.vy >= 0) p.cut = false;

    // move X
    let nx = p.x + p.vx * dt;
    const top = Math.floor(p.y / T), bot = Math.floor((p.y + PH - 0.01) / T);
    if (p.vx > 0) {
      const tx = Math.floor((nx + PW) / T);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(L, tx, ty))) { nx = tx * T - PW; p.vx = 0; break; }
    } else if (p.vx < 0) {
      const tx = Math.floor(nx / T);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(L, tx, ty))) { nx = (tx + 1) * T; p.vx = 0; break; }
    }
    p.x = nx;

    // move Y
    const prevBottom = p.y + PH;
    let ny = p.y + p.vy * dt;
    const l = Math.floor(p.x / T), r = Math.floor((p.x + PW - 0.01) / T);
    const wasGround = p.onGround;
    p.onGround = false;
    if (p.vy > 0) {
      const ty = Math.floor((ny + PH) / T);
      for (let tx = l; tx <= r; tx++) {
        const c = tileAt(L, tx, ty);
        if (isSolid(c) || (c === '-' && prevBottom <= ty * T + 0.01)) {
          ny = ty * T - PH;
          if (!wasGround && p.vy > 260) emit(p, 'land', p.vy);
          p.vy = 0; p.onGround = true; p.coyote = C.COYOTE;
          break;
        }
      }
    } else if (p.vy < 0) {
      const ty = Math.floor(ny / T);
      let hit = false;
      for (let tx = l; tx <= r; tx++) if (isSolid(tileAt(L, tx, ty))) hit = true;
      if (hit) {
        const cx = Math.floor((p.x + PW / 2) / T);
        const bx = tileAt(L, cx, ty) === '?' ? cx : tileAt(L, l, ty) === '?' ? l : tileAt(L, r, ty) === '?' ? r : -1;
        if (bx >= 0) emit(p, 'bonk', bx, ty);
        ny = (ty + 1) * T; p.vy = 0; p.cut = false;
      }
    }
    p.y = ny;

    // wall contact
    p.wallDir = 0;
    if (!p.onGround) {
      const t2 = Math.floor((p.y + 4) / T), b2 = Math.floor((p.y + PH - 4) / T);
      const lx = Math.floor((p.x - 1) / T), rx = Math.floor((p.x + PW + 0.5) / T);
      if (isSolid(tileAt(L, lx, t2)) || isSolid(tileAt(L, lx, b2))) p.wallDir = -1;
      else if (isSolid(tileAt(L, rx, t2)) || isSolid(tileAt(L, rx, b2))) p.wallDir = 1;
      if (p.wallDir) { p.lastWall = p.wallDir; p.wcoy = C.WCOY; }
    }

    // springs + spikes
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 0.01) / T);
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(L, tx, ty);
        if (c === ' ' || c === '#') continue;
        const ox = tx * T, oy = ty * T;
        if (c === 'J') {
          if (p.vy >= 0 && p.y + PH > oy + T / 2) {
            p.vy = -C.SPRING; p.cut = false; p.onGround = false; p.coyote = 0;
            emit(p, 'spring', tx, ty);
          }
        } else if (c === '^' || c === 'v' || c === '<' || c === '>') {
          let hx = ox + 6, hy = oy + 6, hw = T - 12, hh = T - 12;
          if (c === '^') { hy = oy + T / 2 + 2; hh = T / 2 - 2; }
          else if (c === 'v') { hy = oy; hh = T / 2 - 2; }
          else if (c === '>') { hx = ox; hw = T / 2 - 2; }
          else { hx = ox + T / 2 + 2; hw = T / 2 - 2; }
          if (p.x < hx + hw && p.x + PW > hx && p.y < hy + hh && p.y + PH > hy) { p.dead = true; emit(p, 'die'); }
        }
      }
    }
    if (p.y > L.h * T + 96) { p.dead = true; emit(p, 'die'); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
