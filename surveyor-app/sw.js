const CACHE = 'kd-surveyor-v3-facade-camera-v32';
const CORE = ['./index.html','./styles.css','./app.js','./line-builder.js','./calculator-bridge.js','./3d-calculator.js','./3d-compact-editor.js','./3d-layout.js','./3d-gate-frame.js','./3d-gate-render.js','./3d-sliding-frame.js','./3d-sliding-render.js','./3d-sliding-installation.js','./3d-sliding-hardware.js','./3d-drawing.js','./3d-calculator.css?v=reference-ux-20261022','./3d-mobile-ui.css?v=quick-offsets-20261019','./3d-compact-editor.css?v=side-editor-20261022','./manifest.webmanifest','./icon.svg','./sliding-gates/index.html'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('kd-surveyor-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    // When online always validate styles rather than serving an old CSS from
    // another named cache. Offline still uses the current-version copy.
    const isCss = new URL(event.request.url).pathname.endsWith('.css');
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached && !isCss) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return cache.match('./index.html');
      throw new Error('offline');
    }
  })());
});
