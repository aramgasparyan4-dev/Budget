import { create } from 'zustand';

export interface DialogueLine {
  who: 'npc' | 'you';
  text: string;
}
export interface DialogueOptionView {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}
export interface DialogueView {
  npcId: number;
  name: string;
  subtitle: string;
  stage: string;
  traits: string[];
  mood: number;
  rel: { friend: number; trust: number; fam: number; romance: number };
  lines: DialogueLine[];
  options: DialogueOptionView[];
  thinking: boolean;
  schedule?: { time: string; what: string }[];
}

export const useDialogue = create<{ view: DialogueView | null; set: (v: DialogueView | null) => void }>((set) => ({
  view: null,
  set: (view) => set({ view }),
}));

export interface ShopItemView {
  id: string;
  name: string;
  price: number;
  desc?: string;
  kind?: string;
  owned?: boolean;
  disabled?: string;
  color?: string;
}
export interface ShopView {
  title: string;
  subtitle: string;
  items: ShopItemView[];
  mode: 'buy' | 'sell' | 'service';
  /** extra action buttons (e.g. apply for job, ATM) */
  actions: { id: string; label: string; hint?: string; disabled?: boolean }[];
  footer?: string;
}
export const useShop = create<{ view: ShopView | null; set: (v: ShopView | null) => void; handler: ((id: string, kind: 'item' | 'action') => void) | null; setHandler: (h: ((id: string, kind: 'item' | 'action') => void) | null) => void }>((set) => ({
  view: null,
  handler: null,
  set: (view) => set({ view }),
  setHandler: (handler) => set({ handler }),
}));

export interface MiniGameView {
  kind: 'barista' | 'stock' | 'office' | 'warehouse';
  title: string;
  round: number;
  rounds: number;
  score: number;
  prompt: string;
  choices: string[];
  timeLeft: number;
  feedback: string | null;
}
export const useMiniGame = create<{ view: MiniGameView | null; set: (v: MiniGameView | null) => void; answer: ((i: number) => void) | null; setAnswer: (h: ((i: number) => void) | null) => void }>((set) => ({
  view: null,
  answer: null,
  set: (view) => set({ view }),
  setAnswer: (answer) => set({ answer }),
}));
