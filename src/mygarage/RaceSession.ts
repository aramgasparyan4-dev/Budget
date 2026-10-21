// One race against the rival: the route, the rival's car and driver, both cars' progress, the
// checkpoint gates and the rules for who wins. DriveGame owns it and drives the player's car.
import * as THREE from 'three';
import type { World } from '../engine/World';
import { DrivableVehicle } from '../game/DrivableVehicle';
import type { TrafficSystem } from '../sim/traffic/TrafficSystem';
import { VEHICLES } from '../sim/vehicles';
import { clamp } from '../core/math';
import { compareProgress, freeSpot, laneSet, planRoute, Progress, RivalDriver, Route, type Checkpoint } from './race';
import { RULES } from './scoring';

/** rival paint by the original preset car (red/yellow → cyan, black/blue → orange) */
export const RIVAL_PAINT = [0x00c8ff, 0xff7a00, 0x00c8ff, 0xff7a00];

/** rival paint for a player's paint: cyan, unless the player's car is itself blue or cyan (then orange) */
export function rivalPaintFor(paint: THREE.Color): number {
  const hsl = { h: 0, s: 0, l: 0 };
  paint.getHSL(hsl);
  return hsl.s > 0.25 && hsl.h > 0.42 && hsl.h < 0.75 ? 0xff7a00 : 0x00c8ff;
}

/** seconds the player has to finish once the rival is home */
export const RIVAL_FINISHED_GRACE = 30;

/** lane centres of the start grid on the first (always four-lane) leg */
const GRID = { player: 2.25, rival: 5.75 };

export type RaceEvent = { kind: 'checkpoint'; index: number } | { kind: 'finish' } | { kind: 'rivalFinished' } | { kind: 'rivalCrash' } | { kind: 'lead'; ahead: boolean };

interface Gate {
  group: THREE.Group;
  post: THREE.MeshBasicMaterial;
  curtain: THREE.MeshBasicMaterial;
  banner: THREE.MeshBasicMaterial;
  finish: boolean;
}

/** list.am blue for the next gate */
const AMBER = new THREE.Color(0x1a86ff);
const DIM = new THREE.Color(0x9aa0aa);

let checker: THREE.CanvasTexture | null = null;
function checkerTexture() {
  if (checker) return checker;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 16;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
      g.fillRect(i * 8, j * 8, 8, 8);
    }
  checker = new THREE.CanvasTexture(cv);
  checker.colorSpace = THREE.SRGBColorSpace;
  checker.magFilter = THREE.NearestFilter;
  return checker;
}

export class RaceSession {
  readonly route: Route;
  readonly rival: DrivableVehicle;
  readonly driver: RivalDriver;
  readonly player: Progress;
  readonly rivalProgress: Progress;
  readonly group = new THREE.Group();
  readonly paint: THREE.Color;
  /** seconds since GO */
  time = 0;
  playerTime: number | null = null;
  rivalTime: number | null = null;
  rivalCrashes = 0;
  /** seconds the player's car stays stopped after a crash */
  stunT = 0;
  /** 1 = player leads (with a little hysteresis so it does not flicker side by side) */
  position: 1 | 2 = 2;
  events: RaceEvent[] = [];
  private rivalGrace = 0;
  private offT = 0;
  private flipT = 0;
  private gates: Gate[] = [];
  private startGate: Gate;
  private marker: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private v3 = new THREE.Vector3();

  constructor(
    private world: World,
    private traffic: TrafficSystem,
    scene: THREE.Scene,
    carType: number,
    paint: number,
    readonly seed: number,
  ) {
    this.route = planRoute(world.city, seed);
    this.paint = new THREE.Color(paint);
    const start = this.gridPose(GRID.rival);
    this.rival = new DrivableVehicle(world.physics, carType, start.x, 0.02, start.z, start.yaw, this.paint, 'player', 'Rival');
    this.rival.headlights = true;
    this.rival.handlingAssist = true;
    this.rival.onImpact = (dv) => this.rivalImpact(dv);
    this.driver = new RivalDriver(this.route);
    this.driver.reset(0, GRID.rival);
    this.player = new Progress(this.route);
    this.rivalProgress = new Progress(this.route);

    const cps = this.route.checkpoints;
    cps.forEach((c, i) => this.gates.push(this.makeGate(c, this.route.widths[i], c.finish)));
    const p0 = this.route.at(6);
    this.startGate = this.makeGate({ x: p0.x, z: p0.z, s: 6, dir: [p0.dx, p0.dz], finish: true }, 7.5, true);
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), new THREE.MeshBasicMaterial({ color: this.paint, toneMapped: false }));
    this.marker.rotation.x = Math.PI;
    this.group.add(this.marker);
    scene.add(this.group);
    this.updateGates();
  }

  /** start grid slot on the route at the given lane */
  gridPose(lane: number) {
    const p = this.route.at(0);
    return {
      x: p.x - p.dz * lane,
      z: p.z + p.dx * lane,
      yaw: Math.atan2(p.dx, p.dz),
    };
  }

  /** the player's slot; also clears traffic off the grid and the first stretch of road */
  grid() {
    const tr = this.traffic;
    for (const v of [...tr.vehicles]) {
      const p = this.route.project(v.x, v.z, 0);
      if ((p.s < 170 && p.dist < 12) || Math.hypot(v.x - this.route.pts[0].x, v.z - this.route.pts[0].z) < 40) tr.remove(v);
    }
    return this.gridPose(GRID.player);
  }

  /** a point on the route `d` metres ahead of the player, in the near lane (null near the finish) */
  spotAhead(d: number): { x: number; z: number } | null {
    const r = this.route;
    const s = Math.min(r.length - 40, this.player.s + d);
    if (s < this.player.s + 70) return null;
    const at = r.at(s);
    const lane = laneSet(r.legLanes[at.seg] ?? 1)[0];
    return { x: at.x - at.dz * lane, z: at.z + at.dx * lane };
  }

  /** physics-rate control for the rival (held on the brakes until GO) */
  control(h: number, go: boolean) {
    this.rival.control(h, null, go);
  }

  /** per frame; `running` is false during the countdown and while paused */
  update(dt: number, car: DrivableVehicle, running: boolean, camera: THREE.Camera) {
    this.events.length = 0;
    if (!running) {
      this.updateGates();
      this.placeMarker();
      return;
    }
    this.time += dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.rivalGrace > 0) this.rivalGrace -= dt;
    const rival = this.rival;

    // catch-up: the rival speeds up when behind and eases off when ahead, so it stays a race. It
    // eases off harder than it catches up: traffic lives around the player, so a rival far ahead
    // would otherwise have empty streets to itself
    const gap = this.rivalProgress.s - this.player.s;
    this.driver.skill = gap > 0 ? clamp(0.97 - gap / 500, 0.72, 0.97) : clamp(0.97 - gap / 900, 0.97, 1.1);
    rival.powerMul = 1 + clamp(-gap / 400, 0, 0.35);
    rival.topMul = 1 + clamp(-gap / 600, 0, 0.2);
    // 40 m/s (144 km/h) with a 40 m lead, down to 20 m/s (72 km/h) by 210 m
    this.driver.cap = gap > 40 ? clamp(40 - (gap - 40) * 0.12, 20, 40) : Infinity;

    if (this.rivalTime !== null) rival.aiInput = { throttle: 0, brake: 1, steer: 0, handbrake: false };
    else {
      const obs = [];
      for (const v of this.traffic.vehicles) if (Math.abs(v.x - rival.pos.x) < 95 && Math.abs(v.z - rival.pos.z) < 95) obs.push({ x: v.x, z: v.z, v: v.v, yaw: v.yaw });
      obs.push({
        x: car.pos.x,
        z: car.pos.z,
        v: car.forwardSpeed,
        yaw: car.yaw,
      });
      const ms = rival.spec.steer / (1 + Math.abs(rival.forwardSpeed) / 13);
      rival.aiInput = this.driver.update(
        dt,
        {
          x: rival.pos.x,
          z: rival.pos.z,
          yaw: rival.yaw,
          speed: rival.forwardSpeed,
          wheelBase: rival.spec.wheelBase,
          maxSteer: ms,
          grip: rival.spec.grip * rival.gripMul,
        },
        obs,
      );
    }

    // progress and checkpoints
    const last = this.route.checkpoints.length - 1;
    const cp = this.player.update(car.pos.x, car.pos.z, car.yaw, car.speed);
    if (cp >= 0) {
      if (cp === last) {
        this.playerTime = this.time;
        this.events.push({ kind: 'finish' });
      } else this.events.push({ kind: 'checkpoint', index: cp });
    }
    const rcp = this.rivalProgress.update(rival.pos.x, rival.pos.z, rival.yaw, rival.speed);
    if (rcp === last && this.rivalTime === null) {
      this.rivalTime = this.time;
      this.events.push({ kind: 'rivalFinished' });
    }
    const lead = this.player.s - this.rivalProgress.s;
    const ahead = compareProgress(this.player, this.rivalProgress, this.playerTime, this.rivalTime) > 0;
    const pos: 1 | 2 = this.playerTime !== null || this.rivalTime !== null ? (ahead ? 1 : 2) : lead > 3 ? 1 : lead < -3 ? 2 : this.position;
    if (pos !== this.position && this.time > 3) this.events.push({ kind: 'lead', ahead: pos === 1 });
    this.position = pos;

    this.recoverRival(car, camera, dt);
    this.updateGates();
    this.placeMarker();
  }

  /** the rival is stuck, flipped or lost: put it back on the route, out of sight if possible */
  private recoverRival(car: DrivableVehicle, camera: THREE.Camera, dt: number) {
    if (this.rivalTime !== null) return;
    const rival = this.rival;
    const up = this.v3.set(0, 1, 0).applyQuaternion(rival.quat);
    this.flipT = up.y < 0.4 ? this.flipT + dt : 0;
    this.offT = this.rivalProgress.off > 22 ? this.offT + dt : 0;
    const stuck = this.driver.stuckT > 2.5;
    if (!stuck && this.flipT < 1.2 && this.offT < 3) return;
    const seen = this.inView(camera, rival.pos) && rival.pos.distanceTo(car.pos) < 70;
    if (seen && this.driver.stuckT < 6 && this.flipT < 1.2 && this.offT < 3) return;
    const others = [...this.traffic.vehicles, ...this.traffic.parked, car.pos];
    const spot = freeSpot(this.route, Math.max(this.rivalProgress.s, this.driver.s) + 6, others);
    rival.teleport(spot.x, 0.02, spot.z, spot.yaw);
    this.driver.reset(spot.s, spot.lane);
    this.flipT = this.offT = 0;
  }

  private inView(camera: THREE.Camera, p: THREE.Vector3) {
    this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    return this.frustum.containsPoint(this.v3.set(p.x, p.y + 1, p.z));
  }

  private rivalImpact(dv: number) {
    if (this.time <= 0 || this.rivalGrace > 0 || dv < RULES.wreckImpact || this.rivalTime !== null) return;
    this.rivalGrace = RULES.damageGrace;
    this.rivalCrashes++;
    this.rival.stop();
    this.driver.stunT = 0.9;
    const p = this.rival.pos;
    let hit = null;
    let bd = 7;
    for (const tv of this.traffic.vehicles) {
      const d = Math.hypot(tv.x - p.x, tv.z - p.z) - VEHICLES[tv.type].length / 2;
      if (d < bd) {
        bd = d;
        hit = tv;
      }
    }
    if (hit && hit.state !== 'crash') this.traffic.crash(hit, 10);
    this.events.push({ kind: 'rivalCrash' });
  }

  /** the player's car back on the route where they left it (flipped, lost, wedged) */
  resetPlayer(car: DrivableVehicle) {
    const others = [...this.traffic.vehicles, ...this.traffic.parked, this.rival.pos];
    const spot = freeSpot(this.route, this.player.s, others, 7);
    car.teleport(spot.x, 0.02, spot.z, spot.yaw);
    return spot.yaw;
  }

  /** seconds the rival still needs, at its average pace so far (for the winning margin) */
  rivalSecondsLeft() {
    const left = this.route.length - this.rivalProgress.s;
    const pace = Math.max(8, this.rivalProgress.s / Math.max(1, this.time));
    return left / pace;
  }

  /** where to point the player: along the route a little ahead, never past the next checkpoint */
  guide(): { x: number; z: number; cpDist: number } {
    const cp = this.player.checkpoint ?? this.route.checkpoints[this.route.checkpoints.length - 1];
    const p = this.route.at(Math.min(this.player.s + 35, cp.s));
    return { x: p.x, z: p.z, cpDist: Math.max(0, cp.s - this.player.s) };
  }

  /** screen position (CSS px) for the floating rival tag, or null when it is behind the camera */
  tag(camera: THREE.Camera, w: number, h: number): { x: number; y: number } | null {
    const p = this.v3.copy(this.rival.pos);
    p.y += 2.2;
    p.project(camera);
    if (p.z > 1 || p.z < -1) return null;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  }

  // ------------------------------------------------------------------ visuals
  private makeGate(c: Checkpoint, width: number, finish: boolean): Gate {
    const g = new THREE.Group();
    const half = width + 0.8;
    const post = new THREE.MeshBasicMaterial({
      color: AMBER.clone(),
      toneMapped: false,
    });
    const banner = finish
      ? new THREE.MeshBasicMaterial({
          map: checkerTexture(),
          toneMapped: false,
        })
      : new THREE.MeshBasicMaterial({
          color: AMBER.clone(),
          toneMapped: false,
        });
    const curtain = new THREE.MeshBasicMaterial({
      color: AMBER.clone(),
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const postGeo = new THREE.BoxGeometry(0.35, 6.6, 0.35);
    for (const sx of [-half, half]) {
      const m = new THREE.Mesh(postGeo, post);
      m.position.set(sx, 3.3, 0);
      g.add(m);
    }
    const b = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.35, 0.9, 0.22), banner);
    b.position.y = 6.4;
    g.add(b);
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 5.9), curtain);
    cur.position.y = 2.95;
    cur.renderOrder = 3;
    g.add(cur);
    g.position.set(c.x, 0, c.z);
    g.rotation.y = Math.atan2(c.dir[0], c.dir[1]);
    this.group.add(g);
    return { group: g, post, curtain, banner, finish };
  }

  /** the next gate glows amber, the one after is a grey preview, the rest are hidden */
  private updateGates() {
    const next = this.player.next;
    const pulse = 0.16 + 0.08 * Math.sin(this.time * 6);
    this.gates.forEach((g, i) => {
      const k = i - next;
      g.group.visible = k === 0 || k === 1;
      const col = k === 0 ? AMBER : DIM;
      g.post.color.copy(col);
      if (!g.finish) g.banner.color.copy(col);
      g.curtain.color.copy(col);
      g.curtain.opacity = k === 0 ? pulse : 0.05;
    });
    this.startGate.group.visible = this.player.s < 30;
    this.startGate.curtain.opacity = 0.05;
    this.startGate.post.color.set(0xf4f4f4);
    this.startGate.curtain.color.set(0xf4f4f4);
  }

  private placeMarker() {
    const p = this.rival.pos;
    this.marker.position.set(p.x, p.y + 2.7 + Math.sin(this.time * 3) * 0.15, p.z);
    this.marker.rotation.y += 0.04;
  }

  dispose() {
    this.rival.dispose();
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
