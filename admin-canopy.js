(() => {
'use strict';
const PRICE_KEY='kuzdvor-canopy-admin-prices-v1';
const DEV_SAVED_KEY='kuzdvor-dev-canopy-saved-v1';
const PRICE_FIELDS=[
 ['tube25','25×25×1,5','₽/м'],['tube20','20×20×1,5','₽/м'],['tube30','30×30×2','₽/м'],['tube25web','25×25×1,5 (решётка)','₽/м'],
 ['tube40x20','40×20×2','₽/м'],['tube40x40','40×40×2','₽/м'],['tube80','80×80×3','₽/м'],['poly','Поликарбонат 8 мм','₽/пог.м'],
 ['connector','Соединитель 6 м','₽/шт'],['endProfile','Торцевой профиль 2,1 м','₽/шт'],['profnastil','Профнастил','₽/м²'],
 ['weld4m','ЗП сварка фермы 4 м','₽/ферма'],['mountCover','ЗП монтаж с покрытием','₽/м²'],['mountNoCover','ЗП монтаж без покрытия','₽/м²'],
 ['postConcrete','ЗП установка столба','₽/шт'],['postPlate','Закладная / столб','₽/шт'],['paint','Покраска','₽/м²'],
 ['wire','Проволока + газ','₽/ферма'],['discs','Круги','₽/ферма'],['markup','Наценка полного навеса','%'],['ownerMount','Доп. прибыль из монтажа','₽/м²'],['separateMarkup','Наценка отдельной фермы','%']
];
const escape=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const money=v=>Math.round(Number(v)||0).toLocaleString('ru-RU')+' ₽';
const fmt=(v,d=2)=>Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?String(v||''):d.toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})};
const toast=(m,bad=false)=>typeof window.showToast==='function'?window.showToast(m,bad):console[bad?'error':'log'](m);
const root=document.querySelector('.editor-shell'),nav=document.querySelector('.admin-tabs');if(!root||!nav)return;

const tab=document.createElement('button');tab.className='admin-tab';tab.type='button';tab.dataset.adminTab='canopy-orders';tab.textContent='🏗 Навесы';nav.prepend(tab);
const panel=document.createElement('section');panel.className='admin-tab-panel';panel.id='canopyOrdersTab';panel.hidden=true;
panel.innerHTML=`
  <div class="page-title"><div><p class="eyebrow">Сохранённые расчёты</p><h1>Навесы</h1></div><p>Внутренние расчёты, ТЗ сварщику и 2D‑чертежи доступны только здесь.</p></div>
  <div class="canopy-admin-toolbar"><div id="canopyAdminStats"></div><button class="reset-button" id="canopyReload" type="button">Обновить</button></div>
  <div id="canopyOrderList" class="canopy-order-list"></div>
  <p id="canopyEmpty" class="empty-photos" hidden>Сохранённых расчётов навесов пока нет.</p>
  <details class="canopy-price-settings">
    <summary><span><b>Прайс и внутренние ставки навесов</b><small>Эти настройки клиент не видит</small></span><i>⌄</i></summary>
    <div id="canopyAdminPriceGrid" class="canopy-admin-price-grid"></div>
    <button class="reset-button" id="canopyResetPrices" type="button">Сбросить к базовым</button>
  </details>
  <dialog id="canopyAdminDialog" class="canopy-admin-dialog">
    <div class="canopy-dialog-shell">
      <div class="canopy-dialog-head"><div><small>Внутренний расчёт</small><h2 id="canopyDialogTitle">Навес</h2></div><button id="canopyDialogClose" type="button">×</button></div>
      <div id="canopyDialogBody"></div>
    </div>
  </dialog>`;
root.append(panel);

const style=document.createElement('style');style.textContent=`
.canopy-admin-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.canopy-order-list{display:grid;gap:10px}.canopy-order-card{padding:15px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(18,16,13,.04)}.canopy-order-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.canopy-order-card-head b{font-size:14px}.canopy-order-card-head small{display:block;color:var(--muted);margin-top:4px}.canopy-order-price{font:18px Prata,serif;color:#8a6326}.canopy-order-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:12px 0}.canopy-order-meta span{padding:8px 9px;border-radius:9px;background:#f7f4ef;font-size:10px}.canopy-order-actions{display:flex;justify-content:flex-end}.canopy-price-settings{margin-top:18px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#faf8f4}.canopy-price-settings summary{display:flex;justify-content:space-between;cursor:pointer;list-style:none}.canopy-price-settings summary::-webkit-details-marker{display:none}.canopy-price-settings summary span{display:grid;gap:3px}.canopy-price-settings summary small{color:var(--muted)}.canopy-admin-price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.canopy-admin-price-grid label{display:grid;gap:5px}.canopy-admin-price-grid span{font-size:9px;color:var(--muted);font-weight:800}.canopy-admin-price-grid input{height:38px;border:1px solid var(--line);border-radius:9px;padding:0 9px;background:#fff}.canopy-admin-dialog{width:min(1120px,calc(100% - 20px));max-height:94vh;padding:0;border:0;border-radius:18px;background:#fff;color:var(--ink);box-shadow:0 30px 100px rgba(0,0,0,.28)}.canopy-admin-dialog::backdrop{background:rgba(0,0,0,.54)}.canopy-dialog-shell{padding:18px}.canopy-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.canopy-dialog-head small{color:#9a6d28;font-weight:900;text-transform:uppercase;font-size:9px;letter-spacing:.5px}.canopy-dialog-head h2{margin:3px 0 0}.canopy-dialog-head button{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:24px}.canopy-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.canopy-admin-box{padding:13px;border:1px solid var(--line);border-radius:13px;background:#faf8f4}.canopy-admin-box h3{margin:0 0 9px;font-size:13px}.canopy-admin-dl{margin:0}.canopy-admin-dl div{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #e7e1d8}.canopy-admin-dl div:last-child{border-bottom:0}.canopy-admin-dl dt{color:var(--muted);font-size:10px}.canopy-admin-dl dd{margin:0;font-size:10px;font-weight:900;text-align:right}.canopy-admin-svg{margin-top:12px;border:1px solid var(--line);border-radius:13px;background:#f8f7f2;overflow:hidden}.canopy-admin-svg svg{display:block;width:100%;height:auto}.canopy-admin-table{overflow:auto;margin-top:12px;border:1px solid var(--line);border-radius:12px}.canopy-admin-table table{border-collapse:collapse;width:100%;min-width:760px}.canopy-admin-table th,.canopy-admin-table td{padding:8px 9px;border-bottom:1px solid var(--line);font-size:10px;text-align:left;white-space:nowrap}.canopy-admin-table th{background:#f1ece4}.canopy-print-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
@media(max-width:900px){.canopy-admin-price-grid{grid-template-columns:repeat(2,1fr)}.canopy-order-meta,.canopy-admin-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.canopy-admin-price-grid,.canopy-order-meta,.canopy-admin-grid{grid-template-columns:1fr}.canopy-order-card-head{flex-direction:column}.canopy-dialog-shell{padding:11px}}`;document.head.append(style);

const list=panel.querySelector('#canopyOrderList'),empty=panel.querySelector('#canopyEmpty'),stats=panel.querySelector('#canopyAdminStats'),dialog=panel.querySelector('#canopyAdminDialog'),body=panel.querySelector('#canopyDialogBody');
let items=[],loadedScripts=null;

function asset(path){return path;}
function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src&&s.src.endsWith(src.replace(/^\//,'')));if(existing){resolve();return;}const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Не загрузился '+src));document.head.append(s);});}
async function ensureTools(){
  if(window.TrussGeometry&&window.CanopyPricing&&window.TrussDrawing)return;
  if(!loadedScripts)loadedScripts=(async()=>{await loadScript(asset('/naves/geometry.js'));await loadScript(asset('/naves/pricing.js'));await loadScript(asset('/naves/drawing.js'));})();
  return loadedScripts;
}
function loadPrices(){try{return window.CanopyPricing.mergePrices(JSON.parse(localStorage.getItem(PRICE_KEY)||'{}'));}catch{return window.CanopyPricing.mergePrices({});}}
function savePrices(){
  const x={};PRICE_FIELDS.forEach(([k])=>{const v=Number(panel.querySelector('#cap-price-'+k)?.value);if(Number.isFinite(v)&&v>=0)x[k]=v;});
  localStorage.setItem(PRICE_KEY,JSON.stringify(x));return x;
}
function buildPriceGrid(){
  const defaults=window.CanopyPricing.DEFAULTS,p=loadPrices();
  panel.querySelector('#canopyAdminPriceGrid').innerHTML=PRICE_FIELDS.map(([k,label,unit])=>`<label><span>${escape(label)}, ${escape(unit)}</span><input id="cap-price-${k}" type="number" min="0" step="${unit==='%'?'1':'10'}" value="${p[k]??defaults[k]}"></label>`).join('');
  PRICE_FIELDS.forEach(([k])=>panel.querySelector('#cap-price-'+k).addEventListener('change',()=>{savePrices();toast('Ставки навеса сохранены')}));
}
function readLocal(){try{return JSON.parse(localStorage.getItem(DEV_SAVED_KEY)||'[]').map(x=>({...x,_local:true}));}catch{return[];}}
async function readServer(){
  try{
    const r=await fetch('/api/admin/leads?category=canopy&limit=100',{headers:{accept:'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error('server unavailable');const d=await r.json();return Array.isArray(d.leads)?d.leads:[];
  }catch{return[];}
}
function snapOf(lead){return lead?.configuration?.canopy||lead?.configuration?.canopyCalc||null;}
function renderList(){
  empty.hidden=items.length>0;stats.textContent='Расчётов: '+items.length;
  list.innerHTML=items.map((lead,index)=>{
    const s=snapOf(lead),inp=s?.input||{},local=lead._local?' · DEV локально':'';
    return `<article class="canopy-order-card"><div class="canopy-order-card-head"><div><b>#${escape(lead.id)} · ${escape(lead.city||'Без населённого пункта')}</b><small>${escape(date(lead.created_at))} · ${escape(lead.phone||'')}${local}</small></div><strong class="canopy-order-price">${money(lead.total)}</strong></div><div class="canopy-order-meta"><span>Размер <b>${escape(fmt(inp.widthPostsM))} × ${escape(fmt(inp.lengthM))} м</b></span><span>Высота <b>${escape(fmt(inp.visibleHeightM))} м</b></span><span>Покрытие <b>${escape(inp.coverage||'—')}</b></span><span>Подъём <b>${escape(Math.round(inp.riseMm||0))} мм</b></span></div><div class="canopy-order-actions"><button class="reset-button" data-open-canopy="${index}" type="button">Открыть внутренний расчёт</button></div></article>`;
  }).join('');
  list.querySelectorAll('[data-open-canopy]').forEach(b=>b.addEventListener('click',()=>openItem(items[Number(b.dataset.openCanopy)])));
}
async function load(){
  await ensureTools();buildPriceGrid();
  const server=await readServer(),local=readLocal();
  const ids=new Set(server.map(x=>String(x.id)));items=[...server,...local.filter(x=>!ids.has(String(x.id)))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  renderList();
}
function calculate(lead){
  const snap=snapOf(lead);if(!snap?.input)throw new Error('В расчёте нет исходных параметров');
  const raw={...snap.input};raw.trussCount=window.CanopyPricing.autoTrussCount(raw.lengthM,loadPrices());
  const g=window.TrussGeometry.compute(raw);if(!g.ok)throw new Error(g.errors.join(' '));
  const c=window.CanopyPricing.compute(raw,g,loadPrices());g.trussCount=c.trussCount;return {snap,raw,g,c};
}
const dl=rows=>'<dl class="canopy-admin-dl">'+rows.map(([a,b])=>'<div><dt>'+escape(a)+'</dt><dd>'+escape(b)+'</dd></div>').join('')+'</dl>';
function materialTable(c){return '<div class="canopy-admin-table"><table><thead><tr><th>Материал</th><th>Используется</th><th>Хлыстов</th><th>Купить</th><th>Стоимость</th></tr></thead><tbody>'+c.materialRows.map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+fmt(x.used)+' м</td><td>'+x.sticks+'</td><td>'+fmt(x.buy,0)+' м</td><td>'+money(x.cost)+'</td></tr>').join('')+'</tbody></table></div>'}
function cutTable(g,c){const rows=[['P1','Верхний пояс',g.chordProfile,window.TrussGeometry.mm(g.topCircle.length),1,c.trussCount,'дуга'],['P2','Нижний пояс',g.chordProfile,window.TrussGeometry.mm(g.lowerTotalM),1,c.trussCount,'дуга + края'],['V','Торцевая стойка',g.webProfile,window.TrussGeometry.mm(g.endPostM),2,2*c.trussCount,'90°']];g.diagonals.forEach(d=>rows.push(['D'+d.index,'Диагональ '+d.index,g.webProfile,window.TrussGeometry.mm(d.lengthM),1,c.trussCount,fmt(d.angleDeg,1)+'°']));return '<div class="canopy-admin-table"><table><thead><tr><th>Поз.</th><th>Деталь</th><th>Профиль</th><th>Длина, мм</th><th>На 1</th><th>Всего</th><th>Угол</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function printDoc(title,html){const w=window.open('','_blank');if(!w)return toast('Браузер заблокировал печать',true);w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+escape(title)+'</title><style>body{font:12px Arial,sans-serif;color:#111;margin:22px}h1{font-size:20px}h2{font-size:15px;margin-top:18px}svg{width:100%;height:auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:5px;text-align:left}dl div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:4px}dd{font-weight:bold}.note{margin-top:12px;font-size:10px}</style></head><body>'+html+'</body></html>');w.document.close();setTimeout(()=>{w.focus();w.print()},250)}
async function openItem(lead){
  try{
    await ensureTools();const {g,c}=calculate(lead);panel.querySelector('#canopyDialogTitle').textContent='Навес #'+lead.id+' · '+(lead.city||'');
    body.innerHTML=`
      <div class="canopy-admin-grid">
        <section class="canopy-admin-box"><h3>Заказ</h3>${dl([['Клиент',lead.phone||'—'],['Размер',fmt(g.widthPostsM)+' × '+fmt(c.lengthM)+' м'],['Высота',fmt(c.visibleHeightM)+' м'],['Покрытие',c.coverage],['Ферм',c.trussCount+' шт'],['Опор','всего '+c.totalPosts+', новых '+c.newPosts],['Балки',c.beamsExisting?'есть у заказчика':'2 шт изготовить']])}</section>
        <section class="canopy-admin-box"><h3>Финансы</h3>${dl([['Цена при сохранении',money(lead.total)],['Текущий пересчёт',money(c.total)],['Расчётная база',money(c.base)],['Фактические расходы',money(c.actualExpenses)],['Наценка',money(c.markup)],['Доп. прибыль из монтажа',money(c.ownerMount)],['Прибыль до налогов',money(c.profit)],['Маржа',fmt(c.margin,1)+'%']])}</section>
        <section class="canopy-admin-box"><h3>ЗП / работы</h3>${dl([['Сварка ферм',money(c.weld)],['Монтаж навеса',money(c.mount)],['Установка новых столбов',money(c.postMount)],['Покраска',money(c.paintCost)],['Расходники ферм',money(c.consumables)]])}</section>
        <section class="canopy-admin-box"><h3>Одна ферма</h3>${dl([['Себестоимость без покраски',money(c.oneTruss.cost)],['Цена отдельно без покраски',money(c.oneTruss.priceNoPaint)],['Цена отдельно с покраской',money(c.oneTruss.pricePaint)],['Прибыль без покраски',money(c.oneTruss.profitNoPaint)],['Прибыль с покраской',money(c.oneTruss.profitPaint)]])}</section>
      </div>
      <h3>Материалы и закупка</h3>${materialTable(c)}
      <h3>2D‑чертёж фермы</h3><div class="canopy-admin-svg"><svg id="canopyAdminTrussSvg" viewBox="0 0 1200 640"></svg></div>
      <h3>ТЗ сварщику</h3>${cutTable(g,c)}
      <div class="canopy-print-actions"><button class="reset-button" id="canopyPrintDrawing" type="button">Печать чертежа + ТЗ</button><button class="reset-button" id="canopyPrintFull" type="button">Печать полного расчёта</button></div>`;
    const svg=body.querySelector('#canopyAdminTrussSvg');window.TrussDrawing.render(svg,g);
    body.querySelector('#canopyPrintDrawing').onclick=()=>printDoc('ТЗ навеса '+lead.id,'<h1>ТЗ сварщику · навес #'+escape(lead.id)+'</h1>'+new XMLSerializer().serializeToString(svg)+'<h2>Раскрой фермы</h2>'+cutTable(g,c)+'<p class="note">Перед серийной резкой изготовить одну контрольную ферму по шаблону.</p>');
    body.querySelector('#canopyPrintFull').onclick=()=>printDoc('Расчёт навеса '+lead.id,'<h1>Внутренний расчёт навеса #'+escape(lead.id)+'</h1>'+body.innerHTML.replace(/<div class="canopy-print-actions">[\s\S]*?<\/div>$/,''));
    dialog.showModal();
  }catch(e){toast(e.message||'Не удалось открыть расчёт',true)}
}
panel.querySelector('#canopyDialogClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
panel.querySelector('#canopyReload').addEventListener('click',load);
panel.querySelector('#canopyResetPrices').addEventListener('click',()=>{localStorage.removeItem(PRICE_KEY);buildPriceGrid();toast('Ставки сброшены')});
tab.addEventListener('click',async()=>{
  document.querySelectorAll('.admin-tab-panel').forEach(x=>x.hidden=x!==panel);
  document.querySelectorAll('.admin-tab').forEach(x=>x.classList.toggle('active',x===tab));
  await load();
});
})();