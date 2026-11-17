import preact from '@preact/preset-vite';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const publicDir = resolve(import.meta.dirname, 'public');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Writes sw.js, the service worker that makes the app work with no
 * internet. It lists every file of this build, so the phone can save them
 * all the first time the app is opened.
 */
function serviceWorker(): Plugin {
  return {
    name: 'star-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // './' is the page itself (index.html). Hidden files such as .nojekyll
      // are left out: a host may refuse to serve them, and one missing file
      // would stop the whole app from being saved.
      const built = Object.keys(bundle);
      const copied = walk(publicDir).map((path) => relative(publicDir, path).split('\\').join('/'));
      const files = [
        './',
        ...[...built, ...copied]
          .filter((name) => name !== 'sw.js' && name !== 'index.html' && !name.split('/').some((part) => part.startsWith('.')))
          .map((name) => `./${name}`),
      ];
      const version = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SERVICE_WORKER.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)) });
    },
  };
}

const SERVICE_WORKER = `// Made by the build. Do not edit: see vite.config.ts.
const CACHE = 'star-__VERSION__';
const FILES = __FILES__;

// First visit: save every file of the app on the phone.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// A newer version has been saved: throw the old files away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('star-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Answer from the saved files first, so the app opens instantly and works
// with no internet. Anything not saved goes to the network as usual.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // ignoreVary: the saved copy counts whatever headers the host varies on.
  const saved =
    request.mode === 'navigate'
      ? caches.match('./', { ignoreSearch: true, ignoreVary: true })
      : caches.match(request, { ignoreSearch: true, ignoreVary: true });
  event.respondWith(saved.then((response) => response || fetch(request)));
});
`;

// base './' makes every address relative, so the app works wherever it is
// hosted, for example https://name.github.io/Budget/.
export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorker()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  build: { target: 'es2022' },
});
