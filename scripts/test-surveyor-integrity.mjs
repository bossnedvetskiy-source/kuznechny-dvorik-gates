import {readFile} from 'node:fs/promises';

const app = await readFile('surveyor-app/app.js','utf8');
const html = await readFile('surveyor-app/index.html','utf8');
const sw = await readFile('surveyor-app/sw.js','utf8');
const api = await readFile('timeweb/backend/surveyor.php','utf8');
const router = await readFile('timeweb/local-api.php','utf8');
const schema = await readFile('timeweb/backend/schema.mysql.sql','utf8');
const build = await readFile('scripts/build-timeweb.mjs','utf8');

for (const marker of [
  "const API_ENABLED",
  "async function serverLogin",
  "async function syncNow",
  "serverRevision",
  "syncState: API_ENABLED ? 'pending' : 'local'",
  "API_BASE + path",
  "const SEGMENT_LABELS",
  "openLayoutEditor",
  "saveSegmentFromDialog",
  "layout:x.layout || null"
]) {
  if (!app.includes(marker)) throw new Error('Surveyor app missing: '+marker);
}
for (const marker of ['syncNowBtn','syncStatusText','КД Замерщик']) {
  if (!html.includes(marker)) throw new Error('Surveyor HTML missing: '+marker);
}
if (!sw.includes('kd-surveyor-stage1-v3')) throw new Error('Surveyor service worker cache was not bumped');

for (const marker of [
  'function kd_surveyor_handle',
  'function kd_surveyor_login',
  'function kd_surveyor_sync',
  'function kd_surveyor_users',
  'surveyor_sessions',
  'surveyor_orders',
  "password_hash($password,PASSWORD_DEFAULT)",
  "Bearer",
  "layout_json",
  "'layout' => is_array($layout) ? $layout : null"
]) {
  if (!api.includes(marker)) throw new Error('Surveyor server API missing: '+marker);
}
if (!router.includes("backend/surveyor.php") || !router.includes("str_starts_with($route, 'surveyor/')")) {
  throw new Error('Surveyor API is not routed by Timeweb');
}
if (!schema.includes('layout_json MEDIUMTEXT')) throw new Error('MySQL schema missing visual layout column');
for (const table of ['surveyor_users','surveyor_sessions','surveyor_clients','surveyor_orders']) {
  if (!schema.includes('CREATE TABLE IF NOT EXISTS '+table)) throw new Error('MySQL schema missing '+table);
}
if (!build.includes("path.join(root, 'surveyor-app')") || !build.includes("'Disallow: /surveyor-app'")) {
  throw new Error('Timeweb package does not contain/protect surveyor app');
}
console.log('Surveyor app/server integrity OK');
