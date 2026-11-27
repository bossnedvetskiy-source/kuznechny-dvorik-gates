import {simpleGateGeometry,simpleGateFill,simpleGateExtras} from './simple-gate-engine.js';
// Serial unfilled swing frames. Dimensions are clear openings between posts.
// Geometry/material estimate only. Never use illustrative lengths as a cut list.
export const SWING_DEFAULTS=Object.freeze({
  product:'set',gateWidthMm:3400,gateHeightMm:1800,wicketWidthMm:1000,wicketHeightMm:1800,
  profile:'40x25x2',gapMode:'sideClearance',diagonal:'40x25x2',paint:false,hinges:false,lock:false,bolts:false,posts:false,
  wicketType:'separate',fill:'none',postType:'none',wicketPosition:'adjacent',manualPosts:'',link:false,installation:'none'
});
const int=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isSafeInteger(Number(v));
export function swingFramePlan(input={}){
  const state={...SWING_DEFAULTS,...input},errors=[];
  if(!['set','gate','wicket'].includes(state.product))errors.push('Выберите изделие.');
  if(!['40x25x2','25x25x1.5'].includes(state.diagonal))errors.push('Выберите профиль диагонали.');
  for(const k of ['paint','hinges','lock','bolts','posts'])if(typeof state[k]!=='boolean')errors.push('Некорректная комплектация.');
  const gate=state.product!=='wicket',wicket=state.product!=='gate';
  const built=state.wicketType==='builtIn';
  if(!['separate','builtIn'].includes(state.wicketType))errors.push('Выберите тип калитки.');
  if(built&&(state.product!=='set'||state.diagonal!=='40x25x2'))errors.push('Встроенная калитка доступна только в комплекте по схеме Excel.');
  for(const [enabled,w,h,gap] of [[gate,'gateWidthMm','gateHeightMm',60],[wicket,'wicketWidthMm','wicketHeightMm',40]]){
    if(enabled&&(!int(state[w])||Number(state[w])<=gap||!int(state[h])||Number(state[h])<=80))errors.push('Укажите положительные целые размеры в мм с учётом зазоров и профиля.');
  }
  if(!['60x40x2','40x40x2','40x25x2'].includes(state.profile)||!['excel','sideClearance'].includes(state.gapMode))errors.push('Выберите профиль и зазоры.');
  if(state.product!=='set'&&state.profile!=='40x25x2')errors.push('Профили 60×40 и 40×40 пока проверены только для комплекта.');
  const leaves=[];
  if(!errors.length){
    if(gate)for(let i=0;i<2;i++)leaves.push({kind:'gate',width:(Number(state.gateWidthMm)-(state.gapMode==='excel'?20:60))/2,height:Number(state.gateHeightMm)});
    if(wicket)leaves.push({kind:built?'embeddedWicket':'wicket',width:Number(state.wicketWidthMm)-(state.gapMode==='excel'?10:40),height:Number(state.wicketHeightMm)});
    if(leaves.some(x=>x.width<=80))errors.push('Недостаточная ширина полотна.');
  }
  if(errors.length)return {errors:[...new Set(errors)],leaves:[],materials:[],total:null};
  if(state.product==='set'&&state.diagonal==='40x25x2'){
    try{
      const config={widthMm:Number(state.gateWidthMm),heightMm:Number(state.gateHeightMm),wicketWidthMm:Number(state.wicketWidthMm),wicketHeightMm:Number(state.wicketHeightMm),profile:state.profile,gapMode:state.gapMode,wicketType:state.wicketType,fill:state.fill,paint:state.paint,postType:state.postType,wicketPosition:state.wicketPosition,manualPosts:state.manualPosts===''?'':Number(state.manualPosts),link:state.link,installation:state.installation};
      const g=simpleGateGeometry(config),fill=simpleGateFill(config),extras=simpleGateExtras(config);
      const materials=[{profile:state.profile,mm:g.main.actualMm,stock:g.main.count}];
      if(g.inner.count)materials.push({profile:'20x20x1.5',mm:g.inner.actualMm,stock:g.inner.count});
      materials.push({profile:'40x20x2',mm:g.rearActualMm,stock:g.rearPurchaseMm/6000});
      return {errors:[],leaves,materials,fill,extras,builtIn:g.builtIn,embeddedOpeningMm:g.builtIn?config.wicketWidthMm:null,total:null,quoteInput:config,workbookGeometry:true,rearNeedsJoin:g.rearNeedsJoin,
        accessories:{hinges:state.hinges?6:0,lock:state.lock?1:0,bolts:state.bolts?1:0,posts:0},paint:state.paint,configuration:state};
    }catch(error){return {errors:[error.message],leaves:[],materials:[],total:null}}
  }
  if(state.profile!=='40x25x2')return {errors:['Для этого профиля используется схема диагоналей из Excel.'],leaves:[],materials:[],total:null};
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
  const embedded=plan.leaves.find(l=>l.kind==='embeddedWicket');
  const outer=plan.leaves.filter(l=>l.kind!=='embeddedWicket');
  const maxH=Math.max(...outer.map(l=>l.height)),totalW=outer.reduce((n,l)=>n+l.width,0)+20*(outer.length-1);
  const s=Math.min(314/totalW,126/maxH);let x=(360-totalW*s)/2;
  let shapes='';
  for(const [i,l] of outer.entries()){
    const w=l.width*s,h=l.height*s,y=140-h;
    shapes+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"/>';
    if(embedded&&i===1){
      const opening=plan.embeddedOpeningMm*s,door=embedded.width*s,dh=embedded.height*s,left=x+(w-opening)/2,dx=x+(w-door)/2,dy=140-dh;
      shapes+='<path d="M'+left+' '+y+'V140 M'+(left+opening)+' '+y+'V140 M'+x+' '+(y+h/2)+'H'+left+' M'+(left+opening)+' '+(y+h/2)+'H'+(x+w)+'"/><rect x="'+dx+'" y="'+dy+'" width="'+door+'" height="'+dh+'" stroke="#2563eb"/>';
    }else shapes+='<path d="M'+x+' '+(y+h/2)+'h'+w+' M'+x+' '+(y+h)+'L'+(x+w)+' '+y+'"/>';
    x+=w+20*s;
  }
  return '<svg viewBox="0 0 360 155" role="img" aria-label="Условный эскиз компоновки, не производственный чертёж"><g fill="none" stroke="#20262d" stroke-width="2">'+shapes+'</g></svg>';
}
export function mountSwingFrameEditor(root,{draft,onDraft,onBack,onReset,onQuote,onSave}={}){
  const state={...SWING_DEFAULTS,...draft};
  root.innerHTML='<section class="kd-product-editor" aria-label="Расчёт каркасов распашных ворот">'+
    '<button type="button" class="kd-v2-action" data-swing-back>← К каталогу</button><h3>Каркасы ворот и калиток</h3>'+
    '<p class="kd-v2-note">Высота готового полотна. Размеры и зазоры — по выбранной схеме.</p>'+
    '<div class="kd-v2-card"><div class="kd-product-sketch" data-swing-sketch></div><div class="kd-product-grid">'+
    '<label><span>Изделие</span><select data-swing-field="product"><option value="set">Ворота с калиткой</option><option value="gate">Только ворота</option><option value="wicket">Только калитка</option></select></label>'+
    '<label data-swing-wicket-type><span>Тип калитки</span><select data-swing-field="wicketType"><option value="separate">Отдельная</option><option value="builtIn">Встроенная</option></select></label>'+
    '<label><span>Основной профиль</span><select data-swing-field="profile"><option value="40x25x2">40×25×2</option><option value="40x40x2">40×40×2</option><option value="60x40x2">60×40×2</option></select></label>'+
    '<label><span>Зазоры</span><select data-swing-field="gapMode"><option value="sideClearance">По проёму: 60 / 40 мм</option><option value="excel">Из Excel: 20 / 10 мм</option></select></label>'+
    '<label><span>Схема диагонали</span><select data-swing-field="diagonal"><option value="40x25x2">По Excel / основной профиль</option><option value="25x25x1.5">25×25×1,5 (предварительно)</option></select></label>'+
    '</div><div class="kd-product-grid" data-swing-gate>'+num('gateWidthMm','Проём ворот, мм')+num('gateHeightMm','Высота ворот, мм')+'</div>'+
    '<div class="kd-product-grid" data-swing-wicket>'+num('wicketWidthMm','Проём калитки, мм')+num('wicketHeightMm','Высота калитки, мм')+'</div></div>'+
    '<div class="kd-v2-card"><h3>Комплектация</h3><div class="kd-product-checks">'+check('paint','Покраска')+check('hinges','Петли')+check('lock','Замок с ручками')+check('bolts','Засовы и штыри')+check('posts','Столбы 80×80×3')+'</div></div>'+
    '<div class="kd-v2-card" data-swing-workbook-options><h3>Заполнение и дополнительные услуги</h3><div class="kd-product-grid">'+
    '<label><span>Заполнение</span><select data-swing-field="fill"><option value="none">Без заполнения</option><option value="single">Односторонний</option><option value="chess">Шахматка</option><option value="horizontal">Горизонтальный</option><option value="sheet">Профнастил</option></select></label>'+
    '<label><span>Столбы</span><select data-swing-field="postType"><option value="none">Без столбов</option><option value="100x100">100×100</option><option value="80x80">80×80</option><option value="60x60">60×60</option></select></label>'+
    '<label data-swing-position><span>Расположение отдельной калитки</span><select data-swing-field="wicketPosition"><option value="adjacent">Рядом</option><option value="separate">Отдельно</option></select></label>'+
    '<label><span>Столбов вручную (необязательно)</span><input type="number" min="0" step="1" inputmode="numeric" data-swing-field="manualPosts" placeholder="По схеме"></label>'+
    '<label><span>Установка</span><select data-swing-field="installation"><option value="none">Без установки</option><option value="set">Ворота + калитка</option><option value="gate">Только ворота</option><option value="wicket">Только калитка</option><option value="builtIn">Ворота со встроенной калиткой</option></select></label>'+
    check('link','Со связкой')+'</div><div data-swing-fill-plan></div></div>'+
    '<div data-swing-errors role="status"></div><div class="kd-v2-card"><h3>Габариты и материалы</h3><div data-swing-plan></div><p class="kd-v2-note">Предварительный расход по геометрии. Для комплекта по Excel — распределение по хлыстам 6 м без ширины реза. Не карта резки. Технологические припуски и длина столбов не рассчитаны.</p></div>'+
    '<div class="kd-v2-card" data-swing-price><b>Стоимость пока не рассчитана</b><small>Тарифы серийных каркасов требуют сверки. Сохранение в смету будет доступно после утверждения цены.</small></div>'+
    (onQuote?'<div class="kd-v2-card"><b>ТЕСТОВЫЙ РЕЖИМ</b><p class="kd-v2-note">Условные тарифы, не коммерческое предложение. Фурнитура по полной комплектации Excel. Только новый тестовый замер.</p><button type="button" class="kd-v2-action" data-swing-demo-quote>Рассчитать на условных тарифах</button><div data-swing-demo-result role="status"></div><button type="button" class="kd-v2-action primary" data-swing-demo-save hidden>Сохранить новый тестовый замер</button></div>':'')+
    '<button type="button" class="kd-v2-action" data-swing-reset>Сбросить параметры</button></section>';
  for(const el of root.querySelectorAll('[data-swing-field]')){const k=el.dataset.swingField;if(el.type==='checkbox')el.checked=state[k];else el.value=state[k];}
  const show=()=>{
    const p=swingFramePlan(state);
    const complete=state.product==='set'&&state.diagonal==='40x25x2';
    const built=state.wicketType==='builtIn';
    root.querySelector('[data-swing-wicket-type]').hidden=!complete;
    root.querySelector('[data-swing-position]').hidden=built;
    const install=root.querySelector('[data-swing-field="installation"]');
    for(const option of install.options){option.hidden=option.disabled=option.value!=='none'&&(built?option.value!=='builtIn':option.value==='builtIn');}
    root.querySelector('[data-swing-workbook-options]').hidden=!complete;
    root.querySelector('[data-swing-field="posts"]').closest('label').hidden=complete;
    const extraRows=[];
    if(p.fill?.fill==='sheet')extraRows.push(['Профнастил, листов',p.fill.total.sheets],['Закупочная площадь, м²',fmt(p.fill.total.areaM2)]);
    else if(p.fill&&p.fill.fill!=='none')extraRows.push(['Штакетник спереди, шт',p.fill.total.front],['Штакетник сзади, шт',p.fill.total.back],['Запас планок, шт',p.fill.total.spare],['Штакетник к закупке, п.м.',fmt(p.fill.total.picketMm/1000)]);
    if(p.fill?.fill!=='none'&&p.fill)extraRows.push(['Саморезы, шт',p.fill.total.screws]);
    if(p.extras)extraRows.push(['Столбов по схеме',p.extras.schemePosts],['Столбов в комплектации',p.extras.postCount],['Ширина связки, мм',p.extras.linkMm]);
    root.querySelector('[data-swing-fill-plan]').innerHTML=extraRows.map(([label,value])=>'<div class="kd-product-row"><span>'+label+'</span><b>'+value+'</b></div>').join('');
    root.querySelector('[data-swing-gate]').hidden=state.product==='wicket';
    root.querySelector('[data-swing-wicket]').hidden=state.product==='gate';
    root.querySelector('[data-swing-sketch]').innerHTML=(state.profile==='40x25x2'||p.builtIn)?diagram(p):'<small>Эскиз с внутренней рамкой будет добавлен на этапе чертежей.</small>';
    root.querySelector('[data-swing-errors]').textContent=p.errors.join(' ')+(p.rearNeedsJoin?' Задняя закрывашка длиннее 6 м, требуется согласовать стыковку.':'');
    root.querySelector('[data-swing-plan]').innerHTML=p.errors.length?'':p.leaves.map((l,i)=>'<div class="kd-product-row"><span>'+(l.kind==='gate'?'Створка ворот '+(i+1):l.kind==='embeddedWicket'?'Встроенная калитка':'Калитка')+'</span><b>'+fmt(l.width)+' × '+fmt(l.height)+' мм</b></div>').join('')+
      p.materials.map(m=>'<div class="kd-product-row"><span>Труба '+m.profile.replaceAll('x','×')+'</span><b>'+fmt(m.mm/1000)+' м'+(m.stock?' · '+m.stock+' хл.':'')+'</b></div>').join('')+
      [['Петли',p.accessories.hinges],['Замок с ручками',p.accessories.lock],['Засовы/штыри, комплект',p.accessories.bolts],['Столбы 80×80×3',p.accessories.posts]].filter(([,v])=>v>0).map(([label,v])=>'<div class="kd-product-row"><span>'+label+'</span><b>'+v+'</b></div>').join('');
  };
  let demoReply=null,demoBusy=false,version=0;
  const demoResult=root.querySelector('[data-swing-demo-result]'),demoSave=root.querySelector('[data-swing-demo-save]'),demoButton=root.querySelector('[data-swing-demo-quote]');
  const clearDemo=()=>{version++;demoReply=null;if(demoResult)demoResult.textContent='';if(demoSave)demoSave.hidden=true;};
  if(demoButton)demoButton.onclick=async()=>{
    if(demoBusy)return;
    clearDemo();
    const p=swingFramePlan(state);
    if(!p.quoteInput||p.errors.length){demoResult.textContent='Выберите корректный комплект по Excel.';return}
    const revision=version;
    demoBusy=true;demoButton.disabled=true;
    try{
      const reply=await onQuote(p.quoteInput);
      if(revision!==version)return;
      if(reply?.customer?.test!==true)throw Error('Ожидается только тестовый расчёт');
      demoReply=reply;
      demoResult.textContent='Условная цена: '+fmt(reply.customer.prices.total)+' ₽'+(reply.owner?' · Себестоимость (тест): '+fmt(reply.owner.productCost)+' ₽ · Зарплата (тест): '+fmt(reply.owner.wage)+' ₽ · Прибыль изделия (тест): '+fmt(reply.owner.productProfitBeforeRounding)+' ₽':'');
      demoSave.hidden=!onSave;
    }catch(error){if(revision===version)demoResult.textContent=error.message}
    finally{demoBusy=false;demoButton.disabled=false}
  };
  if(demoSave)demoSave.onclick=async()=>{
    if(demoBusy||!demoReply||!onSave)return;
    const p=swingFramePlan(state);
    if(!p.quoteInput||p.errors.length)return;
    demoBusy=true;demoSave.disabled=true;demoButton.disabled=true;
    try{await onSave(p.quoteInput)}catch(error){demoResult.textContent=error.message}
    finally{demoBusy=false;demoSave.disabled=false;demoButton.disabled=false}
  };
  root.addEventListener('input',e=>{
    const el=e.target,k=el.dataset.swingField;if(!Object.hasOwn(SWING_DEFAULTS,k))return;
    clearDemo();
    state[k]=el.type==='checkbox'?el.checked:el.value;
    if(state.product!=='set'||state.diagonal!=='40x25x2'){state.wicketType='separate';root.querySelector('[data-swing-field="wicketType"]').value='separate'}
    if(k==='wicketType'||k==='product'||k==='diagonal'){
      if((state.wicketType==='builtIn'&& !['none','builtIn'].includes(state.installation))||(state.wicketType!=='builtIn'&&state.installation==='builtIn')){state.installation='none';root.querySelector('[data-swing-field="installation"]').value='none'}
      if(state.wicketType==='builtIn'){state.wicketPosition='adjacent';root.querySelector('[data-swing-field="wicketPosition"]').value='adjacent'}
    }
    onDraft?.({...state});show();
  });
  root.querySelector('[data-swing-back]').onclick=()=>onBack?.();
  root.querySelector('[data-swing-reset]').onclick=()=>{if(window.confirm('Сбросить параметры каркаса?'))onReset?.()};
  show();
}
