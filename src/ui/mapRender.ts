import type { CityData } from '../world/types';
import { DISTRICT_INFO, SW } from '../world/types';
import { PLATFORM } from '../world/CityGenerator';

/** Map image space: 1 pixel = SCALE meters, origin at -EXTENT. */
export const MAP_EXTENT = 680;
export const MAP_PX = 1360; // 1 px per metre

let cache: { seed: number; canvas: HTMLCanvasElement } | null = null;

export function worldToMap(x: number, z: number) {
  return { u: ((x + MAP_EXTENT) / (MAP_EXTENT * 2)) * MAP_PX, v: ((z + MAP_EXTENT) / (MAP_EXTENT * 2)) * MAP_PX };
}

export function getMapCanvas(c: CityData): HTMLCanvasElement {
  if (cache && cache.seed === c.seed) return cache.canvas;
  const cv = document.createElement('canvas');
  cv.width = MAP_PX;
  cv.height = MAP_PX;
  const g = cv.getContext('2d')!;
  const k = MAP_PX / (MAP_EXTENT * 2);
  const X = (x: number) => (x + MAP_EXTENT) * k;
  const Z = (z: number) => (z + MAP_EXTENT) * k;
  // water & land
  g.fillStyle = '#0c2733';
  g.fillRect(0, 0, MAP_PX, MAP_PX);
  g.fillStyle = '#1b2a1f';
  g.fillRect(0, 0, X(PLATFORM), MAP_PX);
  g.fillStyle = '#1e2732';
  g.fillRect(X(-PLATFORM), Z(-PLATFORM), (PLATFORM * 2 - 2) * k, PLATFORM * 2 * k);
  // blocks tinted by district
  for (const b of c.blocks) {
    const base = DISTRICT_INFO[b.district].color;
    g.fillStyle = b.use === 'park' ? '#25472c' : b.use === 'plaza' ? '#4a4338' : b.use === 'parking' ? '#2c3038' : mix(base, '#1a2029', 0.78);
    g.fillRect(X(b.x0 - SW), Z(b.z0 - SW), (b.x1 - b.x0 + SW * 2) * k, (b.z1 - b.z0 + SW * 2) * k);
  }
  // buildings
  for (const bd of c.buildings) {
    const h = bd.height;
    const l = Math.min(1, h / 140);
    g.fillStyle = `rgba(${150 + l * 70},${158 + l * 70},${172 + l * 60},${0.55 + l * 0.35})`;
    g.fillRect(X(bd.x0), Z(bd.z0), (bd.x1 - bd.x0) * k, (bd.z1 - bd.z0) * k);
  }
  // roads
  g.fillStyle = '#3b4250';
  for (const s of c.segments) {
    if (!s.exists) continue;
    if (s.orient === 'v') g.fillRect(X(s.x0 - s.hw), Z(s.z0 - 10), s.hw * 2 * k, (s.z1 - s.z0 + 20) * k);
    else g.fillRect(X(s.x0 - 10), Z(s.z0 - s.hw), (s.x1 - s.x0 + 20) * k, s.hw * 2 * k);
  }
  for (const it of c.intersections) g.fillRect(X(it.x - it.hx), Z(it.z - it.hz), it.hx * 2 * k, it.hz * 2 * k);
  g.fillStyle = '#5b6373';
  for (const s of c.segments) {
    if (!s.exists || s.cls !== 'arterial') continue;
    if (s.orient === 'v') g.fillRect(X(s.x0 - 0.6), Z(s.z0), 1.2 * k, (s.z1 - s.z0) * k);
    else g.fillRect(X(s.x0), Z(s.z0 - 0.6), (s.x1 - s.x0) * k, 1.2 * k);
  }
  cache = { seed: c.seed, canvas: cv };
  return cv;
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${gg},${bl})`;
}

export const POI_ICONS: Record<string, { color: string; glyph: string }> = {
  cafe: { color: '#c48a5a', glyph: '☕' },
  restaurant: { color: '#e0705a', glyph: '🍴' },
  fastfood: { color: '#e09a4a', glyph: '🍔' },
  grocery: { color: '#7ac46a', glyph: '🛒' },
  convenience: { color: '#7ac46a', glyph: '🏪' },
  clothing: { color: '#c46ab8', glyph: '👕' },
  bank: { color: '#e7c66b', glyph: '$' },
  dealership: { color: '#ff5a5a', glyph: '🚗' },
  bar: { color: '#b07ae0', glyph: '🍸' },
  nightclub: { color: '#ff5ac8', glyph: '♫' },
  hotel: { color: '#8ab4ff', glyph: 'H' },
  depot: { color: '#ffb35a', glyph: '📦' },
  taxi: { color: '#f7c21b', glyph: '🚕' },
  gym: { color: '#ff7a3a', glyph: '💪' },
  cinema: { color: '#ffd04a', glyph: '🎬' },
  home: { color: '#57e3d6', glyph: '⌂' },
};
