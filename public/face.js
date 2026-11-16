// The face. Two canvases stacked: a 2D one for the backdrop (sky, rings,
// embers) and a WebGL one for the head itself.
//
// The head is one of two things:
//   - the built-in machine: a 3D model described as a distance field and
//     ray-marched in a fragment shader, so it is lit, shadowed and reflective;
//   - a portrait: any image the person supplies, with glowing eyes and a jaw
//     that opens, placed using four points they click (eyes, mouth corners).
//
// Both react to the same inputs: a state (offline, idle, listening, thinking,
// speaking) and a 0..1 voice level that drives the jaw.

import { HEAD_SHADER, PORTRAIT_SHADER, VERTEX_SHADER } from "./shaders.js";

const DEFAULT_GLOW = "#ff261e";
export const DEFAULT_POINTS = {
  eyeL: [0.39, 0.4],
  eyeR: [0.61, 0.4],
  mouthL: [0.42, 0.66],
  mouthR: [0.58, 0.66],
  glow: DEFAULT_GLOW,
};

// World-space framing of the built-in head, shared with the shader.
const VIEW_HALF = 1.12; // half the height of the view at the head's depth
const VIEW_CENTRE_Y = -0.36;
const PORTRAIT_FILL = 0.94; // how much of the square a portrait may take

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = parseInt(m ? m[1] : DEFAULT_GLOW.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader failed to compile");
  }
  return shader;
}

function program(gl, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "shader failed to link");
  }
  const uniforms = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(p, i);
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { p, u: uniforms };
}

export function createFace(backCanvas, headCanvas) {
  const ctx = backCanvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const forcedQuality = Number(new URLSearchParams(location.search).get("faceq")) || 0;

  // ---------- WebGL setup ----------

  let gl = null;
  let headProg = null;
  let portraitProg = null;
  try {
    gl = headCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (gl) {
      headProg = program(gl, HEAD_SHADER);
      portraitProg = program(gl, PORTRAIT_SHADER);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    }
  } catch (err) {
    console.error("[face] WebGL unavailable:", err);
    gl = null;
  }
  if (!gl) headCanvas.hidden = true;

  // ---------- state ----------

  let width = 0;
  let height = 0;
  let dpr = 1;
  let box = { x: 0, y: 0, side: 1 }; // the square the head is drawn in, CSS px
  let backdrop = null;
  let quality = forcedQuality || 1;
  let slowFor = 0;

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
  let flick = 0; // brief dip in eye brightness, the machine's version of a blink
  let nextFlick = 3;
  let last = performance.now();
  let skip = false;

  let portrait = null; // { texture, aspect, points, glow }
  let placing = false; // true while the person is clicking the eye/mouth points

  const embers = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    drift: (Math.random() - 0.5) * 0.02,
  }));

  // ---------- layout ----------

  // Where the centre of the head sits on screen, for the halo and rings.
  function headCentre() {
    const cx = box.x + box.side / 2;
    if (portrait) return { cx, cy: box.y + box.side * 0.46, r: box.side * 0.3 };
    const cy = box.y + box.side / 2 + ((VIEW_CENTRE_Y - 0.05) / VIEW_HALF) * (box.side / 2);
    return { cx, cy, r: box.side * 0.24 };
  }

  // The rectangle a portrait occupies inside the square, as fractions of it.
  function portraitRect() {
    const a = portrait.aspect;
    const w = a >= 1 ? PORTRAIT_FILL : PORTRAIT_FILL * a;
    const h = a >= 1 ? PORTRAIT_FILL / a : PORTRAIT_FILL;
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }

  function bakeBackdrop() {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(height * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const { cx, cy } = headCentre();

    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#151d28");
    sky.addColorStop(0.55, "#0c1118");
    sky.addColorStop(1, "#06080b");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    const floor = g.createRadialGradient(cx, height * 1.05, 0, cx, height * 1.05, Math.max(width, height) * 0.7);
    floor.addColorStop(0, "rgba(255,38,30,0.16)");
    floor.addColorStop(1, "rgba(255,38,30,0)");
    g.fillStyle = floor;
    g.fillRect(0, 0, width, height);

    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, box.side * 0.62);
    halo.addColorStop(0, "rgba(120,150,190,0.16)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, width, height);
    return c;
  }

  function sizeHeadCanvas() {
    if (!gl) return;
    const pixels = Math.round(Math.min(box.side * dpr * quality, 960));
    if (headCanvas.width !== pixels) {
      headCanvas.width = pixels;
      headCanvas.height = pixels;
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = backCanvas.clientWidth;
    height = backCanvas.clientHeight;
    backCanvas.width = Math.round(width * dpr);
    backCanvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Wide screens put the head in the left half; narrow ones keep it at the
    // top so the conversation fits underneath.
    if (width >= 1000) {
      const side = Math.min(width * 0.56, height * 1.02);
      box = { x: width * 0.275 - side / 2, y: (height - side) / 2 + height * 0.02, side };
    } else {
      const side = Math.min(width * 1.12, height * 0.56);
      box = { x: (width - side) / 2, y: 44, side };
    }
    Object.assign(headCanvas.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.side}px`,
      height: `${box.side}px`,
    });
    sizeHeadCanvas();
    backdrop = bakeBackdrop();
    skip = false;
  }

  // ---------- backdrop, per frame ----------

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

  function drawRings(t) {
    if (alert <= 0.02) return;
    const { cx, cy, r } = headCentre();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,38,30,${(1 - p) * 0.4 * alert})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * (1.25 + p * 0.9), r * (1.45 + p * 0.9), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Shown only when WebGL is missing: two bars of light where the eyes go.
  function drawFallbackEyes(glow) {
    const { cx, cy, r } = headCentre();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const side of [-1, 1]) {
      const x = cx + side * r * 0.42;
      const halo = ctx.createRadialGradient(x, cy, 0, x, cy, r * 0.5);
      halo.addColorStop(0, `rgba(255,38,30,${0.5 * glow})`);
      halo.addColorStop(1, "rgba(255,38,30,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 0.5, cy - r * 0.5, r, r);
      ctx.fillStyle = `rgba(255,150,130,${glow})`;
      ctx.fillRect(x - r * 0.2, cy - r * 0.025, r * 0.4, r * 0.05);
    }
    ctx.restore();
  }

  // ---------- head, per frame ----------

  function drawHead(t, glow) {
    const u = headProg.u;
    gl.useProgram(headProg.p);
    const yaw = lookX * 0.3 + (reduceMotion ? 0 : Math.sin(t * 0.6) * 0.03);
    const pitch = 0.07 + lookY * 0.12 + (reduceMotion ? 0 : Math.sin(t * 0.9) * 0.015);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // World to head space (the inverse of the head's turn), column-major.
    gl.uniformMatrix3fv(u.uHead, false, [cy, sp * sy, cp * sy, 0, cp, -sp, -sy, sp * cy, cp * cy]);
    const jaw = voice * 0.32;
    gl.uniform2f(u.uJaw, Math.cos(jaw), Math.sin(jaw));
    gl.uniform2f(u.uRes, headCanvas.width, headCanvas.height);
    gl.uniform1f(u.uTime, t % 1000);
    gl.uniform1f(u.uPower, power);
    gl.uniform1f(u.uGlow, glow * (1 - 0.7 * flick));
    gl.uniform1f(u.uVoice, voice);
    gl.uniform1f(u.uFocus, focus);
    gl.uniform1f(u.uBreath, reduceMotion ? 0 : Math.sin(t * 1.3) * 0.006);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawPortrait(t, glow) {
    const u = portraitProg.u;
    const r = portraitRect();
    const pts = portrait.points;
    gl.useProgram(portraitProg.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, portrait.texture);
    gl.uniform1i(u.uTex, 0);
    gl.uniform4f(u.uRect, r.x, r.y, r.w, r.h);
    gl.uniform1f(u.uAspect, portrait.aspect);
    gl.uniform2fv(u.uEyeL, pts.eyeL);
    gl.uniform2fv(u.uEyeR, pts.eyeR);
    gl.uniform2fv(u.uMouthL, pts.mouthL);
    gl.uniform2fv(u.uMouthR, pts.mouthR);
    gl.uniform3fv(u.uColor, portrait.glow);
    gl.uniform1f(u.uTime, t % 1000);
    gl.uniform1f(u.uPower, power);
    gl.uniform1f(u.uGlow, glow * (1 - 0.7 * flick));
    gl.uniform1f(u.uVoice, placing ? 0 : voice);
    gl.uniform1f(u.uFocus, focus);
    const still = placing || reduceMotion;
    gl.uniform2f(u.uShift, still ? 0 : lookX * 0.006, still ? 0 : lookY * 0.004);
    gl.uniform1f(u.uZoom, still ? 1 : 1 + 0.004 * Math.sin(t * 1.3));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Drops the render size if frames are taking too long. Never goes back up,
  // so it can't oscillate.
  function watchSpeed(dt) {
    if (forcedQuality || !gl || dt > 0.25) return;
    slowFor = dt > 0.034 ? slowFor + dt : Math.max(0, slowFor - dt * 2);
    if (slowFor > 1.5 && quality > 0.35) {
      quality = Math.max(0.35, quality * 0.72);
      slowFor = 0;
      sizeHeadCanvas();
    }
  }

  function frame(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    const t = now / 1000;
    const ease = (rate) => 1 - Math.exp(-dt * rate);
    watchSpeed(raw);

    power += ((state === "offline" ? 0.12 : 1) - power) * ease(2.2);
    focus += ((state === "thinking" ? 1 : 0) - focus) * ease(5);
    alert += ((state === "listening" ? 1 : 0) - alert) * ease(5);
    voice += (voiceTarget - voice) * ease(voiceTarget > voice ? 30 : 11);
    lookX += (pointerX - lookX) * ease(3);
    lookY += (pointerY - lookY) * ease(3);

    nextFlick -= dt;
    if (nextFlick <= 0) {
      flick = 1;
      nextFlick = 3 + Math.random() * 6;
    }
    flick = Math.max(0, flick - dt * 8);

    const breathe = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3);
    const jitter = focus * (reduceMotion ? 0 : 0.12 * Math.sin(t * 31) * Math.sin(t * 17));
    const glow = power * Math.min(1, 0.6 + 0.1 * breathe + 0.3 * voice + 0.25 * alert + 0.1 * focus + jitter);

    ctx.drawImage(backdrop, 0, 0, width, height);
    drawRings(t);
    drawEmbers(glow);

    if (gl) {
      // The head is the expensive part. At rest it changes slowly, so draw it
      // on every other frame unless something is happening.
      const lively = voice > 0.01 || alert > 0.02 || focus > 0.02 || power < 0.98 || placing;
      skip = !lively && !skip;
      if (!skip) {
        gl.viewport(0, 0, headCanvas.width, headCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (portrait) drawPortrait(t, glow);
        else drawHead(t, glow);
      }
    } else {
      drawFallbackEyes(glow);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    const { cx, cy } = headCentre();
    pointerX = Math.max(-1, Math.min(1, ((e.clientX - cx) / width) * 2.2));
    pointerY = Math.max(-1, Math.min(1, ((e.clientY - cy) / height) * 2.2));
  });
  resize();
  requestAnimationFrame(frame);

  return {
    // False when WebGL is missing, in which case portraits can't be shown.
    canShowPortrait: Boolean(gl),

    setState(next) {
      state = next;
    },

    setVoiceLevel(level) {
      voiceTarget = Math.max(0, Math.min(1, level));
    },

    // Show `image` as the face, or pass null to go back to the built-in head.
    setPortrait(image, points) {
      if (!gl) return;
      if (portrait) gl.deleteTexture(portrait.texture);
      portrait = null;
      if (image) {
        // Copy through a canvas so very large images fit in a texture.
        const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(image.naturalWidth * scale));
        c.height = Math.max(1, Math.round(image.naturalHeight * scale));
        c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        portrait = { texture, aspect: c.width / c.height, points: null, glow: null };
        this.setPoints(points);
      }
      backdrop = bakeBackdrop();
      skip = false;
    },

    setPoints(points) {
      if (!portrait) return;
      portrait.points = { ...DEFAULT_POINTS, ...points };
      portrait.glow = hexToRgb(portrait.points.glow);
    },

    // While true, the portrait holds still so points can be clicked on it.
    setPlacing(on) {
      placing = on;
    },

    // Screen position -> position within the portrait image (0..1 each way).
    imagePoint(clientX, clientY) {
      if (!portrait) return null;
      const r = portraitRect();
      const u = ((clientX - box.x) / box.side - r.x) / r.w;
      const v = ((clientY - box.y) / box.side - r.y) / r.h;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
    },

    // The reverse, for drawing markers over the image.
    screenPoint([u, v]) {
      const r = portrait ? portraitRect() : { x: 0, y: 0, w: 1, h: 1 };
      return [box.x + (r.x + u * r.w) * box.side, box.y + (r.y + v * r.h) * box.side];
    },
  };
}
