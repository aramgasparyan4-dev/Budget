/* Neural Kick — canvas rendering. */
(function (g) {
  'use strict';
  const NK = g.NK, C = NK.C, T = C.T, PW = C.PW, PH = C.PH, S = NK.S, TAU = Math.PI * 2;
  const FONT = '"Chakra Petch", "Trebuchet MS", system-ui, sans-serif';

  const PALS = [
    { top: '#1c2452', bot: '#3b8089', glow: '#f6c177', far: '#1d2c58', near: '#162146', tile: '#11172f', tile2: '#1b2447', edge: '#7cf0c8' },
    { top: '#34164e', bot: '#c4576c', glow: '#ffd08a', far: '#47224f', near: '#2d143a', tile: '#1c102b', tile2: '#2b1941', edge: '#ffb86b' },
    { top: '#080d26', bot: '#25447f', glow: '#a9c9ff', far: '#14214b', near: '#0d1636', tile: '#090e22', tile2: '#151d3e', edge: '#6cb6ff' },
    { top: '#170d33', bot: '#55308a', glow: '#f0b8ff', far: '#27174d', near: '#1c103a', tile: '#130b27', tile2: '#221541', edge: '#d69bff' },
  ];

  function hash(a, b) {
    let n = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    n ^= n >>> 13; n = Math.imul(n, 0x27d4eb2f); n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  }
  const mod = (a, n) => ((a % n) + n) % n;

  function skyline(c, W, off, baseY, H, color, layer, scale, glow) {
    const cell = 58 * scale, i0 = Math.floor(off / cell) - 1, n = Math.ceil(W / cell) + 2;
    for (let i = i0; i < i0 + n; i++) {
      const bw = cell * (0.55 + hash(i, layer) * 0.4), bh = (50 + hash(i, layer + 7) * 150) * scale;
      const x = i * cell - off, y = baseY - bh;
      c.fillStyle = color; c.fillRect(x, y, bw, H - y);
      if (glow) {
        c.fillStyle = glow;
        const cols = Math.floor(bw / (9 * scale)), rws = Math.min(8, Math.floor(bh / (11 * scale)));
        for (let r = 1; r < rws; r++) for (let q = 1; q < cols; q++) {
          if (hash(i * 31 + q, r * 17 + layer) < 0.22) { c.globalAlpha = 0.25 + 0.3 * hash(q, i + r); c.fillRect(x + q * 9 * scale - 2, y + r * 11 * scale, 3 * scale, 4 * scale); }
        }
        c.globalAlpha = 1;
      }
    }
  }

  function backdrop(c, W, H, pal, z) {
    const L = S.L, cam = S.cam;
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.top); sky.addColorStop(1, pal.bot);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const x = mod(hash(i, 1) * W * 1.4 - cam.x * 0.04 * z, W), y = mod(hash(i, 2) * H - cam.y * 0.04 * z, H);
      c.globalAlpha = (0.2 + 0.5 * hash(i, 3)) * (0.6 + 0.4 * Math.sin(S.clock * (0.6 + hash(i, 4)) + i));
      const s = 1 + hash(i, 5) * 1.6; c.fillRect(x, y * 0.8, s, s);
    }
    c.globalAlpha = 1;
    const sx = W * 0.72 - cam.x * 0.02 * z, sy = H * 0.3 - cam.y * 0.02 * z;
    const sg = c.createRadialGradient(sx, sy, 4, sx, sy, Math.max(W, H) * 0.34);
    sg.addColorStop(0, pal.glow); sg.addColorStop(0.08, pal.glow + 'aa'); sg.addColorStop(0.1, pal.glow + '33'); sg.addColorStop(1, pal.glow + '00');
    c.fillStyle = sg; c.fillRect(0, 0, W, H);
    const sink = L ? (L.h * T - (cam.y + S.view.h)) * z : 0, base = H * 0.8;
    skyline(c, W, cam.x * 0.18 * z, base + sink * 0.1, H, pal.far, 1, Math.max(1, z * 0.8), null);
    skyline(c, W, cam.x * 0.38 * z + 400, base + 40 + sink * 0.2, H, pal.near, 2, Math.max(1.2, z), pal.glow);
  }

  function tiles(c, pal) {
    const L = S.L, cam = S.cam, v = S.view;
    const x0 = Math.floor(cam.x / T) - 1, x1 = Math.floor((cam.x + v.w) / T) + 1;
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.floor((cam.y + v.h) / T) + 1;
    const sol = (tx, ty) => NK.isSolid(NK.tileAt(L, tx, ty));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const x = tx * T, y = ty * T;
      if (tx < 0 || tx >= L.w || ty >= L.h) { c.fillStyle = pal.tile; c.fillRect(x, y, T + 0.5, T + 0.5); continue; }
      const ch = L.grid[ty][tx];
      if (ch === ' ') continue;
      if (ch === '#') {
        c.fillStyle = pal.tile; c.fillRect(x, y, T + 0.5, T + 0.5);
        const h = hash(tx, ty);
        if (h < 0.22) { c.fillStyle = pal.tile2; c.fillRect(x + 6 + h * 40, y + 8 + h * 50, 12, 3); c.fillRect(x + 6 + h * 40, y + 8 + h * 50, 3, 10); }
        else if (h > 0.9) { c.fillStyle = pal.tile2; c.fillRect(x + 12, y + 14, 5, 5); }
        c.fillStyle = pal.edge;
        if (!sol(tx, ty - 1)) { c.fillRect(x, y, T + 0.5, 5); c.globalAlpha = 0.45; c.fillStyle = '#ffffff'; c.fillRect(x, y, T + 0.5, 1.5); c.fillStyle = pal.edge; c.globalAlpha = 1; }
        c.globalAlpha = 0.5;
        if (!sol(tx - 1, ty)) c.fillRect(x, y, 2.5, T + 0.5);
        if (!sol(tx + 1, ty)) c.fillRect(x + T - 2.5, y, 2.5, T + 0.5);
        c.globalAlpha = 0.28;
        if (!sol(tx, ty + 1)) c.fillRect(x, y + T - 2.5, T + 0.5, 2.5);
        c.globalAlpha = 1;
      } else if (ch === '-') {
        c.fillStyle = pal.edge; c.fillRect(x, y, T + 0.5, 6);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + 6, T + 0.5, 3);
        c.fillStyle = pal.tile2; c.fillRect(x + 6, y + 9, 3, 5); c.fillRect(x + 23, y + 9, 3, 5);
      } else if (ch === 'J') {
        const s = S.springT[tx + ',' + ty], ext = s ? Math.sin((s / 0.3) * Math.PI) * 12 : 0, top = y + 15 - ext;
        c.fillStyle = '#c9cede'; c.fillRect(x + 13, top + 6, 6, y + T - 5 - top - 6);
        c.fillStyle = '#3a3f58'; c.fillRect(x + 4, y + T - 5, T - 8, 5);
        c.fillStyle = '#ffd75e'; c.fillRect(x + 3, top, T - 6, 7);
      } else if (ch === '^') {
        c.fillStyle = '#ff5d73'; c.beginPath();
        for (let i = 0; i < 2; i++) { const o = i * 16; c.moveTo(x + o, y + T); c.lineTo(x + o + 8, y + 13); c.lineTo(x + o + 16, y + T); }
        c.fill();
        c.fillStyle = '#ffd0d6'; c.fillRect(x + 7, y + 13, 2, 4); c.fillRect(x + 23, y + 13, 2, 4);
      }
    }
  }

  function pill(c, x, y, text, size, bold) {
    c.font = (bold ? '700 ' : '600 ') + size + 'px ' + FONT; c.textAlign = 'center';
    const w = c.measureText(text).width + 16;
    c.fillStyle = 'rgba(8,10,26,0.78)'; c.fillRect(x - w / 2, y - size - 3, w, size + 10);
    c.fillStyle = '#ffffff'; c.fillText(text, x, y);
    c.textAlign = 'start';
  }

  function promptText(it) {
    const r = S.run;
    if (it.kind === 'chest') return 'E  Open chest';
    if (it.kind === 'chip') return 'E  Install upgrade chip';
    if (it.kind === 'door') return S.boss && S.boss.hp > 0 ? 'Locked' : 'E  Next floor';
    const W = NK.WEAPONS[it.w.id], cur = W.slot === 'main' ? r.main : r.alt;
    return 'E  ' + NK.weaponName(it.w) + '  (' + (cur ? NK.weaponDmg(cur) + ' → ' : '') + NK.weaponDmg(it.w) + ' dmg)';
  }

  function things(c, pal) {
    const L = S.L, cam = S.cam, v = S.view, t = S.clock;
    const vis = (x, y) => x > cam.x - 80 && x < cam.x + v.w + 80 && y > cam.y - 100 && y < cam.y + v.h + 100;
    const D = L.door;
    if (D && vis(D.x, D.y)) { c.save(); c.translate(D.x, D.y); NK.drawDoor(c, !!(S.boss && S.boss.hp > 0), t, pal.edge); c.restore(); }
    for (const it of S.items) {
      if (!vis(it.x, it.y)) continue;
      c.save(); c.translate(it.x, it.y);
      if (it.kind === 'weapon') {
        const y = -20 + Math.sin(t * 3 + it.x) * 3, col = NK.WEAPONS[it.w.id].color;
        c.globalAlpha = 0.22; c.fillStyle = col; c.beginPath(); c.arc(0, y, 17, 0, TAU); c.fill(); c.globalAlpha = 1;
        c.translate(0, y); NK.drawWeaponIcon(c, it.w.id, 26);
      } else NK.drawItem(c, it.kind, t, it.open);
      c.restore();
    }
    for (const q of S.picks) { if (!vis(q.x, q.y)) continue; c.save(); c.translate(q.x, q.y + 5 + (q.still ? Math.sin(t * 3 + q.x) * 2 : 0)); NK.drawItem(c, q.kind, t); c.restore(); }
    for (const e of S.en) {
      const cx = e.x + e.w / 2, fy = e.y + e.h;
      if (!vis(cx, fy)) continue;
      if (e.elite) { c.globalAlpha = 0.2 + 0.1 * Math.sin(t * 6); c.fillStyle = '#ffd75e'; c.fillRect(e.x - 5, e.y - 5, e.w + 10, e.h + 10); c.globalAlpha = 1; }
      c.save(); c.translate(cx, fy + (e.fly ? Math.sin(e.t * 4) * 2 : 0)); NK.drawEnemy(c, e); c.restore();
      if (e.state === 'wind') { c.fillStyle = '#ffd75e'; c.fillRect(cx - 2, e.y - 24, 4, 10); c.fillRect(cx - 2, e.y - 12, 4, 4); }
      if (e.type !== 'boss' && (e.hp < e.maxhp || e.elite)) {
        const w = e.w + 10;
        c.fillStyle = 'rgba(8,10,26,0.8)'; c.fillRect(cx - w / 2 - 1, e.y - 10, w + 2, 5);
        c.fillStyle = e.elite ? '#ffd75e' : '#ff5d73'; c.fillRect(cx - w / 2, e.y - 9, w * Math.max(0, e.hp / e.maxhp), 3);
      }
    }
    for (const s of S.shots) {
      if (s.kind === 'bullet') { c.fillStyle = '#bfe0ff'; c.fillRect(s.x - 7, s.y - 1.5, 14, 3); c.globalAlpha = 0.4; c.fillRect(s.x - Math.sign(s.vx) * 16 - 7, s.y - 1, 14, 2); c.globalAlpha = 1; }
      else if (s.kind === 'bolt') { c.fillStyle = '#ff8a3d'; c.fillRect(s.x - 5, s.y - 5, 10, 10); c.fillStyle = '#ffe9a8'; c.fillRect(s.x - 2, s.y - 2, 4, 4); }
      else if (s.kind === 'bomb') { c.fillStyle = '#1b1410'; c.beginPath(); c.arc(s.x, s.y, 6, 0, TAU); c.fill(); c.fillStyle = Math.floor(t * 20) % 2 ? '#ffd75e' : '#ff5d73'; c.fillRect(s.x - 1, s.y - 10, 3, 4); }
      else { c.globalAlpha = Math.min(1, s.life * 3); c.fillStyle = '#ffffff'; c.fillRect(s.x - 6, s.y - 18, 12, 18); c.fillStyle = pal.edge; c.fillRect(s.x - 3, s.y - 26, 6, 26); c.globalAlpha = 1; }
    }
  }

  function hero(c) {
    const p = S.p, a = S.a, r = S.run;
    if (!p || S.state === 'dead') return;
    for (const tr of S.trail) { c.save(); c.globalAlpha = (tr.life / 0.18) * 0.3; c.translate(tr.x, tr.y); NK.drawHero(c, { anim: 'roll', rot: tr.rot, t: 0 }); c.restore(); }
    if (S.state === 'play' && a.iframes > 0 && p.roll <= 0 && Math.floor(S.clock * 20) % 2) return;
    const anim = p.roll > 0 ? 'roll' : !p.onGround ? 'air' : Math.abs(p.vx) > 30 ? 'run' : 'idle';
    const cx = p.x + PW / 2, fy = p.y + PH;
    c.save(); c.translate(cx, fy); c.scale(S.sqx, S.sqy);
    if (r && !a.atk && p.roll <= 0) { c.save(); c.translate(-p.facing * 7, -13); c.rotate(p.facing > 0 ? -2.2 : -0.95); c.fillStyle = NK.WEAPONS[r.main.id].color; c.fillRect(0, -1.2, 15, 2.6); c.restore(); }
    NK.drawHero(c, { face: p.sliding ? p.wallDir : p.facing, anim, t: S.clock, rot: S.rot, flash: a && a.iframes > 0.75 });
    c.restore();
    if (a && a.atk) { c.save(); c.translate(cx + p.facing * 4, p.y + PH / 2 - 2); NK.drawSwing(c, r.main.id, p.facing, Math.min(1, a.atk.t / a.atk.dur), a.atk.n, r.reach); c.restore(); }
    if (p.dive) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(cx - 9, p.y - 22, 3, 18); c.fillRect(cx + 6, p.y - 16, 3, 14); }
  }

  NK.render = function (c, W, H, dpr) {
    const z = Math.min(W / (13 * T), H / (14.5 * T));
    S.view.w = W / z; S.view.h = H / z; S.view.z = z;
    const pal = PALS[S.L ? S.L.pal : 0];
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(c, W, H, pal, z);
    if (!S.L) return;
    const sh = S.shake;
    c.save(); c.scale(z, z);
    c.translate(-S.cam.x + (sh ? (Math.random() - 0.5) * sh : 0), -S.cam.y + (sh ? (Math.random() - 0.5) * sh : 0));
    tiles(c, pal); things(c, pal); hero(c);
    for (const q of S.parts) { c.globalAlpha = Math.max(0, q.life / q.max); c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    c.globalAlpha = 1; c.textAlign = 'center'; c.lineJoin = 'round';
    for (const n of S.nums) {
      c.globalAlpha = Math.min(1, (0.7 - n.t) * 4); c.font = '700 ' + (n.big ? 17 : 13) + 'px ' + FONT;
      const y = n.y - n.t * 46;
      c.lineWidth = 3; c.strokeStyle = 'rgba(8,10,26,0.9)'; c.strokeText(n.text, n.x, y);
      c.fillStyle = n.color; c.fillText(n.text, n.x, y);
    }
    c.globalAlpha = 1; c.textAlign = 'start';
    if (S.near && S.state === 'play') pill(c, S.near.x, S.near.y - (S.near.kind === 'door' ? 70 : 46), promptText(S.near), 12, false);
    c.restore();
    if (S.run && S.state === 'play' && S.run.hp < S.run.maxhp * 0.3) {
      c.globalAlpha = 0.16 + 0.1 * Math.sin(S.clock * 6); c.strokeStyle = '#ff2d4a'; c.lineWidth = 36; c.strokeRect(0, 0, W, H); c.globalAlpha = 1;
    }
    if (S.msg) { c.globalAlpha = Math.min(1, S.msg.t * 2); pill(c, W / 2, 86, S.msg.text, 15, true); c.globalAlpha = 1; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
