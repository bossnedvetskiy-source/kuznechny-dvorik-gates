import { cp, mkdir, readFile, readdir, rm, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'timeweb-dist');
const SURVEYOR_SOURCE = path.join(ROOT, 'surveyor-app');
const SURVEYOR_TEST_DIR = 'surveyor-test';
const SURVEYOR_TEST_OUT = path.join(ROOT, '_site', SURVEYOR_TEST_DIR);
const SURVEYOR_V2_DIR = 'zamer-app-v2';
const SURVEYOR_V2_OUT = path.join(ROOT, '_site', SURVEYOR_V2_DIR);
const OUT = path.join(ROOT, '_site');
const BASE = '/kuznechny-dvorik-gates';
const ACCESS_FILE = path.join(ROOT, 'dev-access.js');
const LIVE_CATALOG = '/tmp/kuzdvor-live-catalog.json';
const LIVE_FENCE_PRICES = '/tmp/kuzdvor-live-fence-prices.json';
const DEV_ICON_NAME = 'dev-site-icon.svg';
const DEV_TOOLS_DIR = 'dev-tools';
const DEV_TOOLS_OUT = path.join(ROOT, '_site', DEV_TOOLS_DIR);

const DEV_APP_START = `${BASE}/${DEV_TOOLS_DIR}/`;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPngIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [21, 21, 21, 255];
  const gold = [231, 195, 111, 255];
  const edge = [199, 150, 53, 255];
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = color[3];
  };
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) set(x, y, bg);
  const s = size / 512;
  const rect = (x1,y1,x2,y2,color) => {
    for (let y=Math.floor(y1*s); y<Math.ceil(y2*s); y+=1)
      for (let x=Math.floor(x1*s); x<Math.ceil(x2*s); x+=1) set(x,y,color);
  };
  // Gold frame.
  rect(54,54,458,66,edge); rect(54,446,458,458,edge);
  rect(54,54,66,458,edge); rect(446,54,458,458,edge);
  // K.
  rect(145,135,178,377,gold);
  for (let t=0;t<26;t+=1) {
    for (let n=0;n<118;n+=1) {
      const x=178+n; const y=256-n+t-13; set(Math.round(x*s),Math.round(y*s),gold);
      const y2=256+n+t-13; set(Math.round(x*s),Math.round(y2*s),gold);
    }
  }
  // D.
  rect(294,138,327,377,gold);
  rect(327,138,355,171,gold); rect(327,344,355,377,gold);
  for (let y=171;y<344;y+=1) {
    const yy=(y-257)/86;
    const x=355+Math.round(64*Math.sqrt(Math.max(0,1-yy*yy)));
    rect(x-16,y,x+16,y+1,gold);
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y=0;y<size;y+=1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    px.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, {level:9})),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}


await rm(OUT, {recursive:true, force:true});
await cp(SOURCE, OUT, {recursive:true});
await cp(SURVEYOR_SOURCE, path.join(OUT, 'surveyor-app'), {recursive:true});

for (const target of [
  '.htaccess',
  'local-api.php',
  'deploy-timeweb.sh',
  'health-check.sh',
  'install-autodeploy.sh',
  'deployment-health-status.txt',
  'manager.html',
  'manager-sw.js',
  'manager-manifest.webmanifest',
  'manager-icon.svg'
]) {
  await rm(path.join(OUT, target), {recursive:true, force:true});
}
await rm(path.join(OUT, 'backend'), {recursive:true, force:true});

// GitHub Pages preview is frontend-only. Keep read-only catalog data as a static
// endpoint so the dev site starts with the same published photos as production.
let catalogJson = '';
try {
  catalogJson = await readFile(LIVE_CATALOG, 'utf8');
  JSON.parse(catalogJson);
} catch {
  const source = await readFile(path.join(ROOT, 'catalog-images.js'), 'utf8');
  const match = source.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
  if (!match) throw new Error('Could not create dev catalog snapshot');
  catalogJson = JSON.stringify({galleries:JSON.parse(match[1])});
}
catalogJson = catalogJson
  .replaceAll('"/catalog/', `"${BASE}/catalog/`)
  .replaceAll('"/catalog-media/', '"https://kuzdvor.tw1.ru/catalog-media/');
await mkdir(path.join(OUT, 'api'), {recursive:true});
await writeFile(path.join(OUT, 'api', 'catalog-images'), catalogJson, 'utf8');

// DEV uses the current production fence rates, but remains read-only and isolated.
let fencePricesJson = '';
try {
  fencePricesJson = await readFile(LIVE_FENCE_PRICES, 'utf8');
  const parsed = JSON.parse(fencePricesJson);
  if (!parsed?.fence || typeof parsed.fence !== 'object') throw new Error('invalid live fence rates');
} catch {
  const defaults = JSON.parse(await readFile(path.join(SOURCE, 'backend/defaults.json'), 'utf8'));
  fencePricesJson = JSON.stringify({fence:defaults?.prices?.fence || {}});
}
await writeFile(path.join(OUT, 'api', 'fence-prices'), fencePricesJson, 'utf8');

// GitHub Pages cannot execute the Timeweb PHP endpoint. Publish the same
// lightweight version contract as a static file so the DEV PWA can detect
// every new dev deployment and refresh its offline snapshot.
const devSourceVersion = String(process.env.GITHUB_SHA || process.env.KUZDVOR_DEV_SOURCE_SHA || 'dev-local').trim();
await writeFile(
  path.join(OUT, 'api', 'offline-version'),
  JSON.stringify({
    version:'dev-'+devSourceVersion,
    source:devSourceVersion,
    settingsUpdatedAt:'',
    catalogUpdatedAt:''
  }),
  'utf8'
);

const access = await readFile(ACCESS_FILE, 'utf8');
const hideStyle = '<style id="kuzdvor-dev-hide">html{background:#0c0d0f}body>*{visibility:hidden!important}#kuzdvor-dev-gate,#kuzdvor-dev-gate *{visibility:visible!important}</style>';
const robotsMeta = '<meta name="robots" content="noindex,nofollow,noarchive">';
const devBadgeMeta = '<meta name="kuzdvor-environment" content="development">';

function rewriteRootStrings(text) {
  return text.replace(/(['"`])\/(?!\/)/g, `$1${BASE}/`);
}

async function walk(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }

    if (entry.name.endsWith('.html')) {
      let html = await readFile(full, 'utf8');
      html = rewriteRootStrings(html);
      html = html
        .replace(/<link\s+rel=["']canonical["'][^>]*>/ig, '')
        .replace(/<meta\s+name=["']robots["'][^>]*>/ig, '')
        .replace(/<\/head>/i, `${robotsMeta}\n${devBadgeMeta}\n${hideStyle}\n</head>`)
        .replace(/<\/body>/i, `<script>${access}</script>\n</body>`);
      await writeFile(full, html, 'utf8');
      continue;
    }

    if (entry.name.endsWith('.js') || entry.name.endsWith('.webmanifest')) {
      let text = await readFile(full, 'utf8');
      text = rewriteRootStrings(text);
      await writeFile(full, text, 'utf8');
      continue;
    }

    if (entry.name.endsWith('.css')) {
      let text = await readFile(full, 'utf8');
      text = text.replace(/url\(\/(?!\/)/g, `url(${BASE}/`);
      await writeFile(full, text, 'utf8');
    }
  }
}
await walk(OUT);

// Build an un-gated standalone test PWA *after* the protected DEV tree is
// rewritten. This keeps the test app installable on a phone without sending
// every launch through the DEV access gate.
await rm(SURVEYOR_TEST_OUT, {recursive:true, force:true});
await cp(SURVEYOR_SOURCE, SURVEYOR_TEST_OUT, {recursive:true});

const surveyorTestManifestPath = path.join(SURVEYOR_TEST_OUT, 'manifest.webmanifest');
const surveyorTestManifest = JSON.parse(await readFile(surveyorTestManifestPath, 'utf8'));
Object.assign(surveyorTestManifest, {
  name:'КД Замерщик Тест',
  short_name:'КД Замер Тест',
  id:`${BASE}/${SURVEYOR_TEST_DIR}`,
  start_url:`${BASE}/${SURVEYOR_TEST_DIR}/`,
  scope:`${BASE}/${SURVEYOR_TEST_DIR}/`,
  description:'Тестовая PWA КД Замерщик. Обновляется автоматически из DEV.',
  background_color:'#f4f4f2',
  theme_color:'#151515'
});
await writeFile(surveyorTestManifestPath, JSON.stringify(surveyorTestManifest, null, 2)+'\n', 'utf8');

const surveyorTestIndexPath = path.join(SURVEYOR_TEST_OUT, 'index.html');
const surveyorTestAssetVersion = encodeURIComponent(devSourceVersion);
let surveyorTestIndex = await readFile(surveyorTestIndexPath, 'utf8');
surveyorTestIndex = surveyorTestIndex
  .replace('<title>КД Замерщик</title>', '<title>КД Замерщик Тест</title>')
  .replace('<h1>КД Замерщик</h1>', '<h1>КД Замерщик Тест</h1>')
  .replace('<div class="eyebrow">КД Замерщик</div>', '<div class="eyebrow">КД Замерщик · Тест</div>')
  .replace('href="./styles.css"', `href="./styles.css?v=${surveyorTestAssetVersion}"`)
  .replace('src="./app.js"', `src="./app.js?v=${surveyorTestAssetVersion}"`)
  .replace('href="./manifest.webmanifest"', `href="./manifest.webmanifest?v=${surveyorTestAssetVersion}"`);
await writeFile(surveyorTestIndexPath, surveyorTestIndex, 'utf8');

const surveyorTestAppPath = path.join(SURVEYOR_TEST_OUT, 'app.js');
let surveyorTestApp = await readFile(surveyorTestAppPath, 'utf8');
surveyorTestApp = surveyorTestApp.replace(
  "from './line-builder.js';",
  `from './line-builder.js?v=${surveyorTestAssetVersion}';`
);
await writeFile(surveyorTestAppPath, surveyorTestApp, 'utf8');

const surveyorTestSwPath = path.join(SURVEYOR_TEST_OUT, 'sw.js');
let surveyorTestSw = await readFile(surveyorTestSwPath, 'utf8');
surveyorTestSw = surveyorTestSw
  .replace(/const CACHE = '[^']+';/, `const CACHE = 'kdz-test-pwa-${devSourceVersion}';`)
  .replace("keys.filter(k => k.startsWith('kd-surveyor-') && k !== CACHE)", "keys.filter(k => k.startsWith('kdz-test-pwa-') && k !== CACHE)")
  .replace(
    "if (event.request.method !== 'GET') return;\n  event.respondWith((async () => {\n    const cached = await caches.match(event.request);\n    if (cached) return cached;",
    "if (event.request.method !== 'GET') return;\n  event.respondWith((async () => {\n    if(event.request.mode==='navigate'){try{const fresh=await fetch(event.request,{cache:'no-store'});if(fresh&&fresh.ok)return fresh;}catch{}}\n    const cached = await caches.match(event.request);\n    if (cached) return cached;"
  );
await writeFile(surveyorTestSwPath, surveyorTestSw, 'utf8');

// Build a completely fresh V2 surveyor PWA on a new path.
await rm(SURVEYOR_V2_OUT, {recursive:true, force:true});
await cp(SURVEYOR_SOURCE, SURVEYOR_V2_OUT, {recursive:true});

const surveyorV2ManifestPath = path.join(SURVEYOR_V2_OUT, 'manifest.webmanifest');
const surveyorV2Manifest = JSON.parse(await readFile(surveyorV2ManifestPath, 'utf8'));
Object.assign(surveyorV2Manifest, {
  name:'КД Замерщик V2',
  short_name:'КД Замер V2',
  id:`${BASE}/${SURVEYOR_V2_DIR}`,
  start_url:`${BASE}/${SURVEYOR_V2_DIR}/`,
  scope:`${BASE}/${SURVEYOR_V2_DIR}/`,
  description:'Чистая тестовая PWA КД Замерщик V2.',
  background_color:'#f4f4f2',
  theme_color:'#151515',
  display:'standalone',
  prefer_related_applications:false,
  icons:[
    {src:'icon-192.png', sizes:'192x192', type:'image/png', purpose:'any'},
    {src:'icon-512.png', sizes:'512x512', type:'image/png', purpose:'any maskable'},
    {src:'icon.svg', sizes:'any', type:'image/svg+xml', purpose:'any'}
  ]
});
await writeFile(surveyorV2ManifestPath, JSON.stringify(surveyorV2Manifest, null, 2)+'\n', 'utf8');
await writeFile(path.join(SURVEYOR_V2_OUT, 'icon-192.png'), buildPngIcon(192));
await writeFile(path.join(SURVEYOR_V2_OUT, 'icon-512.png'), buildPngIcon(512));

const surveyorV2AssetVersion = encodeURIComponent(devSourceVersion);
const surveyorV2IndexPath = path.join(SURVEYOR_V2_OUT, 'index.html');
let surveyorV2Index = await readFile(surveyorV2IndexPath, 'utf8');
surveyorV2Index = surveyorV2Index
  .replace('<title>КД Замерщик</title>', '<title>КД Замерщик V2</title>')
  .replace('<h1>КД Замерщик</h1>', '<h1>КД Замерщик V2</h1>')
  .replace('<div class="eyebrow">КД Замерщик</div>', '<div class="eyebrow">КД Замерщик · V2</div>')
  .replace('href="./styles.css"', `href="./styles.css?v=${surveyorV2AssetVersion}"`)
  .replace('src="./app.js"', `src="./app.js?v=${surveyorV2AssetVersion}"`)
  .replace('href="./manifest.webmanifest"', `href="./manifest.webmanifest?v=${surveyorV2AssetVersion}"`);
await writeFile(surveyorV2IndexPath, surveyorV2Index, 'utf8');

const surveyorV2AppPath = path.join(SURVEYOR_V2_OUT, 'app.js');
let surveyorV2App = await readFile(surveyorV2AppPath, 'utf8');
surveyorV2App = surveyorV2App.replace(
  "from './line-builder.js';",
  `from './line-builder.js?v=${surveyorV2AssetVersion}';`
);
await writeFile(surveyorV2AppPath, surveyorV2App, 'utf8');

const surveyorV2SwPath = path.join(SURVEYOR_V2_OUT, 'sw.js');
let surveyorV2Sw = await readFile(surveyorV2SwPath, 'utf8');
surveyorV2Sw = surveyorV2Sw
  .replace(/const CACHE = '[^']+';/, `const CACHE = 'kdz-v2-${devSourceVersion}';`)
  .replace("keys.filter(k => k.startsWith('kd-surveyor-') && k !== CACHE)", "keys.filter(k => k.startsWith('kdz-v2-') && k !== CACHE)")
  .replace(
    "if (event.request.method !== 'GET') return;\n  event.respondWith((async () => {\n    const cached = await caches.match(event.request);\n    if (cached) return cached;",
    "if (event.request.method !== 'GET') return;\n  event.respondWith((async () => {\n    if(event.request.mode==='navigate'){try{const fresh=await fetch(event.request,{cache:'no-store'});if(fresh&&fresh.ok)return fresh;}catch{}}\n    const cached = await caches.match(event.request);\n    if (cached) return cached;"
  );
await writeFile(surveyorV2SwPath, surveyorV2Sw, 'utf8');

// Give the GitHub Pages DEV build its own PWA identity. Production keeps the
// normal site manifest, icon, service worker cache names and IndexedDB.
const devIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="108" fill="#111318"/>
  <rect x="34" y="34" width="444" height="444" rx="82" fill="none" stroke="#e6bd69" stroke-width="18"/>
  <path d="M86 150h340v208H86z" fill="none" stroke="#c9953b" stroke-width="14"/>
  <path d="M256 150v208M86 218h340M86 292h340" stroke="#8d6a2d" stroke-width="12"/>
  <rect x="92" y="344" width="328" height="94" rx="30" fill="#e6bd69"/>
  <text x="256" y="410" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="70" font-weight="900" fill="#15120c">DEV</text>
</svg>
`;
await writeFile(path.join(OUT, DEV_ICON_NAME), devIcon, 'utf8');

const manifestPath = path.join(OUT, 'site-manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
Object.assign(manifest, {
  name:'КД Замерщик DEV',
  short_name:'КД Замерщик',
  id:`${BASE}/kd-work-v1`,
  start_url:DEV_APP_START,
  scope:`${BASE}/`,
  description:'Внутреннее DEV-приложение замерщика: замеры, ворота, заборы и навесы.',
  background_color:'#111318',
  theme_color:'#111318',
  icons:[{
    src:`${BASE}/${DEV_ICON_NAME}`,
    sizes:'any',
    type:'image/svg+xml',
    purpose:'any maskable'
  }]
});
await writeFile(manifestPath, JSON.stringify(manifest, null, 2)+'\n', 'utf8');

// iOS/shortcut icon and static DEV menu routes must also be independent from
// production. GitHub Pages has no .htaccess rewrites for /app, /links or /admin.
async function patchDevHtml(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await patchDevHtml(full);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;
    let html = await readFile(full, 'utf8');
    html = html.replaceAll(`${BASE}/site-icon.svg`, `${BASE}/${DEV_ICON_NAME}`);
    if (entry.name === 'work-app.html') {
      html = html
        .replaceAll(`href="${BASE}/links"`, `href="${BASE}/link-app.html"`)
        .replaceAll(`href="${BASE}/admin"`, `href="${BASE}/admin.html"`);

      const linksMarker = `      <a class="tile" href="${BASE}/link-app.html">`;
      const euroTile = `      <a class="tile" href="${BASE}/evroshtaketnik/">
        <span class="tile-icon">▥</span>
        <span class="tile-copy"><b>Расчёт евроштакетника</b><span>Вертикальный и горизонтальный забор, материалы, столбы, пролёты и стоимость. Работает без сети.</span></span>
        <span class="arrow">›</span>
      </a>
`;
      if (!html.includes('Расчёт евроштакетника')) {
        if (!html.includes(linksMarker)) throw new Error('DEV work app links tile marker was not found');
        html = html.replace(linksMarker, euroTile + linksMarker);
      }

      const navesTile = `      <a class="tile" href="${BASE}/naves/">
        <span class="tile-icon">⌁</span>
        <span class="tile-copy"><b>Расчёт навеса</b><span>Размеры, конструкция, 3D и стоимость. Для замера результат добавляется прямо в карточку.</span></span>
        <span class="arrow">›</span>
      </a>
`;
      if (!html.includes('Расчёт навеса')) {
        if (!html.includes(linksMarker)) throw new Error('DEV work app links tile marker was not found for canopy generator');
        html = html.replace(linksMarker, navesTile + linksMarker);
      }

      const adminTile = `      <a class="tile" href="${BASE}/admin.html">
        <span class="tile-icon">📥</span>
        <span class="tile-copy"><b>Заявки и админка</b><span>Новые заявки, фотографии, цены и каталог. Для этого раздела нужен интернет.</span></span>
        <span class="arrow">›</span>
      </a>
`;
      html = html.replace(adminTile, '');
    }
    await writeFile(full, html, 'utf8');
  }
}
await patchDevHtml(OUT);

// DEV-only bridge: existing calculators stay unchanged, but when opened from a
// survey they can return their exact current snapshot back into that survey.
await cp(path.join(SURVEYOR_SOURCE, 'calculator-bridge.js'), path.join(OUT, 'surveyor-bridge.js'));
for (const relative of ['index.html','evroshtaketnik/index.html','naves/index.html']) {
  const full = path.join(OUT, relative);
  let html = await readFile(full, 'utf8');
  if (!html.includes(`${BASE}/surveyor-bridge.js`)) {
    if (!html.includes('</body>')) throw new Error(`DEV calculator page has no body: ${relative}`);
    html = html.replace('</body>', `<script src="${BASE}/surveyor-bridge.js"></script>\n</body>`);
    await writeFile(full, html, 'utf8');
  }
}

// Build one internal DEV work app. The surveyor shell is the start screen,
// while the existing DEV calculators remain under the same broad PWA scope.
await rm(DEV_TOOLS_OUT, {recursive:true, force:true});
await cp(SURVEYOR_SOURCE, DEV_TOOLS_OUT, {recursive:true});

const devToolsIndexPath = path.join(DEV_TOOLS_OUT, 'index.html');
let devToolsIndex = await readFile(devToolsIndexPath, 'utf8');
devToolsIndex = devToolsIndex
  .replace('<title>КД Замерщик</title>', '<title>КД Замерщик DEV</title>')
  .replace('<h1>КД Замерщик</h1>', '<h1>КД Замерщик DEV</h1>')
  .replace('<div class="eyebrow">КД Замерщик</div>', '<div class="eyebrow">КД Замерщик · DEV</div>');
await writeFile(devToolsIndexPath, devToolsIndex, 'utf8');

await writeFile(path.join(DEV_TOOLS_OUT,'manifest.webmanifest'),JSON.stringify({
  name:'КД Замерщик DEV',
  short_name:'КД Замерщик',
  id:`${BASE}/kd-work-v1`,
  start_url:`${BASE}/${DEV_TOOLS_DIR}/`,
  scope:`${BASE}/`,
  display:'standalone',
  background_color:'#111318',
  theme_color:'#111318',
  icons:[{src:`${BASE}/${DEV_ICON_NAME}`,sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]
},null,2)+'\n','utf8');

// The public bundle adds a floating app menu when launched in standalone mode.
// Point it to the actual static DEV menu instead of the Timeweb-only /app route.
const siteBundlePath = path.join(OUT, 'site.bundle.js');
let siteBundle = await readFile(siteBundlePath, 'utf8');
const devMenuSource = `appMenuButton.href='${BASE}/app';`;
const devMenuTarget = `appMenuButton.href='${DEV_APP_START}';`;
if (!siteBundle.includes(devMenuSource)) throw new Error('DEV app menu link was not found in site bundle');
siteBundle = siteBundle
  .replace(devMenuSource, devMenuTarget)
  .replaceAll('kuzdvor-catalog-controller-reload-', 'kuzdvor-dev-catalog-controller-reload-');
await writeFile(siteBundlePath, siteBundle, 'utf8');

// Keep DEV storage completely separate even if the two builds are later served
// from the same browser profile. This also makes cache diagnostics unambiguous.
const swPath = path.join(OUT, 'site-sw.js');
let devSw = await readFile(swPath, 'utf8');
devSw = devSw
  .replaceAll('kuzdvor-offline-', 'kuzdvor-dev-offline-')
  .replaceAll('__kuzdvor_offline_meta__', '__kuzdvor_dev_offline_meta__')
  .replaceAll(`${BASE}/site-icon.svg`, `${BASE}/${DEV_ICON_NAME}`);
const surveyorTestFetchNeedle = "self.addEventListener('fetch',event=>{\n  const request=event.request;\n  const url=new URL(request.url);";
const surveyorTestFetchReplacement = surveyorTestFetchNeedle + "\n  // standalone surveyor PWA bypass\n  if(url.pathname==='${BASE}/${SURVEYOR_TEST_DIR}'||url.pathname.startsWith('${BASE}/${SURVEYOR_TEST_DIR}/')||url.pathname==='${BASE}/${SURVEYOR_V2_DIR}'||url.pathname.startsWith('${BASE}/${SURVEYOR_V2_DIR}/'))return;";
if (!devSw.includes(surveyorTestFetchNeedle)) throw new Error('DEV service worker fetch handler not found');
devSw = devSw.replace(surveyorTestFetchNeedle, surveyorTestFetchReplacement);
await writeFile(swPath, devSw, 'utf8');

// A Pages project site lives under /kuznechny-dvorik-gates/.
await writeFile(path.join(OUT, '.nojekyll'), '', 'utf8');
await writeFile(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');

// The production sitemap must never be exposed by the private preview.
await rm(path.join(OUT, 'sitemap.xml'), {force:true});

const index = await readFile(path.join(OUT, 'index.html'), 'utf8');
for (const required of [
  'noindex,nofollow,noarchive',
  'kuzdvor-dev-gate',
  `${BASE}/site.css`,
  `${BASE}/site.bundle.js`,
  'window.SITE_SETTINGS',
  'КУЗНЕЧНЫЙ ДВОРИКЪ',
  `${BASE}/${DEV_ICON_NAME}`
]) {
  if (!index.includes(required)) throw new Error(`Dev preview missing: ${required}`);
}
if (index.includes('<script src="app.js"')) throw new Error('Dev preview is using raw source scripts instead of the production bundle');

const builtManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (
  builtManifest.name !== 'КД Замерщик DEV' ||
  builtManifest.short_name !== 'КД Замерщик' ||
  builtManifest.id !== `${BASE}/kd-work-v1` ||
  builtManifest.start_url !== DEV_APP_START ||
  builtManifest.scope !== `${BASE}/` ||
  builtManifest.icons?.[0]?.src !== `${BASE}/${DEV_ICON_NAME}`
) {
  throw new Error('DEV PWA manifest is not isolated from production');
}

const builtSw = await readFile(swPath, 'utf8');
for (const required of ['kuzdvor-dev-offline-', '__kuzdvor_dev_offline_meta__', `${BASE}/${DEV_ICON_NAME}`]) {
  if (!builtSw.includes(required)) throw new Error(`DEV service worker isolation missing: ${required}`);
}
if (builtSw.includes("const VERSION='kuzdvor-offline-")) throw new Error('DEV service worker still uses production cache namespace');

const builtWorkApp = await readFile(path.join(OUT, 'work-app.html'), 'utf8');
for (const required of [
  `${BASE}/site-manifest.webmanifest`,
  `${BASE}/${DEV_ICON_NAME}`,
  `href="${BASE}/link-app.html"`,
  `href="${BASE}/evroshtaketnik/"`,
  'Расчёт евроштакетника',
  `href="${BASE}/naves/"`,
  'Расчёт навеса'
]) {
  if (!builtWorkApp.includes(required)) throw new Error(`DEV work app missing: ${required}`);
}
if (builtWorkApp.includes('Заявки и админка') || builtWorkApp.includes('Навесы — админ DEV')) {
  throw new Error('DEV work app still exposes legacy admin tiles');
}
if (!siteBundle.includes(devMenuTarget)) throw new Error('DEV standalone menu does not point to the static work app');

const devCatalogText = await readFile(path.join(OUT, 'api', 'catalog-images'), 'utf8');
if (devCatalogText.includes('"/catalog/')) throw new Error('DEV catalog still contains root-relative photo URLs');
if (!devCatalogText.includes(`"${BASE}/catalog/`) && !devCatalogText.includes('"https://kuzdvor.tw1.ru/catalog-media/')) {
  throw new Error('DEV catalog does not contain usable photo URLs');
}
const fencePrices = JSON.parse(await readFile(path.join(OUT, 'api', 'fence-prices'), 'utf8'));
if (!fencePrices?.fence || typeof fencePrices.fence !== 'object') throw new Error('Dev preview fence prices are missing');

for (const relative of ['index.html','evroshtaketnik/index.html','naves/index.html']) {
  const html = await readFile(path.join(OUT, relative), 'utf8');
  if (!html.includes(`${BASE}/surveyor-bridge.js`)) throw new Error(`DEV surveyor bridge missing: ${relative}`);
}
if (!(await readFile(path.join(OUT,'surveyor-bridge.js'),'utf8')).includes('kd-surveyor-transfer-v1')) {
  throw new Error('DEV surveyor bridge payload contract missing');
}

const navesIndex = await readFile(path.join(OUT, 'naves', 'index.html'), 'utf8');
for (const required of ['./naves.css','./geometry.js','./pricing.js','./canopy-three.js','./naves.js','canopyViewport','reset3dView','totalPrice','saveCalculation']) {
  if (!navesIndex.includes(required)) throw new Error(`DEV canopy generator missing: ${required}`);
}
const navesAdminIndex = await readFile(path.join(OUT, 'naves', 'admin.html'), 'utf8');
for (const required of ['admin-canopy.js','admin-tabs','editor-shell']) {
  if (!navesAdminIndex.includes(required)) throw new Error(`DEV canopy admin missing: ${required}`);
}

for (const required of ['index.html','styles.css','app.js','manifest.webmanifest','sw.js','icon.svg']) {
  try { await readFile(path.join(OUT, 'surveyor-app', required)); }
  catch { throw new Error(`DEV surveyor app missing: ${required}`); }
}
const surveyorIndex = await readFile(path.join(OUT, 'surveyor-app', 'index.html'), 'utf8');
for (const required of ['КД Замерщик','noindex,nofollow,noarchive','kuzdvor-dev-gate']) {
  if (!surveyorIndex.includes(required)) throw new Error(`DEV surveyor preview missing: ${required}`);
}

// Ungated surveyor test PWA must remain independent from the protected preview.
const surveyorTestIndexBuilt = await readFile(path.join(SURVEYOR_TEST_OUT, 'index.html'), 'utf8');
if (surveyorTestIndexBuilt.includes('kuzdvor-dev-gate')) throw new Error('Surveyor test PWA still contains DEV access gate');
if (!surveyorTestIndexBuilt.includes('КД Замерщик Тест')) throw new Error('Surveyor test PWA title is missing');
const surveyorTestManifestBuilt = JSON.parse(await readFile(path.join(SURVEYOR_TEST_OUT, 'manifest.webmanifest'), 'utf8'));
if (
  surveyorTestManifestBuilt.name !== 'КД Замерщик Тест' ||
  surveyorTestManifestBuilt.id !== `${BASE}/${SURVEYOR_TEST_DIR}` ||
  surveyorTestManifestBuilt.start_url !== `${BASE}/${SURVEYOR_TEST_DIR}/` ||
  surveyorTestManifestBuilt.scope !== `${BASE}/${SURVEYOR_TEST_DIR}/`
) throw new Error('Surveyor test PWA identity is not isolated');
const surveyorTestSwBuilt = await readFile(path.join(SURVEYOR_TEST_OUT, 'sw.js'), 'utf8');
if (!surveyorTestSwBuilt.includes(`kdz-test-pwa-${devSourceVersion}`)) throw new Error('Surveyor test PWA cache/version is not isolated');

console.log('Protected dev preview plus ungated surveyor test PWA built successfully');
