import * as THREE from 'three';

/** Uniforms shared by every world material (updated once per frame by the environment). */
export const G = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uWet: { value: 0 },
  uHour: { value: 12 },
  uPower: { value: [1, 1, 1, 1, 1, 1] as number[] },
  uWind: { value: 0.3 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  uRain: { value: 0 },
};

export const GLSL_NOISE = /* glsl */ `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  float a = h12(i), b = h12(i+vec2(1.0,0.0)), c = h12(i+vec2(0.0,1.0)), d = h12(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;
