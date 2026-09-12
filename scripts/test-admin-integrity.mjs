import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [enhancements, adminPrices, excelAdmin, formulaSite, build, engine, quote, excelWorker, publicSettings, workerSettings, prices] = await Promise.all([
  read('admin-enhancements.js'),
  read('admin-prices.js'),
  read('admin-excel-import.js'),
  read('gate-formula-prices-site.js'),
  read('scripts/build.mjs'),
  read('gate-calc-engine.js'),
  read('worker/gate-quote-d1.js'),
  read('worker/excel-pricing-d1.js'),
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
  [adminPrices, 'if (window.KUZDVOR_ADMIN_EXCEL_READY) return;', 'Excel importer survives settings rerender'],
  [excelAdmin, 'gateExcelInput', 'Excel file chooser'],
  [excelAdmin, 'Скачать текущий Excel', 'Excel download button'],
  [excelAdmin, "fetch('/api/admin/gate-excel/file'", 'Excel binary upload/download API usage'],
  [excelAdmin, 'x-file-sha256', 'Excel file integrity header'],
  [excelAdmin, 'XLSX.read', 'Excel workbook parser'],
  [excelAdmin, "workbook.Sheets?.['Лист3']", 'material price source sheet'],
  [excelAdmin, '/api/admin/gate-excel', 'Excel publish API'],
  [excelAdmin, 'Публикация заблокирована', 'formula drift protection'],
  [excelAdmin, 'Ожидалось 38 используемых моделей', '38-model Excel validation'],
  [excelAdmin, 'Boolean(currentState?.fileAvailable)', 'first Excel publication without price changes'],
  [formulaSite, 'KUZDVOR_FORMULA_PRICE_SYNC_READY', 'formula catalog sync'],
  [build, "readFile('admin-excel-import.js'", 'production Excel admin bundle'],
  [build, "readFile('worker/excel-pricing-d1.js'", 'production Excel server module'],
  [build, 'xlsx.full.min.js', 'bundled XLSX reader'],
  [build, '__RUNTIME_GATE_CALC_PRICES__', 'runtime formula input injection'],
  [engine, 'standardForArticle', 'Excel standard price API'],
  [quote, 'loadGateCalcInputs(env)', 'server uploaded Excel inputs'],
  [quote, 'priceInputs = DEFAULT_GATE_CALC_PRICES', 'server formula input parameter'],
  [excelWorker, "GATE_EXCEL_SETTINGS_KEY = 'gate_excel_prices'", 'Excel D1 storage'],
  [excelWorker, 'gate_excel_file_chunks', 'stored Excel binary chunks'],
  [excelWorker, 'downloadGateExcelFile', 'authenticated Excel download'],
  [excelWorker, 'storeGateExcelFile', 'Excel binary storage'],
  [excelWorker, 'fileUploadId', 'active workbook pointer'],
  [excelWorker, 'gateExcelStandardPrices', 'server workbook validation'],
  [excelWorker, '/api/admin/gate-excel/file', 'authenticated Excel file API'],
  [excelWorker, '/api/admin/gate-excel', 'authenticated Excel API'],
  [publicSettings, 'syncExcelDerivedGatePrices', 'catalog price sync from formulas'],
  [workerSettings, 'loadGateCalcInputs(env)', 'public runtime formula inputs'],
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
