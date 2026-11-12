/* Sundown Protocol — pixel art drawn from rectangles. Every draw call expects the context
   translated to the thing's feet (centre-bottom) unless it says otherwise. 1 art pixel = 2 world units. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2, U = 2;
  const px = (c, x, y, w, h) => c.fillRect(x * U, -(y + h) * U, w * U, h * U); // y measured up from the feet
  SD.px = px;

  /* The hero: a small amber four-legged robot with a visor, an antenna and a red bandana.
     o = {face, anim: idle|run|air|roll, t, rot, flash, crouch} */
  SD.drawHero = function (c, o) {
    const fl = o.flash, body = fl ? '#fff' : '#e0893c', dark = fl ? '#fff' : '#a65a26', leg = fl ? '#fff' : '#6e3d22';
    c.save();
    if (o.anim === 'roll') { c.translate(0, -11); c.rotate(o.rot || 0); c.translate(0, 9); }
    let a = 2, b = 2, lift = 0;
    if (o.anim === 'run') { const k = Math.floor(o.t * 12) % 2; a = k ? 2 : 1; b = k ? 1 : 2; lift = k ? 0 : 0.5; }
    else if (o.anim === 'air') { a = 1; b = 1; lift = 1; }
    else if (o.anim === 'roll') { a = 0; b = 0; lift = 1; }
    else if (o.anim === 'idle') lift = Math.floor(o.t * 2) % 2 ? 0 : 0.5;
    if (o.crouch) c.scale(1.1, 0.7);
    c.scale(o.face || 1, 1);
    c.fillStyle = leg;
    if (a) { px(c, -5, 2 - a + lift, 1.2, a); px(c, 2, 2 - a + lift, 1.2, a); }
    if (b) { px(c, -3, 2 - b + lift, 1.2, b); px(c, 4, 2 - b + lift, 1.2, b); }
    c.fillStyle = body; px(c, -5, 2 + lift, 10, 6); px(c, -4, 8 + lift, 8, 2);
    c.fillStyle = dark; px(c, -5, 2 + lift, 10, 1); px(c, -5, 2 + lift, 1, 6); px(c, -4, 9.4 + lift, 1, 0.6); px(c, 3, 9.4 + lift, 1, 0.6);
    const blink = o.anim === 'idle' && o.t % 3.2 > 3.05;
    c.fillStyle = '#1b1410'; px(c, -1, 5 + lift, 6, 2.2);
    c.fillStyle = blink ? '#1b1410' : '#7fe3ff'; px(c, 2.4, 5.6 + lift, 1.6, 1);
    c.fillStyle = fl ? '#fff' : '#b8322a'; px(c, 0, 3 + lift, 5, 1.2); px(c, 3.2, 2.1 + lift, 1.4, 1);
    c.fillStyle = dark; px(c, -2, 10 + lift, 1, 2.4);
    c.fillStyle = fl ? '#fff' : '#ff5d5d'; px(c, -2.5, 12.4 + lift, 2, 1.6);
    c.restore();
  };

  /* A gun held out along `ang`, drawn from the current origin. */
  SD.drawGun = function (c, kind, ang, kick) {
    c.save(); c.rotate(ang);
    if (Math.cos(ang) < 0) c.scale(1, -1);
    c.translate(-(kick || 0), 0);
    c.fillStyle = '#2b2522';
    if (kind === 'rifle') { c.fillRect(0, -2, 30, 3); c.fillStyle = '#7a4a2a'; c.fillRect(-8, -2, 10, 5); }
    else if (kind === 'shotgun') { c.fillRect(0, -2.5, 24, 4); c.fillStyle = '#7a4a2a'; c.fillRect(-7, -2, 9, 5); }
    else { c.fillRect(2, -2, 13, 3); c.fillRect(2, -2, 4, 6); c.fillStyle = '#8a8f99'; c.fillRect(5, -1.5, 3, 2); }
    c.restore();
  };

  /* People. a: {kind, face, t, vx, hat, shirt, state, dead, surrender, h, flash, ax, ay, muzzle, law} */
  SD.drawHuman = function (c, a) {
    const f = a.face || 1, hit = a.flash > 0;
    const skin = hit ? '#fff' : a.skin || '#e0b088', shirt = hit ? '#fff' : a.shirt, pants = hit ? '#fff' : a.kind === 'duelist' ? '#1d1b20' : '#3d3a4a';
    const big = a.kind === 'foreman' ? 1.22 : 1, crouch = a.h < (SD.KINDS[a.kind].h * 0.8);
    c.save();
    if (a.dead) { c.translate(0, -3); c.rotate(-f * Math.PI / 2); c.translate(0, 8); }
    c.scale(f * big, crouch ? 0.66 * big : big);
    const walk = !a.dead && Math.abs(a.vx) > 15 ? Math.floor(a.t * 9) % 2 : -1;
    c.fillStyle = pants;
    px(c, -3 + (walk === 1 ? 1 : 0), 0, 2, 6); px(c, 1 - (walk === 0 ? 1 : 0), 0, 2, 6);
    c.fillStyle = '#2a1d16'; px(c, -3 + (walk === 1 ? 1 : 0), 0, 2.5, 1); px(c, 1 - (walk === 0 ? 1 : 0), 0, 2.5, 1);
    c.fillStyle = shirt; px(c, -3, 6, 6, 8);
    if (a.kind === 'duelist') { c.fillStyle = '#14110f'; px(c, -3.5, 3, 2, 11); }
    c.fillStyle = '#3a2618'; px(c, -3, 6, 6, 1);
    if (a.law || a.kind === 'law') { c.fillStyle = '#ffd166'; px(c, 1, 11, 1.5, 1.5); }
    c.fillStyle = skin; px(c, -2, 14, 5, 4);
    c.fillStyle = '#1b1410'; px(c, 1.5, 16, 1, 1);
    if (a.team === 'gang' && a.kind !== 'duelist') { c.fillStyle = hit ? '#fff' : a.boss ? '#5a4a2a' : '#9b2c22'; px(c, -2, 14, 5, 1.6); }
    c.fillStyle = hit ? '#fff' : a.hat;
    px(c, -4, 18, 8.5, 1); px(c, -2, 19, 5, 2.5);
    if (a.surrender && !a.dead) { c.fillStyle = shirt; px(c, -4, 13, 1.5, 6); px(c, 2.5, 13, 1.5, 6); c.fillStyle = skin; px(c, -4, 19, 1.5, 1); px(c, 2.5, 19, 1.5, 1); }
    else if (a.kind === 'folk' || a.dead || a.kind === 'knife' && a.state !== 'wind') { c.fillStyle = shirt; px(c, 2, 8, 1.5, 5); }
    c.restore();
    if (!a.dead && !a.surrender && a.kind !== 'folk') {
      const sy = -(crouch ? 8 : 12.5) * U * big;
      c.save(); c.translate(f * 2, sy);
      if (a.kind === 'knife') {
        const r = a.state === 'wind' ? -1.2 : 0.4;
        c.rotate(f > 0 ? r : Math.PI - r); c.fillStyle = shirt; c.fillRect(0, -1.5, 9, 3); c.fillStyle = '#c9cede'; c.fillRect(9, -1, 9, 2);
      } else {
        const ang = a.state === 'aim' || a.alert ? Math.atan2((a.ay || 0) - (a.y + sy), (a.ax || a.x + f) - a.x) : f > 0 ? 0.9 : Math.PI - 0.9;
        c.save(); c.rotate(ang); c.fillStyle = shirt; c.fillRect(0, -1.5, 9, 3); c.restore();
        c.translate(Math.cos(ang) * 8, Math.sin(ang) * 8);
        SD.drawGun(c, a.kind === 'rifle' ? 'rifle' : a.kind === 'foreman' ? 'shotgun' : 'revolver', ang, 0);
        if (a.muzzle > 0) { c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(Math.cos(ang) * 18, Math.sin(ang) * 18, 5, 0, TAU); c.fill(); }
      }
      c.restore();
    }
  };

  /* Horses. h: {face, vx, t, coat}; legs move with speed. */
  SD.drawHorse = function (c, h, coat) {
    const f = h.face || 1, sp = Math.abs(h.vx), body = coat || '#a86b3c', dark = '#3b2516';
    const k = sp > 20 ? Math.floor(h.t * (sp > 380 ? 14 : 9)) % 4 : -1;
    c.save(); c.scale(f, 1);
    const air = h.onGround === false ? 2 : 0;
    const leg = (x, i) => { const lift = k >= 0 && (k + i) % 4 < 2 ? 2 : 0, fwd = k >= 0 ? ((k + i) % 4 < 2 ? 1 : -1) : 0; px(c, x + fwd, lift + air * 0.5, 1.6, 8 - lift); };
    c.fillStyle = body;
    leg(-9, 0); leg(-7, 2); leg(6, 1); leg(8, 3);
    c.fillStyle = dark; for (const x of [-9, -7, 6, 8]) px(c, x, 0, 1.6, 1);
    c.fillStyle = body; px(c, -11, 7, 22, 8);
    px(c, 8, 13, 4, 6); px(c, 10, 17, 7, 4);
    c.fillStyle = '#c9925a'; px(c, -9, 7, 18, 1.5);
    c.fillStyle = dark; px(c, 7, 15, 2, 7); px(c, 10, 21, 1.5, 1.5); px(c, -13, 9, 2, 7); px(c, -14, 7, 2, 4);
    c.fillStyle = '#1b1410'; px(c, 14, 19, 1, 1);
    if (h.saddle !== false) { c.fillStyle = '#7a2e22'; px(c, -4, 13, 8, 3); c.fillStyle = '#4a2a1a'; px(c, -3, 15, 6, 1.5); }
    c.restore();
  };

  SD.drawAnimal = function (c, a) {
    const f = a.face || 1, hit = a.flash > 0, run = Math.abs(a.vx) > 30 ? Math.floor(a.t * 12) % 2 : 0;
    c.save(); c.scale(f, 1);
    if (a.dead) { c.rotate(Math.PI); c.translate(0, a.h); }
    if (a.kind === 'rabbit') {
      c.fillStyle = hit ? '#fff' : '#b89b7a'; px(c, -3, run, 5, 3); px(c, 1, 2 + run, 2.5, 2.5); px(c, 1.5, 4 + run, 1, 2.5);
      c.fillStyle = '#f2ece2'; px(c, -3.5, 1 + run, 1.2, 1.2);
    } else if (a.kind === 'deer') {
      c.fillStyle = hit ? '#fff' : '#9c6b43';
      for (const [x, i] of [[-6, 0], [-4.5, 1], [4, 1], [5.5, 0]]) px(c, x + (run && i ? 1 : 0), 0, 1, 7);
      px(c, -7, 7, 14, 5); px(c, 5, 10, 2.5, 5); px(c, 6, 14, 4, 2.5);
      c.fillStyle = '#e8d7bf'; px(c, -5, 7, 10, 1); px(c, -8, 10, 1.5, 1.5);
      c.fillStyle = '#5b3d25'; px(c, 6.5, 16.5, 1, 3); px(c, 5.5, 18.5, 1, 1.5); px(c, 7.5, 18.5, 1, 2);
      c.fillStyle = '#1b1410'; px(c, 8.5, 15.5, 1, 1);
    } else {
      const wolf = a.kind === 'wolf';
      c.fillStyle = hit ? '#fff' : wolf ? '#7d7f86' : '#b08a5c';
      const s = wolf ? 1.12 : 1;
      c.scale(s, s);
      for (const [x, i] of [[-5, 0], [-3.5, 1], [3, 1], [4.5, 0]]) px(c, x + (run && i ? 1 : 0), 0, 1.2, 4);
      px(c, -6, 4, 11, 4); px(c, 4, 6, 4, 3.5); px(c, 7.5, 6.5, 2, 1.5); px(c, 4.5, 9.5, 1, 1.5); px(c, 6.5, 9.5, 1, 1.5);
      px(c, -9, 4, 3, 2.5);
      c.fillStyle = '#1b1410'; px(c, 6.5, 8, 1, 1);
      if (a.state === 'wind') { c.fillStyle = '#fff'; px(c, 8, 6, 1, 1); }
    }
    c.restore();
  };

  /* ---------- props and cover (world units, feet at 0,0) ---------- */
  SD.drawProp = function (c, p, t, night) {
    const s = p.s;
    switch (p.k) {
      case 'cactus':
        c.fillStyle = '#4f7a3f'; c.fillRect(-4 * s, -46 * s, 8 * s, 46 * s);
        c.fillRect(-14 * s, -30 * s, 4 * s, 14 * s); c.fillRect(-14 * s, -18 * s, 10 * s, 4 * s);
        if (p.v) { c.fillRect(10 * s, -36 * s, 4 * s, 16 * s); c.fillRect(4 * s, -24 * s, 10 * s, 4 * s); }
        c.fillStyle = '#6a9a52'; c.fillRect(-2 * s, -44 * s, 2 * s, 42 * s); break;
      case 'deadtree':
        c.strokeStyle = '#5b4636'; c.lineWidth = 4 * s; c.lineCap = 'round'; c.beginPath();
        c.moveTo(0, 0); c.lineTo(0, -40 * s); c.lineTo(-14 * s, -56 * s); c.moveTo(0, -28 * s); c.lineTo(16 * s, -44 * s); c.lineTo(22 * s, -42 * s); c.stroke(); break;
      case 'pine':
        c.fillStyle = '#4a3326'; c.fillRect(-3 * s, -16 * s, 6 * s, 16 * s);
        c.fillStyle = p.v ? '#2f5a3f' : '#2a5038';
        for (let i = 0; i < 4; i++) { const w = (26 - i * 5) * s, y = -14 * s - i * 16 * s; c.beginPath(); c.moveTo(-w, y); c.lineTo(0, y - 26 * s); c.lineTo(w, y); c.fill(); }
        break;
      case 'bush':
        c.fillStyle = p.v === 1 ? '#8a8a4a' : '#6f7d47'; c.beginPath(); c.ellipse(0, -5 * s, 14 * s, 7 * s, 0, 0, TAU); c.fill(); break;
      case 'lamp':
        c.fillStyle = '#3a2a20'; c.fillRect(-2, -62, 4, 62); c.fillRect(-2, -62, 12, 3);
        c.fillStyle = night ? '#ffd27a' : '#6e6252'; c.fillRect(6, -60, 7, 9); break;
      case 'fence':
        c.fillStyle = '#7a5a40'; c.fillRect(-2, -26, 4, 26); c.fillRect(-20, -22, 40, 3); c.fillRect(-20, -12, 40, 3); break;
      case 'post':
        c.fillStyle = '#6a4a32'; c.fillRect(-16, -20, 3, 20); c.fillRect(13, -20, 3, 20); c.fillRect(-16, -20, 32, 3); break;
      case 'tower':
        c.fillStyle = '#5b4636'; for (const x of [-22, 18]) c.fillRect(x, -90, 4, 90);
        c.fillRect(-22, -50, 44, 3); c.fillStyle = '#7a5a40'; c.fillRect(-30, -140, 60, 52); c.fillStyle = '#5b4636'; c.fillRect(-32, -146, 64, 8);
        for (let i = 0; i < 4; i++) c.fillRect(-30, -132 + i * 12, 60, 2); break;
      case 'windmill': {
        c.fillStyle = '#5b4636'; c.fillRect(-3, -120, 6, 120); c.fillRect(-16, -2, 32, 3);
        c.save(); c.translate(0, -120); c.rotate(t * 1.4); c.fillStyle = '#b8ad9a';
        for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.fillRect(4, -3, 26, 6); }
        c.restore(); c.fillStyle = '#7a5a40'; c.fillRect(6, -124, 26, 8); break;
      }
      case 'sign':
        c.fillStyle = '#5b4636'; c.fillRect(-2, -40, 4, 40); c.fillStyle = '#a07a52'; c.fillRect(-46, -54, 92, 18);
        c.fillStyle = '#2a1d16'; c.font = '700 9px "Chakra Petch", monospace'; c.textAlign = 'center'; c.fillText(p.t, 0, -41); c.textAlign = 'start'; break;
      case 'grave':
        c.fillStyle = '#7a6a5a';
        if (p.v) { c.fillRect(-2, -22, 4, 22); c.fillRect(-8, -16, 16, 4); } else { c.fillRect(-7, -16, 14, 16); c.fillRect(-5, -19, 10, 3); }
        break;
      case 'tent':
        c.fillStyle = p.v ? '#b7a98a' : '#c9b893'; c.beginPath(); c.moveTo(-36 * s, 0); c.lineTo(0, -40 * s); c.lineTo(36 * s, 0); c.fill();
        c.fillStyle = '#2a2018'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(0, -20); c.lineTo(8, 0); c.fill(); break;
      case 'fire': {
        c.fillStyle = '#4a3326'; c.fillRect(-12, -4, 24, 4);
        const fl = 0.8 + 0.2 * Math.sin(t * 13);
        c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(-9, -3); c.lineTo(0, -24 * fl); c.lineTo(9, -3); c.fill();
        c.fillStyle = '#ffe08a'; c.beginPath(); c.moveTo(-4, -3); c.lineTo(0, -13 * fl); c.lineTo(4, -3); c.fill(); break;
      }
    }
  };

  SD.drawSolid = function (c, b) {
    const x = b.x, y = b.y, w = b.w, h = b.h;
    if (b.k === 'barrel') { c.fillStyle = '#7a4a2a'; c.fillRect(x + 1, y, w - 2, h); c.fillStyle = '#3a2a20'; c.fillRect(x, y + 5, w, 3); c.fillRect(x, y + h - 8, w, 3); }
    else if (b.k === 'crate') { c.fillStyle = '#a77b4c'; c.fillRect(x, y, w, h); c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + w - 3, y + h - 3); c.stroke(); }
    else if (b.k === 'trough') { c.fillStyle = '#6a4a32'; c.fillRect(x, y, w, h); c.fillStyle = '#5a8aa0'; c.fillRect(x + 3, y + 2, w - 6, 4); }
    else if (b.k === 'rock') { c.fillStyle = '#8a7a68'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + 4, y + 6); c.lineTo(x + w * 0.4, y); c.lineTo(x + w - 6, y + 4); c.lineTo(x + w, y + h); c.fill(); c.fillStyle = '#a5937e'; c.fillRect(x + w * 0.3, y + 3, w * 0.3, 4); }
    else if (b.k === 'wagon') {
      c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(x + 6, y + 4); c.quadraticCurveTo(x + w / 2, y - 46, x + w - 6, y + 4); c.fill();
      c.fillStyle = '#7a5236'; c.fillRect(x, y + 4, w, 12);
      c.fillStyle = '#3a2a20'; for (const cx of [x + 16, x + w - 16]) { c.beginPath(); c.arc(cx, y + h - 8, 9, 0, TAU); c.fill(); }
    } else if (b.k === 'log') { c.fillStyle = '#6a4a32'; c.fillRect(x, y, w, h); c.fillStyle = '#a07a52'; c.beginPath(); c.ellipse(x + w, y + h / 2, 4, h / 2, 0, 0, TAU); c.fill(); }
    else if (b.k === 'cart') { c.fillStyle = '#5c5f66'; c.fillRect(x, y, w, h - 6); c.fillStyle = '#3a3c42'; c.fillRect(x - 2, y, w + 4, 3); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 9, y + h - 4, 4, 0, TAU); c.arc(x + w - 9, y + h - 4, 4, 0, TAU); c.fill(); }
  };

  /* Buildings: false-front shops along the street. */
  SD.drawBuilding = function (c, b, night) {
    const x = b.x, gy = b.gy, w = b.w, h = b.h;
    if (b.kind === 'minehead') {
      c.fillStyle = '#6b5a4a'; c.beginPath(); c.moveTo(x - 60, gy); c.lineTo(x + 20, gy - h); c.lineTo(x + w - 20, gy - h - 20); c.lineTo(x + w + 80, gy); c.fill();
      c.fillStyle = '#16110e'; c.fillRect(x + w / 2 - 34, gy - 70, 68, 70);
      c.fillStyle = '#5b4636'; c.fillRect(x + w / 2 - 42, gy - 78, 84, 10); c.fillRect(x + w / 2 - 42, gy - 78, 9, 78); c.fillRect(x + w / 2 + 33, gy - 78, 9, 78);
      c.fillStyle = '#c9b893'; c.font = '700 11px "Chakra Petch", monospace'; c.textAlign = 'center'; c.fillText(b.name, x + w / 2, gy - 84); c.textAlign = 'start';
      return;
    }
    if (b.kind === 'shack') {
      c.fillStyle = b.col; c.fillRect(x, gy - h, w, h);
      c.fillStyle = '#3e2f24'; c.beginPath(); c.moveTo(x - 10, gy - h); c.lineTo(x + w / 2, gy - h - 26); c.lineTo(x + w + 10, gy - h); c.fill();
      c.fillStyle = '#1e1712'; c.fillRect(x + w / 2 - 10, gy - 32, 20, 32); c.fillStyle = night ? '#ffcf6b' : '#2a3340'; c.fillRect(x + 14, gy - 50, 16, 13);
      return;
    }
    const front = h, bodyH = h * 0.8;
    c.fillStyle = b.col; c.fillRect(x, gy - bodyH, w, bodyH); c.fillRect(x + 10, gy - front, w - 20, front - bodyH + 2);
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = x + 6; i < x + w; i += 9) c.fillRect(i, gy - bodyH, 1.5, bodyH);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 10, gy - front, w - 20, 4);
    if (b.name) {
      const sw = Math.min(w - 30, b.name.length * 8.5 + 20);
      c.fillStyle = '#e8d8b0'; c.fillRect(x + w / 2 - sw / 2, gy - front + 8, sw, 18);
      c.fillStyle = '#2a1d16'; c.font = '700 11px "Chakra Petch", monospace'; c.textAlign = 'center'; c.fillText(b.name, x + w / 2, gy - front + 21); c.textAlign = 'start';
    }
    const lit = night ? '#ffcf6b' : '#2a3340';
    const win = (wx, wy) => { c.fillStyle = '#3a2a20'; c.fillRect(wx - 2, wy - 2, 22, 20); c.fillStyle = lit; c.fillRect(wx, wy, 18, 16); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(wx + 8, wy, 2, 16); };
    if (h > 125) { win(x + 22, gy - bodyH + 18); win(x + w - 40, gy - bodyH + 18); if (w > 230) win(x + w / 2 - 9, gy - bodyH + 18); }
    win(x + 16, gy - 46); win(x + w - 34, gy - 46);
    if (b.kind === 'saloon') { c.fillStyle = '#4a2a20'; c.fillRect(x - 6, gy - bodyH + 52, w + 12, 5); for (let i = x - 4; i < x + w + 6; i += 10) c.fillRect(i, gy - bodyH + 40, 2, 12); c.fillRect(x - 6, gy - bodyH + 40, w + 12, 2); }
    c.fillStyle = '#3e2c20'; c.fillRect(x - 8, gy - 62, w + 16, 6);
    c.fillRect(x - 6, gy - 62, 4, 62); c.fillRect(x + w + 2, gy - 62, 4, 62);
    c.fillStyle = '#5b4636'; c.fillRect(x - 8, gy - 4, w + 16, 4);
    const dx = b.doorX;
    c.fillStyle = '#1e1712'; c.fillRect(dx - 12, gy - 38, 24, 34);
    if (b.kind === 'saloon') { c.fillStyle = '#a77b4c'; c.fillRect(dx - 12, gy - 30, 11, 16); c.fillRect(dx + 1, gy - 30, 11, 16); }
    else { c.fillStyle = '#6a4a32'; c.fillRect(dx - 11, gy - 37, 22, 33); c.fillStyle = '#c9a46b'; c.fillRect(dx + 6, gy - 22, 2, 3); }
    if (b.kind === 'sheriff') { c.fillStyle = '#efe3c4'; c.fillRect(x + 50, gy - 92, 16, 20); c.fillRect(x + w - 66, gy - 92, 16, 20); c.fillStyle = '#5a3a2a'; c.fillRect(x + 54, gy - 88, 8, 6); c.fillRect(x + w - 62, gy - 88, 8, 6); }
    if (b.kind === 'bank') { c.fillStyle = '#e8d8b0'; c.fillRect(dx - 20, gy - 52, 40, 9); c.fillStyle = '#2a1d16'; c.font = '700 7px "Chakra Petch", monospace'; c.textAlign = 'center'; c.fillText('CLOSED', dx, gy - 45); c.textAlign = 'start'; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
