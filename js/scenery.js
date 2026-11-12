/* Sundown Protocol — buildings, props, cover, the distant train and the stagecoach. World units.
   Props and coaches are drawn with the context at their feet; buildings and cover use world coordinates. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;
  const text = (c, s, x, y, size, col, font) => { c.font = (font || '400 ') + size + 'px ' + (font ? '"Chakra Petch", sans-serif' : 'Rye, Georgia, serif'); c.textAlign = 'center'; c.fillStyle = col; c.fillText(s, x, y); c.textAlign = 'start'; };

  function windowAt(c, x, y, w, h, lit, bars) {
    c.fillStyle = '#2e2018'; c.fillRect(x - 2, y - 2, w + 4, h + 5);
    c.fillStyle = lit ? '#ffc867' : '#26303c'; c.fillRect(x, y, w, h);
    if (!lit) { c.fillStyle = 'rgba(255,255,255,0.10)'; SD.poly(c, [x, y + h, x + w * 0.6, y, x + w, y, x + w * 0.4, y + h]); c.fill(); }
    else { c.fillStyle = 'rgba(160,60,20,0.35)'; c.fillRect(x, y, w * 0.28, h); c.fillRect(x + w * 0.72, y, w * 0.28, h); }
    c.fillStyle = '#2e2018'; c.fillRect(x + w / 2 - 0.8, y, 1.6, h); c.fillRect(x, y + h / 2 - 0.8, w, 1.6);
    if (bars) for (let i = 1; i < 5; i++) c.fillRect(x + (w * i) / 5 - 0.6, y, 1.2, h);
  }

  SD.drawBuilding = function (c, b, night, t) {
    const x = b.x, gy = b.gy, w = b.w, h = b.h, col = b.col, trim = SD.shade(col, -0.38), lite = SD.shade(col, 0.14), dx = b.doorX;
    if (b.kind === 'minehead') {
      c.fillStyle = '#6a5848'; SD.poly(c, [x - 90, gy + 4, x - 20, gy - h * 0.7, x + 40, gy - h - 10, x + w - 30, gy - h - 34, x + w + 40, gy - h * 0.5, x + w + 120, gy + 4]); c.fill();
      c.fillStyle = '#7d6a58'; SD.poly(c, [x - 20, gy - h * 0.7, x + 40, gy - h - 10, x + 70, gy - h * 0.55, x + 10, gy - h * 0.35]); c.fill();
      c.fillStyle = '#120d0a'; SD.poly(c, [dx - 34, gy, dx - 30, gy - 66, dx + 30, gy - 66, dx + 34, gy]); c.fill();
      c.fillStyle = '#5b4332'; c.fillRect(dx - 44, gy - 78, 88, 11); c.fillRect(dx - 42, gy - 70, 10, 70); c.fillRect(dx + 32, gy - 70, 10, 70);
      c.fillStyle = '#3e2d21'; c.fillRect(dx - 44, gy - 69, 88, 2.5); for (const s of [-1, 1]) SD.limb(c, dx + s * 37, gy - 40, dx + s * 20, gy - 68, 4, '#5b4332');
      c.fillStyle = '#4a4038'; c.fillRect(dx - 60, gy - 3, 120, 3); for (let i = -56; i < 60; i += 12) c.fillRect(dx + i, gy - 1.5, 6, 3);
      text(c, b.name, dx, gy - 86, 11, '#d8c59c');
      return;
    }
    if (b.kind === 'shack') {
      c.fillStyle = col; c.fillRect(x, gy - h + 12, w, h - 12);
      c.fillStyle = 'rgba(0,0,0,0.16)'; for (let i = x + 9; i < x + w; i += 11) c.fillRect(i, gy - h + 12, 1.6, h - 12);
      c.fillStyle = '#6f757c'; SD.poly(c, [x - 12, gy - h + 16, x + w * 0.4, gy - h - 14, x + w + 12, gy - h + 6, x + w + 12, gy - h + 14, x - 12, gy - h + 22]); c.fill();
      c.fillStyle = '#3a3d42'; c.fillRect(x + w - 30, gy - h - 26, 7, 26);
      c.fillStyle = '#1c1511'; c.fillRect(dx - 11, gy - 36, 22, 36); windowAt(c, x + 14, gy - 52, 18, 16, night);
      return;
    }
    const bodyH = b.kind === 'station' ? h : h * 0.8, top = gy - bodyH;
    // body with clapboard siding
    c.fillStyle = col; c.fillRect(x, top, w, bodyH);
    c.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = top + 6; y < gy - 4; y += 7) c.fillRect(x, y, w, 1.3);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, top, 5, bodyH); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + w - 5, top, 5, bodyH);
    if (b.kind === 'church') {
      c.fillStyle = lite; SD.poly(c, [x - 8, top + 2, x + w / 2, top - 44, x + w + 8, top + 2]); c.fill();
      c.fillStyle = col; c.fillRect(x + w / 2 - 17, top - 86, 34, 60); c.fillStyle = trim; SD.poly(c, [x + w / 2 - 21, top - 84, x + w / 2, top - 128, x + w / 2 + 21, top - 84]); c.fill();
      c.fillRect(x + w / 2 - 1.2, top - 142, 2.4, 16); c.fillRect(x + w / 2 - 5, top - 137, 10, 2.4);
      c.fillStyle = '#16100c'; SD.rr(c, x + w / 2 - 8, top - 74, 16, 22, 7); c.fill(); c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(x + w / 2, top - 61, 4, 0, TAU); c.fill();
      for (const wx of [x + 20, x + w - 38]) { c.fillStyle = night ? '#ffc867' : '#3d5a78'; SD.rr(c, wx, gy - 62, 18, 34, 8); c.fill(); }
      c.fillStyle = '#4a3020'; SD.rr(c, dx - 13, gy - 44, 26, 44, 12); c.fill();
      return;
    }
    if (b.kind === 'stable') {
      c.fillStyle = trim; SD.poly(c, [x - 10, top + 4, x + w * 0.2, top - 28, x + w * 0.5, top - 44, x + w * 0.8, top - 28, x + w + 10, top + 4]); c.fill();
      c.fillStyle = col; SD.poly(c, [x, top + 4, x + w * 0.22, top - 20, x + w * 0.5, top - 34, x + w * 0.78, top - 20, x + w, top + 4]); c.fill();
      c.fillStyle = '#1a120d'; c.fillRect(x + w / 2 - 34, gy - 62, 68, 62); c.fillRect(x + w / 2 - 11, top - 16, 22, 18);
      c.fillStyle = trim; c.fillRect(x + w / 2 - 44, gy - 64, 12, 64); c.fillRect(x + w / 2 + 32, gy - 64, 12, 64); c.fillRect(x + w / 2 - 44, gy - 68, 88, 6);
      c.strokeStyle = SD.shade(col, 0.2); c.lineWidth = 2; for (const s of [-38, 38]) { c.beginPath(); c.moveTo(x + w / 2 + s - 5, gy - 60); c.lineTo(x + w / 2 + s + 5, gy - 4); c.moveTo(x + w / 2 + s + 5, gy - 60); c.lineTo(x + w / 2 + s - 5, gy - 4); c.stroke(); }
      c.fillStyle = '#d8b25a'; SD.rr(c, x + 14, gy - 18, 30, 18, 3); c.fill(); SD.rr(c, x + 26, gy - 33, 28, 16, 3); c.fill(); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 14, gy - 10, 30, 1.5); c.fillRect(x + 26, gy - 26, 28, 1.5);
      text(c, b.name, x + w / 2, top + 0, 10, '#e8d8b0');
      return;
    }
    if (b.kind === 'house') {
      c.fillStyle = trim; SD.poly(c, [x - 10, top + 3, x + w * 0.5, top - 36, x + w + 10, top + 3]); c.fill();
      c.fillStyle = '#5a4a40'; c.fillRect(x + w - 38, top - 40, 12, 30);
      windowAt(c, x + 16, gy - 52, 20, 20, night); windowAt(c, x + w - 38, gy - 52, 20, 20, night);
      c.fillStyle = '#4a3020'; c.fillRect(dx - 11, gy - 40, 22, 40); c.fillStyle = '#c9a46b'; c.fillRect(dx + 5, gy - 22, 2, 3);
      c.fillStyle = '#e8e0d0'; for (let i = x - 16; i < x + w + 16; i += 7) if (Math.abs(i - dx) > 16) c.fillRect(i, gy - 16, 3, 16);
      c.fillRect(x - 16, gy - 11, w / 2 - 2, 2); c.fillRect(dx + 18, gy - 11, w / 2 - 4, 2);
      return;
    }
    // false front, cornice and sign
    if (b.kind !== 'station') {
      c.fillStyle = col; c.fillRect(x + 6, gy - h, w - 12, h - bodyH + 2);
      c.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = gy - h + 8; y < top; y += 7) c.fillRect(x + 6, y, w - 12, 1.3);
      c.fillStyle = trim; c.fillRect(x + 2, gy - h - 4, w - 4, 6); c.fillStyle = lite; c.fillRect(x + 2, gy - h - 4, w - 4, 1.6);
      c.fillStyle = trim; for (let i = x + 8; i < x + w - 10; i += 9) c.fillRect(i, gy - h + 2, 4, 3);
    } else { c.fillStyle = trim; SD.poly(c, [x - 16, top + 4, x + 6, top - 20, x + w - 6, top - 20, x + w + 16, top + 4]); c.fill(); }
    if (b.name) {
      const sw = Math.min(w - 26, b.name.length * 9.6 + 22), sy = b.kind === 'station' ? top + 20 : gy - h + 10;
      c.fillStyle = '#3a271b'; c.fillRect(x + w / 2 - sw / 2 - 2, sy - 2, sw + 4, 21);
      c.fillStyle = b.kind === 'bank' ? '#d9d2bf' : '#ecdcb4'; c.fillRect(x + w / 2 - sw / 2, sy, sw, 17);
      text(c, b.name, x + w / 2, sy + 13.5, 12, '#3a1a12');
    }
    // windows
    if (h > 125) { windowAt(c, x + 22, top + 16, 18, 22, night); windowAt(c, x + w - 40, top + 16, 18, 22, night); if (w > 230) windowAt(c, x + w / 2 - 9, top + 16, 18, 22, night); }
    windowAt(c, x + 16, gy - 50, b.kind === 'store' ? 34 : 20, 24, night, b.kind === 'sheriff');
    windowAt(c, x + w - (b.kind === 'store' ? 50 : 36), gy - 50, b.kind === 'store' ? 34 : 20, 24, night && b.kind !== 'bank', b.kind === 'bank');
    if (b.kind === 'saloon') {
      c.fillStyle = trim; c.fillRect(x - 8, top + 50, w + 16, 4); c.fillRect(x - 8, top + 36, w + 16, 2.5);
      for (let i = x - 6; i < x + w + 8; i += 8) c.fillRect(i, top + 38, 2, 12);
    }
    // porch roof, posts, boardwalk
    const py = gy - 66;
    c.fillStyle = b.kind === 'store' ? '#8a3b2e' : SD.shade(trim, -0.15); SD.poly(c, [x - 4, py - 9, x + w + 4, py - 9, x + w + 12, py, x - 12, py]); c.fill();
    if (b.kind === 'store') { c.fillStyle = '#e8dcc0'; for (let i = x - 6; i < x + w; i += 22) SD.poly(c, [i + 4, py - 9, i + 14, py - 9, i + 16, py, i + 2, py]), c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x - 12, py, w + 24, 3); c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(x, py + 3, w, 12);
    c.fillStyle = trim; for (const px of [x - 8, x + w / 3, x + (w * 2) / 3, x + w + 4]) if (Math.abs(px + 2 - dx) > 20) c.fillRect(px, py, 4, 66);
    c.fillStyle = '#6a4e38'; c.fillRect(x - 14, gy - 5, w + 28, 5); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x - 14, gy - 5, w + 28, 1.2);
    // door
    c.fillStyle = '#17100c'; c.fillRect(dx - 13, gy - 45, 26, 40);
    if (b.kind === 'saloon') { const s = Math.sin(t * 1.3) * 1.5; c.fillStyle = '#b08050'; SD.rr(c, dx - 13, gy - 34, 12 + s, 20, 3); c.fill(); SD.rr(c, dx + 1 - s, gy - 34, 12 + s, 20, 3); c.fill(); c.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 4; i++) c.fillRect(dx - 12, gy - 31 + i * 4.5, 24, 1); }
    else { c.fillStyle = SD.shade(col, -0.2); c.fillRect(dx - 12, gy - 44, 24, 39); c.fillStyle = 'rgba(0,0,0,0.25)'; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.2; c.strokeRect(dx - 9, gy - 41, 18, 14); c.strokeRect(dx - 9, gy - 24, 18, 16); c.fillStyle = '#d0aa60'; c.beginPath(); c.arc(dx + 7.5, gy - 24, 1.5, 0, TAU); c.fill(); }
    if (b.kind === 'sheriff') {
      for (const wx of [x + 48, x + w - 64]) { c.fillStyle = '#efe3c4'; c.fillRect(wx, gy - 100, 17, 22); c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(wx + 8.5, gy - 91, 4, 0, TAU); c.fill(); c.fillRect(wx + 3, gy - 84, 11, 1.5); c.fillRect(wx + 3, gy - 81, 11, 1.5); }
      c.fillStyle = '#ffd166'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 3 : 7; c.lineTo(dx + Math.cos(a) * r, gy - 56 + Math.sin(a) * r); } c.fill();
    }
    if (b.kind === 'doctor') { c.fillStyle = '#f2ece0'; c.fillRect(dx - 9, gy - 64, 18, 14); c.fillStyle = '#b8322a'; c.fillRect(dx - 2, gy - 62, 4, 10); c.fillRect(dx - 5, gy - 59, 10, 4); }
    if (b.kind === 'bank') { c.fillStyle = '#d9d2bf'; for (const px of [dx - 26, dx + 20]) c.fillRect(px, gy - 62, 6, 57); }
    if (b.kind === 'station') { c.fillStyle = '#efe3c4'; c.beginPath(); c.arc(x + 34, top + 30, 9, 0, TAU); c.fill(); c.strokeStyle = '#2a1d16'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 34, top + 30); c.lineTo(x + 34, top + 24); c.moveTo(x + 34, top + 30); c.lineTo(x + 38, top + 32); c.stroke(); c.fillStyle = '#5a3a2a'; c.fillRect(x + w - 70, gy - 16, 44, 4); c.fillRect(x + w - 68, gy - 12, 3, 8); c.fillRect(x + w - 31, gy - 12, 3, 8); }
  };

  SD.drawProp = function (c, p, t, night) {
    const s = p.s || 1;
    switch (p.k) {
      case 'cactus': {
        const a = '#4d7a43', b = '#6c9c58';
        SD.limb(c, 0, -3, 0, -44 * s, 9 * s, a); SD.limb(c, -1.6 * s, -6, -1.6 * s, -42 * s, 2 * s, b);
        SD.limb(c, -4 * s, -20 * s, -13 * s, -20 * s, 5.5 * s, a); SD.limb(c, -13 * s, -20 * s, -13 * s, -33 * s, 5.5 * s, a);
        if (p.v) { SD.limb(c, 4 * s, -27 * s, 12 * s, -27 * s, 5 * s, a); SD.limb(c, 12 * s, -27 * s, 12 * s, -39 * s, 5 * s, a); }
        if (p.v === 2) { c.fillStyle = '#f2a0b8'; c.beginPath(); c.arc(0, -47 * s, 2.4 * s, 0, TAU); c.fill(); }
        break;
      }
      case 'deadtree':
        c.strokeStyle = '#5a4434'; c.lineCap = 'round'; c.lineWidth = 5 * s; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(3 * s, -22 * s, -2 * s, -42 * s); c.stroke();
        c.lineWidth = 2.6 * s; c.beginPath(); c.moveTo(-1 * s, -30 * s); c.lineTo(-17 * s, -50 * s); c.lineTo(-22 * s, -62 * s); c.moveTo(-10 * s, -42 * s); c.lineTo(-6 * s, -56 * s);
        c.moveTo(1 * s, -26 * s); c.lineTo(17 * s, -42 * s); c.lineTo(26 * s, -44 * s); c.moveTo(-2 * s, -42 * s); c.lineTo(6 * s, -62 * s); c.stroke(); break;
      case 'pine': {
        c.fillStyle = '#4a3326'; c.fillRect(-3 * s, -20 * s, 6 * s, 20 * s);
        const sway = Math.sin(t * 0.9 + p.x) * 1.2;
        for (let i = 0; i < 5; i++) { const w = (30 - i * 5) * s, y = -16 * s - i * 15 * s, k = sway * (i / 4); c.fillStyle = i % 2 ? '#2d5a40' : '#234a36'; SD.poly(c, [-w + k, y, k * 1.6, y - 27 * s, w + k, y, k, y - 5 * s]); c.fill(); c.fillStyle = 'rgba(255,255,255,0.05)'; SD.poly(c, [k * 1.6, y - 27 * s, w + k, y, k, y - 5 * s]); c.fill(); }
        break;
      }
      case 'bush':
        c.fillStyle = p.v === 1 ? '#7f8048' : '#667546'; c.beginPath(); c.ellipse(-5 * s, -5 * s, 9 * s, 6 * s, 0, 0, TAU); c.ellipse(6 * s, -4 * s, 9 * s, 5 * s, 0, 0, TAU); c.ellipse(0, -8 * s, 8 * s, 6 * s, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.ellipse(-1 * s, -10 * s, 5 * s, 2.6 * s, 0, 0, TAU); c.fill(); break;
      case 'grass':
        c.strokeStyle = p.v ? '#8d9a52' : '#73864a'; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath();
        for (let i = -3; i <= 3; i++) { const k = Math.sin(t * 1.6 + p.x + i) * 2.2; c.moveTo(i * 2.2, 0); c.quadraticCurveTo(i * 2.6, -6 * s, i * 3.4 + k, -(9 + (i & 1) * 4) * s); }
        c.stroke(); break;
      case 'skull':
        c.fillStyle = '#e6dcc6'; c.beginPath(); c.ellipse(0, -4, 6, 4, 0, 0, TAU); c.fill(); SD.poly(c, [3, -5, 11, -3.6, 10, -1, 3, -1.6]); c.fill();
        c.strokeStyle = '#e6dcc6'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, -7); c.quadraticCurveTo(-11, -8, -11, -14); c.moveTo(-1, -8); c.quadraticCurveTo(3, -14, 9, -13); c.stroke();
        c.fillStyle = '#2a2018'; c.beginPath(); c.arc(1, -4.5, 1.3, 0, TAU); c.fill(); break;
      case 'pole':
        c.fillStyle = '#4e3a2c'; c.fillRect(-2.2, -112, 4.4, 112); c.fillRect(-15, -104, 30, 3.4); c.fillRect(-11, -94, 22, 3);
        c.fillStyle = '#9fb7b0'; for (const i of [-13, 11]) c.fillRect(i, -108, 2.6, 4); break;
      case 'lamp':
        c.fillStyle = '#2f2219'; c.fillRect(-1.8, -64, 3.6, 64); c.fillRect(-4, -3, 8, 3); SD.limb(c, 0, -62, 9, -66, 2, '#2f2219');
        c.fillStyle = '#2f2219'; SD.poly(c, [5.5, -66, 12.5, -66, 11, -69, 7, -69]); c.fill();
        c.fillStyle = night ? '#ffd27a' : '#8f8672'; c.fillRect(6.4, -66, 5.2, 8); c.fillStyle = '#2f2219'; c.fillRect(5.6, -58, 6.8, 1.6); break;
      case 'fence':
        c.fillStyle = '#7a5a40'; c.fillRect(-2.2, -27, 4.4, 27); SD.limb(c, -20, -21, 20, -20, 2.8, '#8a6a4c'); SD.limb(c, -20, -11, 20, -12, 2.8, '#7a5a40'); break;
      case 'post':
        c.fillStyle = '#5f432e'; c.fillRect(-17, -21, 3.6, 21); c.fillRect(13.4, -21, 3.6, 21); SD.limb(c, -18, -19, 18, -19, 3.2, '#6f5038'); break;
      case 'tower': {
        c.strokeStyle = '#5b4636'; c.lineWidth = 4; c.lineCap = 'butt'; c.beginPath(); for (const x of [-24, 24]) { c.moveTo(x, 0); c.lineTo(x * 0.8, -92); } c.stroke();
        c.lineWidth = 2; c.beginPath(); c.moveTo(-24, -4); c.lineTo(21, -46); c.moveTo(24, -4); c.lineTo(-21, -46); c.moveTo(-21, -46); c.lineTo(19.5, -90); c.moveTo(21, -46); c.lineTo(-19.5, -90); c.stroke();
        c.fillStyle = '#86644a'; c.fillRect(-31, -146, 62, 56); c.fillStyle = 'rgba(0,0,0,0.16)'; for (let i = -31; i < 31; i += 8) c.fillRect(i, -146, 1.4, 56);
        c.fillStyle = '#3a3d42'; for (const y of [-138, -118, -98]) c.fillRect(-32, y, 64, 2.6);
        c.fillStyle = '#5b4636'; SD.poly(c, [-36, -146, 0, -164, 36, -146]); c.fill(); SD.limb(c, 30, -96, 52, -84, 3, '#3a3d42'); break;
      }
      case 'windmill': {
        c.strokeStyle = '#5b4636'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-15, 0); c.lineTo(-3, -118); c.moveTo(15, 0); c.lineTo(3, -118);
        for (let i = 0; i < 4; i++) { const y = -i * 28, k = 15 - i * 3; c.moveTo(-k, y); c.lineTo(k - 3, y - 28); c.moveTo(k, y); c.lineTo(-k + 3, y - 28); }
        c.stroke();
        c.save(); c.translate(0, -120); c.fillStyle = '#8a8f96'; SD.poly(c, [-6, -2, -34, -10, -34, 10, -6, 2]); c.fill(); c.rotate(t * 1.6); c.fillStyle = '#c3bcae';
        for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); SD.poly(c, [5, -1.5, 27, -5.5, 27, 5.5, 5, 1.5]); c.fill(); }
        c.fillStyle = '#4a4038'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.restore(); break;
      }
      case 'sign':
        c.fillStyle = '#5b4636'; c.fillRect(-40, -44, 4, 44); c.fillRect(36, -44, 4, 44); c.fillStyle = '#b08a5c'; c.fillRect(-50, -62, 100, 22); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-50, -42, 100, 2);
        text(c, p.t, 0, -46, 10, '#2a1d16'); break;
      case 'grave':
        c.fillStyle = '#8a7a66';
        if (p.v) { c.fillRect(-2, -24, 4, 24); c.fillRect(-8, -18, 16, 3.6); } else { SD.rr(c, -7, -18, 14, 18, 6); c.fill(); }
        c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(4, -0.5, 14, 2.4, 0, 0, TAU); c.fill(); break;
      case 'tent':
        c.fillStyle = p.v ? '#b9ab8c' : '#cdbd98'; SD.poly(c, [-38 * s, 0, 0, -42 * s, 38 * s, 0]); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.16)'; SD.poly(c, [0, -42 * s, 38 * s, 0, 8 * s, 0]); c.fill();
        c.fillStyle = '#231a14'; SD.poly(c, [-9 * s, 0, 0, -24 * s, 9 * s, 0]); c.fill();
        c.strokeStyle = '#8a7a5c'; c.lineWidth = 1; c.beginPath(); c.moveTo(-38 * s, 0); c.lineTo(-50 * s, 0); c.moveTo(0, -42 * s); c.lineTo(0, -47 * s); c.stroke(); break;
      case 'fire': {
        c.fillStyle = '#6f6a62'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(i * 6, -1.6, 3.4, 2.4, 0, 0, TAU); c.fill(); }
        SD.limb(c, -9, -3, 8, -6, 3.4, '#4a3326'); SD.limb(c, 9, -3, -8, -6, 3.4, '#3e2a1e');
        for (let i = 0; i < 3; i++) { const fl = 0.75 + 0.25 * Math.sin(t * (11 + i * 3) + i), w = 8 - i * 2.4; c.fillStyle = ['#ff7a2c', '#ffae3c', '#ffe9a0'][i]; c.beginPath(); c.moveTo(-w, -4); c.quadraticCurveTo(-w * 0.6 + Math.sin(t * 7 + i) * 2, -14 * fl, Math.sin(t * 5 + i) * 2.4, -(27 - i * 7) * fl); c.quadraticCurveTo(w * 0.7, -12 * fl, w, -4); c.fill(); }
        break;
      }
    }
  };

  SD.drawSolid = function (c, b) {
    const x = b.x, y = b.y, w = b.w, h = b.h;
    if (b.k === 'barrel') {
      c.fillStyle = '#8a5a34'; SD.rr(c, x, y, w, h, 5); c.fill(); c.fillStyle = 'rgba(0,0,0,0.16)'; for (let i = x + 5; i < x + w; i += 5.5) c.fillRect(i, y + 1, 1, h - 2);
      c.fillStyle = '#3a342e'; c.fillRect(x, y + 5, w, 2.6); c.fillRect(x, y + h - 8, w, 2.6); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x + 3, y + 2, 3, h - 4);
    } else if (b.k === 'crate') {
      c.fillStyle = '#b1854f'; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(0,0,0,0.14)'; for (let i = y + 7; i < y + h; i += 7.5) c.fillRect(x, i, w, 1.2);
      c.strokeStyle = '#7a5630'; c.lineWidth = 3.2; c.strokeRect(x + 1.6, y + 1.6, w - 3.2, h - 3.2); c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + w - 3, y + h - 3); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, y, w, 1.6);
    } else if (b.k === 'trough') { c.fillStyle = '#6a4a32'; SD.poly(c, [x, y, x + w, y, x + w - 4, y + h, x + 4, y + h]); c.fill(); c.fillStyle = '#6d9bb0'; c.fillRect(x + 3, y + 2, w - 6, 3.6); }
    else if (b.k === 'rock') {
      c.fillStyle = '#857460'; SD.poly(c, [x - 2, y + h, x + 5, y + h * 0.3, x + w * 0.36, y, x + w * 0.72, y + 3, x + w - 3, y + h * 0.45, x + w + 2, y + h]); c.fill();
      c.fillStyle = '#a3917b'; SD.poly(c, [x + 5, y + h * 0.3, x + w * 0.36, y, x + w * 0.72, y + 3, x + w * 0.5, y + h * 0.42]); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.16)'; SD.poly(c, [x + w * 0.72, y + 3, x + w - 3, y + h * 0.45, x + w + 2, y + h, x + w * 0.6, y + h]); c.fill();
    } else if (b.k === 'wagon') {
      c.fillStyle = '#ece1c6'; c.beginPath(); c.moveTo(x + 4, y + 5); c.bezierCurveTo(x + 6, y - 46, x + w - 6, y - 46, x + w - 4, y + 5); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.13)'; c.lineWidth = 1.4; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x + (w * i) / 5, y + 4); c.quadraticCurveTo(x + (w * i) / 5 + 2, y - 20, x + (w * i) / 5 - (i - 2.5) * 2, y - 33); c.stroke(); }
      c.fillStyle = '#7b5437'; c.fillRect(x - 2, y + 4, w + 4, 13); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 2, y + 10, w + 4, 1.4);
      for (const cx of [x + 17, x + w - 17]) SD.wheel(c, cx, y + h - 10, 10, 0);
    } else if (b.k === 'log') { c.fillStyle = '#6a4a32'; SD.rr(c, x, y, w, h, 7); c.fill(); c.fillStyle = '#b08a5c'; c.beginPath(); c.ellipse(x + w - 1, y + h / 2, 4.4, h / 2 - 0.5, 0, 0, TAU); c.fill(); c.strokeStyle = '#7a5a3c'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + w - 1, y + h / 2, 2.2, h / 4, 0, 0, TAU); c.stroke(); }
    else if (b.k === 'cart') { c.fillStyle = '#5b5e65'; SD.poly(c, [x - 3, y, x + w + 3, y, x + w - 3, y + h - 7, x + 3, y + h - 7]); c.fill(); c.fillStyle = '#3c3e44'; c.fillRect(x - 4, y, w + 8, 3.4); c.fillStyle = '#2a2420'; c.beginPath(); c.arc(x + w / 2 - 6, y - 1, 6, Math.PI, TAU); c.arc(x + w / 2 + 7, y - 1, 5, Math.PI, TAU); c.fill(); for (const cx of [x + 10, x + w - 10]) SD.wheel(c, cx, y + h - 4.5, 4.5, 0); }
  };
  SD.wheel = function (c, x, y, r, rot) {
    c.strokeStyle = '#3a2a1e'; c.lineWidth = r > 6 ? 2.6 : 1.8; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 4; i++) { const a = rot + (i * Math.PI) / 4; c.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke();
    c.fillStyle = '#3a2a1e'; c.beginPath(); c.arc(x, y, r * 0.22, 0, TAU); c.fill();
  };

  /* stagecoach body; horses are drawn by the caller */
  SD.drawCoach = function (c, rot) {
    c.fillStyle = '#7a2e22'; SD.rr(c, -30, -52, 60, 34, 6); c.fill(); c.fillStyle = '#4a2a1a'; c.fillRect(-32, -56, 64, 6); c.fillRect(-30, -22, 60, 5);
    c.fillStyle = '#ecd9a0'; c.fillRect(-21, -46, 15, 14); c.fillRect(6, -46, 15, 14); c.fillStyle = '#2a1d16'; c.fillRect(-4, -48, 8, 28);
    c.fillStyle = '#5a3a26'; c.fillRect(30, -44, 14, 5); c.fillRect(-26, -64, 26, 8); c.fillStyle = '#8a6a44'; c.fillRect(-2, -63, 20, 7);
    SD.wheel(c, -19, -12, 12, rot); SD.wheel(c, 21, -10, 10, rot * 1.2);
  };

  /* far-off train silhouette for the parallax layer. x,y = front bottom; k = scale */
  SD.drawTrain = function (c, x, y, k, t, col, night) {
    c.save(); c.translate(x, y); c.scale(k, k); c.fillStyle = col;
    c.fillRect(-46, -20, 46, 14); c.fillRect(-18, -30, 18, 12); c.fillRect(-40, -30, 5, 11); SD.poly(c, [-48, -8, -58, -4, -46, -4]); c.fill();
    for (const wx of [-40, -28, -12]) { c.beginPath(); c.arc(wx, -4, 4.4, 0, TAU); c.fill(); }
    for (let i = 0; i < 5; i++) { const cx = 6 + i * 44; c.fillRect(cx, -24, 40, 19); for (const wx of [cx + 7, cx + 33]) { c.beginPath(); c.arc(wx, -3.5, 3.6, 0, TAU); c.fill(); } }
    if (night) { c.fillStyle = '#ffcf7a'; for (let i = 1; i < 5; i++) for (let j = 0; j < 4; j++) c.fillRect(11 + i * 44 + j * 8.4, -20, 4.6, 5); c.fillRect(-16, -27, 6, 5); }
    c.fillStyle = 'rgba(235,235,240,0.5)';
    for (let i = 0; i < 9; i++) { const u = (i + (t * 1.4) % 1) / 9; c.globalAlpha = (1 - u) * 0.5; c.beginPath(); c.arc(-37.5 + u * 120, -34 - u * 30 - Math.sin(u * 5) * 3, 4 + u * 13, 0, TAU); c.fill(); }
    c.globalAlpha = 1; c.restore();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
