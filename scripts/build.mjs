import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

const [htmlSource, css, catalogImages, prices, deliveryPricesSource, js, adminHtmlSource, adminCss, adminJs, workerSource] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('styles.css', 'utf8'),
  readFile('catalog-images.js', 'utf8'),
  readFile('prices.js', 'utf8'),
  readFile('delivery-prices.json', 'utf8'),
  readFile('app.js', 'utf8'),
  readFile('admin.html', 'utf8'),
  readFile('admin.css', 'utf8'),
  readFile('admin.js', 'utf8'),
  readFile('worker/runtime.js', 'utf8')
]);

const deliveryPrices = JSON.parse(deliveryPricesSource);
if (!Number.isFinite(deliveryPrices.fallbackRatePerKm) || !deliveryPrices.origin) {
  throw new Error('Некорректный файл delivery-prices.json');
}
const embeddedDeliveryPrices = JSON.stringify(deliveryPrices).replace(/</g, '\\u003c');
const galleryMatch = catalogImages.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
if (!galleryMatch) throw new Error('Некорректный файл catalog-images.js');
const defaultGalleries = JSON.parse(galleryMatch[1]);

const html = htmlSource
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`)
  .replace('<script id="deliveryData" type="application/json">{}</script>', `<script id="deliveryData" type="application/json">${embeddedDeliveryPrices}</script>`)
  .replace('<script src="catalog-images.js"></script>', `<script>${catalogImages}</script>`)
  .replace('<script src="prices.js"></script>', `<script>${prices}</script>`)
  .replace('<script src="app.js"></script>', `<script>${js}</script>`);

const adminHtml = adminHtmlSource
  .replace('<link rel="stylesheet" href="admin.css">', `<style>${adminCss}</style>`)
  .replace('<script src="admin.js"></script>', `<script>${adminJs}</script>`);

const worker = workerSource
  .replace('__PUBLIC_PAGE__', JSON.stringify(html))
  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))
  .replace('__DEFAULT_GALLERIES__', JSON.stringify(defaultGalleries))
  .replace('__DELIVERY_ORIGIN__', JSON.stringify(deliveryPrices.origin))
  .replace('__DELIVERY_RATE__', String(deliveryPrices.fallbackRatePerKm));

await writeFile('dist/server/index.js', worker, 'utf8');
await writeFile('dist/client/.keep', '', 'utf8');
await copyFile('assets/hero-gates.jpg', 'dist/client/hero-gates.jpg');
await cp('assets/catalog', 'dist/client/catalog', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
