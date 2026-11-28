import {calculateFence} from '../evroshtaketnik/engine.js';
// S10 widths from the existing gate fill model. Fence-specific fastener count
// and rail count are editable assumptions, not an approved fabrication norm.
export const PROFILE_FENCE_DEFAULTS=Object.freeze({lengthMm:12000,heightMm:1800,post:'80x80x3',includeNewPosts:true,existingPostsCount:0,fullMm:1200,workingMm:1140,rails:2,screwsPerSheet:18,gateMm:0,wicketMm:0,openingStartMm:0,openingPost:'100x100x3',shareOpeningPost:true,betweenMm:0,kerfMm:3,sheetMode:'between'});
const int=(v,min,max)=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
export function profileFenceCut(pieces,kerfMm=3){
 if(!int(kerfMm,0,20)||!Array.isArray(pieces)||pieces.some(v=>!int(v,1,6000)))throw Error('Проверьте длины раскроя');
 const bins=[],lengths=pieces.map(Number);
 kerfMm=Number(kerfMm);
 for(const length of lengths.sort((a,b)=>b-a)){
  let bin=bins.find(b=>b.remaining>=length+kerfMm);
  if(!bin){bin={pieces:[],remaining:6000};bins.push(bin)}
  // Exact stock-sized piece needs no cut; every shorter piece reserves kerf.
  const cut=length===6000&&bin.pieces.length===0?0:kerfMm;
  if(length+cut>bin.remaining)throw Error('Деталь с припуском реза не помещается в хлыст');
  bin.pieces.push(length);bin.remaining-=length+cut;
 }
 return {stocks:bins.length,bins,usedMm:lengths.reduce((a,b)=>a+b,0),remainderMm:bins.reduce((a,b)=>a+b.remaining,0)};
}
export function profileFencePlan(input={}){
 const s={...PROFILE_FENCE_DEFAULTS,...input};
 const invalid=()=>({errors:['Проверьте размеры, число прожилин, листы и опоры.'],plan:null,total:null});
 for(const [key,min,max] of [['lengthMm',1,60000],['heightMm',500,2300],['fullMm',300,2000],['workingMm',300,2000],['rails',2,3],['screwsPerSheet',1,100],['existingPostsCount',0,100],['gateMm',0,8000],['wicketMm',0,2500],['openingStartMm',0,60000],['betweenMm',0,60000],['kerfMm',0,20]])if(!int(s[key],min,max))return invalid();
 if(!['between','continuous'].includes(s.sheetMode)||Number(s.workingMm)>Number(s.fullMm)||!['60x60x2','80x80x3','100x100x3'].includes(s.post)||!['60x60x2','80x80x3','100x100x3'].includes(s.openingPost)||typeof s.includeNewPosts!=='boolean'||typeof s.shareOpeningPost!=='boolean')return invalid();
 const gate=Number(s.gateMm),wicket=Number(s.wicketMm),h=Number(s.heightMm),rails=Number(s.rails);
 const q=calculateFence({type:'vertical-single',post:s.post,includeNewPosts:s.includeNewPosts,existingPostsCount:Number(s.existingPostsCount),sections:[{length:Number(s.lengthMm)/1000,height:h/1000,gateOpening:gate/1000,wicketOpening:wicket/1000,openingPostType:s.openingPost,openingsSharePost:s.shareOpeningPost,betweenOpeningFence:gate&&wicket&&!s.shareOpeningPost?Number(s.betweenMm)/1000:0,openingStartFence:gate+wicket>0?Number(s.openingStartMm)/1000:null}]});
 if(q.summary.check!=='ГОТОВО')return {errors:[q.summary.check],plan:null,total:null};
 if(s.includeNewPosts&&Number(s.existingPostsCount)>q.summary.postsByScheme)return invalid();
 const source=q.sections[0],segments=[],pieces=[];
 if(!source.segments.length||source.segments.some(g=>g.clearSpan<=0))return {errors:['Нет допустимых пролётов'],plan:null,total:null};
 for(const g of source.segments){
  const width=g.clearSpan*1000;
  // Conservative independent-span procurement: no reuse of edge offcuts.
  const perSpan=Math.ceil((width-1e-7)/Number(s.workingMm));
  const betweenSheets=perSpan*g.spans;
  // Cover ordinary posts in the segment footprint, but never bridge a gate/wicket opening.
  const continuousWidthMm=g.footprint*1000;
  const continuousSheets=Math.ceil((continuousWidthMm-1e-7)/Number(s.workingMm));
  const sheets=s.sheetMode==='continuous'?continuousSheets:betweenSheets;
  const coveredWidthMm=s.sheetMode==='continuous'?continuousWidthMm:width*g.spans;
  const railMm=Math.ceil(width-1e-7);
  for(let i=0;i<g.spans*rails;i++)pieces.push(railMm);
  segments.push({key:g.key,spans:g.spans,clearSpanMm:width,sheetsPerSpan:s.sheetMode==='between'?perSpan:null,sheets,betweenSheets,continuousSheets,coveredWidthMm,coveredAreaM2:coveredWidthMm*h/1e6,purchaseAreaM2:sheets*Number(s.fullMm)*h/1e6,railMm});
 }
 const sum=k=>segments.reduce((n,g)=>n+g[k],0),cut=profileFenceCut(pieces,Number(s.kerfMm));
 return {errors:[],total:null,plan:{sheetMode:s.sheetMode,betweenSheets:sum('betweenSheets'),continuousSheets:sum('continuousSheets'),coveredWidthMm:sum('coveredWidthMm'),spans:sum('spans'),posts:q.summary.postsByScheme,newPosts:q.summary.newPosts,existingPosts:q.summary.existingPostsUsed,openingPosts:source.openingSupportPosts,sheets:sum('sheets'),coveredAreaM2:sum('coveredAreaM2'),purchaseAreaM2:sum('purchaseAreaM2'),screws:sum('sheets')*Number(s.screwsPerSheet),overlapMm:Number(s.fullMm)-Number(s.workingMm),rails,pieces:pieces.length,tubeUsedM:cut.usedMm/1000,tubeStocks:cut.stocks,cut,segments}};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n);
const num=(k,l)=>'<label><span>'+l+'</span><input type="number" step="1" inputmode="numeric" data-profile-field="'+k+'"></label>';
const select=(k,l,options)=>'<label><span>'+l+'</span><select data-profile-field="'+k+'">'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>';
const check=(k,l)=>'<label class="kd-product-check"><input type="checkbox" data-profile-field="'+k+'"><span>'+l+'</span></label>';
const profiles=[['60x60x2','60×60×2'],['80x80x3','80×80×3'],['100x100x3','100×100×3']];
export function mountProfileFenceEditor(root,{draft,onDraft,onBack,onReset}={}){
 const state={...PROFILE_FENCE_DEFAULTS,...draft};
 root.innerHTML='<section class="kd-product-editor"><button type="button" class="kd-v2-action" data-profile-back>← К каталогу</button><h3>Забор из профнастила</h3><p class="kd-v2-note">Одна прямая линия, длина вместе со столбами и проёмами. Выберите укладку между столбами или сплошную обшивку. Обрезки между отдельными группами не переиспользуются.</p><div class="kd-v2-card"><div class="kd-product-grid">'+num('lengthMm','Длина участка, мм')+num('heightMm','Высота, мм')+select('post','Столбы',profiles)+select('sheetMode','Расположение листов',[['between','Между столбами'],['continuous','Столбы сзади · сплошная']])+select('rails','Прожилины на пролёт',[['2','2'],['3','3']])+num('existingPostsCount','Готовые опоры, шт.')+'</div>'+check('includeNewPosts','Добавлять новые столбы')+'</div><details class="kd-v2-card"><summary>Листы и крепёж</summary><div class="kd-product-grid">'+num('fullMm','Полная ширина листа, мм')+num('workingMm','Рабочая ширина, мм')+num('screwsPerSheet','Саморезов на лист (предварительно)')+num('kerfMm','Припуск реза трубы, мм')+'</div><small>1200/1140 мм — исходные размеры С10 для ворот. Крепёж и число прожилин подтвердить для конкретного забора.</small></details><details class="kd-v2-card"><summary>Ворота и калитка</summary><div class="kd-product-grid">'+num('gateMm','Проём ворот, мм')+num('wicketMm','Проём калитки, мм')+num('openingStartMm','От начала до узла, мм')+select('openingPost','Столбы проёмов',profiles)+num('betweenMm','Забор между проёмами, мм')+'</div>'+check('shareOpeningPost','Общий столб ворот и калитки')+'</details><div data-profile-errors role="status"></div><div class="kd-v2-card"><h3>Материалы и раскрой</h3><div data-profile-plan></div><details><summary>Хлысты 6 м — предварительная карта реза</summary><div data-profile-cuts></div></details></div><p class="kd-v2-note">Стоимость и сохранение в смету не подключены. Опоры проёмов отдельно. Прожилины в обеих схемах считаются между опорами; крепление снаружи и стыки требуют проверки. Раскрой без монтажных зазоров, не производственное задание.</p><button type="button" class="kd-v2-action" data-profile-reset>Сбросить параметры</button></section>';
 for(const e of root.querySelectorAll('[data-profile-field]')){const k=e.dataset.profileField;if(e.type==='checkbox')e.checked=state[k];else e.value=state[k]}
 function render(){
  const q=profileFencePlan(state),p=q.plan;
  root.querySelector('[data-profile-errors]').textContent=q.errors.join(' ');
  root.querySelector('[data-profile-field="existingPostsCount"]').closest('label').hidden=!state.includeNewPosts;
  const rows=p?[['Пролёты, шт.',p.spans],['Опоры забора',p.posts],['Новые столбы',p.newPosts],['Опоры проёмов отдельно',p.openingPosts],['Листы, шт.',p.sheets],['При укладке между столбами',p.betweenSheets],['При сплошной укладке',p.continuousSheets],['Обшиваемая длина, мм',fmt(p.coveredWidthMm)],['Нахлёст, мм',p.overlapMm],['Площадь заполнения, м²',fmt(p.coveredAreaM2)],['Площадь закупки, м²',fmt(p.purchaseAreaM2)],['Саморезы, шт.',p.screws],['Прожилины, шт.',p.pieces],['Труба 40×20, м',fmt(p.tubeUsedM)],['Хлысты 6 м, шт.',p.tubeStocks],...p.segments.map((g,i)=>['Группа пролётов '+(i+1),g.spans+' × '+fmt(g.clearSpanMm)+' мм; обшивка '+fmt(g.coveredWidthMm)+' мм; листов '+g.sheets])]:[];
  root.querySelector('[data-profile-plan]').innerHTML=rows.map(([l,v])=>'<div class="kd-product-row"><span>'+l+'</span><b>'+v+'</b></div>').join('');
  root.querySelector('[data-profile-cuts]').textContent=p?p.cut.bins.map((b,i)=>(i+1)+': '+b.pieces.join(' + ')+' мм; остаток '+b.remaining+' мм').join('\n'):'';
 }
 root.oninput=e=>{const el=e.target,k=el.dataset.profileField;if(!Object.hasOwn(PROFILE_FENCE_DEFAULTS,k))return;state[k]=el.type==='checkbox'?el.checked:el.value;onDraft?.({...state});render()};
 root.querySelector('[data-profile-back]').onclick=()=>onBack?.();
 root.querySelector('[data-profile-reset]').onclick=()=>{if(window.confirm('Сбросить параметры забора?'))onReset?.()};
 render();
}
