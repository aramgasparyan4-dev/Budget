export type Preset = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  preset: Preset | 'custom';
  shadows: 0 | 1024 | 2048 | 4096;
  shadowExtent: number;
  drawDistance: number;
  detailRadius: number;
  vegetation: number;
  npcDensity: number;
  trafficDensity: number;
  postFX: boolean;
  bloom: boolean;
  ao: boolean;
  aa: 'none' | 'smaa' | 'msaa';
  resolutionScale: number;
  rainParticles: number;
}

export interface Settings {
  graphics: GraphicsSettings;
  audio: { master: number; music: number; sfx: number; ambience: number };
  controls: { sensitivity: number; invertY: boolean; cameraDistance: number; fov: number };
  gameplay: {
    timeScale: number; // game seconds per real second
    showPerf: boolean;
    subtitles: boolean;
    minimapRotate: boolean;
    llmEnabled: boolean;
    llmEndpoint: string;
    llmModel: string;
  };
}

export const PRESETS: Record<Preset, GraphicsSettings> = {
  low: {
    preset: 'low',
    shadows: 0,
    shadowExtent: 60,
    drawDistance: 320,
    detailRadius: 200,
    vegetation: 0.4,
    npcDensity: 0.45,
    trafficDensity: 0.5,
    postFX: false,
    bloom: false,
    ao: false,
    aa: 'none',
    resolutionScale: 0.75,
    rainParticles: 2500,
  },
  medium: {
    preset: 'medium',
    shadows: 1024,
    shadowExtent: 70,
    drawDistance: 480,
    detailRadius: 280,
    vegetation: 0.7,
    npcDensity: 0.7,
    trafficDensity: 0.75,
    postFX: true,
    bloom: true,
    ao: false,
    aa: 'smaa',
    resolutionScale: 1,
    rainParticles: 6000,
  },
  high: {
    preset: 'high',
    shadows: 2048,
    shadowExtent: 95,
    drawDistance: 700,
    detailRadius: 380,
    vegetation: 1,
    npcDensity: 1,
    trafficDensity: 1,
    postFX: true,
    bloom: true,
    ao: true,
    aa: 'smaa',
    resolutionScale: 1,
    rainParticles: 11000,
  },
  ultra: {
    preset: 'ultra',
    shadows: 4096,
    shadowExtent: 130,
    drawDistance: 950,
    detailRadius: 520,
    vegetation: 1,
    npcDensity: 1.3,
    trafficDensity: 1.25,
    postFX: true,
    bloom: true,
    ao: true,
    aa: 'msaa',
    resolutionScale: 1.25,
    rainParticles: 18000,
  },
};

export const DEFAULT_SETTINGS: Settings = {
  graphics: { ...PRESETS.high },
  audio: { master: 0.8, music: 0.55, sfx: 0.8, ambience: 0.7 },
  controls: { sensitivity: 1, invertY: false, cameraDistance: 4.6, fov: 62 },
  gameplay: {
    timeScale: 30,
    showPerf: false,
    subtitles: true,
    minimapRotate: true,
    llmEnabled: false,
    llmEndpoint: 'http://localhost:11434/v1/chat/completions',
    llmModel: 'llama3.1',
  },
};

const KEY = 'echo-city-settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      graphics: { ...DEFAULT_SETTINGS.graphics, ...(s.graphics ?? {}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(s.audio ?? {}) },
      controls: { ...DEFAULT_SETTINGS.controls, ...(s.controls ?? {}) },
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(s.gameplay ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function persistSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/** Pick a sensible preset for this machine. */
export function detectPreset(): Preset {
  try {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software/i.test(renderer)) return 'low';
    if (/rtx|radeon rx|apple m[2-9]|arc a7/i.test(renderer) && cores >= 8) return 'high';
    if (cores <= 4 || mem <= 4) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}
