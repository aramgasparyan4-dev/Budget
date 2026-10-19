import * as THREE from 'three';
import { G } from './globals';

const VERT = /* glsl */ `
attribute vec4 aDrop; // x,z offset in box, phase, speed factor
attribute float aEnd; // 0 = top vertex, 1 = bottom vertex
uniform vec3 uCam;
uniform float uTime;
uniform float uIntensity;
uniform float uWind;
varying float vA;
const float BOX = 34.0;
const float H = 26.0;
void main() {
  float fall = 15.0 * aDrop.w;
  float y = H - mod(uTime * fall + aDrop.z * H, H);
  vec3 base = vec3(aDrop.x, 0.0, aDrop.y);
  // wrap horizontally around the camera
  vec3 p = base + vec3(floor((uCam.x - base.x) / BOX + 0.5) * BOX, 0.0, floor((uCam.z - base.z) / BOX + 0.5) * BOX);
  p.y = uCam.y - 6.0 + y;
  vec3 dir = vec3(uWind * 0.35, -1.0, uWind * 0.12);
  p += dir * aEnd * (0.55 + aDrop.w * 0.35);
  p.x += uWind * (H - y) * 0.06;
  vA = step(fract(aDrop.z * 7.31), uIntensity) * (0.25 + 0.35 * aEnd);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(uColor, vA * 0.55);
}
`;

export class Rain {
  group = new THREE.Group();
  private mesh: THREE.LineSegments | null = null;
  private mat: THREE.ShaderMaterial;
  private count = 0;
  private splashes: THREE.InstancedMesh;
  private splashData: { x: number; z: number; t: number }[] = [];

  constructor(count: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uTime: G.uTime,
        uIntensity: { value: 0 },
        uWind: { value: 0 },
        uColor: { value: new THREE.Color(0.75, 0.8, 0.9) },
      },
    });
    this.setCount(count);
    const ringGeo = new THREE.RingGeometry(0.03, 0.09, 10).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xbcc8d8, transparent: true, opacity: 0.35, depthWrite: false });
    this.splashes = new THREE.InstancedMesh(ringGeo, ringMat, 220);
    this.splashes.count = 0;
    this.splashes.frustumCulled = false;
    this.group.add(this.splashes);
    for (let i = 0; i < 220; i++) this.splashData.push({ x: 0, z: 0, t: Math.random() });
  }

  setCount(n: number) {
    if (n === this.count) return;
    this.count = n;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const pos = new Float32Array(n * 2 * 3);
    const drop = new Float32Array(n * 2 * 4);
    const end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 34;
      const z = (Math.random() - 0.5) * 34;
      const ph = Math.random();
      const sp = 0.8 + Math.random() * 0.5;
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        drop.set([x, z, ph, sp], j * 4);
        end[j] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDrop', new THREE.BufferAttribute(drop, 4));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.group.add(this.mesh);
  }

  update(dt: number, cam: THREE.Vector3, intensity: number, wind: number) {
    this.mat.uniforms.uCam.value.copy(cam);
    this.mat.uniforms.uIntensity.value = intensity;
    this.mat.uniforms.uWind.value = wind * 2;
    if (this.mesh) this.mesh.visible = intensity > 0.02;
    // splash rings on the ground around the camera
    const n = Math.floor(220 * Math.min(1, intensity * 1.2));
    this.splashes.count = n;
    if (!n) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const s = this.splashData[i];
      s.t += dt * 2.2;
      if (s.t >= 1) {
        s.t = 0;
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.sqrt(Math.random()) * 16;
        s.x = cam.x + Math.cos(a) * r;
        s.z = cam.z + Math.sin(a) * r;
      }
      const sc = 0.4 + s.t * 2.2;
      m.makeScale(sc, 1, sc);
      m.setPosition(s.x, 0.17, s.z);
      this.splashes.setMatrixAt(i, m);
    }
    this.splashes.instanceMatrix.needsUpdate = true;
  }
}
