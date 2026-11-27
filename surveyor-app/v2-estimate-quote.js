import {readBasket} from './v2-basket.js';
import {artGateRequest,artGateVerifiedQuote} from './v2-art-gates.js';
// Read-only transport boundary. The caller must supply an authenticated provider.
// No live transport, prices or permissions are stored in this module.
const reasons={
 pricing_not_connected:'Расчёт этой категории ещё не подключён',
 excel_not_verified:'Нет проверенного импорта Excel',
 service_rate_missing:'Не задан тариф выбранной услуги',
 calculation_unavailable:'Расчёт временно недоступен'
};
export function estimateRequest(items){
 const rows=readBasket(items);
 if(!Array.isArray(items)||!rows.length||rows.length!==items.length)throw Error('Проверьте все позиции сметы');
 return {items:rows};
}
export function validateEstimateReply(items,reply){
 const request=estimateRequest(items),data=reply?.estimate;
 if(data?.version!==1||!Array.isArray(data.rows)||data.rows.length!==request.items.length||
    data.totalRub!==null||data.deliveryPending!==true||data.canIssue!==false||data.canReleaseProduction!==false)throw Error('Некорректный ответ расчёта сметы');
 const byId=new Map();
 for(const row of data.rows){
  if(!row||typeof row.id!=='string'||byId.has(row.id))throw Error('Некорректный состав ответа');
  byId.set(row.id,row);
 }
 const lines=request.items.map(item=>{
  const row=byId.get(item.id);
  if(!row||row.kind!==item.kind)throw Error('Состав сметы изменился');
  if(row.status==='unavailable'){
   if(row.quote!==null||!Object.hasOwn(reasons,row.reason))throw Error('Некорректное состояние цены');
   return {id:item.id,kind:item.kind,status:'unavailable',message:reasons[row.reason],priceRub:null};
  }
  if(row.status!=='calculated'||item.kind!=='artGates'||row.reason!==null)throw Error('Неизвестный расчётный модуль');
  const request=artGateRequest(item.draft.article,item.draft.dimensions,item.draft.options);
  const q=artGateVerifiedQuote(request,{quote:row.quote});
  if(typeof row.importedAt!=='string'||!Number.isFinite(Date.parse(row.importedAt)))throw Error('Нет даты импорта');
  return {id:item.id,kind:item.kind,status:'calculated',priceRub:q.prices.total,prices:q.prices,tariffRevision:q.tariffRevision,importedAt:row.importedAt,calculatedAt:q.calculatedAt};
 });
 const known=lines.filter(x=>x.status==='calculated');
 const subtotal=known.reduce((n,x)=>n+x.priceRub,0);
 if(!Number.isSafeInteger(subtotal))throw Error('Слишком большая сумма');
 return {version:1,lines,calculatedCount:known.length,unavailableCount:lines.length-known.length,calculatedSubtotalRub:known.length?subtotal:null,totalRub:null,deliveryPending:true,canIssue:false,canReleaseProduction:false};
}
export async function requestEstimate(items,provider){
 if(typeof provider!=='function')throw Error('Серверный расчёт пока не подключён');
 const request=estimateRequest(items);
 return validateEstimateReply(request.items,await provider(request));
}
