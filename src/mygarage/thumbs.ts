// Pictures of the garage's cars, rendered from the same models the game drives, in their own paint
// (darkened by damage, as on the road), on a transparent background for the cards. Drawn once per
// car and condition with the game's own renderer, into an offscreen target.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useEffect, useState } from 'react';
import { VEHICLES } from '../sim/vehicles';
import { vehicleGeometries, buildWheelGeometry, createVehicleMaterial } from '../render/vehicleModels';
import { nm } from './DriveGame';

const W = 640;
const H = 320;
const DARK = new THREE.Color(0x1d1d1f);
const cache = new Map<string, string>();

let stage: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  body: THREE.Mesh;
  wheels: THREE.Mesh[];
  shadow: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  target: THREE.WebGLRenderTarget;
} | null = null;

function setup(renderer: THREE.WebGLRenderer) {
  if (stage) return stage;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-4, 7, 6);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0xbfc4cc, 0.6));
  const mat = createVehicleMaterial(false);
  mat.userData.uPaint = { value: new THREE.Color() };
  mat.userData.uState = { value: new THREE.Vector4() };
  const body = new THREE.Mesh(vehicleGeometries()[0], mat);
  scene.add(body);
  const wg = buildWheelGeometry();
  const wheels = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(wg, mat);
    scene.add(m);
    return m;
  });
  // a soft contact shadow under the car
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.42)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
  const target = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  stage = { scene, camera, body, wheels, shadow, mat, target };
  return stage;
}

/** a data URL of the car (null until the renderer exists) */
export function carThumb(type: number, paint: number, health = 100): string | null {
  const dmg = Math.round(Math.max(0, 100 - health) / 20);
  const key = `${type}:${paint}:${dmg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const renderer = nm.renderer as THREE.WebGLRenderer | undefined;
  if (!renderer || !nm.world) return null;
  const st = setup(renderer);
  const spec = VEHICLES[type];
  st.body.geometry = vehicleGeometries()[type];
  st.mat.userData.uPaint.value.setHex(paint).lerp(DARK, dmg * 0.2 * 0.55);
  const r = spec.wheelRadius;
  const pos: [number, number][] = [
    [spec.track / 2, spec.wheelBase / 2],
    [-spec.track / 2, spec.wheelBase / 2],
    [spec.track / 2, -spec.wheelBase / 2],
    [-spec.track / 2, -spec.wheelBase / 2],
  ];
  st.wheels.forEach((w, i) => {
    const [x, z] = pos[i];
    w.position.set(x, r, z);
    // front wheels turned a little, so the picture has some life
    w.rotation.set(0, (x < 0 ? Math.PI : 0) + (i < 2 ? 0.32 : 0), 0, 'YXZ');
    w.scale.set(0.85, r, r);
  });
  st.shadow.scale.set(spec.width * 1.6, spec.length * 1.25, 1);
  // three-quarter front view, framed to the car's size
  const size = Math.max(spec.length, spec.width * 2.1);
  const a = 0.78;
  const d = size * 2.15;
  st.camera.position.set(-Math.sin(a) * d, spec.height * 0.95 + size * 0.22, Math.cos(a) * d);
  st.camera.lookAt(0, spec.height * 0.42, 0);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(st.target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(st.scene, st.camera);
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(st.target, 0, 0, W, H, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const img = c.getContext('2d')!.createImageData(W, H);
  // the target is bottom-up
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  c.getContext('2d')!.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** the picture for a car, once the game can draw it */
export function useCarThumb(type: number, paint: number, health = 100) {
  const [url, setUrl] = useState(() => carThumb(type, paint, health));
  useEffect(() => {
    let raf = 0;
    const go = () => {
      const u = carThumb(type, paint, health);
      if (u) setUrl(u);
      else raf = requestAnimationFrame(go);
    };
    go();
    return () => cancelAnimationFrame(raf);
  }, [type, paint, health]);
  return url;
}
