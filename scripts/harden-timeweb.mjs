import { access, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'timeweb-dist');
const htaccessPath = path.join(output, '.htaccess');
const apiPath = path.join(output, 'local-api.php');
const adminPath = path.join(output, 'admin.html');
const gateQuotePath = path.join(output, 'backend/gate-quote.php');
const excelValidationPath = path.join(output, 'backend/excel-quote-validation.php');

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

let gateQuote = await readFile(gateQuotePath, 'utf8');
// PHP has no built-in trunc() function. Keep JS Math.trunc semantics without
// enabling eval or any dynamic PHP execution in the formula engine.
gateQuote = gateQuote.replace(
  "'Math.trunc' => trunc(kd_gate_number($args[0] ?? 0)),",
  "'Math.trunc' => (float)(int)kd_gate_number($args[0] ?? 0),"
);
await writeFile(gateQuotePath, gateQuote, 'utf8');

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
const oldLeadCall = `        kd_require_same_origin();
        kd_create_lead();`;
const newLeadCall = `        kd_require_same_origin();
        require_once __DIR__ . '/backend/gate-quote.php';
        kd_create_authoritative_lead();`;
if (api.includes(oldLeadCall)) api = replaceExactlyOnce(api, oldLeadCall, newLeadCall, 'authoritative lead endpoint');

const oldExcelInputTrust = `$body=kd_json_body(262144);$prices=is_array($body['prices']??null)?$body['prices']:[];$standards=is_array($body['standardPrices']??null)?$body['standardPrices']:[];`;
const newExcelInputValidation = `$body=kd_json_body(262144);require_once __DIR__ . '/backend/excel-quote-validation.php';try{$validated=kd_gate_validate_excel_payload($body);}catch(Throwable $e){kd_json(['error'=>$e->getMessage()],400);}$prices=$validated['prices'];$standards=$validated['standardPrices'];`;
if (api.includes(oldExcelInputTrust)) api = replaceExactlyOnce(api, oldExcelInputTrust, newExcelInputValidation, 'Excel pricing validation');
await writeFile(apiPath, api, 'utf8');

// Make the lead price source explicit for managers. The authoritative amount
// stays in lead.total; client_total is shown only when it differs. Older leads
// and product categories without server formulas remain visibly unverified.
let admin = await readFile(adminPath, 'utf8');
const leadTotalCss = '.lead-total{font:20px Prata,serif;color:#8a6326;white-space:nowrap}';
const leadTrustCss = `${leadTotalCss}.lead-price-box{display:grid;justify-items:end;gap:4px;min-width:190px;text-align:right}.lead-quote-badge{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}.lead-quote-badge.is-verified{background:#edf6ec;color:#42623d;border:1px solid #cfe2cc}.lead-quote-badge.is-review{background:#fff5df;color:#76591f;border:1px solid #ead3a1}.lead-price-warning,.lead-delivery-warning{max-width:250px;font-size:9px;line-height:1.35}.lead-price-warning{color:#8a542f}.lead-delivery-warning{color:#6f5d36}`;
admin = replaceExactlyOnce(admin, leadTotalCss, leadTrustCss, 'lead price trust styles');

const leadStateMarker = "      const fieldThreeValue=category==='gates'?wicket:(lead.product_title||categoryName);";
const leadTrustState = `${leadStateMarker}
      const quoteVerified=lead.quote_verified===true||Number(lead.quote_verified)===1;
      const authoritativeTotal=Number(lead.total)||0;
      const clientTotal=Number(lead.client_total);
      const hasClientTotal=Number.isFinite(clientTotal)&&clientTotal>0;
      const quoteDiffers=hasClientTotal&&Math.round(clientTotal)!==Math.round(authoritativeTotal);
      const deliveryPending=lead.delivery_pending===true||Number(lead.delivery_pending)===1;
      const deliveryOutOfArea=lead.delivery_out_of_area===true||Number(lead.delivery_out_of_area)===1;
      const quoteBadgeText=quoteVerified?'✓ Проверено сервером':'⚠ Цена требует проверки';
      const quoteBadgeClass=quoteVerified?'is-verified':'is-review';
      const quoteWarning=quoteDiffers?\`Клиент видел \${money(clientTotal)} · сервер \${money(authoritativeTotal)}\`:'';
      const deliveryWarning=deliveryOutOfArea?'Доставка за пределами стандартной зоны':(deliveryPending?'Доставка требует уточнения':'');`;
admin = replaceExactlyOnce(admin, leadStateMarker, leadTrustState, 'lead price trust state');

const leadTotalMarker = '<strong class="lead-total">${money(lead.total)}</strong>';
const leadTotalReplacement = '<div class="lead-price-box"><strong class="lead-total">${money(lead.total)}</strong><span class="lead-quote-badge ${quoteBadgeClass}">${quoteBadgeText}</span>${quoteWarning?`<span class="lead-price-warning">${quoteWarning}</span>`:\'\'}${deliveryWarning?`<span class="lead-delivery-warning">${deliveryWarning}</span>`:\'\'}</div>';
admin = replaceExactlyOnce(admin, leadTotalMarker, leadTotalReplacement, 'lead price trust display');
await writeFile(adminPath, admin, 'utf8');

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

const siteBundle = await readFile(path.join(output, 'site.bundle.js'), 'utf8');
const publicIndex = await readFile(path.join(output, 'index.html'), 'utf8');
const directionsIndex = await readFile(path.join(output, 'napravleniya/index.html'), 'utf8');
const robots = await readFile(path.join(output, 'robots.txt'), 'utf8');
const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
const defaults = JSON.parse(await readFile(path.join(output, 'backend/defaults.json'), 'utf8'));
const excelValidation = await readFile(excelValidationPath, 'utf8');

const globalRobotsHeaderBlocksIndexing = /Header\s+(?:always\s+)?set\s+X-Robots-Tag\s+["'][^"']*(?:noindex|nofollow|noarchive)/i.test(htaccess);
const canonicalVorotaRedirect = /RewriteRule\s+\^vorota\/\?\$\s+\/\s+\[R=(?:301|308),L\]/i.test(htaccess);
const gateModelCount = Object.keys(defaults?.gateCalcModels?.models || {}).length;

const checks = [
  [htaccess.includes('RewriteCond %{HTTP:X-Forwarded-Proto} !https [NC]'), 'HTTPS proxy-aware redirect is missing'],
  [htaccess.includes('Strict-Transport-Security'), 'HSTS header is missing'],
  [htaccess.includes('RewriteRule ^api/(.*)$ local-api.php?__route=$1 [QSA,L]'), 'production API is not routed to local PHP'],
  [!htaccess.includes('api-proxy.php?__proxy_path'), 'production .htaccess still references legacy Cloudflare proxy'],
  [!globalRobotsHeaderBlocksIndexing, 'production .htaccess globally blocks search indexing'],
  [canonicalVorotaRedirect, '/vorota is not permanently redirected to the canonical root URL'],
  [api.includes('$healthy ? 200 : 503'), 'health endpoint does not fail closed'],
  [!api.includes("'detail' => $e->getMessage()"), 'public API still exposes exception details'],
  [api.includes("require_once __DIR__ . '/backend/gate-quote.php';") && api.includes('kd_create_authoritative_lead();'), 'lead endpoint does not use authoritative PHP pricing'],
  [api.includes("require_once __DIR__ . '/backend/excel-quote-validation.php';") && api.includes('kd_gate_validate_excel_payload($body)'), 'admin Excel import does not use authoritative PHP validation'],
  [excelValidation.includes('kd_gate_standard_prices') && excelValidation.includes('kd_gate_validate_excel_payload'), 'Excel pricing validation helper is incomplete'],
  [gateModelCount === 38, `authoritative PHP pricing has ${gateModelCount} gate models instead of 38`],
  [!gateQuote.includes("'Math.trunc' => trunc("), 'gate formula engine still calls unavailable PHP trunc()'],
  [admin.includes('<script src="/xlsx.bundle.js"></script>'), 'admin does not use the external XLSX bundle'],
  [!admin.includes('unsupported format |'), 'XLSX implementation is still inlined into admin HTML'],
  [admin.includes('✓ Проверено сервером') && admin.includes('⚠ Цена требует проверки') && admin.includes('Доставка требует уточнения'), 'admin lead price verification indicators are missing'],
  [siteBundle.includes('С учётом доставки'), 'delivery-inclusive catalog pricing is missing from the public bundle'],
  [publicIndex.includes('content="index,follow,max-image-preview:large"'), 'public home page is not indexable'],
  [!publicIndex.toLowerCase().includes('noindex'), 'public home page contains noindex'],
  [directionsIndex.includes('content="index,follow,max-image-preview:large"'), 'directions page is not indexable'],
  [!directionsIndex.toLowerCase().includes('noindex'), 'directions page contains noindex'],
  [robots.includes('Sitemap: https://kuzdvor.tw1.ru/sitemap.xml'), 'robots.txt sitemap directive is missing'],
  [sitemap.includes('<loc>https://kuzdvor.tw1.ru/</loc>'), 'sitemap is missing the canonical home URL'],
  [publicIndex.includes('"@type":"LocalBusiness"'), 'LocalBusiness JSON-LD is missing from home page']
];
for (const [ok, message] of checks) {
  if (!ok) throw new Error(`Timeweb hardening: ${message}`);
}

execFileSync('php', ['-l', apiPath], { stdio: 'inherit' });
execFileSync('php', ['-l', gateQuotePath], { stdio: 'inherit' });
execFileSync('php', ['-l', excelValidationPath], { stdio: 'inherit' });
execFileSync('php', [path.join(root, 'scripts/test-timeweb-gate-quote.php'), output], { stdio: 'inherit' });

console.log(`Timeweb package hardening checks passed for ${sourceSha}`);