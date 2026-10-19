import * as THREE from 'three';
import { MeshBuilder, addBox, addExtrude, addCylinder, lin, Xform } from './MeshBuilder';
import { toBufferGeometry } from './propModels';
import { VEHICLES, VehicleSpec } from '../sim/vehicles';
import { G } from './globals';

// Vehicle meshes: aMat 0 paint, 1 glass, 2 trim, 3 headlight, 4 taillight, 5 chrome, 6 sign (taxi), 7 police light
const VEH_LAYOUT = [
  { name: 'position', size: 3 },
  { name: 'normal', size: 3 },
  { name: 'color', size: 3 },
  { name: 'aEmit', size: 1 },
];

const TRIM = lin([0.06, 0.06, 0.065]);
const GLASS = lin([0.05, 0.07, 0.09]);
const CHROME = lin([0.7, 0.72, 0.75]);
const HEAD = lin([1, 0.97, 0.9]);
const TAIL = lin([0.75, 0.04, 0.03]);
const PLATE = lin([0.9, 0.9, 0.85]);

/** profile (x along length, y up) extruded across width, oriented so length runs along +z */
const ALONG: Xform = { tx: 0, ty: 0, tz: 0, ry: -Math.PI / 2 };

function body(b: MeshBuilder, spec: VehicleSpec, profile: [number, number][], cabin: [number, number][] | null, cabinInset = 0.12) {
  addExtrude(b, profile, spec.width, [1, 1, 1], ALONG, 0);
  if (cabin) addExtrude(b, cabin, spec.width - cabinInset * 2, GLASS, ALONG, 1);
}

function lights(b: MeshBuilder, spec: VehicleSpec, frontY: number, rearY: number, frontZ: number, rearZ: number) {
  const hw = spec.width / 2;
  for (const s of [-1, 1]) {
    addBox(b, s * (hw - 0.28), frontY, frontZ, 0.42, 0.13, 0.08, HEAD, undefined, 3);
    addBox(b, s * (hw - 0.22), rearY, rearZ, 0.36, 0.14, 0.08, TAIL, undefined, 4);
  }
  addBox(b, 0, frontY - 0.12, frontZ + 0.01, spec.width * 0.42, 0.18, 0.06, TRIM, undefined, 2);
  addBox(b, 0, rearY - 0.22, rearZ - 0.02, 0.5, 0.12, 0.03, PLATE, undefined, 2);
  addBox(b, 0, frontY - 0.32, frontZ + 0.05, spec.width * 0.96, 0.16, 0.14, TRIM, undefined, 2);
  addBox(b, 0, rearY - 0.38, rearZ - 0.05, spec.width * 0.96, 0.16, 0.14, TRIM, undefined, 2);
}

function mirrors(b: MeshBuilder, spec: VehicleSpec, y: number, z: number) {
  for (const s of [-1, 1]) addBox(b, s * (spec.width / 2 + 0.08), y, z, 0.16, 0.1, 0.14, TRIM, undefined, 2);
}

function wheelArches(b: MeshBuilder, spec: VehicleSpec) {
  const hw = spec.width / 2;
  for (const z of [spec.wheelBase / 2, -spec.wheelBase / 2])
    for (const s of [-1, 1]) addBox(b, s * (hw - 0.02), spec.wheelRadius + 0.12, z, 0.06, spec.wheelRadius * 0.9, spec.wheelRadius * 2.3, TRIM, undefined, 2);
}

function buildVehicle(spec: VehicleSpec): THREE.BufferGeometry {
  const b = new MeshBuilder(VEH_LAYOUT);
  const L = spec.length / 2;
  const r = spec.wheelRadius;
  const y0 = r * 0.9;
  switch (spec.key) {
    case 'compact': {
      body(b, spec, [[-L, y0], [L - 0.05, y0], [L, y0 + 0.3], [L - 0.25, y0 + 0.55], [L - 1.0, y0 + 0.68], [-L + 0.25, y0 + 0.72], [-L, y0 + 0.45]],
        [[L - 1.0, y0 + 0.68], [L - 1.7, y0 + 1.14], [-L + 0.5, y0 + 1.16], [-L + 0.15, y0 + 0.72]]);
      addBox(b, 0, y0 + 1.15, -0.2, spec.width - 0.3, 0.06, 1.6, [1, 1, 1], undefined, 0);
      lights(b, spec, y0 + 0.42, y0 + 0.5, L - 0.02, -L + 0.02);
      mirrors(b, spec, y0 + 0.78, L - 1.15);
      break;
    }
    case 'sedan':
    case 'taxi':
    case 'police': {
      body(b, spec, [[-L, y0], [L - 0.05, y0], [L, y0 + 0.24], [L - 0.15, y0 + 0.47], [L - 1.25, y0 + 0.6], [-L + 0.75, y0 + 0.64], [-L + 0.05, y0 + 0.56], [-L - 0.02, y0 + 0.3]],
        [[L - 1.25, y0 + 0.6], [L - 2.05, y0 + 1.06], [-L + 1.35, y0 + 1.08], [-L + 0.75, y0 + 0.64]]);
      addBox(b, 0, y0 + 1.07, -0.25, spec.width - 0.3, 0.06, 1.5, [1, 1, 1], undefined, 0);
      lights(b, spec, y0 + 0.36, y0 + 0.46, L - 0.02, -L + 0.02);
      mirrors(b, spec, y0 + 0.72, L - 1.4);
      if (spec.key === 'taxi') {
        addBox(b, 0, y0 + 1.22, -0.3, 0.9, 0.24, 0.3, lin([1.0, 0.95, 0.75]), undefined, 6);
        // checker stripe
        for (let k = 0; k < 8; k++) for (const s of [-1, 1]) addBox(b, s * (spec.width / 2 + 0.005), y0 + 0.45, -1.6 + k * 0.4, 0.01, 0.1, 0.2, k % 2 ? TRIM : [1, 1, 1], undefined, k % 2 ? 2 : 2);
      }
      if (spec.key === 'police') {
        addBox(b, -0.3, y0 + 1.2, -0.25, 0.55, 0.14, 0.32, lin([1, 0.1, 0.1]), undefined, 7);
        addBox(b, 0.3, y0 + 1.2, -0.25, 0.55, 0.14, 0.32, lin([0.1, 0.3, 1]), undefined, 8);
        for (const s of [-1, 1]) addBox(b, s * (spec.width / 2 + 0.005), y0 + 0.4, 0, 0.01, 0.42, 2.6, lin([0.95, 0.95, 0.95]), undefined, 2);
      }
      break;
    }
    case 'suv': {
      body(b, spec, [[-L, y0], [L - 0.05, y0], [L, y0 + 0.35], [L - 0.12, y0 + 0.66], [L - 1.1, y0 + 0.8], [-L + 0.05, y0 + 0.84], [-L - 0.02, y0 + 0.4]],
        [[L - 1.1, y0 + 0.8], [L - 1.75, y0 + 1.38], [-L + 0.2, y0 + 1.4], [-L + 0.05, y0 + 0.84]]);
      addBox(b, 0, y0 + 1.41, -0.5, spec.width - 0.28, 0.06, 2.6, [1, 1, 1], undefined, 0);
      for (const s of [-1, 1]) addBox(b, s * (spec.width / 2 - 0.2), y0 + 1.47, -0.5, 0.05, 0.05, 2.4, CHROME, undefined, 5);
      lights(b, spec, y0 + 0.52, y0 + 0.62, L - 0.02, -L + 0.02);
      mirrors(b, spec, y0 + 0.92, L - 1.25);
      break;
    }
    case 'sports': {
      body(b, spec, [[-L, y0 - 0.05], [L - 0.05, y0 - 0.05], [L + 0.02, y0 + 0.15], [L - 0.35, y0 + 0.36], [L - 1.6, y0 + 0.5], [-L + 0.4, y0 + 0.55], [-L, y0 + 0.4]],
        [[L - 1.6, y0 + 0.5], [L - 2.35, y0 + 0.86], [-L + 1.3, y0 + 0.84], [-L + 0.45, y0 + 0.55]], 0.18);
      addBox(b, 0, y0 + 0.86, -0.45, spec.width - 0.5, 0.05, 1.1, [1, 1, 1], undefined, 0);
      addBox(b, 0, y0 + 0.78, -L + 0.2, spec.width - 0.3, 0.05, 0.35, TRIM, undefined, 2);
      for (const s of [-1, 1]) addBox(b, s * 0.7, y0 + 0.68, -L + 0.25, 0.06, 0.18, 0.08, TRIM, undefined, 2);
      lights(b, spec, y0 + 0.2, y0 + 0.36, L - 0.04, -L + 0.02);
      mirrors(b, spec, y0 + 0.6, L - 1.75);
      break;
    }
    case 'van': {
      body(b, spec, [[-L, y0], [L - 0.05, y0], [L, y0 + 0.5], [L - 0.35, y0 + 0.9], [L - 1.1, y0 + 1.85], [-L + 0.02, y0 + 1.88], [-L - 0.02, y0 + 0.4]], null);
      // windshield + side windows
      addExtrude(b, [[L - 0.36, y0 + 0.95], [L - 1.0, y0 + 1.75], [L - 1.75, y0 + 1.75], [L - 1.75, y0 + 0.95]], spec.width + 0.02, GLASS, ALONG, 1);
      lights(b, spec, y0 + 0.62, y0 + 0.5, L - 0.04, -L + 0.02);
      mirrors(b, spec, y0 + 1.15, L - 1.0);
      // company stripe
      for (const s of [-1, 1]) addBox(b, s * (spec.width / 2 + 0.01), y0 + 1.1, -0.6, 0.01, 0.35, 3.2, lin([0.9, 0.45, 0.1]), undefined, 2);
      break;
    }
    case 'truck': {
      // cab
      addExtrude(b, [[L - 2.2, y0], [L - 0.05, y0], [L, y0 + 0.6], [L - 0.2, y0 + 1.3], [L - 0.6, y0 + 2.05], [L - 2.2, y0 + 2.08]], spec.width - 0.1, [1, 1, 1], ALONG, 0);
      addExtrude(b, [[L - 0.25, y0 + 1.35], [L - 0.62, y0 + 1.98], [L - 1.4, y0 + 1.98], [L - 1.4, y0 + 1.35]], spec.width - 0.08, GLASS, ALONG, 1);
      // cargo box
      addBox(b, 0, y0 + 1.55, -0.9, spec.width, 2.75, spec.length - 2.4, lin([0.92, 0.92, 0.9]), undefined, 2);
      addBox(b, 0, y0 + 0.15, -0.9, spec.width - 0.3, 0.3, spec.length - 2.4, TRIM, undefined, 2);
      lights(b, spec, y0 + 0.6, y0 + 0.35, L - 0.04, -L + 0.02);
      mirrors(b, spec, y0 + 1.5, L - 1.2);
      break;
    }
    case 'bus': {
      body(b, spec, [[-L, y0], [L - 0.05, y0], [L, y0 + 0.4], [L - 0.05, y0 + 2.5], [L - 0.3, y0 + 2.7], [-L + 0.1, y0 + 2.7], [-L, y0 + 2.5]], null);
      // window band
      addBox(b, 0, y0 + 1.75, -0.2, spec.width + 0.02, 1.05, spec.length - 1.6, GLASS, undefined, 1);
      addBox(b, 0, y0 + 1.5, L - 0.04, spec.width - 0.2, 1.6, 0.06, GLASS, undefined, 1);
      addBox(b, 0, y0 + 2.45, L - 0.03, 1.6, 0.25, 0.06, lin([1, 0.7, 0.2]), undefined, 6);
      lights(b, spec, y0 + 0.5, y0 + 0.6, L - 0.04, -L + 0.02);
      mirrors(b, spec, y0 + 2.0, L - 0.2);
      break;
    }
  }
  wheelArches(b, spec);
  return toBufferGeometry(b.build());
}

export function buildWheelGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder(VEH_LAYOUT);
  const rot: Xform = { tx: 0, ty: 0, tz: 0, ry: 0, rz: Math.PI / 2 };
  addCylinder(b, 0, -0.13, 0, 1, 1, 0.26, 16, lin([0.05, 0.05, 0.05]), rot, 2);
  addCylinder(b, 0, -0.135, 0, 0.62, 0.62, 0.27, 10, lin([0.55, 0.56, 0.58]), rot, 5);
  // hub spokes (visible rotation)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    addBox(b, 0.14, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.02, 0.5, 0.1, lin([0.3, 0.3, 0.32]), { tx: 0, ty: 0, tz: 0, ry: 0, rx: -a }, 5);
  }
  return toBufferGeometry(b.build());
}

let cache: THREE.BufferGeometry[] | null = null;
export function vehicleGeometries(): THREE.BufferGeometry[] {
  if (!cache) cache = VEHICLES.map((v) => buildVehicle(v));
  return cache;
}

// ---------------------------------------------------------------------------
const VEH_VERT_HEAD = /* glsl */ `
attribute float aEmit;
#ifdef USE_INSTANCING
attribute vec3 aPaint;
attribute vec4 aState;
#else
uniform vec3 uPaint;
uniform vec4 uState;
#endif
varying float vMatV;
varying vec3 vPaint;
varying vec4 vState;
`;
const VEH_VERT_MAIN = /* glsl */ `
vMatV = aEmit;
#ifdef USE_INSTANCING
vPaint = aPaint; vState = aState;
#else
vPaint = uPaint; vState = uState;
#endif
`;
const VEH_FRAG_HEAD = /* glsl */ `
varying float vMatV;
varying vec3 vPaint;
varying vec4 vState;
uniform float uTime;
uniform float uWet;
float vMat;
`;

export function createVehicleMaterial(instanced = true) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = G.uTime;
    shader.uniforms.uWet = G.uWet;
    if (!instanced) {
      shader.uniforms.uPaint = (m.userData.uPaint = m.userData.uPaint ?? { value: new THREE.Color(1, 0, 0) });
      shader.uniforms.uState = (m.userData.uState = m.userData.uState ?? { value: new THREE.Vector4() });
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VEH_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VEH_VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + VEH_FRAG_HEAD)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vMat = floor(vMatV + 0.5);
        if (vMat == 0.0) diffuseColor.rgb *= vPaint;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        if (vMat == 0.0) roughnessFactor = 0.22;
        else if (vMat == 1.0) roughnessFactor = 0.04;
        else if (vMat == 5.0) roughnessFactor = 0.18;
        else roughnessFactor = 0.6;`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        if (vMat == 0.0) metalnessFactor = 0.45;
        else if (vMat == 1.0) metalnessFactor = 0.9;
        else if (vMat == 5.0) metalnessFactor = 1.0;
        else metalnessFactor = 0.0;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vMat == 3.0) totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * (0.15 + vState.x * 5.0);
        if (vMat == 4.0) totalEmissiveRadiance += vec3(1.0, 0.05, 0.03) * (0.12 + vState.x * 1.2 + vState.y * 5.0);
        if (vMat == 6.0) totalEmissiveRadiance += vec3(1.0, 0.85, 0.35) * (0.4 + vState.x * 2.0);
        if (vMat == 7.0) totalEmissiveRadiance += vec3(1.0, 0.1, 0.1) * vState.z * step(0.5, fract(uTime * 2.0)) * 6.0;
        if (vMat == 8.0) totalEmissiveRadiance += vec3(0.1, 0.3, 1.0) * vState.z * step(0.5, fract(uTime * 2.0 + 0.5)) * 6.0;
        if (vMat == 4.0 && vState.w > 0.5) totalEmissiveRadiance += vec3(1.0, 0.45, 0.0) * step(0.5, fract(uTime * 1.6)) * 4.0;`,
      );
  };
  m.customProgramCacheKey = () => (instanced ? 'echo-veh-i' : 'echo-veh-s');
  return m;
}
