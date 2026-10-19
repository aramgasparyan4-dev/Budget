import * as THREE from 'three';
import { RoadGraph, Lane, Connector } from './RoadGraph';
import type { CityData, ParkingSpot } from '../../world/types';
import { VEHICLES, pickTrafficType } from '../vehicles';
import { clamp } from '../../core/math';
import { RNG } from '../../core/rng';
import { RAPIER, Physics, GROUP, groups } from '../../engine/Physics';

export type VState = 'drive' | 'parking' | 'parked' | 'unpark' | 'crash' | 'stopped';

export interface TVehicle {
  id: number;
  type: number;
  paint: THREE.Color;
  lane: number;
  conn: number;
  s: number;
  v: number;
  vDes: number;
  len: number;
  route: number[];
  lat: number;
  state: VState;
  stopT: number;
  arrive: number;
  committed: boolean;
  park: ParkingSpot | null;
  parkLat: number;
  driver: number;
  x: number;
  z: number;
  yaw: number;
  yawRate: number;
  wheelRot: number;
  brake: boolean;
  blink: number; // -1 left, 1 right, 0 none
  hazard: boolean;
  crashT: number;
  honkT: number;
  blockedT: number;
  body: RAPIER.RigidBody | null;
  purpose: 'traffic' | 'npc' | 'taxi' | 'bus' | 'delivery';
  life: number;
  aggression: number; // 0..1 from driver personality
  /** user data for game systems (e.g. passenger, job) */
  tag?: string;
  onArrive?: (v: TVehicle) => void;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
  kind: 'player' | 'playerCar' | 'ped' | 'event';
}

const SIG_Y = 3;
const SIG_AR = 1.5;

function trafficCurve(h: number) {
  const g = (mu: number, s: number) => Math.exp(-((h - mu) ** 2) / (2 * s * s));
  const night = h < 5 || h > 23 ? 1 : 0;
  return clamp(0.14 + 0.78 * g(8.2, 1.15) + 0.85 * g(17.6, 1.45) + 0.42 * g(13, 2.8) + 0.3 * g(20.6, 1.6) - night * 0.04, 0.08, 1.2);
}

export class TrafficSystem {
  graph: RoadGraph;
  vehicles: TVehicle[] = [];
  laneVeh: TVehicle[][] = [];
  connVeh: TVehicle[][] = [];
  interWait: Set<TVehicle>[] = [];
  parked: TVehicle[] = [];
  private nextId = 1;
  private rng: RNG;
  time = 0;
  density = 1;
  /** power outage: signals flash */
  outage = new Set<number>();
  /** lanes blocked by events (accidents / construction) at an s range */
  blocks: { lane: number; s0: number; s1: number }[] = [];
  obstacles: Obstacle[] = [];
  center = new THREE.Vector3();
  camFwd = new THREE.Vector2(0, 1);
  spawnRadius = { min: 120, max: 290, despawn: 340 };
  enabled = true;
  usedSpots = new Set<number>();
  onHonk: ((v: TVehicle) => void) | null = null;
  onDespawn: ((v: TVehicle) => void) | null = null;
  private spawnTimer = 0;
  private bodyPool: RAPIER.RigidBody[] = [];
  private pose = { x: 0, z: 0, yaw: 0 };
  hour = 8;
  maxVehicles = 70;
  colliderToVehicle = new Map<number, TVehicle>();

  constructor(public city: CityData, private physics: Physics | null, seed: number) {
    this.graph = new RoadGraph(city);
    this.rng = new RNG(seed ^ 0x7a11c);
    for (let i = 0; i < this.graph.lanes.length; i++) this.laneVeh.push([]);
    for (let i = 0; i < this.graph.conns.length; i++) this.connVeh.push([]);
    for (let i = 0; i < city.intersections.length; i++) this.interWait.push(new Set());
  }

  // ------------------------------------------------------------------ signals
  signalPhase(inter: number, axis: 'v' | 'h', t = this.time): 0 | 1 | 2 | 3 {
    const it = this.city.intersections[inter];
    if (!it.signalized) return 3;
    if (this.outage.has(inter)) return 3;
    const gv = this.city.vLines[it.i].cls === 'arterial' ? 22 : 13;
    const gh = this.city.hLines[it.j].cls === 'arterial' ? 22 : 13;
    const cycle = gv + SIG_Y + SIG_AR + gh + SIG_Y + SIG_AR;
    const p = (((t + it.signalOffset) % cycle) + cycle) % cycle;
    if (axis === 'v') {
      if (p < gv) return 0;
      if (p < gv + SIG_Y) return 1;
      return 2;
    }
    const q = p - (gv + SIG_Y + SIG_AR);
    if (q >= 0 && q < gh) return 0;
    if (q >= gh && q < gh + SIG_Y) return 1;
    return 2;
  }

  /** for the ChunkManager signal heads: 0 green 1 yellow 2 red 3 flashing */
  signalColor = (inter: number, axis: 'v' | 'h'): 0 | 1 | 2 | 3 => {
    const ph = this.signalPhase(inter, axis);
    return ph;
  };

  /** pedestrians may cross the arm whose traffic runs along `crossAxis` when that traffic is red */
  walkSignal(inter: number, crossAxis: 'v' | 'h'): 'walk' | 'dont' | 'free' {
    const it = this.city.intersections[inter];
    if (!it.signalized || this.outage.has(inter)) return 'free';
    const ph = this.signalPhase(inter, crossAxis);
    const other = this.signalPhase(inter, crossAxis === 'v' ? 'h' : 'v');
    return ph === 2 && other === 0 ? 'walk' : 'dont';
  }

  // ------------------------------------------------------------------ spawning
  private laneDist(l: Lane, x: number, z: number) {
    const mx = (l.x0 + l.x1) / 2;
    const mz = (l.z0 + l.z1) / 2;
    return Math.hypot(mx - x, mz - z);
  }

  spawn(laneId: number, s: number, type = pickTrafficType(this.rng.next()), opts: Partial<TVehicle> = {}): TVehicle | null {
    const lane = this.graph.lanes[laneId];
    if (!lane) return null;
    const spec = VEHICLES[type];
    // spacing
    for (const o of this.laneVeh[laneId]) if (Math.abs(o.s - s) < spec.length + 8) return null;
    const v: TVehicle = {
      id: this.nextId++,
      type,
      paint: new THREE.Color(spec.palette[Math.floor(this.rng.next() * spec.palette.length)]),
      lane: laneId,
      conn: -1,
      s,
      v: lane.speed * 0.6,
      vDes: spec.cruise * (0.88 + this.rng.next() * 0.22),
      len: spec.length,
      route: [lane.link],
      lat: 0,
      state: 'drive',
      stopT: 0,
      arrive: 0,
      committed: false,
      park: null,
      parkLat: 0,
      driver: -1,
      x: 0,
      z: 0,
      yaw: 0,
      yawRate: 0,
      wheelRot: 0,
      brake: false,
      blink: 0,
      hazard: false,
      crashT: 0,
      honkT: 0,
      blockedT: 0,
      body: null,
      purpose: 'traffic',
      life: 0,
      aggression: this.rng.next(),
      ...opts,
    };
    this.planRandomRoute(v);
    this.insertLane(v, laneId);
    this.vehicles.push(v);
    this.updatePose(v);
    return v;
  }

  planRandomRoute(v: TVehicle, near?: { x: number; z: number }) {
    const cur = this.graph.lanes[v.lane >= 0 ? v.lane : this.graph.conns[v.conn].to].link;
    for (let tries = 0; tries < 6; tries++) {
      const tgt = this.graph.lanes[Math.floor(this.rng.next() * this.graph.lanes.length)];
      const cx = near?.x ?? this.center.x;
      const cz = near?.z ?? this.center.z;
      if (this.laneDist(tgt, cx, cz) > 650) continue;
      const r = this.graph.route(cur, tgt.link);
      if (r && r.length > 2) {
        v.route = r;
        return true;
      }
    }
    const link = this.graph.links[cur];
    v.route = [cur, ...(link.next.length ? [link.next[Math.floor(this.rng.next() * link.next.length)]] : [])];
    return false;
  }

  /** Route a vehicle to a destination point (parks at nearest free spot if possible). */
  routeTo(v: TVehicle, x: number, z: number, park = true) {
    const cur = this.graph.lanes[v.lane >= 0 ? v.lane : this.graph.conns[v.conn].to].link;
    let spot: ParkingSpot | null = null;
    if (park) spot = this.findSpot(x, z, 70);
    let goalLink: number;
    if (spot) goalLink = spot.seg * 2 + (spot.dir === 1 ? 0 : 1);
    else {
      const nl = this.graph.nearestLane(x, z);
      if (!nl) return false;
      goalLink = nl.lane.link;
    }
    const r = this.graph.route(cur, goalLink);
    if (!r) return false;
    v.route = r;
    if (spot) {
      if (v.park) this.usedSpots.delete(v.park.id);
      v.park = spot;
      this.usedSpots.add(spot.id);
    }
    return true;
  }

  findSpot(x: number, z: number, maxD: number): ParkingSpot | null {
    let best: ParkingSpot | null = null;
    let bd = maxD;
    for (const p of this.city.parking) {
      if (p.occupiedStatic || this.usedSpots.has(p.id)) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private insertLane(v: TVehicle, laneId: number) {
    const list = this.laneVeh[laneId];
    let i = list.length;
    while (i > 0 && list[i - 1].s > v.s) i--;
    list.splice(i, 0, v);
    v.lane = laneId;
    v.conn = -1;
  }
  private removeFromLists(v: TVehicle) {
    if (v.lane >= 0) {
      const l = this.laneVeh[v.lane];
      const i = l.indexOf(v);
      if (i >= 0) l.splice(i, 1);
    }
    if (v.conn >= 0) {
      const l = this.connVeh[v.conn];
      const i = l.indexOf(v);
      if (i >= 0) l.splice(i, 1);
    }
    for (const w of this.interWait) w.delete(v);
  }

  remove(v: TVehicle) {
    this.removeFromLists(v);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    const pi = this.parked.indexOf(v);
    if (pi >= 0) this.parked.splice(pi, 1);
    if (v.park) this.usedSpots.delete(v.park.id);
    this.releaseBody(v);
    this.onDespawn?.(v);
  }

  /** Detach a vehicle from traffic (the player takes it). */
  extract(v: TVehicle) {
    this.removeFromLists(v);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    const pi = this.parked.indexOf(v);
    if (pi >= 0) this.parked.splice(pi, 1);
    if (v.park) this.usedSpots.delete(v.park.id);
    this.releaseBody(v);
  }

  private trySpawnAround() {
    const target = Math.round(this.maxVehicles * this.density * trafficCurve(this.hour));
    const driving = this.vehicles.length;
    if (driving >= target) return;
    const lanes = this.graph.lanes;
    for (let attempt = 0; attempt < 8; attempt++) {
      const l = lanes[Math.floor(this.rng.next() * lanes.length)];
      const s = 6 + this.rng.next() * Math.max(1, l.length - 12);
      const x = l.x0 + l.dx * s;
      const z = l.z0 + l.dz * s;
      const d = Math.hypot(x - this.center.x, z - this.center.z);
      if (d < this.spawnRadius.min || d > this.spawnRadius.max) continue;
      // avoid popping in plain view
      const toX = (x - this.center.x) / d;
      const toZ = (z - this.center.z) / d;
      if (d < 200 && toX * this.camFwd.x + toZ * this.camFwd.y > 0.35) continue;
      if (this.blocked(l.id, s)) continue;
      const v = this.spawn(l.id, s);
      if (v) return;
    }
  }

  private blocked(lane: number, s: number) {
    for (const b of this.blocks) if (b.lane === lane && s > b.s0 - 10 && s < b.s1 + 10) return true;
    return false;
  }

  // ------------------------------------------------------------------ rules
  private nextLink(v: TVehicle): number {
    return v.route.length > 1 ? v.route[1] : -1;
  }
  private nextConn(v: TVehicle): Connector | null {
    if (v.lane < 0) return null;
    const nl = this.nextLink(v);
    if (nl < 0) return null;
    return this.graph.connTo(v.lane, nl);
  }

  private mayEnter(v: TVehicle, c: Connector, remain: number): boolean {
    const it = this.city.intersections[c.inter];
    const lane = this.graph.lanes[v.lane];
    const phase = this.signalPhase(c.inter, lane.axis);
    if (phase === 2) return false;
    if (phase === 1) {
      if (remain > (v.v * v.v) / (2 * 3.2) + 0.5) return false;
    }
    if (phase === 3) {
      // stop sign / flashing: full stop then first-come
      if (v.stopT < 0.7) return false;
      for (const o of this.interWait[c.inter]) {
        if (v.stopT > 12) break; // deadlock breaker
        if (o === v || o.arrive >= v.arrive || o.committed) continue;
        const oc = this.nextConn(o);
        if (oc && (oc.conflicts.includes(c.id) || oc.id === c.id)) return false;
      }
    }
    for (const cid of c.conflicts) if (this.connVeh[cid].length > 0) return false;
    if (phase === 0 && c.turn !== 'S') {
      // yield to oncoming / crossing flows that are also green
      for (const cid of c.conflicts) {
        const oc = this.graph.conns[cid];
        if (oc.from === c.from) continue;
        const ol = this.laneVeh[oc.from];
        for (let i = ol.length - 1; i >= 0; i--) {
          const o = ol[i];
          const orem = this.graph.lanes[oc.from].length - o.s;
          if (orem > 38) break;
          // only yield to traffic that is actually coming through (moving or already committed)
          if (!o.committed && (o.v < 1.5 || orem > o.v * 3.2 + 4)) continue;
          const onc = this.nextConn(o);
          if (onc && onc.id === oc.id) {
            if (c.turn === 'L' || oc.turn === 'S') return false;
          }
        }
      }
    }
    // don't block the box
    const tl = this.laneVeh[c.to];
    if (tl.length && tl[0].s < tl[0].len + 3 && tl[0].v < 3) return false;
    void it;
    return true;
  }

  // ------------------------------------------------------------------ update
  update(dt: number, center: THREE.Vector3, camFwd: THREE.Vector2, hour: number) {
    if (!this.enabled) return;
    this.time += dt;
    this.hour = hour;
    this.center.copy(center);
    this.camFwd.copy(camFwd);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.15;
      this.trySpawnAround();
    }
    // despawn far vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.life += dt;
      const d = Math.hypot(v.x - center.x, v.z - center.z);
      if (d > this.spawnRadius.despawn && v.tag === undefined) this.remove(v);
    }
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const v = this.parked[i];
      const d = Math.hypot(v.x - center.x, v.z - center.z);
      if (d > this.spawnRadius.despawn + 40 && v.tag === undefined) this.remove(v);
    }
    const sub = dt > 0.05 ? 2 : 1;
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      for (const v of this.vehicles) this.step(v, h);
    }
    for (const v of this.vehicles) this.updatePose(v);
  }

  private obstacleGap(v: TVehicle): { gap: number; kind: Obstacle['kind'] | null } {
    let best = Infinity;
    let kind: Obstacle['kind'] | null = null;
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    for (const o of this.obstacles) {
      const dx = o.x - v.x;
      const dz = o.z - v.z;
      const f = dx * fx + dz * fz;
      if (f < 0 || f > 35) continue;
      const l = Math.abs(dx * fz - dz * fx);
      const halfW = VEHICLES[v.type].width / 2 + o.r + 0.3;
      if (l > halfW) continue;
      const gap = f - v.len / 2 - o.r - 0.8;
      if (gap < best) {
        best = gap;
        kind = o.kind;
      }
    }
    return { gap: best, kind };
  }

  private idm(v: TVehicle, v0: number, gap: number, vl: number) {
    const spec = VEHICLES[v.type];
    const a = 2.2 + v.aggression * 0.8;
    const b = 3.2;
    const s0 = 2.2;
    const T = 1.25 - v.aggression * 0.35;
    const dv = v.v - vl;
    const sStar = s0 + Math.max(0, v.v * T + (v.v * dv) / (2 * Math.sqrt(a * b)));
    const free = 1 - Math.pow(v.v / Math.max(0.1, v0), 4);
    const inter = gap < 1e5 ? Math.pow(sStar / Math.max(0.1, gap), 2) : 0;
    let acc = a * (free - inter);
    acc = Math.max(acc, -spec.brake * 0.22);
    return acc;
  }

  private step(v: TVehicle, dt: number) {
    const spec = VEHICLES[v.type];
    if (v.state === 'crash') {
      v.crashT -= dt;
      v.v = Math.max(0, v.v - 8 * dt);
      v.hazard = true;
      if (v.crashT <= 0) {
        v.state = 'drive';
        v.hazard = false;
      }
      return;
    }
    if (v.state === 'stopped') {
      v.v = 0;
      v.brake = true;
      return;
    }
    if (v.state === 'unpark') {
      // wait for a gap in the travel lane then merge
      const list = this.laneVeh[v.lane];
      let clear = true;
      for (const o of list) if (o !== v && o.s < v.s + 6 && o.s > v.s - 22) clear = false;
      v.blink = -1;
      if (clear) v.state = 'drive';
      else return;
    }
    let gap = Infinity;
    let vl = 0;
    let v0 = this.graph.lanes[v.lane >= 0 ? v.lane : this.graph.conns[v.conn].to].speed * v.vDes;
    if (v.lane >= 0) {
      const lane = this.graph.lanes[v.lane];
      const list = this.laneVeh[v.lane];
      const idx = list.indexOf(v);
      if (idx < list.length - 1) {
        const lead = list[idx + 1];
        gap = lead.s - lead.len - v.s;
        vl = lead.v;
      }
      const remain = lane.length - v.s;
      let c = this.nextConn(v);
      if (!c && v.route.length > 1 && remain < 20) {
        // stuck in the wrong lane for the planned turn: take any available movement and re-plan
        c = this.reroute(v, lane);
      }
      if (c && idx === list.length - 1) {
        const cl = this.connVeh[c.id];
        if (cl.length) {
          const last = cl[0];
          gap = Math.min(gap, remain + last.s - last.len);
          vl = last.v;
        } else {
          const tl = this.laneVeh[c.to];
          if (tl.length) {
            const last = tl[0];
            const g2 = remain + c.length + last.s - last.len;
            if (g2 < gap) {
              gap = g2;
              vl = last.v;
            }
          }
        }
      }
      // turning: slow down before the turn
      if (c && c.turn !== 'S' && remain < 30) v0 = Math.min(v0, (c.turn === 'L' ? 7.5 : 5.5) + remain * 0.25);
      if (c) {
        if (!v.committed) {
          if (remain < 3 && v.v < 0.6) {
            if (v.stopT === 0) v.arrive = this.time;
            v.stopT += dt;
            this.interWait[c.inter].add(v);
          }
          const allowed = this.mayEnter(v, c, remain);
          const commitDist = (v.v * v.v) / (2 * 4.0) + 1.0;
          if (allowed && remain < Math.max(commitDist, 2.5)) {
            v.committed = true;
            this.interWait[c.inter].delete(v);
          } else if (!allowed) {
            const sg = remain - 0.8;
            if (sg < gap) {
              gap = sg;
              vl = 0;
            }
          }
        }
        v.blink = c.turn === 'L' && remain < 45 ? -1 : c.turn === 'R' && remain < 45 ? 1 : 0;
      } else if (v.route.length <= 1) {
        // end of route
        if (v.park && this.graph.lanes[v.lane].link === v.park.seg * 2 + (v.park.dir === 1 ? 0 : 1)) {
          const toSpot = v.park.s - v.s;
          if (toSpot < 25) {
            v0 = Math.min(v0, Math.max(1.5, toSpot * 0.45));
            v.blink = 1;
            v.parkLat = clamp(1 - toSpot / 18, 0, 1) * 3.0;
          }
          if (toSpot < 0.6) {
            this.finishParking(v);
            return;
          }
          gap = Math.min(gap, toSpot + 5);
        } else if (v.onArrive) {
          if (remain < 30) {
            v.onArrive(v);
            v.onArrive = undefined;
          }
          gap = Math.min(gap, remain - 1);
        } else if (remain < 40) {
          this.planRandomRoute(v);
        }
      }
      // event blocks on this lane
      for (const b of this.blocks) {
        if (b.lane !== v.lane) continue;
        const g = b.s0 - v.s - 1;
        if (g > -2 && g < gap) {
          gap = Math.max(0.1, g);
          vl = 0;
        }
      }
      this.laneChange(v, lane, gap, vl);
    } else {
      const c = this.graph.conns[v.conn];
      const list = this.connVeh[v.conn];
      const idx = list.indexOf(v);
      if (idx < list.length - 1) {
        const lead = list[idx + 1];
        gap = lead.s - lead.len - v.s;
        vl = lead.v;
      } else {
        const tl = this.laneVeh[c.to];
        if (tl.length) {
          const last = tl[0];
          gap = c.length - v.s + last.s - last.len;
          vl = last.v;
        }
      }
      v0 = Math.min(v0, c.turn === 'S' ? v0 : c.turn === 'L' ? 7.5 : 5.5);
    }
    const ob = this.obstacleGap(v);
    if (ob.gap < gap) {
      gap = Math.max(0.05, ob.gap);
      vl = 0;
      if (ob.kind === 'player' || ob.kind === 'playerCar') {
        if (ob.gap < 8 && v.v < 1.5) {
          v.blockedT += dt;
          v.honkT -= dt;
          if (v.blockedT > 1.6 - v.aggression && v.honkT <= 0) {
            v.honkT = 3 + this.rng.next() * 3;
            this.onHonk?.(v);
          }
        }
      }
    } else v.blockedT = 0;
    const acc = this.idm(v, Math.max(0.5, v0), gap, vl);
    v.brake = acc < -0.6 || v.v < 0.2;
    v.v = Math.max(0, v.v + acc * dt);
    if (gap < 0.2) v.v = Math.min(v.v, 0.5);
    v.s += v.v * dt;
    v.wheelRot += (v.v * dt) / spec.wheelRadius;
    if (Math.abs(v.lat) > 0.01) v.lat -= Math.sign(v.lat) * Math.min(Math.abs(v.lat), dt * 1.6);
    // transitions
    if (v.lane >= 0) {
      const lane = this.graph.lanes[v.lane];
      if (v.s >= lane.length) {
        const c = this.nextConn(v);
        if (c && v.committed) {
          this.removeFromLists(v);
          v.conn = c.id;
          v.lane = -1;
          v.s -= lane.length;
          this.connVeh[c.id].push(v);
          v.committed = false;
          v.stopT = 0;
        } else {
          v.s = lane.length - 0.01;
          v.v = 0;
        }
      }
    } else {
      const c = this.graph.conns[v.conn];
      if (v.s >= c.length) {
        const extra = v.s - c.length;
        this.removeFromLists(v);
        v.s = extra;
        this.insertLane(v, c.to);
        v.route.shift();
        v.blink = 0;
      }
    }
  }

  private reroute(v: TVehicle, lane: Lane): Connector | null {
    if (!lane.out.length) return null;
    let pick = this.graph.conns[lane.out[0]];
    for (const cid of lane.out) if (this.graph.conns[cid].turn === 'S') pick = this.graph.conns[cid];
    const goal = v.route[v.route.length - 1];
    const nextLink = this.graph.lanes[pick.to].link;
    const rest = this.graph.route(nextLink, goal);
    v.route = rest ? [lane.link, ...rest] : [lane.link, nextLink];
    if (!rest && v.park) {
      this.usedSpots.delete(v.park.id);
      v.park = null;
    }
    return pick;
  }

  private laneChange(v: TVehicle, lane: Lane, gap: number, vl: number) {
    if (lane.left < 0 && lane.right < 0) return;
    if (Math.abs(v.lat) > 0.3) return;
    const remain = lane.length - v.s;
    if (remain < 18 || v.s < 6) return;
    const nl = this.nextLink(v);
    let want = -1;
    if (nl >= 0) {
      const ok = this.graph.lanesFor(lane.link, nl);
      if (!ok.includes(lane.id) && ok.length) {
        // move toward an allowed lane
        const tgt = ok[0];
        want = this.graph.lanes[tgt].idx < lane.idx ? lane.left : lane.right;
      } else if (gap < 30 && vl < v.v * 0.7 && v.v > 3) {
        // overtake if the other lane also works
        for (const cand of [lane.left, lane.right]) {
          if (cand >= 0 && ok.includes(cand)) {
            want = cand;
            break;
          }
        }
      }
    }
    if (want < 0) return;
    // gap acceptance in target lane
    const list = this.laneVeh[want];
    for (const o of list) {
      if (o.s > v.s - v.len - 6 - v.v * 0.6 && o.s - o.len < v.s + 6) return;
    }
    const sideSign = this.graph.lanes[want].idx < lane.idx ? -1 : 1; // -1 = to the left (inner)
    this.removeFromLists(v);
    this.insertLane(v, want);
    // lat is measured toward the right (outer) side
    v.lat = sideSign * -3.5;
    v.blink = sideSign;
  }

  private finishParking(v: TVehicle) {
    this.removeFromLists(v);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    const p = v.park!;
    v.state = 'parked';
    v.v = 0;
    v.x = p.x;
    v.z = p.z;
    v.yaw = p.rot;
    v.blink = 0;
    v.brake = false;
    this.parked.push(v);
    v.onArrive?.(v);
    v.onArrive = undefined;
  }

  /** NPC leaves a curbside spot near (x,z). */
  departFromSpot(x: number, z: number, opts: Partial<TVehicle>): TVehicle | null {
    const spot = this.findSpot(x, z, 60);
    if (!spot) return null;
    const link = this.graph.links[spot.seg * 2 + (spot.dir === 1 ? 0 : 1)];
    if (!link.lanes.length) return null;
    const laneId = link.lanes[link.lanes.length - 1];
    const v = this.spawn(laneId, spot.s, opts.type ?? pickTrafficType(this.rng.next()), { ...opts, state: 'unpark', lat: 3.0, v: 0 });
    return v;
  }

  // ------------------------------------------------------------------ pose
  updatePose(v: TVehicle) {
    if (v.state === 'parked') return;
    let x: number;
    let z: number;
    let yaw: number;
    if (v.lane >= 0) {
      const l = this.graph.lanes[v.lane];
      const lat = v.lat + v.parkLat;
      x = l.x0 + l.dx * v.s + l.rx * lat;
      z = l.z0 + l.dz * v.s + l.rz * lat;
      yaw = Math.atan2(l.dx, l.dz);
      // visual heading during lateral moves
      if (Math.abs(v.lat) > 0.05 && v.v > 0.5) yaw += Math.sign(v.lat) * 0.12 * Math.min(1, Math.abs(v.lat));
    } else {
      const c = this.graph.conns[v.conn];
      this.graph.connPose(c, v.s, this.pose);
      x = this.pose.x;
      z = this.pose.z;
      yaw = this.pose.yaw;
    }
    // vehicle reference point is its centre; s refers to the front bumper
    const back = v.len / 2;
    x -= Math.sin(yaw) * back;
    z -= Math.cos(yaw) * back;
    let dy = yaw - v.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    v.yawRate = dy;
    v.x = x;
    v.z = z;
    v.yaw = yaw;
  }

  // ------------------------------------------------------------------ physics proxies
  syncBodies(player: { x: number; z: number }) {
    if (!this.physics) return;
    const R = 75;
    const all = this.vehicles.concat(this.parked);
    for (const v of all) {
      const d = Math.hypot(v.x - player.x, v.z - player.z);
      if (d < R) {
        if (!v.body) this.acquireBody(v);
        if (v.body) {
          const spec = VEHICLES[v.type];
          v.body.setNextKinematicTranslation({ x: v.x, y: spec.height * 0.5 + 0.15, z: v.z });
          v.body.setNextKinematicRotation({ x: 0, y: Math.sin(v.yaw / 2), z: 0, w: Math.cos(v.yaw / 2) });
        }
      } else if (v.body && d > R + 10) this.releaseBody(v);
    }
  }

  private acquireBody(v: TVehicle) {
    if (!this.physics) return;
    const w = this.physics.world;
    const spec = VEHICLES[v.type];
    const body = this.bodyPool.pop() ?? w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    body.setTranslation({ x: v.x, y: spec.height * 0.5 + 0.15, z: v.z }, true);
    body.setRotation({ x: 0, y: Math.sin(v.yaw / 2), z: 0, w: Math.cos(v.yaw / 2) }, true);
    while (body.numColliders() > 0) w.removeCollider(body.collider(0), false);
    const col = w.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.height * 0.45, spec.length / 2)
        .setCollisionGroups(groups(GROUP.TRAFFIC, GROUP.PLAYER | GROUP.VEHICLE | GROUP.DYNAMIC))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setFriction(0.5),
      body,
    );
    this.colliderToVehicle.set(col.handle, v);
    body.setEnabled(true);
    v.body = body;
  }

  private releaseBody(v: TVehicle) {
    if (!v.body || !this.physics) return;
    const b = v.body;
    for (let i = 0; i < b.numColliders(); i++) this.colliderToVehicle.delete(b.collider(i).handle);
    b.setEnabled(false);
    b.setTranslation({ x: 0, y: -500, z: 0 }, false);
    this.bodyPool.push(b);
    v.body = null;
  }

  crash(v: TVehicle, seconds: number) {
    v.state = 'crash';
    v.crashT = seconds;
    v.hazard = true;
  }

  stats() {
    return { moving: this.vehicles.length, parked: this.parked.length };
  }

  dispose() {
    for (const v of [...this.vehicles, ...this.parked]) this.releaseBody(v);
    if (this.physics) for (const b of this.bodyPool) this.physics.world.removeRigidBody(b);
    this.bodyPool = [];
  }
}
