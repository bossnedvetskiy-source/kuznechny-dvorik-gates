import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const htaccessPath = path.join(output, '.htaccess');
const apiPath = path.join(output, 'local-api.php');

function replaceExactlyOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first === -1) throw new Error(`Timeweb hardening: ${label} source block was not found`);
  if (source.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Timeweb hardening: ${label} source block is ambiguous`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

let htaccess = await readFile(htaccessPath, 'utf8');
if (!htaccess.includes('HTTP:X-Forwarded-Proto')) {
  htaccess = replaceExactlyOnce(
    htaccess,
    'RewriteEngine On\n',
    `RewriteEngine On\n\n# Always keep customer and admin traffic on HTTPS. X-Forwarded-Proto is\n# checked as Timeweb may terminate TLS before Apache/PHP.\nRewriteCond %{HTTPS} !=on\nRewriteCond %{HTTP:X-Forwarded-Proto} !https [NC]\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L,NE]\n`,
    'HTTPS redirect'
  );
}

if (!htaccess.includes('Strict-Transport-Security')) {
  const headerMarker = '<IfModule mod_headers.c>\n';
  htaccess = replaceExactlyOnce(
    htaccess,
    headerMarker,
    `${headerMarker}  Header always set Strict-Transport-Security "max-age=31536000"\n`,
    'HSTS header'
  );
}
await writeFile(htaccessPath, htaccess, 'utf8');

let api = await readFile(apiPath, 'utf8');
const oldHealth = `if ($route === 'health') {
    $configured = kd_is_configured();
    $db = false;
    $error = '';
    if ($configured) {
        try {
            kd_db()->query('SELECT 1')->fetchColumn();
            $db = true;
        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
    }
    kd_json(['ok' => true, 'backend' => 'timeweb-php', 'configured' => $configured, 'db' => $db, 'error' => $error]);
}`;
const newHealth = `if ($route === 'health') {
    $configured = kd_is_configured();
    $db = false;
    if ($configured) {
        try {
            kd_db()->query('SELECT 1')->fetchColumn();
            $db = true;
        } catch (Throwable $e) {
            error_log('Kuzdvor Timeweb health: ' . $e->getMessage());
        }
    }
    $healthy = $configured && $db;
    kd_json(['ok' => $healthy, 'backend' => 'timeweb-php', 'configured' => $configured, 'db' => $db], $healthy ? 200 : 503);
}`;
if (api.includes(oldHealth)) api = replaceExactlyOnce(api, oldHealth, newHealth, 'health endpoint');
if (api.includes("    kd_json(['error' => 'Ошибка серверной части сайта', 'detail' => $e->getMessage()], 500);")) {
  api = replaceExactlyOnce(
    api,
    "    kd_json(['error' => 'Ошибка серверной части сайта', 'detail' => $e->getMessage()], 500);",
    "    kd_json(['error' => 'Ошибка серверной части сайта'], 500);",
    'public exception response'
  );
}
await writeFile(apiPath, api, 'utf8');

const sourceSha = String(process.env.KUZDVOR_SOURCE_SHA || process.env.GITHUB_SHA || '').trim();
if (!/^[0-9a-f]{40}$/i.test(sourceSha)) {
  throw new Error('Timeweb hardening: source SHA is unavailable or invalid');
}
await writeFile(
  path.join(output, 'deployment-version.json'),
  JSON.stringify({ sourceSha, builtAt: new Date().toISOString() }) + '\n',
  'utf8'
);

try {
  await access(path.join(output, 'api-proxy.php'));
  throw new Error('Timeweb hardening: legacy Cloudflare api-proxy.php is present in production package');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const admin = await readFile(path.join(output, 'admin.html'), 'utf8');
const siteBundle = await readFile(path.join(output, 'site.bundle.js'), 'utf8');

const checks = [
  [htaccess.includes('RewriteCond %{HTTP:X-Forwarded-Proto} !https [NC]'), 'HTTPS proxy-aware redirect is missing'],
  [htaccess.includes('Strict-Transport-Security'), 'HSTS header is missing'],
  [htaccess.includes('RewriteRule ^api/(.*)$ local-api.php?__route=$1 [QSA,L]'), 'production API is not routed to local PHP'],
  [!htaccess.includes('api-proxy.php?__proxy_path'), 'production .htaccess still references legacy Cloudflare proxy'],
  [api.includes('$healthy ? 200 : 503'), 'health endpoint does not fail closed'],
  [!api.includes("'detail' => $e->getMessage()"), 'public API still exposes exception details'],
  [admin.includes('<script src="/xlsx.bundle.js"></script>'), 'admin does not use the external XLSX bundle'],
  [!admin.includes('unsupported format |'), 'XLSX implementation is still inlined into admin HTML'],
  [siteBundle.includes('С учётом доставки'), 'delivery-inclusive catalog pricing is missing from the public bundle']
];
for (const [ok, message] of checks) {
  if (!ok) throw new Error(`Timeweb hardening: ${message}`);
}

console.log(`Timeweb package hardening checks passed for ${sourceSha}`);
