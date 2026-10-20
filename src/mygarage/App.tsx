import { useEffect, useMemo } from 'react';
import { GameCanvas } from '../scene/GameCanvas';
import { useStore } from '../state/store';
import type { Preset } from '../state/settings';
import { nm, CONDITIONS } from './DriveGame';
import { useNM, Popup } from './store';
import { RaceHud, RaceResults } from './RaceUI';
import { RULES } from './scoring';
import { GarageCard, GaragePanels, GarageResults, isTouch, RotateNotice, TouchControls, healthTone } from './GarageUI';
import { useGarage } from './garage/store';
import { MIN_HEALTH } from './garage/progress';
import { Badge, Bar, Button, Card, Coins, fmt, Label, StatGrid, Wordmark } from './ui';

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
      else if (e.code === 'KeyR' && (st.phase === 'run' || st.phase === 'countdown' || st.phase === 'results' || st.phase === 'wreck')) nm.retry();
      else if (e.code === 'Escape') {
        if (st.phase === 'run' || st.phase === 'countdown') nm.togglePause();
        else if (st.phase === 'results') nm.toTitle();
      } else if (e.code === 'KeyQ' && st.paused) nm.toTitle();
      else if (e.code === 'KeyT' && st.phase === 'run' && !st.paused) nm.backOnTrack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ------------------------------------------------------------------ loading
function Loading() {
  const p = useNM((s) => s.progress);
  const t = useNM((s) => s.progressText);
  return (
    <div className="absolute inset-0 bg-paper flex flex-col items-center justify-center gap-6 pointer-events-auto px-6">
      <Wordmark size="text-[clamp(32px,6vw,56px)]" mark={56} />
      <Bar value={p} className="w-72 h-1.5" />
      <div className="text-sm text-muted h-5">{t}</div>
      <HighScore />
    </div>
  );
}

/**
 * The free-drive high score and the race record, kept in this browser. Loading shows both as cards;
 * the title shows the one for the mode that is picked.
 */
function HighScore({ only }: { only?: 'score' | 'race' }) {
  const best = useNM((s) => s.best);
  const rs = useNM((s) => s.raceStats);
  if (only) {
    return (
      <div id="high-score" className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
        <Label>{only === 'race' ? 'Races won' : 'High score'}</Label>
        <span className="display text-lg ml-auto">{only === 'race' ? `${rs.wins} / ${rs.races}` : fmt(best[0]?.score ?? 0)}</span>
      </div>
    );
  }
  return (
    <div id="high-score" className="flex gap-3">
      <div className="rounded-xl bg-card px-5 py-3 min-w-36 text-center">
        <Label>High score</Label>
        <div className={`display text-3xl ${best.length ? 'text-ink' : 'text-muted'}`}>{best.length ? fmt(best[0].score) : '—'}</div>
        {best.length > 0 && (
          <div className="text-xs text-muted mt-0.5">
            {best[0].car} · {best[0].cond}
          </div>
        )}
      </div>
      {rs.races > 0 && (
        <div className="rounded-xl bg-card px-5 py-3 min-w-36 text-center">
          <Label>Races won</Label>
          <div className="display text-3xl">
            {rs.wins}
            <span className="text-muted text-xl"> / {rs.races}</span>
          </div>
          {rs.bestMargin > 0 && <div className="text-xs text-muted mt-0.5">best margin {rs.bestMargin.toFixed(1)} s</div>}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ title
const MODES = {
  score: {
    label: 'Free drive',
    blurb: 'Dodge traffic, pass close and beat your high score. Crashes damage your car, and the damage stays until you repair it.',
    go: 'Drive',
  },
  race: {
    label: 'Race',
    blurb: 'Beat a rival in the same kind of car through the checkpoints. Crashes stop you dead and cost condition, but never end the race.',
    go: 'Race',
  },
} as const;

function ModeTabs() {
  const mode = useNM((s) => s.mode);
  const set = useNM((s) => s.set);
  return (
    <div className="inline-flex rounded-full bg-mist p-1">
      {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => (
        <button
          key={m}
          id={`mode-${m}`}
          onClick={() => set({ mode: m })}
          className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${m === mode ? 'bg-paper text-brand lift' : 'text-ink-2 hover:text-ink'}`}
        >
          {MODES[m].label}
        </button>
      ))}
    </div>
  );
}

function Title() {
  const cond = useNM((s) => s.cond);
  const mode = useNM((s) => s.mode);
  const set = useNM((s) => s.set);
  const preset = useStore((s) => s.settings.graphics.preset);
  const master = useStore((s) => s.settings.audio.master);
  const touch = useMemo(() => isTouch(), []);
  const hasBest = useNM((s) => s.best.length > 0);
  const raceCount = useNM((s) => s.raceStats.races);
  const coins = useGarage((s) => s.save.coins);
  const hosted = useGarage((s) => s.hostVehicles.length > 0);
  return (
    <div className="absolute inset-0 pointer-events-auto flex flex-col rise">
      {/* the dark strip and white header, as on list.am */}
      <div className="h-8 shrink-0 bg-night text-white/70 text-xs flex items-center gap-4 px-4 sm:px-6 short:hidden">
        <span className="font-semibold text-white">MyGarage Drive</span>
        <span className="hidden sm:inline">Drive the car from your garage</span>
        <span className="ml-auto">{hosted ? 'Cars from your Garage' : 'Demo garage'}</span>
      </div>
      <div className="h-16 short:h-12 shrink-0 bg-paper border-b border-line flex items-center gap-4 px-4 sm:px-6">
        <Wordmark size="text-lg sm:text-xl" mark={32} />
        <div className="hidden md:block ml-4">
          <ModeTabs />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center h-9 px-3 rounded-full bg-mist">
            <Coins n={coins} />
          </span>
          <Button id="btn-drive" onClick={() => nm.startRun()} pill size="lg" className="px-7">
            {MODES[mode].go}
            {!touch && <span className="text-sm font-medium text-white/70">Enter</span>}
          </Button>
        </div>
      </div>

      {/* the scene shows through between the two cards */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 p-4 sm:p-6">
          <Card className="w-full lg:w-[360px] p-5 flex flex-col gap-4">
            <div className="md:hidden">
              <ModeTabs />
            </div>
            <div>
              <div className="display text-2xl">{MODES[mode].label}</div>
              <div className="text-sm text-ink-2 mt-1 leading-relaxed short:hidden">{MODES[mode].blurb}</div>
            </div>
            {(mode === 'race' ? raceCount > 0 : hasBest) && <HighScore only={mode} />}
            <div className="flex flex-col gap-2">
              <Label>Conditions</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONDITIONS).map(([id, c]) => (
                  <button
                    key={id}
                    id={`cond-${id}`}
                    onClick={() => set({ cond: id })}
                    className={`h-8 px-3 rounded-full text-sm font-medium transition-colors ${id === cond ? 'bg-brand-tint text-brand' : 'bg-mist text-ink-2 hover:text-ink'}`}
                  >
                    {c.label}
                    {c.grip < 1 ? ' · slippery' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted leading-relaxed short:hidden">
              {touch ? (
                <>Steer on the left, pedals on the right, boost and drift above the pedals.</>
              ) : (
                <>
                  W A S D drive · Shift boost · Space drift
                  <br />
                  Esc pause · R restart{mode === 'race' ? ' · T back on track' : ''}
                </>
              )}
            </div>
            <div className="flex gap-3 items-center text-xs text-muted border-t border-line pt-3">
              <span>Graphics</span>
              {(['low', 'medium', 'high', 'ultra'] as Preset[]).map((p) => (
                <button key={p} onClick={() => useStore.getState().applyPreset(p)} className={`capitalize ${preset === p ? 'text-brand font-semibold' : 'hover:text-ink'}`}>
                  {p}
                </button>
              ))}
              <span className="w-px h-3 bg-line" />
              <button onClick={() => useStore.getState().updateSettings((s) => (s.audio.master = s.audio.master > 0 ? 0 : 0.8))} className="hover:text-ink">
                Sound {master > 0 ? 'on' : 'off'}
              </button>
            </div>
          </Card>

          <div className="w-full lg:w-[380px]">
            <GarageCard />
          </div>
        </div>
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
      <div key={n} className="count w-40 h-40 rounded-full bg-paper lift flex items-center justify-center">
        <span className="display text-8xl text-brand">{n}</span>
      </div>
    </div>
  );
}

function PopupItem({ p }: { p: Popup }) {
  const bad = p.kind === 'lost' || p.kind === 'damage' || p.kind === 'crash';
  const color = bad ? 'text-hot' : p.kind === 'bank' ? 'text-ok' : p.kind === 'drift' ? 'text-warn' : p.tier === 3 ? 'text-hot' : 'text-brand';
  const big = p.kind === 'bank' || bad || p.tier === 3 || p.label === 'MASSIVE DRIFT';
  return (
    <div className={`flex items-center gap-3 rounded-full bg-paper/95 lift ${big ? 'px-6 py-3 pop-long' : 'px-5 py-2 pop'}`}>
      <div className={`display uppercase ${color} ${big ? 'text-3xl' : 'text-xl'}`}>{p.label}</div>
      {p.sub ? <div className="text-sm font-semibold text-ink-2">{p.sub}</div> : null}
      {p.points !== 0 ? <div className={`display ${big ? 'text-2xl' : 'text-lg'} text-ink`}>{`${p.points > 0 ? '+' : ''}${fmt(p.points)}`}</div> : null}
    </div>
  );
}

/** a small white card floating on the scene */
function Chip({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`bg-paper/95 rounded-2xl lift ${className}`}>
      {children}
    </div>
  );
}

function Hud({ touch }: { touch: boolean }) {
  const h = useNM((s) => s.hud);
  const phase = useNM((s) => s.phase);
  const popups = useNM((s) => s.popups);
  const racing = useNM((s) => s.race !== null);
  if (phase !== 'run' && phase !== 'countdown' && phase !== 'wreck') return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {h.boosting && <div className="absolute inset-0 streaks throb" />}
      {h.damaged && !racing && <div className="absolute inset-0 damaged-vignette" />}

      {racing ? <RaceHud /> : <ScoreHud />}

      {/* popups */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[36%] flex flex-col items-center gap-2">
        {popups.map((p) => (
          <PopupItem key={p.id} p={p} />
        ))}
      </div>

      {/* speed, boost, condition (raised clear of the pedals on touch screens) */}
      <Chip className={`absolute right-4 sm:right-6 px-4 py-3 w-60 ${touch ? 'bottom-[200px] scale-75 origin-bottom-right' : 'bottom-6'}`}>
        <div className="flex items-baseline gap-1.5">
          <div className="display text-5xl leading-none">{h.speed}</div>
          <div className="text-sm font-medium text-muted">km/h</div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Label className="w-16">{touch ? 'Boost' : 'Boost ⇧'}</Label>
          <Bar value={h.boost} tone={h.boosting ? 'hot' : 'brand'} className="flex-1 h-2" />
        </div>
        <div id="hud-condition" className="flex items-center gap-2 mt-2">
          <Label className="w-16">Car {Math.round(h.health)}%</Label>
          <Bar value={h.health / 100} tone={healthTone(h.health)} className="flex-1 h-2" />
        </div>
      </Chip>

      {/* street */}
      {!touch && h.street && <Chip className="absolute left-4 sm:left-6 bottom-6 px-3 py-1.5 text-xs font-semibold text-ink-2">{h.street}</Chip>}
    </div>
  );
}

/** free drive: the clock, the score and the combo */
function ScoreHud() {
  const h = useNM((s) => s.hud);
  const low = h.time < 10;
  const comboFrac = Math.max(0, Math.min(1, h.comboT / RULES.comboWindow));
  return (
    <>
      {/* clock */}
      <Chip className="absolute left-4 sm:left-6 top-4 sm:top-6 px-4 py-3 w-40">
        <Label>Time</Label>
        <div className={`display text-4xl leading-tight ${low ? 'text-hot throb' : 'text-ink'}`}>{h.time.toFixed(1)}</div>
        <Bar value={h.time / RULES.maxTime} tone={low ? 'hot' : 'brand'} className="w-full h-1.5 mt-1" />
      </Chip>

      {/* score + combo */}
      <div className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 flex flex-col items-center gap-2">
        <Chip className="px-5 py-2 text-center">
          <Label>Score</Label>
          <div className="display text-4xl leading-tight">{fmt(h.score)}</div>
        </Chip>
        <div className={`flex items-center gap-2 transition-opacity ${h.comboPoints > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="display text-xl px-3 h-9 inline-flex items-center rounded-full bg-brand text-white lift">x{h.mult}</span>
          <Chip className="px-3 h-9 flex items-center gap-2">
            <span className="display text-lg">{fmt(h.comboPoints)}</span>
            <Bar value={comboFrac} className="w-20 h-1.5" />
          </Chip>
        </div>
        <div className="flex gap-2 h-7">
          {h.oncoming && (
            <Badge tone="dark" className="text-sm px-3 py-1 rounded-full">
              Oncoming
            </Badge>
          )}
          {h.drifting && (
            <Badge tone="brand" className="text-sm px-3 py-1 rounded-full tabular-nums bg-paper lift">
              Drift {h.driftAngle}° · +{fmt(h.driftPoints)}
            </Badge>
          )}
        </div>
      </div>

      {/* damaged: how close to the end */}
      {h.damaged && (
        <Chip id="damaged" className="absolute left-4 sm:left-6 top-[132px] sm:top-[140px] px-3 py-2 flex items-center gap-2">
          <Badge tone="hot" className="throb">
            Damaged
          </Badge>
          <span className="text-xs text-ink-2">{h.lastHit ? 'a hard hit now ends the run' : 'it can take another big hit'}</span>
        </Chip>
      )}
    </>
  );
}

function Pause() {
  const paused = useNM((s) => s.paused);
  if (!paused) return null;
  return (
    <div className="absolute inset-0 bg-night/45 flex items-center justify-center pointer-events-auto rise p-4">
      <Card className="p-6 flex flex-col items-center gap-5 w-full max-w-md">
        <div className="display text-3xl">Paused</div>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button id="btn-resume" onClick={() => nm.togglePause()} className="flex-1">
            Resume · Esc
          </Button>
          <Button variant="tint" onClick={() => nm.retry()} className="flex-1">
            Restart · R
          </Button>
          <Button variant="ghost" onClick={() => nm.toTitle()} className="flex-1">
            Quit · Q
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ results
function ResultSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-night/45 pointer-events-auto flex justify-center overflow-y-auto p-4 rise">
      <Card className="w-full max-w-4xl my-auto p-6 flex flex-col gap-5">{children}</Card>
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
  const stats: [string, string][] = [
    ['Near misses', fmt(r.nearMisses)],
    ['Best multiplier', `x${r.bestCombo}`],
    ['Biggest bank', fmt(r.bestBank)],
    ['Top speed', `${r.topSpeed} km/h`],
    ['Distance', `${(r.distance / 1000).toFixed(2)} km`],
    ['Survived', `${r.seconds} s`],
    ['Against traffic', `${r.oncomingSec} s`],
    ['Drifts', `${r.drifts} · ${r.driftSec} s`],
    ['Best drift', fmt(r.bestDrift)],
    ['Closest pass', r.closest !== null ? `${Math.round(r.closest * 100)} cm` : '—'],
  ];
  return (
    <ResultSheet>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className={`display text-4xl ${r.reason === 'wrecked' ? 'text-hot' : 'text-ink'}`}>{r.reason === 'wrecked' ? 'Wrecked' : "Time's up"}</div>
          <div className="text-ink-2 mt-1">
            {r.car} · {r.cond}
          </div>
        </div>
        <div className="text-right">
          <Label>Score</Label>
          <div className="display text-6xl leading-none">{fmt(r.score)}</div>
          <div className="text-sm mt-1 text-muted">
            {r.rank === 1 ? <span className="text-brand font-semibold">New personal best</span> : r.rank > 0 ? `#${r.rank} of your top 10` : 'Not in your top 10'}
          </div>
        </div>
      </div>
      <StatGrid stats={stats} />
      {r.garage && <GarageResults g={r.garage} />}
      <ResultButtons again="Drive again" />
    </ResultSheet>
  );
}

function ResultButtons({ again }: { again: string }) {
  const racing = useNM((s) => s.result?.mode === 'race');
  // a car too damaged to start: the way on is the workshop, not another run
  const broken = useGarage((s) => s.setup().progress.health < MIN_HEALTH);
  return (
    <div className="flex gap-2 flex-wrap">
      {broken ? (
        <Button
          id="btn-again"
          variant="danger"
          size="lg"
          onClick={() => {
            nm.toTitle();
            useGarage.getState().setPanel('workshop');
          }}
        >
          Fix your car
        </Button>
      ) : (
        <Button id="btn-again" size="lg" onClick={() => nm.startRun()}>
          {again} <span className="text-sm font-medium text-white/70">Enter</span>
        </Button>
      )}
      {racing && (
        <Button id="btn-rematch" variant="tint" size="lg" onClick={() => nm.retry()}>
          Same route · R
        </Button>
      )}
      <Button id="btn-title" variant="tint" size="lg" onClick={() => nm.toTitle()}>
        Garage · Esc
      </Button>
    </div>
  );
}

function Wrecked() {
  const phase = useNM((s) => s.phase);
  if (phase !== 'wreck') return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="pop-long rounded-full bg-paper lift px-10 py-4">
        <span className="display text-6xl sm:text-7xl text-hot">Wrecked</span>
      </div>
    </div>
  );
}

export default function App() {
  const phase = useNM((s) => s.phase);
  const touch = useMemo(() => isTouch(), []);
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
      <div className="absolute inset-0 pointer-events-none">
        {phase === 'title' && <Title />}
        <Hud touch={touch} />
        <Countdown />
        <Wrecked />
        {touch && <TouchControls />}
        <Pause />
        <Results />
        {touch && <RotateNotice />}
      </div>
      {phase === 'loading' && <Loading />}
    </div>
  );
}
