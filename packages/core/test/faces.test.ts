import { describe, expect, it } from 'vitest';
import { FACES, FACE_SIZE, MOODS, frameToGrid, frameToHex, getFace, validateFaces } from '../src/index.ts';

describe('faces.json', () => {
  it('has no problems', () => {
    expect(validateFaces(FACES)).toEqual([]);
  });

  it('has a face for every mood, and each one looks different', () => {
    const first = MOODS.map((m) => getFace(m).frames[0]!.rows.join(''));
    expect(new Set(first).size).toBe(MOODS.length);
    const colors = MOODS.map((m) => getFace(m).color);
    expect(new Set(colors).size).toBe(MOODS.length);
  });

  it('reports a broken face set', () => {
    const broken = JSON.parse(JSON.stringify(FACES)) as typeof FACES;
    broken.moods.happy.frames[0]!.rows[0] = '#...............';
    broken.moods.grumpy.frames[0]!.rows.pop();
    const problems = validateFaces(broken);
    expect(problems.some((p) => p.includes('corner'))).toBe(true);
    expect(problems.some((p) => p.includes('16 rows'))).toBe(true);
  });
});

describe('frames', () => {
  const frame = getFace('neutral').frames[0]!;

  it('become a 16 by 16 grid', () => {
    const grid = frameToGrid(frame);
    expect(grid).toHaveLength(FACE_SIZE);
    expect(grid.every((row) => row.length === FACE_SIZE)).toBe(true);
    expect(grid[5]![4]).toBe(true); // left eye
    expect(grid[11]![6]).toBe(true); // mouth
    expect(grid[0]![0]).toBe(false);
  });

  it('eyes can shift, the mouth stays put', () => {
    const grid = frameToGrid(frame, 1, -1);
    expect(grid[4]![5]).toBe(true);
    expect(grid[4]![6]).toBe(true);
    expect(grid[7]![4]).toBe(false);
    expect(grid[11]![6]).toBe(true);
  });

  it('pack into 64 hex characters for the robot', () => {
    const hex = frameToHex(frame);
    expect(hex).toHaveLength(64);
    // Row 5 is ....oo....oo.... -> 0000 1100 0011 0000 -> 0c30
    expect(hex.slice(5 * 4, 6 * 4)).toBe('0c30');
    // Row 11 is ......####...... -> 0000 0011 1100 0000 -> 03c0
    expect(hex.slice(11 * 4, 12 * 4)).toBe('03c0');
  });
});
