// Talking to a host page that embeds the game (for example a classifieds site's Garage).
//
// In:  the player's vehicles, either in the URL fragment (#garage=<base64url JSON>) or by
//      postMessage({ type: 'garage:vehicles', vehicles, progress? }) from an allowed origin.
// Out: postMessage events to the parent page: ready, progress (to save on the account),
//      run (a finished run), parts / services (open the host's listings for this car).
//
// Allowed origins come from VITE_GARAGE_ORIGINS (comma separated) at build time; the page's own
// origin is always allowed. Nothing is posted unless the game is actually framed by an allowed origin.
import { parseVehicle, GarageVehicle } from './vehicle';
import { GarageSave, sanitizeSave } from './progress';

export interface GarageImport {
  vehicles: GarageVehicle[];
  progress: GarageSave | null;
}

export type HostEvent =
  | { type: 'mygarage:ready'; version: 1 }
  | { type: 'mygarage:progress'; save: GarageSave }
  | { type: 'mygarage:run'; vehicleId: string; mode: 'score' | 'highway' | 'chase' | 'race'; score: number; coins: number; health: number; won?: boolean }
  | { type: 'mygarage:parts'; vehicleId: string; make: string; model: string; year?: number; category: string }
  | { type: 'mygarage:services'; vehicleId: string; make: string; model: string; year?: number; category: 'repair' };

const MAX_VEHICLES = 10;

function allowedOrigins(): string[] {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GARAGE_ORIGINS ?? '';
  const list = env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (typeof location !== 'undefined') list.push(location.origin);
  return list;
}

/** vehicles and progress from an untrusted payload (hash or message) */
export function parseImport(raw: unknown): GarageImport | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.vehicles) ? o.vehicles : Array.isArray(raw) ? (raw as unknown[]) : o.make ? [o] : [];
  const vehicles = list
    .slice(0, MAX_VEHICLES)
    .map((v) => parseVehicle(v, 'host'))
    .filter((v): v is GarageVehicle => v !== null);
  // ids must be unique for the picker and for saved progress
  const seen = new Set<string>();
  for (const v of vehicles) {
    while (seen.has(v.id)) v.id = `${v.id}-2`.slice(-64);
    seen.add(v.id);
  }
  if (!vehicles.length) return null;
  return { vehicles, progress: o.progress ? sanitizeSave(o.progress) : null };
}

/** base64url (UTF-8) of a JSON value, for building #garage= links */
export function encodeGarage(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeGarage(s: string): unknown {
  if (s.length > 20000) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** #garage=... in the page URL */
export function readHash(hash = typeof location !== 'undefined' ? location.hash : ''): GarageImport | null {
  const m = /[#&]garage=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? parseImport(decodeGarage(m[1])) : null;
}

export class HostBridge {
  /** the origin of the parent page, once it has proven itself by sending us vehicles */
  private hostOrigin: string | null = null;
  private allowed = allowedOrigins();

  constructor(private onImport: (g: GarageImport) => void) {}

  get connected() {
    return this.hostOrigin !== null;
  }

  start() {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', this.onMessage);
    const g = readHash();
    if (g) this.onImport(g);
    // the host may also swap the fragment on a page that is already open
    window.addEventListener('hashchange', () => {
      const h = readHash();
      if (h) this.onImport(h);
    });
    // tell an embedding page we are listening; a specific origin only, never '*'
    if (window.parent !== window) {
      for (const o of this.allowed) {
        try {
          window.parent.postMessage({ type: 'mygarage:ready', version: 1 } satisfies HostEvent, o);
        } catch {
          /* not that origin */
        }
      }
    }
  }

  private onMessage = (e: MessageEvent) => {
    if (!this.allowed.includes(e.origin)) return;
    const d = e.data as { type?: unknown } | null;
    if (!d || typeof d !== 'object' || d.type !== 'garage:vehicles') return;
    const g = parseImport(d);
    if (!g) return;
    if (e.source === window.parent && e.origin !== location.origin) this.hostOrigin = e.origin;
    this.onImport(g);
  };

  send(ev: HostEvent) {
    if (!this.hostOrigin || typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage(ev, this.hostOrigin);
  }
}
