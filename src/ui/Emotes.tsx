import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { game } from '../game/Game';

const MAX = 24;
const v = new THREE.Vector3();

/** Little speech bubbles over pedestrians reacting to things ("!", "#!", "♪"). Positioned imperatively. */
export function Emotes() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els: HTMLDivElement[] = [];
    const r = root.current!;
    for (let i = 0; i < MAX; i++) {
      const d = document.createElement('div');
      d.className = 'absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-full text-xs font-bold bg-white text-ink shadow-lg';
      d.style.display = 'none';
      r.appendChild(d);
      els.push(d);
    }
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = game.session;
      let n = 0;
      if (s && s.mode !== 'interior' && game.camera) {
        const cam = game.camera;
        const W = r.clientWidth;
        const H = r.clientHeight;
        for (const p of s.peds.peds) {
          if (n >= MAX) break;
          if (!p.emote || p.emoteT <= 0) continue;
          if (Math.hypot(p.x - cam.position.x, p.z - cam.position.z) > 40) continue;
          v.set(p.x, p.y + 2.15, p.z).project(cam);
          if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
          const el = els[n++];
          el.style.display = 'block';
          el.style.left = `${((v.x + 1) / 2) * W}px`;
          el.style.top = `${((1 - v.y) / 2) * H}px`;
          if (el.textContent !== p.emote) el.textContent = p.emote;
          el.style.background = p.emote.includes('#') ? '#ff5a6e' : '#ffffff';
          el.style.color = p.emote.includes('#') ? '#fff' : '#05070c';
        }
      }
      for (let i = n; i < MAX; i++) if (els[i].style.display !== 'none') els[i].style.display = 'none';
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const e of els) e.remove();
    };
  }, []);
  return <div ref={root} className="absolute inset-0 pointer-events-none overflow-hidden" />;
}
