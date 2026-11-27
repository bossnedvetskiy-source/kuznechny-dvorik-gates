import {calculateFence} from '../evroshtaketnik/engine.js';
import {verticalPicketPlan} from './3d-layout.js';
// Reuse existing division and cutting logic; no additional rate table.
export const PICKET_DEFAULTS=Object.freeze({type:'vertical-double',post:'80x80x3',lengthMm:12000,heightMm:1800,gapMm:60,includeNewPosts:true,existingPostsCount:0,fit:false});
const int=(v,min,max)=>v!==''&&v!==null&&typeof v!=='boolean'&&Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
export function picketPlan(input={}){
 const s={...PICKET_DEFAULTS,...input},errors=[];
 if(!['vertical-single','vertical-double','horizontal-double'].includes(s.type)||!['60x60x2','80x80x3','100x100x3'].includes(s.post)||!int(s.lengthMm,1,60000)||!int(s.heightMm,500,2300)||!int(s.gapMm,0,120)||!int(s.existingPostsCount,0,100)||typeof s.includeNewPosts!=='boolean'||typeof s.fit!=='boolean')return {errors:['Проверьте размеры, профиль, зазор и число опор.'],plan:null,total:null};
 const q=calculateFence({type:s.type,post:s.post,includeNewPosts:s.includeNewPosts,existingPostsCount:Number(s.existingPostsCount),sections:[{length:Number(s.lengthMm)/1000,height:Number(s.heightMm)/1000}],settings:{gapSingle:Number(s.gapMm)/1000,gapDouble:Number(s.gapMm)/1000}});
 if(q.summary.check!=='ГОТОВО')return {errors:[q.summary.check],plan:null,total:null};
 if(s.includeNewPosts&&Number(s.existingPostsCount)>q.summary.postsByScheme)return {errors:['Готовых опор больше, чем предусмотрено схемой.'],plan:null,total:null};
 const segment=q.sections[0].segments[0],horizontal=s.type==='horizontal-double',double=s.type!=='vertical-single';
 if(!segment||segment.clearSpan<=0)return {errors:['Пролёт не помещается между столбами.'],plan:null,total:null};
 const measure=horizontal?Number(s.heightMm)/1000:segment.clearSpan;
 const raw=verticalPicketPlan(measure,Number(s.gapMm)/1000,false);
 const fitted=verticalPicketPlan(measure,Number(s.gapMm)/1000,true);
 const chosen=s.fit?fitted:raw;
 const front=chosen.count*segment.spans,back=double?Math.max(0,chosen.count-1)*segment.spans:0;
 const reserve=double&&front>0?4:0;
 const needsFit=raw.edgeMargin>.00005;
 const approved=chosen.count>0&&(!needsFit||s.fit&&raw.canFit&&chosen.edgeMargin<=.00005);
 const warning=!raw.count?'Целая планка 120 мм не помещается.':needsFit&&!raw.canFit?'Дополнительная целая планка не помещается. Измените длину или шаг опор; подрезка запрещена.':needsFit&&!s.fit?'Остаётся зазор у края. Подтвердите уменьшение зазора без подрезки.':'';
 const p={spans:segment.spans,clearSpanMm:segment.clearSpan*1000,posts:q.summary.postsByScheme,newPosts:q.summary.newPosts,existingPosts:q.summary.existingPostsUsed,front,back,reserve,frontPerSpan:chosen.count,backPerSpan:double?Math.max(0,chosen.count-1):0,picketLengthMm:segment.picketLengthMm,picketPurchaseM:(front+back+reserve)*segment.picketLength,screws:(front+back)*(horizontal?6:4),tubeUsed:q.purchase.tubeUsed,tubeStocks:q.purchase.tubeStocks,gapMm:chosen.gapUsed*1000,recommendedGapMm:raw.recommendedGap===null?null:raw.recommendedGap*1000,edgeMarginMm:chosen.edgeMargin*1000,approved,needsFit,canFit:raw.canFit,warning};
 // Do not present the legacy price for modified counts or outdated input rates.
 return {errors,plan:p,total:null};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const number=(key,label,min=0)=>'<label><span>'+label+'</span><input type="number" step="1" min="'+min+'" inputmode="numeric" data-picket-field="'+key+'"></label>';
const select=(key,label,options)=>'<label><span>'+label+'</span><select data-picket-field="'+key+'">'+options.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>';
export function mountPicketEditor(root,{draft,onDraft,onBack,onReset}={}){
 const state={...PICKET_DEFAULTS,...draft};
 root.innerHTML='<section class="kd-product-editor"><button type="button" class="kd-v2-action" data-picket-back>← К каталогу</button><h3>Евроштакетник</h3><p class="kd-v2-note">Одна прямая линия, общая длина вместе со столбами. Пролёты до 2500 мм. Планки шириной 120 мм не подрезаются.</p><div class="kd-v2-card"><div class="kd-product-grid">'+number('lengthMm','Длина участка, мм',1)+number('heightMm','Высота, мм',500)+select('type','Заполнение',[['vertical-single','Вертикальный односторонний'],['vertical-double','Вертикальная шахматка'],['horizontal-double','Горизонтальная шахматка']])+select('post','Столбы',[['60x60x2','60×60×2'],['80x80x3','80×80×3'],['100x100x3','100×100×3']])+number('gapMm','Желаемый зазор, мм')+number('existingPostsCount','Готовых опор, шт.')+'</div><label class="kd-product-check"><input type="checkbox" data-picket-field="includeNewPosts"><span>Добавлять новые столбы</span></label></div><div role="status" data-picket-errors></div><div class="kd-v2-card" data-picket-warning hidden><p data-picket-message></p><button type="button" class="kd-v2-action" data-picket-fit>Уменьшить зазор без подрезки</button></div><div class="kd-v2-card"><h3>Материалы</h3><div data-picket-plan></div></div><p class="kd-v2-note">Цена и сохранение пока отключены. Количество опор и раскрой предварительные: реальные готовые опоры нужно измерить.</p><button type="button" class="kd-v2-action" data-picket-reset>Сбросить параметры</button></section>';
 const fields=[...root.querySelectorAll('[data-picket-field]')];
 for(const e of fields){const k=e.dataset.picketField;if(e.type==='checkbox')e.checked=state[k];else e.value=state[k]}
 function render(){
  const q=picketPlan(state),p=q.plan;
  root.querySelector('[data-picket-errors]').textContent=q.errors.join(' ');
  root.querySelector('[data-picket-warning]').hidden=!p?.warning;
  root.querySelector('[data-picket-message]').textContent=p?.warning||'';
  root.querySelector('[data-picket-fit]').hidden=!p?.canFit||!p?.needsFit;
  root.querySelector('[data-picket-field="existingPostsCount"]').closest('label').hidden=!state.includeNewPosts;
  const rows=p?[['Пролёты, шт.',p.spans],['Ширина между столбами, мм',fmt(p.clearSpanMm)],['Опоры всего',p.posts],['Новые столбы',p.newPosts],['Спереди, шт.',p.front],['Сзади, шт.',p.back],['Запас, шт.',p.reserve],['Длина планки, мм',p.picketLengthMm],['Зазор, мм',fmt(p.gapMm)],['Отступ у края, мм',fmt(p.edgeMarginMm)],['Штакетник к закупке, м',fmt(p.picketPurchaseM)],['Саморезы, шт.',p.screws],['Труба 40×20, м',fmt(p.tubeUsed)],['Хлысты 6 м, шт.',p.tubeStocks],['Раскладка',p.approved?'Без подрезки':'Не подтверждена']]:[];
  root.querySelector('[data-picket-plan]').innerHTML=rows.map(([l,v])=>'<div class="kd-product-row"><span>'+l+'</span><b>'+v+'</b></div>').join('');
 }
 root.oninput=e=>{const el=e.target,k=el.dataset.picketField;if(!Object.hasOwn(PICKET_DEFAULTS,k))return;state[k]=el.type==='checkbox'?el.checked:el.value;if(k==='type'){state.gapMm=state.type==='vertical-single'?50:60;root.querySelector('[data-picket-field="gapMm"]').value=state.gapMm}state.fit=false;onDraft?.({...state});render()};
 root.querySelector('[data-picket-fit]').onclick=()=>{state.fit=true;onDraft?.({...state});render()};
 root.querySelector('[data-picket-back]').onclick=()=>onBack?.();
 root.querySelector('[data-picket-reset]').onclick=()=>{if(window.confirm('Сбросить параметры забора?'))onReset?.()};
 render();
}
