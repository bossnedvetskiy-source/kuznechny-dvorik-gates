import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, gatePageCss, catalogImages, pricesSource, deliveryPricesSource, customerContextSource, deliverySharedSource, leadsSharedSource, js, runtimePriceAdjustmentSource, publicSiteJsSource, gatePageUiSource, colorPhotoSiteSource, adminHtmlSource, adminCss, adminJsSource, adminColorsJsSource, adminPricesJsSource, adminSiteJsSource, adminDeliveryJsSource, adminLeadsJsSource, adminWorkflowJsSource, adminTabsFixJsSource, adminHistoryJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, catalogColorsSource, gateQuoteSource, leadAntispamSource, leadsSource, adminEnhancementsSource] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('home.html', 'utf8'),
  readFile('home.css', 'utf8'),
  readFile('product-categories.js', 'utf8'),
  readFile('styles.css', 'utf8'),
  readFile('storefront.css', 'utf8'),
  readFile('gate-page.css', 'utf8'),
  readFile('catalog-images.js', 'utf8'),
  readFile('prices.js', 'utf8'),
  readFile('delivery-prices.json', 'utf8'),
  readFile('shared/customer-context.js', 'utf8'),
  readFile('shared/delivery.js', 'utf8'),
  readFile('shared/leads.js', 'utf8'),
  readFile('app.js', 'utf8'),
  readFile('runtime-price-adjustment.js', 'utf8'),
  readFile('public-site-settings.js', 'utf8'),
  readFile('gate-page-ui.js', 'utf8'),
  readFile('color-photo-site.js', 'utf8'),
  readFile('admin.html', 'utf8'),
  readFile('admin.css', 'utf8'),
  readFile('admin.js', 'utf8'),
  readFile('admin-colors.js', 'utf8'),
  readFile('admin-prices.js', 'utf8'),
  readFile('admin-site.js', 'utf8'),
  readFile('admin-delivery.js', 'utf8'),
  readFile('admin-leads.js', 'utf8'),
  readFile('admin-workflow.js', 'utf8'),
  readFile('admin-tabs-fix.js', 'utf8'),
  readFile('admin-history.js', 'utf8'),
  readFile('worker/runtime.js', 'utf8'),
  readFile('worker/auth-d1.js', 'utf8'),
  readFile('worker/site-settings-d1.js', 'utf8'),
  readFile('worker/catalog-media-d1.js', 'utf8'),
  readFile('worker/catalog-colors-d1.js', 'utf8'),
  readFile('worker/gate-quote-d1.js', 'utf8'),
  readFile('worker/lead-antispam.js', 'utf8'),
  readFile('worker/leads-d1.js', 'utf8'),
  readFile('worker/admin-enhancements-d1.js', 'utf8')
]);

const gateCalcSources = await Promise.all([
  readFile('gate-calc-prices.js', 'utf8'),
  readFile('gate-calc-models-chunk1.js', 'utf8'),
  readFile('gate-calc-models-chunk2.js', 'utf8'),
  readFile('gate-calc-models-chunk3.js', 'utf8'),
  readFile('gate-calc-models-chunk4.js', 'utf8'),
  readFile('gate-calc-models.js', 'utf8'),
  readFile('gate-calc-engine.js', 'utf8')
]);
const gateCalcBundle = gateCalcSources.join('\n');

const gatePricesMatch = gateCalcSources[0].match(/window\.GATE_CALC_PRICES\s*=\s*({[\s\S]*});?\s*$/);
if (!gatePricesMatch) throw new Error('Не удалось подготовить серверные цены формул ворот');
const defaultGateCalcPrices = Function(`"use strict"; return (${gatePricesMatch[1]});`)();
const compressedGateModels = gateCalcSources.slice(1,5).map((source,index) => {
  const match = source.match(/\+\s*'([^']+)'\s*;?\s*$/);
  if (!match) throw new Error(`Не удалось прочитать часть расчётных моделей ${index+1}`);
  return match[1];
}).join('');
const gateModelsScript = gunzipSync(Buffer.from(compressedGateModels, 'base64')).toString('utf8');
const rawGateModels = Function('window', '"use strict";\n' + gateModelsScript + '\nreturn window.GATE_CALC_MODELS;')({});
if (!rawGateModels?.models) throw new Error('Не удалось распаковать серверные модели ворот');
const serverGateModelSource = `{models:{${Object.entries(rawGateModels.models || {}).map(([key,model]) => {
  const formulas = Object.entries(model.formulas || {}).map(([ref,expr]) => `${JSON.stringify(ref)}:(ctx,p,v,sum,roundExcel,roundUp)=>(${expr})`).join(',');
  return `${JSON.stringify(key)}:{gateRef:${JSON.stringify(model.gateRef)},wicketRef:${JSON.stringify(model.wicketRef)},standard:${JSON.stringify(model.standard || {})},literals:${JSON.stringify(model.literals || {})},formulas:{${formulas}}}`;
}).join(',')}}}`;

const deliveryPrices = JSON.parse(deliveryPricesSource);
if (!Number.isFinite(deliveryPrices.fallbackRatePerKm) || !deliveryPrices.origin) {
  throw new Error('Некорректный файл delivery-prices.json');
}
const galleryMatch = catalogImages.match(/window\.CATALOG_IMAGES\s*=\s*({[\s\S]*?});\s*$/);
if (!galleryMatch) throw new Error('Некорректный файл catalog-images.js');
const defaultGalleries = JSON.parse(galleryMatch[1]);
const pricesMatch = pricesSource.match(/window\.PRICE_DATA\s*=\s*({[\s\S]*?});\s*$/);
if (!pricesMatch) throw new Error('Некорректный файл prices.js');
const defaultPrices = Function(`"use strict"; return (${pricesMatch[1]});`)();

const publicJs = js;

const homeHtml = homeHtmlSource
  .replace('<link rel="stylesheet" href="home.css">', `<style>${homeCss}</style>`)
  .replace('<script src="product-categories.js"></script>', `<script>${productCategoriesSource}</script>`);

const html = htmlSource
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}\n${storefrontCss}\n${gatePageCss}</style>`)
  .replace('<link rel="stylesheet" href="storefront.css">', '')
  .replace('<link rel="stylesheet" href="gate-page.css">', '')
  .replace('<script id="deliveryData" type="application/json">{}</script>', '<script id="deliveryData" type="application/json">__RUNTIME_DELIVERY_DATA__</script>')
  .replace('<script src="catalog-images.js"></script>', `<script>${catalogImages}</script>`)
  .replace('<script src="prices.js"></script>', '<script>window.PRICE_DATA=__RUNTIME_PRICE_DATA__;window.SITE_SETTINGS=__RUNTIME_SITE_DATA__;</script>')
  .replace('<script src="gate-calc-prices.js"></script>', `<script>${gateCalcBundle}</script>`)
  .replace('<script src="gate-calc-models-chunk1.js"></script>', '')
  .replace('<script src="gate-calc-models-chunk2.js"></script>', '')
  .replace('<script src="gate-calc-models-chunk3.js"></script>', '')
  .replace('<script src="gate-calc-models-chunk4.js"></script>', '')
  .replace('<script src="gate-calc-models.js"></script>', '')
  .replace('<script src="gate-calc-engine.js"></script>', '')
  .replace('<script src="shared/customer-context.js"></script>', `<script>${customerContextSource}</script>`)
  .replace('<script src="shared/delivery.js"></script>', `<script>${deliverySharedSource}</script>`)
  .replace('<script src="shared/leads.js"></script>', `<script>${leadsSharedSource}</script>`)
  .replace('<script src="app.js"></script>', `<script>${runtimePriceAdjustmentSource}\n${publicJs}</script>`)
  .replace('<script src="public-site-settings.js"></script>', `<script>${publicSiteJsSource}</script>`)
  .replace('<script src="gate-page-ui.js"></script>', `<script>${gatePageUiSource}\n${colorPhotoSiteSource}</script>`);

const adminJs = adminJsSource;

const adminHtml = adminHtmlSource
  .replace('<link rel="stylesheet" href="admin.css">', `<style>${adminCss}</style>`)
  .replace('<script src="admin.js"></script>', `<script>${adminJs}\n${adminColorsJsSource}</script>`)
  .replace('<script src="admin-prices.js"></script>', `<script>${adminPricesJsSource}</script><script>${adminSiteJsSource}</script><script>${adminDeliveryJsSource}</script><script>${adminLeadsJsSource}</script><script>${adminWorkflowJsSource}</script><script>${adminTabsFixJsSource}</script><script>${adminHistoryJsSource}</script>`);

const workerModules = [
  adminAuthSource,
  siteSettingsSource,
  leadAntispamSource,
  gateQuoteSource,
  catalogMediaSource,
  catalogColorsSource,
  leadsSource,
  adminEnhancementsSource
].map(source => source.trim()).join('\n\n');
if (!workerSource.includes('/*__WORKER_MODULES__*/')) throw new Error('Не найден маркер модулей Worker');
const patchedWorkerSource = workerSource.replace('/*__WORKER_MODULES__*/', workerModules);

for (const requiredWorkerFeature of ['calculateAuthoritativeGateQuote','consumeLeadAttempt','DEFAULT_GATE_CALC_MODELS','DEFAULT_DELIVERY_PRICES','lead_workflow','delivery_prices']) {
  if (!patchedWorkerSource.includes(requiredWorkerFeature)) throw new Error(`Worker assembly missing ${requiredWorkerFeature}`);
}

const worker = patchedWorkerSource
  .replace('__PUBLIC_PAGE__', JSON.stringify(html))
  .replace('__HOME_PAGE__', JSON.stringify(homeHtml))
  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))
  .replace('__DEFAULT_GALLERIES__', JSON.stringify(defaultGalleries))
  .replace('__DEFAULT_PRICES__', JSON.stringify(defaultPrices))
  .replace('__DEFAULT_GATE_CALC_PRICES__', JSON.stringify(defaultGateCalcPrices))
  .replace('__DEFAULT_GATE_CALC_MODELS__', serverGateModelSource)
  .replace('__DEFAULT_DELIVERY_PRICES__', JSON.stringify(deliveryPrices))
  .replace('__DELIVERY_ORIGIN__', JSON.stringify(deliveryPrices.origin))
  .replace('__DELIVERY_RATE__', String(deliveryPrices.fallbackRatePerKm));

await writeFile('dist/server/index.js', worker, 'utf8');
await writeFile('dist/client/.keep', '', 'utf8');
await copyFile('assets/hero-gates.jpg', 'dist/client/hero-gates.jpg');
await copyFile('storefront.css', 'dist/client/storefront.css');
await cp('assets/catalog', 'dist/client/catalog', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });