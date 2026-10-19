import { useState } from 'react';
import { useStore } from '../state/store';
import { Preset, Settings, DEFAULT_SETTINGS } from '../state/settings';
import { game } from '../game/Game';

type Tab = 'graphics' | 'audio' | 'controls' | 'gameplay';

function Row({ label, hint, children, compact }: { label: string; hint?: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? 'py-2' : 'py-2.5'} border-b border-white/6`}>
      <div className="min-w-0">
        <div className={compact ? 'text-xs' : 'text-sm'}>{label}</div>
        {hint && !compact && <div className="text-[11px] text-white/40">{hint}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange, fmt }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32 accent-[#57e3d6]" />
      <span className="text-xs tabular-nums text-white/60 w-12 text-right">{fmt ? fmt(value) : value}</span>
    </>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full relative transition ${value ? 'bg-accent' : 'bg-white/15'}`}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: value ? 22 : 2 }} />
    </button>
  );
}

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-white/8 p-0.5">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} className={`px-2.5 py-1 rounded-full text-[11px] ${value === o.v ? 'bg-accent text-ink font-semibold' : 'text-white/70 hover:text-white'}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** All game settings. Changes apply immediately and persist to localStorage. */
export function SettingsPanel({ compact = false }: { compact?: boolean }) {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const applyPreset = useStore((st) => st.applyPreset);
  const [tab, setTab] = useState<Tab>('graphics');
  const g = s.graphics;
  const set = (fn: (x: Settings) => void, custom = false) =>
    update((x) => {
      fn(x);
      if (custom) x.graphics.preset = 'custom';
    });
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const tabs: { id: Tab; l: string }[] = [
    { id: 'graphics', l: 'Graphics' },
    { id: 'audio', l: 'Audio' },
    { id: 'controls', l: 'Controls' },
    { id: 'gameplay', l: 'Gameplay' },
  ];
  return (
    <div className={compact ? 'text-sm' : ''}>
      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-full ${compact ? 'text-[11px]' : 'text-sm'} ${tab === t.id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`}>
            {t.l}
          </button>
        ))}
      </div>
      {tab === 'graphics' && (
        <div>
          <Row label="Quality preset" compact={compact}>
            <Choice<Preset | 'custom'>
              value={g.preset}
              options={[
                { v: 'low', l: 'Low' },
                { v: 'medium', l: 'Med' },
                { v: 'high', l: 'High' },
                { v: 'ultra', l: 'Ultra' },
              ]}
              onChange={(p) => p !== 'custom' && applyPreset(p)}
            />
          </Row>
          {g.preset === 'custom' && <div className="text-[11px] text-white/40 py-1">Custom settings</div>}
          <Row label="Shadows" hint="Shadow map resolution" compact={compact}>
            <Choice<number>
              value={g.shadows}
              options={[
                { v: 0, l: 'Off' },
                { v: 1024, l: '1K' },
                { v: 2048, l: '2K' },
                { v: 4096, l: '4K' },
              ]}
              onChange={(v) => set((x) => (x.graphics.shadows = v as 0 | 1024 | 2048 | 4096), true)}
            />
          </Row>
          <Row label="Draw distance" compact={compact}>
            <Slider value={g.drawDistance} min={250} max={1100} step={10} onChange={(v) => set((x) => (x.graphics.drawDistance = v), true)} fmt={(v) => `${v}m`} />
          </Row>
          <Row label="Detail radius" hint="Props, markings and street furniture" compact={compact}>
            <Slider value={g.detailRadius} min={150} max={600} step={10} onChange={(v) => set((x) => (x.graphics.detailRadius = v), true)} fmt={(v) => `${v}m`} />
          </Row>
          <Row label="Vegetation" compact={compact}>
            <Slider value={g.vegetation} min={0.2} max={1} step={0.05} onChange={(v) => set((x) => (x.graphics.vegetation = v), true)} fmt={pct} />
          </Row>
          <Row label="Pedestrian density" compact={compact}>
            <Slider value={g.npcDensity} min={0.2} max={1.5} step={0.05} onChange={(v) => set((x) => (x.graphics.npcDensity = v), true)} fmt={pct} />
          </Row>
          <Row label="Traffic density" compact={compact}>
            <Slider value={g.trafficDensity} min={0.2} max={1.5} step={0.05} onChange={(v) => set((x) => (x.graphics.trafficDensity = v), true)} fmt={pct} />
          </Row>
          <Row label="Resolution scale" compact={compact}>
            <Slider value={g.resolutionScale} min={0.5} max={1.5} step={0.05} onChange={(v) => set((x) => (x.graphics.resolutionScale = v), true)} fmt={pct} />
          </Row>
          <Row label="Post-processing" hint="Tone mapping, color grading, vignette" compact={compact}>
            <Toggle value={g.postFX} onChange={(v) => set((x) => (x.graphics.postFX = v), true)} />
          </Row>
          <Row label="Bloom" compact={compact}>
            <Toggle value={g.bloom} onChange={(v) => set((x) => (x.graphics.bloom = v), true)} />
          </Row>
          <Row label="Ambient occlusion" compact={compact}>
            <Toggle value={g.ao} onChange={(v) => set((x) => (x.graphics.ao = v), true)} />
          </Row>
          <Row label="Anti-aliasing" compact={compact}>
            <Choice<'none' | 'smaa' | 'msaa'>
              value={g.aa}
              options={[
                { v: 'none', l: 'Off' },
                { v: 'smaa', l: 'SMAA' },
                { v: 'msaa', l: 'MSAA' },
              ]}
              onChange={(v) => set((x) => (x.graphics.aa = v), true)}
            />
          </Row>
          <Row label="Rain particles" compact={compact}>
            <Slider value={g.rainParticles} min={1000} max={20000} step={500} onChange={(v) => set((x) => (x.graphics.rainParticles = v), true)} fmt={(v) => `${Math.round(v / 1000)}k`} />
          </Row>
        </div>
      )}
      {tab === 'audio' && (
        <div>
          {(['master', 'music', 'sfx', 'ambience'] as const).map((k) => (
            <Row key={k} label={{ master: 'Master volume', music: 'Music', sfx: 'Effects', ambience: 'City ambience' }[k]} compact={compact}>
              <Slider value={s.audio[k]} min={0} max={1} step={0.05} onChange={(v) => set((x) => (x.audio[k] = v))} fmt={pct} />
            </Row>
          ))}
          <div className="text-[11px] text-white/40 pt-2">All sound is synthesised live with the Web Audio API.</div>
        </div>
      )}
      {tab === 'controls' && (
        <div>
          <Row label="Mouse sensitivity" compact={compact}>
            <Slider value={s.controls.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => set((x) => (x.controls.sensitivity = v))} fmt={(v) => v.toFixed(2)} />
          </Row>
          <Row label="Invert Y axis" compact={compact}>
            <Toggle value={s.controls.invertY} onChange={(v) => set((x) => (x.controls.invertY = v))} />
          </Row>
          <Row label="Camera distance" compact={compact}>
            <Slider value={s.controls.cameraDistance} min={2.5} max={9} step={0.1} onChange={(v) => set((x) => (x.controls.cameraDistance = v))} fmt={(v) => `${v.toFixed(1)}m`} />
          </Row>
          <Row label="Field of view" compact={compact}>
            <Slider value={s.controls.fov} min={50} max={90} step={1} onChange={(v) => set((x) => (x.controls.fov = v))} fmt={(v) => `${v}°`} />
          </Row>
          {!compact && <ControlsList />}
        </div>
      )}
      {tab === 'gameplay' && (
        <div>
          <Row label="Time speed" hint="Game seconds per real second (30 = a day lasts 48 minutes)" compact={compact}>
            <Choice<number>
              value={s.gameplay.timeScale}
              options={[
                { v: 15, l: 'Slow' },
                { v: 30, l: 'Normal' },
                { v: 60, l: 'Fast' },
              ]}
              onChange={(v) => set((x) => (x.gameplay.timeScale = v))}
            />
          </Row>
          <Row label="Rotate minimap" compact={compact}>
            <Toggle value={s.gameplay.minimapRotate} onChange={(v) => set((x) => (x.gameplay.minimapRotate = v))} />
          </Row>
          <Row label="Subtitles" compact={compact}>
            <Toggle value={s.gameplay.subtitles} onChange={(v) => set((x) => (x.gameplay.subtitles = v))} />
          </Row>
          <Row label="Performance overlay" hint="Also toggled with F3" compact={compact}>
            <Toggle value={s.gameplay.showPerf} onChange={(v) => set((x) => (x.gameplay.showPerf = v))} />
          </Row>
          <Row label="Local LLM dialogue" hint="Optional: OpenAI-compatible endpoint, e.g. Ollama. Falls back to built-in dialogue." compact={compact}>
            <Toggle value={s.gameplay.llmEnabled} onChange={(v) => set((x) => (x.gameplay.llmEnabled = v))} />
          </Row>
          {s.gameplay.llmEnabled && (
            <div className="flex flex-col gap-2 py-2">
              <input
                className="bg-white/8 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 ring-accent"
                value={s.gameplay.llmEndpoint}
                onChange={(e) => set((x) => (x.gameplay.llmEndpoint = e.target.value))}
                placeholder="http://localhost:11434/v1/chat/completions"
              />
              <input
                className="bg-white/8 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 ring-accent"
                value={s.gameplay.llmModel}
                onChange={(e) => set((x) => (x.gameplay.llmModel = e.target.value))}
                placeholder="model name"
              />
            </div>
          )}
          <div className="pt-3">
            <button
              className="text-xs px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/15"
              onClick={() => {
                update((x) => Object.assign(x, structuredClone(DEFAULT_SETTINGS)));
                game.audio.ui('click');
              }}
            >
              Reset all settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const CONTROLS: [string, string][] = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click the game to capture the mouse)'],
  ['Shift', 'Sprint'],
  ['Ctrl / C', 'Walk slowly'],
  ['Space', 'Jump · handbrake'],
  ['E', 'Interact · talk · enter buildings'],
  ['F', 'Enter / exit vehicle'],
  ['H', 'Horn'],
  ['Tab', 'Phone'],
  ['M', 'City map'],
  ['I', 'Bag (inventory)'],
  ['1 – 9', 'Choose dialogue options'],
  ['Esc', 'Pause / close menus'],
  ['F3', 'Performance overlay'],
  ['Mouse wheel', 'Camera distance'],
];

export function ControlsList() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-4">
      {CONTROLS.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="keycap shrink-0 min-w-[64px] text-center">{k}</span>
          <span className="text-white/70">{v}</span>
        </div>
      ))}
    </div>
  );
}

