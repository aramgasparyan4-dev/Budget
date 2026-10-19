import { useEffect, useRef } from 'react';
import { game } from '../game/Game';
import { getMapCanvas, MAP_EXTENT, MAP_PX, POI_ICONS } from './mapRender';
import { useStore } from '../state/store';

/** Rotating minimap drawn on a canvas (no React re-renders per frame). */
export function Minimap({ size = 196 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rotate = useStore((s) => s.settings.gameplay.minimapRotate);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 40) return;
      last = t;
      const cv = ref.current;
      const s = game.session;
      const city = game.city;
      if (!cv || !s || !city) return;
      const g = cv.getContext('2d')!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== size * dpr) {
        cv.width = size * dpr;
        cv.height = size * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const map = getMapCanvas(city);
      const inside = s.mode === 'interior';
      const pos = inside && s.interiors?.doorPos ? { x: s.interiors.doorPos.x, z: s.interiors.doorPos.z } : s.playerPos();
      const k = MAP_PX / (MAP_EXTENT * 2);
      const driving = !!s.driving;
      const zoom = driving ? 1.15 : 2.0; // screen px per metre
      const yaw = game.cam.yaw;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#0c1016';
      g.fillRect(0, 0, size, size);
      g.translate(size / 2, size / 2);
      if (rotate) g.rotate(Math.PI + yaw);
      g.scale(zoom / k, zoom / k);
      const u = (pos.x + MAP_EXTENT) * k;
      const v = (pos.z + MAP_EXTENT) * k;
      g.drawImage(map, -u, -v);
      // world-space overlays
      const W = (x: number, z: number) => [(x + MAP_EXTENT) * k - u, (z + MAP_EXTENT) * k - v] as const;
      const dot = (x: number, z: number, r: number, col: string) => {
        const [a, b] = W(x, z);
        g.fillStyle = col;
        g.beginPath();
        g.arc(a, b, (r * k) / zoom, 0, Math.PI * 2);
        g.fill();
      };
      // traffic
      for (const tv of s.traffic.vehicles) dot(tv.x, tv.z, 1.6, 'rgba(200,210,230,0.55)');
      // pedestrians (contacts highlighted)
      for (const p of s.peds.peds) dot(p.x, p.z, 1.2, p.npc.hasNumber ? '#ffd166' : p.npc.relPlayer.friend > 38 ? '#7ae582' : 'rgba(255,255,255,0.35)');
      // owned vehicles
      for (const veh of s.vehicles) if (veh !== s.driving) dot(veh.pos.x, veh.pos.z, 2.4, '#57e3d6');
      // home
      const home = city.buildings[city.playerHome].door;
      dot(home.x, home.z, 3, POI_ICONS.home.color);
      // job markers
      const j = s.jobs?.active;
      if (j) {
        if (j.stage === 'pickup' && j.pickup) dot(j.pickup.x, j.pickup.z, 3.5, '#ffffff');
        if (j.stage === 'deliver') for (const st of j.stops) if (!st.done) dot(st.x, st.z, 3.5, '#ff4d6d');
      }
      for (const ev of s.events?.events ?? []) dot(ev.x, ev.z, 3.2, ev.kind === 'accident' ? '#ff5a5a' : ev.kind === 'gathering' ? '#b07ae0' : '#ffb35a');
      g.restore();
      // waypoint (clamped to edge)
      const wp = s.waypoint;
      if (wp) {
        let dx = (wp.x - pos.x) * zoom;
        let dz = (wp.z - pos.z) * zoom;
        if (rotate) {
          const a = Math.PI + yaw;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          const rx = dx * c - dz * sn;
          const rz = dx * sn + dz * c;
          dx = rx;
          dz = rz;
        }
        const r = Math.hypot(dx, dz);
        const max = size / 2 - 10;
        if (r > max) {
          dx = (dx / r) * max;
          dz = (dz / r) * max;
        }
        g.fillStyle = '#57e3d6';
        g.strokeStyle = '#05070c';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(size / 2 + dx, size / 2 + dz, 6, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      // player arrow
      g.save();
      g.translate(size / 2, size / 2);
      const pyaw = s.driving ? s.driving.yaw : s.ctl?.yaw ?? 0;
      g.rotate(rotate ? Math.PI + yaw - pyaw + Math.PI : Math.PI - pyaw);
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
      // north marker
      if (rotate) {
        const a = Math.PI + yaw;
        const nx = size / 2 + Math.sin(-a) * (size / 2 - 12) * -1;
        const ny = size / 2 - Math.cos(-a) * (size / 2 - 12);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.font = '600 10px Inter Variable, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('N', nx, ny);
      }
      // ring
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, rotate]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="rounded-full shadow-2xl" />;
}
