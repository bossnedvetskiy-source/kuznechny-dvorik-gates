// Forged fences are a separate product, not a gate-price or picket formula.
// Standard section size comes from the owner's November 2026 listing export.
// No verified article-to-design, bill of materials or rate table is available yet.
export const ART_FENCE_DEFAULTS=Object.freeze({article:'',sectionWidthMm:1000,heightMm:1700,count:1,supportMode:'existing',postSizeMm:80,manualNewPosts:'',fill:'sheet',paint:true,install:false});
const integer=(raw,min,max)=>((typeof raw==='string'&&raw.trim()!=='')||typeof raw==='number')&&Number.isSafeInteger(Number(raw))&&Number(raw)>=min&&Number(raw)<=max;
export function artFencePlan(input={}){
 const s={...ART_FENCE_DEFAULTS,...input},errors=[];
 if(!integer(s.sectionWidthMm,1,10000)||!integer(s.heightMm,1,6000)||!integer(s.count,1,200))errors.push('Укажите целые положительные размеры и количество секций (1–200).');
 if(typeof s.article!=='string'||s.article.length>80)errors.push('Обозначение модели — до 80 символов.');
 if(!['existing','new','mixed'].includes(s.supportMode)||![60,80,100].includes(Number(s.postSizeMm))||!['sheet','open'].includes(s.fill)||typeof s.paint!=='boolean'||typeof s.install!=='boolean')errors.push('Проверьте комплектацию.');
 const count=Number(s.count);
 const supports=count+1;
 if(s.supportMode==='mixed'&&!integer(s.manualNewPosts,0,supports))errors.push('Укажите количество новых столбов от 0 до '+supports+'.');
 if(errors.length)return {errors,plan:null,total:null};
 const w=Number(s.sectionWidthMm),h=Number(s.heightMm),size=Number(s.postSizeMm);
 const newPosts=s.supportMode==='new'?supports:s.supportMode==='existing'?0:Number(s.manualNewPosts);
 // Section widths are nominal opening widths. No welding/mounting clearances inferred.
 // Total including posts is only known under the all-new, equal-profile, straight-line assumption.
 return {errors:[],total:null,plan:{count,sectionWidthMm:w,heightMm:h,openingSumMm:w*count,sectionAreaM2:w*h*count/1e6,supports,newPosts,existingPosts:supports-newPosts,outerLengthMm:s.supportMode==='new'?w*count+supports*size:null,configuration:{article:s.article.trim(),sectionWidthMm:w,heightMm:h,count,supportMode:s.supportMode,postSizeMm:size,manualNewPosts:s.supportMode==='mixed'?newPosts:null,fill:s.fill,paint:s.paint,install:s.install}}};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n);
const number=(key,label)=>'<label><span>'+label+'</span><input type="number" min="1" step="1" inputmode="numeric" data-art-fence-field="'+key+'"></label>';
const select=(key,label,options)=>'<label><span>'+label+'</span><select data-art-fence-field="'+key+'">'+options.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>';
const check=(key,label)=>'<label class="kd-product-check"><input type="checkbox" data-art-fence-field="'+key+'"><span>'+label+'</span></label>';
function sketch(p){
 if(!p)return '';
 const n=Math.min(p.count,4),size=p.configuration.postSizeMm,span=p.sectionWidthMm;
 const scale=Math.min(310/(n*span+(n+1)*size),110/p.heightMm),w=span*scale,h=p.heightMm*scale,sw=size*scale;
 const left=(340-(n*w+(n+1)*sw))/2,y=130-h;
 let elements='';
 for(let i=0;i<=n;i++){
  const x=left+i*(w+sw);elements+='<rect x="'+x+'" y="'+(y-6)+'" width="'+sw+'" height="'+(h+6)+'" fill="#536273"/>';
  if(i<n)elements+='<rect x="'+(x+sw)+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="#536273" stroke-width="1.7"/>';
 }
 return '<svg viewBox="0 0 340 154" role="img" aria-label="Условные прямые пролёты без рисунка ковки">'+elements+'<text x="170" y="147" text-anchor="middle" font-size="11" fill="#536273">'+p.count+' секц. × '+p.sectionWidthMm+' мм</text></svg>';
}
export function mountArtFenceEditor(root,{draft,onDraft,onBack,onReset}={}){
 const state={...ART_FENCE_DEFAULTS,...draft};
 root.innerHTML='<section class="kd-product-editor" aria-label="Кованые заборы Арт."><button class="kd-v2-action" type="button" data-art-fence-back>← К каталогу</button><h3>Кованые заборы Арт.</h3><p class="kd-v2-note">Прямой участок с одинаковыми секциями. Стандарт из объявлений: 1000 × 1700 мм. Ширина секции — между столбами; монтажные зазоры пока не рассчитаны.</p><div class="kd-v2-card"><div class="kd-product-sketch" data-art-fence-sketch></div><label><span>Артикул / обозначение модели (вручную)</span><input data-art-fence-field="article" type="text" maxlength="80" placeholder="Из каталога секций"></label><div class="kd-product-grid">'+number('sectionWidthMm','Ширина секции, мм')+number('heightMm','Высота, мм')+number('count','Количество секций')+select('supportMode','Опоры',[['existing','Готовые'],['new','Все новые'],['mixed','Часть новых']])+'<div data-art-fence-post-size>'+select('postSizeMm','Размер новых столбов',[['60','60×60'],['80','80×80'],['100','100×100']])+'</div><label data-art-fence-new-count><span>Новых столбов, шт.</span><input type="number" min="0" step="1" inputmode="numeric" data-art-fence-field="manualNewPosts"></label></div></div><div class="kd-v2-card"><h3>Комплектация</h3>'+select('fill','Заполнение',[['sheet','С профнастилом'],['open','Открытая ковка']])+check('paint','Покраска')+check('install','Монтаж')+'</div><div data-art-fence-errors role="status"></div><div class="kd-v2-card"><h3>Габариты и количество</h3><div data-art-fence-plan></div></div><div class="kd-v2-card" role="status"><b>Стоимость не рассчитывается</b><small>Пока нет утверждённого справочника моделей секций, формул материалов и тарифов. Площадь геометрическая, не количество листов или расход металла. Сохранение в смету недоступно.</small></div><button class="kd-v2-action" type="button" data-art-fence-reset>Сбросить параметры</button></section>';
 const fields=[...root.querySelectorAll('[data-art-fence-field]')];
 for(const el of fields){const key=el.dataset.artFenceField;if(el.type==='checkbox')el.checked=state[key];else el.value=state[key]}
 function show(){
  const {plan,errors}=artFencePlan(state);
  root.querySelector('[data-art-fence-post-size]').hidden=state.supportMode==='existing';
  root.querySelector('[data-art-fence-new-count]').hidden=state.supportMode!=='mixed';
  root.querySelector('[data-art-fence-errors]').textContent=errors.join(' ');
  root.querySelector('[data-art-fence-sketch]').innerHTML=sketch(plan);
  const rows=plan?[['Секций, шт.',plan.count],['Сумма ширин проёмов, мм',plan.openingSumMm],['Площадь секций, м²',fmt(plan.sectionAreaM2)],['Всего опор, шт.',plan.supports],['Новых столбов, шт.',plan.newPosts],['Готовых опор, шт.',plan.existingPosts],['Длина с опорами, мм',plan.outerLengthMm??'Нужны размеры готовых опор']]:[];
  const out=root.querySelector('[data-art-fence-plan]');out.replaceChildren();
  for(const [label,value] of rows){const row=document.createElement('div'),name=document.createElement('span'),v=document.createElement('b');row.className='kd-product-row';name.textContent=label;v.textContent=String(value);row.append(name,v);out.append(row)}
 }
 root.addEventListener('input',e=>{const el=e.target,key=el.dataset.artFenceField;if(!Object.hasOwn(ART_FENCE_DEFAULTS,key))return;state[key]=el.type==='checkbox'?el.checked:el.value;onDraft?.({...state});show()});
 root.querySelector('[data-art-fence-back]').onclick=()=>onBack?.();
 root.querySelector('[data-art-fence-reset]').onclick=()=>{if(window.confirm('Сбросить параметры секций?'))onReset?.()};
 show();
}
