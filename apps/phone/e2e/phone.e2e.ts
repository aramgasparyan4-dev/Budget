// Runs the phone app in a browser set up like an Android phone and checks
// that it installs, works with no internet, and adds homework quickly.
//
//   npm run test:e2e -w @star/phone
//
// Screenshots are saved to docs/phone/.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTask, emptyData, stringifyAppData } from '@star/core';
import type { AppData, Stamp } from '@star/core';

const require = createRequire(import.meta.url);
// Playwright is installed on the machine, not in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium, devices } = require('playwright') as any;

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, '..', '..', '..', 'docs', 'phone');
mkdirSync(shots, { recursive: true });

const PORT = 4331;
// Served under a sub-folder on purpose: the real site lives at /Budget/, so
// every address in the app has to be relative.
const BASE = `http://localhost:${PORT}/Budget/`;
const NOW = '2026-11-11T16:00:00'; // a Wednesday
const at = (local: string): Stamp => ({ local, ms: Date.parse(`${local}Z`) });

let passed = 0;
async function step(name: string, run: () => Promise<void>) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    throw error;
  }
}

const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--strictPort', '--base', '/Budget/'], {
  cwd: join(here, '..'),
  stdio: 'pipe',
});
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('preview server did not start')), 20_000);
  server.stdout.on('data', (chunk: Buffer) => {
    if (chunk.toString().includes('localhost')) {
      clearTimeout(timer);
      resolve();
    }
  });
});

const browser = await chromium.launch();

async function newPhone(data?: AppData) {
  const context = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'UTC', locale: 'en-GB' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${NOW}Z`) });
  if (data) {
    await page.addInitScript((text: string) => {
      if (!localStorage.getItem('star.seeded')) {
        localStorage.setItem('star.data', text);
        localStorage.setItem('star.seeded', '1');
      }
    }, stringifyAppData(data));
  }
  return { context, page };
}

try {
  console.log('Install and offline');
  {
    const { context, page } = await newPhone();
    await page.goto(BASE);

    await step('opens with the face on top and a hello', async () => {
      await page.locator('.companion.phone .star-face.live svg').waitFor();
      assert.match(await page.locator('.message').innerText(), /Tell me what homework/);
      const face = (await page.locator('.star-face.live').boundingBox())!;
      const input = (await page.locator('.quick-add input').boundingBox())!;
      assert.ok(face.y < input.y, 'the face is above the quick add box');
    });

    await step('has what Chrome needs to offer "Install app"', async () => {
      const href = await page.locator('link[rel=manifest]').getAttribute('href');
      const manifestUrl = new URL(href!, page.url()).toString();
      const manifest = await (await page.request.get(manifestUrl)).json();
      assert.equal(manifest.display, 'standalone');
      assert.equal(manifest.name, 'Star Companion');
      const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
      assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
      for (const icon of manifest.icons) {
        const response = await page.request.get(new URL(icon.src, manifestUrl).toString());
        assert.equal(response.status(), 200, icon.src);
        assert.equal(response.headers()['content-type'], 'image/png');
      }
      // The start address must be inside the app's own folder.
      assert.equal(new URL(manifest.start_url, manifestUrl).toString(), BASE);
    });

    await step('saves itself on the phone for use with no internet', async () => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      const saved = await page.evaluate(async () => {
        const names = await caches.keys();
        const cache = await caches.open(names[0]!);
        return (await cache.keys()).length;
      });
      assert.ok(saved >= 6, `expected the app's files to be saved, found ${saved}`);
    });

    await step('adding homework takes one line, and well under 5 seconds', async () => {
      const started = Date.now();
      await page.locator('.quick-add input').tap();
      await page.keyboard.type('maths hw fri', { delay: 60 });
      assert.equal(await page.locator('.quick-add-preview').innerText(), 'Homework: Maths hw, due Fri 13 Nov');
      await page.keyboard.press('Enter');
      await page.locator('.task-title', { hasText: 'Maths hw' }).waitFor();
      const seconds = (Date.now() - started) / 1000;
      console.log(`      tap, type 12 letters at a slow typing speed, Enter: ${seconds.toFixed(1)} s`);
      assert.ok(seconds < 5);
      await page.screenshot({ path: join(shots, '01-today.png') });
    });

    await step('with no internet: reopens, still has the data, and can add more', async () => {
      await context.setOffline(true);
      await page.reload();
      await page.locator('.task-title', { hasText: 'Maths hw' }).waitFor();
      await page.locator('.quick-add input').fill('chem exam 14 nov');
      await page.keyboard.press('Enter');
      await page.locator('.task-title', { hasText: /^Chem exam$/ }).waitFor();
      await page.reload();
      await page.locator('.task-title', { hasText: /^Chem exam$/ }).waitFor();
      await page.locator('.suggestions').waitFor();
      await page.screenshot({ path: join(shots, '02-offline-with-suggestions.png') });
      await context.setOffline(false);
    });

    await step('the face follows the mood', async () => {
      // An exam 3 days away with no revision: worried (violet).
      await page.clock.runFor(40_000);
      await page.locator('.star-face.live circle[stroke="#b592ff"]').waitFor();
      assert.match(await page.locator('.message').innerText(), /Chem exam is on Sat 14 Nov\. No revision/);
    });

    await step('a focus session runs and logs itself, here on the phone', async () => {
      await page.locator('.task', { has: page.locator('.task-title', { hasText: /^Chem exam$/ }) }).locator('text=Focus').tap();
      await page.locator('.focus-card.running').waitFor();
      await page.locator('.star-face.live circle[stroke="#4de0b0"]').waitFor();
      await page.screenshot({ path: join(shots, '03-focus.png') });
      await page.clock.runFor(25 * 60_000 - 10_000);
      await page.locator('.star-face.live circle[stroke="#ff7bd5"]').waitFor(); // celebrate
      assert.equal(await page.locator('.message').innerText(), '25 minutes on Chem exam!');
      await page.locator('.focus-card:not(.running)').waitFor();
      const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('star.data')!).sessions);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].minutes, 25);
    });

    await step('ticking a task off works with a finger', async () => {
      await page.clock.runFor(60_000);
      await page.locator('.task', { hasText: 'Maths hw' }).locator('input[type=checkbox]').tap();
      await page.locator('.task.done .task-title', { hasText: 'Maths hw' }).waitFor();
      assert.equal(await page.locator('.message').innerText(), 'Maths hw is done!');
    });

    await step('exams, goals and settings tabs', async () => {
      await page.locator('.tabs button', { hasText: 'Exams' }).tap();
      await page.locator('text=25 min revised').waitFor();
      await page.screenshot({ path: join(shots, '04-exams.png') });
      await page.locator('.quick-add input').fill('long goal get an A in chemistry');
      await page.keyboard.press('Enter');
      await page.locator('.tabs button', { hasText: 'Goals' }).tap();
      await page.locator('.goal .task-title', { hasText: 'Get an A in chemistry' }).waitFor();
      await page.locator('.tabs button', { hasText: 'Settings' }).tap();
      await page.locator('h2', { hasText: 'This phone' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(shots, '05-settings.png') });
    });

    await step('buttons are big enough for a finger', async () => {
      await page.locator('.tabs button', { hasText: 'Today' }).tap();
      for (const selector of ['.quick-add input', '.tabs button >> nth=0', '.task .chip >> nth=0']) {
        const box = (await page.locator(selector).boundingBox())!;
        assert.ok(box.height >= 34, `${selector} is ${box.height}px tall`);
      }
      const fontSize = await page.locator('.quick-add input').evaluate((el: Element) => getComputedStyle(el).fontSize);
      assert.equal(fontSize, '16px'); // smaller text makes Chrome zoom in on tap
    });

    await step('nothing is wider than the screen', async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0);
    });

    await context.close();
  }

  console.log('Quick add shortcut');
  {
    const { context, page } = await newPhone();
    await page.goto(`${BASE}?add=1`);
    await step('opens with the cursor already in the box', async () => {
      await page.locator('.quick-add input').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Quick add');
    });
    await context.close();

    const plain = await newPhone();
    await plain.page.goto(BASE);
    await step('a normal start does not pop the keyboard up', async () => {
      await plain.page.locator('.quick-add input').waitFor();
      assert.notEqual(await plain.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Quick add');
    });
    await plain.context.close();
  }

  console.log('A day with things in it');
  {
    let data = emptyData();
    data.settings.quietHours = [];
    const add = (kind: 'homework' | 'exam' | 'goal_long', title: string, id: string, due?: string) => {
      data = addTask(data, { kind, title, ...(due ? { due } : {}) }, id, at('2026-11-05T10:00:00'));
    };
    add('homework', 'History notes', 'a', '2026-11-10');
    add('homework', 'Maths ex 4.2', 'b', '2026-11-12');
    add('homework', 'English essay draft', 'c', '2026-11-16');
    add('exam', 'Chem exam', 'd', '2026-11-20');
    const { context, page } = await newPhone(data);
    await page.goto(BASE);
    await step('overdue homework: grumpy face, and "Move to tomorrow" fixes it', async () => {
      await page.locator('.star-face.live circle[stroke="#ff5a4d"]').waitFor();
      assert.equal(await page.locator('.message').innerText(), 'History notes was due yesterday.');
      await page.screenshot({ path: join(shots, '06-overdue.png') });
      await page.locator('.group.late .task').locator('text=Move to tomorrow').tap();
      await page.locator('.star-face.live circle[stroke="#8ecbff"]').waitFor();
    });
    await context.close();
  }

  // The service worker file must list real files only.
  {
    const dist = join(here, '..', 'dist');
    const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
    const files = JSON.parse(/const FILES = (\[.*?\]);/s.exec(sw)![1]!) as string[];
    await step('every file the phone is told to save exists', async () => {
      for (const file of files) {
        if (file === './') continue;
        readFileSync(join(dist, file));
      }
      assert.ok(files.includes('./') && files.includes('./manifest.webmanifest'));
      assert.ok(!files.some((file) => file.includes('/.')), 'no hidden files');
    });
  }

  console.log(`\n${passed} checks passed`);
} finally {
  await browser.close();
  server.kill();
}
