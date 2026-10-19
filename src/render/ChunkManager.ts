import * as THREE from 'three';
import type { CityData, Prop, PropType } from '../world/types';
import { buildChunkBase, buildChunkDetail, ChunkBase, ChunkDetail } from '../world/chunkGeometry';
import { buildPropModels, PropModel, toBufferGeometry } from './propModels';
import {
  createBuildingMaterial,
  createGroundMaterial,
  createPropMaterial,
  createLightPoolMaterial,
  createGlowMaterial,
} from './materials';
import { hash01 } from '../core/rng';

interface ChunkState {
  id: number;
  base: THREE.Mesh[];
  baseLoaded: boolean;
  detail: THREE.Group | null;
  detailState: 'none' | 'loading' | 'loaded';
  signalLamps: THREE.InstancedMesh | null;
  signalRefs: { inter: number; axis: 'v' | 'h' }[];
  lastNeeded: number;
}

export interface ChunkHooks {
  onDetailLoaded?: (chunk: number, group: THREE.Group) => void;
  onDetailUnloaded?: (chunk: number) => void;
  signalColor?: (inter: number, axis: 'v' | 'h') => 0 | 1 | 2 | 3; // 0 green 1 yellow 2 red 3 dark
}

const SIGNAL_COLORS = [
  new THREE.Color(0.1, 2.6, 0.9),
  new THREE.Color(3.0, 1.8, 0.1),
  new THREE.Color(3.2, 0.12, 0.08),
];
const SIGNAL_OFF = new THREE.Color(0.05, 0.05, 0.05);

export class ChunkManager {
  group = new THREE.Group();
  chunks: ChunkState[] = [];
  private worker: Worker | null = null;
  private pending = new Map<string, (d: unknown) => void>();
  private propsByChunk = new Map<number, Prop[]>();
  private signalsByChunk = new Map<number, CityData['signals']>();
  readonly models: Record<PropType, PropModel | null>;
  readonly mats = {
    building: createBuildingMaterial(),
    ground: createGroundMaterial(false),
    overlay: createGroundMaterial(true),
    marking: createGroundMaterial(true),
    prop: createPropMaterial(),
    detail: createPropMaterial({ emissiveDay: 0.25, emissiveNight: 2.2 }),
    pool: createLightPoolMaterial(),
    glow: createGlowMaterial(false),
  };
  private signalHousing: THREE.BufferGeometry;
  private signalLamp: THREE.BufferGeometry;
  private poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  detailRadius = 320;
  shadows = true;
  vegetation = 1;
  private loadQueue: number[] = [];
  private building = false;
  hooks: ChunkHooks = {};
  stats = { loaded: 0, detail: 0 };

  constructor(public city: CityData) {
    this.group.name = 'city';
    this.models = buildPropModels();
    for (const ch of city.chunks) {
      this.chunks.push({ id: ch.id, base: [], baseLoaded: false, detail: null, detailState: 'none', signalLamps: null, signalRefs: [], lastNeeded: 0 });
    }
    for (const p of city.props) {
      let arr = this.propsByChunk.get(p.chunk);
      if (!arr) this.propsByChunk.set(p.chunk, (arr = []));
      arr.push(p);
    }
    for (const s of city.signals) {
      let arr = this.signalsByChunk.get(s.chunk);
      if (!arr) this.signalsByChunk.set(s.chunk, (arr = []));
      arr.push(s);
    }
    this.signalHousing = new THREE.BoxGeometry(0.42, 1.25, 0.3);
    // three lamp discs stacked, facing +z
    const lamp = new THREE.CircleGeometry(0.13, 12);
    lamp.translate(0, 0, 0.16);
    this.signalLamp = lamp;
    this.mats.marking.polygonOffsetFactor = -3;
    this.mats.marking.polygonOffsetUnits = -6;
    try {
      this.worker = new Worker(new URL('../world/chunk.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.onWorker(e.data);
      this.worker.onerror = (e) => {
        console.warn('[chunks] worker failed, falling back to main thread', e.message);
        this.worker = null;
        for (const [, res] of this.pending) res(null);
        this.pending.clear();
      };
    } catch (err) {
      console.warn('[chunks] no worker support', err);
      this.worker = null;
    }
  }

  private onWorker(msg: { type: string; data?: ChunkBase | ChunkDetail; seed?: number }) {
    if (msg.type === 'ready') {
      this.pending.get('ready')?.(true);
      this.pending.delete('ready');
      return;
    }
    const d = msg.data!;
    const key = `${msg.type}:${d.chunk}`;
    const res = this.pending.get(key);
    if (res) {
      this.pending.delete(key);
      res(d);
    }
  }

  private request<T>(type: 'base' | 'detail', chunk: number): Promise<T> {
    if (!this.worker) {
      return Promise.resolve((type === 'base' ? buildChunkBase(this.city, chunk) : buildChunkDetail(this.city, chunk)) as T);
    }
    return new Promise<T>((resolve) => {
      this.pending.set(`${type}:${chunk}`, (d) => {
        if (d === null) resolve((type === 'base' ? buildChunkBase(this.city, chunk) : buildChunkDetail(this.city, chunk)) as T);
        else resolve(d as T);
      });
      this.worker!.postMessage({ type, chunk });
    });
  }

  async init(onProgress?: (p: number) => void) {
    if (this.worker) {
      await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => {
          console.warn('[chunks] worker init timeout, using main thread');
          this.worker?.terminate();
          this.worker = null;
          resolve(false);
        }, 15000);
        this.pending.set('ready', (v) => {
          clearTimeout(t);
          resolve(v as boolean);
        });
        this.worker!.postMessage({ type: 'init', seed: this.city.seed });
      });
    }
    let done = 0;
    const total = this.chunks.length;
    await Promise.all(
      this.chunks.map(async (c) => {
        const base = await this.request<ChunkBase>('base', c.id);
        this.applyBase(c, base);
        done++;
        onProgress?.(done / total);
      }),
    );
  }

  private applyBase(c: ChunkState, d: ChunkBase) {
    const add = (g: ChunkBase['buildings'], mat: THREE.Material, cast: boolean, recv: boolean, order = 0) => {
      if (!g) return;
      const mesh = new THREE.Mesh(toBufferGeometry(g), mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = recv;
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      c.base.push(mesh);
    };
    add(d.buildings, this.mats.building, true, true);
    add(d.ground, this.mats.ground, false, true);
    add(d.overlay, this.mats.overlay, false, true, 1);
    c.baseLoaded = true;
    this.stats.loaded++;
  }

  private chunkDist(id: number, x: number, z: number) {
    const ch = this.city.chunks[id];
    const dx = Math.max(ch.x0 - x, 0, x - ch.x1);
    const dz = Math.max(ch.z0 - z, 0, z - ch.z1);
    return Math.hypot(dx, dz);
  }

  update(x: number, z: number, now: number) {
    // queue detail loads
    for (const c of this.chunks) {
      const d = this.chunkDist(c.id, x, z);
      if (d < this.detailRadius) {
        c.lastNeeded = now;
        if (c.detailState === 'none' && !this.loadQueue.includes(c.id)) this.loadQueue.push(c.id);
      } else if (c.detailState === 'loaded' && d > this.detailRadius + 90) {
        this.unloadDetail(c);
      }
    }
    if (!this.building && this.loadQueue.length) {
      this.loadQueue.sort((a, b) => this.chunkDist(a, x, z) - this.chunkDist(b, x, z));
      const id = this.loadQueue.shift()!;
      const c = this.chunks[id];
      if (c.detailState === 'none') {
        c.detailState = 'loading';
        this.building = true;
        this.request<ChunkDetail>('detail', id).then((det) => {
          this.building = false;
          if (c.detailState !== 'loading') return;
          this.applyDetail(c, det);
        });
      }
    }
    // signal lamp colors
    if (this.hooks.signalColor) {
      const col = new THREE.Color();
      for (const c of this.chunks) {
        if (!c.signalLamps) continue;
        const lamps = c.signalLamps;
        for (let i = 0; i < c.signalRefs.length; i++) {
          const ref = c.signalRefs[i];
          const state = this.hooks.signalColor(ref.inter, ref.axis);
          for (let k = 0; k < 3; k++) {
            // k: 0 red (top), 1 yellow, 2 green (bottom)
            const on = (k === 0 && state === 2) || (k === 1 && state === 1) || (k === 2 && state === 0) || (state === 3 && k === 1 && Math.floor(now * 1.5) % 2 === 0);
            col.copy(on ? SIGNAL_COLORS[k === 0 ? 2 : k === 1 ? 1 : 0] : SIGNAL_OFF);
            lamps.setColorAt(i * 3 + k, col);
          }
        }
        if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
      }
    }
  }

  private unloadDetail(c: ChunkState) {
    if (c.detail) {
      this.group.remove(c.detail);
      c.detail.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
        if (m.isMesh && m.userData.ownGeometry) m.geometry.dispose();
      });
    }
    this.hooks.onDetailUnloaded?.(c.id);
    c.detail = null;
    c.signalLamps = null;
    c.signalRefs = [];
    c.detailState = 'none';
    this.stats.detail--;
  }

  private applyDetail(c: ChunkState, d: ChunkDetail) {
    const g = new THREE.Group();
    g.name = `chunk-detail-${c.id}`;
    if (d.markings) {
      const m = new THREE.Mesh(toBufferGeometry(d.markings), this.mats.marking);
      m.receiveShadow = true;
      m.renderOrder = 2;
      m.userData.ownGeometry = true;
      g.add(m);
    }
    if (d.details) {
      const m = new THREE.Mesh(toBufferGeometry(d.details), this.mats.detail);
      m.castShadow = this.shadows;
      m.receiveShadow = true;
      m.userData.ownGeometry = true;
      g.add(m);
    }
    // props grouped by type
    const props = this.propsByChunk.get(c.id) ?? [];
    const byType = new Map<PropType, Prop[]>();
    for (const p of props) {
      if (p.type === 'car') continue;
      if ((p.type === 'tree' || p.type === 'bush' || p.type === 'conifer' || p.type === 'palm') && this.vegetation < 1) {
        if (hash01(Math.floor(p.x * 10), Math.floor(p.z * 10)) > this.vegetation) continue;
      }
      let arr = byType.get(p.type);
      if (!arr) byType.set(p.type, (arr = []));
      arr.push(p);
    }
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const pools: { x: number; y: number; z: number; r: number }[] = [];
    for (const [type, list] of byType) {
      const model = this.models[type];
      if (!model) continue;
      const im = new THREE.InstancedMesh(model.geometry, this.mats.prop, list.length);
      im.castShadow = model.castShadow && this.shadows;
      im.receiveShadow = true;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        q.setFromAxisAngle(up, p.rot);
        s.setScalar(p.scale);
        pos.set(p.x, p.y, p.z);
        mtx.compose(pos, q, s);
        im.setMatrixAt(i, mtx);
        if (type === 'container') {
          const palette = [0xb03a2e, 0x1f618d, 0x117a65, 0xd68910, 0x6c3483, 0x7b7d7d, 0xa04000];
          col.setHex(palette[Math.floor(p.v * palette.length)]);
        } else if (type === 'tree' || type === 'bush' || type === 'palm' || type === 'conifer') {
          col.setRGB(0.85 + p.v * 0.3, 0.9 + p.v * 0.15, 0.8 + (1 - p.v) * 0.25);
        } else if (type === 'billboard') {
          const palette = [0xffffff, 0xff7ad9, 0x7af0ff, 0xfff07a, 0x9dff7a];
          col.setHex(palette[(p.ref ?? 0) % palette.length]);
        } else col.setRGB(1, 1, 1);
        im.setColorAt(i, col);
        if (model.lights) {
          for (const l of model.lights) {
            const c0 = Math.cos(p.rot);
            const s0 = Math.sin(p.rot);
            pools.push({ x: p.x + l.x * c0 + l.z * s0, y: 0.03, z: p.z - l.x * s0 + l.z * c0, r: l.r });
          }
        }
      }
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    if (pools.length) {
      const im = new THREE.InstancedMesh(this.poolGeo, this.mats.pool, pools.length);
      for (let i = 0; i < pools.length; i++) {
        const p = pools[i];
        mtx.makeScale(p.r * 2, 1, p.r * 2);
        mtx.setPosition(p.x, p.y + 0.16, p.z);
        im.setMatrixAt(i, mtx);
      }
      im.renderOrder = 5;
      im.computeBoundingSphere();
      g.add(im);
    }
    // traffic signal heads
    const sigs = this.signalsByChunk.get(c.id) ?? [];
    if (sigs.length) {
      const housing = new THREE.InstancedMesh(this.signalHousing, this.mats.prop, sigs.length);
      const lamps = new THREE.InstancedMesh(this.signalLamp, this.mats.glow, sigs.length * 3);
      housing.castShadow = this.shadows;
      for (let i = 0; i < sigs.length; i++) {
        const sg = sigs[i];
        q.setFromAxisAngle(up, sg.rot);
        s.setScalar(1);
        pos.set(sg.x, sg.y, sg.z);
        mtx.compose(pos, q, s);
        housing.setMatrixAt(i, mtx);
        housing.setColorAt(i, col.setRGB(0.12, 0.12, 0.12));
        for (let k = 0; k < 3; k++) {
          pos.set(sg.x, sg.y + 0.38 - k * 0.38, sg.z);
          mtx.compose(pos, q, s);
          lamps.setMatrixAt(i * 3 + k, mtx);
          lamps.setColorAt(i * 3 + k, SIGNAL_OFF);
        }
        c.signalRefs.push({ inter: sg.inter, axis: sg.axis });
      }
      housing.computeBoundingSphere();
      lamps.computeBoundingSphere();
      g.add(housing, lamps);
      c.signalLamps = lamps;
    }
    this.group.add(g);
    c.detail = g;
    c.detailState = 'loaded';
    this.stats.detail++;
    this.hooks.onDetailLoaded?.(c.id, g);
  }

  setShadows(on: boolean) {
    this.shadows = on;
    for (const c of this.chunks) {
      if (!c.detail) continue;
      c.detail.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.castShadow !== undefined && m.material !== this.mats.pool && m.material !== this.mats.marking) {
          if ((m as THREE.InstancedMesh).isInstancedMesh || m.userData.ownGeometry) m.castShadow = on && m.material !== this.mats.glow;
        }
      });
    }
  }

  /** Force reload of all detail chunks (e.g., after vegetation setting changes). */
  reloadDetails() {
    for (const c of this.chunks) if (c.detailState === 'loaded') this.unloadDetail(c);
  }

  dispose() {
    this.worker?.terminate();
    for (const c of this.chunks) if (c.detailState === 'loaded') this.unloadDetail(c);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
