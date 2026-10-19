import * as THREE from 'three';
import type { CityData, Prop } from '../../world/types';
import { CURB_H } from '../../world/types';
import { NPCSystem } from './NPCSystem';
import type { NPC, Trip } from './types';
import type { PathPoint } from '../nav/SidewalkNav';
import { pathLength } from '../nav/SidewalkNav';
import type { TrafficSystem } from '../traffic/TrafficSystem';
import { Pose } from '../../render/Human';
import { RNG } from '../../core/rng';
import { clamp, damp, dampAngle, SpatialHash } from '../../core/math';
import { MIN_PER_DAY } from '../Clock';

export type PedState = 'walk' | 'wait' | 'idle' | 'talk' | 'sit' | 'fallen' | 'dodge' | 'chat' | 'watch' | 'angry' | 'wave';

export interface Ped {
  npc: NPC;
  path: PathPoint[];
  i: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  lat: number;
  state: PedState;
  stateT: number;
  phase: number;
  gait: number;
  arriveAtEnd: boolean;
  outdoor: number;
  idleTarget: { x: number; z: number } | null;
  face: number | null;
  emote: string | null;
  emoteT: number;
  waitT: number;
  partner: Ped | null;
  life: number;
  hitCooldown: number;
}

function pedCurve(h: number) {
  const g = (mu: number, s: number) => Math.exp(-((h - mu) ** 2) / (2 * s * s));
  return clamp(0.08 + 0.55 * g(8.3, 1.2) + 0.7 * g(12.8, 1.6) + 0.75 * g(17.8, 1.6) + 0.45 * g(20.5, 1.8), 0.05, 1.1);
}

export class Pedestrians {
  peds: Ped[] = [];
  byNpc = new Map<number, Ped>();
  private hash = new SpatialHash<Ped>(4);
  private rng: RNG;
  private benches: SpatialHash<Prop>;
  center = new THREE.Vector3();
  camFwd = new THREE.Vector2(0, 1);
  density = 1;
  baseTarget = 55;
  R = { spawnMin: 55, spawnMax: 150, despawn: 195, door: 150 };
  enabled = true;
  playerCar: { x: number; z: number; vx: number; vz: number; speed: number } | null = null;
  playerFoot: { x: number; z: number } | null = null;
  onHitByPlayer: ((p: Ped, speed: number) => void) | null = null;
  onNearMiss: ((p: Ped) => void) | null = null;
  private topUpTimer = 0;
  private scanTimer = 0;
  stats = { spawned: 0 };

  constructor(public city: CityData, public sys: NPCSystem, public traffic: TrafficSystem | null, seed: number) {
    this.rng = new RNG(seed ^ 0x9ed);
    this.benches = new SpatialHash<Prop>(16);
    for (const p of city.props) if (p.type === 'bench') this.benches.insert(p.x, p.z, p);
    sys.hooks.onDepart = (n, trip) => this.onDepart(n, trip);
  }

  private visibleSpawnOk(x: number, z: number, minD: number) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    const d = Math.hypot(dx, dz);
    if (d > this.R.spawnMax) return false;
    if (d >= minD) return true;
    // closer spawns only behind the camera
    return (dx / d) * this.camFwd.x + (dz / d) * this.camFwd.y < -0.2;
  }

  // ------------------------------------------------------------------ spawning
  private onDepart(n: NPC, trip: Trip) {
    if (!this.enabled || n.proxy !== 'none') return;
    const door = this.sys.placePos(trip.from);
    const d = Math.hypot(door.x - this.center.x, door.z - this.center.z);
    if (d > this.R.door) return;
    if (trip.mode === 'car' && this.traffic) {
      const v = this.traffic.departFromSpot(door.x, door.z, { driver: n.id, type: n.carType, purpose: 'npc' });
      if (v) {
        v.paint.setHex(n.carColor);
        n.proxy = 'car';
        const dest = this.sys.placePos(trip.to);
        this.traffic.routeTo(v, dest.x, dest.z, true);
        v.onArrive = () => {
          // the abstract sim takes over again once parked
          n.proxy = 'none';
        };
      }
      return;
    }
    if (trip.mode !== 'walk') return;
    if (this.peds.length >= this.maxPeds()) return;
    this.spawnFromTrip(n, 0);
  }

  maxPeds() {
    return Math.round(this.baseTarget * 1.6 * this.density) + 8;
  }

  private spawnFromTrip(n: NPC, startDist: number): Ped | null {
    const path = this.sys.tripPath(n);
    if (!path || path.length < 2) return null;
    // find segment containing startDist
    let acc = 0;
    let i = 1;
    let x = path[0].x;
    let z = path[0].z;
    for (; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (acc + l >= startDist) {
        const t = l > 0 ? (startDist - acc) / l : 0;
        x = a.x + (b.x - a.x) * t;
        z = a.z + (b.z - a.z) * t;
        break;
      }
      acc += l;
    }
    if (i >= path.length) return null;
    const p = this.makePed(n, x, z);
    p.path = path;
    p.i = i;
    p.arriveAtEnd = true;
    p.yaw = Math.atan2(path[i].x - x, path[i].z - z);
    return p;
  }

  makePed(n: NPC, x: number, z: number): Ped {
    const p: Ped = {
      npc: n,
      path: [],
      i: 0,
      x,
      y: CURB_H,
      z,
      yaw: 0,
      vx: 0,
      vz: 0,
      speed: 1.2 + (1 - n.age / 100) * 0.35 + n.traits.risk * 0.1 + (this.rng.next() - 0.5) * 0.15,
      lat: (0.35 + this.rng.next() * 0.8) * (this.rng.chance(0.75) ? 1 : -1),
      state: 'walk',
      stateT: 0,
      phase: this.rng.next() * 6,
      gait: 1,
      arriveAtEnd: false,
      outdoor: -1,
      idleTarget: null,
      face: null,
      emote: null,
      emoteT: 0,
      waitT: 0,
      partner: null,
      life: 0,
      hitCooldown: 0,
    };
    n.proxy = 'ped';
    this.peds.push(p);
    this.byNpc.set(n.id, p);
    this.stats.spawned++;
    return p;
  }

  private spawnOutdoor(n: NPC) {
    const o = this.city.outdoor[n.loc!.id];
    const a = this.rng.next() * Math.PI * 2;
    const r = Math.sqrt(this.rng.next()) * Math.max(2, o.radius);
    const x = o.x + Math.cos(a) * r;
    const z = o.z + Math.sin(a) * r;
    if (!this.visibleSpawnOk(x, z, this.R.spawnMin)) return;
    const p = this.makePed(n, x, z);
    p.outdoor = o.id;
    p.state = 'idle';
    p.yaw = this.rng.next() * Math.PI * 2;
    // try to sit on a bench nearby
    if (o.kind !== 'promenade' || this.rng.chance(0.5)) {
      const near = this.benches.query(x, z, 14).filter((b) => !this.peds.some((q) => q.state === 'sit' && Math.hypot(q.x - b.x, q.z - b.z) < 0.9));
      if (near.length && this.rng.chance(0.5)) {
        const b = near[Math.floor(this.rng.next() * near.length)];
        p.idleTarget = { x: b.x + Math.sin(b.rot) * 0.25, z: b.z + Math.cos(b.rot) * 0.25 };
        p.face = b.rot;
        p.stateT = 0;
      }
    }
    if (o.kind === 'busstop') p.state = 'idle';
  }

  private scanTransit(now: number) {
    const max = this.maxPeds();
    for (const n of this.sys.npcs) {
      if (this.peds.length >= max) return;
      if (n.proxy !== 'none' || n.hold > 0) continue;
      if (n.trip) {
        if (n.trip.mode !== 'walk') continue;
        // only bother pathing trips that pass reasonably near
        const a = this.sys.placePos(n.trip.from);
        const b = this.sys.placePos(n.trip.to);
        const minX = Math.min(a.x, b.x) - 160;
        const maxX = Math.max(a.x, b.x) + 160;
        const minZ = Math.min(a.z, b.z) - 160;
        const maxZ = Math.max(a.z, b.z) + 160;
        if (this.center.x < minX || this.center.x > maxX || this.center.z < minZ || this.center.z > maxZ) continue;
        this.sys.tripPath(n);
        const pos = this.sys.tripPos(n, now);
        if (!this.visibleSpawnOk(pos.x, pos.z, this.R.spawnMin)) continue;
        this.spawnFromTrip(n, pos.d);
      } else if (n.loc && n.loc.k === 'o' && n.activity.kind !== 'sleep') {
        const o = this.city.outdoor[n.loc.id];
        if (Math.hypot(o.x - this.center.x, o.z - this.center.z) < this.R.spawnMax) this.spawnOutdoor(n);
      }
    }
  }

  private topUp(now: number, hour: number) {
    const target = this.targetCount(hour);
    if (this.peds.length >= target) return;
    // pick a resident who is at a building near the player and send them on a short errand
    const cands: NPC[] = [];
    for (const n of this.sys.npcs) {
      if (n.proxy !== 'none' || n.trip || !n.loc || n.loc.k !== 'b' || n.hold > 0) continue;
      const k = n.activity.kind;
      if (k !== 'home' && k !== 'leisure' && k !== 'shop' && k !== 'eat' && k !== 'errand') continue;
      const d = this.sys.doors[n.loc.id];
      const dist = Math.hypot(d.x - this.center.x, d.z - this.center.z);
      if (dist > this.R.door || dist < 12) continue;
      cands.push(n);
      if (cands.length > 24) break;
    }
    if (!cands.length) return;
    const n = cands[Math.floor(this.rng.next() * cands.length)];
    const act = this.sys.choose(n, now, { local: true, maxDist: 420 });
    if (n.loc && act.place.k === n.loc.k && act.place.id === n.loc.id) return;
    n.activity = act;
    this.sys.startTrip(n, act.place, now);
  }

  targetCount(hour: number) {
    const rain = this.sys.weather.rain;
    let t = this.baseTarget * this.density * pedCurve(hour) * (1 - rain * 0.65);
    // nightlife district stays busy late
    const night = hour > 21 || hour < 3;
    const d = this.districtAt(this.center.x, this.center.z);
    if (night && d === 'entertainment') t *= 2.6;
    if (d === 'downtown' || d === 'commercial') t *= 1.25;
    if (d === 'industrial') t *= 0.55;
    return Math.round(t);
  }

  private districtAt(x: number, z: number) {
    const c = this.city;
    const bi = clamp(Math.floor((x - c.bounds.minX) / 96), 0, c.n - 1);
    const bj = clamp(Math.floor((z - c.bounds.minZ) / 96), 0, c.n - 1);
    return c.blocks[c.blockGrid[bj * c.n + bi]]?.district ?? 'residential';
  }

  // ------------------------------------------------------------------ despawn
  despawn(p: Ped, now: number, arrived: boolean) {
    const n = p.npc;
    const i = this.peds.indexOf(p);
    if (i >= 0) this.peds.splice(i, 1);
    this.byNpc.delete(n.id);
    if (p.partner) p.partner.partner = null;
    n.proxy = 'none';
    if (arrived && n.trip) {
      this.sys.arrive(n, now);
      return;
    }
    if (n.trip && p.arriveAtEnd) {
      // hand the remaining walk back to the abstract simulation
      let remain = 0;
      for (let k = p.i; k < p.path.length; k++) {
        const a = k === p.i ? { x: p.x, z: p.z } : p.path[k - 1];
        const b = p.path[k];
        remain += Math.hypot(b.x - a.x, b.z - a.z);
      }
      const L = n.trip.pathLen ?? pathLength(p.path);
      n.trip.arrive = now + remain / 78 + 0.5;
      n.trip.depart = now - Math.max(0, L - remain) / 78;
    }
  }

  // ------------------------------------------------------------------ update
  update(dt: number, now: number, center: THREE.Vector3, camFwd: THREE.Vector2) {
    this.center.copy(center);
    this.camFwd.copy(camFwd);
    const hour = (now % MIN_PER_DAY) / 60;
    if (!this.enabled) return;
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = 0.5;
      this.scanTransit(now);
    }
    this.topUpTimer -= dt;
    if (this.topUpTimer <= 0) {
      this.topUpTimer = 0.35;
      this.topUp(now, hour);
    }
    this.hash.clear();
    for (const p of this.peds) this.hash.insert(p.x, p.z, p);
    for (let k = this.peds.length - 1; k >= 0; k--) {
      const p = this.peds[k];
      p.life += dt;
      const d = Math.hypot(p.x - center.x, p.z - center.z);
      if (d > this.R.despawn && p.state !== 'talk') {
        this.despawn(p, now, false);
        continue;
      }
      // abstract activity ended for idle outdoor npcs -> they leave (sim decides next)
      if (p.outdoor >= 0 && p.npc.trip) {
        // the npc started a trip: convert to a walker
        const path = this.sys.tripPath(p.npc);
        if (path) {
          p.path = [{ x: p.x, z: p.z }, ...path.slice(1)];
          p.i = 1;
          p.outdoor = -1;
          p.arriveAtEnd = true;
          p.state = 'walk';
        }
      }
      this.step(p, dt, now);
    }
  }

  private step(p: Ped, dt: number, now: number) {
    if (p.emoteT > 0) {
      p.emoteT -= dt;
      if (p.emoteT <= 0) p.emote = null;
    }
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    this.carReaction(p, dt);
    let wantX = 0;
    let wantZ = 0;
    let speed = 0;
    switch (p.state) {
      case 'fallen': {
        p.stateT -= dt;
        if (p.stateT <= 0) {
          p.state = 'angry';
          p.stateT = 3;
          p.emote = '#!';
          p.emoteT = 3;
        }
        p.vx = p.vz = 0;
        return;
      }
      case 'angry':
      case 'wave': {
        p.stateT -= dt;
        if (this.playerFoot || this.playerCar) {
          const t = this.playerFoot ?? this.playerCar!;
          p.yaw = dampAngle(p.yaw, Math.atan2(t.x - p.x, t.z - p.z), 6, dt);
        }
        if (p.stateT <= 0) p.state = p.outdoor >= 0 ? 'idle' : 'walk';
        p.vx = damp(p.vx, 0, 8, dt);
        p.vz = damp(p.vz, 0, 8, dt);
        p.gait = damp(p.gait, 0, 6, dt);
        return;
      }
      case 'talk': {
        if (p.face !== null) p.yaw = dampAngle(p.yaw, p.face, 6, dt);
        p.vx = p.vz = 0;
        p.gait = damp(p.gait, 0, 8, dt);
        return;
      }
      case 'dodge': {
        p.stateT -= dt;
        speed = 4.5;
        wantX = Math.sin(p.yaw);
        wantZ = Math.cos(p.yaw);
        if (p.stateT <= 0) p.state = p.outdoor >= 0 ? 'idle' : 'walk';
        break;
      }
      case 'wait': {
        const cur = p.path[p.i - 1];
        const ok = cur?.cross ? this.canCross(cur.cross.inter, cur.cross.axis, p) : true;
        p.waitT += dt;
        if (ok || p.waitT > 75) {
          p.state = 'walk';
          p.waitT = 0;
        }
        p.vx = damp(p.vx, 0, 8, dt);
        p.vz = damp(p.vz, 0, 8, dt);
        p.gait = damp(p.gait, 0, 6, dt);
        const nxt = p.path[p.i];
        if (nxt) p.yaw = dampAngle(p.yaw, Math.atan2(nxt.x - p.x, nxt.z - p.z), 4, dt);
        this.integrate(p, dt);
        return;
      }
      case 'idle':
      case 'sit':
      case 'chat':
      case 'watch': {
        this.idleBehaviour(p, dt);
        return;
      }
      case 'walk': {
        if (p.i >= p.path.length) {
          if (p.arriveAtEnd) this.despawn(p, now, true);
          else p.state = 'idle';
          return;
        }
        const tgt = p.path[p.i];
        const prev = p.path[p.i - 1] ?? tgt;
        // lateral offset to the right of travel direction (not on the first/last door legs)
        let tx = tgt.x;
        let tz = tgt.z;
        const sdx = tgt.x - prev.x;
        const sdz = tgt.z - prev.z;
        const sl = Math.hypot(sdx, sdz) || 1;
        const doorLeg = p.i === 1 || p.i === p.path.length - 1;
        if (!doorLeg) {
          const lat = prev.cross ? p.lat * 0.4 : p.lat;
          tx += (-sdz / sl) * lat;
          tz += (sdx / sl) * lat;
        }
        const dx = tx - p.x;
        const dz = tz - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < (p.i === p.path.length - 1 ? 0.35 : 0.9)) {
          p.i++;
          // about to start a crosswalk? check signal
          const here = p.path[p.i - 1];
          if (here?.cross && !this.canCross(here.cross.inter, here.cross.axis, p)) {
            p.state = 'wait';
            p.waitT = 0;
          }
          return;
        }
        wantX = dx / dist;
        wantZ = dz / dist;
        speed = p.speed * (p.npc.trip?.late ? 1.6 : 1) * (this.sys.weather.rain > 0.4 ? 1.25 : 1);
        break;
      }
    }
    // separation from nearby pedestrians and the player
    let sx = 0;
    let sz = 0;
    for (const o of this.hash.query(p.x, p.z, 1.4)) {
      if (o === p) continue;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.2 && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        sx += (dx / d) * (1.1 - d);
        sz += (dz / d) * (1.1 - d);
      }
    }
    if (this.playerFoot) {
      const dx = p.x - this.playerFoot.x;
      const dz = p.z - this.playerFoot.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6 && d > 0.01) {
        sx += (dx / d) * (1.7 - d) * 1.5;
        sz += (dz / d) * (1.7 - d) * 1.5;
      }
    }
    const vx = wantX * speed + sx * 1.6;
    const vz = wantZ * speed + sz * 1.6;
    p.vx = damp(p.vx, vx, 6, dt);
    p.vz = damp(p.vz, vz, 6, dt);
    this.integrate(p, dt);
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0.2) p.yaw = dampAngle(p.yaw, Math.atan2(p.vx, p.vz), 8, dt);
    p.gait = damp(p.gait, sp < 0.15 ? 0 : sp < 2.2 ? sp / 1.45 : 1 + Math.min(1, (sp - 2.2) / 2.5), 8, dt);
  }

  private integrate(p: Ped, dt: number) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const sp = Math.hypot(p.vx, p.vz);
    p.phase += dt * sp * (sp < 2.2 ? 3.9 : 2.5);
    // height: road vs raised sidewalk
    const onRoad = this.onRoad(p.x, p.z);
    p.y = damp(p.y, onRoad ? 0 : CURB_H, 18, dt);
  }

  private onRoad(x: number, z: number) {
    const c = this.city;
    // near a road line within half width?
    const bi = Math.round((x - c.bounds.minX) / 96);
    const bj = Math.round((z - c.bounds.minZ) / 96);
    const vx = c.vLines[clamp(bi, 0, c.n)];
    const hz = c.hLines[clamp(bj, 0, c.n)];
    return (vx && Math.abs(x - vx.pos) < vx.hw) || (hz && Math.abs(z - hz.pos) < hz.hw);
  }

  private canCross(inter: number, axis: 'v' | 'h', p: Ped) {
    if (!this.traffic) return true;
    const w = this.traffic.walkSignal(inter, axis);
    if (w === 'walk') return true;
    if (w === 'dont') return p.npc.traits.risk > 0.92 && !this.carsNear(p.x, p.z, 22);
    return !this.carsNear(p.x, p.z, 14);
  }

  private carsNear(x: number, z: number, r: number) {
    if (!this.traffic) return false;
    for (const v of this.traffic.vehicles) {
      if (v.v < 1.5) continue;
      if (Math.abs(v.x - x) < r && Math.abs(v.z - z) < r) return true;
    }
    if (this.playerCar && this.playerCar.speed > 2 && Math.hypot(this.playerCar.x - x, this.playerCar.z - z) < r) return true;
    return false;
  }

  private idleBehaviour(p: Ped, dt: number) {
    p.stateT -= dt;
    if (p.idleTarget) {
      const dx = p.idleTarget.x - p.x;
      const dz = p.idleTarget.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        p.vx = damp(p.vx, (dx / d) * 1.2, 6, dt);
        p.vz = damp(p.vz, (dz / d) * 1.2, 6, dt);
        p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 8, dt);
        this.integrate(p, dt);
        p.gait = damp(p.gait, 0.85, 6, dt);
        return;
      }
      p.vx = p.vz = 0;
      p.idleTarget = null;
      if (p.face !== null) {
        p.state = 'sit';
        p.stateT = 30 + this.rng.next() * 60;
      }
    }
    p.gait = damp(p.gait, 0, 6, dt);
    if (p.face !== null) p.yaw = dampAngle(p.yaw, p.face, 4, dt);
    if (p.stateT <= 0) {
      // choose a new idle behaviour
      const o = p.outdoor >= 0 ? this.city.outdoor[p.outdoor] : null;
      if (p.state === 'sit' && this.rng.chance(0.6)) {
        p.stateT = 20 + this.rng.next() * 40;
        return;
      }
      p.state = 'idle';
      p.face = null;
      const roll = this.rng.next();
      if (roll < 0.35 && o) {
        const a = this.rng.next() * Math.PI * 2;
        const r = Math.sqrt(this.rng.next()) * Math.max(3, o.radius);
        p.idleTarget = { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r };
        p.stateT = 5 + this.rng.next() * 8;
      } else if (roll < 0.7) {
        // find someone to chat with
        const near = this.hash.query(p.x, p.z, 8).filter((q) => q !== p && !q.partner && (q.state === 'idle' || q.state === 'sit'));
        const q = near.find((c) => (p.npc.rel.get(c.npc.id)?.fam ?? 0) > 10) ?? (this.rng.chance(0.3) ? near[0] : undefined);
        if (q) {
          p.partner = q;
          q.partner = p;
          const mx = (p.x + q.x) / 2;
          const mz = (p.z + q.z) / 2;
          const a = Math.atan2(q.x - p.x, q.z - p.z);
          p.idleTarget = { x: mx - Math.sin(a) * 0.6, z: mz - Math.cos(a) * 0.6 };
          q.idleTarget = { x: mx + Math.sin(a) * 0.6, z: mz + Math.cos(a) * 0.6 };
          p.state = 'chat';
          q.state = 'chat';
          p.stateT = q.stateT = 15 + this.rng.next() * 25;
          p.face = a;
          q.face = a + Math.PI;
        } else p.stateT = 4 + this.rng.next() * 6;
      } else {
        p.stateT = 4 + this.rng.next() * 8;
        p.yaw += (this.rng.next() - 0.5) * 2;
      }
      if (p.state !== 'chat' && p.partner) {
        p.partner.partner = null;
        p.partner = null;
      }
    }
  }

  private carReaction(p: Ped, dt: number) {
    const car = this.playerCar;
    if (!car || car.speed < 3 || p.state === 'fallen') return;
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d > 9) return;
    const vlen = Math.hypot(car.vx, car.vz) || 1;
    const ahead = (dx * car.vx + dz * car.vz) / vlen;
    const side = (dx * car.vz - dz * car.vx) / vlen;
    if (d < 1.5 && p.hitCooldown <= 0) {
      p.state = 'fallen';
      p.stateT = 3.5;
      p.hitCooldown = 6;
      p.emote = '!!';
      p.emoteT = 2;
      this.onHitByPlayer?.(p, car.speed);
      return;
    }
    if (ahead > 0 && Math.abs(side) < 2.4 && p.state !== 'dodge') {
      p.state = 'dodge';
      p.stateT = 0.7;
      p.yaw = Math.atan2(car.vz * Math.sign(side || 1), -car.vx * Math.sign(side || 1));
      p.emote = '!';
      p.emoteT = 1.5;
      this.onNearMiss?.(p);
    }
    void dt;
  }

  /** Make a pedestrian stop and face a point (dialogue). */
  hold(p: Ped, faceX: number, faceZ: number) {
    p.state = 'talk';
    p.face = Math.atan2(faceX - p.x, faceZ - p.z);
    p.npc.hold = 1;
  }
  release(p: Ped) {
    p.npc.hold = 0;
    p.face = null;
    p.state = p.outdoor >= 0 ? 'idle' : 'walk';
  }

  /** obstacles for traffic: pedestrians in or near the road */
  obstacles(out: { x: number; z: number; r: number; kind: 'ped' }[]) {
    for (const p of this.peds) {
      if (p.y < CURB_H * 0.5) out.push({ x: p.x, z: p.z, r: 0.5, kind: 'ped' });
    }
  }

  nearest(x: number, z: number, r: number): Ped | null {
    let best: Ped | null = null;
    let bd = r;
    for (const p of this.hash.query(x, z, r)) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd && p.state !== 'fallen') {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  poseOf(p: Ped): { pose: number; aux: number; gait: number } {
    switch (p.state) {
      case 'sit':
        return { pose: Pose.Sit, aux: 0, gait: 0 };
      case 'talk':
      case 'chat':
        return { pose: Pose.Talk, aux: 0.5, gait: 0 };
      case 'fallen':
        return { pose: Pose.Fallen, aux: 0, gait: 0 };
      case 'angry':
        return { pose: Pose.Angry, aux: 0, gait: 0 };
      case 'wave':
        return { pose: Pose.Wave, aux: 0, gait: 0 };
      case 'watch':
        return { pose: Pose.Stand, aux: 0, gait: 0 };
      default: {
        if (p.state === 'wait' && p.npc.traits.patience < 0.3) return { pose: Pose.Phone, aux: 0, gait: 0 };
        return { pose: Pose.Stand, aux: 0, gait: p.gait };
      }
    }
  }

  clear() {
    for (const p of [...this.peds]) {
      p.npc.proxy = 'none';
      p.npc.hold = 0;
    }
    this.peds = [];
    this.byNpc.clear();
  }
}
