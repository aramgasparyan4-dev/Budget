// GLSL for the face. Kept apart from face.js so the drawing logic there
// stays readable.

export const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// The built-in head: a distance field, ray-marched.
//
// Layout (y up, the camera looks down -z):
//   head    a faceted skull with a strip of dark glass across the face and
//           a ring of light behind it for each eye; vent slots around the
//           mouth; the lower front is a separate jaw that swings on hubs
//   neck    a ribbed column with struts
//   body    collar ring, chest and shoulder shells, a seam of light between
// ---------------------------------------------------------------------------
export const HEAD_SHADER = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform mat3 uHead;   // world -> head space (undoes the head's turn)
uniform vec2 uJaw;    // cos, sin of the jaw angle
uniform float uTime, uPower, uGlow, uVoice, uFocus, uBreath;

const vec3 PIVOT = vec3(0.0, -0.42, -0.06);
const vec3 HINGE = vec3(0.0, -0.12, -0.05);
const vec3 RED = vec3(1.0, 0.15, 0.11);
const vec3 KEY = vec3(-0.50, 0.62, 0.60);   // main light, upper left, in front
const vec3 CAM = vec3(0.0, -0.36, 5.0);
const float FIELD = 1.12 / 5.0;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = max(length(p / (r * r)), 1e-4);
  return k0 * (k0 - 1.0) / k1;
}
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}
// Disc with its axis along x.
float sdDiscX(vec3 p, float r, float halfLen) {
  vec2 d = vec2(length(p.yz) - r, abs(p.x) - halfLen);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.012;
}
// Column with its axis along y.
float sdColumn(vec3 p, float r, float halfLen) {
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - halfLen);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdTorus(vec3 p, float major, float minor) {
  return length(vec2(length(p.xz) - major, p.y)) - minor;
}
// 1 on a line of half-width w, falling to 0 beside it. Used to engrave seams.
float cut(float d, float w) { return smoothstep(w, 0.0, abs(d)); }

float skull(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float cranium = sdEllipsoid(p - vec3(0.0, 0.13, -0.05), vec3(0.40, 0.43, 0.47));
  float lower = sdRoundBox(p - vec3(0.0, -0.30, 0.05), vec3(0.19, 0.24, 0.20), 0.13);
  float d = smin(cranium, lower, 0.10);
  d = smax(d, q.x - 0.355, 0.05);                                           // flat temples
  d = smax(d, dot(q.xy, vec2(0.5, 0.866)) - 0.515, 0.05);                   // crown facets
  d = smax(d, p.y - 0.50, 0.05);                                            // flat top
  d = smax(d, dot(q, normalize(vec3(0.86, -0.28, 0.42))) - 0.355, 0.025);  // cheek facets
  d = smax(d, dot(q.xy, vec2(0.7071, -0.7071)) - 0.60, 0.03);              // jaw corners
  d = smax(d, dot(q, normalize(vec3(0.0, -0.55, 0.83))) - 0.47, 0.03);     // under the chin
  d = smax(d, dot(q, normalize(vec3(0.0, 0.50, 0.87))) - 0.50, 0.04);      // forehead
  d = smax(d, p.z - 0.41, 0.025);                                           // flat front
  return d;
}

// Height above the middle of the visor, which runs level across the face.
float visorY(vec3 h) { return h.y - 0.05; }

float box2(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

// Returns (distance, material).
// 1 bright plate, 2 dark mechanism, 3 visor glass, 4 body plate, 5 glowing seam.
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

// A row of vertical slots through a plate, between heights y0 and y1.
float slots(vec3 h, float skin, float y0, float y1) {
  float x = abs(h.x);
  float cell = mod(x + 0.024, 0.048) - 0.024;
  float slot = box2(vec2(cell, h.y - 0.5 * (y0 + y1)), vec2(0.008, 0.5 * (y1 - y0) - 0.012), 0.004);
  slot = max(slot, x - 0.17);
  return max(slot, -(skin + 0.075));
}

vec2 map(vec3 p) {
  vec3 h = uHead * (p - PIVOT) + PIVOT;
  vec3 q = vec3(abs(h.x), h.y, h.z);
  float sk = skull(h);
  float yb = visorY(h);
  float front = smoothstep(-0.05, 0.1, h.z);

  // Upper head: a visor trench across the face, vent slots above the mouth.
  float up = smax(sk, -(h.y + 0.375), 0.012);
  float band = box2(vec2(q.x, yb), vec2(0.33, 0.045), 0.012);
  up = smax(up, -max(band, -(sk + 0.05)), 0.010);
  up = max(up, -slots(h, sk, -0.365, -0.235));
  float seams = cut(q.x - 0.13, 0.010) * step(0.12, h.y)
    + cut(yb - 0.14, 0.010)
    + cut(h.y + 0.20, 0.009) * step(0.19, q.x);
  up += 0.007 * min(seams, 1.0) * front;
  vec2 res = vec2(up, 1.0);

  // Dark glass set into the trench. The eyes are lit rings behind it.
  float glass = max(sk + 0.022, box2(vec2(q.x, yb), vec2(0.335, 0.05), 0.012));
  res = opU(res, vec2(glass, 3.0));

  // The mechanism under the plates, seen through the slots and the mouth.
  res = opU(res, vec2(max(sk + 0.065, -(h.y + 0.66)), 2.0));

  // Jaw, swinging on the hinge.
  vec3 j = h - HINGE;
  j.yz = vec2(uJaw.x * j.y + uJaw.y * j.z, -uJaw.y * j.y + uJaw.x * j.z);
  j += HINGE;
  float jsk = skull(j);
  float jaw = smax(jsk, j.y + 0.405, 0.012);
  jaw = smax(jaw, -(j.z + 0.07), 0.03);
  jaw = max(jaw, -slots(j, jsk, -0.50, -0.415));
  jaw += 0.007 * cut(j.y + 0.535, 0.009) * front;
  res = opU(res, vec2(jaw, 1.0));

  // Hinge hubs.
  vec3 hub = vec3(q.x - 0.335, h.y + 0.12, h.z + 0.05);
  float hubD = sdDiscX(hub, 0.10, 0.05) + 0.006 * cut(length(hub.yz) - 0.06, 0.010);
  res = opU(res, vec2(hubD, 1.0));

  // Neck and body do not turn with the head; they breathe a little.
  p.y -= uBreath;
  vec3 a = vec3(abs(p.x), p.y, p.z);
  float neck = sdColumn(p - vec3(0.0, -0.80, -0.09), 0.225 + 0.012 * cos(p.y * 58.0), 0.44);
  res = opU(res, vec2(neck, 2.0));
  res = opU(res, vec2(sdCapsule(a, vec3(0.265, -0.50, -0.10), vec3(0.325, -1.16, -0.08), 0.034), 1.0));
  res = opU(res, vec2(sdCapsule(a, vec3(0.085, -0.56, 0.135), vec3(0.11, -1.14, 0.17), 0.028), 1.0));

  float torso = sdRoundBox(p - vec3(0.0, -1.97, -0.14), vec3(0.64, 0.62, 0.20), 0.20);
  torso = smax(torso, dot(a.xy, vec2(0.44, 0.897)) + 0.90, 0.05);   // sloping shoulders
  float pad = sdEllipsoid(a - vec3(1.0, -1.45, -0.14), vec3(0.34, 0.21, 0.36));
  float body = min(torso, pad);
  body += 0.008 * (cut(length(a.xy - vec2(0.0, -1.12)) - 0.60, 0.012)
    + cut(length(a.xy - vec2(1.0, -1.42)) - 0.20, 0.011));
  res = opU(res, vec2(body, 4.0));
  res = opU(res, vec2(sdTorus(p - vec3(0.0, -1.155, -0.09), 0.30, 0.012), 5.0));
  return res;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x
    + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

float shadowToward(vec3 p, vec3 l) {
  float lit = 1.0;
  float t = 0.03;
  for (int i = 0; i < 16; i++) {
    float d = map(p + l * t).x;
    lit = min(lit, 9.0 * d / t);
    t += clamp(d, 0.02, 0.2);
    if (lit < 0.02 || t > 2.2) break;
  }
  return clamp(lit, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 4; i++) {
    float d = 0.035 * float(i);
    occ += (d - map(p + n * d).x) * weight;
    weight *= 0.6;
  }
  return clamp(1.0 - 3.2 * occ, 0.0, 1.0);
}

// What the metal reflects: a dark studio with a few soft lights in it.
vec3 studio(vec3 d) {
  vec3 c = vec3(0.010, 0.013, 0.018);
  float az = atan(d.x, d.z);
  c += vec3(0.95, 0.97, 1.0) * 1.5 * smoothstep(0.84, 0.97, dot(d, normalize(KEY)));          // key softbox
  c += vec3(0.30, 0.45, 0.70) * 1.3 * exp(-pow((az - 1.2) * 4.5, 2.0)) * smoothstep(-0.6, 0.1, d.y) * smoothstep(0.95, 0.5, d.y);  // strip, right
  c += vec3(0.42, 0.47, 0.55) * 0.5 * exp(-pow((az + 1.7) * 3.5, 2.0)) * smoothstep(-0.4, 0.2, d.y);   // strip, far left
  c += vec3(0.45, 0.50, 0.58) * 0.35 * smoothstep(0.6, 1.0, d.y);                               // overhead
  c += vec3(0.05, 0.065, 0.09) * exp(-abs(d.y) * 4.0);                                          // horizon
  c += RED * 0.32 * uPower * smoothstep(-0.2, -0.9, d.y);                                       // floor glow
  return c;
}

vec3 shade(vec3 pos, vec3 rd, float m) {
  vec3 n = normalAt(pos);
  float facing = max(dot(n, -rd), 0.0);

  if (m > 4.5) {
    return RED * (0.15 + 1.3 * uGlow * (0.55 + 0.45 * uVoice));
  }

  vec3 h = uHead * (pos - PIVOT) + PIVOT;
  vec3 nh = uHead * n;
  vec3 f0 = vec3(0.50, 0.52, 0.57);
  vec3 base = vec3(0.10, 0.108, 0.125);
  if (m > 3.5) { f0 = vec3(0.34, 0.355, 0.40); base = vec3(0.06, 0.065, 0.078); }
  else if (m > 2.5) { f0 = vec3(0.05); base = vec3(0.004, 0.004, 0.006); }
  else if (m > 1.5) { f0 = vec3(0.09, 0.095, 0.11); base = vec3(0.035, 0.037, 0.045); }

  vec3 key = normalize(KEY);
  vec3 r = reflect(rd, n);
  float ao = occlusion(pos, n);
  float sun = max(dot(n, key), 0.0) * shadowToward(pos + n * 0.012, key);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);

  vec3 col = studio(r) * fresnel * mix(0.25, 1.0, ao);
  col += base * (sun * vec3(1.0, 0.97, 0.92) + 0.16 * ao * vec3(0.55, 0.65, 0.85) * (0.6 + 0.4 * n.y));
  col += fresnel * 1.2 * sun * pow(max(dot(r, key), 0.0), 60.0);
  col *= mix(0.22, 1.0, uPower);

  // Eyes: a ring and a pupil of light on each side, behind the glass.
  // Thinking breaks the ring into segments that spin.
  if (m > 2.5 && m < 3.5) {
    vec2 e = vec2(abs(h.x) - 0.155, h.y - 0.05);
    float r = length(e);
    float turn = atan(e.y, e.x) * 3.0 + uTime * 6.0;
    float ring = cut(r - 0.034, 0.0075) * mix(1.0, smoothstep(-0.3, 0.3, sin(turn)), uFocus);
    float pupil = smoothstep(0.014, 0.007, r) * (1.0 - 0.5 * uFocus);
    float lines = 0.75 + 0.25 * sin(h.y * 900.0);
    col += RED * uGlow * lines * (2.6 * ring + 2.2 * pupil + 0.22 * exp(-r * r * 260.0));
    col += vec3(1.0, 0.7, 0.55) * uGlow * uGlow * (0.9 * ring + 1.2 * pupil);
  }

  // Light the eyes throw on the plates around them, and the throat's when speaking.
  vec3 toEye = vec3(sign(h.x) * 0.155, 0.05, 0.40) - h;
  float eyeLight = max(dot(nh, normalize(toEye)), 0.0) / (1.0 + 70.0 * dot(toEye, toEye));
  col += RED * uGlow * eyeLight * (base * 6.0 + f0 * 1.2);

  if (m > 1.5 && m < 2.5 && h.y < -0.30 && h.y > -0.62 && h.z > 0.12) {
    float vanes = 0.35 + 0.65 * smoothstep(-0.2, 0.6, sin(h.x * 110.0));
    float pulse = 0.75 + 0.25 * sin(uTime * 19.0 + h.x * 40.0);
    col += RED * uGlow * (0.10 + 1.7 * uVoice * pulse) * vanes;
    col += vec3(1.0, 0.6, 0.45) * uGlow * uVoice * uVoice * 0.3 * vanes;
  }
  vec3 toMouth = vec3(0.0, -0.42, 0.34) - h;
  col += RED * uGlow * uVoice * 0.5 * base * 5.0 / (1.0 + 40.0 * dot(toMouth, toMouth));

  // Thinking: a band of light sweeps the head.
  float band = pos.y - (0.05 + 0.6 * sin(uTime * 2.4));
  col += RED * uFocus * 0.55 * exp(-band * band * 180.0) * step(-0.75, pos.y);
  return col;
}

// Where a point in head space lands on screen (in vUv units).
vec2 onScreen(vec3 headPoint) {
  vec3 w = (headPoint - PIVOT) * uHead + PIVOT;
  return (w.xy - CAM.xy) / ((CAM.z - w.z) * FIELD);
}

void main() {
  vec3 rd = normalize(vec3(vUv * FIELD, -1.0));
  float t = 3.7;
  float nearest = 1e3;
  float nearestT = t;
  float material = 0.0;
  for (int i = 0; i < 84; i++) {
    vec2 d = map(CAM + rd * t);
    if (d.x < nearest) { nearest = d.x; nearestT = t; }
    if (d.x < 0.0008 * t) { material = d.y; break; }
    t += d.x * 0.92;
    if (t > 6.6) break;
  }

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (material > 0.5) {
    col = shade(CAM + rd * t, rd, material);
    alpha = 1.0;
  } else {
    // Soften the outline: partly cover pixels the ray only just missed.
    float pixel = 2.0 * FIELD * nearestT / uRes.y;
    alpha = clamp(1.0 - nearest / pixel, 0.0, 1.0) * 0.9;
    col = vec3(0.02, 0.024, 0.03);
  }

  // Tone map, then gamma.
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  // Haze around the eyes and the seam, added on top of everything.
  vec3 haze = vec3(0.0);
  for (int s = 0; s < 2; s++) {
    vec2 eye = onScreen(vec3(s == 0 ? -0.155 : 0.155, 0.05, 0.38));
    float d = length(vUv - eye);
    haze += RED * uGlow * (0.30 * exp(-d * d * 700.0) + 0.16 * exp(-d * 10.0));
  }
  vec2 mouth = onScreen(vec3(0.0, -0.42, 0.36));
  float md = length((vUv - mouth) * vec2(1.0, 1.8));
  haze += RED * uGlow * uVoice * 0.30 * exp(-md * 9.0);

  // Fade out toward the bottom and sides so the bust has no hard edge.
  float fade = smoothstep(-1.0, -0.74, vUv.y) * smoothstep(1.0, 0.86, abs(vUv.x));
  alpha *= fade;
  haze *= fade;
  float hazeAlpha = clamp(max(haze.r, max(haze.g, haze.b)), 0.0, 1.0);
  float outAlpha = alpha + hazeAlpha * (1.0 - alpha);
  gl_FragColor = vec4(col * alpha + haze, outAlpha);
}`;

// ---------------------------------------------------------------------------
// A portrait: the person's own image, brought to life.
//
// Four points placed on the image drive everything: the two eyes get a glow
// that follows the state, and the line between the mouth corners is where the
// face splits. Below that line the image slides down as the voice level
// rises, and the gap that opens is filled with a lit cavity.
// ---------------------------------------------------------------------------
export const PORTRAIT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec4 uRect;      // where the image sits in the square: x, y, w, h
uniform float uAspect;   // image width / height
uniform vec2 uEyeL, uEyeR, uMouthL, uMouthR;   // 0..1 across the image, y down
uniform vec3 uColor;
uniform vec2 uShift;
uniform float uZoom, uTime, uPower, uGlow, uVoice, uFocus;

void main() {
  vec2 s = vec2(vUv.x, -vUv.y) * 0.5 + 0.5;
  s = (s - 0.5) / uZoom + 0.5 - uShift;
  vec2 uv = (s - uRect.xy) / uRect.zw;

  // Work in units of image height so distances are the same both ways.
  vec2 asp = vec2(uAspect, 1.0);
  vec2 a = uv * asp;
  vec2 eyeL = uEyeL * asp, eyeR = uEyeR * asp;
  vec2 mouthL = uMouthL * asp, mouthR = uMouthR * asp;
  float eyeGap = max(length(eyeR - eyeL), 1e-3);
  vec2 mouth = 0.5 * (mouthL + mouthR);
  float halfMouth = max(0.5 * length(mouthR - mouthL), 1e-3);
  vec2 along = (mouthR - mouthL) / (2.0 * halfMouth);
  vec2 down = vec2(-along.y, along.x);

  vec2 rel = a - mouth;
  float across = dot(rel, along) / halfMouth;   // -1..1 between the corners
  float below = dot(rel, down);                 // > 0 under the mouth line

  // The jaw: everything under the mouth line slides down, easing back to
  // nothing further down the image so the neck stays put.
  float open = uVoice * 0.17 * eyeGap * (1.0 - smoothstep(0.6, 1.3, abs(across)));
  float settle = 1.0 - smoothstep(0.9 * eyeGap, 2.0 * eyeGap, below);
  vec2 src = a - down * open * settle * step(0.0, below);

  vec4 tex = texture2D(uTex, src / asp);
  vec3 col = tex.a > 0.001 ? tex.rgb / tex.a : vec3(0.0);

  // The gap that opens above the jaw.
  float edge = 0.012 * eyeGap;
  float cavity = smoothstep(0.0, edge, below) * smoothstep(open, open - edge, below) * step(edge, open);
  float depth = clamp(below / max(open, 1e-4), 0.0, 1.0);
  float vanes = 0.4 + 0.6 * smoothstep(-0.2, 0.6, sin(across * 34.0));
  float pulse = 0.75 + 0.25 * sin(uTime * 19.0 + across * 9.0);
  vec3 inside = vec3(0.012) + uColor * uGlow * (0.2 + 1.5 * uVoice * pulse) * vanes * sin(depth * 3.14159);
  inside += vec3(1.0, 0.75, 0.6) * uGlow * uVoice * uVoice * 0.5 * vanes * sin(depth * 3.14159);
  col = mix(col, inside, cavity);

  col *= mix(0.2, 1.0, uPower);

  // Light added on top: eyes, spill around the mouth, the thinking sweep.
  vec3 light = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec2 d = (a - (i == 0 ? eyeL : eyeR)) / eyeGap;
    d.y *= 1.5;
    float r2 = dot(d, d);
    light += uColor * uGlow * (0.75 * exp(-r2 * 80.0) + 0.3 * exp(-r2 * 10.0));
    light += vec3(1.0, 0.85, 0.75) * uGlow * uGlow * 0.5 * exp(-r2 * 420.0);
  }
  vec2 md = rel / eyeGap;
  light += uColor * uGlow * uVoice * 0.35 * exp(-dot(md, md) * 7.0);
  // The sweep stays on the face rather than crossing the whole picture.
  vec2 fromFace = (a - 0.5 * (eyeL + eyeR)) / eyeGap;
  float sweep = fromFace.y - 0.4 - 1.5 * sin(uTime * 2.4);
  light += uColor * uFocus * 0.35 * exp(-sweep * sweep * 40.0) * exp(-fromFace.x * fromFace.x * 0.9);

  // Soft rounded-rectangle edge so the picture melts into the background.
  vec2 c = abs(uv - 0.5) * 2.0;
  float rim = pow(pow(c.x, 4.0) + pow(c.y, 4.0), 0.25);
  float mask = (1.0 - smoothstep(0.78, 1.0, rim)) * step(max(c.x, c.y), 1.0);
  float alpha = tex.a * mask;
  gl_FragColor = vec4((col + light) * alpha, alpha);
}`;
