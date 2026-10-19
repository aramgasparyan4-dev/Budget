import * as THREE from 'three';
import { Physics, initRapier } from './Physics';
import { generateCity } from '../world/CityGenerator';
import type { CityData } from '../world/types';
import { ChunkManager } from '../render/ChunkManager';
import { Environment, WeatherParams } from '../render/Environment';
import { Terrain } from '../render/Terrain';
import { Rain } from '../render/Rain';
import type { Settings } from '../state/settings';

export type Progress = (p: number, text: string) => void;

const tick = () => new Promise((r) => setTimeout(r, 0));

/** The generated city and everything built from it: chunks, terrain, collision, sky and rain. Shared by both games. */
export class World {
  private constructor(
    readonly seed: number,
    readonly city: CityData,
    readonly chunks: ChunkManager,
    readonly terrain: Terrain,
    readonly physics: Physics,
    readonly env: Environment,
    readonly rain: Rain,
  ) {}

  static async load(scene: THREE.Scene, seed: number, settings: Settings, progress: Progress): Promise<World> {
    progress(0.02, 'Initialising physics');
    await initRapier();
    progress(0.06, 'Surveying the city');
    await tick();
    const city = generateCity(seed);
    progress(0.15, 'Laying roads and foundations');
    const chunks = new ChunkManager(city);
    scene.add(chunks.group);
    await chunks.init((p) => progress(0.15 + p * 0.55, 'Raising buildings'));
    progress(0.72, 'Shaping the hills');
    await tick();
    const terrain = new Terrain(seed, settings.graphics.vegetation);
    scene.add(terrain.group);
    progress(0.8, 'Building collision');
    await tick();
    const physics = new Physics();
    physics.buildCity(city, chunks.models, seed);
    const env = new Environment(scene);
    const rain = new Rain(settings.graphics.rainParticles);
    scene.add(rain.group);
    return new World(seed, city, chunks, terrain, physics, env, rain);
  }

  /** graphics settings that live in the world (the renderer and camera are passed in when available) */
  applySettings(s: Settings, renderer?: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera) {
    const g = s.graphics;
    this.env.drawDistance = g.drawDistance;
    this.env.setShadowQuality(g.shadows || 1024, g.shadowExtent, g.shadows > 0);
    if (renderer) {
      renderer.shadowMap.enabled = g.shadows > 0;
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    this.chunks.detailRadius = g.detailRadius;
    if (this.chunks.vegetation !== g.vegetation) {
      this.chunks.vegetation = g.vegetation;
      this.chunks.reloadDetails();
    }
    this.chunks.setShadows(g.shadows > 0);
    if (camera) {
      camera.far = g.drawDistance + 400;
      camera.near = 0.25;
      camera.updateProjectionMatrix();
    }
    this.rain.setCount(g.rainParticles);
  }

  /** per-frame: sky, light, fog, chunk streaming around the camera and rain */
  update(renderer: THREE.WebGLRenderer, camera: THREE.Camera, dt: number, time: number, hour: number, weather: WeatherParams, focus: THREE.Vector3, rainScale = 1) {
    this.env.update(renderer, hour, weather, camera.position, focus, dt);
    this.chunks.update(camera.position.x, camera.position.z, time);
    this.rain.update(dt, camera.position, weather.rain * rainScale, weather.wind);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.chunks.group);
    this.chunks.dispose();
    scene.remove(this.terrain.group);
    this.terrain.dispose();
    scene.remove(this.rain.group);
    this.env.dispose();
    this.physics.dispose();
  }
}
