import { create } from 'zustand';
import { loadSettings, persistSettings, Settings, PRESETS, Preset } from './settings';

interface AppState {
  settings: Settings;
  updateSettings: (fn: (s: Settings) => void) => void;
  applyPreset: (p: Preset) => void;
}

/** graphics, sound and control settings, kept in this browser */
export const useStore = create<AppState>((set, get) => ({
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
}));
