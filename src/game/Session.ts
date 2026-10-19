import * as THREE from 'three';
import type { Game } from './Game';
import { Clock, fmtTime, MIN_PER_DAY } from '../sim/Clock';
import { WeatherSystem, WEATHER_LABEL } from '../sim/Weather';
import { Economy } from '../sim/economy/Economy';
import { generatePopulation, npcName } from '../sim/npc/Population';
import { NPCSystem } from '../sim/npc/NPCSystem';
import { TrafficSystem, TVehicle } from '../sim/traffic/TrafficSystem';
import { Pedestrians, Ped } from '../sim/npc/Pedestrians';
import type { NPC } from '../sim/npc/types';
import { PlayerState } from './PlayerState';
import { PlayerController } from './PlayerController';
import { DrivableVehicle } from './DrivableVehicle';
import { Crowd, Pose, randomLook, HumanLook } from '../render/Human';
import { VehicleRenderer } from '../render/VehicleRenderer';
import { VEHICLES } from '../sim/vehicles';
import { useStore } from '../state/store';
import { CURB_H, DISTRICT_INFO } from '../world/types';
import { districtAtPoint } from '../world/CityGenerator';
import { RNG, hash01 } from '../core/rng';
import { clamp } from '../core/math';
import { G } from '../render/globals';
import { GRADE } from '../scene/ColorGrade';
import { JobSystem } from './Jobs';
import { InteriorManager } from './Interiors';
import { DialogueController } from './Dialogue';
import { Objectives } from './Objectives';
import { MiniGameController } from './MiniGame';
import { BusinessManager } from './Business';
import { EventSystem } from './Events';
import type { Place } from '../sim/npc/types';

export interface Interactable {
  key: 'KeyE' | 'KeyF';
  text: string;
  sub?: string;
  dist: number;
  priority: number;
  action: () => void;
}

export type InteractProvider = (s: Session) => Interactable[];

export class Session {
  clock: Clock;
  weather: WeatherSystem;
  econ: Economy;
  npcs: NPC[];
  nsys: NPCSystem;
  traffic: TrafficSystem;
  peds: Pedestrians;
  player = new PlayerState();
  ctl: PlayerController | null = null;
  vehicles: DrivableVehicle[] = [];
  driving: DrivableVehicle | null = null;
  mode: 'foot' | 'vehicle' | 'interior' | 'none' = 'none';
  crowdNear: Crowd;
  crowdFar: Crowd;
  vehR: VehicleRenderer;
  staticR: VehicleRenderer;
  private staticCenter = new THREE.Vector3(1e9, 0, 0);
  providers: InteractProvider[] = [];
  updaters: ((dt: number, dm: number) => void)[] = [];
  current: { e: Interactable | null; f: Interactable | null } = { e: null, f: null };
  waypoint: { x: number; z: number; label: string } | null = null;
  objective: { text: string; sub: string | null } | null = null;
  focus = new THREE.Vector3();
  camFwd = new THREE.Vector2(0, 1);
  rng: RNG;
  background: boolean;
  paused = false;
  /** a fade overlay value 0..1 driven by transitions */
  fade = 0;
  private fadeTarget = 0;
  private fadeCb: (() => void) | null = null;
  private lastDay = -1;
  private hudTimer = 0;
  enterT = 0;
  driverLooks = new Map<number, HumanLook>();
  onFootstep: ((run: boolean) => void) | null = null;
  jobs: JobSystem | null = null;
  interiors: InteriorManager | null = null;
  dialogue: DialogueController;
  objectives: Objectives | null = null;
  minigame: MiniGameController | null = null;
  business: BusinessManager | null = null;
  events: EventSystem | null = null;
  appointments: { npc: number; t: number; place: Place; label: string }[] = [];
  renderHooks: (() => void)[] = [];
  skipping: string | null = null;
  playtime = 0;
  private subtitleT = 0;
  private socialTimer = 30;

  constructor(public game: Game, opts: { background: boolean; seed: number; startMinutes?: number }) {
    const city = game.city!;
    this.background = opts.background;
    this.rng = new RNG(opts.seed ^ 0x51);
    this.clock = new Clock(opts.startMinutes ?? 8 * 60 + 30);
    this.clock.scale = opts.background ? 6 : game.settings.gameplay.timeScale;
    this.weather = new WeatherSystem(opts.seed);
    this.weather.set(opts.background ? 'sunny' : 'sunny', this.clock.t, true);
    this.econ = new Economy(city);
    this.npcs = generatePopulation(city, opts.seed);
    this.nsys = new NPCSystem(city, this.npcs, this.econ, this.clock, opts.seed);
    this.traffic = new TrafficSystem(city, game.physics, opts.seed);
    this.peds = new Pedestrians(city, this.nsys, this.traffic, opts.seed);
    this.crowdNear = new Crowd(140, game.humanGeo, game.humanMat, game.humanDepth);
    this.crowdFar = new Crowd(160, game.humanGeoLow, game.humanMat, game.humanDepth);
    this.crowdFar.mesh.castShadow = false;
    this.vehR = new VehicleRenderer(150);
    this.staticR = new VehicleRenderer(260);
    game.scene.add(this.crowdNear.mesh, this.crowdFar.mesh, this.vehR.group, this.staticR.group);
    if (game.chunks) game.chunks.hooks.signalColor = this.traffic.signalColor;
    this.nsys.warmup();
    this.applyDensity();
    this.player.look = randomLook(Math.random, false, 0.3);
    this.dialogue = new DialogueController(this);
  }

  /** create the gameplay layer (not used by the menu background session) */
  setupGameplay() {
    this.baseProviders();
    this.interiors = new InteriorManager(this);
    this.jobs = new JobSystem(this);
    this.objectives = new Objectives(this);
    this.minigame = new MiniGameController(this);
    this.business = new BusinessManager(this);
    this.events = new EventSystem(this);
    this.nsys.hooks.onNews = (h, b, cat, place) => this.addNews(h, b, cat, place ? this.nsys.placePos(place) : undefined);
    this.nsys.hooks.onMessage = (n, text, kind) => {
      if (!n.hasNumber && !(n.knowsPlayer && (kind === 'thanks' || kind === 'angry'))) return;
      this.player.message({ from: n.id, name: npcName(n), text, t: this.t, kind });
      this.notify(npcName(n), text, 'message');
    };
    this.updaters.push((dt) => {
      this.objectives?.update(dt);
      this.socialMessages(dt);
      this.playtime += dt;
      if (this.subtitleT > 0) {
        this.subtitleT -= dt;
        if (this.subtitleT <= 0) useStore.getState().setHud({ subtitle: null });
      }
      // appointments: remind and clean up
      for (const a of this.appointments) {
        if (!(a as { reminded?: boolean }).reminded && this.t > a.t - 30 && this.t < a.t) {
          (a as { reminded?: boolean }).reminded = true;
          const pos = this.nsys.placePos(a.place);
          this.notify('Upcoming plans', `${a.label} at ${fmtTime(a.t % MIN_PER_DAY)}`, 'relationship');
          if (!this.objective) this.setObjective(a.label, `At ${fmtTime(a.t % MIN_PER_DAY)}`);
          this.setWaypoint(pos.x, pos.z, a.label);
        }
      }
      this.appointments = this.appointments.filter((a) => this.t < a.t + 90 && this.npcs[a.npc].appointment);
    });
  }

  subtitle(who: string, text: string) {
    useStore.getState().setHud({ subtitle: { who, text } });
    this.subtitleT = 4.5;
  }

  /** friends with your number occasionally text you, including invitations */
  private socialMessages(dt: number) {
    this.socialTimer -= dt;
    if (this.socialTimer > 0) return;
    this.socialTimer = 40 + this.rng.next() * 60;
    const contacts = this.player.contacts.map((id) => this.npcs[id]).filter((n) => n && n.relPlayer.friend > 25);
    if (!contacts.length) return;
    const n = contacts[Math.floor(this.rng.next() * contacts.length)];
    if (n.activity.kind === 'sleep' || n.activity.kind === 'work') return;
    if (n.needs.social < 0.5 && !n.appointment && this.rng.chance(0.6)) {
      const msg = this.player.message({
        from: n.id,
        name: npcName(n),
        text: this.rng.pick(['Hey! Free later? Want to grab a drink?', 'Bored. Want to hang out tonight?', 'Coffee later? My treat.']),
        t: this.t,
        kind: 'invite',
        replies: [
          { label: "I'm in!", action: 'accept' },
          { label: 'Maybe next time', action: 'decline' },
        ],
      });
      void msg;
      this.notify(npcName(n), 'sent you an invitation', 'message');
    } else {
      const mem = [...n.memories].reverse().find((m) => this.nsys.strength(m) > 0.2 && ['got_job', 'promoted', 'bought_car', 'dated_npc', 'lost_job'].includes(m.type));
      const text = mem
        ? ({ got_job: `Guess who got a job at ${mem.note}! 🎉`, promoted: `I got promoted!! ${mem.note}`, bought_car: `Finally bought a ${mem.note}. Want a ride sometime?`, dated_npc: `I have news... I'm seeing someone 😊`, lost_job: `Lost my job today. Not great.` } as Record<string, string>)[mem.type]
        : this.rng.pick(['How are you settling in?', 'Saw a crazy sunset by the harbor today.', 'Traffic was insane this morning lol', "Let's catch up soon!"]);
      this.player.message({ from: n.id, name: npcName(n), text, t: this.t, kind: 'chat' });
      this.notify(npcName(n), text, 'message');
    }
  }

  /** reply to an invitation from the phone */
  replyInvite(msgId: number, accept: boolean) {
    const m = this.player.messages.find((x) => x.id === msgId);
    if (!m || m.answered) return;
    m.answered = true;
    const n = this.npcs[m.from];
    if (!accept) {
      n.relPlayer.friend -= 1;
      this.player.message({ from: n.id, name: npcName(n), text: 'No worries! Another time.', t: this.t, kind: 'chat' });
      return;
    }
    const hour = this.clock.hour;
    let t = this.t + 60;
    if (hour > 22) t = Math.floor(this.t / MIN_PER_DAY + 1) * MIN_PER_DAY + 19 * 60;
    t = Math.round(t / 15) * 15;
    const h2 = (t % MIN_PER_DAY) / 60;
    const home = n.loc ?? this.nsys.homePlace(n);
    const biz = this.nsys.pickVenue(n, h2 > 19 ? ['bar', 'restaurant'] : ['cafe', 'restaurant'], home, 1300);
    if (biz < 0) return;
    const place: Place = { k: 'b', id: this.city.businesses[biz].building };
    n.appointment = { t, place, with: -1, kind: 'hangout' };
    const label = `Meet ${n.first} at ${this.city.businesses[biz].name}`;
    this.appointments.push({ npc: n.id, t, place, label });
    this.player.message({ from: n.id, name: npcName(n), text: `Great! ${this.city.businesses[biz].name} at ${fmtTime(t % MIN_PER_DAY)}. See you there!`, t: this.t, kind: 'chat' });
    const pos = this.nsys.placePos(place);
    this.setWaypoint(pos.x, pos.z, label);
    this.notify('Plans made', label, 'relationship');
  }

  /** fast-forward the world (sleep, shifts, movies). The abstract simulation keeps running. */
  skipTime(minutes: number, label: string, cb?: () => void) {
    if (minutes <= 0) {
      cb?.();
      return;
    }
    this.skipping = label;
    useStore.getState().setHud({ subtitle: null });
    this.fadeTo(1, () => {
      // clear visible proxies; the abstract world continues
      this.peds.clear();
      for (const v of [...this.traffic.vehicles, ...this.traffic.parked]) if (v.tag === undefined) this.traffic.remove(v);
      const end = this.clock.t + minutes;
      while (this.clock.t < end) {
        const step = Math.min(3, end - this.clock.t);
        this.clock.t += step;
        this.weather.update((step * 60) / Math.max(1, this.clock.scale), this.clock.t, this.clock.hour);
        this.nsys.tick(0.6);
      }
      this.player.hunger = Math.max(0, this.player.hunger - (minutes / 60) * 0.035);
      cb?.();
      this.skipping = null;
      this.fadeTo(0);
    });
  }

  sleep(hours: number) {
    const fast = this.player.upgrades.includes('bed');
    this.skipTime(hours * 60, 'Sleeping…', () => {
      this.player.energy = Math.min(1, this.player.energy + hours * (fast ? 0.18 : 0.13));
      this.objectives?.event('sleep');
      this.notify('Good morning', `You slept ${hours} hours`, 'info');
      this.game.autosave?.();
    });
  }

  get city() {
    return this.game.city!;
  }
  get t() {
    return this.clock.t;
  }

  applyDensity() {
    const g = this.game.settings.graphics;
    this.peds.density = g.npcDensity;
    this.traffic.density = g.trafficDensity;
    this.traffic.maxVehicles = 64;
  }

  // ------------------------------------------------------------------ helpers
  notify(title: string, body?: string, kind: 'info' | 'money' | 'news' | 'message' | 'objective' | 'warning' | 'relationship' = 'info') {
    if (this.background) return;
    useStore.getState().notify({ title, body, kind });
    this.game.audio?.ui(kind === 'money' ? 'money' : kind === 'warning' ? 'warn' : 'notify');
  }
  setObjective(text: string | null, sub: string | null = null) {
    this.objective = text ? { text, sub } : null;
  }
  setWaypoint(x: number, z: number, label: string) {
    this.waypoint = { x, z, label };
  }
  clearWaypoint() {
    this.waypoint = null;
  }
  addNews(headline: string, body: string, cat: string, pos?: { x: number; z: number }) {
    const n = this.player.addNews({ t: this.t, headline, body, cat, x: pos?.x, z: pos?.z });
    if (!this.background) useStore.getState().notify({ title: headline, body: 'Echo City News', kind: 'news' });
    return n;
  }
  playerPos(): THREE.Vector3 {
    if (this.driving) return this.driving.pos;
    return this.ctl?.renderPos ?? this.focus;
  }
  fadeTo(v: number, cb?: () => void) {
    this.fadeTarget = v;
    this.fadeCb = cb ?? null;
  }
  get dayMinutes() {
    return this.clock.minuteOfDay;
  }
  npcLabel(n: NPC) {
    return n.relPlayer.fam > 0 || n.knowsPlayer ? npcName(n) : 'Stranger';
  }

  // ------------------------------------------------------------------ player spawn
  spawnPlayer(x: number, z: number, yaw: number) {
    const g = this.game;
    g.spawnPlayer(this.player.look, x, CURB_H, z, yaw);
    this.ctl = g.player;
    if (this.ctl) {
      this.ctl.onFootstep = (run) => this.onFootstep?.(run);
    }
    this.mode = 'foot';
  }

  // ------------------------------------------------------------------ vehicles
  spawnVehicle(type: number, x: number, z: number, yaw: number, color: number, owner: DrivableVehicle['owner'], label?: string, vid?: number) {
    const v = new DrivableVehicle(this.game.physics!, type, x, 0.02, z, yaw, new THREE.Color(color), owner, label, vid);
    v.onImpact = (sp, veh) => this.onVehicleImpact(sp, veh);
    this.vehicles.push(v);
    return v;
  }
  removeVehicle(v: DrivableVehicle) {
    if (this.driving === v) this.exitVehicle(true);
    this.vehicles = this.vehicles.filter((x) => x !== v);
    v.dispose();
  }

  enterVehicle(v: DrivableVehicle) {
    if (!this.ctl) return;
    this.driving = v;
    v.driven = true;
    this.mode = 'vehicle';
    this.ctl.enabled = false;
    this.ctl.setCollisionEnabled(false);
    this.game.cam.mode = 'vehicle';
    this.game.cam.alignBehind(v.yaw);
    this.game.cam.snap();
    this.game.audio?.carDoor();
    this.game.audio?.engineStart();
    this.enterT = 0;
  }

  exitVehicle(force = false) {
    const v = this.driving;
    if (!v || !this.ctl) return;
    if (!force && Math.abs(v.forwardSpeed) > 4) {
      this.notify('Slow down to get out', undefined, 'warning');
      return;
    }
    // find a clear side
    let door = v.doorPoint(1);
    const phys = this.game.physics!;
    const blocked = (p: THREE.Vector3) => phys.raycast(v.pos.x, v.pos.y, v.pos.z, p.x - v.pos.x, 0, p.z - v.pos.z, Math.hypot(p.x - v.pos.x, p.z - v.pos.z) + 0.3) !== null;
    if (blocked(door)) door = v.doorPoint(-1);
    this.driving = null;
    v.driven = false;
    this.mode = 'foot';
    this.ctl.enabled = true;
    this.ctl.setCollisionEnabled(true);
    this.ctl.teleport(door.x, Math.max(door.y, 0) + 0.05, door.z, v.yaw);
    this.game.cam.mode = 'foot';
    this.game.cam.snap();
    this.game.audio?.carDoor();
    this.game.audio?.engineStop();
    // remember parked position of owned cars
    const owned = this.player.vehicles.find((o) => o.vid === v.vid);
    if (owned) {
      owned.x = v.pos.x;
      owned.z = v.pos.z;
      owned.yaw = v.yaw;
    }
  }

  /** take a car from traffic (the driver gets out, upset) */
  carjack(tv: TVehicle) {
    const spec = VEHICLES[tv.type];
    this.traffic.extract(tv);
    const v = this.spawnVehicle(tv.type, tv.x, tv.z, tv.yaw, tv.paint.getHex(), 'borrowed', `${spec.name} (stolen)`);
    // driver steps out
    if (tv.driver >= 0) {
      const n = this.npcs[tv.driver];
      n.proxy = 'none';
      this.nsys.addMemory(n, 'carjacked_by_player', [-1], 0.95, -1, undefined, spec.name);
      n.relPlayer.friend -= 45;
      n.relPlayer.trust -= 60;
      n.relPlayer.rival += 40;
      n.relPlayer.fam += 10;
      n.knowsPlayer = true;
    }
    this.witness('player_ran_red', 0.6, -0.7, 30, tv.x, tv.z);
    this.player.reputation -= 6;
    this.enterVehicle(v);
    this.notify('Vehicle stolen', 'Witnesses will remember this.', 'warning');
  }

  /** nearby pedestrians remember something the player did */
  witness(type: NPC['memories'][number]['type'], importance: number, valence: number, radius: number, x: number, z: number) {
    for (const p of this.peds.peds) {
      if (Math.hypot(p.x - x, p.z - z) > radius) continue;
      this.nsys.addMemory(p.npc, type, [-1], importance, valence);
      p.npc.relPlayer.friend += valence * 8;
      p.npc.relPlayer.trust += valence * 10;
      p.npc.relPlayer.fam += 3;
    }
  }

  private onVehicleImpact(speed: number, veh: DrivableVehicle) {
    if (veh !== this.driving) return;
    this.game.cam.shake = Math.min(1.5, speed * 0.08);
    this.game.audio?.crash(Math.min(1, speed / 18));
    // which traffic vehicle did we hit?
    let best: TVehicle | null = null;
    let bd = 6;
    for (const tv of this.traffic.vehicles) {
      const d = Math.hypot(tv.x - veh.pos.x, tv.z - veh.pos.z) - VEHICLES[tv.type].length / 2;
      if (d < bd) {
        bd = d;
        best = tv;
      }
    }
    if (best && best.state !== 'crash') {
      this.traffic.crash(best, 8 + speed);
      if (best.driver >= 0) {
        const n = this.npcs[best.driver];
        this.nsys.addMemory(n, 'bumped_by_player', [-1], 0.6 + Math.min(0.3, speed / 40), -0.75, undefined, 'car crash');
        n.relPlayer.friend -= 12 + speed;
        n.relPlayer.trust -= 15;
        n.relPlayer.fam += 5;
        n.knowsPlayer = true;
      }
      this.witness('witnessed_accident', 0.4, -0.4, 35, veh.pos.x, veh.pos.z);
      if (speed > 9) this.notify('Collision', 'The other driver is not happy.', 'warning');
      this.player.reputation -= 1;
    }
  }

  // ------------------------------------------------------------------ interaction
  private gatherInteractions() {
    const out: Interactable[] = [];
    for (const p of this.providers) out.push(...p(this));
    let e: Interactable | null = null;
    let f: Interactable | null = null;
    for (const it of out) {
      const better = (cur: Interactable | null) => !cur || it.priority > cur.priority || (it.priority === cur.priority && it.dist < cur.dist);
      if (it.key === 'KeyE' && better(e)) e = it;
      if (it.key === 'KeyF' && better(f)) f = it;
    }
    this.current = { e, f };
  }

  /** built-in providers: vehicles and talking to pedestrians */
  baseProviders() {
    this.providers.push((s) => {
      const out: Interactable[] = [];
      if (s.mode === 'vehicle' && s.driving) {
        out.push({ key: 'KeyF', text: 'Exit vehicle', dist: 0, priority: 10, action: () => s.exitVehicle() });
        return out;
      }
      if (s.mode !== 'foot' || !s.ctl) return out;
      const p = s.ctl.renderPos;
      for (const v of s.vehicles) {
        const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
        if (d < 3.6) {
          const own = v.owner === 'player' || v.owner === 'company' || v.owner === 'taxi';
          out.push({ key: 'KeyF', text: own ? `Drive ${v.label}` : `Enter ${v.label}`, dist: d, priority: 5, action: () => s.enterVehicle(v) });
        }
      }
      for (const tv of [...s.traffic.vehicles, ...s.traffic.parked]) {
        const d = Math.hypot(tv.x - p.x, tv.z - p.z);
        if (d < 3.2 && tv.v < 2.5) {
          const spec = VEHICLES[tv.type];
          if (tv.type === 7) continue;
          out.push({ key: 'KeyF', text: tv.state === 'parked' ? `Break into ${spec.name}` : `Carjack ${spec.name}`, sub: 'This is a crime', dist: d, priority: 2, action: () => s.carjack(tv) });
        }
      }
      return out;
    });
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const g = this.game;
    const store = useStore.getState();
    const inUI = store.overlay !== null;
    const paused = this.paused || store.overlay === 'pause' || store.overlay === 'settings' || store.overlay === 'saveload' || store.overlay === 'controls';
    let dm = 0;
    if (!paused) {
      dm = this.clock.advance(dt);
      this.weather.update(dt, this.t, this.clock.hour);
    }
    const hour = this.clock.hour;
    // camera forward for spawn visibility
    const cf = new THREE.Vector3();
    g.camera.getWorldDirection(cf);
    this.camFwd.set(cf.x, cf.z).normalize();
    if (this.mode === 'none') this.focus.copy(g.focus);
    else if (this.mode === 'interior' && this.interiors?.doorPos) this.focus.set(this.interiors.doorPos.x, 0, this.interiors.doorPos.z);
    else this.focus.copy(this.playerPos());

    if (!paused) {
      this.nsys.weather = { rain: this.weather.p.rain, storm: this.weather.p.storm, temp: this.weather.temp };
      this.nsys.playerPos.x = this.focus.x;
      this.nsys.playerPos.z = this.focus.z;
      this.nsys.tick(dt);
      // traffic obstacles: player, player car, pedestrians in the road
      const obs = this.traffic.obstacles;
      obs.length = 0;
      if (this.mode === 'foot' && this.ctl) obs.push({ x: this.ctl.pos.x, z: this.ctl.pos.z, r: 0.5, kind: 'player' });
      for (const v of this.vehicles) obs.push({ x: v.pos.x, z: v.pos.z, r: v.spec.width * 0.6 + 0.4, kind: 'playerCar' });
      this.peds.obstacles(obs as never);
      this.traffic.update(dt, this.focus, this.camFwd, hour);
      this.traffic.syncBodies(this.focus);
      // pedestrians react to the player
      this.peds.playerFoot = this.mode === 'foot' && this.ctl ? { x: this.ctl.pos.x, z: this.ctl.pos.z } : null;
      if (this.driving) {
        const lv = this.driving.body.linvel();
        this.peds.playerCar = { x: this.driving.pos.x, z: this.driving.pos.z, vx: lv.x, vz: lv.z, speed: this.driving.speed };
      } else this.peds.playerCar = null;
      this.peds.update(dt, this.t, this.focus, this.camFwd);
      for (const fn of this.updaters) fn(dt, dm);
      this.playerNeeds(dm);
      this.dayRollover();
    }

    // player physics
    if (!paused && g.physics) {
      const allow = !inUI && this.fade < 0.5;
      if (this.mode !== 'none') g.cam.handleMouse(g.input, allow);
      const drv = this.driving;
      g.physics.advance(dt, (h) => {
        if (this.ctl && this.mode === 'foot') this.ctl.fixedUpdate(h, g.input, g.cam.yaw, allow);
        for (const v of this.vehicles) v.control(h, g.input, v === drv && allow);
      });
      if (this.ctl) this.ctl.update(dt);
      if (this.driving) {
        this.ctl?.teleport(this.driving.pos.x, this.driving.pos.y - 0.5, this.driving.pos.z);
        g.cam.update(dt, this.driving.pos, g.physics, { heading: this.driving.yaw, speed: this.driving.speed });
      } else if (this.ctl && this.mode !== 'none') {
        g.cam.update(dt, this.ctl.renderPos, g.physics, { interior: this.mode === 'interior' });
      }
      // falling into the bay
      if (this.ctl && this.mode === 'foot' && this.ctl.pos.y < -3) {
        this.notify('You swam back to shore', undefined, 'warning');
        this.ctl.teleport(this.city.shoreX - 8, CURB_H, this.ctl.pos.z);
      }
    } else if (this.ctl) this.ctl.update(0);

    // interaction prompts & input
    if (this.mode !== 'none') {
      this.gatherInteractions();
      if (!inUI && this.fade < 0.3 && !this.skipping) {
        if (g.input.hit('KeyE') && this.current.e) this.current.e.action();
        else if (g.input.hit('KeyF') && this.current.f) this.current.f.action();
      }
      // horn
      if (this.driving && !inUI) {
        const h = g.input.down('KeyH');
        g.audio.horn(h);
        if (h) {
          for (const p of this.peds.peds) if (Math.hypot(p.x - this.driving.pos.x, p.z - this.driving.pos.z) < 12 && p.state === 'walk' && this.rng.chance(0.02)) {
            p.emote = '!';
            p.emoteT = 1.2;
          }
        }
      }
    }
    // fade transitions
    const fs = this.fadeTarget > this.fade ? 3.5 : 2.5;
    this.fade += clamp(this.fadeTarget - this.fade, -fs * dt, fs * dt);
    const st2 = useStore.getState();
    if (Math.abs(st2.fade - this.fade) > 0.015 || st2.skipLabel !== this.skipping || (this.fade === 0 && st2.fade !== 0)) st2.setFade(this.fade < 0.005 ? 0 : this.fade, this.skipping);
    if (this.fadeCb && Math.abs(this.fade - this.fadeTarget) < 0.01) {
      const cb = this.fadeCb;
      this.fadeCb = null;
      cb();
    }
    this.render();
    this.grade();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.12;
      this.publishHud();
    }
  }

  private playerNeeds(dm: number) {
    if (this.background || dm <= 0) return;
    const p = this.player;
    const sprint = this.ctl && this.ctl.speed > 6 ? 1.8 : 1;
    p.hunger = clamp(p.hunger - (dm / 60) * 0.045, 0, 1);
    p.energy = clamp(p.energy - (dm / 60) * 0.032 * sprint, 0, 1);
    if (this.ctl) this.ctl.sprintMul = p.energy < 0.1 ? 0.7 : p.hunger < 0.05 ? 0.85 : 1;
    if (p.hunger < 0.15 && !p.flags.hungryWarn) {
      p.flags.hungryWarn = true;
      this.notify("You're hungry", 'Grab something to eat at a café or store.', 'warning');
    }
    if (p.hunger > 0.3) p.flags.hungryWarn = false;
    if (p.energy < 0.12 && !p.flags.tiredWarn) {
      p.flags.tiredWarn = true;
      this.notify("You're exhausted", 'Head home and sleep.', 'warning');
    }
    if (p.energy > 0.3) p.flags.tiredWarn = false;
  }

  private dayRollover() {
    const day = this.clock.day;
    if (day === this.lastDay) return;
    const first = this.lastDay < 0;
    this.lastDay = day;
    if (first || this.background) return;
    const wd = this.clock.weekday;
    if (wd === 0) {
      // weekly rent
      const rent = [210, 480, 1400][this.player.homeTier];
      this.player.bank -= rent;
      this.player.txns.unshift({ t: this.t, amount: -rent, label: 'Weekly rent', account: 'bank' });
      this.notify('Rent paid', `-$${rent} from your bank account`, 'money');
      if (this.player.bank < 0) this.notify('Your account is overdrawn', 'Earn money soon or you will struggle to pay rent.', 'warning');
    }
  }

  // ------------------------------------------------------------------ render
  private render() {
    const night = G.uNight.value;
    const fx = this.focus.x;
    const fz = this.focus.z;
    // pedestrians
    this.crowdNear.begin();
    this.crowdFar.begin();
    for (const p of this.peds.peds) {
      const d = Math.hypot(p.x - fx, p.z - fz);
      const pose = this.peds.poseOf(p);
      const crowd = d < 48 ? this.crowdNear : this.crowdFar;
      crowd.push(p.x, p.y, p.z, p.yaw, p.npc.look, p.phase, pose.gait, pose.pose, pose.aux);
    }
    // drivers inside traffic cars near the camera
    const vehs = this.traffic.vehicles;
    this.vehR.begin();
    for (const v of vehs) {
      const d = Math.hypot(v.x - fx, v.z - fz);
      if (d > this.game.settings.graphics.drawDistance) continue;
      this.vehR.push({
        type: v.type,
        x: v.x,
        z: v.z,
        yaw: v.yaw,
        paint: v.paint,
        head: night > 0.4 || this.weather.p.rain > 0.5 || this.weather.p.fog > 0.5 ? 1 : 0,
        brake: v.brake ? 1 : 0,
        hazard: v.hazard || v.blink !== 0 ? 1 : 0,
        siren: v.type === 8 ? 1 : 0,
        wheelRot: v.wheelRot,
        steer: clamp(v.yawRate * 8, -0.5, 0.5),
      });
      if (d < 36 && v.type !== 7) this.pushDriver(v.x, v.z, v.yaw, v.type, v.driver, v.id);
    }
    for (const v of this.traffic.parked) {
      const d = Math.hypot(v.x - fx, v.z - fz);
      if (d > this.game.settings.graphics.drawDistance) continue;
      this.vehR.push({ type: v.type, x: v.x, z: v.z, yaw: v.yaw, paint: v.paint, head: 0, brake: 0, wheelRot: 0, steer: 0 });
    }
    for (const v of this.vehicles) {
      this.vehR.push(v.getDrawable(night));
      if (v === this.driving && this.ctl) {
        const q = v.quat;
        const seat = new THREE.Vector3(0.38, -v.groundOffset + 0.03, 0.05).applyQuaternion(q).add(v.pos);
        this.crowdNear.push(seat.x, seat.y, seat.z, v.yaw, this.player.look, 0, 0, Pose.Drive);
      }
    }
    this.vehR.end();
    for (const h of this.renderHooks) h();
    this.crowdNear.end();
    this.crowdFar.end();
    // static parked cars: rebuild when the focus moved enough
    if (this.staticCenter.distanceTo(this.focus) > 45) this.rebuildStatic();
  }

  private pushDriver(x: number, z: number, yaw: number, type: number, driver: number, id: number) {
    let look: HumanLook | undefined = driver >= 0 ? this.npcs[driver]?.look : undefined;
    if (!look) {
      look = this.driverLooks.get(id);
      if (!look) {
        const r = new RNG(id * 977);
        look = randomLook(() => r.next(), r.chance(0.45));
        this.driverLooks.set(id, look);
        if (this.driverLooks.size > 300) this.driverLooks.clear();
      }
    }
    const spec = VEHICLES[type];
    const side = 0.38 * (spec.width / 1.86);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const lz = type === 5 || type === 6 ? spec.length / 2 - 1.4 : 0.05;
    const px = x + side * c + lz * s;
    const pz = z - side * s + lz * c;
    const y = type === 5 || type === 6 ? 0.55 : type === 2 ? 0.2 : 0.03;
    this.crowdNear.push(px, y, pz, yaw, look, 0, 0, Pose.Drive);
  }

  private rebuildStatic() {
    this.staticCenter.copy(this.focus);
    const R = Math.min(300, this.game.settings.graphics.detailRadius + 40);
    const r = this.staticR;
    r.begin();
    const col = new THREE.Color();
    for (const p of this.city.parking) {
      if (!p.occupiedStatic) continue;
      if (Math.abs(p.x - this.focus.x) > R || Math.abs(p.z - this.focus.z) > R) continue;
      const type = [0, 1, 1, 2, 0, 3][p.staticType] ?? 1;
      const spec = VEHICLES[type];
      col.setHex(spec.palette[p.staticColor % spec.palette.length]);
      r.push({ type, x: p.x, z: p.z, yaw: p.rot, paint: col.clone(), head: 0, brake: 0, wheelRot: 0, steer: 0 });
    }
    for (const p of this.city.props) {
      if (p.type !== 'car') continue;
      if (Math.abs(p.x - this.focus.x) > R || Math.abs(p.z - this.focus.z) > R) continue;
      const type = p.ref ?? 1;
      const spec = VEHICLES[type];
      col.setHex(spec.palette[(p.ref2 ?? 0) % spec.palette.length]);
      r.push({ type, x: p.x, y: p.y, z: p.z, yaw: p.rot, paint: col.clone(), head: 0, brake: 0, wheelRot: 0, steer: 0 });
    }
    r.end();
  }

  /** color grading follows time of day and weather */
  private grade() {
    const h = this.clock.hour;
    const night = G.uNight.value;
    const golden = Math.max(0, 1 - Math.abs(h - 18.6) / 1.6) + Math.max(0, 1 - Math.abs(h - 6.6) / 1.2) * 0.7;
    const w = this.weather.p;
    GRADE.tint.value.set(1 + golden * 0.06 - night * 0.04, 1 + golden * 0.01, 1 - golden * 0.07 + night * 0.06);
    GRADE.saturation.value = 1.1 - w.cloud * 0.12 - w.rain * 0.1 + golden * 0.08 + night * 0.05;
    GRADE.contrast.value = 1.06 + golden * 0.04 - w.fog * 0.06;
    GRADE.exposure.value = (1.0 + night * 0.18) * (this.mode === 'interior' ? 1.05 : 1);
  }

  private publishHud() {
    if (this.background) return;
    const st = useStore.getState();
    const p = this.playerPos();
    const d = districtAtPoint(this.city, p.x, p.z);
    const seg = this.nearestStreet(p.x, p.z);
    st.setHud({
      time: this.clock.label(),
      day: this.clock.day,
      weekday: this.clock.weekdayName,
      hour: this.clock.hour,
      weather: WEATHER_LABEL[this.weather.kind],
      temp: Math.round(this.weather.temp),
      cash: this.player.cash,
      bank: this.player.bank,
      hunger: this.player.hunger,
      energy: this.player.energy,
      stamina: this.ctl?.stamina ?? 1,
      objective: this.objective?.text ?? null,
      objectiveSub: this.objective?.sub ?? null,
      prompt: this.current.e ? { key: 'E', text: this.current.e.text, sub: this.current.e.sub } : this.current.f ? { key: 'F', text: this.current.f.text, sub: this.current.f.sub } : null,
      speed: this.driving ? Math.abs(this.driving.forwardSpeed) * 3.6 : 0,
      inVehicle: !!this.driving,
      vehicleName: this.driving?.label ?? '',
      interior: this.mode === 'interior' ? (this.interiors?.current?.bld.name ?? 'Inside') : null,
      district: this.mode === 'interior' ? '' : DISTRICT_INFO[d].name,
      street: this.mode === 'interior' ? '' : seg,
      waypoint: this.waypoint,
    });
    const peds = this.peds.peds.length;
    const perf = st.perf;
    st.setPerf({
      ...perf,
      activeNpcs: peds,
      simulatedNpcs: this.npcs.length,
      activeVehicles: this.traffic.vehicles.length + this.vehicles.length,
    });
  }

  nearestStreet(x: number, z: number) {
    const c = this.city;
    let best = '';
    let bd = Infinity;
    for (const l of c.vLines) {
      const d = Math.abs(l.pos - x);
      if (d < bd && z > c.bounds.minZ - 20 && z < c.bounds.maxZ + 20) {
        bd = d;
        best = l.name;
      }
    }
    for (const l of c.hLines) {
      const d = Math.abs(l.pos - z);
      if (d < bd && x > c.bounds.minX - 20 && x < c.bounds.maxX + 20) {
        bd = d;
        best = l.name;
      }
    }
    return bd < 40 ? best : '';
  }

  dispose() {
    const g = this.game;
    this.interiors?.forceExit();
    this.jobs?.dispose();
    this.events?.dispose();
    this.business?.dispose();
    this.minigame?.cancel();
    if (this.dialogue.active) this.dialogue.end();
    g.scene.remove(this.crowdNear.mesh, this.crowdFar.mesh, this.vehR.group, this.staticR.group);
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    this.traffic.dispose();
    this.peds.clear();
    if (g.chunks) g.chunks.hooks.signalColor = undefined;
    void hash01;
    void fmtTime;
    void MIN_PER_DAY;
  }
}
