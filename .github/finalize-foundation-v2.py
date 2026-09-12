from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label}: expected source not found')

# --- worker/runtime.js: turn it into an explicit composition template ---
p = Path('worker/runtime.js')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "const PAGE = __PUBLIC_PAGE__;\nconst ADMIN_PAGE = __ADMIN_PAGE__;\nconst DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\nconst ORIGIN = __DELIVERY_ORIGIN__;\nconst FALLBACK_RATE = __DELIVERY_RATE__;",
    "const PAGE = __PUBLIC_PAGE__;\nconst HOME_PAGE = __HOME_PAGE__;\nconst ADMIN_PAGE = __ADMIN_PAGE__;\nconst DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;\nconst DEFAULT_GATE_CALC_PRICES = __DEFAULT_GATE_CALC_PRICES__;\nconst DEFAULT_GATE_CALC_MODELS = __DEFAULT_GATE_CALC_MODELS__;\nconst DEFAULT_DELIVERY_PRICES = __DEFAULT_DELIVERY_PRICES__;\nconst ORIGIN = __DELIVERY_ORIGIN__;\nconst FALLBACK_RATE = __DELIVERY_RATE__;",
    'runtime constants'
)
start = s.find('async function createSessionCookie(env) {')
end = s.find('function defaultGallery(article) {', start)
if start >= 0:
    if end < 0:
        raise SystemExit('runtime auth block end missing')
    s = s[:start] + '/*__WORKER_MODULES__*/\n\n' + s[end:]
elif '/*__WORKER_MODULES__*/' not in s:
    raise SystemExit('runtime module marker missing')

s = s.replace(
    "if (!env.DB || !env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);",
    "if (!env.DB) return json({error: 'База данных временно недоступна'}, 503);"
)
s = s.replace(
    "await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => env.BUCKET.delete(key)));",
    "await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => deleteCatalogMediaObject(env, key)));"
)
s = s.replace(
    "await Promise.allSettled(keys.map(key => env.BUCKET.delete(key)));",
    "await Promise.allSettled(keys.map(key => deleteCatalogMediaObject(env, key)));"
)

upload_start = s.find('async function uploadPhoto(request, env, article) {')
upload_end = s.find('\nasync function serveCatalogMedia', upload_start)
if upload_start >= 0:
    if upload_end < 0:
        raise SystemExit('runtime upload function end missing')
    s = s[:upload_start] + "async function uploadPhoto(request, env, article) {\n  return storeCatalogMedia(request, env, article);\n}\n" + s[upload_end:]
serve_start = s.find('async function serveCatalogMedia(env, pathname) {')
serve_end = s.find('\nconst haversine', serve_start)
if serve_start >= 0:
    if serve_end < 0:
        raise SystemExit('runtime serve function end missing')
    s = s[:serve_start] + "async function serveCatalogMedia(env, pathname) {\n  return readCatalogMedia(env, pathname);\n}\n" + s[serve_end:]

old_catalog_route = """  if (url.pathname === '/api/admin/catalog' && request.method === 'GET') {
    try {
      return json({galleries: await allGalleries(env, true)});"""
new_catalog_route = """  if (url.pathname === '/api/admin/site-settings') {
    try {
      if (request.method === 'GET') return json({site: await loadSiteProfile(env)});
      if (request.method === 'POST') return await saveSiteProfile(request, env);
      return json({error: 'Метод не поддерживается'}, 405);
    } catch (error) {
      return json({error: 'Не удалось сохранить настройки сайта: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname === '/api/admin/prices') {
    try {
      if (request.method === 'GET') return json({prices: await loadPrices(env)});
      if (request.method === 'POST') return await savePrices(request, env);
      return json({error: 'Метод не поддерживается'}, 405);
    } catch (error) {
      return json({error: 'Не удалось сохранить цены: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname === '/api/admin/leads' && request.method === 'GET') {
    try {
      return json(await listLeads(env));
    } catch (error) {
      return json({error: 'Не удалось загрузить заявки: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname.startsWith('/api/admin/leads/') && request.method === 'POST') {
    try {
      return await updateLeadStatus(request, env, url.pathname.slice('/api/admin/leads/'.length));
    } catch (error) {
      return json({error: 'Не удалось обновить заявку: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname === '/api/admin/catalog' && request.method === 'GET') {
    try {
      return json({galleries: await allGalleries(env, true), photoUploadEnabled: Boolean(env.BUCKET || env.DB)});"""
if old_catalog_route in s:
    s = s.replace(old_catalog_route, new_catalog_route, 1)
elif "url.pathname === '/api/admin/site-settings'" not in s:
    raise SystemExit('runtime admin route anchor missing')

old_public = """    if (url.pathname.startsWith('/catalog-media/')) return serveCatalogMedia(env, url.pathname);
    if (url.pathname === '/api/catalog-images' && request.method === 'GET') {"""
new_public = """    if (url.pathname.startsWith('/catalog-media/')) return serveCatalogMedia(env, url.pathname);
    if (url.pathname === '/api/leads') {
      if (request.method !== 'POST') return json({error: 'Метод не поддерживается'}, 405);
      try {
        return await createLead(request, env, url);
      } catch (error) {
        return json({error: 'Не удалось сохранить заявку: ' + errorMessage(error)}, 500);
      }
    }
    if (url.pathname === '/api/catalog-images' && request.method === 'GET') {"""
if old_public in s:
    s = s.replace(old_public, new_public, 1)
elif "url.pathname === '/api/leads'" not in s:
    raise SystemExit('runtime public lead route anchor missing')

old_root = """    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    return html(PAGE);"""
new_root = """    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});
    if (url.pathname === '/napravleniya' || url.pathname === '/napravleniya/') return html(await renderProductHub(env));
    if (url.pathname !== '/' && url.pathname !== '/index.html' && url.pathname !== '/vorota' && url.pathname !== '/vorota/') return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    return html(await renderPublicPage(env));"""
s = replace_once(s, old_root, new_root, 'runtime public routes')
p.write_text(s, encoding='utf-8')

# --- scripts/build.mjs: compose modules only at an explicit marker ---
p = Path('scripts/build.mjs')
s = p.read_text(encoding='utf-8')
start = s.find("const authStart = workerSource.indexOf('async function createSessionCookie(env)');")
end = s.find('for (const requiredWorkerFeature', start)
if start >= 0 and end >= 0:
    simple = """const workerModules = [
  adminAuthSource,
  siteSettingsSource,
  leadAntispamSource,
  gateQuoteSource,
  catalogMediaSource,
  leadsSource
].map(source => source.trim()).join('\\n\\n');
if (!workerSource.includes('/*__WORKER_MODULES__*/')) throw new Error('Не найден маркер модулей Worker');
const patchedWorkerSource = workerSource.replace('/*__WORKER_MODULES__*/', workerModules);

"""
    s = s[:start] + simple + s[end:]
elif "workerSource.replace('/*__WORKER_MODULES__*/', workerModules)" not in s:
    raise SystemExit('build worker composition block missing')
p.write_text(s, encoding='utf-8')

# --- worker/lead-antispam.js: D1-backed limit shared by all Worker isolates ---
Path('worker/lead-antispam.js').write_text("""let leadRateSchemaReady = false;
const LEAD_RATE_WINDOW_SECONDS = 10 * 60;
const LEAD_RATE_MAX = 8;
let leadRateCleanupTick = 0;

async function ensureLeadRateSchema(env) {
  if (!env.DB) return false;
  if (!leadRateSchemaReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_rate_limits (
      rate_key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    )`).run();
    leadRateSchemaReady = true;
  }
  return true;
}

async function leadClientKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const fallback = (request.headers.get('user-agent') || 'unknown').slice(0, 160);
  return digestHex(ip ? `ip:${ip}` : `ua:${fallback}`);
}

async function consumeLeadAttempt(request, env) {
  if (!await ensureLeadRateSchema(env)) return {allowed:true, retryAfterSeconds:0};
  const now = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(now / LEAD_RATE_WINDOW_SECONDS) * LEAD_RATE_WINDOW_SECONDS;
  const expiresAt = bucketStart + LEAD_RATE_WINDOW_SECONDS;
  const client = await leadClientKey(request);
  const rateKey = `${client}:${bucketStart}`;
  await env.DB.prepare(`INSERT INTO lead_rate_limits (rate_key, count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at`)
    .bind(rateKey, expiresAt).run();
  const row = await env.DB.prepare('SELECT count FROM lead_rate_limits WHERE rate_key = ?').bind(rateKey).first();
  const count = Number(row?.count) || 1;
  leadRateCleanupTick += 1;
  if (leadRateCleanupTick % 64 === 0) {
    try { await env.DB.prepare('DELETE FROM lead_rate_limits WHERE expires_at < ?').bind(now - LEAD_RATE_WINDOW_SECONDS).run(); } catch {}
  }
  return {
    allowed: count <= LEAD_RATE_MAX,
    retryAfterSeconds: count <= LEAD_RATE_MAX ? 0 : Math.max(1, expiresAt - now)
  };
}

function honeypotTriggered(body) {
  return Boolean(String(body?.website || body?.company_site || '').trim());
}
""", encoding='utf-8')

p = Path('worker/leads-d1.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, '  const rate = consumeLeadAttempt(request);', '  const rate = await consumeLeadAttempt(request, env);', 'lead rate await')
p.write_text(s, encoding='utf-8')

# --- Playwright becomes mandatory in CI ---
p = Path('package.json')
package = json.loads(p.read_text(encoding='utf-8'))
package.setdefault('scripts', {})['test:e2e'] = 'playwright test'
package.setdefault('devDependencies', {})['@playwright/test'] = '1.55.0'
p.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

p = Path('.github/workflows/deploy-preview.yml')
s = p.read_text(encoding='utf-8')
old = """      - name: Check built Worker syntax
        run: node --check dist/server/index.js

      - name: Configure Pages"""
new = """      - name: Check built Worker syntax
        run: node --check dist/server/index.js

      - name: Install browser tests
        run: |
          npm install --no-audit --no-fund
          npx playwright install --with-deps chromium

      - name: Run browser E2E tests
        run: npm run test:e2e

      - name: Configure Pages"""
s = replace_once(s, old, new, 'deploy workflow e2e')
p.write_text(s, encoding='utf-8')

# --- strengthen existing regression guard ---
p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
marker = "assert(antiSpam.includes('honeypotTriggered') && antiSpam.includes('LEAD_RATE_MAX'), 'Public lead anti-spam guard missing');"
extra = marker + "\nassert(antiSpam.includes('lead_rate_limits') && antiSpam.includes('env.DB.prepare'), 'Lead rate limit must be globally backed by D1');\nassert(workerLeads.includes('await consumeLeadAttempt(request, env)'), 'Lead endpoint must await global rate limiting');\nassert(workerLeads.includes('quote?.total ?? clientTotal') && workerLeads.includes('quote_mismatch'), 'Server quote must override and audit client totals');\nassert(workerRuntime.includes('/*__WORKER_MODULES__*/'), 'Worker runtime must expose a module composition marker');\nassert(workerRuntime.includes(\"url.pathname === '/api/leads'\") && workerRuntime.includes(\"url.pathname === '/api/admin/site-settings'\"), 'Worker routes must live in runtime source');\nassert(!build.includes('const authStart = workerSource.indexOf') && !build.includes('const uploadStart = patchedWorkerSource.indexOf') && !build.includes('const serveStart = patchedWorkerSource.indexOf'), 'Build must not surgically rewrite Worker function bodies');"
if 'globally backed by D1' not in s:
    if marker not in s:
        raise SystemExit('foundation assertion marker missing')
    s = s.replace(marker, extra, 1)
p.write_text(s, encoding='utf-8')

# --- authoritative quote test: browser-supplied total is ignored ---
p = Path('scripts/test-server-gate-quote.mjs')
s = p.read_text(encoding='utf-8')
marker = "console.log(`Server quote control cases: ${cases.length}; failures: ${failures}`);"
if 'AUTHORITATIVE QUOTE FAIL' not in s:
    block = """context.DEFAULT_DELIVERY_PRICES = {destinations:[{name:'Мелеуз',price:0}], fallbackRatePerKm:90, origin:{name:'Мелеуз'}};
context.loadPrices = async () => ({catalogInstallation:8000,catalogPosts:25000,catalog:[{art:'Арт.6',visible:true}]});
context.loadSiteProfile = async () => ({serviceAreaKm:150,deliveryRate:90});
context.calculateUnknownDelivery = async () => ({shortName:'Тестово',price:9000,distanceKm:100,serviceAreaKm:150,outOfArea:false});
const authoritative = await context.calculateAuthoritativeGateQuote({
  article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:false,city:'Мелеуз',total:1
}, {});
if (authoritative.total !== 64600 || !authoritative.quoteVerified) {
  failures += 1;
  console.error(`AUTHORITATIVE QUOTE FAIL: expected 64600 verified, got ${authoritative.total}`);
}
const authoritativePosts = await context.calculateAuthoritativeGateQuote({
  article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:true,city:'Мелеуз',total:9999999
}, {});
if (authoritativePosts.total !== 89600) {
  failures += 1;
  console.error(`AUTHORITATIVE POSTS FAIL: expected 89600, got ${authoritativePosts.total}`);
}

"""
    if marker not in s:
        raise SystemExit('server quote log marker missing')
    s = s.replace(marker, block + marker, 1)
p.write_text(s, encoding='utf-8')

print('Foundation v2 changes prepared')
