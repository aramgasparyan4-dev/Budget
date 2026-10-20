import { create } from 'zustand';
import type { EventKind } from './scoring';

export type Phase = 'loading' | 'title' | 'countdown' | 'run' | 'wreck' | 'results';
export type Mode = 'score' | 'race';

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
  damaged: boolean;
  health: number; // car condition 0-100
  lastHit: boolean; // one more big hit wrecks it
}

export interface RaceHud {
  position: 1 | 2;
  checkpoint: number; // checkpoints passed
  checkpoints: number;
  time: number; // seconds since the start
  gap: number; // metres ahead of the rival (negative: behind)
  rivalDist: number; // straight-line metres to the rival
  arrow: number; // degrees, direction to the next checkpoint relative to the camera (0 = straight ahead)
  cpDist: number; // metres to the next checkpoint
  off: boolean; // off the route
  wrongWay: boolean;
  rivalFinished: boolean;
  stunned: boolean; // stopped by a crash
  left: number; // seconds left to finish once the rival is home, else -1
}

export interface RaceResult {
  won: boolean;
  time: number | null; // null: did not finish
  rivalTime: number | null;
  rivalEstimated: boolean; // the rival had not finished yet: its time is projected from its pace
  crashes: number;
  rivalCrashes: number;
  length: number; // metres
  record: boolean; // best winning margin so far
}

export interface RaceStats {
  races: number;
  wins: number;
  bestMargin: number; // seconds, 0 if never won
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
  mode: Mode;
  race?: RaceResult;
  garage?: GarageResult;
}

export interface GarageResult {
  coins: number; // earned this run
  health: number; // condition after the run
  damage: number; // condition lost this run
  repair: number; // coins to fix it fully
  total: number; // coins now
}

export interface BestEntry {
  score: number;
  car: string;
  cond: string;
  date: number;
  nearMisses: number;
  bestCombo: number;
}

// storage keys keep the game's first name (Near Miss) so existing saves carry over
const BEST_KEY = 'near-miss-best-v1';
const RACE_KEY = 'near-miss-race-v1';

function loadRace(): RaceStats {
  try {
    const raw = localStorage.getItem(RACE_KEY);
    if (raw) return { races: 0, wins: 0, bestMargin: 0, ...(JSON.parse(raw) as Partial<RaceStats>) };
  } catch {
    /* storage unavailable */
  }
  return { races: 0, wins: 0, bestMargin: 0 };
}

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
  cond: string;
  mode: Mode;
  hud: Hud;
  race: RaceHud | null;
  raceStats: RaceStats;
  popups: Popup[];
  result: RunResult | null;
  best: BestEntry[];
  set: (p: Partial<NMState>) => void;
  setHud: (h: Hud) => void;
  pushPopup: (p: Omit<Popup, 'id'>) => void;
  /** add a finished run to the local top 10; returns its 1-based rank or 0 */
  record: (e: BestEntry) => number;
  /** count a finished race; returns true if the winning margin is a new best */
  recordRace: (won: boolean, margin: number) => boolean;
}

let pid = 1;

export const useNM = create<NMState>((set, get) => ({
  phase: 'loading',
  progress: 0,
  progressText: '',
  paused: false,
  cond: 'day',
  mode: 'score',
  hud: {
    speed: 0,
    score: 0,
    comboPoints: 0,
    mult: 1,
    comboT: 0,
    boost: 0,
    boosting: false,
    time: 0,
    oncoming: false,
    drifting: false,
    driftAngle: 0,
    driftPoints: 0,
    countdown: 0,
    street: '',
    damaged: false,
    health: 100,
    lastHit: false,
  },
  race: null,
  raceStats: loadRace(),
  popups: [],
  result: null,
  best: loadBest(),
  set: (p) => set(p),
  setHud: (hud) => set({ hud }),
  pushPopup: (p) => {
    const item = { ...p, id: pid++ };
    set({ popups: [...get().popups, item].slice(-4) });
    const long = p.kind === 'bank' || p.kind === 'lost' || p.kind === 'damage' || p.kind === 'crash';
    setTimeout(() => set({ popups: get().popups.filter((x) => x.id !== item.id) }), long ? 2200 : 1400);
  },
  record: (e) => {
    // a run that scored nothing is not a "personal best"
    if (e.score <= 0) return 0;
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
  recordRace: (won, margin) => {
    const r = { ...get().raceStats };
    r.races++;
    let best = false;
    if (won) {
      r.wins++;
      if (margin > r.bestMargin) {
        r.bestMargin = Math.round(margin * 10) / 10;
        best = true;
      }
    }
    set({ raceStats: r });
    try {
      localStorage.setItem(RACE_KEY, JSON.stringify(r));
    } catch {
      /* storage unavailable */
    }
    return best;
  },
}));
