import * as THREE from 'three';
import type { Session, Interactable } from './Session';
import type { Building, BusinessDef, InteriorType } from '../world/types';
import { CURB_H } from '../world/types';
import { buildLayout, Layout, Slot } from './interiorLayouts';
import { MeshBuilder, BASIC_LAYOUT, addBox, addCylinder, lin } from '../render/MeshBuilder';
import { toBufferGeometry } from '../render/propModels';
import { createPropMaterial } from '../render/materials';
import { RAPIER, GROUP, groups } from '../engine/Physics';
import type { NPC } from '../sim/npc/types';
import { npcName } from '../sim/npc/Population';
import { Pose } from '../render/Human';
import { VehicleRenderer } from '../render/VehicleRenderer';
import { VEHICLES, DEALERSHIP_STOCK } from '../sim/vehicles';
import { useShop, ShopItemView } from '../state/uiStores';
import { useStore } from '../state/store';
import { formatMoney, damp, dampAngle } from '../core/math';
import { MIN_PER_DAY, fmtTime } from '../sim/Clock';
import { OUTFITS, APARTMENT_UPGRADES, HOMES } from './PlayerState';
import { G } from '../render/globals';

export const INTERIOR_ORIGIN = new THREE.Vector3(0, -300, 0);

interface Actor {
  npc: NPC;
  slot: Slot | null;
  x: number;
  z: number;
  yaw: number;
  state: 'enter' | 'idle' | 'leave';
  phase: number;
  gait: number;
  talk: boolean;
  t: number;
  target: { x: number; z: number } | null;
}

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  kind: 'food' | 'gift' | 'misc' | 'service';
  hunger?: number;
  energy?: number;
  fun?: number;
  gift?: string;
  desc?: string;
  take?: boolean;
}

const CATALOG: Partial<Record<string, CatalogItem[]>> = {
  cafe: [
    { id: 'espresso', name: 'Espresso', price: 3.5, kind: 'food', energy: 0.18, desc: '+Energy' },
    { id: 'latte', name: 'Oat Latte', price: 5, kind: 'food', energy: 0.12, hunger: 0.05, desc: '+Energy' },
    { id: 'croissant', name: 'Butter Croissant', price: 4, kind: 'food', hunger: 0.25, desc: '+Hunger' },
    { id: 'sandwich', name: 'Club Sandwich', price: 8.5, kind: 'food', hunger: 0.45, desc: '+Hunger' },
    { id: 'coffee', name: 'Coffee to go', price: 4, kind: 'food', energy: 0.12, take: true, gift: 'coffee', desc: 'Take away · gift' },
  ],
  restaurant: [
    { id: 'pasta', name: 'House Pasta', price: 16, kind: 'food', hunger: 0.8, desc: 'Big meal' },
    { id: 'burger', name: 'Burger & Fries', price: 14, kind: 'food', hunger: 0.75, desc: 'Big meal' },
    { id: 'salad', name: 'Garden Salad', price: 11, kind: 'food', hunger: 0.5, energy: 0.05 },
    { id: 'dessert', name: 'Chocolate Torte', price: 7, kind: 'food', hunger: 0.2, fun: 0.1 },
    { id: 'takeout', name: 'Takeout box', price: 12, kind: 'food', hunger: 0.6, take: true, desc: 'Eat later' },
  ],
  fastfood: [
    { id: 'combo', name: 'Combo Meal', price: 9, kind: 'food', hunger: 0.7 },
    { id: 'cheeseburger', name: 'Cheeseburger', price: 5.5, kind: 'food', hunger: 0.45 },
    { id: 'fries', name: 'Fries', price: 3, kind: 'food', hunger: 0.2 },
    { id: 'soda', name: 'Soda', price: 2, kind: 'food', energy: 0.05 },
  ],
  convenience: [
    { id: 'snack', name: 'Snack bar', price: 2.5, kind: 'food', hunger: 0.15, take: true },
    { id: 'energy', name: 'Energy drink', price: 4, kind: 'food', energy: 0.35, take: true, desc: 'Big energy boost' },
    { id: 'sandwich', name: 'Wrapped sandwich', price: 5, kind: 'food', hunger: 0.4, take: true },
    { id: 'flowers', name: 'Bouquet of flowers', price: 14, kind: 'gift', gift: 'flowers', take: true, desc: 'Gift' },
    { id: 'chocolate', name: 'Box of chocolates', price: 7, kind: 'gift', gift: 'chocolate', take: true, desc: 'Gift' },
    { id: 'wine', name: 'Bottle of wine', price: 15, kind: 'gift', gift: 'wine', take: true, desc: 'Gift' },
  ],
  grocery: [
    { id: 'groceries', name: 'Week of groceries', price: 38, kind: 'misc', desc: 'Stocks your fridge (7 meals)' },
    { id: 'fruit', name: 'Fresh fruit', price: 4, kind: 'food', hunger: 0.2, take: true },
    { id: 'flowers', name: 'Bouquet of flowers', price: 12, kind: 'gift', gift: 'flowers', take: true, desc: 'Gift' },
    { id: 'wine', name: 'Bottle of wine', price: 13, kind: 'gift', gift: 'wine', take: true, desc: 'Gift' },
  ],
  pharmacy: [
    { id: 'medicine', name: 'Painkillers', price: 8, kind: 'misc', take: true },
    { id: 'vitamins', name: 'Vitamins', price: 12, kind: 'food', energy: 0.2 },
  ],
  bookstore: [
    { id: 'book', name: 'Bestselling novel', price: 16, kind: 'gift', gift: 'book', take: true, desc: 'Gift' },
    { id: 'guide', name: 'Echo City guidebook', price: 10, kind: 'misc', desc: 'Reveals every business on the map' },
  ],
  electronics: [
    { id: 'headphones', name: 'Wireless headphones', price: 95, kind: 'misc', desc: 'Radio while walking (R)' },
    { id: 'powerbank', name: 'Power bank', price: 35, kind: 'misc', desc: 'Bigger bag (+2 slots)' },
  ],
  salon: [{ id: 'haircut', name: 'Haircut & style', price: 34, kind: 'service', desc: 'New hairstyle' }],
  bar: [
    { id: 'beer', name: 'Craft beer', price: 6, kind: 'food', fun: 0.15 },
    { id: 'cocktail', name: 'Signature cocktail', price: 11, kind: 'food', fun: 0.25 },
    { id: 'mocktail', name: 'Mocktail', price: 7, kind: 'food', fun: 0.12, energy: 0.05 },
  ],
  nightclub: [
    { id: 'entry', name: 'Cover charge', price: 15, kind: 'service', fun: 0.2 },
    { id: 'cocktail', name: 'Neon cocktail', price: 13, kind: 'food', fun: 0.3 },
  ],
  cinema: [{ id: 'ticket', name: 'Movie ticket', price: 13, kind: 'service', fun: 0.5, desc: 'Watch a movie (2 hours)' }],
  gym: [{ id: 'daypass', name: 'Day pass', price: 11, kind: 'service', desc: 'Work out: +stamina for the day' }],
  hotel: [{ id: 'room', name: 'Room for the night', price: 120, kind: 'service', desc: 'Sleep and save' }],
};

export class InteriorManager {
  current: {
    bld: Building;
    biz: BusinessDef | null;
    type: InteriorType;
    layout: Layout;
    group: THREE.Group;
    colliders: RAPIER.Collider[];
    actors: Actor[];
    cars: VehicleRenderer | null;
  } | null = null;
  private mat = createPropMaterial({ emissiveDay: 1.0, emissiveNight: 1.0, rough: 0.6 });
  private ambient = new THREE.HemisphereLight(0xfff4e8, 0x2a2622, 0.9);
  private syncT = 0;
  private enteredAt = 0;

  constructor(private s: Session) {
    s.providers.push(() => this.interactions());
    s.updaters.push((dt) => this.update(dt));
    s.renderHooks.push(() => this.renderActors());
  }
  private lastDt = 0;

  get inside() {
    return !!this.current;
  }

  /** world position of the door (for the outside world while we are inside) */
  get doorPos() {
    return this.current ? this.current.bld.door : null;
  }

  // ------------------------------------------------------------------ enter / exit
  canEnter(b: Building): { ok: boolean; why?: string } {
    const s = this.s;
    if (!b.interior) return { ok: false, why: 'Locked' };
    if (b.interior === 'apartment') return { ok: b.id === s.city.playerHome };
    const biz = b.businesses.map((id) => s.city.businesses[id]).find((d) => d.interior === b.interior);
    if (!biz) return { ok: false };
    const st = s.econ.biz[biz.id];
    if (st.closed) return { ok: false, why: 'Permanently closed' };
    if (!s.econ.isOpen(biz.id, s.clock.hour, s.clock.weekday)) {
      const emp = s.player.job?.biz === biz.id;
      if (!emp) return { ok: false, why: `Closed · opens ${fmtTime((biz.open % 24) * 60)}` };
    }
    return { ok: true };
  }

  enter(b: Building) {
    const s = this.s;
    if (this.current) return;
    s.fadeTo(1, () => {
      this.build(b);
      s.fadeTo(0);
    });
  }

  private build(b: Building) {
    const s = this.s;
    const type = b.interior!;
    const biz = b.businesses.map((id) => s.city.businesses[id]).find((d) => d.interior === type) ?? null;
    const L = buildLayout(type, b.seed * 31 + b.id, { upgrades: s.player.upgrades, homeTier: s.player.homeTier });
    const group = new THREE.Group();
    group.position.copy(INTERIOR_ORIGIN);
    // geometry
    const mb = new MeshBuilder(BASIC_LAYOUT);
    const hw = L.w / 2;
    const hd = L.d / 2;
    const floorC = lin(L.floor);
    addBox(mb, 0, -0.1, 0, L.w, 0.2, L.d, floorC);
    // floor pattern stripes
    if (L.floorKind === 'wood') for (let x = -hw + 0.4; x < hw; x += 0.4) addBox(mb, x, 0.003, 0, 0.012, 0.005, L.d, lin([L.floor[0] * 0.75, L.floor[1] * 0.75, L.floor[2] * 0.75]));
    if (L.floorKind === 'tile') for (let x = -hw; x <= hw; x += 1) addBox(mb, x, 0.003, 0, 0.02, 0.005, L.d, lin([L.floor[0] * 0.85, L.floor[1] * 0.85, L.floor[2] * 0.85]));
    const wallC = lin(L.wall);
    addBox(mb, 0, L.h + 0.1, 0, L.w, 0.2, L.d, lin([L.wall[0] * 0.95, L.wall[1] * 0.95, L.wall[2] * 0.95]), undefined, 0, false);
    addBox(mb, 0, L.h / 2, -hd - 0.1, L.w, L.h, 0.2, wallC);
    addBox(mb, -hw - 0.1, L.h / 2, 0, 0.2, L.h, L.d, wallC);
    addBox(mb, hw + 0.1, L.h / 2, 0, 0.2, L.h, L.d, wallC);
    // front wall with door gap
    const gap = 1.8;
    addBox(mb, -(hw + gap / 2) / 2 - gap / 4, L.h / 2, hd + 0.1, hw - gap / 2, L.h, 0.2, wallC);
    addBox(mb, (hw + gap / 2) / 2 + gap / 4, L.h / 2, hd + 0.1, hw - gap / 2, L.h, 0.2, wallC);
    addBox(mb, 0, L.h - 0.4, hd + 0.1, gap, 0.8, 0.2, wallC);
    addBox(mb, 0, 1.15, hd + 0.18, gap - 0.1, 2.3, 0.05, lin([0.1, 0.12, 0.14]), undefined, 0.15);
    // skirting + accent stripe
    addBox(mb, 0, 0.06, -hd + 0.01, L.w, 0.12, 0.04, lin(L.accent));
    // windows (emissive glow tinted by time of day)
    const night = G.uNight.value;
    const sky = night > 0.5 ? [0.05, 0.07, 0.14] : L.windowGlow;
    const wc = lin(sky as [number, number, number]);
    for (const x of [-hw * 0.6, hw * 0.6]) addBox(mb, x, L.h * 0.55, hd + 0.0, Math.min(3, hw * 0.6), L.h * 0.45, 0.04, wc, undefined, night > 0.5 ? 0.4 : 1.4);
    for (const b2 of L.boxes) addBox(mb, b2.x, b2.y, b2.z, b2.sx, b2.sy, b2.sz, lin(b2.c), b2.ry ? { tx: 0, ty: 0, tz: 0, ry: b2.ry } : undefined, b2.emit ?? 0, false);
    for (const c of L.cyls) addCylinder(mb, c.x, c.y, c.z, c.r, c.r, c.h, 14, lin(c.c), undefined, c.emit ?? 0);
    const mesh = new THREE.Mesh(toBufferGeometry(mb.build()), this.mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    for (const l of L.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);
      pl.position.set(l.x, l.y, l.z);
      group.add(pl);
    }
    group.add(this.ambient);
    s.game.scene.add(group);
    // colliders
    const w = s.game.physics!.world;
    const colliders: RAPIER.Collider[] = [];
    const o = INTERIOR_ORIGIN;
    const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) => {
      const c = w.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(o.x + cx, o.y + cy, o.z + cz).setCollisionGroups(groups(GROUP.INTERIOR, 0xffff)));
      colliders.push(c);
    };
    box(0, -0.25, 0, hw + 1, 0.25, hd + 1);
    box(0, L.h + 0.25, 0, hw + 1, 0.25, hd + 1);
    box(0, L.h / 2, -hd - 0.2, hw + 1, L.h, 0.2);
    box(-hw - 0.2, L.h / 2, 0, 0.2, L.h, hd + 1);
    box(hw + 0.2, L.h / 2, 0, 0.2, L.h, hd + 1);
    box(0, L.h / 2, hd + 0.2, hw + 1, L.h, 0.2);
    for (const b2 of L.boxes) if (b2.collide) box(b2.x, b2.y, b2.z, b2.sx / 2, b2.sy / 2, b2.sz / 2);
    for (const c of L.cyls) if (c.collide) {
      const cc = w.createCollider(RAPIER.ColliderDesc.cylinder(c.h / 2, c.r).setTranslation(o.x + c.x, o.y + c.y + c.h / 2, o.z + c.z).setCollisionGroups(groups(GROUP.INTERIOR, 0xffff)));
      colliders.push(cc);
    }
    // display cars
    let cars: VehicleRenderer | null = null;
    if (L.displayCars) {
      cars = new VehicleRenderer(8);
      cars.group.position.copy(INTERIOR_ORIGIN);
      cars.begin();
      for (const dc of L.displayCars) {
        const spec = VEHICLES[dc.type];
        cars.push({ type: dc.type, x: dc.x, y: 0.12, z: dc.z, yaw: dc.yaw, paint: new THREE.Color(spec.palette[0]), head: 0, brake: 0, wheelRot: 0, steer: 0 });
      }
      cars.end();
      s.game.scene.add(cars.group);
    }
    this.current = { bld: b, biz, type, layout: L, group, colliders, actors: [], cars };
    // player inside
    s.mode = 'interior';
    s.ctl!.teleport(o.x + L.spawn.x, o.y + 0.05, o.z + L.spawn.z, L.spawn.yaw);
    s.game.cam.yaw = L.spawn.yaw;
    s.game.cam.pitch = 0.25;
    s.game.cam.snap();
    s.game.env?.setInterior(true);
    if (s.game.chunks) s.game.chunks.group.visible = false;
    if (s.game.terrain) s.game.terrain.group.visible = false;
    s.vehR.group.visible = false;
    s.staticR.group.visible = false;
    s.crowdFar.mesh.visible = false;
    if (L.music) s.game.audio.playMusic(L.music);
    this.enteredAt = s.t;
    this.syncActors(true);
    s.game.audio.ui('open');
    if (type === 'apartment') s.objectives?.event('enterHome');
  }

  exit() {
    const s = this.s;
    if (!this.current) return;
    s.fadeTo(1, () => {
      this.teardown();
      s.fadeTo(0);
    });
  }

  private teardown() {
    const s = this.s;
    const c = this.current!;
    for (const a of c.actors) a.npc.proxy = 'none';
    s.game.scene.remove(c.group);
    c.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    if (c.cars) s.game.scene.remove(c.cars.group);
    const w = s.game.physics!.world;
    for (const col of c.colliders) w.removeCollider(col, false);
    const b = c.bld;
    this.current = null;
    const out = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][b.facing];
    s.mode = 'foot';
    s.ctl!.teleport(b.door.x + out[0] * 1.6, CURB_H + 0.05, b.door.z + out[1] * 1.6, Math.atan2(out[0], out[1]));
    s.game.cam.yaw = Math.atan2(out[0], out[1]);
    s.game.cam.snap();
    s.game.env?.setInterior(false);
    if (s.game.chunks) s.game.chunks.group.visible = true;
    if (s.game.terrain) s.game.terrain.group.visible = true;
    s.vehR.group.visible = true;
    s.staticR.group.visible = true;
    s.crowdFar.mesh.visible = true;
    s.game.audio.playMusic('none');
    s.game.audio.ui('close');
  }

  // ------------------------------------------------------------------ actors
  private syncActors(initial = false) {
    const s = this.s;
    const c = this.current!;
    const present = new Set(s.nsys.presentAt({ k: 'b', id: c.bld.id }));
    // remove leavers
    for (const a of c.actors) {
      if (!present.has(a.npc.id) && a.state !== 'leave') {
        a.state = 'leave';
        a.target = { x: 0, z: c.layout.d / 2 - 0.5 };
        if (a.slot) a.slot = null;
      }
    }
    // add arrivals
    const used = new Set(c.actors.map((a) => a.slot).filter(Boolean));
    for (const id of present) {
      if (c.actors.some((a) => a.npc.id === id)) continue;
      const n = s.npcs[id];
      if (n.activity.kind === 'sleep' && c.type !== 'apartment') continue;
      if (c.type === 'apartment') continue;
      const staff = !!(n.job && c.biz && n.job.biz === c.biz.id && n.activity.kind === 'work');
      const slot = c.layout.slots.find((sl) => !used.has(sl) && sl.role === (staff ? 'staff' : 'customer'));
      if (!slot) continue;
      used.add(slot);
      const startAtSlot = initial || s.t - this.enteredAt < 1;
      const a: Actor = {
        npc: n,
        slot,
        x: startAtSlot ? slot.x : 0,
        z: startAtSlot ? slot.z : c.layout.d / 2 - 0.6,
        yaw: slot.yaw,
        state: startAtSlot ? 'idle' : 'enter',
        phase: Math.random() * 6,
        gait: 0,
        talk: false,
        t: Math.random() * 10,
        target: startAtSlot ? null : { x: slot.x, z: slot.z },
      };
      n.proxy = 'interior';
      c.actors.push(a);
    }
  }

  private updateActors(dt: number) {
    const s = this.s;
    const c = this.current!;
    const o = INTERIOR_ORIGIN;
    const remove: Actor[] = [];
    for (const a of c.actors) {
      a.t += dt;
      if (a.target) {
        const dx = a.target.x - a.x;
        const dz = a.target.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          a.target = null;
          if (a.state === 'leave') {
            remove.push(a);
            continue;
          }
          a.state = 'idle';
        } else {
          const sp = 1.3;
          a.x += (dx / d) * sp * dt;
          a.z += (dz / d) * sp * dt;
          a.yaw = dampAngle(a.yaw, Math.atan2(dx, dz), 8, dt);
          a.phase += dt * sp * 3.9;
          a.gait = damp(a.gait, 0.9, 6, dt);
        }
      } else {
        a.gait = damp(a.gait, 0, 6, dt);
        if (a.slot) a.yaw = dampAngle(a.yaw, a.slot.yaw, 4, dt);
        if (a.slot?.pose === 'browse' && a.t > 6) {
          a.t = 0;
          a.target = { x: a.slot.x + (Math.random() - 0.5) * 2, z: a.slot.z + (Math.random() - 0.5) * 1.5 };
        }
      }
      if (a.talk) {
        const p = s.ctl!.renderPos;
        a.yaw = dampAngle(a.yaw, Math.atan2(p.x - (o.x + a.x), p.z - (o.z + a.z)), 6, dt);
      }
      let pose: number = Pose.Stand;
      if (!a.target && a.slot) {
        if (a.slot.pose === 'sit') pose = Pose.Sit;
        else if (a.slot.pose === 'dance') pose = Pose.Dance;
        else if (a.slot.pose === 'work' && Math.sin(a.t * 0.4 + a.npc.id) > 0.6) pose = Pose.Talk;
      }
      if (a.talk) pose = Pose.Talk;
      s.crowdNear.push(o.x + a.x, o.y, o.z + a.z, a.yaw, a.npc.look, a.phase, pose === Pose.Stand ? a.gait : 0, pose, 0.4);
    }
    for (const a of remove) {
      c.actors = c.actors.filter((x) => x !== a);
      a.npc.proxy = 'none';
    }
  }

  // ------------------------------------------------------------------ interactions
  private interactions(): Interactable[] {
    const s = this.s;
    const out: Interactable[] = [];
    if (s.mode === 'foot' && s.ctl) {
      // building doors outside
      const p = s.ctl.renderPos;
      for (const b of this.nearbyDoors(p.x, p.z)) {
        const d = Math.hypot(b.door.x - p.x, b.door.z - p.z);
        if (b.forSale) {
          const price = this.propertyPrice(b);
          out.push({ key: 'KeyE', text: `For sale: buy for ${formatMoney(price)}`, sub: 'Open your own business here', dist: d, priority: 6, action: () => s.business?.offerPurchase(b) });
          continue;
        }
        if (!b.interior) {
          const biz = b.businesses.map((id) => s.city.businesses[id]).find((x) => x.type === 'warehouse' || x.type === 'factory');
          if (biz) out.push({ key: 'KeyE', text: 'Buy wholesale supplies', sub: biz.name, dist: d, priority: 4, action: () => this.openWholesale(biz) });
          continue;
        }
        const ce = this.canEnter(b);
        if (b.interior === 'apartment' && b.id !== s.city.playerHome) continue;
        const name = b.interior === 'apartment' ? 'your apartment' : b.name ?? 'building';
        out.push({
          key: 'KeyE',
          text: ce.ok ? `Enter ${name}` : `${b.name ?? 'Building'} · ${ce.why ?? 'Closed'}`,
          sub: ce.ok ? b.address : undefined,
          dist: d,
          priority: ce.ok ? 4 : 1,
          action: () => {
            if (ce.ok) this.enter(b);
            else s.notify(ce.why ?? 'Closed', b.name, 'info');
          },
        });
      }
      // talk to pedestrians
      const ped = s.peds.nearest(p.x, p.z, 2.4);
      if (ped && ped.state !== 'talk') {
        const n = ped.npc;
        out.push({
          key: 'KeyE',
          text: `Talk to ${s.npcLabel(n)}`,
          sub: n.relPlayer.fam > 0 ? `${n.title}` : undefined,
          dist: Math.hypot(ped.x - p.x, ped.z - p.z) - 0.5,
          priority: 5,
          action: () => {
            s.peds.hold(ped, p.x, p.z);
            s.dialogue.start({ npc: n, x: ped.x, y: ped.y, z: ped.z, release: () => s.peds.release(ped) });
          },
        });
      }
      return out;
    }
    if (s.mode !== 'interior' || !this.current) return out;
    const c = this.current;
    const p = s.ctl!.renderPos;
    const lx = p.x - INTERIOR_ORIGIN.x;
    const lz = p.z - INTERIOR_ORIGIN.z;
    for (const st of c.layout.stations) {
      const d = Math.hypot(st.x - lx, st.z - lz);
      if (d > st.r) continue;
      const it = this.stationAction(st.id, st.label, st.sub);
      if (it) out.push({ ...it, dist: d });
    }
    for (const a of c.actors) {
      const d = Math.hypot(a.x - lx, a.z - lz);
      if (d < 2.2 && a.state !== 'leave') {
        out.push({
          key: 'KeyE',
          text: `Talk to ${s.npcLabel(a.npc)}`,
          sub: a.npc.relPlayer.fam > 0 ? a.npc.title : undefined,
          dist: d - 0.3,
          priority: 6,
          action: () => {
            a.talk = true;
            s.dialogue.start({ npc: a.npc, x: INTERIOR_ORIGIN.x + a.x, y: INTERIOR_ORIGIN.y, z: INTERIOR_ORIGIN.z + a.z, release: () => (a.talk = false) });
          },
        });
      }
    }
    return out;
  }

  private nearbyDoors(x: number, z: number) {
    const out: Building[] = [];
    for (const b of this.s.city.buildings) {
      if (Math.abs(b.door.x - x) < 2.6 && Math.abs(b.door.z - z) < 2.6) out.push(b);
    }
    return out;
  }

  propertyPrice(b: Building) {
    const w = { downtown: 2.2, entertainment: 1.6, commercial: 1.3, residential: 1, wealthy: 2.5, industrial: 0.8 }[b.district];
    return Math.round(((b.x1 - b.x0) * (b.z1 - b.z0) * 22 * w) / 500) * 500;
  }

  private stationAction(id: string, label: string, sub?: string): Omit<Interactable, 'dist'> | null {
    const s = this.s;
    const c = this.current!;
    const biz = c.biz;
    const base = { key: 'KeyE' as const, priority: 8 };
    if (id === 'exit') return { ...base, text: `Exit to ${c.bld.street}`, priority: 3, action: () => this.exit() };
    if (id === 'shop' && biz) return { ...base, text: label, sub: biz.name, action: () => this.openShop(biz) };
    if (id === 'atm' || id === 'teller') return { ...base, text: label, sub: `Wallet ${formatMoney(s.player.cash)} · Bank ${formatMoney(s.player.bank)}`, action: () => this.openBank(id === 'teller') };
    if (id === 'jobboard' && biz) {
      const open = s.econ.openings(biz.id);
      const mine = s.player.job?.biz === biz.id;
      if (mine) return null;
      return { ...base, text: open > 0 ? `Apply for a job here` : 'Ask about work', sub: open > 0 ? `${open} opening${open > 1 ? 's' : ''}` : 'No openings', priority: 5, action: () => this.openJobs(biz) };
    }
    if ((id === 'work' || id === 'reception') && biz && s.player.job?.biz === biz.id) {
      const st = s.jobs!.shiftStatus();
      return { ...base, text: st.onShift ? 'Start your shift' : 'Your workstation', sub: st.label, priority: 9, action: () => (st.onShift ? s.minigame?.start(biz) : s.notify(st.label, undefined, 'info')) };
    }
    if (id === 'reception' && biz) return { ...base, text: label, sub: biz.name, action: () => this.openJobs(biz) };
    if (id === 'dispatch') {
      return {
        ...base,
        text: s.jobs?.active ? 'Dispatcher (finish your current job first)' : 'Ask for a courier route',
        sub: 'Echo Express',
        action: () => {
          const j = s.jobs!.available.find((x) => x.kind === 'parcel');
          if (j && s.jobs!.accept(j.id)) {
            this.exit();
          } else s.notify('No routes right now', 'Check back later', 'info');
        },
      };
    }
    if (id.startsWith('car_')) {
      const type = Number(id.slice(4));
      const spec = VEHICLES[type];
      return { ...base, text: `${spec.name} · ${formatMoney(spec.price)}`, sub: 'View & buy', action: () => this.openDealer() };
    }
    if (id === 'bed') return { ...base, text: label, sub, action: () => useStore.getState().setOverlay('sleep') };
    if (id === 'wardrobe') return { ...base, text: label, sub, action: () => this.openWardrobe() };
    if (id === 'fridge') return { ...base, text: label, sub: `${Number(s.player.flags.groceries ?? 0)} meals in the fridge`, action: () => this.eatHome() };
    if (id === 'tv') return { ...base, text: label, sub, action: () => { useStore.getState().setPhoneApp('news'); useStore.getState().setOverlay('phone'); } };
    if (id === 'pc') return { ...base, text: label, sub, action: () => s.minigame?.freelance() };
    if (id === 'dance') return { ...base, text: 'Dance', sub: '+Fun, meet people', priority: 4, action: () => this.dance() };
    if (id === 'workout') return { ...base, text: 'Work out (1 hour)', sub: 'Needs a day pass', action: () => this.workout() };
    return null;
  }

  // ------------------------------------------------------------------ shop UIs
  private applyEffects(it: CatalogItem) {
    const p = this.s.player;
    if (it.hunger) p.hunger = Math.min(1, p.hunger + it.hunger);
    if (it.energy) p.energy = Math.min(1, p.energy + it.energy);
  }

  openShop(biz: BusinessDef) {
    const s = this.s;
    if (biz.type === 'clothing') return this.openClothing(biz);
    if (biz.type === 'dealership') return this.openDealer();
    if (biz.type === 'bank') return this.openBank(true);
    const items = CATALOG[biz.type] ?? CATALOG.convenience!;
    const mul = biz.priceLevel * s.econ.biz[biz.id].priceMul;
    const view = (): ShopItemView[] =>
      items.map((it) => {
        const price = Math.round(it.price * mul * 100) / 100;
        return { id: it.id, name: it.name, price, desc: it.desc ?? (it.take ? 'Take away' : undefined), kind: it.kind, disabled: s.player.money < price ? 'Not enough money' : undefined };
      });
    useShop.getState().set({ title: biz.name, subtitle: `${this.typeLabel(biz.type)} · prices ${Math.round(s.econ.biz[biz.id].priceMul * 100)}% of normal`, items: view(), mode: 'buy', actions: [], footer: `Wallet ${formatMoney(s.player.cash)} · Card ${formatMoney(s.player.bank)}` });
    useShop.getState().setHandler((id) => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const price = Math.round(it.price * mul * 100) / 100;
      if (!s.player.pay(price, `${it.name} · ${biz.name}`, s.t)) return s.notify('Not enough money', undefined, 'warning');
      const paid = s.econ.purchase(biz.id, null, it.price / ((CATALOG[biz.type]?.[0]?.price ?? it.price) || 1));
      void paid;
      if (it.id === 'groceries') s.player.flags.groceries = Number(s.player.flags.groceries ?? 0) + 7;
      else if (it.id === 'guide') s.player.flags.guide = true;
      else if (it.id === 'powerbank') s.player.capacity += 2;
      else if (it.id === 'headphones') s.player.flags.headphones = true;
      else if (it.id === 'haircut') {
        s.player.look.hairStyle = (s.player.look.hairStyle + 1) % 4;
        s.player.look.hair.setHSL(Math.random(), 0.4, 0.25 + Math.random() * 0.3);
      } else if (it.id === 'ticket') {
        useShop.getState().set(null);
        useStore.getState().setOverlay(null);
        s.skipTime(120, 'Watching a movie…', () => s.notify('What a film!', 'You feel refreshed', 'info'));
        return;
      } else if (it.id === 'room') {
        useShop.getState().set(null);
        useStore.getState().setOverlay('sleep');
        return;
      } else if (it.id === 'daypass') s.player.flags.gymDay = s.clock.day;
      else if (it.take || it.kind === 'gift') {
        if (!s.player.addItem({ id: it.id, name: it.name, kind: it.kind === 'gift' ? 'gift' : 'food', value: price, meta: { hunger: it.hunger ?? 0, energy: it.energy ?? 0, gift: it.gift ?? '' } })) s.notify('Bag full', 'Item consumed instead', 'info');
      } else this.applyEffects(it);
      if (it.kind === 'food' && !it.take) s.objectives?.event('eat');
      s.notify(`Bought ${it.name}`, `-${formatMoney(price)}`, 'money');
      useShop.getState().set({ ...useShop.getState().view!, items: view(), footer: `Wallet ${formatMoney(s.player.cash)} · Card ${formatMoney(s.player.bank)}` });
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  private typeLabel(t: string) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  openClothing(biz: BusinessDef) {
    const s = this.s;
    const mul = biz.priceLevel;
    const view = (): ShopItemView[] =>
      OUTFITS.filter((o) => o.price > 0).map((o) => {
        const owned = s.player.outfits.find((x) => x.id === o.id)?.owned;
        const price = Math.round(o.price * mul);
        return { id: o.id, name: o.name, price, owned, desc: `${o.style} style`, color: '#' + o.shirt.toString(16).padStart(6, '0'), disabled: owned ? undefined : s.player.money < price ? 'Not enough money' : undefined };
      });
    useShop.getState().set({ title: biz.name, subtitle: 'Outfits change how people see you — offices expect business attire.', items: view(), mode: 'buy', actions: [] });
    useShop.getState().setHandler((id) => {
      const o = OUTFITS.find((x) => x.id === id)!;
      const mine = s.player.outfits.find((x) => x.id === id)!;
      if (!mine.owned) {
        const price = Math.round(o.price * mul);
        if (!s.player.pay(price, `${o.name} · ${biz.name}`, s.t)) return;
        s.econ.purchase(biz.id, null, price / 48);
        mine.owned = true;
        s.notify(`Bought ${o.name}`, 'Change in your wardrobe or wear it now', 'money');
      }
      this.wear(id);
      useShop.getState().set({ ...useShop.getState().view!, items: view() });
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  wear(id: string) {
    const s = this.s;
    const o = OUTFITS.find((x) => x.id === id)!;
    s.player.outfit = id;
    s.player.look.shirt.setHex(o.shirt);
    s.player.look.pants.setHex(o.pants);
    s.game.audio.ui('click');
  }

  openWardrobe() {
    const s = this.s;
    const view = (): ShopItemView[] =>
      s.player.outfits.filter((o) => o.owned).map((o) => ({ id: o.id, name: o.name, price: 0, owned: true, desc: s.player.outfit === o.id ? 'Wearing' : o.style, color: '#' + o.shirt.toString(16).padStart(6, '0') }));
    useShop.getState().set({ title: 'Wardrobe', subtitle: 'Choose what to wear', items: view(), mode: 'service', actions: [] });
    useShop.getState().setHandler((id) => {
      this.wear(id);
      useShop.getState().set({ ...useShop.getState().view!, items: view() });
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  openBank(teller: boolean) {
    const s = this.s;
    const actions = () => [
      { id: 'dep50', label: 'Deposit $50', disabled: s.player.cash < 50 },
      { id: 'depall', label: `Deposit all cash (${formatMoney(s.player.cash)})`, disabled: s.player.cash < 1 },
      { id: 'wd20', label: 'Withdraw $20', disabled: s.player.bank < 20 },
      { id: 'wd100', label: 'Withdraw $100', disabled: s.player.bank < 100 },
      ...(teller ? [{ id: 'loan', label: 'Take a $1,500 loan (repay $1,800)', disabled: !!s.player.flags.loan }] : []),
      ...(teller && s.player.flags.loan ? [{ id: 'repay', label: 'Repay loan ($1,800)', disabled: s.player.bank < 1800 }] : []),
    ];
    const refresh = () => useShop.getState().set({ title: teller ? 'First Echo Bank' : 'ATM', subtitle: `Wallet ${formatMoney(s.player.cash, true)} · Bank ${formatMoney(s.player.bank, true)}`, items: [], mode: 'service', actions: actions() });
    refresh();
    useShop.getState().setHandler((id) => {
      const p = s.player;
      const move = (amt: number, toBank: boolean) => {
        if (toBank) {
          p.cash -= amt;
          p.bank += amt;
        } else {
          p.bank -= amt;
          p.cash += amt;
        }
        p.txns.unshift({ t: s.t, amount: toBank ? amt : -amt, label: toBank ? 'Cash deposit' : 'ATM withdrawal', account: 'bank' });
        s.game.audio.ui('money');
      };
      if (id === 'dep50') move(50, true);
      if (id === 'depall') move(p.cash, true);
      if (id === 'wd20') move(20, false);
      if (id === 'wd100') move(100, false);
      if (id === 'loan') {
        p.earn(1500, 'Loan · First Echo Bank', 'bank', s.t);
        p.flags.loan = true;
      }
      if (id === 'repay' && p.pay(1800, 'Loan repayment', s.t, 'bank')) p.flags.loan = false;
      refresh();
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  openDealer() {
    const s = this.s;
    const view = (): ShopItemView[] =>
      DEALERSHIP_STOCK.map((t) => {
        const v = VEHICLES[t];
        const owned = s.player.vehicles.some((o) => o.type === t);
        return {
          id: String(t),
          name: v.name,
          price: v.price,
          owned,
          desc: `Top speed ${Math.round(v.maxSpeed * 3.6 * 0.85)} km/h · ${v.seats} seats · ${v.key === 'van' ? 'big cargo' : v.key}`,
          disabled: owned ? 'Owned' : s.player.money < v.price ? 'Not enough money' : undefined,
        };
      });
    useShop.getState().set({ title: 'Echo Motors', subtitle: 'New vehicles, delivered to the curb outside.', items: view(), mode: 'buy', actions: [] });
    useShop.getState().setHandler((id) => {
      const t = Number(id);
      const v = VEHICLES[t];
      if (!s.player.pay(v.price, `Vehicle: ${v.name}`, s.t, 'bank')) return s.notify('Not enough money', 'Vehicles are paid by card', 'warning');
      const b = this.current?.bld ?? s.city.buildings[s.city.landmarks['dealership']];
      const spot = s.traffic.findSpot(b.door.x, b.door.z, 90);
      const color = v.palette[Math.floor(Math.random() * v.palette.length)];
      const x = spot?.x ?? b.door.x;
      const z = spot?.z ?? b.door.z;
      const yaw = spot?.rot ?? 0;
      if (spot) s.traffic.usedSpots.add(spot.id);
      const dv = s.spawnVehicle(t, x, z, yaw, color, 'player', v.name);
      s.player.vehicles.push({ vid: dv.vid, type: t, color, x, z, yaw, label: v.name });
      s.notify(`You bought a ${v.name}!`, 'It is parked outside.', 'objective');
      s.objectives?.event('buyCar');
      s.setWaypoint(x, z, v.name);
      useShop.getState().set({ ...useShop.getState().view!, items: view() });
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  openJobs(biz: BusinessDef) {
    const s = this.s;
    const open = s.econ.openings(biz.id);
    const why = s.jobs!.canApply(biz.id);
    const roles = biz.jobs.map((j) => `${j.role} · ${formatMoney(j.wage)}/h · ${fmtTime(j.start * 60)}–${fmtTime((j.end % 24) * 60)}`);
    useShop.getState().set({
      title: biz.name,
      subtitle: open > 0 ? `Hiring: ${open} opening${open > 1 ? 's' : ''}` : 'Not hiring right now',
      items: [],
      mode: 'service',
      actions: [{ id: 'apply', label: 'Apply for a job', hint: why ?? roles[0], disabled: !!why }],
      footer: roles.join('\n'),
    });
    useShop.getState().setHandler((id) => {
      if (id === 'apply' && s.jobs!.apply(biz.id)) {
        useShop.getState().set(null);
        useStore.getState().setOverlay(null);
        s.game.input.requestLock();
      }
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  openWholesale(biz: BusinessDef) {
    const s = this.s;
    const jobs = s.jobs!;
    const view = (): ShopItemView[] => jobs.goodsList().map((g) => ({ id: g.id, name: g.name, price: g.price, desc: `Wholesale · demand: ${jobs.supplies.filter((x) => x.goods === g.id).length} shops`, disabled: s.player.money < g.price ? 'Not enough money' : undefined }));
    useShop.getState().set({ title: `${biz.name} — wholesale`, subtitle: `Buy goods here, sell them to shops that are running low (see Jobs › Supply runs). Price index ${Math.round(s.econ.wholesale * 100)}%`, items: view(), mode: 'buy', actions: [] });
    useShop.getState().setHandler((id) => {
      jobs.buyGoods(id);
      useShop.getState().set({ ...useShop.getState().view!, items: view() });
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  private eatHome() {
    const s = this.s;
    const g = Number(s.player.flags.groceries ?? 0);
    const food = s.player.inventory.find((i) => i.kind === 'food');
    if (g > 0) {
      s.player.flags.groceries = g - 1;
      s.player.hunger = Math.min(1, s.player.hunger + (s.player.upgrades.includes('kitchen') ? 0.8 : 0.55));
      s.notify('You cooked a meal', `${g - 1} meals left`, 'info');
      s.skipTime(25, 'Cooking…');
      s.objectives?.event('eat');
    } else if (food) {
      s.player.removeItem(food.id);
      s.player.hunger = Math.min(1, s.player.hunger + Number(food.meta?.hunger ?? 0.3));
      s.player.energy = Math.min(1, s.player.energy + Number(food.meta?.energy ?? 0));
      s.notify(`You ate the ${food.name.toLowerCase()}`, undefined, 'info');
    } else s.notify('The fridge is empty', 'Buy groceries at a grocery store', 'info');
  }

  private dance() {
    const s = this.s;
    s.ctl!.forcedPose = Pose.Dance;
    s.player.flags.danced = Number(s.player.flags.danced ?? 0) + 1;
    setTimeout(() => {
      if (s.ctl) s.ctl.forcedPose = null;
    }, 6000);
    // dancers nearby warm up to you
    for (const a of this.current?.actors ?? []) {
      if (a.slot?.pose === 'dance') {
        a.npc.relPlayer.fam += 3;
        a.npc.relPlayer.friend += 2;
      }
    }
    s.notify('You hit the dance floor', 'People around you are having fun too', 'info');
  }

  private workout() {
    const s = this.s;
    if (s.player.flags.gymDay !== s.clock.day) return s.notify('You need a day pass', 'Buy one at the front desk', 'info');
    s.skipTime(60, 'Working out…', () => {
      s.player.energy = Math.max(0, s.player.energy - 0.15);
      s.player.flags.fitness = Number(s.player.flags.fitness ?? 0) + 1;
      s.notify('Great workout', 'Sprinting costs less stamina today', 'info');
    });
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    if (!this.current) return;
    this.syncT -= dt;
    if (this.syncT <= 0) {
      this.syncT = 0.6;
      this.syncActors();
    }
    this.lastDt = dt;
    void MIN_PER_DAY;
    void npcName;
    void APARTMENT_UPGRADES;
    void HOMES;
  }

  private renderActors() {
    if (!this.current) return;
    this.updateActors(this.lastDt);
    this.lastDt = 0;
  }

  forceExit() {
    if (this.current) this.teardown();
  }
}
