// Race-mode screens: the race HUD, its minimap, the floating RIVAL tag and the race results.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { nm } from './DriveGame';
import { useNM, RunResult } from './store';
import { Badge, Label, StatGrid } from './ui';

export const raceClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const camDir = new THREE.Vector3();
const BRAND = '#0074f8';

/** the rival's colour as CSS, for tags and dots */
function rivalColor() {
  return nm.race ? hex(nm.race.paint) : '#00c8ff';
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-paper/95 rounded-2xl lift ${className}`}>{children}</div>;
}

export function RaceHud() {
  const r = useNM((s) => s.race);
  const phase = useNM((s) => s.phase);
  if (!r || (phase !== 'run' && phase !== 'countdown')) return null;
  const lead = r.position === 1;
  return (
    <>
      {/* position, time, gap */}
      <Chip className="absolute left-4 sm:left-6 top-4 sm:top-6 px-4 py-3 min-w-44">
        <div className="flex items-baseline gap-1.5">
          <div id="race-position" className={`display text-5xl leading-none ${lead ? 'text-brand' : 'text-ink'}`}>
            {lead ? '1st' : '2nd'}
          </div>
          <div className="text-sm font-medium text-muted">of 2</div>
        </div>
        <div className="display text-2xl leading-tight mt-1">{raceClock(r.time)}</div>
        <div className={`text-xs font-semibold tabular-nums ${r.gap >= 0 ? 'text-brand' : 'text-ink-2'}`}>
          {r.gap >= 0 ? `${r.gap} m ahead of the rival` : `${-r.gap} m behind the rival`}
        </div>
        {r.left >= 0 && <div className="display text-lg text-hot throb mt-1">Finish in {Math.ceil(r.left)} s</div>}
      </Chip>

      {/* checkpoints + where to go */}
      <Chip className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 px-5 py-2 flex items-center gap-4">
        <div className="text-center">
          <Label>Checkpoint</Label>
          <div id="race-cp" className="display text-3xl leading-tight">
            {Math.min(r.checkpoint + 1, r.checkpoints)}
            <span className="text-muted text-xl"> / {r.checkpoints}</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <svg width="40" height="40" viewBox="-27 -27 54 54" style={{ transform: `rotate(${r.arrow}deg)` }}>
            <path d="M0 -22 L16 10 L0 2 L-16 10 Z" fill={BRAND} />
          </svg>
          <div className="text-xs font-semibold text-ink-2 tabular-nums">{r.cpDist} m</div>
        </div>
      </Chip>

      {/* warnings */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[26%] flex flex-col items-center gap-2">
        {r.stunned && <div className="rounded-full bg-hot text-white px-6 py-2 display text-3xl lift">Crashed</div>}
        {!r.stunned && r.wrongWay && <div className="rounded-full bg-hot text-white px-6 py-2 display text-3xl lift throb">Wrong way</div>}
        {!r.stunned && r.off && <div className="rounded-full bg-paper text-ink px-5 py-2 font-semibold lift">Off the route · T to get back</div>}
      </div>

      <RaceMap />
      <RivalTag />
    </>
  );
}

/** rotating map, drawn light: streets in grey, the route in blue, gates, you and the rival */
function RaceMap({ size = 180 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 40) return;
      last = t;
      const cv = ref.current;
      const race = nm.race;
      const car = nm.car;
      const city = nm.world?.city;
      if (!cv || !race || !car || !city) return;
      const g = cv.getContext('2d')!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== size * dpr) {
        cv.width = size * dpr;
        cv.height = size * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const zoom = 0.62; // screen px per metre
      const cf = nm.camera.getWorldDirection(camDir);
      const yaw = Math.atan2(cf.x, cf.z);
      const pos = car.pos;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#f8f8f8';
      g.fillRect(0, 0, size, size);
      g.translate(size / 2, size / 2);
      g.rotate(Math.PI + yaw);
      g.scale(zoom, zoom);
      g.translate(-pos.x, -pos.z);
      const px = 1 / zoom; // one screen pixel in metres
      // streets near us
      g.strokeStyle = '#e1e2e6';
      g.lineCap = 'square';
      const R = size / zoom;
      for (const s of city.segments) {
        if (!s.exists) continue;
        if (Math.max(Math.abs(s.x0 - pos.x), Math.abs(s.z0 - pos.z)) > R + s.length && Math.max(Math.abs(s.x1 - pos.x), Math.abs(s.z1 - pos.z)) > R + s.length) continue;
        g.lineWidth = s.hw * 2;
        g.beginPath();
        g.moveTo(s.x0, s.z0);
        g.lineTo(s.x1, s.z1);
        g.stroke();
      }
      // the route
      g.strokeStyle = BRAND;
      g.lineWidth = 5 * px;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      race.route.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z)));
      g.stroke();
      const dot = (x: number, z: number, r: number, fill: string, stroke = '#ffffff') => {
        g.fillStyle = fill;
        g.beginPath();
        g.arc(x, z, r * px, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = stroke;
        g.lineWidth = 2 * px;
        g.stroke();
      };
      race.route.checkpoints.forEach((c, i) => {
        if (i < race.player.next) return;
        dot(c.x, c.z, i === race.player.next ? 6 : 3.5, c.finish ? '#101014' : i === race.player.next ? BRAND : '#b7bac2');
      });
      dot(race.rival.pos.x, race.rival.pos.z, 5.5, rivalColor());
      g.restore();
      // you: an arrow in the middle pointing the way the car faces
      g.save();
      g.translate(size / 2, size / 2);
      g.rotate(-(car.yaw - yaw));
      g.fillStyle = '#101014';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(6, 6);
      g.lineTo(0, 3);
      g.lineTo(-6, 6);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return (
    <div className="absolute right-4 sm:right-6 top-4 sm:top-6 rounded-full bg-paper p-1.5 lift">
      <canvas id="race-map" ref={ref} style={{ width: size, height: size }} className="rounded-full block" />
    </div>
  );
}

/** a label that floats over the rival's car (positioned straight from the game every frame) */
function RivalTag() {
  const ref = useRef<HTMLDivElement>(null);
  const dist = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const p = nm.updateRivalTag(window.innerWidth, window.innerHeight);
      if (!p || p.dist < 6) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = '1';
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      if (dist.current) dist.current.textContent = `${Math.round(p.dist)} m`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 opacity-0 flex items-center gap-1 rounded-full bg-paper lift pl-1 pr-2.5 py-1 pointer-events-none"
      style={{ willChange: 'transform' }}
    >
      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: rivalColor() }}>
        Rival
      </span>
      <span ref={dist} className="text-xs font-semibold text-ink-2 tabular-nums" />
    </div>
  );
}

export function RaceResults({ r }: { r: RunResult }) {
  const race = r.race!;
  const stats: [string, string][] = [
    ['Your time', race.time !== null ? raceClock(race.time) : 'DNF'],
    ['Rival', race.rivalTime !== null ? `${race.rivalEstimated ? '≈ ' : ''}${raceClock(race.rivalTime)}` : '—'],
    ['Route', `${(race.length / 1000).toFixed(2)} km`],
    ['Your crashes', String(race.crashes)],
    ['Rival crashes', String(race.rivalCrashes)],
    ['Top speed', `${r.topSpeed} km/h`],
    ['Near misses', String(r.nearMisses)],
    ['Drifts', `${r.drifts} · ${r.driftSec} s`],
    ['Against traffic', `${r.oncomingSec} s`],
    ['Closest pass', r.closest !== null ? `${Math.round(r.closest * 100)} cm` : '—'],
  ];
  const margin = race.time !== null && race.rivalTime !== null ? race.rivalTime - race.time : null;
  const stats2 = useNM((s) => s.raceStats);
  return (
    <>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div id="race-verdict" className={`display text-5xl leading-none ${race.won ? 'text-brand' : 'text-hot'}`}>
            {race.won ? 'You win' : race.time === null ? 'Too slow' : 'You lose'}
          </div>
          <div className="text-ink-2 mt-2">
            {r.car} · {r.cond} · won {stats2.wins} of {stats2.races}
          </div>
        </div>
        <div className="text-right">
          <div className="display text-6xl leading-none">
            {margin !== null ? Math.abs(margin).toFixed(1) : 'DNF'}
            {margin !== null && <span className="text-3xl text-muted"> s</span>}
          </div>
          <div className="text-sm mt-1 text-muted">
            {margin === null ? 'Did not finish' : race.won ? 'ahead of the rival' : 'behind the rival'}
            {race.record && (
              <Badge className="ml-2" tone="brand">
                Biggest winning margin yet
              </Badge>
            )}
          </div>
        </div>
      </div>
      <StatGrid stats={stats} />
    </>
  );
}
