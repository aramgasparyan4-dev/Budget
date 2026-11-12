/* Sundown Protocol — the frame: camera, terrain, the play layer, lighting, cinematic overlays. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2, hash = SD.hash;
  const FONT = '"Chakra Petch", "Trebuchet MS", system-ui, sans-serif', SERIF = 'Rye, Georgia, serif';
  const cam = (SD.cam = { x: 1300, y: -300, z: 1, zf: 1.3, w: 960, h: 540 });
  const TOPS = { rail: ['#c39a68', '#8f6a45'], town: ['#c39a68', '#8f6a45'], plains: ['#d8b478', '#a8804e'], gulch: ['#cf8552', '#93573a'], river: ['#86994f', '#6a5a3e'], mine: ['#978873', '#6a5d50'] };
  const stripCol = [];
  function colAt(i) {
    if (stripCol[i]) return stripCol[i];
    const x = i * 16 + 8, R = SD.REGIONS, k = R.findIndex((r) => x < r.x1), r = R[k < 0 ? R.length - 1 : k];
    let top = TOPS[r.id][0], body = TOPS[r.id][1];
    const nb = x - r.x0 < 140 && k > 0 ? [R[k - 1], 0.5 - (x - r.x0) / 280] : r.x1 - x < 140 && k < R.length - 1 && k >= 0 ? [R[k + 1], 0.5 - (r.x1 - x) / 280] : null;
    if (nb) { top = SD.mix(top, TOPS[nb[0].id][0], nb[1]); body = SD.mix(body, TOPS[nb[0].id][1], nb[1]); }
    return (stripCol[i] = [top, body, SD.shade(top, 0.16)]);
  }
  const surf = (x) => { const B = SD.BRIDGE; if (x < B.x0 - 30 || x > B.x1 + 30) return SD.ground(x); const k = x < B.x0 ? (x - B.x0 + 30) / 30 : x > B.x1 ? (B.x1 + 30 - x) / 30 : 1; return SD.ground(x) + 74 * Math.max(0, Math.min(1, k)); };

  function terrain(c, T) {
    const i0 = Math.floor(cam.x / 16) - 1, i1 = Math.ceil((cam.x + cam.w) / 16) + 1, yb = cam.y + cam.h + 30;
    c.save(); c.beginPath(); c.moveTo(i0 * 16, yb);
    for (let i = i0; i <= i1; i++) c.lineTo(i * 16, surf(i * 16));
    c.lineTo(i1 * 16, yb); c.clip();
    for (let i = i0; i < i1; i++) {
      const col = colAt(Math.max(0, i)), x = i * 16, y = Math.min(surf(x), surf(x + 16));
      c.fillStyle = col[1]; c.fillRect(x, y - 2, 16.6, yb - y);
      c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(x + hash(i, 2) * 8, y + 22 + hash(i, 3) * 30, 9, 2.4); c.fillRect(x + hash(i, 4) * 6, y + 70 + hash(i, 5) * 40, 12, 3);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x + hash(i, 6) * 12, y + 10 + hash(i, 7) * 60, 3, 2);
    }
    c.lineWidth = 24; c.lineCap = 'round';
    for (let i = i0; i < i1; i++) { c.strokeStyle = colAt(Math.max(0, i))[0]; c.beginPath(); c.moveTo(i * 16, surf(i * 16)); c.lineTo(i * 16 + 16, surf(i * 16 + 16)); c.stroke(); }
    c.lineCap = 'butt';
    const gy = SD.ground(cam.x + cam.w / 2), gr = c.createLinearGradient(0, gy, 0, gy + 260);
    gr.addColorStop(0, 'rgba(30,14,6,0)'); gr.addColorStop(1, 'rgba(30,14,6,0.62)'); c.fillStyle = gr; c.fillRect(cam.x - 20, gy - 140, cam.w + 40, cam.h + 200);
    c.restore();
    c.lineWidth = 2; c.lineJoin = 'round';
    for (let i = i0; i < i1; i++) { c.strokeStyle = colAt(Math.max(0, i))[2]; c.beginPath(); c.moveTo(i * 16, surf(i * 16)); c.lineTo(i * 16 + 16.5, surf(i * 16 + 16)); c.stroke(); }
    const B = SD.BRIDGE;
    if (B.x1 + 60 > cam.x && B.x0 - 60 < cam.x + cam.w) {
      const y = SD.ground(B.x0), wg = c.createLinearGradient(0, y + 26, 0, y + 74);
      wg.addColorStop(0, SD.mix('#4f86a6', T.mid, 0.35)); wg.addColorStop(1, '#274a62'); c.fillStyle = wg; c.fillRect(B.x0 - 34, y + 26, B.x1 - B.x0 + 68, 50);
      c.fillStyle = 'rgba(255,255,255,0.3)'; for (let i = 0; i < 12; i++) c.fillRect(B.x0 - 20 + ((i * 53 + SD.G.time * 26) % (B.x1 - B.x0 + 30)), y + 30 + (i % 4) * 9, 14 + (i % 3) * 8, 1.6);
      c.fillStyle = '#4a3326'; for (let x = B.x0 + 8; x <= B.x1; x += 58) { c.fillRect(x, y + 5, 6, 70); SD.limb(c, x + 3, y + 10, x + 46, y + 60, 2.4, '#4a3326'); }
      c.fillStyle = '#7a5a40'; c.fillRect(B.x0 - 34, y - 1, B.x1 - B.x0 + 68, 7); c.fillStyle = 'rgba(0,0,0,0.2)'; for (let x = B.x0 - 34; x < B.x1 + 34; x += 11) c.fillRect(x, y - 1, 1.4, 7);
      c.fillStyle = '#5f432e'; for (let x = B.x0 - 30; x <= B.x1 + 30; x += 33) c.fillRect(x, y - 20, 3.4, 20); SD.limb(c, B.x0 - 32, y - 19, B.x1 + 32, y - 19, 3, '#6f5038');
    }
  }

  function pill(c, x, y, s, size, col) {
    c.font = '600 ' + size + 'px ' + FONT; c.textAlign = 'center';
    const w = c.measureText(s).width + 14;
    c.fillStyle = 'rgba(20,14,10,0.84)'; SD.rr(c, x - w / 2, y - size - 3, w, size + 9, 4); c.fill();
    c.fillStyle = col || '#f4e9d4'; c.fillText(s, x, y); c.textAlign = 'start';
  }
  SD.pill = pill;
  function shadow(c, x, y, w, T) {
    if (T.dark > 0.42) return;
    const len = 6 + (1 - T.arc) * 34, ox = -(T.sunX - 0.5) * 2 * len;
    c.fillStyle = 'rgba(20,10,6,' + 0.24 * (1 - T.dark * 2) + ')'; c.beginPath(); c.ellipse(x + ox * 0.5, y + 1.5, w / 2 + Math.abs(ox) * 0.5 + 2, 3, 0, 0, TAU); c.fill();
  }

  function world(c, T) {
    const G = SD.G, p = G.p, h = G.horse, t = G.time, nt = T.night;
    const vis = (x, m) => x > cam.x - (m || 140) && x < cam.x + cam.w + (m || 140);
    // telegraph line
    let prev = null; c.strokeStyle = 'rgba(30,22,18,0.7)'; c.lineWidth = 1;
    for (const pr of SD.PROPS) {
      if (pr.k !== 'pole') continue;
      if (prev && pr.x - prev.x < 420 && (vis(pr.x, 400) || vis(prev.x, 400))) for (const o of [-14, 12]) { const y0 = SD.ground(prev.x) - 106, y1 = SD.ground(pr.x) - 106; c.beginPath(); c.moveTo(prev.x + o, y0); c.quadraticCurveTo((prev.x + pr.x) / 2 + o, (y0 + y1) / 2 + 20, pr.x + o, y1); c.stroke(); }
      if (vis(pr.x)) { c.save(); c.translate(pr.x, SD.ground(pr.x)); SD.drawProp(c, pr, t, nt); c.restore(); }
      prev = pr;
    }
    for (const b of SD.BUILDINGS) if (vis(b.x, 60) || vis(b.x + b.w, 60)) SD.drawBuilding(c, b, nt, t);
    terrain(c, T);
    for (const pr of SD.PROPS) if (pr.k !== 'pole' && vis(pr.x, 160)) { c.save(); c.translate(pr.x, SD.ground(pr.x) + 1); SD.drawProp(c, pr, t, nt); c.restore(); }
    if (G.camp && vis(G.camp.x, 200)) for (const [k, dx] of [['tent', -46], ['fire', 16]]) { c.save(); c.translate(G.camp.x + dx, SD.ground(G.camp.x + dx) + 1); SD.drawProp(c, { k, s: 0.85, v: 0, x: 0 }, t, nt); c.restore(); }
    for (const s of SD.SOLIDS) if (vis(s.x, 120)) { shadow(c, s.x + s.w / 2, s.y + s.h, s.w, T); SD.drawSolid(c, s); }
    const mounted = (a) => a.kind === 'rider' || a.kind === 'ally';
    const draw = (a) => {
      c.save(); c.translate(a.x, a.y);
      if (a.kind === 'bottle') { c.fillStyle = '#5aa38a'; SD.rr(c, -3, -13, 6, 11, 1.5); c.fill(); c.fillRect(-1.4, -18, 2.8, 6); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-2, -12, 1.2, 8); }
      else if (a.kind === 'coach') { for (const o of [58, 96]) { c.save(); c.translate(o * a.face, 0); SD.drawHorse(c, { face: a.face, vx: a.vx, t: a.t + o, onGround: true, saddle: false }, o > 60 ? '#5a3a28' : '#3a2a22'); c.restore(); } c.scale(a.face, 1); SD.drawCoach(c, a.x / 12); }
      else if (mounted(a)) { SD.drawHorse(c, { face: a.face, vx: a.vx, vy: a.vy, t: a.t, onGround: a.onGround, dead: a.dead }, a.coatCol || (a.coatCol = ['#5a3a28', '#3a2a22', '#8a7a70', '#b08a60'][(hash(a.hx | 0, 9) * 4) | 0])); if (!a.dead) { c.translate(0, -15); SD.drawHuman(c, a, { seated: true, lift: -15 }); } }
      else if (a.human) SD.drawHuman(c, a);
      else SD.drawAnimal(c, a);
      c.restore();
    };
    for (const a of G.actors) if (a.dead && !a.inside && vis(a.x)) draw(a);
    for (const a of G.actors) if (!a.dead && !a.inside && vis(a.x)) { if (a.kind !== 'bottle') shadow(c, a.x, SD.ground(a.x), a.w + (mounted(a) ? 10 : 0), T); draw(a); }
    // horse, cargo, hero
    shadow(c, h.x, SD.ground(h.x), 52, T);
    c.save(); c.translate(h.x, h.y); SD.drawHorse(c, h, '#a5683a'); c.restore();
    if (p.carry) { c.save(); c.translate(p.mounted ? h.x - h.face * 17 : p.x - p.face * 2, p.mounted ? h.y - 40 : p.y - 19); c.rotate((Math.PI / 2) * (p.mounted ? -h.face : -p.face)); c.scale(0.86, 0.86); SD.drawHuman(c, Object.assign({}, p.carry, { dead: false, surrender: false, roped: 1, vx: 0, alert: false, face: 1, flash: 0, deadT: 9 })); c.restore(); }
    if (!p.dead) {
      const anim = p.roll > 0 ? 'roll' : p.mounted ? 'ride' : !p.onGround ? 'air' : Math.abs(p.vx) > 25 ? 'run' : 'idle';
      if (!p.mounted) shadow(c, p.x, SD.ground(p.x), 20, T);
      if (!(p.iframes > 0 && p.roll <= 0 && Math.floor(t * 30) % 2)) {
        c.save(); c.translate(p.x, p.y);
        SD.drawHero(c, { face: p.face, anim, t, vx: p.vx, rot: p.roll > 0 ? (1 - p.roll / SD.K.ROLLT) * TAU * p.rollDir : 0, flash: p.flash > 0, crouch: p.crouch });
        c.restore();
        if (p.roll <= 0) {
          const o = SD.gunOrigin(); c.save(); c.translate(o.x, o.y);
          SD.limb(c, -p.face * 3, 1, Math.cos(p.aim) * 5, Math.sin(p.aim) * 5, 2.6, '#a65a26');
          c.translate(Math.cos(p.aim) * 5, Math.sin(p.aim) * 5); SD.drawGun(c, p.gun, p.aim, G.kick);
          if (G.muzzle > 0) { c.rotate(p.aim); c.fillStyle = '#fff1b8'; const L = p.gun === 'rifle' ? 29 : p.gun === 'shotgun' ? 24 : 15; SD.poly(c, [L, 0, L + 13, -6, L + 8, 0, L + 13, 6]); c.fill(); SD.poly(c, [L, -1.5, L + 20, 0, L, 1.5]); c.fill(); }
          c.restore();
        }
      }
    }
    // lasso rope
    if (G.rope) { const o = SD.gunOrigin(), a = G.rope; c.strokeStyle = '#c9a56a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(o.x, o.y); c.quadraticCurveTo((o.x + a.x) / 2, Math.max(o.y, a.y - 14) + 14, a.x, a.y - (a.roped > 0 ? 6 : 26)); c.stroke(); }
    if (G.loop) { c.strokeStyle = '#c9a56a'; c.lineWidth = 1.8; const o = SD.gunOrigin(); c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(G.loop.x, G.loop.y); c.stroke(); c.beginPath(); c.ellipse(G.loop.x, G.loop.y, 11, 6, t * 9, 0, TAU); c.stroke(); }
    // enemy aim warnings
    for (const a of G.actors) {
      if (a.state !== 'aim' || a.dead || a.team === 'ally' || !vis(a.x)) continue;
      const d = SD.KINDS[a.kind].gun, k = 1 - Math.max(0, a.st) / d[1], gy = a.y - (a.kind === 'rider' ? 46 : a.h * 0.68);
      c.strokeStyle = 'rgba(255,70,50,' + (0.12 + 0.6 * k) + ')'; c.lineWidth = k > 0.75 ? 1.8 : 1; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(a.x + a.face * 10, gy); c.lineTo(a.ax, a.ay); c.stroke(); c.setLineDash([]);
    }
    for (const b of G.bullets) { c.strokeStyle = b.team === 'e' ? 'rgba(255,160,100,0.95)' : 'rgba(255,244,200,0.95)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(b.px, b.py); c.lineTo(b.x, b.y); c.stroke(); }
    for (const b of G.booms) { c.save(); c.translate(b.x, b.y - 6); c.rotate(t * 9); c.fillStyle = '#b8322a'; SD.rr(c, -2.6, -7, 5.2, 14, 1.5); c.fill(); c.restore(); c.fillStyle = Math.floor(t * 24) % 2 ? '#fff1b8' : '#ff8a3d'; c.beginPath(); c.arc(b.x, b.y - 14, 2.4, 0, TAU); c.fill(); }
    for (const q of G.parts) { c.globalAlpha = Math.max(0, q.life / q.max) * (q.a || 1); c.fillStyle = q.color; if (q.soft) { c.beginPath(); c.arc(q.x, q.y, q.size * (1.6 - q.life / q.max), 0, TAU); c.fill(); } else c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    c.globalAlpha = 1;
    for (const a of G.actors) {
      if (a.dead || a.inside || !vis(a.x)) continue;
      const top = a.y - a.h - (mounted(a) ? 30 : 0);
      if (G.cine.bars > 0.3) continue;
      if (a.bubble) pill(c, a.x, top - 14, a.bubble.text, 10.5);
      else if (a.boss || a.target || a.kind === 'duelist' || a.kind === 'ally') pill(c, a.x, top - 12, a.name, 9.5, a.kind === 'ally' ? '#9fd0ff' : '#ffb4a4');
      if (a.boss && a.hp < a.maxhp) { c.fillStyle = 'rgba(20,14,10,0.8)'; c.fillRect(a.x - 26, top - 8, 52, 5); c.fillStyle = '#e2553f'; c.fillRect(a.x - 25, top - 7, 50 * Math.max(0, a.hp / a.maxhp), 3); }
    }
    c.textAlign = 'center'; c.lineJoin = 'round';
    for (const n of G.nums) { c.globalAlpha = Math.min(1, (0.9 - n.t) * 4); c.font = '700 ' + (n.big ? 13 : 10.5) + 'px ' + FONT; const y = n.y - n.t * 36; c.lineWidth = 3; c.strokeStyle = 'rgba(20,14,10,0.9)'; c.strokeText(n.text, n.x, y); c.fillStyle = n.color; c.fillText(n.text, n.x, y); }
    c.globalAlpha = 1; c.textAlign = 'start';
    if (G.near && G.near.kind !== 'dismount' && !G.ocOn && !G.cine.bars) pill(c, p.x, p.y - (p.mounted ? 44 : 34), 'E  ' + G.near.label, 10.5);
  }

  let wc = null, sc = null, skyCv = null, skyAt = -9, skyW = 0, vgCv = null, vgKey = '';
  function layer(cv, W, H) { if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } return cv.getContext('2d'); }
  const lights = (G) => SD.LIGHTS.concat(G.camp ? [{ x: G.camp.x + 16, y: SD.ground(G.camp.x) - 10, r: 170, fire: 1 }] : [], [{ x: G.p.x, y: G.p.y - 14, r: 130, self: 1 }]);

  function overlays(c, W, H, z, G, T, mouse) {
    const ci = G.cine;
    if (G.ocOn || (G.queue && G.queue.length)) {
      c.fillStyle = 'rgba(160,70,20,0.2)'; c.fillRect(0, 0, W, H);
      for (const m of G.marks.concat(G.queue || [])) { const x = (m.a.x + m.ox - cam.x) * z, y = (m.a.y + m.oy - cam.y) * z; c.strokeStyle = '#ff3b2f'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7); c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7); c.stroke(); }
    }
    const key = W + 'x' + H + (G.ocOn ? 'o' : 'n');
    if (vgKey !== key) { // the vignette only changes with the window size, so paint it once
      vgKey = key; const v = layer(vgCv, Math.ceil(W / 2), Math.ceil(H / 2)); v.clearRect(0, 0, W, H);
      const vg = v.createRadialGradient(W / 4, H / 4, Math.min(W, H) * 0.21, W / 4, H / 4, Math.max(W, H) * 0.39);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, G.ocOn ? 'rgba(60,10,0,0.7)' : 'rgba(10,6,4,0.42)'); v.fillStyle = vg; v.fillRect(0, 0, W, H);
    }
    c.drawImage(vgCv, 0, 0, W, H);
    if (G.p.hp < 30 && !G.p.dead) { c.strokeStyle = 'rgba(200,30,20,' + (0.18 + 0.1 * Math.sin(G.time * 7)) + ')'; c.lineWidth = 40; c.strokeRect(0, 0, W, H); }
    if (ci.bars > 0.01) { const bh = H * 0.11 * ci.bars; c.fillStyle = '#0a0705'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh); }
    c.textAlign = 'center';
    if (G.duel) { const d = G.duel.stage === 'draw'; c.font = '400 ' + (d ? Math.min(84, W / 8) : Math.min(26, W / 22)) + 'px ' + SERIF; c.fillStyle = d ? '#ffd166' : '#f4e9d4'; c.shadowColor = '#000'; c.shadowBlur = 12; c.fillText(d ? 'DRAW!' : 'Steady. Wait for the call.', W / 2, H * 0.3); c.shadowBlur = 0; }
    if (ci.title) {
      const a = Math.min(1, ci.title.t * 1.6, (ci.title.dur - ci.title.t) * 1.6), s = Math.min(54, W / 13);
      c.globalAlpha = Math.max(0, a); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 16;
      c.font = '700 ' + Math.max(10, s * 0.24) + 'px ' + FONT; c.fillStyle = '#ffd166'; c.fillText(ci.title.kicker.toUpperCase().split('').join(' '), W / 2, H * 0.36 - s * 0.9);
      c.font = '400 ' + s + 'px ' + SERIF; c.fillStyle = '#f4e9d4'; c.fillText(ci.title.text, W / 2, H * 0.36);
      c.shadowBlur = 0; c.fillStyle = '#ffd166'; c.fillRect(W / 2 - s * 2.4, H * 0.36 + s * 0.3, s * 4.8, 2); c.globalAlpha = 1;
    }
    if (ci.banner) {
      const a = Math.min(1, ci.banner.t, (4 - ci.banner.t)), s = Math.min(26, W / 24);
      c.globalAlpha = Math.max(0, a); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 10; c.font = '400 ' + s + 'px ' + SERIF; c.fillStyle = '#f4e9d4';
      const tw = c.measureText(ci.banner.text).width; c.fillText(ci.banner.text, W / 2, H * 0.2); c.shadowBlur = 0;
      c.fillStyle = 'rgba(244,233,212,0.7)'; c.fillRect(W / 2 - tw / 2 - 54, H * 0.2 - s * 0.32, 40, 1.5); c.fillRect(W / 2 + tw / 2 + 14, H * 0.2 - s * 0.32, 40, 1.5); c.globalAlpha = 1;
    }
    if (ci.sub) {
      const s = Math.max(12, Math.min(17, W / 60)), y = H - Math.max(86, H * 0.16);
      c.font = '700 ' + s * 0.72 + 'px ' + FONT; c.fillStyle = '#ffd166'; c.lineWidth = 4; c.strokeStyle = 'rgba(10,6,4,0.85)'; c.lineJoin = 'round';
      c.strokeText(ci.sub.who.toUpperCase(), W / 2, y - s * 1.25); c.fillText(ci.sub.who.toUpperCase(), W / 2, y - s * 1.25);
      c.font = '600 ' + s + 'px ' + FONT; c.fillStyle = '#ffffff'; c.strokeText(ci.sub.text, W / 2, y); c.fillText(ci.sub.text, W / 2, y);
    }
    c.textAlign = 'start';
    if (!ci.bars && !SD.hideHud) {
      const narrow = W < 700, w = narrow ? W - 40 : Math.min(380, W - 220), x0 = (W - w) / 2, y0 = narrow ? 112 : 20, k = w / SD.WORLD_W;
      c.fillStyle = 'rgba(20,14,10,0.62)'; SD.rr(c, x0 - 5, y0 - 5, w + 10, 14, 7); c.fill();
      for (const r of SD.REGIONS) { c.fillStyle = TOPS[r.id][0]; c.fillRect(x0 + r.x0 * k, y0, (r.x1 - r.x0) * k, 4); }
      const dot = (x, col, s) => { c.fillStyle = col; c.beginPath(); c.arc(x0 + x * k, y0 + 2, s, 0, TAU); c.fill(); };
      dot(G.horse.x, '#6b3f22', 2.6);
      const m = SD.missionNow(), mx = m ? m.marker() : null, bx = SD.bountyMarker();
      if (G.camp) dot(G.camp.x, '#ff9a3c', 2.6);
      if (bx != null) dot(bx, '#e74c3c', 3.6);
      if (mx != null) dot(mx, '#ffd166', 4);
      c.strokeStyle = '#140e0a'; c.lineWidth = 1.5; dot(G.p.x, '#e0893c', 4); c.stroke();
      const tx = mx != null ? mx : bx;
      if (tx != null && (tx < cam.x || tx > cam.x + cam.w)) {
        const right = tx > cam.x, ax = right ? W - 24 : 24, ay = H * 0.46;
        c.fillStyle = mx != null ? '#ffd166' : '#e74c3c'; SD.poly(c, [ax + (right ? 12 : -12), ay, ax, ay - 9, ax, ay + 9]); c.fill();
        c.font = '700 11px ' + FONT; c.textAlign = right ? 'right' : 'left'; c.fillText(Math.round(Math.abs(tx - G.p.x) / 10) + ' m', right ? ax - 4 : ax + 4, ay + 24); c.textAlign = 'start';
      }
    }
    if (G.msg && !ci.title) { c.globalAlpha = Math.min(1, G.msg.t * 2); pill(c, W / 2, W < 700 ? 150 : 62, G.msg.text, Math.max(9, Math.min(14, (W - 40) / (G.msg.text.length * 0.56)))); c.globalAlpha = 1; }
    if (mouse.inside && !G.p.dead && !ci.bars) {
      const x = mouse.x, y = mouse.y, col = G.ocOn ? '#ff3b2f' : '#f4e9d4';
      for (const [w, cc] of [[4, 'rgba(20,14,10,0.8)'], [1.8, col]]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.moveTo(x - 14, y); c.lineTo(x - 5, y); c.moveTo(x + 5, y); c.lineTo(x + 14, y); c.moveTo(x, y - 14); c.lineTo(x, y - 5); c.moveTo(x, y + 5); c.lineTo(x, y + 14); c.stroke(); }
      if (G.p.reload > 0) { const k = 1 - G.p.reload / SD.GUNS[G.p.gun].reload; c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.stroke(); }
    }
  }

  SD.render = function (c, W, H, dpr, mouse) {
    const G = SD.G, T = SD.tod(SD.save.hour), p = G.p, h = G.horse;
    // camera: close on foot, wide on horseback, wider still when a fight needs the room
    let want = p.mounted ? 1.12 - Math.min(0.24, Math.abs(h.vx) / 2300) : 1.42, far = 0;
    for (const a of G.actors) if (!a.dead && a.alert && (a.team === 'gang' || a.team === 'law' || a.bite) && Math.abs(a.x - p.x) < 780) far = Math.max(far, Math.abs(a.x - p.x));
    if (far) want = Math.min(want, Math.max(0.78, 470 / (far + 120)));
    if (G.duel) want = 1.2; if (G.ocOn) want *= 1.06; if (G.slow > 0) want *= 1.1;
    cam.zf += (want - cam.zf) * (cam.init ? 0.035 : 1);
    const z = Math.max(Math.min(W / 960, H / 540), Math.min(W / 560, H / 760)) * cam.zf;
    cam.z = z; cam.w = W / z; cam.h = H / z;
    const lead = G.duel ? 170 : Math.max(-210, Math.min(210, (p.mounted ? h.vx : p.vx) * 0.5)) + p.face * 46;
    const tx = Math.max(0, Math.min(SD.WORLD_W - cam.w, p.x + lead - cam.w / 2)), ty = SD.ground(p.x) * 0.6 + (p.mounted ? h.y : p.y) * 0.4 - cam.h * 0.7;
    const k = cam.init ? (G.ocOn ? 0.02 : 0.07) : 1;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.init = true;
    const hy = (SD.ground(cam.x + cam.w / 2) - cam.y) * z - 4 * z;
    if (!wc) { wc = document.createElement('canvas'); sc = document.createElement('canvas'); skyCv = document.createElement('canvas'); vgCv = document.createElement('canvas'); }
    const pw = c.canvas.width, ph = c.canvas.height;
    // the sky changes slowly, so it is repainted a few times a second and reused in between
    if (skyW !== pw || G.time - skyAt > 0.16 || G.time < skyAt) { const sk = layer(skyCv, pw, ph); sk.setTransform(dpr, 0, 0, dpr, 0, 0); SD.drawSky(sk, W, H, z, T, cam, G.time, hy, 0); skyAt = G.time; skyW = pw; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(skyCv, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    SD.drawSky(c, W, H, z, T, cam, G.time, hy, 1);
    // by day the play layer goes straight to the screen; at dusk and night it gets its own canvas
    // so the light of the hour tints the world and not the sky
    const direct = SD.lowFx || (T.washA <= 0.05 && T.dark <= 0.02), w = direct ? c : layer(wc, pw, ph);
    if (!direct) { w.setTransform(1, 0, 0, 1, 0, 0); w.globalCompositeOperation = 'source-over'; w.clearRect(0, 0, pw, ph); }
    const sh = G.shake;
    w.setTransform(dpr * z, 0, 0, dpr * z, (-cam.x + (sh ? (Math.random() - 0.5) * sh : 0)) * dpr * z, (-cam.y + (sh ? (Math.random() - 0.5) * sh : 0)) * dpr * z);
    world(w, T);
    const LS = lights(G);
    if (!direct) {
      w.setTransform(1, 0, 0, 1, 0, 0); w.globalCompositeOperation = 'source-atop';
      if (T.washA > 0.01) { w.fillStyle = SD.rgba(T.wash, T.washA); w.fillRect(0, 0, pw, ph); }
      if (T.dark > 0.02) {
        const sw = pw >> 1, shh = ph >> 1, s = layer(sc, sw, shh), q = dpr / 2; // half resolution: darkness is soft anyway
        s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, sw, shh); s.fillStyle = 'rgba(6,9,34,' + Math.min(0.78, T.dark * 1.22) + ')'; s.fillRect(0, 0, sw, shh);
        s.globalCompositeOperation = 'destination-out';
        for (const L of LS) { const x = (L.x - cam.x) * z * q, y = (L.y - cam.y) * z * q, r = L.r * z * q * (L.fire ? 1 + Math.sin(G.time * 11) * 0.05 : 1); if (x < -r || x > sw + r) continue; const gr = s.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,' + (L.self ? 0.72 : 0.95) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = gr; s.fillRect(x - r, y - r, r * 2, r * 2); }
        w.drawImage(sc, 0, 0, pw, ph);
      }
      w.globalCompositeOperation = 'source-over';
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(wc, 0, 0);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (SD.lowFx && (T.dark > 0.02 || T.washA > 0.05)) { // cheap lighting for slow machines: one flat tint over the frame
      if (T.washA > 0.05) { c.fillStyle = SD.rgba(T.wash, T.washA); c.fillRect(0, 0, W, H); }
      if (T.dark > 0.02) { c.fillStyle = 'rgba(6,9,34,' + Math.min(0.5, T.dark * 0.8) + ')'; c.fillRect(0, 0, W, H); }
    }
    // warm bloom from lamps, fires and gunfire
    c.save(); c.globalCompositeOperation = 'lighter';
    if (T.dark > 0.1) for (const L of LS) { if (L.self) continue; const x = (L.x - cam.x) * z, y = (L.y - cam.y) * z; if (x > -200 && x < W + 200) SD.glow(c, x, y, L.r * z * 0.62, L.fire ? '#ff8a30' : '#ffb850', 0.2 * Math.min(1, T.dark * 2)); }
    if (G.muzzle > 0) { const o = SD.gunOrigin(); SD.glow(c, (o.x + Math.cos(p.aim) * 18 - cam.x) * z, (o.y + Math.sin(p.aim) * 18 - cam.y) * z, 90 * z, '#ffd27a', 0.5); }
    for (const a of G.actors) if (a.muzzle > 0 && !a.dead) SD.glow(c, (a.x + a.face * 18 - cam.x) * z, (a.y - a.h * 0.7 - cam.y) * z, 70 * z, '#ffb060', 0.4);
    if (G.flash > 0) { c.fillStyle = 'rgba(255,220,160,' + Math.min(0.5, G.flash) + ')'; c.fillRect(0, 0, W, H); }
    c.restore();
    SD.drawFore(c, W, H, z, T, cam);
    if (G.weather && G.weather.amt > 0.02) SD.drawWeather(c, W, H, G.weather.kind, G.weather.amt, G.time, G.weather.flash);
    overlays(c, W, H, z, G, T, mouse);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
