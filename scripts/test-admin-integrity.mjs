import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [enhancements, build, engine, quote, siteSettings] = await Promise.all([
  read('admin-enhancements.js'),
  read('scripts/build.mjs'),
  read('gate-calc-engine.js'),
  read('worker/gate-quote-d1.js'),
  read('public-site-settings.js')
]);

const required = [
  [enhancements, 'reconcileTab', 'admin tab reconciliation'],
  [enhancements, 'CSV с рекламой', 'marketing CSV export'],
  [enhancements, 'цена изделия — это базовая цена стандартного размера', 'price baseline explanation'],
  [enhancements, 'utmCampaign', 'lead campaign rendering'],
  [build, "readFile('admin-enhancements.js'", 'production admin bundle'],
  [engine, 'runtimeCatalogPrice', 'browser runtime price baseline'],
  [engine, 'targetStandardPrice - standard.total', 'browser price adjustment'],
  [quote, 'gateProductPriceWithRuntimeBaseline', 'server runtime price baseline'],
  [quote, 'targetStandard - standardCalculated', 'server price adjustment'],
  [siteSettings, "technicalHost ? 'noindex,follow'", 'technical-host noindex']
];

let failures = 0;
for (const [source, needle, label] of required) {
  if (!source.includes(needle)) {
    failures += 1;
    console.error(`ADMIN INTEGRITY FAIL: missing ${label}`);
  }
}

if (!failures) console.log('Admin integrity checks passed');
if (failures) process.exit(1);
