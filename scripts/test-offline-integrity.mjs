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
  'CHECK_OFFLINE_UPDATE',
  'OFFLINE_UP_TO_DATE',
  'OFFLINE_UPDATE_AVAILABLE',
  'OFFLINE_READY',
  'OFFLINE_PARTIAL',
  'catalog-media',
  "url.pathname==='/api/catalog-images'"
]) assert(sw.includes(required), `Service worker missing: ${required}`);

assert(app.includes('Обновить офлайн-базу'), 'Manual offline refresh button missing');
assert(app.includes('navigator.storage.persist'), 'Persistent offline storage protection missing');
assert(app.includes("post('CHECK_OFFLINE_UPDATE',{auto:true,allowInitial:true})"), 'Manual offline refresh must check the lightweight version before downloading');
assert(app.includes("post('CHECK_OFFLINE_UPDATE',{auto:true,allowInitial:false})"), 'Work app must automatically check for site changes without forcing the first download');
assert(app.includes('Полная офлайн-база скачивается автоматически только если на сайте изменились'), 'Work app must explain change-driven offline downloads');
assert(app.includes('Предыдущая офлайн-база сохранена'), 'Partial refresh must explain that the previous offline base is preserved');
assert(sw.includes("fetch('/api/offline-version'"), 'Service worker must use the lightweight offline version endpoint');
assert(sw.includes("localVersion===remote.version"), 'Service worker must skip full downloads when the site version is unchanged');
assert(sw.includes("if(auto)return warmOffline(remote.version)"), 'Changed site content must trigger the offline refresh automatically');
assert(sw.includes('FETCH_ATTEMPTS=3'), 'Offline refresh must retry transient file failures');
assert(sw.includes('useCachedFallback'), 'Offline refresh must reuse a previously cached file after repeated network failures');
assert(sw.includes('completeFallback||anyFallback'), 'Offline status must prefer a previously complete snapshot over an incomplete refresh attempt');
assert(sw.includes('previousReady:Boolean(previousStatus.ready)'), 'Partial refresh must report whether a previous usable base exists');
assert(!app.includes("then(()=>navigator.serviceWorker.ready).then(()=>{\n      post('WARM_OFFLINE')"), 'Offline database must not refresh automatically on every app open');

const parsedManifest = JSON.parse(manifest);
assert.equal(parsedManifest.start_url, '/app', 'Unified PWA must open the work app');
assert.equal(parsedManifest.display, 'standalone', 'PWA must remain standalone');

assert(htaccess.includes('X-Frame-Options "DENY"'), 'Clickjacking protection missing');
assert(htaccess.includes('Permissions-Policy'), 'Permissions-Policy missing');

console.log(`Offline/app integrity checks passed: ${rows.length} settlements`);
