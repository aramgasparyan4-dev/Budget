import * as THREE from 'three';
import { Input } from '../engine/Input';
import { Physics, initRapier } from '../engine/Physics';
import { AudioEngine } from '../engine/Audio';
import { generateCity } from '../world/CityGenerator';
import type { CityData } from '../world/types';
import { ChunkManager } from '../render/ChunkManager';
import { Environment } from '../render/Environment';
import { Terrain } from '../render/Terrain';
import { G } from '../render/globals';
import { CameraController } from './CameraController';
import { PlayerController } from './PlayerController';
import { Crowd, buildHumanGeometry, createHumanMaterial, createHumanDepthMaterial, HumanLook } from '../render/Human';
import { useStore } from '../state/store';
import type { Settings } from '../state/settings';
import { Session } from './Session';
import { Rain } from '../render/Rain';

export const DEFAULT_SEED = 20261019;

export class Game {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  input = new Input();
  audio = new AudioEngine();
  cam!: CameraController;
  attached = false;

  city: CityData | null = null;
  physics: Physics | null = null;
  chunks: ChunkManager | null = null;
  env: Environment | null = null;
  terrain: Terrain | null = null;
  rain: Rain | null = null;
  player: PlayerController | null = null;
  session: Session | null = null;
  humanGeo = buildHumanGeometry('high');
  humanGeoLow = buildHumanGeometry('low');
  humanMat = createHumanMaterial();
  humanDepth = createHumanDepthMaterial();
  playerCrowd = new Crowd(1, this.humanGeo, this.humanMat, this.humanDepth);
  worldSeed = -1;

  mode: 'none' | 'menu' | 'game' = 'none';
  time = 0;
  private menuT = 0;
  private frames = 0;
  private fpsTimer = 0;
  fps = 60;
  private lastFrameMs = 16;
  private simMs = 0;
  focus = new THREE.Vector3();
  private updaters: ((dt: number) => void)[] = [];
  lastDraws = 0;
  lastTris = 0;
  /** set by the save system */
  autosave: (() => void) | null = null;
  private perfTimer = 0;

  attach(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.attached) return;
    this.attached = true;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cam = new CameraController(camera);
    this.input.attach(renderer.domElement);
    renderer.info.autoReset = false;
    this.scene.add(this.playerCrowd.mesh);
    (window as unknown as { __echo: Game }).__echo = this;
    const unlockAudio = () => {
      this.audio.init();
      this.audio.setVolumes(this.settings.audio);
      if (this.mode === 'menu') this.audio.playMusic('menu');
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  onUpdate(fn: (dt: number) => void) {
    this.updaters.push(fn);
  }

  get settings(): Settings {
    return useStore.getState().settings;
  }

  async loadWorld(seed: number, progress: (p: number, t: string) => void) {
    if (this.worldSeed === seed && this.city) return;
    this.endSession();
    this.unloadWorld();
    progress(0.02, 'Initialising physics');
    await initRapier();
    progress(0.06, 'Surveying the city');
    await new Promise((r) => setTimeout(r, 0));
    const city = generateCity(seed);
    this.city = city;
    this.worldSeed = seed;
    progress(0.15, 'Laying roads and foundations');
    const chunks = new ChunkManager(city);
    this.chunks = chunks;
    this.scene.add(chunks.group);
    await chunks.init((p) => progress(0.15 + p * 0.55, 'Raising buildings'));
    progress(0.72, 'Shaping the hills');
    await new Promise((r) => setTimeout(r, 0));
    this.terrain = new Terrain(seed, this.settings.graphics.vegetation);
    this.scene.add(this.terrain.group);
    progress(0.8, 'Building collision');
    await new Promise((r) => setTimeout(r, 0));
    this.physics = new Physics();
    this.physics.buildCity(city, chunks.models, seed);
    this.env = new Environment(this.scene);
    this.rain = new Rain(this.settings.graphics.rainParticles);
    this.scene.add(this.rain.group);
    this.applySettings(this.settings);
    progress(0.9, 'Waking up the citizens');
  }

  unloadWorld() {
    if (this.chunks) {
      this.scene.remove(this.chunks.group);
      this.chunks.dispose();
      this.chunks = null;
    }
    if (this.terrain) {
      this.scene.remove(this.terrain.group);
      this.terrain.dispose();
      this.terrain = null;
    }
    if (this.rain) {
      this.scene.remove(this.rain.group);
      this.rain = null;
    }
    this.env?.dispose();
    this.env = null;
    this.player?.dispose();
    this.player = null;
    this.physics?.dispose();
    this.physics = null;
    this.city = null;
    this.worldSeed = -1;
  }

  applySettings(s: Settings) {
    const g = s.graphics;
    if (this.env) {
      this.env.drawDistance = g.drawDistance;
      this.env.setShadowQuality(g.shadows || 1024, g.shadowExtent, g.shadows > 0);
    }
    if (this.renderer) {
      this.renderer.shadowMap.enabled = g.shadows > 0;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    if (this.chunks) {
      this.chunks.detailRadius = g.detailRadius;
      if (this.chunks.vegetation !== g.vegetation) {
        this.chunks.vegetation = g.vegetation;
        this.chunks.reloadDetails();
      }
      this.chunks.setShadows(g.shadows > 0);
    }
    if (this.camera) {
      this.camera.far = g.drawDistance + 400;
      this.camera.near = 0.25;
      this.camera.updateProjectionMatrix();
    }
    if (this.cam) {
      this.cam.sensitivity = s.controls.sensitivity;
      this.cam.invertY = s.controls.invertY;
      this.cam.baseFov = s.controls.fov;
      this.cam.dist = s.controls.cameraDistance;
    }
    this.rain?.setCount(g.rainParticles);
    if (this.session) {
      if (!this.session.background) this.session.clock.scale = s.gameplay.timeScale;
      this.session.applyDensity();
    }
    this.audio.setVolumes(s.audio);
  }

  // ------------------------------------------------------------------ sessions
  startMenu() {
    this.mode = 'menu';
    this.menuT = 0;
    if (!this.session || !this.session.background) {
      this.endSession();
      this.session = new Session(this, { background: true, seed: this.worldSeed, startMinutes: 18 * 60 + 20 });
    }
    if (this.player) this.player.enabled = false;
    this.cam.mode = 'cinematic';
    this.audio.playMusic('menu');
  }

  endSession() {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    if (this.player) {
      this.player.enabled = false;
      this.playerCrowd.begin();
      this.playerCrowd.end();
    }
  }

  newSession(startMinutes: number) {
    this.endSession();
    this.session = new Session(this, { background: false, seed: this.worldSeed, startMinutes });
    this.mode = 'game';
    this.audio.playMusic('none');
    return this.session;
  }

  spawnPlayer(look: HumanLook, x: number, y: number, z: number, yaw: number) {
    if (!this.physics) return;
    if (!this.player) this.player = new PlayerController(this.physics, look, this.playerCrowd, x, y, z);
    this.player.look = look;
    this.player.enabled = true;
    this.player.teleport(x, y, z, yaw);
    this.cam.mode = 'foot';
    this.cam.yaw = yaw;
    this.cam.pitch = 0.2;
    this.cam.snap();
  }

  // ------------------------------------------------------------------ loop
  update(dt: number) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.1);
    this.time += dt;
    G.uTime.value = this.time;
    if (!this.city || !this.env || !this.physics) {
      this.input.endFrame();
      return;
    }
    const s = this.session;
    if (this.mode === 'menu') this.updateMenuCamera(dt);
    const ts = performance.now();
    if (s) s.update(dt);
    this.simMs = performance.now() - ts;
    for (const fn of this.updaters) fn(dt);

    const hour = s ? s.clock.hour : 12;
    const weather = s ? s.weather.p : { cloud: 0.2, rain: 0, fog: 0, wet: 0, wind: 0.2, storm: 0, flash: 0 };
    const focus = s && s.mode !== 'none' ? s.playerPos() : this.focus;
    this.env.update(this.renderer, hour, weather, this.camera.position, focus, dt);
    this.chunks?.update(this.camera.position.x, this.camera.position.z, this.time);
    if (this.rain) this.rain.update(dt, this.camera.position, weather.rain * (s?.mode === 'interior' ? 0 : 1), weather.wind);

    // audio ambience
    if (this.audio.ready && s) {
      const peds = s.peds.peds.length;
      this.audio.updateAmbience(dt, {
        traffic: Math.min(1, s.traffic.vehicles.length / 50),
        rain: weather.rain,
        wind: weather.wind,
        crowd: peds,
        day: 1 - G.uNight.value,
        interior: s.mode === 'interior',
        park: 0,
      });
      if (s.driving) {
        const d = s.driving;
        const thr = this.input.down('KeyW') || this.input.down('KeyS') ? 1 : 0;
        this.audio.engine(d.rpm, thr, d.speed, d.spec.mass > 2300);
      }
    }

    this.input.endFrame();
    // fps from wall-clock time (dt is clamped for simulation stability)
    this.frames++;
    const now = performance.now();
    if (!this.fpsTimer) this.fpsTimer = now;
    if (now - this.fpsTimer >= 500) {
      this.fps = (this.frames * 1000) / (now - this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = now;
    }
    this.lastFrameMs = performance.now() - t0;
    this.perfTimer -= dt;
    if (this.perfTimer <= 0) {
      this.perfTimer = 0.25;
      this.publishPerf();
    }
  }

  /** Advance the simulation without rendering (used by automated tests). */
  simulate(seconds: number, dt = 1 / 30) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) this.update(dt);
  }

  afterRender() {
    if (!this.renderer) return;
    const info = this.renderer.info;
    this.lastDraws = info.render.calls;
    this.lastTris = info.render.triangles;
    info.reset();
  }

  private publishPerf() {
    const st = useStore.getState();
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    st.setPerf({
      ...st.perf,
      fps: Math.round(this.fps),
      frameMs: Math.round(this.lastFrameMs * 10) / 10,
      drawCalls: this.lastDraws,
      triangles: this.lastTris,
      loadedChunks: this.chunks?.stats.loaded ?? 0,
      detailChunks: this.chunks?.stats.detail ?? 0,
      memory: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      simMs: Math.round(this.simMs * 100) / 100,
      physicsBodies: this.physics?.world.bodies.len() ?? 0,
    });
  }

  private updateMenuCamera(dt: number) {
    if (!this.city) return;
    this.menuT += dt;
    const c = this.city.districtCenters.find((d) => d.id === 'downtown')!;
    const a = this.menuT * 0.03 + 0.6;
    const r = 250;
    const pos = new THREE.Vector3(c.x + Math.cos(a) * r, 78 + Math.sin(a * 0.7) * 22, c.z + Math.sin(a) * r);
    if (this.menuT < 0.2) this.camera.position.copy(pos);
    else this.camera.position.lerp(pos, 1 - Math.exp(-dt * 2));
    this.camera.lookAt(c.x, 32, c.z);
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.focus.set(c.x + Math.cos(a) * 120, 0, c.z + Math.sin(a) * 120);
  }
}

export const game = new Game();
