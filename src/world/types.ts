// Static (seed-derived) city data. Everything here is regenerated identically
// from the world seed; dynamic simulation state lives in /sim.

export const PITCH = 96; // distance between parallel road centerlines
export const SW = 4; // sidewalk width (also crosswalk width)
export const LANE_W = 3.5;
export const CURB_H = 0.15;
export const ARTERIAL_HW = 7.5;
export const LOCAL_HW = 6;
export const PARK_LANE_W = 2.5;
export const CHUNK_SIZE = 192;

export type DistrictId = 'downtown' | 'residential' | 'commercial' | 'industrial' | 'wealthy' | 'entertainment';
export const DISTRICT_IDS: DistrictId[] = ['downtown', 'residential', 'commercial', 'industrial', 'wealthy', 'entertainment'];
export const DISTRICT_INFO: Record<DistrictId, { name: string; color: string; wealth: number }> = {
  downtown: { name: 'Downtown', color: '#5aa9ff', wealth: 0.75 },
  residential: { name: 'Maplewood', color: '#7bd88f', wealth: 0.45 },
  commercial: { name: 'Market Quarter', color: '#ffb35a', wealth: 0.55 },
  industrial: { name: 'Ironworks', color: '#b0a08a', wealth: 0.3 },
  wealthy: { name: 'Bayview Heights', color: '#e7c66b', wealth: 1.0 },
  entertainment: { name: 'Neon Row', color: '#ff5ac8', wealth: 0.6 },
};

export type RoadClass = 'arterial' | 'local';

export interface RoadLine {
  idx: number;
  /** 'v' lines sit at fixed x and run along z (north-south). 'h' lines sit at fixed z and run along x. */
  orient: 'v' | 'h';
  pos: number;
  cls: RoadClass;
  hw: number;
  lanesPerDir: number;
  parking: boolean;
  name: string;
}

export interface Intersection {
  id: number;
  i: number;
  j: number;
  x: number;
  z: number;
  /** half extents of the road overlap box */
  hx: number;
  hz: number;
  /** segment ids per arm: 0=N(-z) 1=E(+x) 2=S(+z) 3=W(-x), -1 if missing */
  arms: [number, number, number, number];
  signalized: boolean;
  signalOffset: number;
}

export interface RoadSegment {
  id: number;
  orient: 'v' | 'h';
  line: number; // index into vLines/hLines
  a: number; // intersection id at start (smaller coordinate)
  b: number; // intersection id at end
  /** centerline endpoints at intersection-zone edges */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  length: number;
  hw: number;
  cls: RoadClass;
  lanesPerDir: number;
  parking: boolean;
  name: string;
  exists: boolean; // false where blocks were merged into a park
  speedLimit: number;
}

export type BlockUse = 'buildings' | 'park' | 'plaza' | 'parking';

export interface Block {
  id: number;
  bi: number;
  bj: number;
  /** interior lot area (inside sidewalks) */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  district: DistrictId;
  use: BlockUse;
  merged: boolean;
  special?: string;
}

/** Facade styles understood by the building shader. */
export const enum Facade {
  Glass = 0,
  Office = 1,
  Brick = 2,
  Plaster = 3,
  House = 4,
  Industrial = 5,
  Plain = 6,
  Store = 7,
  RoofFlat = 8,
  RoofTile = 9,
  GlassDark = 10,
  Club = 11,
}

export interface BoxPart {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  style: number;
  roof: number; // roof style for the top face, -1 = no top
  color: [number, number, number];
  roofColor?: [number, number, number];
  ground: number; // storefront height (0 none)
  collide: boolean;
}

export interface GableRoof {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  h: number;
  /** ridge runs along x if true, else along z */
  alongX: boolean;
  color: [number, number, number];
}

export type BuildingKind =
  | 'tower'
  | 'office'
  | 'apartment'
  | 'house'
  | 'mansion'
  | 'shop'
  | 'mall'
  | 'warehouse'
  | 'factory'
  | 'hotel'
  | 'cinema'
  | 'club'
  | 'school'
  | 'cityhall'
  | 'dealership'
  | 'bank'
  | 'depot';

export type InteriorType =
  | 'apartment'
  | 'cafe'
  | 'restaurant'
  | 'store'
  | 'clothing'
  | 'office'
  | 'bank'
  | 'dealership'
  | 'bar'
  | 'club'
  | 'depot'
  | 'hotel'
  | 'gym'
  | 'cinema';

export interface Building {
  id: number;
  blockId: number;
  district: DistrictId;
  kind: BuildingKind;
  /** footprint bounds (axis aligned) */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  floors: number;
  facing: 0 | 1 | 2 | 3; // 0=N(-z) 1=E(+x) 2=S(+z) 3=W(-x)
  parts: BoxPart[];
  gables: GableRoof[];
  door: { x: number; z: number };
  /** sidewalk edge used for pedestrian access */
  access: { edge: number; t: number; x: number; z: number };
  segment: number;
  street: string;
  number: number;
  address: string;
  homes: number[];
  businesses: number[];
  interior: InteriorType | null;
  name?: string;
  seed: number;
  chunk: number;
  forSale?: boolean;
}

export type BusinessType =
  | 'cafe'
  | 'restaurant'
  | 'fastfood'
  | 'grocery'
  | 'convenience'
  | 'clothing'
  | 'electronics'
  | 'bookstore'
  | 'pharmacy'
  | 'office'
  | 'bank'
  | 'dealership'
  | 'bar'
  | 'nightclub'
  | 'hotel'
  | 'cinema'
  | 'gym'
  | 'salon'
  | 'warehouse'
  | 'factory'
  | 'depot'
  | 'school'
  | 'cityhall'
  | 'taxi';

export interface JobSlot {
  role: string;
  count: number;
  wage: number; // per hour
  start: number; // hour
  end: number; // hour (may exceed 24 for overnight)
  days: number[]; // 0=Mon..6=Sun
}

export interface BusinessDef {
  id: number;
  name: string;
  type: BusinessType;
  building: number;
  district: DistrictId;
  jobs: JobSlot[];
  priceLevel: number;
  capacity: number;
  open: number;
  close: number;
  interior: InteriorType | null;
  goods: 'food' | 'drink' | 'retail' | 'service' | 'industrial' | 'none';
}

export interface HomeDef {
  id: number;
  building: number;
  unit: string;
  capacity: number;
  rent: number; // per week
  quality: number; // 0..1
}

export type OutdoorKind = 'park' | 'plaza' | 'promenade' | 'busstop';
export interface OutdoorSpot {
  id: number;
  kind: OutdoorKind;
  name: string;
  x: number;
  z: number;
  radius: number;
  block: number;
  /** nearest sidewalk edge for nav */
  access: { edge: number; t: number; x: number; z: number };
  district: DistrictId;
}

export type PropType =
  | 'tree'
  | 'conifer'
  | 'palm'
  | 'lamp'
  | 'lampClassic'
  | 'signalPole'
  | 'stopSign'
  | 'hydrant'
  | 'bench'
  | 'bin'
  | 'busStop'
  | 'planter'
  | 'bollard'
  | 'fountain'
  | 'hedge'
  | 'fence'
  | 'container'
  | 'crane'
  | 'billboard'
  | 'bush'
  | 'picnic'
  | 'playground'
  | 'dumpster'
  | 'acUnit'
  | 'waterTank'
  | 'antenna'
  | 'streetSign'
  | 'railing'
  | 'meter'
  | 'car';

export interface Prop {
  type: PropType;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  /** variant / tint seed */
  v: number;
  chunk: number;
  /** extra: for signals the intersection id, for street signs name indices */
  ref?: number;
  ref2?: number;
}

/** Signal heads: per intersection approach, rendered with dynamic colors. */
export interface SignalHead {
  inter: number;
  axis: 'v' | 'h'; // which traffic flow it controls
  x: number;
  y: number;
  z: number;
  rot: number;
  chunk: number;
}

export interface ParkingSpot {
  id: number;
  seg: number;
  dir: 1 | -1;
  s: number; // distance along the directed lane
  x: number;
  z: number;
  rot: number;
  occupiedStatic: boolean;
  staticType: number;
  staticColor: number;
  chunk: number;
}

export interface GroundQuad {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
  kind: number; // ground material index (see GroundKind)
  chunk: number;
}

export const enum GroundKind {
  Asphalt = 0,
  Sidewalk = 1,
  Grass = 2,
  Plaza = 3,
  Dirt = 4,
  Parking = 5,
  Water = 6,
  Concrete = 7,
  Sand = 8,
  Lawn = 9,
}

export interface Marking {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  w: number;
  color: 0 | 1; // white / yellow
  chunk: number;
}

export interface SidewalkNode {
  id: number;
  x: number;
  z: number;
  inter: number;
  corner: number;
}
export interface SidewalkEdge {
  id: number;
  a: number;
  b: number;
  length: number;
  /** 'walk' along a sidewalk, 'cross' over a road at a crosswalk, 'link' continuation at missing arm */
  kind: 'walk' | 'cross' | 'link';
  /** for crossings: the traffic axis being crossed */
  crossAxis?: 'v' | 'h';
  inter?: number;
}

export interface ChunkInfo {
  id: number;
  cx: number;
  cz: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface CityData {
  seed: number;
  n: number;
  vLines: RoadLine[];
  hLines: RoadLine[];
  intersections: Intersection[];
  segments: RoadSegment[];
  blocks: Block[];
  buildings: Building[];
  businesses: BusinessDef[];
  homes: HomeDef[];
  outdoor: OutdoorSpot[];
  props: Prop[];
  signals: SignalHead[];
  parking: ParkingSpot[];
  ground: GroundQuad[];
  markings: Marking[];
  swNodes: SidewalkNode[];
  swEdges: SidewalkEdge[];
  /** adjacency: node -> edge ids */
  swAdj: number[][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  shoreX: number;
  chunks: ChunkInfo[];
  chunkCols: number;
  chunkRows: number;
  chunkOrigin: { x: number; z: number };
  districtCenters: { id: DistrictId; x: number; z: number }[];
  /** grid of district per block for quick lookup (bj * n + bi) */
  blockGrid: number[];
  playerHome: number; // building id
  playerHomeId: number; // home id
  landmarks: Record<string, number>; // name -> building id
}
