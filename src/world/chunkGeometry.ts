// Pure geometry generation for city chunks. Runs inside the chunk worker and
// falls back to the main thread if workers are unavailable.
import { MeshBuilder, GeometryData, lin, addBox, BASIC_LAYOUT } from '../render/MeshBuilder';
import { hash01 } from '../core/rng';
import { CityData, DISTRICT_IDS, Facade, GroundKind, CURB_H, BoxPart, Building } from './types';

export const BUILDING_LAYOUT = [
  { name: 'position', size: 3 },
  { name: 'normal', size: 3 },
  { name: 'color', size: 3 },
  { name: 'aUV', size: 2 },
  { name: 'aFace', size: 4 },
];
export const GROUND_LAYOUT = [
  { name: 'position', size: 3 },
  { name: 'normal', size: 3 },
  { name: 'aKind', size: 1 },
];

export interface ChunkBase {
  chunk: number;
  buildings: GeometryData | null;
  ground: GeometryData | null;
  overlay: GeometryData | null;
}
export interface ChunkDetail {
  chunk: number;
  markings: GeometryData | null;
  details: GeometryData | null;
}

function wallQuad(
  b: MeshBuilder,
  ax: number, az: number, bx: number, bz: number,
  y0: number, y1: number,
  nx: number, nz: number,
  color: number[], face: number[],
) {
  const w = Math.hypot(bx - ax, bz - az);
  const f = [face[0], face[1], face[2], w];
  const n = [nx, 0, nz];
  const i0 = b.v({ position: [ax, y0, az], normal: n, color, aUV: [0, y0], aFace: f });
  const i1 = b.v({ position: [bx, y0, bz], normal: n, color, aUV: [w, y0], aFace: f });
  const i2 = b.v({ position: [bx, y1, bz], normal: n, color, aUV: [w, y1], aFace: f });
  const i3 = b.v({ position: [ax, y1, az], normal: n, color, aUV: [0, y1], aFace: f });
  b.quadIdx(i0, i1, i2, i3);
}

function addPart(b: MeshBuilder, p: BoxPart, seed: number) {
  const col = lin(p.color);
  // aFace.z packs the storefront height and the part's top so windows never get cut by the roof line
  const face = [p.style, seed, Math.floor(p.y1 * 4) * 32 + Math.round(p.ground * 2), 0];
  // walls, counter-clockwise from outside; u runs left->right seen from outside
  wallQuad(b, p.x0, p.z1, p.x1, p.z1, p.y0, p.y1, 0, 1, col, face); // +z
  wallQuad(b, p.x1, p.z0, p.x0, p.z0, p.y0, p.y1, 0, -1, col, face); // -z
  wallQuad(b, p.x1, p.z1, p.x1, p.z0, p.y0, p.y1, 1, 0, col, face); // +x
  wallQuad(b, p.x0, p.z0, p.x0, p.z1, p.y0, p.y1, -1, 0, col, face); // -x
  {
    const rc = lin(p.roofColor ?? p.color);
    const rf = [p.roof === -1 ? Facade.Plain : p.roof, seed, 0, p.x1 - p.x0];
    const n = [0, 1, 0];
    const i0 = b.v({ position: [p.x0, p.y1, p.z1], normal: n, color: rc, aUV: [p.x0, p.z1], aFace: rf });
    const i1 = b.v({ position: [p.x1, p.y1, p.z1], normal: n, color: rc, aUV: [p.x1, p.z1], aFace: rf });
    const i2 = b.v({ position: [p.x1, p.y1, p.z0], normal: n, color: rc, aUV: [p.x1, p.z0], aFace: rf });
    const i3 = b.v({ position: [p.x0, p.y1, p.z0], normal: n, color: rc, aUV: [p.x0, p.z0], aFace: rf });
    b.quadIdx(i0, i1, i2, i3);
  }
}

function addGable(b: MeshBuilder, bld: Building, g: Building['gables'][number], seed: number) {
  const rc = lin(g.color);
  const wc = lin(bld.parts[0].color);
  const tile = [Facade.RoofTile, seed, 0, 0];
  const plain = [Facade.Plain, seed, 0, 0];
  const y0 = g.y0;
  const y1 = g.y0 + g.h;
  if (g.alongX) {
    const zm = (g.z0 + g.z1) / 2;
    const half = (g.z1 - g.z0) / 2;
    const sl = Math.hypot(half, g.h);
    // north slope (z0 side), normal points -z/up
    let n = [0, half / sl, -g.h / sl];
    let i0 = b.v({ position: [g.x1, y0, g.z0], normal: n, color: rc, aUV: [0, 0], aFace: tile });
    let i1 = b.v({ position: [g.x0, y0, g.z0], normal: n, color: rc, aUV: [g.x1 - g.x0, 0], aFace: tile });
    let i2 = b.v({ position: [g.x0, y1, zm], normal: n, color: rc, aUV: [g.x1 - g.x0, sl], aFace: tile });
    let i3 = b.v({ position: [g.x1, y1, zm], normal: n, color: rc, aUV: [0, sl], aFace: tile });
    b.quadIdx(i0, i1, i2, i3);
    n = [0, half / sl, g.h / sl];
    i0 = b.v({ position: [g.x0, y0, g.z1], normal: n, color: rc, aUV: [0, 0], aFace: tile });
    i1 = b.v({ position: [g.x1, y0, g.z1], normal: n, color: rc, aUV: [g.x1 - g.x0, 0], aFace: tile });
    i2 = b.v({ position: [g.x1, y1, zm], normal: n, color: rc, aUV: [g.x1 - g.x0, sl], aFace: tile });
    i3 = b.v({ position: [g.x0, y1, zm], normal: n, color: rc, aUV: [0, sl], aFace: tile });
    b.quadIdx(i0, i1, i2, i3);
    // gable ends (inset slightly to the wall plane)
    const ex0 = g.x0 + 0.4;
    const ex1 = g.x1 - 0.4;
    const ez0 = g.z0 + 0.4;
    const ez1 = g.z1 - 0.4;
    const a = b.v({ position: [ex0, y0, ez0], normal: [-1, 0, 0], color: wc, aUV: [0, y0], aFace: plain });
    const c = b.v({ position: [ex0, y0, ez1], normal: [-1, 0, 0], color: wc, aUV: [1, y0], aFace: plain });
    const d = b.v({ position: [ex0, y1 - 0.35, zm], normal: [-1, 0, 0], color: wc, aUV: [0.5, y1], aFace: plain });
    b.tri(a, c, d);
    const a2 = b.v({ position: [ex1, y0, ez1], normal: [1, 0, 0], color: wc, aUV: [0, y0], aFace: plain });
    const c2 = b.v({ position: [ex1, y0, ez0], normal: [1, 0, 0], color: wc, aUV: [1, y0], aFace: plain });
    const d2 = b.v({ position: [ex1, y1 - 0.35, zm], normal: [1, 0, 0], color: wc, aUV: [0.5, y1], aFace: plain });
    b.tri(a2, c2, d2);
  } else {
    const xm = (g.x0 + g.x1) / 2;
    const half = (g.x1 - g.x0) / 2;
    const sl = Math.hypot(half, g.h);
    let n = [-g.h / sl, half / sl, 0];
    let i0 = b.v({ position: [g.x0, y0, g.z0], normal: n, color: rc, aUV: [0, 0], aFace: tile });
    let i1 = b.v({ position: [g.x0, y0, g.z1], normal: n, color: rc, aUV: [g.z1 - g.z0, 0], aFace: tile });
    let i2 = b.v({ position: [xm, y1, g.z1], normal: n, color: rc, aUV: [g.z1 - g.z0, sl], aFace: tile });
    let i3 = b.v({ position: [xm, y1, g.z0], normal: n, color: rc, aUV: [0, sl], aFace: tile });
    b.quadIdx(i0, i1, i2, i3);
    n = [g.h / sl, half / sl, 0];
    i0 = b.v({ position: [g.x1, y0, g.z1], normal: n, color: rc, aUV: [0, 0], aFace: tile });
    i1 = b.v({ position: [g.x1, y0, g.z0], normal: n, color: rc, aUV: [g.z1 - g.z0, 0], aFace: tile });
    i2 = b.v({ position: [xm, y1, g.z0], normal: n, color: rc, aUV: [g.z1 - g.z0, sl], aFace: tile });
    i3 = b.v({ position: [xm, y1, g.z1], normal: n, color: rc, aUV: [0, sl], aFace: tile });
    b.quadIdx(i0, i1, i2, i3);
    const ex0 = g.x0 + 0.4;
    const ex1 = g.x1 - 0.4;
    const ez0 = g.z0 + 0.4;
    const ez1 = g.z1 - 0.4;
    const a = b.v({ position: [ex1, y0, ez0], normal: [0, 0, -1], color: wc, aUV: [0, y0], aFace: plain });
    const c = b.v({ position: [ex0, y0, ez0], normal: [0, 0, -1], color: wc, aUV: [1, y0], aFace: plain });
    const d = b.v({ position: [xm, y1 - 0.35, ez0], normal: [0, 0, -1], color: wc, aUV: [0.5, y1], aFace: plain });
    b.tri(a, c, d);
    const a2 = b.v({ position: [ex0, y0, ez1], normal: [0, 0, 1], color: wc, aUV: [0, y0], aFace: plain });
    const c2 = b.v({ position: [ex1, y0, ez1], normal: [0, 0, 1], color: wc, aUV: [1, y0], aFace: plain });
    const d2 = b.v({ position: [xm, y1 - 0.35, ez1], normal: [0, 0, 1], color: wc, aUV: [0.5, y1], aFace: plain });
    b.tri(a2, c2, d2);
  }
}

function groundTop(b: MeshBuilder, x0: number, x1: number, z0: number, z1: number, y: number, kind: number) {
  const n = [0, 1, 0];
  const i0 = b.v({ position: [x0, y, z1], normal: n, aKind: kind });
  const i1 = b.v({ position: [x1, y, z1], normal: n, aKind: kind });
  const i2 = b.v({ position: [x1, y, z0], normal: n, aKind: kind });
  const i3 = b.v({ position: [x0, y, z0], normal: n, aKind: kind });
  b.quadIdx(i0, i1, i2, i3);
}
function groundSides(b: MeshBuilder, x0: number, x1: number, z0: number, z1: number, y: number, kind: number) {
  const sides: [number, number, number, number, number, number][] = [
    [x0, z1, x1, z1, 0, 1],
    [x1, z0, x0, z0, 0, -1],
    [x1, z1, x1, z0, 1, 0],
    [x0, z0, x0, z1, -1, 0],
  ];
  for (const [ax, az, bx, bz, nx, nz] of sides) {
    const n = [nx, 0, nz];
    const i0 = b.v({ position: [ax, 0, az], normal: n, aKind: kind });
    const i1 = b.v({ position: [bx, 0, bz], normal: n, aKind: kind });
    const i2 = b.v({ position: [bx, y, bz], normal: n, aKind: kind });
    const i3 = b.v({ position: [ax, y, az], normal: n, aKind: kind });
    b.quadIdx(i0, i1, i2, i3);
  }
}

export function buildChunkBase(c: CityData, chunk: number): ChunkBase {
  const bb = new MeshBuilder(BUILDING_LAYOUT);
  for (const bld of c.buildings) {
    if (bld.chunk !== chunk) continue;
    const seed = DISTRICT_IDS.indexOf(bld.district) * 1000 + bld.seed;
    for (const p of bld.parts) addPart(bb, p, seed);
    for (const g of bld.gables) addGable(bb, bld, g, seed);
  }
  const gb = new MeshBuilder(GROUND_LAYOUT);
  const ob = new MeshBuilder(GROUND_LAYOUT);
  for (const q of c.ground) {
    if (q.chunk !== chunk) continue;
    const isBase = Math.abs(q.y) < 0.001 || Math.abs(q.y - CURB_H) < 0.001 || Math.abs(q.y - 0.02) < 0.001;
    if (isBase) {
      groundTop(gb, q.x0, q.x1, q.z0, q.z1, q.y, q.kind);
      if (q.y > 0.1) groundSides(gb, q.x0, q.x1, q.z0, q.z1, q.y, GroundKind.Concrete);
    } else {
      groundTop(ob, q.x0, q.x1, q.z0, q.z1, q.y, q.kind);
    }
  }
  return {
    chunk,
    buildings: bb.empty ? null : bb.build(),
    ground: gb.empty ? null : gb.build(),
    overlay: ob.empty ? null : ob.build(),
  };
}

export function buildChunkDetail(c: CityData, chunk: number): ChunkDetail {
  const mb = new MeshBuilder(GROUND_LAYOUT);
  for (const m of c.markings) {
    if (m.chunk !== chunk) continue;
    const dx = m.x1 - m.x0;
    const dz = m.z1 - m.z0;
    const L = Math.hypot(dx, dz) || 1;
    const px = (-dz / L) * (m.w / 2);
    const pz = (dx / L) * (m.w / 2);
    const y = 0.01;
    const n = [0, 1, 0];
    const k = m.color === 0 ? 10 : 11;
    const a = mb.v({ position: [m.x0 + px, y, m.z0 + pz], normal: n, aKind: k });
    const b = mb.v({ position: [m.x1 + px, y, m.z1 + pz], normal: n, aKind: k });
    const cc = mb.v({ position: [m.x1 - px, y, m.z1 - pz], normal: n, aKind: k });
    const d = mb.v({ position: [m.x0 - px, y, m.z0 - pz], normal: n, aKind: k });
    mb.quadIdx(a, b, cc, d);
  }
  // building details: awnings over storefronts, door frames
  const db = new MeshBuilder(BASIC_LAYOUT);
  const awningCols = [
    [0.55, 0.12, 0.12],
    [0.1, 0.3, 0.22],
    [0.12, 0.2, 0.42],
    [0.6, 0.45, 0.12],
    [0.22, 0.22, 0.24],
    [0.45, 0.2, 0.35],
    [0.85, 0.85, 0.82],
  ];
  for (const bld of c.buildings) {
    if (bld.chunk !== chunk) continue;
    const p = bld.parts[0];
    const doorCol = lin([0.12, 0.12, 0.13]);
    const f = bld.facing;
    const along = f === 0 || f === 2;
    const w = along ? p.x1 - p.x0 : p.z1 - p.z0;
    const rot = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][f];
    // door frame / canopy at entrance
    const dx = bld.door.x;
    const dz = bld.door.z;
    const outX = [0, 1, 0, -1][f];
    const outZ = [-1, 0, 1, 0][f];
    if (bld.kind === 'house' || bld.kind === 'mansion') {
      // door slab
      addBox(db, 0, 1.15, 0.05, 1.1, 2.2, 0.12, lin([0.35, 0.22, 0.14]), { tx: dx, ty: p.y0, tz: dz, ry: rot });
      // porch step
      addBox(db, 0, 0.1, 0.7, 2.2, 0.2, 1.2, lin([0.6, 0.6, 0.58]), { tx: dx, ty: p.y0, tz: dz, ry: rot });
      // small canopy
      addBox(db, 0, 2.6, 0.6, 2.4, 0.12, 1.3, lin([0.3, 0.3, 0.32]), { tx: dx, ty: p.y0, tz: dz, ry: rot });
      continue;
    }
    // doors for all other buildings
    addBox(db, 0, 1.25, 0.04, 2.0, 2.5, 0.1, doorCol, { tx: dx, ty: p.y0, tz: dz, ry: rot });
    if (p.ground > 0 && (bld.kind === 'shop' || bld.kind === 'tower' || bld.kind === 'apartment' || bld.kind === 'hotel' || bld.kind === 'mall')) {
      const h = hash01(bld.id, 77);
      const col = lin(awningCols[Math.floor(h * awningCols.length)]);
      const aw = Math.min(w * 0.8, 12);
      // slanted awning: approximate with a rotated thin box
      addBox(db, 0, 0, 0.75, aw, 0.08, 1.6, col, { tx: dx + outX * 0.05, ty: p.y0 + p.ground - 0.55, tz: dz + outZ * 0.05, ry: rot, rx: -0.32 });
      // sign band panel (lit at night)
      addBox(db, 0, p.ground - 0.15, 0.08, Math.min(w * 0.6, 8), 0.7, 0.12, lin([0.95, 0.92, 0.85]), { tx: dx, ty: p.y0, tz: dz, ry: rot }, 0.6);
    } else if (bld.kind === 'office' || bld.kind === 'tower' || bld.kind === 'hotel' || bld.kind === 'bank') {
      addBox(db, 0, 3.3, 1.2, 6, 0.25, 2.4, lin([0.2, 0.21, 0.23]), { tx: dx, ty: p.y0, tz: dz, ry: rot });
    } else if (bld.kind === 'warehouse' || bld.kind === 'factory' || bld.kind === 'depot') {
      // roll-up doors along the facade
      const n = Math.max(1, Math.floor(w / 12));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        const lx = t * w;
        addBox(db, lx, 2.2, 0.05, 4.2, 4.4, 0.12, lin([0.62, 0.62, 0.6]), { tx: dx, ty: p.y0, tz: dz, ry: rot });
      }
    } else if (bld.kind === 'club') {
      addBox(db, 0, 2.9, 0.4, 5, 0.3, 0.8, lin([0.9, 0.2, 0.7]), { tx: dx, ty: p.y0, tz: dz, ry: rot }, 2.5);
    }
  }
  return {
    chunk,
    markings: mb.empty ? null : mb.build(),
    details: db.empty ? null : db.build(),
  };
}
