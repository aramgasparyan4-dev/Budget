// Everything the windows ask of the system goes through here.
//
// Inside the real app the requests go to the Rust side. In an ordinary
// browser (the test bench, and the automated tests) a stand-in keeps the data
// in browser storage and passes messages between the three pages, so the
// same pages run in both places.

import type { Backend } from '@star/ui';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface Prefs {
  size: 'normal' | 'small';
  hideOnFullscreen: boolean;
  sound: boolean;
  starHidden: boolean;
  autostart: boolean;
  /** Side length of the star drawing in CSS pixels. */
  starSize: number;
  bubbleHeight: number;
  bubbleWidth: number;
  dataFolder: string;
}

export type PrefKey = 'size' | 'hideOnFullscreen' | 'sound' | 'starHidden' | 'autostart';

export interface BubbleLayout {
  below: boolean;
  shift: number;
}

export interface Platform {
  isTauri: boolean;
  backend: Backend;
  getPrefs(): Promise<Prefs>;
  setPref(key: PrefKey, value: boolean | string): void;
  onPrefsChanged(callback: () => void): void;
  /** Which way to look: each part is -1, 0 or 1. */
  onEyes(callback: (dx: number, dy: number) => void): void;
  /** Something picked from the tray or right click menu. */
  onMenuAction(callback: (id: string) => void): void;
  onStarVisible(callback: (visible: boolean) => void): void;
  /** This window was just opened again. */
  onWindowShown(callback: () => void): void;
  togglePanel(): void;
  openQuickAdd(): void;
  hideSelf(): void;
  startDrag(): void;
  showMenu(): void;
  bubbleLayout(): Promise<BubbleLayout>;
  quit(): void;
}

// ---------------------------------------------------------- real app

function tauriPlatform(): Platform {
  const on = <T>(event: string, callback: (payload: T) => void) => void listen<T>(event, (e) => callback(e.payload));
  return {
    isTauri: true,
    backend: {
      load: () => invoke<string>('get_data'),
      save: (json) => invoke<void>('set_data', { json }),
      onExternalChange: (callback) => on('data-changed', callback),
    },
    getPrefs: () => invoke<Prefs>('get_prefs'),
    setPref: (key, value) => void invoke('set_pref', { key, value }),
    onPrefsChanged: (callback) => on('prefs-changed', callback),
    onEyes: (callback) => on<[number, number]>('eyes', ([dx, dy]) => callback(dx, dy)),
    onMenuAction: (callback) => on<string>('menu-action', callback),
    onStarVisible: (callback) => on<boolean>('star-visible', callback),
    onWindowShown: (callback) => on('window-shown', callback),
    togglePanel: () => void invoke('toggle_panel'),
    openQuickAdd: () => void invoke('open_quick_add'),
    hideSelf: () => void invoke('hide_self'),
    startDrag: () => void getCurrentWindow().startDragging(),
    showMenu: () => void invoke('show_menu'),
    bubbleLayout: () => invoke<BubbleLayout>('bubble_layout'),
    quit: () => void invoke('quit'),
  };
}

// ------------------------------------------------- browser stand-in

const DATA_KEY = 'star.data';
const PREFS_KEY = 'star.prefs';

export type BenchMessage =
  | { type: 'data' }
  | { type: 'prefs' }
  | { type: 'eyes'; dx: number; dy: number }
  | { type: 'menu'; id: string }
  | { type: 'visible'; value: boolean }
  | { type: 'shown'; window: string }
  | { type: 'ui'; action: 'toggle-panel' | 'quick-add' | 'hide' | 'menu' | 'quit'; from: string };

function browserPlatform(windowName: string): Platform {
  const channel = new BroadcastChannel('star');
  const listeners: Array<(message: BenchMessage) => void> = [];
  channel.onmessage = (event: MessageEvent<BenchMessage>) => listeners.forEach((l) => l(event.data));
  const on = (handler: (message: BenchMessage) => void) => void listeners.push(handler);
  const send = (message: BenchMessage) => channel.postMessage(message);
  const ui = (action: Extract<BenchMessage, { type: 'ui' }>['action']) => send({ type: 'ui', action, from: windowName });

  const readPrefs = (): Prefs => {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    const size = saved.size === 'small' ? 'small' : 'normal';
    return {
      hideOnFullscreen: true,
      sound: false,
      starHidden: false,
      autostart: false,
      ...saved,
      size,
      starSize: size === 'small' ? 130 : 190,
      bubbleHeight: 130,
      bubbleWidth: 270,
      dataFolder: '(browser storage)',
    };
  };

  return {
    isTauri: false,
    backend: {
      load: async () => localStorage.getItem(DATA_KEY) ?? '',
      save: async (json) => {
        localStorage.setItem(DATA_KEY, json);
        send({ type: 'data' });
      },
      onExternalChange: (callback) => on((m) => m.type === 'data' && callback()),
    },
    getPrefs: async () => readPrefs(),
    setPref: (key, value) => {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), [key]: value }));
      send({ type: 'prefs' });
      listeners.forEach((l) => l({ type: 'prefs' }));
    },
    onPrefsChanged: (callback) => on((m) => m.type === 'prefs' && callback()),
    onEyes: (callback) => on((m) => m.type === 'eyes' && callback(m.dx, m.dy)),
    onMenuAction: (callback) => on((m) => m.type === 'menu' && callback(m.id)),
    onStarVisible: (callback) => on((m) => m.type === 'visible' && callback(m.value)),
    onWindowShown: (callback) => on((m) => m.type === 'shown' && m.window === windowName && callback()),
    togglePanel: () => ui('toggle-panel'),
    openQuickAdd: () => ui('quick-add'),
    hideSelf: () => ui('hide'),
    startDrag: () => {},
    showMenu: () => ui('menu'),
    bubbleLayout: async () => ({
      below: new URLSearchParams(location.search).get('bubble') === 'below',
      shift: Number(new URLSearchParams(location.search).get('shift') ?? 0),
    }),
    quit: () => ui('quit'),
  };
}

export function getPlatform(): Platform {
  const windowName = document.documentElement.dataset.window ?? 'bench';
  return '__TAURI_INTERNALS__' in window ? tauriPlatform() : browserPlatform(windowName);
}
