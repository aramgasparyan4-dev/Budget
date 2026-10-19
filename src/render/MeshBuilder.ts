// Lightweight geometry accumulator that runs in workers (no three.js dependency).
// Each builder has a fixed attribute layout; output is a set of typed arrays
// that can be transferred to the main thread and wrapped in a BufferGeometry.

export interface AttrSpec {
  name: string;
  size: number;
}

export interface GeometryData {
  attrs: Record<string, { array: Float32Array; size: number }>;
  index: Uint32Array;
  bounds: [number, number, number, number, number, number];
}

export class MeshBuilder {
  data: Record<string, number[]> = {};
  sizes: Record<string, number> = {};
  index: number[] = [];
  vcount = 0;
  minX = Infinity;
  minY = Infinity;
  minZ = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  maxZ = -Infinity;
  constructor(public specs: AttrSpec[]) {
    for (const s of specs) {
      this.data[s.name] = [];
      this.sizes[s.name] = s.size;
    }
  }
  /** Push a vertex; values keyed by attribute name. position/normal are mandatory. */
  v(attrs: Record<string, ArrayLike<number> | number>): number {
    for (const s of this.specs) {
      const val = attrs[s.name];
      const arr = this.data[s.name];
      if (typeof val === 'number') arr.push(val);
      else if (val) for (let i = 0; i < s.size; i++) arr.push(val[i] ?? 0);
      else for (let i = 0; i < s.size; i++) arr.push(0);
    }
    const p = attrs.position as ArrayLike<number>;
    if (p[0] < this.minX) this.minX = p[0];
    if (p[1] < this.minY) this.minY = p[1];
    if (p[2] < this.minZ) this.minZ = p[2];
    if (p[0] > this.maxX) this.maxX = p[0];
    if (p[1] > this.maxY) this.maxY = p[1];
    if (p[2] > this.maxZ) this.maxZ = p[2];
    return this.vcount++;
  }
  tri(a: number, b: number, c: number) {
    this.index.push(a, b, c);
  }
  quadIdx(a: number, b: number, c: number, d: number) {
    this.index.push(a, b, c, a, c, d);
  }
  get empty() {
    return this.vcount === 0;
  }
  build(): GeometryData {
    const attrs: GeometryData['attrs'] = {};
    for (const s of this.specs) attrs[s.name] = { array: new Float32Array(this.data[s.name]), size: s.size };
    return {
      attrs,
      index: new Uint32Array(this.index),
      bounds: [this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ],
    };
  }
}

/** sRGB -> linear for vertex colors. */
export function lin(c: ArrayLike<number>): [number, number, number] {
  return [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];
}

// ---------------------------------------------------------------------------
// Generic primitive helpers for the "basic" layout (position, normal, color, aEmit)
// used for props and vehicles.
export const BASIC_LAYOUT: AttrSpec[] = [
  { name: 'position', size: 3 },
  { name: 'normal', size: 3 },
  { name: 'color', size: 3 },
  { name: 'aEmit', size: 1 },
];

export interface Xform {
  /** translation */
  tx: number;
  ty: number;
  tz: number;
  /** yaw */
  ry: number;
  /** pitch (around local x) */
  rx?: number;
  /** roll (around local z) */
  rz?: number;
}

function rotateVec(x: number, y: number, z: number, t: Xform): [number, number, number] {
  // apply rz, rx, then ry
  if (t.rz) {
    const c = Math.cos(t.rz);
    const s = Math.sin(t.rz);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx;
    y = ny;
  }
  if (t.rx) {
    const c = Math.cos(t.rx);
    const s = Math.sin(t.rx);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }
  if (t.ry) {
    const c = Math.cos(t.ry);
    const s = Math.sin(t.ry);
    const nx = x * c + z * s;
    const nz = -x * s + z * c;
    x = nx;
    z = nz;
  }
  return [x, y, z];
}

const ID: Xform = { tx: 0, ty: 0, tz: 0, ry: 0 };

/** Axis-aligned box in local space (centered at cx,cy,cz with size sx,sy,sz) transformed by t. */
export function addBox(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  color: ArrayLike<number>,
  t: Xform = ID,
  emit = 0,
  skipBottom = true,
) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [number[], number[][]][] = [
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
    [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
  ];
  for (let f = 0; f < faces.length; f++) {
    if (skipBottom && f === 5) continue;
    const [n, vs] = faces[f];
    const nn = rotateVec(n[0], n[1], n[2], t);
    const idx = vs.map((p) => {
      const r = rotateVec(p[0] + cx, p[1] + cy, p[2] + cz, t);
      return b.v({ position: [r[0] + t.tx, r[1] + t.ty, r[2] + t.tz], normal: nn, color, aEmit: emit });
    });
    b.quadIdx(idx[0], idx[1], idx[2], idx[3]);
  }
}

/** Cylinder along local Y. */
export function addCylinder(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  r0: number, r1: number, h: number, seg: number,
  color: ArrayLike<number>,
  t: Xform = ID,
  emit = 0,
  caps = true,
) {
  const base = b.vcount;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const slope = (r0 - r1) / h;
    const nl = Math.hypot(1, slope);
    const n = rotateVec(ca / nl, slope / nl, sa / nl, t);
    const p0 = rotateVec(cx + ca * r0, cy, cz + sa * r0, t);
    const p1 = rotateVec(cx + ca * r1, cy + h, cz + sa * r1, t);
    b.v({ position: [p0[0] + t.tx, p0[1] + t.ty, p0[2] + t.tz], normal: n, color, aEmit: emit });
    b.v({ position: [p1[0] + t.tx, p1[1] + t.ty, p1[2] + t.tz], normal: n, color, aEmit: emit });
  }
  for (let i = 0; i < seg; i++) {
    const a = base + i * 2;
    b.quadIdx(a, a + 1, a + 3, a + 2);
  }
  if (caps) {
    const top = rotateVec(0, 1, 0, t);
    const c = rotateVec(cx, cy + h, cz, t);
    const ci = b.v({ position: [c[0] + t.tx, c[1] + t.ty, c[2] + t.tz], normal: top, color, aEmit: emit });
    const ring: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const p = rotateVec(cx + Math.cos(a) * r1, cy + h, cz + Math.sin(a) * r1, t);
      ring.push(b.v({ position: [p[0] + t.tx, p[1] + t.ty, p[2] + t.tz], normal: top, color, aEmit: emit }));
    }
    for (let i = 0; i < seg; i++) b.tri(ci, ring[i + 1], ring[i]);
  }
}

/** Low-poly sphere (UV sphere) with optional per-vertex jitter for foliage. */
export function addSphere(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
  wSeg: number, hSeg: number,
  color: ArrayLike<number>,
  t: Xform = ID,
  emit = 0,
  jitter = 0,
  seed = 1,
) {
  const base = b.vcount;
  for (let y = 0; y <= hSeg; y++) {
    const v = y / hSeg;
    const phi = v * Math.PI;
    for (let x = 0; x <= wSeg; x++) {
      const u = x / wSeg;
      const th = u * Math.PI * 2;
      let nx = -Math.cos(th) * Math.sin(phi);
      let ny = Math.cos(phi);
      let nz = Math.sin(th) * Math.sin(phi);
      let k = 1;
      if (jitter > 0 && y > 0 && y < hSeg) {
        const xi = x === wSeg ? 0 : x;
        const h = Math.sin(xi * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
        k = 1 + (h - Math.floor(h) - 0.5) * jitter;
      }
      const p = rotateVec(cx + nx * rx * k, cy + ny * ry * k, cz + nz * rz * k, t);
      const n = rotateVec(nx, ny, nz, t);
      b.v({ position: [p[0] + t.tx, p[1] + t.ty, p[2] + t.tz], normal: n, color, aEmit: emit });
    }
  }
  for (let y = 0; y < hSeg; y++) {
    for (let x = 0; x < wSeg; x++) {
      const a = base + y * (wSeg + 1) + x;
      const bb = a + wSeg + 1;
      if (y !== 0) b.tri(a, bb, a + 1);
      if (y !== hSeg - 1) b.tri(a + 1, bb, bb + 1);
    }
  }
}

/** Cone (for conifers). */
export function addCone(
  b: MeshBuilder,
  cx: number, cy: number, cz: number,
  r: number, h: number, seg: number,
  color: ArrayLike<number>,
  t: Xform = ID,
) {
  addCylinder(b, cx, cy, cz, r, 0.001, h, seg, color, t, 0, false);
  // bottom cap
  const down = rotateVec(0, -1, 0, t);
  const c = rotateVec(cx, cy, cz, t);
  const ci = b.v({ position: [c[0] + t.tx, c[1] + t.ty, c[2] + t.tz], normal: down, color, aEmit: 0 });
  const ring: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const p = rotateVec(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, t);
    ring.push(b.v({ position: [p[0] + t.tx, p[1] + t.ty, p[2] + t.tz], normal: down, color, aEmit: 0 }));
  }
  for (let i = 0; i < seg; i++) b.tri(ci, ring[i], ring[i + 1]);
}

/** Extrude a 2D profile (in local x=length, y=height) along local z (width). */
export function addExtrude(
  b: MeshBuilder,
  profile: [number, number][],
  width: number,
  color: ArrayLike<number>,
  t: Xform = ID,
  emit = 0,
  zOffset = 0,
) {
  const hw = width / 2;
  const n = profile.length;
  // side walls (z = +hw and -hw) via fan triangulation (profile must be convex or star-shaped from p0)
  for (const side of [1, -1]) {
    const nz = rotateVec(0, 0, side, t);
    const ids = profile.map(([x, y]) => {
      const p = rotateVec(x, y, side * hw + zOffset, t);
      return b.v({ position: [p[0] + t.tx, p[1] + t.ty, p[2] + t.tz], normal: nz, color, aEmit: emit });
    });
    for (let i = 1; i < n - 1; i++) {
      if (side === 1) b.tri(ids[0], ids[i], ids[i + 1]);
      else b.tri(ids[0], ids[i + 1], ids[i]);
    }
  }
  // perimeter faces
  for (let i = 0; i < n; i++) {
    const [x0, y0] = profile[i];
    const [x1, y1] = profile[(i + 1) % n];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    // outward normal for CCW profile
    const nn = rotateVec(dy / l, -dx / l, 0, t);
    const corners = [
      [x0, y0, -hw],
      [x1, y1, -hw],
      [x1, y1, hw],
      [x0, y0, hw],
    ].map(([x, y, z]) => {
      const p = rotateVec(x, y, z + zOffset, t);
      return b.v({ position: [p[0] + t.tx, p[1] + t.ty, p[2] + t.tz], normal: nn, color, aEmit: emit });
    });
    b.quadIdx(corners[0], corners[1], corners[2], corners[3]);
  }
}
