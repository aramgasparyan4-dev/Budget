// Garage screens: the car card on the title screen, the workshop (repairs and upgrades), the
// garage list and the "add a vehicle" form, the garage part of the results, and touch controls.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nm } from './NearMissGame';
import { useNM } from './store';
import { useGarage, hostBridge } from './garage/store';
import { ARCHETYPES, ARCHETYPE, ratings, type ArchetypeId } from './garage/archetypes';
import { knownMakes, knownModels, makeName } from './garage/catalog';
import { archetypeOf, displayName, paintOf, type GarageVehicle } from './garage/vehicle';
import { MAX_LEVEL, MIN_HEALTH, progressOf, repairCost, upgradeCost, UPGRADES } from './garage/progress';
import { RULES } from './scoring';
import { VEHICLES } from '../sim/vehicles';
import type { GarageResult } from './store';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function Coins({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${big ? 'display font-black text-3xl' : 'font-semibold'}`}>
      <span className={`${big ? 'w-4 h-4' : 'w-2.5 h-2.5'} rounded-full bg-amber shadow-[0_0_8px_rgba(255,176,0,0.7)]`} />
      {fmt(n)}
    </span>
  );
}

function healthColor(h: number) {
  return h >= 60 ? 'bg-[#4ade80]' : h >= 35 ? 'bg-amber' : 'bg-brake';
}

export function ConditionBar({ health, wide = false }: { health: number; wide?: boolean }) {
  return (
    <div className={`${wide ? 'w-full' : 'w-40'} h-2 bg-white/10 overflow-hidden`}>
      <div className={`h-full ${healthColor(health)} transition-all`} style={{ width: `${Math.max(0, Math.min(100, health))}%` }} />
    </div>
  );
}

/** a 10-segment bar; segments earned by upgrades show in white after the base amber ones */
function StatBar({ label, base, total }: { label: string; base: number; total: number }) {
  const b = Math.round(Math.min(1, base) * 10);
  const t = Math.max(b, Math.round(Math.min(1, total) * 10));
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/45 whitespace-nowrap">{label}</div>
      <div className="flex-1 flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 ${i < b ? 'bg-amber' : i < t ? 'bg-beam' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  );
}

/** big hits the car is sure to survive from its current condition (counting the hardest kind) */
function hitsLeft(health: number, damageTaken: number) {
  return Math.max(0, Math.ceil(health / (RULES.bigHitCap * damageTaken)) - 1);
}

function useActive() {
  // re-render on any garage change
  const save = useGarage((s) => s.save);
  const host = useGarage((s) => s.hostVehicles);
  return useMemo(() => {
    const g = useGarage.getState();
    return { v: g.active(), setup: g.setup(), list: g.vehicles(), save };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, host]);
}

// ------------------------------------------------------------------ title card
export function GarageCard() {
  const { v, setup, list, save } = useActive();
  const setPanel = useGarage((s) => s.setPanel);
  const notice = useGarage((s) => s.notice);
  const a = setup.archetype;
  const r = ratings(a);
  const h = setup.progress.health;
  const cost = repairCost(a, h);
  const own = useGarage.getState().ownCount();
  const demo = v.id.startsWith('demo-');
  return (
    <div id="garage-card" className="flex flex-col gap-2.5 bg-asphalt/70 border border-white/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{demo ? 'Test drive' : 'Your car'}</div>
        <Coins n={save.coins} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ background: hex(paintOf(v.color, VEHICLES[a.type].palette[0])) }} />
        <span id="garage-name" className="display font-black text-2xl uppercase leading-tight truncate">
          {displayName(v)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span id="garage-type" className="display font-bold uppercase text-sm px-2 bg-amber text-asphalt">
          {a.name}
        </span>
        <span className="text-xs text-white/70">Best: {a.best}</span>
      </div>
      <div className="text-xs text-white/55 leading-snug short:hidden">{a.perk}</div>
      <div className="flex items-center gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 w-20">Condition</div>
        <ConditionBar health={h} />
        <span id="garage-health" className="text-sm tabular-nums">
          {Math.round(h)}%
        </span>
        {cost > 0 && (
          <button id="btn-repair" onClick={() => useGarage.getState().repair()} className="ml-auto text-xs px-2 py-1 border border-white/20 hover:border-amber">
            <RepairLabel cost={cost} coins={save.coins} health={h} />
          </button>
        )}
      </div>
      <div className="text-[11px] text-white/45 -mt-1">
        {h < MIN_HEALTH ? (
          <span className="text-brake">Too damaged to drive: repair it first</span>
        ) : (
          `Can take ${hitsLeft(h, setup.damageTaken)} more big hit${hitsLeft(h, setup.damageTaken) === 1 ? '' : 's'}`
        )}
      </div>
      <div className="flex flex-col gap-1.5 short:hidden">
        <StatBar label="Top speed" base={r.top} total={r.top * setup.top} />
        <StatBar label="Accel" base={r.accel} total={r.accel * setup.power} />
        <StatBar label="Handling" base={r.handling} total={r.handling * setup.grip} />
        <StatBar label="Toughness" base={r.toughness} total={(r.toughness * (1 / setup.damageTaken)) / a.perks.toughness} />
      </div>
      <div className="flex gap-2 mt-1">
        <button id="btn-workshop" onClick={() => setPanel('workshop')} className="display font-bold uppercase text-lg px-3 py-1.5 bg-beam text-asphalt hover:brightness-110">
          Workshop
        </button>
        <button id="btn-garage" onClick={() => setPanel('garage')} className="display font-bold uppercase text-lg px-3 py-1.5 border border-white/20 hover:border-white/50">
          {own === 0 ? 'Add your car' : `Garage · ${own}`}
        </button>
      </div>
      {notice && <div className="text-xs text-amber">{notice}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ panels
function Panel({ title, children, onClose, id }: { title: string; children: React.ReactNode; onClose: () => void; id: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', k, { capture: true });
    return () => window.removeEventListener('keydown', k, { capture: true });
  }, [onClose]);
  return (
    <div className="absolute inset-0 bg-asphalt/80 pointer-events-auto flex items-start sm:items-center justify-center overflow-y-auto p-4 rise" data-modal onClick={onClose}>
      <div id={id} className="w-full max-w-xl bg-tarmac border border-white/10 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <div className="display font-black text-3xl uppercase">{title}</div>
          <button onClick={onClose} aria-label="Close" className="text-2xl text-white/60 hover:text-white px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GaragePanels() {
  const panel = useGarage((s) => s.panel);
  if (panel === 'workshop') return <Workshop />;
  if (panel === 'garage') return <GarageList />;
  if (panel === 'add') return <AddVehicle />;
  return null;
}

function Workshop() {
  const { v, setup, save } = useActive();
  const g = useGarage();
  const a = setup.archetype;
  const h = setup.progress.health;
  const cost = repairCost(a, h);
  const broke = h < MIN_HEALTH && save.coins < cost / 2;
  const host = hostBridge()?.connected;
  return (
    <Panel id="workshop" title="Workshop" onClose={() => g.setPanel('none')}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="display font-bold text-xl uppercase">{displayName(v)}</div>
          <div className="text-xs text-white/55">{a.name}</div>
        </div>
        <Coins n={save.coins} big />
      </div>
      <div className="flex items-center gap-3 flex-wrap border-y border-white/10 py-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Condition</div>
        <ConditionBar health={h} />
        <span className="tabular-nums">{Math.round(h)}%</span>
        <div className="ml-auto flex gap-2">
          {broke ? (
            <button id="btn-patch" onClick={() => g.patch()} className="text-sm px-3 py-1.5 bg-amber text-asphalt font-semibold">
              Free patch-up
            </button>
          ) : (
            <button id="btn-repair-full" disabled={cost === 0} onClick={() => g.repair()} className="text-sm px-3 py-1.5 bg-amber text-asphalt font-semibold disabled:opacity-30">
              {cost === 0 ? 'Like new' : <>Repair · {fmt(cost)}</>}
            </button>
          )}
          {host && cost > 0 && (
            <button
              onClick={() => hostBridge()?.send({ type: 'nearmiss:services', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'repair' })}
              className="text-sm px-3 py-1.5 border border-white/20 hover:border-white/50"
            >
              Find a real mechanic
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-white/8">
        {UPGRADES.map((u) => {
          const lvl = setup.progress.upgrades[u.id];
          const c = upgradeCost(a, lvl);
          return (
            <div key={u.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-white/50">{u.effect}</div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: MAX_LEVEL }, (_, i) => (
                  <span key={i} className={`w-2.5 h-2.5 ${i < lvl ? 'bg-amber' : 'bg-white/12'}`} />
                ))}
              </div>
              <button
                id={`up-${u.id}`}
                disabled={c === null || save.coins < c}
                onClick={() => g.upgrade(u.id)}
                className="w-28 text-sm px-2 py-1.5 border border-amber/60 text-amber hover:bg-amber hover:text-asphalt disabled:border-white/10 disabled:text-white/30 disabled:hover:bg-transparent"
              >
                {c === null ? 'Maxed' : <>Buy · {fmt(c)}</>}
              </button>
            </div>
          );
        })}
      </div>
      {host && (
        <button
          onClick={() => hostBridge()?.send({ type: 'nearmiss:parts', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'performance' })}
          className="self-start text-sm text-oncoming hover:underline"
        >
          Shop real parts that fit this car →
        </button>
      )}
      {g.notice && <div className="text-sm text-amber">{g.notice}</div>}
      <div className="text-xs text-white/40">
        Coins come from runs ({a.perks.cashMul > 1 ? `this car earns ${Math.round((setup.cashMul - 1) * 100)}% extra` : 'about 1 coin per 20 points'}) and races (400+ for a win).
      </div>
    </Panel>
  );
}

function GarageList() {
  const { v: active, list, save } = useActive();
  const g = useGarage();
  const fromHost = list.some((x) => x.source === 'host');
  const mine = list.filter((x) => !x.id.startsWith('demo-'));
  const demos = list.filter((x) => x.id.startsWith('demo-'));
  const row = (x: GarageVehicle) => {
    const a = ARCHETYPE[archetypeOf(x).archetype];
    const p = progressOf(save, x);
    const on = x.id === active.id;
    return (
      <div key={x.id} className={`flex items-center gap-3 p-2.5 border ${on ? 'border-amber bg-amber/10' : 'border-white/10'}`}>
        <span className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ background: hex(paintOf(x.color, VEHICLES[a.type].palette[0])) }} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {displayName(x)}
            {x.primary && <span className="ml-2 text-[10px] uppercase px-1 bg-oncoming/20 text-oncoming">Primary</span>}
          </div>
          <div className="text-xs text-white/50">
            {a.name} · {Math.round(p.health)}%
          </div>
        </div>
        {x.source === 'local' && !x.id.startsWith('demo-') && (
          <button onClick={() => g.removeVehicle(x.id)} className="text-xs text-white/40 hover:text-brake">
            Remove
          </button>
        )}
        <button
          data-car={x.id}
          onClick={() => {
            g.setActive(x.id);
            g.setPanel('none');
          }}
          className={`text-sm px-3 py-1 ${on ? 'text-amber' : 'border border-white/20 hover:border-white/50'}`}
        >
          {on ? 'Driving' : 'Drive'}
        </button>
      </div>
    );
  };
  return (
    <Panel id="garage-list" title="Garage" onClose={() => g.setPanel('none')}>
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{fromHost ? 'From your garage' : 'Your cars'}</div>
        {mine.length ? mine.map(row) : <div className="text-sm text-white/55">No cars yet. Add yours and the game drives it, with its own condition and upgrades.</div>}
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45 mt-3">Test drive · one of each kind</div>
        {demos.map(row)}
      </div>
      <button id="btn-add-car" onClick={() => g.setPanel('add')} className="self-start display font-bold uppercase text-lg px-4 py-2 bg-amber text-asphalt">
        + Add a vehicle
      </button>
    </Panel>
  );
}

const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Burgundy', 'Blue', 'Light blue', 'Green', 'Yellow', 'Orange', 'Gold', 'Beige', 'Brown', 'Purple', 'Pink'];
const YEARS = Array.from({ length: 2026 - 1960 + 1 }, (_, i) => 2026 - i);

function AddVehicle() {
  const g = useGarage();
  const makes = useMemo(() => knownMakes(), []);
  const [make, setMake] = useState('');
  const [otherMake, setOtherMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [f, setF] = useState({ color: '', engine: '', gasEquipment: '', wheelSize: '', steeringWheel: '', headlights: '', condition: '', archetype: '' });
  const realMake = make === '__other' ? otherMake : make;
  const models = useMemo(() => (make && make !== '__other' ? knownModels(make) : []), [make]);
  const draft: Partial<GarageVehicle> = {
    make: realMake,
    model,
    year: year ? Number(year) : undefined,
    engine: (f.engine || undefined) as GarageVehicle['engine'],
    archetype: (f.archetype || undefined) as ArchetypeId | undefined,
  };
  const match = realMake && model ? archetypeOf(draft as GarageVehicle) : null;
  const sel = 'w-full bg-asphalt border border-white/15 px-2 py-2 text-sm focus:border-amber outline-none';
  const label = 'text-[10px] uppercase tracking-[0.18em] text-white/50 mb-1 block';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel id="add-vehicle" title="Add a vehicle" onClose={() => g.setPanel('garage')}>
      <div className="text-sm text-white/60">The same details as your garage. Only make and model are needed; the rest fine-tune how it drives.</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={label}>Make</label>
          <select id="f-make" className={sel} value={make} onChange={(e) => setMake(e.target.value)}>
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
            <option value="__other">Other…</option>
          </select>
          {make === '__other' && <input className={`${sel} mt-2`} placeholder="Make" value={otherMake} onChange={(e) => setOtherMake(e.target.value)} maxLength={40} />}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={label}>Model</label>
          <input id="f-model" className={sel} list="f-models" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={40} />
          <datalist id="f-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label}>Year</label>
          <select id="f-year" className={sel} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">—</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Color</label>
          <select id="f-color" className={sel} value={f.color} onChange={set('color')}>
            <option value="">—</option>
            {COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Engine</label>
          <select id="f-engine" className={sel} value={f.engine} onChange={set('engine')}>
            <option value="">—</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
            <option value="gas">Gas (LPG / CNG)</option>
          </select>
        </div>
        <div>
          <label className={label}>Gas equipment</label>
          <select className={sel} value={f.gasEquipment} onChange={set('gasEquipment')}>
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div>
          <label className={label}>Wheel size</label>
          <select className={sel} value={f.wheelSize} onChange={set('wheelSize')}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => 13 + i).map((n) => (
              <option key={n} value={n}>
                R{n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Current condition</label>
          <select className={sel} value={f.condition} onChange={set('condition')}>
            <option value="">—</option>
            <option value="not_damaged">Not damaged</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
        <div>
          <label className={label}>Steering wheel</label>
          <select className={sel} value={f.steeringWheel} onChange={set('steeringWheel')}>
            <option value="">—</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          <label className={label}>Headlights</label>
          <select className={sel} value={f.headlights} onChange={set('headlights')}>
            <option value="">—</option>
            <option value="halogen">Halogen</option>
            <option value="xenon">Xenon</option>
            <option value="led">LED</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>Drives as</label>
          <select id="f-archetype" className={sel} value={f.archetype} onChange={set('archetype')}>
            <option value="">Automatic{match && !f.archetype ? ` (${ARCHETYPE[match.archetype].name})` : ''}</option>
            {ARCHETYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}: {a.best.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
      {match && (
        <div id="f-match" className="text-sm border-l-2 border-amber pl-3">
          {makeName(realMake)} {model} drives as a <b>{ARCHETYPE[match.archetype].name}</b>. {ARCHETYPE[match.archetype].perk}
        </div>
      )}
      {g.notice && <div className="text-sm text-amber">{g.notice}</div>}
      <div className="flex gap-2">
        <button
          id="btn-save-car"
          disabled={!realMake || !model}
          onClick={() => {
            const v = g.addVehicle({ make: makeName(realMake), model, year, ...f, archetype: f.archetype || undefined });
            if (v) g.setPanel('none');
          }}
          className="display font-black uppercase text-xl px-5 py-2 bg-amber text-asphalt disabled:opacity-30"
        >
          Save vehicle
        </button>
        <button onClick={() => g.setPanel('garage')} className="px-4 py-2 border border-white/20">
          Back
        </button>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ results
export function GarageResults({ g }: { g: GarageResult }) {
  const save = useGarage((s) => s.save);
  const { setup } = useActive();
  const cost = repairCost(setup.archetype, setup.progress.health);
  return (
    <div id="garage-result" className="flex items-center gap-x-8 gap-y-3 flex-wrap border border-white/10 bg-white/[0.03] px-4 py-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">Coins earned</div>
        <div className="display font-black text-3xl text-amber tabular-nums">+{fmt(g.coins)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">Wallet</div>
        <Coins n={save.coins} big />
      </div>
      <div className="flex-1 min-w-48">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
          Condition {g.damage > 0 ? <span className="text-brake">−{g.damage}%</span> : <span className="text-[#4ade80]">no damage</span>}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <ConditionBar health={setup.progress.health} wide />
          <span className="tabular-nums text-sm">{Math.round(setup.progress.health)}%</span>
        </div>
      </div>
      {cost > 0 && save.coins > 0 && (
        <button id="btn-repair-result" onClick={() => useGarage.getState().repair()} className="text-sm px-3 py-2 border border-white/20 hover:border-amber">
          <RepairLabel cost={cost} coins={save.coins} health={setup.progress.health} />
        </button>
      )}
      {setup.progress.health < MIN_HEALTH && cost > 0 && save.coins <= cost / 2 && (
        <button id="btn-patch-result" onClick={() => useGarage.getState().patch()} className="text-sm px-3 py-2 bg-amber text-asphalt font-semibold">
          Free patch-up
        </button>
      )}
    </div>
  );
}

/** "Repair · 900", or what the coins in hand will fix */
export function RepairLabel({ cost, coins, health }: { cost: number; coins: number; health: number }) {
  if (coins >= cost) return <>Repair · {fmt(cost)}</>;
  const pts = Math.floor(coins / (cost / (100 - health)));
  return (
    <>
      Fix {pts}% · {fmt(coins)}
    </>
  );
}

// ------------------------------------------------------------------ touch
/** true on phones and tablets (or with ?touch=1) */
export function isTouch() {
  try {
    return new URLSearchParams(location.search).get('touch') === '1' || matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function Hold({ code, children, className, id }: { code: string; children: React.ReactNode; className: string; id?: string }) {
  const held = useRef(new Set<number>());
  const up = (e: React.PointerEvent) => {
    held.current.delete(e.pointerId);
    if (!held.current.size) nm.input.keys.delete(code);
  };
  return (
    <button
      id={id}
      className={`pointer-events-auto select-none touch-none active:scale-95 transition-transform ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        held.current.add(e.pointerId);
        nm.input.keys.add(code);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** on-screen controls: steer on the left, pedals on the right, boost and drift above the pedals */
export function TouchControls() {
  const phase = useNM((s) => s.phase);
  const paused = useNM((s) => s.paused);
  const racing = useNM((s) => s.race !== null);
  useEffect(
    () => () => {
      for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'Space']) nm.input.keys.delete(k);
    },
    [],
  );
  if ((phase !== 'run' && phase !== 'countdown') || paused) return null;
  const pad = 'rounded-full bg-white/10 border border-white/25 backdrop-blur-sm flex items-center justify-center display font-black uppercase text-beam/90';
  return (
    <div id="touch-controls" className="absolute inset-0 pointer-events-none">
      <div className="absolute left-4 bottom-4 flex gap-3">
        <Hold id="t-left" code="KeyA" className={`${pad} w-20 h-20 text-3xl`}>
          ◀
        </Hold>
        <Hold id="t-right" code="KeyD" className={`${pad} w-20 h-20 text-3xl`}>
          ▶
        </Hold>
      </div>
      <div className="absolute right-4 bottom-4 flex items-end gap-3">
        <div className="flex flex-col gap-3 items-center">
          <Hold id="t-drift" code="Space" className={`${pad} w-14 h-14 text-xs`}>
            Drift
          </Hold>
          <Hold id="t-brake" code="KeyS" className={`${pad} w-16 h-16 text-sm`}>
            Brake
          </Hold>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <Hold id="t-boost" code="ShiftLeft" className={`${pad} w-14 h-14 text-xs bg-amber/25 border-amber/60`}>
            Boost
          </Hold>
          <Hold id="t-gas" code="KeyW" className={`${pad} w-20 h-24 text-lg rounded-2xl`}>
            Gas
          </Hold>
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex gap-2">
        <button onClick={() => nm.togglePause()} className={`pointer-events-auto ${pad} w-11 h-11 text-sm`} aria-label="Pause">
          II
        </button>
        {racing && (
          <button onClick={() => nm.backOnTrack()} className={`pointer-events-auto ${pad} w-11 h-11 text-[10px]`} aria-label="Back on track">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

/** phones held upright: driving needs the screen sideways */
export function RotateNotice() {
  const phase = useNM((s) => s.phase);
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const f = () => setPortrait(window.innerHeight > window.innerWidth * 1.1);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  if (!portrait || (phase !== 'run' && phase !== 'countdown')) return null;
  return (
    <div className="absolute inset-0 bg-asphalt/95 flex flex-col items-center justify-center gap-3 text-center p-8 pointer-events-auto">
      <div className="text-5xl">⟳</div>
      <div className="display font-black text-3xl uppercase">Turn your phone sideways</div>
      <div className="text-white/60 text-sm">The road needs the width.</div>
    </div>
  );
}
