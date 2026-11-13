// Drives the three desktop pages in a real browser and checks they work
// together: adding, editing, the focus timer, moods, bubbles and settings.
//
//   npm run test:e2e -w @star/desktop
//
// It uses the browser test bench (index.html), where a stand-in plays the
// part of the Rust side. So this tests everything except the native parts:
// the see-through window, click-through, the tray and full screen hiding.
// Screenshots are saved to docs/desktop/.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOODS, addTask, completeTask, emptyData, snooze, startFocus, stringifyAppData } from '@star/core';
import type { AppData, Mood, Stamp } from '@star/core';

const require = createRequire(import.meta.url);
// Playwright is installed on the machine, not in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = require('playwright') as any;

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, '..', '..', '..', 'docs', 'desktop');
mkdirSync(shots, { recursive: true });

const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
// The fixed "now" for every test: Wednesday 11 November 2026, 16:00.
const NOW = '2026-11-11T16:00:00';
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

// ------------------------------------------------------------- server

// Started with node directly (not through npx) so that stopping it really stops it.
const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--strictPort'], { cwd: join(here, '..'), stdio: 'pipe' });
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

async function newPage(data?: AppData, size = { width: 1180, height: 760 }) {
  const context = await browser.newContext({ viewport: size, timezoneId: 'UTC', deviceScaleFactor: 2 });
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
  return page;
}

try {
  // ------------------------------------------------ the whole journey
  console.log('Journey: add, plan, focus, finish');
  {
    const page = await newPage();
    await page.goto(BASE);
    const star = page.frameLocator('#star');
    const panel = page.frameLocator('#panel');
    const quick = page.frameLocator('#quickadd');
    const bubble = star.locator('#bubble');

    await step('a new star says hello', async () => {
      await bubble.locator('text=Click me').waitFor();
      assert.match(await bubble.innerText(), /Ctrl\+Shift\+A/);
      await page.locator('#star').screenshot({ path: join(shots, '01-first-start.png') });
    });

    await step('clicking the star opens the list', async () => {
      await star.locator('.star-screen').click();
      await panel.locator('.companion').waitFor();
      assert.match(await panel.locator('.message').innerText(), /Tell me what homework/);
    });

    await step('quick add in the list shows a preview, then adds', async () => {
      const input = panel.locator('.quick-add input');
      await input.fill('maths ex 4.2 due fri');
      assert.equal(await panel.locator('.quick-add-preview').innerText(), 'Homework: Maths ex 4.2, due Fri 13 Nov');
      await input.press('Enter');
      await panel.locator('.task-title', { hasText: 'Maths ex 4.2' }).waitFor();
      assert.equal(await panel.locator('.group h2').first().innerText(), 'NEXT 7 DAYS');
    });

    await step('the star confirms what was added', async () => {
      await bubble.locator('text=Added.').waitFor();
      assert.equal(await bubble.innerText(), 'Added. Homework: Maths ex 4.2, due Fri 13 Nov.');
    });

    await step('Ctrl+Shift+A window adds an exam and closes', async () => {
      await page.locator('button[data-menu="quick_add"]').click();
      const input = quick.locator('.quick-add input');
      await input.fill('chem exam 14 nov');
      assert.equal(await quick.locator('.quick-add-preview').innerText(), 'Exam: Chem exam, on Sat 14 Nov');
      await page.locator('#quickadd').screenshot({ path: join(shots, '02-quick-add.png') });
      await input.press('Enter');
      await page.locator('#quickadd:not(.open)').waitFor({ state: 'attached' });
      await bubble.locator('text=I can suggest 2 revision days').waitFor();
    });

    await step('an exam 3 days away with no revision worries the star', async () => {
      await page.clock.runFor(10_000);
      await star.locator('circle[stroke="#b592ff"]').waitFor();
      await star.locator('.star-screen').hover();
      await bubble.locator('text=No revision today or yesterday').waitFor();
      await page.mouse.move(900, 700);
    });

    await step('suggested revision days can be added or skipped', async () => {
      const rows = panel.locator('.suggestions .task');
      assert.equal(await rows.count(), 2);
      await page.locator('#panel').screenshot({ path: join(shots, '03-list-with-suggestions.png') });
      await rows.first().locator('text=Add').click();
      await rows.first().locator('text=Skip').click();
      await panel.locator('.suggestions').waitFor({ state: 'detached' });
      await panel.locator('.task-title', { hasText: 'Revise for Chem exam' }).waitFor();
    });

    await step('starting a focus session puts the star in focus mode', async () => {
      await panel.locator('.task', { hasText: 'Revise for Chem exam' }).locator('text=Focus').click();
      await panel.locator('.focus-card.running').waitFor();
      assert.match(await panel.locator('.focus-label').innerText(), /Focusing on Revise for Chem exam/);
      await star.locator('circle[stroke="#4de0b0"]').waitFor();
      await bubble.locator('text=Focusing on Revise for Chem exam until 16:').waitFor();
      await page.screenshot({ path: join(shots, '04-focus-running.png') });
    });

    await step('when the 25 minutes are up the session logs itself', async () => {
      // Jump to ten seconds before the end, then let the last seconds tick by
      // for real, so the short celebration is not skipped over.
      await page.clock.runFor(25 * 60_000 - 10_000);
      await star.locator('circle[stroke="#ff7bd5"]').waitFor(); // celebrate
      await bubble.locator('text=25 minutes on Revise for Chem exam!').waitFor();
      await page.locator('#star').screenshot({ path: join(shots, '05-celebrate.png') });
      await panel.locator('.focus-card:not(.running)').waitFor();
      // The revision day ticked itself off.
      await panel.locator('.task.done .task-title', { hasText: 'Revise for Chem exam' }).waitFor();
    });

    await step('after the celebration it is proud, and the exam no longer worries it', async () => {
      await page.clock.runFor(10_000);
      await star.locator('circle[stroke="#ffa931"]').waitFor(); // proud: nothing is due today or tomorrow
      await panel.locator('.tabs button', { hasText: 'Exams' }).click();
      await panel.locator('text=25 min revised').waitFor();
      await page.locator('#panel').screenshot({ path: join(shots, '06-exams.png') });
    });

    await step('revision done elsewhere can be logged by hand', async () => {
      await panel.locator('.exam .log-minutes button', { hasText: '30 min' }).click();
      await panel.locator('text=55 min revised').waitFor();
    });

    await step('ticking homework off celebrates it', async () => {
      await page.clock.runFor(60_000);
      await panel.locator('.tabs button', { hasText: 'Today' }).click();
      await panel.locator('.task', { hasText: 'Maths ex 4.2' }).locator('input[type=checkbox]').check();
      await bubble.locator('text=Maths ex 4.2 is done!').waitFor();
      await panel.locator('.group', { hasText: 'Done today' }).locator('.task-title', { hasText: 'Maths ex 4.2' }).waitFor();
    });

    await step('a task can be edited and its date changed', async () => {
      await panel.locator('.quick-add input').fill('english essay 20.11');
      await panel.locator('.quick-add input').press('Enter');
      const row = panel.locator('.task', { hasText: 'English essay' });
      await row.locator('.task-main').click();
      await row.locator('input[type=text]').fill('English essay draft');
      await row.locator('input[type=date]').fill('2026-11-12');
      await row.locator('button[type=submit]').click();
      const moved = panel.locator('.group', { hasText: 'Tomorrow' }).locator('.task', { hasText: 'English essay draft' });
      await moved.waitFor();
      assert.match(await moved.locator('.task-meta').innerText(), /Due tomorrow/);
    });

    await step('a task can be deleted', async () => {
      const row = panel.locator('.task', { hasText: 'English essay draft' });
      await row.locator('.task-main').click();
      await row.locator('text=Delete').click();
      await row.waitFor({ state: 'detached' });
    });

    await step('goals show up on their own tab', async () => {
      await panel.locator('.quick-add input').fill('long goal get an A in chemistry');
      await panel.locator('.quick-add input').press('Enter');
      await panel.locator('.tabs button', { hasText: 'Goals' }).click();
      await panel.locator('.goal .task-title', { hasText: 'Get an A in chemistry' }).waitFor();
      await panel.locator('text=Not worked on yet').waitFor();
      await page.locator('#panel').screenshot({ path: join(shots, '07-goals.png') });
    });

    await step('the eyes follow the mouse', async () => {
      // Something due tomorrow turns proud (closed, smiling eyes) into happy (open eyes).
      await panel.locator('.quick-add input').fill('bio hw tomorrow');
      await panel.locator('.quick-add input').press('Enter');
      await star.locator('circle[stroke="#ffd84d"]').waitFor();
      const lit = () =>
        star
          .locator('svg g:last-of-type circle[opacity="1"]')
          .evaluateAll((dots: Element[]) => dots.map((d) => `${d.getAttribute('cx')}:${d.getAttribute('cy')}`).sort().join(' '));
      await page.mouse.move(1100, 280); // level with the star, far to the right
      await page.waitForTimeout(150);
      const right = await lit();
      await page.mouse.move(236, 740); // straight below the star
      await page.waitForTimeout(150);
      const down = await lit();
      assert.notEqual(right, down);
      // The mouth does not move: both faces light the same number of dots.
      assert.equal(right.split(' ').length, down.split(' ').length);
    });

    await step('settings: a snooze puts it to sleep, ending it wakes it', async () => {
      await panel.locator('.tabs button', { hasText: 'Settings' }).click();
      await panel.locator('text=Snooze 1 hour').click();
      await star.locator('circle[stroke="#6f7fc4"]').waitFor(); // sleepy
      await page.locator('#panel').screenshot({ path: join(shots, '08-settings.png') });
      await panel.locator('text=End snooze').click();
      await star.locator('circle[stroke="#6f7fc4"]').waitFor({ state: 'detached' });
    });

    await step('settings: the small star setting shrinks the star', async () => {
      assert.equal(await star.locator('svg').getAttribute('width'), '190');
      await panel.locator('label', { hasText: 'Small star' }).locator('input').check();
      await star.locator('svg[width="130"]').waitFor();
      await panel.locator('label', { hasText: 'Small star' }).locator('input').uncheck();
      await star.locator('svg[width="190"]').waitFor();
    });

    await step('settings: my evening time is saved', async () => {
      await panel.locator('label', { hasText: 'My evening starts at' }).locator('input').fill('20:30');
      await panel.locator('label', { hasText: 'My evening starts at' }).locator('input').blur();
      await page.waitForFunction(() => (localStorage.getItem('star.data') ?? '').includes('"eveningTime": "20:30"'));
    });

    await step('Esc closes the list, and the data is still there after a restart', async () => {
      await panel.locator('.quick-add input').press('Escape');
      await page.locator('#panel:not(.open)').waitFor({ state: 'attached' });
      await page.reload();
      await page.frameLocator('#star').locator('.star-screen').click();
      const again = page.frameLocator('#panel');
      await again.locator('.tabs button', { hasText: 'Goals' }).click();
      await again.locator('.task-title', { hasText: 'Get an A in chemistry' }).waitFor();
    });

    await page.context().close();
  }

  // --------------------------------------------------------- overdue
  console.log('Overdue homework');
  {
    let data = emptyData();
    data = addTask(data, { kind: 'homework', title: 'History notes', due: '2026-11-09' }, 'late', at('2026-11-05T10:00:00'));
    const page = await newPage(data);
    await page.goto(BASE);
    const star = page.frameLocator('#star');
    const panel = page.frameLocator('#panel');

    await step('the star is grumpy and names the task and the day', async () => {
      await star.locator('circle[stroke="#ff5a4d"]').waitFor();
      assert.equal(await star.locator('#bubble').innerText(), 'History notes was due Mon 9 Nov.');
    });

    await step('"Move to tomorrow" clears it', async () => {
      await star.locator('.star-screen').click();
      const row = panel.locator('.group.late .task', { hasText: 'History notes' });
      assert.match(await row.locator('.task-meta').innerText(), /Was due Mon 9 Nov/);
      await page.locator('#panel').screenshot({ path: join(shots, '09-overdue.png') });
      await row.locator('text=Move to tomorrow').click();
      await panel.locator('.group', { hasText: 'Tomorrow' }).locator('.task', { hasText: 'History notes' }).waitFor();
      await star.locator('circle[stroke="#8ecbff"]').waitFor(); // neutral again
    });
    await page.context().close();
  }

  // ------------------------------------------------ bubble placement
  console.log('Speech bubble');
  {
    const page = await newPage(undefined, { width: 440, height: 450 });
    await page.goto(`${BASE}/star.html?bubble=below&shift=60`);
    await step('the bubble can sit under the star and slide sideways', async () => {
      const bubble = page.locator('#bubble.show');
      await bubble.waitFor();
      await page.waitForTimeout(400); // let the fade-in finish before measuring
      const star = (await page.locator('#stage').boundingBox())!;
      const box = (await bubble.boundingBox())!;
      assert.ok(box.y >= star.y + star.height - 10, 'bubble is below the star');
      assert.ok(Math.abs(box.x + box.width / 2 - (star.x + star.width / 2) - 60) < 2, 'bubble is shifted 60px right');
      await page.addStyleTag({ content: 'html{background:#3a4660}' });
      await page.screenshot({ path: join(shots, '10-bubble-below.png') });
    });
    await step('the bubble goes away by itself', async () => {
      await page.clock.runFor(8_000);
      await page.locator('#bubble:not(.show)').waitFor();
    });
    await page.context().close();
  }

  // ------------------------------------------------------ every mood
  console.log('Every mood in the star window');
  {
    const seeds: Record<Mood, AppData> = Object.fromEntries(MOODS.map((m) => [m, emptyData()])) as Record<Mood, AppData>;
    const hw = (data: AppData, id: string, title: string, due?: string) =>
      addTask(data, { kind: 'homework', title, ...(due ? { due } : {}) }, id, at('2026-11-05T10:00:00'));

    seeds.neutral = hw(seeds.neutral, 'a', 'Maths hw', '2026-11-16');
    seeds.happy = completeTask(hw(hw(seeds.happy, 'a', 'Bio notes', '2026-11-20'), 'b', 'English essay', '2026-11-12'), 'a', at('2026-11-11T13:00:00'));
    seeds.proud = completeTask(hw(seeds.proud, 'a', 'Bio notes', '2026-11-20'), 'a', at('2026-11-11T13:00:00'));
    seeds.celebrate = completeTask(hw(seeds.celebrate, 'a', 'Maths hw', '2026-11-12'), 'a', at('2026-11-11T15:59:58'));
    seeds.worried = addTask(seeds.worried, { kind: 'exam', title: 'Chem exam', due: '2026-11-14' }, 'e', at('2026-11-05T10:00:00'));
    seeds.grumpy = hw(seeds.grumpy, 'a', 'Maths ex 4.2', '2026-11-10');
    seeds.sleepy = snooze(hw(seeds.sleepy, 'a', 'Maths hw', '2026-11-16'), 120, at(NOW));
    seeds.focus = startFocus(
      addTask(seeds.focus, { kind: 'exam', title: 'Chem exam', due: '2026-11-14' }, 'e', at('2026-11-05T10:00:00')),
      { taskId: 'e' },
      's',
      at('2026-11-11T15:50:00'),
    );

    const colors: Record<Mood, string> = {
      neutral: '#8ecbff', happy: '#ffd84d', proud: '#ffa931', celebrate: '#ff7bd5',
      worried: '#b592ff', grumpy: '#ff5a4d', sleepy: '#6f7fc4', focus: '#4de0b0',
    };
    const messages: string[] = [];
    for (const mood of MOODS) {
      await step(`${mood}`, async () => {
        const page = await newPage(seeds[mood], { width: 440, height: 450 });
        await page.goto(`${BASE}/star.html`);
        await page.locator(`circle[stroke="${colors[mood]}"]`).waitFor({ timeout: 5000 });
        await page.locator('#bubble.show').waitFor();
        messages.push(`${mood}: ${await page.locator('#bubble').innerText()}`);
        await page.addStyleTag({ content: 'html{background:#3a4660}' });
        await page.screenshot({ path: join(shots, `mood-${mood}.png`), clip: { x: 60, y: 40, width: 320, height: 300 } });
        await page.context().close();
      });
    }
    console.log(messages.map((m) => `      ${m}`).join('\n'));

    // One sheet with all eight, for the docs.
    const sheet = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
    await sheet.setContent(
      `<body style="margin:0;background:#3a4660;display:grid;grid-template-columns:repeat(4,320px);width:max-content">` +
        MOODS.map((m) => `<img src="${BASE}/__shots/mood-${m}.png" width="320" height="300">`).join('') +
        `</body>`,
    );
    await sheet.route('**/__shots/*', (route: { request(): { url(): string }; fulfill(o: object): Promise<void> }) =>
      route.fulfill({ path: join(shots, route.request().url().split('/').pop()!) }),
    );
    await sheet.reload().catch(() => {});
    await sheet.setContent(
      `<body style="margin:0;background:#3a4660;display:grid;grid-template-columns:repeat(4,320px);width:max-content">` +
        MOODS.map((m) => `<img src="${BASE}/__shots/mood-${m}.png" width="320" height="300">`).join('') +
        `</body>`,
      { waitUntil: 'networkidle' },
    );
    await sheet.locator('body').screenshot({ path: join(shots, 'all-moods-in-app.png') });
    await sheet.context().close();
  }

  console.log(`\n${passed} checks passed`);
} finally {
  await browser.close();
  server.kill();
}
