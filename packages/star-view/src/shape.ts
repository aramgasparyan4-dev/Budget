// Sizes and colours of the star drawing, in a 240 by 240 box.

import { FACE_SIZE } from '@star/core';

export const VIEW = 240;
export const CENTER = VIEW / 2;
const OUTER_RADIUS = 92;
const INNER_RADIUS = 56;
/** The star's outline is drawn this thick with round joins, which rounds the points. */
export const CORNER_ROUNDING = 26;
export const SCREEN_RADIUS = 47;
const DOT_PITCH = (SCREEN_RADIUS * 2 - 6) / FACE_SIZE;
export const DOT_RADIUS = DOT_PITCH * 0.36;

export const BODY = '#16171d';
export const SCREEN = '#0b0c10';
export const DOT_OFF = '#1d1f27';

function starPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(CENTER + r * Math.cos(a)).toFixed(2)},${(CENTER + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const STAR_POINTS = starPoints();

/** Centre of one dot of the face, in view box units. */
export function dotCenter(x: number, y: number): { cx: number; cy: number } {
  const start = CENTER - (DOT_PITCH * (FACE_SIZE - 1)) / 2;
  return { cx: start + x * DOT_PITCH, cy: start + y * DOT_PITCH };
}
