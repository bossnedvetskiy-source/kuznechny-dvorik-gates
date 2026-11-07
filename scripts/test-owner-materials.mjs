import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateFence} from '../evroshtaketnik/engine.js';
import {buildOwnerReport, ownerReportHtml} from '../surveyor-app/owner-report.js';
import {buildOwnerDashboard, ownerDashboardHtml} from '../surveyor-app/owner-dashboard.js';
import {buildSlidingProduction, SLIDING_RATE_FIELDS, slidingRateKey} from '../surveyor-app/owner-sliding.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('surveyor-app/app.js');
const backend=read('timeweb/backend/surveyor.php');
const preview=read('scripts/build-dev-preview.mjs');
const html=read('surveyor-app/index.html');
const sw=read('surveyor-app/sw.js');
const selectedFence={
  id:'fence_1',type:'fence',title:'Забор · 10 м',total:73834,estimateRole:'included',
  payload:{configuration:{fenceType:'vertical-double',postType:'80x80x3',
    includeNewPosts:true,sections:[{length:10,height:1.8}],
    delivery:{known:true,manual:false,price:0}}}
};
const alternative={...selectedFence,id:'fence_alt',total:999999,estimateRole:'alternative'};
const gate={id:'gate_1',type:'gates',title:'Ворота',total:50000,estimateRole:'included'};
const survey={id:'survey_123456',number:'ЗМ-0018',status:'ready',address:'Тестовая улица',
  configuration:{calculations:[selectedFence,gate,alternative]}};
const quote=(selected,total)=>({selected,alternatives:[alternative],total});
const engine=calculateFence({type:'vertical-double',post:'80x80x3',
  includeNewPosts:true,sections:[{length:10,height:1.8}],deliveryCost:0});
assert.equal(engine.summary.check,'ГОТОВО');

let report=buildOwnerReport(survey,quote([selectedFence],selectedFence.total),{});
assert.equal(report.fenceRows.length,1);
assert.equal(report.estimated,true);
assert.equal(report.incomplete,false);
const p=report.fenceRows[0].result.purchase;
assert.deepEqual(p.pickets,engine.purchase.pickets);
assert.equal(report.fenceRows[0].result.summary.tubeStocks,engine.summary.tubeStocks);
assert.equal(p.pickets.reduce((s,x)=>s+x.frontBuy+x.rearBuy,0),
  p.pickets.reduce((s,x)=>s+x.totalBuy,0));
assert.ok(p.pickets.some(x=>x.frontBuy>0 && x.rearBuy>0));
assert.match(ownerReportHtml(report,quote([selectedFence],selectedFence.total)),/Перед факт/);
assert.match(ownerReportHtml(report,quote([selectedFence],selectedFence.total)),/Зад факт/);
assert.match(ownerReportHtml(report,quote([selectedFence],selectedFence.total)),/40×20×2/);
assert.match(ownerReportHtml(report,quote([selectedFence],selectedFence.total)),/Столбы/);

report=buildOwnerReport(survey,quote([selectedFence,gate],123834),{});
assert.equal(report.incomplete,true);
assert.equal(report.profit,null,'do not invent profit when gates lack costs');
report=buildOwnerReport(survey,quote([selectedFence,gate],123834),{gate_1:40000,extra:500});
assert.equal(report.incomplete,false);
assert.equal(report.profit,123834-report.fenceRows[0].cost-40500);
assert.notEqual(report.profit,123834-report.fenceRows[0].cost,'manual expenses apply');
const asLoss=buildOwnerReport(survey,quote([selectedFence],1000),{fence_1:3000,extra:100});
assert.equal(asLoss.profit,-2100);
assert.ok(ownerReportHtml(asLoss,quote([selectedFence],1000)).includes('-2'), 'Loss must be negative');
assert.equal(buildOwnerReport(survey,quote([selectedFence],73834),{}).fenceRows.length,1,
  'alternate expensive fence must not inflate chosen order');
const model=buildOwnerDashboard([survey],()=>quote([selectedFence,gate],123834),()=>({}));
assert.equal(model.orders,1);
assert.equal(model.profit,null);
assert.equal(model.front,p.pickets.reduce((s,x)=>s+x.frontBuy,0));
assert.equal(model.rear,p.pickets.reduce((s,x)=>s+x.rearBuy,0));
assert.match(ownerDashboardHtml(model),/Не хватает себестоимости/);
assert.match(ownerDashboardHtml(model,{preview:true}),/DEV-превью/);

// Sliding-gate production planning is built from the saved customer-safe geometry.
const sliding={
  id:'sliding_abc',type:'sliding',title:'Откатные ворота',total:115000,
  payload:{configuration:{width:4,height:1.8,frame:'prof',tail:'square',
    fill:true,paint:true,stand:true,bolts:true,install:true,distance:0,
    builtInWicket:true,builtInWidth:1,builtInMode:'center',builtInOffset:0}}
};
const plan=buildSlidingProduction(sliding,{});
assert.equal(plan.valid,true);
assert.equal(plan.stocks60,Math.ceil(plan.tube60/6));
assert.equal(plan.stocks20,Math.ceil(plan.tube20/6));
assert.equal(plan.wicket60>0,true);
assert.equal(plan.wicketInner20,0.92,'wicket door has 20×20 midspan crossbar');
assert.equal(plan.sheets,4);
assert.equal(plan.missing.includes('Зарплата маляра'),true);
assert.equal(plan.calculatedCost,null,'missing supplier and wage rates must block profit');
let ownerSlidingReport=buildOwnerReport(survey,quote([sliding],115000),{});
assert.equal(ownerSlidingReport.incomplete,true);
assert.equal(ownerSlidingReport.profit,null);
assert.match(ownerReportHtml(ownerSlidingReport,quote([sliding],115000)),/Зарплата сварщика/);
assert.match(ownerReportHtml(ownerSlidingReport,quote([sliding],115000)),/хлыстов/);
const privateRates=Object.fromEntries(SLIDING_RATE_FIELDS.map(field=>[
  slidingRateKey(sliding.id,field.key),field.initial??500
]));
const priced=buildSlidingProduction(sliding,privateRates);
assert.equal(priced.missing.length,0);
assert.equal(priced.calculatedCost>0,true);
assert.equal(priced.wage,privateRates[slidingRateKey(sliding.id,'weldGate')]+
  privateRates[slidingRateKey(sliding.id,'weldWicket')]+
  priced.area*privateRates[slidingRateKey(sliding.id,'painter')]+
  privateRates[slidingRateKey(sliding.id,'cladding')]);
ownerSlidingReport=buildOwnerReport(survey,quote([sliding],115000),privateRates);
assert.equal(ownerSlidingReport.incomplete,false);
assert.equal(ownerSlidingReport.profit,115000-priced.calculatedCost);
const manual=buildOwnerReport(survey,quote([sliding],115000),{...privateRates,[sliding.id]:40000});
assert.equal(manual.profit,75000,'manual full cost replaces estimate; never double counts');
const horizontal={...sliding,payload:{configuration:{...sliding.payload.configuration,frame:'horizontal'}}};
const horizontalPlan=buildSlidingProduction(horizontal,{});
assert.equal(horizontalPlan.valid,true);
assert.ok(horizontalPlan.wicketInner20>plan.wicketInner20,'horizontal fill requires full 20×20 inner wicket frame');
const withoutWicket={...sliding,payload:{configuration:{...sliding.payload.configuration,builtInWicket:false}}};
assert.equal(buildSlidingProduction(withoutWicket,{}).wicket20,0);
assert.equal(buildSlidingProduction({...sliding,payload:{configuration:{width:99,height:2,frame:'prof',tail:'square'}}},{}).valid,false);
const swModule=read('surveyor-app/sw.js');
assert.match(swModule,/owner-sliding\.js/);

for(const [haystack,needle] of [
  [source,"currentUser?.role === 'owner' &&"],
  [source,'data-owner-detail-tab'],
  [source,"switchScreen(currentUser?.role === 'owner' ? 'owner' : 'surveys')"],
  [source,"sessionStorage.setItem('kd-owner-demo-'"],
  [source,"apiRequest('/owner-costs'"],
  [html,'id="ownerScreen"'],[html,'id="ownerNavBtn"'],
  [backend,'function kd_surveyor_owner_costs'],
  [backend,"kd_surveyor_require_session('owner')"],
  [backend,"unset($configuration['ownerCosts']);"],
  [backend,'surveyor_owner_costs'],
  [sw,'owner-dashboard.js'],[sw,'owner-report.js'],
  [preview,'owner-dashboard.js'],[preview,'owner-report.js']
]) assert.ok(haystack.includes(needle),'Missing: '+needle);
assert.ok(!source.includes('fresh.configuration.ownerCosts = next'),
  'Private cost data must not be stored in synced survey records');
console.log('Owner dashboard: engine quantities, margin, losses, role isolation and PWA structure OK');
