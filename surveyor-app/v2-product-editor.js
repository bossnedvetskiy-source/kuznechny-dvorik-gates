// Stage 2 foundation: local customer quote only. No owner cost or wage data.
import {calculateSlidingQuote} from './sliding-gates/pricing.js';

export const PRODUCT_TYPES=Object.freeze([
  {id:'artGates',label:'Кованые ворота Арт.'},
  {id:'artFences',label:'Кованые заборы Арт.'},
  {id:'frames',label:'Каркасы ворот и калиток'},
  {id:'sliding',label:'Откатные ворота'},
  {id:'pickets',label:'Евроштакетник'},
  {id:'profileFence',label:'Забор из профнастила'},
  {id:'canopy',label:'Навесы'}
].map(Object.freeze));
// Explicit defaults match the existing sliding owner quick editor.
// No new prices or production assumptions.
export const SLIDING_DEFAULTS=Object.freeze({
  widthMm:4000,heightMm:2000,frame:'prof',tail:'square',picket:'single',centerPost:'auto',
  fill:true,paint:true,auto:false,install:true,stand:true,bolts:true,
  distance:0,discount:0,builtInWicket:false,builtInWidthMm:1000,
  builtInMode:'center',builtInOffsetMm:0
});
const enums={frame:['prof','vertical','horizontal','jalousie'],tail:['square','triangle'],picket:['single','double'],centerPost:['auto','yes','no'],builtInMode:['center','left','right']};
const bools=['fill','paint','auto','install','stand','bolts','builtInWicket'];
const mmFields=['widthMm','heightMm','builtInWidthMm','builtInOffsetMm'];
const numberFields=['distance','discount'];
const finiteNumber=v=>v!==''&&v!==null&&typeof v!=='boolean'&&Number.isFinite(Number(v));
export function slidingQuoteMm(input={}){
  const state={...SLIDING_DEFAULTS,...input},errors=[];
  for(const key of mmFields){
    if(!finiteNumber(state[key])||!Number.isSafeInteger(Number(state[key]))||Number(state[key])<0)errors.push('Размеры указываются целыми миллиметрами.');
  }
  for(const key of numberFields)if(!finiteNumber(state[key])||Number(state[key])<0)errors.push('Доставка и скидка должны быть неотрицательными числами.');
  for(const [key,values] of Object.entries(enums))if(!values.includes(state[key]))errors.push('Некорректный вариант комплектации.');
  for(const key of bools)if(typeof state[key]!=='boolean')errors.push('Некорректный параметр комплектации.');
  if(errors.length)return {errors:[...new Set(errors)],total:null,rows:[],geometry:null,configuration:null};
  const config={
    width:Number(state.widthMm)/1000,height:Number(state.heightMm)/1000,
    frame:state.frame,tail:state.tail,picket:state.picket,
    centerPost:state.centerPost==='auto'?null:state.centerPost==='yes',
    fill:state.fill,paint:state.paint,auto:state.auto,install:state.install,stand:state.stand,bolts:state.bolts,
    distance:Number(state.distance),discount:Number(state.discount),builtInWicket:state.builtInWicket,
    builtInWidth:Number(state.builtInWidthMm)/1000,builtInMode:state.builtInMode,builtInOffset:Number(state.builtInOffsetMm)/1000
  };
  // Geometry and retail pricing stay in the existing verified engine.
  const quote=calculateSlidingQuote(config);
  return {...quote,configuration:config,rows:quote.rows||[]};
}
// Rebuild a customer-only snapshot from validated inputs, never trust a displayed total.
export function buildSlidingCalculation(input,id,now=new Date().toISOString()){
  const q=slidingQuoteMm(input);
  if(q.total===null||!q.configuration)throw new Error(q.errors.join(' ')||'Проверьте размеры');
  const config={...q.configuration};
  if(config.frame==='jalousie')config.fill=false;
  config.builtInFrameProfile=config.builtInWicket?'60x40x2':null;
  config.builtInThreshold=config.builtInWicket?'step-over':null;
  config.deliveryCost=config.distance*90;
  const names={prof:'Профнастил',vertical:'Вертикальный евроштакетник',horizontal:'Горизонтальный евроштакетник',jalousie:'Каркас под жалюзи'};
  return {id,type:'sliding',title:'Откатные ворота',total:q.total,
    summary:(config.builtInWicket?'Встроенная калитка '+config.builtInWidth+' м · ':'')+names[config.frame]+' · '+config.width+' × '+config.height+' м · '+(config.tail==='square'?'квадратный':'треугольный')+' хвостовик',
    createdAt:now,updatedAt:now,payload:{category:'sliding-gates',productTitle:'Откатные ворота',total:q.total,deliveryPending:false,configuration:config}};
}
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽':'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(key,label,min=0,step=1)=>'<label><span>'+label+'</span><input data-product-field="'+key+'" type="number" inputmode="'+(step===1?'numeric':'decimal')+'" min="'+min+'" step="'+step+'"></label>';
const select=(key,label,options)=>'<label><span>'+label+'</span><select data-product-field="'+key+'">'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>';
const check=(key,label)=>'<label class="kd-product-check"><input type="checkbox" data-product-field="'+key+'"><span>'+label+'</span></label>';
function diagram(q){
  const g=q.geometry;if(!g||!q.configuration)return '';
  const w=q.configuration.width,scale=320/g.full,x=20+g.tail*scale,right=20+g.full*scale,top=22,bottom=118;
  const line=(a,b,c,d)=>'<line x1="'+a+'" y1="'+b+'" x2="'+c+'" y2="'+d+'"/>';
  let drawing=line(20,bottom,right,bottom)+line(x,top,right,top)+line(right,top,right,bottom)+line(x,top,x,bottom);
  if(q.configuration.tail==='square')drawing+=line(20,top,20,bottom)+line(20,top,x,top)+line(20,top,x,bottom)+line(20,bottom,x,top);
  else drawing+=line(20,bottom,x,top);
  if(g.centerPost)drawing+=line(x+w*scale/2,top,x+w*scale/2,bottom);
  if(q.wicket?.valid)drawing+='<rect x="'+(x+q.wicket.left*scale)+'" y="'+(top+7)+'" width="'+(q.wicket.width*scale)+'" height="'+(bottom-top-14)+'"/>';
  return '<svg viewBox="0 0 360 145" role="img" aria-label="Условный эскиз откатных ворот, не производственный чертёж"><g fill="none" stroke="#20262d" stroke-width="2">'+drawing+'</g><text x="'+((x+right)/2)+'" y="137" fill="#20262d" text-anchor="middle" font-size="12">'+Math.round(w*1000)+' мм</text></svg>';
}
export function mountProductEditor(root,{onBack,onLegacy,draft,onDraft,onReset,listTargets,onSave}={}){
  let state={...SLIDING_DEFAULTS,...draft};
  root.innerHTML='<section class="kd-product-editor" aria-label="Быстрый расчёт откатных ворот">'+
    '<button type="button" class="kd-v2-action" data-product-back>← К каталогу</button><h3>Откатные ворота</h3><p class="kd-v2-note">Предварительная цена по действующим формулам · без заказа и контактов. Эскиз условный.</p>'+
    '<div class="kd-v2-card"><div class="kd-product-sketch" data-product-sketch></div><div class="kd-product-grid">'+
    number('widthMm','Ширина проёма, мм',500)+number('heightMm','Высота, мм',500)+
    select('frame','Тип каркаса',[['prof','Под профнастил'],['vertical','Вертикальный штакетник'],['horizontal','Горизонтальный штакетник'],['jalousie','Под жалюзи']])+
    select('tail','Хвостовик',[['square','Квадратный'],['triangle','Треугольный']])+
    '</div></div><div class="kd-v2-card"><h3>Комплектация</h3><div class="kd-product-checks">'+check('fill','Заполнение')+check('paint','Покраска')+check('stand','Станина')+check('bolts','Болты')+check('install','Монтаж')+check('auto','Автоматика')+check('builtInWicket','Встроенная калитка')+'</div>'+
    '<div class="kd-product-grid" data-product-wicket hidden>'+number('builtInWidthMm','Ширина калитки, мм',700)+select('builtInMode','Расположение',[['center','По центру'],['left','Слева'],['right','Справа']])+number('builtInOffsetMm','Отступ от края, мм')+'</div>'+
    '<details><summary>Дополнительные параметры</summary><div class="kd-product-grid">'+select('picket','Штакетник',[['single','Односторонний'],['double','Двусторонний']])+select('centerPost','Центральная стойка',[['auto','По типу каркаса'],['yes','Да'],['no','Нет']])+number('distance','Доставка, км',0,.1)+number('discount','Скидка, ₽')+'</div></details></div>'+
    '<div data-product-errors role="status"></div><details class="kd-v2-card"><summary>Состав цены</summary><div data-product-rows></div></details>'+
    '<button type="button" class="kd-v2-action primary" data-product-add>Добавить в замер</button>'+
    '<div class="kd-v2-card" data-product-targets hidden><label><span>Куда сохранить расчёт</span><select data-product-target></select></label><button type="button" class="kd-v2-action primary" data-product-confirm>Сохранить расчёт</button><button type="button" class="kd-v2-action" data-product-cancel>Отмена</button><p data-product-save-status role="status"></p></div>'+
    '<button type="button" class="kd-v2-action" data-product-legacy>Открыть действующий замер отдельно</button>'+
    '<button type="button" class="kd-v2-action" data-product-reset>Новый расчёт · сбросить параметры</button>'+
    '<div class="kd-product-total kd-v2-card"><small>Предварительная стоимость</small><strong data-product-total aria-live="polite">—</strong></div></section>';
  const fields=[...root.querySelectorAll('[data-product-field]')];
  for(const el of fields){const k=el.dataset.productField;if(el.type==='checkbox')el.checked=state[k];else el.value=state[k];}
  let saving=false;
  function render(){
    const q=slidingQuoteMm(state);
    root.querySelector('[data-product-wicket]').hidden=!state.builtInWicket;
    root.querySelector('[data-product-sketch]').innerHTML=diagram(q);
    root.querySelector('[data-product-errors]').textContent=q.errors.join(' ');
    root.querySelector('[data-product-total]').textContent=money(q.total);
    root.querySelector('[data-product-add]').disabled=q.total===null||!onSave;
    root.querySelector('[data-product-confirm]').disabled=q.total===null||saving;
    root.querySelector('[data-product-rows]').innerHTML=q.rows.map(([name,v])=>'<div class="kd-product-row"><span>'+esc(name)+'</span><b>'+money(v)+'</b></div>').join('');
  }
  root.addEventListener('input',e=>{
    const el=e.target,key=el.dataset.productField;if(!Object.hasOwn(SLIDING_DEFAULTS,key))return;
    state[key]=el.type==='checkbox'?el.checked:el.value;
    onDraft?.({...state});
    render();
  });
  const targets=root.querySelector('[data-product-targets]'),target=root.querySelector('[data-product-target]'),status=root.querySelector('[data-product-save-status]');
  root.querySelector('[data-product-add]').addEventListener('click',async()=>{
    if(saving)return;
    targets.hidden=false;status.textContent='Загрузка замеров…';target.replaceChildren(new Option('Создать новый замер без контактов',''));
    try{for(const row of await listTargets?.()||[])target.add(new Option(row.label,row.id));status.textContent='';}catch{status.textContent='Не удалось загрузить список. Попробуйте снова.';}
  });
  root.querySelector('[data-product-cancel]').addEventListener('click',()=>{if(!saving)targets.hidden=true});
  root.querySelector('[data-product-confirm]').addEventListener('click',async()=>{
    if(saving||!onSave||slidingQuoteMm(state).total===null)return;
    saving=true;render();status.textContent='Сохраняем…';
    try{await onSave({...state},target.value);}
    catch(error){status.textContent=error?.message||'Не удалось сохранить расчёт';}
    finally{saving=false;render();}
  });
  root.querySelector('[data-product-back]').addEventListener('click',()=>onBack?.());
  root.querySelector('[data-product-legacy]').addEventListener('click',()=>onLegacy?.());
  root.querySelector('[data-product-reset]').addEventListener('click',()=>{if(window.confirm('Начать новый расчёт? Текущие параметры будут сброшены.'))onReset?.()});
  render();
}
