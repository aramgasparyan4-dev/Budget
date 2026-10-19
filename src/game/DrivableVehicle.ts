import * as THREE from 'three';
import { RAPIER, Physics, GROUP, groups } from '../engine/Physics';
import { VEHICLES, VehicleSpec } from '../sim/vehicles';
import type { Input } from '../engine/Input';
import type { VehicleDrawable } from '../render/VehicleRenderer';
import { clamp, damp } from '../core/math';

export type Ownership = 'player' | 'company' | 'taxi' | 'borrowed';

let nextVid = 1;

export class DrivableVehicle {
  readonly vid: number;
  spec: VehicleSpec;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  vc: RAPIER.DynamicRayCastVehicleController;
  paint: THREE.Color;
  steer = 0;
  throttle = 0;
  wheelRot = 0;
  groundOffset: number;
  rest = 0.32;
  driven = false;
  headlights = false;
  damage = 0;
  owner: Ownership;
  label: string;
  lastVel = new THREE.Vector3();
  quat = new THREE.Quaternion();
  pos = new THREE.Vector3();
  speed = 0;
  forwardSpeed = 0;
  private upsideT = 0;
  onImpact: ((speed: number, v: DrivableVehicle) => void) | null = null;
  braking = false;
  reversing = false;
  handbrake = false;
  rpm = 0;
  gear = 1;
  siren = false;
  /** tuning hooks for arcade modes: boost (power, top speed) and wet roads (grip) */
  powerMul = 1;
  topMul = 1;
  gripMul = 1;
  private drawable: VehicleDrawable;
  private physics: Physics;

  constructor(physics: Physics, type: number, x: number, y: number, z: number, yaw: number, paint: THREE.Color, owner: Ownership, label?: string, vid?: number) {
    this.physics = physics;
    this.vid = vid ?? nextVid++;
    if (this.vid >= nextVid) nextVid = this.vid + 1;
    this.spec = VEHICLES[type];
    this.paint = paint.clone();
    this.owner = owner;
    this.label = label ?? this.spec.name;
    const s = this.spec;
    this.groundOffset = this.rest * 0.82 + s.wheelRadius;
    const w = physics.world;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body = w.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y + this.groundOffset + 0.05, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.05)
        .setAngularDamping(0.8)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    const clearance = 0.22;
    const hh = (s.height - clearance) / 2;
    const cy = -this.groundOffset + clearance + hh;
    const m = s.mass;
    const Ix = (m / 12) * (s.height ** 2 + s.length ** 2);
    const Iy = (m / 12) * (s.width ** 2 + s.length ** 2);
    const Iz = (m / 12) * (s.width ** 2 + s.height ** 2);
    this.collider = w.createCollider(
      RAPIER.ColliderDesc.cuboid(s.width / 2, hh, s.length / 2)
        .setTranslation(0, cy, 0)
        .setMassProperties(m, { x: 0, y: -this.groundOffset + 0.5, z: 0.05 }, { x: Ix, y: Iy, z: Iz }, { w: 1, x: 0, y: 0, z: 0 })
        .setFriction(0.35)
        .setRestitution(0.1)
        .setCollisionGroups(groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.TRAFFIC | GROUP.PLAYER | GROUP.DYNAMIC | GROUP.VEHICLE))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    );
    this.vc = w.createVehicleController(this.body);
    (this.vc as unknown as { setIndexForwardAxis: number }).setIndexForwardAxis = 2;
    const hb = s.wheelBase / 2;
    const ht = s.track / 2;
    for (const [wx, wz] of [
      [ht, hb],
      [-ht, hb],
      [ht, -hb],
      [-ht, -hb],
    ]) {
      this.vc.addWheel({ x: wx, y: 0, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, this.rest, s.wheelRadius);
    }
    const k = s.suspension;
    for (let i = 0; i < 4; i++) {
      this.vc.setWheelSuspensionStiffness(i, k);
      this.vc.setWheelSuspensionCompression(i, 0.82 * 2 * Math.sqrt(k));
      this.vc.setWheelSuspensionRelaxation(i, 0.9 * 2 * Math.sqrt(k));
      this.vc.setWheelMaxSuspensionTravel(i, 0.26);
      this.vc.setWheelMaxSuspensionForce(i, m * 60);
      this.vc.setWheelFrictionSlip(i, s.grip);
      this.vc.setWheelSideFrictionStiffness(i, 1.0);
    }
    this.drawable = {
      type,
      x,
      z,
      yaw,
      paint: this.paint,
      head: 0,
      brake: 0,
      wheelRot: 0,
      steer: 0,
      susp: [0, 0, 0, 0],
    };
    this.syncPose();
  }

  get yaw() {
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
    return Math.atan2(f.x, f.z);
  }

  /** Driver door (left side, +x local) world position. */
  doorPoint(side: 1 | -1 = 1) {
    const p = new THREE.Vector3(side * (this.spec.width / 2 + 0.75), 0, this.spec.wheelBase * 0.12).applyQuaternion(this.quat);
    return new THREE.Vector3(this.pos.x + p.x, this.pos.y - this.groundOffset, this.pos.z + p.z);
  }

  private syncPose() {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
  }

  /** physics-rate control */
  control(h: number, input: Input | null, active: boolean) {
    const s = this.spec;
    const vc = this.vc;
    let thr = 0;
    let brk = 0;
    let str = 0;
    let hand = false;
    this.forwardSpeed = vc.currentVehicleSpeed();
    const v = this.forwardSpeed;
    if (active && input) {
      const fwd = input.down('KeyW') || input.down('ArrowUp');
      const back = input.down('KeyS') || input.down('ArrowDown');
      str = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
      hand = input.down('Space');
      if (fwd) {
        if (v < -1) brk = 1;
        else thr = 1;
      }
      if (back) {
        if (v > 1) brk = 1;
        else thr = -0.5;
      }
    }
    this.braking = brk > 0 || (!active && Math.abs(v) < 2);
    this.reversing = thr < 0 && v < 0.5;
    this.handbrake = hand;
    // steering: speed sensitive, smooth
    const maxSteer = s.steer / (1 + Math.abs(v) / 13);
    const target = str * maxSteer;
    const rate = target === 0 ? 5 : 3.2;
    this.steer += clamp(target - this.steer, -rate * h, rate * h);
    // power-limited engine
    const vKnee = s.maxSpeed * 0.32;
    let force = s.engine * this.powerMul * Math.min(1, (vKnee * this.topMul) / Math.max(Math.abs(v), 1));
    if (thr > 0 && v > s.maxSpeed * this.topMul) force = 0;
    if (thr < 0 && v < -9) force = 0;
    const drive = thr * force;
    const rwd = s.key === 'sports' || s.key === 'truck' || s.key === 'bus' || s.key === 'police';
    const awd = s.key === 'suv';
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      let e = 0;
      if (awd) e = drive / 4;
      else if (rwd) e = front ? 0 : drive / 2;
      else e = front ? drive / 2 : 0;
      vc.setWheelEngineForce(i, e);
      vc.setWheelSteering(i, front ? this.steer : 0);
      let b = brk * s.brake;
      if (!active) b = s.brake * 0.6;
      if (thr === 0 && brk === 0 && active) b = 0.8; // engine braking
      if (hand && !front) b = s.brake * 1.2;
      vc.setWheelBrake(i, b);
      vc.setWheelSideFrictionStiffness(i, hand && !front ? 0.35 : 1.0);
      vc.setWheelFrictionSlip(i, (hand && !front ? s.grip * 0.55 : s.grip) * this.gripMul);
    }
    vc.updateVehicle(h, undefined, groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.DYNAMIC | GROUP.TRAFFIC), (col) => col.handle !== this.collider.handle);
    // aerodynamic drag + downforce
    const lv = this.body.linvel();
    const sp = Math.hypot(lv.x, lv.y, lv.z);
    this.body.resetForces(true);
    if (sp > 0.5) {
      const k = 0.36 * (s.width * s.height) * 0.5;
      const f = k * sp;
      this.body.addForce({ x: -lv.x * f, y: -lv.y * f * 0.2 - sp * sp * 0.6, z: -lv.z * f }, true);
    }
    // impact detection
    const dv = Math.hypot(lv.x - this.lastVel.x, lv.y - this.lastVel.y, lv.z - this.lastVel.z);
    if (dv > 4.5) {
      this.damage = Math.min(1, this.damage + dv * 0.01);
      this.onImpact?.(dv, this);
    }
    this.lastVel.set(lv.x, lv.y, lv.z);
    this.speed = sp;
    this.wheelRot += (v * h) / s.wheelRadius;
    // engine "rpm" for audio
    const gearSpeeds = [0, 9, 17, 26, 36, 48, 80];
    let g = 1;
    while (g < 6 && Math.abs(v) > gearSpeeds[g]) g++;
    this.gear = g;
    const lo = gearSpeeds[g - 1];
    const hi = gearSpeeds[g];
    const target2 = 0.18 + 0.82 * clamp((Math.abs(v) - lo) / (hi - lo), 0, 1);
    this.rpm = damp(this.rpm, thr !== 0 ? Math.max(target2, 0.35) : target2 * 0.7, 8, h);
    // flip recovery
    this.syncPose();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    if (up.y < 0.3 && sp < 3) {
      this.upsideT += h;
      if (this.upsideT > 2.5) this.reset();
    } else this.upsideT = 0;
    if (this.pos.y < -20) this.reset(true);
  }

  reset(toRoad = false) {
    const yaw = this.yaw;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const y = toRoad ? 2 : this.pos.y + 1.2;
    this.body.setTranslation({ x: this.pos.x, y, z: this.pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.upsideT = 0;
  }

  teleport(x: number, y: number, z: number, yaw: number) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.setTranslation({ x, y: y + this.groundOffset + 0.05, z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.lastVel.set(0, 0, 0);
    this.syncPose();
  }

  /** render-rate drawable */
  getDrawable(night: number): VehicleDrawable {
    const d = this.drawable;
    const down = new THREE.Vector3(0, -this.groundOffset, 0).applyQuaternion(this.quat);
    d.x = this.pos.x + down.x;
    d.y = this.pos.y + down.y;
    d.z = this.pos.z + down.z;
    const e = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
    d.yaw = e.y;
    d.pitch = e.x;
    d.roll = e.z;
    d.head = this.headlights || night > 0.5 ? 1 : 0;
    d.brake = this.braking ? 1 : 0;
    d.siren = this.siren ? 1 : 0;
    d.hazard = 0;
    d.wheelRot = this.wheelRot;
    d.steer = this.steer;
    for (let i = 0; i < 4; i++) {
      const sl = this.vc.wheelSuspensionLength(i) ?? this.rest;
      d.susp![i] = this.groundOffset - sl - this.spec.wheelRadius;
    }
    return d;
  }

  dispose() {
    const w = this.physics.world;
    w.removeVehicleController(this.vc);
    w.removeRigidBody(this.body);
  }
}
