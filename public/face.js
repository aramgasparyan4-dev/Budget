// The face: a chrome machine bust drawn on a canvas. Tall ridged head, red
// slit eyes, a jaw that moves with speech, exposed neck, armoured shoulders
// with red light leaking through the seams.
//
// It reacts to four states (offline, idle, listening, thinking, speaking) and
// to a 0..1 "voice" level that drives the jaw while speech is playing.
//
// All shapes are in "unit space": the head centre is (0, 0), y grows downward,
// and one unit is the scale `s` in pixels. Shapes list the right half only and
// are mirrored.

const RED = [255, 38, 30];
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${Math.max(0, a)})`;
const mix = (a, b, t) => a + (b - a) * t;

// ---------- shapes (right half; a third value of true marks a sharp corner) ----------

// Whole-outline shapes start and end on the centre line and get mirrored.
const HEAD = [
  [0, -1.26], [0.2, -1.24], [0.36, -1.12], [0.46, -0.9], [0.51, -0.6],
  [0.545, -0.32], [0.56, -0.08], [0.53, 0.14], [0.46, 0.34], [0.4, 0.52],
  [0.33, 0.66, true], [0.25, 0.57], [0.21, 0.5, true], [0, 0.49],
];
const CREST = [
  [0, -1.275], [0.075, -1.25], [0.095, -0.92], [0.085, -0.55], [0.05, -0.3, true], [0, -0.2],
];
const NOSE = [
  [0, -0.17], [0.035, -0.08], [0.045, 0.18], [0.075, 0.3], [0.05, 0.36, true], [0, 0.35],
];
const UPPER_LIP = [[0, 0.38], [0.14, 0.4], [0.22, 0.45], [0.21, 0.5, true], [0, 0.49]];
const JAW = [
  [0, 0.545], [0.2, 0.545, true], [0.3, 0.6], [0.31, 0.74, true], [0.2, 0.93], [0.08, 1.0, true], [0, 1.01],
];
const CAVITY = [[0, 0.43], [0.24, 0.45, true], [0.27, 0.62], [0.22, 0.8], [0, 0.82]];
const NECK = [[0, 0.6], [0.25, 0.62, true], [0.28, 0.95], [0.33, 1.32, true], [0, 1.34]];
const CORE = [[0, 1.3], [0.04, 1.34], [0.035, 2.0], [0.03, 3.05], [0, 3.1]];

// Side-only shapes (drawn once per side).
const FIN = [[0.4, -0.8], [0.6, -0.6], [0.69, -0.25], [0.65, 0.08], [0.5, 0.32], [0.44, -0.1]];
const SOCKET = [
  [0.06, -0.1, true], [0.2, -0.24], [0.47, -0.37, true], [0.51, -0.22], [0.39, -0.05], [0.17, 0.01, true],
];
const TRAP = [
  [0.24, 0.8, true], [0.58, 0.94], [1.02, 1.1], [1.44, 1.22], [1.36, 1.42], [0.72, 1.32], [0.26, 1.3, true],
];
// Shoulder armour as overlapping bands, listed bottom band first.
const PAULDRON = [
  [[1.24, 1.9], [1.7, 2.08], [1.94, 2.5], [1.88, 3.05], [1.5, 3.05], [1.3, 2.5]],
  [[1.14, 1.66], [1.5, 1.68], [1.86, 1.88], [2.04, 2.34], [1.9, 2.5], [1.62, 2.2], [1.36, 2.06], [1.18, 2.02]],
  [[1.07, 1.4], [1.45, 1.34], [1.84, 1.5], [2.07, 1.9], [1.96, 2.02], [1.63, 1.8], [1.3, 1.73], [1.1, 1.72]],
  [[1.0, 1.16], [1.46, 1.05], [1.87, 1.25], [2.05, 1.62], [1.76, 1.55], [1.4, 1.43], [1.04, 1.46]],
];
const CHEST = [
  [0.035, 1.36, true], [0.5, 1.3], [1.0, 1.45, true], [1.22, 1.85], [1.12, 2.3, true], [0.62, 2.46], [0.035, 2.5, true],
];
const ABS = [0, 1].map((i) => {
  const y = 2.58 + i * 0.3;
  return [[0.035, y, true], [0.44, y - 0.02], [0.6, y + 0.1, true], [0.5, y + 0.25, true], [0.035, y + 0.25, true]];
});

// Grooves cut into the plates (open curves, right side).
const HEAD_RIDGES = [
  [[0.125, -1.235], [0.17, -0.88], [0.17, -0.55], [0.12, -0.3]],
  [[0.23, -1.21], [0.29, -0.88], [0.3, -0.56], [0.25, -0.36]],
  [[0.33, -1.14], [0.4, -0.86], [0.42, -0.55], [0.41, -0.38]],
  [[0.42, -0.98], [0.48, -0.74], [0.51, -0.48]],
];
const CHEEK_LINES = [
  [[0.4, -0.05], [0.44, 0.12], [0.39, 0.32], [0.31, 0.56]],
  [[0.17, 0.03], [0.21, 0.18], [0.21, 0.34], [0.24, 0.47]],
];
const FIN_LINES = [[[0.49, -0.6], [0.6, -0.3], [0.57, 0.06]]];
const TRAP_LINES = [
  [[0.34, 0.92], [0.72, 1.06], [1.28, 1.24]],
  [[0.32, 1.12], [0.72, 1.2], [1.18, 1.34]],
];
const PAULDRON_LINES = [
  [[1.12, 1.25], [1.5, 1.17], [1.84, 1.36]],
  [[1.18, 1.52], [1.5, 1.48], [1.84, 1.66], [1.98, 1.9]],
  [[1.24, 1.8], [1.55, 1.82], [1.84, 2.02], [1.96, 2.36]],
];
const CHEST_LINES = [
  [[0.18, 1.48], [0.55, 1.44], [0.92, 1.56], [1.08, 1.86]],
  [[0.2, 1.78], [0.56, 1.74], [0.94, 1.88], [1.04, 2.18]],
  [[0.36, 2.0], [0.4, 2.2], [0.5, 2.38]],
];
const GLOW_SEAMS = [
  [[0.14, 1.33], [0.55, 1.31], [1.0, 1.43]], // collar
  [[1.02, 1.48], [1.21, 1.86], [1.12, 2.28]], // between chest and shoulder
  [[0.1, 2.53], [0.6, 2.5], [1.08, 2.33]], // under the chest plate
  [[0.27, 0.95], [0.3, 1.12], [0.33, 1.3]], // neck edge
  [[0.1, 2.84], [0.4, 2.84], [0.6, 2.72]], // between the ab plates
];
const PAULDRON_SEAMS = [
  [[1.1, 1.45], [1.45, 1.4], [1.8, 1.56], [2.02, 1.92]],
  [[1.16, 1.72], [1.52, 1.72], [1.86, 1.94]],
];

function mirrored(half) {
  const left = half.slice(1, -1).reverse().map(([x, y, c]) => [-x, y, c]);
  return [...half, ...left];
}

const HEAD_M = mirrored(HEAD);
const CREST_M = mirrored(CREST);
const NOSE_M = mirrored(NOSE);
const LIP_M = mirrored(UPPER_LIP);
const JAW_M = mirrored(JAW);
const CAVITY_M = mirrored(CAVITY);
const NECK_M = mirrored(NECK);
const CORE_M = mirrored(CORE);

// Polished steel with a cool cast: bright reflection streaks between dark bands.
const CHROME = [
  [0, "#12161c"], [0.1, "#38404b"], [0.22, "#8e98a4"], [0.31, "#dfe5ec"], [0.38, "#808a96"],
  [0.5, "#353c46"], [0.63, "#59626e"], [0.74, "#a3adb9"], [0.82, "#4d5560"], [1, "#0f1217"],
];

export function createFace(canvas) {
  const screen = canvas.getContext("2d");
  // Drawing helpers use `ctx`, which points at the screen or at an offscreen
  // canvas while a static layer is being pre-rendered.
  let ctx = screen;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let px = 1; // pixels per unit
  let cx = 0;
  let cy = 0;
  let layers = null; // pre-rendered static parts, rebuilt on resize

  let state = "offline";
  let voiceTarget = 0;
  let voice = 0;
  let power = 0; // 0 dormant .. 1 awake
  let focus = 0; // thinking
  let alert = 0; // listening
  let lookX = 0;
  let lookY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let blink = 0;
  let nextBlink = 3;
  let last = performance.now();

  const embers = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    drift: (Math.random() - 0.5) * 0.02,
  }));

  // ---------- path helpers ----------

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  function closed(p) {
    const n = p.length;
    ctx.beginPath();
    const start = mid(p[n - 1], p[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const cur = p[i];
      const m = mid(cur, p[(i + 1) % n]);
      if (cur[2]) {
        ctx.lineTo(cur[0], cur[1]);
        ctx.lineTo(m[0], m[1]);
      } else {
        ctx.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
      }
    }
    ctx.closePath();
  }

  function open(p) {
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const m = mid(p[i], p[i + 1]);
      ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    const end = p[p.length - 1];
    ctx.lineTo(end[0], end[1]);
  }

  function bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of p) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }

  // Draws `fn` for the right side, then mirrored for the left.
  function bothSides(fn) {
    fn(1);
    ctx.save();
    ctx.scale(-1, 1);
    fn(-1);
    ctx.restore();
  }

  // ---------- materials ----------

  function metal(p, { shade = 0.45, redLight = 0, bright = 1 } = {}) {
    const b = bounds(p);
    closed(p);
    const g = ctx.createLinearGradient(b.x0, 0, b.x1, 0);
    for (const [o, c] of CHROME) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fill();

    // Light from above, falling off toward the bottom of each plate.
    const v = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    v.addColorStop(0, `rgba(255,255,255,${0.08 * bright})`);
    v.addColorStop(0.45, "rgba(0,0,0,0.04)");
    v.addColorStop(1, `rgba(0,0,0,${shade})`);
    ctx.fillStyle = v;
    ctx.fill();

    // Cool ambient tint.
    ctx.fillStyle = "rgba(40,75,120,0.14)";
    ctx.fill();

    if (redLight > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const r = ctx.createRadialGradient(0, 1.75, 0, 0, 1.75, 1.7);
      r.addColorStop(0, rgba(RED, redLight));
      r.addColorStop(1, rgba(RED, 0));
      ctx.fillStyle = r;
      ctx.fill();
      ctx.restore();
    }

    ctx.lineWidth = 0.008;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.stroke();
  }

  function groove(p, w = 0.014) {
    open(p);
    ctx.lineCap = "round";
    ctx.lineWidth = w;
    ctx.strokeStyle = "rgba(4,6,9,0.78)";
    ctx.stroke();
    ctx.save();
    ctx.translate(0.007, 0.005);
    open(p);
    ctx.lineWidth = w * 0.42;
    ctx.strokeStyle = "rgba(225,232,240,0.3)";
    ctx.stroke();
    ctx.restore();
  }

  // Light leaking through a gap: a soft wide stroke under a bright thin one.
  // (Canvas shadow blur would look similar but costs far more per frame.)
  function seam(p, alpha, w = 0.018) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    open(p);
    ctx.lineWidth = w * 5;
    ctx.strokeStyle = rgba(RED, alpha * 0.12);
    ctx.stroke();
    ctx.lineWidth = w * 2.2;
    ctx.strokeStyle = rgba(RED, alpha * 0.25);
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = rgba([255, 90, 70], alpha);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- static layers (rendered once per resize) ----------

  function bake(box, draw) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil((box.x1 - box.x0) * px * dpr));
    c.height = Math.max(1, Math.ceil((box.y1 - box.y0) * px * dpr));
    const saved = ctx;
    ctx = c.getContext("2d");
    ctx.setTransform(px * dpr, 0, 0, px * dpr, -box.x0 * px * dpr, -box.y0 * px * dpr);
    draw();
    ctx = saved;
    return { c, box };
  }

  function blit(layer) {
    const { c, box } = layer;
    ctx.drawImage(c, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }

  function bakeBackdrop() {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(height * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#1a2532");
    sky.addColorStop(0.55, "#0d131b");
    sky.addColorStop(1, "#06080b");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    // Fire glow along the ground.
    const fire = g.createRadialGradient(cx, height * 1.05, 0, cx, height * 1.05, Math.max(width, height) * 0.7);
    fire.addColorStop(0, rgba(RED, 0.2));
    fire.addColorStop(1, rgba(RED, 0));
    g.fillStyle = fire;
    g.fillRect(0, 0, width, height);

    // Cool halo behind the head.
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, px * 2.6);
    halo.addColorStop(0, "rgba(120,150,190,0.14)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, width, height);
    return c;
  }

  function drawTorsoPlates() {
    closed(CORE_M);
    ctx.fillStyle = "#0b0405";
    ctx.fill();
    bothSides(() => {
      ABS.forEach((plate) => metal(plate, { shade: 0.7, redLight: 0.17 }));
      metal(CHEST, { shade: 0.6, redLight: 0.14 });
      CHEST_LINES.forEach((l) => groove(l, 0.015));
      PAULDRON.forEach((band, i) => metal(band, { shade: 0.55 + i * 0.03, redLight: 0.05 }));
      PAULDRON_LINES.forEach((l) => groove(l, 0.014));
      metal(TRAP, { shade: 0.5, redLight: 0.1 });
      TRAP_LINES.forEach((l) => groove(l));
    });
  }

  function drawNeckPlates() {
    closed(NECK_M);
    ctx.fillStyle = "#0a0d11";
    ctx.fill();
    bothSides(() => {
      for (const x of [0.035, 0.1, 0.165, 0.23]) {
        const strip = [[x - 0.024, 0.62, true], [x + 0.024, 0.62, true], [x + 0.032, 1.32, true], [x - 0.032, 1.32, true]];
        metal(strip, { shade: 0.6 });
      }
    });
  }

  function drawJawPlates() {
    metal(JAW_M, { shade: 0.55, redLight: 0.18 });
    bothSides(() => {
      groove([[0.06, 0.84], [0.15, 0.8], [0.26, 0.72]]);
      for (let x = 0.03; x < 0.2; x += 0.045) groove([[x, 0.565], [x + 0.004, 0.63]], 0.01);
    });
  }

  function drawHeadPlates() {
    // Swept-back side plates, behind the skull.
    bothSides(() => {
      metal(FIN, { shade: 0.7, bright: 0.6 });
      FIN_LINES.forEach((l) => groove(l));
    });

    metal(HEAD_M, { shade: 0.5, redLight: 0.16 });

    // Specular bloom on the dome.
    ctx.save();
    closed(HEAD_M);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    const spec = ctx.createRadialGradient(-0.16, -0.9, 0, -0.16, -0.9, 0.45);
    spec.addColorStop(0, "rgba(235,242,250,0.3)");
    spec.addColorStop(1, "rgba(235,242,250,0)");
    ctx.fillStyle = spec;
    ctx.fillRect(-0.7, -1.4, 1.4, 1);
    ctx.restore();

    bothSides(() => HEAD_RIDGES.forEach((l) => groove(l, 0.016)));
    metal(CREST_M, { shade: 0.35, bright: 1.4 });

    // Eye sockets, then the brow edge catching the light.
    bothSides(() => {
      closed(SOCKET);
      const d = ctx.createLinearGradient(0.06, -0.37, 0.3, 0.01);
      d.addColorStop(0, "#020304");
      d.addColorStop(1, "#11151b");
      ctx.fillStyle = d;
      ctx.fill();
      open([[0.06, -0.115], [0.2, -0.255], [0.47, -0.385]]);
      ctx.lineWidth = 0.014;
      ctx.strokeStyle = "rgba(220,228,238,0.35)";
      ctx.stroke();
    });

    bothSides(() => CHEEK_LINES.forEach((l) => groove(l)));
    metal(NOSE_M, { shade: 0.3, bright: 1.3 });
    bothSides(() => groove([[0.05, 0.33], [0.09, 0.345]], 0.012));
    metal(LIP_M, { shade: 0.5, redLight: 0.12 });
    for (let x = -0.16; x <= 0.161; x += 0.045) groove([[x, 0.415], [x * 1.05, 0.485]], 0.009);
  }

  function rebuild() {
    // Wide screens put the bust in the left half; narrow ones keep it high so
    // the conversation fits underneath.
    if (width >= 1000) {
      px = Math.min(height * 0.18, width * 0.11, 200);
      cx = width * 0.28;
      cy = height * 0.07 + px * 1.4;
    } else {
      px = Math.min(width * 0.2, height * 0.105, 150);
      cx = width / 2;
      cy = 62 + px * 1.36;
    }
    layers = {
      backdrop: bakeBackdrop(),
      torso: bake({ x0: -2.15, x1: 2.15, y0: 0.75, y1: 3.4 }, drawTorsoPlates),
      neck: bake({ x0: -0.4, x1: 0.4, y0: 0.55, y1: 1.4 }, drawNeckPlates),
      jaw: bake({ x0: -0.4, x1: 0.4, y0: 0.5, y1: 1.08 }, drawJawPlates),
      head: bake({ x0: -0.78, x1: 0.78, y0: -1.36, y1: 0.75 }, drawHeadPlates),
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    screen.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  // ---------- per-frame parts ----------

  function drawEmbers(glow) {
    for (const e of embers) {
      if (!reduceMotion) {
        e.y -= 0.0006 * e.z;
        e.x += e.drift * 0.01;
        if (e.y < -0.02) {
          e.y = 1.02;
          e.x = Math.random();
        }
      }
      const a = (0.15 + 0.5 * e.z) * (0.35 + 0.65 * glow) * (0.5 + 0.5 * Math.sin(last / 300 + e.x * 50));
      ctx.fillStyle = `rgba(255,${Math.round(70 + 90 * e.z)},40,${a})`;
      const size = 1.2 + 1.6 * e.z;
      ctx.fillRect(e.x * width, e.y * height, size, size);
    }
  }

  function drawBodyGlow(core) {
    seam([[0, 1.33], [0, 2.2], [0, 3.02]], core, 0.022);
    bothSides(() => {
      PAULDRON_SEAMS.forEach((l) => seam(l, core * 0.5, 0.014));
      GLOW_SEAMS.forEach((l) => seam(l, core * 0.7, 0.016));
    });
  }

  function drawNeckGlow(core) {
    bothSides(() => {
      for (const x of [0.068, 0.133, 0.198]) {
        seam([[x, 0.8], [x + 0.003, 1.05], [x + 0.008, 1.3]], core * 0.55, 0.01);
      }
    });
  }

  function drawMouth(t, glow, jaw) {
    closed(CAVITY_M);
    const inside = ctx.createLinearGradient(0, 0.45, 0, 0.8);
    const heat = glow * (0.06 + 0.94 * voice);
    inside.addColorStop(0, "#050506");
    inside.addColorStop(0.35, rgba(RED, 0.08 + heat * 0.8));
    inside.addColorStop(1, "#050506");
    ctx.fillStyle = inside;
    ctx.fill();

    // Vertical vanes in the throat that flicker with the voice.
    if (heat < 0.03) return;
    ctx.save();
    closed(CAVITY_M);
    ctx.clip();
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.045;
      const wave = 0.5 + 0.5 * Math.sin(t * 14 + i * 1.9) * Math.sin(t * 6.7 + i);
      ctx.fillStyle = `rgba(255,${Math.round(110 + 120 * voice * wave)},${Math.round(80 + 100 * voice * wave)},${heat * 0.85 * wave})`;
      ctx.fillRect(x - 0.008, 0.5, 0.016, 0.06 + jaw * 0.9);
    }
    ctx.restore();
  }

  function drawEye(glow, side) {
    const open = Math.max(
      0.05,
      (1 - blink) * mix(mix(1, 0.55, focus), 1.25, alert * (1 - focus)),
    );
    ctx.save();
    ctx.translate(0.28, -0.165);
    ctx.rotate(-0.36);
    const eye = [
      [-0.15, 0.012, true], [-0.05, -0.03 * open], [0.14, -0.036 * open, true],
      [0.12, 0.026 * open], [-0.02, 0.03 * open],
    ];

    ctx.globalCompositeOperation = "lighter";
    // Glow spilling onto the socket.
    const spill = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.32);
    spill.addColorStop(0, rgba(RED, 0.4 * glow));
    spill.addColorStop(1, rgba(RED, 0));
    ctx.fillStyle = spill;
    ctx.fillRect(-0.34, -0.34, 0.68, 0.68);

    // Halo: the slit itself, enlarged and faint.
    ctx.save();
    ctx.scale(1.25, 1.9);
    closed(eye);
    ctx.fillStyle = rgba(RED, 0.25 * glow);
    ctx.fill();
    ctx.restore();

    closed(eye);
    const hot = Math.min(1, glow * 1.1);
    const g = ctx.createLinearGradient(-0.15, 0, 0.15, 0);
    g.addColorStop(0, rgba(RED, 0.3 + 0.6 * hot));
    g.addColorStop(0.45, `rgba(255,${Math.round(mix(60, 170, hot))},${Math.round(mix(40, 130, hot))},${0.35 + 0.65 * hot})`);
    g.addColorStop(1, rgba(RED, 0.3 + 0.55 * hot));
    ctx.fillStyle = g;
    ctx.fill();

    // Hot core that drifts toward the pointer.
    ctx.clip();
    const cxp = 0.01 + lookX * side * 0.05;
    const cyp = lookY * 0.008;
    const core = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, 0.09);
    core.addColorStop(0, `rgba(255,240,225,${0.15 + glow * 0.8})`);
    core.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = core;
    ctx.fillRect(-0.2, -0.1, 0.4, 0.2);
    ctx.restore();
  }

  function drawScan(t) {
    if (focus <= 0.02) return;
    ctx.save();
    closed(HEAD_M);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    const y = -0.4 + Math.sin(t * 2.4) * 0.95;
    const scan = ctx.createLinearGradient(0, y - 0.12, 0, y + 0.12);
    scan.addColorStop(0, "rgba(0,0,0,0)");
    scan.addColorStop(0.5, rgba(RED, 0.28 * focus));
    scan.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = scan;
    ctx.fillRect(-0.7, y - 0.12, 1.4, 0.24);
    ctx.restore();
  }

  function drawRings(t) {
    if (alert <= 0.02) return;
    ctx.lineWidth = 0.008;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.strokeStyle = rgba(RED, (1 - p) * 0.35 * alert);
      ctx.beginPath();
      ctx.ellipse(0, -0.3, 0.85 + p * 0.6, 1.25 + p * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const ease = (rate) => 1 - Math.exp(-dt * rate);

    power += ((state === "offline" ? 0.15 : 1) - power) * ease(2.2);
    focus += ((state === "thinking" ? 1 : 0) - focus) * ease(5);
    alert += ((state === "listening" ? 1 : 0) - alert) * ease(5);
    voice += (voiceTarget - voice) * ease(voiceTarget > voice ? 30 : 11);
    lookX += (pointerX - lookX) * ease(3);
    lookY += (pointerY - lookY) * ease(3);

    nextBlink -= dt;
    if (nextBlink <= 0) {
      blink = 1;
      nextBlink = 3 + Math.random() * 5;
    }
    blink = Math.max(0, blink - dt * 7);

    const breathe = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3);
    const flicker = focus * (reduceMotion ? 0 : 0.12 * Math.sin(t * 31) * Math.sin(t * 17));
    const glow = power * Math.min(1, 0.6 + 0.1 * breathe + 0.3 * voice + 0.25 * alert + 0.1 * focus + flicker);
    const core = glow * (0.5 + 0.2 * breathe + 0.3 * voice);

    ctx.drawImage(layers.backdrop, 0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(px, px);

    // Body.
    ctx.save();
    if (!reduceMotion) ctx.translate(0, Math.sin(t * 1.3) * 0.006);
    blit(layers.torso);
    drawBodyGlow(core);
    blit(layers.neck);
    drawNeckGlow(core);
    ctx.restore();

    // Head turns a little toward the pointer, pivoting at the neck.
    const sway = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.012;
    const bob = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.012;
    const jaw = voice * 0.16;
    ctx.save();
    ctx.translate(lookX * 0.03, 0.8 + bob + lookY * 0.015);
    ctx.rotate(lookX * 0.06 + sway);
    ctx.translate(0, -0.8);
    drawMouth(t, glow, jaw);
    ctx.save();
    ctx.translate(0, jaw);
    blit(layers.jaw);
    ctx.restore();
    blit(layers.head);
    bothSides((side) => drawEye(glow, side));
    drawScan(t);
    drawRings(t);
    ctx.restore();

    ctx.restore();

    // Fade the bottom of the figure into the floor.
    const fade = ctx.createLinearGradient(0, height * 0.72, 0, height);
    fade.addColorStop(0, "rgba(6,8,11,0)");
    fade.addColorStop(1, "rgba(6,8,11,0.85)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // Dormant: everything sinks into shadow.
    if (power < 0.99) {
      ctx.fillStyle = `rgba(4,5,7,${(1 - power) * 0.6})`;
      ctx.fillRect(0, 0, width, height);
    }

    drawEmbers(glow);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    pointerX = (e.clientX / width) * 2 - 1;
    pointerY = (e.clientY / height) * 2 - 1;
  });
  resize();
  requestAnimationFrame(frame);

  return {
    setState(next) {
      state = next;
    },
    setVoiceLevel(level) {
      voiceTarget = Math.max(0, Math.min(1, level));
    },
  };
}
