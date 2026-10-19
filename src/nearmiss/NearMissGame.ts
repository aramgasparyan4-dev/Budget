import * as THREE from 'three';
import { Input } from '../engine/Input';
import { AudioEngine } from '../engine/Audio';
import { World } from '../engine/World';
import type { WeatherParams } from '../render/Environment';
import { G } from '../render/globals';
import { VehicleRenderer } from '../render/VehicleRenderer';
import { CameraController } from '../game/CameraController';
import { DrivableVehicle } from '../game/DrivableVehicle';
import { TrafficSystem, TVehicle } from '../sim/traffic/TrafficSystem';
import { VEHICLES } from '../sim/vehicles';
import { laneOffset, PLATFORM } from '../world/CityGenerator';
import { MeshBuilder, BASIC_LAYOUT, addBox, lin } from '../render/MeshBuilder';
import { toBufferGeometry } from '../render/propModels';
import { createPropMaterial } from '../render/materials';
import type { RoadSegment } from '../world/types';
import type { Lane } from '../sim/traffic/RoadGraph';
import { useStore } from '../state/store';
import { clamp, damp } from '../core/math';
import { Scorer, OtherCar } from './scoring';
import { useNM, Phase } from './store';

/** the same city as Echo City */
export const CITY_SEED = 20261019;

export const CARS = [
  { type: 3, name: 'Volta GT', blurb: 'Fastest car in the city. Light rear end.', color: 0xd21f1f, siren: false },
  { type: 8, name: 'Patrol Cruiser', blurb: 'Heavy and stable. Lights on.', color: 0x111827, siren: true },
  { type: 4, name: 'Echo Cab', blurb: 'Slow, forgiving, nobody looks twice.', color: 0xf7c21b, siren: false },
  { type: 0, name: 'Pixie Compact', blurb: 'Tiny. Fits through gaps nothing else does.', color: 0x2a6fdb, siren: false },
];

const clear = (o: Partial<WeatherParams> = {}): WeatherParams => ({ cloud: 0.15, rain: 0, fog: 0, wet: 0, wind: 0.2, storm: 0, flash: 0, ...o });

export const CONDITIONS: Record<string, { label: string; hour: number; weather: WeatherParams; grip: number }> = {
  night: { label: 'Midnight', hour: 0.4, weather: clear(), grip: 1 },
  rain: { label: 'Night rain', hour: 22.6, weather: clear({ cloud: 0.95, rain: 0.85, fog: 0.25, wet: 1, wind: 0.55, storm: 0.35 }), grip: 0.78 },
  dusk: { label: 'Golden hour', hour: 18.75, weather: clear({ cloud: 0.3 }), grip: 1 },
  day: { label: 'Noon', hour: 12.5, weather: clear({ cloud: 0.25 }), grip: 1 },
};

const BOOST_POWER = 1.8;
const BOOST_TOP = 1.25;
/** traffic is always at rush-hour volume, whatever the light looks like */
const TRAFFIC_HOUR = 17.6;

export class NearMissGame {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  input = new Input();
  audio = new AudioEngine();
  cam!: CameraController;
  world: World | null = null;
  traffic: TrafficSystem | null = null;
  vehR = new VehicleRenderer(320);
  car: DrivableVehicle | null = null;
  scorer = new Scorer();
  phase: Phase = 'loading';
  paused = false;
  time = 0;
  private attached = false;
  private phaseT = 0;
  private hudT = 0;
  private orbit = 0; // wreck camera angle
  private slowmo = 1;
  /** real seconds left of the brief slow-motion after an INSANE pass */
  private beatT = 0;
  private focus = new THREE.Vector3();
  private camFwd = new THREE.Vector2(0, 1);
  private lastInter = -1;
  private flipT = 0;
  private boosting = false;
  private lastCount = -1;
  private baseFov = 62;
  private attract: TVehicle | null = null;
  private attractUntil = 0;
  private attractSnap = true;
  /** lanes grouped by the road line they run along ('v3', 'h7'), for the traffic director */
  private lineLanes = new Map<string, Lane[]>();
  private directorT = 0;

  get cond() {
    return CONDITIONS[useNM.getState().cond] ?? CONDITIONS.night;
  }
  get carDef() {
    return CARS[useNM.getState().carIndex] ?? CARS[0];
  }

  // ------------------------------------------------------------------ setup
  attach(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.attached) return;
    this.attached = true;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cam = new CameraController(camera);
    this.input.attach(renderer.domElement);
    renderer.info.autoReset = false;
    scene.add(this.vehR.group);
    (window as unknown as { __nm: NearMissGame }).__nm = this;
    const unlock = () => {
      this.audio.init();
      this.audio.setVolumes(useStore.getState().settings.audio);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    void this.boot();
  }

  private async boot() {
    const st = useNM.getState();
    const settings = useStore.getState().settings;
    this.world = await World.load(this.scene, CITY_SEED, settings, (p, t) => st.set({ progress: p, progressText: t }));
    this.applySettings();
    this.traffic = new TrafficSystem(this.world.city, this.world.physics, CITY_SEED);
    // much denser than Echo City: spawn often and closer in (but never in plain view ahead)
    this.traffic.maxVehicles = 160;
    this.traffic.spawnInterval = 0.03;
    this.traffic.spawnAttempts = 24;
    this.traffic.spawnRadius = { min: 60, max: 280, despawn: 320 };
    this.world.chunks.hooks.signalColor = this.traffic.signalColor;
    for (const l of this.traffic.graph.lanes) {
      const seg = this.world.city.segments[l.seg];
      const key = seg.orient + seg.line;
      let list = this.lineLanes.get(key);
      if (!list) this.lineLanes.set(key, (list = []));
      list.push(l);
    }
    this.buildBarriers();
    // let the streets fill up before the title screen shows
    const c = this.downtown();
    this.focus.set(c.x, 0, c.z);
    for (let i = 0; i < 240; i++) this.traffic.update(1 / 20, this.focus, this.camFwd, TRAFFIC_HOUR);
    st.set({ progress: 1, progressText: 'Ready' });
    this.toTitle();
  }

  /** concrete barriers round the edge of the city: driving off into the hills ends nowhere good */
  private buildBarriers() {
    const w = this.world!;
    const E = PLATFORM + 1.5;
    const mb = new MeshBuilder(BASIC_LAYOUT);
    const concrete = lin([0.42, 0.43, 0.45]);
    const reflector = lin([1, 0.62, 0.05]);
    for (const [cx, cz, sx, sz] of [
      [0, -E, E * 2, 0.7],
      [0, E, E * 2, 0.7],
      [-E, 0, 0.7, E * 2],
      [E, 0, 0.7, E * 2],
    ]) {
      addBox(mb, cx, 0.55, cz, sx, 1.1, sz, concrete);
      addBox(mb, cx, 0.82, cz, sx + (sx > 1 ? 0 : 0.04), 0.12, sz + (sz > 1 ? 0 : 0.04), reflector, undefined, 0.6);
      w.physics.addStaticBox(cx, 1.5, cz, sx / 2, 1.5, sz / 2);
    }
    const mesh = new THREE.Mesh(toBufferGeometry(mb.build()), createPropMaterial({ emissiveNight: 2.5 }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /**
   * Keeps a stream of cars on the road ahead of the player: slower cars going the same way to weave
   * through, and oncoming ones to dodge. Spawns 180-250 m ahead, beyond what the camera resolves.
   */
  private direct(dt: number, car: DrivableVehicle) {
    this.directorT -= dt;
    if (this.directorT > 0) return;
    this.directorT = 0.3;
    const city = this.world!.city;
    const tr = this.traffic!;
    const yaw = car.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const alongZ = Math.abs(fz) > Math.abs(fx);
    // the road line under (or nearest to) the car, along its direction of travel
    const lines = alongZ ? city.vLines : city.hLines;
    let li = -1;
    let bd = 14;
    lines.forEach((l, i) => {
      const d = Math.abs((alongZ ? car.pos.x : car.pos.z) - l.pos);
      if (d < bd) {
        bd = d;
        li = i;
      }
    });
    if (li < 0) return;
    const center = lines[li].pos;
    const ax = alongZ ? 0 : Math.sign(fx);
    const az = alongZ ? Math.sign(fz) : 0;
    let ahead = 0;
    for (const v of tr.vehicles) {
      const lat = alongZ ? v.x - center : v.z - center;
      if (Math.abs(lat) > 10) continue;
      const lon = (v.x - car.pos.x) * ax + (v.z - car.pos.z) * az;
      if (lon > 0 && lon < 260) ahead++;
    }
    const want = Math.min(14, 7 + Math.floor(this.scorer.elapsed / 15));
    if (ahead >= want) return;
    const lanes = this.lineLanes.get((alongZ ? 'v' : 'h') + li);
    if (!lanes) return;
    const dist = 180 + Math.random() * 70;
    const px = car.pos.x + ax * dist;
    const pz = car.pos.z + az * dist;
    const oncoming = Math.random() < 0.4;
    const cands = lanes.filter((l) => (l.dx * ax + l.dz * az < 0) === oncoming);
    if (!cands.length) return;
    const l = cands[Math.floor(Math.random() * cands.length)];
    const sAt = (px - l.x0) * l.dx + (pz - l.z0) * l.dz;
    if (sAt < 4 || sAt > l.length - 4) return;
    tr.spawn(l.id, sAt);
  }

  applySettings() {
    const s = useStore.getState().settings;
    this.world?.applySettings(s, this.renderer, this.camera);
    if (this.cam) {
      this.cam.sensitivity = s.controls.sensitivity;
      this.cam.invertY = s.controls.invertY;
      this.baseFov = s.controls.fov;
      this.cam.dist = s.controls.cameraDistance;
    }
    this.audio.setVolumes(s.audio);
  }

  private downtown() {
    const c = this.world!.city;
    return c.districtCenters.find((d) => d.id === 'downtown') ?? { x: 0, z: 0 };
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    useNM.getState().set({ phase: p, paused: false });
    this.paused = false;
  }

  // ------------------------------------------------------------------ flow
  toTitle() {
    this.removeCar();
    this.slowmo = 1;
    this.cam.mode = 'cinematic';
    this.setPhase('title');
  }

  /** a random long arterial, right-hand lane, pointing along the road */
  private pickStart() {
    const c = this.world!.city;
    const segs = c.segments.filter((s) => s.exists && s.cls === 'arterial' && s.length > 70);
    return this.startPose(segs[Math.floor(Math.random() * segs.length)].id, Math.random() < 0.5);
  }

  /** start pose on a segment: inner lane of the given direction, 12 m in from the intersection */
  startPose(segId: number, forward: boolean) {
    const seg: RoadSegment = this.world!.city.segments[segId];
    // inner lane: clear of parked cars at the curb
    const off = laneOffset(seg, 0);
    let x: number, z: number, yaw: number;
    if (seg.orient === 'v') {
      yaw = forward ? 0 : Math.PI; // +z or -z
      // right of +z is -x
      x = seg.x0 + (forward ? -off : off);
      z = forward ? seg.z0 + 12 : seg.z1 - 12;
    } else {
      yaw = forward ? Math.PI / 2 : -Math.PI / 2; // +x or -x
      // right of +x is +z
      z = seg.z0 + (forward ? off : -off);
      x = forward ? seg.x0 + 12 : seg.x1 - 12;
    }
    return { x, z, yaw };
  }

  startRun() {
    if (!this.world || !this.traffic) return;
    this.audio.init();
    this.removeCar();
    const def = this.carDef;
    const start = this.pickStart();
    // nothing parked on top of us or right in front
    for (const v of [...this.traffic.vehicles]) if (Math.hypot(v.x - start.x, v.z - start.z) < 45) this.traffic.remove(v);
    const car = new DrivableVehicle(this.world.physics, def.type, start.x, 0.02, start.z, start.yaw, new THREE.Color(def.color), 'player', def.name);
    car.siren = def.siren;
    car.headlights = true;
    car.gripMul = this.cond.grip;
    car.driven = true;
    car.onImpact = (dv) => this.onImpact(dv);
    this.car = car;
    this.scorer = new Scorer();
    this.lastInter = -1;
    this.flipT = 0;
    this.slowmo = 1;
    this.beatT = 0;
    this.lastCount = -1;
    this.cam.mode = 'vehicle';
    this.cam.alignBehind(start.yaw);
    this.cam.pitch = 0.16;
    this.cam.snap();
    this.audio.engineStart();
    useNM.getState().set({ result: null, popups: [] });
    this.setPhase('countdown');
  }

  retry() {
    if (this.phase === 'loading') return;
    this.startRun();
  }

  togglePause() {
    if (this.phase !== 'run' && this.phase !== 'countdown') return;
    this.paused = !this.paused;
    useNM.getState().set({ paused: this.paused });
    if (this.paused) this.audio.engine(0, 0, 0, false);
  }

  private removeCar() {
    if (this.car) {
      this.car.dispose();
      this.car = null;
      this.audio.engineStop();
    }
  }

  private finish() {
    const s = this.scorer;
    const st = useNM.getState();
    const def = this.carDef;
    const rank = st.record({ score: s.score, car: def.name, cond: this.cond.label, date: Date.now(), nearMisses: s.nearMisses, bestCombo: s.bestCombo });
    st.set({
      result: {
        score: s.score,
        reason: s.over ?? 'time',
        nearMisses: s.nearMisses,
        bestCombo: s.bestCombo,
        bestBank: s.bestBank,
        topSpeed: Math.round(s.topSpeed),
        distance: Math.round(s.distance),
        seconds: Math.round(s.elapsed),
        oncomingSec: Math.round(s.oncomingSec),
        driftSec: Math.round(s.driftSec),
        closest: isFinite(s.closest) ? Math.round(s.closest * 100) / 100 : null,
        car: def.name,
        cond: this.cond.label,
        rank,
      },
    });
    this.audio.engine(0, 0, 0, false);
    this.setPhase('results');
  }

  // ------------------------------------------------------------------ collisions
  private onImpact(dv: number) {
    if (this.phase !== 'run' || !this.car || !this.traffic) return;
    const p = this.car.pos;
    let hit: TVehicle | null = null;
    let bd = 7;
    for (const tv of this.traffic.vehicles) {
      const d = Math.hypot(tv.x - p.x, tv.z - p.z) - VEHICLES[tv.type].length / 2;
      if (d < bd) {
        bd = d;
        hit = tv;
      }
    }
    if (hit) {
      this.scorer.touched(hit.id);
      if (hit.state !== 'crash') this.traffic.crash(hit, 10);
    }
    const r = this.scorer.impact(dv);
    if (r === 'none') return;
    this.audio.crash(Math.min(1, dv / 16));
    this.cam.shake = Math.min(1.6, dv * 0.09);
    if (r === 'wreck') this.wreck();
  }

  private wreck() {
    if (!this.scorer.over) this.scorer.end('wrecked');
    this.flushEvents();
    this.slowmo = 0.3;
    this.orbit = this.car ? this.car.yaw + Math.PI * 0.6 : 0;
    this.cam.mode = 'cinematic';
    this.setPhase('wreck');
  }

  // ------------------------------------------------------------------ per frame
  update(rawDt: number) {
    rawDt = Math.min(rawDt, 0.1);
    const world = this.world;
    if (!world || !this.traffic) {
      this.input.endFrame();
      return;
    }
    if (this.beatT > 0) this.beatT -= rawDt;
    const beat = this.beatT > 0 && this.phase === 'run' ? 0.4 : 1;
    const dt = this.paused ? 0 : rawDt * this.slowmo * beat;
    this.time += dt;
    G.uTime.value = this.time;
    this.phaseT += rawDt;
    const car = this.car;
    const input = this.input;
    const cond = this.cond;

    // phase timers
    if (this.phase === 'countdown' && !this.paused) {
      const left = 3 - this.phaseT;
      const n = Math.ceil(left);
      if (n !== this.lastCount) {
        this.lastCount = n;
        this.audio.countdown(n <= 0);
      }
      if (left <= 0) this.setPhase('run');
    }
    if (this.phase === 'wreck' && this.phaseT > 2.6) this.finish();

    // car control, boost and physics
    const driving = this.phase === 'run' && !this.paused;
    this.boosting = driving && !!car && (input.down('ShiftLeft') || input.down('ShiftRight')) && this.scorer.boost > 0.01 && car.forwardSpeed > 2;
    if (car) {
      car.powerMul = this.boosting ? BOOST_POWER : 1;
      car.topMul = this.boosting ? BOOST_TOP : 1;
    }
    if (!this.paused) {
      world.physics.advance(dt, (h) => car?.control(h, input, driving));
    }

    // camera and the point everything streams around
    if (car && (this.phase === 'countdown' || this.phase === 'run')) {
      this.cam.handleMouse(input, true);
      this.cam.baseFov = damp(this.cam.baseFov, this.baseFov + (this.boosting ? 12 : 0), 5, rawDt);
      this.cam.update(rawDt, car.pos, world.physics, { heading: car.yaw, speed: car.speed });
      this.focus.copy(car.pos);
    } else if (car && this.phase === 'wreck') {
      this.orbit += rawDt * 0.5;
      const p = car.pos;
      this.camera.position.lerp(new THREE.Vector3(p.x + Math.sin(this.orbit) * 9, p.y + 3.2, p.z + Math.cos(this.orbit) * 9), 1 - Math.exp(-rawDt * 3));
      this.camera.lookAt(p.x, p.y + 0.5, p.z);
      this.focus.copy(p);
    } else {
      // title / results: ride behind a random car in traffic
      this.attractCam(rawDt);
    }
    const cf = new THREE.Vector3();
    this.camera.getWorldDirection(cf);
    this.camFwd.set(cf.x, cf.z).normalize();

    // traffic (denser the longer you survive)
    const tr = this.traffic;
    tr.density = this.phase === 'run' ? 1 + Math.min(0.4, this.scorer.elapsed / 150) : 0.9;
    tr.obstacles.length = 0;
    if (car) tr.obstacles.push({ x: car.pos.x, z: car.pos.z, r: car.spec.width * 0.6 + 0.4, kind: 'playerCar' });
    if (!this.paused) {
      if (car && this.phase === 'run') this.direct(dt, car);
      tr.update(dt, this.focus, this.camFwd, TRAFFIC_HOUR);
      tr.syncBodies(this.focus);
    }

    // scoring
    if (this.phase === 'run' && car && !this.paused) this.score(dt, car);

    // flipped over counts as a wreck
    if (car && this.phase === 'run') {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quat);
      this.flipT = up.y < 0.35 ? this.flipT + dt : 0;
      if (this.flipT > 0.8) this.wreck();
    }

    world.update(this.renderer, this.camera, dt, this.time, cond.hour, cond.weather, this.focus);
    this.render();

    // sound
    if (this.audio.ready) {
      this.audio.updateAmbience(rawDt, { traffic: Math.min(1, tr.vehicles.length / 60), rain: cond.weather.rain, wind: cond.weather.wind, crowd: 0, day: 1 - G.uNight.value, interior: false, park: 0 });
      if (car && (this.phase === 'run' || this.phase === 'countdown') && !this.paused) {
        const thr = input.down('KeyW') || input.down('ArrowUp') ? 1 : 0;
        this.audio.engine(Math.min(1.2, car.rpm + (this.boosting ? 0.25 : 0)), thr, car.speed, car.spec.mass > 2300);
      }
    }

    input.endFrame();
    this.hudT -= rawDt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.publish();
    }
  }

  private attractCam(dt: number) {
    const tr = this.traffic!;
    let v = this.attract;
    if (!v || !tr.vehicles.includes(v) || this.time > this.attractUntil || v.v < 1) {
      const moving = tr.vehicles.filter((x) => x.v > 7 && x.type !== 7 && Math.hypot(x.x - this.focus.x, x.z - this.focus.z) < 220);
      v = moving.length ? moving[Math.floor(Math.random() * moving.length)] : null;
      this.attract = v;
      this.attractUntil = this.time + 9;
      this.attractSnap = true;
    }
    if (!v) {
      const c = this.downtown();
      this.camera.position.set(c.x + 60, 40, c.z + 60);
      this.camera.lookAt(c.x, 5, c.z);
      this.focus.set(c.x, 0, c.z);
      return;
    }
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const want = new THREE.Vector3(v.x - fx * 9, 3.1, v.z - fz * 9);
    if (this.attractSnap) this.camera.position.copy(want);
    else this.camera.position.lerp(want, 1 - Math.exp(-dt * 4));
    this.attractSnap = false;
    this.camera.lookAt(v.x + fx * 10, 1.2, v.z + fz * 10);
    this.camera.fov = damp(this.camera.fov, 60, 2, dt);
    this.camera.updateProjectionMatrix();
    this.focus.set(v.x, 0, v.z);
  }

  private score(dt: number, car: DrivableVehicle) {
    const tr = this.traffic!;
    const yaw = car.yaw;
    const lv = car.body.linvel();
    const others: OtherCar[] = [];
    for (const v of tr.vehicles) {
      if (Math.abs(v.x - car.pos.x) > 32 || Math.abs(v.z - car.pos.z) > 32) continue;
      const spec = VEHICLES[v.type];
      others.push({ id: v.id, x: v.x, z: v.z, yaw: v.yaw, v: v.v, width: spec.width, length: spec.length });
    }
    // sideways speed (right vector of the heading)
    const slip = Math.abs(lv.x * -Math.cos(yaw) + lv.z * Math.sin(yaw));
    const road = this.roadInfo(car.pos.x, car.pos.z, yaw);
    this.scorer.update(
      { x: car.pos.x, z: car.pos.z, yaw, vx: lv.x, vz: lv.z, width: car.spec.width, length: car.spec.length },
      others,
      { oncoming: road.oncoming, slip: car.speed > 9 ? slip : 0, boosting: this.boosting, dt },
    );
    // running a red light
    const it = this.intersectionAt(car.pos.x, car.pos.z);
    if (it >= 0 && it !== this.lastInter && car.speed > 14) {
      const inter = this.world!.city.intersections[it];
      const axis = Math.abs(Math.cos(yaw)) > Math.abs(Math.sin(yaw)) ? 'v' : 'h';
      if (inter.signalized && tr.signalColor(it, axis) === 2) this.scorer.bonus('RED LIGHT', 250, this.boosting);
    }
    this.lastInter = it;
    this.flushEvents();
    if (this.scorer.over === 'time') this.finish();
  }

  /** popups and sounds for what the scorer just decided */
  private flushEvents() {
    const st = useNM.getState();
    for (const e of this.scorer.events) {
      st.pushPopup({ kind: e.kind, label: e.label, sub: e.sub, points: e.points, tier: e.tier });
      if (e.kind === 'near') {
        this.audio.whoosh(e.tier ?? 1, (Math.random() - 0.5) * 1.4);
        if (e.tier === 3) this.beatT = 0.4;
        this.audio.combo(this.scorer.mult);
        this.cam.shake = Math.max(this.cam.shake, 0.12 * (e.tier ?? 1));
      } else if (e.kind === 'bonus') this.audio.combo(this.scorer.mult);
      else if (e.kind === 'bank') this.audio.bank(e.points);
      else if (e.kind === 'lost') this.audio.comboLost();
    }
    this.scorer.events.length = 0;
  }

  /** which road the car is on and whether it is in a lane against traffic (right-hand traffic) */
  roadInfo(x: number, z: number, yaw: number): { oncoming: boolean; street: string } {
    const c = this.world!.city;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (const s of c.segments) {
      if (!s.exists) continue;
      if (s.orient === 'v') {
        const lat = x - s.x0;
        if (Math.abs(lat) > s.hw || z < s.z0 || z > s.z1) continue;
        // heading +z keeps right at -x
        const aligned = Math.abs(fz) > 0.7;
        return { oncoming: aligned && Math.abs(lat) > 0.6 && lat * -Math.sign(fz) < 0, street: s.name };
      } else {
        const lat = z - s.z0;
        if (Math.abs(lat) > s.hw || x < s.x0 || x > s.x1) continue;
        // heading +x keeps right at +z
        const aligned = Math.abs(fx) > 0.7;
        return { oncoming: aligned && Math.abs(lat) > 0.6 && lat * Math.sign(fx) < 0, street: s.name };
      }
    }
    return { oncoming: false, street: '' };
  }

  private intersectionAt(x: number, z: number) {
    for (const it of this.world!.city.intersections) if (Math.abs(x - it.x) < it.hx && Math.abs(z - it.z) < it.hz) return it.id;
    return -1;
  }

  private render() {
    const night = G.uNight.value;
    const r = this.vehR;
    const draw = useStore.getState().settings.graphics.drawDistance;
    const lights = night > 0.4 || this.cond.weather.rain > 0.5 ? 1 : 0;
    r.begin();
    for (const v of this.traffic!.vehicles) {
      if (Math.hypot(v.x - this.focus.x, v.z - this.focus.z) > draw) continue;
      r.push({ type: v.type, x: v.x, z: v.z, yaw: v.yaw, paint: v.paint, head: lights, brake: v.brake ? 1 : 0, hazard: v.hazard || v.blink !== 0 ? 1 : 0, siren: v.type === 8 ? 1 : 0, wheelRot: v.wheelRot, steer: clamp(v.yawRate * 8, -0.5, 0.5) });
    }
    for (const v of this.traffic!.parked) {
      if (Math.hypot(v.x - this.focus.x, v.z - this.focus.z) > draw) continue;
      r.push({ type: v.type, x: v.x, z: v.z, yaw: v.yaw, paint: v.paint, head: 0, brake: 0, wheelRot: 0, steer: 0 });
    }
    if (this.car) r.push(this.car.getDrawable(night));
    r.end();
  }

  private publish() {
    const s = this.scorer;
    const car = this.car;
    const road = car && this.world ? this.roadInfo(car.pos.x, car.pos.z, car.yaw) : { oncoming: false, street: '' };
    const lv = car?.body.linvel();
    const slip = car && lv ? Math.abs(lv.x * -Math.cos(car.yaw) + lv.z * Math.sin(car.yaw)) : 0;
    useNM.getState().setHud({
      speed: car ? Math.round(Math.abs(car.forwardSpeed) * 3.6) : 0,
      score: s.score,
      comboPoints: Math.round(s.comboPoints),
      mult: s.mult,
      comboT: s.comboT,
      boost: s.boost,
      boosting: this.boosting,
      time: s.time,
      oncoming: this.phase === 'run' && road.oncoming && !!car && car.speed > 12,
      drifting: this.phase === 'run' && !!car && car.speed > 9 && slip > 3.5,
      countdown: this.phase === 'countdown' ? Math.max(0, Math.ceil(3 - this.phaseT)) : 0,
      street: road.street,
    });
  }

  afterRender() {
    this.renderer?.info.reset();
  }

  /** advance without rendering (automated tests: software WebGL draws ~1 frame a second) */
  simulate(seconds: number, dt = 1 / 30) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) this.update(dt);
  }
}

export const nm = new NearMissGame();
