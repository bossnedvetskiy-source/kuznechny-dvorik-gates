import {readFile} from 'node:fs/promises';

const app = await readFile('surveyor-app/app.js','utf8');
const html = await readFile('surveyor-app/index.html','utf8');
const sw = await readFile('surveyor-app/sw.js','utf8');
const lineBuilder = await readFile('surveyor-app/line-builder.js','utf8');
const threeD = await readFile('surveyor-app/3d-calculator.js','utf8');
const gateFrame=await readFile('surveyor-app/3d-gate-frame.js','utf8');
const gateRender=await readFile('surveyor-app/3d-gate-render.js','utf8');
const slidingFrame=await readFile('surveyor-app/3d-sliding-frame.js','utf8');
const slidingRender=await readFile('surveyor-app/3d-sliding-render.js','utf8');
const layout = await readFile('surveyor-app/3d-layout.js','utf8');
const threeDCss = await readFile('surveyor-app/3d-calculator.css','utf8');
const mobileCardsCss = await readFile('surveyor-app/3d-mobile-ui.css','utf8');
if (!html.includes('3d-mobile-ui.css?v=card-v3-20261017') ||
    !sw.includes('./3d-mobile-ui.css?v=card-v3-20261017') ||
    !mobileCardsCss.includes('.kd3d-swing-position') ||
    !mobileCardsCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'))
  throw new Error('Side-local mobile CSS missing, unversioned or absent from offline cache');

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
for (const marker of ['syncNowBtn','syncStatusText','КД Замерщик','planDialog','planCanvas','data-add-plan-item','customerPreviewDialog','open3DCalcBtn','threeDScreen','kd3dRoot','3d-calculator.css']) {
  if (!html.includes(marker)) throw new Error('Surveyor HTML missing: '+marker);
}
if (!/const CACHE = 'kd-surveyor-v3-[^']+'/.test(sw) || !sw.includes('./line-builder.js') || !sw.includes('./sliding-gates/index.html') || !sw.includes('./3d-calculator.js')) throw new Error('Surveyor service worker cache missing 3D/sliding calculator');
for (const marker of ['function open3DCalculator','import(\'./3d-calculator.js\')','threeD: \'3D расчёт\'']) if (!app.includes(marker)) throw new Error('3D route missing: '+marker);
for (const marker of ['OrbitControls','WebGLRenderer','mount3DCalculator','updateModel','fit()','render','DRAFT_KEY']) if (!threeD.includes(marker)) throw new Error('3D module missing: '+marker);
if (!threeDCss.includes('.kd3d-viewport') || !threeDCss.includes('.kd3d-launch')) throw new Error('3D styles missing');
const stylesheetVersion=html.match(/3d-calculator\.css\?v=([^"']+)/)?.[1];
if (!threeD.includes('data-preset=') || !threeD.includes('data-section="sizes"') ||
  !stylesheetVersion || !sw.includes('./3d-calculator.css?v='+stylesheetVersion))
  throw new Error('Reference style editor or current stylesheet missing');
if (!threeD.includes('drawDimensionGuides') || !threeD.includes('baselineZ=(id===') || !threeD.includes('data-show-dimensions') || !layout.includes('function getClearDimensionPlan') || !threeDCss.includes('kd3d-dim-switch')) throw new Error('Optional ground-offset clear dimension guides missing');
if (!sw.includes('./3d-drawing.js') || !threeD.includes("from './3d-drawing.js'") ||
  !threeD.includes('data-side-edit-slot') || !threeD.includes('data-drawing-kind') ||
  !layout.includes('FRAME_PROFILES')) throw new Error('Inline side editor, per-product options or SVG drawing missing');
if (!sw.includes('./3d-layout.js') || !layout.includes('function getSiteLayout') || !threeD.includes("from './3d-layout.js'"))
  throw new Error('Multi-side 3D geometry module missing from PWA');
if (!gateFrame.includes('function getGateFramePlan') || !gateRender.includes('function renderGateFrame') ||
  !gateRender.includes('kdHinge') || !threeD.includes('sceneHinges') ||
  !sw.includes('./3d-gate-frame.js') || !sw.includes('./3d-gate-render.js'))
  throw new Error('Actual welded swing frame, 3D hinges, or offline gate assets missing');
if (!threeD.includes('data-builtin-enabled') || !threeD.includes('data-builtin-side') ||
  !threeD.includes('sceneEmbeddedWickets') || !gateFrame.includes('embeddedRequested') ||
  !gateRender.includes('kdEmbeddedThreshold') || !threeDCss.includes('kd3d-built-in'))
  throw new Error('Built-in wicket gate option, threshold or renderer missing');
if (!threeD.includes('data-opening-side=') || !threeD.includes('data-wicket-enabled') ||
  !threeD.includes('sceneWicketLeaves') || !layout.includes('function normalizeOpenings') ||
  !layout.includes('function normalizeWicket') || !threeDCss.includes('kd3d-opening-actions'))
  throw new Error('Four-side gate/wicket toggles or actual 3D wicket rendering missing');
if (!threeD.includes('data-gate-enabled') || !threeD.includes('sceneGateLeaves') || !layout.includes('function normalizeSwingGate') || !threeDCss.includes('kd3d-gate-editor')) throw new Error('Swing gate 3D opening or render controls missing');
if (!threeD.includes('data-gate-mode="sliding"') || !threeD.includes('data-gate-tail-shape') ||
  !threeD.includes('data-gate-slide-direction') || !threeD.includes('sceneSlidingLeaves') ||
  !sw.includes('./3d-sliding-frame.js') || !sw.includes('./3d-sliding-render.js'))
  throw new Error('DEV sliding gate selector, 3D render, or offline assets missing');
if (!threeD.includes('data-tap-editor') ||
  !threeD.includes('hitRaycaster.intersectObjects(hitTargets,false)') ||
  !threeD.includes('data-tap-detail') ||
  !threeD.includes('pointerStart.cancelled') ||
  !threeDCss.includes('.kd3d-tap-editor'))
  throw new Error('DEV tap-to-edit or gesture protection missing');

if (!threeD.includes('data-gate-slide-position="open"') ||
  !threeD.includes('data-scene-slide-position="open"') ||
  !threeD.includes('data-gate-show-slide-zone') ||
  !threeD.includes('sceneSlidingZones') ||
  !slidingFrame.includes('function getSlidingTravelPlan') ||
  !slidingRender.includes('kdSlidingMoving') ||
  !slidingRender.includes('kdSlidingParkingZone') ||
  !threeDCss.includes('kd3d-slide-legend'))
  throw new Error('Sliding gate live 3D movement, full parking zones or mobile controls missing');
if (!threeD.includes('data-obstacle-add') || !threeD.includes('data-gate-track-offset') ||
  !threeD.includes('sceneSlidingCarriages') ||
  !slidingFrame.includes('getSlidingTravelPlan') ||
  !sw.includes('./3d-sliding-installation.js') ||
  !sw.includes('./3d-sliding-hardware.js'))
  throw new Error('DEV sliding roller/obstacle hardware or offline assets missing');
if (!threeD.includes('data-auto-gap') || !layout.includes('function verticalPicketPlan') || !threeDCss.includes('kd3d-gap-alert')) throw new Error('Whole-width steel picket gap warning and quick adjust missing');
if (!threeD.includes('data-post-mode="behind"') || !threeD.includes('verticalPicketPlan') || !layout.includes('const normalizePostMode=')) throw new Error('Post mode or no-gap picket calculation missing');
if (!threeD.includes('data-side-toggle') || !threeD.includes("function syncSideButtons"))
  throw new Error('Four-side editor UI is missing');
if (!threeD.includes('data-side-length-input') || !threeD.includes('data-field="height"')) throw new Error('Individual side dimensions must remain editable');
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
