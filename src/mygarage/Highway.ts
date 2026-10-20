// Highway mode: an endless motorway out of town, four lanes each way with a concrete median,
// guardrails and lamps, and traffic to weave through at speed. It is built well north of the city,
// out of sight of it.
//
// The road and its scenery repeat every SECTION metres and the scenery follows the car in whole
// sections. When the car gets WRAP metres from the start, the car, the traffic and the camera are
// shifted back by WRAP so coordinates stay small; WRAP is a whole number of every repeat length
// here (sections, lamps, dashes, texture tiles, gantries), so the shift cannot be seen.
import * as THREE from 'three';
import { RAPIER, GROUP, groups, type Physics } from '../engine/Physics';
import { VEHICLES } from '../sim/vehicles';
import { MeshBuilder, BASIC_LAYOUT, addBox, addCylinder, lin } from '../render/MeshBuilder';
import { toBufferGeometry, buildPropModels } from '../render/propModels';
import { createPropMaterial, createLightPoolMaterial } from '../render/materials';
import type { VehicleRenderer } from '../render/VehicleRenderer';
import { G } from '../render/globals';
import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import type { OtherCar } from './scoring';

/** the centre line runs along +x at this z, far north of the city */
export const HWY_Z = -4600;
export const LANE_W = 3.4;
export const LANES = 4;
const MEDIAN = 1.2; // half width of the median strip
const INNER = MEDIAN + 0.6; // inner edge of lane 0 (the fast lane)
const OUTER = INNER + LANES * LANE_W; // outer edge of lane 3 (the slow lane)
const RAIL = OUTER + 3.4; // guardrail, past a 3 m shoulder
const SECTION = 480;
const LANDMARK = 1440; // gantry signs and overpasses
const WRAP = 2880;
const AHEAD = 3; // sections of scenery ahead of the car
const CHANGE_T = 2.4; // seconds a lane change takes

/** offset from the centre line of lane i's middle (eastbound: +z, westbound: -z) */
export const laneLat = (i: number) => INNER + LANE_W * (i + 0.5);

// cars and heavy vehicles from the traffic set (no patrol car: it would run its lights)
const CARS = [0, 0, 1, 1, 1, 2, 2, 3, 4];
const HEAVY = [5, 5, 6, 6, 7];
/** desired speed by lane, m/s: fast lane 120 km/h down to 80 in the slow lane */
const LANE_SPEED = [33.5, 30, 26.5, 22.5];

export interface HCar {
  id: number;
  type: number;
  paint: THREE.Color;
  /** +1 eastbound (your side), -1 westbound (behind the median) */
  dir: 1 | -1;
  x: number;
  /** distance from the centre line, positive on its own side */
  lat: number;
  /** the lane it is in or moving into */
  lane: number;
  fromLat: number;
  /** lane change progress in seconds (-1: not changing) */
  changeT: number;
  /** indicator on before the move */
  signalT: number;
  cool: number;
  v: number;
  vDes: number;
  acc: number;
  yaw: number;
  wheelRot: number;
  blink: -1 | 0 | 1;
  crashed: boolean;
  spin: number;
  spinV: number;
  slideV: number;
  len: number;
  width: number;
  body: RAPIER.RigidBody | null;
}

export interface HPlayer {
  x: number;
  z: number;
  /** speed along the road, m/s */
  v: number;
  len: number;
  width: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** a tileable grey noise texture (around 1.0) that gives asphalt and grass some grain */
function noiseTexture(size = 256) {
  const rng = new RNG(4711);
  const octaves = [8, 16, 32, 64].map((g) => ({ g, v: Array.from({ length: g * g }, () => rng.next()) }));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0;
      let amp = 0.5;
      for (const o of octaves) {
        const fx = (x / size) * o.g;
        const fy = (y / size) * o.g;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const at = (i: number, j: number) => o.v[((j + o.g) % o.g) * o.g + ((i + o.g) % o.g)];
        const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
        const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
        n += (a + (b - a) * ty) * amp;
        amp *= 0.5;
      }
      const grain = rng.next() * 0.08;
      const v = Math.round(255 * clamp(0.72 + n * 0.32 + grain, 0, 1));
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

/** flat quads with uvs (the BASIC layout has none), for the textured road and grass */
class Flat {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  emit: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  /** a quad from x0..x1 along the road and z0..z1 across it at height y; uvs every `tile` metres */
  quad(x0: number, x1: number, z0: number, z1: number, y: number, color: ArrayLike<number>, tile: number, emit = 0) {
    const i = this.pos.length / 3;
    for (const [x, z] of [
      [x0, z1],
      [x1, z1],
      [x1, z0],
      [x0, z0],
    ]) {
      this.pos.push(x, y, z);
      this.nor.push(0, 1, 0);
      this.col.push(color[0], color[1], color[2]);
      this.emit.push(emit);
      this.uv.push(x / tile, z / tile);
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
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

const C = {
  asphalt: lin([0.26, 0.26, 0.28]),
  shoulder: lin([0.3, 0.3, 0.31]),
  verge: lin([0.42, 0.4, 0.36]),
  concrete: lin([0.66, 0.65, 0.62]),
  white: lin([0.86, 0.86, 0.84]),
  yellow: lin([0.85, 0.66, 0.12]),
  grass: lin([0.33, 0.42, 0.2]),
  steel: lin([0.62, 0.64, 0.66]),
  pole: lin([0.46, 0.47, 0.49]),
  lamp: lin([1, 0.93, 0.8]),
  sign: lin([0.07, 0.42, 0.25]),
  dark: lin([0.12, 0.12, 0.13]),
};

export class Highway {
  readonly group = new THREE.Group();
  cars: HCar[] = [];
  private scenery = new THREE.Group();
  private landmarks: THREE.Object3D[][] = [];
  private hills: THREE.Mesh;
  private hillMat: THREE.MeshBasicMaterial;
  private signMats: THREE.MeshStandardMaterial[] = [];
  private bodyPool: RAPIER.RigidBody[] = [];
  private rng = new RNG(99);
  private nextId = 1;
  private spawnT = 0;
  /** metres driven since the drive started (traffic gets denser with it) */
  travelled = 0;

  constructor(
    private scene: THREE.Scene,
    private physics: Physics,
  ) {
    this.group.name = 'highway';
    this.group.add(this.scenery);
    this.buildScenery();
    this.buildLandmarks();
    this.hillMat = new THREE.MeshBasicMaterial({ color: 0x6a7a74, fog: false });
    this.hills = new THREE.Mesh(this.hillGeometry(), this.hillMat);
    this.hills.frustumCulled = false;
    this.group.add(this.hills);
    this.buildColliders();
    this.group.visible = false;
    scene.add(this.group);
  }

  // ------------------------------------------------------------------ build
  private buildScenery() {
    const tex = noiseTexture();
    const L = SECTION * (AHEAD + 1);
    // the deck and grass, textured
    const f = new Flat();
    for (const s of [1, -1]) {
      const q = (a: number, b: number, c: ArrayLike<number>, tile = 12) => f.quad(0, L, Math.min(s * a, s * b), Math.max(s * a, s * b), 0.02, c, tile);
      q(0, MEDIAN, C.concrete, 6);
      q(MEDIAN, INNER, C.shoulder);
      q(INNER, OUTER, C.asphalt);
      q(OUTER, RAIL - 0.4, C.shoulder);
      q(RAIL - 0.4, RAIL + 1.2, C.verge, 6);
      f.quad(0, L, Math.min(s * (RAIL + 1.2), s * 2600), Math.max(s * (RAIL + 1.2), s * 2600), 0, C.grass, 40);
    }
    const deckMat = createPropMaterial({ rough: 0.88, metal: 0, emissiveNight: 0.6 });
    deckMat.map = tex;
    const deck = new THREE.Mesh(f.build(), deckMat);
    deck.receiveShadow = true;
    this.scenery.add(deck);

    // markings: dashed lane lines, a yellow inner edge and a white outer edge, both sides
    const m = new Flat();
    for (const s of [1, -1]) {
      const line = (lat: number, x0: number, x1: number, c: ArrayLike<number>) => m.quad(x0, x1, Math.min(s * (lat - 0.08), s * (lat + 0.08)), Math.max(s * (lat - 0.08), s * (lat + 0.08)), 0.03, c, 12, 0.06);
      line(INNER + 0.12, 0, L, C.yellow);
      line(OUTER - 0.12, 0, L, C.white);
      for (let i = 1; i < LANES; i++) for (let x = 0; x < L; x += 12) line(INNER + LANE_W * i, x, x + 3, C.white);
    }
    const markMat = createPropMaterial({ rough: 0.6, metal: 0, emissiveNight: 6 });
    markMat.map = tex;
    markMat.polygonOffset = true;
    markMat.polygonOffsetFactor = -2;
    markMat.polygonOffsetUnits = -4;
    this.scenery.add(new THREE.Mesh(m.build(), markMat));

    // median barrier, guardrails and lamps
    const b = new MeshBuilder(BASIC_LAYOUT);
    addBox(b, L / 2, 0.2, 0, L, 0.4, 0.62, C.concrete);
    addBox(b, L / 2, 0.62, 0, L, 0.46, 0.26, C.concrete);
    for (const s of [1, -1]) {
      addBox(b, L / 2, 0.72, s * RAIL, L, 0.32, 0.08, C.steel);
      for (let x = 0; x < L; x += 4) addBox(b, x, 0.4, s * (RAIL + 0.09), 0.12, 0.8, 0.12, C.pole);
    }
    for (let x = 0; x < L; x += 48) {
      addCylinder(b, x, 0, 0, 0.17, 0.12, 10.6, 8, C.pole);
      for (const s of [1, -1]) {
        addBox(b, x, 10.45, s * 2.6, 0.14, 0.14, 5.2, C.pole);
        addBox(b, x, 10.3, s * 5.1, 0.5, 0.16, 1.1, C.lamp, undefined, 1);
      }
    }
    const props = new THREE.Mesh(toBufferGeometry(b.build()), createPropMaterial({ emissiveNight: 5 }));
    props.castShadow = true;
    props.receiveShadow = true;
    this.scenery.add(props);

    // pools of lamp light on the road at night
    const p = new Flat();
    for (let x = 0; x < L; x += 48) for (const s of [1, -1]) p.quad(x - 11, x + 11, s * 5.6 - 11, s * 5.6 + 11, 0.04, [1, 1, 1], 1);
    // a pool quad takes the whole radial texture
    const pg = p.build();
    const uv = pg.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, [0, 1, 1, 0][i % 4], [1, 1, 0, 0][i % 4]);
    const pools = new THREE.Mesh(pg, createLightPoolMaterial(new THREE.Color(1, 0.86, 0.66)));
    pools.renderOrder = 2;
    this.scenery.add(pools);

    // trees beyond the guardrails, the same in every section
    const models = buildPropModels();
    const trng = new RNG(1234);
    for (const kind of ['conifer', 'tree'] as const) {
      const model = models[kind];
      if (!model) continue;
      const per = kind === 'conifer' ? 46 : 26;
      const mesh = new THREE.InstancedMesh(model.geometry, createPropMaterial(), per * 2 * (AHEAD + 1));
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let n = 0;
      for (const s of [1, -1]) {
        for (let i = 0; i < per; i++) {
          const x = trng.next() * SECTION;
          // mostly close to the road, a few far out
          const lat = RAIL + 9 + Math.pow(trng.next(), 1.8) * 170;
          const sc = 0.8 + trng.next() * 0.7;
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), trng.next() * 6.28);
          for (let k = 0; k <= AHEAD; k++) {
            mtx.compose(new THREE.Vector3(x + k * SECTION, 0, s * lat), q, new THREE.Vector3(sc, sc, sc));
            mesh.setMatrixAt(n++, mtx);
          }
        }
      }
      mesh.count = n;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.scenery.add(mesh);
    }
  }

  /** gantry signs and overpasses, every LANDMARK metres; three of each are moved along with the car */
  private buildLandmarks() {
    const gantry = new MeshBuilder(BASIC_LAYOUT);
    for (const lat of [0.75, RAIL + 0.9]) addBox(gantry, 0, 3.6, lat, 0.4, 7.2, 0.4, C.pole);
    addBox(gantry, 0, 7.0, (0.75 + RAIL + 0.9) / 2, 0.5, 0.5, RAIL + 0.6, C.pole);
    addBox(gantry, -0.18, 6.1, (INNER + OUTER) / 2, 0.12, 2.6, OUTER - INNER, C.dark);
    const gGeo = toBufferGeometry(gantry.build());
    const ov = new MeshBuilder(BASIC_LAYOUT);
    addBox(ov, 0, 7.1, 0, 13, 1.1, 150, C.concrete);
    for (const s of [1, -1]) {
      addBox(ov, s * 6.3, 7.95, 0, 0.3, 0.6, 150, C.concrete);
      for (const lat of [RAIL + 3, 42]) addBox(ov, 0, 3.3, s * lat, 9, 6.6, 1.2, C.concrete);
      addBox(ov, 0, 3.6, s * 75, 13, 7.2, 1, C.concrete);
    }
    addBox(ov, 0, 3.3, 0, 9, 6.6, 0.5, C.concrete);
    const oGeo = toBufferGeometry(ov.build());
    const mat = createPropMaterial();
    const signs = ['Echo City|Downtown  ↑', 'Airport|Exit 12  ↗'];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(gGeo, mat);
      g.castShadow = true;
      // the sign faces the traffic (west)
      const sm = new THREE.MeshStandardMaterial({ map: this.signTexture(signs[i % 2]), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
      sm.emissiveMap = sm.map;
      this.signMats.push(sm);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(OUTER - INNER - 0.4, 2.3), sm);
      board.rotation.y = -Math.PI / 2;
      board.position.set(-0.25, 6.1, (INNER + OUTER) / 2);
      g.add(board);
      const o = new THREE.Mesh(oGeo, mat);
      o.castShadow = true;
      o.receiveShadow = true;
      this.group.add(g, o);
      this.landmarks.push([g, o]);
    }
  }

  private signTexture(text: string) {
    const [a, b] = text.split('|');
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 168;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0b6b3c';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.strokeRect(10, 10, c.width - 20, c.height - 20);
    g.fillStyle = '#ffffff';
    g.font = '600 64px Inter Variable, Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(a, 48, c.height / 2);
    g.textAlign = 'right';
    g.fillText(b, c.width - 48, c.height / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /** a ring of low hills round the horizon, kept centred on the camera so it never gets closer */
  private hillGeometry() {
    const n = 160;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = 0.035 + 0.03 * Math.sin(a * 3 + 1) ** 2 + 0.02 * Math.sin(a * 7 + 2) + 0.012 * Math.sin(a * 17);
      pos.push(Math.cos(a), -0.02, Math.sin(a), Math.cos(a), h, Math.sin(a));
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  private buildColliders() {
    const ph = this.physics;
    const X = WRAP + 1600;
    ph.addStaticBox(0, -1, HWY_Z, X, 1, 400, 0, GROUP.STATIC, 1.0);
    ph.addStaticBox(0, 0.55, HWY_Z, X, 0.55, 0.32);
    for (const s of [1, -1]) ph.addStaticBox(0, 0.6, HWY_Z + s * (RAIL + 0.05), X, 0.6, 0.15);
  }

  // ------------------------------------------------------------------ the drive
  /** where a drive starts: the middle of your side, pointing east */
  startPose() {
    return { x: 0, z: HWY_Z + laneLat(2), yaw: Math.PI / 2 };
  }

  begin(px: number) {
    this.end();
    this.group.visible = true;
    this.travelled = 0;
    this.spawnT = 0;
    // traffic already on the road: none right round the start
    for (let i = 0; i < 60 && this.countAhead(px) < this.wantAhead(); i++) this.trySpawn(1, px + 80 + this.rng.next() * 600);
    for (let i = 0; i < 30; i++) this.trySpawn(-1, px - 250 + this.rng.next() * 900);
  }

  end() {
    for (const c of this.cars) this.releaseBody(c);
    this.cars = [];
    this.group.visible = false;
  }

  private wantAhead() {
    return Math.min(34, 15 + Math.floor(this.travelled / 400));
  }

  private countAhead(px: number) {
    let n = 0;
    for (const c of this.cars) if (c.dir === 1 && c.x > px + 30) n++;
    return n;
  }

  private trySpawn(dir: 1 | -1, x: number, laneHint?: number) {
    const lane = laneHint ?? Math.floor(this.rng.next() * LANES);
    const lat = laneLat(lane);
    for (const o of this.cars) if (o.dir === dir && Math.abs(o.lat - lat) < 2.6 && Math.abs(o.x - x) < 32) return null;
    const heavy = lane >= 2 && this.rng.next() < (lane === 3 ? 0.32 : 0.12);
    const list = heavy ? HEAVY : CARS;
    const type = list[Math.floor(this.rng.next() * list.length)];
    const spec = VEHICLES[type];
    let vDes = LANE_SPEED[lane] + (this.rng.next() - 0.5) * 4;
    if (heavy) vDes = Math.min(vDes, 23);
    const c: HCar = {
      id: this.nextId++,
      type,
      paint: new THREE.Color(spec.palette[Math.floor(this.rng.next() * spec.palette.length)]),
      dir,
      x,
      lat,
      lane,
      fromLat: lat,
      changeT: -1,
      signalT: 0,
      cool: 2 + this.rng.next() * 6,
      v: vDes * 0.95,
      vDes,
      acc: 0,
      yaw: (dir * Math.PI) / 2,
      wheelRot: 0,
      blink: 0,
      crashed: false,
      spin: 0,
      spinV: 0,
      slideV: 0,
      len: spec.length,
      width: spec.width,
      body: null,
    };
    this.cars.push(c);
    return c;
  }

  /** is a lane clear of cars (and you) from `back` metres behind x to `front` metres ahead? */
  private laneClear(dir: 1 | -1, lane: number, x: number, back: number, front: number, self: HCar | null, player: HPlayer | null) {
    const lat = laneLat(lane);
    for (const o of this.cars) {
      if (o === self || o.dir !== dir) continue;
      if (Math.abs(o.lat - lat) > 2.6 && o.lane !== lane) continue;
      const d = dir * (o.x - x);
      if (d > -back && d < front) return false;
    }
    if (player && dir === 1) {
      const plat = player.z - HWY_Z;
      if (Math.abs(plat - lat) < 2.8) {
        const d = player.x - x;
        if (d > -back && d < front) return false;
      }
    }
    return true;
  }

  update(dt: number, player: HPlayer | null, focusX: number) {
    if (dt <= 0) return;
    const px = player?.x ?? focusX;
    const plat = player ? player.z - HWY_Z : 0;
    if (player) this.travelled += Math.max(0, player.v) * dt;

    for (const c of this.cars) {
      // the car ahead in its lane (or in the lane it is moving into), you included
      let gap = Infinity;
      let lv = 0;
      const tLat = laneLat(c.lane);
      for (const o of this.cars) {
        if (o === c || o.dir !== c.dir) continue;
        const w = (o.width + c.width) / 2 + 0.3;
        if (Math.abs(o.lat - c.lat) > w && Math.abs(o.lat - tLat) > w) continue;
        const d = c.dir * (o.x - c.x) - (o.len + c.len) / 2;
        if (d > -1 && d < gap) {
          gap = d;
          lv = o.v;
        }
      }
      if (player && c.dir === 1) {
        const w = (player.width + c.width) / 2 + 0.3;
        if (Math.abs(plat - c.lat) < w || Math.abs(plat - tLat) < w) {
          const d = player.x - c.x - (player.len + c.len) / 2;
          if (d > -1 && d < gap) {
            gap = d;
            lv = Math.max(0, player.v);
          }
        }
      }
      // intelligent driver model
      if (c.crashed) {
        c.acc = -7;
      } else {
        const a = 2.2;
        const bComf = 3.5;
        let acc = a * (1 - (c.v / c.vDes) ** 4);
        if (gap < 250) {
          const ss = 4 + Math.max(0, c.v * 1.1 + (c.v * (c.v - lv)) / (2 * Math.sqrt(a * bComf)));
          acc -= a * (ss / Math.max(0.5, gap)) ** 2;
        }
        c.acc = clamp(acc, -9, a);
        // overtake a slower car ahead, or drift back toward the slow lane when the way is clear
        c.cool -= dt;
        if (c.changeT < 0 && c.signalT <= 0 && c.cool <= 0 && c.dir === 1) {
          c.cool = 1.5 + this.rng.next() * 3;
          let target = -1;
          if (gap < 70 && lv < c.vDes - 2.5) {
            for (const t of this.rng.next() < 0.7 ? [c.lane - 1, c.lane + 1] : [c.lane + 1, c.lane - 1]) {
              if (t < 0 || t >= LANES || (t === 3 && c.vDes > 28)) continue;
              if (this.laneClear(c.dir, t, c.x, 22, 34, c, player)) {
                target = t;
                break;
              }
            }
          } else if (c.lane < LANES - 1 && this.rng.next() < 0.15 && c.vDes < LANE_SPEED[c.lane] - 1 && this.laneClear(c.dir, c.lane + 1, c.x, 30, 60, c, player)) {
            target = c.lane + 1;
          }
          if (target >= 0) {
            c.blink = target < c.lane ? -1 : 1;
            c.signalT = 0.9;
            c.fromLat = c.lat;
            c.lane = target;
          }
        }
      }
      // lane change: indicate, then move across
      let latV = c.slideV;
      if (c.signalT > 0) {
        c.signalT -= dt;
        if (c.signalT <= 0) c.changeT = 0;
      } else if (c.changeT >= 0 && !c.crashed) {
        c.changeT += dt;
        const k = Math.min(1, c.changeT / CHANGE_T);
        const nl = c.fromLat + (laneLat(c.lane) - c.fromLat) * smooth(k);
        latV += (nl - c.lat) / dt;
        c.lat = nl;
        if (k >= 1) {
          c.changeT = -1;
          c.blink = 0;
        }
      }
      if (c.crashed) {
        c.spin += c.spinV * dt;
        c.spinV *= Math.exp(-2.2 * dt);
        c.lat = clamp(c.lat + c.slideV * dt, MEDIAN + 1.3, RAIL - 1.2);
        c.slideV *= Math.exp(-2.5 * dt);
      }
      c.v = Math.max(0, c.v + c.acc * dt);
      c.x += c.dir * c.v * dt;
      c.wheelRot += (c.v * dt) / VEHICLES[c.type].wheelRadius;
      const turn = c.v > 1 ? Math.atan(clamp((c.crashed ? 0 : latV) / c.v, -0.3, 0.3)) : 0;
      c.yaw = (c.dir * Math.PI) / 2 - turn + c.spin;
    }

    // keep the road ahead filled, and let go of cars well behind
    this.cars = this.cars.filter((c) => {
      const keep = c.dir === 1 ? c.x > px - 260 && c.x < px + 950 : c.x > px - 320 && c.x < px + 950;
      if (!keep) this.releaseBody(c);
      return keep;
    });
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.25;
      if (this.countAhead(px) < this.wantAhead()) this.trySpawn(1, px + 520 + this.rng.next() * 260);
      let west = 0;
      for (const c of this.cars) if (c.dir === -1) west++;
      if (west < 22) this.trySpawn(-1, px + 650 + this.rng.next() * 250);
    }
  }

  /** you hit it: it skids to a stop with its hazards on, in your way */
  crash(c: HCar, fromZ: number, impact: number) {
    if (c.crashed) return;
    c.crashed = true;
    c.changeT = -1;
    c.signalT = 0;
    c.blink = 0;
    const away = Math.sign(c.lat - (fromZ - HWY_Z) * c.dir) || 1;
    c.slideV = away * Math.min(4, 1 + impact * 0.2);
    c.spinV = (this.rng.next() < 0.5 ? -1 : 1) * Math.min(1.6, 0.4 + impact * 0.08);
  }

  /** the nearest car to a point (by its outline), within maxD metres */
  nearest(x: number, z: number, maxD: number) {
    let best: HCar | null = null;
    let bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, HWY_Z + c.dir * c.lat - z) - c.len / 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** cars near you, for the near-miss scoring */
  others(x: number, z: number, out: OtherCar[]) {
    for (const c of this.cars) {
      const cz = HWY_Z + c.dir * c.lat;
      if (Math.abs(c.x - x) > 32 || Math.abs(cz - z) > 32) continue;
      out.push({ id: c.id, x: c.x, z: cz, yaw: c.yaw, v: c.v, width: c.width, length: c.len });
    }
    return out;
  }

  // ------------------------------------------------------------------ physics proxies
  syncBodies(x: number, z: number) {
    for (const c of this.cars) {
      const cz = HWY_Z + c.dir * c.lat;
      const d = c.dir === 1 ? Math.hypot(c.x - x, cz - z) : Infinity;
      if (d < 70) {
        if (!c.body) this.acquireBody(c);
        const spec = VEHICLES[c.type];
        c.body!.setNextKinematicTranslation({ x: c.x, y: spec.height * 0.5 + 0.15, z: cz });
        c.body!.setNextKinematicRotation({ x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) });
      } else if (c.body && d > 80) this.releaseBody(c);
    }
  }

  private acquireBody(c: HCar) {
    const w = this.physics.world;
    const spec = VEHICLES[c.type];
    const body = this.bodyPool.pop() ?? w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    body.setTranslation({ x: c.x, y: spec.height * 0.5 + 0.15, z: HWY_Z + c.dir * c.lat }, true);
    body.setRotation({ x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) }, true);
    while (body.numColliders() > 0) w.removeCollider(body.collider(0), false);
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.height * 0.45, spec.length / 2)
        .setCollisionGroups(groups(GROUP.TRAFFIC, GROUP.PLAYER | GROUP.VEHICLE | GROUP.DYNAMIC))
        .setFriction(0.5),
      body,
    );
    body.setEnabled(true);
    c.body = body;
  }

  private releaseBody(c: HCar) {
    if (!c.body) return;
    c.body.setEnabled(false);
    c.body.setTranslation({ x: 0, y: -500, z: 0 }, false);
    this.bodyPool.push(c.body);
    c.body = null;
  }

  // ------------------------------------------------------------------ wrap and scenery
  /** how far to shift everything to keep coordinates small (0 most of the time) */
  wrapShift(x: number) {
    return x > WRAP ? -WRAP : x < -WRAP ? WRAP : 0;
  }

  shift(dx: number) {
    for (const c of this.cars) {
      c.x += dx;
      if (c.body) {
        const t = c.body.translation();
        c.body.setTranslation({ x: t.x + dx, y: t.y, z: t.z }, true);
      }
    }
  }

  /** move the repeating scenery (whole sections) and the horizon along with the camera */
  follow(x: number, camera: THREE.PerspectiveCamera, fog: THREE.Color | null) {
    const base = Math.floor(x / SECTION) * SECTION;
    this.scenery.position.set(base - SECTION, 0, HWY_Z);
    const lk = Math.floor(x / LANDMARK);
    this.landmarks.forEach(([g, o], i) => {
      const k = lk - 1 + i;
      g.position.set(k * LANDMARK + 240, 0, HWY_Z);
      o.position.set(k * LANDMARK + 960, 0, HWY_Z);
    });
    const r = camera.far * 0.93;
    this.hills.position.set(camera.position.x, 0, camera.position.z);
    this.hills.scale.set(r, r, r);
    // hazy: most of the way to the fog colour, darker at night
    if (fog) this.hillMat.color.copy(fog).multiplyScalar(0.72 + 0.1 * (1 - G.uNight.value));
    for (const m of this.signMats) m.emissiveIntensity = 0.04 + 0.5 * G.uNight.value;
  }

  draw(r: VehicleRenderer, lights: number, fx: number, range: number) {
    for (const c of this.cars) {
      if (Math.abs(c.x - fx) > range) continue;
      const blinkOn = c.blink !== 0 && Math.floor(performance.now() / 380) % 2 === 0;
      r.push({
        type: c.type,
        x: c.x,
        z: HWY_Z + c.dir * c.lat,
        yaw: c.yaw,
        paint: c.paint,
        head: lights,
        brake: c.acc < -1.2 || (c.crashed && c.v > 0.3) ? 1 : 0,
        hazard: c.crashed || blinkOn ? 1 : 0,
        wheelRot: c.wheelRot,
        steer: 0,
      });
    }
  }
}
