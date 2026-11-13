// Draws every mood and saves screenshots to docs/moods/.
//   npm run faces:preview
// Use it after editing packages/core/src/faces.json to see the result.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACES, MOODS, validateFaces } from '@star/core';
import { renderStarSvg } from '@star/star-view';

const require = createRequire(import.meta.url);
// Playwright is installed on the machine, not in this project, so it has no types here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = require('playwright') as any;

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'moods');
mkdirSync(outDir, { recursive: true });

const problems = validateFaces(FACES);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const page_css = `
  body { margin: 0; background: #2a2d3a; font: 15px system-ui, sans-serif; color: #e8e9ee; }
  .sheet { display: grid; grid-template-columns: repeat(4, 260px); gap: 8px; padding: 16px; width: max-content; }
  .cell { text-align: center; padding-bottom: 10px; }
  .frames { display: flex; flex-wrap: wrap; gap: 4px; padding: 16px; width: max-content; }
  .name { margin-top: -6px; text-transform: capitalize; }
`;

let sheet = '';
let allFrames = '';
for (const mood of MOODS) {
  const face = FACES.moods[mood];
  sheet += `<div class="cell" id="${mood}">${renderStarSvg(face, face.frames[0]!, { size: 260, idPrefix: mood })}<div class="name">${mood}</div></div>`;
  face.frames.forEach((frame, i) => {
    allFrames += `<div class="cell">${renderStarSvg(face, frame, { size: 170, idPrefix: `${mood}${i}` })}<div class="name">${mood} ${i + 1}/${face.frames.length}</div></div>`;
  });
}

const html = (body: string) => `<!doctype html><meta charset="utf-8"><style>${page_css}</style>${body}`;
writeFileSync(join(outDir, 'index.html'), html(`<div class="sheet">${sheet}</div><div class="frames">${allFrames}</div>`));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html(`<div class="sheet">${sheet}</div>`));
await page.locator('.sheet').screenshot({ path: join(outDir, 'all-moods.png') });
for (const mood of MOODS) {
  await page.locator(`#${mood}`).screenshot({ path: join(outDir, `${mood}.png`) });
}
await page.setContent(html(`<div class="frames">${allFrames}</div>`));
await page.locator('.frames').screenshot({ path: join(outDir, 'all-frames.png') });
await browser.close();
console.log(`Saved ${MOODS.length + 2} images to docs/moods/`);
