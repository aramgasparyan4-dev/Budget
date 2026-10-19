import * as THREE from 'three';
import {
  MeshBuilder,
  BASIC_LAYOUT,
  addBox,
  addCylinder,
  addSphere,
  addCone,
  lin,
  GeometryData,
  Xform,
} from './MeshBuilder';
import type { PropType } from '../world/types';

export function toBufferGeometry(d: GeometryData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(d.attrs)) g.setAttribute(name, new THREE.BufferAttribute(a.array, a.size));
  g.setIndex(new THREE.BufferAttribute(d.index, 1));
  const [x0, y0, z0, x1, y1, z1] = d.bounds;
  g.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

export interface ColliderSpec {
  kind: 'box' | 'cyl';
  /** local center */
  x: number;
  y: number;
  z: number;
  /** box half extents or cyl (radius in hx, half height in hy) */
  hx: number;
  hy: number;
  hz: number;
}

export interface PropModel {
  geometry: THREE.BufferGeometry;
  colliders: ColliderSpec[];
  /** local offsets of light sources for light pools */
  lights?: { x: number; z: number; r: number }[];
  castShadow: boolean;
}

const C = {
  bark: lin([0.32, 0.22, 0.15]),
  leaf1: lin([0.24, 0.38, 0.14]),
  leaf2: lin([0.2, 0.33, 0.12]),
  leaf3: lin([0.3, 0.42, 0.16]),
  pine: lin([0.12, 0.25, 0.14]),
  palmLeaf: lin([0.28, 0.45, 0.16]),
  metal: lin([0.24, 0.25, 0.27]),
  metalLight: lin([0.55, 0.56, 0.58]),
  black: lin([0.06, 0.06, 0.07]),
  lampLight: lin([1.0, 0.86, 0.62]),
  red: lin([0.68, 0.08, 0.07]),
  white: lin([0.88, 0.88, 0.86]),
  wood: lin([0.45, 0.3, 0.18]),
  green: lin([0.12, 0.26, 0.18]),
  concrete: lin([0.6, 0.59, 0.56]),
  glass: lin([0.55, 0.68, 0.72]),
  hedge: lin([0.15, 0.3, 0.12]),
  signGreen: lin([0.05, 0.35, 0.18]),
  water: lin([0.25, 0.55, 0.65]),
  yellow: lin([0.85, 0.65, 0.1]),
  blue: lin([0.12, 0.3, 0.6]),
};

const T = (tx = 0, ty = 0, tz = 0, ry = 0, rx = 0, rz = 0): Xform => ({ tx, ty, tz, ry, rx, rz });

function build(fn: (b: MeshBuilder) => void): THREE.BufferGeometry {
  const b = new MeshBuilder(BASIC_LAYOUT);
  fn(b);
  return toBufferGeometry(b.build());
}

const SWAY = -1; // aEmit < 0 = wind sway weight

function tree(b: MeshBuilder, variant: number) {
  addCylinder(b, 0, 0, 0, 0.2, 0.13, 3.0, 7, C.bark);
  const cols = [C.leaf1, C.leaf2, C.leaf3];
  addSphere(b, 0, 3.6, 0, 1.9, 1.6, 1.9, 9, 6, cols[variant % 3], undefined, SWAY, 0.35, 1 + variant);
  addSphere(b, 0.9, 4.4, 0.4, 1.3, 1.2, 1.3, 8, 5, cols[(variant + 1) % 3], undefined, SWAY, 0.35, 2 + variant);
  addSphere(b, -0.7, 4.7, -0.5, 1.2, 1.1, 1.2, 8, 5, cols[(variant + 2) % 3], undefined, SWAY, 0.35, 3 + variant);
  addSphere(b, 0.1, 5.4, 0.1, 0.9, 0.8, 0.9, 7, 5, cols[variant % 3], undefined, SWAY, 0.3, 4 + variant);
}

function conifer(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.18, 0.12, 1.6, 6, C.bark);
  addCone(b, 0, 1.2, 0, 1.9, 2.8, 8, C.pine);
  addCone(b, 0, 2.6, 0, 1.5, 2.6, 8, lin([0.14, 0.28, 0.15]));
  addCone(b, 0, 4.0, 0, 1.0, 2.4, 8, lin([0.16, 0.31, 0.17]));
}

function palm(b: MeshBuilder) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const nx = x + 0.12 * i * 0.25;
    addCylinder(b, 0, 0, 0, 0.2 - i * 0.012, 0.19 - i * 0.012, 1.3, 7, lin([0.42, 0.33, 0.24]), T(nx, y, 0));
    x = nx;
    y += 1.25;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    addBox(b, 0, 0, 1.4, 0.5, 0.06, 2.8, C.palmLeaf, { tx: x, ty: y + 0.1, tz: 0, ry: a, rx: 0.45 }, SWAY);
  }
  addSphere(b, x, y, 0, 0.35, 0.3, 0.35, 6, 4, lin([0.35, 0.25, 0.12]));
}

function lampModern(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.12, 0.08, 7.6, 8, C.metal);
  addBox(b, 0, 7.55, 0.8, 0.1, 0.1, 1.7, C.metal);
  addBox(b, 0, 7.5, 1.6, 0.42, 0.14, 0.75, C.metal);
  addBox(b, 0, 7.42, 1.6, 0.34, 0.04, 0.62, C.lampLight, undefined, 1);
  addCylinder(b, 0, 0, 0, 0.2, 0.18, 0.5, 8, C.metal);
}

function lampClassic(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.16, 0.1, 0.6, 8, C.black);
  addCylinder(b, 0, 0.6, 0, 0.08, 0.06, 3.6, 8, C.black);
  addCylinder(b, 0, 4.15, 0, 0.12, 0.22, 0.12, 8, C.black);
  addCylinder(b, 0, 4.27, 0, 0.2, 0.25, 0.6, 8, C.lampLight, undefined, 1, false);
  addCylinder(b, 0, 4.87, 0, 0.3, 0.05, 0.3, 8, C.black);
}

function signalPole(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.17, 0.13, 6.4, 8, C.metal);
  addBox(b, 2.55, 6.1, 0, 5.1, 0.14, 0.14, C.metal);
  addBox(b, 1.2, 5.6, 0, 2.4, 0.06, 0.06, C.metal, T(0, 0, 0, 0, 0, 0.35));
  // pedestrian signal box
  addBox(b, 0, 2.9, 0.25, 0.32, 0.5, 0.22, C.black);
}

function stopSign(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.04, 0.04, 2.3, 6, C.metalLight);
  addCylinder(b, 0, 0, 0, 0.42, 0.42, 0.04, 8, C.red, { tx: 0, ty: 2.25, tz: 0.04, ry: 0, rx: Math.PI / 2 }, 0.05);
  addCylinder(b, 0, 0, 0, 0.36, 0.36, 0.045, 8, C.white, { tx: 0, ty: 2.25, tz: 0.035, ry: 0, rx: Math.PI / 2 }, 0.05);
  addCylinder(b, 0, 0, 0, 0.34, 0.34, 0.05, 8, C.red, { tx: 0, ty: 2.25, tz: 0.03, ry: 0, rx: Math.PI / 2 }, 0.05);
}

function streetSign(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.05, 0.05, 3.4, 6, C.metal);
  addBox(b, 0.8, 3.1, 0, 1.7, 0.3, 0.04, C.signGreen, undefined, 0.05);
  addBox(b, 0, 3.45, 0.8, 0.04, 0.3, 1.7, C.signGreen, undefined, 0.05);
}

function hydrant(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.17, 0.15, 0.55, 8, C.red);
  addSphere(b, 0, 0.58, 0, 0.15, 0.12, 0.15, 8, 4, C.red);
  addCylinder(b, 0, 0, 0, 0.06, 0.06, 0.42, 6, C.red, { tx: -0.21, ty: 0.38, tz: 0, ry: 0, rz: Math.PI / 2 });
  addCylinder(b, 0, 0, 0, 0.22, 0.22, 0.06, 8, C.red);
}

function bench(b: MeshBuilder) {
  for (let k = 0; k < 3; k++) addBox(b, 0, 0.45, -0.18 + k * 0.17, 1.8, 0.05, 0.13, C.wood);
  for (let k = 0; k < 2; k++) addBox(b, 0, 0.72 + k * 0.17, -0.3, 1.8, 0.11, 0.04, C.wood, { tx: 0, ty: 0, tz: 0, ry: 0, rx: -0.12 });
  for (const x of [-0.75, 0.75]) {
    addBox(b, x, 0.22, 0, 0.06, 0.44, 0.5, C.black);
    addBox(b, x, 0.6, -0.3, 0.06, 0.62, 0.06, C.black);
  }
}

function bin(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.27, 0.3, 0.92, 10, lin([0.12, 0.22, 0.16]));
  addCylinder(b, 0, 0.92, 0, 0.31, 0.25, 0.1, 10, C.black);
}

function busStop(b: MeshBuilder) {
  addBox(b, 0, 1.3, -0.7, 3.8, 2.2, 0.05, C.glass, undefined, 0.15);
  addBox(b, 0, 2.5, -0.1, 4.0, 0.12, 1.6, C.metal);
  for (const x of [-1.95, 1.95]) {
    addBox(b, x, 1.25, -0.7, 0.08, 2.5, 0.08, C.metal);
    addBox(b, x, 1.25, 0.6, 0.08, 2.5, 0.08, C.metal);
    addBox(b, x, 1.3, -0.1, 0.04, 2.0, 1.2, C.glass, undefined, 0.15);
  }
  addBox(b, 0, 0.45, -0.45, 2.6, 0.06, 0.38, C.metalLight);
  // ad panel (lit)
  addBox(b, 1.2, 1.4, -0.66, 1.2, 1.7, 0.03, lin([0.9, 0.85, 0.7]), undefined, 0.8);
  // sign
  addCylinder(b, 2.4, 0, 0.7, 0.04, 0.04, 2.8, 6, C.metal);
  addBox(b, 2.4, 2.7, 0.7, 0.5, 0.5, 0.04, C.blue, undefined, 0.3);
}

function planter(b: MeshBuilder) {
  addBox(b, 0, 0.3, 0, 1.6, 0.6, 1.6, C.concrete);
  addBox(b, 0, 0.6, 0, 1.4, 0.04, 1.4, lin([0.15, 0.12, 0.08]));
}

function fountain(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 4.2, 4.2, 0.65, 24, C.concrete);
  addCylinder(b, 0, 0.2, 0, 3.85, 3.85, 0.4, 24, C.water, undefined, 0.25, true);
  addCylinder(b, 0, 0, 0, 0.6, 0.45, 2.2, 12, C.concrete);
  addCylinder(b, 0, 2.2, 0, 1.4, 0.3, 0.4, 12, C.concrete);
  addCylinder(b, 0, 2.5, 0, 1.25, 1.25, 0.12, 12, C.water, undefined, 0.3);
  addCylinder(b, 0, 2.5, 0, 0.15, 0.08, 1.2, 8, lin([0.75, 0.9, 1.0]), undefined, 0.6);
}

function hedge(b: MeshBuilder) {
  addBox(b, 0, 0.65, 0, 3.05, 1.3, 0.95, C.hedge, undefined, 0);
  addBox(b, 0, 1.32, 0, 2.95, 0.08, 0.85, lin([0.18, 0.34, 0.14]));
}

function fence(b: MeshBuilder) {
  addBox(b, 0, 0.35, 0, 2.5, 0.07, 0.05, C.white);
  addBox(b, 0, 0.8, 0, 2.5, 0.07, 0.05, C.white);
  for (let k = 0; k < 6; k++) addBox(b, -1.1 + k * 0.44, 0.55, 0.03, 0.09, 1.1, 0.03, C.white);
}

function container(b: MeshBuilder) {
  addBox(b, 0, 1.3, 0, 2.44, 2.6, 6.0, lin([0.9, 0.9, 0.9]), undefined, 0, false);
  for (let k = 0; k < 10; k++) addBox(b, 1.235, 1.3, -2.7 + k * 0.6, 0.04, 2.4, 0.08, lin([0.75, 0.75, 0.75]));
}

function billboard(b: MeshBuilder) {
  addCylinder(b, 0, -6, 0, 0.2, 0.2, 6.2, 8, C.metal);
  addBox(b, 0, 2.0, 0, 8.4, 4.4, 0.3, C.metal);
  addBox(b, 0, 2.0, 0.17, 8.0, 4.0, 0.04, lin([0.95, 0.95, 0.95]), undefined, 1.2);
}

function bush(b: MeshBuilder, v: number) {
  addSphere(b, 0, 0.55, 0, 0.9, 0.7, 0.9, 7, 5, v % 2 ? C.leaf2 : C.hedge, undefined, -0.4, 0.45, v + 5);
}

function picnic(b: MeshBuilder) {
  addBox(b, 0, 0.75, 0, 1.9, 0.06, 0.8, C.wood);
  for (const z of [-0.65, 0.65]) addBox(b, 0, 0.45, z, 1.9, 0.05, 0.28, C.wood);
  for (const x of [-0.7, 0.7]) addBox(b, x, 0.37, 0, 0.08, 0.74, 1.5, C.wood);
}

function playground(b: MeshBuilder) {
  // slide tower
  addBox(b, 0, 1.0, 0, 1.8, 0.1, 1.8, C.red);
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) addCylinder(b, x, 0, z, 0.07, 0.07, 2.4, 6, C.blue);
  addBox(b, 0, 2.4, 0, 2.0, 0.1, 2.0, C.yellow);
  addBox(b, 0, 0.5, 2.0, 0.7, 0.06, 2.6, C.yellow, { tx: 0, ty: 0, tz: 0, ry: 0, rx: 0.38 });
  // swings
  addBox(b, 4, 2.4, 0, 3.4, 0.1, 0.1, C.blue);
  for (const x of [2.4, 5.6]) addCylinder(b, x, 0, 0, 0.06, 0.06, 2.4, 6, C.blue);
  for (const x of [3.4, 4.6]) {
    addBox(b, x, 1.45, 0, 0.02, 1.9, 0.02, C.metalLight);
    addBox(b, x, 0.5, 0, 0.5, 0.05, 0.25, C.red);
  }
}

function dumpster(b: MeshBuilder) {
  addBox(b, 0, 0.65, 0, 1.9, 1.3, 1.1, lin([0.15, 0.3, 0.45]));
  addBox(b, 0, 1.33, 0, 1.95, 0.06, 1.15, C.black, { tx: 0, ty: 0, tz: 0, ry: 0, rx: 0.05 });
}

function acUnit(b: MeshBuilder) {
  addBox(b, 0, 0, 0, 1.7, 1.0, 1.2, lin([0.7, 0.71, 0.72]), { tx: 0, ty: -0.3, tz: 0, ry: 0 });
  addCylinder(b, 0, 0.2, 0, 0.45, 0.45, 0.04, 12, C.black);
}

function waterTank(b: MeshBuilder) {
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) addBox(b, x, 0.2, z, 0.15, 1.8, 0.15, C.metal, { tx: 0, ty: -0.7, tz: 0, ry: 0 });
  addCylinder(b, 0, 1.1, 0, 1.4, 1.4, 2.6, 12, lin([0.42, 0.3, 0.2]));
  addCone(b, 0, 3.7, 0, 1.5, 0.8, 12, lin([0.3, 0.22, 0.15]));
}

function railing(b: MeshBuilder) {
  addBox(b, 0, 1.05, 0, 4.0, 0.08, 0.08, C.metalLight);
  addBox(b, 0, 0.55, 0, 4.0, 0.04, 0.04, C.metalLight);
  for (const x of [-1.95, 0, 1.95]) addBox(b, x, 0.55, 0, 0.07, 1.1, 0.07, C.metalLight);
}

function meter(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.04, 0.04, 1.15, 6, C.metal);
  addBox(b, 0, 1.25, 0, 0.18, 0.28, 0.14, C.metalLight);
}

function antenna(b: MeshBuilder) {
  addCylinder(b, 0, 0, 0, 0.06, 0.03, 6, 5, C.metal);
  addSphere(b, 0, 6, 0, 0.12, 0.12, 0.12, 6, 4, lin([1, 0.1, 0.1]), undefined, 2);
}

export function buildPropModels(): Record<PropType, PropModel | null> {
  const cyl = (r: number, h: number, y = h / 2): ColliderSpec => ({ kind: 'cyl', x: 0, y, z: 0, hx: r, hy: h / 2, hz: r });
  const bx = (sx: number, sy: number, sz: number, x = 0, y = sy / 2, z = 0): ColliderSpec => ({ kind: 'box', x, y, z, hx: sx / 2, hy: sy / 2, hz: sz / 2 });
  const m = (geometry: THREE.BufferGeometry, colliders: ColliderSpec[], castShadow = true, lights?: PropModel['lights']): PropModel => ({
    geometry,
    colliders,
    castShadow,
    lights,
  });
  return {
    tree: m(build((b) => tree(b, 0)), [cyl(0.28, 3)]),
    conifer: m(build(conifer), [cyl(0.25, 2)]),
    palm: m(build(palm), [cyl(0.25, 3)]),
    lamp: m(build(lampModern), [cyl(0.14, 7.5)], true, [{ x: 0, z: 1.6, r: 7.5 }]),
    lampClassic: m(build(lampClassic), [cyl(0.14, 4.5)], true, [{ x: 0, z: 0, r: 5.5 }]),
    signalPole: m(build(signalPole), [cyl(0.2, 6.2)]),
    stopSign: m(build(stopSign), [cyl(0.06, 2.4)]),
    streetSign: m(build(streetSign), [cyl(0.07, 3.4)]),
    hydrant: m(build(hydrant), [cyl(0.2, 0.7)], false),
    bench: m(build(bench), [bx(1.8, 0.85, 0.6, 0, 0.42, -0.05)], false),
    bin: m(build(bin), [cyl(0.32, 1.0)], false),
    busStop: m(build(busStop), [bx(4.0, 2.5, 0.12, 0, 1.25, -0.7), bx(0.12, 2.5, 1.3, -1.95, 1.25, -0.05), bx(0.12, 2.5, 1.3, 1.95, 1.25, -0.05)]),
    planter: m(build(planter), [bx(1.6, 0.6, 1.6)], false),
    bollard: m(build((b) => addCylinder(b, 0, 0, 0, 0.12, 0.1, 0.9, 8, C.metal)), [cyl(0.12, 0.9)], false),
    fountain: m(build(fountain), [cyl(4.2, 0.7)]),
    hedge: m(build(hedge), [bx(3.0, 1.3, 0.95)]),
    fence: m(build(fence), [bx(2.5, 1.1, 0.12)], false),
    container: m(build(container), [bx(2.44, 2.6, 6.0)]),
    crane: null,
    billboard: m(build(billboard), [cyl(0.25, 6.2, -3)]),
    bush: m(build((b) => bush(b, 1)), [], false),
    picnic: m(build(picnic), [bx(1.9, 0.8, 1.6)], false),
    playground: m(build(playground), [bx(2.2, 2.5, 2.2), bx(3.6, 2.5, 0.3, 4, 1.25, 0)]),
    dumpster: m(build(dumpster), [bx(1.9, 1.35, 1.1)]),
    acUnit: m(build(acUnit), [], true),
    waterTank: m(build(waterTank), [], true),
    antenna: m(build(antenna), [], false),
    railing: m(build(railing), [bx(4.0, 1.15, 0.15)], false),
    meter: m(build(meter), [cyl(0.06, 1.3)], false),
    car: null,
  };
}
