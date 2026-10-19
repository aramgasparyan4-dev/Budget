import * as THREE from 'three';
import { G } from './globals';

// A low-poly humanoid whose skeleton is animated entirely in the vertex shader.
// Each vertex carries (bone, material). Per-instance attributes drive the gait,
// pose, colors and body shape, so hundreds of people cost one draw call.

export const enum Bone {
  Hips = 0,
  Spine = 1,
  Head = 2,
  LArm = 3,
  LFore = 4,
  RArm = 5,
  RFore = 6,
  LThigh = 7,
  LShin = 8,
  RThigh = 9,
  RShin = 10,
}
export const enum HMat {
  Skin = 0,
  Shirt = 1,
  Pants = 2,
  Shoes = 3,
  Hair = 4,
  Eyes = 5,
  HairLong = 6,
  HairBun = 7,
  Sleeve = 8,
}

export const enum Pose {
  Stand = 0,
  Sit = 1,
  Talk = 2,
  Wave = 3,
  Fallen = 4,
  Phone = 5,
  Dance = 6,
  Jump = 7,
  Drive = 8,
  Angry = 9,
  Carry = 10,
}

function pushPart(
  pos: number[], nrm: number[], bone: number[], idx: number[],
  geo: THREE.BufferGeometry, b: number, mat: number, m: THREE.Matrix4,
) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(m);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const base = pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    pos.push(p.getX(i), p.getY(i), p.getZ(i));
    nrm.push(n.getX(i), n.getY(i), n.getZ(i));
    bone.push(b, mat);
    idx.push(base + i);
  }
}

export function buildHumanGeometry(detail: 'high' | 'low' = 'high'): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const bone: number[] = [];
  const idx: number[] = [];
  const seg = detail === 'high' ? 10 : 6;
  const M = new THREE.Matrix4();
  const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
    M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
  const cyl = (r0: number, r1: number, h: number) => new THREE.CylinderGeometry(r1, r0, h, seg, 1);
  const sph = (r: number) => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 3));
  const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

  // hips / pelvis
  pushPart(pos, nrm, bone, idx, cyl(0.17, 0.155, 0.2), Bone.Hips, HMat.Pants, at(0, 0.93, 0, 1, 1, 0.72));
  // torso (tapered), chest
  pushPart(pos, nrm, bone, idx, cyl(0.155, 0.19, 0.42), Bone.Spine, HMat.Shirt, at(0, 1.2, 0, 1, 1, 0.66));
  pushPart(pos, nrm, bone, idx, sph(0.19), Bone.Spine, HMat.Shirt, at(0, 1.41, 0, 1, 0.42, 0.68));
  // neck & head
  pushPart(pos, nrm, bone, idx, cyl(0.055, 0.05, 0.12), Bone.Head, HMat.Skin, at(0, 1.5, 0));
  pushPart(pos, nrm, bone, idx, sph(0.115), Bone.Head, HMat.Skin, at(0, 1.66, 0.01, 0.92, 1.08, 1.0));
  pushPart(pos, nrm, bone, idx, box(0.035, 0.05, 0.04), Bone.Head, HMat.Skin, at(0, 1.645, 0.115));
  for (const ex of [-0.04, 0.04]) pushPart(pos, nrm, bone, idx, sph(0.018), Bone.Head, HMat.Eyes, at(ex, 1.685, 0.1));
  // hair variants
  pushPart(pos, nrm, bone, idx, new THREE.SphereGeometry(0.125, seg, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), Bone.Head, HMat.Hair, at(0, 1.675, -0.005, 0.98, 1.0, 1.05, -0.25));
  pushPart(pos, nrm, bone, idx, cyl(0.11, 0.125, 0.3), Bone.Head, HMat.HairLong, at(0, 1.56, -0.045, 1, 1, 0.7));
  pushPart(pos, nrm, bone, idx, sph(0.07), Bone.Head, HMat.HairBun, at(0, 1.76, -0.09));
  // arms (upper: shoulder at y 1.42)
  for (const side of [1, -1]) {
    const up = side > 0 ? Bone.LArm : Bone.RArm;
    const fo = side > 0 ? Bone.LFore : Bone.RFore;
    const x = side * 0.215;
    pushPart(pos, nrm, bone, idx, sph(0.06), up, HMat.Sleeve, at(x, 1.41, 0));
    pushPart(pos, nrm, bone, idx, cyl(0.052, 0.058, 0.28), up, HMat.Sleeve, at(x, 1.27, 0));
    pushPart(pos, nrm, bone, idx, cyl(0.04, 0.048, 0.26), fo, HMat.Skin, at(x, 1.0, 0));
    pushPart(pos, nrm, bone, idx, sph(0.046), fo, HMat.Skin, at(x, 0.85, 0.005, 0.8, 1.15, 0.9));
  }
  // legs (hip joint at y 0.9)
  for (const side of [1, -1]) {
    const th = side > 0 ? Bone.LThigh : Bone.RThigh;
    const sh = side > 0 ? Bone.LShin : Bone.RShin;
    const x = side * 0.092;
    pushPart(pos, nrm, bone, idx, cyl(0.065, 0.085, 0.44), th, HMat.Pants, at(x, 0.68, 0));
    pushPart(pos, nrm, bone, idx, cyl(0.05, 0.064, 0.42), sh, HMat.Pants, at(x, 0.26, 0));
    pushPart(pos, nrm, bone, idx, box(0.1, 0.075, 0.24), sh, HMat.Shoes, at(x, 0.04, 0.04));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aBone', new THREE.Float32BufferAttribute(bone, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.boundingSphere!.radius = 1.4;
  g.boundingSphere!.center.set(0, 0.9, 0);
  return g;
}

const HUMAN_VERT_HEAD = /* glsl */ `
attribute vec2 aBone;
attribute vec4 aAnim;
attribute vec4 aShirt;
attribute vec4 aPants;
attribute vec4 aSkin;
attribute vec4 aHair;
uniform float uTime;
varying vec3 vHCol;
flat varying float vHMat;

vec3 hRotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, p.y*c - p.z*s, p.y*s + p.z*c); }
vec3 hRotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x*c + p.z*s, p.y, -p.x*s + p.z*c); }
vec3 hRotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x*c - p.y*s, p.x*s + p.y*c, p.z); }
// rotate p around pivot q: first Z (abduction) then X (swing)
vec3 hJoint(vec3 p, vec3 q, float ax, float az){ return hRotX(hRotZ(p - q, az), ax) + q; }
`;

const HUMAN_VERT_ANIM = /* glsl */ `
{
  int bone = int(aBone.x + 0.5);
  float mat = aBone.y;
  float phase = aAnim.x;
  float gait = aAnim.y;
  float pose = floor(aAnim.z + 0.5);
  float aux = aAnim.w;
  float t = uTime + aSkin.w * 13.0;
  float walk = clamp(gait, 0.0, 1.0);
  float run = clamp(gait - 1.0, 0.0, 1.0);
  float legA = mix(0.0, 0.5, walk) + run * 0.38;
  float armA = mix(0.05, 0.42, walk) + run * 0.55;
  float sP = sin(phase);
  float thL = -sP * legA;
  float thR = sP * legA;
  float knL = (0.08 + max(0.0, sin(phase + 1.3)) * (0.55 + run * 0.6)) * (walk + run * 0.5);
  float knR = (0.08 + max(0.0, sin(phase + 1.3 + 3.14159)) * (0.55 + run * 0.6)) * (walk + run * 0.5);
  float shL = sP * armA;
  float shR = -sP * armA;
  float elL = -(0.15 + 0.25 * walk + 1.0 * run);
  float elR = elL;
  float abL = 0.06;
  float abR = -0.06;
  float lean = 0.04 * walk + 0.22 * run;
  float twist = sP * (0.06 * walk + 0.1 * run);
  float headX = 0.0;
  float headY = 0.0;
  float bob = (1.0 - cos(phase * 2.0)) * (0.018 * walk + 0.035 * run);
  float hipDrop = 0.0;
  float rootPitch = 0.0;
  float breath = sin(t * 1.6) * 0.012 * (1.0 - walk);
  lean += breath;
  if (pose == 1.0) { // sit
    thL = -1.5; thR = -1.5; knL = 1.5; knR = 1.5;
    shL = -0.35; shR = -0.35; elL = -0.7; elR = -0.7; hipDrop = 0.44; lean = -0.05 + breath;
  } else if (pose == 8.0) { // driving
    thL = -1.35; thR = -1.35; knL = 1.25; knR = 1.25;
    shL = -0.9; shR = -0.9; elL = -0.5; elR = -0.5; abL = 0.15; abR = -0.15; hipDrop = 0.42; lean = -0.15;
  } else if (pose == 2.0) { // talk / gesture
    float g = sin(t * 2.7) * 0.5 + 0.5;
    shR = -0.45 - g * 0.35; elR = -1.1 - g * 0.3; abR = -0.25;
    shL = -0.2 * aux; elL = -0.4 - aux * 0.6 * (sin(t * 2.1) * 0.5 + 0.5);
    headX = sin(t * 3.3) * 0.08;
    headY = sin(t * 0.9) * 0.12;
  } else if (pose == 3.0) { // wave
    shR = -0.2; abR = -2.5 + sin(t * 9.0) * 0.25; elR = -0.4;
  } else if (pose == 4.0) { // fallen (lying on back)
    rootPitch = -1.5;
    hipDrop = 0.78;
    shL = 0.3; shR = 0.3; abL = 0.8; abR = -0.8; knL = 0.3; knR = 0.1;
  } else if (pose == 5.0) { // phone at ear
    shL = -0.6; abL = 0.5; elL = -2.3; headY = 0.15;
  } else if (pose == 6.0) { // dance
    float b = sin(t * 7.5);
    bob = abs(b) * 0.06;
    shL = -0.4 + b * 0.5; shR = -0.4 - b * 0.5; abL = 0.7 + b * 0.3; abR = -0.7 + b * 0.3; elL = -1.2; elR = -1.2;
    twist = b * 0.25; thL = -abs(b) * 0.3; thR = -abs(1.0 - abs(b)) * 0.3; knL = abs(b) * 0.5; knR = (1.0 - abs(b)) * 0.5;
    headX = b * 0.15;
  } else if (pose == 7.0) { // jump / air
    float a = clamp(aux, 0.0, 1.0);
    thL = -0.6 * a; thR = -0.2 * a; knL = 1.0 * a; knR = 0.6 * a;
    shL = -0.8 * a; shR = -0.8 * a; abL = 0.4 * a; abR = -0.4 * a; elL = -0.6; elR = -0.6;
  } else if (pose == 9.0) { // angry
    float g = sin(t * 5.0) * 0.5 + 0.5;
    shR = -1.1 - g * 0.5; elR = -0.8; abR = -0.2; shL = -0.3; elL = -1.2; abL = 0.4;
    headX = 0.15 + sin(t * 6.0) * 0.08;
  } else if (pose == 10.0) { // carry box
    shL = -0.95; shR = -0.95; elL = -0.6; elR = -0.6; abL = -0.1; abR = 0.1;
  }

  vec3 P = transformed;
  vec3 Nn = objectNormal;
  // hair style selection: aHair.w = 0 short, 1 long, 2 bun, 3 bald
  float hs = floor(aHair.w + 0.5);
  if ((mat == 4.0 && hs == 3.0) || (mat == 6.0 && hs != 1.0) || (mat == 7.0 && hs != 2.0)) { P *= 0.0; }

  vec3 shoulderL = vec3(0.215, 1.41, 0.0);
  vec3 shoulderR = vec3(-0.215, 1.41, 0.0);
  vec3 elbowL = vec3(0.215, 1.13, 0.0);
  vec3 elbowR = vec3(-0.215, 1.13, 0.0);
  vec3 hipL = vec3(0.092, 0.9, 0.0);
  vec3 hipR = vec3(-0.092, 0.9, 0.0);
  vec3 kneeL = vec3(0.092, 0.47, 0.0);
  vec3 kneeR = vec3(-0.092, 0.47, 0.0);
  vec3 neck = vec3(0.0, 1.48, 0.0);
  vec3 spineP = vec3(0.0, 0.98, 0.0);

  if (bone == 8) { P = hJoint(P, kneeL, knL, 0.0); Nn = hRotX(Nn, knL); }
  if (bone == 10) { P = hJoint(P, kneeR, knR, 0.0); Nn = hRotX(Nn, knR); }
  if (bone == 7 || bone == 8) { P = hJoint(P, hipL, thL, 0.0); Nn = hRotX(Nn, thL); }
  if (bone == 9 || bone == 10) { P = hJoint(P, hipR, thR, 0.0); Nn = hRotX(Nn, thR); }
  if (bone == 4) { P = hJoint(P, elbowL, elL, 0.0); Nn = hRotX(Nn, elL); }
  if (bone == 6) { P = hJoint(P, elbowR, elR, 0.0); Nn = hRotX(Nn, elR); }
  if (bone == 3 || bone == 4) { P = hJoint(P, shoulderL, shL, abL); Nn = hRotX(hRotZ(Nn, abL), shL); }
  if (bone == 5 || bone == 6) { P = hJoint(P, shoulderR, shR, abR); Nn = hRotX(hRotZ(Nn, abR), shR); }
  if (bone == 2) { P = hRotY(hRotX(P - neck, headX), headY) + neck; Nn = hRotY(hRotX(Nn, headX), headY); }
  if (bone >= 1 && bone <= 6) {
    P = hRotX(hRotY(P - spineP, twist), lean) + spineP;
    Nn = hRotX(hRotY(Nn, twist), lean);
  }
  // body shape
  float build = aPants.w;
  float height = 0.9 + aSkin.w * 0.0 + aShirt.w;
  P.x *= build;
  P.z *= mix(1.0, build, 0.6);
  P.y += bob - hipDrop;
  // root pitch (fallen)
  if (rootPitch != 0.0) { P = hRotX(P - vec3(0.0, 0.1, 0.0), rootPitch) + vec3(0.0, 0.1, 0.0); Nn = hRotX(Nn, rootPitch); P.y += 0.05; }
  P *= height;
  transformed = P;
  objectNormal = Nn;

  vec3 col = aSkin.rgb;
  if (mat == 1.0 || mat == 8.0) col = aShirt.rgb;
  else if (mat == 2.0) col = aPants.rgb;
  else if (mat == 3.0) col = vec3(0.05, 0.045, 0.045) + aPants.rgb * 0.15;
  else if (mat == 4.0 || mat == 6.0 || mat == 7.0) col = aHair.rgb;
  else if (mat == 5.0) col = vec3(0.02);
  vHCol = col;
  vHMat = mat;
}
`;

function patchHumanVertex(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uTime = G.uTime;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + HUMAN_VERT_HEAD)
    // three computes view normals before begin_vertex; move that after the skeletal animation
    .replace('#include <defaultnormal_vertex>', '')
    .replace('#include <normal_vertex>', '')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + HUMAN_VERT_ANIM + '\n#include <defaultnormal_vertex>\n#include <normal_vertex>');
}

export function createHumanMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.0 });
  m.onBeforeCompile = (shader) => {
    patchHumanVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHCol;\nflat varying float vHMat;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vHCol;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vHMat == 5.0) roughnessFactor = 0.2; if (vHMat == 4.0 || vHMat == 6.0 || vHMat == 7.0) roughnessFactor = 0.55; if (vHMat == 3.0) roughnessFactor = 0.4;');
  };
  m.customProgramCacheKey = () => 'echo-human-v2';
  return m;
}

export function createHumanDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + HUMAN_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 objectNormal = vec3(0.0, 1.0, 0.0);\n' + HUMAN_VERT_ANIM);
    shader.uniforms.uTime = G.uTime;
  };
  m.customProgramCacheKey = () => 'echo-human-depth-v2';
  return m;
}

export interface HumanLook {
  shirt: THREE.Color;
  pants: THREE.Color;
  skin: THREE.Color;
  hair: THREE.Color;
  hairStyle: number; // 0 short 1 long 2 bun 3 bald
  build: number; // 0.85..1.2
  height: number; // added to 0.9 (0.02..0.2)
  seed: number;
}

/** A pool of animated humans drawn with one instanced mesh. */
export class Crowd {
  mesh: THREE.InstancedMesh;
  count = 0;
  readonly capacity: number;
  private aAnim: THREE.InstancedBufferAttribute;
  private aShirt: THREE.InstancedBufferAttribute;
  private aPants: THREE.InstancedBufferAttribute;
  private aSkin: THREE.InstancedBufferAttribute;
  private aHair: THREE.InstancedBufferAttribute;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(capacity: number, geometry: THREE.BufferGeometry, material: THREE.Material, depth: THREE.Material) {
    this.capacity = capacity;
    const g = geometry.clone();
    const mk = () => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aAnim = mk();
    this.aShirt = mk();
    this.aPants = mk();
    this.aSkin = mk();
    this.aHair = mk();
    g.setAttribute('aAnim', this.aAnim);
    g.setAttribute('aShirt', this.aShirt);
    g.setAttribute('aPants', this.aPants);
    g.setAttribute('aSkin', this.aSkin);
    g.setAttribute('aHair', this.aHair);
    this.mesh = new THREE.InstancedMesh(g, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.customDepthMaterial = depth;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin() {
    this.count = 0;
  }

  push(x: number, y: number, z: number, yaw: number, look: HumanLook, phase: number, gait: number, pose: number, aux = 0) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.q.setFromAxisAngle(this.up, yaw);
    this.v.set(x, y, z);
    this.m4.compose(this.v, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m4);
    this.aAnim.setXYZW(i, phase, gait, pose, aux);
    this.aShirt.setXYZW(i, look.shirt.r, look.shirt.g, look.shirt.b, look.height);
    this.aPants.setXYZW(i, look.pants.r, look.pants.g, look.pants.b, look.build);
    this.aSkin.setXYZW(i, look.skin.r, look.skin.g, look.skin.b, look.seed);
    this.aHair.setXYZW(i, look.hair.r, look.hair.g, look.hair.b, look.hairStyle);
    return i;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.count > 0) {
      for (const a of [this.aAnim, this.aShirt, this.aPants, this.aSkin, this.aHair]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, this.count * 4);
        a.needsUpdate = true;
      }
    }
  }
}

export const SKIN_TONES = [0xf3d3b8, 0xe8b894, 0xd29e76, 0xb57a52, 0x8d5a3a, 0x6a4027, 0x4a2c1c, 0xf6dcc6];
export const HAIR_COLS = [0x1a1210, 0x2b1d14, 0x4a3020, 0x7a5233, 0xb88a52, 0xd8c08a, 0x8a8a88, 0x5a2a1a, 0x101010];
const SHIRTS = [0x2d4a6e, 0x8c2f2f, 0xd9d4c7, 0x2f5e3f, 0x5b4a8a, 0xc98a2b, 0x222428, 0x6f8fa8, 0xa8a8a2, 0xb05a7a, 0x3d6b6b, 0xe0e0dc, 0x7a3b1d];
const PANTS = [0x22262e, 0x30343c, 0x3b4a66, 0x50463a, 0x1c1c1e, 0x6b5a45, 0x3a3f35, 0x2c3e5c];

export function randomLook(rand: () => number, female: boolean, wealth = 0.5): HumanLook {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length) % a.length];
  const lin = (hex: number) => new THREE.Color(hex);
  const shirt = lin(pick(SHIRTS));
  if (wealth > 0.8 && rand() < 0.5) shirt.setHex(pick([0x1d2430, 0x2a2a2e, 0xe9e7e2, 0x3c2f2a]));
  const hs = female ? (rand() < 0.65 ? 1 : rand() < 0.6 ? 2 : 0) : rand() < 0.08 ? 3 : 0;
  return {
    shirt,
    pants: lin(pick(PANTS)),
    skin: lin(pick(SKIN_TONES)),
    hair: lin(pick(HAIR_COLS)),
    hairStyle: hs,
    build: female ? 0.88 + rand() * 0.14 : 0.95 + rand() * 0.2,
    height: female ? 0.0 + rand() * 0.1 : 0.05 + rand() * 0.12,
    seed: rand(),
  };
}
