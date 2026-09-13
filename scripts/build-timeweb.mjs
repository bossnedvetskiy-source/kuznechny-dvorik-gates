import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

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

const indexHtml = noindex(await render('/'));
await writeFile(path.join(output, 'index.html'), indexHtml, 'utf8');

const adminHtml = noindex(await render('/admin'));
await writeFile(path.join(output, 'admin.html'), adminHtml, 'utf8');

const hubHtml = noindex(await render('/napravleniya'));
await mkdir(path.join(output, 'napravleniya'), { recursive: true });
await writeFile(path.join(output, 'napravleniya/index.html'), hubHtml, 'utf8');

await cp(path.join(root, 'timeweb/.htaccess'), path.join(output, '.htaccess'));
await cp(path.join(root, 'timeweb/api-proxy.php'), path.join(output, 'api-proxy.php'));
await cp(path.join(root, 'timeweb/deploy-timeweb.sh'), path.join(output, 'deploy-timeweb.sh'));

// A tiny build marker helps verify from the server that a deploy really changed.
await writeFile(path.join(output, 'timeweb-build.txt'), `${new Date().toISOString()}\n`, 'utf8');

const files = await readFile(path.join(output, 'index.html'), 'utf8');
if (!files.includes('/site.bundle.js') || !files.includes('/site.css')) {
  throw new Error('Timeweb index.html собран неполностью');
}

console.log(`Timeweb bundle ready: ${output}`);
