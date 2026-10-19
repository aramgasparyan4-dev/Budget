import { useEffect } from 'react';
import { useShop, useMiniGame } from '../state/uiStores';
import { useStore } from '../state/store';
import { game } from '../game/Game';
import { formatMoney } from '../core/math';

function close() {
  useShop.getState().set(null);
  useStore.getState().setOverlay(null);
  game.audio.ui('close');
  game.input.requestLock();
}

export function ShopUI() {
  const v = useShop((s) => s.view);
  const handler = useShop((s) => s.handler);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useShop.getState().view) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!v) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-auto anim-fade" onClick={close}>
      <div className="glass rounded-3xl w-[560px] max-h-[80vh] flex flex-col anim-slide" onClick={(e) => e.stopPropagation()}>
        <div className="px-7 pt-6 pb-4 border-b border-white/8">
          <div className="text-2xl font-semibold">{v.title}</div>
          <div className="text-sm text-white/55 mt-1">{v.subtitle}</div>
        </div>
        <div className="overflow-y-auto scroll-thin px-4 py-3 flex flex-col gap-1.5">
          {v.items.map((it) => (
            <button
              key={it.id}
              disabled={!!it.disabled && !it.owned}
              onClick={() => {
                game.audio.ui('click');
                handler?.(it.id, 'item');
              }}
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/6 disabled:opacity-40 text-left transition"
            >
              {it.color && <span className="w-6 h-6 rounded-full border border-white/20" style={{ background: it.color }} />}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{it.name}</div>
                {(it.desc || it.disabled) && <div className="text-xs text-white/45">{it.disabled && !it.owned ? it.disabled : it.desc}</div>}
              </div>
              <div className={`font-semibold tabular-nums ${it.owned ? 'text-accent' : 'text-white'}`}>{it.owned ? (v.mode === 'service' ? 'Wear' : 'Owned · wear') : it.price > 0 ? formatMoney(it.price, it.price < 100) : ''}</div>
            </button>
          ))}
          {v.actions.map((a) => (
            <button
              key={a.id}
              disabled={a.disabled}
              onClick={() => {
                game.audio.ui('click');
                handler?.(a.id, 'action');
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-accent/15 border border-white/8 disabled:opacity-40 text-left transition"
            >
              <span className="font-medium">{a.label}</span>
              {a.hint && <span className="text-xs text-white/45 ml-3 text-right">{a.hint}</span>}
            </button>
          ))}
        </div>
        {v.footer && <div className="px-7 py-3 text-xs text-white/50 whitespace-pre-line border-t border-white/8">{v.footer}</div>}
        <div className="px-7 py-4 flex justify-end border-t border-white/8">
          <button onClick={close} className="px-5 py-2 rounded-full bg-white/8 hover:bg-white/15 text-sm">
            Close <span className="text-white/40 ml-1">ESC</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function MiniGameUI() {
  const v = useMiniGame((s) => s.view);
  const answer = useMiniGame((s) => s.answer);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= 4) useMiniGame.getState().answer?.(k - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!v) return null;
  const limit = v.kind === 'stock' ? 9 : 7;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-auto anim-fade">
      <div className="glass rounded-3xl w-[600px] p-8 anim-slide">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-accent">On shift</div>
            <div className="text-2xl font-semibold">{v.title}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white/55">
              Round {v.round}/{v.rounds}
            </div>
            <div className="text-lg font-semibold tabular-nums">Score {v.score.toFixed(1)}</div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 mt-5 overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(Math.max(0, v.timeLeft) / limit) * 100}%`, background: v.timeLeft < 2.5 ? '#ff5a6e' : undefined }} />
        </div>
        <div className="text-xl mt-6 min-h-[64px] leading-snug">{v.prompt}</div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          {v.choices.map((c, i) => (
            <button key={c + i} onClick={() => answer?.(i)} className="rounded-xl px-4 py-3 bg-white/6 hover:bg-accent/20 border border-white/10 text-left transition">
              <span className="text-accent font-bold mr-2">{i + 1}</span>
              {c}
            </button>
          ))}
        </div>
        <div className={`mt-5 h-6 text-center font-semibold ${v.feedback?.startsWith('Nice') ? 'text-[#7ae582]' : 'text-[#ff8a8a]'}`}>{v.feedback}</div>
      </div>
    </div>
  );
}

export function SleepUI() {
  const overlay = useStore((s) => s.overlay);
  if (overlay !== 'sleep') return null;
  const s = game.session;
  const h = s?.clock.hour ?? 12;
  const untilMorning = Math.max(1, Math.round(((h < 7 ? 7 - h : 31 - h) * 10)) / 10);
  const opts = [
    { label: 'Nap · 2 hours', hours: 2 },
    { label: 'Rest · 4 hours', hours: 4 },
    { label: 'Full night · 8 hours', hours: 8 },
    { label: `Until morning · ${untilMorning.toFixed(1)}h`, hours: untilMorning },
  ];
  const go = (hours: number) => {
    useStore.getState().setOverlay(null);
    s?.sleep(hours);
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-auto anim-fade" onClick={() => useStore.getState().setOverlay(null)}>
      <div className="glass rounded-3xl w-[420px] p-7 anim-slide" onClick={(e) => e.stopPropagation()}>
        <div className="text-2xl font-semibold">Get some rest</div>
        <div className="text-sm text-white/55 mt-1">Sleeping restores energy and saves your game. The city keeps living while you sleep.</div>
        <div className="flex flex-col gap-2 mt-5">
          {opts.map((o) => (
            <button key={o.label} onClick={() => go(o.hours)} className="rounded-xl px-4 py-3 bg-white/6 hover:bg-accent/20 border border-white/10 text-left">
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FadeOverlay() {
  const fade = useStore((s) => s.fade);
  const label = useStore((s) => s.skipLabel);
  return (
    <div className="absolute inset-0 bg-black pointer-events-none flex items-center justify-center" style={{ opacity: fade }}>
      {label && fade > 0.6 && <div className="text-2xl tracking-[0.3em] uppercase text-white/80 anim-pulse">{label}</div>}
    </div>
  );
}

export function PerfOverlay() {
  const show = useStore((s) => s.settings.gameplay.showPerf);
  const p = useStore((s) => s.perf);
  if (!show) return null;
  const row = (k: string, v: string | number) => (
    <div className="flex justify-between gap-6">
      <span className="text-white/50">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
  return (
    <div className="absolute right-4 top-28 glass rounded-xl px-4 py-3 text-[11px] font-mono w-56 pointer-events-none">
      <div className="text-accent text-[10px] uppercase tracking-[0.2em] mb-1">Performance · F3</div>
      {row('FPS', p.fps)}
      {row('Frame ms', p.frameMs)}
      {row('Sim ms', p.simMs)}
      {row('Draw calls', p.drawCalls)}
      {row('Triangles', `${(p.triangles / 1000).toFixed(0)}k`)}
      {row('Active NPCs', p.activeNpcs)}
      {row('Simulated NPCs', p.simulatedNpcs)}
      {row('Vehicles', p.activeVehicles)}
      {row('Chunks (detail)', `${p.loadedChunks} (${p.detailChunks})`)}
      {row('Physics bodies', p.physicsBodies)}
      {row('JS heap', p.memory !== null ? `${p.memory} MB` : 'n/a')}
    </div>
  );
}
