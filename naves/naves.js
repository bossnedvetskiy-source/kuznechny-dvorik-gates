(() => {
'use strict';
const $=id=>document.getElementById(id),G=window.TrussGeometry,C=window.CanopyPricing;
const PRICE_KEY='kuzdvor-canopy-admin-prices-v1';
const DEV_SAVED_KEY='kuzdvor-dev-canopy-saved-v1';
const INPUTS=['widthPosts','lengthPosts','visibleHeight','installType','coverage','trussType','materialMode','rise','autoRise','trussHeight','existingPosts','beamsExisting','paint'];
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
    installType:$('installType').value,coverage:$('coverage').value,trussType:$('trussType').value,materialMode:$('materialMode').value,
    overhangMm:150,riseMm:num('rise',567),heightMm:num('trussHeight',250),endFlatMm:300,cellStepMm:400,
    trussCount:C.autoTrussCount(lengthM,p),postsNeeded:true,existingPosts:num('existingPosts',0),
    beamsExisting:$('beamsExisting').checked,paint:$('paint').checked,delivery:0
  };
}
function clientSummary(g,c){
  $('clientSummary').innerHTML=[
    row('Размер',fmt(g.widthPostsM)+' × '+fmt(c.lengthM)+' м'),
    row('Площадь',fmt(c.area,1)+' м²'),
    row('Покрытие',c.coverage),
    row('Ферма',g.trussType),
    row('Материал фермы',g.materialMode),
    row('Установка',c.installType),
    row('Покраска',c.paint?'включена':'без покраски')
  ].join('');
}
function render(){
  syncRise();
  const raw=rawInput(),g=G.compute(raw);
  window.__TRUSS_CURRENT=g;
  if(!g.ok){
    $('geometryWarning').hidden=false;
    $('geometryWarning').textContent=g.errors.join(' ');
    $('drawingStatus').textContent='проверьте размеры';
    $('totalPrice').textContent='—';
    $('clientSummary').innerHTML='';
    const viewport=$('canopyViewport');
    if(viewport) viewport.innerHTML='<div class="three-fallback"><b>Проверьте размеры навеса</b><span>После исправления параметров 3D перестроится автоматически.</span></div>';
    return;
  }
  const c=C.compute(raw,g,loadAdminPrices());
  g.trussCount=c.trussCount;
  window.__CANOPY_PUBLIC=c;
  currentRaw={...raw};
  currentPublic={total:Math.round(c.total),area:c.area,coverage:c.coverage,visibleHeightM:c.visibleHeightM,lengthM:c.lengthM,paint:c.paint};

  const warnings=[];
  if(Math.abs(num('rise')-g.recommendedRiseMm)>=15)warnings.push('Подъём дуги отличается от рекомендуемого '+Math.round(g.recommendedRiseMm)+' мм.');
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
  const viewport=$('canopyViewport');
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
  const raw=currentRaw;
  const rates={...loadAdminPrices()};
  return {
    version:4,
    savedAt:new Date().toISOString(),
    input:{
      widthPostsM:raw.widthPostsM,lengthM:raw.lengthM,visibleHeightM:raw.visibleHeightM,
      installType:raw.installType,coverage:raw.coverage,trussType:raw.trussType,riseMm:raw.riseMm,heightMm:raw.heightMm,
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
window.TrussApp={render,rawInput,loadAdminPrices,snapshot};
render();
})();