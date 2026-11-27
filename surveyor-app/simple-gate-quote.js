// Explicit allowlist at the private pricing boundary. This module contains no rates.
// The real provider must run on a trusted server; the public preview must never
// request or receive real rate tables, internal costs, wages or profit.
import {simpleGateCompleteQuote} from './simple-gate-engine.js';
const numberFields=['widthMm','heightMm','wicketWidthMm','wicketHeightMm'];
const enumFields={profile:['60x40x2','40x40x2','40x25x2'],wicketType:['separate','builtIn'],gapMode:['excel','sideClearance'],fill:['none','single','chess','horizontal','sheet'],postType:['none','100x100','80x80','60x60'],wicketPosition:['adjacent','separate'],installation:['none','set','gate','wicket','builtIn']};
export function normalizeSwingQuoteInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Некорректный запрос расчёта');
  const out={};
  for(const key of numberFields){
    const v=input[key];
    if(!Number.isSafeInteger(v)||v<1||v>6000)throw Error('Проверьте размеры в мм');
    out[key]=v;
  }
  for(const [key,values] of Object.entries(enumFields)){
    if(!values.includes(input[key]))throw Error('Некорректная комплектация: '+key);
    out[key]=input[key];
  }
  for(const key of ['paint','link']){
    if(typeof input[key]!=='boolean')throw Error('Некорректная комплектация: '+key);
    out[key]=input[key];
  }
  if(input.manualPosts!==''&&input.manualPosts!==null&&input.manualPosts!==undefined){
    if(!Number.isSafeInteger(input.manualPosts)||input.manualPosts<0||input.manualPosts>20)throw Error('Проверьте количество столбов');
    out.manualPosts=input.manualPosts;
  }else out.manualPosts=null;
  return out;
}
const priceFields=['productRetail','gateRetail','wicketRetail','posts','link','installation','total'];
export function buildSwingCustomerQuote(input,quote,{test=false,revision}={}){
  const configuration=normalizeSwingQuoteInput(input);
  if(typeof revision!=='string'||!revision.trim()||revision.length>100)throw Error('Версия тарифа не задана');
  const prices={};
  for(const key of priceFields){
    const v=quote?.[key];
    if(!Number.isSafeInteger(v)||v<0)throw Error('Некорректная цена: '+key);
    prices[key]=v;
  }
  if(prices.gateRetail+prices.wicketRetail!==prices.productRetail||prices.productRetail+prices.posts+prices.link+prices.installation!==prices.total||prices.total<=0)throw Error('Не сходится сумма расчёта');
  return {version:1,kind:'simpleSwing',test:test===true,tariffRevision:revision,configuration,prices};
}
// Intended for a private adapter, or a test using entirely synthetic rates.
// Do not call this with actual rates in the public client.
export function makeSwingQuote(input,rates,{role,test=false,revision}={}){
  if(role!=='owner'&&role!=='surveyor')throw Error('Нет доступа к расчёту');
  const configuration=normalizeSwingQuoteInput(input);
  const q=simpleGateCompleteQuote(configuration,rates?.frame,rates?.fill,rates?.extras,rates?.dimensions);
  const customer=buildSwingCustomerQuote(configuration,q,{test,revision});
  if(role==='surveyor')return {customer};
  return {customer,owner:{productCost:q.productCost,productProfitBeforeRounding:q.productProfitBeforeRounding,wage:q.frame.wage,extrasProfit:null,netProfit:null}};
}
// Customer snapshots must be rebuilt from the provider's allowlisted reply;
// no spreading input, arbitrary payload or internal quote objects.
export function buildSwingCalculation(reply,id,now=new Date().toISOString()){
  const customer=reply?.customer;
  if(customer?.version!==1||customer?.kind!=='simpleSwing'||typeof customer.test!=='boolean')throw Error('Неподдерживаемый ответ расчёта');
  const q=buildSwingCustomerQuote(customer.configuration,customer.prices,{test:customer.test,revision:customer.tariffRevision});
  const c=q.configuration;
  return {id,type:'simpleSwing',title:(q.test?'Тест · ':'')+'Распашные ворота с калиткой',total:q.prices.total,summary:'Проём '+c.widthMm+' × '+c.heightMm+' мм · '+(c.wicketType==='builtIn'?'встроенная':'отдельная')+' калитка '+c.wicketWidthMm+' × '+c.wicketHeightMm+' мм',createdAt:now,updatedAt:now,payload:{category:'simpleSwing',test:q.test,tariffRevision:q.tariffRevision,configuration:c,prices:q.prices,total:q.prices.total,deliveryPending:true}};
}

/** Deliberately fictitious rates for the isolated preview only. */
export function makeSwingDemoQuote(input,role){
  const frame=Object.fromEntries(['mainPrice','innerPrice','stripPrice','hingePrice','lockPrice','paintPrice','cutDisc','grindDisc','wire','gas','rent','rearPrice','rearPaintArea','pins','mainPaintArea','innerPaintArea','hingePlate','wageGate','wageWicket','wageRound','frameMarkup'].map(k=>[k,1]));
  // Integer round values intentionally unrelated to current business rates.
  Object.assign(frame,{mainPrice:100,innerPrice:50,stripPrice:50,paintPrice:100,mainPaintArea:.2,innerPaintArea:.08,rearPaintArea:.12,wageGate:1000,wageWicket:500,wageRound:100,frameMarkup:1.5});
  return makeSwingQuote(input,{frame,fill:{sheetPrice:100,sheetScrewPrice:1,sheetGateLabor:100,sheetWicketLabor:100,singlePrice:100,doublePrice:100,picketScrewPrice:1,singleLabor:100,chessLabor:100,horizontalLabor:100,fillMarkup:1.2},extras:{post100x100:1000,post80x80:1000,post60x60:1000,linkBase:1000,installset:1000,installgate:1000,installwicket:1000,installbuiltIn:1000}},{role,test:true,revision:'synthetic-preview-v1'});
}
