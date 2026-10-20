// Build the game as a single self-contained HTML file (JS, CSS, fonts and the chunk worker inlined).
// Usage: node scripts/build-single.mjs [index.html] [out.html]
// Google Fonts links in the page stay external: with no network the page falls back to the bundled Inter.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const page = process.argv[2] ?? 'index.html';
const out = process.argv[3] ?? page.replace(/\.html$/, '.single.html');
const dir = mkdtempSync(join(tmpdir(), 'single-'));

await build({
  configFile: false,
  plugins: [react(), tailwindcss()],
  base: './',
  worker: { format: 'es' },
  logLevel: 'warn',
  build: { outDir: dir, emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 20000, rollupOptions: { input: resolve(page) } },
});

const assets = join(dir, 'assets');
let html = readFileSync(join(dir, page), 'utf8');
const files = readdirSync(assets);
const read = (f) => readFileSync(join(assets, f), 'utf8');

// stylesheet: fonts become data URIs
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+\.css)"[^>]*>/g, (_, f) => {
  const css = read(f).replace(/url\(\.\/([^)]+\.woff2)\)/g, (m, font) => `url(data:font/woff2;base64,${readFileSync(join(assets, font)).toString('base64')})`);
  return `<style>${css}</style>`;
});

// script: the chunk worker comes from a blob URL
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+\.js)"[^>]*><\/script>/, (_, f) => {
  let js = read(f);
  if (/\bimport\s*[{*\w]|\bimport\(/.test(js.slice(0, 2000)) && files.filter((x) => x.endsWith('.js') && !x.startsWith('chunk.worker')).length > 1) {
    throw new Error('the build was split into several chunks; single-file inlining expects one');
  }
  const worker = files.find((x) => x.startsWith('chunk.worker'));
  let pre = '';
  if (worker) {
    const pat = new RegExp('new URL\\(new URL\\(`' + worker.replace(/[.-]/g, '\\$&') + '`,import\\.meta\\.url\\)\\.href,``\\+import\\.meta\\.url\\)');
    if (!pat.test(js)) throw new Error('worker reference not found');
    js = js.replace(pat, '__workerURL');
    pre = `const __workerURL = URL.createObjectURL(new Blob([${JSON.stringify(read(worker))}], { type: "text/javascript" }));\n`;
  }
  return `<script type="module">${(pre + js).replace(/<\/script/gi, '<\\/script')}</script>`;
});

writeFileSync(out, html);
rmSync(dir, { recursive: true, force: true });
console.log(`${out}: ${(html.length / 1048576).toFixed(1)} MB`);
