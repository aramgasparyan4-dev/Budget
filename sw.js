// Made by the build. Do not edit: see vite.config.ts.
const CACHE = 'star-20261117044716';
const FILES = ["./","./assets/index-Dpn4wssa.js","./assets/index-B-BJ-nJs.css","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./manifest.webmanifest"];

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
