import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [pricesJs, quoteJs, ...chunks] = await Promise.all([
  read('gate-calc-prices.js'),
  read('worker/gate-quote-d1.js'),
  read('gate-calc-models-chunk1.js'),
  read('gate-calc-models-chunk2.js'),
  read('gate-calc-models-chunk3.js'),
  read('gate-calc-models-chunk4.js')
]);

const context = {console, Intl};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(pricesJs, context, {filename:'gate-calc-prices.js'});
for (let i=0;i<chunks.length;i+=1) vm.runInContext(chunks[i], context, {filename:`chunk-${i+1}.js`});
const modelSource = gunzipSync(Buffer.from(context.__GATE_CALC_B64, 'base64')).toString('utf8');
vm.runInContext(modelSource, context, {filename:'excel-derived-models.js'});

for (const model of Object.values(context.GATE_CALC_MODELS.models || {})) {
  const compiled = {};
  for (const [ref, expr] of Object.entries(model.formulas || {})) {
    compiled[ref] = new Function('ctx','p','v','sum','roundExcel','roundUp', `return (${expr});`);
  }
  model.formulas = compiled;
}

context.DEFAULT_GATE_CALC_PRICES = context.GATE_CALC_PRICES;
context.DEFAULT_GATE_CALC_MODELS = context.GATE_CALC_MODELS;
context.DEFAULT_DELIVERY_PRICES = {destinations:[], fallbackRatePerKm:90, origin:{name:'Мелеуз'}};
vm.runInContext(quoteJs, context, {filename:'worker/gate-quote-d1.js'});

const cases = [
  ['6',3.4,1.8,1,1.8,56600],
  ['6',3.8,1.8,1,1.8,61300],
  ['6',3.4,2,1,2,59300],
  ['6',3.4,1.8,1.1,1.8,56900],
  ['6',4,2,1.1,2,65400],
  ['17С',3.4,1.8,1,1.8,90000],
  ['17С',3.8,1.8,1,1.8,96700],
  ['17С',3.4,2,1,2,93900],
  ['17С',3.4,1.8,1.1,1.8,90300],
  ['17С',4,2,1.1,2,102800],
  ['38',3.4,1.8,1,1.8,76500],
  ['38',3.8,1.8,1,1.8,82600],
  ['38',3.4,2,1,2,80800],
  ['38',3.4,1.8,1.1,1.8,76700],
  ['38',4,2,1.1,2,88500],
  ['9-3',3.8,1.8,0.9,1.8,109400]
];

let failures=0;
for (const [article,gateWidth,gateHeight,wicketWidth,wicketHeight,expected] of cases) {
  const actual = context.calculateGateProductServer({article,gateWidth,gateHeight,wicketWidth,wicketHeight});
  if (actual !== expected) {
    failures += 1;
    console.error(`${article}: expected ${expected}, got ${actual}`);
  }
}

for (const [article, model] of Object.entries(context.GATE_CALC_MODELS.models)) {
  if (!model.standard) continue;
  const s=model.standard;
  const expected=Number(s.total_round100);
  const actual=context.calculateGateProductServer({
    article,
    gateWidth:Number(s.gate_width_m), gateHeight:Number(s.gate_height_m),
    wicketWidth:Number(s.wicket_width_m), wicketHeight:Number(s.wicket_height_m)
  });
  if (actual !== expected) {
    failures += 1;
    console.error(`STANDARD SERVER FAIL ${article}: expected ${expected}, got ${actual}`);
  }
}

context.DEFAULT_DELIVERY_PRICES = {destinations:[{name:'Мелеуз',price:0}], fallbackRatePerKm:90, origin:{name:'Мелеуз'}};
let runtimeArt6Price = 56600;
context.loadPrices = async () => ({catalogInstallation:8000,catalogPosts:25000,catalog:[{art:'Арт.6',price:runtimeArt6Price,visible:true}]});
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

runtimeArt6Price = 61600;
const adjustedStandard = await context.calculateAuthoritativeGateQuote({
  article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:false,city:'Мелеуз'
}, {});
const adjustedCustom = await context.calculateAuthoritativeGateQuote({
  article:'Арт.6',width:3.8,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:false,city:'Мелеуз'
}, {});
if (adjustedStandard.productPrice !== 61600 || adjustedCustom.productPrice !== 66300) {
  failures += 1;
  console.error(`SERVER RUNTIME BASELINE FAIL: expected 61600 / 66300, got ${adjustedStandard.productPrice} / ${adjustedCustom.productPrice}`);
}

console.log(`Server quote control cases: ${cases.length}; failures: ${failures}`);
console.log(`Server quote article models: ${Object.keys(context.GATE_CALC_MODELS.models).length}`);
if (failures) process.exit(1);
