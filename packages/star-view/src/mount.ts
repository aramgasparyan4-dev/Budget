// A live star in the page. Unlike renderStarSvg, which rebuilds everything,
// this builds the drawing once and then only switches the dots that differ
// between frames. That keeps the star cheap to animate.

import { FACE_SIZE, frameToGrid, isInsideCircle } from '@star/core';
import type { Face, FaceFrame } from '@star/core';
import { BODY, CENTER, CORNER_ROUNDING, DOT_OFF, DOT_RADIUS, SCREEN, SCREEN_RADIUS, STAR_POINTS, VIEW, dotCenter } from './shape.ts';

const NS = 'http://www.w3.org/2000/svg';

export interface MountedStar {
  element: SVGSVGElement;
  /** Shows one frame. eyeDx and eyeDy are -1, 0 or 1. */
  set(face: Face, frame: FaceFrame, eyeDx?: number, eyeDy?: number): void;
  resize(size: number): void;
}

function el(name: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
}

export function mountStar(container: HTMLElement, size: number, idPrefix = 'live'): MountedStar {
  const svg = el('svg', { viewBox: `0 0 ${VIEW} ${VIEW}`, width: size, height: size }) as SVGSVGElement;

  const defs = el('defs', {}, svg);
  const glowFilter = el('filter', { id: `${idPrefix}-glow`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 9 }, glowFilter);
  const dotFilter = el('filter', { id: `${idPrefix}-dots`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { stdDeviation: 1.6, result: 'b' }, dotFilter);
  const merge = el('feMerge', {}, dotFilter);
  el('feMergeNode', { in: 'b' }, merge);
  el('feMergeNode', { in: 'SourceGraphic' }, merge);

  const star = { points: STAR_POINTS, 'stroke-width': CORNER_ROUNDING, 'stroke-linejoin': 'round' };
  const glow = el('polygon', { ...star, opacity: 0.55, filter: `url(#${idPrefix}-glow)` }, svg);
  // The body is the part that takes clicks and drags.
  el('polygon', { ...star, fill: BODY, stroke: BODY, class: 'star-body' }, svg);
  const ring = el('circle', { cx: CENTER, cy: CENTER, r: SCREEN_RADIUS, fill: SCREEN, 'stroke-opacity': 0.35, 'stroke-width': 1.5, class: 'star-screen' }, svg);

  const offGroup = el('g', { fill: DOT_OFF }, svg);
  const onGroup = el('g', { filter: `url(#${idPrefix}-dots)` }, svg);
  const dots: Array<Array<SVGElement | null>> = [];
  const lit: boolean[][] = [];
  for (let y = 0; y < FACE_SIZE; y++) {
    dots.push([]);
    lit.push(Array<boolean>(FACE_SIZE).fill(false));
    for (let x = 0; x < FACE_SIZE; x++) {
      if (!isInsideCircle(x, y)) {
        dots[y]!.push(null);
        continue;
      }
      const { cx, cy } = dotCenter(x, y);
      const at = { cx: cx.toFixed(2), cy: cy.toFixed(2), r: DOT_RADIUS.toFixed(2) };
      el('circle', at, offGroup);
      dots[y]!.push(el('circle', { ...at, opacity: 0 }, onGroup));
    }
  }

  svg.style.pointerEvents = 'none';
  svg.querySelector<SVGElement>('.star-body')!.style.pointerEvents = 'auto';
  ring.style.pointerEvents = 'auto';
  container.replaceChildren(svg);

  let color = '';
  return {
    element: svg,
    set(face, frame, eyeDx = 0, eyeDy = 0) {
      if (face.color !== color) {
        color = face.color;
        glow.setAttribute('fill', color);
        glow.setAttribute('stroke', color);
        ring.setAttribute('stroke', color);
        onGroup.setAttribute('fill', color);
      }
      const grid = frameToGrid(frame, eyeDx, eyeDy);
      for (let y = 0; y < FACE_SIZE; y++) {
        for (let x = 0; x < FACE_SIZE; x++) {
          const on = grid[y]![x]!;
          if (on === lit[y]![x]) continue;
          lit[y]![x] = on;
          dots[y]![x]?.setAttribute('opacity', on ? '1' : '0');
        }
      }
    },
    resize(next) {
      svg.setAttribute('width', String(next));
      svg.setAttribute('height', String(next));
    },
  };
}
