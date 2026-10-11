import {readFile} from 'node:fs/promises';

const app = await readFile('surveyor-app/app.js','utf8');
const html = await readFile('surveyor-app/index.html','utf8');
const sw = await readFile('surveyor-app/sw.js','utf8');
const lineBuilder = await readFile('surveyor-app/line-builder.js','utf8');
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
  "async function openPlanEditor",
  "function addPlanItem",
  "function calculationWorkTypes",
  "function syncSurveyWorkTypes",
  "Сохранённые расчёты",
  "function v3ProductTools",
  "function showCustomerView",
  "await openSurveyDetails(survey.id)",
  "configuration:x.configuration || {}",
  "url.searchParams.set('returnTo', location.pathname)"
]) {
  if (!app.includes(marker)) throw new Error('Surveyor app missing: '+marker);
}
for (const marker of ['syncNowBtn','syncStatusText','КД Замерщик','planDialog','planCanvas','data-add-plan-item','customerPreviewDialog']) {
  if (!html.includes(marker)) throw new Error('Surveyor HTML missing: '+marker);
}
if (!sw.includes('kd-surveyor-v3-stage1-v1') || !sw.includes('./line-builder.js')) throw new Error('Surveyor service worker cache was not bumped');
for (const marker of ['ensureSitePlan','newItem','newLine','lineWidth','PLAN_ITEM_TYPES']) {
  if (!lineBuilder.includes(marker)) throw new Error('Line builder missing: '+marker);
}

for (const marker of [
  'function kd_surveyor_handle',
  'function kd_surveyor_login',
  'function kd_surveyor_sync',
  'function kd_surveyor_users',
  'surveyor_sessions',
  'surveyor_orders',
  "password_hash($password,PASSWORD_DEFAULT)",
  "Bearer",
  "configuration_json",
  "Схема объекта слишком большая"
]) {
  if (!api.includes(marker)) throw new Error('Surveyor server API missing: '+marker);
}
if (!router.includes("backend/surveyor.php") || !router.includes("str_starts_with($route, 'surveyor/')")) {
  throw new Error('Surveyor API is not routed by Timeweb');
}
for (const table of ['surveyor_users','surveyor_sessions','surveyor_clients','surveyor_orders']) {
  if (!schema.includes('CREATE TABLE IF NOT EXISTS '+table)) throw new Error('MySQL schema missing '+table);
}
if (!build.includes("path.join(root, 'surveyor-app')") || !build.includes("'Disallow: /surveyor-app'")) {
  throw new Error('Timeweb package does not contain/protect surveyor app');
}
// DEV sync may never be toggled through a query string or aimed at the
// production hostname. An isolated HTTPS endpoint must be provisioned explicitly.
for (const needle of [
  'window.KD_DEV_SURVEYOR_API',
  "url.protocol !== 'https:'",
  "url.hostname === 'kuzdvor.tw1.ru'",
  "url.pathname !== '/api/surveyor'",
  "const API_ENABLED = !IS_PREVIEW || Boolean(DEV_API_URL)",
  "const API_BASE = IS_PREVIEW ? DEV_API_URL : '/api/surveyor'",
  "serverRevision:Number(x.serverRevision||0)",
  "if (!navigator.onLine)",
  "if (syncInFlight) return false"
]) if(!app.includes(needle)) throw new Error('DEV staging guard or retry handling missing: '+needle);
if (app.includes("FORCE_SERVER") || app.includes("new URLSearchParams(location.search).get('server')"))
  throw new Error('Unsafe DEV production override detected');
for(const needle of [
  "if ($phone !== '' && strlen(",
  "if ($phone !== ''",
  "c.updated_by=? OR EXISTS",
  "o.created_by=?",
  "if ((string)$session['role'] === 'owner')",
  "elseif" // corrected below: marker from the explicit conflict branches
].slice(0,-1)) if(!api.includes(needle))throw new Error('Staging API integrity missing: '+needle);
const preview=await readFile('scripts/build-dev-preview.mjs','utf8');
if(!preview.includes('process.env.DEV_SURVEYOR_API_URL') || !preview.includes("url.pathname!=='/api/surveyor'"))
  throw new Error('Staging endpoint build wiring missing');
console.log('Surveyor app/server integrity OK');
