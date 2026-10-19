import { useMemo } from 'react';
import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';

/** Values driven by the environment each frame. */
export const GRADE = {
  exposure: { value: 1.0 },
  tint: { value: new THREE.Vector3(1, 1, 1) },
  saturation: { value: 1.08 },
  contrast: { value: 1.06 },
  shadowTint: { value: new THREE.Vector3(0.96, 1.0, 1.06) },
  highlightTint: { value: new THREE.Vector3(1.05, 1.0, 0.94) },
};

const frag = /* glsl */ `
uniform float exposure;
uniform vec3 tint;
uniform float saturation;
uniform float contrast;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * exposure * tint;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = lum / (1.0 + lum);
  c *= mix(shadowTint, highlightTint, smoothstep(0.05, 0.6, k));
  c = mix(vec3(lum), c, saturation);
  // contrast in log space around mid grey
  vec3 lc = log2(max(c, vec3(1e-5)));
  lc = (lc - log2(0.18)) * contrast + log2(0.18);
  c = exp2(lc);
  outputColor = vec4(max(c, vec3(0.0)), inputColor.a);
}
`;

class ColorGradeEffect extends Effect {
  constructor() {
    super('ColorGrade', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>(Object.entries(GRADE) as [string, THREE.Uniform][]),
    });
  }
}

export function ColorGrade() {
  const effect = useMemo(() => new ColorGradeEffect(), []);
  return <primitive object={effect} dispose={null} />;
}
