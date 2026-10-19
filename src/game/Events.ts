import * as THREE from 'three';
import type { Session, Interactable } from './Session';
import { RNG } from '../core/rng';
import { MIN_PER_DAY } from '../sim/Clock';
import { DISTRICT_IDS, DISTRICT_INFO, DistrictId } from '../world/types';
import { npcName } from '../sim/npc/Population';
import { VehicleRenderer } from '../render/VehicleRenderer';
import { VEHICLES } from '../sim/vehicles';
import { G } from '../render/globals';
import { Pose } from '../render/Human';
import type { Ped } from '../sim/npc/Pedestrians';

export type EventKind = 'accident' | 'construction' | 'gathering' | 'outage' | 'dispute' | 'sale' | 'storm';

export interface CityEvent {
  id: number;
  kind: EventKind;
  title: string;
  x: number;
  z: number;
  until: number;
  lanes?: number[];
  links?: number[];
  district?: DistrictId;
  biz?: number;
  place?: number;
  npcs?: number[];
  group?: THREE.Group;
}

let eid = 1;

const GATHERINGS = ['Farmers Market', 'Street Concert', 'Food Truck Festival', 'Art Walk', 'Rally for Affordable Housing', 'Open-air Cinema', 'Salsa Night', 'Charity Fun Run'];

export class EventSystem {
  events: CityEvent[] = [];
  private rng = new RNG(4242);
  private lastHour = -1;
  private crashR: VehicleRenderer;
  private coneGeo = new THREE.ConeGeometry(0.22, 0.7, 10).translate(0, 0.35, 0);
  private coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.6, emissive: new THREE.Color(0x401000) });
  private barrierGeo = new THREE.BoxGeometry(2.0, 0.9, 0.25).translate(0, 0.45, 0);
  private barrierMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
  private stripeMat = new THREE.MeshStandardMaterial({ color: 0xd02020, roughness: 0.5, emissive: new THREE.Color(0x300000) });
  private stallMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.8 });
  private warnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.2), toneMapped: false });
  dispute: { a: Ped; b: Ped; t: number; resolved: boolean } | null = null;

  constructor(private s: Session) {
    this.crashR = new VehicleRenderer(12);
    s.game.scene.add(this.crashR.group);
    s.updaters.push((dt) => this.update(dt));
    s.providers.push(() => this.interactions());
  }

  private news(headline: string, body: string, cat: string, x?: number, z?: number) {
    this.s.addNews(headline, body, cat, x !== undefined ? { x, z: z! } : undefined);
  }

  // ------------------------------------------------------------------ spawners
  accident(nearPlayer = true) {
    const s = this.s;
    const g = s.traffic.graph;
    const p = s.playerPos();
    let lane = g.lanes[Math.floor(this.rng.next() * g.lanes.length)];
    if (nearPlayer) {
      for (let k = 0; k < 60; k++) {
        const l = g.lanes[Math.floor(this.rng.next() * g.lanes.length)];
        const d = Math.hypot((l.x0 + l.x1) / 2 - p.x, (l.z0 + l.z1) / 2 - p.z);
        if (d > 90 && d < 380) {
          lane = l;
          break;
        }
      }
    }
    const sPos = lane.length * (0.35 + this.rng.next() * 0.3);
    const x = lane.x0 + lane.dx * sPos;
    const z = lane.z0 + lane.dz * sPos;
    const street = s.city.segments[lane.seg].name;
    const until = s.t + 45 + this.rng.next() * 50;
    const ev: CityEvent = { id: eid++, kind: 'accident', title: `Collision on ${street}`, x, z, until, lanes: [lane.id] };
    s.traffic.blocks.push({ lane: lane.id, s0: sPos - 9, s1: sPos + 6 });
    s.traffic.graph.penalty.set(lane.link, 40);
    s.nsys.trafficPenalty.push({ x, z, r: 120, minutes: 8 });
    // visuals: two damaged cars + cones
    const grp = new THREE.Group();
    const yaw = Math.atan2(lane.dx, lane.dz);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(this.coneGeo, this.coneMat);
      c.position.set(x - lane.dx * (11 + k * 1.6) + lane.rx * (k - 1.5) * 0.5, 0, z - lane.dz * (11 + k * 1.6) + lane.rz * (k - 1.5) * 0.5);
      grp.add(c);
    }
    s.game.scene.add(grp);
    ev.group = grp;
    (ev as CityEvent & { cars: { type: number; x: number; z: number; yaw: number; c: number }[] }).cars = [
      { type: Math.floor(this.rng.next() * 3), x: x - lane.dx * 2, z: z - lane.dz * 2, yaw: yaw + 0.35, c: VEHICLES[1].palette[Math.floor(this.rng.next() * 6)] },
      { type: 1 + Math.floor(this.rng.next() * 2), x: x + lane.dx * 2.8 + lane.rx * 0.6, z: z + lane.dz * 2.8 + lane.rz * 0.6, yaw: yaw - 0.5, c: VEHICLES[2].palette[Math.floor(this.rng.next() * 5)] },
      { type: 8, x: x - lane.dx * 7 + lane.rx * 2.6, z: z - lane.dz * 7 + lane.rz * 2.6, yaw, c: 0x111827 },
    ];
    this.events.push(ev);
    // witnesses nearby remember it
    for (const ped of s.peds.peds) if (Math.hypot(ped.x - x, ped.z - z) < 40) s.nsys.addMemory(ped.npc, 'witnessed_accident', [], 0.4, -0.3, undefined, street);
    this.news(`Collision on ${street}`, `Two cars collided on ${street}. Expect delays while crews clear the lane.`, 'traffic', x, z);
  }

  construction() {
    const s = this.s;
    const segs = s.city.segments.filter((sg) => sg.exists && sg.cls === 'local');
    const seg = segs[Math.floor(this.rng.next() * segs.length)];
    const links = [seg.id * 2, seg.id * 2 + 1];
    if (links.some((l) => s.traffic.graph.closed.has(l))) return;
    for (const l of links) s.traffic.graph.closed.add(l);
    const lanes = links.flatMap((l) => s.traffic.graph.links[l].lanes);
    for (const lid of lanes) s.traffic.blocks.push({ lane: lid, s0: 3, s1: seg.length });
    const x = (seg.x0 + seg.x1) / 2;
    const z = (seg.z0 + seg.z1) / 2;
    const grp = new THREE.Group();
    const vert = seg.orient === 'v';
    for (const end of [0, 1]) {
      const ex = vert ? seg.x0 : end ? seg.x1 - 2 : seg.x0 + 2;
      const ez = vert ? (end ? seg.z1 - 2 : seg.z0 + 2) : seg.z0;
      for (let k = -1; k <= 1; k++) {
        const b = new THREE.Mesh(this.barrierGeo, this.barrierMat);
        b.position.set(ex + (vert ? k * 2.1 : 0), 0, ez + (vert ? 0 : k * 2.1));
        b.rotation.y = vert ? 0 : Math.PI / 2;
        const st = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 0.27).translate(0, 0.62, 0), this.stripeMat);
        b.add(st);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).translate(0, 1.0, 0), this.warnMat);
        b.add(lamp);
        grp.add(b);
      }
    }
    // a dug-up patch and a small excavator-like block
    const pit = new THREE.Mesh(new THREE.BoxGeometry(vert ? 6 : 14, 0.05, vert ? 14 : 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }));
    pit.position.set(x, 0.03, z);
    grp.add(pit);
    const ex = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 3.6), new THREE.MeshStandardMaterial({ color: 0xf2b21c, roughness: 0.5 }));
    ex.position.set(x + (vert ? 2 : 0), 1.1, z + (vert ? 0 : 2));
    grp.add(ex);
    s.game.scene.add(grp);
    const ev: CityEvent = { id: eid++, kind: 'construction', title: `Roadworks on ${seg.name}`, x, z, until: s.t + MIN_PER_DAY * (0.6 + this.rng.next()), links, lanes, group: grp };
    this.events.push(ev);
    s.nsys.trafficPenalty.push({ x, z, r: 200, minutes: 6 });
    this.news(`Roadworks close part of ${seg.name}`, `${seg.name} is closed between two blocks for utility repairs. Traffic is being diverted.`, 'traffic', x, z);
  }

  gathering() {
    const s = this.s;
    if (this.events.some((e) => e.kind === 'gathering')) return;
    const spots = s.city.outdoor.filter((o) => o.kind === 'plaza' || o.kind === 'park');
    const o = spots[Math.floor(this.rng.next() * spots.length)];
    const name = this.rng.pick(GATHERINGS);
    const until = s.t + 120 + this.rng.next() * 120;
    s.nsys.gathering = { place: { k: 'o', id: o.id }, until, name: `${name} at ${o.name}` };
    const grp = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.8), this.stallMat);
      st.position.set(o.x + Math.cos(a) * 9, 1.25, o.z + Math.sin(a) * 9);
      st.rotation.y = -a;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(k / 6, 0.6, 0.5), roughness: 0.7 }));
      roof.position.y = 1.2;
      st.add(roof);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2), toneMapped: false }));
      bulb.position.y = 1.4;
      st.add(bulb);
      grp.add(st);
    }
    s.game.scene.add(grp);
    this.events.push({ id: eid++, kind: 'gathering', title: `${name} at ${o.name}`, x: o.x, z: o.z, until, place: o.id, group: grp });
    this.news(`${name} at ${o.name}`, `Residents are gathering at ${o.name} today. Expect crowds until the evening.`, 'community', o.x, o.z);
  }

  outage(district?: DistrictId) {
    const s = this.s;
    const d = district ?? DISTRICT_IDS[Math.floor(this.rng.next() * DISTRICT_IDS.length)];
    if (this.events.some((e) => e.kind === 'outage' && e.district === d)) return;
    const idx = DISTRICT_IDS.indexOf(d);
    G.uPower.value[idx] = 0;
    s.econ.powerOut.add(d);
    const inters = s.city.intersections.filter((it) => {
      const bi = Math.min(s.city.n - 1, Math.max(0, it.i));
      const bj = Math.min(s.city.n - 1, Math.max(0, it.j));
      return s.city.blocks[s.city.blockGrid[bj * s.city.n + bi]]?.district === d;
    });
    for (const it of inters) s.traffic.outage.add(it.id);
    const c = s.city.districtCenters.find((q) => q.id === d)!;
    this.events.push({ id: eid++, kind: 'outage', title: `Power outage in ${DISTRICT_INFO[d].name}`, x: c.x, z: c.z, until: s.t + 60 + this.rng.next() * 120, district: d });
    this.news(`Blackout hits ${DISTRICT_INFO[d].name}`, `A substation failure has cut power across ${DISTRICT_INFO[d].name}. Shops are closed and traffic lights are flashing.`, 'utilities', c.x, c.z);
    for (const n of s.npcs) if (n.loc && n.loc.k === 'b' && s.city.buildings[n.loc.id].district === d && s.rng.chance(0.3)) s.nsys.addMemory(n, 'power_outage', [], 0.25, -0.3);
  }

  sale() {
    const s = this.s;
    const cands = s.econ.biz.filter((b) => !b.closed && b.maxStock > 0 && b.owner === 'npc');
    const b = cands[Math.floor(this.rng.next() * cands.length)];
    if (!b) return;
    const d = s.city.businesses[b.id];
    b.priceMul = Math.max(0.6, b.priceMul * 0.7);
    b.reputation = Math.min(1, b.reputation + 0.08);
    const door = s.city.buildings[d.building].door;
    this.events.push({ id: eid++, kind: 'sale', title: `Sale at ${d.name}`, x: door.x, z: door.z, until: s.t + 300, biz: b.id });
    this.news(`Big sale at ${d.name}`, `${d.name} on ${s.city.buildings[d.building].street} is cutting prices by 30% today.`, 'business', door.x, door.z);
  }

  /** two residents near the player get into a heated argument */
  startDispute() {
    const s = this.s;
    if (this.dispute) return;
    const p = s.playerPos();
    const near = s.peds.peds.filter((q) => q.state === 'walk' && Math.hypot(q.x - p.x, q.z - p.z) < 60 && Math.hypot(q.x - p.x, q.z - p.z) > 12);
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i];
        const b = near[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) > 14) continue;
        const ra = a.npc.rel.get(b.npc.id);
        if ((ra && ra.rival > 30) || (a.npc.traits.patience < 0.35 && b.npc.traits.patience < 0.45)) {
          for (const q of [a, b]) {
            q.state = 'angry';
            q.stateT = 40;
            q.emote = '#!';
            q.emoteT = 40;
            q.npc.hold = 1;
          }
          // face each other in the middle
          const mx = (a.x + b.x) / 2;
          const mz = (a.z + b.z) / 2;
          const ang = Math.atan2(b.x - a.x, b.z - a.z);
          a.x = mx - Math.sin(ang) * 0.7;
          a.z = mz - Math.cos(ang) * 0.7;
          b.x = mx + Math.sin(ang) * 0.7;
          b.z = mz + Math.cos(ang) * 0.7;
          a.yaw = ang;
          b.yaw = ang + Math.PI;
          this.dispute = { a, b, t: 40, resolved: false };
          s.notify('An argument breaks out', `${a.npc.first} and ${b.npc.first} are shouting at each other`, 'info');
          return;
        }
      }
    }
  }

  private resolveDispute(calm: boolean) {
    const s = this.s;
    const d = this.dispute!;
    const rep = s.player.reputation;
    const chance = 0.45 + (d.a.npc.traits.kindness + d.b.npc.traits.kindness) * 0.2 + Math.min(0.2, rep / 100);
    const ok = calm && this.rng.next() < chance;
    for (const q of [d.a, d.b]) {
      q.npc.hold = 0;
      q.state = 'walk';
      q.emote = ok ? '♪' : '...';
      q.emoteT = 3;
      if (ok) {
        s.nsys.addMemory(q.npc, 'player_calmed_dispute', [-1], 0.55, 0.75);
        q.npc.relPlayer.friend += 10;
        q.npc.relPlayer.trust += 8;
        q.npc.relPlayer.fam += 10;
        q.npc.knowsPlayer = true;
      } else {
        q.npc.relPlayer.friend -= 4;
        q.npc.relPlayer.fam += 4;
      }
    }
    if (ok) {
      const ra = d.a.npc.rel.get(d.b.npc.id);
      if (ra) ra.rival = Math.max(0, ra.rival - 20);
      s.player.reputation += 3;
      s.notify('You calmed them down', `${d.a.npc.first} and ${d.b.npc.first} shake hands`, 'relationship');
    } else s.notify('They storm off', 'That did not help much', 'info');
    this.dispute = null;
  }

  private interactions(): Interactable[] {
    const s = this.s;
    if (!this.dispute || s.mode !== 'foot' || !s.ctl) return [];
    const d = this.dispute;
    const p = s.ctl.renderPos;
    const dist = Math.hypot((d.a.x + d.b.x) / 2 - p.x, (d.a.z + d.b.z) / 2 - p.z);
    if (dist > 4) return [];
    return [
      { key: 'KeyE', text: `Calm ${d.a.npc.first} and ${d.b.npc.first} down`, sub: 'Defuse the argument', dist, priority: 15, action: () => this.resolveDispute(true) },
      { key: 'KeyF', text: 'Tell them to knock it off', dist, priority: 15, action: () => this.resolveDispute(false) },
    ];
  }

  // ------------------------------------------------------------------ update
  private end(ev: CityEvent) {
    const s = this.s;
    if (ev.group) {
      s.game.scene.remove(ev.group);
      ev.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry !== this.coneGeo && m.geometry !== this.barrierGeo) m.geometry.dispose();
      });
    }
    if (ev.lanes) s.traffic.blocks = s.traffic.blocks.filter((b) => !ev.lanes!.includes(b.lane));
    if (ev.links) for (const l of ev.links) s.traffic.graph.closed.delete(l);
    if (ev.kind === 'accident' && ev.lanes) {
      const l = s.traffic.graph.lanes[ev.lanes[0]];
      s.traffic.graph.penalty.delete(l.link);
    }
    if (ev.kind === 'outage' && ev.district) {
      G.uPower.value[DISTRICT_IDS.indexOf(ev.district)] = 1;
      s.econ.powerOut.delete(ev.district);
      for (const it of s.city.intersections) s.traffic.outage.delete(it.id);
      this.news(`Power restored in ${DISTRICT_INFO[ev.district].name}`, 'Crews have restored electricity.', 'utilities');
    }
    if (ev.kind === 'gathering') s.nsys.gathering = null;
    if (ev.kind === 'sale' && ev.biz !== undefined) s.econ.biz[ev.biz].priceMul = Math.min(1, s.econ.biz[ev.biz].priceMul / 0.7);
    s.nsys.trafficPenalty = s.nsys.trafficPenalty.filter((p) => Math.hypot(p.x - ev.x, p.z - ev.z) > 1);
    this.events = this.events.filter((e) => e !== ev);
  }

  update(dt: number) {
    const s = this.s;
    if (s.background) return;
    for (const ev of [...this.events]) if (s.t > ev.until) this.end(ev);
    const hour = Math.floor(s.clock.hour);
    if (hour !== this.lastHour) {
      const first = this.lastHour < 0;
      this.lastHour = hour;
      if (!first) this.roll(hour);
    }
    // weather emergencies
    if (s.weather.kind === 'stormy' && !s.player.flags[`storm_${s.clock.day}`]) {
      s.player.flags[`storm_${s.clock.day}`] = true;
      this.news('Storm warning for Echo City', 'Heavy rain and lightning expected. Residents are advised to stay indoors.', 'weather');
      if (this.rng.chance(0.4)) this.outage();
    }
    if (this.dispute) {
      this.dispute.t -= dt;
      if (this.dispute.t <= 0 || !s.peds.peds.includes(this.dispute.a) || !s.peds.peds.includes(this.dispute.b)) {
        for (const q of [this.dispute.a, this.dispute.b]) {
          q.npc.hold = 0;
          if (q.state === 'angry') q.state = 'walk';
        }
        this.dispute = null;
      }
    }
    // crashed cars rendering
    this.crashR.begin();
    for (const ev of this.events) {
      const cars = (ev as CityEvent & { cars?: { type: number; x: number; z: number; yaw: number; c: number }[] }).cars;
      if (!cars) continue;
      for (const c of cars) this.crashR.push({ type: c.type, x: c.x, z: c.z, yaw: c.yaw, paint: new THREE.Color(c.c), head: 0, brake: 0, hazard: 1, siren: c.type === 8 ? 1 : 0, wheelRot: 0, steer: 0 });
    }
    this.crashR.end();
    void npcName;
  }

  private roll(hour: number) {
    const s = this.s;
    const r = this.rng;
    const day = hour > 7 && hour < 22;
    if (r.chance(day ? 0.32 : 0.12)) this.accident(r.chance(0.7));
    if (r.chance(0.05) && this.events.filter((e) => e.kind === 'construction').length < 2) this.construction();
    if (hour >= 10 && hour <= 19 && r.chance(0.16)) this.gathering();
    if (r.chance(s.weather.kind === 'stormy' ? 0.15 : 0.025)) this.outage();
    if (r.chance(0.08)) this.sale();
    if (r.chance(0.25)) this.startDispute();
    // gig opportunity message
    if (r.chance(0.1) && s.player.contacts.length) {
      const n = s.npcs[s.player.contacts[Math.floor(r.next() * s.player.contacts.length)]];
      s.nsys.hooks.onMessage?.(n, r.pick(['Hey! My boss needs extra hands this week — want me to put in a word?', 'Heard the courier depot is paying bonuses today.', 'Food delivery orders are crazy right now, you should hop on.']), 'chat');
    }
  }

  serialize() {
    return this.events.filter((e) => e.kind === 'construction').map((e) => ({ kind: e.kind, until: e.until }));
  }

  dispose() {
    for (const ev of [...this.events]) this.end(ev);
    this.s.game.scene.remove(this.crashR.group);
    for (let i = 0; i < 6; i++) G.uPower.value[i] = 1;
  }
}
