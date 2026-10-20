// Usage: node scripts/shot.mjs <name> [actions-json]
import { chromium } from 'playwright';
const name = process.argv[2] ?? 'shot';
const actions = JSON.parse(process.argv[3] ?? '[]');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(process.env.URL ?? 'http://localhost:5173/echo-city/');
const t0 = Date.now();
for (const a of actions) {
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.waitFor) await page.waitForSelector(a.waitFor, { timeout: a.timeout ?? 120000 });
  if (a.click) await page.click(a.click);
  if (a.key) await page.keyboard.press(a.key);
  if (a.down) await page.keyboard.down(a.down);
  if (a.up) await page.keyboard.up(a.up);
  if (a.eval) { const r = await page.evaluate(a.eval); if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r)); }
  if (a.shot) await page.screenshot({ path: `scripts/out/${a.shot}.png` });
}
console.log(logs.slice(-60).join('\n'));
console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
