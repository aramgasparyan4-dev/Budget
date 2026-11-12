/* Sundown Protocol — drawing helpers, colour maths and the time-of-day lighting model. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;
  const cache = {};
  const rgb = (h) => cache[h] || (cache[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const h2 = (v) => (v < 16 ? '0' : '') + (v | 0).toString(16);
  /* mix two #rrggbb colours; returns #rrggbb so results can be mixed again */
  SD.mix = function (a, b, t) {
    const A = rgb(a), B = rgb(b);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return '#' + h2(A[0] + (B[0] - A[0]) * t) + h2(A[1] + (B[1] - A[1]) * t) + h2(A[2] + (B[2] - A[2]) * t);
  };
  SD.shade = (h, k) => SD.mix(h, k < 0 ? '#000000' : '#ffffff', Math.abs(k));
  SD.rgba = (h, a) => { const A = rgb(h); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; };
  SD.hash = function (a, b) {
    let n = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    n ^= n >>> 13; n = Math.imul(n, 0x27d4eb2f); n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  };

  /* a thick round-ended line: the building block for arms, legs, necks and tails */
  SD.limb = function (c, x0, y0, x1, y1, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  /* two-bone limb. Angles are from straight down, positive swings forward (+x). Returns the end point. */
  SD.bone2 = function (c, x, y, a1, l1, a2, l2, w, col) {
    const x1 = x + Math.sin(a1) * l1, y1 = y + Math.cos(a1) * l1, x2 = x1 + Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    return [x2, y2];
  };
  SD.rr = function (c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  SD.poly = function (c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };

  /* Sky keyframes: hour, zenith, mid sky, horizon, warm wash colour + strength, darkness */
  const KEYS = [
    [0, '#060a1c', '#0e1836', '#1a2650', '#000000', 0, 0.6],
    [4.8, '#060a1c', '#0e1836', '#1a2650', '#000000', 0, 0.6],
    [6, '#2b3768', '#a9688c', '#ffab78', '#ff9a7a', 0.14, 0.26],
    [7.6, '#4a8cd2', '#a6cbe8', '#ffe2b6', '#ffd9a8', 0.07, 0],
    [10.5, '#3b8be0', '#8dc5ef', '#f0e4c8', '#ffffff', 0, 0],
    [16, '#478ed9', '#9cc8ea', '#f5ddb0', '#ffe8c0', 0.04, 0],
    [18, '#5570b4', '#f1a26f', '#ffc46e', '#ffac58', 0.17, 0.02],
    [19.3, '#39306c', '#c9595c', '#ff8846', '#ff6e3a', 0.2, 0.2],
    [20.6, '#141a46', '#48386e', '#8a4a6c', '#6a4a9a', 0.1, 0.46],
    [22, '#060a1c', '#0e1836', '#1a2650', '#000000', 0, 0.6],
    [24, '#060a1c', '#0e1836', '#1a2650', '#000000', 0, 0.6],
  ];
  /* Everything the renderer needs to light a frame at a given hour. */
  SD.tod = function (h) {
    let a = KEYS[0], b = KEYS[1];
    for (let i = 1; i < KEYS.length; i++) if (h <= KEYS[i][0]) { a = KEYS[i - 1]; b = KEYS[i]; break; }
    const t = (h - a[0]) / (b[0] - a[0] || 1);
    const day = h >= 5.5 && h < 20, k = day ? (h - 5.5) / 14.5 : ((h - 20 + 24) % 24) / 9.5, arc = Math.sin(Math.PI * Math.max(0, Math.min(1, k)));
    return {
      hour: h, zen: SD.mix(a[1], b[1], t), mid: SD.mix(a[2], b[2], t), hor: SD.mix(a[3], b[3], t),
      wash: SD.mix(a[4], b[4], t), washA: a[5] + (b[5] - a[5]) * t, dark: a[6] + (b[6] - a[6]) * t,
      day, k, arc, sunX: 0.06 + 0.88 * k, sunY: 0.74 - 0.6 * arc,
      sunCol: SD.mix('#ff6a30', '#fff3d2', Math.pow(arc, 0.6)), gold: day ? Math.pow(1 - arc, 3) : 0,
      night: (a[6] + (b[6] - a[6]) * t) > 0.3,
    };
  };

  /* Guns, drawn from the hand along `ang` (world angle). */
  SD.drawGun = function (c, kind, ang, kick) {
    c.save(); c.rotate(ang);
    if (Math.cos(ang) < 0) c.scale(1, -1);
    c.translate(-(kick || 0), 0);
    if (kind === 'rifle') {
      c.fillStyle = '#6b3f22'; SD.poly(c, [-10, -1.5, 2, -2.2, 2, 2.2, -7, 4.5, -11, 3.5]); c.fill();
      c.fillStyle = '#23201f'; c.fillRect(1, -2, 27, 2.6); c.fillRect(1, 0.6, 14, 1.6); c.fillStyle = '#5a5f68'; c.fillRect(3, -2.4, 6, 1);
    } else if (kind === 'shotgun') {
      c.fillStyle = '#6b3f22'; SD.poly(c, [-9, -1.5, 2, -2.4, 2, 2.4, -6, 4.8, -10, 3.6]); c.fill();
      c.fillStyle = '#23201f'; c.fillRect(1, -2.6, 22, 2.3); c.fillRect(1, 0.1, 22, 2.3);
    } else if (kind === 'lasso') {
      c.strokeStyle = '#c9a56a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(6, 1, 6, 4.5, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(6, 1, 4, 3, 0.4, 0, TAU); c.stroke();
    } else {
      c.fillStyle = '#5a3620'; SD.poly(c, [0, -1, 3.5, -1, 2.6, 5.5, -1.2, 5]); c.fill();
      c.fillStyle = '#2a2726'; c.fillRect(2, -2.2, 12, 2.6); c.fillStyle = '#6d727c'; c.fillRect(3.5, -2.8, 4.4, 3.8); c.fillStyle = '#2a2726'; c.fillRect(13, -3, 1, 1);
    }
    c.restore();
  };

  /* soft glow used for lamps, windows, fire and muzzle flashes (draw with 'lighter') */
  SD.glow = function (c, x, y, r, col, a) {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, SD.rgba(col, a)); gr.addColorStop(1, SD.rgba(col, 0));
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
