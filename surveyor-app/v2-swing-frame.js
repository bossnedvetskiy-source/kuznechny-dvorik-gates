// Serial unfilled swing frames. Dimensions are clear openings between posts.
// Geometry/material estimate only. Never use illustrative lengths as a cut list.
export const SWING_DEFAULTS=Object.freeze({
  product:'set',gateWidthMm:3400,gateHeightMm:1800,wicketWidthMm:1000,wicketHeightMm:1800,
  diagonal:'40x25x2',paint:false,hinges:false,lock:false,bolts:false,posts:false
});
const int=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isSafeInteger(Number(v));
export function swingFramePlan(input={}){
  const state={...SWING_DEFAULTS,...input},errors=[];
  if(!['set','gate','wicket'].includes(state.product))errors.push('Выберите изделие.');
  if(!['40x25x2','25x25x1.5'].includes(state.diagonal))errors.push('Выберите профиль диагонали.');
  for(const k of ['paint','hinges','lock','bolts','posts'])if(typeof state[k]!=='boolean')errors.push('Некорректная комплектация.');
  const gate=state.product!=='wicket',wicket=state.product!=='gate';
  for(const [enabled,w,h,gap] of [[gate,'gateWidthMm','gateHeightMm',60],[wicket,'wicketWidthMm','wicketHeightMm',40]]){
    if(enabled&&(!int(state[w])||Number(state[w])<=gap||!int(state[h])||Number(state[h])<=80))errors.push('Укажите положительные целые размеры в мм с учётом зазоров и профиля.');
  }
  const leaves=[];
  if(!errors.length){
    if(gate)for(let i=0;i<2;i++)leaves.push({kind:'gate',width:(Number(state.gateWidthMm)-60)/2,height:Number(state.gateHeightMm)});
    if(wicket)leaves.push({kind:'wicket',width:Number(state.wicketWidthMm)-40,height:Number(state.wicketHeightMm)});
    if(leaves.some(x=>x.width<=80))errors.push('Недостаточная ширина полотна.');
  }
  if(errors.length)return {errors:[...new Set(errors)],leaves:[],materials:[],total:null};
  // Gross geometric stock estimate: full perimeter plus full-width midrail
  // and outside corner diagonal. Actual cuts depend on joint/end treatment.
  const perimeter=leaves.reduce((n,x)=>n+2*(x.width+x.height),0);
  const rail=leaves.reduce((n,x)=>n+x.width,0);
  const diagonal=leaves.reduce((n,x)=>n+Math.hypot(x.width,x.height),0);
  const materials=[{profile:'40x25x2',mm:perimeter+rail+(state.diagonal==='40x25x2'?diagonal:0)}];
  if(state.diagonal!=='40x25x2')materials.push({profile:state.diagonal,mm:diagonal});
  return {errors:[],leaves,materials,perimeter,rail,diagonal,total:null,
    accessories:{hinges:state.hinges?leaves.length*2:0,lock:state.lock&&wicket?1:0,bolts:state.bolts&&gate?1:0,posts:state.posts?(gate&&wicket?3:2):0},
    paint:state.paint,configuration:state};
}
const num=(k,title)=>'<label><span>'+title+'</span><input type="number" min="1" step="1" inputmode="numeric" data-swing-field="'+k+'"></label>';
const check=(k,title)=>'<label class="kd-product-check"><input type="checkbox" data-swing-field="'+k+'"><span>'+title+'</span></label>';
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
function diagram(plan){
  if(!plan.leaves.length)return '';
  const maxH=Math.max(...plan.leaves.map(l=>l.height)),totalW=plan.leaves.reduce((n,l)=>n+l.width,0)+20*(plan.leaves.length-1);
  const s=Math.min(314/totalW,126/maxH);let x=(360-totalW*s)/2;
  let shapes='';
  for(const l of plan.leaves){
    const w=l.width*s,h=l.height*s,y=140-h;
    shapes+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"/><path d="M'+x+' '+(y+h/2)+'h'+w+' M'+x+' '+(y+h)+'L'+(x+w)+' '+y+'"/>';
    x+=w+20*s;
  }
  return '<svg viewBox="0 0 360 155" role="img" aria-label="Условный эскиз рам с перемычкой и диагональю"><g fill="none" stroke="#20262d" stroke-width="2">'+shapes+'</g></svg>';
}
export function mountSwingFrameEditor(root,{draft,onDraft,onBack,onReset}={}){
  const state={...SWING_DEFAULTS,...draft};
  root.innerHTML='<section class="kd-product-editor" aria-label="Расчёт каркасов распашных ворот">'+
    '<button type="button" class="kd-v2-action" data-swing-back>← К каталогу</button><h3>Каркасы ворот и калиток</h3>'+
    '<p class="kd-v2-note">Без заполнения и внутренней рамки. Размеры между столбами, высота готового полотна.</p>'+
    '<div class="kd-v2-card"><div class="kd-product-sketch" data-swing-sketch></div><div class="kd-product-grid">'+
    '<label><span>Изделие</span><select data-swing-field="product"><option value="set">Ворота с калиткой</option><option value="gate">Только ворота</option><option value="wicket">Только калитка</option></select></label>'+
    '<label><span>Профиль диагонали</span><select data-swing-field="diagonal"><option value="40x25x2">40×25×2</option><option value="25x25x1.5">25×25×1,5</option></select></label>'+
    '</div><div class="kd-product-grid" data-swing-gate>'+num('gateWidthMm','Проём ворот, мм')+num('gateHeightMm','Высота ворот, мм')+'</div>'+
    '<div class="kd-product-grid" data-swing-wicket>'+num('wicketWidthMm','Проём калитки, мм')+num('wicketHeightMm','Высота калитки, мм')+'</div></div>'+
    '<div class="kd-v2-card"><h3>Комплектация</h3><div class="kd-product-checks">'+check('paint','Покраска')+check('hinges','Петли')+check('lock','Замок с ручками')+check('bolts','Засовы и штыри')+check('posts','Столбы 80×80×3')+'</div></div>'+
    '<div data-swing-errors role="status"></div><div class="kd-v2-card"><h3>Габариты и материалы</h3><div data-swing-plan></div><p class="kd-v2-note">Предварительный расход по геометрии без оптимизации раскроя. Не карта резки. Технологические припуски и длина столбов не рассчитаны.</p></div>'+
    '<div class="kd-v2-card"><b>Стоимость пока не рассчитана</b><small>Тарифы серийных каркасов требуют сверки. Сохранение в смету будет доступно после утверждения цены.</small></div>'+
    '<button type="button" class="kd-v2-action" data-swing-reset>Сбросить параметры</button></section>';
  for(const el of root.querySelectorAll('[data-swing-field]')){const k=el.dataset.swingField;if(el.type==='checkbox')el.checked=state[k];else el.value=state[k];}
  const show=()=>{
    const p=swingFramePlan(state);
    root.querySelector('[data-swing-gate]').hidden=state.product==='wicket';
    root.querySelector('[data-swing-wicket]').hidden=state.product==='gate';
    root.querySelector('[data-swing-sketch]').innerHTML=diagram(p);
    root.querySelector('[data-swing-errors]').textContent=p.errors.join(' ');
    root.querySelector('[data-swing-plan]').innerHTML=p.errors.length?'':p.leaves.map((l,i)=>'<div class="kd-product-row"><span>'+(l.kind==='gate'?'Створка ворот '+(i+1):'Калитка')+'</span><b>'+fmt(l.width)+' × '+fmt(l.height)+' мм</b></div>').join('')+
      p.materials.map(m=>'<div class="kd-product-row"><span>Труба '+m.profile.replaceAll('x','×')+'</span><b>'+fmt(m.mm/1000)+' м</b></div>').join('')+
      [['Петли',p.accessories.hinges],['Замок с ручками',p.accessories.lock],['Засовы/штыри, комплект',p.accessories.bolts],['Столбы 80×80×3',p.accessories.posts]].filter(([,v])=>v>0).map(([label,v])=>'<div class="kd-product-row"><span>'+label+'</span><b>'+v+'</b></div>').join('');
  };
  root.addEventListener('input',e=>{
    const el=e.target,k=el.dataset.swingField;if(!Object.hasOwn(SWING_DEFAULTS,k))return;
    state[k]=el.type==='checkbox'?el.checked:el.value;
    onDraft?.({...state});show();
  });
  root.querySelector('[data-swing-back]').onclick=()=>onBack?.();
  root.querySelector('[data-swing-reset]').onclick=()=>{if(window.confirm('Сбросить параметры каркаса?'))onReset?.()};
  show();
}
