// Race-mode screens: the race HUD, its minimap, the floating RIVAL tag and the race results.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { nm } from './DriveGame';
import { useNM, RunResult } from './store';
import { Badge, Label, StatGrid } from './ui';

/** the maps: big on a desktop, smaller on short screens (phones held sideways) */
function useMapSize(fixed?: number) {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const f = () => setH(window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return fixed ?? (h < 520 ? 150 : h < 760 ? 210 : 250);
}

export const raceClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const camDir = new THREE.Vector3();
const BRAND = '#0077ff';

/** the rival's colour as CSS, for tags and dots */
function rivalColor() {
  return nm.race ? hex(nm.race.paint) : '#00c8ff';
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`surface rounded-xl ${className}`}>{children}</div>;
}

export function RaceHud() {
  const r = useNM((s) => s.race);
  const phase = useNM((s) => s.phase);
  if (!r || (phase !== 'run' && phase !== 'countdown')) return null;
  const lead = r.position === 1;
  return (
    <>
      {/* position, time, gap */}
      <Chip className="absolute left-4 sm:left-6 top-4 sm:top-6 px-4 py-3 min-w-40">
        <div className="flex items-baseline gap-1.5">
          <div id="race-position" className={`display text-[40px] leading-none ${lead ? 'text-brand' : 'text-ink'}`}>
            {lead ? '1st' : '2nd'}
          </div>
          <div className="text-[13px] text-muted">of 2</div>
        </div>
        <div className="display text-xl leading-tight mt-1">{raceClock(r.time)}</div>
        <div className={`text-[12px] font-medium tabular-nums ${r.gap >= 0 ? 'text-brand' : 'text-ink-2'}`}>{r.gap >= 0 ? `+${r.gap} m` : `−${-r.gap} m`}</div>
        {r.left >= 0 && <div className="text-[15px] font-semibold text-alert throb mt-1">Finish in {Math.ceil(r.left)} s</div>}
      </Chip>

      {/* checkpoints + where to go */}
      <Chip className="absolute left-1/2 -translate-x-1/2 top-4 sm:top-6 px-5 py-2 flex items-center gap-4">
        <div className="text-center">
          <Label className="text-[12px]">Checkpoint</Label>
          <div id="race-cp" className="display text-[28px] leading-tight">
            {Math.min(r.checkpoint + 1, r.checkpoints)}
            <span className="text-muted text-lg"> / {r.checkpoints}</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <svg width="36" height="36" viewBox="-27 -27 54 54" style={{ transform: `rotate(${r.arrow}deg)` }}>
            <path d="M0 -22 L16 10 L0 2 L-16 10 Z" fill={BRAND} />
          </svg>
          <div className="text-[12px] font-medium text-ink-2 tabular-nums">{r.cpDist} m</div>
        </div>
      </Chip>

      {/* warnings */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[26%] flex flex-col items-center gap-2">
        {r.stunned && <div className="rounded-full bg-alert text-white px-6 h-12 flex items-center text-xl font-bold">Crashed</div>}
        {!r.stunned && r.wrongWay && <div className="rounded-full bg-alert text-white px-6 h-12 flex items-center text-xl font-bold throb">Wrong way</div>}
        {!r.stunned && r.off && <div className="rounded-full surface px-5 h-10 flex items-center text-[14px] font-medium">Off the route · T to get back</div>}
      </div>

      <RaceMap />
      <RivalTag />
    </>
  );
}

/** rotating map, drawn light: streets in grey, the route in blue, gates, you and the rival */
function RaceMap({ size: fixed }: { size?: number }) {
  const size = useMapSize(fixed);
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
      g.fillStyle = '#fafafa';
      g.fillRect(0, 0, size, size);
      g.translate(size / 2, size / 2);
      g.rotate(Math.PI + yaw);
      g.scale(zoom, zoom);
      g.translate(-pos.x, -pos.z);
      const px = 1 / zoom; // one screen pixel in metres
      // streets near us
      g.strokeStyle = '#eaeaea';
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
        dot(c.x, c.z, i === race.player.next ? 6 : 3.5, c.finish ? '#0d0d0d' : i === race.player.next ? BRAND : '#c7c7c7');
      });
      dot(race.rival.pos.x, race.rival.pos.z, 5.5, rivalColor());
      g.restore();
      // you: an arrow in the middle pointing the way the car faces
      g.save();
      g.translate(size / 2, size / 2);
      g.rotate(-(car.yaw - yaw));
      g.fillStyle = '#0d0d0d';
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
    <div className="absolute right-4 sm:right-6 top-4 sm:top-6 rounded-full surface p-1">
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
      className="absolute left-0 top-0 opacity-0 flex items-center gap-1 rounded-full surface pl-1 pr-2.5 py-1 pointer-events-none"
      style={{ willChange: 'transform' }}
    >
      <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-white" style={{ background: rivalColor() }}>
        Rival
      </span>
      <span ref={dist} className="text-[12px] font-medium text-ink-2 tabular-nums" />
    </div>
  );
}

export function RaceResults({ r }: { r: RunResult }) {
  const race = r.race!;
  const stats: [string, string][] = [
    ['Your time', race.time !== null ? raceClock(race.time) : 'DNF'],
    ['Rival', race.rivalTime !== null ? `${race.rivalEstimated ? '≈ ' : ''}${raceClock(race.rivalTime)}` : '—'],
    ['Route', `${(race.length / 1000).toFixed(1)} km`],
    ['Crashes', `${race.crashes} · rival ${race.rivalCrashes}`],
    ['Top speed', `${r.topSpeed} km/h`],
    ['Near misses', String(r.nearMisses)],
  ];
  const margin = race.time !== null && race.rivalTime !== null ? race.rivalTime - race.time : null;
  const stats2 = useNM((s) => s.raceStats);
  return (
    <>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div id="race-verdict" className={`text-2xl font-bold ${race.won ? 'text-brand' : 'text-alert'}`}>
            {race.won ? 'You win' : race.time === null ? 'Too slow' : 'You lose'}
          </div>
          <div className="text-[14px] text-ink-2 mt-1">
            {r.car} · {r.cond} · won {stats2.wins} of {stats2.races}
          </div>
        </div>
        <div className="text-right">
          <div className="display text-5xl leading-none">
            {margin !== null ? `${race.won ? '+' : '−'}${Math.abs(margin).toFixed(1)}` : 'DNF'}
            {margin !== null && <span className="text-2xl text-muted"> s</span>}
          </div>
          <div className="mt-2 h-6">{race.record ? <Badge>Best margin</Badge> : <span className="text-[13px] text-muted">{margin === null ? 'Did not finish' : 'vs the rival'}</span>}</div>
        </div>
      </div>
      <StatGrid stats={stats} />
    </>
  );
}

/** the highway map: the road ahead (both branches before a fork, with where they go), the traffic and you */
export function HighwayMap({ size: fixed }: { size?: number }) {
  const size = useMapSize(fixed);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return;
      last = t;
      const cv = ref.current;
      const hw = nm.highway;
      const car = nm.car;
      if (!cv || !hw || !car || !nm.onHighway) return;
      const g = cv.getContext('2d')!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== size * dpr) {
        cv.width = size * dpr;
        cv.height = size * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const zoom = 0.3; // px per metre: about 400 m across
      const cf = nm.camera.getWorldDirection(camDir);
      const yaw = Math.atan2(cf.x, cf.z);
      const pos = car.pos;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#fafafa';
      g.fillRect(0, 0, size, size);
      // you sit low on the map, so it shows more of the road ahead
      g.translate(size / 2, size * 0.66);
      g.rotate(Math.PI + yaw);
      g.scale(zoom, zoom);
      g.translate(-pos.x, -pos.z);
      const px = 1 / zoom;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (const l of hw.mapLines(pos.x, pos.z, size / zoom)) {
        g.strokeStyle = l.mine ? '#d4d4d4' : '#e6e6e6';
        g.lineWidth = Math.max(l.width + 2, 9 * px);
        g.beginPath();
        l.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
        g.stroke();
      }
      for (const c of hw.traffic.cars) {
        if (Math.abs(c.x - pos.x) > 450 || Math.abs(c.z - pos.z) > 450) continue;
        g.fillStyle = c.crashed ? '#fd396b' : c.oncoming ? '#c7c7c7' : '#7a7a7a';
        g.beginPath();
        g.arc(c.x, c.z, 2.4 * px, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      // where the branches go
      const road = useNM.getState().road;
      const you = hw.you;
      if (road?.fork && you?.path.children) {
        g.save();
        g.font = '600 11px Inter Variable, sans-serif';
        g.textAlign = 'center';
        you.path.children.forEach((c, i) => {
          const q = c.pose(Math.min(c.length, 160), c.rightEdge(0) / 2);
          // world to map
          const dx = q.x - pos.x;
          const dz = q.z - pos.z;
          const a = Math.PI + yaw;
          const mx = size / 2 + (dx * Math.cos(a) - dz * Math.sin(a)) * zoom;
          const my = size * 0.66 + (dx * Math.sin(a) + dz * Math.cos(a)) * zoom;
          const text = i === 0 ? road.fork!.left : road.fork!.right;
          const w = g.measureText(text).width + 12;
          const x = Math.max(w / 2 + 4, Math.min(size - w / 2 - 4, mx));
          const y = Math.max(14, Math.min(size - 10, my));
          g.fillStyle = '#ffffff';
          g.strokeStyle = '#eaeaea';
          g.beginPath();
          g.roundRect(x - w / 2, y - 10, w, 20, 10);
          g.fill();
          g.stroke();
          g.fillStyle = '#0077ff';
          g.fillText(text, x, y + 4);
        });
        g.restore();
      }
      // you
      g.save();
      g.translate(size / 2, size * 0.66);
      g.rotate(-(car.yaw - yaw));
      g.fillStyle = '#0077ff';
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
    <div className="absolute right-4 sm:right-6 top-4 sm:top-6 rounded-full surface p-1">
      <canvas id="highway-map" ref={ref} style={{ width: size, height: size }} className="rounded-full block" />
    </div>
  );
}
