/* Sundown Protocol — canvas rendering: sky, terrain, town, actors, night lighting, aim UI. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;
  const FONT = '"Chakra Petch", "Trebuchet MS", system-ui, sans-serif';
  const cam = (SD.cam = { x: 1300, y: -300, z: 1, w: 960, h: 540 });

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
  const SKY = [[0, '#0b1026', '#1d2346'], [5, '#0b1026', '#1d2346'], [6.3, '#3b4a7a', '#f0a77a'], [8, '#5aa3d8', '#f3d9a4'], [17, '#5aa3d8', '#f3d9a4'],
    [19, '#4a3a6a', '#ff9a5a'], [20.5, '#1e1d44', '#7a4a6a'], [22, '#0b1026', '#1d2346'], [24, '#0b1026', '#1d2346']];
  function sky(h) {
    for (let i = 1; i < SKY.length; i++) if (h <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i], t = (h - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
    return [SKY[0][1], SKY[0][2]];
  }
  SD.darkness = (h) => (h >= 21 || h < 5 ? 0.62 : h >= 19 ? (h - 19) / 2 * 0.62 : h < 7 ? (7 - h) / 2 * 0.62 : 0);
  const night = (h) => SD.darkness(h) > 0.3;

  function hash(a, b) { let n = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35); n ^= n >>> 13; n = Math.imul(n, 0x27d4eb2f); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
  const TOPS = { rail: ['#b98f5f', '#8f6a45'], town: ['#b98f5f', '#8f6a45'], plains: ['#d1ad72', '#a8804e'], gulch: ['#c47a4a', '#93573a'], river: ['#7f8f4c', '#6a5a3e'], mine: ['#8f806e', '#6a5d50'] };
  const surf = (x) => { const B = SD.BRIDGE; if (x < B.x0 - 30 || x > B.x1 + 30) return SD.ground(x); const k = x < B.x0 ? (x - B.x0 + 30) / 30 : x > B.x1 ? (B.x1 + 30 - x) / 30 : 1; return SD.ground(x) + 70 * Math.max(0, Math.min(1, k)); };

  function backdrop(c, W, H, z, hour) {
    const [top, bot] = sky(hour), dk = SD.darkness(hour);
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    if (dk > 0.05) { c.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { c.globalAlpha = dk * (0.4 + 0.6 * hash(i, 9)); c.fillRect(hash(i, 1) * W, hash(i, 2) * H * 0.6, 1.5, 1.5); } c.globalAlpha = 1; }
    const day = hour >= 6 && hour < 19.5, k = day ? (hour - 6) / 13.5 : ((hour + 4.5) % 24) / 10.5;
    const bx = W * (0.1 + 0.8 * k), by = H * (0.62 - 0.5 * Math.sin(Math.PI * Math.max(0, Math.min(1, k))));
    if (day) { const sg = c.createRadialGradient(bx, by, 4, bx, by, 120); sg.addColorStop(0, '#fff6d8'); sg.addColorStop(0.18, '#ffe7a6'); sg.addColorStop(0.2, 'rgba(255,220,150,0.35)'); sg.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H); }
    else { c.fillStyle = '#e9ecf5'; c.beginPath(); c.arc(bx, by, 16, 0, TAU); c.fill(); c.fillStyle = top; c.beginPath(); c.arc(bx + 6, by - 3, 14, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,' + (0.5 - dk * 0.6) + ')';
    for (let i = 0; i < 6; i++) { const x = ((hash(i, 3) * W * 2 - cam.x * 0.05 * z + SD.G.time * 6) % (W + 300) + W + 300) % (W + 300) - 150, y = H * (0.08 + hash(i, 4) * 0.25); c.beginPath(); c.ellipse(x, y, 60 + hash(i, 5) * 50, 9, 0, 0, TAU); c.fill(); }
    const horizon = (SD.ground(cam.x) - cam.y) * z;
    for (const [par, col, amp, base, seed] of [[0.1, mix(bot, '#7a4a3a', 0.45), 120, 30, 1], [0.25, mix(bot, '#6a3a2a', 0.65), 80, 10, 2]]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      const off = cam.x * par * z, cell = 140 * z;
      for (let sx = -cell; sx <= W + cell; sx += cell / 4) {
        const wx = (sx + off) / cell, i = Math.floor(wx), f = wx - i;
        const hgt = (n) => (hash(n, seed) > 0.55 ? amp * (0.6 + hash(n, seed + 3) * 0.6) : amp * 0.25 * hash(n, seed + 5));
        const mesa = f < 0.15 ? hgt(i - 1) + (hgt(i) - hgt(i - 1)) * (f / 0.15) : hgt(i);
        c.lineTo(sx, horizon - base * z - mesa * z * 0.9);
      }
      c.lineTo(W, H); c.fill();
    }
    if (dk > 0) { c.fillStyle = 'rgba(8,10,30,' + dk * 0.55 + ')'; c.fillRect(0, 0, W, H); }
  }

  function terrain(c) {
    const x0 = Math.floor(cam.x / 8) * 8 - 8, x1 = cam.x + cam.w + 16, yb = cam.y + cam.h + 40;
    for (const r of SD.REGIONS) {
      const a = Math.max(x0, r.x0), b = Math.min(x1, r.x1);
      if (a >= b) continue;
      const [top, body] = TOPS[r.id];
      c.fillStyle = body; c.beginPath(); c.moveTo(a, yb);
      for (let x = a; x <= b + 8; x += 8) c.lineTo(x, surf(Math.min(x, b)));
      c.lineTo(b, yb); c.fill();
      c.fillStyle = top;
      for (let x = a; x < b; x += 8) { const y = surf(x); c.fillRect(x, y, 8.5, 6); }
      c.fillStyle = 'rgba(0,0,0,0.08)';
      for (let x = a; x < b; x += 8) { const y = surf(x); c.fillRect(x, y + 18 + hash(x, 1) * 4, 8.5, 3); c.fillRect(x, y + 46 + hash(x, 2) * 6, 8.5, 3); }
    }
    const B = SD.BRIDGE;
    if (B.x1 + 40 > cam.x && B.x0 - 40 < cam.x + cam.w) {
      const gy = SD.ground(B.x0);
      c.fillStyle = '#3f6f8f'; c.fillRect(B.x0 - 30, gy + 26, B.x1 - B.x0 + 60, 44);
      c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) c.fillRect(B.x0 + ((i * 47 + SD.G.time * 30) % (B.x1 - B.x0)), gy + 32 + (i % 3) * 10, 18, 2);
      c.fillStyle = '#6a4a32'; c.fillRect(B.x0 - 30, gy, B.x1 - B.x0 + 60, 6);
      c.fillStyle = '#4a3326'; for (let x = B.x0; x <= B.x1; x += 60) c.fillRect(x, gy + 6, 6, 64);
      c.fillRect(B.x0 - 30, gy - 18, B.x1 - B.x0 + 60, 3); for (let x = B.x0 - 30; x <= B.x1 + 30; x += 30) c.fillRect(x, gy - 18, 3, 18);
    }
  }

  function pill(c, x, y, text, size) {
    c.font = '600 ' + size + 'px ' + FONT; c.textAlign = 'center';
    const w = c.measureText(text).width + 14;
    c.fillStyle = 'rgba(20,14,10,0.82)'; c.fillRect(x - w / 2, y - size - 3, w, size + 9);
    c.fillStyle = '#f4e9d4'; c.fillText(text, x, y); c.textAlign = 'start';
  }
  SD.pill = pill;

  function world(c, hour) {
    const G = SD.G, p = G.p, h = G.horse, t = G.time, nt = night(hour);
    const vis = (x, m) => x > cam.x - (m || 120) && x < cam.x + cam.w + (m || 120);
    for (const b of SD.BUILDINGS) if (vis(b.x, 40) || vis(b.x + b.w, 40)) SD.drawBuilding(c, b, nt);
    for (const pr of SD.PROPS) if (vis(pr.x, 160)) { c.save(); c.translate(pr.x, SD.ground(pr.x)); SD.drawProp(c, pr, t, nt); c.restore(); }
    terrain(c);
    for (const s of SD.SOLIDS) if (vis(s.x, 120)) SD.drawSolid(c, s);
    const draw = (a) => {
      c.save(); c.translate(a.x, a.y);
      if (a.kind === 'bottle') { c.fillStyle = '#5aa38a'; c.fillRect(-3, -14, 6, 11); c.fillRect(-1.5, -18, 3, 5); c.fillStyle = '#7a5a40'; c.fillRect(-6, -3, 12, 3); }
      else if (a.kind === 'rider') { SD.drawHorse(c, { face: a.face, vx: a.vx, t: a.t, onGround: a.onGround }, a.coat || '#5a3a28'); if (!a.dead) { c.translate(0, -30); SD.drawHuman(c, Object.assign({}, a, { vx: 0, y: a.y - 30 })); } }
      else if (a.human) SD.drawHuman(c, a);
      else SD.drawAnimal(c, a);
      c.restore();
    };
    for (const a of G.actors) if (a.dead && !a.inside && vis(a.x)) draw(a);
    for (const a of G.actors) if (!a.dead && !a.inside && vis(a.x)) draw(a);
    // horse and player
    c.save(); c.translate(h.x, h.y); SD.drawHorse(c, h, '#a86b3c'); c.restore();
    if (p.carry) { c.save(); c.translate(p.mounted ? h.x - h.face * 22 : p.x, p.mounted ? h.y - 36 : p.y - 18); c.rotate(Math.PI / 2 * (p.mounted ? -h.face : 1)); c.scale(0.8, 0.8); SD.drawHuman(c, Object.assign({}, p.carry, { dead: false, surrender: false, state: 'tied', vx: 0, alert: false, face: 1, flash: 0, kind: 'folk' })); c.restore(); }
    if (!p.dead) {
      const anim = p.roll > 0 ? 'roll' : p.mounted ? 'idle' : !p.onGround ? 'air' : Math.abs(p.vx) > 25 ? 'run' : 'idle';
      const blink = p.iframes > 0 && p.roll <= 0 && Math.floor(t * 30) % 2;
      if (!blink) {
        c.save(); c.translate(p.x, p.y);
        SD.drawHero(c, { face: p.face, anim, t: SD.G.time, rot: p.roll > 0 ? (1 - p.roll / SD.K.ROLLT) * TAU * p.rollDir : 0, flash: p.flash > 0, crouch: p.crouch });
        c.restore();
        if (p.roll <= 0) { const o = SD.gunOrigin(); c.save(); c.translate(o.x, o.y); SD.drawGun(c, p.gun, p.aim, G.kick); c.restore(); }
        if (G.muzzle > 0) { const o = SD.gunOrigin(), L = p.gun === 'rifle' ? 30 : 18; c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(o.x + Math.cos(p.aim) * L, o.y + Math.sin(p.aim) * L, 6, 0, TAU); c.fill(); }
      }
    }
    // incoming-shot warnings
    for (const a of G.actors) {
      if (a.state !== 'aim' || a.dead || !vis(a.x)) continue;
      const d = SD.KINDS[a.kind].gun, k = 1 - Math.max(0, a.st) / d[1];
      const gy = a.y - (a.kind === 'rider' ? 30 : 0) - a.h * (a.kind === 'rider' ? 0.3 : 0.68);
      c.strokeStyle = 'rgba(255,70,50,' + (0.15 + 0.6 * k) + ')'; c.lineWidth = k > 0.75 ? 2 : 1; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(a.x, gy); c.lineTo(a.ax, a.ay); c.stroke(); c.setLineDash([]);
    }
    for (const b of G.bullets) { c.strokeStyle = b.team === 'p' ? 'rgba(255,240,190,0.95)' : 'rgba(255,150,90,0.95)'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.px, b.py); c.lineTo(b.x, b.y); c.stroke(); }
    for (const b of G.booms) { c.fillStyle = '#c0392b'; c.fillRect(b.x - 3, b.y - 10, 6, 10); c.fillStyle = Math.floor(t * 20) % 2 ? '#ffe08a' : '#ff8a3d'; c.fillRect(b.x - 1, b.y - 14, 3, 4); }
    for (const q of G.parts) { c.globalAlpha = Math.max(0, q.life / q.max); c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    c.globalAlpha = 1;
    for (const a of G.actors) if (a.bubble && !a.dead && vis(a.x)) pill(c, a.x, a.y - a.h - 14, a.bubble.text, 11);
    for (const a of G.actors) if (!a.dead && (a.boss || a.target || a.kind === 'duelist') && vis(a.x)) pill(c, a.x, a.y - a.h - (a.kind === 'rider' ? 36 : 12), a.name, 10);
    c.textAlign = 'center'; c.lineJoin = 'round';
    for (const n of G.nums) {
      c.globalAlpha = Math.min(1, (0.9 - n.t) * 4); c.font = '700 ' + (n.big ? 15 : 12) + 'px ' + FONT;
      const y = n.y - n.t * 40; c.lineWidth = 3; c.strokeStyle = 'rgba(20,14,10,0.9)'; c.strokeText(n.text, n.x, y); c.fillStyle = n.color; c.fillText(n.text, n.x, y);
    }
    c.globalAlpha = 1; c.textAlign = 'start';
    if (G.near && !G.ocOn) pill(c, p.x, p.y - (p.mounted ? 46 : 34), 'E  ' + G.near.label, 11);
  }

  let shade = null;
  function lighting(c, W, H, z, dk) {
    if (dk <= 0.02) return;
    if (!shade) shade = document.createElement('canvas');
    if (shade.width !== c.canvas.width || shade.height !== c.canvas.height) { shade.width = c.canvas.width; shade.height = c.canvas.height; }
    const s = shade.getContext('2d'), k = c.canvas.width / W;
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, shade.width, shade.height);
    s.fillStyle = 'rgba(6,8,28,' + dk + ')'; s.fillRect(0, 0, shade.width, shade.height);
    s.globalCompositeOperation = 'destination-out';
    const p = SD.G.p, lights = SD.LIGHTS.concat([{ x: p.x, y: p.y - 12, r: 95 }]);
    for (const L of lights) {
      const x = (L.x - cam.x) * z * k, y = (L.y - cam.y) * z * k, r = L.r * z * k;
      if (x < -r || x > shade.width + r) continue;
      const gr = s.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = gr; s.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(shade, 0, 0); c.restore();
  }

  function minimap(c, W) {
    const G = SD.G, narrow = W < 700, w = narrow ? W - 40 : Math.min(420, W - 200), x0 = (W - w) / 2, y0 = narrow ? 112 : 52, k = w / SD.WORLD_W;
    c.fillStyle = 'rgba(20,14,10,0.6)'; c.fillRect(x0 - 3, y0 - 3, w + 6, 12);
    for (const r of SD.REGIONS) { c.fillStyle = TOPS[r.id][0]; c.fillRect(x0 + r.x0 * k, y0, (r.x1 - r.x0) * k, 6); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x0 + cam.x * k, y0 - 2, cam.w * k, 10);
    const dot = (x, col, s) => { c.fillStyle = col; c.fillRect(x0 + x * k - s / 2, y0 + 3 - s / 2, s, s); };
    dot(G.horse.x, '#6b3f22', 5);
    const m = SD.missionNow(), mx = m ? m.marker() : null, bx = SD.bountyMarker();
    if (bx != null) dot(bx, '#e74c3c', 7);
    if (mx != null) dot(mx, '#ffd166', 8);
    dot(G.p.x, '#d97757', 7);
    // arrow to an off-screen objective
    const tx = mx != null ? mx : bx;
    if (tx != null && (tx < cam.x || tx > cam.x + cam.w)) {
      const right = tx > cam.x, ax = right ? W - 26 : 26, ay = c.canvas.height / (window.devicePixelRatio > 1 ? Math.min(2, window.devicePixelRatio) : 1) / 2;
      c.fillStyle = mx != null ? '#ffd166' : '#e74c3c'; c.beginPath(); c.moveTo(ax + (right ? 12 : -12), ay); c.lineTo(ax, ay - 10); c.lineTo(ax, ay + 10); c.fill();
      c.font = '700 11px ' + FONT; c.textAlign = right ? 'right' : 'left';
      c.fillText(Math.round(Math.abs(tx - G.p.x) / 10) + ' m', right ? ax - 4 : ax + 4, ay + 24); c.textAlign = 'start';
    }
  }

  SD.render = function (c, W, H, dpr, mouse) {
    const G = SD.G, hour = SD.save.hour;
    const z = Math.max(Math.min(W / 960, H / 540), Math.min(W / 560, H / 760));
    cam.z = z; cam.w = W / z; cam.h = H / z;
    if (G) {
      const p = G.p, lead = G.duel ? 170 : (p.mounted ? Math.sign(G.horse.vx || p.face) * 160 : p.face * 70);
      const tx = Math.max(0, Math.min(SD.WORLD_W - cam.w, p.x + lead - cam.w / 2)), ty = p.y - cam.h * 0.64;
      if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
      const k = G.ocOn ? 0.02 : 0.07; cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(c, W, H, z, hour);
    if (!G) return;
    const sh = G.shake;
    c.save(); c.scale(z, z);
    c.translate(-cam.x + (sh ? (Math.random() - 0.5) * sh : 0), -cam.y + (sh ? (Math.random() - 0.5) * sh : 0));
    world(c, hour);
    c.restore();
    lighting(c, W, H, z, SD.darkness(hour));
    if (G.ocOn || (G.queue && G.queue.length)) {
      c.fillStyle = 'rgba(150,60,20,0.22)'; c.fillRect(0, 0, W, H);
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,8,0,0.6)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
      for (const m of G.marks.concat(G.queue || [])) {
        const x = (m.a.x + m.ox - cam.x) * z, y = (m.a.y + m.oy - cam.y) * z;
        c.strokeStyle = '#ff3b2f'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7); c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7); c.stroke();
      }
    }
    if (G.duel) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, H * 0.12); c.fillRect(0, H * 0.88, W, H * 0.12);
      c.font = '400 ' + (G.duel.stage === 'draw' ? 64 : 26) + 'px Rye, Georgia, serif'; c.textAlign = 'center';
      c.fillStyle = G.duel.stage === 'draw' ? '#ffd166' : '#f4e9d4'; c.fillText(G.duel.stage === 'draw' ? 'DRAW!' : 'Steady... wait for it', W / 2, H * 0.3); c.textAlign = 'start';
    }
    minimap(c, W);
    if (G.msg) { c.globalAlpha = Math.min(1, G.msg.t * 2); pill(c, W / 2, W < 700 ? 150 : 98, G.msg.text, Math.max(9, Math.min(15, (W - 40) / (G.msg.text.length * 0.56)))); c.globalAlpha = 1; }
    if (mouse.inside && !G.p.dead) {
      const x = mouse.x, y = mouse.y, col = G.ocOn ? '#ff3b2f' : '#f4e9d4';
      c.strokeStyle = 'rgba(20,14,10,0.8)'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke();
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.moveTo(x - 14, y); c.lineTo(x - 5, y); c.moveTo(x + 5, y); c.lineTo(x + 14, y); c.moveTo(x, y - 14); c.lineTo(x, y - 5); c.moveTo(x, y + 5); c.lineTo(x, y + 14); c.stroke();
      if (G.p.reload > 0) { const k = 1 - G.p.reload / SD.GUNS[G.p.gun].reload; c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.stroke(); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
