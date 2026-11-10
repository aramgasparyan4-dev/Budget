/* Neural Kick — core: constants, level building, body physics.
   No DOM access here, so the level solver can run it under Node. */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});
  const T = 32;
  const C = (NK.C = {
    T,
    G: 2200, MAXFALL: 900,
    RUN: 250, ACC_G: 2600, ACC_A: 1600, FRIC_G: 2800, FRIC_A: 300,
    JUMP: 760, CUT: 300,
    SLIDE: 110, WJX: 330, WJY: 720, LOCK: 0.18,
    SPRING: 1150, ROLL: 470, ROLLT: 0.3, DIVE: 840,
    COYOTE: 0.09, JBUF: 0.12, WCOY: 0.1,
    PW: 22, PH: 22, DT: 1 / 120,
  });
  const PW = C.PW, PH = C.PH;

  const isSolid = (c) => c === '#';
  NK.isSolid = isSolid;
  function tileAt(L, tx, ty) {
    if (ty < 0 || ty >= L.h) return ty < 0 ? ' ' : '#';
    if (tx < 0 || tx >= L.w) return '#';
    return L.grid[ty][tx];
  }
  NK.tileAt = tileAt;

  /* A level is a row of chunks (small ASCII pictures), bottom aligned.
     `rise` shifts the baseline for every chunk after it. */
  NK.buildLevel = function (def) {
    let x = 0, elev = 0, minE = 0, maxTop = 0;
    const placed = [];
    for (const ch of def.chunks) {
      const w = Math.max.apply(null, ch.rows.map((r) => r.length));
      placed.push({ rows: ch.rows, w, x, elev, tag: ch.tag });
      minE = Math.min(minE, elev);
      maxTop = Math.max(maxTop, elev + ch.rows.length);
      x += w; elev += ch.rise || 0;
      minE = Math.min(minE, elev);
    }
    const W = x, H = maxTop - minE + 9;
    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill(' '));
    const L = { name: def.name, pal: def.pal || 0, w: W, h: H, grid, spawns: [], start: { x: T, y: T }, door: null, arena: null };
    for (const p of placed) {
      const n = p.rows.length, by = H - 1 - (p.elev - minE);
      for (let i = 0; i < n; i++) {
        const row = p.rows[i], gy = by - (n - 1 - i);
        for (let cx = 0; cx < p.w; cx++) grid[gy][p.x + cx] = row[cx] || ' ';
      }
      const last = p.rows[n - 1];
      for (let cx = 0; cx < p.w; cx++) if (last[cx] === '#') for (let gy = by + 1; gy < H; gy++) grid[gy][p.x + cx] = '#';
      if (p.tag === 'boss') L.arena = { x0: (p.x + 1) * T, x1: (p.x + p.w - 1) * T };
    }
    // pull markers out, leaving terrain only
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      const c = grid[y][x2];
      if (c === '#' || c === ' ' || c === '-' || c === '^' || c === 'J') continue;
      grid[y][x2] = ' ';
      const cx = x2 * T + T / 2, fy = y * T + T; // centre x, floor y of the cell
      if (c === 'P') L.start = { x: cx - PW / 2, y: fy - PH };
      else if (c === 'D') L.door = { x: cx, y: fy };
      else L.spawns.push({ c, x: cx, y: fy });
    }
    return L;
  };

  /* ---------- player body ---------- */
  NK.newPlayer = function (x, y) {
    return {
      x, y, vx: 0, vy: 0, onGround: false, onPlat: false, wallDir: 0, lastWall: 0, sliding: false,
      coyote: 0, jbuf: 0, wcoy: 0, lock: 0, cut: false, facing: 1,
      roll: 0, rollDir: 1, dive: false, dropT: 0, spd: 1, slow: 1, airJumps: 0, jumpsLeft: 0,
      spiked: false, fell: false, ev: null,
    };
  };
  function emit(p, type, a, b) { if (p.ev) p.ev.push([type, a, b]); }

  /* One fixed step. inp = {left, right, down, jump (held), jumpPressed (edge)}. */
  NK.stepPlayer = function (p, inp, dt, L) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    p.coyote -= dt; p.jbuf -= dt; p.wcoy -= dt; p.lock -= dt; p.dropT -= dt;
    p.spiked = false;
    if (inp.jumpPressed) p.jbuf = C.JBUF;
    const run = C.RUN * p.spd * p.slow;

    if (p.roll > 0) {
      p.roll -= dt;
      p.vx = p.rollDir * C.ROLL;
      p.vy = Math.min(C.MAXFALL, p.vy + C.G * dt * (p.onGround ? 1 : 0.3));
      p.sliding = false;
      if (p.roll <= 0) p.vx = p.rollDir * run * 0.7;
    } else {
      const locked = p.lock > 0;
      if (dir) {
        if (!p.faceLock) p.facing = dir;
        const acc = (p.onGround ? C.ACC_G : C.ACC_A) * (locked ? 0.15 : 1) * dt;
        if (p.vx * dir < run) p.vx = dir > 0 ? Math.min(run, p.vx + acc) : Math.max(-run, p.vx - acc);
      } else if (!locked) {
        const fr = (p.onGround ? C.FRIC_G : C.FRIC_A) * dt;
        p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
      }
      if (p.onGround && Math.abs(p.vx) > run) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - run, 1400 * dt);

      p.vy += C.G * dt;
      if (p.dive) { p.vx *= Math.max(0, 1 - 8 * dt); p.vy = Math.max(p.vy, C.DIVE); }
      p.sliding = !p.onGround && !p.dive && p.wallDir !== 0 && p.vy > 0;
      p.vy = Math.min(p.vy, p.sliding ? C.SLIDE : C.MAXFALL);

      if (p.jbuf > 0) {
        if (inp.down && p.onGround && p.onPlat) {
          p.dropT = 0.2; p.jbuf = 0; p.onGround = false; p.coyote = 0;
        } else if (p.onGround || p.coyote > 0) {
          p.vy = -C.JUMP; p.cut = true; p.jbuf = 0; p.coyote = 0; p.onGround = false; emit(p, 'jump');
        } else if (p.wallDir || p.wcoy > 0) {
          const wd = p.wallDir || p.lastWall;
          p.vx = -wd * C.WJX; p.vy = -C.WJY; p.lock = C.LOCK; p.cut = false;
          p.jbuf = 0; p.wcoy = 0; p.facing = -wd; p.sliding = false; p.dive = false;
          emit(p, 'kick', wd);
        } else if (p.jumpsLeft > 0) {
          p.jumpsLeft--; p.vy = -C.JUMP * 0.9; p.cut = true; p.jbuf = 0; p.dive = false; emit(p, 'jump2');
        }
      }
      if (p.cut && !inp.jump && p.vy < -C.CUT) p.vy = -C.CUT;
      if (p.vy >= 0) p.cut = false;
    }

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
      let hit = false, plat = true;
      for (let tx = l; tx <= r; tx++) {
        const c = tileAt(L, tx, ty);
        if (isSolid(c)) { hit = true; plat = false; }
        else if (c === '-' && p.dropT <= 0 && prevBottom <= ty * T + 0.01) hit = true;
      }
      if (hit) {
        ny = ty * T - PH;
        if (p.dive) { p.dive = false; emit(p, 'slam'); }
        else if (!wasGround && p.vy > 260) emit(p, 'land', p.vy);
        p.vy = 0; p.onGround = true; p.onPlat = plat; p.coyote = C.COYOTE; p.jumpsLeft = p.airJumps;
      }
    } else if (p.vy < 0) {
      const ty = Math.floor(ny / T);
      for (let tx = l; tx <= r; tx++) if (isSolid(tileAt(L, tx, ty))) { ny = (ty + 1) * T; p.vy = 0; p.cut = false; break; }
    }
    p.y = ny;

    // wall contact
    p.wallDir = 0;
    if (!p.onGround) {
      const t2 = Math.floor((p.y + 4) / T), b2 = Math.floor((p.y + PH - 4) / T);
      const lx = Math.floor((p.x - 1) / T), rx = Math.floor((p.x + PW + 0.5) / T);
      if (isSolid(tileAt(L, lx, t2)) || isSolid(tileAt(L, lx, b2))) p.wallDir = -1;
      else if (isSolid(tileAt(L, rx, t2)) || isSolid(tileAt(L, rx, b2))) p.wallDir = 1;
      if (p.wallDir) { p.lastWall = p.wallDir; p.wcoy = C.WCOY; p.jumpsLeft = p.airJumps; }
    }

    // springs + spikes
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 0.01) / T);
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = tileAt(L, tx, ty);
      if (c === 'J') {
        if (p.vy >= 0 && p.y + PH > ty * T + T / 2) {
          p.vy = -C.SPRING; p.cut = false; p.onGround = false; p.coyote = 0; p.dive = false;
          emit(p, 'spring', tx, ty);
        }
      } else if (c === '^') {
        const hx = tx * T + 6, hy = ty * T + T / 2 + 2;
        if (p.x < hx + T - 12 && p.x + PW > hx && p.y + PH > hy) p.spiked = true;
      }
    }
  };

  /* ---------- generic box for enemies and loot (top-left x,y; w,h; vx,vy) ---------- */
  NK.moveBox = function (b, dt, L) {
    let nx = b.x + b.vx * dt;
    b.wall = 0;
    const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
    if (b.vx > 0) {
      const tx = Math.floor((nx + b.w) / T);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(L, tx, ty))) { nx = tx * T - b.w; b.wall = 1; break; }
    } else if (b.vx < 0) {
      const tx = Math.floor(nx / T);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(L, tx, ty))) { nx = (tx + 1) * T; b.wall = -1; break; }
    }
    b.x = nx;
    const prevB = b.y + b.h;
    let ny = b.y + b.vy * dt;
    const l = Math.floor(b.x / T), r = Math.floor((b.x + b.w - 0.01) / T);
    b.onGround = false;
    if (b.vy > 0) {
      const ty = Math.floor((ny + b.h) / T);
      for (let tx = l; tx <= r; tx++) {
        const c = tileAt(L, tx, ty);
        if (isSolid(c) || (c === '-' && prevB <= ty * T + 0.01)) { ny = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
      }
    } else if (b.vy < 0) {
      const ty = Math.floor(ny / T);
      for (let tx = l; tx <= r; tx++) if (isSolid(tileAt(L, tx, ty))) { ny = (ty + 1) * T; b.vy = 0; break; }
    }
    b.y = ny;
  };

  /* Is there floor under the point (x, footY)? Spikes do not count. */
  NK.floorAt = function (L, x, footY) {
    const c = tileAt(L, Math.floor(x / T), Math.floor((footY + 4) / T));
    const here = tileAt(L, Math.floor(x / T), Math.floor((footY - 4) / T));
    return (isSolid(c) || c === '-') && here !== '^';
  };
  NK.solidAtPx = (L, x, y) => isSolid(tileAt(L, Math.floor(x / T), Math.floor(y / T)));
})(typeof globalThis !== 'undefined' ? globalThis : this);
