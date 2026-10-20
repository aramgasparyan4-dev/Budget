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
import { TireSmoke, SkidMarks } from '../render/TireEffects';
import { wrapAngle } from '../core/math';
import type { RoadSegment } from '../world/types';
import type { Lane } from '../sim/traffic/RoadGraph';
import { useStore } from '../state/store';
import { clamp, damp } from '../core/math';
import { Scorer, OtherCar, RULES } from './scoring';
import { useNM, Phase, Mode } from './store';
import { RACE_TRAFFIC } from './race';
import { RaceSession, RIVAL_FINISHED_GRACE, rivalPaintFor } from './RaceSession';
import { useGarage, hostBridge, startBridge } from './garage/store';
import { CarSetup, damageFactor, MIN_HEALTH, raceCoins, repairCost, runCoins } from './garage/progress';
import { displayName, paintOf } from './garage/vehicle';
import type { ParkingSpot } from '../world/types';

/** the same city as Echo City */
export const CITY_SEED = 20261019;

const clear = (o: Partial<WeatherParams> = {}): WeatherParams => ({ cloud: 0.15, rain: 0, fog: 0, wet: 0, wind: 0.2, storm: 0, flash: 0, ...o });

export const CONDITIONS: Record<string, { label: string; hour: number; weather: WeatherParams; grip: number }> = {
  night: { label: 'Midnight', hour: 0.4, weather: clear(), grip: 1 },
  rain: { label: 'Night rain', hour: 22.6, weather: clear({ cloud: 0.95, rain: 0.85, fog: 0.25, wet: 1, wind: 0.55, storm: 0.35 }), grip: 0.78 },
  dusk: { label: 'Golden hour', hour: 18.75, weather: clear({ cloud: 0.3 }), grip: 1 },
  day: { label: 'Noon', hour: 12.5, weather: clear({ cloud: 0.25 }), grip: 1 },
};

const BOOST_POWER = 1.8;
const BOOST_TOP = 1.25;
const DARK_PAINT = new THREE.Color(0x1d1d1f);
/** free drive: much denser than Echo City, spawning often and close in (never in plain view ahead) */
const SCORE_TRAFFIC = { maxVehicles: 160, spawnInterval: 0.03, spawnAttempts: 24, spawnRadius: { min: 60, max: 280, despawn: 320 } };
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
  smoke = new TireSmoke(700);
  /** black smoke from a damaged engine */
  engineSmoke = new TireSmoke(240, 1);
  skids = new SkidMarks(3000);
  private smokeAcc = 0;
  private engineSmokeAcc = 0;
  car: DrivableVehicle | null = null;
  scorer = new Scorer();
  mode: Mode = 'score';
  race: RaceSession | null = null;
  /** where the floating RIVAL tag goes (CSS px), read by the UI every frame */
  rivalTag: { x: number; y: number; dist: number } | null = null;
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
  /** the garage car being driven (set at the start of each run) */
  setup: CarSetup | null = null;
  /** its paint before any damage */
  private basePaint = new THREE.Color();
  /** this run's condition and coins have been written to the garage */
  private runSaved = true;
  /** the title screen: your car parked at a curb, the camera circling it */
  private showroom: { spot: ParkingSpot; out: [number, number]; along: [number, number] } | null = null;
  private showPaint = new THREE.Color();
  /** a street-lamp spot over the parked car (always in the scene so shaders never recompile; 0 when unused) */
  private showLight = new THREE.SpotLight(0xffe0b0, 0, 20, 0.62, 0.7, 1.4);

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
    scene.add(this.vehR.group, this.smoke.points, this.engineSmoke.points, this.skids.mesh, this.showLight, this.showLight.target);
    (window as unknown as { __nm: NearMissGame }).__nm = this;
    startBridge();
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
    this.trafficPreset(SCORE_TRAFFIC);
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
    const cands = lanes.filter((l) => l.dx * ax + l.dz * az < 0 === oncoming);
    if (!cands.length) return;
    const l = cands[Math.floor(Math.random() * cands.length)];
    const sAt = (px - l.x0) * l.dx + (pz - l.z0) * l.dz;
    if (sAt < 4 || sAt > l.length - 4) return;
    tr.spawn(l.id, sAt);
  }

  private trafficPreset(p: typeof SCORE_TRAFFIC) {
    Object.assign(this.traffic!, { ...p, spawnRadius: { ...p.spawnRadius } });
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
    this.saveRun(0);
    this.removeCar();
    this.endRace();
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

  /** start a run in the mode picked on the title screen; `sameRoute` replays the last race's route */
  startRun(sameRoute = false) {
    if (!this.world || !this.traffic) return;
    this.audio.init();
    // restarting mid-run: the damage so far stays with the car (no coins for an unfinished run)
    this.saveRun(0);
    const setup = useGarage.getState().setup();
    if (setup.progress.health < MIN_HEALTH) {
      useGarage.setState({ notice: 'Your car needs a repair before it can drive' });
      if (this.phase !== 'title') this.toTitle();
      return;
    }
    this.removeCar();
    this.setup = setup;
    this.basePaint.setHex(paintOf(setup.vehicle.color, VEHICLES[setup.type].palette[0]));
    this.mode = useNM.getState().mode;
    let start: { x: number; z: number; yaw: number };
    if (this.mode === 'race') {
      const seed = sameRoute && this.race ? this.race.seed : Math.floor(Math.random() * 1e9);
      this.endRace();
      this.trafficPreset(RACE_TRAFFIC);
      // the rival drives the same kind of car, in a colour that stands out from yours
      this.race = new RaceSession(this.world, this.traffic, this.scene, setup.type, rivalPaintFor(this.basePaint), seed);
      this.race.rival.gripMul = this.condGrip(setup);
      start = this.race.grid();
    } else {
      this.endRace();
      this.trafficPreset(SCORE_TRAFFIC);
      start = this.pickStart();
      // nothing parked on top of us or right in front
      for (const v of [...this.traffic.vehicles]) if (Math.hypot(v.x - start.x, v.z - start.z) < 45) this.traffic.remove(v);
    }
    this.leaveShowroom();
    const car = new DrivableVehicle(this.world.physics, setup.type, start.x, 0.02, start.z, start.yaw, this.basePaint, 'player', displayName(setup.vehicle));
    car.headlights = true;
    car.gripMul = setup.grip * this.condGrip(setup);
    car.brakeMul = setup.brake;
    car.driftAssist = true;
    this.skids.clear();
    this.smoke.clear();
    car.driven = true;
    car.onImpact = (dv) => this.onImpact(dv);
    this.car = car;
    this.scorer = new Scorer(this.mode, {
      health: setup.progress.health,
      damageTaken: setup.damageTaken,
      scoreMul: setup.scoreMul,
      nearMul: setup.nearMul,
      driftMul: setup.driftMul,
      boostGainMul: setup.boostGainMul,
      boostDrainMul: setup.boostDrainMul,
      startBoost: setup.startBoost,
    });
    this.runSaved = false;
    this.damageLook();
    this.rivalTag = null;
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

  /** grip left in these conditions (all-wheel drive keeps more of it in the rain) */
  private condGrip(setup: CarSetup) {
    return 1 - (1 - this.cond.grip) * setup.rainPenalty;
  }

  /** write the car's condition (and the coins earned) back to the garage, once per run */
  private saveRun(coins: number, score = 0) {
    if (this.runSaved || !this.setup) return;
    this.runSaved = true;
    useGarage.getState().finish(this.scorer.health, coins, score);
  }

  /** paint, hazards and smoke follow the car's condition */
  private damageLook() {
    const car = this.car;
    if (!car) return;
    const h = this.scorer.health;
    car.paint.copy(this.basePaint).lerp(DARK_PAINT, Math.max(0, (100 - h) / 100) * 0.55);
    car.hazards = h < 35;
  }

  /** R: the same again (a race replays its route) */
  retry() {
    if (this.phase === 'loading') return;
    this.startRun(true);
  }

  private endRace() {
    this.race?.dispose();
    this.race = null;
    this.rivalTag = null;
    useNM.getState().set({ race: null });
  }

  /** T in a race: back on the route where you left it (flipped, lost, wedged) */
  backOnTrack() {
    const car = this.car;
    if (!this.race || !car || this.phase !== 'run' || this.race.playerTime !== null) return;
    const yaw = this.race.resetPlayer(car);
    this.cam.alignBehind(yaw);
    this.cam.snap();
    this.flipT = 0;
    useNM.getState().pushPopup({ kind: 'scrape', label: 'BACK ON TRACK', points: 0 });
  }

  togglePause() {
    if (this.phase !== 'run' && this.phase !== 'countdown') return;
    this.paused = !this.paused;
    useNM.getState().set({ paused: this.paused });
    if (this.paused) this.audio.engine(0, 0, 0, false);
  }

  private removeCar() {
    this.audio.skid(0);
    if (this.car) {
      this.car.dispose();
      this.car = null;
      this.audio.engineStop();
    }
  }

  private finish() {
    const s = this.scorer;
    const st = useNM.getState();
    if (this.race) return this.finishRace();
    const setup = this.setup!;
    const name = displayName(setup.vehicle);
    const rank = st.record({ score: s.score, car: name, cond: this.cond.label, date: Date.now(), nearMisses: s.nearMisses, bestCombo: s.bestCombo });
    const coins = runCoins(s.score, setup);
    this.saveRun(coins, s.score);
    hostBridge()?.send({ type: 'nearmiss:run', vehicleId: setup.vehicle.id, mode: 'score', score: s.score, coins, health: Math.round(s.health) });
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
        drifts: s.drifts,
        bestDrift: s.bestDrift,
        closest: isFinite(s.closest) ? Math.round(s.closest * 100) / 100 : null,
        car: name,
        cond: this.cond.label,
        rank,
        mode: 'score',
        garage: this.garageResult(coins),
      },
    });
    this.audio.engine(0, 0, 0, false);
    this.setPhase('results');
  }

  /** the player crossed the line, or ran out of time after the rival did */
  private finishRace() {
    const race = this.race!;
    const s = this.scorer;
    const st = useNM.getState();
    const setup = this.setup!;
    const mine = race.playerTime;
    const won = mine !== null && (race.rivalTime === null || mine < race.rivalTime);
    const rivalEstimated = race.rivalTime === null;
    const rivalTime = race.rivalTime ?? (mine !== null ? mine + race.rivalSecondsLeft() : null);
    const margin = won && rivalTime !== null ? rivalTime - mine : 0;
    const record = st.recordRace(won, margin);
    const coins = raceCoins(won, mine !== null, margin, setup);
    this.saveRun(coins);
    hostBridge()?.send({ type: 'nearmiss:run', vehicleId: setup.vehicle.id, mode: 'race', score: 0, coins, health: Math.round(s.health), won });
    st.set({
      result: {
        score: s.score,
        reason: 'time',
        nearMisses: s.nearMisses,
        bestCombo: s.bestCombo,
        bestBank: s.bestBank,
        topSpeed: Math.round(s.topSpeed),
        distance: Math.round(s.distance),
        seconds: Math.round(race.time),
        oncomingSec: Math.round(s.oncomingSec),
        driftSec: Math.round(s.driftSec),
        drifts: s.drifts,
        bestDrift: s.bestDrift,
        closest: isFinite(s.closest) ? Math.round(s.closest * 100) / 100 : null,
        car: displayName(setup.vehicle),
        cond: this.cond.label,
        rank: 0,
        mode: 'race',
        garage: this.garageResult(coins),
        race: { won, time: mine, rivalTime, rivalEstimated, crashes: s.crashes, rivalCrashes: race.rivalCrashes, length: Math.round(race.route.length), record },
      },
    });
    this.audio.engine(0, 0, 0, false);
    this.audio.skid(0);
    this.setPhase('results');
  }

  private garageResult(coins: number) {
    const s = this.scorer;
    const a = this.setup!.archetype;
    return { coins, health: Math.round(s.health), damage: Math.round(s.damageTaken), repair: repairCost(a, s.health), total: useGarage.getState().save.coins };
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
    this.damageLook();
    if (r === 'wreck') this.wreck();
    else if (r === 'crash' && this.race) {
      // racing: a big hit stops you dead, then you carry on
      this.car.stop();
      this.race.stunT = 0.9;
      this.flushEvents();
    } else if (r === 'damage') {
      this.beatT = 0.6;
      this.flushEvents();
    }
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
      const dmg = damageFactor(this.scorer.health);
      const st = this.setup;
      car.powerMul = (st?.power ?? 1) * (this.boosting ? BOOST_POWER : 1) * dmg.power;
      car.topMul = (st?.top ?? 1) * (this.boosting ? BOOST_TOP : 1) * dmg.top;
    }
    const race = this.race;
    const go = this.phase === 'run';
    // stopped by a crash in a race: no control for a moment
    const control = driving && !(race && race.stunT > 0);
    if (!this.paused) {
      world.physics.advance(dt, (h) => {
        car?.control(h, input, control);
        race?.control(h, go);
      });
    }

    // camera and the point everything streams around
    if (car && (this.phase === 'countdown' || this.phase === 'run')) {
      this.cam.handleMouse(input, true);
      this.cam.baseFov = damp(this.cam.baseFov, this.baseFov + (this.boosting ? 12 : 0), 5, rawDt);
      // in a slide the camera swings toward the direction of travel, so you see the car side-on
      let heading = car.yaw;
      if (car.drifting) {
        const lv = car.body.linvel();
        const travel = Math.atan2(lv.x, lv.z);
        heading = travel + wrapAngle(car.yaw - travel) * 0.45;
      }
      this.cam.update(rawDt, car.pos, world.physics, { heading, speed: car.speed });
      this.focus.copy(car.pos);
    } else if (car && this.phase === 'wreck') {
      this.orbit += rawDt * 0.5;
      const p = car.pos;
      this.camera.position.lerp(new THREE.Vector3(p.x + Math.sin(this.orbit) * 9, p.y + 3.2, p.z + Math.cos(this.orbit) * 9), 1 - Math.exp(-rawDt * 3));
      this.camera.lookAt(p.x, p.y + 0.5, p.z);
      this.focus.copy(p);
    } else {
      // title: your car at the curb; results: ride behind a random car in traffic
      if (this.phase === 'title' && this.showroomCam(rawDt)) {
        /* showroom */
      } else this.attractCam(rawDt);
    }
    const cf = new THREE.Vector3();
    this.camera.getWorldDirection(cf);
    this.camFwd.set(cf.x, cf.z).normalize();

    // traffic (denser the longer you survive)
    const tr = this.traffic;
    tr.density = this.phase === 'run' ? 1 + Math.min(0.4, this.scorer.elapsed / 150) : 0.9;
    tr.obstacles.length = 0;
    if (car) tr.obstacles.push({ x: car.pos.x, z: car.pos.z, r: car.spec.width * 0.6 + 0.4, kind: 'playerCar' });
    if (race) tr.obstacles.push({ x: race.rival.pos.x, z: race.rival.pos.z, r: race.rival.spec.width * 0.6 + 0.4, kind: 'playerCar' });
    if (!this.paused) {
      if (car && this.phase === 'run' && !race) this.direct(dt, car);
      tr.update(dt, this.focus, this.camFwd, TRAFFIC_HOUR);
      tr.syncBodies(this.focus, race?.rival.pos);
    }

    // the race: rival, checkpoints, positions
    if (race && car && !this.paused && (this.phase === 'countdown' || this.phase === 'run')) {
      race.update(dt, car, this.phase === 'run', this.camera);
      this.raceEvents(race, car);
    }

    // scoring
    if (this.phase === 'run' && car && !this.paused) this.score(dt, car);

    // flipped over: a wreck in free drive, back on the route in a race
    if (car && this.phase === 'run') {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quat);
      this.flipT = up.y < 0.35 ? this.flipT + dt : 0;
      if (this.flipT > 0.8) {
        if (race) this.backOnTrack();
        else this.wreck();
      }
    }

    this.tireEffects(dt, car);
    world.update(this.renderer, this.camera, dt, this.time, cond.hour, cond.weather, this.focus);
    this.render();

    // sound
    if (this.audio.ready) {
      this.audio.updateAmbience(rawDt, {
        traffic: Math.min(1, tr.vehicles.length / 60),
        rain: cond.weather.rain,
        wind: cond.weather.wind,
        crowd: 0,
        day: 1 - G.uNight.value,
        interior: false,
        park: 0,
      });
      if (car && (this.phase === 'run' || this.phase === 'countdown') && !this.paused) {
        const thr = input.down('KeyW') || input.down('ArrowUp') ? 1 : 0;
        this.audio.engine(Math.min(1.2, car.rpm + (this.boosting ? 0.25 : 0)), thr, car.speed, car.spec.mass > 2300);
      }
      const sliding = car && this.phase === 'run' && !this.paused && (car.drifting || (car.handbrake && car.speed > 8));
      this.audio.skid(sliding ? Math.min(1, Math.max(0.35, Math.abs(car.slipAngle) / 30)) * Math.min(1, car.speed / 15) : 0);
    }

    input.endFrame();
    this.hudT -= rawDt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.publish();
    }
  }

  private raceEvents(race: RaceSession, car: DrivableVehicle) {
    const st = useNM.getState();
    const n = race.route.checkpoints.length;
    for (const e of race.events) {
      if (e.kind === 'checkpoint') {
        st.pushPopup({ kind: 'bonus', label: 'CHECKPOINT', sub: `${e.index + 1} / ${n}`, points: 0 });
        this.audio.countdown(false);
      } else if (e.kind === 'finish') {
        this.audio.countdown(true);
        this.finishRace();
        return;
      } else if (e.kind === 'rivalFinished') {
        st.pushPopup({ kind: 'lost', label: 'RIVAL FINISHED', sub: `${RIVAL_FINISHED_GRACE} S TO GET HOME`, points: 0 });
        this.audio.comboLost();
      } else if (e.kind === 'rivalCrash') {
        const d = race.rival.pos.distanceTo(car.pos);
        if (d < 150) st.pushPopup({ kind: 'bonus', label: 'RIVAL CRASHED', points: 0 });
        if (d < 80) this.audio.crash(Math.max(0.15, 0.8 - d / 100));
      } else if (e.kind === 'lead') {
        st.pushPopup({ kind: e.ahead ? 'bank' : 'lost', label: e.ahead ? 'TOOK THE LEAD' : 'LOST THE LEAD', points: 0 });
        if (e.ahead) this.audio.combo(4);
      }
    }
    // too slow: the rival has been home for a while
    if (race.rivalTime !== null && race.playerTime === null && race.time - race.rivalTime > RIVAL_FINISHED_GRACE) this.finishRace();
  }

  /** park the active car at the curb nearest downtown for the title screen */
  private enterShowroom() {
    const city = this.world!.city;
    const tr = this.traffic!;
    const c = this.downtown();
    // no tree or lamp right next to it: they block the camera and catch the light
    const tall = city.props.filter((p) => (p.type === 'tree' || p.type === 'conifer' || p.type === 'palm' || p.type === 'lamp') && Math.hypot(p.x - c.x, p.z - c.z) < 400);
    let best: ParkingSpot | null = null;
    let bd = Infinity;
    for (const p of city.parking) {
      if (tr.usedSpots.has(p.id) || !city.segments[p.seg]?.exists) continue;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d >= bd) continue;
      if (tall.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 7)) continue;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return;
    for (const v of [...tr.parked]) if (Math.hypot(v.x - best.x, v.z - best.z) < 9) tr.remove(v);
    tr.usedSpots.add(best.id);
    const seg = city.segments[best.seg];
    const out: [number, number] = seg.orient === 'v' ? [Math.sign(seg.x0 - best.x) || 1, 0] : [0, Math.sign(seg.z0 - best.z) || 1];
    this.showroom = { spot: best, out, along: [Math.sin(best.rot), Math.cos(best.rot)] };
    this.attractSnap = true;
  }

  private leaveShowroom() {
    if (this.showroom) this.traffic?.usedSpots.delete(this.showroom.spot.id);
    this.showroom = null;
    this.showLight.intensity = 0;
  }

  /** the title camera: a slow half circle round your car from the street side */
  private showroomCam(dt: number): boolean {
    if (!this.showroom) this.enterShowroom();
    const sh = this.showroom;
    if (!sh) return false;
    const { spot, out, along } = sh;
    const a = Math.sin(this.time * 0.16) * 1.05;
    const dx = out[0] * Math.cos(a) + along[0] * Math.sin(a);
    const dz = out[1] * Math.cos(a) + along[1] * Math.sin(a);
    const want = new THREE.Vector3(spot.x + dx * 8.2, 2.5, spot.z + dz * 8.2);
    if (this.attractSnap) this.camera.position.copy(want);
    else this.camera.position.lerp(want, 1 - Math.exp(-dt * 3));
    this.attractSnap = false;
    // aim a little to the car's left so it sits right of centre, clear of the title column
    const fx = spot.x - this.camera.position.x;
    const fz = spot.z - this.camera.position.z;
    const fl = Math.hypot(fx, fz) || 1;
    const shift = this.camera.aspect > 1.3 ? 1.4 : 0;
    this.camera.lookAt(spot.x + (fz / fl) * shift, 0.6, spot.z - (fx / fl) * shift);
    // a key light just off the camera's shoulder, so the side you are looking at is always lit
    const b = a + 0.45;
    const lx = out[0] * Math.cos(b) + along[0] * Math.sin(b);
    const lz = out[1] * Math.cos(b) + along[1] * Math.sin(b);
    this.showLight.position.set(spot.x + lx * 6, 3.4, spot.z + lz * 6);
    this.showLight.target.position.set(spot.x, 0.5, spot.z);
    this.showLight.intensity = 40 + 190 * G.uNight.value;
    this.camera.fov = damp(this.camera.fov, 52, 3, dt);
    this.camera.updateProjectionMatrix();
    this.focus.set(spot.x, 0, spot.z);
    // a damaged car smokes on the title screen too: a reminder to fix it
    const g = useGarage.getState();
    const health = g.setup().progress.health;
    if (health < 60 && dt > 0) {
      this.engineSmokeAcc += (8 + (60 - health) * 0.4) * dt;
      const len = VEHICLES[g.setup().type].length;
      while (this.engineSmokeAcc >= 1) {
        this.engineSmokeAcc -= 1;
        this.engineSmoke.emit(spot.x + along[0] * (len / 2 - 0.7), 0.6, spot.z + along[1] * (len / 2 - 0.7), 0, 0, 0.9);
      }
    }
    return true;
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
    const road = this.roadInfo(car.pos.x, car.pos.z, yaw);
    this.scorer.update({ x: car.pos.x, z: car.pos.z, yaw, vx: lv.x, vz: lv.z, width: car.spec.width, length: car.spec.length }, others, {
      oncoming: road.oncoming,
      drift: { active: car.drifting, angle: Math.abs(car.slipAngle) },
      boosting: this.boosting,
      dt,
    });
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
    const racing = this.mode === 'race';
    for (const e of this.scorer.events) {
      // in a race only the moments matter, not points or banking
      if (racing && (e.kind === 'bank' || e.kind === 'lost')) continue;
      st.pushPopup({ kind: e.kind, label: e.label, sub: e.sub, points: racing ? 0 : e.points, tier: e.tier });
      if (e.kind === 'near') {
        this.audio.whoosh(e.tier ?? 1, (Math.random() - 0.5) * 1.4);
        if (e.tier === 3) this.beatT = 0.4;
        this.audio.combo(this.scorer.mult);
        this.cam.shake = Math.max(this.cam.shake, 0.12 * (e.tier ?? 1));
      } else if (e.kind === 'bonus' || e.kind === 'drift') this.audio.combo(this.scorer.mult);
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

  /** smoke and skid marks from the rear tires while sliding (drifts and handbrake locks) */
  private tireEffects(dt: number, car: DrivableVehicle | null) {
    if (dt > 0) {
      this.smoke.update(dt);
      this.engineSmoke.update(dt);
    }
    this.smoke.setViewport(this.renderer.domElement.height, this.camera.fov);
    this.engineSmoke.setViewport(this.renderer.domElement.height, this.camera.fov);
    if (!car || dt <= 0) return;
    if (this.scorer.damaged) {
      // from under the bonnet, thicker when slow and the worse the damage
      const worse = 0.4 + (60 - this.scorer.health) / 60;
      this.engineSmokeAcc += (16 + 22 / (1 + car.speed / 8)) * worse * dt;
      const f = new THREE.Vector3(0, 0.55, car.spec.length / 2 - 0.7).applyQuaternion(car.quat).add(car.pos);
      const lv = car.body.linvel();
      while (this.engineSmokeAcc >= 1) {
        this.engineSmokeAcc -= 1;
        this.engineSmoke.emit(f.x, f.y, f.z, lv.x * 0.6, lv.z * 0.6, 1.1);
      }
    }
    const sliding = (car.drifting || (car.handbrake && car.speed > 8)) && car.speed > 5;
    const lv = car.body.linvel();
    const intensity = car.drifting ? Math.min(1.4, Math.abs(car.slipAngle) / 25) : 0.5;
    this.smokeAcc += sliding ? 36 * intensity * Math.min(1, car.speed / 18) * dt : 0;
    for (const i of [2, 3]) {
      const p = sliding ? car.wheelContact(i) : null;
      this.skids.add(i, p);
    }
    while (this.smokeAcc >= 1) {
      this.smokeAcc -= 1;
      const p = car.wheelContact(Math.random() < 0.5 ? 2 : 3);
      if (p) this.smoke.emit(p.x, p.y, p.z, lv.x, lv.z, 0.8 + intensity * 0.6);
    }
  }

  private render() {
    const night = G.uNight.value;
    const r = this.vehR;
    const draw = useStore.getState().settings.graphics.drawDistance;
    const lights = night > 0.4 || this.cond.weather.rain > 0.5 ? 1 : 0;
    r.begin();
    for (const v of this.traffic!.vehicles) {
      if (Math.hypot(v.x - this.focus.x, v.z - this.focus.z) > draw) continue;
      r.push({
        type: v.type,
        x: v.x,
        z: v.z,
        yaw: v.yaw,
        paint: v.paint,
        head: lights,
        brake: v.brake ? 1 : 0,
        hazard: v.hazard || v.blink !== 0 ? 1 : 0,
        siren: v.type === 8 ? 1 : 0,
        wheelRot: v.wheelRot,
        steer: clamp(v.yawRate * 8, -0.5, 0.5),
      });
    }
    for (const v of this.traffic!.parked) {
      if (Math.hypot(v.x - this.focus.x, v.z - this.focus.z) > draw) continue;
      r.push({ type: v.type, x: v.x, z: v.z, yaw: v.yaw, paint: v.paint, head: 0, brake: 0, wheelRot: 0, steer: 0 });
    }
    if (this.car) r.push(this.car.getDrawable(night));
    if (this.race) r.push(this.race.rival.getDrawable(night));
    if (this.phase === 'title' && this.showroom) {
      const st = useGarage.getState().setup();
      const h = st.progress.health;
      const paint = this.showPaint.setHex(paintOf(st.vehicle.color, VEHICLES[st.type].palette[0])).lerp(DARK_PAINT, ((100 - h) / 100) * 0.55);
      const sp = this.showroom.spot;
      r.push({ type: st.type, x: sp.x, z: sp.z, yaw: sp.rot, paint, head: 1, brake: 0, hazard: h < 35 ? 1 : 0, wheelRot: 0, steer: 0 });
    }
    r.end();
  }

  private publish() {
    const s = this.scorer;
    const car = this.car;
    const road = car && this.world ? this.roadInfo(car.pos.x, car.pos.z, car.yaw) : { oncoming: false, street: '' };
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
      drifting: this.phase === 'run' && s.driftActive,
      driftAngle: car ? Math.round(Math.abs(car.slipAngle)) : 0,
      driftPoints: Math.round(s.driftPoints),
      countdown: this.phase === 'countdown' ? Math.max(0, Math.ceil(3 - this.phaseT)) : 0,
      street: road.street,
      damaged: s.damaged,
      health: s.health,
      lastHit: s.health <= RULES.bigHitCap * s.opts.damageTaken,
    });
    const race = this.race;
    if (race && car && (this.phase === 'countdown' || this.phase === 'run')) {
      const g = race.guide();
      const cf = new THREE.Vector3();
      this.camera.getWorldDirection(cf);
      const camYaw = Math.atan2(cf.x, cf.z);
      const toYaw = Math.atan2(g.x - car.pos.x, g.z - car.pos.z);
      useNM.getState().set({
        race: {
          position: race.position,
          checkpoint: race.player.next,
          checkpoints: race.route.checkpoints.length,
          time: race.time,
          gap: Math.round(race.player.s - race.rivalProgress.s),
          rivalDist: Math.round(race.rival.pos.distanceTo(car.pos)),
          arrow: Math.round((-wrapAngle(toYaw - camYaw) * 180) / Math.PI),
          cpDist: Math.round(g.cpDist),
          off: race.player.off > 18,
          wrongWay: race.player.wrongWay,
          rivalFinished: race.rivalTime !== null,
          stunned: race.stunT > 0,
          left: race.rivalTime !== null ? Math.max(0, RIVAL_FINISHED_GRACE - (race.time - race.rivalTime)) : -1,
        },
      });
    }
  }

  /** screen position of the rival's tag; called every frame by the UI */
  updateRivalTag(w: number, h: number) {
    const race = this.race;
    if (!race || !this.car || (this.phase !== 'countdown' && this.phase !== 'run')) return (this.rivalTag = null);
    const p = race.tag(this.camera, w, h);
    this.rivalTag = p ? { ...p, dist: race.rival.pos.distanceTo(this.car.pos) } : null;
    return this.rivalTag;
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
