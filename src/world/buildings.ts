import { RNG } from '../core/rng';
import { clamp, pointSegment } from '../core/math';
import { businessName } from './names';
import {
  Block,
  BoxPart,
  Building,
  BuildingKind,
  BusinessDef,
  BusinessType,
  CityData,
  DISTRICT_INFO,
  DistrictId,
  Facade,
  GroundKind,
  InteriorType,
  JobSlot,
  CURB_H,
  Prop,
} from './types';

type RGB = [number, number, number];

interface Helpers {
  segV: number[][];
  segH: number[][];
  segSideEdge: [number, number][];
  addGround: (x0: number, x1: number, z0: number, z1: number, y: number, kind: GroundKind) => void;
  addProp: (type: Prop['type'], x: number, z: number, rot?: number, scale?: number, y?: number, ref?: number, ref2?: number) => void;
  ch: (x: number, z: number) => number;
}

const PAL = {
  glass: [
    [0.22, 0.36, 0.46],
    [0.16, 0.26, 0.34],
    [0.26, 0.4, 0.42],
    [0.2, 0.3, 0.42],
    [0.32, 0.4, 0.5],
    [0.24, 0.3, 0.28],
    [0.3, 0.34, 0.4],
  ] as RGB[],
  frame: [
    [0.62, 0.64, 0.66],
    [0.42, 0.44, 0.47],
    [0.75, 0.74, 0.7],
    [0.3, 0.32, 0.35],
  ] as RGB[],
  concrete: [
    [0.66, 0.64, 0.6],
    [0.55, 0.56, 0.58],
    [0.72, 0.68, 0.6],
    [0.45, 0.46, 0.49],
    [0.6, 0.55, 0.48],
    [0.38, 0.4, 0.44],
    [0.7, 0.62, 0.52],
  ] as RGB[],
  brick: [
    [0.56, 0.28, 0.21],
    [0.63, 0.36, 0.26],
    [0.46, 0.26, 0.21],
    [0.69, 0.47, 0.36],
    [0.52, 0.33, 0.29],
    [0.4, 0.3, 0.28],
  ] as RGB[],
  plaster: [
    [0.88, 0.84, 0.76],
    [0.8, 0.73, 0.62],
    [0.74, 0.8, 0.82],
    [0.87, 0.77, 0.69],
    [0.72, 0.76, 0.69],
    [0.92, 0.9, 0.86],
    [0.84, 0.66, 0.56],
  ] as RGB[],
  siding: [
    [0.84, 0.8, 0.67],
    [0.66, 0.77, 0.84],
    [0.88, 0.88, 0.85],
    [0.74, 0.82, 0.7],
    [0.9, 0.77, 0.72],
    [0.63, 0.63, 0.68],
    [0.82, 0.72, 0.56],
    [0.95, 0.93, 0.88],
  ] as RGB[],
  tile: [
    [0.36, 0.22, 0.18],
    [0.28, 0.28, 0.31],
    [0.44, 0.3, 0.22],
    [0.25, 0.3, 0.36],
    [0.5, 0.26, 0.2],
  ] as RGB[],
  industrial: [
    [0.56, 0.59, 0.61],
    [0.46, 0.52, 0.57],
    [0.62, 0.57, 0.46],
    [0.36, 0.47, 0.52],
    [0.62, 0.37, 0.31],
    [0.7, 0.7, 0.68],
  ] as RGB[],
  club: [
    [0.13, 0.11, 0.16],
    [0.16, 0.12, 0.22],
    [0.1, 0.12, 0.16],
  ] as RGB[],
  roof: [
    [0.36, 0.36, 0.37],
    [0.43, 0.42, 0.41],
    [0.31, 0.32, 0.34],
    [0.5, 0.5, 0.5],
  ] as RGB[],
};

interface JobTemplate {
  role: string;
  count: [number, number];
  wage: [number, number];
  start: number;
  end: number;
  days?: number[];
}
const WEEKDAYS = [0, 1, 2, 3, 4];
const ALLDAYS = [0, 1, 2, 3, 4, 5, 6];
const JOBS: Partial<Record<BusinessType, JobTemplate[]>> = {
  cafe: [
    { role: 'Barista', count: [1, 2], wage: [15, 18], start: 7, end: 15 },
    { role: 'Barista', count: [1, 1], wage: [15, 18], start: 12, end: 20 },
    { role: 'Cafe Manager', count: [1, 1], wage: [22, 26], start: 8, end: 16, days: WEEKDAYS },
  ],
  restaurant: [
    { role: 'Chef', count: [1, 2], wage: [20, 28], start: 11, end: 22 },
    { role: 'Server', count: [1, 3], wage: [14, 17], start: 11, end: 17 },
    { role: 'Server', count: [1, 2], wage: [14, 17], start: 17, end: 23 },
    { role: 'Restaurant Manager', count: [1, 1], wage: [26, 32], start: 12, end: 22, days: [1, 2, 3, 4, 5] },
  ],
  fastfood: [
    { role: 'Line Cook', count: [1, 2], wage: [14, 16], start: 10, end: 18 },
    { role: 'Cashier', count: [1, 2], wage: [13, 15], start: 14, end: 22 },
  ],
  grocery: [
    { role: 'Cashier', count: [1, 2], wage: [14, 16], start: 8, end: 16 },
    { role: 'Stock Clerk', count: [1, 2], wage: [14, 17], start: 6, end: 14 },
    { role: 'Cashier', count: [1, 1], wage: [15, 17], start: 16, end: 24 },
  ],
  convenience: [
    { role: 'Clerk', count: [1, 1], wage: [13, 15], start: 7, end: 15 },
    { role: 'Clerk', count: [1, 1], wage: [14, 16], start: 15, end: 23 },
  ],
  clothing: [
    { role: 'Sales Associate', count: [1, 3], wage: [15, 18], start: 10, end: 19 },
    { role: 'Store Manager', count: [1, 1], wage: [24, 30], start: 9, end: 18, days: WEEKDAYS },
  ],
  electronics: [{ role: 'Sales Associate', count: [1, 2], wage: [16, 20], start: 10, end: 19 }],
  bookstore: [{ role: 'Bookseller', count: [1, 2], wage: [14, 16], start: 10, end: 19 }],
  pharmacy: [
    { role: 'Pharmacist', count: [1, 1], wage: [42, 50], start: 9, end: 18, days: WEEKDAYS },
    { role: 'Pharmacy Clerk', count: [1, 1], wage: [15, 17], start: 9, end: 19 },
  ],
  office: [
    { role: 'Software Engineer', count: [1, 4], wage: [45, 70], start: 9, end: 17, days: WEEKDAYS },
    { role: 'Analyst', count: [1, 3], wage: [32, 45], start: 9, end: 17, days: WEEKDAYS },
    { role: 'Accountant', count: [1, 2], wage: [30, 42], start: 9, end: 17, days: WEEKDAYS },
    { role: 'Designer', count: [0, 2], wage: [30, 45], start: 10, end: 18, days: WEEKDAYS },
    { role: 'Office Manager', count: [1, 1], wage: [38, 55], start: 8, end: 17, days: WEEKDAYS },
    { role: 'Receptionist', count: [1, 1], wage: [18, 22], start: 8, end: 16, days: WEEKDAYS },
  ],
  bank: [
    { role: 'Bank Teller', count: [2, 3], wage: [19, 23], start: 9, end: 17, days: WEEKDAYS },
    { role: 'Financial Advisor', count: [1, 2], wage: [35, 50], start: 9, end: 17, days: WEEKDAYS },
    { role: 'Branch Manager', count: [1, 1], wage: [50, 65], start: 8, end: 18, days: WEEKDAYS },
  ],
  dealership: [
    { role: 'Car Salesperson', count: [2, 3], wage: [20, 30], start: 9, end: 18, days: [0, 1, 2, 3, 4, 5] },
    { role: 'Mechanic', count: [1, 2], wage: [24, 30], start: 8, end: 17, days: WEEKDAYS },
  ],
  bar: [
    { role: 'Bartender', count: [1, 2], wage: [15, 19], start: 17, end: 26 },
    { role: 'Server', count: [0, 1], wage: [14, 16], start: 18, end: 25 },
  ],
  nightclub: [
    { role: 'DJ', count: [1, 1], wage: [30, 45], start: 21, end: 28, days: [3, 4, 5, 6] },
    { role: 'Bartender', count: [1, 2], wage: [16, 20], start: 21, end: 28, days: [2, 3, 4, 5, 6] },
    { role: 'Bouncer', count: [1, 2], wage: [18, 22], start: 21, end: 28, days: [2, 3, 4, 5, 6] },
  ],
  hotel: [
    { role: 'Receptionist', count: [1, 2], wage: [17, 20], start: 7, end: 15 },
    { role: 'Receptionist', count: [1, 1], wage: [18, 21], start: 15, end: 23 },
    { role: 'Housekeeper', count: [1, 3], wage: [15, 17], start: 8, end: 16 },
    { role: 'Concierge', count: [1, 1], wage: [20, 25], start: 10, end: 18 },
  ],
  cinema: [{ role: 'Cinema Attendant', count: [1, 3], wage: [13, 15], start: 14, end: 24 }],
  gym: [
    { role: 'Personal Trainer', count: [1, 2], wage: [20, 30], start: 6, end: 14 },
    { role: 'Front Desk', count: [1, 1], wage: [14, 16], start: 14, end: 22 },
  ],
  salon: [{ role: 'Hair Stylist', count: [1, 2], wage: [16, 24], start: 10, end: 19, days: [1, 2, 3, 4, 5] }],
  warehouse: [
    { role: 'Warehouse Worker', count: [2, 4], wage: [17, 20], start: 6, end: 14 },
    { role: 'Warehouse Worker', count: [1, 3], wage: [18, 21], start: 14, end: 22 },
    { role: 'Forklift Operator', count: [1, 2], wage: [20, 24], start: 6, end: 14 },
    { role: 'Logistics Manager', count: [1, 1], wage: [32, 40], start: 8, end: 17, days: WEEKDAYS },
  ],
  factory: [
    { role: 'Factory Worker', count: [3, 5], wage: [18, 22], start: 6, end: 14, days: WEEKDAYS },
    { role: 'Factory Worker', count: [2, 4], wage: [19, 23], start: 14, end: 22, days: WEEKDAYS },
    { role: 'Engineer', count: [1, 2], wage: [36, 48], start: 8, end: 17, days: WEEKDAYS },
    { role: 'Plant Manager', count: [1, 1], wage: [45, 60], start: 7, end: 17, days: WEEKDAYS },
  ],
  depot: [
    { role: 'Courier', count: [2, 3], wage: [17, 20], start: 8, end: 17, days: [0, 1, 2, 3, 4, 5] },
    { role: 'Dispatcher', count: [1, 1], wage: [20, 24], start: 7, end: 16, days: WEEKDAYS },
    { role: 'Delivery Driver', count: [2, 3], wage: [19, 22], start: 7, end: 16, days: [0, 1, 2, 3, 4, 5] },
  ],
  taxi: [
    { role: 'Taxi Driver', count: [2, 3], wage: [16, 22], start: 7, end: 17 },
    { role: 'Taxi Driver', count: [1, 3], wage: [18, 24], start: 17, end: 27 },
  ],
  school: [
    { role: 'Teacher', count: [3, 5], wage: [26, 34], start: 8, end: 16, days: WEEKDAYS },
    { role: 'Janitor', count: [1, 1], wage: [15, 18], start: 12, end: 20, days: WEEKDAYS },
  ],
  cityhall: [
    { role: 'City Clerk', count: [2, 4], wage: [22, 28], start: 9, end: 17, days: WEEKDAYS },
    { role: 'City Planner', count: [1, 2], wage: [34, 44], start: 9, end: 17, days: WEEKDAYS },
  ],
};

const HOURS: Partial<Record<BusinessType, [number, number]>> = {
  cafe: [7, 20],
  restaurant: [11, 23],
  fastfood: [10, 23],
  grocery: [7, 24],
  convenience: [6, 24],
  clothing: [10, 20],
  electronics: [10, 20],
  bookstore: [10, 20],
  pharmacy: [8, 21],
  office: [8, 19],
  bank: [9, 17],
  dealership: [9, 19],
  bar: [16, 26],
  nightclub: [21, 28],
  hotel: [0, 24],
  cinema: [12, 24],
  gym: [6, 23],
  salon: [10, 19],
  warehouse: [6, 22],
  factory: [6, 22],
  depot: [7, 20],
  school: [8, 16],
  cityhall: [9, 17],
  taxi: [0, 24],
};

const GOODS: Record<BusinessType, BusinessDef['goods']> = {
  cafe: 'drink',
  restaurant: 'food',
  fastfood: 'food',
  grocery: 'food',
  convenience: 'retail',
  clothing: 'retail',
  electronics: 'retail',
  bookstore: 'retail',
  pharmacy: 'retail',
  office: 'service',
  bank: 'service',
  dealership: 'retail',
  bar: 'drink',
  nightclub: 'drink',
  hotel: 'service',
  cinema: 'service',
  gym: 'service',
  salon: 'service',
  warehouse: 'industrial',
  factory: 'industrial',
  depot: 'service',
  school: 'none',
  cityhall: 'none',
  taxi: 'service',
};

const INTERIOR: Partial<Record<BusinessType, InteriorType>> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  fastfood: 'restaurant',
  grocery: 'store',
  convenience: 'store',
  electronics: 'store',
  bookstore: 'store',
  pharmacy: 'store',
  salon: 'store',
  clothing: 'clothing',
  office: 'office',
  taxi: 'office',
  bank: 'bank',
  dealership: 'dealership',
  bar: 'bar',
  nightclub: 'club',
  depot: 'depot',
  hotel: 'hotel',
  gym: 'gym',
  cinema: 'cinema',
};

interface Lot {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  facing: 0 | 1 | 2 | 3;
}

export function generateBuildings(c: CityData, rng: RNG, h: Helpers) {
  const Y = CURB_H;
  const used = { bank: 0, dealership: 0, depot: 0, taxi: 0, cityhall: 0, school: 0, cinema: 0, nightclub: 0, mall: 0, gym: 0 };

  const box = (
    x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    style: number, color: RGB, roof = Facade.RoofFlat as number, ground = 0, roofColor?: RGB, collide = true,
  ): BoxPart => ({ x0, x1, y0, y1, z0, z1, style, roof, color, roofColor, ground, collide });

  const inset = (l: Lot, front: number, side: number, back: number) => {
    const o = { x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1 };
    if (l.facing === 0) {
      o.z0 += front;
      o.z1 -= back;
      o.x0 += side;
      o.x1 -= side;
    } else if (l.facing === 2) {
      o.z1 -= front;
      o.z0 += back;
      o.x0 += side;
      o.x1 -= side;
    } else if (l.facing === 1) {
      o.x1 -= front;
      o.x0 += back;
      o.z0 += side;
      o.z1 -= side;
    } else {
      o.x0 += front;
      o.x1 -= back;
      o.z0 += side;
      o.z1 -= side;
    }
    return o;
  };

  const segForFacing = (b: Block, facing: number, x: number, z: number): { seg: number; side: number } => {
    // merged blocks: find cell from point
    let bi = b.bi;
    if (b.merged) bi = clamp(Math.floor((x - c.bounds.minX) / 96), 0, c.n - 1);
    const bj = b.bj;
    if (facing === 0) return { seg: h.segH[bj][bi], side: 1 };
    if (facing === 2) return { seg: h.segH[bj + 1][bi], side: 0 };
    if (facing === 1) return { seg: h.segV[bi + 1][bj], side: 0 };
    return { seg: h.segV[bi][bj], side: 1 };
  };

  const addresses = new Set<string>();
  const makeBuilding = (
    b: Block,
    kind: BuildingKind,
    fp: { x0: number; x1: number; z0: number; z1: number },
    facing: 0 | 1 | 2 | 3,
    parts: BoxPart[],
    seed: number,
  ): Building => {
    const cx = (fp.x0 + fp.x1) / 2;
    const cz = (fp.z0 + fp.z1) / 2;
    const door =
      facing === 0 ? { x: cx, z: fp.z0 - 0.15 } : facing === 2 ? { x: cx, z: fp.z1 + 0.15 } : facing === 1 ? { x: fp.x1 + 0.15, z: cz } : { x: fp.x0 - 0.15, z: cz };
    const { seg, side } = segForFacing(b, facing, door.x, door.z);
    const s = c.segments[seg];
    const edgeId = h.segSideEdge[seg][side];
    const e = c.swEdges[edgeId];
    const na = c.swNodes[e.a];
    const nb = c.swNodes[e.b];
    const pr = pointSegment(door.x, door.z, na.x, na.z, nb.x, nb.z);
    const along = s.orient === 'v' ? door.z : door.x;
    let num = 10 + Math.floor((along + 620) / 5) * 2 + (side === 1 ? 1 : 0);
    let address = `${num} ${s.name}`;
    while (addresses.has(address)) {
      num += 2;
      address = `${num} ${s.name}`;
    }
    addresses.add(address);
    let height = 0;
    for (const p of parts) height = Math.max(height, p.y1);
    const bld: Building = {
      id: c.buildings.length,
      blockId: b.id,
      district: b.district,
      kind,
      x0: fp.x0,
      x1: fp.x1,
      z0: fp.z0,
      z1: fp.z1,
      height,
      floors: Math.max(1, Math.round(height / 3.5)),
      facing,
      parts,
      gables: [],
      door,
      access: { edge: edgeId, t: pr.t, x: pr.x, z: pr.z },
      segment: seg,
      street: s.name,
      number: num,
      address,
      homes: [],
      businesses: [],
      interior: null,
      seed,
      chunk: h.ch(cx, cz),
    };
    c.buildings.push(bld);
    return bld;
  };

  const addBusiness = (bld: Building, type: BusinessType, r: RNG, opts: { name?: string; primary?: boolean } = {}) => {
    const wealth = DISTRICT_INFO[bld.district].wealth;
    const jobs: JobSlot[] = [];
    for (const t of JOBS[type] ?? []) {
      const count = r.int(t.count[0], t.count[1]);
      if (count <= 0) continue;
      const wage = Math.round(r.range(t.wage[0], t.wage[1]) * (0.85 + wealth * 0.3));
      jobs.push({ role: t.role, count, wage, start: t.start, end: t.end, days: t.days ?? ALLDAYS });
    }
    const [open, close] = HOURS[type] ?? [9, 17];
    const def: BusinessDef = {
      id: c.businesses.length,
      name: opts.name ?? businessName(r, type),
      type,
      building: bld.id,
      district: bld.district,
      jobs,
      priceLevel: Math.round((0.7 + wealth * 0.8 + r.range(-0.1, 0.1)) * 100) / 100,
      capacity: type === 'office' || type === 'factory' ? 60 : type === 'nightclub' ? 80 : type === 'cafe' ? 14 : 24,
      open,
      close,
      interior: INTERIOR[type] ?? null,
      goods: GOODS[type],
    };
    c.businesses.push(def);
    bld.businesses.push(def.id);
    if (opts.primary !== false && bld.interior === null && def.interior) {
      bld.interior = def.interior;
      bld.name = def.name;
    }
    if (!bld.name) bld.name = def.name;
    return def;
  };

  const addHomes = (bld: Building, count: number, capacity: [number, number], rent: [number, number], quality: number, r: RNG) => {
    for (let k = 0; k < count; k++) {
      const floor = Math.floor(k / 4) + 1;
      const letter = 'ABCD'[k % 4];
      c.homes.push({
        id: c.homes.length,
        building: bld.id,
        unit: bld.kind === 'house' || bld.kind === 'mansion' ? 'House' : `Apt ${floor}${letter}`,
        capacity: r.int(capacity[0], capacity[1]),
        rent: Math.round(r.range(rent[0], rent[1])),
        quality,
      });
      bld.homes.push(c.homes.length - 1);
    }
  };

  const perimeterLots = (b: Block, r: RNG, depth: (f: number) => number, wMin: number, wMax: number): Lot[] => {
    const lots: Lot[] = [];
    const dN = depth(0);
    const dS = depth(2);
    const dW = depth(3);
    const dE = depth(1);
    const split = (a0: number, a1: number): [number, number][] => {
      const out: [number, number][] = [];
      let a = a0;
      while (a1 - a > wMin * 1.5) {
        const w = Math.min(r.range(wMin, wMax), a1 - a);
        out.push([a, a + w]);
        a += w;
      }
      if (a1 - a > 0.1) {
        if (out.length && a1 - a < wMin) out[out.length - 1][1] = a1;
        else out.push([a, a1]);
      }
      return out;
    };
    for (const [a0, a1] of split(b.x0, b.x1)) lots.push({ x0: a0, x1: a1, z0: b.z0, z1: b.z0 + dN, facing: 0 });
    for (const [a0, a1] of split(b.x0, b.x1)) lots.push({ x0: a0, x1: a1, z0: b.z1 - dS, z1: b.z1, facing: 2 });
    for (const [a0, a1] of split(b.z0 + dN, b.z1 - dS)) lots.push({ x0: b.x0, x1: b.x0 + dW, z0: a0, z1: a1, facing: 3 });
    for (const [a0, a1] of split(b.z0 + dN, b.z1 - dS)) lots.push({ x0: b.x1 - dE, x1: b.x1, z0: a0, z1: a1, facing: 1 });
    return lots;
  };

  /** Is the road on a given block side an arterial? */
  const sideArterial = (b: Block, facing: number) => {
    if (facing === 0) return c.hLines[b.bj].cls === 'arterial';
    if (facing === 2) return c.hLines[b.bj + 1].cls === 'arterial';
    if (facing === 1) return c.vLines[b.bi + 1].cls === 'arterial';
    return c.vLines[b.bi].cls === 'arterial';
  };
  const bestFacing = (b: Block, r: RNG): 0 | 1 | 2 | 3 => {
    const arts = ([0, 1, 2, 3] as const).filter((f) => sideArterial(b, f));
    return arts.length ? r.pick(arts) : r.pick([0, 1, 2, 3] as const);
  };

  const downtownCenter = c.districtCenters.find((d) => d.id === 'downtown')!;

  // --------------------------------------------------------------- recipes
  const towerParts = (fp: { x0: number; x1: number; z0: number; z1: number }, H: number, r: RNG, facing: number) => {
    const parts: BoxPart[] = [];
    const styleRoll = r.next();
    const style = styleRoll < 0.55 ? Facade.Glass : styleRoll < 0.78 ? Facade.GlassDark : Facade.Office;
    const col = style === Facade.Office ? r.pick(PAL.concrete) : r.pick(PAL.glass);
    const frame = r.pick(PAL.frame);
    const podH = r.pick([8.5, 8.5, 12.5]);
    parts.push(box(fp.x0, fp.x1, Y, Y + podH, fp.z0, fp.z1, Facade.Office, frame, Facade.RoofFlat, 4.5, r.pick(PAL.roof)));
    const w = fp.x1 - fp.x0;
    const d = fp.z1 - fp.z0;
    const m = Math.min(w, d) * r.range(0.08, 0.2);
    let x0 = fp.x0 + m;
    let x1 = fp.x1 - m;
    let z0 = fp.z0 + m;
    let z1 = fp.z1 - m;
    const shape = r.pick(['box', 'setback', 'setback', 'slim', 'twin'] as const);
    let y = Y + podH;
    const top = Y + H;
    if (shape === 'box' || shape === 'slim') {
      if (shape === 'slim') {
        const sx = (x1 - x0) * 0.18;
        const sz = (z1 - z0) * 0.18;
        x0 += sx;
        x1 -= sx;
        z0 += sz;
        z1 -= sz;
      }
      parts.push(box(x0, x1, y, top, z0, z1, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
      y = top;
    } else if (shape === 'setback') {
      const tiers = r.int(2, 3);
      for (let t = 0; t < tiers; t++) {
        const yt = t === tiers - 1 ? top : y + (top - y) * r.range(0.45, 0.62);
        parts.push(box(x0, x1, y, yt, z0, z1, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
        y = yt;
        const sx = (x1 - x0) * r.range(0.08, 0.16);
        const sz = (z1 - z0) * r.range(0.08, 0.16);
        x0 += sx;
        x1 -= sx;
        z0 += sz;
        z1 -= sz;
      }
      // restore last footprint for crown
      x0 -= 0;
    } else {
      // twin slabs
      const alongX = w > d;
      if (alongX) {
        const mid = (x0 + x1) / 2;
        parts.push(box(x0, mid - 2, y, top, z0, z1, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
        parts.push(box(mid + 2, x1, y, top - r.range(8, 25), z0, z1, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
      } else {
        const mid = (z0 + z1) / 2;
        parts.push(box(x0, x1, y, top, z0, mid - 2, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
        parts.push(box(x0, x1, y, top - r.range(8, 25), mid + 2, z1, style, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
      }
      y = top;
    }
    // crown band
    const last = parts[parts.length - 1];
    if (shape !== 'twin') {
      parts.push(box(last.x0 - 0.3, last.x1 + 0.3, last.y1, last.y1 + 1.4, last.z0 - 0.3, last.z1 + 0.3, Facade.Plain, frame, Facade.RoofFlat, 0, r.pick(PAL.roof), false));
      // mechanical penthouse
      const mx = (last.x1 - last.x0) * 0.3;
      const mz = (last.z1 - last.z0) * 0.3;
      const cx = (last.x0 + last.x1) / 2 + r.range(-2, 2);
      const cz = (last.z0 + last.z1) / 2 + r.range(-2, 2);
      parts.push(box(cx - mx / 2, cx + mx / 2, last.y1 + 1.4, last.y1 + 1.4 + r.range(3, 6), cz - mz / 2, cz + mz / 2, Facade.Plain, r.pick(PAL.concrete), Facade.RoofFlat, 0, undefined, false));
      if (H > 110) {
        parts.push(box(cx - 0.3, cx + 0.3, last.y1 + 4, last.y1 + 4 + H * 0.12, cz - 0.3, cz + 0.3, Facade.Plain, [0.6, 0.6, 0.62], -1, 0, undefined, false));
      }
    }
    return parts;
  };

  const shopParts = (fp: { x0: number; x1: number; z0: number; z1: number }, floors: number, r: RNG, district: DistrictId) => {
    const style = r.pick(district === 'entertainment' ? [Facade.Brick, Facade.Plaster, Facade.Plaster, Facade.Club] : [Facade.Brick, Facade.Brick, Facade.Plaster, Facade.Office]);
    const col = style === Facade.Brick ? r.pick(PAL.brick) : style === Facade.Office ? r.pick(PAL.concrete) : style === Facade.Club ? r.pick(PAL.club) : r.pick(PAL.plaster);
    const H = 4.5 + (floors - 1) * 3.4;
    const parts = [box(fp.x0, fp.x1, Y, Y + H, fp.z0, fp.z1, style, col, Facade.RoofFlat, 4.5, r.pick(PAL.roof))];
    // cornice / parapet
    parts.push(box(fp.x0 - 0.2, fp.x1 + 0.2, Y + H, Y + H + 0.8, fp.z0 - 0.2, fp.z1 + 0.2, Facade.Plain, style === Facade.Club ? [0.08, 0.08, 0.1] : r.pick(PAL.concrete), Facade.RoofFlat, 0, r.pick(PAL.roof), false));
    return parts;
  };

  const apartmentParts = (fp: { x0: number; x1: number; z0: number; z1: number }, floors: number, r: RNG, groundShop: boolean) => {
    const style = r.chance(0.55) ? Facade.Brick : Facade.Plaster;
    const col = style === Facade.Brick ? r.pick(PAL.brick) : r.pick(PAL.plaster);
    const H = (groundShop ? 4.5 : 3.4) + (floors - 1) * 3.2;
    const parts = [box(fp.x0, fp.x1, Y, Y + H, fp.z0, fp.z1, style, col, Facade.RoofFlat, groundShop ? 4.5 : 0, r.pick(PAL.roof))];
    parts.push(box(fp.x0 - 0.25, fp.x1 + 0.25, Y + H, Y + H + 0.7, fp.z0 - 0.25, fp.z1 + 0.25, Facade.Plain, r.pick(PAL.concrete), Facade.RoofFlat, 0, r.pick(PAL.roof), false));
    return parts;
  };

  const roofClutter = (bld: Building, r: RNG, n: number) => {
    const top = bld.parts[0];
    for (let k = 0; k < n; k++) {
      const x = r.range(top.x0 + 2, top.x1 - 2);
      const z = r.range(top.z0 + 2, top.z1 - 2);
      if (r.chance(0.65)) h.addProp('acUnit', x, z, r.pick([0, Math.PI / 2]), r.range(0.8, 1.2), top.y1 + 0.8);
      else h.addProp('waterTank', x, z, 0, r.range(0.8, 1.1), top.y1 + 0.8);
    }
  };

  // ----------------------------------------------------- district: downtown
  const doDowntown = (b: Block, r: RNG) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const layout = r.weighted(['single', 'halves', 'quads'], [1, 2, 2]);
    const lots: { x0: number; x1: number; z0: number; z1: number }[] = [];
    if (layout === 'single') lots.push({ x0: b.x0 + 2, x1: b.x1 - 2, z0: b.z0 + 2, z1: b.z1 - 2 });
    else if (layout === 'halves') {
      if (r.chance(0.5)) {
        const m = b.x0 + w * r.range(0.42, 0.58);
        lots.push({ x0: b.x0 + 1, x1: m - 3, z0: b.z0 + 1, z1: b.z1 - 1 }, { x0: m + 3, x1: b.x1 - 1, z0: b.z0 + 1, z1: b.z1 - 1 });
      } else {
        const m = b.z0 + d * r.range(0.42, 0.58);
        lots.push({ x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + 1, z1: m - 3 }, { x0: b.x0 + 1, x1: b.x1 - 1, z0: m + 3, z1: b.z1 - 1 });
      }
    } else {
      const mx = b.x0 + w * r.range(0.45, 0.55);
      const mz = b.z0 + d * r.range(0.45, 0.55);
      lots.push(
        { x0: b.x0 + 1, x1: mx - 2.5, z0: b.z0 + 1, z1: mz - 2.5 },
        { x0: mx + 2.5, x1: b.x1 - 1, z0: b.z0 + 1, z1: mz - 2.5 },
        { x0: b.x0 + 1, x1: mx - 2.5, z0: mz + 2.5, z1: b.z1 - 1 },
        { x0: mx + 2.5, x1: b.x1 - 1, z0: mz + 2.5, z1: b.z1 - 1 },
      );
    }
    const plazaIdx = layout === 'quads' && r.chance(0.3) ? r.int(0, 3) : -1;
    lots.forEach((fp, k) => {
      const cx = (fp.x0 + fp.x1) / 2;
      const cz = (fp.z0 + fp.z1) / 2;
      // facing: toward nearest block edge
      const dists = [fp.z0 - b.z0, b.x1 - fp.x1, b.z1 - fp.z1, fp.x0 - b.x0];
      let facing = 0 as 0 | 1 | 2 | 3;
      let bestScore = Infinity;
      for (let f = 0; f < 4; f++) {
        const sc = dists[f] - (sideArterial(b, f) ? 3 : 0);
        if (sc < bestScore) {
          bestScore = sc;
          facing = f as 0 | 1 | 2 | 3;
        }
      }
      if (k === plazaIdx) {
        h.addGround(fp.x0 - 1, fp.x1 + 1, fp.z0 - 1, fp.z1 + 1, Y + 0.04, GroundKind.Plaza);
        h.addProp('fountain', cx, cz, 0, 0.8);
        for (let t = 0; t < 4; t++) {
          h.addProp('tree', cx + (t % 2 ? 1 : -1) * (fp.x1 - fp.x0) * 0.33, cz + (t < 2 ? 1 : -1) * (fp.z1 - fp.z0) * 0.33, r.range(0, 6), 1);
          h.addProp('bench', cx + (t % 2 ? 1 : -1) * 5.5, cz + (t < 2 ? 1 : -1) * 5.5, (t * Math.PI) / 2);
        }
        c.outdoor.push({ id: c.outdoor.length, kind: 'plaza', name: 'Pocket Plaza', x: cx, z: cz, radius: 8, block: b.id, access: { edge: 0, t: 0, x: cx, z: cz }, district: b.district });
        return;
      }
      const cent = clamp(1 - Math.hypot(cx - downtownCenter.x, cz - downtownCenter.z) / 260, 0, 1);
      const area = (fp.x1 - fp.x0) * (fp.z1 - fp.z0);
      const H = (38 + r.next() * 45) * (1 + 1.9 * cent * cent) * clamp(area / 900, 0.6, 1.2);
      const parts = towerParts(fp, H, r, facing);
      const bld = makeBuilding(b, 'tower', fp, facing, parts, r.int(0, 999));
      // podium business
      const special = !used.bank && cent > 0.55 ? 'bank' : null;
      if (special === 'bank') {
        used.bank++;
        addBusiness(bld, 'bank', r, { name: 'First Echo Bank' });
        c.landmarks['bank'] = bld.id;
      } else {
        addBusiness(bld, r.weighted(['cafe', 'restaurant', 'clothing', 'pharmacy', 'convenience', 'electronics', 'fastfood'] as BusinessType[], [3, 2.2, 1.4, 0.8, 1, 0.6, 0.8]), r);
      }
      if (r.chance(0.68)) {
        const nOff = H > 90 ? 2 : 1;
        for (let q = 0; q < nOff; q++) addBusiness(bld, 'office', r, { primary: false });
      } else {
        addHomes(bld, Math.min(24, Math.floor(H / 3.4) * 2), [1, 2], [520, 1100], 0.85, r);
      }
    });
  };

  // --------------------------------------------------- district: commercial
  const doCommercial = (b: Block, r: RNG, ent = false) => {
    if (!ent && !used.mall && r.chance(0.18) && b.x1 - b.x0 > 60) {
      used.mall++;
      const fp = { x0: b.x0 + 6, x1: b.x1 - 6, z0: b.z0 + 6, z1: b.z1 - 6 };
      const facing = bestFacing(b, r);
      const parts = [
        box(fp.x0, fp.x1, Y, Y + 15, fp.z0, fp.z1, Facade.Store, r.pick(PAL.concrete), Facade.RoofFlat, 6, r.pick(PAL.roof)),
        box(fp.x0 + 8, fp.x1 - 8, Y + 15, Y + 19, fp.z0 + 8, fp.z1 - 8, Facade.Glass, r.pick(PAL.glass), Facade.RoofFlat, 0, r.pick(PAL.roof)),
      ];
      const bld = makeBuilding(b, 'mall', fp, facing, parts, r.int(0, 999));
      bld.name = 'Echo Galleria';
      addBusiness(bld, 'clothing', r);
      addBusiness(bld, 'electronics', r, { primary: false });
      addBusiness(bld, 'fastfood', r, { primary: false });
      addBusiness(bld, 'cafe', r, { primary: false });
      if (!used.cinema) {
        used.cinema++;
        addBusiness(bld, 'cinema', r, { primary: false });
      }
      bld.name = 'Echo Galleria';
      roofClutter(bld, r, 6);
      return;
    }
    const lots = perimeterLots(b, r, () => r.range(18, 25), 11, 21);
    let vacancy = 0;
    for (const lot of lots) {
      const fp = inset(lot, 0, r.range(0, 0.6), r.range(0, 3));
      const floors = r.int(ent ? 2 : 2, ent ? 4 : 5);
      const parts = shopParts(fp, floors, r, b.district);
      const bld = makeBuilding(b, 'shop', fp, lot.facing, parts, r.int(0, 999));
      const t: BusinessType = ent
        ? r.weighted(['restaurant', 'bar', 'fastfood', 'cafe', 'convenience', 'salon'] as BusinessType[], [3, 3, 1.5, 1.5, 1, 0.5])
        : r.weighted(
            ['restaurant', 'cafe', 'clothing', 'convenience', 'grocery', 'electronics', 'bookstore', 'pharmacy', 'salon', 'fastfood', 'gym', 'bar'] as BusinessType[],
            [2.5, 2.2, 2, 1.4, 1, 0.8, 0.6, 0.7, 0.8, 1.4, used.gym < 2 ? 0.5 : 0, 0.7],
          );
      if (vacancy < 1 && r.chance(0.06)) {
        vacancy++;
        bld.forSale = true;
        bld.name = 'Vacant Storefront';
      } else {
        if (t === 'gym') used.gym++;
        addBusiness(bld, t, r);
      }
      if (floors >= 3) {
        if (r.chance(0.65)) addHomes(bld, (floors - 1) * 2, [1, 2], [180, 380], 0.5, r);
        else addBusiness(bld, 'office', r, { primary: false });
      }
      if (r.chance(0.35)) roofClutter(bld, r, 1);
    }
    // courtyard parking
    const cx0 = b.x0 + 26;
    const cx1 = b.x1 - 26;
    const cz0 = b.z0 + 26;
    const cz1 = b.z1 - 26;
    if (cx1 - cx0 > 10 && cz1 - cz0 > 10) {
      h.addGround(cx0, cx1, cz0, cz1, Y + 0.04, GroundKind.Parking);
      for (let x = cx0 + 2.5; x < cx1 - 2; x += 3) {
        if (r.chance(0.5)) h.addProp('car', x, cz0 + 3, 0, 1, Y, r.int(0, 3), r.int(0, 999));
        if (r.chance(0.5)) h.addProp('car', x, cz1 - 3, Math.PI, 1, Y, r.int(0, 3), r.int(0, 999));
      }
      h.addProp('lamp', (cx0 + cx1) / 2, (cz0 + cz1) / 2, 0, 1);
    }
  };

  // -------------------------------------------------- district: residential
  let schools = 0;
  const doResidential = (b: Block, r: RNG) => {
    if (schools < 2 && r.chance(0.08)) {
      schools++;
      const fp = { x0: b.x0 + 4, x1: b.x0 + (b.x1 - b.x0) * 0.62, z0: b.z0 + 4, z1: b.z0 + 22 };
      const facing = 0;
      const col = r.pick(PAL.brick);
      const parts = [
        box(fp.x0, fp.x1, Y, Y + 11, fp.z0, fp.z1, Facade.Brick, col, Facade.RoofFlat, 0, r.pick(PAL.roof)),
        box(fp.x0, fp.x0 + 16, Y, Y + 11, fp.z1, b.z1 - 8, Facade.Brick, col, Facade.RoofFlat, 0, r.pick(PAL.roof)),
      ];
      const bld = makeBuilding(b, 'school', fp, facing, parts, r.int(0, 999));
      addBusiness(bld, 'school', r, { name: `${bld.street.split(' ')[0]} High School` });
      h.addGround(fp.x0 + 20, b.x1 - 4, fp.z1 + 4, b.z1 - 4, Y + 0.04, GroundKind.Grass);
      h.addProp('playground', fp.x1 + 10, b.z0 + 12, 0, 1);
      return;
    }
    const lots: Lot[] = [];
    // arterial sides get apartment buildings
    const aptSides = ([0, 1, 2, 3] as const).filter((f) => sideArterial(b, f));
    const allApt = r.chance(0.3);
    const depth = (f: number) => (allApt || aptSides.includes(f as 0) ? r.range(18, 22) : r.range(28, 33));
    const raw = perimeterLots(b, r, depth, 13, 18);
    for (const lot of raw) {
      const isApt = allApt || aptSides.includes(lot.facing);
      if (isApt) {
        // merge apartment lots to wider buildings
        const prev = lots[lots.length - 1] as Lot & { apt?: boolean };
        if (prev && prev.apt && prev.facing === lot.facing && Math.max(prev.x1 - prev.x0, prev.z1 - prev.z0) < 26) {
          prev.x0 = Math.min(prev.x0, lot.x0);
          prev.x1 = Math.max(prev.x1, lot.x1);
          prev.z0 = Math.min(prev.z0, lot.z0);
          prev.z1 = Math.max(prev.z1, lot.z1);
          continue;
        }
        lots.push(Object.assign({ ...lot }, { apt: true }));
      } else lots.push(lot);
    }
    for (const lot of lots as (Lot & { apt?: boolean })[]) {
      if (lot.apt) {
        const fp = inset(lot, 1.5, 0.8, 1.5);
        const floors = r.int(4, 7);
        const groundShop = r.chance(0.3);
        const bld = makeBuilding(b, 'apartment', fp, lot.facing, apartmentParts(fp, floors, r, groundShop), r.int(0, 999));
        addHomes(bld, Math.min(24, floors * 3), [1, 3], [170, 360], 0.45, r);
        if (groundShop) addBusiness(bld, r.weighted(['convenience', 'cafe', 'salon', 'fastfood', 'restaurant'] as BusinessType[], [2, 2, 1, 1, 1]), r);
        if (r.chance(0.4)) roofClutter(bld, r, 2);
      } else {
        const lw = lot.facing === 0 || lot.facing === 2 ? lot.x1 - lot.x0 : lot.z1 - lot.z0;
        const ld = lot.facing === 0 || lot.facing === 2 ? lot.z1 - lot.z0 : lot.x1 - lot.x0;
        const hw = Math.min(lw - 3.5, r.range(8.5, 11.5));
        const hd = Math.min(ld - 12, r.range(8.5, 11));
        const front = r.range(5, 7);
        const side = (lw - hw) / 2 + r.range(-1, 1);
        const fp = inset(lot, front, 0, 0);
        // compute house footprint inside lot along axes
        const f2 = { ...fp };
        if (lot.facing === 0) {
          f2.z1 = f2.z0 + hd;
          f2.x0 = lot.x0 + side;
          f2.x1 = f2.x0 + hw;
        } else if (lot.facing === 2) {
          f2.z0 = f2.z1 - hd;
          f2.x0 = lot.x0 + side;
          f2.x1 = f2.x0 + hw;
        } else if (lot.facing === 1) {
          f2.x0 = f2.x1 - hd;
          f2.z0 = lot.z0 + side;
          f2.z1 = f2.z0 + hw;
        } else {
          f2.x1 = f2.x0 + hd;
          f2.z0 = lot.z0 + side;
          f2.z1 = f2.z0 + hw;
        }
        const floors = r.chance(0.55) ? 2 : 1;
        const H = floors * 3.0 + 0.3;
        const col = r.pick(PAL.siding);
        const parts = [box(f2.x0, f2.x1, Y, Y + H, f2.z0, f2.z1, Facade.House, col, -1, 0)];
        const bld = makeBuilding(b, 'house', f2, lot.facing, parts, r.int(0, 999));
        const alongX = lot.facing === 0 || lot.facing === 2;
        bld.gables.push({ x0: f2.x0 - 0.4, x1: f2.x1 + 0.4, z0: f2.z0 - 0.4, z1: f2.z1 + 0.4, y0: Y + H, h: r.range(2.2, 3.4), alongX, color: r.pick(PAL.tile) });
        if (r.chance(0.5)) {
          const cx = r.range(f2.x0 + 1, f2.x1 - 1);
          const cz = r.range(f2.z0 + 1, f2.z1 - 1);
          parts.push(box(cx - 0.45, cx + 0.45, Y + H, Y + H + 3.6, cz - 0.45, cz + 0.45, Facade.Brick, r.pick(PAL.brick), Facade.RoofFlat, 0, undefined, false));
        }
        bld.height = Y + H + 3;
        addHomes(bld, 1, [2, 4], [260, 480], 0.6, r);
        // yard: tree in back, bush in front, fence along sides
        const bx = (lot.x0 + lot.x1) / 2;
        const bz = (lot.z0 + lot.z1) / 2;
        const backX = lot.facing === 1 ? lot.x0 + 3 : lot.facing === 3 ? lot.x1 - 3 : bx + r.range(-3, 3);
        const backZ = lot.facing === 0 ? lot.z1 - 3 : lot.facing === 2 ? lot.z0 + 3 : bz + r.range(-3, 3);
        if (r.chance(0.8)) h.addProp(r.chance(0.3) ? 'conifer' : 'tree', backX, backZ, r.range(0, 6), r.range(0.9, 1.3));
        // front bushes
        const dfx = lot.facing === 1 ? 1 : lot.facing === 3 ? -1 : 0;
        const dfz = lot.facing === 0 ? -1 : lot.facing === 2 ? 1 : 0;
        const doorX = bld.door.x + dfx * 2.5;
        const doorZ = bld.door.z + dfz * 2.5;
        if (r.chance(0.7)) h.addProp('bush', doorX + (dfz !== 0 ? 3 : 0), doorZ + (dfx !== 0 ? 3 : 0), 0, r.range(0.7, 1.1));
        // fence along lot side boundaries
        const fenceRot = lot.facing === 0 || lot.facing === 2 ? Math.PI / 2 : 0;
        if (lot.facing === 0 || lot.facing === 2) {
          for (let z = lot.z0 + 1; z < lot.z1 - 0.5; z += 2.5) h.addProp('fence', lot.x1 - 0.1, z + 1.25, fenceRot, 1, Y);
        } else {
          for (let x = lot.x0 + 1; x < lot.x1 - 0.5; x += 2.5) h.addProp('fence', x + 1.25, lot.z1 - 0.1, fenceRot, 1, Y);
        }
        // driveway + car
        if (r.chance(0.6)) {
          const dw = 3;
          if (lot.facing === 0) {
            const x = f2.x1 + 0.5;
            if (x + dw < lot.x1) {
              h.addGround(x, x + dw, lot.z0, f2.z0 + 4, Y + 0.03, GroundKind.Concrete);
              if (r.chance(0.6)) h.addProp('car', x + dw / 2, lot.z0 + 3, Math.PI, 1, Y + 0.03, r.int(0, 3), r.int(0, 999));
            }
          } else if (lot.facing === 2) {
            const x = f2.x0 - 0.5 - dw;
            if (x > lot.x0) {
              h.addGround(x, x + dw, f2.z1 - 4, lot.z1, Y + 0.03, GroundKind.Concrete);
              if (r.chance(0.6)) h.addProp('car', x + dw / 2, lot.z1 - 3, 0, 1, Y + 0.03, r.int(0, 3), r.int(0, 999));
            }
          }
        }
      }
    }
  };

  // ------------------------------------------------------- district: wealthy
  const doWealthy = (b: Block, r: RNG) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const mx = b.x0 + w / 2;
    const mz = b.z0 + d / 2;
    const lots: Lot[] = [
      { x0: b.x0, x1: mx, z0: b.z0, z1: mz, facing: 0 },
      { x0: mx, x1: b.x1, z0: b.z0, z1: mz, facing: 0 },
      { x0: b.x0, x1: mx, z0: mz, z1: b.z1, facing: 2 },
      { x0: mx, x1: b.x1, z0: mz, z1: b.z1, facing: 2 },
    ];
    for (const lot of lots) {
      const lw = lot.x1 - lot.x0;
      const ld = lot.z1 - lot.z0;
      const hw = r.range(16, Math.min(24, lw - 8));
      const hd = r.range(12, Math.min(17, ld - 14));
      const x0 = lot.x0 + (lw - hw) / 2 + r.range(-2, 2);
      const z0 = lot.facing === 0 ? lot.z0 + r.range(8, 11) : lot.z1 - r.range(8, 11) - hd;
      const fp = { x0, x1: x0 + hw, z0, z1: z0 + hd };
      const modern = r.chance(0.45);
      const floors = r.int(2, 3);
      const H = floors * 3.4;
      const col = modern ? r.pick([[0.93, 0.93, 0.92], [0.85, 0.84, 0.82], [0.3, 0.3, 0.32]] as RGB[]) : r.pick(PAL.plaster);
      const parts: BoxPart[] = [box(fp.x0, fp.x1, Y, Y + H, fp.z0, fp.z1, modern ? Facade.GlassDark : Facade.Plaster, col, modern ? Facade.RoofFlat : -1, 0, r.pick(PAL.roof))];
      if (modern) {
        // cantilevered upper volume
        const ox = r.range(-3, 3);
        parts.push(box(fp.x0 + ox, fp.x1 + ox - 4, Y + H, Y + H + 3.4, fp.z0 - 1.5, fp.z1 - 3, Facade.GlassDark, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
      }
      // garage wing
      parts.push(box(fp.x1, fp.x1 + 6.5, Y, Y + 3.2, fp.z0 + 1, fp.z0 + 7.5, Facade.Plain, col, Facade.RoofFlat, 0, r.pick(PAL.roof)));
      const bld = makeBuilding(b, 'mansion', fp, lot.facing, parts, r.int(0, 999));
      if (!modern) bld.gables.push({ x0: fp.x0 - 0.6, x1: fp.x1 + 0.6, z0: fp.z0 - 0.6, z1: fp.z1 + 0.6, y0: Y + H, h: r.range(3, 4), alongX: true, color: r.pick(PAL.tile) });
      addHomes(bld, 1, [1, 4], [1500, 3200], 1, r);
      // pool behind
      const pz0 = lot.facing === 0 ? fp.z1 + 3 : fp.z0 - 9;
      h.addGround(fp.x0 + 2, fp.x0 + 12, pz0, pz0 + 6, Y + 0.05, GroundKind.Water);
      h.addGround(fp.x0 + 1, fp.x0 + 13, pz0 - 1, pz0 + 7, Y + 0.03, GroundKind.Plaza);
      // driveway & car
      const dz0 = lot.facing === 0 ? lot.z0 : fp.z0 + 7.5;
      const dz1 = lot.facing === 0 ? fp.z0 + 1 : lot.z1;
      h.addGround(fp.x1 + 0.5, fp.x1 + 6, Math.min(dz0, dz1), Math.max(dz0, dz1), Y + 0.03, GroundKind.Concrete);
      if (r.chance(0.8)) h.addProp('car', fp.x1 + 3.25, lot.facing === 0 ? lot.z0 + 4 : lot.z1 - 4, lot.facing === 0 ? Math.PI : 0, 1, Y + 0.03, r.pick([2, 2, 1, 4]), r.int(0, 999));
      // hedges around the lot street side
      const hz = lot.facing === 0 ? lot.z0 + 0.6 : lot.z1 - 0.6;
      for (let x = lot.x0 + 1.5; x < lot.x1 - 1; x += 3) {
        if (x > fp.x1 - 0.5 && x < fp.x1 + 7) continue; // driveway gap
        h.addProp('hedge', x + 1.5, hz, 0, 1);
      }
      for (let t = 0; t < 5; t++) {
        const tx = r.range(lot.x0 + 2, lot.x1 - 2);
        const tz = r.range(lot.z0 + 2, lot.z1 - 2);
        if (tx > fp.x0 - 2 && tx < fp.x1 + 8 && tz > fp.z0 - 2 && tz < fp.z1 + 2) continue;
        h.addProp(r.weighted(['palm', 'tree', 'conifer'] as Prop['type'][], [2, 2, 1]), tx, tz, r.range(0, 6), r.range(0.9, 1.3));
      }
    }
  };

  // ---------------------------------------------------- district: industrial
  const doIndustrial = (b: Block, r: RNG) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const alongX = r.chance(0.5);
    const nLots = r.int(1, 2);
    const lots: Lot[] = [];
    if (nLots === 1) lots.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, facing: bestFacing(b, r) });
    else if (alongX) {
      const m = b.x0 + w * r.range(0.4, 0.6);
      lots.push({ x0: b.x0, x1: m, z0: b.z0, z1: b.z1, facing: 3 }, { x0: m, x1: b.x1, z0: b.z0, z1: b.z1, facing: 1 });
    } else {
      const m = b.z0 + d * r.range(0.4, 0.6);
      lots.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: m, facing: 0 }, { x0: b.x0, x1: b.x1, z0: m, z1: b.z1, facing: 2 });
    }
    for (const lot of lots) {
      const kind = !used.depot && r.chance(0.5) ? 'depot' : r.weighted(['warehouse', 'factory', 'yard'], [3, 2, 1]);
      const fp = inset(lot, r.range(6, 10), r.range(4, 7), r.range(5, 9));
      const col = r.pick(PAL.industrial);
      if (kind === 'yard') {
        // container yard with small office
        const off = { x0: fp.x0, x1: fp.x0 + 10, z0: fp.z0, z1: fp.z0 + 8 };
        const bld = makeBuilding(b, 'warehouse', off, lot.facing, [box(off.x0, off.x1, Y, Y + 6.5, off.z0, off.z1, Facade.Office, r.pick(PAL.concrete), Facade.RoofFlat, 0, r.pick(PAL.roof))], r.int(0, 999));
        addBusiness(bld, 'warehouse', r);
        for (let x = fp.x0 + 14; x < fp.x1 - 4; x += 3) {
          for (let z = fp.z0 + 4; z < fp.z1 - 7; z += 7.5) {
            const stack = r.int(0, 3);
            for (let s = 0; s < stack; s++) h.addProp('container', x, z + 3.2, 0, 1, Y + s * 2.6);
          }
        }
        continue;
      }
      const H = kind === 'factory' ? r.range(11, 16) : r.range(9, 13);
      const parts: BoxPart[] = [box(fp.x0, fp.x1, Y, Y + H, fp.z0, fp.z1, Facade.Industrial, col, Facade.RoofFlat, 0, r.pick(PAL.roof))];
      if (kind === 'factory') {
        // office annex + chimneys
        const ax0 = fp.x0;
        parts.push(box(ax0, ax0 + 12, Y, Y + 9.5, fp.z0 - 0.01, fp.z0 + 10, Facade.Office, r.pick(PAL.concrete), Facade.RoofFlat, 0, r.pick(PAL.roof)));
        const nc = r.int(1, 3);
        for (let k = 0; k < nc; k++) {
          const cx = fp.x1 - 5 - k * 6;
          const cz = (fp.z0 + fp.z1) / 2 + r.range(-4, 4);
          parts.push(box(cx - 1.1, cx + 1.1, Y + H, Y + H + r.range(14, 22), cz - 1.1, cz + 1.1, Facade.Brick, r.pick(PAL.brick), -1, 0, undefined, false));
        }
      } else {
        // loading docks on the front
        for (let k = 0; k < 3; k++) {
          const t = (k + 1) / 4;
          if (lot.facing === 0 || lot.facing === 2) {
            const x = fp.x0 + (fp.x1 - fp.x0) * t;
            const z = lot.facing === 0 ? fp.z0 : fp.z1;
            parts.push(box(x - 2.5, x + 2.5, Y, Y + 1.2, Math.min(z, z + (lot.facing === 0 ? -2.5 : 2.5)), Math.max(z, z + (lot.facing === 0 ? -2.5 : 2.5)), Facade.Plain, [0.5, 0.5, 0.5], Facade.RoofFlat, 0));
          }
        }
      }
      const bk: BuildingKind = kind === 'depot' ? 'depot' : kind === 'factory' ? 'factory' : 'warehouse';
      const bld = makeBuilding(b, bk, fp, lot.facing, parts, r.int(0, 999));
      if (kind === 'depot') {
        used.depot++;
        addBusiness(bld, 'depot', r, { name: 'Echo Express Couriers' });
        c.landmarks['depot'] = bld.id;
      } else addBusiness(bld, kind === 'factory' ? 'factory' : 'warehouse', r);
      roofClutter(bld, r, 2);
      // trucks / vans parked in the yard
      const nTr = r.int(1, 3);
      for (let k = 0; k < nTr; k++) {
        const px = r.range(lot.x0 + 4, lot.x1 - 4);
        const pz = lot.facing === 0 ? lot.z0 + 3 : lot.facing === 2 ? lot.z1 - 3 : r.range(lot.z0 + 4, lot.z1 - 4);
        if (px > fp.x0 - 3 && px < fp.x1 + 3 && pz > fp.z0 - 3 && pz < fp.z1 + 3) continue;
        h.addProp('car', px, pz, lot.facing === 1 || lot.facing === 3 ? 0 : Math.PI / 2, 1, Y, kind === 'depot' ? 6 : r.pick([5, 6]), r.int(0, 999));
      }
      h.addProp('dumpster', fp.x1 + 2, fp.z1 - 2, 0, 1);
      // fence along lot back
      for (let x = lot.x0 + 1.25; x < lot.x1 - 1; x += 2.5) h.addProp('fence', x, lot.facing === 0 ? lot.z1 - 0.3 : lot.z0 + 0.3, 0, 1, Y);
    }
  };

  // --------------------------------------------------- district: entertainment
  const doEntertainment = (b: Block, r: RNG) => {
    const roll = r.next();
    if (roll < 0.35) {
      // hotel tower + shops around
      const facing = bestFacing(b, r);
      const fp = { x0: b.x0 + 10, x1: b.x1 - 10, z0: b.z0 + 10, z1: b.z1 - 10 };
      const H = r.range(45, 85);
      const parts = towerParts(fp, H, r, facing);
      const bld = makeBuilding(b, 'hotel', fp, facing, parts, r.int(0, 999));
      addBusiness(bld, 'hotel', r);
      addBusiness(bld, 'restaurant', r, { primary: false });
      addBusiness(bld, 'bar', r, { primary: false });
      return;
    }
    if (roll < 0.55 && used.nightclub < 3) {
      used.nightclub++;
      const facing = bestFacing(b, r);
      const fp = { x0: b.x0 + 8, x1: b.x0 + 8 + r.range(24, 32), z0: b.z0 + 8, z1: b.z0 + 8 + r.range(24, 30) };
      // align footprint to the chosen facing side
      const fw = fp.x1 - fp.x0;
      const fd = fp.z1 - fp.z0;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const f2 =
        facing === 0
          ? { x0: cx - fw / 2, x1: cx + fw / 2, z0: b.z0 + 1, z1: b.z0 + 1 + fd }
          : facing === 2
            ? { x0: cx - fw / 2, x1: cx + fw / 2, z0: b.z1 - 1 - fd, z1: b.z1 - 1 }
            : facing === 1
              ? { x0: b.x1 - 1 - fd, x1: b.x1 - 1, z0: cz - fw / 2, z1: cz + fw / 2 }
              : { x0: b.x0 + 1, x1: b.x0 + 1 + fd, z0: cz - fw / 2, z1: cz + fw / 2 };
      const parts = [box(f2.x0, f2.x1, Y, Y + 9, f2.z0, f2.z1, Facade.Club, r.pick(PAL.club), Facade.RoofFlat, 0, r.pick(PAL.roof))];
      const bld = makeBuilding(b, 'club', f2, facing, parts, r.int(0, 999));
      addBusiness(bld, 'nightclub', r);
      h.addProp('billboard', bld.door.x, bld.door.z, [Math.PI, Math.PI / 2, 0, -Math.PI / 2][facing], 1, Y + 9.5, 1);
      // fill rest of block with bars/restaurants
      const lots = perimeterLots(b, r, () => r.range(18, 22), 12, 20).filter(
        (l) => !(l.x1 > f2.x0 - 2 && l.x0 < f2.x1 + 2 && l.z1 > f2.z0 - 2 && l.z0 < f2.z1 + 2),
      );
      for (const lot of lots) {
        const fp3 = inset(lot, 0, 0.4, 2);
        const bl = makeBuilding(b, 'shop', fp3, lot.facing, shopParts(fp3, r.int(2, 4), r, 'entertainment'), r.int(0, 999));
        addBusiness(bl, r.weighted(['bar', 'restaurant', 'fastfood', 'cafe'] as BusinessType[], [3, 3, 1, 1]), r);
      }
      return;
    }
    if (roll < 0.62 && used.cinema < 2) {
      used.cinema++;
      const facing = bestFacing(b, r);
      const fp = { x0: b.x0 + 6, x1: b.x1 - 6, z0: b.z0 + 6, z1: b.z1 - 6 };
      const parts = [
        box(fp.x0, fp.x1, Y, Y + 15, fp.z0, fp.z1, Facade.Plain, r.pick(PAL.concrete), Facade.RoofFlat, 6, r.pick(PAL.roof)),
      ];
      const bld = makeBuilding(b, 'cinema', fp, facing, parts, r.int(0, 999));
      addBusiness(bld, 'cinema', r);
      h.addProp('billboard', bld.door.x, bld.door.z, [Math.PI, Math.PI / 2, 0, -Math.PI / 2][facing], 1.6, Y + 7, 2);
      return;
    }
    doCommercial(b, r, true);
  };

  // ------------------------------------------------------------- parks etc
  const doPark = (b: Block, r: RNG) => {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    // cross paths
    h.addGround(b.x0, b.x1, cz - 2, cz + 2, CURB_H + 0.04, GroundKind.Plaza);
    h.addGround(cx - 2, cx + 2, b.z0, cz - 2, CURB_H + 0.04, GroundKind.Plaza);
    h.addGround(cx - 2, cx + 2, cz + 2, b.z1, CURB_H + 0.04, GroundKind.Plaza);
    if (b.special === 'centralPark') {
      h.addGround(cx - 26, cx - 8, cz + 8, cz + 26, CURB_H + 0.05, GroundKind.Water);
      h.addGround(cx - 28, cx - 6, cz + 6, cz + 28, CURB_H + 0.035, GroundKind.Sand);
    }
    h.addProp('fountain', cx, cz, 0, b.merged ? 1.3 : 0.9);
    const nTrees = Math.floor((w * d) / 160);
    for (let k = 0; k < nTrees; k++) {
      const x = r.range(b.x0 + 2, b.x1 - 2);
      const z = r.range(b.z0 + 2, b.z1 - 2);
      if (Math.abs(x - cx) < 4.5 || Math.abs(z - cz) < 4.5) continue;
      if (b.special === 'centralPark' && x > cx - 30 && x < cx - 4 && z > cz + 4 && z < cz + 30) continue;
      h.addProp(r.weighted(['tree', 'conifer', 'bush'] as Prop['type'][], [5, 2, 2]), x, z, r.range(0, 6), r.range(0.8, 1.4));
    }
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6;
      const x = b.x0 + w * t;
      if (Math.abs(x - cx) < 6) continue;
      h.addProp('bench', x, cz - 3.2, 0);
      h.addProp('bench', x, cz + 3.2, Math.PI);
      if (k % 2 === 0) h.addProp('lampClassic', x, cz - 2.6, 0);
    }
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const z = b.z0 + d * t;
      if (Math.abs(z - cz) < 6) continue;
      h.addProp('lampClassic', cx + 2.6, z, Math.PI / 2);
    }
    if (b.district === 'residential') h.addProp('playground', cx + w * 0.25, cz - d * 0.25, 0, 1);
    h.addProp('picnic', cx + w * 0.28, cz + d * 0.22, r.range(0, 3));
    h.addProp('picnic', cx + w * 0.18, cz + d * 0.3, r.range(0, 3));
    const name = b.special === 'centralPark' ? 'Echo Central Park' : `${c.segments[h.segH[b.bj][b.bi]].name.split(' ')[0]} Park`;
    c.outdoor.push({ id: c.outdoor.length, kind: 'park', name, x: cx, z: cz, radius: Math.min(w, d) * 0.4, block: b.id, access: { edge: 0, t: 0, x: cx, z: cz }, district: b.district });
    c.outdoor.push({ id: c.outdoor.length, kind: 'park', name, x: cx + w * 0.25, z: cz + d * 0.25, radius: 8, block: b.id, access: { edge: 0, t: 0, x: cx, z: cz }, district: b.district });
    if (b.merged) c.landmarks['centralPark'] = b.id;
  };

  const doPlaza = (b: Block, r: RNG) => {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    if (b.special === 'civicPlaza' && !used.cityhall) {
      used.cityhall++;
      // City hall on the north half
      const fp = { x0: cx - 22, x1: cx + 22, z0: b.z0 + 4, z1: b.z0 + 26 };
      const stone: RGB = [0.82, 0.8, 0.74];
      const parts: BoxPart[] = [
        box(fp.x0, fp.x1, Y, Y + 1.2, fp.z0, fp.z1 + 5, Facade.Plain, [0.7, 0.69, 0.65], Facade.RoofFlat),
        box(fp.x0 + 2, fp.x1 - 2, Y + 1.2, Y + 16, fp.z0, fp.z1, Facade.Plaster, stone, Facade.RoofFlat, 0, [0.4, 0.42, 0.4]),
        box(cx - 7, cx + 7, Y + 16, Y + 24, fp.z0 + 4, fp.z1 - 4, Facade.Plaster, stone, Facade.RoofFlat, 0, [0.35, 0.5, 0.45]),
      ];
      for (let k = 0; k < 8; k++) {
        const x = fp.x0 + 6 + k * ((fp.x1 - fp.x0 - 12) / 7);
        parts.push(box(x - 0.55, x + 0.55, Y + 1.2, Y + 14, fp.z1 + 1.5, fp.z1 + 2.6, Facade.Plain, stone, -1, 0, undefined, true));
      }
      parts.push(box(fp.x0 + 3, fp.x1 - 3, Y + 14, Y + 16, fp.z1 - 0.5, fp.z1 + 3.2, Facade.Plain, stone, Facade.RoofFlat, 0, undefined, false));
      const bld = makeBuilding(b, 'cityhall', fp, 2, parts, r.int(0, 999));
      bld.door = { x: cx, z: fp.z1 + 0.2 };
      addBusiness(bld, 'cityhall', r, { name: 'Echo City Hall' });
      c.landmarks['cityhall'] = bld.id;
      h.addGround(b.x0, b.x1, fp.z1 + 5, b.z1, Y + 0.04, GroundKind.Plaza);
      h.addProp('fountain', cx, (fp.z1 + b.z1) / 2 + 4, 0, 1.4);
      c.outdoor.push({ id: c.outdoor.length, kind: 'plaza', name: 'Civic Plaza', x: cx, z: (fp.z1 + b.z1) / 2 + 4, radius: 14, block: b.id, access: { edge: 0, t: 0, x: cx, z: cz }, district: b.district });
      for (let k = 0; k < 6; k++) {
        const x = b.x0 + 8 + k * ((b.x1 - b.x0 - 16) / 5);
        h.addProp('tree', x, b.z1 - 5, r.range(0, 6), 1.1);
        h.addProp('planter', x, b.z1 - 5, 0, 1);
        h.addProp('lampClassic', x, fp.z1 + 9, 0);
      }
      return;
    }
    h.addProp('fountain', cx, cz, 0, 1.5);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      h.addProp('bench', cx + Math.cos(a) * 10, cz + Math.sin(a) * 10, -a + Math.PI / 2);
      h.addProp(k % 2 ? 'lampClassic' : 'planter', cx + Math.cos(a) * 15, cz + Math.sin(a) * 15, -a);
    }
    for (let k = 0; k < 10; k++) {
      const x = r.range(b.x0 + 3, b.x1 - 3);
      const z = r.range(b.z0 + 3, b.z1 - 3);
      if (Math.hypot(x - cx, z - cz) < 19) continue;
      h.addProp('tree', x, z, r.range(0, 6), 1);
    }
    if (b.special === 'neonPlaza') {
      h.addProp('billboard', b.x0 + 4, cz, Math.PI / 2, 2, Y + 6, 3);
      h.addProp('billboard', b.x1 - 4, cz, -Math.PI / 2, 2, Y + 6, 4);
    }
    c.outdoor.push({ id: c.outdoor.length, kind: 'plaza', name: b.special === 'neonPlaza' ? 'Neon Square' : 'Market Square', x: cx, z: cz, radius: 14, block: b.id, access: { edge: 0, t: 0, x: cx, z: cz }, district: b.district });
  };

  const doParkingLot = (b: Block, r: RNG) => {
    h.addGround(b.x0 + 2, b.x1 - 2, b.z0 + 2, b.z1 - 2, Y + 0.04, GroundKind.Parking);
    for (let z = b.z0 + 8; z < b.z1 - 6; z += 14) {
      for (let x = b.x0 + 5; x < b.x1 - 4; x += 3) {
        if (r.chance(0.6)) h.addProp('car', x, z, 0, 1, Y + 0.04, r.int(0, 4), r.int(0, 999));
        if (r.chance(0.6)) h.addProp('car', x, z + 5.5, Math.PI, 1, Y + 0.04, r.int(0, 4), r.int(0, 999));
      }
      h.addProp('lamp', (b.x0 + b.x1) / 2, z + 2.8, 0);
    }
  };

  // ------------------------------------------------------------- dispatch
  // deterministic special assignments first: dealership + taxi company in the commercial district
  const blocksSorted = [...c.blocks];
  for (const b of blocksSorted) {
    const r = rng.fork(1000 + b.id);
    if (b.use === 'park') doPark(b, r);
    else if (b.use === 'plaza') doPlaza(b, r);
    else if (b.use === 'parking') doParkingLot(b, r);
    else {
      switch (b.district) {
        case 'downtown':
          doDowntown(b, r);
          break;
        case 'commercial':
          doCommercial(b, r);
          break;
        case 'residential':
          doResidential(b, r);
          break;
        case 'wealthy':
          doWealthy(b, r);
          break;
        case 'industrial':
          doIndustrial(b, r);
          break;
        case 'entertainment':
          doEntertainment(b, r);
          break;
      }
    }
  }

  // ---------------------------------------------------- guaranteed landmarks
  const commercialCenter = c.districtCenters.find((d) => d.id === 'commercial')!;
  const byDist = (pred: (b: Building) => boolean, cx: number, cz: number) =>
    c.buildings
      .filter(pred)
      .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.z0 + a.z1) / 2 - cz) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz));

  const convertShop = (bld: Building, type: BusinessType, name: string, landmark: string) => {
    // replace primary business of a shop building
    if (bld.businesses.length) {
      const old = c.businesses[bld.businesses[0]];
      old.type = type;
      old.name = name;
      old.interior = INTERIOR[type] ?? null;
      old.goods = GOODS[type];
      const [o, cl] = HOURS[type] ?? [9, 17];
      old.open = o;
      old.close = cl;
      old.jobs = [];
      const rr = rng.fork(landmark);
      for (const t of JOBS[type] ?? []) {
        const count = rr.int(t.count[0], t.count[1]);
        if (count > 0) old.jobs.push({ role: t.role, count, wage: Math.round(rr.range(t.wage[0], t.wage[1])), start: t.start, end: t.end, days: t.days ?? ALLDAYS });
      }
      bld.interior = old.interior;
    } else addBusiness(bld, type, rng.fork(landmark), { name });
    bld.name = name;
    bld.forSale = false;
    c.landmarks[landmark] = bld.id;
  };

  if (!used.bank) {
    const t = byDist((b) => b.kind === 'tower', downtownCenter.x, downtownCenter.z)[0] ?? byDist((b) => b.kind === 'shop', downtownCenter.x, downtownCenter.z)[0];
    if (t) convertShop(t, 'bank', 'First Echo Bank', 'bank');
  }
  const shops = byDist((b) => b.kind === 'shop' && b.district === 'commercial' && b.businesses.length > 0, commercialCenter.x, commercialCenter.z);
  if (shops.length > 2) {
    const dealer = shops[Math.min(3, shops.length - 1)];
    convertShop(dealer, 'dealership', 'Echo Motors', 'dealership');
    const taxiShop = shops.find((s) => s.id !== dealer.id && c.businesses[s.businesses[0]]?.type !== 'bank' && s.district === 'commercial' && Math.abs(s.id - dealer.id) > 3);
    if (taxiShop) convertShop(taxiShop, 'taxi', 'Echo Cabs', 'taxi');
  }
  if (!used.depot) {
    const w = byDist((b) => b.kind === 'warehouse' || b.kind === 'factory', commercialCenter.x, commercialCenter.z)[0];
    if (w) {
      convertShop(w, 'depot', 'Echo Express Couriers', 'depot');
      w.kind = 'depot';
    }
  }
  // make sure there are a few cafes and convenience stores close to the player home later
  // ---------------------------------------------------------------- player home
  const homeCandidates = byDist(
    (b) => b.kind === 'apartment' && b.district === 'residential' && b.homes.length >= 6,
    commercialCenter.x,
    commercialCenter.z,
  );
  const ph = homeCandidates[0] ?? byDist((b) => b.homes.length > 0, 0, 0)[0];
  c.playerHome = ph.id;
  // remove ground floor business so the door leads to the lobby / apartment
  ph.interior = 'apartment';
  ph.name = `${ph.address.split(' ').slice(1).join(' ')} Apartments`;
  c.homes.push({ id: c.homes.length, building: ph.id, unit: 'Apt 3B', capacity: 1, rent: 210, quality: 0.3 });
  c.playerHomeId = c.homes.length - 1;
  c.landmarks['home'] = ph.id;
  // businesses in the player's building move to "secondary" (still exist for the sim)

  // a nearby cafe for the tutorial
  const cafes = byDist((b) => b.businesses.some((id) => c.businesses[id].type === 'cafe') && b.interior === 'cafe', (ph.x0 + ph.x1) / 2, (ph.z0 + ph.z1) / 2);
  if (cafes[0]) c.landmarks['tutorialCafe'] = cafes[0].id;

  // Outdoor spot access edges
  for (const o of c.outdoor) {
    let best = { edge: 0, t: 0, x: o.x, z: o.z };
    let bd = Infinity;
    for (const e of c.swEdges) {
      if (e.kind !== 'walk') continue;
      const a = c.swNodes[e.a];
      const bb = c.swNodes[e.b];
      const pr = pointSegment(o.x, o.z, a.x, a.z, bb.x, bb.z);
      if (pr.d < bd) {
        bd = pr.d;
        best = { edge: e.id, t: pr.t, x: pr.x, z: pr.z };
      }
    }
    o.access = best;
  }
}
