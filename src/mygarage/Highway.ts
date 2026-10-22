// The police chase road, well north of the city: motorway, town, then the docks (highway/road.ts;
// the generator's forking 'highway' profile from the old Highway mode still works here too). This
// class streams it in around the car, keeps track of where on the road you are, runs the traffic
// (highway/traffic.ts) and its physics proxies, and keeps coordinates small by moving the whole
// world back toward the start whenever you get far from it.
import * as THREE from 'three';
import { RAPIER, GROUP, groups, type Physics } from '../engine/Physics';
import { VEHICLES } from '../sim/vehicles';
import type { VehicleRenderer } from '../render/VehicleRenderer';
import { G } from '../render/globals';
import type { OtherCar } from './scoring';
import { RoadGen, Path, Piece, ZONES, laneLat, latBetween, Rand, type Profile, type Zone } from './highway/road';
import { Traffic, type Driver, type HCar } from './highway/traffic';
export type { Driver } from './highway/traffic';
import { PieceBuilder, type Built } from './highway/build';

/** where the road starts (and where the world is moved back to), far from the city */
export const ORIGIN = { x: 0, z: -9000 };
const REBASE = 1200;

const GROUND: Record<Zone, THREE.Color> = {
  fields: new THREE.Color().setRGB(0.09, 0.15, 0.035),
  forest: new THREE.Color().setRGB(0.05, 0.1, 0.03),
  coast: new THREE.Color().setRGB(0.2, 0.21, 0.09),
  desert: new THREE.Color().setRGB(0.42, 0.3, 0.16),
  city: new THREE.Color().setRGB(0.13, 0.15, 0.1),
  downtown: new THREE.Color().setRGB(0.1, 0.1, 0.105),
  docks: new THREE.Color().setRGB(0.16, 0.16, 0.16),
};

export interface HighwayInfo {
  zone: string;
  lanes: number;
  /** the next fork, when it is close: metres to it and where each side goes */
  fork: { dist: number; left: string; right: string; leftBusy: string; rightBusy: string } | null;
}

export class Highway {
  readonly group = new THREE.Group();
  private builder: PieceBuilder;
  private gen = new RoadGen(1);
  root: Path | null = null;
  traffic: Traffic;
  private rng = new Rand(7);
  private built = new Map<Piece, Built>();
  /** every path still in play */
  private paths = new Set<Path>();
  /** you, on the road */
  you: Driver | null = null;
  private committed = new Set<Path>();
  private streamT = 0;
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private hills: THREE.Mesh;
  private hillMat: THREE.MeshBasicMaterial;
  private bodyPool: RAPIER.RigidBody[] = [];
  private bodies = new Map<HCar, RAPIER.RigidBody>();

  constructor(
    scene: THREE.Scene,
    private physics: Physics,
  ) {
    this.group.name = 'highway';
    this.builder = new PieceBuilder(physics);
    this.traffic = new Traffic(this.rng);
    // the ground: a big plane under everything, moved with the camera in whole texture tiles
    this.groundMat = new THREE.MeshStandardMaterial({ color: GROUND.fields.clone(), roughness: 0.97, metalness: 0, map: this.builder.tex });
    const gg = new THREE.PlaneGeometry(7000, 7000);
    gg.rotateX(-Math.PI / 2);
    const uv = gg.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 175, uv.getY(i) * 175);
    this.ground = new THREE.Mesh(gg, this.groundMat);
    this.ground.position.y = -0.3;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    // a ring of low hills round the horizon, kept centred on the camera so it never gets closer
    this.hillMat = new THREE.MeshBasicMaterial({ color: 0x6a7a74, fog: false });
    this.hills = new THREE.Mesh(this.hillGeometry(), this.hillMat);
    this.hills.frustumCulled = false;
    this.group.add(this.hills);
    // solid ground for the car everywhere out here
    physics.addStaticBox(ORIGIN.x, -1, ORIGIN.z, 4000, 1, 4000, 0, GROUP.STATIC, 1.0);
    this.group.visible = false;
    scene.add(this.group);
  }

  private hillGeometry() {
    const n = 160;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = 0.035 + 0.03 * Math.sin(a * 3 + 1) ** 2 + 0.02 * Math.sin(a * 7 + 2) + 0.012 * Math.sin(a * 17);
      pos.push(Math.cos(a), -0.02, Math.sin(a), Math.cos(a), h, Math.sin(a));
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  /** which road: the motorway, or the police chase's mix of downtown streets and motorway */
  profile: Profile = 'highway';

  // ------------------------------------------------------------------ a drive
  begin(profile: Profile = 'highway') {
    this.end();
    this.profile = profile;
    this.gen = new RoadGen(Math.floor(Math.random() * 1e9), profile);
    const root = this.gen.root({ x: ORIGIN.x, z: ORIGIN.z, h: Math.PI / 2 });
    // the chase road has an end (the docks): lay all of it now, so the distance to go is known
    this.gen.extend(root, profile === 'chase' ? Infinity : 2600);
    this.root = root;
    this.paths = new Set([root]);
    this.committed.clear();
    // in a chase you start a little way in, so the police can start behind you
    this.you = { path: root, s: profile === 'chase' ? 200 : 40, lat: laneLat(1), v: 0, len: 4.6, width: 1.9 };
    this.traffic.reset();
    this.traffic.fill(this.you);
    this.groundMat.color.copy(GROUND[root.plan.zone]);
    this.group.visible = true;
    this.stream();
  }

  /** a point `d` metres ahead of you in an open lane (before any fork), or null */
  spotAhead(d: number, rand: () => number = Math.random): { x: number; z: number; road: { pathId: number; s: number } } | null {
    const you = this.you;
    if (!you) return null;
    const p = you.path;
    const s = Math.min(you.s + d, p.length - 30);
    if (s < you.s + 80) return null;
    const n = Math.floor(p.lanes(s) + 0.4);
    const open: number[] = [];
    for (let i = 0; i < n; i++) if (p.laneOpen(i, s) && p.laneOpen(i, s - 30)) open.push(i);
    if (!open.length) return null;
    const q = p.pose(s, laneLat(open[Math.floor(rand() * open.length)]));
    return { x: q.x, z: q.z, road: { pathId: p.id, s } };
  }

  /** where a drive starts: lane 1, 40 m in */
  startPose() {
    const p = this.root!.pose(this.you!.s, laneLat(1));
    return { x: p.x, z: p.z, yaw: p.h };
  }

  /** a pose on your road `ds` metres from you, in lane 1 (after a roll, or a teleport in tests) */
  poseAhead(ds = 0) {
    const you = this.you!;
    const s = Math.max(5, Math.min(you.path.length - 5, you.s + ds));
    const lanes = Math.floor(you.path.lanes(s) + 0.4);
    const p = you.path.pose(s, laneLat(Math.min(1, lanes - 1)));
    return { x: p.x, z: p.z, yaw: p.h };
  }

  end() {
    for (const b of this.built.values()) this.builder.dispose(b);
    this.built.clear();
    for (const c of this.traffic.cars) this.releaseBody(c);
    this.traffic.reset();
    this.paths.clear();
    this.root = null;
    this.you = null;
    this.group.visible = false;
  }

  /**
   * Every frame: where you are, the road around you, the traffic. `others` are cars the traffic
   * must make room for (the police; `sirens` those with their lights on).
   */
  update(dt: number, car: { x: number; z: number; vx: number; vz: number; len: number; width: number } | null, others: Driver[] = [], sirens: Driver[] = []) {
    const you = this.you;
    if (!you) return;
    if (car) this.track(car);
    this.streamT -= dt;
    if (this.streamT <= 0) {
      this.streamT = 0.3;
      this.stream();
    }
    if (dt <= 0) return;
    this.traffic.update(dt, car ? you : null, others, sirens);
    const p = you.path.pose(you.s, you.lat);
    this.traffic.manage(dt, you, car?.x ?? p.x, car?.z ?? p.z);
  }

  /** find you on the road (and which branch you took) */
  private track(car: { x: number; z: number; vx: number; vz: number; len: number; width: number }) {
    const you = this.you!;
    const path = this.locate(you, car);
    // committed to a branch: the other one is left behind
    const parent = path?.parent;
    if (path && parent?.children && !this.committed.has(path) && you.s > 50 && you.lat > -1.5 && you.lat < path.rightEdge(you.s) + 1) {
      this.committed.add(path);
      for (const c of parent.children) if (c !== path) c.abandoned = true;
    }
  }

  /** where a car is on the road, starting from where it was last time; updates `d` (null if lost) */
  locate(d: Driver, car: { x: number; z: number; vx: number; vz: number; len: number; width: number }): Path | null {
    const you = d;
    let path = you.path;
    let pr = path.project(car.x, car.z, you.s);
    const outside = (p: Path, r: { s: number; lat: number; d: number }) => (r.d === Infinity ? 1e6 : Math.max(0, -2 - r.lat, r.lat - (p.rightEdge(r.s) + 4)));
    if (path.children && pr.s > path.length - 6) {
      let best = { p: path, r: pr, o: outside(path, pr) + 1 };
      for (const c of path.children) {
        if (c.abandoned) continue;
        const r = c.project(car.x, car.z, 0, 10, 80);
        const o = outside(c, r);
        if (o < best.o) best = { p: c, r, o };
      }
      path = best.p;
      pr = best.r;
    } else if (path.parent && pr.s < 2) {
      const r = path.parent.project(car.x, car.z, path.parent.length - 5, 80, 10);
      if (r.d < Infinity && r.s < path.parent.length - 1) {
        path = path.parent;
        pr = r;
      }
    }
    // lost (a reset or a teleport): look along the whole path
    if (pr.d === Infinity) pr = path.project(car.x, car.z, you.s, you.s, path.length);
    if (pr.d === Infinity) return null;
    you.path = path;
    you.s = pr.s;
    you.lat = pr.lat;
    you.len = car.len;
    you.width = car.width;
    const h = path.pose(pr.s).h;
    you.v = car.vx * Math.sin(h) + car.vz * Math.cos(h);
    return path;
  }

  /** lay road ahead, build what is in view, drop what is far behind */
  private stream() {
    const you = this.you!;
    const gen = this.gen;
    const path = you.path;
    if (!path.children) gen.extend(path, you.s + 1800);
    if (path.children) for (const c of path.children) {
      this.paths.add(c);
      if (!c.abandoned) gen.extend(c, 760);
    }
    // pieces to keep: behind and ahead on your path, the end of the one before, the branches ahead,
    // and the branch you did not take while it is still close
    const keep = new Set<Piece>();
    const take = (p: Path, s0: number, s1: number) => {
      for (const pc of p.pieces) if (pc.s0 + pc.len > s0 && pc.s0 < s1) keep.add(pc);
    };
    take(path, you.s - 450, you.s + 1500);
    if (path.parent) {
      take(path.parent, path.parent.length - (450 - you.s), path.parent.length);
      for (const c of path.parent.children ?? []) if (c !== path && you.s < 700) take(c, 0, 900 - you.s);
    }
    if (path.children) {
      const left = path.length - you.s;
      if (left < 1500) for (const c of path.children) take(c, 0, 1500 - left);
    }
    for (const pc of keep) {
      if (this.built.has(pc)) continue;
      const b = this.builder.build(pc);
      this.group.add(b.group);
      this.built.set(pc, b);
    }
    for (const [pc, b] of this.built) {
      if (keep.has(pc)) continue;
      this.builder.dispose(b);
      this.built.delete(pc);
    }
    // forget paths nothing is on any more
    for (const p of this.paths) {
      if (p === path || p === path.parent || p.parent === path) continue;
      const used = this.traffic.cars.some((c) => c.path === p) || [...this.built.keys()].some((pc) => pc.path === p);
      if (!used) this.paths.delete(p);
    }
    this.paths.add(path);
    if (path.parent) this.paths.add(path.parent);
  }

  /**
   * Far from the start? Move everything back toward it. Returns the shift for the caller to
   * apply to the car and the camera (or null).
   */
  rebase(x: number, z: number): { dx: number; dz: number } | null {
    const dx = ORIGIN.x - x;
    const dz = ORIGIN.z - z;
    if (Math.hypot(dx, dz) < REBASE) return null;
    const sx = Math.round(dx);
    const sz = Math.round(dz);
    for (const p of this.paths) p.shift(sx, sz);
    for (const b of this.built.values()) {
      b.group.position.x += sx;
      b.group.position.z += sz;
      const t = b.body.translation();
      b.body.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
    }
    for (const c of this.traffic.cars) {
      c.x += sx;
      c.z += sz;
      const body = this.bodies.get(c);
      if (body) {
        const t = body.translation();
        body.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
      }
    }
    return { dx: sx, dz: sz };
  }

  // ------------------------------------------------------------------ the traffic
  /** a car you can hit: going your way, or the other way where nothing is between you (downtown) */
  reachable(c: HCar) {
    return !c.oncoming || (c.s > 0 && c.path.street(c.s));
  }

  /** physics bodies for the cars near you, or near any of `near` (the police) */
  syncBodies(x: number, z: number, near: { x: number; z: number }[] = []) {
    for (const c of this.traffic.cars) {
      let d = this.reachable(c) ? Math.hypot(c.x - x, c.z - z) : Infinity;
      if (d < Infinity) for (const q of near) d = Math.min(d, Math.hypot(c.x - q.x, c.z - q.z));
      let b = this.bodies.get(c);
      if (d < 70) {
        if (!b) b = this.acquireBody(c);
        const spec = VEHICLES[c.type];
        b.setNextKinematicTranslation({ x: c.x, y: spec.height * 0.5 + 0.15, z: c.z });
        b.setNextKinematicRotation({ x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) });
      } else if (b && d > 80) this.releaseBody(c);
    }
    // cars that left the road
    if (this.bodies.size) for (const c of [...this.bodies.keys()]) if (!this.traffic.cars.includes(c)) this.releaseBody(c);
  }

  private acquireBody(c: HCar) {
    const w = this.physics.world;
    const spec = VEHICLES[c.type];
    const body = this.bodyPool.pop() ?? w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    body.setTranslation({ x: c.x, y: spec.height * 0.5 + 0.15, z: c.z }, true);
    body.setRotation({ x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) }, true);
    while (body.numColliders() > 0) w.removeCollider(body.collider(0), false);
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.height * 0.45, spec.length / 2)
        .setCollisionGroups(groups(GROUP.TRAFFIC, GROUP.PLAYER | GROUP.VEHICLE | GROUP.DYNAMIC))
        .setFriction(0.5),
      body,
    );
    body.setEnabled(true);
    this.bodies.set(c, body);
    return body;
  }

  private releaseBody(c: HCar) {
    const b = this.bodies.get(c);
    if (!b) return;
    b.setEnabled(false);
    b.setTranslation({ x: 0, y: -500, z: 0 }, false);
    this.bodyPool.push(b);
    this.bodies.delete(c);
  }

  /** the nearest car to a point (by its outline), within maxD metres */
  nearest(x: number, z: number, maxD: number) {
    let best: HCar | null = null;
    let bd = maxD;
    for (const c of this.traffic.cars) {
      if (!this.reachable(c)) continue;
      const d = Math.hypot(c.x - x, c.z - z) - c.len / 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  crash(c: HCar, impact: number) {
    const you = this.you;
    const lat = you ? (latBetween(you.lat, you.path, c.path) ?? c.lat) : c.lat;
    this.traffic.crash(c, lat, impact);
  }

  /** cars near you, for the near-miss scoring */
  others(x: number, z: number, out: OtherCar[]) {
    for (const c of this.traffic.cars) {
      if (!this.reachable(c) || Math.abs(c.x - x) > 32 || Math.abs(c.z - z) > 32) continue;
      out.push({ id: c.id, x: c.x, z: c.z, yaw: c.yaw, v: c.v, width: c.width, length: c.len });
    }
    return out;
  }

  /** downtown, in the other direction's lanes */
  oncomingSide() {
    const you = this.you;
    if (!you || !you.path.street(you.s)) return false;
    const g = you.path.companionGap(you.s);
    return g !== null && you.lat < -g / 2 - 0.4;
  }

  /** metres to the car right ahead of you in your lane (for the slipstream), or null */
  slipstream() {
    return this.you ? this.traffic.leaderOf(this.you) : null;
  }

  // ------------------------------------------------------------------ looks
  /** the ground and horizon follow the camera; signs glow and arrows flash at night */
  follow(camera: THREE.PerspectiveCamera, fog: THREE.Color | null, dt: number) {
    const tile = 40;
    this.ground.position.set(Math.round(camera.position.x / tile) * tile, -0.3, Math.round(camera.position.z / tile) * tile);
    const r = camera.far * 0.93;
    this.hills.position.set(camera.position.x, 0, camera.position.z);
    this.hills.scale.set(r, r, r);
    if (fog) this.hillMat.color.copy(fog).multiplyScalar(0.72 + 0.1 * (1 - G.uNight.value));
    const you = this.you;
    if (you) this.groundMat.color.lerp(GROUND[you.path.pieceAt(you.s).zone], 1 - Math.exp(-dt * 0.8));
    this.builder.setNight(G.uNight.value);
    this.builder.arrowMat.emissiveIntensity = Math.floor(performance.now() / 450) % 2 ? 2.6 : 0.05;
  }

  draw(r: VehicleRenderer, lights: number, fx: number, fz: number, range: number) {
    const now = performance.now();
    for (const c of this.traffic.cars) {
      if (Math.abs(c.x - fx) > range || Math.abs(c.z - fz) > range || c.s < 0) continue;
      const blinkOn = c.blink !== 0 && Math.floor(now / 380) % 2 === 0;
      r.push({
        type: c.type,
        x: c.x,
        z: c.z,
        yaw: c.yaw,
        paint: c.paint,
        head: lights,
        brake: c.acc < -1.2 || (c.crashed && c.v > 0.3) ? 1 : 0,
        hazard: c.crashed || blinkOn ? 1 : 0,
        wheelRot: c.wheelRot,
        steer: 0,
      });
    }
  }

  /** for the HUD: the zone, lanes, and the next fork when it is near */
  info(): HighwayInfo | null {
    const you = this.you;
    if (!you) return null;
    const pc = you.path.pieceAt(you.s);
    const kids = you.path.children;
    const dist = you.path.length - you.s;
    return {
      zone: ZONES[pc.zone].label,
      lanes: Math.round(you.path.lanes(you.s)),
      fork:
        kids && dist < 1100
          ? { dist: Math.round(dist), left: ZONES[kids[0].plan.zone].label, right: ZONES[kids[1].plan.zone].label, leftBusy: ZONES[kids[0].plan.zone].busy, rightBusy: ZONES[kids[1].plan.zone].busy }
          : null,
    };
  }

  /** the road near a point for the map: each path's middle line (world x, z) and width */
  mapLines(x: number, z: number, radius: number) {
    const out: { pts: [number, number][]; width: number; mine: boolean }[] = [];
    const you = this.you;
    for (const p of this.paths) {
      if (p.abandoned && you && p !== you.path) continue;
      const pts: [number, number][] = [];
      for (const pc of p.pieces) {
        for (let i = 0; i < pc.xs.length; i += 5) {
          if (Math.abs(pc.xs[i] - x) > radius || Math.abs(pc.zs[i] - z) > radius) continue;
          const s = pc.s0 + i * 2;
          const q = p.pose(s, p.rightEdge(s) / 2);
          pts.push([q.x, q.z]);
        }
      }
      if (pts.length > 1) out.push({ pts, width: p.rightEdge(p === you?.path ? you.s : 0), mine: !!you && (p === you.path || p.parent === you.path) });
      // downtown the other direction is right beside: draw it too (each downtown stretch on its own)
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length > 1) out.push({ pts: run, width: p.compLanes * 3.4, mine: false });
        run = [];
      };
      for (const pc of p.pieces) {
        if (!pc.street) {
          flush();
          continue;
        }
        for (let i = 0; i < pc.xs.length; i += 5) {
          if (Math.abs(pc.xs[i] - x) > radius || Math.abs(pc.zs[i] - z) > radius) {
            flush();
            continue;
          }
          const s = pc.s0 + i * 2;
          const g = p.companionGap(s) ?? 0;
          const q = p.pose(s, -g - (p.compLanes * 3.4) / 2);
          run.push([q.x, q.z]);
        }
      }
      flush();
    }
    return out;
  }
}
