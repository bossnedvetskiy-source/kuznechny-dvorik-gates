import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');

const [pricesJs, engineJs, ...chunks] = await Promise.all([
  read('gate-calc-prices.js'),
  read('gate-calc-engine.js'),
  read('gate-calc-models-chunk1.js'),
  read('gate-calc-models-chunk2.js'),
  read('gate-calc-models-chunk3.js'),
  read('gate-calc-models-chunk4.js'),
]);

const context = { console, Promise };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(pricesJs, context, { filename: 'gate-calc-prices.js' });
for (let i = 0; i < chunks.length; i += 1) vm.runInContext(chunks[i], context, { filename: `chunk-${i + 1}.js` });
const modelSource = gunzipSync(Buffer.from(context.__GATE_CALC_B64, 'base64')).toString('utf8');
vm.runInContext(modelSource, context, { filename: 'excel-derived-models.js' });
vm.runInContext(engineJs, context, { filename: 'gate-calc-engine.js' });

const cases = [
  ['6','Стандарт',3.4,1.8,1,1.8,38211.31716666667,18422.558583333335,56600],
  ['6','Ширина ворот 3,8',3.8,1.8,1,1.8,42918.87783333333,18422.558583333335,61300],
  ['6','Высота 2,0',3.4,2,1,2,40026.21591666667,19270.969083333333,59300],
  ['6','Ширина калитки 1,1',3.4,1.8,1.1,1.8,38211.31716666667,18731.115666666665,56900],
  ['6','Все размеры',4,2,1.1,2,45822.22991666667,19579.526166666667,65400],

  ['17С','Стандарт',3.4,1.8,1,1.8,64838.90790277778,25124.758575,90000],
  ['17С','Ширина ворот 3,8',3.8,1.8,1,1.8,71576.04993055556,25124.758575,96700],
  ['17С','Высота 2,0',3.4,2,1,2,67683.97312499999,26216.12740833333,93900],
  ['17С','Ширина калитки 1,1',3.4,1.8,1.1,1.8,64838.90790277778,25429.0638875,90300],
  ['17С','Все размеры',4,2,1.1,2,76301.6705,26520.432720833338,102800],

  ['38','Стандарт',3.4,1.8,1,1.8,55073.3860125,21457.011301893937,76500],
  ['38','Ширина ворот 3,8',3.8,1.8,1,1.8,61094.13647083334,21457.011301893937,82600],
  ['38','Высота 2,0',3.4,2,1,2,58111.66095694444,22720.166401641414,80800],
  ['38','Ширина калитки 1,1',3.4,1.8,1.1,1.8,55073.3860125,21584.092090822072,76700],
  ['38','Все размеры',4,2,1.1,2,65637.41681111112,22844.46142753378,88500],
];

const tolerance = 1e-6;
let failures = 0;
const rows = [];
for (const [article, scenario, gateWidth, gateHeight, wicketWidth, wicketHeight, excelGate, excelWicket, excelTotal] of cases) {
  const actual = context.GATE_CALC.calculateGate({ article, gateWidth, gateHeight, wicketWidth, wicketHeight });
  const gateDiff = actual.gatePrice - excelGate;
  const wicketDiff = actual.wicketPrice - excelWicket;
  const totalDiff = actual.total - excelTotal;
  const ok = Math.abs(gateDiff) <= tolerance && Math.abs(wicketDiff) <= tolerance && totalDiff === 0;
  if (!ok) failures += 1;
  rows.push({ article, scenario, excelTotal, siteTotal: actual.total, diffRub: totalDiff, ok });
}

for (const [article, model] of Object.entries(context.GATE_CALC_MODELS.models)) {
  if (!model.standard) continue;
  const s = model.standard;
  const expected = Number(s.total_round100);
  const actual = context.GATE_CALC.calculateGate({
    article,
    gateWidth: Number(s.gate_width_m),
    gateHeight: Number(s.gate_height_m),
    wicketWidth: Number(s.wicket_width_m),
    wicketHeight: Number(s.wicket_height_m),
  });
  if (!Number.isFinite(expected) || actual.total !== expected) {
    failures += 1;
    console.error(`STANDARD FAIL ${article}: expected ${expected}, got ${actual.total}`);
  }
}

const correctedRegressions = [
  ['9-3','Ворота 3,8; калитка 0,9',3.8,1.8,0.9,1.8,109400],
];
for (const [article, scenario, gateWidth, gateHeight, wicketWidth, wicketHeight, expectedTotal] of correctedRegressions) {
  const actual = context.GATE_CALC.calculateGate({article, gateWidth, gateHeight, wicketWidth, wicketHeight});
  const ok = actual.total === expectedTotal;
  if (!ok) failures += 1;
  rows.push({article, scenario, excelTotal: expectedTotal, siteTotal: actual.total, diffRub: actual.total - expectedTotal, ok});
}

// Even if stale/manual catalog data contains another number, it must never affect Excel-derived formulas.
context.PRICE_DATA = {catalog:[{art:'Арт.6',price:999999}]};
const protectedStandard = context.GATE_CALC.calculateGate({article:'Арт.6',gateWidth:3.4,gateHeight:1.8,wicketWidth:1,wicketHeight:1.8});
const protectedCustom = context.GATE_CALC.calculateGate({article:'Арт.6',gateWidth:3.8,gateHeight:1.8,wicketWidth:1,wicketHeight:1.8});
const standardInfo = context.GATE_CALC.standardForArticle('Арт.6');
if (protectedStandard.total !== 56600 || protectedCustom.total !== 61300 || standardInfo?.price !== 56600) {
  failures += 1;
  console.error(`EXCEL SOURCE FAIL: expected 56600 / 61300 / 56600, got ${protectedStandard.total} / ${protectedCustom.total} / ${standardInfo?.price}`);
}

console.table(rows);
console.log(`Control cases: ${cases.length + correctedRegressions.length}; failures: ${failures}`);
console.log(`Imported article models: ${Object.keys(context.GATE_CALC_MODELS.models).length}`);
if (failures) process.exit(1);
