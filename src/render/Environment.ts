import * as THREE from 'three';
import { G, GLSL_NOISE } from './globals';
import { clamp, lerp, smoothstep } from '../core/math';

export interface WeatherParams {
  cloud: number; // 0..1 coverage
  rain: number; // 0..1
  fog: number; // 0..1 extra fog
  wet: number; // 0..1 surface wetness
  wind: number; // 0..1
  storm: number; // 0..1 darkness
  flash: number; // lightning flash 0..1
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uFog;
uniform float uFogAmt;
uniform float uCloud;
uniform float uStorm;
uniform float uTime;
uniform float uStars;
uniform float uFlash;
uniform float uNight;
varying vec3 vDir;
${GLSL_NOISE}
float fbm5(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float t = pow(clamp(y, 0.0, 1.0), 0.42);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uGround, smoothstep(0.0, -0.12, y));
  float sd = max(dot(d, uSunDir), 0.0);
  float sunUp = smoothstep(-0.12, 0.04, uSunDir.y);
  float clearSky = 1.0 - uCloud * 0.85;
  col += uSunColor * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.55) * sunUp * clearSky;
  col += uSunColor * smoothstep(0.99935, 0.99965, sd) * 22.0 * sunUp * (1.0 - uCloud * 0.95);
  // stars
  if (uStars > 0.01 && y > 0.0) {
    vec3 sp = d * 260.0;
    vec3 cell = floor(sp);
    float h = h12(cell.xy + cell.z * 17.13);
    float r = length(fract(sp) - 0.5);
    float star = step(0.9955, h) * (1.0 - smoothstep(0.08, 0.3, r));
    float tw = 0.65 + 0.35 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
    col += vec3(0.9, 0.95, 1.0) * star * tw * uStars * 3.0 * (1.0 - uCloud) * smoothstep(0.0, 0.25, y);
  }
  // moon
  float md = dot(d, uMoonDir);
  float moonDisc = smoothstep(0.99905, 0.9994, md);
  col += vec3(1.0, 0.97, 0.9) * moonDisc * 3.5 * uNight * (1.0 - uCloud * 0.8);
  col += vec3(0.25, 0.3, 0.45) * pow(max(md, 0.0), 24.0) * 0.35 * uNight;
  // clouds
  if (y > -0.02) {
    vec2 cp = d.xz / (max(y, 0.0) + 0.28) * 0.75 + vec2(uTime * 0.008, uTime * 0.003);
    float n = fbm5(cp);
    float n2 = fbm5(cp * 2.3 + 5.0);
    float thr = mix(0.66, 0.2, uCloud);
    float c = smoothstep(thr, thr + 0.22, n * 0.75 + n2 * 0.25);
    c *= smoothstep(0.02, 0.32, y);
    float lit = 0.55 + 0.45 * pow(sd, 3.0) * sunUp;
    float dens = smoothstep(thr, thr + 0.6, n);
    vec3 cTop = mix(uHorizon * 1.15 + uSunColor * 0.25 * sunUp, vec3(1.0), 0.35 * sunUp);
    vec3 cBot = mix(uZenith, uHorizon, 0.5) * 0.55;
    vec3 cloudCol = mix(cTop, cBot, dens * 0.8) * lit;
    cloudCol = mix(cloudCol, cloudCol * vec3(0.35, 0.37, 0.42), uStorm);
    cloudCol += uFlash * vec3(1.6, 1.7, 2.0) * (0.4 + dens);
    col = mix(col, cloudCol, c * (0.7 + 0.3 * uCloud));
  }
  col = mix(col, uFog, uFogAmt * (1.0 - smoothstep(-0.05, 0.3, y)));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function c3(r: number, g: number, b: number) {
  return new THREE.Color(r, g, b);
}
// Sky keyframes by sun elevation (sin)
const KEYS: { e: number; zen: THREE.Color; hor: THREE.Color; sun: THREE.Color; light: number; amb: number }[] = [
  { e: -1.0, zen: c3(0.003, 0.006, 0.016), hor: c3(0.018, 0.024, 0.045), sun: c3(0.0, 0.0, 0.0), light: 0, amb: 0.14 },
  { e: -0.18, zen: c3(0.005, 0.01, 0.03), hor: c3(0.03, 0.035, 0.06), sun: c3(0.3, 0.12, 0.05), light: 0, amb: 0.16 },
  { e: -0.06, zen: c3(0.03, 0.05, 0.13), hor: c3(0.42, 0.2, 0.12), sun: c3(1.0, 0.35, 0.12), light: 0.0, amb: 0.3 },
  { e: 0.04, zen: c3(0.1, 0.18, 0.4), hor: c3(1.0, 0.5, 0.24), sun: c3(1.0, 0.48, 0.2), light: 1.2, amb: 0.55 },
  { e: 0.18, zen: c3(0.09, 0.22, 0.58), hor: c3(0.75, 0.62, 0.5), sun: c3(1.0, 0.78, 0.55), light: 2.6, amb: 0.8 },
  { e: 0.45, zen: c3(0.07, 0.2, 0.62), hor: c3(0.42, 0.58, 0.82), sun: c3(1.0, 0.94, 0.86), light: 3.3, amb: 0.95 },
  { e: 1.0, zen: c3(0.06, 0.19, 0.6), hor: c3(0.4, 0.56, 0.8), sun: c3(1.0, 0.97, 0.92), light: 3.6, amb: 1.0 },
];

export class Environment {
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  sun = new THREE.DirectionalLight(0xffffff, 3);
  hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3328, 0.6);
  fog = new THREE.FogExp2(0x9ab0c8, 0.002);
  sunDir = new THREE.Vector3();
  moonDir = new THREE.Vector3();
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private skyScene = new THREE.Scene();
  private lastEnvHour = -99;
  private lastEnvCloud = -1;
  private envTimer = 0;
  shadowSize = 90;
  drawDistance = 600;
  nightFactor = 0;
  horizon = new THREE.Color();
  envIntensity = 1;
  interior = false;

  constructor(private scene: THREE.Scene) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uSunDir: { value: new THREE.Vector3() },
        uMoonDir: { value: new THREE.Vector3() },
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uGround: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() },
        uFogAmt: { value: 0 },
        uCloud: { value: 0.3 },
        uStorm: { value: 0 },
        uTime: G.uTime,
        uStars: { value: 0 },
        uFlash: { value: 0 },
        uNight: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.sky.name = 'sky';
    scene.add(this.sky);
    const skyClone = new THREE.Mesh(this.sky.geometry, this.skyMat);
    this.skyScene.add(skyClone);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 700;
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = this.fog;
  }

  setShadowQuality(size: number, extent: number, enabled: boolean) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.shadowSize = extent;
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();
  }

  private sampleKeys(e: number) {
    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = clamp((e - a.e) / (b.e - a.e), 0, 1);
    return {
      zen: a.zen.clone().lerp(b.zen, t),
      hor: a.hor.clone().lerp(b.hor, t),
      sun: a.sun.clone().lerp(b.sun, t),
      light: lerp(a.light, b.light, t),
      amb: lerp(a.amb, b.amb, t),
    };
  }

  /**
   * @param hour fractional hour 0..24
   * @param focus point the shadow camera follows (player)
   */
  update(renderer: THREE.WebGLRenderer, hour: number, w: WeatherParams, camPos: THREE.Vector3, focus: THREE.Vector3, dt: number) {
    // sun path: rises east (+x) at 6, highest to the south (+z) at noon
    const th = ((hour - 6) / 12) * Math.PI;
    const lat = 0.6;
    this.sunDir.set(Math.cos(th), Math.sin(th) * Math.cos(lat), Math.sin(th) * Math.sin(lat)).normalize();
    const mth = th + Math.PI + 0.35;
    this.moonDir.set(Math.cos(mth), Math.sin(mth) * Math.cos(0.4), Math.sin(mth) * Math.sin(0.4)).normalize();
    const e = this.sunDir.y;
    const k = this.sampleKeys(e);
    // overcast desaturation
    const overcast = clamp(w.cloud * 0.9 + w.rain * 0.3, 0, 1);
    const grayZ = (k.zen.r + k.zen.g + k.zen.b) / 3;
    const grayH = (k.hor.r + k.hor.g + k.hor.b) / 3;
    k.zen.lerp(new THREE.Color(grayZ * 1.1, grayZ * 1.12, grayZ * 1.18), overcast * 0.85);
    k.hor.lerp(new THREE.Color(grayH * 0.95, grayH * 0.98, grayH * 1.02), overcast * 0.75);
    const stormDim = 1 - w.storm * 0.55;
    k.zen.multiplyScalar(stormDim);
    k.hor.multiplyScalar(stormDim);
    // city light pollution at night
    const night = smoothstep(0.08, -0.08, e);
    this.nightFactor = night;
    k.hor.add(new THREE.Color(0.05, 0.035, 0.025).multiplyScalar(night * (0.6 + overcast)));

    const u = this.skyMat.uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    u.uZenith.value.copy(k.zen);
    u.uHorizon.value.copy(k.hor);
    u.uGround.value.copy(k.hor).multiplyScalar(0.35);
    u.uSunColor.value.copy(k.sun);
    u.uCloud.value = w.cloud;
    u.uStorm.value = w.storm;
    u.uStars.value = night;
    u.uNight.value = night;
    u.uFlash.value = w.flash;
    // fog
    const fogCol = k.hor.clone().multiplyScalar(0.82).lerp(new THREE.Color(0.5, 0.52, 0.55).multiplyScalar(0.3 + 0.7 * (1 - night)), w.fog * 0.5 + w.rain * 0.3);
    this.horizon.copy(fogCol);
    this.fog.color.copy(fogCol);
    const baseDensity = 1.12 / this.drawDistance;
    this.fog.density = baseDensity * (1 + w.fog * 4.5 + w.rain * 1.2);
    u.uFog.value.copy(fogCol);
    u.uFogAmt.value = clamp(0.45 + w.fog * 0.5 + w.rain * 0.3, 0, 1);

    // lights
    const sunUp = e > -0.04;
    const cloudDim = 1 - overcast * 0.65;
    if (sunUp) {
      this.sun.position.copy(this.sunDir);
      this.sun.color.copy(k.sun);
      this.sun.intensity = k.light * cloudDim * smoothstep(-0.04, 0.06, e) * stormDim;
    } else {
      this.sun.position.copy(this.moonDir);
      this.sun.color.setRGB(0.55, 0.65, 0.95);
      this.sun.intensity = 0.32 * smoothstep(-0.02, 0.2, this.moonDir.y) * (1 - overcast * 0.7);
    }
    this.sun.intensity += w.flash * 4;
    // at night the sky term becomes a cool moonlit/city-glow fill so streets are readable, not black
    this.hemi.color.copy(k.zen).lerp(new THREE.Color(1, 1, 1), 0.35).lerp(new THREE.Color(0.5, 0.6, 0.85), night * 0.6);
    this.hemi.groundColor.setRGB(0.18, 0.15, 0.12).lerp(new THREE.Color(0.25, 0.16, 0.1), night);
    this.hemi.intensity = (k.amb * 0.42 + night * 0.3) * (1 - w.storm * 0.4) + w.flash * 1.5;
    this.envIntensity = 0.28 + 0.42 * (1 - night) * cloudDim + w.flash;
    (this.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = this.envIntensity;

    // shadow camera follows focus, snapped to texel grid to avoid shimmering
    const ext = this.shadowSize;
    const texel = (ext * 2) / this.sun.shadow.mapSize.x;
    const lightDir = this.sun.position.clone().normalize();
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.copy(lightDir).multiplyScalar(300).add(this.sun.target.position);
    this.sun.target.updateMatrixWorld();

    this.sky.position.copy(camPos);

    // global uniforms
    G.uNight.value = this.interior ? 0 : smoothstep(0.12, -0.05, e);
    G.uHour.value = hour;
    G.uWet.value = w.wet;
    G.uWind.value = w.wind;
    G.uRain.value = w.rain;
    G.uSunDir.value.copy(this.sunDir);

    // environment map refresh (cheap PMREM of the sky only)
    this.envTimer -= dt;
    if (this.envTimer <= 0 && (Math.abs(hour - this.lastEnvHour) > 0.2 || Math.abs(w.cloud - this.lastEnvCloud) > 0.05 || this.lastEnvHour < 0)) {
      this.envTimer = 1.5;
      this.lastEnvHour = hour;
      this.lastEnvCloud = w.cloud;
      this.refreshEnv(renderer);
    }
  }

  refreshEnv(renderer: THREE.WebGLRenderer) {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(renderer);
    const flash = this.skyMat.uniforms.uFlash.value;
    this.skyMat.uniforms.uFlash.value = 0;
    const rt = this.pmrem.fromScene(this.skyScene, 0.015, 0.1, 1000);
    this.skyMat.uniforms.uFlash.value = flash;
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    if (!this.interior) this.scene.environment = rt.texture;
  }

  setInterior(on: boolean) {
    this.interior = on;
    this.sky.visible = !on;
    this.sun.visible = !on;
    this.hemi.visible = !on;
    this.scene.fog = on ? null : this.fog;
    this.scene.environment = on ? null : (this.envRT?.texture ?? null);
  }

  dispose() {
    this.envRT?.dispose();
    this.pmrem?.dispose();
    this.scene.remove(this.sky, this.sun, this.sun.target, this.hemi);
  }
}
