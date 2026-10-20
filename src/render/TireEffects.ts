import * as THREE from 'three';
import { G } from './globals';

/** Tire smoke: a pool of soft billboard puffs that rise, grow and fade. */
export class TireSmoke {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array; // seconds; < 0 = free
  private life: Float32Array;
  private size: Float32Array;
  private ageAttr: THREE.BufferAttribute;
  private next = 0;

  /** dark: 0 = tire smoke, 1 = black engine smoke */
  constructor(private capacity = 600, dark = 0) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity).fill(-1);
    this.life = new Float32Array(capacity).fill(1);
    this.size = new Float32Array(capacity);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.ageAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAge', this.ageAttr);
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 }, uNight: G.uNight, uDark: { value: dark } },
      vertexShader: /* glsl */ `
        attribute float aAge;
        attribute float aSize;
        uniform float uScale;
        varying float vAge;
        void main() {
          vAge = aAge;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aAge < 0.0 ? 0.0 : aSize * (0.6 + aAge * 2.4) * uScale / max(1.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        uniform float uDark;
        varying float vAge;
        void main() {
          if (vAge < 0.0) discard;
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p) * 2.0;
          float a = smoothstep(1.0, 0.2, r) * pow(1.0 - clamp(vAge, 0.0, 1.0), 1.6) * 0.42;
          vec3 c = mix(vec3(0.86, 0.87, 0.9), vec3(0.32, 0.34, 0.4), uNight);
          // engine smoke: sooty by day, a lighter grey at night so headlights and street lamps pick it up
          c = mix(c, vec3(0.1, 0.1, 0.11), uDark * (1.0 - uNight * 0.55));
          gl_FragColor = vec4(c, a * (1.0 + uDark * 0.5));
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** one puff at (x, y, z) drifting with (vx, vz) */
  emit(x: number, y: number, z: number, vx: number, vz: number, size = 1) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.pos[i * 3] = x + (Math.random() - 0.5) * 0.3;
    this.pos[i * 3 + 1] = y + 0.15;
    this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
    this.vel[i * 3] = vx * 0.25 + (Math.random() - 0.5) * 1.2;
    this.vel[i * 3 + 1] = 0.5 + Math.random() * 0.7;
    this.vel[i * 3 + 2] = vz * 0.25 + (Math.random() - 0.5) * 1.2;
    this.age[i] = 0;
    this.life[i] = 1.1 + Math.random() * 0.9;
    this.size[i] = (0.9 + Math.random() * 0.6) * size;
  }

  update(dt: number) {
    const ages = this.ageAttr.array as Float32Array;
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] < 0) {
        ages[i] = -1;
        continue;
      }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.age[i] = -1;
        ages[i] = -1;
        continue;
      }
      const drag = Math.exp(-dt * 1.6);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      ages[i] = t;
    }
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    this.ageAttr.needsUpdate = true;
  }

  /** viewport height in pixels for point sizing */
  setViewport(heightPx: number, fov: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
  }

  get live() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.age[i] >= 0) n++;
    return n;
  }

  clear() {
    this.age.fill(-1);
  }
}

/** Skid marks: a ring buffer of dark quads laid on the road behind sliding tires, fading over time. */
export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private birth: Float32Array;
  private next = 0;
  private last: ({ x: number; y: number; z: number } | null)[] = [];
  count = 0;

  constructor(private capacity = 3000) {
    this.pos = new Float32Array(capacity * 4 * 3);
    this.birth = new Float32Array(capacity * 4).fill(-1e6);
    const idx = new Uint32Array(capacity * 6);
    for (let q = 0; q < capacity; q++) {
      const a = q * 4;
      idx.set([a, a + 1, a + 2, a, a + 2, a + 3], q * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
      uniforms: { uNow: G.uTime },
      vertexShader: /* glsl */ `
        attribute float aBirth;
        uniform float uNow;
        varying float vA;
        void main() {
          vA = clamp(1.0 - (uNow - aBirth) / 40.0, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA <= 0.0) discard;
          gl_FragColor = vec4(0.02, 0.02, 0.025, 0.55 * vA);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** continue (or start) the mark of tire `wheel` at a ground point; pass null when the tire stops sliding */
  add(wheel: number, p: { x: number; y: number; z: number } | null, width = 0.24) {
    const prev = this.last[wheel] ?? null;
    if (!p) {
      this.last[wheel] = null;
      return;
    }
    if (!prev) {
      this.last[wheel] = { ...p };
      return;
    }
    const dx = p.x - prev.x;
    const dz = p.z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.35) return;
    if (len > 4) {
      // a jump (teleport, new run): start a fresh mark
      this.last[wheel] = { ...p };
      return;
    }
    const nx = (-dz / len) * width * 0.5;
    const nz = (dx / len) * width * 0.5;
    const y0 = prev.y + 0.015;
    const y1 = p.y + 0.015;
    const q = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
    const o = q * 12;
    this.pos.set([prev.x - nx, y0, prev.z - nz, prev.x + nx, y0, prev.z + nz, p.x + nx, y1, p.z + nz, p.x - nx, y1, p.z - nz], o);
    const now = G.uTime.value;
    this.birth.fill(now, q * 4, q * 4 + 4);
    const g = this.mesh.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aBirth') as THREE.BufferAttribute).needsUpdate = true;
    this.last[wheel] = { ...p };
  }

  clear() {
    this.birth.fill(-1e6);
    (this.mesh.geometry.getAttribute('aBirth') as THREE.BufferAttribute).needsUpdate = true;
    this.last = [];
    this.count = 0;
  }
}
