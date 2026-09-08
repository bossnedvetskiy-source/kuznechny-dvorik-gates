import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PUBLIC_KEY = 'https://disk.yandex.ru/d/NjaKu8BypduYDw';
const API_URL = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const outputDirectory = join(process.cwd(), 'assets', 'catalog');

const fallbackImages = {
  'Арт.4': 'https://static.tildacdn.com/stor3936-3965-4735-b637-383164646636/61264818.jpg',
  'Арт.7': 'https://static.tildacdn.com/stor6464-3461-4535-a133-613337666436/39717687.jpg',
  'Арт.11': 'https://static.tildacdn.com/stor3838-6230-4231-a137-373164326430/93256237.jpg',
  'Арт.34': 'https://static.tildacdn.com/stor3033-6239-4065-b830-373264323034/37033440.png',
  'Арт.37': 'https://static.tildacdn.com/stor3465-3834-4366-a565-313334636132/95794254.png'
};

const supplementalImages = {
  'Арт.29': 'https://static.tildacdn.com/stor6662-3630-4564-b736-333965303563/25478974.jpg'
};

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'KuznechnyDvorikCatalogImporter/1.0' },
        signal: AbortSignal.timeout(60_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 900);
    }
  }
  throw lastError;
}

function articleSlug(article) {
  return article
    .replace(/^Арт\./, 'art-')
    .toLocaleLowerCase('ru-RU')
    .replace(/с/g, 's')
    .replace(/[^a-z0-9-]/g, '');
}

function imageExtension(name) {
  return name.toLocaleLowerCase('ru-RU').match(/\.(jpe?g|png|webp)$/)?.[1];
}

function sourceDate(item) {
  const exifDate = item.exif?.date_time;
  if (exifDate) return Date.parse(exifDate) || 0;
  const matched = item.name.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (matched) return Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  return Date.parse(item.modified || '') || 0;
}

function sourceDay(item) {
  const date = sourceDate(item);
  return date ? new Date(date).toISOString().slice(0, 10) : item.name;
}

function sizeUrl(item, name) {
  return item.sizes?.find(size => size.name === name)?.url
    || item.sizes?.find(size => size.name === 'ORIGINAL')?.url;
}

async function resource(path) {
  const params = new URLSearchParams({
    public_key: PUBLIC_KEY,
    path,
    limit: '200',
    fields: 'name,_embedded.total,_embedded.items.name,_embedded.items.mime_type,_embedded.items.size,_embedded.items.modified,_embedded.items.exif,_embedded.items.sizes'
  });
  return (await fetchWithRetry(`${API_URL}?${params}`)).json();
}

async function download(url, destination) {
  const response = await fetchWithRetry(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
}

async function dimensions(path) {
  const { stdout } = await execFileAsync('identify', ['-format', '%w %h', path]);
  const [width, height] = stdout.trim().split(/\s+/).map(Number);
  return { width, height, ratio: width / height };
}

async function optimize(source, destination) {
  await execFileAsync('convert', [
    source,
    '-auto-orient',
    '-resize', '1600x1200>',
    '-strip',
    '-quality', '82',
    destination
  ]);
}

async function inspectCandidates(article, items, temporaryDirectory) {
  const candidates = items
    .filter(item => item.mime_type?.startsWith('image/')
      && imageExtension(item.name)
      && sizeUrl(item, 'S')
      && !/(без имени|screenshot|скрин)/i.test(item.name))
    .sort((a, b) => sourceDate(b) - sourceDate(a) || (b.size || 0) - (a.size || 0))
    .slice(0, 10);

  const inspected = [];
  for (const [index, item] of candidates.entries()) {
    try {
      const temporaryPath = join(temporaryDirectory, `${articleSlug(article)}-preview-${index}.${imageExtension(item.name)}`);
      await download(sizeUrl(item, 'S'), temporaryPath);
      inspected.push({ ...item, temporaryPath, ...(await dimensions(temporaryPath)) });
    } catch (error) {
      console.warn(`${article}: не удалось проверить ${item.name}: ${error.message}`);
    }
  }
  return inspected;
}

function chooseGallery(candidates) {
  const landscape = candidates.filter(item => item.ratio >= 1.22 && item.ratio <= 3.4);
  const cover = landscape[0] || candidates[0];
  if (!cover) return [];
  const selected = [cover];
  const usedDays = new Set([sourceDay(cover)]);

  for (const item of candidates) {
    if (item === cover) continue;
    const day = sourceDay(item);
    if (!usedDays.has(day)) {
      selected.push(item);
      usedDays.add(day);
    }
    if (selected.length === 3) return selected;
  }
  for (const item of candidates) {
    if (!selected.includes(item)) selected.push(item);
    if (selected.length === 3) break;
  }
  return selected;
}

async function importArticle(article, temporaryDirectory) {
  const metadata = await resource(`/${article}`);
  const inspected = await inspectCandidates(article, metadata._embedded?.items || [], temporaryDirectory);
  const selected = chooseGallery(inspected);
  if (!selected.length) throw new Error(`${article}: в папке нет подходящих фотографий`);

  const paths = [];
  for (const [index, item] of selected.entries()) {
    const originalPath = join(temporaryDirectory, `${articleSlug(article)}-source-${index}.${imageExtension(item.name)}`);
    const outputName = `${articleSlug(article)}-${index + 1}.webp`;
    const outputPath = join(outputDirectory, outputName);
    await download(sizeUrl(item, 'XL'), originalPath);
    await optimize(originalPath, outputPath);
    paths.push(`/catalog/${outputName}`);
  }
  if (paths.length < 2 && supplementalImages[article]) {
    const index = paths.length;
    const originalPath = join(temporaryDirectory, `${articleSlug(article)}-supplement.jpg`);
    const outputName = `${articleSlug(article)}-${index + 1}.webp`;
    await download(supplementalImages[article], originalPath);
    await optimize(originalPath, join(outputDirectory, outputName));
    paths.push(`/catalog/${outputName}`);
  }
  console.log(`${article}: ${selected.map(item => item.name).join(', ')}`);
  return paths;
}

async function importFallback(article, url, temporaryDirectory) {
  const extension = url.toLocaleLowerCase('ru-RU').endsWith('.png') ? 'png' : 'jpg';
  const originalPath = join(temporaryDirectory, `${articleSlug(article)}-fallback.${extension}`);
  const outputName = `${articleSlug(article)}-1.webp`;
  await download(url, originalPath);
  await optimize(originalPath, join(outputDirectory, outputName));
  console.log(`${article}: временное изображение из прежнего каталога`);
  return [`/catalog/${outputName}`];
}

async function runPool(tasks, concurrency = 4) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

const pricesSource = await readFile('prices.js', 'utf8');
const articles = [...pricesSource.matchAll(/\{ art: '([^']+)', price:/g)].map(match => match[1]);
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'gates-import-'));
await mkdir(outputDirectory, { recursive: true });

try {
  const entries = await runPool(articles.map(article => async () => {
    const gallery = fallbackImages[article]
      ? await importFallback(article, fallbackImages[article], temporaryDirectory)
      : await importArticle(article, temporaryDirectory);
    return [article, gallery];
  }));
  const mapping = Object.fromEntries(entries);
  const source = `/* Фотографии каталога. Цены изменяются только в prices.js. */\nwindow.CATALOG_IMAGES = ${JSON.stringify(mapping, null, 2)};\n`;
  await writeFile('catalog-images.js', source, 'utf8');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
