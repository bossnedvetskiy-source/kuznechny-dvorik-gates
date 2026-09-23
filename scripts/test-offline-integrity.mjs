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
assert(sw.includes('failedMediaCount'), 'Offline metadata must track missing photos separately from critical data');
assert(sw.includes('offline-catalog-storage'), 'Offline refresh must report catalog storage failures explicitly');
assert(sw.includes('const NAV_FALLBACKS'), 'Offline navigation must use physical work/link app fallbacks');
assert(sw.includes("'/work-app.html'"), 'Physical work app must be cached for offline use');
assert(sw.includes('mediaComplete:missingMediaUrls.length===0'), 'Offline verification must report photo completeness');
assert(sw.includes('ok:true'), 'Optional missing photos must not make the whole offline base unusable');
assert(app.includes('Отдельные фотографии больше не блокируют готовность офлайн-базы.'), 'Work app must explain that photo failures are nonblocking');
assert(app.includes('updateViaCache:\'none\''), 'Installed PWA must bypass the browser HTTP cache when checking its service worker');
assert(app.includes("'/site-sw.js?build='"), 'Installed PWA must register a versioned service worker URL');
assert(app.includes("navigator.serviceWorker.addEventListener('controllerchange'"), 'Installed PWA must reload once when the new service worker takes control');
assert(htaccess.includes('work-app.html?app-build=2026-09-23-v9'), 'The /app route must force a fresh versioned work-app navigation');
assert(htaccess.includes('RewriteRule ^update/?$ force-update.html [L]'), 'A short /update recovery route must exist');
assert(htaccess.includes('force-update\\.html'), 'Force-update page must bypass stale browser cache');
assert(htaccess.includes('no-store, no-cache, must-revalidate, max-age=0'), 'Work app and service worker must be served without stale browser cache');

assert(sw.includes('FETCH_ATTEMPTS=3'), 'Offline refresh must retry transient file failures');
assert(sw.includes('useCachedFallback'), 'Offline refresh must reuse a previously cached file after repeated network failures');
assert(sw.includes('completeFallback||anyFallback'), 'Offline status must prefer a previously complete snapshot over an incomplete refresh attempt');
assert(sw.includes('previousReady:Boolean(previousStatus.ready)'), 'Partial refresh must report whether a previous usable base exists');
assert(!app.includes("then(()=>navigator.serviceWorker.ready).then(()=>{\n      post('WARM_OFFLINE')"), 'Offline database must not refresh automatically on every app open');

const parsedManifest = JSON.parse(manifest);
assert.match(parsedManifest.start_url, /^\/app(?:\?|$)/, 'Unified PWA must open the work app');
assert.equal(parsedManifest.display, 'standalone', 'PWA must remain standalone');

assert(htaccess.includes('X-Frame-Options "DENY"'), 'Clickjacking protection missing');
assert(htaccess.includes('Permissions-Policy'), 'Permissions-Policy missing');

console.log(`Offline/app integrity checks passed: ${rows.length} settlements`);
