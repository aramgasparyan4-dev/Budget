// Draws the star: a dark rounded star, a round screen in the middle with the
// dot matrix face, and a glow in the mood's colour.
//
//   renderStarSvg  builds the whole drawing as text. Works anywhere.
//   mountStar      puts a live star in a page and updates it cheaply.

import { FACE_SIZE, frameToGrid, isInsideCircle } from '@star/core';
import type { Face, FaceFrame } from '@star/core';
import { BODY, CENTER, CORNER_ROUNDING, DOT_OFF, DOT_RADIUS, SCREEN, SCREEN_RADIUS, STAR_POINTS, VIEW, dotCenter } from './shape.ts';

export { mountStar } from './mount.ts';
export type { MountedStar } from './mount.ts';

export interface StarOptions {
  /** Width and height in pixels. */
  size?: number;
  /** Eye shift, each -1, 0 or 1. */
  eyeDx?: number;
  eyeDy?: number;
  /** Set to false to draw without the outer glow. */
  glow?: boolean;
  /** Must be unique per star on a page, because SVG filter ids are global. */
  idPrefix?: string;
}

export function renderStarSvg(face: Face, frame: FaceFrame, options: StarOptions = {}): string {
  const { size = 240, eyeDx = 0, eyeDy = 0, glow = true, idPrefix = 'star' } = options;
  const grid = frameToGrid(frame, eyeDx, eyeDy);
  const color = face.color;

  let off = '';
  let on = '';
  for (let y = 0; y < FACE_SIZE; y++) {
    for (let x = 0; x < FACE_SIZE; x++) {
      if (!isInsideCircle(x, y)) continue;
      const { cx, cy } = dotCenter(x, y);
      const dot = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${DOT_RADIUS.toFixed(2)}"/>`;
      if (grid[y]?.[x]) on += dot;
      else off += dot;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${size}" height="${size}">` +
    `<defs>` +
    `<filter id="${idPrefix}-glow" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur stdDeviation="9"/></filter>` +
    `<filter id="${idPrefix}-dots" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>` +
    (glow
      ? `<polygon points="${STAR_POINTS}" fill="${color}" stroke="${color}" stroke-width="${CORNER_ROUNDING}" ` +
        `stroke-linejoin="round" opacity="0.55" filter="url(#${idPrefix}-glow)"/>`
      : '') +
    `<polygon points="${STAR_POINTS}" fill="${BODY}" stroke="${BODY}" stroke-width="${CORNER_ROUNDING}" stroke-linejoin="round"/>` +
    `<circle cx="${CENTER}" cy="${CENTER}" r="${SCREEN_RADIUS}" fill="${SCREEN}" stroke="${color}" stroke-opacity="0.35" stroke-width="1.5"/>` +
    `<g fill="${DOT_OFF}">${off}</g>` +
    `<g fill="${color}" filter="url(#${idPrefix}-dots)">${on}</g>` +
    `</svg>`
  );
}
