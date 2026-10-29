import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateFence} from '../evroshtaketnik/engine.js';
import {buildOwnerReport, ownerReportHtml} from '../surveyor-app/owner-report.js';
import {buildOwnerDashboard, ownerDashboardHtml} from '../surveyor-app/owner-dashboard.js';

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
assert.match(ownerReportHtml(asLoss,quote([selectedFence],1000)),/-2\\s?100\\s?₽/);
assert.equal(buildOwnerReport(survey,quote([selectedFence],73834),{}).fenceRows.length,1,
  'alternate expensive fence must not inflate chosen order');
const model=buildOwnerDashboard([survey],()=>quote([selectedFence,gate],123834),()=>({}));
assert.equal(model.orders,1);
assert.equal(model.profit,null);
assert.equal(model.front,p.pickets.reduce((s,x)=>s+x.frontBuy,0));
assert.equal(model.rear,p.pickets.reduce((s,x)=>s+x.rearBuy,0));
assert.match(ownerDashboardHtml(model),/Не хватает себестоимости/);
assert.match(ownerDashboardHtml(model,{preview:true}),/DEV-превью/);

assert.match(source,/currentUser\\?\\.role === 'owner' &&/);
assert.match(source,/data-owner-detail-tab/);
assert.match(source,/switchScreen\\(currentUser\\?\\.role === 'owner' \\? 'owner' : 'surveys'\\)/);
assert.match(source,/sessionStorage\\.setItem\\('kd-owner-demo-'/);
assert.doesNotMatch(source,/fresh\\.configuration\\.ownerCosts\\s*=/);
assert.match(source,/apiRequest\\('\/owner-costs'/);
assert.match(html,/id="ownerScreen"/);
assert.match(html,/id="ownerNavBtn"/);
assert.match(backend,/function kd_surveyor_owner_costs/);
assert.match(backend,/kd_surveyor_require_session\\('owner'\\)/);
assert.match(backend,/unset\\(\\$configuration\\['ownerCosts'\\]\\);/);
assert.match(backend,/surveyor_owner_costs/);
assert.match(sw,/owner-dashboard\\.js/);
assert.match(sw,/owner-report\\.js/);
assert.match(preview,/DEV_TOOLS_DIR}\\/owner-dashboard\\.js/);
assert.match(preview,/DEV_TOOLS_FRESH_DIR}\\/owner-report\\.js/);
console.log('Owner dashboard: engine quantities, margin, losses, role isolation and PWA structure OK');
