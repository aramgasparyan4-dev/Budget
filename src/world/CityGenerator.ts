import { RNG } from '../core/rng';
import { clamp, pointSegment } from '../core/math';
import { STREET_NAMES, resetNameRegistry } from './names';
import { generateBuildings } from './buildings';
import {
  ARTERIAL_HW,
  Block,
  CHUNK_SIZE,
  CityData,
  DISTRICT_IDS,
  DistrictId,
  GroundKind,
  GroundQuad,
  Intersection,
  LANE_W,
  LOCAL_HW,
  Marking,
  ParkingSpot,
  PITCH,
  Prop,
  RoadLine,
  RoadSegment,
  SidewalkEdge,
  SidewalkNode,
  SignalHead,
  SW,
  CURB_H,
} from './types';

export const CITY_N = 12;
export const PLATFORM = 600; // half size of the flat city platform

export function interId(c: CityData | { n: number }, i: number, j: number) {
  return j * (c.n + 1) + i;
}

/** Lateral offset of lane k (0 = innermost) from the road centerline. */
export function laneOffset(seg: { cls: string; lanesPerDir: number }, k: number) {
  const median = seg.lanesPerDir > 1 ? 1.0 : 0;
  return median / 2 + LANE_W * (k + 0.5);
}

export function chunkOf(c: Pick<CityData, 'chunkOrigin' | 'chunkCols' | 'chunkRows'>, x: number, z: number) {
  const cx = clamp(Math.floor((x - c.chunkOrigin.x) / CHUNK_SIZE), 0, c.chunkCols - 1);
  const cz = clamp(Math.floor((z - c.chunkOrigin.z) / CHUNK_SIZE), 0, c.chunkRows - 1);
  return cz * c.chunkCols + cx;
}

export function generateCity(seed: number): CityData {
  resetNameRegistry();
  const rng = new RNG(seed);
  const n = CITY_N;

  // ---------------------------------------------------------------- lines
  const names = rng.fork('streets').shuffle([...STREET_NAMES]);
  const mkLine = (orient: 'v' | 'h', idx: number): RoadLine => {
    const arterial = idx % 3 === 0;
    const base = names[(orient === 'v' ? 0 : n + 1) + idx];
    let suffix = arterial ? (orient === 'v' ? 'Avenue' : 'Boulevard') : orient === 'v' ? 'Street' : 'Lane';
    let name = `${base} ${suffix}`;
    if (orient === 'v' && idx === n) name = 'Harbor Drive';
    return {
      idx,
      orient,
      pos: (idx - n / 2) * PITCH,
      cls: arterial ? 'arterial' : 'local',
      hw: arterial ? ARTERIAL_HW : LOCAL_HW,
      lanesPerDir: arterial ? 2 : 1,
      parking: !arterial,
      name,
    };
  };
  const vLines: RoadLine[] = [];
  const hLines: RoadLine[] = [];
  for (let i = 0; i <= n; i++) vLines.push(mkLine('v', i));
  for (let j = 0; j <= n; j++) hLines.push(mkLine('h', j));

  const minX = vLines[0].pos;
  const maxX = vLines[n].pos;
  const minZ = hLines[0].pos;
  const maxZ = hLines[n].pos;

  // ------------------------------------------------------------ districts
  const dr = rng.fork('districts');
  const j = () => dr.range(-0.05, 0.05);
  const seeds: { id: DistrictId; u: number; v: number; w: number }[] = [
    { id: 'downtown', u: 0.62 + j(), v: 0.45 + j(), w: 0.022 },
    { id: 'entertainment', u: 0.86 + j(), v: 0.6 + j(), w: 0.0 },
    { id: 'commercial', u: 0.36 + j(), v: 0.5 + j(), w: 0.012 },
    { id: 'commercial', u: 0.55 + j(), v: 0.2 + j(), w: 0.0 },
    { id: 'residential', u: 0.22 + j(), v: 0.15 + j(), w: 0.03 },
    { id: 'residential', u: 0.15 + j(), v: 0.82 + j(), w: 0.03 },
    { id: 'residential', u: 0.5 + j(), v: 0.86 + j(), w: 0.0 },
    { id: 'wealthy', u: 0.88 + j(), v: 0.92 + j(), w: 0.0 },
    { id: 'industrial', u: 0.88 + j(), v: 0.12 + j(), w: 0.02 },
    { id: 'industrial', u: 0.04 + j(), v: 0.45 + j(), w: -0.01 },
  ];
  const districtOfUV = (u: number, v: number): DistrictId => {
    let best = seeds[0];
    let bd = Infinity;
    for (const s of seeds) {
      const d = (u - s.u) ** 2 + (v - s.v) ** 2 - s.w;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best.id;
  };
  const districtCenters = DISTRICT_IDS.map((id) => {
    const s = seeds.find((q) => q.id === id)!;
    return { id, x: minX + s.u * (maxX - minX), z: minZ + s.v * (maxZ - minZ) };
  });

  // ---------------------------------------------------------- intersections
  const intersections: Intersection[] = [];
  const sigRng = rng.fork('signals');
  for (let jj = 0; jj <= n; jj++) {
    for (let i = 0; i <= n; i++) {
      const v = vLines[i];
      const h = hLines[jj];
      intersections.push({
        id: jj * (n + 1) + i,
        i,
        j: jj,
        x: v.pos,
        z: h.pos,
        hx: v.hw,
        hz: h.hw,
        arms: [-1, -1, -1, -1],
        signalized: v.cls === 'arterial' || h.cls === 'arterial',
        signalOffset: ((i + jj) * 7.5 + sigRng.range(0, 3)) % 50,
      });
    }
  }
  const I = (i: number, jj: number) => intersections[jj * (n + 1) + i];

  // --------------------------------------------------------- block grid
  const blockGrid: number[] = new Array(n * n).fill(-1);
  const cellDistrict: DistrictId[] = [];
  for (let bj = 0; bj < n; bj++) {
    for (let bi = 0; bi < n; bi++) {
      cellDistrict[bj * n + bi] = districtOfUV((bi + 0.5) / n, (bj + 0.5) / n);
    }
  }

  // superblock park: merge two residential cells horizontally across a local line
  const removedV = new Set<string>(); // `${i},${j}` v-segment removed
  const parkRng = rng.fork('parks');
  const candidates: [number, number][] = [];
  for (let bj = 1; bj < n - 1; bj++) {
    for (let bi = 1; bi < n - 2; bi++) {
      if (vLines[bi + 1].cls !== 'local') continue;
      if (cellDistrict[bj * n + bi] === 'residential' && cellDistrict[bj * n + bi + 1] === 'residential') candidates.push([bi, bj]);
    }
  }
  const merges: [number, number][] = [];
  if (candidates.length) {
    // prefer a central-ish candidate
    candidates.sort((a, b) => Math.abs(a[0] - n / 2) + Math.abs(a[1] - n / 2) - (Math.abs(b[0] - n / 2) + Math.abs(b[1] - n / 2)));
    const pick = candidates[Math.min(candidates.length - 1, parkRng.int(0, 2))];
    merges.push(pick);
    removedV.add(`${pick[0] + 1},${pick[1]}`);
  }

  // ------------------------------------------------------------- segments
  const segments: RoadSegment[] = [];
  const segV: number[][] = []; // [i][j] seg id for v segment from (i,j)->(i,j+1)
  const segH: number[][] = []; // [j][i] seg id for h segment from (i,j)->(i+1,j)
  for (let i = 0; i <= n; i++) {
    segV[i] = [];
    for (let jj = 0; jj < n; jj++) {
      const a = I(i, jj);
      const b = I(i, jj + 1);
      const line = vLines[i];
      const exists = !removedV.has(`${i},${jj}`);
      const z0 = a.z + a.hz + SW;
      const z1 = b.z - b.hz - SW;
      const seg: RoadSegment = {
        id: segments.length,
        orient: 'v',
        line: i,
        a: a.id,
        b: b.id,
        x0: line.pos,
        z0,
        x1: line.pos,
        z1,
        length: z1 - z0,
        hw: line.hw,
        cls: line.cls,
        lanesPerDir: line.lanesPerDir,
        parking: line.parking,
        name: line.name,
        exists,
        speedLimit: line.cls === 'arterial' ? 16 : 11.5,
      };
      segments.push(seg);
      segV[i][jj] = seg.id;
      if (exists) {
        a.arms[2] = seg.id;
        b.arms[0] = seg.id;
      }
    }
  }
  for (let jj = 0; jj <= n; jj++) {
    segH[jj] = [];
    for (let i = 0; i < n; i++) {
      const a = I(i, jj);
      const b = I(i + 1, jj);
      const line = hLines[jj];
      const x0 = a.x + a.hx + SW;
      const x1 = b.x - b.hx - SW;
      const seg: RoadSegment = {
        id: segments.length,
        orient: 'h',
        line: jj,
        a: a.id,
        b: b.id,
        x0,
        z0: line.pos,
        x1,
        z1: line.pos,
        length: x1 - x0,
        hw: line.hw,
        cls: line.cls,
        lanesPerDir: line.lanesPerDir,
        parking: line.parking,
        name: line.name,
        exists: true,
        speedLimit: line.cls === 'arterial' ? 16 : 11.5,
      };
      segments.push(seg);
      segH[jj][i] = seg.id;
      a.arms[1] = seg.id;
      b.arms[3] = seg.id;
    }
  }

  // --------------------------------------------------------------- blocks
  const blocks: Block[] = [];
  const blockRng = rng.fork('blocks');
  const interior = (bi: number, bj: number) => ({
    x0: vLines[bi].pos + vLines[bi].hw + SW,
    x1: vLines[bi + 1].pos - vLines[bi + 1].hw - SW,
    z0: hLines[bj].pos + hLines[bj].hw + SW,
    z1: hLines[bj + 1].pos - hLines[bj + 1].hw - SW,
  });
  for (const [bi, bj] of merges) {
    const a = interior(bi, bj);
    const b = interior(bi + 1, bj);
    const blk: Block = {
      id: blocks.length,
      bi,
      bj,
      x0: a.x0,
      x1: b.x1,
      z0: a.z0,
      z1: a.z1,
      district: 'residential',
      use: 'park',
      merged: true,
      special: 'centralPark',
    };
    blocks.push(blk);
    blockGrid[bj * n + bi] = blk.id;
    blockGrid[bj * n + bi + 1] = blk.id;
  }
  for (let bj = 0; bj < n; bj++) {
    for (let bi = 0; bi < n; bi++) {
      if (blockGrid[bj * n + bi] >= 0) continue;
      const d = cellDistrict[bj * n + bi];
      const r = interior(bi, bj);
      let use: Block['use'] = 'buildings';
      const roll = blockRng.next();
      if (d === 'residential' && roll < 0.09) use = 'park';
      else if (d === 'wealthy' && roll < 0.08) use = 'park';
      else if (d === 'commercial' && roll < 0.05) use = 'parking';
      else if (d === 'industrial' && roll < 0.04) use = 'parking';
      const blk: Block = { id: blocks.length, bi, bj, ...r, district: d, use, merged: false };
      blocks.push(blk);
      blockGrid[bj * n + bi] = blk.id;
    }
  }
  // guarantee plazas: the most central downtown and entertainment block
  for (const dId of ['downtown', 'entertainment'] as DistrictId[]) {
    const c = districtCenters.find((q) => q.id === dId)!;
    let best: Block | null = null;
    let bd = Infinity;
    for (const b of blocks) {
      if (b.district !== dId || b.merged) continue;
      const d = ((b.x0 + b.x1) / 2 - c.x) ** 2 + ((b.z0 + b.z1) / 2 - c.z) ** 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) {
      best.use = 'plaza';
      best.special = dId === 'downtown' ? 'civicPlaza' : 'neonPlaza';
    }
  }

  // ----------------------------------------------------- sidewalk graph
  const swNodes: SidewalkNode[] = [];
  const swEdges: SidewalkEdge[] = [];
  const swAdj: number[][] = [];
  // corner 0=NE(x+,z-) 1=NW(x-,z-) 2=SW(x-,z+) 3=SE(x+,z+)
  for (const it of intersections) {
    const ox = it.hx + SW / 2;
    const oz = it.hz + SW / 2;
    const pos = [
      [it.x + ox, it.z - oz],
      [it.x - ox, it.z - oz],
      [it.x - ox, it.z + oz],
      [it.x + ox, it.z + oz],
    ];
    for (let c = 0; c < 4; c++) {
      swNodes.push({ id: it.id * 4 + c, x: pos[c][0], z: pos[c][1], inter: it.id, corner: c });
      swAdj.push([]);
    }
  }
  const addEdge = (a: number, b: number, kind: SidewalkEdge['kind'], crossAxis?: 'v' | 'h', inter?: number) => {
    const na = swNodes[a];
    const nb = swNodes[b];
    const e: SidewalkEdge = {
      id: swEdges.length,
      a,
      b,
      length: Math.hypot(na.x - nb.x, na.z - nb.z),
      kind,
      crossAxis,
      inter,
    };
    swEdges.push(e);
    swAdj[a].push(e.id);
    swAdj[b].push(e.id);
    return e.id;
  };
  const segSideEdge: [number, number][] = [];
  for (const s of segments) {
    const a = s.a;
    const b = s.b;
    if (s.orient === 'v') {
      // west side: SW(a) -> NW(b); east: SE(a) -> NE(b)
      segSideEdge[s.id] = [addEdge(a * 4 + 2, b * 4 + 1, 'walk'), addEdge(a * 4 + 3, b * 4 + 0, 'walk')];
    } else {
      // north: NE(a) -> NW(b); south: SE(a) -> SW(b)
      segSideEdge[s.id] = [addEdge(a * 4 + 0, b * 4 + 1, 'walk'), addEdge(a * 4 + 3, b * 4 + 2, 'walk')];
    }
  }
  for (const it of intersections) {
    const base = it.id * 4;
    // arm N: NW-NE crosses v road ; arm S: SW-SE crosses v road ; arm E: NE-SE crosses h road ; arm W: NW-SW
    const armPairs: [number, number, 'v' | 'h'][] = [
      [1, 0, 'v'],
      [3, 0, 'h'],
      [2, 3, 'v'],
      [1, 2, 'h'],
    ];
    for (let arm = 0; arm < 4; arm++) {
      const [ca, cb, axis] = armPairs[arm];
      if (it.arms[arm] >= 0) addEdge(base + ca, base + cb, 'cross', axis, it.id);
      else addEdge(base + ca, base + cb, 'link', undefined, it.id);
    }
  }

  // ---------------------------------------------------------------- chunks
  const chunkOrigin = { x: -PLATFORM - 72, z: -PLATFORM - 72 };
  const chunkCols = Math.ceil((2 * PLATFORM + 144) / CHUNK_SIZE);
  const chunkRows = chunkCols;
  const chunks = [];
  for (let cz = 0; cz < chunkRows; cz++)
    for (let cx = 0; cx < chunkCols; cx++)
      chunks.push({
        id: cz * chunkCols + cx,
        cx,
        cz,
        x0: chunkOrigin.x + cx * CHUNK_SIZE,
        z0: chunkOrigin.z + cz * CHUNK_SIZE,
        x1: chunkOrigin.x + (cx + 1) * CHUNK_SIZE,
        z1: chunkOrigin.z + (cz + 1) * CHUNK_SIZE,
      });
  const chunkMeta = { chunkOrigin, chunkCols, chunkRows };
  const ch = (x: number, z: number) => chunkOf(chunkMeta, x, z);

  // ---------------------------------------------------- ground & markings
  const ground: GroundQuad[] = [];
  const markings: Marking[] = [];
  const addGround = (x0: number, x1: number, z0: number, z1: number, y: number, kind: GroundKind) => {
    // split large quads on chunk borders so culling works per chunk
    const cxs = [x0];
    const czs = [z0];
    for (let k = Math.ceil((x0 - chunkOrigin.x) / CHUNK_SIZE); ; k++) {
      const bx = chunkOrigin.x + k * CHUNK_SIZE;
      if (bx >= x1) break;
      if (bx > x0) cxs.push(bx);
    }
    for (let k = Math.ceil((z0 - chunkOrigin.z) / CHUNK_SIZE); ; k++) {
      const bz = chunkOrigin.z + k * CHUNK_SIZE;
      if (bz >= z1) break;
      if (bz > z0) czs.push(bz);
    }
    cxs.push(x1);
    czs.push(z1);
    for (let a = 0; a < cxs.length - 1; a++)
      for (let b = 0; b < czs.length - 1; b++) {
        const qx0 = cxs[a];
        const qx1 = cxs[a + 1];
        const qz0 = czs[b];
        const qz1 = czs[b + 1];
        ground.push({ x0: qx0, x1: qx1, z0: qz0, z1: qz1, y, kind, chunk: ch((qx0 + qx1) / 2, (qz0 + qz1) / 2) });
      }
  };
  const addMark = (x0: number, z0: number, x1: number, z1: number, w: number, color: 0 | 1) => {
    markings.push({ x0, z0, x1, z1, w, color, chunk: ch((x0 + x1) / 2, (z0 + z1) / 2) });
  };
  const dashed = (x0: number, z0: number, x1: number, z1: number, w: number, color: 0 | 1, dash = 3, gap = 6) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const dx = (x1 - x0) / L;
    const dz = (z1 - z0) / L;
    for (let s = gap / 2; s + dash <= L; s += dash + gap) {
      addMark(x0 + dx * s, z0 + dz * s, x0 + dx * (s + dash), z0 + dz * (s + dash), w, color);
    }
  };

  // intersections asphalt + crosswalks + stop lines
  for (const it of intersections) {
    addGround(it.x - it.hx, it.x + it.hx, it.z - it.hz, it.z + it.hz, 0, GroundKind.Asphalt);
  }
  for (const s of segments) {
    const A = intersections[s.a];
    const B = intersections[s.b];
    if (!s.exists) continue;
    if (s.orient === 'v') {
      const za = A.z + A.hz;
      const zb = B.z - B.hz;
      addGround(s.x0 - s.hw, s.x0 + s.hw, za, zb, 0, GroundKind.Asphalt);
      // center line
      if (s.lanesPerDir > 1) {
        addMark(s.x0 - 0.18, s.z0, s.x0 - 0.18, s.z1, 0.12, 1);
        addMark(s.x0 + 0.18, s.z0, s.x0 + 0.18, s.z1, 0.12, 1);
        const lo = laneOffset(s, 0) + LANE_W / 2;
        dashed(s.x0 - lo, s.z0, s.x0 - lo, s.z1, 0.12, 0);
        dashed(s.x0 + lo, s.z0, s.x0 + lo, s.z1, 0.12, 0);
        addMark(s.x0 - s.hw + 0.3, s.z0, s.x0 - s.hw + 0.3, s.z1, 0.12, 0);
        addMark(s.x0 + s.hw - 0.3, s.z0, s.x0 + s.hw - 0.3, s.z1, 0.12, 0);
      } else {
        dashed(s.x0, s.z0, s.x0, s.z1, 0.12, 1, 3, 4);
        addMark(s.x0 - LANE_W, s.z0, s.x0 - LANE_W, s.z1, 0.1, 0);
        addMark(s.x0 + LANE_W, s.z0, s.x0 + LANE_W, s.z1, 0.1, 0);
      }
      // stop lines: southbound lanes (x<center) stop near B ; northbound (x>center) stop near A
      addMark(s.x0 - s.hw + 0.3, s.z1 - 0.3, s.x0 - 0.3, s.z1 - 0.3, 0.45, 0);
      addMark(s.x0 + 0.3, s.z0 + 0.3, s.x0 + s.hw - 0.3, s.z0 + 0.3, 0.45, 0);
      // crosswalk zebras in the crosswalk zones at both ends
      for (const [zc0, zc1] of [
        [za, za + SW],
        [zb - SW, zb],
      ]) {
        for (let x = s.x0 - s.hw + 0.8; x < s.x0 + s.hw - 0.4; x += 1.2) {
          addMark(x, zc0 + 0.4, x, zc1 - 0.4, 0.55, 0);
        }
      }
    } else {
      const xa = A.x + A.hx;
      const xb = B.x - B.hx;
      addGround(xa, xb, s.z0 - s.hw, s.z0 + s.hw, 0, GroundKind.Asphalt);
      if (s.lanesPerDir > 1) {
        addMark(s.x0, s.z0 - 0.18, s.x1, s.z0 - 0.18, 0.12, 1);
        addMark(s.x0, s.z0 + 0.18, s.x1, s.z0 + 0.18, 0.12, 1);
        const lo = laneOffset(s, 0) + LANE_W / 2;
        dashed(s.x0, s.z0 - lo, s.x1, s.z0 - lo, 0.12, 0);
        dashed(s.x0, s.z0 + lo, s.x1, s.z0 + lo, 0.12, 0);
        addMark(s.x0, s.z0 - s.hw + 0.3, s.x1, s.z0 - s.hw + 0.3, 0.12, 0);
        addMark(s.x0, s.z0 + s.hw - 0.3, s.x1, s.z0 + s.hw - 0.3, 0.12, 0);
      } else {
        dashed(s.x0, s.z0, s.x1, s.z0, 0.12, 1, 3, 4);
        addMark(s.x0, s.z0 - LANE_W, s.x1, s.z0 - LANE_W, 0.1, 0);
        addMark(s.x0, s.z0 + LANE_W, s.x1, s.z0 + LANE_W, 0.1, 0);
      }
      // eastbound lanes are z>center, stop near B ; westbound z<center stop near A
      addMark(s.x1 - 0.3, s.z0 + 0.3, s.x1 - 0.3, s.z0 + s.hw - 0.3, 0.45, 0);
      addMark(s.x0 + 0.3, s.z0 - s.hw + 0.3, s.x0 + 0.3, s.z0 - 0.3, 0.45, 0);
      for (const [xc0, xc1] of [
        [xa, xa + SW],
        [xb - SW, xb],
      ]) {
        for (let z = s.z0 - s.hw + 0.8; z < s.z0 + s.hw - 0.4; z += 1.2) {
          addMark(xc0 + 0.4, z, xc1 - 0.4, z, 0.55, 0);
        }
      }
    }
  }

  // sidewalks rings around blocks and block interiors
  const SY = CURB_H;
  for (const b of blocks) {
    const ox0 = b.x0 - SW;
    const ox1 = b.x1 + SW;
    const oz0 = b.z0 - SW;
    const oz1 = b.z1 + SW;
    if (b.merged) {
      // whole merged area including the removed road corridor is park
      addGround(ox0, ox1, oz0, b.z0, SY, GroundKind.Sidewalk);
      addGround(ox0, ox1, b.z1, oz1, SY, GroundKind.Sidewalk);
      addGround(ox0, b.x0, b.z0, b.z1, SY, GroundKind.Sidewalk);
      addGround(b.x1, ox1, b.z0, b.z1, SY, GroundKind.Sidewalk);
    } else {
      addGround(ox0, ox1, oz0, b.z0, SY, GroundKind.Sidewalk);
      addGround(ox0, ox1, b.z1, oz1, SY, GroundKind.Sidewalk);
      addGround(ox0, b.x0, b.z0, b.z1, SY, GroundKind.Sidewalk);
      addGround(b.x1, ox1, b.z0, b.z1, SY, GroundKind.Sidewalk);
    }
    let kind = GroundKind.Concrete;
    if (b.use === 'park') kind = GroundKind.Grass;
    else if (b.use === 'plaza') kind = GroundKind.Plaza;
    else if (b.use === 'parking') kind = GroundKind.Parking;
    else if (b.district === 'residential' || b.district === 'wealthy') kind = GroundKind.Lawn;
    else if (b.district === 'industrial') kind = GroundKind.Dirt;
    addGround(b.x0, b.x1, b.z0, b.z1, SY, kind);
  }
  // outer sidewalks along the perimeter + margin grass + promenade
  const oMinX = minX - vLines[0].hw;
  const oMaxX = maxX + vLines[n].hw;
  const oMinZ = minZ - hLines[0].hw;
  const oMaxZ = maxZ + hLines[n].hw;
  addGround(oMinX - SW, oMaxX, oMinZ - SW, oMinZ, SY, GroundKind.Sidewalk); // north
  addGround(oMinX - SW, oMaxX, oMaxZ, oMaxZ + SW, SY, GroundKind.Sidewalk); // south
  addGround(oMinX - SW, oMinX, oMinZ, oMaxZ, SY, GroundKind.Sidewalk); // west
  const promX1 = PLATFORM - 2;
  addGround(oMaxX, promX1, oMinZ - SW, oMaxZ + SW, SY, GroundKind.Plaza); // east promenade
  // margin grass (platform edges)
  addGround(-PLATFORM, PLATFORM, -PLATFORM, oMinZ - SW, 0.02, GroundKind.Grass);
  addGround(-PLATFORM, PLATFORM, oMaxZ + SW, PLATFORM, 0.02, GroundKind.Grass);
  addGround(-PLATFORM, oMinX - SW, oMinZ - SW, oMaxZ + SW, 0.02, GroundKind.Grass);

  // ---------------------------------------------------------------- props
  const props: Prop[] = [];
  const signals: SignalHead[] = [];
  const parking: ParkingSpot[] = [];
  const prng = rng.fork('props');
  const addProp = (type: Prop['type'], x: number, z: number, rot = 0, scale = 1, y = SY, ref?: number, ref2?: number) => {
    props.push({ type, x, y, z, rot, scale, v: prng.next(), chunk: ch(x, z), ref, ref2 });
  };
  const districtAt = (x: number, z: number): DistrictId => {
    const bi = clamp(Math.floor((x - minX) / PITCH), 0, n - 1);
    const bj = clamp(Math.floor((z - minZ) / PITCH), 0, n - 1);
    return cellDistrict[bj * n + bi];
  };

  // street-side props per segment side
  for (const s of segments) {
    if (!s.exists) continue;
    const vert = s.orient === 'v';
    for (const side of [0, 1]) {
      const sgn = side === 0 ? -1 : 1;
      // position on sidewalk: curb at hw, sidewalk spans hw..hw+SW
      const along0 = vert ? s.z0 : s.x0;
      const along1 = vert ? s.z1 : s.x1;
      const at = (along: number, off: number): [number, number] =>
        vert ? [s.x0 + sgn * (s.hw + off), along] : [along, s.z0 + sgn * (s.hw + off)];
      const midA = (along0 + along1) / 2;
      const d = districtAt(...at(midA, 1));
      // face toward road: for v side0 (west) road is +x
      const faceRoad = vert ? (side === 0 ? Math.PI / 2 : -Math.PI / 2) : side === 0 ? 0 : Math.PI;
      // trees
      const treeSpacing = { wealthy: 11, residential: 14, commercial: 19, downtown: 17, entertainment: 21, industrial: 34 }[d];
      const treeType = d === 'wealthy' ? (prng.chance(0.5) ? 'palm' : 'tree') : 'tree';
      for (let a = along0 + 7; a < along1 - 6; a += treeSpacing * prng.range(0.85, 1.15)) {
        const [x, z] = at(a, 0.9);
        if (d === 'industrial' && prng.chance(0.5)) continue;
        addProp(treeType, x, z, prng.range(0, Math.PI * 2), prng.range(0.8, 1.15));
        if (d === 'downtown') addProp('planter', x, z, 0, 1);
      }
      // lamps
      const classic = d === 'wealthy' || d === 'entertainment' || d === 'residential';
      const lampSpacing = 30;
      const off0 = side === 0 ? 4 : 4 + lampSpacing / 2;
      for (let a = along0 + off0; a < along1 - 3; a += lampSpacing) {
        const [x, z] = at(a, 0.45);
        addProp(classic ? 'lampClassic' : 'lamp', x, z, faceRoad, 1);
      }
      // hydrant
      if (prng.chance(0.55)) {
        const [x, z] = at(prng.range(along0 + 10, along1 - 10), 0.5);
        addProp('hydrant', x, z, faceRoad);
      }
      // benches, bins
      if (d === 'commercial' || d === 'downtown' || d === 'entertainment') {
        const nb = prng.int(1, 2);
        for (let k = 0; k < nb; k++) {
          const a = prng.range(along0 + 12, along1 - 12);
          const [x, z] = at(a, 2.6);
          addProp('bench', x, z, faceRoad + Math.PI);
        }
        const [bx, bz] = at(along0 + 3.5, 0.6);
        addProp('bin', bx, bz, faceRoad);
        if (s.parking) {
          for (let a = along0 + 9; a < along1 - 9; a += 13) {
            const [x, z] = at(a, 0.35);
            addProp('meter', x, z, faceRoad);
          }
        }
      } else if (prng.chance(0.4)) {
        const [bx, bz] = at(along0 + 3.5, 0.6);
        addProp('bin', bx, bz, faceRoad);
      }
      // bus stops on arterials
      if (s.cls === 'arterial' && prng.chance(0.35) && s.length > 50) {
        const a = (along0 + along1) / 2 + (side === 0 ? -8 : 8);
        const [x, z] = at(a, 2.8);
        addProp('busStop', x, z, faceRoad + Math.PI);
      }
    }
    // parking spots (local roads, both directions)
    if (s.parking) {
      for (const dir of [1, -1] as const) {
        const len = s.length;
        for (let sPos = 9; sPos < len - 9; sPos += 6.5) {
          // directed lane: dir=1 travels from a to b
          const off = LANE_W + 1.25;
          let x: number;
          let z: number;
          let rot: number;
          if (s.orient === 'v') {
            // dir 1 = +z (southbound) right side is -x
            z = dir === 1 ? s.z0 + sPos : s.z1 - sPos;
            x = s.x0 + (dir === 1 ? -off : off);
            rot = dir === 1 ? 0 : Math.PI;
          } else {
            x = dir === 1 ? s.x0 + sPos : s.x1 - sPos;
            z = s.z0 + (dir === 1 ? off : -off);
            rot = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
          }
          const d = districtAt(x, z);
          const occ = prng.chance(d === 'industrial' ? 0.2 : d === 'wealthy' ? 0.25 : 0.42);
          parking.push({
            id: parking.length,
            seg: s.id,
            dir,
            s: sPos,
            x,
            z,
            rot,
            occupiedStatic: occ,
            staticType: prng.int(0, 5),
            staticColor: prng.int(0, 1000),
            chunk: ch(x, z),
          });
        }
      }
    }
  }

  // signals, stop signs, street name signs
  for (const it of intersections) {
    const armsN = it.arms.filter((a) => a >= 0).length;
    if (armsN < 2) continue;
    const cornerPos = (c: number, inset: number): [number, number] => {
      const sx = c === 0 || c === 3 ? 1 : -1;
      const sz = c === 0 || c === 1 ? -1 : 1;
      return [it.x + sx * (it.hx + inset), it.z + sz * (it.hz + inset)];
    };
    // approaches: from N arm (southbound traffic), right side is W -> corner NW(1); head faces -z (rot PI)
    // from S arm (northbound), right side E -> corner SE(3); faces +z (rot 0)
    // from E arm (westbound), right side N -> corner NE(0); faces +x (rot PI/2)
    // from W arm (eastbound), right side S -> corner SW(2); faces -x (rot -PI/2)
    const approaches: [number, number, number, 'v' | 'h'][] = [
      [0, 1, Math.PI, 'v'],
      [2, 3, 0, 'v'],
      [1, 0, Math.PI / 2, 'h'],
      [3, 2, -Math.PI / 2, 'h'],
    ];
    for (const [arm, corner, rot, axis] of approaches) {
      if (it.arms[arm] < 0) continue;
      const [px, pz] = cornerPos(corner, 0.6);
      // shift the pole back along the arm so it sits beside the stop line
      let x = px;
      let z = pz;
      if (arm === 0) z -= SW - 1.2;
      if (arm === 2) z += SW - 1.2;
      if (arm === 1) x += SW - 1.2;
      if (arm === 3) x -= SW - 1.2;
      if (it.signalized) {
        // the mast arm reaches from the corner pole over the approach lanes
        const fx = Math.sin(rot);
        const fz = Math.cos(rot);
        let latX = -fz;
        let latZ = fx;
        if ((it.x - x) * latX + (it.z - z) * latZ < 0) {
          latX = -latX;
          latZ = -latZ;
        }
        const ARM = 5.0;
        addProp('signalPole', x, z, Math.atan2(-latZ, latX), 1, SY, it.id);
        signals.push({ inter: it.id, axis, x: x + latX * ARM, y: SY + 5.9, z: z + latZ * ARM, rot, chunk: ch(x, z) });
      } else {
        addProp('stopSign', x, z, rot, 1, SY, it.id);
      }
    }
    // street sign on NE corner
    const [sx, sz] = cornerPos(0, 1.0);
    addProp('streetSign', sx, sz, 0, 1, SY, vLines[it.i].idx, hLines[it.j].idx + 100);
  }

  // promenade railing + lamps along the water
  for (let z = oMinZ; z < oMaxZ; z += 4) {
    addProp('railing', promX1 - 0.3, z + 2, Math.PI / 2, 1, SY);
  }
  for (let z = oMinZ + 6; z < oMaxZ; z += 22) {
    addProp('lampClassic', promX1 - 1.4, z, -Math.PI / 2, 1);
    if (prng.chance(0.6)) addProp('bench', promX1 - 2.6, z + 6, Math.PI / 2);
    if (prng.chance(0.4)) addProp('palm', oMaxX + 4.5, z + 11, prng.range(0, 6), prng.range(0.9, 1.2));
  }

  // -------------------------------------------------------- buildings etc
  const data: CityData = {
    seed,
    n,
    vLines,
    hLines,
    intersections,
    segments,
    blocks,
    buildings: [],
    businesses: [],
    homes: [],
    outdoor: [],
    props,
    signals,
    parking,
    ground,
    markings,
    swNodes,
    swEdges,
    swAdj,
    bounds: { minX, maxX, minZ, maxZ },
    shoreX: PLATFORM,
    chunks,
    chunkCols,
    chunkRows,
    chunkOrigin,
    districtCenters,
    blockGrid,
    playerHome: -1,
    playerHomeId: -1,
    landmarks: {},
  };
  generateBuildings(data, rng.fork('buildings'), {
    segV,
    segH,
    segSideEdge,
    addGround,
    addProp,
    ch,
  });

  // promenade outdoor spot(s)
  for (let k = 0; k < 4; k++) {
    const z = minZ + (k + 0.5) * ((maxZ - minZ) / 4);
    const x = oMaxX + 6;
    data.outdoor.push({
      id: data.outdoor.length,
      kind: 'promenade',
      name: 'Harbor Promenade',
      x,
      z,
      radius: 6,
      block: -1,
      access: nearestWalkEdge(data, x, z),
      district: districtAt(maxX - 10, z),
    });
  }
  // bus stops become outdoor spots
  for (const p of props) {
    if (p.type !== 'busStop') continue;
    data.outdoor.push({
      id: data.outdoor.length,
      kind: 'busstop',
      name: 'Bus Stop',
      x: p.x,
      z: p.z,
      radius: 2,
      block: -1,
      access: nearestWalkEdge(data, p.x, p.z),
      district: districtAt(p.x, p.z),
    });
  }
  return data;
}

export function nearestWalkEdge(c: CityData, x: number, z: number) {
  let best = { edge: 0, t: 0, x: 0, z: 0 };
  let bd = Infinity;
  for (const e of c.swEdges) {
    if (e.kind !== 'walk') continue;
    const a = c.swNodes[e.a];
    const b = c.swNodes[e.b];
    const r = pointSegment(x, z, a.x, a.z, b.x, b.z);
    if (r.d < bd) {
      bd = r.d;
      best = { edge: e.id, t: r.t, x: r.x, z: r.z };
    }
  }
  return best;
}

export function districtAtPoint(c: CityData, x: number, z: number): DistrictId {
  const bi = clamp(Math.floor((x - c.bounds.minX) / PITCH), 0, c.n - 1);
  const bj = clamp(Math.floor((z - c.bounds.minZ) / PITCH), 0, c.n - 1);
  const b = c.blocks[c.blockGrid[bj * c.n + bi]];
  return b ? b.district : 'residential';
}

export function blockAtPoint(c: CityData, x: number, z: number): number {
  if (x < c.bounds.minX || x > c.bounds.maxX || z < c.bounds.minZ || z > c.bounds.maxZ) return -1;
  const bi = clamp(Math.floor((x - c.bounds.minX) / PITCH), 0, c.n - 1);
  const bj = clamp(Math.floor((z - c.bounds.minZ) / PITCH), 0, c.n - 1);
  return c.blockGrid[bj * c.n + bi];
}
