// Garage screens: the car card in the title sidebar, the workshop (repairs and upgrades), the car
// list and the "add new vehicle" form, the garage part of the results, and touch controls. Laid
// out like the list.am Garage: white, hairline borders, grey tiles of details, one blue action.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BatteryCharging,
  Banknote,
  ChevronDown,
  CloudRain,
  Coins as CoinsIcon,
  Crown,
  Disc,
  Ellipsis,
  Flame,
  Gauge,
  Pause as PauseIcon,
  Plus,
  Trash2,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Wind,
  Wrench,
  Zap,
  Car,
  CircleGauge,
  Cog,
} from 'lucide-react';
import { nm } from './DriveGame';
import { useNM } from './store';
import { useGarage, hostBridge } from './garage/store';
import { ARCHETYPES, ARCHETYPE, topSpeedKmh, zeroToHundred, type ArchetypeId } from './garage/archetypes';
import { knownMakes, knownModels, makeName } from './garage/catalog';
import { archetypeOf, paintOf, type GarageVehicle } from './garage/vehicle';
import { MAX_LEVEL, MIN_HEALTH, progressOf, repairCost, upgradeCost, UPGRADES, type UpgradeId } from './garage/progress';
import { RULES } from './scoring';
import { VEHICLES } from '../sim/vehicles';
import { engineFor } from '../engine/engineSound';
import type { GarageResult } from './store';
import { Badge, Bar, Button, Coins, fmt, IconButton, Label, Mark, Sheet, Tile, Tiles } from './ui';
import { useCarThumb } from './thumbs';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const ICON = { size: 18, strokeWidth: 1.6 };

/** condition bars: red once the car counts as damaged */
export function healthTone(h: number): 'brand' | 'alert' {
  return h < RULES.damagedBelow ? 'alert' : 'brand';
}

const PERK_ICON: Record<ArchetypeId, typeof Car> = {
  compact: Banknote,
  sedan: CoinsIcon,
  exec: Zap,
  sports: Gauge,
  hatch: Wind,
  crossover: CloudRain,
  offroad: Shield,
  utility: Sparkles,
  ev: BatteryCharging,
  classic: Crown,
};

const UPGRADE_ICON: Record<UpgradeId, typeof Car> = {
  engine: Flame,
  gearing: Cog,
  tires: Disc,
  brakes: CircleGauge,
  armor: ShieldCheck,
  nitro: Zap,
};

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

const paint = (v: GarageVehicle) => paintOf(v.color, VEHICLES[ARCHETYPE[archetypeOf(v).archetype].type].palette[0]);
const title = (v: GarageVehicle) => `${v.model}${v.year ? ` ${v.year}` : ''}`;

// ------------------------------------------------------------------ sidebar
/** the car's picture, rendered from its model (a light placeholder until it is ready) */
export function CarImage({ v, health, className = '' }: { v: GarageVehicle; health?: number; className?: string }) {
  const type = ARCHETYPE[archetypeOf(v).archetype].type;
  const url = useCarThumb(type, paint(v), health);
  return url ? <img src={url} alt="" draggable={false} className={`object-contain select-none ${className}`} /> : <div className={className} />;
}

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="rounded-[10px] bg-tile px-2.5 py-2 min-w-0">
      <div className="flex items-center gap-1 text-ink-2">{icon}</div>
      <div className="text-[14px] font-semibold tabular-nums truncate mt-0.5">{value}</div>
      <div className="text-[11px] text-muted truncate">{label}</div>
    </div>
  );
}

export function GarageCard() {
  const { v, setup, save } = useActive();
  const setPanel = useGarage((s) => s.setPanel);
  const notice = useGarage((s) => s.notice);
  const own = useGarage.getState().ownCount();
  const demo = v.id.startsWith('demo-');
  const a = setup.archetype;
  const h = setup.progress.health;
  const cost = repairCost(a, h);
  const hits = hitsLeft(h, setup.damageTaken);
  const Perk = PERK_ICON[a.id];
  const damaged = h < RULES.damagedBelow;
  return (
    <div id="garage-card" className="p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xl font-bold">My Garage</div>
        <Button id="btn-garage" variant="secondary" size="sm" onClick={() => setPanel(own === 0 ? 'add' : 'garage')}>
          {own === 0 ? (
            <>
              <Plus size={16} strokeWidth={1.8} /> Add new vehicle
            </>
          ) : (
            <>My cars · {own}</>
          )}
        </Button>
      </div>

      <div className="rounded-2xl border border-line overflow-hidden">
        <button onClick={() => setPanel('garage')} aria-label="All cars" className="relative block w-full aspect-[2/1] bg-tile group">
          <CarImage v={v} health={h} className="absolute inset-0 w-full h-full p-2 transition-transform group-hover:scale-[1.03]" />
          <Badge tone={demo ? 'grey' : 'brand'} className="absolute left-3 top-3">
            {demo ? 'Test drive' : v.primary ? 'Primary' : 'Yours'}
          </Badge>
          <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-md px-2 h-6 text-[13px] font-medium ${damaged ? 'bg-alert text-white' : 'bg-paper text-ink border border-line'}`}>
            <Car size={13} strokeWidth={1.8} />
            <span id="garage-health">{Math.round(h)}%</span>
          </span>
        </button>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div id="garage-name" className="font-semibold text-[17px] leading-tight truncate">
                {title(v)}
              </div>
              <div className="text-[13px] text-ink-2 truncate mt-0.5">
                <span id="garage-make">{makeName(v.make)}</span> ·{' '}
                <span id="garage-type" className="text-brand">
                  {a.name}
                </span>
              </div>
            </div>
            <IconButton aria-label="Switch car" title="Switch car" onClick={() => setPanel('garage')} className="-mr-2 -mt-1">
              <Ellipsis {...ICON} />
            </IconButton>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Gauge size={14} strokeWidth={1.8} />} value={`${topSpeedKmh(a.type, setup.top)}`} label="km/h top" />
            <Stat icon={<Zap size={14} strokeWidth={1.8} />} value={`${zeroToHundred(a.type, setup.power).toFixed(1)} s`} label="0–100 km/h" />
            <Stat icon={<Shield size={14} strokeWidth={1.8} />} value={h < MIN_HEALTH ? '—' : hits} label={hits === 1 ? 'hard hit' : 'hard hits'} />
          </div>
          <div className="flex items-center gap-2.5 text-[13px]">
            <Perk size={16} strokeWidth={1.7} className="text-brand shrink-0" />
            <span className="font-medium">{a.best}</span>
            <span className="text-ink-2 truncate">· {a.perk}</span>
          </div>
        </div>
      </div>

      {cost > 0 && (
        <div className={`rounded-xl p-3 flex items-center gap-3 ${h < MIN_HEALTH ? 'bg-alert/10' : 'bg-tile'}`}>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">{h < MIN_HEALTH ? 'Too damaged to drive' : damaged ? 'Damaged' : 'A few scratches'}</div>
            <Bar value={h / 100} tone={healthTone(h)} className="w-full mt-1.5" />
          </div>
          <Button
            id="btn-repair"
            size="sm"
            onClick={() => {
              useGarage.getState().repair();
              nm.audio.ui('buy');
            }}
          >
            <Wrench size={15} strokeWidth={1.8} />
            <RepairLabel cost={cost} coins={save.coins} health={h} />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button id="btn-workshop" variant="secondary" onClick={() => setPanel('workshop')}>
          <Wrench size={16} strokeWidth={1.8} /> Workshop
        </Button>
        <Button variant="secondary" onClick={() => setPanel('garage')}>
          <Car size={16} strokeWidth={1.8} /> Switch car
        </Button>
      </div>
      {notice && <div className="text-[13px] text-brand">{notice}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ panels
function Panel({ title, children, onClose, id, wide = false }: { title: string; children: ReactNode; onClose: () => void; id: string; wide?: boolean }) {
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
    <Sheet id={id} title={title} onClose={onClose} wide={wide}>
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
      <div className="flex items-center gap-3">
        <div className="w-24 h-12 rounded-lg bg-tile shrink-0 relative overflow-hidden">
          <CarImage v={v} health={h} className="absolute inset-0 w-full h-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{title(v)}</div>
          <div className="text-[13px] text-ink-2">{a.name}</div>
        </div>
        <span className="inline-flex items-center h-9 px-3 rounded-full bg-mist text-[14px]">
          <Coins n={save.coins} />
        </span>
      </div>

      <div className="rounded-xl bg-tile p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Condition</Label>
          <span className="font-semibold tabular-nums text-[14px]">{Math.round(h)}%</span>
        </div>
        <Bar value={h / 100} tone={healthTone(h)} className="w-full" />
        <div className="flex gap-2 flex-wrap">
          {broke ? (
            <Button id="btn-patch" size="sm" onClick={() => g.patch()}>
              Free patch-up
            </Button>
          ) : (
            <Button
              id="btn-repair-full"
              size="sm"
              disabled={cost === 0}
              onClick={() => {
                g.repair();
                nm.audio.ui('buy');
              }}
            >
              {cost === 0 ? 'Like new' : <RepairLabel cost={cost} coins={save.coins} health={h} />}
            </Button>
          )}
          {host && cost > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => hostBridge()?.send({ type: 'mygarage:services', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'repair' })}
            >
              Find a mechanic
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-line -my-1">
        {UPGRADES.map((u) => {
          const lvl = setup.progress.upgrades[u.id];
          const c = upgradeCost(a, lvl);
          const Icon = UPGRADE_ICON[u.id];
          return (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-mist flex items-center justify-center shrink-0">
                <Icon size={17} strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium">{u.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px] text-ink-2">{u.effect}</span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: MAX_LEVEL }, (_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < lvl ? 'bg-brand' : 'bg-line'}`} />
                    ))}
                  </span>
                </div>
              </div>
              <Button id={`up-${u.id}`} variant="secondary" size="sm" className="w-24" disabled={c === null || save.coins < c} onClick={() => {
                  g.upgrade(u.id);
                  nm.audio.ui('buy');
                }}>
                {c === null ? 'Max' : <Coins n={c} />}
              </Button>
            </div>
          );
        })}
      </div>
      {host && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => hostBridge()?.send({ type: 'mygarage:parts', vehicleId: v.id, make: v.make, model: v.model, year: v.year, category: 'performance' })}
        >
          Parts for this car
        </Button>
      )}
      {g.notice && <div className="text-[13px] text-brand">{g.notice}</div>}
    </Panel>
  );
}

function GarageList() {
  const { v: active, list, save } = useActive();
  const g = useGarage();
  const fromHost = list.some((x) => x.source === 'host');
  const mine = list.filter((x) => !x.id.startsWith('demo-'));
  const demos = list.filter((x) => x.id.startsWith('demo-'));
  const card = (x: GarageVehicle) => {
    const a = ARCHETYPE[archetypeOf(x).archetype];
    const p = progressOf(save, x);
    const on = x.id === active.id;
    return (
      <div key={x.id} className="relative">
        <button
          data-car={x.id}
          onClick={() => {
            nm.pickCar(x.id);
            g.setPanel('none');
          }}
          className={`w-full text-left rounded-2xl border overflow-hidden transition-colors ${on ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-faint'}`}
        >
          <div className="relative aspect-[2/1] bg-tile">
            <CarImage v={x} health={p.health} className="absolute inset-0 w-full h-full p-1.5" />
            {on && <Badge className="absolute left-2.5 top-2.5">Driving</Badge>}
            {!on && x.primary && <Badge className="absolute left-2.5 top-2.5">Primary</Badge>}
          </div>
          <div className="px-3 py-2.5">
            <div className="font-semibold text-[14px] truncate">
              {makeName(x.make)} {title(x)}
            </div>
            <div className="text-[12px] text-ink-2 truncate">
              {a.name} · <span className={p.health < RULES.damagedBelow ? 'text-alert' : ''}>{Math.round(p.health)}%</span>
            </div>
          </div>
        </button>
        {x.source === 'local' && !x.id.startsWith('demo-') && (
          <IconButton aria-label="Remove" title="Remove" className="absolute right-1.5 top-1.5 bg-paper/90" onClick={() => g.removeVehicle(x.id)}>
            <Trash2 size={16} strokeWidth={1.7} />
          </IconButton>
        )}
      </div>
    );
  };
  return (
    <Panel id="garage-list" title="My cars" wide onClose={() => g.setPanel('none')}>
      <div className="flex flex-col gap-3 max-h-[66vh] overflow-y-auto -mx-1 px-1">
        <Label>{fromHost ? 'From your Garage' : 'Yours'}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mine.map(card)}
          <button
            id="btn-add-car"
            onClick={() => g.setPanel('add')}
            className="rounded-2xl border border-dashed border-faint hover:border-brand hover:text-brand text-ink-2 flex flex-col items-center justify-center gap-1.5 min-h-[140px] transition-colors"
          >
            <Plus size={22} strokeWidth={1.6} />
            <span className="text-[14px] font-medium">Add new vehicle</span>
          </button>
        </div>
        <Label className="mt-2">Test drive</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{demos.map(card)}</div>
      </div>
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
  const [more, setMore] = useState(false);
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
  const sel = 'w-full h-11 rounded-[10px] bg-mist px-3 text-[15px] text-ink border-0 outline-none focus:ring-2 focus:ring-brand';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const pick = (label: string, k: keyof typeof f, options: [string, string][], id?: string) => (
    <Field label={label}>
      <select id={id} className={sel} value={f[k]} onChange={set(k)}>
        <option value="">—</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <Panel id="add-vehicle" title="Add new vehicle" onClose={() => g.setPanel('garage')}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Make</FieldLabel>
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
          <FieldLabel>Model</FieldLabel>
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
        {pick(
          'Color',
          'color',
          COLORS.map((c) => [c, c]),
          'f-color',
        )}
      </div>

      <button onClick={() => setMore(!more)} className="self-start -mt-1 flex items-center gap-1 text-[14px] font-medium text-brand hover:text-brand-dark">
        More details <ChevronDown size={16} strokeWidth={1.8} className={`transition-transform ${more ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid grid-cols-2 gap-x-3 gap-y-4 ${more ? '' : 'hidden'}`}>
        {pick(
          'Engine',
          'engine',
          [
            ['petrol', 'Gasoline'],
            ['diesel', 'Diesel'],
            ['hybrid', 'Hybrid'],
            ['electric', 'Electric'],
            ['gas', 'Gas (LPG / CNG)'],
          ],
          'f-engine',
        )}
        {pick('Gas equipment', 'gasEquipment', [
          ['no', 'No'],
          ['yes', 'Yes'],
        ])}
        {pick(
          'Wheel size',
          'wheelSize',
          Array.from({ length: 10 }, (_, i) => [String(13 + i), `R${13 + i}`]),
        )}
        {pick('Current condition', 'condition', [
          ['not_damaged', 'Not damaged'],
          ['damaged', 'Damaged'],
        ])}
        {pick('Steering wheel', 'steeringWheel', [
          ['left', 'Left'],
          ['right', 'Right'],
        ])}
        {pick('Headlights', 'headlights', [
          ['halogen', 'Halogen'],
          ['xenon', 'Xenon'],
          ['led', 'LED'],
        ])}
        <div className="col-span-2">
          <FieldLabel>Drives as</FieldLabel>
          <select id="f-archetype" className={sel} value={f.archetype} onChange={set('archetype')}>
            <option value="">Automatic{match && !f.archetype ? ` (${ARCHETYPE[match.archetype].name})` : ''}</option>
            {ARCHETYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {match && (
        <div id="f-match" className="flex items-center gap-2 text-[14px] rounded-xl bg-tile px-4 h-11">
          <Car size={16} strokeWidth={1.6} className="text-ink-2" />
          Drives as <span className="font-semibold text-brand">{ARCHETYPE[match.archetype].name}</span>
        </div>
      )}
      {g.notice && <div className="text-[13px] text-brand">{g.notice}</div>}
      {/* as in the Garage's "Confirm vehicle details": a grey button and a blue one, side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={() => g.setPanel('garage')}>
          Back
        </Button>
        <Button
          id="btn-save-car"
          size="lg"
          disabled={!realMake || !model}
          onClick={() => {
            const v = g.addVehicle({ make: makeName(realMake), model, year, ...f, archetype: f.archetype || undefined });
            if (v) {
              nm.audio.init();
              nm.audio.pick(engineFor(VEHICLES[g.setup().type]));
              g.setPanel('none');
            }
          }}
        >
          Save
        </Button>
      </div>
    </Panel>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[14px] font-medium text-ink mb-1.5 block">{children}</label>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
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
    <div id="garage-result" className="flex flex-col gap-3">
      <Tiles cols={3}>
        <Tile label="Coins earned" value={<span className="text-brand">+{fmt(g.coins)}</span>} />
        <Tile label="Wallet" value={<Coins n={save.coins} />} />
        <Tile label="Condition" value={<span className={g.damage > 0 ? 'text-alert' : ''}>{g.damage > 0 ? `${Math.round(h)}% (−${g.damage})` : `${Math.round(h)}%`}</span>} />
      </Tiles>
      {(cost > 0 && save.coins > 0) || (h < MIN_HEALTH && cost > 0 && save.coins <= cost / 2) ? (
        <div className="flex gap-2 flex-wrap">
          {cost > 0 && save.coins > 0 && (
            <Button id="btn-repair-result" size="sm" onClick={() => useGarage.getState().repair()}>
              <Wrench size={15} strokeWidth={1.8} />
              <RepairLabel cost={cost} coins={save.coins} health={h} />
            </Button>
          )}
          {h < MIN_HEALTH && cost > 0 && save.coins <= cost / 2 && (
            <Button id="btn-patch-result" variant="secondary" size="sm" onClick={() => useGarage.getState().patch()}>
              Free patch-up
            </Button>
          )}
        </div>
      ) : null}
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

function Hold({ code, children, className, id }: { code: string; children: ReactNode; className: string; id?: string }) {
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
  const pad = 'rounded-full surface flex items-center justify-center font-semibold text-ink';
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
          <Hold id="t-drift" code="Space" className={`${pad} w-14 h-14 text-[12px]`}>
            Drift
          </Hold>
          <Hold id="t-brake" code="KeyS" className={`${pad} w-16 h-16 text-[13px]`}>
            Brake
          </Hold>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <Hold id="t-boost" code="ShiftLeft" className={`${pad} w-14 h-14 !bg-badge !text-brand`}>
            <Zap size={20} strokeWidth={1.8} />
          </Hold>
          <Hold id="t-gas" code="KeyW" className={`${pad} w-20 h-24 text-[15px] !rounded-2xl !bg-brand !text-white !border-brand`}>
            Gas
          </Hold>
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex gap-2">
        <button onClick={() => nm.togglePause()} className={`pointer-events-auto ${pad} w-11 h-11`} aria-label="Pause">
          <PauseIcon size={18} strokeWidth={1.8} />
        </button>
        {racing && (
          <button onClick={() => nm.backOnTrack()} className={`pointer-events-auto ${pad} w-11 h-11`} aria-label="Back on track">
            <RotateCcw size={18} strokeWidth={1.8} />
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
      <Mark size={48} />
      <div className="text-xl font-bold">Turn your phone sideways</div>
    </div>
  );
}
