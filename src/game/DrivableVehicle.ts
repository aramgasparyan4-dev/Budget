import * as THREE from 'three';
import { RAPIER, Physics, GROUP, groups } from '../engine/Physics';
import { VEHICLES, VehicleSpec } from '../sim/vehicles';
import type { Input } from '../engine/Input';
import type { VehicleDrawable } from '../render/VehicleRenderer';
import { clamp, damp, wrapAngle } from '../core/math';

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
  /**
   * Arcade drifting (Near Miss). Space, or a tap of the brake, while steering at speed kicks the back
   * out. In the slide the direction of travel bends toward the nose at a fixed rate, so the angle settles
   * at (yaw rate / that rate): steer into the slide to hold or deepen it, counter-steer to straighten.
   */
  driftAssist = false;
  /** arcade help for turning (MyGarage Drive): more lock at speed, more grip, the car follows the wheel */
  handlingAssist = false;
  /** analog controls for an AI driver; when set, the keyboard is ignored (steer +1 = full left) */
  aiInput: { throttle: number; brake: number; steer: number; handbrake: boolean } | null = null;
  /** brake force multiplier (upgrades) */
  brakeMul = 1;
  /** flashing hazard lights (a damaged car) */
  hazards = false;
  drifting = false;
  /** angle between the nose and the direction of travel, degrees (positive: nose left of travel) */
  slipAngle = 0;
  private driftT = 0;
  private settleT = 0;
  private gripBack = 1;
  private lastBack = false;
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
    let back = false;
    this.forwardSpeed = vc.currentVehicleSpeed();
    const v = this.forwardSpeed;
    let steerAnalog: number | null = null;
    if (active && this.aiInput) {
      const ai = this.aiInput;
      steerAnalog = clamp(ai.steer, -1, 1);
      str = Math.sign(steerAnalog);
      hand = ai.handbrake;
      if (ai.brake > 0.05) {
        if (v > 1) brk = ai.brake;
        else thr = -0.5 * ai.brake;
      } else thr = clamp(ai.throttle, 0, 1);
    } else if (active && input) {
      const fwd = input.down('KeyW') || input.down('ArrowUp');
      back = input.down('KeyS') || input.down('ArrowDown');
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
    // drift state
    const lv0 = this.body.linvel();
    const sp0 = Math.hypot(lv0.x, lv0.z);
    const beta0 = sp0 > 2 ? wrapAngle(this.yaw - Math.atan2(lv0.x, lv0.z)) : 0;
    this.slipAngle = (beta0 * 180) / Math.PI;
    if (this.driftAssist && active) {
      const kick = (hand || (back && !this.lastBack)) && str !== 0 && sp0 > 11 && v > 0;
      if (!this.drifting && kick) {
        this.drifting = true;
        this.driftT = 0;
        this.settleT = 0;
        const av = this.body.angvel();
        this.body.setAngvel({ x: av.x, y: av.y + str * 0.9, z: av.z }, true);
      }
      if (this.drifting) {
        this.driftT += h;
        this.settleT = Math.abs(beta0) < 0.12 && !hand ? this.settleT + h : 0;
        if ((this.driftT > 0.35 && this.settleT > 0.2) || sp0 < 7) this.endDrift();
      }
      this.lastBack = back;
    } else if (this.drifting) this.endDrift();
    this.gripBack = Math.min(1, this.gripBack + h * 3);
    // steering: speed sensitive, smooth
    // the turning help stays out of drifts and handbrake turns, which keep their own feel
    const assist = this.handlingAssist && !this.drifting && !hand;
    const maxSteer = s.steer / (1 + Math.abs(v) / (assist ? 19 : 13));
    const target = (steerAnalog ?? str) * maxSteer;
    const rate = target === 0 ? 5 : 3.2;
    this.steer += clamp(target - this.steer, -rate * h, rate * h);
    // power-limited engine
    const vKnee = s.maxSpeed * (s.torqueKnee ?? 0.32);
    let force = s.engine * this.powerMul * Math.min(1, (vKnee * this.topMul) / Math.max(Math.abs(v), 1));
    if (thr > 0 && v > s.maxSpeed * this.topMul) force = 0;
    if (thr < 0 && v < -9) force = 0;
    const drive = thr * force;
    const rwd = s.drive ? s.drive === 'rwd' : s.key === 'sports' || s.key === 'truck' || s.key === 'bus' || s.key === 'police';
    const awd = s.drive ? s.drive === 'awd' : s.key === 'suv';
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      let e = 0;
      if (awd) e = drive / 4;
      else if (rwd) e = front ? 0 : drive / 2;
      else e = front ? drive / 2 : 0;
      vc.setWheelEngineForce(i, e);
      vc.setWheelSteering(i, front ? this.steer : 0);
      let b = brk * s.brake * this.brakeMul;
      if (!active) b = s.brake * 0.6;
      if (thr === 0 && brk === 0 && active) b = 0.8; // engine braking
      if (hand && !front) b = this.drifting ? s.brake * 0.15 : s.brake * 1.2;
      vc.setWheelBrake(i, b);
      // in a drift the tires hand lateral control to the drift model; grip returns gradually after
      const side = this.drifting ? 0.02 : (hand && !front ? 0.35 : 1.0) * (0.25 + 0.75 * this.gripBack);
      vc.setWheelSideFrictionStiffness(i, side);
      vc.setWheelFrictionSlip(i, (hand && !front ? s.grip * 0.55 : s.grip) * this.gripMul * (assist ? 1.12 : 1));
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
    if (this.drifting) this.driftStep(h, maxSteer, hand);
    else if (assist) this.assistStep(h, v);
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

  /** world contact point of wheel i (0, 1 front; 2, 3 rear), or null while it is in the air */
  wheelContact(i: number): { x: number; y: number; z: number } | null {
    if (!this.vc.wheelIsInContact(i)) return null;
    const p = this.vc.wheelContactPoint(i);
    return p ? { x: p.x, y: p.y, z: p.z } : null;
  }

  private endDrift() {
    this.drifting = false;
    this.gripBack = 0;
  }

  /**
   * Turning help: when the car turns less than the wheel asks for (bicycle model, up to an arcade
   * 30 m/s² of cornering), the missing rotation is added, and the direction of travel is turned by
   * the same amount so it does not just slide; with the wheel straight any leftover rotation dies
   * away. The tyres keep doing their own work. Never while drifting, on the handbrake or reversing.
   */
  private assistStep(h: number, v: number) {
    const lv = this.body.linvel();
    const sp = Math.hypot(lv.x, lv.z);
    if (sp < 3 || v < 0.5 || this.upsideT > 0) return;
    const av = this.body.angvel();
    let y = av.y;
    if (Math.abs(this.steer) > 0.01) {
      const aMax = 30 * this.gripMul;
      const want = clamp((v * Math.tan(this.steer)) / this.spec.wheelBase, -aMax / sp, aMax / sp);
      if (Math.sign(y) !== Math.sign(want) || Math.abs(y) < Math.abs(want)) y += (want - y) * (1 - Math.exp(-7 * h));
    } else y *= Math.exp(-2.5 * h);
    const extra = y - av.y;
    this.body.setAngvel({ x: av.x, y, z: av.z }, true);
    if (Math.abs(extra) > 1e-4 && Math.abs(this.steer) > 0.01) {
      const nt = Math.atan2(lv.x, lv.z) + extra * h;
      this.body.setLinvel({ x: Math.sin(nt) * sp, y: lv.y, z: Math.cos(nt) * sp }, true);
    }
  }

  private driftStep(h: number, maxSteer: number, hand: boolean) {
    const lv = this.body.linvel();
    const spd = Math.hypot(lv.x, lv.z);
    const travel = Math.atan2(lv.x, lv.z);
    const beta = wrapAngle(this.yaw - travel);
    // travel bends toward the nose; the steady angle is (yaw rate / LAMBDA)
    const LAMBDA = 1.5;
    const nt = travel + beta * Math.min(1, LAMBDA * h);
    const scrub = 1 - (0.03 + 0.1 * Math.sin(beta) ** 2 + (hand ? 0.3 : 0)) * h;
    this.body.setLinvel({ x: Math.sin(nt) * spd * scrub, y: lv.y, z: Math.cos(nt) * spd * scrub }, true);
    // yaw rate follows the steering, and is pulled back past ~55 degrees so the car doesn't spin
    const steerN = maxSteer > 0 ? clamp(this.steer / maxSteer, -1, 1) : 0;
    let target = steerN * 1.35;
    const LIMIT = 0.95;
    if (Math.abs(beta) > LIMIT) target -= Math.sign(beta) * (Math.abs(beta) - LIMIT) * 6;
    const av = this.body.angvel();
    this.body.setAngvel({ x: av.x, y: av.y + (target - av.y) * Math.min(1, 7 * h), z: av.z }, true);
  }

  reset(toRoad = false) {
    const yaw = this.yaw;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const y = toRoad ? 2 : this.pos.y + 1.2;
    this.body.setTranslation({ x: this.pos.x, y, z: this.pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.lastVel.set(0, 0, 0);
    this.upsideT = 0;
  }

  /** dead stop where it is (a racing crash): no velocity, no spin, no slide */
  stop() {
    this.body.setLinvel({ x: 0, y: Math.min(0, this.body.linvel().y), z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.lastVel.set(0, 0, 0);
    if (this.drifting) this.endDrift();
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
    d.hazard = this.hazards ? 1 : 0;
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
