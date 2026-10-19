import { create } from 'zustand';
import { loadSettings, persistSettings, Settings, PRESETS, Preset } from './settings';

export type Screen = 'boot' | 'menu' | 'loading' | 'game';
export type Overlay =
  | null
  | 'pause'
  | 'phone'
  | 'map'
  | 'dialogue'
  | 'shop'
  | 'settings'
  | 'saveload'
  | 'minigame'
  | 'inventory'
  | 'sleep'
  | 'newgame'
  | 'wardrobe'
  | 'business'
  | 'intro'
  | 'controls';

export interface Notification {
  id: number;
  title: string;
  body?: string;
  kind: 'info' | 'money' | 'news' | 'message' | 'objective' | 'warning' | 'relationship';
  t: number;
}

export interface HudState {
  time: string;
  day: number;
  weekday: string;
  hour: number;
  weather: string;
  temp: number;
  cash: number;
  bank: number;
  hunger: number;
  energy: number;
  stamina: number;
  objective: string | null;
  objectiveSub: string | null;
  prompt: { key: string; text: string; sub?: string } | null;
  speed: number;
  inVehicle: boolean;
  vehicleName: string;
  district: string;
  street: string;
  interior: string | null;
  jobStatus: string | null;
  jobTimer: number | null;
  subtitle: { who: string; text: string } | null;
  waypoint: { x: number; z: number; label: string } | null;
}

export interface PerfStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  activeNpcs: number;
  simulatedNpcs: number;
  loadedChunks: number;
  detailChunks: number;
  activeVehicles: number;
  memory: number | null;
  simMs: number;
  physicsBodies: number;
}

interface StoreState {
  screen: Screen;
  overlay: Overlay;
  loadingProgress: number;
  loadingText: string;
  settings: Settings;
  hud: HudState;
  perf: PerfStats;
  notifications: Notification[];
  phoneApp: string;
  version: number;
  introActive: boolean;
  introText: { title: string; body: string; place?: string } | null;
  fade: number;
  skipLabel: string | null;
  saveMode: 'save' | 'load';
  setSaveMode: (m: 'save' | 'load') => void;
  setFade: (f: number, label: string | null) => void;
  setScreen: (s: Screen) => void;
  setOverlay: (o: Overlay) => void;
  setLoading: (p: number, text?: string) => void;
  setHud: (h: Partial<HudState>) => void;
  setPerf: (p: PerfStats) => void;
  notify: (n: Omit<Notification, 'id' | 't'>) => void;
  dismiss: (id: number) => void;
  setPhoneApp: (a: string) => void;
  updateSettings: (fn: (s: Settings) => void) => void;
  applyPreset: (p: Preset) => void;
  bump: () => void;
  setIntro: (t: { title: string; body: string; place?: string } | null) => void;
}

let nid = 1;

export const useStore = create<StoreState>((set, get) => ({
  screen: 'boot',
  overlay: null,
  loadingProgress: 0,
  loadingText: '',
  settings: (() => {
    const st = loadSettings();
    // ?preset=low|medium|high|ultra overrides graphics (handy for testing / weak machines)
    try {
      const q = new URLSearchParams(location.search).get('preset') as Preset | null;
      if (q && PRESETS[q]) st.graphics = { ...PRESETS[q] };
    } catch {
      /* no location */
    }
    return st;
  })(),
  hud: {
    time: '08:00',
    day: 1,
    weekday: 'Monday',
    hour: 8,
    weather: 'Clear',
    temp: 18,
    cash: 0,
    bank: 0,
    hunger: 1,
    energy: 1,
    stamina: 1,
    objective: null,
    objectiveSub: null,
    prompt: null,
    speed: 0,
    inVehicle: false,
    vehicleName: '',
    district: '',
    street: '',
    interior: null,
    jobStatus: null,
    jobTimer: null,
    subtitle: null,
    waypoint: null,
  },
  perf: {
    fps: 0,
    frameMs: 0,
    drawCalls: 0,
    triangles: 0,
    activeNpcs: 0,
    simulatedNpcs: 0,
    loadedChunks: 0,
    detailChunks: 0,
    activeVehicles: 0,
    memory: null,
    simMs: 0,
    physicsBodies: 0,
  },
  notifications: [],
  phoneApp: 'home',
  version: 0,
  introActive: false,
  introText: null,
  fade: 0,
  skipLabel: null,
  saveMode: 'save',
  setSaveMode: (saveMode) => set({ saveMode }),
  setFade: (fade, skipLabel) => set({ fade, skipLabel }),
  setScreen: (screen) => set({ screen }),
  setOverlay: (overlay) => set({ overlay }),
  setLoading: (loadingProgress, loadingText) => set({ loadingProgress, loadingText: loadingText ?? get().loadingText }),
  setHud: (h) => set({ hud: { ...get().hud, ...h } }),
  setPerf: (perf) => set({ perf }),
  notify: (n) => {
    const item: Notification = { ...n, id: nid++, t: performance.now() };
    const list = [...get().notifications, item].slice(-5);
    set({ notifications: list });
    setTimeout(() => get().dismiss(item.id), n.kind === 'news' ? 7000 : 5200);
  },
  dismiss: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),
  setPhoneApp: (phoneApp) => set({ phoneApp }),
  updateSettings: (fn) => {
    const s = structuredClone(get().settings);
    fn(s);
    persistSettings(s);
    set({ settings: s });
  },
  applyPreset: (p) => {
    const s = structuredClone(get().settings);
    s.graphics = { ...PRESETS[p] };
    persistSettings(s);
    set({ settings: s });
  },
  bump: () => set({ version: get().version + 1 }),
  setIntro: (introText) => set({ introText }),
}));
