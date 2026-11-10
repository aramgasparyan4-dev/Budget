/* Neural Kick — canvas rendering. */
(function (g) {
  'use strict';
  const NK = g.NK, C = NK.C, T = C.T, PW = C.PW, PH = C.PH, S = NK.S, TAU = Math.PI * 2;

  const PALS = [
    { top: '#1c2452', bot: '#3b8089', glow: '#f6c177', far: '#1d2c58', near: '#162146', tile: '#11172f', tile2: '#1b2447', edge: '#7cf0c8' },
    { top: '#34164e', bot: '#c4576c', glow: '#ffd08a', far: '#47224f', near: '#2d143a', tile: '#1c102b', tile2: '#2b1941', edge: '#ffb86b' },
    { top: '#080d26', bot: '#25447f', glow: '#a9c9ff', far: '#14214b', near: '#0d1636', tile: '#090e22', tile2: '#151d3e', edge: '#6cb6ff' },
    { top: '#170d33', bot: '#55308a', glow: '#f0b8ff', far: '#27174d', near: '#1c103a', tile: '#130b27', tile2: '#221541', edge: '#d69bff' },
  ];
  NK.PALS = PALS;

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
      c.fillStyle = color;
      c.fillRect(x, y, bw, H - y);
      if (glow) {
        c.fillStyle = glow;
        const cols = Math.floor(bw / (9 * scale)), rws = Math.min(8, Math.floor(bh / (11 * scale)));
        for (let r = 1; r < rws; r++) for (let q = 1; q < cols; q++) {
          if (hash(i * 31 + q, r * 17 + layer) < 0.22) {
            c.globalAlpha = 0.25 + 0.3 * hash(q, i + r);
            c.fillRect(x + q * 9 * scale - 2, y + r * 11 * scale, 3 * scale, 4 * scale);
          }
        }
        c.globalAlpha = 1;
      }
    }
  }

  function drawBackdrop(c, W, H, pal, z) {
    const L = S.L, cam = S.cam;
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.top); sky.addColorStop(1, pal.bot);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // stars
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 46; i++) {
      const x = mod(hash(i, 1) * W * 1.4 - cam.x * 0.04 * z, W), y = mod(hash(i, 2) * H - cam.y * 0.04 * z, H);
      c.globalAlpha = (0.2 + 0.5 * hash(i, 3)) * (0.6 + 0.4 * Math.sin(S.clock * (0.6 + hash(i, 4)) + i));
      const s = 1 + hash(i, 5) * 1.6;
      c.fillRect(x, y * 0.8, s, s);
    }
    c.globalAlpha = 1;
    // low sun / moon
    const sx = W * 0.72 - cam.x * 0.02 * z, sy = H * 0.3 - cam.y * 0.02 * z;
    const sg = c.createRadialGradient(sx, sy, 4, sx, sy, Math.max(W, H) * 0.34);
    sg.addColorStop(0, pal.glow); sg.addColorStop(0.08, pal.glow + 'aa'); sg.addColorStop(0.1, pal.glow + '33'); sg.addColorStop(1, pal.glow + '00');
    c.fillStyle = sg; c.fillRect(0, 0, W, H);
    // server-rack skyline, two layers
    let sink = 0;
    if (L) sink = (L.h * T - (cam.y + S.view.h)) * z;
    const base = H * 0.8;
    skyline(c, W, cam.x * 0.18 * z, base + sink * 0.1, H, pal.far, 1, Math.max(1, z * 0.8), null);
    skyline(c, W, cam.x * 0.38 * z + 400, base + 40 + sink * 0.2, H, pal.near, 2, Math.max(1.2, z), pal.glow);
  }

  function spikes(c, x, y, ch) {
    c.fillStyle = '#ff5d73';
    c.beginPath();
    for (let i = 0; i < 2; i++) {
      const o = i * 16;
      if (ch === '^') { c.moveTo(x + o, y + T); c.lineTo(x + o + 8, y + 13); c.lineTo(x + o + 16, y + T); }
      else if (ch === 'v') { c.moveTo(x + o, y); c.lineTo(x + o + 8, y + 19); c.lineTo(x + o + 16, y); }
      else if (ch === '>') { c.moveTo(x, y + o); c.lineTo(x + 19, y + o + 8); c.lineTo(x, y + o + 16); }
      else { c.moveTo(x + T, y + o); c.lineTo(x + 13, y + o + 8); c.lineTo(x + T, y + o + 16); }
    }
    c.fill();
    c.fillStyle = '#ffd0d6';
    for (let i = 0; i < 2; i++) {
      const o = i * 16;
      if (ch === '^') c.fillRect(x + o + 7, y + 13, 2, 4);
      else if (ch === 'v') c.fillRect(x + o + 7, y + 15, 2, 4);
      else if (ch === '>') c.fillRect(x + 15, y + o + 7, 4, 2);
      else c.fillRect(x + 13, y + o + 7, 4, 2);
    }
  }

  function drawTiles(c, pal) {
    const L = S.L, cam = S.cam, v = S.view;
    const x0 = Math.floor(cam.x / T) - 1, x1 = Math.floor((cam.x + v.w) / T) + 1;
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.floor((cam.y + v.h) / T) + 1;
    const sol = (tx, ty) => NK.isSolid(NK.tileAt(L, tx, ty));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const x = tx * T, y = ty * T;
        if (tx < 0 || tx >= L.w || (ty >= L.h && L.grid[L.h - 1][tx] === '#')) { c.fillStyle = pal.tile; c.fillRect(x, y, T + 0.5, T + 0.5); continue; }
        if (ty >= L.h) continue;
        const ch = L.grid[ty][tx];
        if (ch === ' ') continue;
        if (ch === '#') {
          c.fillStyle = pal.tile; c.fillRect(x, y, T + 0.5, T + 0.5);
          const hsh = hash(tx, ty);
          if (hsh < 0.22) { c.fillStyle = pal.tile2; c.fillRect(x + 6 + hsh * 40, y + 8 + hsh * 50, 12, 3); c.fillRect(x + 6 + hsh * 40, y + 8 + hsh * 50, 3, 10); }
          else if (hsh > 0.9) { c.fillStyle = pal.tile2; c.fillRect(x + 12, y + 14, 5, 5); }
          c.fillStyle = pal.edge;
          if (!sol(tx, ty - 1)) { c.fillRect(x, y, T + 0.5, 5); c.globalAlpha = 0.45; c.fillStyle = '#ffffff'; c.fillRect(x, y, T + 0.5, 1.5); c.fillStyle = pal.edge; c.globalAlpha = 1; }
          c.globalAlpha = 0.5;
          if (!sol(tx - 1, ty)) c.fillRect(x, y, 2.5, T + 0.5);
          if (!sol(tx + 1, ty)) c.fillRect(x + T - 2.5, y, 2.5, T + 0.5);
          c.globalAlpha = 0.28;
          if (!sol(tx, ty + 1) && ty + 1 < L.h) c.fillRect(x, y + T - 2.5, T + 0.5, 2.5);
          c.globalAlpha = 1;
        } else if (ch === '?' || ch === 'U') {
          const b = S.bump[tx + ',' + ty], by = y - (b ? Math.sin((b / 0.2) * Math.PI) * 8 : 0);
          NK.roundRect(c, x + 1, by + 1, T - 2, T - 2, 6);
          c.fillStyle = ch === '?' ? '#f5b83d' : '#514a63'; c.fill();
          c.lineWidth = 2; c.strokeStyle = ch === '?' ? '#a96a0c' : '#322d40'; c.stroke();
          if (ch === '?') {
            c.fillStyle = '#fff6d8';
            c.beginPath(); c.moveTo(x + 16, by + 7); c.lineTo(x + 24, by + 16); c.lineTo(x + 16, by + 25); c.lineTo(x + 8, by + 16); c.closePath(); c.fill();
            c.fillStyle = '#f5b83d'; c.fillRect(x + 14.5, by + 11, 3, 10);
          }
        } else if (ch === '-') {
          c.fillStyle = pal.edge; c.fillRect(x, y, T + 0.5, 6);
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + 6, T + 0.5, 3);
          c.fillStyle = pal.tile2; c.fillRect(x + 6, y + 9, 3, 5); c.fillRect(x + 23, y + 9, 3, 5);
        } else if (ch === 'J') {
          const s = S.springT[tx + ',' + ty], ext = s ? Math.sin((s / 0.3) * Math.PI) * 12 : 0;
          const top = y + 15 - ext;
          c.strokeStyle = '#c9cede'; c.lineWidth = 2.5; c.beginPath();
          c.moveTo(x + 9, y + T - 4);
          for (let i = 1; i <= 4; i++) c.lineTo(x + (i % 2 ? 23 : 9), y + T - 4 - ((y + T - 4 - top - 5) * i) / 4);
          c.stroke();
          c.fillStyle = '#3a3f58'; c.fillRect(x + 4, y + T - 5, T - 8, 5);
          NK.roundRect(c, x + 3, top, T - 6, 7, 3); c.fillStyle = '#ffd75e'; c.fill();
        } else spikes(c, x, y, ch);
      }
    }
  }

  function drawThings(c, pal) {
    const L = S.L, cam = S.cam, v = S.view, t = S.clock;
    const vis = (x, y) => x > cam.x - 60 && x < cam.x + v.w + 60 && y > cam.y - 80 && y < cam.y + v.h + 80;
    // hint signs
    c.font = '600 12px "Chakra Petch", system-ui, sans-serif'; c.textAlign = 'center';
    for (const sg of L.signs) {
      if (!vis(sg.x, sg.y)) continue;
      const lines = sg.text.split('\n');
      let w = 0; for (const ln of lines) w = Math.max(w, c.measureText(ln).width);
      NK.roundRect(c, sg.x - w / 2 - 9, sg.y - 15, w + 18, lines.length * 16 + 10, 8);
      c.fillStyle = 'rgba(8,10,26,0.55)'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.92)';
      lines.forEach((ln, i) => c.fillText(ln, sg.x, sg.y + i * 16));
    }
    c.textAlign = 'start';
    // checkpoints
    for (const k of L.checks) {
      if (!vis(k.x, k.y)) continue;
      c.fillStyle = '#c9cede'; c.fillRect(k.x - 1.5, k.y - 56, 3, 56);
      c.fillStyle = k.on ? '#7cf0c8' : '#8a8fa8';
      const w = Math.sin(t * 5 + k.x) * 3;
      c.beginPath(); c.moveTo(k.x + 1.5, k.y - 56); c.lineTo(k.x + 26, k.y - 47 + w); c.lineTo(k.x + 1.5, k.y - 38); c.closePath(); c.fill();
      c.fillStyle = '#3a3f58'; c.fillRect(k.x - 7, k.y - 4, 14, 4);
    }
    // goal portal
    const G = L.goal;
    if (G && vis(G.x, G.y)) {
      const rg = c.createRadialGradient(G.x, G.y, 2, G.x, G.y, 34);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, pal.edge); rg.addColorStop(1, pal.edge + '00');
      c.fillStyle = rg; c.beginPath(); c.arc(G.x, G.y, 34, 0, TAU); c.fill();
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = i === 1 ? '#ffffff' : pal.edge; c.lineWidth = 3;
        const a = t * (1.6 + i * 0.9) * (i % 2 ? -1 : 1);
        c.beginPath(); c.arc(G.x, G.y, 14 + i * 6, a, a + 3.6); c.stroke();
      }
    }
    // tokens
    for (const k of L.coins) {
      if (k.got || !vis(k.x, k.y)) continue;
      const y = k.y + Math.sin(t * 3 + k.x * 0.05) * 3, w = Math.abs(Math.cos(t * 3.2 + k.x * 0.02));
      c.fillStyle = '#ffd75e'; c.beginPath(); c.ellipse(k.x, y, 2.5 + 7 * w, 9.5, 0, 0, TAU); c.fill();
      c.strokeStyle = '#b07a12'; c.lineWidth = 1.5; c.stroke();
      if (w > 0.45) { c.fillStyle = '#fff6d8'; c.fillRect(k.x - 1.2, y - 5, 2.4, 10); }
    }
    for (const q of S.pops) {
      c.globalAlpha = 1 - q.t / 0.5; c.fillStyle = '#ffd75e';
      c.beginPath(); c.ellipse(q.x, q.y - q.t * 110, 8, 9.5, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
    // enemies
    for (const e of S.en) {
      if (!vis(e.x, e.y)) continue;
      c.save(); c.translate(e.x, e.y + e.h / 2);
      if (e.dead > 0) { c.scale(1 + e.dead * 1.5, Math.max(0.1, 1 - e.dead * 3.2)); c.globalAlpha = Math.max(0, 1 - e.dead * 2.6); }
      if (e.type === 'E') {
        const dir = Math.sign(e.vx) || 1, wob = Math.sin(e.t * 16) * 2.5;
        c.strokeStyle = '#2a1016'; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath();
        for (let i = -1; i <= 1; i++) { c.moveTo(i * 7, -5); c.lineTo(i * 7 + (i === 0 ? -wob : wob), 0); }
        c.stroke();
        c.fillStyle = '#e5484d'; c.beginPath(); c.ellipse(0, -11, 13, 9.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#9b2226'; c.beginPath(); c.ellipse(-dir * 3, -13, 8, 5.5, 0, Math.PI, TAU); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(dir * 5, -12, 3.6, 0, TAU); c.arc(dir * 11, -11, 3, 0, TAU); c.fill();
        c.fillStyle = '#1a0a0d'; c.beginPath(); c.arc(dir * 6, -12, 1.6, 0, TAU); c.arc(dir * 12, -11, 1.4, 0, TAU); c.fill();
      } else {
        c.fillStyle = 'rgba(216,200,255,0.93)'; c.beginPath();
        c.arc(0, -12, 12, Math.PI, 0);
        const w = Math.sin(e.t * 7) * 1.5;
        c.lineTo(12, 0); c.lineTo(8, -4 + w); c.lineTo(4, 0); c.lineTo(0, -4 - w); c.lineTo(-4, 0); c.lineTo(-8, -4 + w); c.lineTo(-12, 0);
        c.closePath(); c.fill();
        c.fillStyle = '#2b1d52'; c.beginPath(); c.ellipse(-4.5, -12, 2.4, 3.4, 0, 0, TAU); c.ellipse(4.5, -12, 2.4, 3.4, 0, 0, TAU); c.fill();
      }
      c.restore();
    }
  }

  function drawPlayer(c) {
    const p = S.p, spr = NK.skinSprite(S.skin), SZ = 28;
    if (!p || S.state === 'dead' || S.state === 'over') return;
    for (const tr of S.trail) {
      c.save(); c.globalAlpha = (tr.life / 0.22) * 0.35; c.translate(tr.x, tr.y); c.rotate(tr.rot);
      c.drawImage(spr, -SZ / 2, -SZ / 2, SZ, SZ); c.restore();
    }
    let cx = p.x + PW / 2, fy = p.y + PH, k = 1, rot = S.rot, bob = 0;
    if (S.state === 'win' && S.L.goal) {
      const u = Math.min(1, S.winT * 1.6);
      cx += (S.L.goal.x - cx) * u; fy += (S.L.goal.y + PH / 2 - fy) * u; k = 1 - u * 0.9; rot = S.winT * 14;
    } else if (S.state === 'menu') bob = Math.abs(Math.sin(S.clock * 3)) * 5;
    else if (p.onGround && Math.abs(p.vx) > 40) bob = Math.abs(Math.sin(S.clock * 18)) * 2.5;
    c.save();
    c.translate(cx, fy - bob);
    c.scale(S.sqx * k, S.sqy * k);
    c.translate(0, -PH / 2 - 1);
    c.rotate(rot);
    c.drawImage(spr, -SZ / 2, -SZ / 2, SZ, SZ);
    c.restore();
  }

  NK.render = function (c, W, H, dpr) {
    const z = Math.min(W / (12.5 * T), H / (12.5 * T));
    S.view.w = W / z; S.view.h = H / z; S.view.z = z;
    const pal = PALS[S.L ? S.L.pal : 0];
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackdrop(c, W, H, pal, z);
    if (!S.L) return;
    const sh = S.shake;
    c.save();
    c.scale(z, z);
    c.translate(-S.cam.x + (sh ? (Math.random() - 0.5) * sh : 0), -S.cam.y + (sh ? (Math.random() - 0.5) * sh : 0));
    if (S.L.mode === 'tower' && S.bestH > 0) {
      const by = S.baseY - S.bestH * T;
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.5; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(T, by); c.lineTo((S.L.w - 1) * T, by); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = '700 11px "Chakra Petch", system-ui, sans-serif';
      c.fillText('BEST ' + S.bestH + ' m', T + 6, by - 5);
    }
    drawTiles(c, pal);
    drawThings(c, pal);
    drawPlayer(c);
    for (const q of S.parts) {
      c.globalAlpha = Math.max(0, q.life / q.max); c.fillStyle = q.color;
      c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
    c.restore();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
