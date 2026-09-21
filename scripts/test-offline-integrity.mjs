import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [sw, app, manifest, delivery, htaccess] = await Promise.all([
  readFile('site-sw.js','utf8'),
  readFile('timeweb/work-app.html','utf8'),
  readFile('site-manifest.webmanifest','utf8'),
  readFile('offline-delivery-200km.json','utf8'),
  readFile('timeweb/.htaccess','utf8')
]);

const db = JSON.parse(delivery);
const rows = Array.isArray(db?.destinations) ? db.destinations : [];
assert(rows.length >= 1000, 'Offline delivery database is unexpectedly small');
assert.equal(rows.filter(item => /^\s*\d+(?:[.,]\d+)?\s*(?:км|km)\s*$/iu.test(String(item?.name||''))).length, 0, 'Kilometer markers leaked into settlement database');
assert.equal(Number(db?.meta?.roadLimitKm), 200, 'Offline delivery radius must stay at 200 km');
assert.equal(Number(db?.meta?.ratePerKm), 90, 'Offline delivery rate must stay at 90 ₽/km');

for (const required of [
  "'/app'",
  "'/links'",
  "'/offline-delivery-200km.json'",
  'GET_OFFLINE_STATUS',
  'OFFLINE_READY',
  'OFFLINE_PARTIAL',
  'catalog-media',
  "url.pathname==='/api/catalog-images'"
]) assert(sw.includes(required), `Service worker missing: ${required}`);

assert(app.includes('Обновить офлайн-базу'), 'Manual offline refresh button missing');
assert(app.includes('navigator.storage.persist'), 'Persistent offline storage protection missing');
assert(app.includes("post('WARM_OFFLINE')"), 'Manual offline refresh action is not wired');
assert(!app.includes("then(()=>navigator.serviceWorker.ready).then(()=>{\n      post('WARM_OFFLINE')"), 'Offline database must not refresh automatically on every app open');

const parsedManifest = JSON.parse(manifest);
assert.equal(parsedManifest.start_url, '/app', 'Unified PWA must open the work app');
assert.equal(parsedManifest.display, 'standalone', 'PWA must remain standalone');

assert(htaccess.includes('X-Frame-Options "DENY"'), 'Clickjacking protection missing');
assert(htaccess.includes('Permissions-Policy'), 'Permissions-Policy missing');

console.log(`Offline/app integrity checks passed: ${rows.length} settlements`);
