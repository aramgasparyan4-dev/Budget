/// <reference lib="webworker" />
// Builds chunk geometry off the main thread. The worker regenerates the city
// from the seed (deterministic), so only a number crosses the boundary on init.
import { generateCity } from './CityGenerator';
import { buildChunkBase, buildChunkDetail } from './chunkGeometry';
import type { CityData } from './types';
import type { GeometryData } from '../render/MeshBuilder';

let city: CityData | null = null;

function transferables(...gs: (GeometryData | null)[]): Transferable[] {
  const out: Transferable[] = [];
  for (const g of gs) {
    if (!g) continue;
    for (const a of Object.values(g.attrs)) out.push(a.array.buffer);
    out.push(g.index.buffer);
  }
  return out;
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    city = generateCity(msg.seed);
    (self as unknown as Worker).postMessage({ type: 'ready', seed: msg.seed });
    return;
  }
  if (!city) return;
  if (msg.type === 'base') {
    const r = buildChunkBase(city, msg.chunk);
    (self as unknown as Worker).postMessage({ type: 'base', data: r }, transferables(r.buildings, r.ground, r.overlay));
  } else if (msg.type === 'detail') {
    const r = buildChunkDetail(city, msg.chunk);
    (self as unknown as Worker).postMessage({ type: 'detail', data: r }, transferables(r.markings, r.details));
  }
};
