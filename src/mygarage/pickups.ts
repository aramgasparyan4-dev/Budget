// Free repairs on the road: a wrench floating in a column of light. Drive through it and the car
// gets back some condition. The game puts one ahead of a damaged car (on the street, the motorway
// or the race route); this file draws them and says when one has been collected.
import * as THREE from 'three';

export interface Pickup {
  x: number;
  z: number;
  /** seconds since it appeared (it grows in) */
  age: number;
  /** highway: where on the road it is (for the map and for knowing when it is behind you) */
  road?: { pathId: number; s: number };
}

/** condition a wrench gives back */
export const REPAIR_AMOUNT = 40;
/** metres from the car's centre that count as driving through it */
export const PICKUP_RADIUS = 3.2;

const BRAND = new THREE.Color(0x0077ff);

/** the outline of an open-ended wrench, about a metre tall, centred on the handle */
function wrenchGeometry() {
  const s = new THREE.Shape();
  const R = 0.22;
  const cy = 0.42;
  s.moveTo(-0.07, -0.5);
  s.lineTo(0.07, -0.5);
  s.lineTo(0.07, cy - Math.sqrt(R * R - 0.07 * 0.07));
  s.absarc(0, cy, R, Math.atan2(-Math.sqrt(R * R - 0.07 * 0.07), 0.07), Math.atan2(Math.sqrt(R * R - 0.06 * 0.06), 0.06), false);
  s.lineTo(0.06, cy + 0.06);
  s.lineTo(-0.06, cy + 0.06);
  s.lineTo(-0.06, cy + Math.sqrt(R * R - 0.06 * 0.06));
  s.absarc(0, cy, R, Math.PI - Math.atan2(Math.sqrt(R * R - 0.06 * 0.06), 0.06), Math.PI - Math.atan2(-Math.sqrt(R * R - 0.07 * 0.07), 0.07), false);
  s.lineTo(-0.07, -0.5);
  const hole = new THREE.Path();
  hole.absarc(0, -0.38, 0.04, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -0.035);
  return g;
}

/** a soft vertical fade for the light column (bright at the bottom) */
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Pickups {
  readonly group = new THREE.Group();
  items: Pickup[] = [];
  private wrench: THREE.BufferGeometry;
  private wrenchMat: THREE.MeshStandardMaterial;
  private beamGeo: THREE.CylinderGeometry;
  private beamMat: THREE.MeshBasicMaterial;
  private ringGeo: THREE.RingGeometry;
  private ringMat: THREE.MeshBasicMaterial;
  private shown: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'pickups';
    this.wrench = wrenchGeometry();
    this.wrenchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.6, emissive: BRAND, emissiveIntensity: 1.6 });
    this.beamGeo = new THREE.CylinderGeometry(0.75, 1.1, 26, 20, 1, true);
    this.beamGeo.translate(0, 13, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: BRAND.clone().multiplyScalar(1.4), map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.ringGeo = new THREE.RingGeometry(1.5, 1.9, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: BRAND.clone().multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    scene.add(this.group);
  }

  add(x: number, z: number, road?: Pickup['road']) {
    const p: Pickup = { x, z, age: 0, road };
    this.items.push(p);
    return p;
  }

  clear() {
    this.items.length = 0;
  }

  remove(p: Pickup) {
    const i = this.items.indexOf(p);
    if (i >= 0) this.items.splice(i, 1);
  }

  /** move with the highway when it is brought back toward its start */
  shift(dx: number, dz: number) {
    for (const p of this.items) {
      p.x += dx;
      p.z += dz;
    }
  }

  /** the one the car is driving through, if any */
  collect(x: number, z: number): Pickup | null {
    for (const p of this.items) {
      if (p.age > 0.2 && (p.x - x) ** 2 + (p.z - z) ** 2 < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.remove(p);
        return p;
      }
    }
    return null;
  }

  /** spin, bob and pulse; one scene group per pickup, reused */
  update(dt: number, time: number) {
    for (const p of this.items) p.age += dt;
    while (this.shown.length < this.items.length) {
      const g = new THREE.Group();
      const w = new THREE.Mesh(this.wrench, this.wrenchMat);
      w.scale.setScalar(1.7);
      w.rotation.z = -0.6;
      const spin = new THREE.Group();
      spin.add(w);
      spin.position.y = 1.5;
      const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
      beam.renderOrder = 3;
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
      ring.position.y = 0.06;
      ring.renderOrder = 3;
      g.add(spin, beam, ring);
      this.group.add(g);
      this.shown.push(g);
    }
    this.shown.forEach((g, i) => {
      const p = this.items[i];
      g.visible = !!p;
      if (!p) return;
      const grow = Math.min(1, p.age / 0.4);
      g.position.set(p.x, 0, p.z);
      g.scale.setScalar(0.4 + 0.6 * grow);
      const spin = g.children[0];
      spin.rotation.y = time * 2.4;
      spin.position.y = 1.5 + Math.sin(time * 2.8) * 0.18;
      const ring = g.children[2];
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 5));
    });
    this.ringMat.opacity = 0.55 + 0.3 * Math.sin(time * 5);
  }
}
