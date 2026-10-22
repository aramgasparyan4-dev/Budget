// Turns a highway piece into meshes and collision: the deck and its markings, rails, the road the
// other way, tunnels, water, lamps, trees, rocks and buildings for its zone, signs, overpasses,
// roadworks and the gore where the road forks. Vertices are relative to the piece's first point
// (the group sits there), so precision holds wherever the road wanders.
import * as THREE from 'three';
import { RAPIER, type Physics } from '../../engine/Physics';
import { MeshBuilder, BASIC_LAYOUT, addBox, addCylinder, addCone, lin } from '../../render/MeshBuilder';
import { toBufferGeometry, buildPropModels } from '../../render/propModels';
import { createPropMaterial, createLightPoolMaterial } from '../../render/materials';
import type { PropType } from '../../world/types';
import { Piece, Path, LANE_W, RAIL_L, RAIL_R_OFF, STEP, SIDEWALK, STREET_GAP, JUNCTION_W, DOCKS_GATE, Rand } from './road';

const C = {
  asphalt: lin([0.25, 0.25, 0.27]),
  shoulder: lin([0.31, 0.31, 0.32]),
  verge: lin([0.4, 0.38, 0.34]),
  concrete: lin([0.66, 0.65, 0.62]),
  white: lin([0.88, 0.88, 0.86]),
  yellow: lin([0.86, 0.66, 0.12]),
  steel: lin([0.64, 0.66, 0.68]),
  pole: lin([0.46, 0.47, 0.49]),
  lamp: lin([1, 0.94, 0.82]),
  dark: lin([0.12, 0.12, 0.13]),
  tunnel: lin([0.55, 0.54, 0.5]),
  tile: lin([0.78, 0.78, 0.74]),
  earth: lin([0.36, 0.3, 0.22]),
  hill: lin([0.3, 0.4, 0.18]),
  sand: lin([0.78, 0.7, 0.52]),
  rock: lin([0.46, 0.4, 0.33]),
  orange: lin([0.95, 0.42, 0.05]),
  cushion: lin([0.95, 0.78, 0.05]),
  pavement: lin([0.5, 0.49, 0.47]),
  kerb: lin([0.62, 0.61, 0.58]),
  hedge: lin([0.12, 0.22, 0.08]),
  shop: lin([0.95, 0.78, 0.5]),
  red: lin([0.85, 0.08, 0.06]),
  green: lin([0.15, 1, 0.45]),
  signal: lin([0.08, 0.08, 0.09]),
};

const CONTAINERS = [lin([0.62, 0.12, 0.08]), lin([0.1, 0.28, 0.55]), lin([0.14, 0.42, 0.2]), lin([0.85, 0.42, 0.08]), lin([0.48, 0.5, 0.53]), lin([0.82, 0.82, 0.78]), lin([0.4, 0.12, 0.16]), lin([0.08, 0.45, 0.55])];
const CRANE = lin([0.95, 0.62, 0.08]);
const AWNINGS = [lin([0.6, 0.1, 0.08]), lin([0.1, 0.32, 0.55]), lin([0.15, 0.4, 0.2]), lin([0.55, 0.45, 0.1]), lin([0.2, 0.2, 0.22])];
/** the top of the pavements and kerbs */
const KERB_Y = 0.14;

const BUILDING_TONES = [lin([0.62, 0.6, 0.56]), lin([0.45, 0.47, 0.5]), lin([0.7, 0.66, 0.6]), lin([0.32, 0.35, 0.4]), lin([0.56, 0.5, 0.44])];
const WINDOW = lin([1, 0.85, 0.55]);

/** quads with uvs (the deck and the ground strips), in a piece's local space */
class Strip {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  emit: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  /** a quad from four corners (a, b on one row, c, d on the next), facing up */
  quad(a: V, b: V, c: V, d: V, color: ArrayLike<number>, tile: number, emit = 0, n: [number, number, number] = [0, 1, 0]) {
    const i = this.pos.length / 3;
    for (const p of [a, b, d, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.emit.push(emit);
      this.uv.push(p.u / tile, p.v / tile);
    }
    // a and b run left to right, c and d are the next row: (a, b, d) and (a, d, c) face up
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  get empty() {
    return this.idx.length === 0;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aEmit', new THREE.Float32BufferAttribute(this.emit, 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

interface V {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
}

/** a tileable grey noise texture (around 1.0) that gives asphalt, sand and grass some grain */
export function noiseTexture(size = 256) {
  const rng = new Rand(4711);
  const octaves = [8, 16, 32, 64].map((g) => ({ g, v: Array.from({ length: g * g }, () => rng.next()) }));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0;
      let amp = 0.5;
      for (const o of octaves) {
        const fx = (x / size) * o.g;
        const fy = (y / size) * o.g;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = sm(fx - ix);
        const ty = sm(fy - iy);
        const at = (i: number, j: number) => o.v[((j + o.g) % o.g) * o.g + ((i + o.g) % o.g)];
        const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
        const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
        n += (a + (b - a) * ty) * amp;
        amp *= 0.5;
      }
      const v = Math.round(255 * Math.max(0, Math.min(1, 0.72 + n * 0.32 + rng.next() * 0.08)));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export interface Built {
  piece: Piece;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  geometries: THREE.BufferGeometry[];
  instanced: THREE.InstancedMesh[];
}

const TREE_KINDS: PropType[] = ['tree', 'conifer', 'palm', 'bush'];

type Lat = (u: number) => number;
/** what the street builder needs from build() */
interface Kit {
  P: (u: number, lat: number, y?: number) => V;
  band: (u0: number, u1: number, la: Lat, lb: Lat, color: ArrayLike<number>, into?: Strip, y?: number, tile?: number, emit?: number) => void;
  head: (u: number) => number;
  deck: Strip;
  marks: Strip;
  pools: Strip;
  mb: MeshBuilder;
  body: RAPIER.RigidBody;
  rng: Rand;
  group: THREE.Group;
  instanced: THREE.InstancedMesh[];
  /** geometries to free with the piece */
  geometries: THREE.BufferGeometry[];
}

export class PieceBuilder {
  private deckMat: THREE.Material;
  private markMat: THREE.Material;
  private propMat: THREE.Material;
  private treeMat: THREE.Material;
  private poolMat: THREE.Material;
  private waterMat: THREE.Material;
  private signMats = new Map<string, THREE.MeshStandardMaterial>();
  /** the roadworks arrow boards blink */
  readonly arrowMat: THREE.MeshStandardMaterial;
  private models: Partial<Record<PropType, THREE.BufferGeometry>> = {};
  readonly tex: THREE.Texture;

  constructor(private physics: Physics) {
    this.tex = noiseTexture();
    const deck = createPropMaterial({ rough: 0.88, metal: 0, emissiveNight: 0.6 });
    deck.map = this.tex;
    this.deckMat = deck;
    const mark = createPropMaterial({ rough: 0.6, metal: 0, emissiveNight: 6 });
    mark.map = this.tex;
    mark.polygonOffset = true;
    mark.polygonOffsetFactor = -2;
    mark.polygonOffsetUnits = -4;
    this.markMat = mark;
    this.propMat = createPropMaterial({ emissiveNight: 5 });
    this.treeMat = createPropMaterial();
    this.poolMat = createLightPoolMaterial(new THREE.Color(1, 0.86, 0.66));
    this.poolMat.side = THREE.DoubleSide;
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5c, roughness: 0.12, metalness: 0.25 });
    this.arrowMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff9a1a, emissiveIntensity: 2 });
    const m = buildPropModels();
    for (const k of TREE_KINDS) if (m[k]) this.models[k] = m[k]!.geometry;
  }

  private signMat(text: string) {
    let m = this.signMats.get(text);
    if (m) return m;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0b6b3c';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 7;
    g.strokeRect(12, 12, c.width - 24, c.height - 24);
    g.fillStyle = '#ffffff';
    g.font = '600 66px Inter Variable, Arial, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 80);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05 });
    this.signMats.set(text, m);
    return m;
  }

  /** signs glow a little at night */
  setNight(night: number) {
    for (const m of this.signMats.values()) m.emissiveIntensity = 0.05 + 0.45 * night;
  }

  build(piece: Piece): Built {
    const path = piece.path;
    const ox = piece.xs[0];
    const oz = piece.zs[0];
    const group = new THREE.Group();
    group.position.set(ox, 0, oz);
    const rng = new Rand(piece.seed);
    const geometries: THREE.BufferGeometry[] = [];
    const instanced: THREE.InstancedMesh[] = [];
    const deck = new Strip();
    const marks = new Strip();
    const water = new Strip();
    const mb = new MeshBuilder(BASIC_LAYOUT);
    const pools = new Strip();
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(ox, 0, oz));
    const n = piece.xs.length;
    const S = (u: number) => piece.s0 + Math.min(piece.len, Math.max(0, u));
    /** a local point on this path */
    const at = (p: Path, s: number, lat: number, y: number): V => {
      const q = p.pose(s, lat);
      return { x: q.x - ox, y, z: q.z - oz, u: 0, v: 0 };
    };
    const P = (u: number, lat: number, y = 0.02): V => {
      const q = at(path, S(u), lat, y);
      q.u = piece.s0 + u;
      q.v = lat;
      return q;
    };
    const head = (u: number) => path.pose(S(u)).h;
    const gore = piece.gore;
    /** 0 where the gore side has no shoulder yet, 1 once the branches are apart */
    const goreW = (u: number, side: 'left' | 'right') => (gore && gore.side === side ? Math.max(0, Math.min(1, (u - (gore.end - 16)) / 24)) : 1);

    // ---------------------------------------------------------------- deck
    const band = (u0: number, u1: number, la: (u: number) => number, lb: (u: number) => number, color: ArrayLike<number>, into = deck, y = 0.02, tile = 12, emit = 0) => {
      // always left to right, so it faces up
      const [l0, l1] = la(u0) <= lb(u0) ? [la, lb] : [lb, la];
      const a = P(u0, l0(u0), y);
      const b = P(u0, l1(u0), y);
      const c = P(u1, l0(u1), y);
      const d = P(u1, l1(u1), y);
      if (Math.abs(l1(u0) - l0(u0)) < 0.01 && Math.abs(l1(u1) - l0(u1)) < 0.01) return;
      into.quad(a, b, c, d, color, tile, emit);
    };
    const eR = (u: number) => path.rightEdge(S(u));
    const railR = (u: number) => eR(u) + 3 * goreW(u, 'right') + 0.4 * goreW(u, 'right');
    const railL = (u: number) => RAIL_L * goreW(u, 'left');
    const CL = path.compLanes;
    if (!piece.street) for (let i = 0; i < n - 1; i++) {
      const u0 = i * STEP;
      const u1 = u0 + STEP;
      // verge, shoulder, lanes, shoulder, verge
      band(u0, u1, (u) => railL(u) - 0.9 * goreW(u, 'left'), railL, C.verge);
      band(u0, u1, railL, () => 0, C.shoulder);
      band(u0, u1, () => 0, eR, C.asphalt);
      band(u0, u1, eR, (u) => eR(u) + 3 * goreW(u, 'right'), C.shoulder);
      band(u0, u1, (u) => eR(u) + 3 * goreW(u, 'right'), (u) => railR(u) + 0.9 * goreW(u, 'right'), C.verge);
      // the road the other way
      const g0 = path.companionGap(S(u0));
      const g1 = path.companionGap(S(u1));
      if (g0 !== null && g1 !== null && g0 < 150) {
        const gap = (u: number) => path.companionGap(S(u)) ?? g0;
        const W = CL * LANE_W;
        band(u0, u1, (u) => -gap(u) + 1.3, (u) => -gap(u), C.shoulder);
        band(u0, u1, (u) => -gap(u), (u) => -gap(u) - W, C.asphalt);
        band(u0, u1, (u) => -gap(u) - W, (u) => -gap(u) - W - 3.4, C.shoulder);
        band(u0, u1, (u) => -gap(u) - W - 3.4, (u) => -gap(u) - W - 4.3, C.verge);
        const line = (l: (u: number) => number, color: ArrayLike<number>, dashed: boolean) => {
          if (dashed && (piece.s0 + u0) % 12 >= 3) return;
          band(u0, u1, (u) => l(u) - 0.08, (u) => l(u) + 0.08, color, marks, 0.035, 12, 0.06);
        };
        line((u) => -gap(u) - 0.15, C.yellow, false);
        line((u) => -gap(u) - W + 0.15, C.white, false);
        for (let k = 1; k < CL; k++) line((u) => -gap(u) - k * LANE_W, C.white, true);
        // its rails (no collision: you cannot get there)
        if (!piece.tunnel) for (const l of [(u: number) => -gap(u) + 1.3, (u: number) => -gap(u) - W - 3.4]) this.rail(mb, P, u0, u1, l, false);
      }
      // markings: yellow on the left, white on the right, dashes between lanes
      const line = (l: (u: number) => number, color: ArrayLike<number>) => band(u0, u1, (u) => l(u) - 0.08, (u) => l(u) + 0.08, color, marks, 0.035, 12, 0.06);
      if (!(gore && gore.side === 'left' && u0 < gore.end)) line(() => 0.15, C.yellow);
      else line(() => 0.12, C.white);
      line((u) => eR(u) - 0.15, C.white);
      const sAbs = piece.s0 + u0;
      if (sAbs % 12 < 3) {
        const lanes = Math.max(path.lanes(S(u0)), path.lanes(S(u1)));
        for (let k = 1; k < Math.ceil(lanes - 0.2); k++) {
          if (k > path.lanes(S(u0)) - 0.35) continue;
          line(() => k * LANE_W, C.white);
        }
      }
      // rails (or the causeway's parapets, or the tunnel's walls)
      if (!piece.tunnel) {
        if (!(gore && gore.side === 'left' && u0 < gore.end)) this.rail(mb, P, u0, u1, railL, piece.water);
        if (!(gore && gore.side === 'right' && u0 < gore.end)) this.rail(mb, P, u0, u1, railR, piece.water);
      }
      // the skirts under the deck edges, down to the ground
      for (const l of [(u: number) => railL(u) - 0.9 * goreW(u, 'left'), (u: number) => railR(u) + 0.9 * goreW(u, 'right')]) {
        const a = P(u0, l(u0), 0.02);
        const b = P(u1, l(u1), 0.02);
        const a2 = { ...a, y: -0.45 };
        const b2 = { ...b, y: -0.45 };
        deck.quad(a, a2, b, b2, C.verge, 6, 0);
        deck.quad(a2, a, b2, b, C.verge, 6, 0);
      }
    }

    // ---------------------------------------------------------------- gore (the right branch draws it)
    if (gore && gore.side === 'left') {
      const other = gore.other;
      let cushion = -1;
      for (let u = 0; u < gore.end + 6; u += STEP) {
        const A = P(u, 0);
        const B = at(other, u, other.rightEdge(u), 0.02);
        const A1 = P(u + STEP, 0);
        const B1 = at(other, u + STEP, other.rightEdge(u + STEP), 0.02);
        deck.quad(B, A, B1, A1, C.shoulder, 12);
        if (Math.floor(u / 6) % 2 === 0) marks.quad({ ...B, y: 0.036 }, { ...A, y: 0.036 }, { ...B1, y: 0.036 }, { ...A1, y: 0.036 }, C.white, 12, 0.06);
        if (cushion < 0 && Math.hypot(A.x - B.x, A.z - B.z) > 2.6) cushion = u;
      }
      if (cushion >= 0) {
        const A = P(cushion, 0);
        const B = at(other, cushion, other.rightEdge(cushion), 0);
        const h = head(cushion);
        const cx = (A.x + B.x) / 2;
        const cz = (A.z + B.z) / 2;
        const t = { tx: cx, ty: 0, tz: cz, ry: h };
        addBox(mb, 0, 0.5, 0, 1.1, 1.0, 3.2, C.cushion, t);
        for (let k = 0; k < 3; k++) addBox(mb, 0, 0.5, -1.2 + k * 1.2, 1.14, 0.18, 0.18, C.dark, t);
        this.box(body, cx, 0.6, cz, 0.6, 0.6, 1.7, h);
      }
    }

    // ---------------------------------------------------------------- collision: rails and walls
    if (!piece.street) for (let u = 0; u < piece.len - 0.1; u += 8) {
      const u1 = Math.min(piece.len, u + 8);
      const hy = piece.tunnel ? 3.2 : 0.6;
      if (!(gore && gore.side === 'left' && u < gore.end)) this.segment(body, P(u, railL(u)), P(u1, railL(u1)), hy);
      if (!(gore && gore.side === 'right' && u < gore.end)) this.segment(body, P(u, railR(u)), P(u1, railR(u1)), hy);
    }

    // ---------------------------------------------------------------- tunnel
    if (piece.tunnel) this.tunnel(mb, P, piece, railL, railR, path);

    // ---------------------------------------------------------------- lamps
    if ((piece.lamps || piece.tunnel) && !piece.street) {
      for (let s = Math.ceil(piece.s0 / 50) * 50; s < piece.s0 + piece.len; s += 50) {
        const u = s - piece.s0;
        const h = head(u);
        const w = eR(u);
        if (!piece.tunnel) {
          const base = P(u, RAIL_L - 0.5, 0);
          const t = { tx: base.x, ty: 0, tz: base.z, ry: h };
          addCylinder(mb, 0, 0, 0, 0.16, 0.11, 10.4, 8, C.pole, t);
          // local x is to the left of the road
          addBox(mb, -2.6, 10.3, 0, 5.2, 0.14, 0.14, C.pole, t);
          addBox(mb, -5.0, 10.15, 0, 1.1, 0.16, 0.5, C.lamp, t, 1);
        }
        for (const l of w > 9 ? [4.5, w - 4] : [w / 2]) {
          const c = P(u, l, 0.04);
          const r = 11;
          const q = (dx: number, dz: number): V => ({ x: c.x + dx, y: 0.04, z: c.z + dz, u: 0, v: 0 });
          const a = q(-r, -r);
          const b = q(r, -r);
          const cc = q(-r, r);
          const d = q(r, r);
          a.u = 0;
          a.v = 0;
          b.u = 1;
          b.v = 0;
          cc.u = 0;
          cc.v = 1;
          d.u = 1;
          d.v = 1;
          pools.quad(a, b, cc, d, [1, 1, 1], 1);
        }
      }
    }

    // ---------------------------------------------------------------- overpass
    if (piece.overpass !== null) {
      const u = piece.overpass;
      const h = head(u);
      const gap = path.companionGap(S(u));
      const minL = gap !== null && gap < 150 ? -gap - CL * LANE_W - 12 : RAIL_L - 12;
      const maxR = railR(u) + 12;
      const mid = P(u, (minL + maxR) / 2, 0);
      const t = { tx: mid.x, ty: 0, tz: mid.z, ry: h };
      const span = maxR - minL + 40;
      addBox(mb, 0, 7.1, 0, span, 1.1, 12, C.concrete, t);
      for (const s of [-1, 1]) addBox(mb, 0, 7.95, s * 5.9, span, 0.6, 0.3, C.concrete, t);
      for (const l of [minL + 4, maxR - 4, ...(gap !== null && gap < 150 ? [-gap / 2] : [])]) {
        const pp = P(u, l, 0);
        addBox(mb, 0, 3.3, 0, 1.2, 6.6, 8, C.concrete, { tx: pp.x, ty: 0, tz: pp.z, ry: h });
      }
    }

    // ---------------------------------------------------------------- signs
    if (piece.sign) {
      const sg = piece.sign;
      const u = Math.min(piece.len - 2, sg.at);
      const h = head(u);
      const w = eR(u);
      const posts = [RAIL_L - 0.6, railR(u) + 0.6];
      for (const l of posts) {
        const p = P(u, l, 0);
        addBox(mb, 0, 3.7, 0, 0.4, 7.4, 0.4, C.pole, { tx: p.x, ty: 0, tz: p.z, ry: h });
      }
      const mid = P(u, (posts[0] + posts[1]) / 2, 0);
      addBox(mb, 0, 7.2, 0, posts[1] - posts[0], 0.45, 0.45, C.pole, { tx: mid.x, ty: 0, tz: mid.z, ry: h });
      const boards: [string, number, number][] = sg.right && sg.split ? [
        [sg.left, (sg.split * LANE_W) / 2, sg.split * LANE_W - 0.5],
        [sg.right, ((sg.split + path.lanes(S(u))) * LANE_W) / 2, (path.lanes(S(u)) - sg.split) * LANE_W - 0.5],
      ] : [[sg.left, w * 0.6, Math.min(9, w * 0.7)]];
      for (const [text, l, width] of boards) {
        const p = P(u, l, 6.2);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.2), this.signMat(text));
        geometries.push(board.geometry);
        board.position.set(p.x - Math.sin(h) * 0.3, 6.2, p.z - Math.cos(h) * 0.3);
        board.rotation.y = h + Math.PI;
        group.add(board);
      }
    }

    // ---------------------------------------------------------------- roadworks
    if (piece.works) {
      const w = piece.works;
      const l0 = w.lane * LANE_W;
      const l1 = l0 + LANE_W;
      // the cones sweep across the lane, run along it, and sweep back
      const coneAt = (u: number, l: number) => {
        const p = P(u, l, 0.02);
        addCone(mb, p.x, 0.02, p.z, 0.22, 0.75, 8, C.orange);
        addCylinder(mb, p.x, 0.36, p.z, 0.15, 0.12, 0.12, 8, C.white, undefined, 0.3, false);
      };
      const inner = w.lane === 0 ? l1 : l0;
      const outer = w.lane === 0 ? l0 : l1;
      for (let u = w.from; u < w.full; u += 5) coneAt(u, outer + ((inner - outer) * (u - w.from)) / (w.full - w.from));
      for (let u = w.full; u < w.to; u += 10) coneAt(u, inner);
      for (let u = w.to; u < Math.min(piece.len, w.to + 40); u += 5) coneAt(u, inner + ((outer - inner) * (u - w.to)) / 40);
      // heavy barrels across the lane where it closes, and a flashing arrow board
      for (let k = 0; k < 3; k++) {
        const l = l0 + 0.6 + k * 1.1;
        const p = P(w.full + 4, l, 0);
        addCylinder(mb, p.x, 0, p.z, 0.42, 0.42, 1.05, 10, C.orange);
        addCylinder(mb, p.x, 0.45, p.z, 0.43, 0.43, 0.18, 10, C.white, undefined, 0.3, false);
        this.cyl(body, p.x, 0.55, p.z, 0.45, 0.55);
      }
      const ab = P(w.full + 14, (l0 + l1) / 2, 0);
      const h = head(w.full + 14);
      addBox(mb, 0, 0.9, 0, 2.0, 1.8, 0.8, C.dark, { tx: ab.x, ty: 0, tz: ab.z, ry: h });
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), this.arrowMat);
      geometries.push(arrow.geometry);
      arrow.position.set(ab.x - Math.sin(h) * 0.42, 1.25, ab.z - Math.cos(h) * 0.42);
      arrow.rotation.y = h + Math.PI;
      group.add(arrow);
      this.box(body, ab.x, 0.9, ab.z, 1.0, 0.9, 0.4, h);
    }

    // ---------------------------------------------------------------- water and the sea
    const sea = piece.zone === 'coast';
    if ((piece.water || sea) && !piece.tunnel && !piece.street) {
      for (let i = 0; i < n - 1; i += 5) {
        const u0 = i * STEP;
        const u1 = Math.min(piece.len, u0 + 5 * STEP);
        const gap = path.companionGap(S(u0));
        const leftIn = gap !== null && gap < 150 ? -gap - CL * LANE_W - 4.4 : railL(u0) - 1.2;
        // the sea on the left on the coast; both sides on a causeway
        band(u0, u1, () => leftIn, () => leftIn - 7, C.sand, water, -0.2, 20);
        band(u0, u1, () => leftIn - 7, () => -260, [0.12, 0.3, 0.38], water, -0.12, 30);
        if (piece.water) band(u0, u1, (u) => railR(u) + 1.2, () => 240, [0.12, 0.3, 0.38], water, -0.12, 30);
      }
    }

    // ---------------------------------------------------------------- trees, rocks, buildings
    if (!piece.tunnel && !piece.street) this.scenery(piece, rng, mb, P, eR, railR, group, instanced, piece.water);

    // ---------------------------------------------------------------- a downtown street
    if (piece.street) this.street(piece, { P, band, head, deck, marks, pools, mb, body, rng, group, instanced, geometries });

    // ---------------------------------------------------------------- meshes
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean, order = 0) => {
      geometries.push(g);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.castShadow = shadow;
      m.renderOrder = order;
      group.add(m);
    };
    add(deck.build(), this.deckMat, false);
    if (!marks.empty) add(marks.build(), this.markMat, false);
    if (!water.empty) {
      const g = water.build();
      geometries.push(g);
      // sand and sea share the strip: vertex colours on a standard material
      const m = new THREE.Mesh(g, this.waterMatFor());
      m.receiveShadow = true;
      group.add(m);
    }
    if (!pools.empty) add(pools.build(), this.poolMat, false, 2);
    add(toBufferGeometry(mb.build()), this.propMat, true);
    return { piece, group, body, geometries, instanced };
  }

  private waterVC: THREE.Material | null = null;
  private waterMatFor() {
    if (!this.waterVC) {
      const m = this.waterMat.clone() as THREE.MeshStandardMaterial;
      m.vertexColors = true;
      m.color.set(0xffffff);
      this.waterVC = m;
    }
    return this.waterVC;
  }

  /** a steel rail on posts (or a concrete parapet) along a lateral line */
  private rail(mb: MeshBuilder, P: (u: number, l: number, y?: number) => V, u0: number, u1: number, l: (u: number) => number, parapet: boolean) {
    const a = P(u0, l(u0), 0);
    const b = P(u1, l(u1), 0);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ry = Math.atan2(b.x - a.x, b.z - a.z);
    const t = { tx: (a.x + b.x) / 2, ty: 0, tz: (a.z + b.z) / 2, ry };
    if (parapet) {
      addBox(mb, 0, 0.45, 0, 0.32, 0.9, len + 0.02, C.concrete, t);
      return;
    }
    addBox(mb, 0, 0.7, 0, 0.08, 0.32, len + 0.02, C.steel, t);
    if (Math.round((a.u ?? 0) / STEP) % 2 === 0) addBox(mb, 0, 0.38, 0, 0.12, 0.76, 0.12, C.pole, t);
  }

  private tunnel(mb: MeshBuilder, P: (u: number, l: number, y?: number) => V, piece: Piece, railL: (u: number) => number, railR: (u: number) => number, path: Path) {
    const H = 6.4;
    for (let u = 0; u < piece.len - 0.01; u += STEP) {
      const u1 = Math.min(piece.len, u + STEP);
      for (const [l, side] of [
        [railL, 1],
        [railR, -1],
      ] as const) {
        const a = P(u, l(u), 0);
        const b = P(u1, l(u1), 0);
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const ry = Math.atan2(b.x - a.x, b.z - a.z);
        const t = { tx: (a.x + b.x) / 2, ty: 0, tz: (a.z + b.z) / 2, ry };
        // tiled lower wall, plain upper wall, a light strip along the top
        addBox(mb, side * 0.15, 1.4, 0, 0.3, 2.8, len + 0.02, C.tile, t);
        addBox(mb, side * 0.15, 4.6, 0, 0.3, 3.6, len + 0.02, C.tunnel, t);
        if (Math.floor(u / STEP) % 5 === 0) addBox(mb, -side * 0.05, H - 0.4, 0, 0.12, 0.12, 4, C.lamp, t, 1);
      }
      const l0 = railL(u) - 0.3;
      const r0 = railR(u) + 0.3;
      const mid = P(u + STEP / 2, (l0 + r0) / 2, 0);
      const ry = path.pose(piece.s0 + u + STEP / 2).h;
      const t = { tx: mid.x, ty: 0, tz: mid.z, ry };
      addBox(mb, 0, H + 0.15, 0, r0 - l0 + 0.6, 0.3, STEP + 0.02, C.tunnel, t);
      // the hill over it, stepping down to the ground (and stopping short of the other road)
      const w = r0 - l0;
      const gap = path.companionGap(piece.s0 + u);
      const leftRoom = gap !== null && gap < 150 ? Math.max(1, gap - 6) : 30;
      addBox(mb, 0, H + 1.6, 0, w + 2, 2.6, STEP + 0.02, C.hill, t);
      for (const [side, room] of [
        [1, leftRoom],
        [-1, 30],
      ] as const) {
        const a = Math.min(15, room);
        addBox(mb, side * (w / 2 + a / 2), (H + 2.9) / 2, 0, a, H + 2.9, STEP + 0.02, C.hill, t);
        if (room > 16) addBox(mb, side * (w / 2 + 15 + (room - 15) / 2), H * 0.3, 0, room - 15, H * 0.6, STEP + 0.02, C.hill, t);
      }
    }
    // portals at both ends
    for (const u of [0, piece.len]) {
      const l0 = railL(u) - 0.3;
      const r0 = railR(u) + 0.3;
      const mid = P(u, (l0 + r0) / 2, 0);
      const ry = path.pose(piece.s0 + u).h;
      const t = { tx: mid.x, ty: 0, tz: mid.z, ry };
      const w = r0 - l0;
      addBox(mb, 0, H + 1.2, 0, w + 2, 2.4, 1.2, C.concrete, t);
      for (const s of [-1, 1]) addBox(mb, s * (w / 2 + 8), H / 2 + 1, 0, 16, H + 2, 1.2, C.concrete, t);
    }
  }

  private scenery(
    piece: Piece,
    rng: Rand,
    mb: MeshBuilder,
    P: (u: number, l: number, y?: number) => V,
    eR: (u: number) => number,
    railR: (u: number) => number,
    group: THREE.Group,
    instanced: THREE.InstancedMesh[],
    water: boolean,
  ) {
    const path = piece.path;
    const zone = piece.zone;
    const len = piece.len;
    const counts: Partial<Record<PropType, { x: number; z: number; s: number; r: number }[]>> = {};
    const plant = (kind: PropType, u: number, lat: number, scale: number) => {
      const p = P(u, lat, 0);
      (counts[kind] ??= []).push({ x: p.x, z: p.z, s: scale, r: rng.next() * 6.28 });
    };
    const leftStart = (u: number) => {
      const g = path.companionGap(piece.s0 + u);
      return g !== null && g < 150 ? -g - path.compLanes * LANE_W - 10 : RAIL_L - 7;
    };
    const per = { forest: 0.09, fields: 0.022, coast: 0.016, desert: 0.012, city: 0.006, downtown: 0, docks: 0 }[zone];
    for (const side of [-1, 1]) {
      if (water && side === 1) continue;
      if (zone === 'coast' && side === -1) continue;
      const count = Math.round(len * per * (0.7 + rng.next() * 0.6));
      for (let i = 0; i < count; i++) {
        const u = rng.next() * len;
        const off = 6 + Math.pow(rng.next(), 1.7) * 150;
        const lat = side === 1 ? railR(u) + off : leftStart(u) - off;
        const kind: PropType = zone === 'forest' ? (rng.next() < 0.8 ? 'conifer' : 'tree') : zone === 'coast' ? (rng.next() < 0.6 ? 'palm' : 'bush') : zone === 'desert' ? 'bush' : rng.next() < 0.7 ? 'tree' : 'bush';
        plant(kind, u, lat, 0.8 + rng.next() * 0.7);
      }
      // a few in a wide median
      const g = path.companionGap(piece.s0 + len / 2);
      if (side === -1 && g !== null && g > 26 && zone !== 'city') for (let i = 0; i < len * per * 0.4; i++) plant(zone === 'forest' ? 'conifer' : 'tree', rng.next() * len, RAIL_L - 5 - rng.next() * (g - 12), 0.7 + rng.next() * 0.5);
    }
    // rocks in the desert
    if (zone === 'desert') {
      for (let i = 0; i < len * 0.02; i++) {
        const u = rng.next() * len;
        const side = rng.next() < 0.5 ? -1 : 1;
        const lat = side === 1 ? railR(u) + 8 + rng.next() * 140 : leftStart(u) - 6 - rng.next() * 140;
        const p = P(u, lat, 0);
        const s = 1 + rng.next() * 4;
        addBox(mb, 0, s * 0.35, 0, s * (0.8 + rng.next()), s * 0.7, s * (0.8 + rng.next()), C.rock, { tx: p.x, ty: 0, tz: p.z, ry: rng.next() * 3 });
      }
    }
    // the city: blocks of buildings with lit floors, and noise walls by the road
    if (zone === 'city') {
      for (const side of [-1, 1]) {
        for (let u = rng.next() * 30; u < len; u += 34 + rng.next() * 40) {
          const d = 30 + rng.next() * 160;
          const lat = side === 1 ? railR(u) + d : leftStart(u) - d;
          const p = P(u, lat, 0);
          const w = 18 + rng.next() * 30;
          const dep = 16 + rng.next() * 24;
          const h = 14 + Math.pow(rng.next(), 2) * 110;
          const ry = path.pose(piece.s0 + u).h + (rng.next() - 0.5) * 0.2;
          const t = { tx: p.x, ty: 0, tz: p.z, ry };
          addBox(mb, 0, h / 2, 0, w, h, dep, BUILDING_TONES[Math.floor(rng.next() * BUILDING_TONES.length)], t);
          // a lit band on each floor, on the sides that face the road
          for (let fy = 3; fy < h - 2; fy += 3.4) {
            if (rng.next() < 0.35) continue;
            addBox(mb, 0, fy, 0, w + 0.06, 0.9, dep + 0.06, WINDOW, t, rng.next() < 0.6 ? 0.55 : 0.12);
          }
        }
      }
      if (piece.seed % 3 !== 0 && !water) {
        for (let u = 0; u < len - 0.01; u += 8) {
          const a = P(u, railR(u) + 1.4, 0);
          const b = P(Math.min(len, u + 8), railR(Math.min(len, u + 8)) + 1.4, 0);
          const ry = Math.atan2(b.x - a.x, b.z - a.z);
          addBox(mb, 0, 1.8, 0, 0.25, 3.6, Math.hypot(b.x - a.x, b.z - a.z) + 0.05, C.concrete, { tx: (a.x + b.x) / 2, ty: 0, tz: (a.z + b.z) / 2, ry });
        }
      }
    }
    void eR;
    this.plant(counts, group, instanced);
  }

  /** instanced trees and bushes */
  private plant(counts: Partial<Record<PropType, { x: number; z: number; s: number; r: number }[]>>, group: THREE.Group, instanced: THREE.InstancedMesh[]) {
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [kind, list] of Object.entries(counts) as [PropType, { x: number; z: number; s: number; r: number }[]][]) {
      const geo = this.models[kind];
      if (!geo || !list.length) continue;
      const im = new THREE.InstancedMesh(geo, this.treeMat, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.r);
        mtx.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
        im.setMatrixAt(i, mtx);
      });
      im.castShadow = true;
      im.computeBoundingSphere();
      group.add(im);
      instanced.push(im);
    }
  }

  /**
   * A downtown street: our lanes and the other direction's right beside them (a double yellow
   * line, or a raised island where the two are still apart), kerbs and pavements, buildings with
   * lit shop fronts along both sides, street lamps, and cross streets closed off with barriers, with
   * zebra crossings and signals. The facades are walls: the street is the way through.
   */
  private street(piece: Piece, k: Kit) {
    const { P, band, head, deck, marks, pools, mb, body, rng } = k;
    const path = piece.path;
    const len = piece.len;
    const n = piece.xs.length;
    const S = (u: number) => piece.s0 + Math.min(len, Math.max(0, u));
    const eR = (u: number) => path.rightEdge(S(u));
    const gap = (u: number) => path.companionGap(S(u)) ?? STREET_GAP;
    const W = path.compLanes * LANE_W;
    const edgeL = (u: number) => -gap(u) - W;
    const faceR = (u: number) => eR(u) + SIDEWALK;
    const faceL = (u: number) => edgeL(u) - SIDEWALK;
    const inJ = (u: number, pad = 0) => piece.junctions.some((j) => Math.abs(u - j) < JUNCTION_W / 2 + pad);
    const line = (u0: number, u1: number, l: Lat, color: ArrayLike<number>, w = 0.08) => band(u0, u1, (u) => l(u) - w, (u) => l(u) + w, color, marks, 0.035, 12, 0.06);
    /** the face of a kerb along a lateral line (both ways round, so it shows from either side) */
    const kerbFace = (u0: number, u1: number, l: Lat) => {
      const a = P(u0, l(u0), 0.02);
      const b = P(u1, l(u1), 0.02);
      const a2 = { ...a, y: KERB_Y };
      const b2 = { ...b, y: KERB_Y };
      deck.quad(a, a2, b, b2, C.kerb, 6, 0);
      deck.quad(a2, a, b2, b, C.kerb, 6, 0);
    };

    // ---------------------------------------------------------------- the road surface
    for (let i = 0; i < n - 1; i++) {
      const u0 = i * STEP;
      const u1 = u0 + STEP;
      const um = u0 + STEP / 2;
      band(u0, u1, () => 0, eR, C.asphalt);
      band(u0, u1, edgeL, (u) => -gap(u), C.asphalt);
      // the middle: a double yellow line, or an island where the two directions are apart
      if (gap(u0) > 0.9 && gap(u1) > 0.9) {
        band(u0, u1, (u) => -gap(u), (u) => -gap(u) + 0.3, C.asphalt);
        band(u0, u1, () => -0.3, () => 0, C.asphalt);
        band(u0, u1, (u) => -gap(u) + 0.3, () => -0.3, C.hedge, deck, KERB_Y, 4);
        kerbFace(u0, u1, () => -0.3);
        kerbFace(u0, u1, (u) => -gap(u) + 0.3);
        line(u0, u1, () => 0.15, C.yellow);
        line(u0, u1, (u) => -gap(u) - 0.15, C.yellow);
      } else {
        band(u0, u1, (u) => -gap(u), () => 0, C.asphalt);
        line(u0, u1, (u) => -gap(u) / 2 - 0.13, C.yellow, 0.06);
        line(u0, u1, (u) => -gap(u) / 2 + 0.13, C.yellow, 0.06);
      }
      // edge lines and lane dashes, both ways (not across a junction)
      const j = inJ(um);
      if (!j) {
        line(u0, u1, (u) => eR(u) - 0.2, C.white);
        line(u0, u1, (u) => edgeL(u) + 0.2, C.white);
      }
      if ((piece.s0 + u0) % 12 < 3 && !j) {
        for (let q = 1; q < Math.ceil(path.lanes(S(u0)) - 0.2); q++) if (q <= path.lanes(S(u0)) - 0.35) line(u0, u1, () => q * LANE_W, C.white);
        for (let q = 1; q < path.compLanes; q++) line(u0, u1, (u) => -gap(u) - q * LANE_W, C.white);
      }
      // pavements and kerbs; across a junction the asphalt carries on instead
      if (!j) {
        band(u0, u1, eR, (u) => eR(u) + 0.3, C.kerb, deck, KERB_Y, 4);
        band(u0, u1, (u) => eR(u) + 0.3, faceR, C.pavement, deck, KERB_Y, 3);
        band(u0, u1, (u) => edgeL(u) - 0.3, edgeL, C.kerb, deck, KERB_Y, 4);
        band(u0, u1, faceL, (u) => edgeL(u) - 0.3, C.pavement, deck, KERB_Y, 3);
        kerbFace(u0, u1, eR);
        kerbFace(u0, u1, edgeL);
      } else {
        band(u0, u1, eR, faceR, C.asphalt);
        band(u0, u1, faceL, edgeL, C.asphalt);
      }
    }

    // ---------------------------------------------------------------- the facades are walls
    for (let u = 0; u < len - 0.1; u += 8) {
      const u1 = Math.min(len, u + 8);
      this.segment(body, P(u, faceR(u) + 0.15), P(u1, faceR(u1) + 0.15), 3);
      this.segment(body, P(u, faceL(u) - 0.15), P(u1, faceL(u1) - 0.15), 3);
    }

    // ---------------------------------------------------------------- cross streets
    for (const j of piece.junctions) {
      const uA = j - JUNCTION_W / 2;
      const uB = j + JUNCTION_W / 2;
      const h = head(j);
      for (const side of [1, -1] as const) {
        const f0 = side === 1 ? faceR(j) : faceL(j);
        const far = f0 + side * 70;
        const a = () => f0;
        const b = () => far;
        band(uA + 2.4, uB - 2.4, a, b, C.asphalt);
        band(uA, uA + 2.4, a, b, C.pavement, deck, KERB_Y, 3);
        band(uB - 2.4, uB, a, b, C.pavement, deck, KERB_Y, 3);
        for (let l = 4; l < 66; l += 6) band(j - 0.08, j + 0.08, () => f0 + side * l, () => f0 + side * (l + 3), C.white, marks, 0.035, 12, 0.06);
        // a barrier across it where it meets the street
        const bl = f0 + side * 0.4;
        for (let u = uA + 2.6; u < uB - 2.6; u += 1.2) {
          const p = P(u + 0.6, bl, 0);
          addBox(mb, 0, 0.75, 0, 0.1, 0.32, 1.18, Math.round((u - uA) / 1.2) % 2 ? C.white : C.red, { tx: p.x, ty: 0, tz: p.z, ry: h }, 0.25);
        }
        for (const u of [uA + 2.6, uB - 2.6]) {
          const p = P(u, bl, 0);
          addBox(mb, 0, 0.45, 0, 0.12, 0.9, 0.12, C.pole, { tx: p.x, ty: 0, tz: p.z, ry: h });
        }
        // the blocks along it, and one closing its far end
        for (const [ua, ub] of [
          [Math.max(0, uA - 24), uA - 0.5],
          [uB + 0.5, Math.min(len, uB + 24)],
        ]) {
          if (ub - ua < 5) continue;
          const p = P((ua + ub) / 2, f0 + side * 47, 0);
          const ht = 12 + rng.next() * 40;
          addBox(mb, 0, ht / 2, 0, 42, ht, ub - ua, BUILDING_TONES[Math.floor(rng.next() * BUILDING_TONES.length)], { tx: p.x, ty: 0, tz: p.z, ry: h });
        }
        const e = P(j, far + side * 10, 0);
        addBox(mb, 0, 14, 0, 20, 28, JUNCTION_W + 6, BUILDING_TONES[Math.floor(rng.next() * BUILDING_TONES.length)], { tx: e.x, ty: 0, tz: e.z, ry: h });
      }
      // zebra crossings either side of it
      for (const [z0, z1] of [
        [uA - 4.6, uA - 1.4],
        [uB + 1.4, uB + 4.6],
      ]) {
        for (let l = edgeL(j) + 0.4; l < eR(j) - 0.5; l += 1.1) band(z0, z1, () => l, () => l + 0.55, C.white, marks, 0.035, 12, 0.06);
      }
      // signals: green for the main road, on mast arms over the lanes
      for (const side of [1, -1] as const) {
        const u = side === 1 ? uA - 1.4 : uB + 1.4;
        const base = P(u, side === 1 ? eR(u) + 0.8 : edgeL(u) - 0.8, 0);
        const t = { tx: base.x, ty: 0, tz: base.z, ry: h + (side === 1 ? 0 : Math.PI) };
        const reach = Math.min(6, (side === 1 ? eR(u) : W) * 0.6);
        addCylinder(mb, 0, 0, 0, 0.13, 0.1, 6, 8, C.pole, t);
        addBox(mb, reach / 2, 5.9, 0, reach, 0.12, 0.12, C.pole, t);
        addBox(mb, reach, 5.3, 0, 0.42, 1.2, 0.36, C.signal, t);
        addBox(mb, reach, 5.68, -0.2, 0.24, 0.24, 0.06, C.red, t, 0.15);
        addBox(mb, reach, 4.94, -0.2, 0.24, 0.24, 0.06, C.green, t, 3);
      }
    }

    // ---------------------------------------------------------------- the docks (the end of the chase road)
    if (piece.zone === 'docks') {
      this.docks(piece, k, faceL, faceR, head);
      return;
    }

    // ---------------------------------------------------------------- buildings, or hedges where the median is still open
    const counts: Partial<Record<PropType, { x: number; z: number; s: number; r: number }[]>> = {};
    for (const side of [1, -1] as const) {
      const face = side === 1 ? faceR : faceL;
      let u = rng.next() * 4;
      while (u < len - 1) {
        let w = 12 + rng.next() * 22;
        let u1 = Math.min(len, u + w);
        const hit = piece.junctions.find((j) => u1 > j - JUNCTION_W / 2 - 0.5 && u < j + JUNCTION_W / 2 + 0.5);
        if (hit !== undefined) {
          if (u < hit - JUNCTION_W / 2 - 4) u1 = hit - JUNCTION_W / 2 - 0.5;
          else {
            u = hit + JUNCTION_W / 2 + 0.5;
            continue;
          }
        }
        const mid = (u + u1) / 2;
        if (gap(mid) > 2) {
          // still a boulevard: a hedge along the pavement and trees behind it
          for (let v = u; v < u1 - 0.1; v += 4) {
            const a = P(v, face(v) + side * 0.4, 0);
            const b = P(Math.min(u1, v + 4), face(Math.min(u1, v + 4)) + side * 0.4, 0);
            addBox(mb, 0, 0.5, 0, 0.8, 1.0, Math.hypot(b.x - a.x, b.z - a.z) + 0.05, C.hedge, { tx: (a.x + b.x) / 2, ty: 0, tz: (a.z + b.z) / 2, ry: Math.atan2(b.x - a.x, b.z - a.z) });
          }
          if (rng.next() < 0.8) {
            const p = P(mid, face(mid) + side * (4 + rng.next() * 20), 0);
            (counts.tree ??= []).push({ x: p.x, z: p.z, s: 0.8 + rng.next() * 0.6, r: rng.next() * 6.28 });
          }
          u = u1;
          continue;
        }
        // on the inside of a corner a long frontage would poke into the pavement: keep it short
        const kk = piece.k0 + ((piece.k1 - piece.k0) * mid) / len;
        const inside = (kk > 1e-4 && side === -1) || (kk < -1e-4 && side === 1);
        let dep = 12 + rng.next() * 16;
        if (inside) {
          const rr = 1 / Math.abs(kk) - Math.abs(face(mid));
          w = Math.min(u1 - u, Math.sqrt(8 * Math.max(4, rr) * 0.8));
          u1 = u + w;
          dep = Math.min(dep, Math.max(6, rr - 6));
        }
        const m2 = (u + u1) / 2;
        const ww = u1 - u;
        const ht = 9 + Math.pow(rng.next(), 1.8) * 75;
        const p = P(m2, face(m2) + side * (dep / 2), 0);
        const t = { tx: p.x, ty: 0, tz: p.z, ry: head(m2) };
        addBox(mb, 0, ht / 2, 0, dep, ht, ww, BUILDING_TONES[Math.floor(rng.next() * BUILDING_TONES.length)], t);
        // lit floors (dimmer than the motorway's distant towers: these are right beside you)
        for (let fy = 6; fy < ht - 2; fy += 3.4) {
          if (rng.next() < 0.35) continue;
          addBox(mb, 0, fy, 0, dep + 0.06, 0.9, ww + 0.06, WINDOW, t, rng.next() < 0.5 ? 0.13 : 0.03);
        }
        // a lit shop front and an awning on the ground floor
        if (ww > 6) {
          addBox(mb, side * (dep / 2 + 0.04), 1.9, 0, 0.08, 2.4, ww - 1.6, C.shop, t, 0.08 + rng.next() * 0.12);
          if (rng.next() < 0.6) addBox(mb, side * (dep / 2 + 0.75), 3.4, 0, 1.5, 0.3, ww - 1.2, AWNINGS[Math.floor(rng.next() * AWNINGS.length)], t);
        }
        u = u1 + rng.next() * 1.5;
      }
    }
    this.plant(counts, k.group, k.instanced);

    // ---------------------------------------------------------------- street lamps, either side in turn
    for (let s = Math.ceil(piece.s0 / 26) * 26; s < piece.s0 + len; s += 26) {
      const u = s - piece.s0;
      if (inJ(u, 2)) continue;
      const side = Math.round(s / 26) % 2 ? 1 : -1;
      const base = P(u, side === 1 ? eR(u) + 0.6 : edgeL(u) - 0.6, 0);
      const t = { tx: base.x, ty: 0, tz: base.z, ry: head(u) };
      // local x points to the left of the road: toward it from the right pavement, away from it on the left
      addCylinder(mb, 0, 0, 0, 0.12, 0.09, 8.2, 8, C.pole, t);
      addBox(mb, side * 1.1, 8.1, 0, 2.2, 0.12, 0.12, C.pole, t);
      addBox(mb, side * 2.2, 7.98, 0, 0.9, 0.16, 0.4, C.lamp, t, 1);
      const c = P(u, side === 1 ? eR(u) - 2.6 : edgeL(u) + 2.6, 0.04);
      const r = 10;
      const q = (dx: number, dz: number, uu: number, vv: number): V => ({ x: c.x + dx, y: 0.04, z: c.z + dz, u: uu, v: vv });
      pools.quad(q(-r, -r, 0, 0), q(r, -r, 1, 0), q(-r, r, 0, 1), q(r, r, 1, 1), [1, 1, 1], 1);
    }
  }

  /**
   * The docks: stacks of containers either side behind the fences, the dock gates over the road
   * (through them you have escaped) with a chequered line, gantry cranes and a ship at the quay, and
   * the road ending at a row of barriers in front of the water.
   */
  private docks(piece: Piece, k: Kit, faceL: Lat, faceR: Lat, head: (u: number) => number) {
    const { P, band, marks, mb, body, rng, group } = k;
    const len = piece.len;
    const gate = (piece.path.finish ?? piece.s0 + DOCKS_GATE) - piece.s0;
    const h = head(0);
    const T = (u: number, lat: number) => {
      const p = P(u, lat, 0);
      return { tx: p.x, ty: 0, tz: p.z, ry: h };
    };
    // containers: rows along the road, stacked one to four high
    for (const side of [1, -1] as const) {
      const face = side === 1 ? faceR(0) : faceL(0);
      for (let row = 0; row < 6; row++) {
        const lat = face + side * (2.2 + row * 2.75 + (row >= 3 ? 5 : 0));
        for (let u = 6; u < len - 40; u += 12.9) {
          if (Math.abs(u + 6 - gate) < 14 || rng.next() < 0.18) continue;
          const n = 1 + Math.floor(rng.next() * (row < 2 ? 3 : 4));
          for (let level = 0; level < n; level++) {
            const c = CONTAINERS[Math.floor(rng.next() * CONTAINERS.length)];
            addBox(mb, 0, 1.3 + level * 2.6, 0, 2.44, 2.55, 12.2, c, T(u + 6.1, lat));
            // a darker line where the doors are
            addBox(mb, 0, 1.3 + level * 2.6, 6.11, 2.2, 2.3, 0.04, C.dark, T(u + 6.1, lat));
          }
        }
      }
      // a chain-link fence along the pavement
      for (let u = 0; u < len - 14; u += 8) {
        if (Math.abs(u + 4 - gate) < 8) continue;
        addBox(mb, 0, 1.1, 0, 0.06, 2.2, 8, C.steel, T(u + 4, face + side * 0.3), 0);
      }
    }
    // the dock gates: posts, a beam and the sign, and a chequered line on the road
    const gl = faceL(gate) + 0.5;
    const gr = faceR(gate) - 0.5;
    for (const l of [gl, gr]) addBox(mb, 0, 3.8, 0, 0.6, 7.6, 0.6, C.signal, T(gate, l));
    addBox(mb, 0, 7.4, 0, gr - gl + 0.6, 0.8, 0.8, C.signal, T(gate, (gl + gr) / 2));
    const sp = P(gate, (gl + gr) / 2, 0);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, gr - gl - 2), 2.2), this.signMat('DOCKS · PORT EXIT'));
    board.position.set(sp.x - Math.sin(h) * 0.45, 6.0, sp.z - Math.cos(h) * 0.45);
    board.rotation.y = h + Math.PI;
    group.add(board);
    k.geometries.push(board.geometry);
    for (let l = faceL(gate) + 0.2, i = 0; l < faceR(gate) - 0.2; l += 1, i++) {
      for (let row = 0; row < 2; row++) {
        if ((i + row) % 2) continue;
        band(gate + row - 1, gate + row, () => l, () => l + 1, C.white, marks, 0.036, 12, 0.08);
      }
    }
    // gantry cranes at the quay, booms out over the water
    for (const [u, lat] of [
      [len - 70, faceL(0) - 26],
      [len - 70, faceR(0) + 26],
      [len - 150, faceR(0) + 26],
    ] as const) {
      const t = T(u, lat);
      for (const [x, z] of [
        [-7, -5],
        [7, -5],
        [-7, 5],
        [7, 5],
      ])
        addBox(mb, x, 15, z, 1.1, 30, 1.1, CRANE, t);
      addBox(mb, 0, 30.5, 0, 16, 2, 12, CRANE, t);
      addBox(mb, 0, 33, 30, 3, 2.2, 74, CRANE, t);
      addBox(mb, 0, 33, -12, 3, 2.2, 14, CRANE, t);
      addBox(mb, 0, 31, -16, 5, 5, 4, C.concrete, t);
      addBox(mb, 2.2, 36.5, 4, 2.2, 5, 2.4, C.white, t, 0.4);
    }
    // the end of the road: barriers across it, a quay wall, the water and a ship alongside
    const stop = len - 10;
    for (let l = faceL(stop); l < faceR(stop); l += 2) {
      addBox(mb, 0, 0.45, 0, 2.0, 0.9, 0.6, Math.round(l / 2) % 2 ? C.concrete : C.yellow, T(stop, l + 1));
    }
    this.segment(body, P(stop, faceL(stop) - 1), P(stop, faceR(stop) + 1), 1.2);
    const end = piece.path.pose(piece.s0 + len, (faceL(len) + faceR(len)) / 2);
    const ox = piece.xs[0];
    const oz = piece.zs[0];
    const fx = Math.sin(end.h);
    const fz = Math.cos(end.h);
    // the harbour: from the quay out to the horizon
    const wg = new THREE.PlaneGeometry(1400, 900);
    wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, this.waterMat);
    water.rotation.y = end.h;
    water.position.set(end.x - ox + fx * 452, -0.15, end.z - oz + fz * 452);
    water.receiveShadow = true;
    group.add(water);
    k.geometries.push(wg);
    const quay = { tx: end.x - ox, ty: 0, tz: end.z - oz, ry: end.h };
    addBox(mb, 0, -0.7, 0, 220, 1.6, 1.2, C.concrete, quay);
    const ship = { tx: end.x - ox + fx * 40, ty: 0, tz: end.z - oz + fz * 40, ry: end.h + Math.PI / 2 };
    addBox(mb, 0, 3.5, 0, 150, 9, 24, C.dark, ship);
    addBox(mb, 0, 8.2, 0, 150.2, 0.6, 24.2, C.red, ship);
    addBox(mb, -60, 15, 0, 18, 12, 20, C.white, ship, 0.25);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 3; j++) addBox(mb, -40 + i * 12.6, 9.8 + j * 2.6, (rng.next() - 0.5) * 6, 12.2, 2.55, 2.44, CONTAINERS[Math.floor(rng.next() * CONTAINERS.length)], ship);
    }
  }

  /** an oriented wall segment between two local points */
  private segment(body: RAPIER.RigidBody, a: V, b: V, hy: number) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.1) return;
    this.box(body, (a.x + b.x) / 2, hy, (a.z + b.z) / 2, 0.16, hy, len / 2 + 0.15, Math.atan2(b.x - a.x, b.z - a.z));
  }

  private box(body: RAPIER.RigidBody, x: number, y: number, z: number, hx: number, hy: number, hz: number, ry: number) {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(x, y, z)
      .setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) })
      .setFriction(0.3);
    this.physics.world.createCollider(d, body);
  }

  private cyl(body: RAPIER.RigidBody, x: number, y: number, z: number, r: number, hh: number) {
    this.physics.world.createCollider(RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(x, y, z).setFriction(0.4), body);
  }

  dispose(b: Built) {
    b.group.removeFromParent();
    for (const g of b.geometries) g.dispose();
    for (const im of b.instanced) im.dispose();
    this.physics.world.removeRigidBody(b.body);
  }
}
