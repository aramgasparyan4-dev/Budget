import { fbm2, valueNoise2 } from '../core/rng';
import { smoothstep } from '../core/math';
import { PLATFORM } from './CityGenerator';

export const WATER_Y = -1.6;
export const TERRAIN_EXTENT = 2200;

/** Height of the natural terrain around the flat city platform. */
export function terrainHeight(x: number, z: number, seed = 0): number {
  const P = PLATFORM;
  if (x > -P && x < P && z > -P && z < P) return 0;
  const outW = Math.max(-P - x, 0);
  const outN = Math.max(-P - z, 0);
  const outS = Math.max(z - P, 0);
  const outNS = Math.max(outN, outS);
  const out = Math.hypot(outW, outNS);
  const n = fbm2(x / 380 + 3.3, z / 380 - 1.7, seed + 5, 5);
  const ridge = 1 - Math.abs(valueNoise2(x / 600, z / 600, seed + 9) * 2 - 1);
  let hill = smoothstep(0, 240, out) * (30 + 95 * n + 60 * ridge * smoothstep(250, 700, out)) + smoothstep(0, 30, out) * 1.5;
  hill += (fbm2(x / 40, z / 40, seed + 11, 3) - 0.5) * 3 * smoothstep(20, 120, out);
  if (x > P - 4) {
    // bay to the east; headlands to the north/south
    const bay = smoothstep(P - 4, P + 25, x) * (1 - smoothstep(40, 300, outNS - (x - P) * 0.15));
    const seabed = -10 - smoothstep(P, P + 900, x) * 25;
    hill = hill * (1 - bay) + seabed * bay;
  }
  return hill;
}
