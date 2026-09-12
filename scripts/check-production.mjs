import { readFile } from 'node:fs/promises';

const BASE = String(process.env.PRODUCTION_URL || 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev').replace(/\/$/, '');
const timeoutMs = 10000;

async function fetchChecked(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {headers:{'user-agent':'KuznechnyDvorikProductionSmoke/1.0'}, signal:controller.signal});
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

const page = await (await fetchChecked(BASE + '/')).text();
for (const required of ['Кузнечный ДворикЪ', 'Ворота с калиткой']) {
  if (!page.includes(required)) throw new Error(`Рабочая страница не содержит: ${required}`);
}

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
console.log(`Каталог production: ${entries.length} моделей.`);
if (coverMismatches.length) {
  console.warn(`Обложки production отличаются от main у ${coverMismatches.length} моделей:`);
  console.warn(coverMismatches.join('\n'));
} else {
  console.log('Первые фотографии моделей совпадают с main.');
}
