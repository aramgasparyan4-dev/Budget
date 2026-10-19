import RAPIER from '@dimforge/rapier3d-compat';
import type { CityData } from '../world/types';
import { CURB_H, SW } from '../world/types';
import { PLATFORM } from '../world/CityGenerator';
import { terrainHeight, TERRAIN_EXTENT } from '../world/terrain';
import type { PropModel } from '../render/propModels';
import type { PropType } from '../world/types';

export { RAPIER };

// collision groups (membership << 16 | filter)
export const GROUP = {
  STATIC: 0x0001,
  PLAYER: 0x0002,
  VEHICLE: 0x0004,
  TRAFFIC: 0x0008,
  DYNAMIC: 0x0010,
  INTERIOR: 0x0020,
  NPC: 0x0040,
};
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

let initPromise: Promise<void> | null = null;
export function initRapier() {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

export class Physics {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  private acc = 0;
  readonly step = 1 / 60;
  staticCount = 0;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = this.step;
    this.events = new RAPIER.EventQueue(true);
  }

  /** Fixed-step integration; returns number of substeps performed. */
  advance(dt: number, beforeStep?: (h: number) => void, afterStep?: (h: number) => void) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= this.step && n < 5) {
      beforeStep?.(this.step);
      this.world.step(this.events);
      afterStep?.(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === 5) this.acc = 0;
    return n;
  }

  get alpha() {
    return this.acc / this.step;
  }

  addStaticBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, rotY = 0, group = GROUP.STATIC, friction = 0.8) {
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setFriction(friction);
    if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    desc.setCollisionGroups(groups(group, 0xffff));
    this.staticCount++;
    return this.world.createCollider(desc);
  }

  addStaticCyl(cx: number, cy: number, cz: number, r: number, hh: number, group = GROUP.STATIC) {
    const desc = RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(cx, cy, cz).setFriction(0.6);
    desc.setCollisionGroups(groups(group, 0xffff));
    this.staticCount++;
    return this.world.createCollider(desc);
  }

  buildCity(city: CityData, models: Record<PropType, PropModel | null>, seed: number) {
    // ground slab for the platform (top at y=0)
    this.addStaticBox(0, -1, 0, PLATFORM + 2, 1, PLATFORM + 2, 0, GROUP.STATIC, 1.0);
    // raised blocks (sidewalk + lots) as one slab each
    for (const b of city.blocks) {
      const x0 = b.x0 - SW;
      const x1 = b.x1 + SW;
      const z0 = b.z0 - SW;
      const z1 = b.z1 + SW;
      this.addStaticBox((x0 + x1) / 2, CURB_H / 2, (z0 + z1) / 2, (x1 - x0) / 2, CURB_H / 2, (z1 - z0) / 2);
    }
    // outer sidewalks
    for (const q of city.ground) {
      if (q.kind !== 1 || Math.abs(q.y - CURB_H) > 0.001) continue;
      // only outer strips (not covered by blocks): test centre against block rects
      const cx = (q.x0 + q.x1) / 2;
      const cz = (q.z0 + q.z1) / 2;
      const inBlock = city.blocks.some((b) => cx > b.x0 - SW - 0.01 && cx < b.x1 + SW + 0.01 && cz > b.z0 - SW - 0.01 && cz < b.z1 + SW + 0.01);
      if (inBlock) continue;
      this.addStaticBox(cx, CURB_H / 2, cz, (q.x1 - q.x0) / 2, CURB_H / 2, (q.z1 - q.z0) / 2);
    }
    // promenade
    for (const q of city.ground) {
      if (q.kind === 3 && Math.abs(q.y - CURB_H) < 0.001) {
        this.addStaticBox((q.x0 + q.x1) / 2, CURB_H / 2, (q.z0 + q.z1) / 2, (q.x1 - q.x0) / 2, CURB_H / 2, (q.z1 - q.z0) / 2);
      }
    }
    // seawall barrier (backs up the railing so cars cannot leave the city into the bay)
    this.addStaticBox(PLATFORM - 1.2, 1.2, 0, 0.4, 1.2, PLATFORM + 20);
    // buildings
    for (const bld of city.buildings) {
      for (const p of bld.parts) {
        if (!p.collide) continue;
        this.addStaticBox((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2, (p.x1 - p.x0) / 2, (p.y1 - p.y0) / 2, (p.z1 - p.z0) / 2);
      }
    }
    // props
    for (const pr of city.props) {
      const m = models[pr.type];
      if (!m) continue;
      const c = Math.cos(pr.rot);
      const s = Math.sin(pr.rot);
      for (const col of m.colliders) {
        const lx = col.x * pr.scale;
        const lz = col.z * pr.scale;
        const wx = pr.x + lx * c + lz * s;
        const wz = pr.z - lx * s + lz * c;
        const wy = pr.y + col.y * pr.scale;
        if (col.kind === 'cyl') this.addStaticCyl(wx, wy, wz, col.hx * pr.scale, col.hy * pr.scale);
        else this.addStaticBox(wx, wy, wz, col.hx * pr.scale, col.hy * pr.scale, col.hz * pr.scale, pr.rot);
      }
    }
    // terrain heightfield (outside the platform)
    const n = 110;
    const size = TERRAIN_EXTENT * 2;
    const heights = new Float32Array((n + 1) * (n + 1));
    // rapier heightfield: column-major, rows along x? (nrows along z? ) we sample symmetric grid
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = -TERRAIN_EXTENT + (i / n) * size;
        const z = -TERRAIN_EXTENT + (j / n) * size;
        const inside = x > -PLATFORM + 1 && x < PLATFORM - 1 && z > -PLATFORM + 1 && z < PLATFORM - 1;
        heights[i * (n + 1) + j] = inside ? -2 : terrainHeight(x, z, seed);
      }
    }
    const hf = RAPIER.ColliderDesc.heightfield(n, n, heights, { x: size, y: 1, z: size }).setFriction(0.9);
    hf.setCollisionGroups(groups(GROUP.STATIC, 0xffff));
    this.world.createCollider(hf);
  }

  /** Raycast against static geometry; returns hit distance or null. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number, filter = GROUP.STATIC | GROUP.INTERIOR): number | null {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    const hit = this.world.castRay(ray, max, true, undefined, groups(0xffff, filter));
    return hit ? hit.timeOfImpact : null;
  }

  /** Sphere cast for the camera; returns safe distance. */
  sphereCast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number, radius: number, filter = GROUP.STATIC | GROUP.INTERIOR): number {
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(
      { x: ox, y: oy, z: oz },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: dx, y: dy, z: dz },
      shape,
      0,
      max,
      true,
      undefined,
      groups(0xffff, filter),
    );
    return hit ? hit.time_of_impact : max;
  }

  dispose() {
    this.world.free();
    this.events.free();
  }
}
