import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

const [htmlSource, css, catalogImages, prices, deliveryPricesSource, js, adminHtmlSource, adminCss, adminJsSource, workerSource, adminAuthSource] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('styles.css', 'utf8'),
  readFile('catalog-images.js', 'utf8'),
  readFile('prices.js', 'utf8'),
  readFile('delivery-prices.json', 'utf8'),
  readFile('app.js', 'utf8'),
  readFile('admin.html', 'utf8'),
  readFile('admin.css', 'utf8'),
  readFile('admin.js', 'utf8'),
  readFile('worker/runtime.js', 'utf8'),
  readFile('worker/auth-d1.js', 'utf8')
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

// A 401 from the login endpoint means invalid credentials, not an expired session.
// Keep the server's real error message visible instead of clearing the password field
// and replacing it with "Сеанс завершён".
const adminJs = adminJsSource.replace(
  "if (response.status === 401) {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }",
  "if (response.status === 401 && path !== '/api/admin/login') {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }"
);

const adminHtml = adminHtmlSource
  .replace('<link rel="stylesheet" href="admin.css">', `<style>${adminCss}</style>`)
  .replace('<script src="admin.js"></script>', `<script>${adminJs}</script>`);

// Replace the old environment-variable auth block with D1-backed authentication.
const authStart = workerSource.indexOf('async function createSessionCookie(env)');
const authEnd = workerSource.indexOf('\nfunction defaultGallery(article)', authStart);
if (authStart < 0 || authEnd < 0) throw new Error('Не найден блок авторизации Worker');
let patchedWorkerSource = workerSource.slice(0, authStart) + adminAuthSource.trim() + workerSource.slice(authEnd);

// R2 is not available on this account yet. Allow edits that only change existing
// catalog image order/settings to be saved in D1; uploads still require R2.
patchedWorkerSource = patchedWorkerSource
  .replaceAll(
    "if (!env.DB || !env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);",
    "if (!env.DB) return json({error: 'База данных временно недоступна'}, 503);"
  )
  .replace(
    "await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => env.BUCKET.delete(key)));",
    "if (env.BUCKET) await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => env.BUCKET.delete(key)));"
  )
  .replace(
    "await Promise.allSettled(keys.map(key => env.BUCKET.delete(key)));",
    "if (env.BUCKET) await Promise.allSettled(keys.map(key => env.BUCKET.delete(key)));"
  );

const worker = patchedWorkerSource
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
