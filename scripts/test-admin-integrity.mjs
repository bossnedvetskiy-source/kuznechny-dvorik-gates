import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [enhancements, adminPrices, build, engine, quote, publicSettings, workerSettings, prices] = await Promise.all([
  read('admin-enhancements.js'),
  read('admin-prices.js'),
  read('scripts/build.mjs'),
  read('gate-calc-engine.js'),
  read('worker/gate-quote-d1.js'),
  read('public-site-settings.js'),
  read('worker/site-settings-d1.js'),
  read('prices.js')
]);

const required = [
  [enhancements, 'reconcileTab', 'admin tab reconciliation'],
  [enhancements, 'CSV с рекламой', 'marketing CSV export'],
  [enhancements, 'Источник цен ворот — Excel', 'Excel price source explanation'],
  [enhancements, 'utmCampaign', 'lead campaign rendering'],
  [adminPrices, 'Цены ворот не редактируются вручную', 'read-only gate price admin'],
  [adminPrices, 'Цена — из Excel-расчёта', 'catalog Excel source label'],
  [build, "readFile('admin-enhancements.js'", 'production admin bundle'],
  [engine, 'standardForArticle', 'Excel standard price API'],
  [quote, 'const productPrice = calculateGateProductServer', 'server formula-only price'],
  [publicSettings, 'syncExcelDerivedGatePrices', 'catalog price sync from formulas'],
  [workerSettings, 'price:defaultItem.price', 'server rejection of manual catalog price overrides'],
  [prices, 'Источник цены ворот — Excel-derived расчёт', 'fallback price file warning'],
  [publicSettings, "technicalHost ? 'noindex,follow'", 'technical-host noindex']
];

const forbidden = [
  [engine, 'runtimeCatalogPrice', 'browser manual price override'],
  [engine, 'targetStandardPrice', 'browser manual standard baseline'],
  [quote, 'gateProductPriceWithRuntimeBaseline', 'server manual price override'],
  [quote, 'targetStandard - standardCalculated', 'server manual standard baseline']
];

let failures = 0;
for (const [source, needle, label] of required) {
  if (!source.includes(needle)) {
    failures += 1;
    console.error(`ADMIN INTEGRITY FAIL: missing ${label}`);
  }
}
for (const [source, needle, label] of forbidden) {
  if (source.includes(needle)) {
    failures += 1;
    console.error(`ADMIN INTEGRITY FAIL: forbidden ${label}`);
  }
}

if (!failures) console.log('Admin integrity checks passed');
if (failures) process.exit(1);
