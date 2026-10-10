(() => {
'use strict';
const $=id=>document.getElementById(id),G=window.TrussGeometry,C=window.CanopyPricing;
const PRICE_KEY='kuzdvor-canopy-admin-prices-v1';
const DEV_SAVED_KEY='kuzdvor-dev-canopy-saved-v1';
const INPUTS=['widthPosts','lengthPosts','visibleHeight','installType','coverage','materialMode','rise','autoRise','trussHeight','existingPosts','beamsExisting','paint'];
const row=(a,b)=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>';
let currentRaw=null,currentPublic=null,userTouched=false;
const rub=n=>Math.round(Number(n)||0).toLocaleString('ru-RU')+' ₽';
const fmt=(n,d=2)=>G.fmt(Number(n)||0,d);
const num=(id,fallback=0)=>{const v=Number($(id)?.value);return Number.isFinite(v)?v:fallback};

function loadAdminPrices(){
  try{return C.mergePrices(JSON.parse(localStorage.getItem(PRICE_KEY)||'{}'))}
  catch{return C.mergePrices({})}
}
function syncRise(){
  const r=Math.round(num('widthPosts',3.4)*1000/6);
  $('riseHint').textContent='Рекомендуемый: '+r+' мм (ширина ÷ 6)';
  if($('autoRise').checked)$('rise').value=r;
}
function rawInput(){
  const p=loadAdminPrices(),lengthM=num('lengthPosts',8.4);
  return {
    widthPostsM:num('widthPosts',3.4),lengthM,visibleHeightM:num('visibleHeight',2.1),
    installType:$('installType').value,coverage:$('coverage').value,farmType:$('farmType').value,farmPreset:$('farmPreset').value,trussType:$('trussType').value,materialMode:$('materialMode').value,lagMode:$('lagMode').value,
    overhangMm:150,riseMm:num('rise',567),heightMm:num('trussHeight',250),endFlatMm:300,cellStepMm:400,
    trussCount:C.autoTrussCount(lengthM,p),postsNeeded:true,existingPosts:num('existingPosts',0),
    beamsExisting:$('beamsExisting').checked,paint:$('paint').checked,delivery:0
  };
}
function clientSummary(g,c){
  $('clientSummary').innerHTML=[
    row('Размер между столбами',fmt(g.widthPostsM)+' × '+fmt(c.lengthM)+' м'),
    row('Ширина фермы с выпусками',fmt(g.widthM)+' м'),
    row('Подъём дуги',Math.round(g.riseM*1000)+' мм'),
    row('Длина верхней дуги',fmt(g.topCircle.length,2)+' м'),
    row('Длина покрытия по дуге',c.coverage==='Без покрытия'?'не требуется':fmt(c.coverageData.coverArcM,2)+' м'),
    row('Площадь',fmt(c.area,1)+' м²'),
    row('Покрытие',c.coverage),
    row('Тип фермы',rawInput().farmType),
    row('Обрешётка',g.trussType),
    row('Материал фермы',g.materialMode),
    row('Лаги 40×20',c.coverage==='Профнастил'?('авто · '+c.lagLines+' линий'):(c.lagMode+' · '+c.lagLines+' линий')),
    row('Установка',c.installType),
    row('Покраска',c.paint?'включена':'без покраски')
  ].join('');
}
function render(){
  syncRise();
  const raw=rawInput();
  if(raw.farmType!=='Арочный'||raw.trussType==='Плоская'){
    const reason=raw.farmType!=='Арочный'
      ?('Для типа «'+raw.farmType+'» пока не задан материал и формула расчёта.')
      :'Плоская обрешётка пока не настроена.';
    $('geometryWarning').hidden=false;
    $('geometryWarning').textContent=reason;
    $('drawingStatus').textContent='ожидает настройки';
    $('totalPrice').textContent='—';
    $('clientSummary').innerHTML=[
      row('Тип фермы',raw.farmType),
      row('Обрешётка',raw.trussType),
      row('Материал фермы',raw.materialMode)
    ].join('');
    currentRaw=null;currentPublic=null;
    const viewport=$('canopyViewport');
    if(viewport){
      let notice=viewport.querySelector('.three-config-notice');
      if(!notice){
        notice=document.createElement('div');
        notice.className='three-config-notice';
        viewport.append(notice);
      }
      notice.innerHTML='<b>Вариант ещё не настроен</b><span>'+reason+'</span>';
    }
    return;
  }
  const g=G.compute(raw);
  window.__TRUSS_CURRENT=g;
  if(!g.ok){
    $('geometryWarning').hidden=false;
    $('geometryWarning').textContent=g.errors.join(' ');
    $('drawingStatus').textContent='проверьте размеры';
    $('totalPrice').textContent='—';
    $('clientSummary').innerHTML='';
    // Do not remove the live WebGL canvas when a user is mid-typing (e.g. 8 -> 80 -> 800).
    // Keep the last valid model visible and show a temporary notice instead.
    const viewport=$('canopyViewport');
    if(viewport){
      let notice=viewport.querySelector('.three-geometry-notice');
      if(!notice){
        notice=document.createElement('div');
        notice.className='three-geometry-notice three-config-notice';
        viewport.append(notice);
      }
      notice.innerHTML='<b>Проверьте подъём дуги</b><span>Введите допустимый размер — навес и цена обновятся автоматически.</span>';
    }
    return;
  }
  const c=C.compute(raw,g,loadAdminPrices());
  g.trussCount=c.trussCount;
  window.__CANOPY_PUBLIC=c;
  currentRaw={...raw};
  currentPublic={total:Math.round(c.total),area:c.area,coverage:c.coverage,visibleHeightM:c.visibleHeightM,lengthM:c.lengthM,paint:c.paint};

  const warnings=[];
  // The width / 6 rise is a suggestion, not an invalid geometry warning.
  // A custom rise is allowed and must update pricing and 3D.
  warnings.push(...c.warnings);
  $('geometryWarning').hidden=warnings.length===0;
  $('geometryWarning').textContent=warnings.join(' ');
  $('drawingStatus').textContent='готово';
  $('totalPrice').textContent=c.coverageData.warning?'Требуется уточнение':rub(c.total);

  const status=$('resultStatus');
  if(c.coverageData.warning){
    status.textContent='Параметры покрытия требуют проверки';
    status.classList.add('has-warning');
    status.classList.remove('example');
  }else if(!userTouched){
    status.textContent='Пример расчёта — измените размеры под свой навес';
    status.classList.remove('has-warning');
    status.classList.add('example');
  }else{
    status.textContent='Предварительный расчёт готов';
    status.classList.remove('has-warning','example');
  }
  clientSummary(g,c);
  const lagInfo=$('lagModeInfo');
  const lagChoice=document.querySelector('.lag-choice');
  const lagHint=$('lagModeHint');
  if(c.coverage==='Профнастил'){
    lagChoice?.classList.add('is-auto');
    if(lagHint) lagHint.textContent='Для профнастила шаг считается автоматически 80–100 см';
    if(lagInfo) lagInfo.innerHTML='<strong>'+c.lagLines+' линий</strong> · фактический шаг '+fmt(c.lagStep*100,1)+' см · режим Стандарт/Эконом не применяется';
  }else{
    lagChoice?.classList.remove('is-auto');
    if(lagHint) lagHint.textContent='Выберите баланс жёсткости и стоимости';
    if(lagInfo) lagInfo.innerHTML='<strong>'+c.lagLines+' линий</strong> · фактический шаг '+fmt(c.lagStep*100,1)+' см · '+(c.lagMode==='Эконом'?'не более 50 см':'около 40 см');
  }
  const viewport=$('canopyViewport');
  viewport?.querySelector('.three-config-notice')?.remove();
  if(window.Canopy3D?.render) window.Canopy3D.render(viewport,g,c);
}
function normalizePhone(value){
  let d=String(value||'').replace(/\D/g,'');
  if(d.startsWith('8')&&d.length===11)d='7'+d.slice(1);
  if(d.length===10)d='7'+d;
  return d.length===11&&d.startsWith('7')?'+7 '+d.slice(1,4)+' '+d.slice(4,7)+'-'+d.slice(7,9)+'-'+d.slice(9):String(value||'').trim();
}
function snapshot(){
  const g=window.__TRUSS_CURRENT;
  if(!g?.ok||!currentRaw||!currentPublic)throw new Error('Сначала заполните корректные размеры');
  if(window.__CANOPY_PUBLIC?.coverageData?.warning)throw new Error('Проверьте ограничения покрытия перед сохранением расчёта');
  const raw=currentRaw;
  const rates={...loadAdminPrices()};
  return {
    version:6,
    savedAt:new Date().toISOString(),
    input:{
      widthPostsM:raw.widthPostsM,lengthM:raw.lengthM,visibleHeightM:raw.visibleHeightM,
      installType:raw.installType,coverage:raw.coverage,farmType:raw.farmType,farmPreset:raw.farmPreset,trussType:raw.trussType,lagMode:raw.lagMode,riseMm:raw.riseMm,autoRise:Boolean($('autoRise')?.checked),heightMm:raw.heightMm,
      overhangMm:raw.overhangMm,endFlatMm:raw.endFlatMm,cellStepMm:raw.cellStepMm,
      materialMode:raw.materialMode,existingPosts:raw.existingPosts,beamsExisting:raw.beamsExisting,
      postsNeeded:raw.postsNeeded,paint:raw.paint,delivery:raw.delivery
    },
    pricingSnapshot:{version:'canopy-prices-v1',savedAt:new Date().toISOString(),rates},
    publicSummary:{total:currentPublic.total}
  };
}
function saveLocal(payload){
  const list=JSON.parse(localStorage.getItem(DEV_SAVED_KEY)||'[]');
  const id='DEV-'+Date.now();
  list.unshift({
    id,created_at:new Date().toISOString(),status:'new',category:'canopy',source:'canopy-calculator-dev',
    phone:payload.phone,city:payload.city,product_title:'Арочный навес',total:payload.total,
    configuration:payload.configuration,message:payload.message
  });
  localStorage.setItem(DEV_SAVED_KEY,JSON.stringify(list.slice(0,100)));
  return id;
}
async function saveCalculation(){
  const button=$('saveCalculation'),status=$('saveStatus'),phone=normalizePhone($('savePhone').value),city=$('saveCity').value.trim();
  $('savePhone').value=phone;
  if(String(phone).replace(/\D/g,'').length!==11){status.textContent='Укажите телефон';return;}
  if(city.length<2){status.textContent='Укажите населённый пункт';return;}
  if(!$('saveConsent').checked){status.textContent='Нужно согласие на обработку данных';return;}
  let snap;try{snap=snapshot()}catch(e){status.textContent=e.message;return;}
  const payload={
    phone,city,consent:true,category:'canopy',source:'canopy-calculator',productTitle:'Арочный навес',
    width:snap.input.widthPostsM,height:snap.input.visibleHeightM,install:true,posts:snap.input.postsNeeded,
    total:snap.publicSummary.total,policyVersion:'canopy-v1',
    message:'Сохранён расчёт арочного навеса '+fmt(snap.input.widthPostsM)+' × '+fmt(snap.input.lengthM)+' м.',
    configuration:{canopy:snap}
  };
  button.disabled=true;status.textContent='Сохраняем…';
  try{
    const response=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.id)throw new Error(data?.error||'DEV_LOCAL_FALLBACK');
    status.textContent='Расчёт №'+data.id+' сохранён ✓';
    button.textContent='Сохранено ✓';
  }catch(error){
    try{
      const id=saveLocal(payload);
      status.textContent='Расчёт '+id+' сохранён в DEV‑админке на этом устройстве ✓';
      button.textContent='Сохранено ✓';
    }catch{
      status.textContent=error?.message&&error.message!=='DEV_LOCAL_FALLBACK'?error.message:'Не удалось сохранить расчёт';
    }
  }finally{button.disabled=false;}
}
INPUTS.forEach(id=>{
  const e=$(id);if(!e)return;
  const markAndRender=()=>{
    userTouched=true;
    if(id==='rise'&&document.activeElement===$('rise'))$('autoRise').checked=false;
    render();
  };
  e.addEventListener('input',markAndRender);
  e.addEventListener('change',markAndRender);
});

function bindVisualChoice(buttonSelector,dataKey,inputId){
  const input=$(inputId);
  const buttons=[...document.querySelectorAll(buttonSelector)];
  buttons.forEach(button=>button.addEventListener('click',()=>{
    const value=button.dataset[dataKey];
    if(!value||!input||input.value===value)return;
    input.value=value;
    buttons.forEach(x=>{
      const selected=x===button;
      x.classList.toggle('is-selected',selected);
      x.setAttribute('aria-checked',selected?'true':'false');
    });
    userTouched=true;
    render();
  }));
}

bindVisualChoice('[data-preset-option]','presetOption','farmPreset');
bindVisualChoice('[data-truss-option]','trussOption','trussType');
bindVisualChoice('[data-lag-option]','lagOption','lagMode');

const farmInput=$('farmType'),farmCaption=$('farmTypeCaption');
document.querySelectorAll('[data-farm-type]').forEach(button=>button.addEventListener('click',()=>{
  const value=button.dataset.farmType;
  if(!value||!farmInput)return;
  farmInput.value=value;
  if(farmCaption)farmCaption.textContent=value;
  document.querySelectorAll('[data-farm-type]').forEach(x=>{
    const selected=x===button;
    x.classList.toggle('is-selected',selected);
    x.setAttribute('aria-checked',selected?'true':'false');
  });
  userTouched=true;
  render();
}));
$('savePhone').addEventListener('blur',()=>{$('savePhone').value=normalizePhone($('savePhone').value)});
$('trussForm').addEventListener('submit',e=>e.preventDefault());
$('showSave').addEventListener('click',()=>{
  $('savePanel').hidden=false;
  $('savePanel').scrollIntoView({behavior:'smooth',block:'center'});
  $('savePhone').focus();
});
$('closeSave').addEventListener('click',()=>{$('savePanel').hidden=true});
$('saveCalculation').addEventListener('click',saveCalculation);
$('reset3dView')?.addEventListener('click',()=>window.Canopy3D?.resetView?.());
window.addEventListener('canopy3d-ready',()=>{
  const g=window.__TRUSS_CURRENT,c=window.__CANOPY_PUBLIC,viewport=$('canopyViewport');
  if(g?.ok&&c&&viewport) window.Canopy3D.render(viewport,g,c);
},{once:true});
function restoreSnapshot(saved){
  const snap=saved && typeof saved==='object' ? saved : {};
  const input=snap.input && typeof snap.input==='object' ? snap.input : {};
  const setValue=(id,value)=>{
    const node=$(id);
    if(!node || value===undefined || value===null)return;
    if(node.type==='checkbox')node.checked=Boolean(value);
    else node.value=String(value);
  };
  setValue('widthPosts',input.widthPostsM);
  setValue('lengthPosts',input.lengthM);
  setValue('visibleHeight',input.visibleHeightM);
  setValue('installType',input.installType);
  setValue('coverage',input.coverage);
  setValue('materialMode',input.materialMode);
  setValue('rise',input.riseMm);
  const inferredAutoRise = input.autoRise !== undefined
    ? Boolean(input.autoRise)
    : Math.abs((Number(input.riseMm)||0) - Math.round((Number(input.widthPostsM)||3.4)*1000/6)) < 15;
  setValue('autoRise',inferredAutoRise);
  setValue('trussHeight',input.heightMm);
  setValue('existingPosts',input.existingPosts);
  setValue('beamsExisting',input.beamsExisting);
  setValue('paint',input.paint);
  setValue('farmType',input.farmType);
  setValue('farmPreset',input.farmPreset);
  setValue('trussType',input.trussType);
  setValue('lagMode',input.lagMode);

  if(input.farmType){
    if(farmCaption)farmCaption.textContent=input.farmType;
    document.querySelectorAll('[data-farm-type]').forEach(button=>{
      const selected=button.dataset.farmType===input.farmType;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-checked',selected?'true':'false');
    });
  }
  const syncButtons=(selector,key,value)=>{
    if(!value)return;
    document.querySelectorAll(selector).forEach(button=>{
      const selected=button.dataset[key]===value;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-checked',selected?'true':'false');
    });
  };
  syncButtons('[data-preset-option]','presetOption',input.farmPreset);
  syncButtons('[data-truss-option]','trussOption',input.trussType);
  syncButtons('[data-lag-option]','lagOption',input.lagMode);
  userTouched=true;
  render();
  return true;
}
window.TrussApp={render,rawInput,loadAdminPrices,snapshot,restore:restoreSnapshot};
render();
})();