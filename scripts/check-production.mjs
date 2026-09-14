import { readFile } from 'node:fs/promises';

const BASE = String(process.env.PRODUCTION_URL || 'https://kuzdvor.tw1.ru').replace(/\/$/, '');
const timeoutMs = 15000;

async function fetchChecked(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {'user-agent':'KuznechnyDvorikProductionSmoke/2.0', ...(options.headers || {})},
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

const page = await (await fetchChecked(BASE + '/')).text();
for (const required of ['Кузнечный Дворик', 'Ворота с калиткой']) {
  if (!page.includes(required)) throw new Error(`Рабочая страница не содержит: ${required}`);
}
if (!page.includes('/site.css') || !page.includes('/site.bundle.js')) {
  throw new Error('Рабочая страница не использует production-ресурсы Timeweb');
}

const version = await (await fetchChecked(BASE + '/deployment-version.json')).json();
if (!/^[0-9a-f]{40}$/i.test(String(version?.sourceSha || ''))) {
  throw new Error('deployment-version.json не содержит SHA исходного main');
}

const healthResponse = await fetchChecked(BASE + '/api/health');
if (healthResponse.headers.get('x-kuzdvor-backend') !== 'timeweb-php') {
  throw new Error('Production API обслуживается не Timeweb PHP');
}
const health = await healthResponse.json();
if (health?.ok !== true || health?.configured !== true || health?.db !== true || health?.backend !== 'timeweb-php') {
  throw new Error(`Timeweb backend unhealthy: ${JSON.stringify(health)}`);
}
if ('error' in health || 'detail' in health) throw new Error('Health endpoint раскрывает внутренние поля ошибки');

const remote = await (await fetchChecked(BASE + '/api/catalog-images')).json();
const remoteGalleries = remote?.galleries || {};
const entries = Object.entries(remoteGalleries);
if (entries.length < 38) throw new Error(`В production найдено только ${entries.length} моделей каталога`);

const brokenUrl = '/catalog/art-22-2-1.webp';
const badReferences = [];
for (const [article, gallery] of entries) {
  const photos = Array.isArray(gallery) ? gallery : gallery?.photos;
  if (!Array.isArray(photos) || !photos.length) badReferences.push(`${article}: нет фотографий`);
  if ((photos || []).includes(brokenUrl)) badReferences.push(`${article}: осталась ссылка на повреждённое фото`);
}
if (badReferences.length) throw new Error(badReferences.join('; '));

const source = await readFile('catalog-images.js', 'utf8');
const match = source.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
const local = match ? JSON.parse(match[1]) : {};
const coverMismatches = [];
for (const [article, photos] of Object.entries(local)) {
  const remotePhotos = Array.isArray(remoteGalleries[article]) ? remoteGalleries[article] : remoteGalleries[article]?.photos;
  if (Array.isArray(remotePhotos) && remotePhotos[0] && photos[0] && remotePhotos[0] !== photos[0]) {
    coverMismatches.push(`${article}: production=${remotePhotos[0]}, repo=${photos[0]}`);
  }
}

console.log(`Production доступен: ${BASE}`);
console.log(`Timeweb source SHA: ${version.sourceSha}`);
console.log(`Каталог production: ${entries.length} моделей.`);
if (coverMismatches.length) {
  console.warn(`Обложки production отличаются от main у ${coverMismatches.length} моделей:`);
  console.warn(coverMismatches.join('\n'));
} else {
  console.log('Первые фотографии моделей совпадают с main.');
}
