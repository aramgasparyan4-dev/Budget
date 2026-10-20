// Race-mode screens: the race HUD, its minimap, the floating RIVAL tag and the race results.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { nm } from './NearMissGame';
import { useNM, RunResult } from './store';
import { getMapCanvas, MAP_EXTENT, MAP_PX } from '../ui/mapRender';

export const raceClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const camDir = new THREE.Vector3();

/** the rival's colour as CSS, for tags and dots */
function rivalColor() {
  return nm.race ? hex(nm.race.paint) : '#00c8ff';
}

export function RaceHud() {
  const r = useNM((s) => s.race);
  const phase = useNM((s) => s.phase);
  if (!r || (phase !== 'run' && phase !== 'countdown')) return null;
  const lead = r.position === 1;
  return (
    <>
      {/* position, time, gap */}
      <div className="absolute left-[max(24px,3vw)] top-6">
        <div className="flex items-baseline gap-2">
          <div id="race-position" className={`display font-black text-7xl leading-none shadow-text ${lead ? 'text-amber' : 'text-beam'}`}>
            {lead ? '1ST' : '2ND'}
          </div>
          <div className="display font-bold text-xl text-white/50">/ 2</div>
        </div>
        <div className="display font-bold text-4xl tabular-nums leading-none mt-1 shadow-text">{raceClock(r.time)}</div>
        <div className={`mt-2 text-sm tabular-nums ${r.gap >= 0 ? 'text-amber' : 'text-white/70'}`}>
          {r.gap >= 0 ? `${r.gap} m ahead of the rival` : `${-r.gap} m behind the rival`}
        </div>
        {r.left >= 0 && <div className="display font-black text-3xl text-brake throb mt-2 tabular-nums">Finish in {Math.ceil(r.left)} s</div>}
      </div>

      {/* checkpoints + where to go */}
      <div className="absolute left-1/2 -translate-x-1/2 top-5 flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Checkpoint</div>
        <div id="race-cp" className="display font-black text-5xl leading-none tabular-nums shadow-text">
          {Math.min(r.checkpoint + 1, r.checkpoints)}
          <span className="text-white/45 text-3xl"> / {r.checkpoints}</span>
        </div>
        <svg width="54" height="54" viewBox="-27 -27 54 54" className="mt-2 drop-shadow" style={{ transform: `rotate(${r.arrow}deg)` }}>
          <path d="M0 -22 L16 10 L0 2 L-16 10 Z" fill="#ffb000" stroke="#0b0c10" strokeWidth="2" />
        </svg>
        <div className="text-sm text-white/70 tabular-nums">{r.cpDist} m</div>
      </div>

      {/* warnings */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[26%] flex flex-col items-center gap-1">
        {r.stunned && <div className="display font-black text-5xl uppercase text-brake shadow-text">Crashed</div>}
        {!r.stunned && r.wrongWay && <div className="display font-black text-5xl uppercase text-brake throb shadow-text">Wrong way</div>}
        {!r.stunned && r.off && <div className="display font-bold text-2xl uppercase text-amber shadow-text">Off the route · T to get back</div>}
      </div>

      <RaceMap />
      <RivalTag />
    </>
  );
}

/** rotating map: the route, its checkpoints, you and the rival */
function RaceMap({ size = 190 }: { size?: number }) {
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
      const k = MAP_PX / (MAP_EXTENT * 2);
      const zoom = 0.62; // screen px per metre
      const cf = nm.camera.getWorldDirection(camDir);
      const yaw = Math.atan2(cf.x, cf.z);
      const pos = car.pos;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#0c1016';
      g.fillRect(0, 0, size, size);
      g.translate(size / 2, size / 2);
      g.rotate(Math.PI + yaw);
      g.scale(zoom / k, zoom / k);
      const u = (pos.x + MAP_EXTENT) * k;
      const v = (pos.z + MAP_EXTENT) * k;
      g.globalAlpha = 0.85;
      g.drawImage(getMapCanvas(city), -u, -v);
      g.globalAlpha = 1;
      const W = (x: number, z: number) => [(x + MAP_EXTENT) * k - u, (z + MAP_EXTENT) * k - v] as const;
      const px = k / zoom; // one screen pixel in map units
      // the route
      g.strokeStyle = '#ffb000';
      g.lineWidth = 4 * px;
      g.lineJoin = 'round';
      g.beginPath();
      race.route.pts.forEach((p, i) => {
        const [a, b] = W(p.x, p.z);
        if (i) g.lineTo(a, b);
        else g.moveTo(a, b);
      });
      g.stroke();
      const dot = (x: number, z: number, r: number, fill: string, stroke?: string) => {
        const [a, b] = W(x, z);
        g.fillStyle = fill;
        g.beginPath();
        g.arc(a, b, r * px, 0, Math.PI * 2);
        g.fill();
        if (stroke) {
          g.strokeStyle = stroke;
          g.lineWidth = 2 * px;
          g.stroke();
        }
      };
      race.route.checkpoints.forEach((c, i) => {
        if (i < race.player.next) return;
        dot(c.x, c.z, i === race.player.next ? 6 : 3.5, c.finish ? '#f4f4f4' : i === race.player.next ? '#ffb000' : '#3b3f47', '#0b0c10');
      });
      dot(race.rival.pos.x, race.rival.pos.z, 5.5, rivalColor(), '#0b0c10');
      g.restore();
      // you: an arrow in the middle pointing the way the car faces
      g.save();
      g.translate(size / 2, size / 2);
      g.rotate(-(car.yaw - yaw));
      g.fillStyle = hex(car.paint);
      g.strokeStyle = '#f4f4f4';
      g.lineWidth = 1.5;
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
    <div className="absolute right-[max(24px,3vw)] top-6">
      <canvas id="race-map" ref={ref} style={{ width: size, height: size }} className="rounded-full border border-white/15" />
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
    <div ref={ref} className="absolute left-0 top-0 opacity-0 flex flex-col items-center pointer-events-none" style={{ willChange: 'transform' }}>
      <div className="display font-black text-lg uppercase px-2 leading-tight text-asphalt" style={{ background: rivalColor() }}>
        Rival
      </div>
      <span ref={dist} className="text-xs text-white/80 shadow-text tabular-nums" />
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
          <div id="race-verdict" className={`display font-black text-7xl uppercase leading-none ${race.won ? 'text-amber' : 'text-brake'}`}>
            {race.won ? 'You win' : race.time === null ? 'Too slow' : 'You lose'}
          </div>
          <div className="text-white/55 mt-2">
            {r.car} · {r.cond} · won {stats2.wins} of {stats2.races}
          </div>
        </div>
        <div className="text-right">
          <div className="display font-black text-8xl leading-none tabular-nums">
            {margin !== null ? Math.abs(margin).toFixed(1) : 'DNF'}
            {margin !== null && <span className="text-4xl text-white/50"> s</span>}
          </div>
          <div className="text-sm mt-1 text-white/60">
            {margin === null ? 'Did not finish' : race.won ? 'ahead of the rival' : 'behind the rival'}
            {race.record && <span className="text-amber font-semibold"> · biggest winning margin yet</span>}
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
    </>
  );
}
