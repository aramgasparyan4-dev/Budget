import { useEffect, useState } from 'react';
import { useDialogue } from '../state/uiStores';
import { game } from '../game/Game';

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 16);
    return () => clearInterval(id);
  }, [text]);
  return <span>{text.slice(0, n)}</span>;
}

function RelBar({ label, value, min = -100, color }: { label: string; value: number; min?: number; color: string }) {
  const t = (value - min) / (100 - min);
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/45">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, t * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

export function DialogueUI() {
  const v = useDialogue((s) => s.view);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = useDialogue.getState().view;
      if (!d) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 9) {
        const o = d.options.filter((x) => !x.disabled)[k - 1];
        const all = d.options;
        const pick = all[k - 1];
        if (pick && !pick.disabled) game.session?.dialogue.choose(pick.id);
        else if (o) game.session?.dialogue.choose(o.id);
      }
      if (e.key === 'Escape') game.session?.dialogue.end();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!v) return null;
  const moodFace = v.mood > 0.35 ? '😊' : v.mood > 0 ? '🙂' : v.mood > -0.35 ? '😐' : '😠';
  const last = v.lines[v.lines.length - 1];
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-auto anim-slide">
      <div className="mx-auto max-w-5xl mb-8 flex gap-4 items-end px-6">
        <div className="glass rounded-2xl p-4 w-72 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2a3a4f] to-[#121924] flex items-center justify-center text-2xl">{moodFace}</div>
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight truncate">{v.name}</div>
              <div className="text-xs text-white/55 leading-tight truncate">{v.subtitle}</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-accent">{v.stage}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {v.traits.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/75">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <RelBar label="Friendship" value={v.rel.friend} color="#7ae582" />
            <RelBar label="Trust" value={v.rel.trust} color="#57e3d6" />
            <RelBar label="Familiarity" value={v.rel.fam} min={0} color="#9fb3c8" />
            {v.rel.romance > 5 && <RelBar label="Romance" value={v.rel.romance} min={0} color="#ff8fd8" />}
          </div>
          {v.schedule && (
            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 mb-1">Their day</div>
              {v.schedule.slice(0, 7).map((s, i) => (
                <div key={i} className="flex gap-2 text-[11px] text-white/70">
                  <span className="tabular-nums text-white/45 w-10">{s.time}</span>
                  <span className="truncate">{s.what}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="glass rounded-2xl p-5">
            {v.lines.slice(0, -1).slice(-2).map((l, i) => (
              <div key={i} className={`text-sm mb-1.5 ${l.who === 'you' ? 'text-accent/80' : 'text-white/55'}`}>
                {l.who === 'you' ? 'You: ' : ''}
                {l.text}
              </div>
            ))}
            {last && (
              <div className={`text-lg leading-snug ${last.who === 'you' ? 'text-accent' : 'text-white'}`}>
                {last.who === 'you' ? 'You: ' : ''}
                {last.who === 'npc' ? <Typewriter text={last.text} /> : last.text}
              </div>
            )}
            {v.thinking && <div className="text-white/50 text-sm mt-1 anim-pulse">…</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {v.options.map((o, i) => (
              <button
                key={o.id}
                disabled={o.disabled}
                onClick={() => game.session?.dialogue.choose(o.id)}
                className="glass rounded-xl px-4 py-2.5 text-left flex items-center gap-3 hover:border-accent/60 hover:bg-white/5 disabled:opacity-35 transition"
              >
                <span className="text-[11px] font-bold text-accent w-4">{i + 1}</span>
                <span className="text-sm">{o.label}</span>
                {o.hint && <span className="ml-auto text-[10px] text-white/40">{o.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
