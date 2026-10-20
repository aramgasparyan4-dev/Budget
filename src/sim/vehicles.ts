// Vehicle catalogue: dimensions for rendering/physics and handling for driving.

export interface VehicleSpec {
  id: number;
  key: string;
  name: string;
  length: number;
  width: number;
  height: number;
  wheelBase: number;
  track: number;
  wheelRadius: number;
  mass: number;
  engine: number; // engine force (N)
  maxSpeed: number; // m/s
  brake: number;
  steer: number; // max steering angle (rad)
  grip: number; // friction slip
  suspension: number; // stiffness
  price: number;
  seats: number;
  palette: number[];
  traffic: number; // spawn weight in traffic
  cruise: number; // traffic desired speed multiplier
  /** body shape to build (defaults to key) */
  model?: string;
  /** driven wheels (defaults by key: sports/truck/bus/police rear, suv all, the rest front) */
  drive?: 'fwd' | 'rwd' | 'awd';
  /** full engine force up to this fraction of top speed (default 0.32; electric motors hold it longer) */
  torqueKnee?: number;
}

export const VEHICLES: VehicleSpec[] = [
  {
    id: 0, key: 'compact', name: 'Pixie Compact', length: 3.9, width: 1.76, height: 1.5, wheelBase: 2.5, track: 1.5, wheelRadius: 0.31,
    mass: 1050, engine: 4200, maxSpeed: 41, brake: 38, steer: 0.62, grip: 2.2, suspension: 30, price: 4200, seats: 4,
    palette: [0xc8102e, 0xf2f2f2, 0x2a6fdb, 0x2e2e33, 0xf4b400, 0x6db33f, 0x9aa0a6], traffic: 3, cruise: 0.95,
  },
  {
    id: 1, key: 'sedan', name: 'Meridian Sedan', length: 4.65, width: 1.86, height: 1.46, wheelBase: 2.8, track: 1.6, wheelRadius: 0.34,
    mass: 1400, engine: 5600, maxSpeed: 50, brake: 46, steer: 0.58, grip: 2.35, suspension: 32, price: 11500, seats: 5,
    palette: [0x1c1c1f, 0xe8e8e8, 0x8a8f96, 0x1f3b6d, 0x6d1a1f, 0x3b4a3f, 0xb7b2a6], traffic: 5, cruise: 1,
  },
  {
    id: 2, key: 'suv', name: 'Summit SUV', length: 4.85, width: 1.98, height: 1.78, wheelBase: 2.9, track: 1.68, wheelRadius: 0.39,
    mass: 2000, engine: 7200, maxSpeed: 46, brake: 52, steer: 0.55, grip: 2.25, suspension: 34, price: 21000, seats: 7,
    palette: [0x111214, 0xf0f0ee, 0x5b6770, 0x23402e, 0x7a1c1c, 0x2b3a55], traffic: 4, cruise: 0.98,
  },
  {
    id: 3, key: 'sports', name: 'Volta GT', length: 4.45, width: 1.96, height: 1.2, wheelBase: 2.65, track: 1.66, wheelRadius: 0.35,
    mass: 1350, engine: 10500, maxSpeed: 76, brake: 62, steer: 0.55, grip: 2.9, suspension: 42, price: 68000, seats: 2,
    palette: [0xd21f1f, 0xffb000, 0x1a1a1a, 0x0f64d2, 0xf2f2f2, 0x18a558], traffic: 0.6, cruise: 1.12,
  },
  {
    id: 4, key: 'taxi', name: 'Echo Cab', length: 4.65, width: 1.86, height: 1.46, wheelBase: 2.8, track: 1.6, wheelRadius: 0.34,
    mass: 1450, engine: 5600, maxSpeed: 48, brake: 46, steer: 0.58, grip: 2.35, suspension: 32, price: 9000, seats: 5,
    palette: [0xf7c21b], traffic: 1.6, cruise: 1.04,
  },
  {
    id: 5, key: 'van', name: 'Courier Van', length: 5.3, width: 2.0, height: 2.35, wheelBase: 3.3, track: 1.72, wheelRadius: 0.36,
    mass: 2400, engine: 7000, maxSpeed: 38, brake: 50, steer: 0.55, grip: 2.1, suspension: 36, price: 16000, seats: 2,
    palette: [0xf2f2f2, 0xe6e6e6, 0x2f5fa7, 0xc93a2c], traffic: 1.5, cruise: 0.9,
  },
  {
    id: 6, key: 'truck', name: 'Box Truck', length: 7.4, width: 2.35, height: 3.1, wheelBase: 4.4, track: 1.9, wheelRadius: 0.46,
    mass: 5200, engine: 11000, maxSpeed: 30, brake: 60, steer: 0.5, grip: 2.0, suspension: 48, price: 32000, seats: 2,
    palette: [0xffffff, 0xd9d9d9, 0x1f4e8c, 0x9c2b23], traffic: 0.7, cruise: 0.82,
  },
  {
    id: 7, key: 'bus', name: 'City Bus', length: 11.5, width: 2.5, height: 3.1, wheelBase: 6.6, track: 2.05, wheelRadius: 0.5,
    mass: 11000, engine: 16000, maxSpeed: 24, brake: 70, steer: 0.5, grip: 2.0, suspension: 60, price: 0, seats: 40,
    palette: [0x1fa38a], traffic: 0.5, cruise: 0.8,
  },
  {
    id: 8, key: 'police', name: 'Patrol Cruiser', length: 4.75, width: 1.88, height: 1.5, wheelBase: 2.85, track: 1.62, wheelRadius: 0.35,
    mass: 1600, engine: 7600, maxSpeed: 58, brake: 54, steer: 0.58, grip: 2.5, suspension: 36, price: 0, seats: 4,
    palette: [0x111827], traffic: 0, cruise: 1,
  },
  // Near Miss garage archetypes: player cars only (never in traffic). See src/mygarage/garage/archetypes.ts.
  {
    id: 9, key: 'g_compact', model: 'compact', name: 'City compact', length: 3.9, width: 1.74, height: 1.5, wheelBase: 2.5, track: 1.5, wheelRadius: 0.31,
    mass: 1050, engine: 4800, maxSpeed: 45, brake: 42, steer: 0.64, grip: 2.35, suspension: 30, price: 0, seats: 4, drive: 'fwd',
    palette: [0x2a6fdb], traffic: 0, cruise: 1,
  },
  {
    id: 10, key: 'g_sedan', model: 'sedan', name: 'Family sedan', length: 4.7, width: 1.82, height: 1.46, wheelBase: 2.75, track: 1.58, wheelRadius: 0.34,
    mass: 1400, engine: 6400, maxSpeed: 53, brake: 48, steer: 0.58, grip: 2.45, suspension: 32, price: 0, seats: 5, drive: 'fwd',
    palette: [0x8a8f96], traffic: 0, cruise: 1,
  },
  {
    id: 11, key: 'g_exec', model: 'exec', name: 'Executive', length: 5.0, width: 1.9, height: 1.46, wheelBase: 3.0, track: 1.64, wheelRadius: 0.36,
    mass: 1750, engine: 9400, maxSpeed: 66, brake: 58, steer: 0.54, grip: 2.6, suspension: 36, price: 0, seats: 5, drive: 'rwd',
    palette: [0x1c1c1f], traffic: 0, cruise: 1,
  },
  {
    id: 12, key: 'g_sports', model: 'sports', name: 'Sports coupe', length: 4.45, width: 1.96, height: 1.2, wheelBase: 2.65, track: 1.66, wheelRadius: 0.35,
    mass: 1350, engine: 10500, maxSpeed: 76, brake: 62, steer: 0.55, grip: 2.9, suspension: 42, price: 0, seats: 2, drive: 'rwd',
    palette: [0xd21f1f], traffic: 0, cruise: 1,
  },
  {
    id: 13, key: 'g_hatch', model: 'hatch', name: 'Hot hatch', length: 4.25, width: 1.8, height: 1.42, wheelBase: 2.62, track: 1.56, wheelRadius: 0.33,
    mass: 1250, engine: 8000, maxSpeed: 60, brake: 54, steer: 0.66, grip: 2.7, suspension: 38, price: 0, seats: 5, drive: 'fwd',
    palette: [0xf2f2f2], traffic: 0, cruise: 1,
  },
  {
    id: 14, key: 'g_crossover', model: 'suv', name: 'Crossover', length: 4.6, width: 1.86, height: 1.66, wheelBase: 2.7, track: 1.6, wheelRadius: 0.37,
    mass: 1600, engine: 7200, maxSpeed: 53, brake: 50, steer: 0.57, grip: 2.5, suspension: 34, price: 0, seats: 5, drive: 'awd',
    palette: [0x5b6770], traffic: 0, cruise: 1,
  },
  {
    id: 15, key: 'g_offroad', model: 'offroad', name: 'Off-roader', length: 4.8, width: 1.95, height: 1.9, wheelBase: 2.85, track: 1.66, wheelRadius: 0.42,
    mass: 2300, engine: 9400, maxSpeed: 48, brake: 56, steer: 0.54, grip: 2.4, suspension: 36, price: 0, seats: 5, drive: 'awd',
    palette: [0x23402e], traffic: 0, cruise: 1,
  },
  {
    id: 16, key: 'g_utility', model: 'pickup', name: 'Pickup / van', length: 5.3, width: 1.9, height: 1.8, wheelBase: 3.1, track: 1.62, wheelRadius: 0.4,
    mass: 2100, engine: 8200, maxSpeed: 48, brake: 52, steer: 0.53, grip: 2.3, suspension: 36, price: 0, seats: 3, drive: 'rwd',
    palette: [0xf2f2f2], traffic: 0, cruise: 1,
  },
  {
    id: 17, key: 'g_ev', model: 'ev', name: 'Electric', length: 4.7, width: 1.88, height: 1.44, wheelBase: 2.88, track: 1.62, wheelRadius: 0.35,
    mass: 1850, engine: 15400, maxSpeed: 62, brake: 56, steer: 0.57, grip: 2.6, suspension: 36, price: 0, seats: 5, drive: 'awd', torqueKnee: 0.5,
    palette: [0xe8e8e8], traffic: 0, cruise: 1,
  },
  {
    id: 18, key: 'g_classic', model: 'classic', name: 'Classic', length: 4.15, width: 1.62, height: 1.44, wheelBase: 2.42, track: 1.36, wheelRadius: 0.33,
    mass: 1050, engine: 4300, maxSpeed: 42, brake: 34, steer: 0.6, grip: 2.15, suspension: 28, price: 0, seats: 5, drive: 'rwd',
    palette: [0xb7b2a6], traffic: 0, cruise: 1,
  },
];

export const DEALERSHIP_STOCK = [0, 1, 2, 3, 5];

export function pickTrafficType(r: number): number {
  let total = 0;
  for (const v of VEHICLES) total += v.traffic;
  let x = r * total;
  for (const v of VEHICLES) {
    x -= v.traffic;
    if (x <= 0) return v.id;
  }
  return 1;
}
