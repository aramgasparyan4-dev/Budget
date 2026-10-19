import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, SMAA, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { ColorGrade } from './ColorGrade';

/** what the canvas drives each frame: Echo City's Game or another game built on the same engine */
export interface CanvasEngine {
  attach(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  update(dt: number): void;
  afterRender(): void;
}

function GameRoot({ engine }: { engine: CanvasEngine }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    engine.attach(gl as THREE.WebGLRenderer, scene, camera as THREE.PerspectiveCamera);
  }, [engine, gl, scene, camera]);
  useFrame((_, dt) => {
    engine.update(dt);
  }, -1);
  // collect stats after rendering (priority above the composer)
  useFrame(() => {
    engine.afterRender();
  }, 10);
  return null;
}

/** Without post-processing we render ourselves (a priority>0 frame hook disables R3F's auto render). */
function PlainRender() {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
  }, 1);
  return null;
}

function PostFX() {
  const g = useStore((s) => s.settings.graphics);
  if (!g.postFX) return <PlainRender />;
  return (
    <EffectComposer multisampling={g.aa === 'msaa' ? 4 : 0} enableNormalPass={false}>
      <>{g.ao ? <N8AO aoRadius={2.2} intensity={2.2} distanceFalloff={1.2} halfRes={g.preset !== 'ultra'} quality={g.preset === 'ultra' ? 'high' : 'medium'} /> : null}</>
      <>{g.bloom ? <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.05} luminanceSmoothing={0.3} radius={0.7} /> : null}</>
      <ColorGrade />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
      <>{g.aa === 'smaa' ? <SMAA /> : null}</>
    </EffectComposer>
  );
}

function RenderConfig() {
  const { gl, scene } = useThree();
  const postFX = useStore((s) => s.settings.graphics.postFX);
  const shadows = useStore((s) => s.settings.graphics.shadows);
  useEffect(() => {
    gl.toneMapping = postFX ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.shadowMap.enabled = shadows > 0;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    // force material recompiles for the tone mapping switch
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
    });
  }, [gl, scene, postFX, shadows]);
  return null;
}

export function GameCanvas({ engine }: { engine: CanvasEngine }) {
  const scale = useStore((s) => s.settings.graphics.resolutionScale);
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * scale);
  return (
    <Canvas
      dpr={dpr}
      shadows
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      camera={{ fov: 62, near: 0.25, far: 1200, position: [0, 80, 200] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x05070c, 1);
      }}
      frameloop="always"
    >
      <RenderConfig />
      <GameRoot engine={engine} />
      <PostFX />
    </Canvas>
  );
}
