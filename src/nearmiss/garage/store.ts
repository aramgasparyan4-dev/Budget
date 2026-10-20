// The player's garage as UI state: their vehicles (from the host page, added in the game, or the
// demo line-up), which one is active, coins, and each car's condition and upgrades.
import { create } from 'zustand';
import { HostBridge, GarageImport } from './bridge';
import { buyUpgrade, carSetup, CarSetup, finishRun, GarageSave, loadSave, patchUp, progressOf, repair, storeSave, UpgradeId } from './progress';
import { demoGarage, GarageVehicle, displayName, parseVehicle } from './vehicle';

interface GarageState {
  save: GarageSave;
  hostVehicles: GarageVehicle[];
  /** the host page sent the vehicles (rather than the URL or nothing) */
  hostConnected: boolean;
  /** a short message after an action ("Not enough coins") */
  notice: string;
  /** which garage panel is open over the title screen */
  panel: 'none' | 'workshop' | 'garage' | 'add';
  setPanel: (p: 'none' | 'workshop' | 'garage' | 'add') => void;
  vehicles: () => GarageVehicle[];
  ownCount: () => number;
  active: () => GarageVehicle;
  setup: () => CarSetup;
  setActive: (id: string) => void;
  addVehicle: (raw: unknown) => GarageVehicle | null;
  removeVehicle: (id: string) => void;
  upgrade: (id: UpgradeId) => boolean;
  repair: () => boolean;
  patch: () => boolean;
  /** after a run: condition and coins */
  finish: (health: number, coins: number, score: number) => void;
  importFromHost: (g: GarageImport, fromHost: boolean) => void;
}

const DEMO = demoGarage();

function commit(save: GarageSave) {
  storeSave(save);
  bridge?.send({ type: 'nearmiss:progress', save });
  return save;
}

export const useGarage = create<GarageState>((set, get) => ({
  save: loadSave(),
  hostVehicles: [],
  hostConnected: false,
  notice: '',
  panel: 'none',
  setPanel: (panel) => set({ panel, notice: '' }),
  /** your cars first, then the demo line-up to test-drive the other kinds of car */
  vehicles: () => {
    const { hostVehicles, save } = get();
    return [...hostVehicles, ...save.localVehicles, ...DEMO];
  },
  ownCount: () => get().hostVehicles.length + get().save.localVehicles.length,
  active: () => {
    const list = get().vehicles();
    const id = get().save.activeId;
    return list.find((v) => v.id === id) ?? list.find((v) => v.primary) ?? list[0];
  },
  setup: () => {
    const v = get().active();
    return carSetup(v, progressOf(get().save, v));
  },
  setActive: (id) => set({ save: commit({ ...get().save, activeId: id }), notice: '' }),
  addVehicle: (raw) => {
    const v = parseVehicle(raw, 'local');
    if (!v) {
      set({ notice: 'A car needs at least a make and a model' });
      return null;
    }
    v.id = `local-${Date.now().toString(36)}`;
    const save = get().save;
    set({ save: commit({ ...save, localVehicles: [...save.localVehicles, v].slice(-20), activeId: v.id }), notice: `${displayName(v)} added` });
    return v;
  },
  removeVehicle: (id) => {
    const save = get().save;
    set({ save: commit({ ...save, localVehicles: save.localVehicles.filter((v) => v.id !== id), activeId: save.activeId === id ? null : save.activeId }) });
  },
  upgrade: (id) => {
    const r = buyUpgrade(get().save, get().active(), id);
    if (!r.ok) {
      set({ notice: r.reason });
      return false;
    }
    set({ save: commit(r.save), notice: '' });
    return true;
  },
  repair: () => {
    const r = repair(get().save, get().active());
    if (!r.ok) {
      set({ notice: r.reason });
      return false;
    }
    set({ save: commit(r.save), notice: '' });
    return true;
  },
  patch: () => {
    const r = patchUp(get().save, get().active());
    if (!r.ok) {
      set({ notice: r.reason });
      return false;
    }
    set({ save: commit(r.save), notice: 'Patched up enough to drive' });
    return true;
  },
  finish: (health, coins, score) => set({ save: commit(finishRun(get().save, get().active(), health, coins, score)) }),
  importFromHost: (g, fromHost) => {
    let save = get().save;
    // progress kept on the player's account wins over this browser's copy
    if (g.progress) save = { ...g.progress, localVehicles: save.localVehicles };
    const primary = g.vehicles.find((v) => v.primary) ?? g.vehicles[0];
    if (!g.vehicles.some((v) => v.id === save.activeId) && !save.localVehicles.some((v) => v.id === save.activeId)) save = { ...save, activeId: primary.id };
    storeSave(save);
    set({ hostVehicles: g.vehicles, hostConnected: fromHost || get().hostConnected, save });
  },
}));

let bridge: HostBridge | null = null;

/** start listening to the host page (and read #garage= from the URL) */
export function startBridge() {
  if (bridge) return bridge;
  bridge = new HostBridge((g) => useGarage.getState().importFromHost(g, bridge?.connected ?? false));
  bridge.start();
  return bridge;
}

export function hostBridge() {
  return bridge;
}
