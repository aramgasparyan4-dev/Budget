// Renders src/index.html frame by frame with headless Chromium.
//   node src/render.js                 -> build/frames/f00000.jpg ... (30 fps, WORKERS pages in parallel)
//   node src/render.js --stills 1,9.5  -> build/stills/*.png at the given times (for review)
//   node src/render.js --cues          -> build/cues.json (sound-effect cue times, read by audio.py)
// Env overrides for other pages: PAGE=prompter.html SIZE=1920x1080 T0=-3 T1=60 OUT=build/pframes
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TIMING = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timing.json'), 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(__dirname, 'lines.json'), 'utf8'));
const FPS = 30;
const PAGE = process.env.PAGE || 'index.html';
const [VW, VH] = (process.env.SIZE || '1080x1920').split('x').map(Number);
const T0 = Number(process.env.T0 || 0);
const T1 = Number(process.env.T1 || TIMING.duration);
const OUT = path.join(ROOT, process.env.OUT || 'build/frames');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.addInitScript(([t, l]) => { window.TIMING = t; window.LINES = l; }, [TIMING, LINES]);
  await page.goto('file://' + path.join(__dirname, PAGE));
  await page.evaluate(() => window.ready);
  return page;
}

async function stills(browser, times) {
  const out = path.join(ROOT, 'build/stills');
  fs.mkdirSync(out, { recursive: true });
  const page = await openPage(browser);
  for (const t of times) {
    await page.evaluate((x) => window.seek(x), t);
    await page.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`) });
  }
}

async function frames(browser) {
  const total = Math.round((T1 - T0) * FPS);
  const workers = Number(process.env.WORKERS || 4);
  const dir = OUT;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const chunk = Math.ceil(total / workers);
  let done = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage(browser);
    for (let f = w * chunk; f < Math.min(total, (w + 1) * chunk); f++) {
      await page.evaluate((x) => window.seek(x), T0 + f / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (++done % 150 === 0) console.log(`${done}/${total} frames (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    }
  }));
  console.log(`rendered ${total} frames`);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const i = process.argv.indexOf('--stills');
    if (i > 0) await stills(browser, process.argv[i + 1].split(',').map(Number));
    else if (process.argv.includes('--cues')) {
      const page = await openPage(browser);
      const cues = await page.evaluate(() => ({ cues: window.CUES, lapse: window.LAPSE }));
      fs.writeFileSync(path.join(ROOT, 'build/cues.json'), JSON.stringify(cues, null, 1));
      console.log(`wrote ${cues.cues.length} cues`);
    } else await frames(browser);
  } finally {
    await browser.close();
  }
})();
