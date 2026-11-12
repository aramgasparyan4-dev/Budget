/* Sundown Protocol — horses and wildlife as jointed figures with real gaits.
   Draw calls expect the context translated to the feet (centre-bottom), world units. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;

  /* h: {face, vx, vy, t, onGround, saddle, dead}. coat/mane are #rrggbb. */
  SD.drawHorse = function (c, h, coat, mane) {
    coat = coat || '#a5683a'; mane = mane || '#2e1c12';
    const sp = Math.abs(h.vx || 0), t = h.t || 0, far = SD.shade(coat, -0.32), sock = SD.shade(coat, -0.55);
    const gallop = sp > 360, moving = sp > 14, air = h.onGround === false;
    const ph = t * (gallop ? 15 : sp > 150 ? 11.5 : 7), amp = gallop ? 0.95 : moving ? 0.34 + Math.min(0.3, sp / 900) : 0;
    const bob = gallop ? Math.sin(ph) * 1.8 : moving ? Math.abs(Math.sin(ph)) * 0.8 : Math.sin(t * 1.6) * 0.3;
    const pitch = air ? -Math.max(-0.22, Math.min(0.22, (h.vy || 0) / 2600)) : gallop ? Math.sin(ph + 0.6) * 0.055 : 0;
    c.save(); c.scale(h.face || 1, 1);
    if (h.dead) { c.translate(0, -6); c.rotate(1.45); }
    c.translate(0, -bob); c.rotate(pitch);
    const OFF = gallop ? [0, 0.55, 2.9, 3.45] : [0, Math.PI, Math.PI / 2, Math.PI * 1.5];
    const leg = (i, hx, col) => {
      const fore = i > 1, o = ph + OFF[i];
      let a1 = Math.sin(o) * amp, bend = Math.max(0, Math.cos(o)) * amp * 1.25;
      if (air) { a1 = fore ? 0.9 : -0.75; bend = fore ? 1.5 : -0.2; }
      const a2 = fore ? a1 - bend : a1 + bend * 0.45 - (moving ? 0.12 : 0);
      const e = SD.bone2(c, hx, -23, a1, 11.5, a2, 11, fore ? 3.6 : 4, col);
      SD.limb(c, e[0], e[1] - 0.4, e[0] + 0.6, e[1] + 0.9, 3.6, sock);
    };
    leg(0, -16, far); leg(2, 10.5, far);
    // tail streams back with speed
    const tl = Math.min(1, sp / 420), sw = Math.sin(t * (2 + tl * 9)) * (3 - tl * 1.5);
    c.strokeStyle = mane; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, -32);
    c.quadraticCurveTo(-28 - tl * 8, -30 + sw, -27 - tl * 13 + sw, -15 - tl * 12); c.stroke();
    // body
    c.fillStyle = coat;
    c.beginPath(); c.ellipse(-13, -29, 10.5, 9.5, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(12, -29.5, 10.5, 9.8, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0, -29, 17, 8.6, 0, 0, TAU); c.fill();
    c.fillStyle = SD.shade(coat, 0.14); c.beginPath(); c.ellipse(0, -33.5, 15, 3.4, 0, 0, TAU); c.fill();
    // neck and head, with a nod
    const nod = moving ? Math.sin(ph * (gallop ? 1 : 2)) * 1.6 : Math.sin(t * 1.3) * 0.8;
    const nx = 27, ny = -51 + nod;
    c.fillStyle = coat; SD.poly(c, [9, -37, 19, -27, nx + 3, ny + 6, nx - 4, ny - 2]); c.fill();
    SD.poly(c, [nx - 5, ny - 3, nx + 1, ny - 5.5, nx + 13, ny + 2.6, nx + 12.4, ny + 6.4, nx + 2, ny + 6.6]); c.fill();
    c.fillStyle = sock; c.beginPath(); c.ellipse(nx + 12, ny + 4.6, 1.9, 2.3, 0, 0, TAU); c.fill();
    c.fillStyle = coat; SD.poly(c, [nx - 3.6, ny - 3, nx - 2.2, ny - 9, nx + 0.6, ny - 4.2]); c.fill();
    c.fillStyle = '#16100c'; c.beginPath(); c.arc(nx + 4.6, ny + 0.2, 1.1, 0, TAU); c.fill();
    c.fillStyle = mane;
    for (let i = 0; i < 6; i++) { const u = i / 5, mx = 10 + (nx - 13) * u, my = -37 + (ny + 35) * u, fl = tl * 6 + Math.sin(t * 9 + i) * tl * 2; SD.poly(c, [mx - 1, my + 1, mx + 3.4, my - 2.6, mx - 5 - fl, my - 1 + i * 0.5]); c.fill(); }
    leg(1, -12.5, coat); leg(3, 13.5, coat);
    if (h.saddle !== false && !h.dead) {
      c.fillStyle = h.blanket || '#7a2e22'; SD.poly(c, [-10, -37.5, 8, -38, 9.5, -30, -11, -30]); c.fill();
      c.fillStyle = '#5a3620'; c.beginPath(); c.ellipse(-1, -38.6, 8.5, 2.9, 0, 0, TAU); c.fill(); c.fillRect(5.4, -42, 2.2, 4);
      c.strokeStyle = '#3a2416'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -36); c.lineTo(0.6, -24); c.stroke(); c.strokeRect(-1.4, -24, 4, 3);
      c.beginPath(); c.moveTo(6.5, -41); c.quadraticCurveTo(18, -40 + nod * 0.5, nx + 10.5, ny + 5); c.stroke();
    }
    c.restore();
  };

  /* wildlife. a: {kind, face, vx, vy, t, dead, flash, state, onGround} */
  SD.drawAnimal = function (c, a) {
    const t = a.t || 0, sp = Math.abs(a.vx || 0), fl = a.flash > 0, W = '#ffffff';
    const moving = sp > 20, ph = t * (sp > 180 ? 17 : 9), amp = moving ? (sp > 180 ? 0.9 : 0.45) : 0;
    c.save(); c.scale(a.face || 1, 1);
    if (a.dead) { c.translate(0, -a.h * 0.25); c.rotate(1.5); }
    const legs = (xs, hipY, len, w, col, far) => {
      xs.forEach((x, i) => {
        const o = ph + [0, Math.PI, 2.6, 2.6 + Math.PI][i], a1 = Math.sin(o) * amp, a2 = a1 - Math.max(0, Math.cos(o)) * amp * (i > 1 ? 1.1 : -0.5);
        SD.bone2(c, x, hipY, a1, len, a2, len, w, i % 2 ? col : far);
      });
    };
    if (a.kind === 'rabbit') {
      const col = fl ? W : '#b39472', hop = a.onGround === false ? -0.35 : 0;
      c.rotate(hop);
      c.fillStyle = col; c.beginPath(); c.ellipse(-1, -5, 6.2, 4.4, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(5, -8, 3.1, 0, TAU); c.fill();
      SD.limb(c, 4, -10, 2.2 - (moving ? 2 : 0), -16.5, 1.7, col); SD.limb(c, 5.4, -10, 4.6 - (moving ? 2 : 0), -17, 1.7, SD.shade('#b39472', -0.2));
      c.fillStyle = '#f3ece0'; c.beginPath(); c.arc(-7, -5.5, 1.9, 0, TAU); c.fill();
      SD.limb(c, -4, -2, -1 - (moving ? 3 : 0), -0.6, 2, col); SD.limb(c, 3, -3, 5, -0.6, 1.6, col);
      c.fillStyle = '#16100c'; c.fillRect(6, -9, 1, 1);
    } else if (a.kind === 'deer') {
      const col = fl ? W : '#9a6a44', far = fl ? W : '#74502f';
      legs([-11, -9, 9, 11], -20, 10.5, 2.2, col, far);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, -24, 14.5, 6.6, 0, 0, TAU); c.fill();
      c.fillStyle = fl ? W : '#e9dcc6'; c.beginPath(); c.ellipse(-1, -20.4, 10, 2.4, 0, 0, TAU); c.fill();
      const up = a.flee > 0 ? -2 : 0;
      c.fillStyle = col; SD.poly(c, [9, -28, 13.5, -21, 19.5, -37 + up, 15.5, -39 + up]); c.fill();
      SD.poly(c, [14.5, -39.5 + up, 18, -42.5 + up, 25.5, -37.5 + up, 24.4, -35.4 + up, 17.4, -35 + up]); c.fill();
      SD.poly(c, [15, -40 + up, 13.2, -45 + up, 17, -41.4 + up]); c.fill();
      c.fillStyle = '#f3ece0'; c.beginPath(); c.ellipse(-14.5, -26 - (a.flee > 0 ? 3 : 0), 2.2, 3.4, 0.3, 0, TAU); c.fill();
      c.fillStyle = '#16100c'; c.fillRect(20, -39.4 + up, 1.2, 1.2); c.fillRect(24.2, -37.6 + up, 1.3, 1.3);
      if (SD.hash(a.hx | 0, 3) < 0.55) { c.strokeStyle = '#d9c9a8'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); for (const s of [0, 1.6]) { c.moveTo(16 + s, -42 + up); c.lineTo(15 + s, -51 + up); c.lineTo(11.5 + s, -55 + up); c.moveTo(15.4 + s, -48 + up); c.lineTo(19.5 + s, -53 + up); } c.stroke(); }
    } else {
      const wolf = a.kind === 'wolf', base = wolf ? '#7c7f88' : '#b18b5e', col = fl ? W : base, far = fl ? W : SD.shade(base, -0.3), k = wolf ? 1.12 : 1;
      c.scale(k, k);
      legs([-8.5, -7, 7, 8.5], -11, 5.8, 2.1, col, far);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, -13.4, 11.5, 4.8, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(9.5, -15.6, 5, 4.3, -0.3, 0, TAU); c.fill();
      SD.poly(c, [11, -18.5, 20, -15.6, 19.6, -13.6, 11.4, -12.6]); c.fill();
      SD.poly(c, [8, -18.6, 8.6, -23.6, 11.4, -19]); c.fill(); SD.poly(c, [10.6, -19, 12.2, -23, 13.6, -18.4]); c.fill();
      c.strokeStyle = col; c.lineWidth = 3.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10.5, -14.5); c.quadraticCurveTo(-17, -15 + Math.sin(t * 6) * 1.5, -19.5, -9 - (moving ? 4 : 0)); c.stroke();
      c.fillStyle = fl ? W : SD.shade(base, 0.25); c.beginPath(); c.ellipse(1, -10.6, 8, 1.8, 0, 0, TAU); c.fill();
      c.fillStyle = '#16100c'; c.fillRect(14.2, -17.2, 1.2, 1.2); c.fillRect(19.2, -15.6, 1.3, 1.3);
      if (a.state === 'wind') { c.fillStyle = '#ffffff'; SD.poly(c, [15, -13.6, 19.4, -13.6, 17, -11.4]); c.fill(); }
    }
    c.restore();
  };

  /* a bird in flight: wingspan s, flap phase p */
  SD.drawBird = function (c, x, y, s, p) {
    const w = Math.sin(p) * s * 0.55;
    c.beginPath(); c.moveTo(x - s, y - w); c.quadraticCurveTo(x - s * 0.4, y - s * 0.25 - w * 0.2, x, y); c.quadraticCurveTo(x + s * 0.4, y - s * 0.25 - w * 0.2, x + s, y - w); c.stroke();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
