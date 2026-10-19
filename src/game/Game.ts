import * as THREE from 'three';
import { Input } from '../engine/Input';
import { Physics, initRapier } from '../engine/Physics';
import { generateCity } from '../world/CityGenerator';
import type { CityData } from '../world/types';
import { ChunkManager } from '../render/ChunkManager';
import { Environment, WeatherParams } from '../render/Environment';
import { Terrain } from '../render/Terrain';
import { G } from '../render/globals';
import { CameraController } from './CameraController';
import { PlayerController } from './PlayerController';
import { Crowd, buildHumanGeometry, createHumanMaterial, createHumanDepthMaterial, HumanLook } from '../render/Human';
import { useStore } from '../state/store';
import { Clock } from '../sim/Clock';
import type { Settings } from '../state/settings';

export const DEFAULT_SEED = 20261019;

export class Game {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  input = new Input();
  cam!: CameraController;
  attached = false;

  city: CityData | null = null;
  physics: Physics | null = null;
  chunks: ChunkManager | null = null;
  env: Environment | null = null;
  terrain: Terrain | null = null;
  clock = new Clock(8 * 60 + 30);
  player: PlayerController | null = null;
  humanGeo = buildHumanGeometry('high');
  humanGeoLow = buildHumanGeometry('low');
  humanMat = createHumanMaterial();
  humanDepth = createHumanDepthMaterial();
  playerCrowd = new Crowd(1, this.humanGeo, this.humanMat, this.humanDepth);
  worldSeed = -1;

  mode: 'none' | 'menu' | 'game' = 'none';
  paused = false;
  weather: WeatherParams = { cloud: 0.25, rain: 0, fog: 0, wet: 0, wind: 0.25, storm: 0, flash: 0 };
  time = 0;
  private menuT = 0;
  private uiTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 60;
  private lastFrameMs = 16;
  focus = new THREE.Vector3();
  /** systems that want a per-frame callback (registered by later modules) */
  private updaters: ((dt: number) => void)[] = [];

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
  }

  onUpdate(fn: (dt: number) => void) {
    this.updaters.push(fn);
  }

  get settings(): Settings {
    return useStore.getState().settings;
  }

  async loadWorld(seed: number, progress: (p: number, t: string) => void) {
    if (this.worldSeed === seed && this.city) return;
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
    this.clock.scale = s.gameplay.timeScale;
  }

  startMenu() {
    this.mode = 'menu';
    this.menuT = 0;
    if (this.player) this.player.enabled = false;
    this.cam.mode = 'cinematic';
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

  update(dt: number) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.1);
    this.time += dt;
    G.uTime.value = this.time;
    if (!this.city || !this.env || !this.physics) {
      this.input.endFrame();
      return;
    }
    const inUI = useStore.getState().overlay !== null;
    const playing = this.mode === 'game' && !this.paused;
    if (playing) this.clock.advance(dt);

    // player & physics
    const p = this.player;
    if (this.mode === 'game' && p && !this.paused) {
      this.cam.handleMouse(this.input, !inUI);
      this.physics.advance(dt, (h) => p.fixedUpdate(h, this.input, this.cam.yaw, !inUI));
      p.update(dt);
      this.focus.copy(p.renderPos);
      this.cam.update(dt, p.renderPos, this.physics);
    } else if (this.mode === 'menu') {
      this.updateMenuCamera(dt);
    }

    for (const fn of this.updaters) fn(dt);

    // environment & streaming
    this.env.update(this.renderer, this.clock.hour, this.weather, this.camera.position, this.focus, dt);
    this.chunks?.update(this.camera.position.x, this.camera.position.z, this.time);

    this.input.endFrame();
    // perf / HUD publishing at 8 Hz
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = this.frames / this.fpsTimer;
      this.frames = 0;
      this.fpsTimer = 0;
    }
    this.lastFrameMs = performance.now() - t0;
    this.uiTimer += dt;
    if (this.uiTimer > 0.125) {
      this.uiTimer = 0;
      this.publish();
    }
  }

  /** Called after the frame is rendered so draw-call stats are complete. */
  afterRender() {
    if (!this.renderer) return;
    const info = this.renderer.info;
    this.lastDraws = info.render.calls;
    this.lastTris = info.render.triangles;
    info.reset();
  }
  private lastDraws = 0;
  private lastTris = 0;

  private publish() {
    const st = useStore.getState();
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    st.setPerf({
      fps: Math.round(this.fps),
      frameMs: Math.round(this.lastFrameMs * 10) / 10,
      drawCalls: this.lastDraws,
      triangles: this.lastTris,
      activeNpcs: 0,
      simulatedNpcs: 0,
      loadedChunks: this.chunks?.stats.loaded ?? 0,
      detailChunks: this.chunks?.stats.detail ?? 0,
      activeVehicles: 0,
      memory: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      simMs: 0,
      physicsBodies: this.physics?.world.bodies.len() ?? 0,
    });
    st.setHud({ time: this.clock.label(), day: this.clock.day, weekday: this.clock.weekdayName, hour: this.clock.hour });
  }

  private updateMenuCamera(dt: number) {
    if (!this.city) return;
    this.menuT += dt;
    const c = this.city.districtCenters.find((d) => d.id === 'downtown')!;
    const a = this.menuT * 0.035;
    const r = 260;
    const pos = new THREE.Vector3(c.x + Math.cos(a) * r, 95 + Math.sin(a * 0.7) * 25, c.z + Math.sin(a) * r);
    this.camera.position.lerp(pos, this.menuT < 0.2 ? 1 : 1 - Math.exp(-dt * 2));
    this.camera.lookAt(c.x, 30, c.z);
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.focus.set(c.x, 0, c.z);
  }
}

export const game = new Game();
