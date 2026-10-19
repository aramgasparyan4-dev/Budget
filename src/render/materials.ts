import * as THREE from 'three';
import { G, GLSL_NOISE } from './globals';

// ---------------------------------------------------------------------------
// Building facades: procedural windows, brick, siding, storefronts and night lights.
const BUILDING_VERT_HEAD = /* glsl */ `
attribute vec2 aUV;
attribute vec4 aFace;
varying vec2 vFUV;
flat varying vec4 vFace;
varying vec3 vWPos;
varying vec3 vWN;
`;
const BUILDING_VERT_MAIN = /* glsl */ `
vFUV = aUV;
vFace = aFace;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
`;

const BUILDING_FRAG_HEAD = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uWet;
uniform float uHour;
uniform float uPower[6];
varying vec2 vFUV;
flat varying vec4 vFace;
varying vec3 vWPos;
varying vec3 vWN;
${GLSL_NOISE}
vec3 fAlb; float fRough; float fMetal; vec3 fEmis; vec2 fTilt;

float litProb(float style, float hour) {
  float evening = smoothstep(16.5, 19.5, hour) * (1.0 - smoothstep(23.0, 24.5, hour));
  float late = (1.0 - smoothstep(0.3, 2.8, hour));
  float morning = smoothstep(5.5, 6.5, hour) * (1.0 - smoothstep(8.0, 9.0, hour));
  if (style > 1.5 && style < 4.5) return 0.06 + 0.52 * evening + 0.22 * late + 0.25 * morning;
  float work = smoothstep(6.5, 8.5, hour) * (1.0 - smoothstep(17.0, 20.5, hour));
  return 0.08 + 0.5 * work + 0.08 * evening;
}

void storefront(vec3 base, float u, float v, float faceW, float gH, float seed, float night) {
  float nCols = max(1.0, floor(faceW / 3.2 + 0.5));
  float cw = faceW / nCols;
  float cu = u / cw;
  float ci = floor(cu);
  float fu = fract(cu);
  float aw = fwidth(cu) * 1.5 + 0.001;
  float mull = 1.0 - smoothstep(0.035, 0.035 + aw, min(fu, 1.0 - fu));
  float top = gH - 1.1;
  if (v > 0.45 && v < top) {
    float wid = h12(vec2(ci + seed, seed * 0.37));
    vec3 interior = mix(vec3(1.0, 0.8, 0.55), vec3(0.82, 0.9, 1.0), step(0.62, wid));
    float shelf = 0.65 + 0.35 * step(0.5, fract((v - 0.45) * 1.35 + wid));
    float glow = (0.16 + 1.0 * night) * shelf * (0.6 + 0.4 * wid);
    fAlb = vec3(0.035, 0.042, 0.05);
    fRough = 0.06;
    fMetal = 0.55;
    fEmis = interior * glow * (1.0 - mull);
    fAlb = mix(fAlb, vec3(0.1, 0.1, 0.11), mull);
    fRough = mix(fRough, 0.4, mull);
    float hframe = 1.0 - smoothstep(0.03, 0.06, min(v - 0.45, top - v));
    fAlb = mix(fAlb, vec3(0.1), hframe);
    fEmis *= 1.0 - hframe;
  } else if (v >= top && v < gH - 0.12) {
    vec3 sc = 0.5 + 0.5 * cos(6.2831 * (seed * 0.0137 + vec3(0.0, 0.33, 0.67)));
    fAlb = sc * 0.55 + 0.05;
    fRough = 0.45;
    fEmis = sc * night * 0.2;
  } else if (v < 0.45) {
    fAlb = vec3(0.09, 0.09, 0.1);
    fRough = 0.5;
  } else {
    fAlb = base * 0.8;
    fRough = 0.7;
  }
}

void facadeShade(vec3 base) {
  fAlb = base; fRough = 0.85; fMetal = 0.0; fEmis = vec3(0.0); fTilt = vec2(0.0);
  float style = floor(vFace.x + 0.5);
  float sd = vFace.y;
  int dist = int(clamp(floor(sd / 1000.0), 0.0, 5.0));
  float seed = mod(sd, 1000.0);
  float packed = vFace.z;
  float groundH = mod(packed, 32.0) * 0.5;
  float topY = floor(packed / 32.0) * 0.25;
  float faceW = vFace.w;
  vec3 N = normalize(vWN);
  float power = uPower[dist];
  float night = uNight * power;
  vec2 uv = vFUV;

  if (style == 9.0) {
    float row = floor(uv.y / 0.32);
    float off = mod(row, 2.0) * 0.5;
    float tu = fract(uv.x / 0.45 + off);
    float tv = fract(uv.y / 0.32);
    float tileV = h12(vec2(floor(uv.x / 0.45 + off), row) + seed);
    float fade = clamp(1.0 - fwidth(uv.y / 0.32) * 2.0, 0.0, 1.0);
    float edge = mix(1.0, smoothstep(0.0, 0.12, tv), fade);
    fAlb = base * (0.78 + 0.3 * tileV * fade) * (0.65 + 0.35 * edge);
    fAlb *= 1.0 - 0.3 * uWet;
    fRough = mix(0.82, 0.25, uWet);
    return;
  }
  if (N.y > 0.7 || style == 8.0) {
    float n1 = fbm(vWPos.xz * 0.35 + seed);
    fAlb = base * (0.78 + 0.42 * n1);
    float pud = smoothstep(0.55, 0.66, fbm(vWPos.xz * 0.15 + 3.1)) * uWet;
    fAlb *= 1.0 - 0.3 * uWet;
    fRough = mix(0.92, 0.06, pud);
    return;
  }
  if (N.y < -0.7) { fAlb = base * 0.5; return; }

  float u = uv.x;
  float v = uv.y;
  if (groundH > 0.0 && v < groundH + 0.12) {
    storefront(base, u, v, faceW, groundH, seed, night);
    fAlb *= 1.0 - 0.25 * uWet;
    return;
  }

  // style parameters
  float cellW = 3.2, cellH = 3.2, winW = 0.45, winH = 0.52, winY = 0.55;
  bool glassy = false;
  bool windows = true;
  vec3 wall = base;
  float wallRough = 0.88;
  float wallMetal = 0.0;
  float grime = (1.0 - smoothstep(0.0, 1.5, v)) * 0.22;
  float streak = vnoise(vec2(u * 1.3 + seed, v * 0.06)) * 0.14;

  if (style == 0.0 || style == 10.0) {
    glassy = true;
    cellW = style == 0.0 ? 1.55 : 1.9; cellH = 3.7; winW = 0.93; winH = style == 0.0 ? 0.82 : 0.9; winY = 0.52;
    wall = mix(vec3(0.55, 0.57, 0.6), base, 0.25) * (style == 10.0 ? 0.45 : 1.0);
    wallRough = 0.35; wallMetal = 0.85;
  } else if (style == 1.0) {
    cellW = 3.0; cellH = 3.8; winW = 0.965; winH = 0.5; winY = 0.56;
    float pan = vnoise(vec2(u * 0.4, v * 0.4) + seed);
    wall = base * (0.88 + 0.16 * pan - streak * 0.6);
    wallRough = 0.8;
  } else if (style == 2.0) {
    cellW = 3.0; cellH = 3.2; winW = 0.42; winH = 0.5;
    vec2 bp = vec2(u / 0.5, v / 0.22);
    float br = floor(bp.y);
    bp.x += mod(br, 2.0) * 0.5;
    vec2 bf = fract(bp);
    float fw = max(fwidth(bp.x), fwidth(bp.y));
    float fade = clamp(1.0 - fw * 1.6, 0.0, 1.0);
    float mortar = max(1.0 - smoothstep(0.04, 0.04 + fw, bf.x), 1.0 - smoothstep(0.08, 0.08 + fw, bf.y));
    float bv = h12(floor(bp) + seed);
    vec3 brick = base * (0.8 + 0.34 * bv);
    brick = mix(brick, vec3(0.55, 0.52, 0.48), mortar * 0.75);
    wall = mix(base * 0.92, brick, fade) * (1.0 - streak * 0.5);
  } else if (style == 3.0) {
    cellW = 3.3; cellH = 3.2; winW = 0.44; winH = 0.52;
    wall = base * (0.9 + 0.16 * fbm(vec2(u, v) * 0.5 + seed) - streak);
    float fl = fract(v / cellH);
    wall *= 1.0 - (1.0 - smoothstep(0.0, 0.05, fl)) * 0.12;
  } else if (style == 4.0) {
    cellW = 3.6; cellH = 3.0; winW = 0.32; winH = 0.42; winY = 0.55;
    float sl = fract(v / 0.21);
    float fw = fwidth(v / 0.21);
    float fade = clamp(1.0 - fw * 2.0, 0.0, 1.0);
    wall = base * (0.92 + 0.08 * mix(0.5, smoothstep(0.0, 0.18, sl), fade));
    wallRough = 0.75;
  } else if (style == 5.0) {
    cellW = 5.0; cellH = 4.6; winW = 0.62; winH = 0.16; winY = 0.86;
    float cor = 0.5 + 0.5 * sin(u * 6.2831 / 0.28);
    float fade = clamp(1.0 - fwidth(u / 0.28) * 1.5, 0.0, 1.0);
    wall = base * (0.86 + 0.16 * mix(0.5, cor, fade)) * (1.0 - streak * 0.8);
    float rust = smoothstep(0.62, 0.8, fbm(vec2(u * 0.3, v * 0.5) + seed));
    wall = mix(wall, vec3(0.38, 0.2, 0.1), rust * 0.35);
    wallRough = 0.55; wallMetal = 0.45;
  } else if (style == 6.0) {
    windows = false;
    wall = base * (0.86 + 0.2 * fbm(vec2(u, v) * 0.4 + seed) - streak * 0.5);
  } else if (style == 7.0) {
    storefront(base, u, mod(v, 6.0), faceW, 6.0, seed, night);
    return;
  } else if (style == 11.0) {
    windows = false;
    wall = base * (0.8 + 0.25 * vnoise(vec2(u, v) * 0.8));
    vec3 neon = 0.5 + 0.5 * cos(6.2831 * (seed * 0.021 + vec3(0.0, 0.33, 0.67)));
    neon = normalize(neon + 0.05) * 1.4;
    float band = (1.0 - smoothstep(0.05, 0.09, abs(v - 3.1))) + (1.0 - smoothstep(0.05, 0.09, abs(v - (topY - 0.6))));
    float vert = 1.0 - smoothstep(0.08, 0.12, min(u, faceW - u));
    float pulse = 0.85 + 0.15 * sin(uTime * 3.0 + seed);
    float m = clamp(band + vert, 0.0, 1.0);
    fAlb = mix(wall, neon * 0.5, m);
    fRough = 0.6;
    fEmis = neon * m * (0.6 + 3.2 * night) * pulse * power;
    return;
  }
  wall *= 1.0 - grime;

  float win = 0.0;
  float colI = 0.0, rowI = 0.0, fvv = 0.0;
  if (windows) {
    float margin = glassy ? 0.0 : 0.6;
    float usable = max(faceW - margin * 2.0, 0.1);
    float nCols = max(1.0, floor(usable / cellW + 0.5));
    float cw = usable / nCols;
    float cu = (u - margin) / cw;
    colI = floor(cu);
    float fu = fract(cu);
    float fv = v / cellH;
    rowI = floor(fv);
    fvv = fract(fv);
    float aw = fwidth(cu) * 1.2 + 0.0005;
    float av = fwidth(fv) * 1.2 + 0.0005;
    float wx = 1.0 - smoothstep(0.5 * winW - aw, 0.5 * winW + aw, abs(fu - 0.5));
    float wy = 1.0 - smoothstep(0.5 * winH - av, 0.5 * winH + av, abs(fvv - winY));
    win = wx * wy;
    win *= step(0.0, cu) * step(cu, nCols);
    float rowTop = (rowI + winY + winH * 0.5) * cellH;
    win *= step(rowTop, topY - 0.25);
    win *= step(0.7, v);
    if (!glassy) {
      // sill under punched windows
      float sill = (1.0 - smoothstep(0.0, av * 2.0 + 0.02, abs(fvv - (winY - winH * 0.5) + 0.02))) * wx;
      wall = mix(wall, vec3(0.72, 0.7, 0.66), sill * 0.6 * step(0.7, v));
    }
  }

  float wid = h12(vec2(colI, rowI) + seed * 1.37 + faceW * 0.1);
  float blinds = step(glassy ? 0.9 : 0.78, h12(vec2(rowI, colI) * 1.7 + seed));
  vec3 glassCol = glassy ? base * 0.34 + vec3(0.01, 0.015, 0.02) : vec3(0.045, 0.055, 0.07);
  glassCol *= 0.8 + 0.4 * h12(vec2(rowI, colI) + 7.0 + seed);
  glassCol = mix(glassCol, glassy ? base * 0.6 : vec3(0.5, 0.47, 0.42), blinds * 0.55);
  float gRough = mix(0.06 + 0.07 * h12(vec2(colI, rowI) + 3.0), 0.5, blinds);
  // individual panes are never perfectly coplanar: tilt each slightly so reflections break up like real glass
  fTilt = (vec2(h12(vec2(colI, rowI) + 11.0), h12(vec2(rowI, colI) + 23.0)) - 0.5) * 0.09 * win;
  float gMetal = mix(0.9, 0.1, blinds);

  float p = litProb(style, uHour);
  float lit = step(wid, p) * night;
  vec3 lightCol = mix(vec3(1.0, 0.7, 0.4), vec3(0.78, 0.86, 1.0), step(0.72, h12(vec2(colI * 3.1, rowI) + seed)));
  float inner = 0.55 + 0.45 * smoothstep(winY - winH * 0.5, winY + winH * 0.5, fvv);
  vec3 emis = lightCol * lit * (0.45 + 0.85 * h12(vec2(colI, rowI * 1.7) + seed)) * inner;
  // glass towers keep a faint glow in the day (lobbies / offices)
  emis += lightCol * 0.03 * step(wid, p) * (glassy ? 1.0 : 0.0) * power;

  fAlb = mix(wall, glassCol, win);
  fRough = mix(wallRough, gRough, win);
  fMetal = mix(wallMetal, gMetal * (1.0 - lit * 0.75), win);
  fEmis = emis * win;
  fAlb *= 1.0 - 0.22 * uWet;
}
`;

function patchBuilding(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uTime = G.uTime;
  shader.uniforms.uNight = G.uNight;
  shader.uniforms.uWet = G.uWet;
  shader.uniforms.uHour = G.uHour;
  shader.uniforms.uPower = G.uPower;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + BUILDING_VERT_HEAD)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + BUILDING_VERT_MAIN);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + BUILDING_FRAG_HEAD)
    .replace('#include <color_fragment>', '#include <color_fragment>\nfacadeShade(diffuseColor.rgb);\ndiffuseColor.rgb = fAlb;\ntotalEmissiveRadiance += fEmis;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fRough;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = fMetal;')
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      if (fTilt.x != 0.0 || fTilt.y != 0.0) {
        vec3 wn = normalize(vWN);
        vec3 th = normalize(cross(vec3(0.0, 1.0, 0.0), wn) + vec3(1e-4));
        vec3 vt = (viewMatrix * vec4(th, 0.0)).xyz;
        vec3 vu = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
        normal = normalize(normal + vt * fTilt.x + vu * fTilt.y);
      }`,
    );
}

export function createBuildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = patchBuilding;
  m.customProgramCacheKey = () => 'echo-building-v3';
  return m;
}

// ---------------------------------------------------------------------------
// Ground: asphalt, sidewalks, grass, plazas, markings with rain wetness.
const GROUND_VERT_HEAD = /* glsl */ `
attribute float aKind;
flat varying float vKind;
varying vec3 vWPos;
`;
const GROUND_VERT_MAIN = /* glsl */ `
vKind = aKind;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const GROUND_FRAG_HEAD = /* glsl */ `
uniform float uWet;
uniform float uTime;
uniform float uNight;
flat varying float vKind;
varying vec3 vWPos;
${GLSL_NOISE}
vec3 gAlb; float gRough; float gMetal; vec3 gEmis;
void groundShade() {
  float k = floor(vKind + 0.5);
  vec2 p = vWPos.xz;
  float n1 = fbm(p * 0.13);
  float n2 = vnoise(p * 1.7);
  float n3 = vnoise(p * 6.0);
  float porous = 1.0;
  gRough = 0.9; gMetal = 0.0; gEmis = vec3(0.0);
  if (k == 0.0 || k == 5.0) {
    gAlb = vec3(0.07, 0.072, 0.078) * (0.78 + 0.35 * n1 + 0.14 * n2 + 0.1 * n3);
    float cr = abs(vnoise(p * 0.8 + 4.0) - 0.5);
    gAlb *= mix(0.62, 1.0, smoothstep(0.0, 0.025, cr));
    float patchy = smoothstep(0.6, 0.75, vnoise(p * 0.05 + 2.0));
    gAlb = mix(gAlb, vec3(0.11, 0.11, 0.115), patchy * 0.6);
    if (k == 5.0) {
      gAlb *= 1.25;
      float lx = abs(fract(p.x / 3.0) - 0.5);
      float line = 1.0 - smoothstep(0.42, 0.44, 0.5 - lx);
      float fw = fwidth(p.x / 3.0);
      line *= clamp(1.0 - fw * 4.0, 0.0, 1.0);
      gAlb = mix(gAlb, vec3(0.7), line * 0.7);
    }
    gRough = 0.86;
  } else if (k == 1.0) {
    vec2 t = p / 1.5;
    vec2 f = fract(t);
    float g = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float fw = max(fwidth(t.x), fwidth(t.y));
    float line = (1.0 - smoothstep(0.0, 0.025 + fw, g)) * clamp(1.0 - fw * 3.0, 0.0, 1.0);
    float tv = h12(floor(t));
    gAlb = vec3(0.4, 0.395, 0.38) * (0.86 + 0.16 * tv + 0.1 * n2 - 0.08 * n1);
    gAlb *= 1.0 - 0.3 * line;
    gRough = 0.82;
  } else if (k == 2.0 || k == 9.0) {
    vec3 a = vec3(0.075, 0.13, 0.04);
    vec3 b = vec3(0.14, 0.2, 0.06);
    gAlb = mix(a, b, n1) * (0.82 + 0.34 * n3);
    if (k == 9.0) {
      gAlb *= 1.1;
      float st = step(0.5, fract(p.x / 2.4 + p.y * 0.0));
      gAlb *= 0.94 + 0.08 * st;
    } else {
      float dirt = smoothstep(0.66, 0.8, fbm(p * 0.07 + 9.0));
      gAlb = mix(gAlb, vec3(0.2, 0.17, 0.12), dirt * 0.6);
    }
    gRough = 0.98;
    porous = 0.4;
  } else if (k == 3.0) {
    vec2 t = vec2(p.x / 0.9, p.y / 0.45);
    t.x += mod(floor(t.y), 2.0) * 0.5;
    vec2 f = fract(t);
    float fw = max(fwidth(t.x), fwidth(t.y));
    float g = min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y));
    float line = (1.0 - smoothstep(0.0, 0.04 + fw, g)) * clamp(1.0 - fw * 2.5, 0.0, 1.0);
    float tv = h12(floor(t));
    gAlb = vec3(0.47, 0.42, 0.37) * (0.85 + 0.2 * tv + 0.08 * n2);
    gAlb *= 1.0 - 0.28 * line;
    gRough = 0.78;
  } else if (k == 4.0) {
    gAlb = vec3(0.28, 0.25, 0.2) * (0.72 + 0.5 * n1 + 0.1 * n3);
    gRough = 0.96;
  } else if (k == 6.0) {
    float w = vnoise(p * 1.4 + uTime * 0.4) * 0.5 + vnoise(p * 3.1 - uTime * 0.3) * 0.5;
    gAlb = vec3(0.02, 0.16, 0.22) * (0.8 + 0.4 * w);
    gRough = 0.04;
    gMetal = 0.0;
    gEmis = vec3(0.0, 0.05, 0.08) * (0.4 + 0.6 * uNight);
    porous = 0.0;
  } else if (k == 7.0) {
    gAlb = vec3(0.46, 0.455, 0.44) * (0.85 + 0.2 * n1 + 0.06 * n3);
    gRough = 0.85;
  } else if (k == 8.0) {
    gAlb = vec3(0.6, 0.53, 0.39) * (0.9 + 0.15 * n2);
    gRough = 1.0;
    porous = 0.5;
  } else if (k == 10.0 || k == 11.0) {
    vec3 c = k == 10.0 ? vec3(0.78, 0.78, 0.76) : vec3(0.72, 0.5, 0.06);
    float worn = smoothstep(0.25, 0.7, n3 * 0.6 + n1 * 0.6);
    gAlb = mix(c, vec3(0.12), worn * 0.45);
    gRough = 0.62;
  } else {
    gAlb = vec3(0.5);
  }
  // rain
  float wet = uWet * porous;
  float pud = smoothstep(0.56, 0.68, fbm(p * 0.07 + 11.0)) * smoothstep(0.25, 0.7, uWet) * porous;
  gAlb *= mix(1.0, 0.55, wet);
  gRough = mix(gRough, 0.32, wet * 0.75);
  gRough = mix(gRough, 0.03, pud);
  gAlb = mix(gAlb, gAlb * 0.55, pud);
  if (pud > 0.01) {
    float rip = vnoise(p * 9.0 + vec2(uTime * 2.1, -uTime * 1.7));
    gRough += rip * 0.05 * pud;
  }
}
`;

function patchGround(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uWet = G.uWet;
  shader.uniforms.uTime = G.uTime;
  shader.uniforms.uNight = G.uNight;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + GROUND_VERT_HEAD)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + GROUND_VERT_MAIN);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + GROUND_FRAG_HEAD)
    .replace('#include <color_fragment>', '#include <color_fragment>\ngroundShade();\ndiffuseColor.rgb = gAlb;\ntotalEmissiveRadiance += gEmis;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gMetal;');
}

export function createGroundMaterial(offset = false) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = patchGround;
  m.customProgramCacheKey = () => 'echo-ground-v2';
  if (offset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Props: vertex colors, emissive mask (positive aEmit) and wind sway (negative aEmit).
const PROP_VERT_HEAD = /* glsl */ `
attribute float aEmit;
varying float vEmit;
uniform float uTime;
uniform float uWind;
`;
const PROP_VERT_MAIN = /* glsl */ `
vEmit = max(aEmit, 0.0);
float sway = max(-aEmit, 0.0);
if (sway > 0.0) {
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float t = uTime * (1.1 + uWind) + ip.x * 0.21 + ip.z * 0.17;
  float amp = (0.04 + uWind * 0.22) * sway;
  transformed.x += sin(t) * amp * transformed.y * 0.12;
  transformed.z += cos(t * 0.83) * amp * transformed.y * 0.1;
}
`;
const PROP_FRAG_HEAD = /* glsl */ `
varying float vEmit;
uniform float uNight;
uniform float uWet;
`;

export function createPropMaterial(opts: { emissiveDay?: number; emissiveNight?: number; metal?: number; rough?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.1 });
  const day = opts.emissiveDay ?? 0.15;
  const nightE = opts.emissiveNight ?? 4.0;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = G.uTime;
    shader.uniforms.uWind = G.uWind;
    shader.uniforms.uNight = G.uNight;
    shader.uniforms.uWet = G.uWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + PROP_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + PROP_VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PROP_FRAG_HEAD)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmit * mix(${day.toFixed(3)}, ${nightE.toFixed(3)}, uNight);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, uWet);');
  };
  m.customProgramCacheKey = () => `echo-prop-${day}-${nightE}`;
  return m;
}

/** Unlit glow (signal lamps, light pools). */
export function createGlowMaterial(additive = false) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: false, toneMapped: false });
  if (additive) {
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
  }
  return m;
}

/** Radial gradient texture for light pools / glows. */
let radialTex: THREE.Texture | null = null;
export function getRadialTexture() {
  if (radialTex) return radialTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  radialTex = new THREE.CanvasTexture(c);
  radialTex.colorSpace = THREE.SRGBColorSpace;
  return radialTex;
}

/** Light pool decal material: brightness scales with night factor and rain. */
export function createLightPoolMaterial(color = new THREE.Color(1.0, 0.75, 0.45)) {
  const m = new THREE.MeshBasicMaterial({
    map: getRadialTexture(),
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = G.uNight;
    shader.uniforms.uWet = G.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uWet;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uNight * (0.55 + uWet * 0.6);');
  };
  m.customProgramCacheKey = () => 'echo-pool';
  return m;
}
