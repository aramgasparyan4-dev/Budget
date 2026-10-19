import { useStore } from '../state/store';
import { Minimap } from './Minimap';
import { formatMoney } from '../core/math';

const WEATHER_ICON: Record<string, string> = { Clear: '☀', Cloudy: '☁', Rain: '🌧', Fog: '🌫', Storm: '⛈' };

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 w-14">{label}</div>
      <div className="h-1.5 w-28 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, value * 100)}%`, background: value < 0.2 ? '#ff5a6e' : color }} />
      </div>
    </div>
  );
}

function Notifications() {
  const list = useStore((s) => s.notifications);
  const color: Record<string, string> = {
    info: '#9fb3c8',
    money: '#7ae582',
    news: '#ffb35a',
    message: '#57e3d6',
    objective: '#57e3d6',
    warning: '#ff5a6e',
    relationship: '#ff8fd8',
  };
  return (
    <div className="flex flex-col gap-2 items-end">
      {list.map((n) => (
        <div key={n.id} className="glass rounded-xl px-4 py-2.5 w-80 anim-slide" style={{ borderLeft: `3px solid ${color[n.kind]}` }}>
          <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: color[n.kind] }}>
            {n.kind === 'news' ? 'Breaking' : n.kind === 'message' ? 'Message' : n.kind}
          </div>
          <div className="text-sm font-semibold leading-snug">{n.title}</div>
          {n.body && <div className="text-xs text-white/60 leading-snug mt-0.5">{n.body}</div>}
        </div>
      ))}
    </div>
  );
}

function Speedometer({ speed, name }: { speed: number; name: string }) {
  const frac = Math.min(1, speed / 220);
  const R = 46;
  const C = Math.PI * R * 1.5;
  return (
    <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 anim-fade">
      <svg width="110" height="90" viewBox="0 0 110 90">
        <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeDasharray={`${C} 999`} transform="rotate(135 55 55)" strokeLinecap="round" />
        <circle cx="55" cy="55" r={R} fill="none" stroke="#57e3d6" strokeWidth="7" strokeDasharray={`${C * frac} 999`} transform="rotate(135 55 55)" strokeLinecap="round" />
        <text x="55" y="58" textAnchor="middle" fill="white" fontSize="26" fontWeight="700">
          {Math.round(speed)}
        </text>
        <text x="55" y="74" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" letterSpacing="2">
          KM/H
        </text>
      </svg>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Driving</div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-[11px] text-white/45 mt-1">H horn · SPACE handbrake · F exit</div>
      </div>
    </div>
  );
}

export function HUD() {
  const h = useStore((s) => s.hud);
  const overlay = useStore((s) => s.overlay);
  const hidden = overlay === 'dialogue' || overlay === 'map' || overlay === 'minigame' || overlay === 'intro';
  return (
    <div className="absolute inset-0 pointer-events-none select-none text-shadow" style={{ opacity: hidden ? 0 : 1, transition: 'opacity 0.3s' }}>
      {/* top left: clock */}
      <div className="absolute left-6 top-5 flex items-center gap-4">
        <div>
          <div className="text-4xl font-semibold tracking-tight tabular-nums leading-none">{h.time}</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 mt-1.5">
            {h.weekday} · Day {h.day}
          </div>
        </div>
        <div className="glass rounded-xl px-3 py-2 text-center">
          <div className="text-xl leading-none">{WEATHER_ICON[h.weather] ?? '☀'}</div>
          <div className="text-[10px] text-white/60 mt-1">{h.temp}°C</div>
        </div>
      </div>
      {/* top right: money + notifications */}
      <div className="absolute right-6 top-5 flex flex-col items-end gap-3">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Wallet</div>
            <div className="text-lg font-semibold tabular-nums text-[#7ae582]">{formatMoney(h.cash)}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Bank</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(h.bank)}</div>
          </div>
        </div>
        <Notifications />
      </div>
      {/* objective */}
      {h.objective && (
        <div className="absolute left-6 top-32 max-w-sm anim-fade">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-accent">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent anim-pulse" />
            Objective
          </div>
          <div className="text-lg font-semibold leading-tight mt-1">{h.objective}</div>
          {h.objectiveSub && <div className="text-sm text-white/60 mt-0.5">{h.objectiveSub}</div>}
        </div>
      )}
      {/* bottom left: minimap */}
      <div className="absolute left-6 bottom-6 flex items-end gap-4">
        <div className="relative">
          <Minimap size={196} />
        </div>
        <div className="pb-2">
          {h.interior ? (
            <div className="text-sm font-semibold">{h.interior}</div>
          ) : (
            <>
              <div className="text-sm font-semibold">{h.street || ' '}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">{h.district}</div>
            </>
          )}
          {h.waypoint && <div className="text-xs text-accent mt-1">◆ {h.waypoint.label}</div>}
        </div>
      </div>
      {/* bottom right: needs or speedometer */}
      <div className="absolute right-6 bottom-6 flex flex-col items-end gap-3">
        {h.inVehicle ? (
          <Speedometer speed={h.speed} name={h.vehicleName} />
        ) : (
          <div className="glass rounded-xl px-4 py-3 flex flex-col gap-2">
            <Bar value={h.hunger} color="#ffb35a" label="Hunger" />
            <Bar value={h.energy} color="#57e3d6" label="Energy" />
            <Bar value={h.stamina} color="#e9eef5" label="Stamina" />
          </div>
        )}
        <div className="text-[10px] text-white/35 tracking-wide">TAB phone · M map · ESC menu</div>
      </div>
      {/* interaction prompt */}
      {h.prompt && (
        <div className="absolute left-1/2 bottom-28 -translate-x-1/2 flex items-center gap-3 glass rounded-full pl-2 pr-5 py-2 anim-fade" key={h.prompt.text}>
          <span className="keycap">{h.prompt.key}</span>
          <div>
            <div className="text-sm font-semibold leading-tight">{h.prompt.text}</div>
            {h.prompt.sub && <div className="text-[11px] text-white/55 leading-tight">{h.prompt.sub}</div>}
          </div>
        </div>
      )}
      {/* subtitles */}
      {h.subtitle && (
        <div className="absolute left-1/2 bottom-44 -translate-x-1/2 text-center max-w-xl anim-fade">
          <span className="text-accent font-semibold">{h.subtitle.who}: </span>
          <span className="text-white/90">{h.subtitle.text}</span>
        </div>
      )}
      {/* crosshair dot for interaction aiming */}
      <div className="absolute left-1/2 top-1/2 w-1 h-1 -ml-0.5 -mt-0.5 rounded-full bg-white/40" />
    </div>
  );
}
