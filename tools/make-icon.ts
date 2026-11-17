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

// Desktop: the app icon and the tray icon, on a see-through background.
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

// Phone: home screen icons. The "maskable" one has a solid background and
// extra room around the star, because Android cuts icons into circles.
const phone = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'phone', 'public', 'icons');
for (const [file, size, scale, background] of [
  ['icon-192.png', 192, 1.12, 'transparent'],
  ['icon-512.png', 512, 1.12, 'transparent'],
  ['maskable-512.png', 512, 0.86, '#262a3d'],
] as const) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const drawn = Math.round(size * scale);
  const svg = renderStarSvg(face, frame, { size: drawn });
  await page.setContent(
    `<body style="margin:0;background:${background};overflow:hidden"><div style="margin:${Math.round((size - drawn) / 2)}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: join(phone, file), omitBackground: background === 'transparent' });
  await page.close();
}

await browser.close();
console.log('Wrote the desktop and phone icons');
