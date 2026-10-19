import { useEffect } from 'react';
import { GameCanvas } from '../scene/GameCanvas';
import { useStore } from '../state/store';
import type { Preset } from '../state/settings';
import { nm, CARS, CONDITIONS } from './NearMissGame';
import { useNM, Popup } from './store';
import { VEHICLES } from '../sim/vehicles';
import { RULES } from './scoring';

// handles for automated tests and the browser console
Object.assign(window, { __nmStore: useNM });

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ------------------------------------------------------------------ keys
function useKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useNM.getState();
      if (e.repeat) return;
      if (e.code === 'Enter' && (st.phase === 'title' || st.phase === 'results')) nm.startRun();
      else if (e.code === 'KeyR' && (st.phase === 'run' || st.phase === 'countdown' || st.phase === 'results' || st.phase === 'wreck')) nm.retry();
      else if (e.code === 'Escape') {
        if (st.phase === 'run' || st.phase === 'countdown') nm.togglePause();
        else if (st.phase === 'results') nm.toTitle();
      } else if (e.code === 'KeyQ' && st.paused) nm.toTitle();
      else if (st.phase === 'title' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        const d = e.code === 'ArrowLeft' ? -1 : 1;
        st.set({ carIndex: (st.carIndex + d + CARS.length) % CARS.length });
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
  return (
    <div className="absolute inset-0 bg-asphalt flex flex-col items-center justify-center gap-6 pointer-events-auto">
      <Logo size="text-8xl" />
      <div className="w-80 h-1 bg-white/10 overflow-hidden">
        <div className="h-full bg-amber transition-all duration-300" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <div className="text-sm text-white/50 h-5">{t}</div>
    </div>
  );
}

function Logo({ size = 'text-7xl' }: { size?: string }) {
  return (
    <div className={`display font-black ${size} leading-[0.85] tracking-tight uppercase`}>
      <span className="text-beam">Near</span> <span className="text-amber">Miss</span>
    </div>
  );
}

// ------------------------------------------------------------------ title
function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/45 whitespace-nowrap">{label}</div>
      <div className="flex-1 flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 ${i < Math.round(value * 10) ? 'bg-amber' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  );
}

function carStats(type: number) {
  const s = VEHICLES[type];
  return {
    top: Math.min(1, s.maxSpeed / 76),
    accel: Math.min(1, s.engine / s.mass / 7.8),
    grip: Math.min(1, (s.grip - 1.9) / 1.0),
    size: Math.min(1, 1 - (s.width * s.length - 6.5) / 3.2),
  };
}

function Title() {
  const carIndex = useNM((s) => s.carIndex);
  const cond = useNM((s) => s.cond);
  const best = useNM((s) => s.best);
  const set = useNM((s) => s.set);
  const preset = useStore((s) => s.settings.graphics.preset);
  const master = useStore((s) => s.settings.audio.master);
  const car = CARS[carIndex];
  const st = carStats(car.type);
  return (
    <div className="absolute inset-0 pointer-events-auto rise" style={{ background: 'linear-gradient(90deg, rgba(11,12,16,0.94) 0%, rgba(11,12,16,0.72) 38%, rgba(11,12,16,0) 70%)' }}>
      <div className="h-full flex flex-col justify-center gap-6 pl-[max(48px,6vw)] pr-6 max-w-[560px]">
        <div className="flex flex-col gap-3">
          <Logo size="text-[clamp(64px,9vw,128px)]" />
          <div className="dashes w-44" />
          <div className="text-white/70 text-lg">Pass close. Go fast. Don't touch anything.</div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Car · ← →</div>
          <div className="grid grid-cols-2 gap-2">
            {CARS.map((c, i) => (
              <button
                key={c.name}
                id={`car-${i}`}
                onClick={() => set({ carIndex: i })}
                className={`text-left px-3 py-2.5 border transition ${i === carIndex ? 'border-amber bg-amber/10' : 'border-white/10 hover:border-white/30'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#' + c.color.toString(16).padStart(6, '0') }} />
                  <span className="display font-bold text-lg leading-tight uppercase truncate">{c.name}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="text-sm text-white/60 min-h-5">{car.blurb}</div>
          <div className="flex flex-col gap-1.5">
            <StatBar label="Top speed" value={st.top} />
            <StatBar label="Accel" value={st.accel} />
            <StatBar label="Grip" value={st.grip} />
            <StatBar label="Slim" value={st.size} />
          </div>
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
          <button id="btn-drive" onClick={() => nm.startRun()} className="display font-black text-3xl uppercase bg-amber text-asphalt px-8 py-3 hover:brightness-110 transition">
            Drive <span className="text-base font-bold opacity-60 not-italic ml-1">Enter</span>
          </button>
          <div className="text-xs text-white/45 leading-relaxed">
            W A S D drive · Shift boost · Space handbrake
            <br />
            Esc pause · R restart
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

      {best.length > 0 && (
        <div className="absolute right-[max(24px,4vw)] top-1/2 -translate-y-1/2 w-72 hidden lg:block">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45 mb-2">Your best runs</div>
          <div className="flex flex-col">
            {best.slice(0, 6).map((b, i) => (
              <div key={b.date} className="flex items-baseline gap-3 py-1.5 border-b border-white/8">
                <span className="display text-white/40 w-4">{i + 1}</span>
                <span className="display font-bold text-2xl tabular-nums flex-1">{fmt(b.score)}</span>
                <span className="text-[11px] text-white/45 text-right leading-tight">
                  {b.car}
                  <br />
                  {b.cond} · x{b.bestCombo}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const color = p.kind === 'lost' ? 'text-brake' : p.kind === 'bank' ? 'text-amber' : p.tier === 3 ? 'text-brake' : p.tier === 2 ? 'text-amber' : 'text-beam';
  const big = p.kind === 'bank' || p.kind === 'lost' || p.tier === 3;
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

function Hud() {
  const h = useNM((s) => s.hud);
  const phase = useNM((s) => s.phase);
  const popups = useNM((s) => s.popups);
  if (phase !== 'run' && phase !== 'countdown' && phase !== 'wreck') return null;
  const low = h.time < 10;
  const comboFrac = Math.max(0, Math.min(1, h.comboT / RULES.comboWindow));
  return (
    <div className="absolute inset-0 pointer-events-none">
      {h.boosting && <div className="absolute inset-0 streaks throb" />}

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
          {h.drifting && <span className="display font-bold uppercase text-lg px-2 bg-sodium text-asphalt">Drift</span>}
        </div>
      </div>

      {/* popups */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[38%] flex flex-col items-center gap-1">
        {popups.map((p) => (
          <PopupItem key={p.id} p={p} />
        ))}
      </div>

      {/* speed + boost */}
      <div className="absolute right-[max(24px,3vw)] bottom-6 flex flex-col items-end">
        <div className="flex items-baseline gap-2">
          <div className="display font-black text-8xl leading-none tabular-nums shadow-text">{h.speed}</div>
          <div className="display font-bold text-xl text-white/60">km/h</div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Boost · Shift</div>
          <div className="w-56 h-3 bg-white/10 skew-x-[-18deg] overflow-hidden">
            <div className={`h-full ${h.boosting ? 'bg-brake' : 'bg-amber'}`} style={{ width: `${h.boost * 100}%` }} />
          </div>
        </div>
      </div>

      {/* street */}
      <div className="absolute left-[max(24px,3vw)] bottom-6 text-sm text-white/55 uppercase tracking-[0.2em]">{h.street}</div>
    </div>
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
  const stats: [string, string][] = [
    ['Near misses', fmt(r.nearMisses)],
    ['Best multiplier', `x${r.bestCombo}`],
    ['Biggest bank', fmt(r.bestBank)],
    ['Top speed', `${r.topSpeed} km/h`],
    ['Distance', `${(r.distance / 1000).toFixed(2)} km`],
    ['Survived', `${r.seconds} s`],
    ['Against traffic', `${r.oncomingSec} s`],
    ['Drifting', `${r.driftSec} s`],
    ['Closest pass', r.closest !== null ? `${Math.round(r.closest * 100)} cm` : '—'],
  ];
  return (
    <div className="absolute inset-0 bg-asphalt/85 pointer-events-auto flex items-center justify-center px-6 rise">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className={`display font-black text-5xl uppercase ${r.reason === 'wrecked' ? 'text-brake' : 'text-amber'}`}>{r.reason === 'wrecked' ? 'Wrecked' : "Time's up"}</div>
            <div className="text-white/55 mt-1">
              {r.car} · {r.cond}
            </div>
          </div>
          <div className="text-right">
            <div className="display font-black text-8xl leading-none tabular-nums">{fmt(r.score)}</div>
            <div className="text-sm mt-1 text-white/60">{r.rank === 1 ? <span className="text-amber font-semibold">New personal best</span> : r.rank > 0 ? `#${r.rank} of your top 10` : 'Not in your top 10'}</div>
          </div>
        </div>
        <div className="dashes" />
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          {stats.map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">{k}</div>
              <div className="display font-bold text-3xl tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          <button id="btn-again" onClick={() => nm.startRun()} className="display font-black text-3xl uppercase bg-amber text-asphalt px-8 py-3 hover:brightness-110">
            Drive again <span className="text-base font-bold opacity-60 not-italic ml-1">Enter</span>
          </button>
          <button id="btn-title" onClick={() => nm.toTitle()} className="display font-bold text-2xl uppercase border border-white/20 px-6 py-3 hover:border-white/50">
            Change car · Esc
          </button>
        </div>
      </div>
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

function NarrowNotice() {
  return (
    <div className="absolute inset-x-4 bottom-4 sm:hidden bg-tarmac border border-white/10 p-3 text-sm text-white/70 pointer-events-auto">
      Near Miss needs a keyboard. Open it on a computer to drive.
    </div>
  );
}

export default function App() {
  const phase = useNM((s) => s.phase);
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
        <Hud />
        <Countdown />
        <Wrecked />
        <Pause />
        <Results />
        <NarrowNotice />
      </div>
      {phase === 'loading' && <Loading />}
    </div>
  );
}
