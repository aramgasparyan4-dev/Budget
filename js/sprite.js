/* Neural Kick — pixel sprites, all drawn from rectangles (1 sprite pixel = 2 world units).
   Every draw call expects the context translated to the sprite's feet centre. */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});
  const TAU = Math.PI * 2, U = 2;
  // px(x, y, w, h): x from the centre line, y measured up from the feet
  const px = (c, x, y, w, h) => c.fillRect(x * U, -(y + h) * U, w * U, h * U);

  /* The hero: a little orange pixel critter with four legs.
     o = {face, anim: idle|run|air|slide|roll, t, rot, flash} */
  NK.drawHero = function (c, o) {
    const body = o.flash ? '#ffffff' : '#d97757', shade = o.flash ? '#ffffff' : '#b9603f', eye = '#1b1410';
    const f = o.face || 1;
    c.save();
    if (o.anim === 'roll') { c.translate(0, -11); c.rotate(o.rot || 0); c.translate(0, 9); }
    let a = 2, b = 2, lift = 0;
    if (o.anim === 'run') { const k = Math.floor(o.t * 12) % 2; a = k ? 2 : 1; b = k ? 1 : 2; lift = k ? 0 : 0.5; }
    else if (o.anim === 'air') { a = 1; b = 1; lift = 1; }
    else if (o.anim === 'roll') { a = 0; b = 0; lift = 1; }
    else if (o.anim === 'idle') lift = Math.floor(o.t * 2) % 2 ? 0 : 0.5;
    c.fillStyle = shade;
    if (a) { px(c, -5, 2 - a + lift, 1, a); px(c, 2, 2 - a + lift, 1, a); }
    if (b) { px(c, -3, 2 - b + lift, 1, b); px(c, 4, 2 - b + lift, 1, b); }
    c.fillStyle = body;
    px(c, -5, 2 + lift, 10, 8);
    px(c, -7, 5 + lift, 14, 2);
    c.fillStyle = shade; px(c, -5, 2 + lift, 10, 1);
    c.fillStyle = eye;
    const blink = o.anim === 'idle' && o.t % 3.2 > 3.05;
    px(c, -3 + (f > 0 ? 1 : 0), 6.5 + lift, 1, blink ? 0.5 : 2);
    px(c, 2 + (f > 0 ? 1 : 0), 6.5 + lift, 1, blink ? 0.5 : 2);
    c.restore();
  };

  /* Weapon swing. prog 0..1 through the swing, n = combo step. Drawn at the hero's centre. */
  NK.drawSwing = function (c, id, face, prog, n, reach) {
    const W = NK.WEAPONS[id], R = W.range * reach, e = 1 - (1 - prog) * (1 - prog);
    c.save(); c.scale(face, 1);
    c.fillStyle = W.color; c.strokeStyle = W.color;
    if (id === 'pike') {
      const len = 14 + (R - 8) * Math.sin(Math.min(1, prog * 1.6) * Math.PI * 0.5);
      c.fillRect(4, -2, len, 3);
      c.beginPath(); c.moveTo(4 + len, -5); c.lineTo(4 + len + 10, -0.5); c.lineTo(4 + len, 4); c.fill();
      c.globalAlpha = 0.35 * (1 - prog); c.fillRect(4, -7, len, 13);
    } else {
      const up = id === 'sledge' ? true : n % 2 === 0;
      const a0 = up ? -2.0 : 1.5, a1 = up ? 1.1 : -1.4, a = a0 + (a1 - a0) * e;
      c.globalAlpha = 0.5 * (1 - prog);
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, Math.min(a0, a), Math.max(a0, a)); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.rotate(a);
      c.fillRect(6, -1.5, R - 8, id === 'sledge' ? 4 : 3);
      if (id === 'sledge') c.fillRect(R - 16, -8, 14, 16);
      c.fillStyle = '#5b4636'; c.fillRect(2, -2.5, 6, 5);
    }
    c.restore();
  };

  /* Small weapon icon in a size x size box centred on 0,0 (HUD, pickups, shop). */
  NK.drawWeaponIcon = function (c, id, s) {
    const W = NK.WEAPONS[id], k = s / 24;
    c.save(); c.scale(k, k); c.fillStyle = W.color;
    if (W.kind === 'gun') { c.fillRect(-9, -4, 16, 6); c.fillRect(-9, 2, 5, 7); c.fillStyle = '#ffffff'; c.fillRect(7, -3, 3, 4); }
    else if (W.kind === 'bomb') { c.beginPath(); c.arc(0, 2, 8, 0, TAU); c.fill(); c.fillStyle = '#ffd75e'; c.fillRect(-1, -11, 3, 5); }
    else {
      c.rotate(-Math.PI / 4);
      if (id === 'sledge') { c.fillRect(-10, -1.5, 16, 3); c.fillRect(4, -7, 8, 14); }
      else if (id === 'pike') { c.fillRect(-12, -1, 19, 2.5); c.beginPath(); c.moveTo(6, -4); c.lineTo(13, 0); c.lineTo(6, 4); c.fill(); }
      else if (id === 'daggers') { c.fillRect(-9, -5, 13, 3); c.fillRect(-4, 3, 13, 3); c.fillStyle = '#5b4636'; c.fillRect(-11, -5.5, 3, 4); c.fillRect(-6, 2.5, 3, 4); }
      else { c.fillRect(-6, -1.5, 18, 3.5); c.fillStyle = '#5b4636'; c.fillRect(-11, -1.5, 5, 3.5); c.fillRect(-6.5, -5, 2.5, 10); }
    }
    c.restore();
  };

  function eyes(c, x1, x2, y, f, col) {
    c.fillStyle = '#ffffff'; px(c, x1, y, 2, 2); px(c, x2, y, 2, 2);
    c.fillStyle = col || '#1b1410'; px(c, x1 + (f > 0 ? 1 : 0), y, 1, 1); px(c, x2 + (f > 0 ? 1 : 0), y, 1, 1);
  }

  /* e = enemy record (type, dir, t, state, flash, elite, hp...) */
  NK.drawEnemy = function (c, e) {
    const f = e.dir || 1, hit = e.flash > 0, wind = e.state === 'wind';
    const col = (base) => (hit ? '#ffffff' : wind && Math.floor(e.t * 20) % 2 ? '#fff2a8' : base);
    c.save();
    if (e.elite) { c.scale(1.25, 1.25); }
    if (e.type === 'bug') {
      const k = Math.floor(e.t * 10) % 2;
      c.fillStyle = '#2a1016'; px(c, -5, 0, 1, k ? 2 : 1); px(c, -1, 0, 1, k ? 1 : 2); px(c, 3, 0, 1, k ? 2 : 1);
      c.fillStyle = col('#e5484d'); px(c, -6, 2, 13, 7); px(c, -5, 9, 11, 1);
      c.fillStyle = hit ? '#ffffff' : '#9b2226'; px(c, -6 + (f > 0 ? 0 : 4), 6, 9, 3);
      eyes(c, f > 0 ? 2 : -6, f > 0 ? 5 : -3, 4, f);
    } else if (e.type === 'wisp') {
      const w = Math.floor(e.t * 8) % 2;
      c.globalAlpha = 0.88; c.fillStyle = col('#d8c8ff');
      px(c, -2, 10, 4, 1); px(c, -4, 8, 8, 2); px(c, -5, 4, 10, 4); px(c, -4, 2, 8, 2); px(c, -2 - w, 0, 3, 2); px(c, 1 + w, -2, 2, 2);
      c.globalAlpha = 1; c.fillStyle = '#ffffff'; px(c, -2 + (f > 0 ? 1 : 0), 5, 3, 3);
      c.fillStyle = '#2b1d52'; px(c, -1 + (f > 0 ? 2 : 0), 5, 1, 2);
    } else if (e.type === 'glitch') {
      const j = (n) => (Math.floor(e.t * 14 + n * 3) % 5 === 0 ? (n % 2 ? 2 : -2) : 0);
      c.fillStyle = col('#3fe0d0'); px(c, -5 + j(1), 7, 10, 4); px(c, -5 + j(3), 0, 10, 3);
      c.fillStyle = col('#ff4fd8'); px(c, -5 + j(2), 3, 10, 4);
      eyes(c, -3, 1, 7, f);
    } else if (e.type === 'spam') {
      c.fillStyle = '#3a3f58'; px(c, -5, 0, 10, 3);
      c.fillStyle = col('#c9cede'); px(c, -6, 3, 12, 8);
      c.fillStyle = '#e5484d'; px(c, -1, 11, 2, 3);
      c.fillStyle = wind ? '#ffd75e' : '#ff5d73'; px(c, -2, 14, 4, 2);
      c.fillStyle = '#1b1410'; px(c, -4, 6, 8, 3);
      c.fillStyle = wind ? '#ffd75e' : '#ff5d73'; px(c, f > 0 ? 0 : -3, 7, 3, 1);
    } else if (e.type === 'bloat') {
      c.fillStyle = col('#7a4b8c'); px(c, -9, 0, 19, 17); px(c, -7, 17, 15, 3);
      c.fillStyle = hit ? '#ffffff' : '#5a3468'; px(c, -9, 0, 19, 3);
      const armY = wind || e.state === 'attack' ? 16 : 6;
      c.fillStyle = col('#9a63ad'); px(c, -12, armY, 3, 7); px(c, 10, armY, 3, 7);
      eyes(c, f > 0 ? 0 : -6, f > 0 ? 5 : -1, 12, f);
      c.fillStyle = '#1b1410'; px(c, f > 0 ? -1 : -6, 6, 8, 2);
    } else if (e.type === 'boss') {
      c.fillStyle = col('#2a1a2e'); px(c, -15, 0, 31, 24); px(c, -12, 24, 25, 5);
      c.fillStyle = col('#e5484d'); px(c, -15, 24, 3, 6); px(c, 13, 24, 3, 6); px(c, -15, 0, 31, 2);
      c.fillStyle = e.hp < e.maxhp * 0.5 ? '#ffd75e' : '#ff5d73';
      px(c, -10, 15, 21, 4);
      c.fillStyle = '#1b1410'; px(c, f > 0 ? 2 : -7, 16, 5, 2);
      c.fillStyle = '#ff5d73';
      for (let i = 0; i < 5; i++) px(c, -10 + i * 5, 6 + ((i + Math.floor(e.t * 6)) % 2), 2, 3);
    }
    c.restore();
  };

  /* world items: coin, core, heart, chip, chest, weapon drop */
  NK.drawItem = function (c, kind, t, open) {
    if (kind === 'gold') { c.fillStyle = '#ffd75e'; c.fillRect(-3, -7, 6, 6); c.fillStyle = '#fff6d8'; c.fillRect(-3, -7, 2, 2); }
    else if (kind === 'core') { c.fillStyle = '#5ee6ff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(5, -6); c.lineTo(0, -1); c.lineTo(-5, -6); c.fill(); c.fillStyle = '#e8fbff'; c.fillRect(-1, -8, 2, 2); }
    else if (kind === 'heal') { c.fillStyle = '#7cf0a0'; c.fillRect(-2, -11, 4, 10); c.fillRect(-5, -8, 10, 4); }
    else if (kind === 'chip') {
      const y = -20 + Math.sin(t * 3) * 3;
      c.fillStyle = '#7cf0c8'; c.fillRect(-9, y - 9, 18, 18);
      c.fillStyle = '#0b2a22'; c.fillRect(-5, y - 5, 10, 10);
      c.fillStyle = '#ffd75e'; for (let i = -1; i <= 1; i++) { c.fillRect(i * 6 - 1, y - 13, 2, 4); c.fillRect(i * 6 - 1, y + 9, 2, 4); }
    } else if (kind === 'chest') {
      c.fillStyle = '#6b4a2b'; c.fillRect(-14, -18, 28, 18);
      c.fillStyle = open ? '#1b1410' : '#8a6238'; c.fillRect(-14, open ? -26 : -18, 28, open ? 8 : 7);
      c.fillStyle = '#ffd75e'; c.fillRect(-14, -12, 28, 2); c.fillRect(-2, -14, 4, 6);
    }
  };

  NK.drawDoor = function (c, locked, t, edge) {
    c.fillStyle = '#0a0c1c'; c.fillRect(-18, -56, 36, 56);
    c.fillStyle = locked ? '#ff5d73' : edge; c.fillRect(-20, -58, 40, 4); c.fillRect(-20, -58, 4, 58); c.fillRect(16, -58, 4, 58);
    if (!locked) {
      c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 4); c.fillRect(-16, -54, 32, 54); c.globalAlpha = 1;
      c.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) c.fillRect(-12 + ((i * 9 + t * 20) % 24), -50 + ((i * 17 + t * 30) % 46), 2, 2);
    } else { c.fillStyle = '#ff5d73'; c.fillRect(-4, -34, 8, 10); c.fillRect(-2, -40, 4, 6); }
  };

  /* draw the hero into a standalone canvas (menu portrait) */
  NK.heroPortrait = function (cv, t) {
    const c = cv.getContext('2d'), k = cv.width / 44;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, cv.width / 2, cv.height * 0.84);
    NK.drawHero(c, { face: 1, anim: 'idle', t });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
