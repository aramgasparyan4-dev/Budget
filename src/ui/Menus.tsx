import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { game, DEFAULT_SEED } from '../game/Game';
import { beginPlay, loadSlot, quitToMenu, saveSlot, startNewGame } from '../game/flow';
import { deleteSave, formatPlaytime, listSaves, SaveMeta, SLOTS, SlotId } from '../game/SaveSystem';
import { SettingsPanel, ControlsList } from './Settings';
import { formatMoney } from '../core/math';
import { HAIR_COLS, SKIN_TONES, HumanLook } from '../render/Human';
import { OUTFITS } from '../game/PlayerState';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

function MenuButton({ children, onClick, disabled, sub, id }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; sub?: string; id?: string }) {
  return (
    <button
      id={id}
      disabled={disabled}
      onClick={() => {
        game.audio.ui('click');
        onClick();
      }}
      className="group text-left disabled:opacity-30 py-1.5"
    >
      <div className="text-2xl font-medium tracking-wide text-white/85 group-hover:text-accent group-hover:translate-x-1.5 transition-all">{children}</div>
      {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
    </button>
  );
}

function Panel({ title, onClose, children, width = 720 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 pointer-events-auto anim-fade">
      <div className="glass rounded-3xl max-h-[86vh] flex flex-col anim-slide" style={{ width }}>
        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-white/8">
          <div className="text-2xl font-semibold">{title}</div>
          <button onClick={onClose} className="px-4 py-1.5 rounded-full bg-white/8 hover:bg-white/15 text-sm">
            Back <span className="text-white/40 ml-1">ESC</span>
          </button>
        </div>
        <div className="overflow-y-auto scroll-thin px-8 py-5">{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ loading
const TIPS = [
  'Residents remember how you treat them — and they talk to each other.',
  'Every business has real staff, stock and customers. Prices react to demand.',
  'Red lights matter. So do the drivers you cut off.',
  'Sleep at home to restore energy and autosave.',
  'Friends with your number will text you invitations.',
  'Food deliveries come from real residents who are hungry right now.',
];

export function LoadingScreen() {
  const progress = useStore((s) => s.loadingProgress);
  const text = useStore((s) => s.loadingText);
  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink pointer-events-auto" style={{ background: 'radial-gradient(80% 60% at 50% 40%, #12202c 0%, #05070c 70%)' }}>
      <div className="text-[11px] uppercase tracking-[0.6em] text-accent mb-3">a living city</div>
      <div className="text-6xl font-semibold tracking-[0.42em] pl-[0.42em]">ECHO CITY</div>
      <div className="mt-10 w-80 h-[3px] bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="mt-3 text-sm text-white/55 h-5">{text}</div>
      <div className="absolute bottom-10 text-sm text-white/40 max-w-lg text-center">{tip}</div>
    </div>
  );
}

// ------------------------------------------------------------------ main menu
export function MainMenu() {
  const overlay = useStore((s) => s.overlay);
  const setOverlay = useStore((s) => s.setOverlay);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [panel, setPanel] = useState<null | 'credits'>(null);
  useEffect(() => {
    listSaves().then(setSaves);
  }, [overlay]);
  const latest = saves[0];
  return (
    <div className="absolute inset-0 pointer-events-auto">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(5,7,12,0.88) 0%, rgba(5,7,12,0.55) 32%, rgba(5,7,12,0) 60%)' }} />
      {overlay === null && !panel && (
        <div className="absolute left-20 top-0 bottom-0 flex flex-col justify-center anim-fade">
          <div className="text-[11px] uppercase tracking-[0.6em] text-accent mb-2">an urban life simulation</div>
          <div className="text-7xl font-semibold tracking-[0.3em] text-shadow">ECHO CITY</div>
          <div className="text-white/50 mt-3 max-w-md">640 residents with jobs, memories and routines. Six districts. One life to build.</div>
          <div className="mt-12 flex flex-col gap-1">
            {latest && (
              <MenuButton id="btn-continue" onClick={() => loadSlot(latest.slot)} sub={`${latest.name} · ${latest.label}`}>
                Continue
              </MenuButton>
            )}
            <MenuButton id="btn-new" onClick={() => setOverlay('newgame')}>
              New Game
            </MenuButton>
            <MenuButton id="btn-load" onClick={() => setOverlay('saveload')} disabled={!saves.length}>
              Load Game
            </MenuButton>
            <MenuButton id="btn-settings" onClick={() => setOverlay('settings')}>
              Settings
            </MenuButton>
            <MenuButton onClick={() => setOverlay('controls')}>Controls</MenuButton>
            <MenuButton onClick={() => setPanel('credits')}>Credits</MenuButton>
          </div>
        </div>
      )}
      <div className="absolute left-20 bottom-8 text-[11px] text-white/30">v0.1 · procedural city seed {game.worldSeed}</div>
      {overlay === 'newgame' && <NewGamePanel onClose={() => setOverlay(null)} />}
      {overlay === 'saveload' && <SaveLoadPanel mode="load" onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && (
        <Panel title="Settings" onClose={() => setOverlay(null)}>
          <SettingsPanel />
        </Panel>
      )}
      {overlay === 'controls' && (
        <Panel title="Controls" onClose={() => setOverlay(null)}>
          <ControlsList />
        </Panel>
      )}
      {panel === 'credits' && (
        <Panel title="Credits" onClose={() => setPanel(null)} width={560}>
          <div className="text-sm text-white/70 leading-relaxed space-y-3">
            <p>Echo City is generated entirely in code: every street, building, resident, car model, texture and sound is procedural. There are no downloaded art or audio assets.</p>
            <p>Built with React, Three.js, React Three Fiber, postprocessing, Rapier physics, Zustand, Vite, Tailwind CSS and IndexedDB.</p>
            <p className="text-white/45">Optional: point the Gameplay → Local LLM setting at an OpenAI-compatible server (for example Ollama) to let residents improvise dialogue.</p>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ character creation
const HAIR_STYLES = ['Short', 'Long', 'Bun', 'Bald'];

function Avatar({ look }: { look: { skin: number; hair: number; hairStyle: number; build: number; height: number } }) {
  const starter = OUTFITS[0];
  const w = 1 * look.build;
  const h = 1 + look.height;
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  return (
    <svg viewBox="0 0 200 300" className="w-full h-full">
      <defs>
        <radialGradient id="av-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1d3442" />
          <stop offset="100%" stopColor="#07090d" />
        </radialGradient>
      </defs>
      <rect width="200" height="300" rx="24" fill="url(#av-bg)" />
      <ellipse cx="100" cy="282" rx="48" ry="7" fill="rgba(0,0,0,0.45)" />
      <g transform={`translate(100 280) scale(${w} ${h}) translate(-100 -280)`}>
        {/* legs */}
        <rect x="80" y="180" width="17" height="98" rx="7" fill={hex(starter.pants)} />
        <rect x="103" y="180" width="17" height="98" rx="7" fill={hex(starter.pants)} />
        {/* torso & arms */}
        <rect x="70" y="100" width="60" height="88" rx="18" fill={hex(starter.shirt)} />
        <rect x="56" y="106" width="16" height="74" rx="8" fill={hex(starter.shirt)} />
        <rect x="128" y="106" width="16" height="74" rx="8" fill={hex(starter.shirt)} />
        <circle cx="64" cy="184" r="7" fill={skin} />
        <circle cx="136" cy="184" r="7" fill={skin} />
        {/* neck & head */}
        <rect x="92" y="88" width="16" height="16" fill={skin} />
        {look.hairStyle === 1 && <rect x="74" y="56" width="52" height="58" rx="20" fill={hair} />}
        <ellipse cx="100" cy="68" rx="22" ry="26" fill={skin} />
        {look.hairStyle === 0 && <path d="M78 64 Q78 38 100 38 Q122 38 122 64 Q118 50 100 50 Q82 50 78 64 Z" fill={hair} />}
        {look.hairStyle === 1 && <path d="M77 66 Q76 38 100 38 Q124 38 123 66 Q116 48 100 48 Q84 48 77 66 Z" fill={hair} />}
        {look.hairStyle === 2 && (
          <>
            <path d="M78 64 Q78 38 100 38 Q122 38 122 64 Q118 50 100 50 Q82 50 78 64 Z" fill={hair} />
            <circle cx="100" cy="34" r="11" fill={hair} />
          </>
        )}
        <circle cx="92" cy="70" r="2.2" fill="#1a1210" />
        <circle cx="108" cy="70" r="2.2" fill="#1a1210" />
      </g>
    </svg>
  );
}

function NewGamePanel({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('Alex');
  const [skin, setSkin] = useState(SKIN_TONES[1]);
  const [hair, setHair] = useState(HAIR_COLS[2]);
  const [hairStyle, setHairStyle] = useState(0);
  const [build, setBuild] = useState(1);
  const [height, setHeight] = useState(0.1);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [skipTut, setSkipTut] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    const look: HumanLook = {
      shirt: new THREE.Color(),
      pants: new THREE.Color(),
      skin: new THREE.Color(skin),
      hair: new THREE.Color(hair),
      hairStyle,
      build,
      height,
      seed: Math.random(),
    };
    await startNewGame({ name, look, seed, skipTutorial: skipTut });
  };
  const swatch = (c: number, cur: number, set: (c: number) => void) => (
    <button key={c} onClick={() => set(c)} className={`w-8 h-8 rounded-full border-2 transition ${cur === c ? 'border-accent scale-110' : 'border-white/10'}`} style={{ background: hex(c) }} />
  );
  return (
    <Panel title="New life" onClose={onClose} width={860}>
      <div className="flex gap-8">
        <div className="w-56 h-80 shrink-0 rounded-3xl overflow-hidden">
          <Avatar look={{ skin, hair, hairStyle, build, height }} />
        </div>
        <div className="flex-1 flex flex-col gap-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Name</div>
            <input
              id="in-name"
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/8 rounded-xl px-4 py-2.5 text-lg outline-none focus:ring-2 ring-accent/60"
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Skin tone</div>
            <div className="flex gap-2 flex-wrap">{SKIN_TONES.map((c) => swatch(c, skin, setSkin))}</div>
          </div>
          <div className="flex gap-8">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Hair</div>
              <div className="flex rounded-full bg-white/8 p-0.5">
                {HAIR_STYLES.map((h, i) => (
                  <button key={h} onClick={() => setHairStyle(i)} className={`px-3 py-1 rounded-full text-xs ${hairStyle === i ? 'bg-accent text-ink font-semibold' : 'text-white/70'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Hair colour</div>
              <div className="flex gap-1.5 flex-wrap">{HAIR_COLS.map((c) => swatch(c, hair, setHair))}</div>
            </div>
          </div>
          <div className="flex gap-8">
            <label className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Build</div>
              <input type="range" min={0.86} max={1.18} step={0.01} value={build} onChange={(e) => setBuild(Number(e.target.value))} className="w-full accent-[#57e3d6]" />
            </label>
            <label className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">Height</div>
              <input type="range" min={0} max={0.18} step={0.01} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full accent-[#57e3d6]" />
            </label>
          </div>
          <div className="flex gap-6 items-end">
            <label>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1.5">City seed</div>
              <div className="flex gap-2">
                <input
                  id="in-seed"
                  value={seed}
                  onChange={(e) => setSeed(Math.abs(parseInt(e.target.value || '0', 10)) || 0)}
                  className="w-36 bg-white/8 rounded-xl px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 ring-accent/60"
                />
                <button className="px-3 rounded-xl bg-white/8 hover:bg-white/15 text-xs" onClick={() => setSeed(Math.floor(Math.random() * 99999999))}>
                  Random
                </button>
                <button className="px-3 rounded-xl bg-white/8 hover:bg-white/15 text-xs" onClick={() => setSeed(DEFAULT_SEED)}>
                  Default
                </button>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70 pb-2 cursor-pointer">
              <input type="checkbox" checked={skipTut} onChange={(e) => setSkipTut(e.target.checked)} className="accent-[#57e3d6]" />
              Skip tutorial
            </label>
          </div>
          {seed !== game.worldSeed && <div className="text-xs text-accent2">A different seed generates a brand new city (takes a few seconds).</div>}
          <div className="flex justify-end">
            <button id="btn-start" disabled={busy} onClick={start} className="px-8 py-3 rounded-full bg-accent text-ink font-semibold text-lg hover:brightness-110 disabled:opacity-50">
              {busy ? 'Starting…' : 'Start your life →'}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ save / load
export function SaveLoadPanel({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [busy, setBusy] = useState<SlotId | null>(null);
  const [confirm, setConfirm] = useState<SlotId | null>(null);
  const refresh = () => listSaves().then(setSaves);
  useEffect(() => {
    refresh();
  }, []);
  const bySlot = new Map(saves.map((s) => [s.slot, s]));
  const act = async (slot: SlotId) => {
    if (busy) return;
    if (mode === 'save') {
      if (slot === 'auto') return;
      setBusy(slot);
      await saveSlot(slot);
      setBusy(null);
      refresh();
    } else {
      if (!bySlot.has(slot)) return;
      setBusy(slot);
      await loadSlot(slot);
      setBusy(null);
    }
  };
  return (
    <Panel title={mode === 'save' ? 'Save game' : 'Load game'} onClose={onClose} width={760}>
      <div className="flex flex-col gap-2.5">
        {SLOTS.map((slot) => {
          const m = bySlot.get(slot);
          const disabled = (mode === 'save' && slot === 'auto') || (mode === 'load' && !m);
          return (
            <div key={slot} className={`flex items-center gap-4 rounded-2xl px-3 py-3 border border-white/8 ${disabled ? 'opacity-50' : 'hover:bg-white/6 cursor-pointer'}`} onClick={() => !disabled && act(slot)}>
              <div className="w-40 h-[90px] rounded-xl bg-black/40 overflow-hidden shrink-0 flex items-center justify-center text-white/25 text-xs">
                {m?.thumb ? <img src={m.thumb} className="w-full h-full object-cover" /> : 'Empty'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-accent">{slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(4)}`}</div>
                {m ? (
                  <>
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-sm text-white/60 truncate">{m.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {formatMoney(m.money)} · played {formatPlaytime(m.playtime)} · {new Date(m.savedAt).toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-white/45">{mode === 'save' && slot !== 'auto' ? 'Click to save here' : 'No save'}</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                {busy === slot && <span className="text-xs text-accent anim-pulse">{mode === 'save' ? 'Saving…' : 'Loading…'}</span>}
                {m && slot !== 'auto' && mode === 'save' && busy !== slot && <span className="text-xs text-white/45">Overwrite</span>}
                {m &&
                  (confirm === slot ? (
                    <button
                      className="text-xs px-3 py-1 rounded-full bg-danger/70"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteSave(slot);
                        setConfirm(null);
                        refresh();
                      }}
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      className="text-xs px-3 py-1 rounded-full bg-white/8 hover:bg-white/15"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm(slot);
                      }}
                    >
                      Delete
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-white/40 mt-4">Saves are stored in this browser (IndexedDB). The game autosaves when you sleep and every few minutes.</div>
    </Panel>
  );
}

// ------------------------------------------------------------------ pause
export function PauseMenu() {
  const overlay = useStore((s) => s.overlay);
  const setOverlay = useStore((s) => s.setOverlay);
  const saveMode = useStore((s) => s.saveMode);
  const setSaveMode = useStore((s) => s.setSaveMode);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const back = () => setOverlay('pause');
  if (overlay === 'settings')
    return (
      <Panel title="Settings" onClose={back}>
        <SettingsPanel />
      </Panel>
    );
  if (overlay === 'controls')
    return (
      <Panel title="Controls" onClose={back}>
        <ControlsList />
      </Panel>
    );
  if (overlay === 'saveload') return <SaveLoadPanel mode={saveMode} onClose={back} />;
  if (overlay !== 'pause') return null;
  const s = game.session;
  const resume = () => {
    setOverlay(null);
    game.input.requestLock();
  };
  return (
    <div className="absolute inset-0 pointer-events-auto anim-fade" style={{ background: 'linear-gradient(90deg, rgba(5,7,12,0.92) 0%, rgba(5,7,12,0.6) 35%, rgba(5,7,12,0.25) 100%)' }}>
      <div className="absolute left-20 top-0 bottom-0 flex flex-col justify-center">
        <div className="text-[11px] uppercase tracking-[0.5em] text-accent mb-2">Paused</div>
        <div className="text-5xl font-semibold tracking-[0.25em]">ECHO CITY</div>
        {s && (
          <div className="text-white/50 mt-2 text-sm">
            {s.player.name} · Day {s.clock.day}, {s.clock.label()} · {formatMoney(s.player.money)} · played {formatPlaytime(s.playtime)}
          </div>
        )}
        <div className="mt-10 flex flex-col gap-0.5">
          <MenuButton id="btn-resume" onClick={resume}>
            Resume
          </MenuButton>
          <MenuButton
            id="btn-save"
            onClick={() => {
              setSaveMode('save');
              setOverlay('saveload');
            }}
          >
            Save Game
          </MenuButton>
          <MenuButton
            onClick={() => {
              setSaveMode('load');
              setOverlay('saveload');
            }}
          >
            Load Game
          </MenuButton>
          <MenuButton onClick={() => setOverlay('settings')}>Settings</MenuButton>
          <MenuButton onClick={() => setOverlay('controls')}>Controls</MenuButton>
          {s?.objectives?.tutorial && (
            <MenuButton
              onClick={() => {
                s.objectives?.skipTutorial();
                resume();
              }}
            >
              Skip Tutorial
            </MenuButton>
          )}
          {confirmQuit ? (
            <div className="flex items-center gap-4 py-1.5">
              <span className="text-white/60">Unsaved progress since the last save is lost.</span>
              <button className="px-4 py-1.5 rounded-full bg-danger/80 text-sm" onClick={quitToMenu}>
                Quit
              </button>
              <button className="px-4 py-1.5 rounded-full bg-white/10 text-sm" onClick={() => setConfirmQuit(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <MenuButton onClick={() => setConfirmQuit(true)}>Quit to Main Menu</MenuButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ intro
export function IntroOverlay() {
  const overlay = useStore((s) => s.overlay);
  const intro = useStore((s) => s.introText);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (overlay !== 'intro') return;
    setReady(false);
    const t = setTimeout(() => setReady(true), 2500);
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') beginPlay();
    };
    window.addEventListener('keydown', k);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
  }, [overlay]);
  if (overlay !== 'intro' || !intro) return null;
  const name = game.session?.player.name ?? '';
  return (
    <div className="absolute inset-0 pointer-events-auto" style={{ background: 'linear-gradient(0deg, rgba(5,7,12,0.85) 0%, rgba(5,7,12,0.2) 45%, rgba(5,7,12,0) 70%)' }}>
      <div className="absolute left-0 right-0 bottom-20 flex flex-col items-center text-center px-8">
        <div className="text-[11px] uppercase tracking-[0.5em] text-accent anim-fade">Monday · 8:30 AM{intro.place ? ` · ${intro.place}` : ''}</div>
        <div className="text-5xl font-semibold mt-3 anim-slide">{intro.title}{name ? `, ${name}` : ''}.</div>
        <div className="text-lg text-white/75 mt-4 max-w-2xl leading-relaxed anim-fade">{intro.body}</div>
        <button
          id="btn-begin"
          onClick={beginPlay}
          className={`mt-8 px-8 py-3 rounded-full bg-accent text-ink font-semibold transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
        >
          Begin <span className="opacity-60 ml-1 text-sm">ENTER</span>
        </button>
      </div>
    </div>
  );
}
