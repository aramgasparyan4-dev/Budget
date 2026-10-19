import * as THREE from 'three';
import type { Input } from '../engine/Input';
import type { Physics } from '../engine/Physics';
import { GROUP } from '../engine/Physics';
import { clamp, damp, dampAngle, lerp } from '../core/math';

export type CamMode = 'foot' | 'vehicle' | 'dialogue' | 'cinematic' | 'interior';

export class CameraController {
  yaw = 0;
  pitch = 0.22;
  dist = 4.6;
  private curDist = 4.6;
  private pivot = new THREE.Vector3();
  private pivotInit = false;
  mode: CamMode = 'foot';
  sensitivity = 1;
  invertY = false;
  baseFov = 62;
  private idleMouse = 0;
  shake = 0;
  // dialogue framing
  dialogueTarget = new THREE.Vector3();
  dialogueFrom = new THREE.Vector3();
  // cinematic path
  cineFrom = new THREE.Vector3();
  cineTo = new THREE.Vector3();
  cineLookFrom = new THREE.Vector3();
  cineLookTo = new THREE.Vector3();
  cineT = 0;
  cineDur = 1;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private look = new THREE.Vector3();
  private lookSmoothed = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  snap() {
    this.pivotInit = false;
  }

  handleMouse(input: Input, allow: boolean) {
    if (!allow) return;
    const s = 0.0024 * this.sensitivity;
    if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0.5) this.idleMouse = 0;
    this.yaw -= input.mouseDX * s;
    this.pitch += input.mouseDY * s * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.75, 1.25);
    if (input.wheel) this.dist = clamp(this.dist + input.wheel * 0.5, 2.0, 10);
  }

  update(dt: number, target: THREE.Vector3, physics: Physics | null, opts: { heading?: number; speed?: number; height?: number; interior?: boolean } = {}) {
    const cam = this.camera;
    this.idleMouse += dt;
    if (this.mode === 'cinematic') {
      this.cineT = Math.min(1, this.cineT + dt / this.cineDur);
      const t = this.cineT * this.cineT * (3 - 2 * this.cineT);
      cam.position.lerpVectors(this.cineFrom, this.cineTo, t);
      this.look.lerpVectors(this.cineLookFrom, this.cineLookTo, t);
      cam.lookAt(this.look);
      cam.fov = damp(cam.fov, this.baseFov, 4, dt);
      cam.updateProjectionMatrix();
      return;
    }
    if (this.mode === 'dialogue') {
      cam.position.x = damp(cam.position.x, this.dialogueFrom.x, 5, dt);
      cam.position.y = damp(cam.position.y, this.dialogueFrom.y, 5, dt);
      cam.position.z = damp(cam.position.z, this.dialogueFrom.z, 5, dt);
      this.lookSmoothed.lerp(this.dialogueTarget, 1 - Math.exp(-6 * dt));
      cam.lookAt(this.lookSmoothed);
      cam.fov = damp(cam.fov, 45, 4, dt);
      cam.updateProjectionMatrix();
      return;
    }
    const vehicle = this.mode === 'vehicle';
    const height = opts.height ?? (vehicle ? 1.4 : 1.55);
    this.tmp.set(target.x, target.y + height, target.z);
    if (!this.pivotInit) {
      this.pivot.copy(this.tmp);
      this.pivotInit = true;
      this.curDist = this.dist;
    } else {
      const lam = vehicle ? 18 : 16;
      this.pivot.x = damp(this.pivot.x, this.tmp.x, lam, dt);
      this.pivot.y = damp(this.pivot.y, this.tmp.y, vehicle ? 10 : 12, dt);
      this.pivot.z = damp(this.pivot.z, this.tmp.z, lam, dt);
    }
    let dist = this.dist;
    let pitch = this.pitch;
    if (vehicle) {
      const sp = opts.speed ?? 0;
      dist = this.dist * 1.35 + 1.5 + Math.min(sp, 40) * 0.05;
      if (opts.heading !== undefined && this.idleMouse > 1.2 && sp > 2) {
        this.yaw = dampAngle(this.yaw, opts.heading, 2.6, dt);
        this.pitch = damp(this.pitch, 0.18, 1.5, dt);
      }
      pitch = Math.max(this.pitch, 0.05);
    }
    if (opts.interior) dist = Math.min(dist, 3.6);
    const cp = Math.cos(pitch);
    const dx = -Math.sin(this.yaw) * cp;
    const dy = Math.sin(pitch);
    const dz = -Math.cos(this.yaw) * cp;
    // shoulder offset (to the right of the character) on foot
    const shoulder = vehicle ? 0 : 0.38;
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    const ox = this.pivot.x + rx * shoulder;
    const oz = this.pivot.z + rz * shoulder;
    const oy = this.pivot.y;
    let safe = dist;
    if (physics) {
      safe = physics.sphereCast(ox, oy, oz, dx, dy, dz, dist, 0.22, GROUP.STATIC | GROUP.INTERIOR) - 0.05;
      safe = Math.max(0.6, safe);
    }
    // pull in fast, ease out slowly
    this.curDist = safe < this.curDist ? damp(this.curDist, safe, 30, dt) : damp(this.curDist, safe, 3.5, dt);
    cam.position.set(ox + dx * this.curDist, oy + dy * this.curDist, oz + dz * this.curDist);
    // keep the camera above ground
    if (cam.position.y < target.y + 0.35) cam.position.y = target.y + 0.35;
    this.look.set(ox, oy, oz);
    if (vehicle) this.look.y += 0.2;
    this.lookSmoothed.copy(this.look);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.25;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.25;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    cam.lookAt(this.look);
    const fovTarget = vehicle ? this.baseFov + Math.min(opts.speed ?? 0, 45) * 0.32 : this.baseFov;
    cam.fov = damp(cam.fov, fovTarget, 3, dt);
    cam.updateProjectionMatrix();
  }

  /** Aim the third-person yaw so the camera sits behind a heading. */
  alignBehind(heading: number) {
    this.yaw = heading;
  }

  startCinematic(from: THREE.Vector3, to: THREE.Vector3, lookFrom: THREE.Vector3, lookTo: THREE.Vector3, dur: number) {
    this.mode = 'cinematic';
    this.cineFrom.copy(from);
    this.cineTo.copy(to);
    this.cineLookFrom.copy(lookFrom);
    this.cineLookTo.copy(lookTo);
    this.cineT = 0;
    this.cineDur = dur;
  }

  startDialogue(player: THREE.Vector3, npc: THREE.Vector3) {
    this.mode = 'dialogue';
    // over-the-shoulder: camera behind player's right shoulder looking at NPC face
    const dx = npc.x - player.x;
    const dz = npc.z - player.z;
    const l = Math.hypot(dx, dz) || 1;
    const fx = dx / l;
    const fz = dz / l;
    const rx = -fz;
    const rz = fx;
    this.dialogueFrom.set(player.x - fx * 1.5 + rx * 0.75, player.y + 1.75, player.z - fz * 1.5 + rz * 0.75);
    this.dialogueTarget.set(lerp(player.x, npc.x, 0.75), npc.y + 1.55, lerp(player.z, npc.z, 0.75));
    this.lookSmoothed.copy(this.look);
    void this.tmp2;
  }
}
