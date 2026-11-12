/* Sundown Protocol — everything behind and in front of the play layer: sky, sun and moon, clouds,
   birds, layered mountains and mesas, a far-off train, foreground silhouettes, rain and dust. Screen space. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2, hash = SD.hash;
  const mod = (a, n) => ((a % n) + n) % n;
  /* smooth value noise along one axis */
  const noise = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; };
  const haze = (base, T, k) => SD.mix(SD.mix(base, T.hor, k), '#050818', Math.min(0.85, T.dark * 1.25));

  /* part 0 = sky, sun, clouds (slow-changing, cached by the renderer); part 1 = mountain layers */
  SD.drawSky = function (c, W, H, z, T, cam, time, hy, part) {
    if (part !== 1) {
    const gr = c.createLinearGradient(0, 0, 0, Math.max(hy, H * 0.5));
    gr.addColorStop(0, T.zen); gr.addColorStop(0.55, T.mid); gr.addColorStop(1, T.hor);
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // stars
    const sa = Math.max(0, Math.min(1, (T.dark - 0.18) * 2.6));
    if (sa > 0) {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 110; i++) { c.globalAlpha = sa * (0.35 + 0.65 * hash(i, 9)) * (0.7 + 0.3 * Math.sin(time * (0.8 + hash(i, 4) * 2) + i)); const s = hash(i, 5) < 0.12 ? 2.2 : 1.3; c.fillRect(hash(i, 1) * W, hash(i, 2) * hy * 0.95, s, s); }
      c.globalAlpha = 1;
    }
    // sun or moon
    const bx = W * T.sunX, by = hy - T.arc * hy * 0.8 + 14;
    if (T.day) {
      const r = 20 + T.gold * 12;
      const sg = c.createRadialGradient(bx, by, r * 0.5, bx, by, r * 11);
      sg.addColorStop(0, SD.rgba(T.sunCol, 0.55)); sg.addColorStop(0.25, SD.rgba(T.sunCol, 0.16)); sg.addColorStop(1, SD.rgba(T.sunCol, 0));
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      if (T.gold > 0.15) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = SD.rgba(T.sunCol, 0.05 * T.gold);
        for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.42 + Math.sin(time * 0.1 + i) * 0.05, L = Math.max(W, H); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * L, by + Math.sin(a) * L * 0.6); c.lineTo(bx + Math.cos(a + 0.13) * L, by + Math.sin(a + 0.13) * L * 0.6); c.fill(); }
        const band = c.createLinearGradient(0, hy - 120, 0, hy + 30); band.addColorStop(0, SD.rgba(T.sunCol, 0)); band.addColorStop(0.75, SD.rgba(T.sunCol, 0.28 * T.gold)); band.addColorStop(1, SD.rgba(T.sunCol, 0));
        c.fillStyle = band; c.fillRect(0, hy - 120, W, 150); c.restore();
      }
      c.fillStyle = SD.mix(T.sunCol, '#ffffff', 0.5); c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill();
    } else {
      SD.glow(c, bx, by, 130, '#b9c8ff', 0.22);
      c.fillStyle = '#eef0f8'; c.beginPath(); c.arc(bx, by, 17, 0, TAU); c.fill();
      c.fillStyle = 'rgba(150,160,190,0.5)'; for (const [ox, oy, r] of [[-5, -4, 3.4], [6, 3, 2.6], [-2, 7, 2]]) { c.beginPath(); c.arc(bx + ox, by + oy, r, 0, TAU); c.fill(); }
    }
    // clouds: three drifting layers, lit from above and shaded underneath
    const lit = SD.mix(SD.mix('#ffffff', T.hor, 0.3 + T.gold * 0.4), '#1a2248', Math.min(0.8, T.dark * 1.3)), und = SD.mix(SD.mix(T.mid, '#7a6a8a', 0.3), '#0a1030', Math.min(0.8, T.dark * 1.2));
    for (let L = 0; L < 3; L++) {
      const span = W + 600, sp = 5 + L * 4, n = 4 + L;
      for (let i = 0; i < n; i++) {
        const x = mod(hash(i, 20 + L) * span - cam.x * (0.012 + L * 0.008) * z + time * sp, span) - 300, y = hy * (0.1 + 0.16 * L + hash(i, 30 + L) * 0.16), s = (1.3 - L * 0.25) * (0.7 + hash(i, 40 + L) * 0.7);
        for (let pass = 0; pass < 2; pass++) {
          c.fillStyle = pass ? lit : und; c.globalAlpha = 0.9 - L * 0.12;
          c.beginPath();
          for (let k = 0; k < 6; k++) { const px = x + (k - 2.5) * 30 * s, py = y + (pass ? -5 * s : 0) - Math.sin((k / 5) * Math.PI) * 13 * s * (0.6 + hash(i * 7 + k, L)), rx = (30 + hash(k, i + L) * 22) * s, ry = (10 + hash(k + 3, i) * 9) * s * (pass ? 0.8 : 1); c.moveTo(px + rx, py); c.ellipse(px, py, rx, ry, 0, 0, TAU); }
          c.fill();
        }
      }
    }
    c.globalAlpha = 1;
    // a few birds by day
    if (T.dark < 0.3) {
      c.strokeStyle = SD.rgba('#1c1a22', 0.7); c.lineWidth = 1.4; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const span = W + 500, x = mod(time * (26 + i) + i * 47 + hash(i, 61) * 900 - cam.x * 0.03 * z, span * 2.4) - 200, y = hy * (0.26 + hash(i, 62) * 0.2) + Math.sin(time * 0.7 + i) * 8; if (x < W + 40) SD.drawBird(c, x, y, 5.5 + hash(i, 63) * 2.5, time * 8 + i * 1.7); }
    }
    }
    if (part === 0) return;
    const green = cam.x > 6100;
    // far ranges
    for (let L = 0; L < 2; L++) {
      const par = 0.045 + L * 0.045, cell = 230 * z, off = cam.x * par * z;
      c.fillStyle = haze(L ? (green ? '#4a6470' : '#8a6a78') : '#7a86b4', T, L ? 0.42 : 0.6);
      c.beginPath(); c.moveTo(0, H);
      for (let sx = 0; sx <= W + 16; sx += 14) { const wx = (sx + off) / cell; c.lineTo(sx, hy - (26 + noise(wx, 70 + L) * 120 + noise(wx * 3.1, 80 + L) * 34 + noise(wx * 9, 90 + L) * 9) * z * (L ? 0.62 : 0.85) + (L ? 4 : -6) * z); }
      c.lineTo(W, H); c.fill();
    }
    // mesas and buttes (desert) or wooded ridges (river country)
    const par = 0.16, cell = 380 * z, off = cam.x * par * z, i0 = Math.floor(off / cell) - 1, base = hy + 6 * z;
    const rock = haze(green ? '#44604c' : '#b46540', T, 0.4), rockLit = haze(green ? '#5a7a5e' : '#d98a58', T, 0.36), rockDark = haze(green ? '#30483a' : '#8c4a32', T, 0.4);
    const sunLeft = T.sunX < 0.5;
    for (let i = i0; i < i0 + Math.ceil(W / cell) + 3; i++) {
      if (hash(i, 101) < 0.34) continue;
      const x = i * cell - off + hash(i, 102) * cell * 0.4, w = (150 + hash(i, 103) * 190) * z, h = (58 + hash(i, 104) * 104) * z, tal = 34 * z, ty = base - h;
      if (green) {
        c.fillStyle = rock; c.beginPath(); c.moveTo(x - tal, base);
        for (let s = 0; s <= w; s += 5 * z) c.lineTo(x + s, ty + h * 0.55 * (1 - Math.sin((s / w) * Math.PI)) - (Math.floor(s / (5 * z)) % 2 ? (3 + hash(i * 31 + s / z, 7) * 6) * z : 0));
        c.lineTo(x + w + tal, base); c.fill(); continue;
      }
      const step = h * (0.3 + hash(i, 105) * 0.2), sw = w * (0.2 + hash(i, 106) * 0.2);
      c.fillStyle = rock; SD.poly(c, [x - tal, base, x, base - step * 0.5, x + 4 * z, ty + step, x + sw, ty + step - 3 * z, x + sw + 3 * z, ty, x + w - 5 * z, ty + 2 * z, x + w, base - step * 0.55, x + w + tal, base]); c.fill();
      c.fillStyle = sunLeft ? rockLit : rockDark; SD.poly(c, [x - tal, base, x, base - step * 0.5, x + 4 * z, ty + step, x + 14 * z, ty + step, x + 12 * z, base]); c.fill();
      c.fillStyle = sunLeft ? rockDark : rockLit; SD.poly(c, [x + w - 16 * z, ty + 2 * z, x + w - 5 * z, ty + 2 * z, x + w, base - step * 0.55, x + w + tal, base, x + w - 12 * z, base]); c.fill();
      c.fillStyle = SD.rgba('#000000', 0.07); for (let k = 1; k < 3; k++) c.fillRect(x + sw + 4 * z + hash(i, k) * 20 * z, ty + (h * k) / 3.4, (w - sw - 10 * z) * (0.5 + hash(i, k + 9) * 0.4), 1.6 * z);
      c.fillStyle = rockLit; c.fillRect(x + sw + 3 * z, ty, w - sw - 8 * z, 2.4 * z);
    }
    // near hills with a scatter of silhouettes, and now and then a train
    const p3 = 0.36, c3 = 300 * z, o3 = cam.x * p3 * z, hillC = haze(green ? '#3f5a40' : '#9a6a44', T, 0.22), sil = haze(green ? '#27402e' : '#5c4a30', T, 0.18);
    const hillY = (sx) => hy + 8 * z - (noise((sx + o3) / c3, 120) * 34 + noise((sx + o3) / c3 * 2.7, 121) * 10) * z;
    c.fillStyle = hillC; c.beginPath(); c.moveTo(0, H); for (let sx = 0; sx <= W + 12; sx += 12) c.lineTo(sx, hillY(sx)); c.lineTo(W, H); c.fill();
    const tx = W + 260 * z - mod(time * 34 * z, W * 2.6 + 2400 * z);
    if (tx > -280 * z && tx < W + 80) SD.drawTrain(c, tx, hillY(Math.max(0, Math.min(W, tx + 80))) + 2, z * 0.62, time, sil, T.night);
    c.fillStyle = sil; c.strokeStyle = sil; c.lineCap = 'round';
    const j0 = Math.floor(o3 / (64 * z)) - 1;
    for (let j = j0; j < j0 + Math.ceil(W / (64 * z)) + 3; j++) {
      if (hash(j, 130) < 0.45) continue;
      const sx = j * 64 * z - o3 + hash(j, 131) * 40 * z, y = hillY(sx) + 2, s = (0.5 + hash(j, 132) * 0.4) * z;
      if (green) { for (let k = 0; k < 3; k++) { const w = (9 - k * 2.4) * s * 2; SD.poly(c, [sx - w, y - k * 12 * s, sx, y - (k * 12 + 24) * s, sx + w, y - k * 12 * s]); c.fill(); } }
      else if (hash(j, 133) < 0.6) { c.lineWidth = 5 * s; c.beginPath(); c.moveTo(sx, y); c.lineTo(sx, y - 30 * s); c.moveTo(sx - 8 * s, y - 12 * s); c.lineTo(sx - 8 * s, y - 22 * s); c.moveTo(sx - 8 * s, y - 12 * s); c.lineTo(sx, y - 12 * s); c.stroke(); }
      else { c.beginPath(); c.ellipse(sx, y - 4 * s, 13 * s, 6 * s, 0, 0, TAU); c.fill(); }
    }
  };

  /* dark shapes sliding past close to the camera */
  SD.drawFore = function (c, W, H, z, T, cam) {
    const par = 1.5, cell = 340 * z, off = cam.x * par * z, i0 = Math.floor(off / cell) - 1;
    c.fillStyle = SD.rgba(SD.mix('#140c08', '#04050e', Math.min(1, T.dark * 1.6)), 0.6); c.strokeStyle = c.fillStyle; c.lineCap = 'round';
    for (let i = i0; i < i0 + Math.ceil(W / cell) + 3; i++) {
      const wx = (i * cell) / (par * z);
      if (hash(i, 201) < 0.5 || SD.inTown(wx + cam.w / 2)) continue;
      const x = i * cell - off + hash(i, 202) * cell * 0.5, k = z * (0.9 + hash(i, 203) * 0.6), v = hash(i, 204);
      if (v < 0.6) { c.lineWidth = 1.5 * k; c.beginPath(); for (let b = -4; b <= 4; b++) { c.moveTo(x + b * 5 * k, H + 4); c.quadraticCurveTo(x + b * 6 * k, H - 12 * k, x + b * 9 * k + Math.sin(b * 2.1) * 5, H - (16 + (b & 1) * 12) * k); } c.stroke(); }
      else { c.beginPath(); c.ellipse(x, H + 8 * k, 44 * k, 22 * k, 0, 0, TAU); c.fill(); }
    }
  };

  SD.drawWeather = function (c, W, H, kind, amt, time, flash) {
    if (kind === 'rain') {
      c.fillStyle = 'rgba(30,40,62,' + 0.26 * amt + ')'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(200,218,240,' + 0.4 * amt + ')'; c.lineWidth = 1.2; c.beginPath();
      for (let i = 0; i < 130; i++) { const x = mod(hash(i, 301) * W * 1.3 - time * 420, W * 1.3) - W * 0.15, y = mod(hash(i, 302) * H + time * (900 + hash(i, 303) * 400), H + 40) - 20; c.moveTo(x, y); c.lineTo(x - 7, y + 20); }
      c.stroke();
      if (flash > 0) { c.fillStyle = 'rgba(235,240,255,' + Math.min(0.55, flash * 2.4) + ')'; c.fillRect(0, 0, W, H); }
    } else if (kind === 'dust') {
      c.fillStyle = 'rgba(196,150,96,' + 0.2 * amt + ')'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(226,190,140,' + 0.16 * amt + ')';
      for (let i = 0; i < 46; i++) { const x = mod(hash(i, 311) * W * 1.4 + time * (260 + hash(i, 312) * 300), W * 1.4) - W * 0.2, y = hash(i, 313) * H + Math.sin(time * 2 + i) * 14; c.fillRect(x, y, 60 + hash(i, 314) * 120, 1.6); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
