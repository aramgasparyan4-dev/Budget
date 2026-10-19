// Procedural interior layouts. Each layout describes a room shell, furniture
// boxes (rendered + collidable), lights, NPC slots and interactive stations.
import type { InteriorType } from '../world/types';
import { RNG } from '../core/rng';

export type RGB = [number, number, number];

export interface FBox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  c: RGB;
  emit?: number;
  collide?: boolean;
  ry?: number;
}
export interface FCyl {
  x: number;
  y: number;
  z: number;
  r: number;
  h: number;
  c: RGB;
  emit?: number;
  collide?: boolean;
}
export interface Slot {
  x: number;
  z: number;
  yaw: number;
  pose: 'stand' | 'sit' | 'dance' | 'browse' | 'work';
  role: 'staff' | 'customer';
}
export interface Station {
  id: string;
  x: number;
  z: number;
  r: number;
  label: string;
  sub?: string;
  key?: 'KeyE' | 'KeyF';
}
export interface LightDef {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
}
export interface Layout {
  w: number; // x extent
  d: number; // z extent (door at z = +d/2)
  h: number;
  floor: RGB;
  floorKind: 'wood' | 'tile' | 'concrete' | 'carpet';
  wall: RGB;
  accent: RGB;
  boxes: FBox[];
  cyls: FCyl[];
  slots: Slot[];
  stations: Station[];
  lights: LightDef[];
  windowGlow: RGB;
  displayCars?: { x: number; z: number; yaw: number; type: number }[];
  music?: 'club' | 'radio';
  spawn: { x: number; z: number; yaw: number };
}

const WOOD: RGB = [0.45, 0.3, 0.18];
const DARKWOOD: RGB = [0.25, 0.16, 0.1];
const STEEL: RGB = [0.6, 0.62, 0.65];
const BLACK: RGB = [0.06, 0.06, 0.07];
const WHITE: RGB = [0.9, 0.9, 0.88];

function table(L: Layout, x: number, z: number, round: boolean, chairs: number, c: RGB = WOOD, customer = true) {
  if (round) L.cyls.push({ x, y: 0, z, r: 0.5, h: 0.76, c, collide: true });
  else L.boxes.push({ x, y: 0.38, z, sx: 1.1, sy: 0.76, sz: 0.8, c, collide: true });
  const ring = chairs === 2 ? [0, Math.PI] : [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const a of ring) {
    const cx = x + Math.sin(a) * 0.85;
    const cz = z + Math.cos(a) * 0.85;
    L.boxes.push({ x: cx, y: 0.24, z: cz, sx: 0.45, sy: 0.48, sz: 0.45, c: DARKWOOD });
    L.boxes.push({ x: cx + Math.sin(a) * 0.2, y: 0.7, z: cz + Math.cos(a) * 0.2, sx: Math.abs(Math.cos(a)) * 0.4 + 0.06, sy: 0.5, sz: Math.abs(Math.sin(a)) * 0.4 + 0.06, c: DARKWOOD });
    if (customer) L.slots.push({ x: cx, z: cz, yaw: a + Math.PI, pose: 'sit', role: 'customer' });
  }
}

function pendant(L: Layout, x: number, z: number, color = 0xffd9a0, c: RGB = [1, 0.85, 0.6]) {
  L.cyls.push({ x, y: L.h - 0.9, z, r: 0.18, h: 0.25, c, emit: 2.2 });
  L.boxes.push({ x, y: L.h - 0.4, z, sx: 0.02, sy: 0.8, sz: 0.02, c: BLACK });
  void color;
}

function ceilingPanel(L: Layout, x: number, z: number, w = 1.2, d = 0.6) {
  L.boxes.push({ x, y: L.h - 0.04, z, sx: w, sy: 0.05, sz: d, c: [1, 0.97, 0.9], emit: 2.0 });
}

function shelf(L: Layout, x: number, z: number, ry: number, rng: RNG, len = 3) {
  L.boxes.push({ x, y: 1.0, z, sx: ry ? 0.5 : len, sy: 2.0, sz: ry ? len : 0.5, c: STEEL, collide: true });
  // products
  const n = Math.floor(len * 4);
  for (let k = 0; k < n; k++) {
    for (let lvl = 0; lvl < 4; lvl++) {
      const t = (k + 0.5) / n - 0.5;
      const px = ry ? x : x + t * len;
      const pz = ry ? z + t * len : z;
      const c: RGB = [rng.range(0.2, 0.95), rng.range(0.2, 0.9), rng.range(0.2, 0.9)];
      L.boxes.push({ x: px + (ry ? (rng.chance(0.5) ? 0.28 : -0.28) : 0), y: 0.35 + lvl * 0.45, z: pz + (ry ? 0 : rng.chance(0.5) ? 0.28 : -0.28), sx: ry ? 0.08 : 0.18, sy: 0.25, sz: ry ? 0.18 : 0.08, c, emit: 0.05 });
    }
  }
}

function plant(L: Layout, x: number, z: number) {
  L.cyls.push({ x, y: 0, z, r: 0.25, h: 0.45, c: [0.55, 0.35, 0.25] });
  L.cyls.push({ x, y: 0.45, z, r: 0.38, h: 0.9, c: [0.18, 0.4, 0.16] });
}

function counter(L: Layout, x: number, z: number, len: number, alongX = true, c: RGB = DARKWOOD, top: RGB = [0.82, 0.8, 0.76]) {
  L.boxes.push({ x, y: 0.5, z, sx: alongX ? len : 0.7, sy: 1.0, sz: alongX ? 0.7 : len, c, collide: true });
  L.boxes.push({ x, y: 1.02, z, sx: alongX ? len + 0.1 : 0.8, sy: 0.05, sz: alongX ? 0.8 : len + 0.1, c: top });
}

export function buildLayout(type: InteriorType, seed: number, opts: { upgrades?: string[]; homeTier?: number } = {}): Layout {
  const rng = new RNG(seed);
  const base = (w: number, d: number, h: number, floor: RGB, floorKind: Layout['floorKind'], wall: RGB, accent: RGB): Layout => ({
    w,
    d,
    h,
    floor,
    floorKind,
    wall,
    accent,
    boxes: [],
    cyls: [],
    slots: [],
    stations: [{ id: 'exit', x: 0, z: d / 2 - 0.9, r: 1.4, label: 'Exit', key: 'KeyE' }],
    lights: [],
    windowGlow: [0.6, 0.7, 0.85],
    spawn: { x: 0, z: d / 2 - 1.8, yaw: Math.PI },
  });
  switch (type) {
    case 'cafe': {
      const L = base(12, 10, 3.6, [0.55, 0.38, 0.24], 'wood', [0.86, 0.8, 0.7], [0.25, 0.4, 0.35]);
      counter(L, -1.5, -3.4, 6, true);
      L.boxes.push({ x: -3.2, y: 1.3, z: -3.5, sx: 0.6, sy: 0.5, sz: 0.5, c: STEEL, emit: 0.1 }); // espresso machine
      L.boxes.push({ x: -1.5, y: 2.4, z: -4.9, sx: 4.5, sy: 1.0, sz: 0.06, c: BLACK, emit: 0.2 }); // menu board
      L.boxes.push({ x: 1.0, y: 1.2, z: -3.4, sx: 1.2, sy: 0.35, sz: 0.6, c: [0.9, 0.95, 1], emit: 0.4 }); // pastry case
      L.slots.push({ x: -2.6, z: -4.3, yaw: 0, pose: 'work', role: 'staff' }, { x: -0.4, z: -4.3, yaw: 0, pose: 'work', role: 'staff' });
      for (const [x, z] of [[-3.5, 0], [0, 0.5], [3.5, -0.5], [-3.5, 3], [3.5, 2.6]]) table(L, x, z, true, 2);
      L.boxes.push({ x: 5.2, y: 0.4, z: -2, sx: 1, sy: 0.8, sz: 4, c: [0.35, 0.18, 0.15], collide: true }); // booth
      for (const z of [-3, -1.2]) L.slots.push({ x: 4.6, z, yaw: -Math.PI / 2, pose: 'sit', role: 'customer' });
      for (const [x, z] of [[-3.5, 0], [0, 0.5], [3.5, -0.5]]) pendant(L, x, z);
      pendant(L, -1.5, -3.2);
      plant(L, 5.3, 3.8);
      plant(L, -5.3, 3.8);
      L.stations.push({ id: 'shop', x: -1.5, z: -2.5, r: 1.6, label: 'Order at the counter' });
      L.stations.push({ id: 'work', x: -1.5, z: -4.2, r: 1.2, label: 'Workstation' });
      L.stations.push({ id: 'jobboard', x: 1.6, z: -2.6, r: 1.2, label: 'Ask about work' });
      L.lights.push({ x: 0, y: 3, z: 0, color: 0xffcc88, intensity: 18, distance: 14 }, { x: -2, y: 3, z: -3, color: 0xffd9a0, intensity: 10, distance: 8 });
      L.music = 'radio';
      return L;
    }
    case 'restaurant': {
      const L = base(16, 12, 3.8, [0.3, 0.22, 0.18], 'wood', [0.62, 0.42, 0.34], [0.5, 0.15, 0.15]);
      counter(L, 4.5, -4.6, 5, true, [0.2, 0.15, 0.12]);
      L.boxes.push({ x: -4, y: 1.4, z: -5.7, sx: 6, sy: 2.4, sz: 0.4, c: [0.85, 0.85, 0.85], emit: 0.15 }); // kitchen pass
      L.slots.push({ x: 4.5, z: -5.4, yaw: 0, pose: 'work', role: 'staff' }, { x: -4, z: -5.2, yaw: 0, pose: 'work', role: 'staff' }, { x: 0, z: -2, yaw: Math.PI, pose: 'stand', role: 'staff' });
      for (const x of [-5.5, -2, 1.5, 5]) for (const z of [-1.2, 2.2]) table(L, x, z, false, 4, [0.85, 0.85, 0.82]);
      for (const x of [-5.5, -2, 1.5, 5]) pendant(L, x, 0.5, 0xffc080);
      plant(L, -7.2, 5.2);
      plant(L, 7.2, 5.2);
      L.stations.push({ id: 'shop', x: 4.5, z: -3.7, r: 1.6, label: 'Order food' });
      L.stations.push({ id: 'work', x: -4, z: -4.8, r: 1.4, label: 'Workstation' });
      L.stations.push({ id: 'jobboard', x: 2, z: -3.8, r: 1.2, label: 'Ask about work' });
      L.lights.push({ x: -3, y: 3.2, z: 0, color: 0xffbb77, intensity: 22, distance: 14 }, { x: 3.5, y: 3.2, z: 0, color: 0xffbb77, intensity: 22, distance: 14 });
      L.music = 'radio';
      return L;
    }
    case 'store': {
      const L = base(14, 12, 3.6, [0.82, 0.82, 0.8], 'tile', [0.92, 0.92, 0.9], [0.2, 0.45, 0.75]);
      for (const x of [-4, -1.2, 1.6]) shelf(L, x, -0.5, 1, rng, 6);
      for (let k = 0; k < 4; k++) L.boxes.push({ x: 6.4, y: 1.0, z: -4 + k * 1.6, sx: 0.8, sy: 2.0, sz: 1.5, c: [0.75, 0.85, 0.95], emit: 0.5, collide: true }); // fridges
      counter(L, 4.2, 3.6, 3, true, [0.3, 0.3, 0.32]);
      L.boxes.push({ x: 3.4, y: 1.25, z: 3.6, sx: 0.35, sy: 0.3, sz: 0.3, c: BLACK, emit: 0.3 }); // register
      L.boxes.push({ x: -6.3, y: 0.9, z: 4.2, sx: 0.9, sy: 1.8, sz: 0.8, c: [0.15, 0.35, 0.55], emit: 0.25, collide: true }); // ATM
      L.slots.push({ x: 4.2, z: 2.8, yaw: Math.PI, pose: 'work', role: 'staff' });
      for (const [x, z] of [[-2.6, -3], [0.2, 1.5], [3, -2], [-5.5, 0]]) L.slots.push({ x, z, yaw: rng.range(0, 6), pose: 'browse', role: 'customer' });
      for (const x of [-4, 0, 4]) for (const z of [-3, 1.5]) ceilingPanel(L, x, z, 2.4, 0.4);
      L.stations.push({ id: 'shop', x: 4.2, z: 4.6, r: 1.6, label: 'Buy items' });
      L.stations.push({ id: 'atm', x: -6.0, z: 5.0, r: 1.3, label: 'Use ATM' });
      L.stations.push({ id: 'work', x: 4.2, z: 2.6, r: 1.1, label: 'Register (staff)' });
      L.stations.push({ id: 'jobboard', x: 2.6, z: 4.6, r: 1.0, label: 'Ask about work' });
      L.lights.push({ x: 0, y: 3.3, z: 0, color: 0xf2f5ff, intensity: 28, distance: 16 });
      return L;
    }
    case 'clothing': {
      const L = base(14, 11, 3.8, [0.5, 0.45, 0.42], 'wood', [0.88, 0.86, 0.84], [0.1, 0.1, 0.12]);
      for (const [x, z] of [[-4, -2], [-4, 1.5], [0, -2], [0, 1.5], [4, -2]]) {
        L.boxes.push({ x, y: 1.5, z, sx: 2.4, sy: 0.04, sz: 0.04, c: STEEL });
        L.boxes.push({ x: x - 1.15, y: 0.75, z, sx: 0.05, sy: 1.5, sz: 0.05, c: STEEL, collide: true });
        L.boxes.push({ x: x + 1.15, y: 0.75, z, sx: 0.05, sy: 1.5, sz: 0.05, c: STEEL, collide: true });
        for (let k = 0; k < 8; k++) L.boxes.push({ x: x - 1 + k * 0.28, y: 1.05, z, sx: 0.06, sy: 0.85, sz: 0.5, c: [rng.range(0.1, 0.9), rng.range(0.1, 0.8), rng.range(0.1, 0.9)] });
        L.slots.push({ x, z: z + 0.9, yaw: Math.PI, pose: 'browse', role: 'customer' });
      }
      L.boxes.push({ x: -6.6, y: 1.2, z: 3, sx: 0.06, sy: 2.0, sz: 1.2, c: [0.75, 0.85, 0.95], emit: 0.25 }); // mirror
      counter(L, 4.5, 3.4, 2.6, true, [0.12, 0.12, 0.13], [0.9, 0.9, 0.9]);
      L.slots.push({ x: 4.5, z: 2.6, yaw: Math.PI, pose: 'work', role: 'staff' });
      for (const x of [-4, 0, 4]) ceilingPanel(L, x, 0, 1.6, 1.6);
      L.stations.push({ id: 'shop', x: 4.5, z: 4.4, r: 1.6, label: 'Browse outfits' });
      L.stations.push({ id: 'jobboard', x: 3.0, z: 4.4, r: 1.0, label: 'Ask about work' });
      L.lights.push({ x: 0, y: 3.4, z: 0, color: 0xfff1e0, intensity: 26, distance: 15 });
      return L;
    }
    case 'office': {
      const L = base(16, 14, 3.4, [0.35, 0.37, 0.4], 'carpet', [0.85, 0.86, 0.88], [0.25, 0.35, 0.55]);
      counter(L, 0, 4.3, 3.4, true, [0.92, 0.92, 0.92], [0.2, 0.2, 0.22]);
      L.slots.push({ x: 0, z: 3.5, yaw: Math.PI, pose: 'work', role: 'staff' });
      for (const x of [-5.5, -2, 1.5, 5]) {
        for (const z of [-4.5, -1.2]) {
          L.boxes.push({ x, y: 0.38, z, sx: 1.6, sy: 0.76, sz: 0.8, c: WHITE, collide: true });
          L.boxes.push({ x, y: 1.02, z: z - 0.25, sx: 0.6, sy: 0.38, sz: 0.04, c: BLACK, emit: 0.6 });
          L.boxes.push({ x, y: 0.25, z: z + 0.7, sx: 0.5, sy: 0.5, sz: 0.5, c: BLACK });
          L.slots.push({ x, z: z + 0.7, yaw: Math.PI, pose: 'sit', role: 'staff' });
        }
      }
      plant(L, -7.2, 5.8);
      plant(L, 7.2, 5.8);
      for (const x of [-4, 0, 4]) for (const z of [-4, 0]) ceilingPanel(L, x, z, 1.2, 1.2);
      L.stations.push({ id: 'reception', x: 0, z: 5.2, r: 1.6, label: 'Reception' });
      L.stations.push({ id: 'work', x: 1.5, z: -0.4, r: 1.2, label: 'Your desk' });
      L.lights.push({ x: 0, y: 3.1, z: -1, color: 0xf0f4ff, intensity: 26, distance: 16 });
      return L;
    }
    case 'bank': {
      const L = base(16, 13, 4.6, [0.75, 0.72, 0.66], 'tile', [0.86, 0.83, 0.76], [0.6, 0.48, 0.22]);
      counter(L, 0, -3.8, 9, true, [0.35, 0.25, 0.18], [0.75, 0.7, 0.6]);
      for (const x of [-3, 0, 3]) {
        L.boxes.push({ x, y: 1.6, z: -3.8, sx: 2.6, sy: 1.1, sz: 0.04, c: [0.7, 0.8, 0.85], emit: 0.1 });
        L.slots.push({ x, z: -4.6, yaw: 0, pose: 'work', role: 'staff' });
      }
      for (const x of [-6.8, -5.4]) L.boxes.push({ x, y: 0.9, z: 5.6, sx: 0.9, sy: 1.8, sz: 0.8, c: [0.15, 0.35, 0.55], emit: 0.3, collide: true });
      for (const x of [-3, 3]) for (const z of [1, 3]) L.boxes.push({ x, y: 0.25, z, sx: 2, sy: 0.5, sz: 0.6, c: [0.3, 0.2, 0.15], collide: true });
      for (const [x, z] of [[-3, 1.4], [3, 3.4], [-2.5, 3.4]]) L.slots.push({ x, z, yaw: Math.PI, pose: 'sit', role: 'customer' });
      for (const x of [-7.3, 7.3]) for (const z of [-5, 0, 5]) L.cyls.push({ x, y: 0, z, r: 0.35, h: 4.6, c: [0.9, 0.88, 0.82], collide: true });
      for (const x of [-4, 0, 4]) pendant(L, x, 0, 0xffe0b0, [1, 0.9, 0.7]);
      L.stations.push({ id: 'teller', x: 0, z: -2.9, r: 2.4, label: 'Speak to a teller' });
      L.stations.push({ id: 'atm', x: -6.1, z: 4.8, r: 1.4, label: 'Use ATM' });
      L.stations.push({ id: 'jobboard', x: 4.2, z: -2.9, r: 1.0, label: 'Ask about work' });
      L.lights.push({ x: 0, y: 4.1, z: 0, color: 0xfff0d8, intensity: 32, distance: 18 });
      return L;
    }
    case 'dealership': {
      const L = base(22, 18, 6, [0.85, 0.85, 0.85], 'tile', [0.94, 0.94, 0.94], [0.8, 0.1, 0.1]);
      L.displayCars = [
        { x: -6, z: -3, yaw: 0.6, type: 0 },
        { x: 0, z: -4.5, yaw: 0, type: 1 },
        { x: 6, z: -3, yaw: -0.6, type: 2 },
        { x: -5, z: 3.5, yaw: 0.9, type: 3 },
        { x: 5, z: 3.5, yaw: -0.9, type: 5 },
      ];
      for (const c of L.displayCars) L.cyls.push({ x: c.x, y: 0, z: c.z, r: 3.1, h: 0.12, c: [0.3, 0.3, 0.32], collide: false });
      counter(L, 0, 6.8, 3.2, true, WHITE, [0.15, 0.15, 0.15]);
      L.slots.push({ x: 0, z: 7.6, yaw: Math.PI, pose: 'work', role: 'staff' }, { x: -2.5, z: 0.5, yaw: 0, pose: 'stand', role: 'staff' });
      for (const [x, z] of [[-3, -1], [3, 1.2]]) L.slots.push({ x, z, yaw: rng.range(0, 6), pose: 'browse', role: 'customer' });
      for (const c of L.displayCars) L.stations.push({ id: `car_${c.type}`, x: c.x, z: c.z, r: 3.2, label: 'View vehicle' });
      for (const x of [-6, 0, 6]) for (const z of [-4, 3]) ceilingPanel(L, x, z, 3, 0.5);
      L.stations.push({ id: 'jobboard', x: 1.6, z: 6.0, r: 1.0, label: 'Ask about work' });
      L.lights.push({ x: 0, y: 5.5, z: 0, color: 0xffffff, intensity: 45, distance: 26 }, { x: -6, y: 5, z: 0, color: 0xffffff, intensity: 22, distance: 16 }, { x: 6, y: 5, z: 0, color: 0xffffff, intensity: 22, distance: 16 });
      L.spawn = { x: 0, z: L.d / 2 - 1.8, yaw: Math.PI };
      return L;
    }
    case 'bar':
    case 'club': {
      const club = type === 'club';
      const L = base(club ? 20 : 13, club ? 16 : 11, club ? 5 : 3.6, club ? [0.08, 0.07, 0.1] : [0.3, 0.2, 0.14], club ? 'concrete' : 'wood', club ? [0.1, 0.09, 0.14] : [0.35, 0.22, 0.18], club ? [0.9, 0.2, 0.7] : [0.6, 0.4, 0.2]);
      counter(L, club ? -6 : -3, club ? -5.5 : -3.6, club ? 6 : 5.5, true, [0.15, 0.1, 0.08], club ? [0.15, 0.15, 0.2] : [0.5, 0.35, 0.2]);
      L.boxes.push({ x: club ? -6 : -3, y: 1.8, z: (club ? -5.5 : -3.6) - 1.2, sx: club ? 6 : 5.5, sy: 1.6, sz: 0.3, c: [0.25, 0.18, 0.1], emit: club ? 0.6 : 0.3 }); // bottle wall
      for (let k = 0; k < 4; k++) L.boxes.push({ x: (club ? -8 : -5) + k * 1.4, y: 0.4, z: (club ? -5.5 : -3.6) + 1.0, sx: 0.4, sy: 0.8, sz: 0.4, c: BLACK });
      for (let k = 0; k < 4; k++) L.slots.push({ x: (club ? -8 : -5) + k * 1.4, z: (club ? -5.5 : -3.6) + 1.0, yaw: Math.PI, pose: 'sit', role: 'customer' });
      L.slots.push({ x: club ? -6 : -3, z: (club ? -5.5 : -3.6) - 0.7, yaw: 0, pose: 'work', role: 'staff' });
      if (club) {
        L.boxes.push({ x: 4, y: 0.05, z: 0, sx: 8, sy: 0.1, sz: 8, c: [0.4, 0.2, 0.6], emit: 0.8 }); // dance floor
        L.boxes.push({ x: 4, y: 0.6, z: -6.5, sx: 3, sy: 1.2, sz: 1.2, c: BLACK, collide: true }); // DJ booth
        L.boxes.push({ x: 4, y: 1.3, z: -6.5, sx: 1.4, sy: 0.12, sz: 0.6, c: [0.2, 0.8, 1], emit: 2 });
        L.slots.push({ x: 4, z: -7.3, yaw: 0, pose: 'work', role: 'staff' });
        for (let k = 0; k < 14; k++) L.slots.push({ x: 4 + rng.range(-3.4, 3.4), z: rng.range(-3.4, 3.4), yaw: rng.range(0, 6), pose: 'dance', role: 'customer' });
        for (let k = 0; k < 6; k++) L.boxes.push({ x: rng.range(-2, 8), y: L.h - 0.1, z: rng.range(-5, 5), sx: 0.3, sy: 0.1, sz: 0.3, c: [rng.range(0.3, 1), rng.range(0.1, 0.6), rng.range(0.5, 1)], emit: 3 });
        L.stations.push({ id: 'dance', x: 4, z: 0, r: 4, label: 'Dance' });
        L.lights.push({ x: 4, y: 4.5, z: 0, color: 0xff40d0, intensity: 40, distance: 16 }, { x: -5, y: 4, z: -3, color: 0x4060ff, intensity: 25, distance: 14 });
        L.music = 'club';
      } else {
        for (const [x, z] of [[3, -1.5], [3, 2], [0, 2.5]]) table(L, x, z, true, 2, DARKWOOD);
        for (const [x, z] of [[3, -1.5], [3, 2], [0, 2.5]]) pendant(L, x, z, 0xffaa55, [1, 0.6, 0.3]);
        L.lights.push({ x: 0, y: 3, z: 0, color: 0xffa060, intensity: 16, distance: 12 });
        L.music = 'radio';
      }
      L.stations.push({ id: 'shop', x: club ? -6 : -3, z: (club ? -5.5 : -3.6) + 1.6, r: 2.0, label: 'Order a drink' });
      L.stations.push({ id: 'jobboard', x: (club ? -6 : -3) + 3.4, z: (club ? -5.5 : -3.6) + 1.2, r: 1.0, label: 'Ask about work' });
      return L;
    }
    case 'depot': {
      const L = base(22, 18, 7, [0.45, 0.45, 0.46], 'concrete', [0.6, 0.62, 0.6], [0.9, 0.5, 0.1]);
      for (const x of [-7, -2, 3]) for (const z of [-6, -2]) {
        L.boxes.push({ x, y: 1.6, z, sx: 4, sy: 3.2, sz: 1.2, c: [0.7, 0.4, 0.15], collide: true });
        for (let k = 0; k < 8; k++) L.boxes.push({ x: x - 1.6 + (k % 4) * 1.05, y: 0.4 + Math.floor(k / 4) * 1.4, z: z + 0.75, sx: 0.8, sy: 0.6, sz: 0.5, c: [0.62, 0.48, 0.3] });
      }
      counter(L, 6.5, 4.5, 3, false, [0.3, 0.3, 0.32]);
      L.boxes.push({ x: 7.2, y: 1.3, z: 4.5, sx: 0.05, sy: 0.5, sz: 0.8, c: BLACK, emit: 0.6 });
      L.slots.push({ x: 7.4, z: 4.5, yaw: -Math.PI / 2, pose: 'work', role: 'staff' });
      for (const [x, z] of [[-4, 2], [1, 3], [-6, 5]]) L.slots.push({ x, z, yaw: rng.range(0, 6), pose: 'stand', role: 'staff' });
      for (const x of [-6, 0, 6]) for (const z of [-4, 3]) ceilingPanel(L, x, z, 2, 0.3);
      L.stations.push({ id: 'dispatch', x: 5.4, z: 4.5, r: 1.8, label: 'Dispatcher' });
      L.lights.push({ x: 0, y: 6, z: 0, color: 0xf8f4e8, intensity: 40, distance: 24 });
      return L;
    }
    case 'hotel': {
      const L = base(18, 14, 6, [0.82, 0.78, 0.7], 'tile', [0.75, 0.68, 0.58], [0.6, 0.48, 0.2]);
      counter(L, 0, -4.5, 6, true, [0.3, 0.2, 0.12], [0.85, 0.8, 0.7]);
      L.slots.push({ x: -1.2, z: -5.3, yaw: 0, pose: 'work', role: 'staff' }, { x: 1.2, z: -5.3, yaw: 0, pose: 'work', role: 'staff' });
      for (const x of [-5, 5]) {
        L.boxes.push({ x, y: 0.3, z: 1.5, sx: 2.4, sy: 0.6, sz: 0.9, c: [0.55, 0.15, 0.15], collide: true });
        L.slots.push({ x, z: 1.5, yaw: Math.PI, pose: 'sit', role: 'customer' });
      }
      L.cyls.push({ x: 0, y: 0, z: 1, r: 1.2, h: 0.5, c: [0.4, 0.38, 0.35], collide: true });
      plant(L, -8, 5.5);
      plant(L, 8, 5.5);
      L.cyls.push({ x: 0, y: L.h - 1.3, z: 0, r: 1.0, h: 0.5, c: [1, 0.9, 0.7], emit: 2.2 }); // chandelier
      L.stations.push({ id: 'reception', x: 0, z: -3.6, r: 2.0, label: 'Front desk' });
      L.lights.push({ x: 0, y: 5, z: 0, color: 0xffe6c0, intensity: 40, distance: 20 });
      return L;
    }
    case 'gym': {
      const L = base(16, 14, 4.2, [0.18, 0.18, 0.2], 'concrete', [0.3, 0.32, 0.36], [0.95, 0.3, 0.15]);
      for (let k = 0; k < 4; k++) {
        L.boxes.push({ x: -5 + k * 2.4, y: 0.5, z: -4.5, sx: 0.8, sy: 1.0, sz: 2.0, c: BLACK, collide: true }); // treadmills
        L.slots.push({ x: -5 + k * 2.4, z: -4.5, yaw: Math.PI, pose: 'stand', role: 'customer' });
      }
      for (const x of [-4, 0, 4]) L.boxes.push({ x, y: 0.45, z: 1.5, sx: 1.8, sy: 0.15, sz: 0.5, c: [0.6, 0.1, 0.1], collide: true });
      L.boxes.push({ x: 6.8, y: 1.2, z: 0, sx: 0.06, sy: 2.0, sz: 6, c: [0.75, 0.85, 0.95], emit: 0.2 });
      counter(L, 4.5, 4.8, 3, true, [0.12, 0.12, 0.14]);
      L.slots.push({ x: 4.5, z: 4.0, yaw: Math.PI, pose: 'work', role: 'staff' });
      for (const x of [-4, 0, 4]) ceilingPanel(L, x, 0, 2.5, 0.4);
      L.stations.push({ id: 'shop', x: 4.5, z: 5.8, r: 1.6, label: 'Front desk' });
      L.stations.push({ id: 'workout', x: 0, z: 1.5, r: 3.0, label: 'Work out' });
      L.lights.push({ x: 0, y: 3.8, z: 0, color: 0xf0f6ff, intensity: 28, distance: 16 });
      L.music = 'club';
      return L;
    }
    case 'cinema': {
      const L = base(16, 12, 5, [0.25, 0.08, 0.1], 'carpet', [0.2, 0.12, 0.14], [0.9, 0.7, 0.2]);
      counter(L, -3, -3.6, 5, true, [0.6, 0.1, 0.1], [0.9, 0.85, 0.7]);
      L.boxes.push({ x: -3, y: 2.6, z: -5.6, sx: 5, sy: 1.4, sz: 0.1, c: [1, 0.85, 0.4], emit: 1.4 });
      L.slots.push({ x: -3, z: -4.4, yaw: 0, pose: 'work', role: 'staff' });
      for (const x of [3, 5.5]) L.boxes.push({ x, y: 1.4, z: -5.7, sx: 1.6, sy: 2.4, sz: 0.06, c: [rng.range(0.3, 1), rng.range(0.2, 0.7), rng.range(0.4, 1)], emit: 0.8 }); // posters
      for (const [x, z] of [[2, 1], [-2, 2], [4, 3]]) L.slots.push({ x, z, yaw: rng.range(0, 6), pose: 'stand', role: 'customer' });
      L.stations.push({ id: 'shop', x: -3, z: -2.7, r: 1.8, label: 'Box office' });
      L.lights.push({ x: 0, y: 4.4, z: 0, color: 0xffc070, intensity: 26, distance: 16 });
      return L;
    }
    case 'apartment':
    default: {
      const tier = opts.homeTier ?? 0;
      const up = opts.upgrades ?? [];
      const big = tier >= 1;
      const L = base(big ? 12 : 8, big ? 10 : 7, tier >= 2 ? 3.6 : 2.8, tier >= 2 ? [0.62, 0.5, 0.38] : [0.42, 0.3, 0.2], 'wood', tier >= 2 ? [0.9, 0.9, 0.88] : [0.78, 0.74, 0.66], [0.3, 0.4, 0.5]);
      const hw = L.w / 2;
      const hd = L.d / 2;
      // bed
      const bedX = -hw + 1.3;
      const bedZ = -hd + 1.6;
      L.boxes.push({ x: bedX, y: 0.25, z: bedZ, sx: 1.8, sy: 0.5, sz: 2.2, c: DARKWOOD, collide: true });
      L.boxes.push({ x: bedX, y: 0.55, z: bedZ + 0.1, sx: 1.7, sy: 0.12, sz: 2.0, c: up.includes('bed') ? [0.85, 0.85, 0.95] : [0.6, 0.62, 0.7] });
      L.boxes.push({ x: bedX, y: 0.65, z: bedZ - 0.8, sx: 1.4, sy: 0.15, sz: 0.4, c: WHITE });
      L.stations.push({ id: 'bed', x: bedX + 1.3, z: bedZ, r: 1.6, label: 'Sleep', sub: 'Rest and save your game' });
      // wardrobe
      L.boxes.push({ x: hw - 0.4, y: 1.0, z: -hd + 1.2, sx: 0.6, sy: 2.0, sz: 1.6, c: [0.55, 0.45, 0.35], collide: true });
      L.stations.push({ id: 'wardrobe', x: hw - 1.3, z: -hd + 1.2, r: 1.3, label: 'Wardrobe', sub: 'Change outfit' });
      // kitchenette & fridge
      L.boxes.push({ x: hw - 0.35, y: 0.9, z: 0.6, sx: 0.7, sy: 1.8, sz: 0.7, c: [0.88, 0.88, 0.9], collide: true });
      counter(L, hw - 0.4, 2.0, 1.6, false, [0.9, 0.9, 0.9], [0.2, 0.2, 0.22]);
      L.stations.push({ id: 'fridge', x: hw - 1.3, z: 1.2, r: 1.3, label: 'Kitchen', sub: 'Eat something' });
      // sofa + tv
      L.boxes.push({ x: -0.5, y: 0.25, z: 1.2, sx: 2.2, sy: 0.5, sz: 0.8, c: [0.25, 0.32, 0.45], collide: true });
      L.boxes.push({ x: -0.5, y: 0.65, z: 1.55, sx: 2.2, sy: 0.5, sz: 0.2, c: [0.25, 0.32, 0.45] });
      if (up.includes('tv')) {
        L.boxes.push({ x: -0.5, y: 1.3, z: -hd + 0.1, sx: 1.8, sy: 1.0, sz: 0.06, c: BLACK, emit: 0.5 });
        L.stations.push({ id: 'tv', x: -0.5, z: 0.2, r: 1.4, label: 'Watch TV', sub: 'News and relaxation' });
      }
      if (up.includes('pc')) {
        L.boxes.push({ x: -hw + 0.5, y: 0.4, z: 1.8, sx: 0.8, sy: 0.8, sz: 1.4, c: WHITE, collide: true });
        L.boxes.push({ x: -hw + 0.35, y: 1.05, z: 1.8, sx: 0.04, sy: 0.4, sz: 0.7, c: BLACK, emit: 0.8 });
        L.stations.push({ id: 'pc', x: -hw + 1.3, z: 1.8, r: 1.2, label: 'Workstation', sub: 'Freelance gigs' });
      }
      if (up.includes('decor')) {
        plant(L, hw - 0.6, hd - 0.7);
        L.boxes.push({ x: -hw + 0.05, y: 1.6, z: 0, sx: 0.04, sy: 0.9, sz: 1.3, c: [0.8, 0.4, 0.2], emit: 0.15 });
      }
      L.boxes.push({ x: 0, y: L.h - 0.04, z: 0, sx: 0.8, sy: 0.05, sz: 0.8, c: [1, 0.95, 0.85], emit: 1.6 });
      L.lights.push({ x: 0, y: L.h - 0.3, z: 0, color: 0xffd8a8, intensity: 10, distance: 10 });
      L.windowGlow = [0.6, 0.7, 0.85];
      return L;
    }
  }
}
