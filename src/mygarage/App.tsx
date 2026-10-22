import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CircleHelp,
  CloudRain,
  Moon,
  Music,
  Play,
  Settings,
  Sun,
  Sunset,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Car,
  RotateCcw,
  LogOut,
  Flag,
  Route,
  Wrench,
  Siren,
  Star,
  TrafficCone,
  Anchor,
  Clock,
} from 'lucide-react';
import { GameCanvas } from '../scene/GameCanvas';
import { useStore } from '../state/store';
import type { Preset } from '../state/settings';
import { nm, CONDITIONS } from './DriveGame';
import { useNM, type Mode, type Popup } from './store';
import { HEAT_STEP } from './Chase';
import { CityMap, HighwayMap, RaceHud, RaceResults } from './RaceUI';
import { RULES } from './scoring';
import { GarageCard, GaragePanels, GarageResults, isTouch, TouchControls, healthTone } from './GarageUI';
import { useGarage } from './garage/store';
import { Badge, Bar, Button, Coins, fmt, IconButton, Label, StatGrid, Wordmark } from './ui';

// handles for automated tests and the browser console
Object.assign(window, { __nmStore: useNM, __garage: useGarage });

// ------------------------------------------------------------------ keys
function useKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useNM.getState();
      if (e.repeat) return;
      // typing in the add-a-vehicle form, or a garage panel is open: the keys belong to it
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (useGarage.getState().panel !== 'none') return;
      if (e.code === 'Enter' && (st.phase === 'title' || st.phase === 'results')) nm.startRun();
      else if (e.code === 'KeyR' && (st.phase === 'run' || st.phase === 'countdown' || st.phase === 'results')) nm.retry();
      else if (e.code === 'Escape') {
        if (st.phase === 'run' || st.phase === 'countdown') nm.togglePause();
        else if (st.phase === 'results') nm.toTitle();
      } else if (e.code === 'KeyQ' && st.paused) nm.toTitle();
      else if (e.code === 'KeyE' && st.paused) nm.endDrive();
      else if (e.code === 'KeyT' && st.phase === 'run' && !st.paused) {
        if (nm.race) nm.backOnTrack();
        else nm.recover();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ------------------------------------------------------------------ loading
function Loading() {
  const p = useNM((s) => s.progress);
  const t = useNM((s) => s.progressText);
  const best = useNM((s) => s.bestChase[0]?.score ?? 0);
  const rs = useNM((s) => s.raceStats);
  return (
    <div className="absolute inset-0 bg-paper flex flex-col items-center justify-center gap-5 pointer-events-auto px-6">
      <Wordmark size="text-[clamp(28px,5vw,44px)]" mark={44} />
      <Bar value={p} tone="brand" className="w-64" />
      <div className="text-[13px] text-muted h-5">{t}</div>
      <div id="high-score" className="text-[13px] text-ink-2 flex items-center gap-1.5">
        <Trophy size={14} strokeWidth={1.6} />
        Best chase {best > 0 ? fmt(best) : '—'}
        {rs.races > 0 && (
          <>
            <span className="text-faint">·</span> Races won {rs.wins} / {rs.races}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ title
const MODES: Record<Mode, { label: string; go: string; hint: string }> = {
  free: { label: 'Free drive', go: 'Drive', hint: 'Drive wherever you want: no clock, no score, no damage' },
  chase: { label: 'Police chase', go: 'Drive', hint: 'Police on your tail: down the motorway, through town, out through the docks' },
  race: { label: 'Race', go: 'Race', hint: 'Beat a rival to the finish' },
};

function ModeTabs() {
  const mode = useNM((s) => s.mode);
  const set = useNM((s) => s.set);
  return (
    <div className="inline-flex rounded-full bg-mist p-1">
      {(Object.keys(MODES) as Mode[]).map((m) => (
        <button
          key={m}
          id={`mode-${m}`}
          title={MODES[m].hint}
          onClick={() => {
            if (m !== mode) nm.audio.ui('click');
            set({ mode: m });
          }}
          className={`h-8 px-3.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${m === mode ? 'bg-paper text-ink shadow-[0_1px_2px_rgba(13,13,13,0.08)]' : 'text-ink-2 hover:text-ink'}`}
        >
          {MODES[m].label}
        </button>
      ))}
    </div>
  );
}

const COND_ICON: Record<string, typeof Sun> = { day: Sun, dusk: Sunset, night: Moon, rain: CloudRain };

function Conditions() {
  const cond = useNM((s) => s.cond);
  const set = useNM((s) => s.set);
  return (
    <div className="surface rounded-full p-1 flex items-center gap-1 pointer-events-auto">
      {Object.entries(CONDITIONS).map(([id, c]) => {
        const Icon = COND_ICON[id] ?? Sun;
        const on = id === cond;
        return (
          <button
            key={id}
            id={`cond-${id}`}
            title={c.label + (c.grip < 1 ? ' (slippery)' : '')}
            aria-label={c.label}
            onClick={() => set({ cond: id })}
            className={`h-8 rounded-full flex items-center gap-1.5 transition-colors ${on ? 'bg-badge text-brand px-3' : 'w-8 justify-center text-ink-2 hover:text-ink hover:bg-mist'}`}
          >
            <Icon size={16} strokeWidth={1.6} />
            {on && <span className="text-[13px] font-medium">{c.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** a small menu that opens under a header button */
function Popover({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <IconButton aria-label={label} title={label} active={open} onClick={() => setOpen(!open)}>
        {icon}
      </IconButton>
      {open && <div className="absolute right-0 top-11 z-20 w-64 bg-paper rounded-xl float p-3 rise">{children}</div>}
    </div>
  );
}

const KEYS: [string, string][] = [
  ['W A S D', 'Drive'],
  ['Shift', 'Boost'],
  ['Space', 'Drift'],
  ['Esc', 'Pause'],
  ['R', 'Restart'],
  ['T', 'Back on the road'],
];

function Help() {
  return (
    <Popover icon={<CircleHelp size={20} strokeWidth={1.6} />} label="Controls">
      <div className="text-[13px] font-semibold mb-2">Controls</div>
      <div className="flex flex-col gap-1.5">
        {KEYS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-ink-2">{v}</span>
            <kbd className="font-sans text-[12px] font-medium bg-mist rounded-md px-1.5 h-6 inline-flex items-center">{k}</kbd>
          </div>
        ))}
      </div>
    </Popover>
  );
}

function SettingsMenu() {
  const preset = useStore((s) => s.settings.graphics.preset);
  const master = useStore((s) => s.settings.audio.master);
  const music = useStore((s) => s.settings.audio.music);
  return (
    <Popover icon={<Settings size={20} strokeWidth={1.6} />} label="Settings">
      <Label className="mb-1.5">Graphics</Label>
      <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-mist p-1">
        {(['low', 'medium', 'high', 'ultra'] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => useStore.getState().applyPreset(p)}
            className={`h-7 rounded-lg text-[13px] font-medium capitalize ${preset === p ? 'bg-paper text-ink shadow-[0_1px_2px_rgba(13,13,13,0.08)]' : 'text-ink-2 hover:text-ink'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          id="set-sound"
          onClick={() => useStore.getState().updateSettings((s) => (s.audio.master = s.audio.master > 0 ? 0 : 0.8))}
          className={`h-9 rounded-[10px] flex items-center gap-2 px-3 text-[14px] ${master > 0 ? 'bg-badge text-brand' : 'bg-mist text-ink-2 hover:bg-line'}`}
        >
          {master > 0 ? <Volume2 size={16} strokeWidth={1.6} /> : <VolumeX size={16} strokeWidth={1.6} />}
          Sound
        </button>
        <button
          id="set-music"
          onClick={() => useStore.getState().updateSettings((s) => (s.audio.music = s.audio.music > 0 ? 0 : 0.55))}
          className={`h-9 rounded-[10px] flex items-center gap-2 px-3 text-[14px] ${music > 0 ? 'bg-badge text-brand' : 'bg-mist text-ink-2 hover:bg-line'}`}
        >
          <Music size={16} strokeWidth={1.6} />
          Music
        </button>
      </div>
    </Popover>
  );
}

/** the best for the selected mode (free drive keeps no score) */
function Best() {
  const mode = useNM((s) => s.mode);
  const chase = useNM((s) => s.bestChase[0]?.score ?? 0);
  const rs = useNM((s) => s.raceStats);
  if (mode === 'free') return null;
  const text = mode === 'race' ? (rs.races ? `${rs.wins} / ${rs.races} won` : '—') : chase > 0 ? fmt(chase) : '—';
  return (
    <span
      id="high-score"
      title={mode === 'race' ? 'Races won' : 'High score'}
      className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-mist text-[14px] font-medium tabular-nums"
    >
      <Trophy size={16} strokeWidth={1.6} className="text-ink-2" />
      {text}
    </span>
  );
}

function Title() {
  const mode = useNM((s) => s.mode);
  const coins = useGarage((s) => s.save.coins);
  const aside = useRef<HTMLElement>(null);
  // keep the parked car in the middle of the space the sidebar leaves
  useEffect(() => {
    const el = aside.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const side = r.height >= window.innerHeight - 80;
      nm.viewInset = side ? { right: r.width, bottom: 0 } : { right: 0, bottom: r.height };
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      nm.viewInset = { right: 0, bottom: 0 };
    };
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-auto flex flex-col rise">
      <header className="h-16 short:h-12 shrink-0 bg-paper border-b border-line flex items-center gap-3 px-4 sm:px-6">
        <Wordmark size="text-[19px]" mark={28} />
        <div className="hidden lg:block ml-5">
          <ModeTabs />
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Best />
          <span className="inline-flex items-center h-9 px-3 rounded-full bg-mist text-[14px]" title="Coins">
            <Coins n={coins} />
          </span>
          <div className="hidden sm:block">
            <Help />
          </div>
          <SettingsMenu />
        </div>
      </header>

      {/* sidebar on the right in a wide frame; in a tall one (a phone held upright, an A4 page) the garage sits under the scene */}
      <div className="flex-1 min-h-0 flex flex-col sm:landscape:flex-row">
        {/* the 3D scene shows through here */}
        <div className="flex-1 min-h-[180px] relative pointer-events-none">
          <div className="lg:hidden absolute left-4 top-4 pointer-events-auto max-w-[calc(100%-2rem)] overflow-x-auto">
            <ModeTabs />
          </div>
          <div className="absolute left-4 sm:left-6 bottom-4 sm:bottom-6">
            <Conditions />
          </div>
        </div>
        <aside
          ref={aside}
          className="sm:landscape:w-[380px] lg:landscape:w-[420px] shrink-0 max-h-[62%] sm:landscape:max-h-none flex flex-col bg-paper border-t sm:landscape:border-t-0 sm:landscape:border-l border-line"
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="portrait:max-w-[620px] portrait:mx-auto">
              <GarageCard />
            </div>
          </div>
          {/* the one big button: always in view at the foot of the sidebar */}
          <div className="shrink-0 p-4 sm:px-6 sm:pb-6 sm:pt-4 border-t border-line portrait:flex portrait:justify-center [&>*]:portrait:max-w-[572px]">
            <Button id="btn-drive" size="xl" className="w-full" onClick={() => nm.startRun()}>
              <Play size={20} strokeWidth={2} fill="currentColor" />
              {MODES[mode].go}
              <span className="text-white/70 font-normal">· {MODES[mode].label}</span>
            </Button>
          </div>
        </aside>
      </div>
      <GaragePanels />
    </div>
  );
}

// ------------------------------------------------------------------ in the run
function Countdown() {
  const n = useNM((s) => s.hud.countdown);
  const phase = useNM((s) => s.phase);
  if (phase !== 'countdown' || n <= 0) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div key={n} className="count w-32 h-32 rounded-full surface flex items-center justify-center">
        <span className="display text-7xl text-brand">{n}</span>
      </div>
    </div>
  );
}

function PopupItem({ p }: { p: Popup }) {
  const bad = p.kind === 'lost' || p.kind === 'damage' || p.kind === 'crash' || p.kind === 'police';
  const color = bad ? 'text-alert' : p.kind === 'bank' ? 'text-ink' : 'text-brand';
  const big = p.kind === 'bank' || bad || p.kind === 'repair' || p.tier === 3 || p.label === 'MASSIVE DRIFT';
  return (
    <div className={`flex items-center gap-2.5 rounded-full surface ${big ? 'px-5 h-12 pop-long' : 'px-4 h-10 pop'}`}>
      <div className={`font-bold tracking-wide ${color} ${big ? 'text-xl' : 'text-[15px]'}`}>{p.label}</div>
      {p.sub ? <div className="text-[12px] font-medium text-muted">{p.sub}</div> : null}
      {p.points !== 0 ? (
        <div className={`display ${big ? 'text-xl' : 'text-[15px]'} ${p.points < 0 ? 'text-alert' : 'text-ink'}`}>{`${p.points > 0 ? '+' : ''}${fmt(p.points)}`}</div>
      ) : null}
    </div>
  );
}

/** a small white surface floating on the scene */
function Chip({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`surface rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function Hud({ touch }: { touch: boolean }) {
  const h = useNM((s) => s.hud);
  const phase = useNM((s) => s.phase);
  const popups = useNM((s) => s.popups);
  const racing = useNM((s) => s.race !== null);
  const mode = useNM((s) => s.mode);
  // the ending (busted, escaped) has the screen to itself
  if (phase !== 'run' && phase !== 'countdown') return null;
  const free = mode === 'free';
  return (
    <div className="absolute inset-0 pointer-events-none">
      {h.boosting && <div className="absolute inset-0 streaks throb" />}
      {h.damaged && mode === 'chase' && <div className="absolute inset-0 damaged-vignette" />}

      {racing ? <RaceHud /> : free ? <FreeHud /> : <ScoreHud />}
      {mode === 'chase' && <ChaseHud />}

      <div className="absolute left-1/2 -translate-x-1/2 top-[34%] flex flex-col items-center gap-2">
        {popups.map((p) => (
          <PopupItem key={p.id} p={p} />
        ))}
      </div>

      {/* speed, boost and condition (raised clear of the pedals on touch screens), and the way to a free repair */}
      <div className={`absolute right-4 sm:right-6 flex flex-col items-end gap-2 ${touch ? 'bottom-[200px] scale-75 origin-bottom-right' : 'bottom-6'}`}>
        {h.pickup && <PickupChip p={h.pickup} />}
        {h.damaged && mode === 'chase' && (
          <div id="damaged">
            <Badge tone="alert">Damaged</Badge>
          </div>
        )}
        <Chip className="px-4 py-3 w-56">
          <div className="flex items-baseline gap-1.5">
            <div className="display text-[44px] leading-none">{h.speed}</div>
            <div className="text-[13px] text-muted">km/h</div>
          </div>
          <div className="flex items-center gap-2 mt-3" title="Boost">
            <Zap size={14} strokeWidth={1.8} className={h.boosting ? 'text-brand' : 'text-ink-2'} />
            <Bar value={h.boost} tone="brand" className="flex-1" />
          </div>
          {!free && (
            <div id="hud-condition" className="flex items-center gap-2 mt-2" title="Condition">
              <Car size={14} strokeWidth={1.8} className="text-ink-2" />
              <Bar value={h.health / 100} tone={healthTone(h.health)} className="flex-1" />
              <span className="text-[12px] font-medium tabular-nums w-9 text-right">{Math.round(h.health)}%</span>
            </div>
          )}
        </Chip>
      </div>

      {!touch && h.street && <Chip className="absolute left-4 sm:left-6 bottom-6 px-3 h-8 flex items-center text-[12px] font-medium text-ink-2">{h.street}</Chip>}
    </div>
  );
}

/** a wrench is waiting on the road: how far, and which way */
function PickupChip({ p }: { p: { dist: number; arrow: number } }) {
  return (
    <div id="hud-pickup" className="surface rounded-full h-10 pl-1.5 pr-3 flex items-center gap-2 text-[13px] font-medium whitespace-nowrap">
      <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center">
        <Wrench size={15} strokeWidth={2} />
      </span>
      Free repair
      <span className="tabular-nums text-ink-2">{p.dist} m</span>
      <svg width="18" height="18" viewBox="-27 -27 54 54" style={{ transform: `rotate(${p.arrow}deg)` }}>
        <path d="M0 -22 L16 10 L0 2 L-16 10 Z" fill="#0077ff" />
      </svg>
    </div>
  );
}

/** free drive: how far you have been, and the map. Nothing else */
function FreeHud() {
  const h = useNM((s) => s.hud);
  return (
    <>
      <Chip id="hud-distance" className="absolute left-4 sm:left-6 top-4 sm:top-6 px-4 py-3 w-40">
        <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <Route size={13} strokeWidth={1.8} /> Free drive
        </div>
        <div className="display text-[32px] leading-tight">
          {(h.distance / 1000).toFixed(1)}
          <span className="text-[15px] font-medium text-muted"> km</span>
        </div>
      </Chip>
      <CityMap id="city-map" />
    </>
  );
}

/** the chase: the score and the combo, and the map with the way to the docks */
function ScoreHud() {
  const h = useNM((s) => s.hud);
  const comboFrac = Math.max(0, Math.min(1, h.comboT / RULES.comboWindow));
  return (
    <>
      <HighwayMap />
      <div className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 flex flex-col items-center gap-2">
        <Chip className="px-5 py-2 text-center min-w-36">
          <div className="text-[12px] text-ink-2">Score</div>
          <div className="display text-[32px] leading-tight">{fmt(h.score)}</div>
        </Chip>
        <div className={`flex items-center gap-1.5 transition-opacity ${h.comboPoints > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="display text-[17px] px-3 h-8 inline-flex items-center rounded-full bg-brand text-white">×{h.mult}</span>
          <Chip className="px-3 h-8 !rounded-full flex items-center gap-2">
            <span className="display text-[15px]">{fmt(h.comboPoints)}</span>
            <Bar value={comboFrac} className="w-16" />
          </Chip>
        </div>
        <div className="flex gap-2 h-7">
          {h.oncoming && <Badge tone="grey">Oncoming</Badge>}
          {h.drifting && (
            <Badge tone="brand" className="tabular-nums">
              Drift {h.driftAngle}° · +{fmt(h.driftPoints)}
            </Badge>
          )}
        </div>
      </div>
    </>
  );
}

const STAGES = [
  ['motorway', 'Motorway'],
  ['town', 'Town'],
  ['docks', 'Docks'],
] as const;

/** the police chase: heat, who is after you, the way to the docks, and getting boxed in */
function ChaseHud() {
  const c = useNM((s) => s.chase);
  if (!c) return null;
  return (
    <>
      {c.close < 28 && <div className="absolute inset-0 police-glow" />}
      <Chip id="hud-chase" className="absolute left-4 sm:left-6 top-4 sm:top-6 px-4 py-3 w-48">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-alert font-semibold">
            <Siren size={13} strokeWidth={1.8} className="throb" /> {c.cops > 0 ? `${c.cops} after you` : 'Pursuit'}
          </span>
          <span className="flex items-center gap-1 text-ink-2 tabular-nums">
            <Clock size={12} strokeWidth={1.8} />
            {Math.floor(c.time / 60)}:{String(c.time % 60).padStart(2, '0')}
          </span>
        </div>
        <div id="hud-heat" className="flex gap-0.5 mt-1.5" title={`Heat ${c.heat}: rises every ${HEAT_STEP} s`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={16} strokeWidth={1.6} className={i <= c.heat ? 'text-alert' : 'text-line'} fill={i <= c.heat ? 'currentColor' : 'none'} />
          ))}
        </div>
        <div id="hud-docks" className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <Anchor size={13} strokeWidth={1.8} /> Docks
            </span>
            <span className="display text-[20px] leading-none">
              {(c.toDocks / 1000).toFixed(1)}
              <span className="text-[12px] font-medium text-muted"> km</span>
            </span>
          </div>
          <Bar value={c.progress} tone="brand" className="w-full mt-1.5" />
          <div className="flex justify-between mt-1 text-[11px]">
            {STAGES.map(([k, label]) => (
              <span key={k} className={k === c.stage ? 'text-ink font-semibold' : 'text-muted'}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </Chip>
      {c.bust > 0.04 && (
        <div id="hud-bust" className="absolute left-1/2 -translate-x-1/2 top-[24%] surface rounded-2xl px-5 py-3 w-64 text-center">
          <div className="text-[15px] font-bold text-alert">Get moving or get busted</div>
          <Bar value={c.bust} tone="alert" className="w-full mt-2" />
        </div>
      )}
      {c.roadblock !== null && (
        <div
          id="hud-roadblock"
          className="absolute left-1/2 -translate-x-1/2 bottom-6 surface rounded-full h-10 px-4 flex items-center gap-2 text-[13px] font-medium whitespace-nowrap"
        >
          <TrafficCone size={16} strokeWidth={1.8} className="text-alert" />
          Roadblock in {c.roadblock} m · find the gap
        </div>
      )}
    </>
  );
}

function Pause() {
  const paused = useNM((s) => s.paused);
  const chase = useNM((s) => s.mode === 'chase');
  if (!paused) return null;
  return (
    <div className="absolute inset-0 bg-night/40 flex items-center justify-center pointer-events-auto rise p-4">
      <div className="bg-paper rounded-2xl float p-6 flex flex-col gap-4 w-full max-w-[360px]">
        <div className="text-xl font-bold">Paused</div>
        <div className="flex flex-col gap-2">
          <Button id="btn-resume" size="lg" onClick={() => nm.togglePause()}>
            <Play size={16} strokeWidth={2} fill="currentColor" /> Resume
          </Button>
          {chase && (
            <Button id="btn-end" variant="secondary" size="lg" onClick={() => nm.endDrive()}>
              <Flag size={16} strokeWidth={1.8} /> Give up
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={() => nm.retry()}>
            <RotateCcw size={16} strokeWidth={1.8} /> Restart
          </Button>
          <Button id="btn-quit" variant="ghost" size="lg" onClick={() => nm.toTitle()}>
            <LogOut size={16} strokeWidth={1.8} /> {chase ? 'Quit' : 'Back to the garage'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ results
function ResultSheet({ children, stripe = null }: { children: ReactNode; stripe?: 'police' | 'brand' | null }) {
  return (
    <div className="absolute inset-0 bg-night/40 pointer-events-auto flex justify-center overflow-y-auto p-4 rise">
      <div id="results" className="relative w-full max-w-[720px] my-auto bg-paper rounded-2xl float p-6 pt-7 flex flex-col gap-5 overflow-hidden">
        {stripe && <div className={`absolute inset-x-0 top-0 h-1.5 ${stripe === 'police' ? 'stripe-police' : 'bg-brand'}`} />}
        {children}
      </div>
    </div>
  );
}

function Results() {
  const r = useNM((s) => s.result);
  const phase = useNM((s) => s.phase);
  if (phase !== 'results' || !r) return null;
  if (r.mode === 'race' && r.race) {
    return (
      <ResultSheet>
        <RaceResults r={r} />
        {r.garage && <GarageResults g={r.garage} />}
        <ResultButtons again="New race" />
      </ResultSheet>
    );
  }
  const ch = r.chase;
  const stats: [string, string][] = [
    ['Time', mmss(ch?.time ?? r.seconds)],
    ['Takedowns', fmt(ch?.takedowns ?? 0)],
    ['Highest heat', `${ch?.heat ?? 1} / 5`],
    ['Near misses', fmt(r.nearMisses)],
    ['Top speed', `${r.topSpeed} km/h`],
    ['Docks', ch?.escaped ? 'Made it' : `${((ch?.left ?? 0) / 1000).toFixed(1)} km short`],
  ];
  const title = r.reason === 'escaped' ? 'Escaped' : r.reason === 'busted' ? 'Busted' : 'Chase over';
  const why =
    r.reason === 'escaped'
      ? `Out through the docks with ${ch?.heat ?? 1}-star heat`
      : r.reason === 'busted'
        ? `Boxed in ${((ch?.left ?? 0) / 1000).toFixed(1)} km from the docks`
        : 'You gave yourself up';
  const Icon = r.reason === 'escaped' ? Anchor : r.reason === 'busted' ? Siren : Flag;
  const tile = r.reason === 'escaped' ? 'bg-brand text-white' : r.reason === 'busted' ? 'bg-night text-white' : 'bg-badge text-brand';
  return (
    <ResultSheet stripe={r.reason === 'busted' ? 'police' : r.reason === 'escaped' ? 'brand' : null}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
          <div id="result-icon" className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tile}`}>
            <Icon size={24} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className={`text-2xl font-bold leading-tight ${r.reason === 'busted' ? 'text-alert' : r.reason === 'escaped' ? 'text-brand' : 'text-ink'}`}>{title}</div>
            <div className="text-[14px] text-ink mt-0.5">{why}</div>
            <div className="text-[13px] text-muted mt-0.5">
              {r.car} · {r.cond}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="display text-5xl leading-none">{fmt(r.score)}</div>
          <div className="mt-2 h-6">
            {r.rank === 1 ? <Badge>New best</Badge> : <span className="text-[13px] text-muted">{r.rank > 0 ? `#${r.rank} of your top 10` : 'Not in your top 10'}</span>}
          </div>
        </div>
      </div>
      <StatGrid stats={stats} />
      {r.garage && <GarageResults g={r.garage} />}
      <ResultButtons again="Chase again" />
    </ResultSheet>
  );
}

function ResultButtons({ again }: { again: string }) {
  const racing = useNM((s) => s.result?.mode === 'race');
  return (
    <div className="flex gap-2 flex-wrap">
      <Button id="btn-again" size="lg" onClick={() => nm.startRun()}>
        <Play size={16} strokeWidth={2} fill="currentColor" /> {again}
      </Button>
      {racing && (
        <Button id="btn-rematch" variant="secondary" size="lg" onClick={() => nm.retry()}>
          <RotateCcw size={16} strokeWidth={1.8} /> Same route
        </Button>
      )}
      <Button id="btn-title" variant="secondary" size="lg" onClick={() => nm.toTitle()}>
        My Garage
      </Button>
    </div>
  );
}

function mmss(t: number) {
  return t >= 60 ? `${Math.floor(t / 60)} min ${Math.round(t % 60)} s` : `${Math.round(t)} s`;
}

/** the moment the chase ends: busted (a stamp under police lights) or escaped (out through the dock gates) */
function Ending() {
  const phase = useNM((s) => s.phase);
  const ending = useNM((s) => s.ending);
  const chase = useNM((s) => s.chase);
  const score = useNM((s) => s.hud.score);
  if (phase !== 'ending' || !ending) return null;
  const chips = (
    <div className="flex flex-wrap justify-center gap-2 rise">
      {chase && <EndChip>{mmss(chase.time)}</EndChip>}
      {chase && <EndChip>Heat {chase.heat}</EndChip>}
      {chase && chase.takedowns > 0 && <EndChip>{chase.takedowns} taken out</EndChip>}
      <EndChip>{fmt(score)} pts</EndChip>
    </div>
  );
  if (ending === 'busted') {
    return (
      <div id="ending" data-ending="busted" className="absolute inset-0 pointer-events-none overflow-hidden ending-busted">
        <div className="absolute inset-x-0 top-0 h-3 lightbar" />
        <div className="absolute inset-x-0 bottom-0 h-3 lightbar lightbar-alt" />
        <div className="absolute inset-0 police-glow" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-4">
          <div className="flex items-center gap-2 text-white/90 text-[13px] font-semibold tracking-[0.2em] uppercase">
            <Siren size={16} strokeWidth={2} /> Police
          </div>
          <div className="stamp bg-paper/95 border-[5px] border-alert rounded-2xl px-8 sm:px-12 py-2">
            <span className="block font-extrabold uppercase text-alert tracking-[0.08em] leading-none text-[clamp(44px,10vw,112px)]">Busted</span>
          </div>
          {chips}
        </div>
      </div>
    );
  }
  return (
    <div id="ending" data-ending="escaped" className="absolute inset-0 pointer-events-none overflow-hidden ending-escaped">
      <div className="absolute inset-0 escape-flash" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-4">
        <div className="flex items-center gap-2 text-white/90 text-[13px] font-semibold tracking-[0.2em] uppercase">
          <Anchor size={16} strokeWidth={2} /> Port exit
        </div>
        <div className="stamp stamp-win bg-brand rounded-2xl px-8 sm:px-12 py-2 border-[5px] border-paper">
          <span className="block font-extrabold uppercase text-white tracking-[0.08em] leading-none text-[clamp(44px,10vw,112px)]">Escaped</span>
        </div>
        {chips}
      </div>
    </div>
  );
}

function EndChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center h-8 px-3.5 rounded-full bg-white/15 text-white text-[13px] font-medium backdrop-blur-sm border border-white/20">{children}</span>
  );
}

/**
 * The interface is laid out for a frame at least 820 x 560: in a smaller one (a phone, the game
 * placed on a page in another app) all of it is scaled down to fit rather than overlapping.
 */
function useUiScale() {
  const get = () => Math.max(0.55, Math.min(1, window.innerWidth / 820, window.innerHeight / 560));
  const [k, setK] = useState(get);
  useEffect(() => {
    const f = () => setK(get());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return k;
}

export default function App() {
  const phase = useNM((s) => s.phase);
  const touch = useMemo(() => isTouch(), []);
  const ui = useUiScale();
  useKeys();
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.settings !== prev.settings) nm.applySettings();
      }),
    [],
  );
  return (
    <div className="relative w-full h-full">
      <GameCanvas engine={nm} />
      <div id="ui" className="absolute inset-0 pointer-events-none" style={ui < 1 ? { zoom: ui } : undefined}>
        {phase === 'title' && <Title />}
        <Hud touch={touch} />
        <Countdown />
        <Ending />
        {touch && <TouchControls />}
        <Pause />
        <Results />
      </div>
      {phase === 'loading' && <Loading />}
    </div>
  );
}
