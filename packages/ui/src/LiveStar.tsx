import { getFace } from '@star/core';
import type { Mood } from '@star/core';
import { mountStar } from '@star/star-view';
import { useEffect, useRef } from 'preact/hooks';

/**
 * The star with its face moving. It stops animating while the page is in
 * the background, so it costs nothing when nobody is looking.
 */
export function LiveStar({ mood, size }: { mood: Mood; size: number }) {
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!holder.current) return;
    const star = mountStar(holder.current, size, 'live');
    const face = getFace(mood);
    let index = 0;
    let timer = 0;

    const draw = () => star.set(face, face.frames[index]!);
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden || face.frames.length < 2) return;
      timer = window.setTimeout(() => {
        index = (index + 1) % face.frames.length;
        draw();
        schedule();
      }, face.frames[index]!.ms);
    };

    draw();
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [mood, size]);

  return <span class="star-face live" ref={holder} style={{ width: `${size}px`, height: `${size}px` }} />;
}
