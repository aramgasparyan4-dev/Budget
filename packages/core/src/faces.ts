// Faces. Every mood is a list of frames on a 16 by 16 grid, kept in
// faces.json so the desktop app, the phone app and the robot's LED matrix
// all show exactly the same pixels.

import data from './faces.json' with { type: 'json' };
import { MOODS } from './types.ts';
import type { Mood } from './types.ts';

export const FACE_SIZE = 16;

export interface FaceFrame {
  /** How long to show this frame, in milliseconds. */
  ms: number;
  /** 16 strings of 16 characters. '.' off, '#' on, 'o' on and part of an eye. */
  rows: string[];
}

export interface Face {
  /** Glow and pixel colour for this mood, as #rrggbb. */
  color: string;
  frames: FaceFrame[];
}

export interface FaceSet {
  version: number;
  size: number;
  moods: Record<Mood, Face>;
}

export const FACES = data as unknown as FaceSet;

export function getFace(mood: Mood): Face {
  return FACES.moods[mood];
}

/**
 * The apps show the face inside a circle, so the corners of the grid are
 * hidden. True if the pixel at (x, y) is inside that circle.
 */
export function isInsideCircle(x: number, y: number): boolean {
  const c = (FACE_SIZE - 1) / 2;
  return (x - c) ** 2 + (y - c) ** 2 <= (FACE_SIZE / 2) ** 2;
}

/** Checks a face set and returns a list of problems. Empty means it is fine. */
export function validateFaces(set: FaceSet): string[] {
  const problems: string[] = [];
  if (set.size !== FACE_SIZE) problems.push(`size must be ${FACE_SIZE}`);
  for (const mood of MOODS) {
    const face = set.moods[mood];
    if (!face) {
      problems.push(`${mood}: missing`);
      continue;
    }
    if (!/^#[0-9a-f]{6}$/i.test(face.color)) problems.push(`${mood}: color must look like #rrggbb`);
    if (!Array.isArray(face.frames) || face.frames.length === 0) problems.push(`${mood}: needs at least one frame`);
    face.frames.forEach((frame, i) => {
      const where = `${mood} frame ${i}`;
      if (!(frame.ms > 0)) problems.push(`${where}: ms must be above 0`);
      if (frame.rows.length !== FACE_SIZE) problems.push(`${where}: needs ${FACE_SIZE} rows`);
      frame.rows.forEach((row, y) => {
        if (row.length !== FACE_SIZE) problems.push(`${where} row ${y}: needs ${FACE_SIZE} characters`);
        if (/[^.#o]/.test(row)) problems.push(`${where} row ${y}: only . # o are allowed`);
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '.' && !isInsideCircle(x, y)) {
            problems.push(`${where}: pixel ${x},${y} is in a corner the circle hides`);
          }
        }
      });
    });
  }
  return problems;
}

/**
 * Turns a frame into a grid of on/off pixels: grid[y][x].
 * eyeDx and eyeDy (each -1, 0 or 1) shift the eye pixels so the star can
 * look towards the mouse.
 */
export function frameToGrid(frame: FaceFrame, eyeDx = 0, eyeDy = 0): boolean[][] {
  const grid: boolean[][] = Array.from({ length: FACE_SIZE }, () => Array<boolean>(FACE_SIZE).fill(false));
  frame.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '#') {
        grid[y]![x] = true;
      } else if (ch === 'o') {
        const nx = x + eyeDx;
        const ny = y + eyeDy;
        if (nx >= 0 && nx < FACE_SIZE && ny >= 0 && ny < FACE_SIZE) grid[ny]![nx] = true;
      }
    }
  });
  return grid;
}

/**
 * Packs a frame for a microcontroller: 64 hex characters, 4 per row, top
 * row first. In each row the leftmost pixel is the highest bit.
 */
export function frameToHex(frame: FaceFrame): string {
  return frameToGrid(frame)
    .map((row) => {
      let bits = 0;
      for (const on of row) bits = (bits << 1) | (on ? 1 : 0);
      return bits.toString(16).padStart(4, '0');
    })
    .join('');
}
