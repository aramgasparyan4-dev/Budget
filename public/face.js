// The face: an original angular machine mask drawn on a canvas. It reacts to
// four states (idle, listening, thinking, speaking) and to a 0..1 "voice"
// level that drives the jaw while speech is playing.

const RED = [255, 43, 34];

function rgba([r, g, b], a) {
  return `rgba(${r},${g},${b},${a})`;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export function createFace(canvas) {
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let state = "offline";
  let voiceTarget = 0;
  let voice = 0;
  let power = 0; // 0 dormant .. 1 awake
  let focus = 0; // eye narrowing while thinking
  let alert = 0; // eye widening while listening
  let lookX = 0;
  let lookY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let blink = 0;
  let nextBlink = 3;
  let last = performance.now();

  const motes = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    drift: (Math.random() - 0.5) * 0.012,
  }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Mirror a list of [x, y] points around the vertical axis into a closed path.
  function plate(points, cx, cy, s, jawDrop = 0) {
    ctx.beginPath();
    const right = points.map(([x, y]) => [cx + x * s, cy + y * s + jawDrop]);
    const left = points
      .slice()
      .reverse()
      .map(([x, y]) => [cx - x * s, cy + y * s + jawDrop]);
    [...right, ...left].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  function metal(cx, cy, s, top, bottom) {
    const g = ctx.createLinearGradient(cx, cy + top * s, cx, cy + bottom * s);
    g.addColorStop(0, "#343943");
    g.addColorStop(0.45, "#1b1e25");
    g.addColorStop(1, "#0c0d11");
    return g;
  }

  function drawBackdrop(t, glow) {
    ctx.fillStyle = "#07080b";
    ctx.fillRect(0, 0, width, height);

    const cx = width >= 1000 ? width * 0.28 : width / 2;
    const cy = height * 0.4;
    const r = Math.max(width, height) * 0.62;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    halo.addColorStop(0, rgba(RED, 0.05 + glow * 0.13));
    halo.addColorStop(0.45, rgba(RED, 0.015 + glow * 0.03));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    for (const m of motes) {
      if (!reduceMotion) {
        m.y -= 0.00035 * m.z;
        m.x += m.drift * 0.01;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
      }
      const a = (0.1 + 0.25 * m.z) * (0.4 + 0.6 * power) * (0.6 + 0.4 * Math.sin(t * 0.8 + m.x * 40));
      ctx.fillStyle = rgba(RED, a);
      ctx.fillRect(m.x * width, m.y * height, 1.4 * m.z, 1.4 * m.z);
    }
  }

  function drawEye(cx, cy, s, side, glow) {
    // Angular slit: outer corner high, inner corner low.
    const open = Math.max(0.04, (1 - blink) * mix(mix(1, 0.52, focus), 1.22, alert * (1 - focus)));
    const ex = cx + side * 0.36 * s + lookX * s * 0.018;
    const ey = cy - 0.2 * s + lookY * s * 0.014;
    const w = 0.27 * s;
    const h = 0.085 * s * open;
    const pts = [
      [ex - side * w * 0.95, ey + h * 0.9],
      [ex - side * w * 0.3, ey - h],
      [ex + side * w, ey - h * 1.7 - 0.05 * s],
      [ex + side * w * 0.55, ey + h * 0.85],
    ];
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };

    path();
    ctx.fillStyle = "#040405";
    ctx.fill();

    ctx.save();
    ctx.shadowColor = rgba(RED, 0.95);
    ctx.shadowBlur = s * (0.1 + glow * 0.3);
    path();
    const g = ctx.createLinearGradient(ex - w, ey, ex + w, ey);
    const hot = `rgba(255,${Math.round(mix(70, 225, glow * 0.75))},${Math.round(mix(50, 190, glow * 0.75))},${0.35 + glow * 0.65})`;
    g.addColorStop(side > 0 ? 0 : 1, hot);
    g.addColorStop(side > 0 ? 1 : 0, rgba(RED, 0.25 + glow * 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Pupil core tracks the pointer a little.
    ctx.save();
    path();
    ctx.clip();
    const px = ex + side * w * 0.12 + lookX * w * 0.3;
    const py = ey - h * 0.4 + lookY * h * 0.5;
    const core = ctx.createRadialGradient(px, py, 0, px, py, w * 0.55);
    core.addColorStop(0, `rgba(255,245,235,${0.25 + glow * 0.7})`);
    core.addColorStop(0.35, rgba(RED, glow * 0.5));
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.fillRect(ex - w * 1.2, ey - s * 0.3, w * 2.4, s * 0.6);
    ctx.restore();
  }

  function drawMouth(cx, cy, s, t, glow, jaw) {
    // Vent between the cheek plates and the dropping jaw.
    const top = cy + 0.34 * s;
    const gap = 0.022 * s + jaw;
    const half = 0.3 * s;
    ctx.beginPath();
    ctx.moveTo(cx - half, top - 0.035 * s);
    ctx.lineTo(cx - half * 0.45, top);
    ctx.lineTo(cx + half * 0.45, top);
    ctx.lineTo(cx + half, top - 0.035 * s);
    ctx.lineTo(cx + half * 0.82, top + gap);
    ctx.lineTo(cx - half * 0.82, top + gap);
    ctx.closePath();
    ctx.fillStyle = "#030304";
    ctx.fill();

    ctx.save();
    ctx.clip();
    const inner = ctx.createLinearGradient(cx, top, cx, top + gap);
    inner.addColorStop(0, rgba(RED, 0.1 + glow * 0.5));
    inner.addColorStop(1, rgba(RED, 0.02 + glow * 0.18));
    ctx.fillStyle = inner;
    ctx.fillRect(cx - half, top - 0.05 * s, half * 2, gap + 0.06 * s);

    // Vertical emitter bars that flicker with the voice level.
    const bars = 17;
    for (let i = 0; i < bars; i++) {
      const u = i / (bars - 1);
      const x = cx - half * 0.8 + u * half * 1.6;
      const wave = 0.5 + 0.5 * Math.sin(t * 13 + i * 1.7) * Math.sin(t * 7.3 + i * 0.6);
      const amp = (0.25 + 0.75 * wave) * (1 - Math.abs(u - 0.5) * 1.1);
      const barH = gap * mix(0.35, 1, voice * amp);
      ctx.fillStyle = `rgba(255,${Math.round(90 + 130 * voice * amp)},${Math.round(70 + 90 * voice * amp)},${0.2 + 0.75 * glow * amp})`;
      ctx.fillRect(x - s * 0.006, top + (gap - barH) / 2, s * 0.012, barH);
    }
    ctx.restore();
  }

  function drawHead(t, glow) {
    // Wide screens put the face in the left half; narrow ones keep it small
    // and high so the conversation fits underneath.
    const wide = width >= 1000;
    const s = wide
      ? Math.min(width * 0.19, height * 0.3, 300)
      : Math.min(width * 0.34, height * 0.2, 220);
    const bob = reduceMotion ? 0 : Math.sin(t * 0.9) * s * 0.012;
    const cx = (wide ? width * 0.28 : width / 2) + lookX * s * 0.02;
    const cy = (wide ? height * 0.47 : Math.max(height * 0.3, 70 + s * 1.02)) + bob;
    const jaw = voice * 0.085 * s;
    const edge = rgba(RED, 0.1 + glow * 0.3);

    ctx.lineJoin = "miter";
    ctx.lineWidth = Math.max(1, s * 0.006);

    // Neck struts.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + side * (0.12 + i * 0.09) * s, cy + 0.72 * s);
        ctx.lineTo(cx + side * (0.2 + i * 0.13) * s, cy + 1.25 * s);
        ctx.stroke();
      }
    }

    // Jaw (moves).
    plate(
      [
        [0, 0.9],
        [0.2, 0.88],
        [0.4, 0.66],
        [0.5, 0.36],
        [0.34, 0.4],
        [0.26, 0.5],
        [0, 0.52],
      ],
      cx, cy, s, jaw,
    );
    ctx.fillStyle = metal(cx, cy, s, 0.3, 1);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.stroke();

    // Skull.
    plate(
      [
        [0, -1.02],
        [0.36, -0.98],
        [0.66, -0.7],
        [0.76, -0.22],
        [0.66, 0.2],
        [0.5, 0.33],
        [0.3, 0.3],
        [0.14, 0.34],
        [0, 0.34],
      ],
      cx, cy, s,
    );
    ctx.fillStyle = metal(cx, cy, s, -1.05, 0.4);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.stroke();

    // Brow plate: a heavy ridge that shades the eyes.
    plate(
      [
        [0, -0.4],
        [0.12, -0.44],
        [0.5, -0.56],
        [0.7, -0.5],
        [0.72, -0.36],
        [0.4, -0.3],
        [0.1, -0.2],
        [0, -0.18],
      ],
      cx, cy, s,
    );
    ctx.fillStyle = "#0d0e12";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.stroke();

    // Panel seams.
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 1.02 * s);
    ctx.lineTo(cx, cy - 0.44 * s);
    for (const side of [-1, 1]) {
      ctx.moveTo(cx + side * 0.36 * s, cy - 0.98 * s);
      ctx.lineTo(cx + side * 0.3 * s, cy - 0.52 * s);
      ctx.moveTo(cx + side * 0.74 * s, cy - 0.3 * s);
      ctx.lineTo(cx + side * 0.46 * s, cy + 0.06 * s);
      ctx.lineTo(cx + side * 0.34 * s, cy + 0.3 * s);
      ctx.moveTo(cx + side * 0.08 * s, cy - 0.08 * s);
      ctx.lineTo(cx + side * 0.13 * s, cy + 0.2 * s);
    }
    ctx.stroke();

    // Forehead core.
    const pulse = 0.5 + 0.5 * Math.sin(t * (state === "thinking" ? 9 : 1.6));
    ctx.save();
    ctx.shadowColor = rgba(RED, 0.9);
    ctx.shadowBlur = s * 0.1 * glow;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.78 * s);
    ctx.lineTo(cx + 0.05 * s, cy - 0.66 * s);
    ctx.lineTo(cx, cy - 0.54 * s);
    ctx.lineTo(cx - 0.05 * s, cy - 0.66 * s);
    ctx.closePath();
    ctx.fillStyle = rgba(RED, (0.2 + 0.6 * pulse) * glow);
    ctx.fill();
    ctx.restore();

    drawEye(cx, cy, s, -1, glow);
    drawEye(cx, cy, s, 1, glow);
    drawMouth(cx, cy, s, t, glow, jaw);

    // Thinking: a scan line sweeps the face.
    if (focus > 0.02) {
      const y = cy + Math.sin(t * 2.4) * s * 0.85;
      const scan = ctx.createLinearGradient(0, y - s * 0.12, 0, y + s * 0.12);
      scan.addColorStop(0, "rgba(0,0,0,0)");
      scan.addColorStop(0.5, rgba(RED, 0.16 * focus));
      scan.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = scan;
      ctx.fillRect(cx - s * 0.8, y - s * 0.12, s * 1.6, s * 0.24);
    }

    // Listening: rings open outward.
    if (alert > 0.02) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.5 + i / 3) % 1;
        ctx.strokeStyle = rgba(RED, (1 - p) * 0.3 * alert);
        ctx.beginPath();
        ctx.ellipse(cx, cy - 0.1 * s, s * (0.95 + p * 0.55), s * (1.2 + p * 0.55), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const ease = (rate) => 1 - Math.exp(-dt * rate);

    power += ((state === "offline" ? 0.12 : 1) - power) * ease(2.2);
    focus += ((state === "thinking" ? 1 : 0) - focus) * ease(5);
    alert += ((state === "listening" ? 1 : 0) - alert) * ease(5);
    voice += (voiceTarget - voice) * ease(voiceTarget > voice ? 30 : 11);
    lookX += (pointerX - lookX) * ease(4);
    lookY += (pointerY - lookY) * ease(4);

    nextBlink -= dt;
    if (nextBlink <= 0) {
      blink = 1;
      nextBlink = 2.5 + Math.random() * 5;
    }
    blink = Math.max(0, blink - dt * 7);

    const breathe = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3);
    const glow = power * Math.min(1, 0.55 + 0.12 * breathe + 0.3 * voice + 0.25 * alert + 0.1 * focus);

    drawBackdrop(t, glow);
    drawHead(t, glow);
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
