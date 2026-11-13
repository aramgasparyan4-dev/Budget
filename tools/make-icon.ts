// Draws the app icon (the happy star) and the small tray icon.
//   node tools/make-icon.ts
// Then, inside apps/desktop:  npx tauri icon src-tauri/app-icon.png
// Needs Playwright on the machine. Only run this if the star's look changes.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACES } from '@star/core';
import { renderStarSvg } from '@star/star-view';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = require('playwright') as any;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'desktop', 'src-tauri');
const face = FACES.moods.happy;
const frame = face.frames[0]!;

const browser = await chromium.launch();
for (const [file, size] of [['app-icon.png', 1024], ['icons/tray.png', 64]] as const) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Zoom in a little: the star's own margin is there for the glow, which an icon needs less of.
  const svg = renderStarSvg(face, frame, { size: Math.round(size * 1.12) });
  await page.setContent(
    `<body style="margin:0;background:transparent;overflow:hidden"><div style="margin:${-Math.round(size * 0.06)}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: join(out, file), omitBackground: true });
  await page.close();
}
await browser.close();
console.log('Wrote app-icon.png and icons/tray.png');
