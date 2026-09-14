import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const workerFile = path.join(root, 'dist/server/index.js');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist/client'), output, { recursive: true });

const workerModule = await import(`${pathToFileURL(workerFile).href}?timeweb=${Date.now()}`);
const worker = workerModule.default;
if (!worker?.fetch) throw new Error('Собранный Worker не экспортирует fetch()');

async function render(route) {
  const request = new Request(`https://kuzdvor.tw1.ru${route}`, {
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

async function windowValue(file, key) {
  const code = await readFile(path.join(root, file), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file, timeout: 3000 });
  const value = sandbox.window[key];
  if (!value || typeof value !== 'object') throw new Error(`Не удалось получить ${key} из ${file}`);
  return JSON.parse(JSON.stringify(value));
}

const indexHtml = noindex(await render('/'));
await writeFile(path.join(output, 'index.html'), indexHtml, 'utf8');

const adminHtml = noindex(await render('/admin'));
await writeFile(path.join(output, 'admin.html'), adminHtml, 'utf8');

const hubHtml = noindex(await render('/napravleniya'));
await mkdir(path.join(output, 'napravleniya'), { recursive: true });
await writeFile(path.join(output, 'napravleniya/index.html'), hubHtml, 'utf8');

await cp(path.join(root, 'timeweb/.htaccess'), path.join(output, '.htaccess'));
await cp(path.join(root, 'timeweb/api-proxy.php'), path.join(output, 'api-proxy.php'));
await cp(path.join(root, 'timeweb/local-api.php'), path.join(output, 'local-api.php'));
await cp(path.join(root, 'timeweb/backend'), path.join(output, 'backend'), { recursive: true });
await cp(path.join(root, 'timeweb/setup-timeweb.php'), path.join(output, 'setup-timeweb.php'));
await cp(path.join(root, 'timeweb/migrate-from-cloudflare.php'), path.join(output, 'migrate-from-cloudflare.php'));
await cp(path.join(root, 'timeweb/migrate-public-catalog.php'), path.join(output, 'migrate-public-catalog.php'));
await cp(path.join(root, 'timeweb/deploy-timeweb.sh'), path.join(output, 'deploy-timeweb.sh'));
await cp(path.join(root, 'timeweb/health-check.sh'), path.join(output, 'health-check.sh'));
await cp(path.join(root, 'timeweb/install-autodeploy.sh'), path.join(output, 'install-autodeploy.sh'));

const [prices, catalogImages, gateCalcPrices] = await Promise.all([
  windowValue('prices.js', 'PRICE_DATA'),
  windowValue('catalog-images.js', 'CATALOG_IMAGES'),
  windowValue('gate-calc-prices.js', 'GATE_CALC_PRICES')
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
await writeFile(path.join(output, 'backend/defaults.json'), JSON.stringify({ prices, catalogImages, delivery, gateCalcPrices, siteProfile }), 'utf8');

// A tiny build marker helps verify from the server that a deploy really changed.
await writeFile(path.join(output, 'timeweb-build.txt'), `${new Date().toISOString()}\n`, 'utf8');

const files = await readFile(path.join(output, 'index.html'), 'utf8');
if (!files.includes('/site.bundle.js') || !files.includes('/site.css')) {
  throw new Error('Timeweb index.html собран неполностью');
}

console.log(`Timeweb bundle ready: ${output}`);
