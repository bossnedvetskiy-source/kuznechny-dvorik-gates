import { readFile, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const catalogSource = await readFile('catalog-images.js', 'utf8');
const match = catalogSource.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
if (!match) throw new Error('Не удалось прочитать catalog-images.js');
const galleries = JSON.parse(match[1]);
const referenced = new Set(Object.values(galleries).flat().map(value => value.replace(/^\/catalog\//, '')));
const files = (await readdir('assets/catalog')).filter(name => /\.(webp|jpe?g|png)$/i.test(name));
const errors = [];

function checkWebP(buffer, name) {
  if (buffer.length < 20) return `${name}: файл слишком короткий`;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return `${name}: некорректная сигнатура WebP`;
  const declaredSize = buffer.readUInt32LE(4) + 8;
  if (declaredSize !== buffer.length) return `${name}: размер RIFF ${declaredSize} не совпадает с размером файла ${buffer.length}`;
  let offset = 12;
  let chunks = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end > buffer.length) return `${name}: повреждённый WebP chunk`;
    chunks += 1;
    offset = end + (size % 2);
  }
  if (!chunks || offset !== buffer.length) return `${name}: некорректная структура WebP`;
  return null;
}

function checkJpeg(buffer, name) {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
    ? null : `${name}: некорректная структура JPEG`;
}

function checkPng(buffer, name) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  return buffer.length >= 20 && buffer.subarray(0,8).equals(signature) ? null : `${name}: некорректная сигнатура PNG`;
}

for (const name of files) {
  const buffer = await readFile(join('assets/catalog', name));
  const ext = extname(name).toLowerCase();
  const error = ext === '.webp' ? checkWebP(buffer, name) : ext === '.png' ? checkPng(buffer, name) : checkJpeg(buffer, name);
  if (error) errors.push(error);
}

for (const [article, urls] of Object.entries(galleries)) {
  if (!Array.isArray(urls) || !urls.length) errors.push(`${article}: нет фотографий`);
  for (const url of urls || []) {
    const file = basename(url);
    if (!files.includes(file)) errors.push(`${article}: отсутствует файл ${file}`);
  }
}

for (const name of files) {
  if (!referenced.has(name)) console.warn(`Неиспользуемое изображение: ${name}`);
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Изображения каталога проверены: ${files.length} файлов, ${Object.keys(galleries).length} моделей, ошибок 0.`);
