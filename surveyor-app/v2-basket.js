import {SLIDING_DEFAULTS,slidingQuoteMm,PRODUCT_TYPES} from './v2-product-editor.js';
import {SWING_DEFAULTS,swingFramePlan} from './v2-swing-frame.js';
import {ART_GATE_STANDARD,artGateRequest} from './v2-art-gates.js';
import {ART_FENCE_DEFAULTS,artFencePlan} from './v2-art-fences.js';
import {PICKET_DEFAULTS,PICKET_SIDES,PICKET_CORNERS,picketSitePlan} from './v2-pickets.js';
import {PROFILE_FENCE_DEFAULTS,profileFencePlan} from './v2-profile-fence.js';
import {CANOPY_DEFAULTS,canopyPlan} from './v2-canopy.js';
const defaults={sliding:SLIDING_DEFAULTS,frames:SWING_DEFAULTS,artFences:ART_FENCE_DEFAULTS,profileFence:PROFILE_FENCE_DEFAULTS,canopy:CANOPY_DEFAULTS};
export const BASKET_LIMIT=50;
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
function fields(source,schema){
 const out={...schema};
 if(!plain(source))return out;
 for(const key of Object.keys(schema)){
  if(!Object.hasOwn(source,key))continue;
  const v=source[key];
  if(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=80)out[key]=v;
  else throw Error('Некорректное поле: '+key);
 }
 return out;
}
export function normalizeBasketDraft(kind,input){
 if(!PRODUCT_TYPES.some(p=>p.id===kind))throw Error('Неизвестный вид изделия');
 if(kind==='artGates'){
  if(!plain(input)||typeof input.article!=='string')throw Error('Выберите артикул');
  const {article,installation,posts,...dimensions}=artGateRequest(input.article,fields(input.dimensions,ART_GATE_STANDARD),fields(input.options,{installation:false,posts:false}));
  return {article,dimensions,options:{installation,posts}};
 }
 if(kind==='pickets'){
  const sides={},corners={};
  if(input?.version===2){
   for(const id of PICKET_SIDES)if(plain(input.sides?.[id]))sides[id]=fields(input.sides[id],PICKET_DEFAULTS);
   for(const [a,b] of PICKET_CORNERS)if(input.corners?.[a+b]===true)corners[a+b]=true;
  }else sides['А']=fields(input,PICKET_DEFAULTS);
  if(!Object.keys(sides).length)throw Error('Добавьте сторону');
  return {version:2,active:sides[input?.active]?input.active:Object.keys(sides)[0],sides,corners};
 }
 return fields(input,defaults[kind]);
}
const dims=(w,h)=>Number(w)+' × '+Number(h)+' мм';
export function basketLine(kind,input){
 const draft=normalizeBasketDraft(kind,input);
 let q,summary='',referenceRub=null,warning='';
 switch(kind){
  case 'sliding':
   q=slidingQuoteMm(draft);
   if(q.total===null||!q.configuration)throw Error(q.errors?.join(' ')||'Проверьте параметры ворот');
   if(Number.isSafeInteger(q.total)&&q.total>0)referenceRub=q.total;
   summary=dims(draft.widthMm,draft.heightMm)+(draft.builtInWicket?' · встроенная калитка':'');break;
  case 'frames':
   q=swingFramePlan(draft);
   summary=[draft.product!=='wicket'?'Ворота '+dims(draft.gateWidthMm,draft.gateHeightMm):'',draft.product!=='gate'?'Калитка '+dims(draft.wicketWidthMm,draft.wicketHeightMm):''].filter(Boolean).join(' · ');break;
  case 'artGates':summary=draft.article+' · '+dims(draft.dimensions.gateWidthMm,draft.dimensions.gateHeightMm)+' · калитка '+dims(draft.dimensions.wicketWidthMm,draft.dimensions.wicketHeightMm);break;
  case 'artFences':q=artFencePlan(draft);summary=Number(draft.count)+' секц. · '+dims(draft.sectionWidthMm,draft.heightMm)+(draft.article?' · '+draft.article:'');if(!draft.article.trim())warning='Уточнить модель секции';break;
  case 'pickets':q=picketSitePlan(draft.sides,draft.corners);summary=Object.keys(draft.sides).length+' сторон · '+Object.values(draft.sides).reduce((n,s)=>n+Number(s.lengthMm),0)+' мм';if(q.summary&&!q.summary.approved)warning='Подтвердить раскладку без подрезки';break;
  case 'profileFence':q=profileFencePlan(draft);summary=dims(draft.lengthMm,draft.heightMm);break;
  case 'canopy':q=canopyPlan(draft);summary=dims(draft.widthMm,draft.lengthMm)+' · '+draft.coverage;break;
 }
 if(q?.errors?.length)throw Error(q.errors.join(' '));
 return {kind,draft,summary,referenceRub,warning,priceStatus:'unconfirmed'};
}
// Persist inputs only. Rebuild summaries and indicative prices, never restore a cached total.
export function readBasket(raw){
 if(!Array.isArray(raw))return [];
 const result=[],ids=new Set();
 for(const row of raw.slice(0,BASKET_LIMIT)){
  try{
   if(!plain(row)||typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(row.id)||ids.has(row.id))continue;
   const {kind,draft}=basketLine(row.kind,row.draft);ids.add(row.id);result.push({id:row.id,kind,draft});
  }catch{}
 }
 return result;
}
export function basketSummary(items){
 const lines=items.map(row=>{try{return {id:row.id,...basketLine(row.kind,row.draft)}}catch(e){return {id:row.id,kind:row.kind,error:e.message,referenceRub:null,priceStatus:'unconfirmed'}}});
 return {lines,count:lines.length,unpriced:lines.filter(r=>r.referenceRub===null).length,unconfirmed:lines.length,referenceSubtotal:lines.reduce((n,r)=>n+(r.referenceRub??0),0),total:null};
}
export function mountBasket(root,items,{onBack,onEdit,onRemove}={}){
 const q=basketSummary(items),money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
 root.innerHTML='<section class="kd-product-editor"><button type="button" class="kd-v2-action" data-basket-back>← Добавить изделие из каталога</button><h3>Черновик сметы</h3><p class="kd-v2-note">Один объект · несколько изделий. Только параметры; не заказ, не договор и не подтверждённая цена. Не вводите персональные данные.</p><div data-basket-lines></div><div class="kd-v2-card" data-basket-total role="status"></div></section>';
 const list=root.querySelector('[data-basket-lines]');
 for(const row of q.lines){
  const card=document.createElement('div');card.className='kd-v2-card';card.dataset.basketLine=row.id;
  const title=document.createElement('b');title.textContent=PRODUCT_TYPES.find(p=>p.id===row.kind)?.label||'Изделие';
  const description=document.createElement('p');description.textContent=row.error||row.summary;
  const price=document.createElement('small');price.textContent=row.referenceRub===null?'Цена не рассчитана':'Ориентир: '+money(row.referenceRub)+' · не подтверждён';
  card.append(title,description,price);
  if(row.warning){const w=document.createElement('p');w.textContent=row.warning;card.append(w)}
  const buttons=document.createElement('div');buttons.className='kd-v2-grid two';
  for(const [action,label,callback] of [['edit','Изменить',onEdit],['remove','Удалить',onRemove]]){
   const b=document.createElement('button');b.type='button';b.className='kd-v2-action';b.dataset['basket'+(action==='edit'?'Edit':'Remove')]=row.id;b.textContent=label;b.onclick=()=>callback?.(row.id);buttons.append(b);
  }
  card.append(buttons);list.append(card);
 }
 if(!q.count)list.textContent='Пока нет изделий. Добавьте первое из каталога.';
 const total=root.querySelector('[data-basket-total]');
 total.textContent='Изделий: '+q.count+' · Без цены: '+q.unpriced+' · Не подтверждено: '+q.unconfirmed+'. '+(q.referenceSubtotal?'Сумма известных ориентиров: '+money(q.referenceSubtotal)+'. ':'')+'Итог сметы не рассчитан. Доставка и общие работы требуют отдельной проверки.';
 root.querySelector('[data-basket-back]').onclick=()=>onBack?.();
}
