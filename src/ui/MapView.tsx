import { useEffect, useRef, useState } from 'react';
import { game } from '../game/Game';
import { getMapCanvas, MAP_EXTENT, MAP_PX, POI_ICONS } from './mapRender';
import { useStore } from '../state/store';
import { DISTRICT_INFO } from '../world/types';
import type { BusinessType } from '../world/types';

/** POI categories shown on the map (types not listed fall back to no icon) */
const POI_TYPE: Partial<Record<BusinessType, keyof typeof POI_ICONS>> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  fastfood: 'fastfood',
  grocery: 'grocery',
  convenience: 'convenience',
  clothing: 'clothing',
  bank: 'bank',
  dealership: 'dealership',
  bar: 'bar',
  nightclub: 'nightclub',
  hotel: 'hotel',
  depot: 'depot',
  taxi: 'taxi',
  gym: 'gym',
  cinema: 'cinema',
};

const FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: 'food', label: 'Food', types: ['cafe', 'restaurant', 'fastfood'] },
  { id: 'shops', label: 'Shops', types: ['grocery', 'convenience', 'clothing'] },
  { id: 'services', label: 'Services', types: ['bank', 'dealership', 'depot', 'taxi', 'hotel'] },
  { id: 'night', label: 'Nightlife', types: ['bar', 'nightclub', 'cinema', 'gym'] },
];

interface View {
  cx: number;
  cz: number;
  zoom: number; // screen px per metre
}

function playerPos() {
  const s = game.session;
  if (!s) return { x: 0, z: 0 };
  if (s.mode === 'interior' && s.interiors?.doorPos) return { x: s.interiors.doorPos.x, z: s.interiors.doorPos.z };
  const p = s.playerPos();
  return { x: p.x, z: p.z };
}

/** Pan/zoom city map. Click sets a waypoint (snapped to the nearest place), right-click clears it. */
export function MapCanvas({ height, compact = false }: { height: number; compact?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<View>(null as unknown as View);
  if (!view.current) {
    const p = playerPos();
    view.current = { cx: p.x, cz: p.z, zoom: compact ? 0.55 : 0.85 };
  }
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({ food: true, shops: true, services: true, night: !compact });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      const cv = ref.current;
      const w = wrap.current;
      const s = game.session;
      const city = game.city;
      if (!cv || !w || !s || !city) return;
      const W = w.clientWidth;
      const H = height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      const g = cv.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = view.current;
      const k = MAP_PX / (MAP_EXTENT * 2);
      // beyond the map image: hills to the west, the bay to the east
      g.fillStyle = '#16211a';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#0c2733';
      const shore = W / 2 + (city.shoreX - v.cx) * v.zoom;
      g.fillRect(Math.max(0, shore), 0, W, H);
      // world -> screen
      const SX = (x: number) => W / 2 + (x - v.cx) * v.zoom;
      const SZ = (z: number) => H / 2 + (z - v.cz) * v.zoom;
      const map = getMapCanvas(city);
      g.imageSmoothingEnabled = true;
      g.drawImage(map, SX(-MAP_EXTENT), SZ(-MAP_EXTENT), MAP_PX * (v.zoom / k), MAP_PX * (v.zoom / k));
      // district labels
      if (v.zoom < 1.4) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `600 ${compact ? 10 : 12}px Inter Variable, sans-serif`;
        for (const d of city.districtCenters) {
          g.fillStyle = 'rgba(255,255,255,0.42)';
          g.fillText(DISTRICT_INFO[d.id].name.toUpperCase(), SX(d.x), SZ(d.z));
        }
      }
      // street names when zoomed in
      if (v.zoom > 1.3) {
        g.font = '500 10px Inter Variable, sans-serif';
        g.fillStyle = 'rgba(220,230,245,0.55)';
        for (const l of city.vLines) {
          const x = SX(l.pos);
          if (x < 0 || x > W) continue;
          g.save();
          g.translate(x, H / 2 + 40);
          g.rotate(-Math.PI / 2);
          g.fillText(l.name, 0, 0);
          g.restore();
        }
        for (const l of city.hLines) {
          const z = SZ(l.pos);
          if (z < 0 || z > H) continue;
          g.fillText(l.name, W / 2 + 60, z);
        }
      }
      // POIs
      const f = filtersRef.current;
      const shown = new Set<string>();
      for (const fl of FILTERS) if (f[fl.id]) for (const t of fl.types) shown.add(t);
      const r = Math.max(3, Math.min(9, v.zoom * 6));
      let hoverName: string | null = null;
      const hp = hoverRef.current;
      for (const b of city.businesses) {
        const icon = POI_TYPE[b.type];
        if (!icon || !shown.has(icon)) continue;
        const bd = city.buildings[b.building];
        const x = SX(bd.door.x);
        const z = SZ(bd.door.z);
        if (x < -10 || z < -10 || x > W + 10 || z > H + 10) continue;
        const st = s.econ.biz[b.id];
        g.globalAlpha = st && st.closed ? 0.35 : 1;
        g.fillStyle = POI_ICONS[icon].color;
        g.beginPath();
        g.arc(x, z, r, 0, Math.PI * 2);
        g.fill();
        if (r >= 6) {
          g.fillStyle = '#05070c';
          g.font = `700 ${Math.round(r * 1.1)}px sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const glyph = POI_ICONS[icon].glyph;
          if (glyph.length === 1) g.fillText(glyph, x, z + 0.5);
        }
        g.globalAlpha = 1;
        if (hp && Math.hypot(hp.x - x, hp.y - z) < r + 3) hoverName = `${b.name} · ${bd.address}${st?.closed ? ' (closed)' : ''}`;
      }
      // home
      const home = city.buildings[city.playerHome].door;
      const ring = (x: number, z: number, col: string, rad: number) => {
        g.strokeStyle = col;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(SX(x), SZ(z), rad, 0, Math.PI * 2);
        g.stroke();
      };
      g.fillStyle = POI_ICONS.home.color;
      g.beginPath();
      g.arc(SX(home.x), SZ(home.z), 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#05070c';
      g.font = '700 10px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('⌂', SX(home.x), SZ(home.z) + 0.5);
      if (hp && Math.hypot(hp.x - SX(home.x), hp.y - SZ(home.z)) < 9) hoverName = `Home · ${city.buildings[city.playerHome].address}`;
      // player business
      if (s.business?.def) {
        const bd = city.buildings[s.business.def.building].door;
        ring(bd.x, bd.z, '#7ae582', 8);
      }
      // employer
      const job = s.player.job;
      if (job) {
        const bd = city.buildings[city.businesses[job.biz].building].door;
        ring(bd.x, bd.z, '#ffd166', 8);
      }
      // events
      for (const ev of s.events?.events ?? []) {
        const col = ev.kind === 'accident' ? '#ff5a5a' : ev.kind === 'gathering' ? '#b07ae0' : '#ffb35a';
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(SX(ev.x), SZ(ev.z) - 7);
        g.lineTo(SX(ev.x) + 6, SZ(ev.z) + 5);
        g.lineTo(SX(ev.x) - 6, SZ(ev.z) + 5);
        g.closePath();
        g.fill();
      }
      // job markers
      const j = s.jobs?.active;
      if (j) {
        if (j.stage === 'pickup' && j.pickup) ring(j.pickup.x, j.pickup.z, '#ffb35a', 9);
        if (j.stage === 'deliver') for (const st of j.stops) if (!st.done) ring(st.x, st.z, '#ff5a6e', 9);
      }
      // contacts (friends with your number, if you are close enough to know where they hang out)
      for (const p of s.peds.peds) {
        if (!p.npc.hasNumber) continue;
        g.fillStyle = '#ffd166';
        g.beginPath();
        g.arc(SX(p.x), SZ(p.z), 3, 0, Math.PI * 2);
        g.fill();
      }
      // owned vehicles
      for (const veh of s.vehicles) {
        if (veh === s.driving) continue;
        g.fillStyle = '#57e3d6';
        g.fillRect(SX(veh.pos.x) - 4, SZ(veh.pos.z) - 4, 8, 8);
      }
      // waypoint
      const wp = s.waypoint;
      if (wp) {
        const x = SX(wp.x);
        const z = SZ(wp.z);
        g.strokeStyle = '#57e3d6';
        g.lineWidth = 2;
        g.setLineDash([6, 6]);
        const pp = playerPos();
        g.beginPath();
        g.moveTo(SX(pp.x), SZ(pp.z));
        g.lineTo(x, z);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#57e3d6';
        g.beginPath();
        g.moveTo(x, z);
        g.lineTo(x - 7, z - 14);
        g.arc(x, z - 15, 7, Math.PI, 0);
        g.closePath();
        g.fill();
      }
      // player arrow
      const pp = playerPos();
      const yaw = s.driving ? s.driving.yaw : s.ctl?.yaw ?? 0;
      g.save();
      g.translate(SX(pp.x), SZ(pp.z));
      g.rotate(Math.PI - yaw);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#05070c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(6.5, 7);
      g.lineTo(0, 3.5);
      g.lineTo(-6.5, 7);
      g.closePath();
      g.stroke();
      g.fill();
      g.restore();
      setHover((prev) => (prev === hoverName ? prev : hoverName));
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [height, compact]);

  const toWorld = (ex: number, ey: number) => {
    const cv = ref.current!;
    const rect = cv.getBoundingClientRect();
    const v = view.current;
    return { x: v.cx + (ex - rect.left - rect.width / 2) / v.zoom, z: v.cz + (ey - rect.top - rect.height / 2) / v.zoom };
  };

  const setWaypointAt = (ex: number, ey: number) => {
    const s = game.session;
    const city = game.city;
    if (!s || !city) return;
    const w = toWorld(ex, ey);
    // snap to the nearest place of interest within ~14 screen px
    const v = view.current;
    let best: { x: number; z: number; label: string } | null = null;
    let bd = 14 / v.zoom;
    for (const b of city.businesses) {
      if (!POI_TYPE[b.type]) continue;
      const d = city.buildings[b.building].door;
      const dd = Math.hypot(d.x - w.x, d.z - w.z);
      if (dd < bd) {
        bd = dd;
        best = { x: d.x, z: d.z, label: b.name };
      }
    }
    const home = city.buildings[city.playerHome].door;
    if (Math.hypot(home.x - w.x, home.z - w.z) < bd) best = { x: home.x, z: home.z, label: 'Home' };
    const pt = best ?? { x: w.x, z: w.z, label: 'Marked location' };
    s.setWaypoint(pt.x, pt.z, pt.label);
    game.audio.ui('click');
  };

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={ref}
        className="w-full rounded-2xl cursor-grab active:cursor-grabbing"
        style={{ height }}
        onContextMenu={(e) => {
          e.preventDefault();
          game.session?.clearWaypoint();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const rect = ref.current!.getBoundingClientRect();
          hoverRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          d.moved += Math.abs(dx) + Math.abs(dy);
          d.x = e.clientX;
          d.y = e.clientY;
          view.current.cx -= dx / view.current.zoom;
          view.current.cz -= dy / view.current.zoom;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && d.moved < 5) setWaypointAt(e.clientX, e.clientY);
        }}
        onPointerLeave={() => (hoverRef.current = null)}
        onWheel={(e) => {
          const v = view.current;
          const before = toWorld(e.clientX, e.clientY);
          v.zoom = Math.min(4, Math.max(0.3, v.zoom * (e.deltaY > 0 ? 0.87 : 1.15)));
          const after = toWorld(e.clientX, e.clientY);
          v.cx += before.x - after.x;
          v.cz += before.z - after.z;
        }}
      />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilters({ ...filters, [f.id]: !filters[f.id] })}
            className={`text-[10px] px-2 py-1 rounded-full border ${filters[f.id] ? 'bg-accent/25 border-accent/60 text-white' : 'bg-black/40 border-white/15 text-white/50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button className="w-7 h-7 rounded-full bg-black/50 border border-white/15 text-sm" onClick={() => (view.current.zoom = Math.min(4, view.current.zoom * 1.3))}>
          +
        </button>
        <button className="w-7 h-7 rounded-full bg-black/50 border border-white/15 text-sm" onClick={() => (view.current.zoom = Math.max(0.3, view.current.zoom / 1.3))}>
          −
        </button>
        <button
          className="w-7 h-7 rounded-full bg-black/50 border border-white/15 text-xs"
          title="Center on me"
          onClick={() => {
            const p = playerPos();
            view.current.cx = p.x;
            view.current.cz = p.z;
          }}
        >
          ◎
        </button>
      </div>
      {hover && <div className="absolute left-2 bottom-2 right-2 text-xs bg-black/60 rounded-lg px-2.5 py-1.5 pointer-events-none truncate">{hover}</div>}
    </div>
  );
}

/** Full-screen map (M) */
export function MapOverlay() {
  const overlay = useStore((s) => s.overlay);
  const wp = useStore((s) => s.hud.waypoint);
  const [h, setH] = useState(() => window.innerHeight - 160);
  useEffect(() => {
    const on = () => setH(window.innerHeight - 160);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (overlay !== 'map' || !game.session) return null;
  const legend: [string, string][] = [
    ['#57e3d6', 'Home / waypoint'],
    ['#ffd166', 'Contacts · employer'],
    ['#7ae582', 'Your business'],
    ['#ffb35a', 'Job pickup · events'],
    ['#ff5a6e', 'Delivery drop-off'],
  ];
  return (
    <div className="absolute inset-0 bg-black/70 pointer-events-auto anim-fade flex flex-col px-10 pt-8 pb-6">
      <div className="flex items-end justify-between mb-3 gap-6">
        <div className="shrink-0">
          <div className="text-[11px] uppercase tracking-[0.3em] text-accent">Echo City</div>
          <div className="text-3xl font-semibold whitespace-nowrap">City map</div>
        </div>
        <div className="text-right text-sm text-white/55 min-w-0">
          {wp ? <span className="text-accent">◆ {wp.label}</span> : 'No waypoint'}
          <div className="text-[11px] text-white/40">Click to set a waypoint · right-click to clear · drag and scroll to pan and zoom · M to close</div>
        </div>
      </div>
      <MapCanvas height={h} />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/60 mt-3">
        {legend.map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
