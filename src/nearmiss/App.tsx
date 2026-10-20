import { useEffect, useMemo } from 'react';
import { GameCanvas } from '../scene/GameCanvas';
import { useStore } from '../state/store';
import type { Preset } from '../state/settings';
import { nm, CONDITIONS } from './NearMissGame';
import { useNM, Popup } from './store';
import { RaceHud, RaceResults } from './RaceUI';
import { RULES } from './scoring';
import { ConditionBar, GarageCard, GaragePanels, GarageResults, isTouch, RotateNotice, TouchControls } from './GarageUI';
import { useGarage } from './garage/store';
import { MIN_HEALTH } from './garage/progress';

// handles for automated tests and the browser console
Object.assign(window, { __nmStore: useNM, __garage: useGarage });

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

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
    <div className="absolute inset-0 bg-asphalt flex flex-col items-center justify-center gap-6 pointer-events-auto">
      <Logo size="text-[clamp(48px,9vw,96px)]" />
      <div className="w-80 h-1 bg-white/10 overflow-hidden">
        <div className="h-full bg-amber transition-all duration-300" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <div className="text-sm text-white/50 h-5">{t}</div>
      <HighScore />
    </div>
  );
}

/**
 * The free-drive high score and the race record, kept in this browser. Loading shows both; the title
 * shows the one for the mode that is picked, small, next to the mode buttons.
 */
function HighScore({ only }: { only?: 'score' | 'race' }) {
  const best = useNM((s) => s.best);
  const rs = useNM((s) => s.raceStats);
  const big = !only;
  const num = `display font-black tabular-nums leading-none ${big ? 'text-6xl' : 'text-4xl'}`;
  return (
    <div id="high-score" className={`flex items-end gap-8 ${big ? '' : 'text-right'}`}>
      {only !== 'race' && (
        <div className={big ? 'text-center' : ''}>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">High score</div>
          <div className={`${num} ${best.length ? 'text-amber' : 'text-white/25'}`}>{best.length ? fmt(best[0].score) : '—'}</div>
          {big && best.length > 0 && (
            <div className="text-[11px] text-white/45 mt-1">
              {best[0].car} · {best[0].cond}
            </div>
          )}
        </div>
      )}
      {only !== 'score' && (rs.races > 0 || only === 'race') && (
        <div className={big ? 'text-center' : ''}>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Races won</div>
          <div className={num}>
            {rs.wins}
            <span className={`text-white/40 ${big ? 'text-3xl' : 'text-2xl'}`}> / {rs.races}</span>
          </div>
          {big && rs.bestMargin > 0 && <div className="text-[11px] text-white/45 mt-1">best margin {rs.bestMargin.toFixed(1)} s</div>}
        </div>
      )}
    </div>
  );
}

function Logo({ size = 'text-7xl' }: { size?: string }) {
  return (
    <div className={`display font-black ${size} leading-[0.85] tracking-tight uppercase whitespace-nowrap`}>
      <span className="text-beam">MyGarage</span> <span className="text-amber">Drive</span>
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

function Title() {
  const cond = useNM((s) => s.cond);
  const mode = useNM((s) => s.mode);
  const set = useNM((s) => s.set);
  const preset = useStore((s) => s.settings.graphics.preset);
  const master = useStore((s) => s.settings.audio.master);
  const touch = useMemo(() => isTouch(), []);
  const hasBest = useNM((s) => s.best.length > 0);
  const raceCount = useNM((s) => s.raceStats.races);
  return (
    <div
      className="absolute inset-0 pointer-events-auto rise"
      style={{
        background: 'linear-gradient(90deg, rgba(11,12,16,0.94) 0%, rgba(11,12,16,0.72) 38%, rgba(11,12,16,0) 70%)',
      }}
    >
      <div className="h-full overflow-y-auto flex">
        <div className="my-auto py-4 w-full flex flex-col gap-[clamp(12px,2.6vh,24px)] pl-[max(48px,6vw)] pr-6 max-w-[560px]">
          <div className="flex flex-col gap-3">
            <Logo size="text-[clamp(44px,min(6.2vw,10vh),92px)]" />
            <div className="dashes w-44" />
            <div className="text-white/70 text-lg short:hidden">Your own car. Real traffic. Don't touch anything.</div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-end">
              {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => (
                <button
                  key={m}
                  id={`mode-${m}`}
                  onClick={() => set({ mode: m })}
                  className={`display font-black text-2xl uppercase px-4 py-1.5 border transition ${m === mode ? 'border-amber bg-amber text-asphalt' : 'border-white/15 text-white/70 hover:border-white/40'}`}
                >
                  {MODES[m].label}
                </button>
              ))}
              <div className="ml-auto">{(mode === 'race' ? raceCount > 0 : hasBest) && <HighScore only={mode} />}</div>
            </div>
            <div className="text-sm text-white/60 min-h-10 short:hidden">{MODES[mode].blurb}</div>
          </div>

          {/* the car: in the column on small screens, on the right on wide ones */}
          <div className="lg:absolute lg:right-[max(24px,3vw)] lg:top-1/2 lg:-translate-y-1/2 lg:w-[350px]">
            <GarageCard />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Conditions</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CONDITIONS).map(([id, c]) => (
                <button
                  key={id}
                  id={`cond-${id}`}
                  onClick={() => set({ cond: id })}
                  className={`px-3 py-1.5 text-sm border transition ${id === cond ? 'border-amber text-amber' : 'border-white/10 text-white/70 hover:border-white/30'}`}
                >
                  {c.label}
                  {c.grip < 1 ? ' · slippery' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-5 flex-wrap">
            {/* on short (phone landscape) screens the button stays pinned in the corner */}
            <button
              id="btn-drive"
              onClick={() => nm.startRun()}
              className="display font-black text-3xl uppercase bg-amber text-asphalt px-8 py-3 hover:brightness-110 transition short:fixed short:right-4 short:bottom-4 short:z-10 short:shadow-[0_6px_30px_rgba(0,0,0,0.6)]"
            >
              {MODES[mode].go} {!touch && <span className="text-base font-bold opacity-60 not-italic ml-1">Enter</span>}
            </button>
            <div className="text-xs text-white/45 leading-relaxed">
              {touch ? (
                <>
                  Steer on the left, pedals on the right
                  <br />
                  Boost and drift above the pedals
                </>
              ) : (
                <>
                  W A S D drive · Shift boost · Space drift
                  <br />
                  Esc pause · R restart{mode === 'race' ? ' · T back on track' : ''}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4 items-center text-xs text-white/45">
            <span>Graphics</span>
            {(['low', 'medium', 'high', 'ultra'] as Preset[]).map((p) => (
              <button key={p} onClick={() => useStore.getState().applyPreset(p)} className={`uppercase tracking-wider ${preset === p ? 'text-amber' : 'hover:text-white'}`}>
                {p}
              </button>
            ))}
            <span className="w-px h-3 bg-white/15" />
            <button onClick={() => useStore.getState().updateSettings((s) => (s.audio.master = s.audio.master > 0 ? 0 : 0.8))} className="hover:text-white">
              Sound {master > 0 ? 'on' : 'off'}
            </button>
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
      <div key={n} className="display font-black text-[180px] leading-none text-beam shadow-text count">
        {n}
      </div>
    </div>
  );
}

function PopupItem({ p }: { p: Popup }) {
  const color =
    p.kind === 'lost' || p.kind === 'damage' || p.kind === 'crash'
      ? 'text-brake'
      : p.kind === 'bank'
        ? 'text-amber'
        : p.kind === 'drift'
          ? 'text-sodium'
          : p.tier === 3
            ? 'text-brake'
            : p.tier === 2
              ? 'text-amber'
              : 'text-beam';
  const big = p.kind === 'bank' || p.kind === 'lost' || p.kind === 'damage' || p.kind === 'crash' || p.tier === 3 || p.label === 'MASSIVE DRIFT';
  return (
    <div className={`flex flex-col items-center shadow-text ${big ? 'pop-long' : 'pop'}`}>
      <div className={`display font-black uppercase leading-none ${color} ${big ? 'text-6xl' : 'text-4xl'}`}>{p.label}</div>
      <div className="display font-bold text-2xl text-beam/90">
        {p.sub ? <span className="text-oncoming mr-2">{p.sub}</span> : null}
        {p.points !== 0 ? `${p.points > 0 ? '+' : ''}${fmt(p.points)}` : ''}
      </div>
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
      <div className="absolute left-1/2 -translate-x-1/2 top-[38%] flex flex-col items-center gap-1">
        {popups.map((p) => (
          <PopupItem key={p.id} p={p} />
        ))}
      </div>

      {/* speed, boost, condition (raised clear of the pedals on touch screens) */}
      <div className={`absolute right-[max(24px,3vw)] flex flex-col items-end ${touch ? 'bottom-[205px] scale-75 origin-bottom-right' : 'bottom-6'}`}>
        <div className="flex items-baseline gap-2">
          <div className="display font-black text-8xl leading-none tabular-nums shadow-text">{h.speed}</div>
          <div className="display font-bold text-xl text-white/60">km/h</div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">{touch ? 'Boost' : 'Boost · Shift'}</div>
          <div className="w-56 h-3 bg-white/10 skew-x-[-18deg] overflow-hidden">
            <div className={`h-full ${h.boosting ? 'bg-brake' : 'bg-amber'}`} style={{ width: `${h.boost * 100}%` }} />
          </div>
        </div>
        <div id="hud-condition" className="flex items-center gap-3 mt-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Car {Math.round(h.health)}%</div>
          <ConditionBar health={h.health} />
        </div>
      </div>

      {/* street */}
      {!touch && <div className="absolute left-[max(24px,3vw)] bottom-6 text-sm text-white/55 uppercase tracking-[0.2em]">{h.street}</div>}
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
      <div className="absolute left-[max(24px,3vw)] top-6">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Time</div>
        <div className={`display font-black text-6xl leading-none tabular-nums shadow-text ${low ? 'text-brake throb' : 'text-beam'}`}>{h.time.toFixed(1)}</div>
        <div className="w-40 h-1 bg-white/10 mt-2">
          <div className={`h-full ${low ? 'bg-brake' : 'bg-beam'}`} style={{ width: `${(h.time / RULES.maxTime) * 100}%` }} />
        </div>
      </div>

      {/* score + combo */}
      <div className="absolute left-1/2 -translate-x-1/2 top-5 flex flex-col items-center">
        <div className="display font-black text-6xl leading-none tabular-nums shadow-text">{fmt(h.score)}</div>
        <div className={`mt-2 flex items-center gap-3 transition-opacity ${h.comboPoints > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="display font-black text-5xl text-amber leading-none shadow-text">x{h.mult}</div>
          <div className="flex flex-col">
            <div className="display font-bold text-2xl tabular-nums leading-none">{fmt(h.comboPoints)}</div>
            <div className="w-28 h-1 bg-white/10 mt-1">
              <div className="h-full bg-amber" style={{ width: `${comboFrac * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-2 h-6">
          {h.oncoming && <span className="display font-bold uppercase text-lg px-2 bg-oncoming text-asphalt">Oncoming</span>}
          {h.drifting && (
            <span className="display font-bold uppercase text-lg px-2 bg-sodium text-asphalt tabular-nums">
              Drift {h.driftAngle}° · +{fmt(h.driftPoints)}
            </span>
          )}
        </div>
      </div>

      {/* damaged: how close to the end */}
      {h.damaged && (
        <div id="damaged" className="absolute left-[max(24px,3vw)] top-[150px] flex items-center gap-2">
          <span className="display font-black uppercase text-xl px-2 bg-brake text-beam throb">Damaged</span>
          <span className="text-xs text-white/70 uppercase tracking-[0.16em]">{h.lastHit ? 'a hard hit now ends the run' : 'it can take another big hit'}</span>
        </div>
      )}
    </>
  );
}

function Pause() {
  const paused = useNM((s) => s.paused);
  if (!paused) return null;
  return (
    <div className="absolute inset-0 bg-asphalt/80 flex flex-col items-center justify-center gap-6 pointer-events-auto rise">
      <div className="display font-black text-7xl uppercase">Paused</div>
      <div className="flex gap-3">
        <button id="btn-resume" onClick={() => nm.togglePause()} className="display font-bold text-2xl uppercase bg-amber text-asphalt px-6 py-2">
          Resume · Esc
        </button>
        <button onClick={() => nm.retry()} className="display font-bold text-2xl uppercase border border-white/20 px-6 py-2 hover:border-white/50">
          Restart · R
        </button>
        <button onClick={() => nm.toTitle()} className="display font-bold text-2xl uppercase border border-white/20 px-6 py-2 hover:border-white/50">
          Quit · Q
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ results
function Results() {
  const r = useNM((s) => s.result);
  const phase = useNM((s) => s.phase);
  if (phase !== 'results' || !r) return null;
  if (r.mode === 'race' && r.race) {
    return (
      <div className="absolute inset-0 bg-asphalt/85 pointer-events-auto flex items-center justify-center px-6 rise">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          <RaceResults r={r} />
          {r.garage && <GarageResults g={r.garage} />}
          <ResultButtons again="New race" />
        </div>
      </div>
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
    <div className="absolute inset-0 bg-asphalt/85 pointer-events-auto flex items-center justify-center px-6 rise">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className={`display font-black text-5xl uppercase ${r.reason === 'wrecked' ? 'text-brake' : 'text-amber'}`}>
              {r.reason === 'wrecked' ? 'Wrecked' : "Time's up"}
            </div>
            <div className="text-white/55 mt-1">
              {r.car} · {r.cond}
            </div>
          </div>
          <div className="text-right">
            <div className="display font-black text-8xl leading-none tabular-nums">{fmt(r.score)}</div>
            <div className="text-sm mt-1 text-white/60">
              {r.rank === 1 ? <span className="text-amber font-semibold">New personal best</span> : r.rank > 0 ? `#${r.rank} of your top 10` : 'Not in your top 10'}
            </div>
          </div>
        </div>
        <div className="dashes" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-4">
          {stats.map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">{k}</div>
              <div className="display font-bold text-3xl tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {r.garage && <GarageResults g={r.garage} />}
        <ResultButtons again="Drive again" />
      </div>
    </div>
  );
}

function ResultButtons({ again }: { again: string }) {
  const racing = useNM((s) => s.result?.mode === 'race');
  // a car too damaged to start: the way on is the workshop, not another run
  const broken = useGarage((s) => s.setup().progress.health < MIN_HEALTH);
  return (
    <div className="flex gap-3 mt-2 flex-wrap">
      {broken ? (
        <button
          id="btn-again"
          onClick={() => {
            nm.toTitle();
            useGarage.getState().setPanel('workshop');
          }}
          className="display font-black text-3xl uppercase bg-brake text-beam px-8 py-3 hover:brightness-110"
        >
          Fix your car
        </button>
      ) : (
        <button id="btn-again" onClick={() => nm.startRun()} className="display font-black text-3xl uppercase bg-amber text-asphalt px-8 py-3 hover:brightness-110">
          {again} <span className="text-base font-bold opacity-60 not-italic ml-1">Enter</span>
        </button>
      )}
      {racing && (
        <button id="btn-rematch" onClick={() => nm.retry()} className="display font-bold text-2xl uppercase border border-white/20 px-6 py-3 hover:border-white/50">
          Same route · R
        </button>
      )}
      <button id="btn-title" onClick={() => nm.toTitle()} className="display font-bold text-2xl uppercase border border-white/20 px-6 py-3 hover:border-white/50">
        Garage · Esc
      </button>
    </div>
  );
}

function Wrecked() {
  const phase = useNM((s) => s.phase);
  if (phase !== 'wreck') return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="display font-black text-[140px] uppercase text-brake shadow-text pop-long">Wrecked</div>
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
