import '../naves/geometry.js';
import '../naves/pricing.js';
// Existing public canopy engine, without adding tariff constants or changing legacy calculator.
import {CANOPY_DEFAULTS,normalizeCanopyInput} from './v2-canopy-input.js';
export {CANOPY_DEFAULTS};
export function canopyPlan(input={}){
 const invalid=reason=>({errors:[reason],plan:null,total:null});
 let s,raw;
 try{({configuration:s,raw}=normalizeCanopyInput(input))}catch(error){return invalid(error.message)}
 const G=window.TrussGeometry,C=window.CanopyPricing;
 if(!G||!C)return invalid('Расчётный модуль недоступен');
 raw.trussCount=C.autoTrussCount(raw.lengthM);
 const g=G.compute(raw);
 if(!g.ok)return {errors:g.errors,plan:null,total:null};
 const c=C.compute(raw,g,{});
 if(raw.existingPosts>c.totalPosts)return invalid('Готовых столбов больше, чем предусмотрено схемой.');
 if(c.warnings.length)return {errors:c.warnings,plan:null,total:null};
 if(c.postLen>6)return invalid('Столб длиннее стандартного хлыста — отдельный расчёт.');
 const spec=G.productionSpec(g,c.trussCount),roof=c.coverageData;
 const rows=c.materialRows.map(({name,used,sticks,buy,note})=>({name,used,sticks,buy,note}));
 const p={widthMm:G.mm(g.widthM),postSpanMm:G.mm(g.widthPostsM),lengthMm:Number(s.lengthMm),areaM2:c.area,trusses:c.trussCount,posts:c.totalPosts,newPosts:c.newPosts,existingPosts:c.existingPosts,postLengthMm:G.mm(c.postLen),postStepMm:G.mm(c.clearPostStep),beams:c.beamCount,lagLines:c.lagLines,lagStepMm:G.mm(c.lagStep),profile:g.chordProfile,webProfile:g.webProfile,roof:{type:s.coverage,arcMm:G.mm(roof.coverArcM),lengthMm:G.mm(roof.coverLengthM)},materials:rows,spec};
 if(s.coverage==='Поликарбонат')Object.assign(p.roof,{strips:roof.strips,buyMeters:roof.buyMeters,buyCounts:{...roof.buyCounts},connectors:roof.connectors,endProfiles:roof.endProfiles,areaM2:roof.polyArea});
 if(s.coverage==='Профнастил')Object.assign(p.roof,{sheetsAcross:roof.sheetsAcross,parts:roof.parts,partLengthMm:G.mm(roof.partLength),totalParts:roof.totalParts,areaM2:roof.buyArea});
 // No cost or private economics from legacy engine escape this boundary.
 return {errors:[],plan:p,total:null};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n);
const num=(k,l)=>'<label><span>'+l+'</span><input type="number" step="1" inputmode="numeric" data-canopy-field="'+k+'"></label>';
const sel=(k,l,a)=>'<label><span>'+l+'</span><select data-canopy-field="'+k+'">'+a.map(v=>'<option>'+v+'</option>').join('')+'</select></label>';
const chk=(k,l)=>'<label class="kd-product-check"><input type="checkbox" data-canopy-field="'+k+'"><span>'+l+'</span></label>';
function drawing(p){
 if(!p)return '';
 const d=p.spec.geometry,w=d.widthMm,h=d.riseMm,scale=Math.min(300/w,100/h),left=(340-w*scale)/2,y=118;
 const at=(x,yy)=>[left+x*scale,y-yy*scale];
 const arc=(chord,rise,radius,offset)=>Array.from({length:41},(_,i)=>{const x=chord*i/40,yy=-(radius-rise)+Math.sqrt(Math.max(0,radius*radius-(x-chord/2)**2));return at(x+offset,yy).join(',')}).join(' ');
 let lines='<polyline points="'+arc(w,h,d.upperRadiusMm,0)+'" fill="none" stroke="#516678" stroke-width="2"/><polyline points="'+arc(d.innerChordMm,d.lowerRiseMm,d.lowerRadiusMm,d.endFlatMm)+'" fill="none" stroke="#516678" stroke-width="2"/>';
 for(const row of p.spec.rows.filter(r=>!r.id.startsWith('P')))for(const v of row.placements){const a=at(v.from.xMm,v.from.yMm),b=at(v.to.xMm,v.to.yMm);lines+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#516678" stroke-width="1.5"/>';}
 lines+='<line x1="'+left+'" y1="'+y+'" x2="'+(left+d.endFlatMm*scale)+'" y2="'+y+'" stroke="#516678"/><line x1="'+(left+(w-d.endFlatMm)*scale)+'" y1="'+y+'" x2="'+(left+w*scale)+'" y2="'+y+'" stroke="#516678"/>';
 return '<svg viewBox="0 0 340 144" role="img" aria-label="Условная схема фермы по осям">'+lines+'<text x="170" y="137" text-anchor="middle" font-size="11" fill="#516678">'+w+' мм · подъём '+h+' мм</text></svg>';
}
export function mountCanopyEditor(root,{draft,onDraft,onBack,onReset}={}){
 const state={...CANOPY_DEFAULTS,...draft};
 root.innerHTML='<section class="kd-product-editor"><button type="button" class="kd-v2-action" data-canopy-back>← К каталогу</button><h3>Арочный навес</h3><p class="kd-v2-note">Действующая геометрия и закупочная модель навесов. Ширина по опорам, не по краям кровли. Не расчёт снеговой/ветровой нагрузки.</p><div class="kd-v2-card"><div class="kd-product-sketch" data-canopy-sketch></div><div class="kd-product-grid">'+num('widthMm','Ширина по опорам, мм')+num('lengthMm','Длина, мм')+num('visibleHeightMm','Высота столба над землёй, мм')+sel('coverage','Кровля',['Поликарбонат','Профнастил','Без покрытия'])+'</div></div><details class="kd-v2-card"><summary>Фермы и дуга</summary><div class="kd-product-grid">'+sel('trussType','Решётка',['Треугольная','Вертикальная','Усиленная'])+sel('materialMode','Профиль',['30×30×2','40×20×2','Авто'])+num('riseMm','Подъём дуги, мм')+num('trussHeightMm','Высота фермы, мм')+num('overhangMm','Свес фермы, мм')+num('endFlatMm','Прямой край, мм')+num('cellStepMm','Шаг ячейки, мм')+sel('lagMode','Прожилины',['Стандарт','Эконом'])+'</div></details><details class="kd-v2-card"><summary>Столбы и комплектация</summary>'+chk('postsNeeded','Предусмотреть столбы')+num('existingPosts','Готовые столбы, шт.')+sel('installType','Установка опор',['Бетонирование','Закладные'])+chk('beamsExisting','Балки уже имеются')+chk('paint','Покраска')+'</details><div data-canopy-errors role="status"></div><div class="kd-v2-card"><h3>Комплектация и материалы</h3><div data-canopy-plan></div><details><summary>Покупка трубы и деталей</summary><div data-canopy-materials></div></details><details><summary>Детали фермы по осям</summary><div data-canopy-spec></div></details></div><p class="kd-v2-note">Размеры по осям, не углы реза и не готовое производственное ТЗ. Существующий расчёт закупки без гарантии оптимального раскроя. Цены и сохранение пока отключены.</p><button type="button" class="kd-v2-action" data-canopy-reset>Сбросить параметры</button></section>';
 for(const e of root.querySelectorAll('[data-canopy-field]')){const k=e.dataset.canopyField;if(e.type==='checkbox')e.checked=state[k];else e.value=state[k]}
 const output=(selector,rows)=>{const el=root.querySelector(selector);el.replaceChildren();for(const [label,value] of rows){const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');row.className='kd-product-row';a.textContent=label;b.textContent=String(value);row.append(a,b);el.append(row)}};
 function render(){
  const q=canopyPlan(state),p=q.plan;
  root.querySelector('[data-canopy-errors]').textContent=q.errors.join(' ');
  root.querySelector('[data-canopy-sketch]').innerHTML=drawing(p);
  root.querySelector('[data-canopy-field="existingPosts"]').closest('label').hidden=!state.postsNeeded;
  const roof=p?.roof;
  output('[data-canopy-plan]',p?[['Ширина фермы, мм',p.widthMm],['Площадь по опорам, м²',fmt(p.areaM2)],['Фермы, шт.',p.trusses],['Опоры, шт.',p.posts],['Новые столбы, шт.',p.newPosts],['Длина столба, мм',p.postLengthMm],['Балки, шт.',p.beams],['Ряды лаг',p.lagLines],['Шаг лаг, мм',p.lagStepMm],['Кровля',roof.type],...(roof.type==='Поликарбонат'?[['Полосы',roof.strips],['Поликарбонат к закупке, м',roof.buyMeters],['Соединители',roof.connectors],['Торцевой профиль, шт.',roof.endProfiles]]:roof.type==='Профнастил'?[['Листы, шт.',roof.totalParts],['Длина листа, мм',roof.partLengthMm],['Площадь закупки, м²',fmt(roof.areaM2)]]:[])]:[]);
  output('[data-canopy-materials]',p?p.materials.map(r=>[r.name,fmt(r.used)+' м · '+r.sticks+' хлыстов']):[]);
  output('[data-canopy-spec]',p?p.spec.rows.map(r=>[r.id+' '+r.name+' · '+r.profile,r.lengthMm+' мм × '+r.total+' шт.']):[]);
 }
 root.oninput=e=>{const el=e.target,k=el.dataset.canopyField;if(!Object.hasOwn(CANOPY_DEFAULTS,k))return;state[k]=el.type==='checkbox'?el.checked:el.value;onDraft?.({...state});render()};
 root.querySelector('[data-canopy-back]').onclick=()=>onBack?.();
 root.querySelector('[data-canopy-reset]').onclick=()=>{if(window.confirm('Сбросить параметры навеса?'))onReset?.()};
 render();
}
