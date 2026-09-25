import { cp, mkdir, readFile, readdir, rm, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'timeweb-dist');
const OUT = path.join(ROOT, '_site');
const BASE = '/kuznechny-dvorik-gates';
const ACCESS_FILE = path.join(ROOT, 'dev-access.js');
const LIVE_CATALOG = '/tmp/kuzdvor-live-catalog.json';

await rm(OUT, {recursive:true, force:true});
await cp(SOURCE, OUT, {recursive:true});

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
catalogJson = catalogJson.replaceAll('"/catalog-media/', '"https://kuzdvor.tw1.ru/catalog-media/');
await mkdir(path.join(OUT, 'api'), {recursive:true});
await writeFile(path.join(OUT, 'api', 'catalog-images'), catalogJson, 'utf8');

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
    }
  }
}
await walk(OUT);

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
  'КУЗНЕЧНЫЙ ДВОРИКЪ'
]) {
  if (!index.includes(required)) throw new Error(`Dev preview missing: ${required}`);
}
if (index.includes('<script src="app.js"')) throw new Error('Dev preview is using raw source scripts instead of the production bundle');

console.log('Protected dev preview built from exact Timeweb frontend package');
