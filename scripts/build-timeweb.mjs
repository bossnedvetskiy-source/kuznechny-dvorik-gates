import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const workerFile = path.join(root, 'dist/server/index.js');
const publicOrigin = 'https://kuzdvor.tw1.ru';

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist/client'), output, { recursive: true });

const workerModule = await import(`${pathToFileURL(workerFile).href}?timeweb=${Date.now()}`);
const worker = workerModule.default;
if (!worker?.fetch) throw new Error('Собранный Worker не экспортирует fetch()');

async function render(route) {
  const request = new Request(`${publicOrigin}${route}`, {
    headers: { accept: 'text/html' }
  });
  const response = await worker.fetch(request, {});
  if (!response.ok) throw new Error(`Не удалось подготовить ${route}: HTTP ${response.status}`);
  return response.text();
}

function noindex(html) {
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow,noarchive">');
  }
  return html.replace(/<head>/i, '<head>\n  <meta name="robots" content="noindex,nofollow,noarchive">');
}

function addJsonLd(html, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const script = `  <script type="application/ld+json">${json}</script>\n`;
  if (!/<\/head>/i.test(html)) throw new Error('Не найден </head> для JSON-LD');
  return html.replace(/<\/head>/i, `${script}</head>`);
}

async function windowValue(file, key) {
  const code = await readFile(path.join(root, file), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file, timeout: 3000 });
  const value = sandbox.window[key];
  if (!value || typeof value !== 'object') throw new Error(`Не удалось получить ${key} из ${file}`);
  return JSON.parse(JSON.stringify(value));
}

async function gateModelPack() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (let index = 1; index <= 4; index += 1) {
    const file = `gate-calc-models-chunk${index}.js`;
    const code = await readFile(path.join(root, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file, timeout: 3000 });
  }
  const b64 = String(sandbox.window.__GATE_CALC_B64 || '');
  if (!b64) throw new Error('Не удалось собрать Excel-модели ворот для Timeweb');
  const modelSource = gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
  vm.runInContext(modelSource, sandbox, { filename: 'gate-calc-models.generated.js', timeout: 5000 });
  const pack = sandbox.window.GATE_CALC_MODELS;
  if (!pack?.models || typeof pack.models !== 'object') throw new Error('Excel-модели ворот имеют неверный формат');
  for (const article of ['39', '40']) delete pack.models[article];
  const entries = Object.entries(pack.models);
  if (entries.length !== 38) throw new Error(`Ожидалось 38 активных моделей ворот, получено ${entries.length}`);
  for (const [article, model] of entries) {
    if (!model?.gateRef || !model?.wicketRef || !model?.formulas || typeof model.formulas !== 'object') {
      throw new Error(`Расчётная модель ${article} неполная`);
    }
    for (const [ref, expression] of Object.entries(model.formulas)) {
      if (typeof expression !== 'string' || !expression.trim()) throw new Error(`Формула ${article}:${ref} имеет неверный формат`);
    }
  }
  return JSON.parse(JSON.stringify(pack));
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${publicOrigin}/#business`,
  name: 'Кузнечный ДворикЪ',
  url: `${publicOrigin}/`,
  telephone: '+79373296750',
  image: `${publicOrigin}/hero-gates.jpg`,
  description: 'Изготовление ворот с калиткой и других металлоконструкций по индивидуальным размерам в Мелеузе и ближайших районах.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Мелеуз',
    addressRegion: 'Республика Башкортостан',
    addressCountry: 'RU'
  },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '18:00'
  }],
  areaServed: {
    '@type': 'City',
    name: 'Мелеуз'
  }
};

// Public pages must stay indexable. Only the private admin page is noindexed.
const indexHtml = addJsonLd(await render('/'), localBusinessSchema);
await writeFile(path.join(output, 'index.html'), indexHtml, 'utf8');

const adminHtml = noindex(await render('/admin'));
await writeFile(path.join(output, 'admin.html'), adminHtml, 'utf8');

const hubHtml = await render('/napravleniya');
await mkdir(path.join(output, 'napravleniya'), { recursive: true });
await writeFile(path.join(output, 'napravleniya/index.html'), hubHtml, 'utf8');

const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin',
  'Disallow: /api/',
  `Sitemap: ${publicOrigin}/sitemap.xml`,
  ''
].join('\n');
await writeFile(path.join(output, 'robots.txt'), robotsTxt, 'utf8');

const lastmod = new Date().toISOString().slice(0, 10);
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${publicOrigin}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${publicOrigin}/napravleniya</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
`;
await writeFile(path.join(output, 'sitemap.xml'), sitemapXml, 'utf8');

// Only runtime files are published. Legacy Cloudflare proxy and one-time
// migration/setup helpers deliberately stay out of the production package.
await cp(path.join(root, 'timeweb/.htaccess'), path.join(output, '.htaccess'));
await cp(path.join(root, 'timeweb/local-api.php'), path.join(output, 'local-api.php'));
await cp(path.join(root, 'timeweb/backend'), path.join(output, 'backend'), { recursive: true });
await cp(path.join(root, 'timeweb/deploy-timeweb.sh'), path.join(output, 'deploy-timeweb.sh'));
await cp(path.join(root, 'timeweb/health-check.sh'), path.join(output, 'health-check.sh'));
await cp(path.join(root, 'timeweb/install-autodeploy.sh'), path.join(output, 'install-autodeploy.sh'));

const [prices, catalogImages, gateCalcPrices, gateCalcModels] = await Promise.all([
  windowValue('prices.js', 'PRICE_DATA'),
  windowValue('catalog-images.js', 'CATALOG_IMAGES'),
  windowValue('gate-calc-prices.js', 'GATE_CALC_PRICES'),
  gateModelPack()
]);
const delivery = JSON.parse(await readFile(path.join(root, 'delivery-prices.json'), 'utf8'));
const siteProfile = {
  phoneDisplay: '8 937 329-67-50',
  phoneDigits: '79373296750',
  whatsappDigits: '79373296750',
  businessHours: 'Пн–Пт, 9:00–18:00',
  serviceAreaKm: 150,
  warrantyYears: 3,
  productionDays: 30,
  deliveryRate: 90,
  heroEyebrow: 'Собственное производство · Мелеуз',
  heroTitleMain: 'Ворота с калиткой',
  heroTitleAccent: 'по вашим размерам',
  heroText: 'Выберите дизайн и рассчитайте предварительную стоимость по своим размерам — с учётом установки, новых столбов при необходимости и доставки.',
  trustText: 'Собственное производство в Мелеузе. Бесплатно замерим проём, согласуем комплектацию и зафиксируем стоимость в договоре.',
  finalCtaTitle: 'Выберите модель и получите предварительную стоимость',
  finalCtaText: 'Калькулятор учтёт ваши размеры, новые усиленные столбы при необходимости и доставку. Итоговую сумму зафиксируем в договоре после бесплатного замера.'
};
await writeFile(path.join(output, 'backend/defaults.json'), JSON.stringify({ prices, catalogImages, delivery, gateCalcPrices, gateCalcModels, siteProfile }), 'utf8');

// A tiny build marker helps verify from the server that a deploy really changed.
await writeFile(path.join(output, 'timeweb-build.txt'), `${new Date().toISOString()}\n`, 'utf8');

const publicIndex = await readFile(path.join(output, 'index.html'), 'utf8');
if (!publicIndex.includes('/site.bundle.js') || !publicIndex.includes('/site.css')) {
  throw new Error('Timeweb index.html собран неполностью');
}
if (!publicIndex.includes('content="index,follow,max-image-preview:large"')) {
  throw new Error('Главная Timeweb случайно закрыта от индексации');
}
if (!publicIndex.includes(`<link rel="canonical" href="${publicOrigin}/">`)) {
  throw new Error('Главная Timeweb содержит неверный canonical');
}
if (!publicIndex.includes('type="application/ld+json"') || !publicIndex.includes('"@type":"LocalBusiness"') || !publicIndex.includes('"@id":"https://kuzdvor.tw1.ru/#business"')) {
  throw new Error('Главная Timeweb потеряла LocalBusiness JSON-LD');
}
if (publicIndex.includes('workers.dev')) {
  throw new Error('В публичной Timeweb-странице осталась ссылка на Cloudflare Workers');
}
if (!adminHtml.includes('noindex,nofollow,noarchive')) {
  throw new Error('Админка Timeweb должна быть закрыта от индексации');
}
if (!robotsTxt.includes(`Sitemap: ${publicOrigin}/sitemap.xml`) || !sitemapXml.includes(`${publicOrigin}/`)) {
  throw new Error('SEO-файлы Timeweb собраны неполностью');
}

console.log(`Timeweb bundle ready: ${output}`);