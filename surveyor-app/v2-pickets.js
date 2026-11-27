import {calculateFence} from '../evroshtaketnik/engine.js';
import {verticalPicketPlan} from './3d-layout.js';
// Reuse existing division and cutting logic; no additional rate table.
export const PICKET_DEFAULTS=Object.freeze({type:'vertical-double',post:'80x80x3',lengthMm:12000,heightMm:1800,gapMm:60,includeNewPosts:true,existingPostsCount:0,fit:false,gateMm:0,wicketMm:0,openingStartMm:0,openingPost:'100x100x3',shareOpeningPost:true,betweenMm:0});
const int=(v,min,max)=>v!==''&&v!==null&&typeof v!=='boolean'&&Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
export function picketPlan(input={}){
 const s={...PICKET_DEFAULTS,...input},errors=[];
 if(!['vertical-single','vertical-double','horizontal-double'].includes(s.type)||!['60x60x2','80x80x3','100x100x3'].includes(s.post)||!int(s.lengthMm,1,60000)||!int(s.heightMm,500,2300)||!int(s.gapMm,0,120)||!int(s.existingPostsCount,0,100)||typeof s.includeNewPosts!=='boolean'||typeof s.fit!=='boolean')return {errors:['Проверьте размеры, профиль, зазор и число опор.'],plan:null,total:null};
 if(!int(s.gateMm,0,8000)||!int(s.wicketMm,0,2500)||!int(s.openingStartMm,0,60000)||!int(s.betweenMm,0,60000)||!['60x60x2','80x80x3','100x100x3'].includes(s.openingPost)||typeof s.shareOpeningPost!=='boolean')return {errors:['Проверьте размеры проёмов и положение ворот.'],plan:null,total:null};
 const gate=Number(s.gateMm),wicket=Number(s.wicketMm),hasOpening=gate+wicket>0;
 const section={length:Number(s.lengthMm)/1000,height:Number(s.heightMm)/1000,gateOpening:gate/1000,wicketOpening:wicket/1000,openingPostType:s.openingPost,openingsSharePost:s.shareOpeningPost,betweenOpeningFence:gate&&wicket&&!s.shareOpeningPost?Number(s.betweenMm)/1000:0,openingStartFence:hasOpening?Number(s.openingStartMm)/1000:null};
 const q=calculateFence({type:s.type,post:s.post,includeNewPosts:s.includeNewPosts,existingPostsCount:Number(s.existingPostsCount),sections:[section],settings:{gapSingle:Number(s.gapMm)/1000,gapDouble:Number(s.gapMm)/1000}});
 if(q.summary.check!=='ГОТОВО')return {errors:[q.summary.check],plan:null,total:null};
 if(s.includeNewPosts&&Number(s.existingPostsCount)>q.summary.postsByScheme)return {errors:['Готовых опор больше, чем предусмотрено схемой забора (без опор ворот).'],plan:null,total:null};
 const horizontal=s.type==='horizontal-double',double=s.type!=='vertical-single';
 const source=q.sections[0];
 if(!source.segments.length||source.segments.some(g=>g.clearSpan<=0))return {errors:['Пролёт не помещается между столбами.'],plan:null,total:null};
 const batches=new Map(),segments=[];
 for(const g of source.segments){
  const measure=horizontal?section.height:g.clearSpan;
  const raw=verticalPicketPlan(measure,Number(s.gapMm)/1000,false),chosen=s.fit?verticalPicketPlan(measure,Number(s.gapMm)/1000,true):raw;
  const front=chosen.count*g.spans,back=double?Math.max(0,chosen.count-1)*g.spans:0,needsFit=raw.edgeMargin>.00005;
  const approved=chosen.count>0&&(!needsFit||s.fit&&raw.canFit&&chosen.edgeMargin<=.00005);
  const warning=!raw.count?'Целая планка 120 мм не помещается.':needsFit&&!raw.canFit?'Дополнительная целая планка не помещается. Измените длину или шаг опор; подрезка запрещена.':needsFit&&!s.fit?'Остаётся зазор у края. Подтвердите уменьшение зазора без подрезки.':'';
  const key=g.picketLengthMm;
  const batch=batches.get(key)||{lengthMm:key,front:0,back:0,reserve:0,actualM:0};
  batch.front+=front;batch.back+=back;batch.actualM+=(front+back)*g.picketLength;
  if(double&&front>0)batch.reserve=4;
  batches.set(key,batch);
  segments.push({key:g.key,spans:g.spans,clearSpanMm:g.clearSpan*1000,front,back,frontPerSpan:chosen.count,backPerSpan:double?Math.max(0,chosen.count-1):0,picketLengthMm:key,gapMm:chosen.gapUsed*1000,recommendedGapMm:raw.recommendedGap===null?null:raw.recommendedGap*1000,edgeMarginMm:chosen.edgeMargin*1000,approved,needsFit,canFit:raw.canFit,warning});
 }
 const sum=k=>segments.reduce((n,g)=>n+g[k],0),max=k=>Math.max(...segments.map(g=>g[k]));
 const front=sum('front'),back=sum('back'),reserve=[...batches.values()].reduce((n,b)=>n+b.reserve,0);
 const p={spans:sum('spans'),clearSpanMm:max('clearSpanMm'),posts:q.summary.postsByScheme,newPosts:q.summary.newPosts,existingPosts:q.summary.existingPostsUsed,openingPosts:source.openingSupportPosts,openingNodeMm:source.openingNodeWidth*1000,openingBeforeMm:source.openingStartFence*1000,openingAfterMm:source.openingEndFence*1000,front,back,reserve,frontPerSpan:max('frontPerSpan'),backPerSpan:max('backPerSpan'),picketLengthMm:segments[0].picketLengthMm,picketPurchaseM:[...batches.values()].reduce((n,b)=>n+b.actualM+b.reserve*b.lengthMm/1000,0),screws:(front+back)*(horizontal?6:4),tubeUsed:q.purchase.tubeUsed,tubeStocks:q.purchase.tubeStocks,gapMm:max('gapMm'),recommendedGapMm:segments[0].recommendedGapMm,edgeMarginMm:max('edgeMarginMm'),approved:segments.every(g=>g.approved),needsFit:segments.some(g=>g.needsFit),canFit:segments.every(g=>g.canFit),warning:[...new Set(segments.map(g=>g.warning).filter(Boolean))].join(' '),segments,batches:[...batches.values()]};
 // Do not present the legacy price for modified counts or outdated input rates.
 return {errors,plan:p,total:null};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const number=(key,label,min=0)=>'<label><span>'+label+'</span><input type="number" step="1" min="'+min+'" inputmode="numeric" data-picket-field="'+key+'"></label>';
const select=(key,label,options)=>'<label><span>'+label+'</span><select data-picket-field="'+key+'">'+options.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>';
export function mountPicketEditor(root,{draft,onDraft,onBack,onReset}={}){
 const state={...PICKET_DEFAULTS,...draft};
 root.innerHTML='<section class="kd-product-editor"><button type="button" class="kd-v2-action" data-picket-back>← К каталогу</button><h3>Евроштакетник</h3><p class="kd-v2-note">Длина выбранной стороны вместе со столбами и проёмами. Пролёты до 2500 мм. Планки шириной 120 мм не подрезаются.</p><div class="kd-v2-card"><div class="kd-product-grid">'+number('lengthMm','Длина участка, мм',1)+number('heightMm','Высота, мм',500)+select('type','Заполнение',[['vertical-single','Вертикальный односторонний'],['vertical-double','Вертикальная шахматка'],['horizontal-double','Горизонтальная шахматка']])+select('post','Столбы',[['60x60x2','60×60×2'],['80x80x3','80×80×3'],['100x100x3','100×100×3']])+number('gapMm','Желаемый зазор, мм')+number('existingPostsCount','Готовых опор, шт.')+'</div><details class="kd-v2-card"><summary>Ворота и калитка на этой стороне</summary><div class="kd-product-grid">'+number('gateMm','Проём ворот, мм (0 — нет)')+number('wicketMm','Проём калитки, мм (0 — нет)')+number('openingStartMm','От начала до узла, мм')+select('openingPost','Опоры проёмов',[['60x60x2','60×60×2'],['80x80x3','80×80×3'],['100x100x3','100×100×3']])+number('betweenMm','Забор между проёмами, мм')+'</div><label class="kd-product-check"><input type="checkbox" data-picket-field="shareOpeningPost"><span>Общий столб ворот и калитки</span></label><small>Отступ считается до первой опоры узла. Опоры проёмов считаются отдельно, их состояние уточняется на замере.</small></details><label class="kd-product-check"><input type="checkbox" data-picket-field="includeNewPosts"><span>Добавлять новые столбы</span></label></div><div role="status" data-picket-errors></div><div class="kd-v2-card" data-picket-warning hidden><p data-picket-message></p><button type="button" class="kd-v2-action" data-picket-fit>Уменьшить зазор без подрезки</button></div><div class="kd-v2-card"><h3>Материалы</h3><div data-picket-plan></div></div><p class="kd-v2-note">Цена и сохранение пока отключены. Количество опор и раскрой предварительные: реальные готовые опоры нужно измерить.</p><button type="button" class="kd-v2-action" data-picket-reset>Сбросить параметры</button></section>';
 const fields=[...root.querySelectorAll('[data-picket-field]')];
 for(const e of fields){const k=e.dataset.picketField;if(e.type==='checkbox')e.checked=state[k];else e.value=state[k]}
 function render(){
  const q=picketPlan(state),p=q.plan;
  root.querySelector('[data-picket-errors]').textContent=q.errors.join(' ');
  root.querySelector('[data-picket-warning]').hidden=!p?.warning;
  root.querySelector('[data-picket-message]').textContent=p?.warning||'';
  root.querySelector('[data-picket-fit]').hidden=!p?.canFit||!p?.needsFit;
  root.querySelector('[data-picket-field="existingPostsCount"]').closest('label').hidden=!state.includeNewPosts;
  const rows=p?[['Пролёты, шт.',p.spans],['Макс. ширина между столбами, мм',fmt(p.clearSpanMm)],['Опоры забора',p.posts],['Опоры ворот и калитки',p.openingPosts],['Новые столбы',p.newPosts],['Спереди, шт.',p.front],['Сзади, шт.',p.back],['Запас, шт.',p.reserve],['Длины планок, мм',p.batches.map(b=>b.lengthMm).join(', ')],['Зазор, мм',fmt(p.gapMm)],['Отступ у края, мм',fmt(p.edgeMarginMm)],['Штакетник к закупке, м',fmt(p.picketPurchaseM)],['Саморезы, шт.',p.screws],['Труба 40×20, м',fmt(p.tubeUsed)],['Хлысты 6 м, шт.',p.tubeStocks],['Раскладка',p.approved?'Без подрезки':'Не подтверждена'],...p.segments.map(g=>[({'main':'Основной','before-opening':'До проёмов','after-opening':'После проёмов','between-openings':'Между проёмами','outer':'Снаружи узла'}[g.key]||g.key),g.spans+' × '+fmt(g.clearSpanMm)+' мм; зазор '+fmt(g.gapMm)+' мм'])]:[];
  root.querySelector('[data-picket-plan]').innerHTML=rows.map(([l,v])=>'<div class="kd-product-row"><span>'+l+'</span><b>'+v+'</b></div>').join('');
 }
 root.oninput=e=>{const el=e.target,k=el.dataset.picketField;if(!Object.hasOwn(PICKET_DEFAULTS,k))return;state[k]=el.type==='checkbox'?el.checked:el.value;if(k==='type'){state.gapMm=state.type==='vertical-single'?50:60;root.querySelector('[data-picket-field="gapMm"]').value=state.gapMm}state.fit=false;onDraft?.({...state});render()};
 root.querySelector('[data-picket-fit]').onclick=()=>{state.fit=true;onDraft?.({...state});render()};
 root.querySelector('[data-picket-back]').onclick=()=>onBack?.();
 root.querySelector('[data-picket-reset]').onclick=()=>{if(window.confirm('Сбросить параметры забора?'))onReset?.()};
 render();
}
