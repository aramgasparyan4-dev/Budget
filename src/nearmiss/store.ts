import { create } from 'zustand';
import type { EventKind } from './scoring';

export type Phase = 'loading' | 'title' | 'countdown' | 'run' | 'wreck' | 'results';

export interface Popup {
  id: number;
  kind: EventKind;
  label: string;
  sub?: string;
  points: number;
  tier?: number;
}

export interface Hud {
  speed: number; // km/h
  score: number;
  comboPoints: number;
  mult: number;
  comboT: number; // seconds left before the combo banks
  boost: number; // 0..1
  boosting: boolean;
  time: number; // seconds on the clock
  oncoming: boolean;
  drifting: boolean;
  driftAngle: number; // degrees
  driftPoints: number; // points in the drift so far
  countdown: number;
  street: string;
}

export interface RunResult {
  score: number;
  reason: 'wrecked' | 'time';
  nearMisses: number;
  bestCombo: number;
  bestBank: number;
  topSpeed: number;
  distance: number; // metres
  seconds: number;
  oncomingSec: number;
  driftSec: number;
  drifts: number;
  bestDrift: number;
  closest: number | null;
  car: string;
  cond: string;
  rank: number; // 1-based place in the local top 10, 0 if not in it
}

export interface BestEntry {
  score: number;
  car: string;
  cond: string;
  date: number;
  nearMisses: number;
  bestCombo: number;
}

const BEST_KEY = 'near-miss-best-v1';

function loadBest(): BestEntry[] {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? (JSON.parse(raw) as BestEntry[]) : [];
  } catch {
    return [];
  }
}

interface NMState {
  phase: Phase;
  progress: number;
  progressText: string;
  paused: boolean;
  carIndex: number;
  cond: string;
  hud: Hud;
  popups: Popup[];
  result: RunResult | null;
  best: BestEntry[];
  set: (p: Partial<NMState>) => void;
  setHud: (h: Hud) => void;
  pushPopup: (p: Omit<Popup, 'id'>) => void;
  /** add a finished run to the local top 10; returns its 1-based rank or 0 */
  record: (e: BestEntry) => number;
}

let pid = 1;

export const useNM = create<NMState>((set, get) => ({
  phase: 'loading',
  progress: 0,
  progressText: '',
  paused: false,
  carIndex: 0,
  cond: 'night',
  hud: { speed: 0, score: 0, comboPoints: 0, mult: 1, comboT: 0, boost: 0, boosting: false, time: 0, oncoming: false, drifting: false, driftAngle: 0, driftPoints: 0, countdown: 0, street: '' },
  popups: [],
  result: null,
  best: loadBest(),
  set: (p) => set(p),
  setHud: (hud) => set({ hud }),
  pushPopup: (p) => {
    const item = { ...p, id: pid++ };
    set({ popups: [...get().popups, item].slice(-4) });
    setTimeout(() => set({ popups: get().popups.filter((x) => x.id !== item.id) }), p.kind === 'bank' || p.kind === 'lost' ? 2200 : 1400);
  },
  record: (e) => {
    const list = [...get().best, e].sort((a, b) => b.score - a.score).slice(0, 10);
    set({ best: list });
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable: scores last for this visit only */
    }
    const i = list.indexOf(e);
    return i >= 0 ? i + 1 : 0;
  },
}));
