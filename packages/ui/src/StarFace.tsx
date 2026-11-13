import { getFace } from '@star/core';
import type { Mood } from '@star/core';
import { renderStarSvg } from '@star/star-view';

/** A still picture of the star in one mood. */
export function StarFace({ mood, size, id }: { mood: Mood; size: number; id: string }) {
  const face = getFace(mood);
  const svg = renderStarSvg(face, face.frames[0]!, { size, idPrefix: id });
  return <span class="star-face" style={{ width: `${size}px`, height: `${size}px` }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
