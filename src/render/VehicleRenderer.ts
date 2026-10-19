import * as THREE from 'three';
import { VEHICLES } from '../sim/vehicles';
import { vehicleGeometries, buildWheelGeometry, createVehicleMaterial } from './vehicleModels';
import { G } from './globals';

export interface VehicleDrawable {
  type: number;
  x: number;
  y?: number;
  z: number;
  yaw: number;
  pitch?: number;
  roll?: number;
  paint: THREE.Color;
  /** headlights, brake, police lights, hazard */
  head: number;
  brake: number;
  siren?: number;
  hazard?: number;
  wheelRot: number;
  steer: number;
  /** per-wheel suspension offsets (fl, fr, rl, rr) */
  susp?: [number, number, number, number];
}

/** Batched instanced rendering of all vehicles (traffic + parked) by type. */
export class VehicleRenderer {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private paint: THREE.InstancedBufferAttribute[] = [];
  private state: THREE.InstancedBufferAttribute[] = [];
  private counts: number[] = [];
  private wheels: THREE.InstancedMesh;
  private wheelCount = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private wq = new THREE.Quaternion();
  private tmpM = new THREE.Matrix4();
  readonly capacity: number;
  /** additive headlight cones + ground pools at night */
  private pools: THREE.InstancedMesh;
  private poolCount = 0;

  constructor(capacity = 160, private material = createVehicleMaterial(true)) {
    this.capacity = capacity;
    const geos = vehicleGeometries();
    for (let t = 0; t < geos.length; t++) {
      const g = geos[t].clone();
      const pa = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      const st = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      pa.setUsage(THREE.DynamicDrawUsage);
      st.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aPaint', pa);
      g.setAttribute('aState', st);
      const im = new THREE.InstancedMesh(g, material, capacity);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      this.meshes.push(im);
      this.paint.push(pa);
      this.state.push(st);
      this.counts.push(0);
      this.group.add(im);
    }
    this.wheels = new THREE.InstancedMesh(buildWheelGeometry(), createVehicleMaterial(true), capacity * 6);
    const wg = this.wheels.geometry;
    wg.setAttribute('aPaint', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 6 * 3).fill(1), 3));
    wg.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 6 * 4), 4));
    this.wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wheels.castShadow = true;
    this.wheels.frustumCulled = false;
    this.wheels.count = 0;
    this.group.add(this.wheels);
    // headlight pools on the road
    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 128;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 120, 4, 32, 70, 70);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const poolMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.0, 0.92, 0.75),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });
    poolMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = G.uNight;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uNight * 0.6;');
    };
    this.pools = new THREE.InstancedMesh(poolGeo, poolMat, capacity);
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 6;
    this.pools.count = 0;
    this.group.add(this.pools);
  }

  begin() {
    for (let t = 0; t < this.counts.length; t++) this.counts[t] = 0;
    this.wheelCount = 0;
    this.poolCount = 0;
  }

  push(d: VehicleDrawable) {
    const t = d.type;
    const i = this.counts[t];
    if (i >= this.capacity) return;
    this.counts[t]++;
    const spec = VEHICLES[t];
    const y = d.y ?? 0;
    this.e.set(d.pitch ?? 0, d.yaw, d.roll ?? 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(d.x, y, d.z);
    this.m.compose(this.p, this.q, this.s);
    this.meshes[t].setMatrixAt(i, this.m);
    this.paint[t].setXYZ(i, d.paint.r, d.paint.g, d.paint.b);
    this.state[t].setXYZW(i, d.head, d.brake, d.siren ?? 0, d.hazard ?? 0);
    // wheels
    const r = spec.wheelRadius;
    const hb = spec.wheelBase / 2;
    const ht = spec.track / 2;
    const wpos: [number, number, number][] = [
      [ht, r, hb],
      [-ht, r, hb],
      [ht, r, -hb],
      [-ht, r, -hb],
    ];
    for (let k = 0; k < 4; k++) {
      if (this.wheelCount >= this.capacity * 6) break;
      const [lx, ly, lz] = wpos[k];
      const sus = d.susp ? d.susp[k] : 0;
      this.p.set(lx, ly + sus, lz).applyMatrix4(this.m);
      const steer = k < 2 ? d.steer : 0;
      this.wq.setFromEuler(new THREE.Euler(d.wheelRot, steer + (lx < 0 ? Math.PI : 0), 0, 'YXZ'));
      const wq = this.q.clone().multiply(this.wq);
      // mirrored wheels spin opposite when rotated by PI
      if (lx < 0) {
        this.wq.setFromEuler(new THREE.Euler(-d.wheelRot, steer + Math.PI, 0, 'YXZ'));
        wq.copy(this.q).multiply(this.wq);
      }
      this.tmpM.compose(this.p, wq, this.s.set(0.85, r, r));
      this.s.set(1, 1, 1);
      this.wheels.setMatrixAt(this.wheelCount++, this.tmpM);
    }
    // night headlight pool
    if (d.head > 0.5 && this.poolCount < this.capacity) {
      const fx = Math.sin(d.yaw);
      const fz = Math.cos(d.yaw);
      const dist = spec.length / 2 + 7;
      this.p.set(d.x + fx * dist, 0.06, d.z + fz * dist);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw + Math.PI);
      this.tmpM.compose(this.p, this.q, new THREE.Vector3(spec.width * 2.4, 1, 14));
      this.pools.setMatrixAt(this.poolCount++, this.tmpM);
    }
  }

  end() {
    for (let t = 0; t < this.meshes.length; t++) {
      const im = this.meshes[t];
      im.count = this.counts[t];
      im.instanceMatrix.needsUpdate = true;
      this.paint[t].needsUpdate = true;
      this.state[t].needsUpdate = true;
    }
    this.wheels.count = this.wheelCount;
    this.wheels.instanceMatrix.needsUpdate = true;
    this.pools.count = this.poolCount;
    this.pools.instanceMatrix.needsUpdate = true;
  }
}
