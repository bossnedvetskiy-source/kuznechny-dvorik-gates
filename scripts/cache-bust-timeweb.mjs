import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const indexPath = path.join(output, 'index.html');
const bundlePath = path.join(output, 'site.bundle.js');

let sourceSha = String(process.env.KUZDVOR_SOURCE_SHA || process.env.GITHUB_SHA || '').trim();

if (!/^[0-9a-f]{40}$/i.test(sourceSha)) {
  try {
    const version = JSON.parse(await readFile(path.join(output, 'deployment-version.json'), 'utf8'));
    sourceSha = String(version?.sourceSha || '').trim();
  } catch {}
}

if (!/^[0-9a-f]{40}$/i.test(sourceSha)) {
  try {
    sourceSha = String(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).trim();
  } catch {}
}

if (!/^[0-9a-f]{40}$/i.test(sourceSha)) {
  throw new Error('Timeweb cache busting: source SHA is unavailable or invalid');
}

const version = sourceSha.slice(0, 12).toLowerCase();
const versionPath = value => `${value}?v=${version}`;

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    if (source.includes(to)) return source;
    throw new Error(`Timeweb cache busting: ${label} marker not found`);
  }
  return source.split(from).join(to);
}

let index = await readFile(indexPath, 'utf8');
index = replaceRequired(index, 'href="/site.css"', `href="${versionPath('/site.css')}"`, 'site stylesheet');
index = replaceRequired(index, 'src="/site.bundle.js"', `src="${versionPath('/site.bundle.js')}"`, 'site bundle');
await writeFile(indexPath, index, 'utf8');

let bundle = await readFile(bundlePath, 'utf8');
bundle = replaceRequired(bundle, "'/calculator.bundle.js'", `'${versionPath('/calculator.bundle.js')}'`, 'calculator bundle');
bundle = replaceRequired(bundle, "'/catalog-enhancements.bundle.js'", `'${versionPath('/catalog-enhancements.bundle.js')}'`, 'catalog enhancements bundle');
await writeFile(bundlePath, bundle, 'utf8');

const finalIndex = await readFile(indexPath, 'utf8');
const finalBundle = await readFile(bundlePath, 'utf8');
for (const marker of [
  `href="/site.css?v=${version}"`,
  `src="/site.bundle.js?v=${version}"`
]) {
  if (!finalIndex.includes(marker)) throw new Error(`Timeweb cache busting: missing ${marker}`);
}
for (const marker of [
  `'/calculator.bundle.js?v=${version}'`,
  `'/catalog-enhancements.bundle.js?v=${version}'`
]) {
  if (!finalBundle.includes(marker)) throw new Error(`Timeweb cache busting: missing ${marker}`);
}

console.log(`Timeweb customer assets cache-busted with ${version}`);
