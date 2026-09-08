import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

const [htmlSource, css, catalogImages, pricesSource, deliveryPricesSource, js, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('styles.css', 'utf8'),
  readFile('catalog-images.js', 'utf8'),
  readFile('prices.js', 'utf8'),
  readFile('delivery-prices.json', 'utf8'),
  readFile('app.js', 'utf8'),
  readFile('admin.html', 'utf8'),
  readFile('admin.css', 'utf8'),
  readFile('admin.js', 'utf8'),
  readFile('admin-prices.js', 'utf8'),
  readFile('worker/runtime.js', 'utf8'),
  readFile('worker/auth-d1.js', 'utf8'),
  readFile('worker/site-settings-d1.js', 'utf8'),
  readFile('worker/catalog-media-d1.js', 'utf8')
]);

const deliveryPrices = JSON.parse(deliveryPricesSource);
if (!Number.isFinite(deliveryPrices.fallbackRatePerKm) || !deliveryPrices.origin) {
  throw new Error('Некорректный файл delivery-prices.json');
}
const embeddedDeliveryPrices = JSON.stringify(deliveryPrices).replace(/</g, '\\u003c');
const galleryMatch = catalogImages.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
if (!galleryMatch) throw new Error('Некорректный файл catalog-images.js');
const defaultGalleries = JSON.parse(galleryMatch[1]);
const pricesMatch = pricesSource.match(/window\.PRICE_DATA\s*=\s*({[\s\S]*?});\s*$/);
if (!pricesMatch) throw new Error('Некорректный файл prices.js');
const defaultPrices = Function(`"use strict"; return (${pricesMatch[1]});`)();

const publicJs = js.replace(
  "const catalogProducts = priceData.catalog.map(({art,price},index)=>{",
  "const orderedCatalogPrices = [...priceData.catalog].filter(item=>item.visible!==false).sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999));\nconst catalogProducts = orderedCatalogPrices.map(({art,price},index)=>{"
);
if (publicJs === js) throw new Error('Не найден блок каталога в app.js');

const html = htmlSource
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`)
  .replace('<script id="deliveryData" type="application/json">{}</script>', `<script id="deliveryData" type="application/json">${embeddedDeliveryPrices}</script>`)
  .replace('<script src="catalog-images.js"></script>', `<script>${catalogImages}</script>`)
  .replace('<script src="prices.js"></script>', '<script>window.PRICE_DATA=__RUNTIME_PRICE_DATA__;</script>')
  .replace('<script src="app.js"></script>', `<script>${publicJs}</script>`);

// A 401 from the login endpoint means invalid credentials, not an expired session.
// Keep the server's real error message visible instead of clearing the password field.
let adminJs = adminJsSource
  .replace(
    "if (response.status === 401) {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }",
    "if (response.status === 401 && path !== '/api/admin/login') {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }"
  )
  .replace(
    "galleries = data.galleries;\n    const articles = Object.keys(galleries);",
    "galleries = data.galleries;\n    const photoUploadEnabled = data.photoUploadEnabled !== false;\n    photoInput.disabled = !photoUploadEnabled;\n    document.querySelector('.upload-button')?.classList.toggle('disabled', !photoUploadEnabled);\n    uploadNote.textContent = photoUploadEnabled ? 'Можно загрузить до 12 фотографий. Фото автоматически уменьшаются без обрезки и искажения.' : 'Загрузка фотографий временно недоступна. Порядок и обложку существующих фото можно менять.';\n    const articles = Object.keys(galleries);"
  )
  .replace(
    "showEditor();\n    selectArticle(articles[0]);",
    "showEditor();\n    selectArticle(articles[0]);\n    window.dispatchEvent(new CustomEvent('admin:ready'));"
  );

// D1 has a 2 MB maximum row size. Prepare uploaded photos in the browser so the
// stored WebP stays comfortably below that limit while preserving proportions.
const optimizeStart = adminJs.indexOf('async function optimizeImage(file) {');
const optimizeEnd = adminJs.indexOf('\nasync function uploadFiles(files) {', optimizeStart);
if (optimizeStart < 0 || optimizeEnd < 0) throw new Error('Не найден блок подготовки фотографий');
const optimizedPhotoFunction = `async function optimizeImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(\`${'${file.name}'}: выбран не файл фотографии\`);
  if (file.size > 25 * 1024 * 1024) throw new Error(\`${'${file.name}'}: исходный файл превышает 25 МБ\`);
  const image = await loadImage(file);
  const targetBytes = 1350000;
  let maxSide = 1800;
  let quality = .86;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', {alpha: false});
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw new Error(\`${'${file.name}'}: не удалось подготовить фотографию\`);
    if (blob.size <= targetBytes) return blob;
    if (quality > .62) quality -= .08;
    else {
      maxSide = Math.max(1100, Math.round(maxSide * .84));
      quality = .76;
    }
  }
  throw new Error(\`${'${file.name}'}: фотография слишком большая после оптимизации\`);
}`;
adminJs = adminJs.slice(0, optimizeStart) + optimizedPhotoFunction + adminJs.slice(optimizeEnd);

const adminHtml = adminHtmlSource
  .replace('<link rel="stylesheet" href="admin.css">', `<style>${adminCss}</style>`)
  .replace('<script src="admin.js"></script>', `<script>${adminJs}</script>`)
  .replace('<script src="admin-prices.js"></script>', `<script>${adminPricesJsSource}</script>`);

// Replace old environment-variable auth with D1-backed authentication and add
// D1-backed settings/media helpers.
const authStart = workerSource.indexOf('async function createSessionCookie(env)');
const authEnd = workerSource.indexOf('\nfunction defaultGallery(article)', authStart);
if (authStart < 0 || authEnd < 0) throw new Error('Не найден блок авторизации Worker');
let patchedWorkerSource = workerSource.slice(0, authStart)
  + adminAuthSource.trim() + '\n\n'
  + siteSettingsSource.trim() + '\n\n'
  + catalogMediaSource.trim()
  + workerSource.slice(authEnd);

patchedWorkerSource = patchedWorkerSource.replace(
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;',
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;'
);

// Existing gallery metadata lives in D1. New image bytes use R2 when available,
// otherwise the D1 media table is used as a no-billing fallback.
patchedWorkerSource = patchedWorkerSource.replaceAll(
  "if (!env.DB || !env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);",
  "if (!env.DB) return json({error: 'База данных временно недоступна'}, 503);"
);

const uploadStart = patchedWorkerSource.indexOf('async function uploadPhoto(request, env, article) {');
const uploadEnd = patchedWorkerSource.indexOf('\nasync function serveCatalogMedia', uploadStart);
if (uploadStart < 0 || uploadEnd < 0) throw new Error('Не найден блок загрузки фотографий Worker');
patchedWorkerSource = patchedWorkerSource.slice(0, uploadStart)
  + "async function uploadPhoto(request, env, article) {\n  return storeCatalogMedia(request, env, article);\n}\n"
  + patchedWorkerSource.slice(uploadEnd);

const serveStart = patchedWorkerSource.indexOf('async function serveCatalogMedia(env, pathname) {');
const serveEnd = patchedWorkerSource.indexOf('\nconst haversine', serveStart);
if (serveStart < 0 || serveEnd < 0) throw new Error('Не найден блок выдачи фотографий Worker');
patchedWorkerSource = patchedWorkerSource.slice(0, serveStart)
  + "async function serveCatalogMedia(env, pathname) {\n  return readCatalogMedia(env, pathname);\n}\n"
  + patchedWorkerSource.slice(serveEnd);

patchedWorkerSource = patchedWorkerSource
  .replace(
    "await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => env.BUCKET.delete(key)));",
    "await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => deleteCatalogMediaObject(env, key)));"
  )
  .replace(
    "await Promise.allSettled(keys.map(key => env.BUCKET.delete(key)));",
    "await Promise.allSettled(keys.map(key => deleteCatalogMediaObject(env, key)));"
  );

// Add price and catalog settings management to the authenticated admin API.
patchedWorkerSource = patchedWorkerSource.replace(
  "if (url.pathname === '/api/admin/catalog' && request.method === 'GET') {\n    try {\n      return json({galleries: await allGalleries(env, true)});",
  "if (url.pathname === '/api/admin/prices') {\n    try {\n      if (request.method === 'GET') return json({prices: await loadPrices(env)});\n      if (request.method === 'POST') return await savePrices(request, env);\n      return json({error: 'Метод не поддерживается'}, 405);\n    } catch (error) {\n      return json({error: 'Не удалось сохранить цены: ' + errorMessage(error)}, 500);\n    }\n  }\n  if (url.pathname === '/api/admin/catalog' && request.method === 'GET') {\n    try {\n      return json({galleries: await allGalleries(env, true), photoUploadEnabled: Boolean(env.BUCKET || env.DB)});"
);

// Render the public page with settings from D1, falling back to repository defaults.
patchedWorkerSource = patchedWorkerSource.replace('return html(PAGE);\n  }\n};', 'return html(await renderPublicPage(env));\n  }\n};');

const worker = patchedWorkerSource
  .replace('__PUBLIC_PAGE__', JSON.stringify(html))
  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))
  .replace('__DEFAULT_GALLERIES__', JSON.stringify(defaultGalleries))
  .replace('__DEFAULT_PRICES__', JSON.stringify(defaultPrices))
  .replace('__DELIVERY_ORIGIN__', JSON.stringify(deliveryPrices.origin))
  .replace('__DELIVERY_RATE__', String(deliveryPrices.fallbackRatePerKm));

await writeFile('dist/server/index.js', worker, 'utf8');
await writeFile('dist/client/.keep', '', 'utf8');
await copyFile('assets/hero-gates.jpg', 'dist/client/hero-gates.jpg');
await cp('assets/catalog', 'dist/client/catalog', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
