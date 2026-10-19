import * as THREE from 'three';
import { terrainHeight, TERRAIN_EXTENT, WATER_Y } from '../world/terrain';
import { PLATFORM } from '../world/CityGenerator';
import { G, GLSL_NOISE } from './globals';
import { RNG, fbm2 } from '../core/rng';
import { buildPropModels } from './propModels';
import { createPropMaterial } from './materials';
import { CURB_H } from '../world/types';

export class Terrain {
  group = new THREE.Group();
  forest: THREE.InstancedMesh[] = [];

  constructor(seed: number, vegetation: number) {
    this.group.name = 'terrain';
    this.group.add(this.buildTerrain(seed));
    this.group.add(this.buildWater());
    this.group.add(this.buildSeawall());
    this.buildForest(seed, vegetation);
  }

  private buildTerrain(seed: number) {
    const step = 20;
    const n = Math.round((TERRAIN_EXTENT * 2) / step);
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const H: number[] = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = -TERRAIN_EXTENT + i * step;
        const z = -TERRAIN_EXTENT + j * step;
        const inside = x > -PLATFORM && x < PLATFORM && z > -PLATFORM && z < PLATFORM;
        const h = inside ? -0.5 : terrainHeight(x, z, seed);
        H.push(h);
        pos.push(x, h, z);
      }
    }
    const hAt = (i: number, j: number) => H[Math.min(n, Math.max(0, j)) * (n + 1) + Math.min(n, Math.max(0, i))];
    const c = new THREE.Color();
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const h = hAt(i, j);
        const dx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * step);
        const dz = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * step);
        const slope = Math.hypot(dx, dz);
        const x = -TERRAIN_EXTENT + i * step;
        const z = -TERRAIN_EXTENT + j * step;
        const nz = fbm2(x / 90, z / 90, seed + 21, 3);
        // grass -> forest floor -> rock
        c.setRGB(0.1 + nz * 0.06, 0.17 + nz * 0.07, 0.06 + nz * 0.03);
        if (h > 70) c.lerp(new THREE.Color(0.2, 0.22, 0.12), Math.min(1, (h - 70) / 60));
        if (slope > 0.45) c.lerp(new THREE.Color(0.32, 0.3, 0.27), Math.min(1, (slope - 0.45) * 2.5));
        if (h < WATER_Y + 1.5) c.lerp(new THREE.Color(0.48, 0.43, 0.32), Math.min(1, (WATER_Y + 1.5 - h) / 2));
        if (h < WATER_Y - 2) c.setRGB(0.12, 0.13, 0.11);
        col.push(Math.pow(c.r, 2.2) * 3, Math.pow(c.g, 2.2) * 3, Math.pow(c.b, 2.2) * 3);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = -TERRAIN_EXTENT + i * step;
        const z0 = -TERRAIN_EXTENT + j * step;
        // skip cells fully inside the city platform
        if (x0 >= -PLATFORM && x0 + step <= PLATFORM && z0 >= -PLATFORM && z0 + step <= PLATFORM) continue;
        const a = j * (n + 1) + i;
        const b = a + 1;
        const cc = a + (n + 1);
        const d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTW;\n' + GLSL_NOISE)
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.78 + 0.32 * fbm(vTW.xz * 0.08) + 0.12 * vnoise(vTW.xz * 0.9);');
    };
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  private buildWater() {
    const g = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2 + 1600, TERRAIN_EXTENT * 2 + 1600, 1, 1).rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.012, 0.045, 0.06), roughness: 0.06, metalness: 0.0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = G.uTime;
      shader.uniforms.uRain = G.uRain;
      shader.uniforms.uWind = G.uWind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime; uniform float uRain; uniform float uWind;
          varying vec3 vWW;
          ${GLSL_NOISE}
          vec3 waveNormal(vec2 p) {
            vec2 g = vec2(0.0);
            float amp = 0.25 + uWind * 0.5;
            vec2 d1 = normalize(vec2(1.0, 0.35)); g += d1 * cos(dot(d1, p) * 0.35 + uTime * 1.1) * 0.06 * amp;
            vec2 d2 = normalize(vec2(-0.4, 1.0)); g += d2 * cos(dot(d2, p) * 0.6 + uTime * 1.5) * 0.04 * amp;
            vec2 d3 = normalize(vec2(0.7, -0.6)); g += d3 * cos(dot(d3, p) * 1.3 + uTime * 2.2) * 0.025 * amp;
            float e = 0.35;
            float n0 = vnoise(p * 0.9 + uTime * 0.3);
            float nx = vnoise((p + vec2(e, 0.0)) * 0.9 + uTime * 0.3);
            float nz = vnoise((p + vec2(0.0, e)) * 0.9 + uTime * 0.3);
            g += vec2(nx - n0, nz - n0) * (0.35 + uRain * 0.6);
            return normalize(vec3(-g.x, 1.0, -g.y));
          }`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          vec3 wn = waveNormal(vWW.xz);
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`,
        );
    };
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(PLATFORM + (TERRAIN_EXTENT + 800) - 2, WATER_Y, 0);
    mesh.position.x = 0;
    mesh.receiveShadow = false;
    mesh.name = 'water';
    // only the part east of the seawall matters; the city platform covers the rest
    return mesh;
  }

  private buildSeawall() {
    const g = new THREE.BoxGeometry(3, 14, PLATFORM * 2 + 40);
    const m = new THREE.MeshStandardMaterial({ color: 0x6e6a62, roughness: 0.9 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(PLATFORM - 0.5, CURB_H - 7, 0);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildForest(seed: number, vegetation: number) {
    const models = buildPropModels();
    const rng = new RNG(seed ^ 0xf0435);
    const pts: { x: number; z: number; h: number; s: number; r: number; k: number }[] = [];
    const target = Math.floor(3800 * vegetation);
    let guard = 0;
    while (pts.length < target && guard++ < target * 12) {
      const x = rng.range(-1700, 1700);
      const z = rng.range(-1700, 1700);
      if (x > -PLATFORM - 25 && x < PLATFORM + 25 && z > -PLATFORM - 25 && z < PLATFORM + 25) continue;
      const h = terrainHeight(x, z, seed);
      if (h < WATER_Y + 1.2) continue;
      const dens = fbm2(x / 260, z / 260, seed + 31, 3);
      if (rng.next() > dens * 1.4 - 0.15) continue;
      pts.push({ x, z, h, s: rng.range(0.9, 1.7), r: rng.range(0, 6.28), k: rng.next() < 0.6 ? 1 : 0 });
    }
    const mat = createPropMaterial();
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const kind of [0, 1]) {
      const list = pts.filter((p) => p.k === kind);
      const model = kind === 1 ? models.conifer! : models.tree!;
      const im = new THREE.InstancedMesh(model.geometry, mat, list.length);
      const col = new THREE.Color();
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.r);
        mtx.compose(new THREE.Vector3(p.x, p.h - 0.3, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
        im.setMatrixAt(i, mtx);
        im.setColorAt(i, col.setRGB(0.8 + rng.next() * 0.25, 0.85 + rng.next() * 0.2, 0.8));
      });
      im.computeBoundingSphere();
      im.castShadow = false;
      im.receiveShadow = true;
      this.forest.push(im);
      this.group.add(im);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
