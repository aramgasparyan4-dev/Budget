import * as THREE from 'three';
import { RAPIER, Physics, GROUP, groups } from '../engine/Physics';
import type { Input } from '../engine/Input';
import { Crowd, HumanLook, Pose } from '../render/Human';
import { clamp, damp, dampAngle } from '../core/math';

const RADIUS = 0.32;
const HALF = 0.56;

export class PlayerController {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  kcc: RAPIER.KinematicCharacterController;
  pos = new THREE.Vector3();
  renderPos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  phase = 0;
  gait = 0;
  pose: number = Pose.Stand;
  poseAux = 0;
  stamina = 1;
  airTime = 0;
  speed = 0;
  enabled = true;
  visible = true;
  /** externally forced pose (talking, sitting, etc.) */
  forcedPose: number | null = null;
  onFootstep: ((run: boolean) => void) | null = null;
  onLand: ((v: number) => void) | null = null;
  private lastPhaseStep = 0;
  private desired = new THREE.Vector3();
  private moveLock = 0;
  sprintMul = 1;

  constructor(private physics: Physics, public look: HumanLook, public crowd: Crowd, x: number, y: number, z: number) {
    const w = physics.world;
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + HALF + RADIUS, z));
    this.collider = w.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(groups(GROUP.PLAYER, GROUP.STATIC | GROUP.TRAFFIC | GROUP.VEHICLE | GROUP.DYNAMIC | GROUP.INTERIOR)),
      this.body,
    );
    this.kcc = w.createCharacterController(0.02);
    this.kcc.enableAutostep(0.42, 0.18, false);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(75);
    this.kcc.setSlideEnabled(true);
    this.pos.set(x, y, z);
    this.renderPos.copy(this.pos);
  }

  teleport(x: number, y: number, z: number, yaw?: number) {
    this.body.setTranslation({ x, y: y + HALF + RADIUS + 0.02, z }, true);
    this.body.setNextKinematicTranslation({ x, y: y + HALF + RADIUS + 0.02, z });
    this.pos.set(x, y, z);
    this.renderPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
  }

  setCollisionEnabled(on: boolean) {
    this.collider.setEnabled(on);
  }

  lock(seconds: number) {
    this.moveLock = Math.max(this.moveLock, seconds);
  }

  /** Physics-rate update. camYaw: forward direction of the camera. */
  fixedUpdate(h: number, input: Input, camYaw: number, allowInput: boolean) {
    if (!this.enabled) return;
    let mx = 0;
    let mz = 0;
    const canMove = allowInput && this.moveLock <= 0 && this.forcedPose === null;
    if (canMove) {
      mz = input.axis('KeyS', 'KeyW');
      mx = input.axis('KeyA', 'KeyD');
      if (input.down('ArrowUp')) mz = 1;
      if (input.down('ArrowDown')) mz = -1;
      if (input.down('ArrowLeft')) mx = -1;
      if (input.down('ArrowRight')) mx = 1;
    }
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let wx = fx * mz + rx * mx;
    let wz = fz * mz + rz * mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const moving = wl > 0.01;
    const sprint = moving && canMove && (input.down('ShiftLeft') || input.down('ShiftRight')) && this.stamina > 0.05;
    const walk = canMove && (input.down('KeyC') || input.down('ControlLeft'));
    let target = walk ? 1.75 : sprint ? 7.4 * this.sprintMul : 4.3;
    if (!moving) target = 0;
    if (sprint) this.stamina = Math.max(0, this.stamina - h * 0.12);
    else this.stamina = Math.min(1, this.stamina + h * (moving ? 0.08 : 0.18));
    const accel = this.grounded ? (moving ? 11 : 14) : 2.2;
    this.vel.x = damp(this.vel.x, wx * target, accel, h);
    this.vel.z = damp(this.vel.z, wz * target, accel, h);
    // gravity & jump
    if (this.grounded) {
      if (this.vel.y < 0) this.vel.y = -2;
      if (canMove && input.hit('Space')) {
        this.vel.y = 6.4;
        this.grounded = false;
        this.airTime = 0.01;
      }
    }
    this.vel.y -= 21 * h;
    this.desired.set(this.vel.x * h, this.vel.y * h, this.vel.z * h);
    this.kcc.computeColliderMovement(this.collider, this.desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(GROUP.PLAYER, GROUP.STATIC | GROUP.TRAFFIC | GROUP.VEHICLE | GROUP.DYNAMIC | GROUP.INTERIOR));
    const mv = this.kcc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    // horizontal velocity after collisions (prevents pushing into walls)
    if (h > 0) {
      const ax = mv.x / h;
      const az = mv.z / h;
      if (Math.hypot(ax, az) < Math.hypot(this.vel.x, this.vel.z) - 0.5) {
        this.vel.x = damp(this.vel.x, ax, 20, h);
        this.vel.z = damp(this.vel.z, az, 20, h);
      }
      if (this.vel.y > 0 && mv.y < this.vel.y * h * 0.5) this.vel.y = 0; // bumped head
    }
    if (!wasGrounded && this.grounded) {
      this.onLand?.(-this.vel.y);
      this.airTime = 0;
    }
    if (!this.grounded) this.airTime += h;
    const t = this.body.translation();
    const nx = t.x + mv.x;
    const ny = t.y + mv.y;
    const nz = t.z + mv.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.pos.set(nx, ny - HALF - RADIUS, nz);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (moving && this.speed > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), sprint ? 9 : 12, h);
    if (this.moveLock > 0) this.moveLock -= h;
  }

  /** Render-rate update: animation + instance write. */
  update(dt: number) {
    this.renderPos.x = damp(this.renderPos.x, this.pos.x, 30, dt);
    this.renderPos.y = damp(this.renderPos.y, this.pos.y, 24, dt);
    this.renderPos.z = damp(this.renderPos.z, this.pos.z, 30, dt);
    const sp = this.speed;
    const gaitTarget = sp < 0.15 ? 0 : sp < 2.4 ? sp / 2.4 : 1 + clamp((sp - 2.4) / 4.6, 0, 1);
    this.gait = damp(this.gait, gaitTarget, 10, dt);
    const cadence = sp < 2.4 ? 3.6 : 2.3;
    this.phase += dt * sp * cadence;
    const step = Math.floor(this.phase / Math.PI);
    if (step !== this.lastPhaseStep) {
      this.lastPhaseStep = step;
      if (this.grounded && sp > 0.5) this.onFootstep?.(sp > 5);
    }
    let pose: number = Pose.Stand;
    let aux = 0;
    if (!this.grounded && this.airTime > 0.12) {
      pose = Pose.Jump;
      aux = clamp(this.airTime * 3, 0, 1);
    }
    if (this.forcedPose !== null) {
      pose = this.forcedPose;
      aux = this.poseAux;
    }
    this.pose = pose;
    this.crowd.begin();
    if (this.visible && this.enabled) {
      this.crowd.push(this.renderPos.x, this.renderPos.y, this.renderPos.z, this.yaw, this.look, this.phase, pose === Pose.Stand ? this.gait : 0, pose, aux);
    }
    this.crowd.end();
  }

  dispose() {
    this.physics.world.removeCharacterController(this.kcc);
    this.physics.world.removeRigidBody(this.body);
  }
}
