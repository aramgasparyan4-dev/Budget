// Garage screens: the car card on the title screen, the workshop (repairs and upgrades), the
// garage list and the "add a vehicle" form, the garage part of the results, and touch controls.
// Laid out like the list.am Garage: a white card per car on light grey, blue actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nm } from './DriveGame';
import { useNM } from './store';
import { useGarage, hostBridge } from './garage/store';
import { ARCHETYPES, ARCHETYPE, ratings, type ArchetypeId } from './garage/archetypes';
import { knownMakes, knownModels, makeName } from './garage/catalog';
import { archetypeOf, displayName, paintOf, type GarageVehicle } from './garage/vehicle';
import { MAX_LEVEL, MIN_HEALTH, progressOf, repairCost, upgradeCost, UPGRADES } from './garage/progress';
import { RULES } from './scoring';
import { VEHICLES } from '../sim/vehicles';
import type { GarageResult } from './store';
import { Badge, Bar, Button, Card, Coins, fmt, Label, Mark, Sheet } from './ui';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function healthTone(h: number): 'ok' | 'warn' | 'hot' {
  return h >= 60 ? 'ok' : h >= 35 ? 'warn' : 'hot';
}

function Swatch({ color }: { color: number }) {
  return <span className="w-4 h-4 rounded-full shrink-0 border border-line" style={{ background: hex(color) }} />;
}

/** a 10-segment bar; segments earned by upgrades show in light blue after the base ones */
function StatBar({ label, base, total }: { label: string; base: number; total: number }) {
  const b = Math.round(Math.min(1, base) * 10);
  const t = Math.max(b, Math.round(Math.min(1, total) * 10));
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-xs text-muted whitespace-nowrap">{label}</div>
      <div className="flex-1 flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < b ? 'bg-brand' : i < t ? 'bg-brand/35' : 'bg-line'}`} />
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

// ------------------------------------------------------------------ title card
export function GarageCard() {
  const { v, setup, save } = useActive();
  const setPanel = useGarage((s) => s.setPanel);
  const notice = useGarage((s) => s.notice);
  const own = useGarage.getState().ownCount();
  const demo = v.id.startsWith('demo-');
  const a = setup.archetype;
  const r = ratings(a);
  const h = setup.progress.health;
  const cost = repairCost(a, h);
  const hits = hitsLeft(h, setup.damageTaken);
  return (
    <Card id="garage-card" className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="display text-xl">My Garage</div>
        <Button id="btn-garage" variant="tint" size="sm" onClick={() => setPanel('garage')}>
          {own === 0 ? 'Add new vehicle' : `Garage · ${own}`}
        </Button>
      </div>

      <div className="rounded-xl bg-card p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Swatch color={paintOf(v.color, VEHICLES[a.type].palette[0])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span id="garage-name" className="display text-lg leading-tight">
                {displayName(v)}
              </span>
              <Badge tone={demo ? 'grey' : 'brand'}>{demo ? 'Test drive' : v.primary ? 'Primary' : 'Yours'}</Badge>
            </div>
            <div className="text-sm text-muted mt-0.5">
              Drives as{' '}
              <span id="garage-type" className="text-brand font-semibold">
                {a.name}
              </span>{' '}
              · {a.best}
            </div>
          </div>
        </div>
        <div className="text-xs text-ink-2 leading-snug short:hidden">{a.perk}</div>

        <div className="rounded-lg bg-paper p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Label className="w-20">Condition</Label>
            <Bar value={h / 100} tone={healthTone(h)} className="flex-1 h-2" />
            <span id="garage-health" className="text-sm font-semibold tabular-nums w-10 text-right">
              {Math.round(h)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              {h < MIN_HEALTH ? <span className="text-hot font-semibold">Too damaged to drive: repair it first</span> : `Can take ${hits} more big hit${hits === 1 ? '' : 's'}`}
            </span>
            {cost > 0 && (
              <Button id="btn-repair" variant="primary" size="sm" className="ml-auto" onClick={() => useGarage.getState().repair()}>
                <RepairLabel cost={cost} coins={save.coins} health={h} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 short:hidden">
          <StatBar label="Top speed" base={r.top} total={r.top * setup.top} />
          <StatBar label="Acceleration" base={r.accel} total={r.accel * setup.power} />
          <StatBar label="Handling" base={r.handling} total={r.handling * setup.grip} />
          <StatBar label="Toughness" base={r.toughness} total={(r.toughness * (1 / setup.damageTaken)) / a.perks.toughness} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button id="btn-workshop" variant="tint" onClick={() => setPanel('workshop')}>
          Workshop
        </Button>
        {/* the header shows the wallet on wider screens */}
        <span className="ml-auto inline-flex sm:hidden items-center h-8 px-3 rounded-full bg-mist">
          <Coins n={save.coins} />
        </span>
      </div>
      {notice && <div className="text-sm text-brand">{notice}</div>}
    </Card>
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
    <Sheet id={id} title={title} onClose={onClose}>
      {children}
    </Sheet>
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
          <div className="font-semibold">{displayName(v)}</div>
          <div className="text-sm text-muted">{a.name}</div>
        </div>
        <span className="inline-flex items-center h-10 px-4 rounded-full bg-mist">
          <Coins n={save.coins} big />
        </span>
      </div>
      <div className="rounded-xl bg-card p-4 flex items-center gap-3 flex-wrap">
        <Label>Condition</Label>
        <Bar value={h / 100} tone={healthTone(h)} className="w-40 h-2" />
        <span className="font-semibold tabular-nums">{Math.round(h)}%</span>
        <div className="ml-auto flex gap-2">
          {broke ? (
            <Button id="btn-patch" size="sm" onClick={() => g.patch()}>
              Free patch-up
            </Button>
          ) : (
            <Button id="btn-repair-full" size="sm" disabled={cost === 0} onClick={() => g.repair()}>
              {cost === 0 ? 'Like new' : <RepairLabel cost={cost} coins={save.coins} health={h} />}
            </Button>
          )}
          {host && cost > 0 && (
            <Button
              variant="tint"
              size="sm"
              onClick={() => hostBridge()?.send({ type: 'mygarage:services', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'repair' })}
            >
              Find a real mechanic
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {UPGRADES.map((u) => {
          const lvl = setup.progress.upgrades[u.id];
          const c = upgradeCost(a, lvl);
          return (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{u.name}</div>
                <div className="text-sm text-muted">{u.effect}</div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: MAX_LEVEL }, (_, i) => (
                  <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < lvl ? 'bg-brand' : 'bg-line'}`} />
                ))}
              </div>
              <Button id={`up-${u.id}`} variant="tint" size="sm" className="w-28" disabled={c === null || save.coins < c} onClick={() => g.upgrade(u.id)}>
                {c === null ? 'Maxed' : <>Buy · {fmt(c)}</>}
              </Button>
            </div>
          );
        })}
      </div>
      {host && (
        <Button
          variant="tint"
          className="self-start"
          onClick={() => hostBridge()?.send({ type: 'mygarage:parts', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'performance' })}
        >
          Go to parts that fit this car →
        </Button>
      )}
      {g.notice && <div className="text-sm text-brand">{g.notice}</div>}
      <div className="text-xs text-muted">
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
      <div key={x.id} className={`flex items-center gap-3 p-3 rounded-xl ${on ? 'bg-brand-tint' : 'bg-card'}`}>
        <Swatch color={paintOf(x.color, VEHICLES[a.type].palette[0])} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {displayName(x)}
            {x.primary && <Badge>Primary</Badge>}
          </div>
          <div className="text-sm text-muted">
            {a.name} · {Math.round(p.health)}%
          </div>
        </div>
        {x.source === 'local' && !x.id.startsWith('demo-') && (
          <Button variant="ghost" size="sm" onClick={() => g.removeVehicle(x.id)}>
            Remove
          </Button>
        )}
        <Button
          data-car={x.id}
          variant={on ? 'tint' : 'primary'}
          size="sm"
          onClick={() => {
            g.setActive(x.id);
            g.setPanel('none');
          }}
        >
          {on ? 'Driving' : 'Drive'}
        </Button>
      </div>
    );
  };
  return (
    <Panel id="garage-list" title="My Garage" onClose={() => g.setPanel('none')}>
      <div className="text-sm text-ink-2">Saved vehicles drive in the game. Each keeps its own condition and upgrades.</div>
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
        <Label>{fromHost ? 'From your Garage' : 'Your cars'}</Label>
        {mine.length ? mine.map(row) : <div className="text-sm text-muted rounded-xl bg-card p-4">No cars yet. Add yours and the game drives it.</div>}
        <Label className="mt-3">Test drive · one of each kind</Label>
        {demos.map(row)}
      </div>
      <Button id="btn-add-car" variant="tint" className="self-start" onClick={() => g.setPanel('add')}>
        + Add new vehicle
      </Button>
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
  // the list.am form look: grey filled fields, no border, blue focus ring
  const sel = 'w-full h-11 rounded-lg bg-mist px-3 text-[15px] text-ink border-0 outline-none focus:ring-2 focus:ring-brand';
  const label = 'text-sm font-medium text-ink mb-1.5 block';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel id="add-vehicle" title="Add a vehicle" onClose={() => g.setPanel('garage')}>
      <div className="text-sm text-ink-2 -mt-2">Add your vehicle once and drive it in the game. Only make and model are needed; the rest fine-tune how it drives.</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
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
          <input id="f-model" className={sel} list="f-models" placeholder="Select model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={40} />
          <datalist id="f-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <Field label="Year">
          <select id="f-year" className={sel} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Select year</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="Color">
          <select id="f-color" className={sel} value={f.color} onChange={set('color')}>
            <option value="">—</option>
            {COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Engine">
          <select id="f-engine" className={sel} value={f.engine} onChange={set('engine')}>
            <option value="">—</option>
            <option value="petrol">Gasoline</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
            <option value="gas">Gas (LPG / CNG)</option>
          </select>
        </Field>
        <Field label="Gas equipment">
          <select className={sel} value={f.gasEquipment} onChange={set('gasEquipment')}>
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Wheel size">
          <select className={sel} value={f.wheelSize} onChange={set('wheelSize')}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => 13 + i).map((n) => (
              <option key={n} value={n}>
                R{n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Current condition">
          <select className={sel} value={f.condition} onChange={set('condition')}>
            <option value="">—</option>
            <option value="not_damaged">Not damaged</option>
            <option value="damaged">Damaged</option>
          </select>
        </Field>
        <Field label="Steering wheel">
          <select className={sel} value={f.steeringWheel} onChange={set('steeringWheel')}>
            <option value="">—</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Field label="Headlights">
          <select className={sel} value={f.headlights} onChange={set('headlights')}>
            <option value="">—</option>
            <option value="halogen">Halogen</option>
            <option value="xenon">Xenon</option>
            <option value="led">LED</option>
          </select>
        </Field>
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
        <div id="f-match" className="text-sm rounded-xl bg-brand-tint text-ink px-4 py-3">
          {makeName(realMake)} {model} drives as a <b className="text-brand">{ARCHETYPE[match.archetype].name}</b>. {ARCHETYPE[match.archetype].perk}
        </div>
      )}
      {g.notice && <div className="text-sm text-brand">{g.notice}</div>}
      {/* as in the Garage's "Confirm vehicle details": a grey button and a blue one, side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" size="lg" className="bg-mist" onClick={() => g.setPanel('garage')}>
          Back
        </Button>
        <Button
          id="btn-save-car"
          size="lg"
          disabled={!realMake || !model}
          onClick={() => {
            const v = g.addVehicle({ make: makeName(realMake), model, year, ...f, archetype: f.archetype || undefined });
            if (v) g.setPanel('none');
          }}
        >
          Save vehicle
        </Button>
      </div>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-ink mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ results
export function GarageResults({ g }: { g: GarageResult }) {
  const save = useGarage((s) => s.save);
  const { setup } = useActive();
  const cost = repairCost(setup.archetype, setup.progress.health);
  const h = setup.progress.health;
  return (
    <div id="garage-result" className="rounded-xl bg-card p-4 flex items-center gap-x-8 gap-y-3 flex-wrap">
      <div>
        <Label>Coins earned</Label>
        <div className="display text-2xl text-brand">+{fmt(g.coins)}</div>
      </div>
      <div>
        <Label>Wallet</Label>
        <Coins n={save.coins} big />
      </div>
      <div className="flex-1 min-w-48">
        <Label>Condition {g.damage > 0 ? <span className="text-hot font-semibold">−{g.damage}%</span> : <span className="text-ok font-semibold">no damage</span>}</Label>
        <div className="flex items-center gap-2 mt-1.5">
          <Bar value={h / 100} tone={healthTone(h)} className="flex-1 h-2" />
          <span className="tabular-nums text-sm font-semibold">{Math.round(h)}%</span>
        </div>
      </div>
      {cost > 0 && save.coins > 0 && (
        <Button id="btn-repair-result" size="sm" onClick={() => useGarage.getState().repair()}>
          <RepairLabel cost={cost} coins={save.coins} health={h} />
        </Button>
      )}
      {h < MIN_HEALTH && cost > 0 && save.coins <= cost / 2 && (
        <Button id="btn-patch-result" variant="tint" size="sm" onClick={() => useGarage.getState().patch()}>
          Free patch-up
        </Button>
      )}
    </div>
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
  const pad = 'rounded-full bg-paper/85 lift flex items-center justify-center font-bold text-ink';
  return (
    <div id="touch-controls" className="absolute inset-0 pointer-events-none">
      <div className="absolute left-4 bottom-4 flex gap-3">
        <Hold id="t-left" code="KeyA" className={`${pad} w-20 h-20 text-2xl`}>
          ◀
        </Hold>
        <Hold id="t-right" code="KeyD" className={`${pad} w-20 h-20 text-2xl`}>
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
          <Hold id="t-boost" code="ShiftLeft" className={`${pad} w-14 h-14 text-xs !bg-brand-tint !text-brand`}>
            Boost
          </Hold>
          <Hold id="t-gas" code="KeyW" className={`${pad} w-20 h-24 text-lg !rounded-2xl !bg-brand !text-white`}>
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
    <div className="absolute inset-0 bg-paper flex flex-col items-center justify-center gap-3 text-center p-8 pointer-events-auto">
      <Mark size={56} />
      <div className="display text-2xl">Turn your phone sideways</div>
      <div className="text-ink-2 text-sm">The road needs the width.</div>
    </div>
  );
}
