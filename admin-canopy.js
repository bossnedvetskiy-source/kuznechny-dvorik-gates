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
  <div class="page-title"><div><p class="eyebrow">Сохранённые расчёты</p><h1>Навесы</h1></div><p>Внутренние расчёты, производство и финансы — только здесь.</p></div>
  <div class="canopy-admin-toolbar"><div id="canopyAdminStats"></div><button class="reset-button" id="canopyReload" type="button">Обновить</button></div>
  <div id="canopyOrderList" class="canopy-order-list"></div>
  <p id="canopyEmpty" class="empty-photos" hidden>Сохранённых расчётов навесов пока нет.</p>

  <details class="canopy-price-settings">
    <summary><span><b>Прайс и внутренние ставки навесов</b><small>Используются для новых расчётов и текущего пересчёта</small></span><i>⌄</i></summary>
    <div id="canopyAdminPriceGrid" class="canopy-admin-price-grid"></div>
    <button class="reset-button" id="canopyResetPrices" type="button">Сбросить к базовым</button>
  </details>

  <dialog id="canopyAdminDialog" class="canopy-admin-dialog">
    <div class="canopy-dialog-shell">
      <div class="canopy-dialog-head">
        <div><small>Внутренний расчёт</small><h2 id="canopyDialogTitle">Навес</h2></div>
        <button id="canopyDialogClose" type="button">×</button>
      </div>
      <div id="canopyDialogBody"></div>
    </div>
  </dialog>`;
root.append(panel);

const style=document.createElement('style');style.textContent=`
.canopy-admin-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.canopy-order-list{display:grid;gap:10px}
.canopy-order-card{padding:15px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(18,16,13,.04)}
.canopy-order-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.canopy-order-card-head b{font-size:14px}.canopy-order-card-head small{display:block;color:var(--muted);margin-top:4px}
.canopy-order-price{font:18px Prata,serif;color:#8a6326}
.canopy-order-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}
.canopy-order-meta span{padding:8px 9px;border-radius:9px;background:#f7f4ef;font-size:10px}
.canopy-order-actions{display:flex;justify-content:flex-end}
.canopy-price-settings{margin-top:18px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#faf8f4}
.canopy-price-settings summary{display:flex;justify-content:space-between;cursor:pointer;list-style:none}.canopy-price-settings summary::-webkit-details-marker{display:none}
.canopy-price-settings summary span{display:grid;gap:3px}.canopy-price-settings summary small{color:var(--muted)}
.canopy-admin-price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.canopy-admin-price-grid label{display:grid;gap:5px}
.canopy-admin-price-grid span{font-size:9px;color:var(--muted);font-weight:800}.canopy-admin-price-grid input{height:38px;border:1px solid var(--line);border-radius:9px;padding:0 9px;background:#fff}
.canopy-admin-dialog{width:min(1120px,calc(100% - 20px));max-height:94vh;padding:0;border:0;border-radius:18px;background:#fff;color:var(--ink);box-shadow:0 30px 100px rgba(0,0,0,.28)}
.canopy-admin-dialog::backdrop{background:rgba(0,0,0,.54)}.canopy-dialog-shell{padding:18px}
.canopy-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.canopy-dialog-head small{color:#9a6d28;font-weight:900;text-transform:uppercase;font-size:9px;letter-spacing:.5px}.canopy-dialog-head h2{margin:3px 0 0}
.canopy-dialog-head button{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:24px}
.canopy-inner-tabs{display:flex;gap:7px;position:sticky;top:0;z-index:3;background:#fff;padding:4px 0 11px;border-bottom:1px solid var(--line);margin-bottom:12px}
.canopy-inner-tab{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-weight:900;cursor:pointer}
.canopy-inner-tab.active{background:#191713;color:#fff;border-color:#191713}.canopy-inner-panel[hidden]{display:none!important}
.canopy-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.canopy-admin-grid.one{grid-template-columns:1fr}
.canopy-admin-box{padding:13px;border:1px solid var(--line);border-radius:13px;background:#faf8f4}.canopy-admin-box h3{margin:0 0 9px;font-size:13px}
.canopy-admin-dl{margin:0}.canopy-admin-dl div{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #e7e1d8}
.canopy-admin-dl div:last-child{border-bottom:0}.canopy-admin-dl dt{color:var(--muted);font-size:10px}.canopy-admin-dl dd{margin:0;font-size:10px;font-weight:900;text-align:right}
.canopy-finance-hero{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.canopy-finance-hero article{padding:13px;border-radius:13px;background:#191713;color:#fff}
.canopy-finance-hero small,.canopy-finance-hero b{display:block}.canopy-finance-hero small{opacity:.68;font-size:9px;text-transform:uppercase}.canopy-finance-hero b{font-size:19px;margin-top:5px}
.canopy-snapshot-note{padding:10px 12px;border-radius:11px;background:#f7f0df;color:#6f5527;font-size:10px;line-height:1.45;margin-bottom:12px}
.canopy-admin-svg{margin-top:10px;border:1px solid var(--line);border-radius:13px;background:#f8f7f2;overflow:hidden}.canopy-admin-svg svg{display:block;width:100%;height:auto}
.canopy-admin-table{overflow:auto;margin-top:10px;border:1px solid var(--line);border-radius:12px}.canopy-admin-table table{border-collapse:collapse;width:100%;min-width:760px}
.canopy-admin-table th,.canopy-admin-table td{padding:8px 9px;border-bottom:1px solid var(--line);font-size:10px;text-align:left;white-space:nowrap}.canopy-admin-table th{background:#f1ece4}
.canopy-section-title{margin:16px 0 8px;font-size:14px}.canopy-print-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.canopy-print-primary{background:#191713!important;color:#fff!important;border-color:#191713!important}
@media(max-width:900px){.canopy-admin-price-grid{grid-template-columns:repeat(2,1fr)}.canopy-order-meta,.canopy-admin-grid{grid-template-columns:1fr 1fr}}
@media(max-width:620px){.canopy-admin-price-grid,.canopy-order-meta,.canopy-admin-grid,.canopy-finance-hero{grid-template-columns:1fr}.canopy-order-card-head{flex-direction:column}.canopy-dialog-shell{padding:11px}.canopy-inner-tabs{overflow:auto}.canopy-inner-tab{flex:0 0 auto}}
`;document.head.append(style);

const list=panel.querySelector('#canopyOrderList'),empty=panel.querySelector('#canopyEmpty'),stats=panel.querySelector('#canopyAdminStats'),dialog=panel.querySelector('#canopyAdminDialog'),body=panel.querySelector('#canopyDialogBody');
let items=[],loadedScripts=null;

function asset(path){return path}
function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src&&s.src.endsWith(src.replace(/^\//,'')));if(existing){resolve();return}const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Не загрузился '+src));document.head.append(s)})}
async function ensureTools(){
  if(window.TrussGeometry&&window.CanopyPricing&&window.TrussDrawing)return;
  if(!loadedScripts)loadedScripts=(async()=>{await loadScript(asset('/naves/geometry.js'));await loadScript(asset('/naves/pricing.js'));await loadScript(asset('/naves/drawing.js'))})();
  return loadedScripts;
}
function loadPrices(){try{return window.CanopyPricing.mergePrices(JSON.parse(localStorage.getItem(PRICE_KEY)||'{}'))}catch{return window.CanopyPricing.mergePrices({})}}
function savePrices(){const x={};PRICE_FIELDS.forEach(([k])=>{const v=Number(panel.querySelector('#cap-price-'+k)?.value);if(Number.isFinite(v)&&v>=0)x[k]=v});localStorage.setItem(PRICE_KEY,JSON.stringify(x));return x}
function buildPriceGrid(){
  const defaults=window.CanopyPricing.DEFAULTS,p=loadPrices();
  panel.querySelector('#canopyAdminPriceGrid').innerHTML=PRICE_FIELDS.map(([k,label,unit])=>`<label><span>${escape(label)}, ${escape(unit)}</span><input id="cap-price-${k}" type="number" min="0" step="${unit==='%'?'1':'10'}" value="${p[k]??defaults[k]}"></label>`).join('');
  PRICE_FIELDS.forEach(([k])=>panel.querySelector('#cap-price-'+k).addEventListener('change',()=>{savePrices();toast('Ставки навеса сохранены')}))
}
function readLocal(){try{return JSON.parse(localStorage.getItem(DEV_SAVED_KEY)||'[]').map(x=>({...x,_local:true}))}catch{return[]}}
async function readServer(){
  try{const r=await fetch('/api/admin/leads?category=canopy&limit=100',{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('server unavailable');const d=await r.json();return Array.isArray(d.leads)?d.leads:[]}
  catch{return[]}
}
function snapOf(lead){return lead?.configuration?.canopy||lead?.configuration?.canopyCalc||null}
function renderList(){
  empty.hidden=items.length>0;stats.textContent='Расчётов: '+items.length;
  list.innerHTML=items.map((lead,index)=>{
    const s=snapOf(lead),inp=s?.input||{},local=lead._local?' · DEV локально':'';
    return `<article class="canopy-order-card">
      <div class="canopy-order-card-head"><div><b>#${escape(lead.id)} · ${escape(lead.city||'Без населённого пункта')}</b><small>${escape(date(lead.created_at))} · ${escape(lead.phone||'')}${local}</small></div><strong class="canopy-order-price">${money(lead.total)}</strong></div>
      <div class="canopy-order-meta"><span>Размер <b>${escape(fmt(inp.widthPostsM))} × ${escape(fmt(inp.lengthM))} м</b></span><span>Ферма <b>${escape(inp.trussType||'Треугольная')}</b></span><span>Материал <b>${escape(inp.materialMode||'Авто')}</b></span></div>
      <div class="canopy-order-actions"><button class="reset-button" data-open-canopy="${index}" type="button">Открыть заказ</button></div>
    </article>`
  }).join('');
  list.querySelectorAll('[data-open-canopy]').forEach(b=>b.addEventListener('click',()=>openItem(items[Number(b.dataset.openCanopy)])))
}
async function load(){
  await ensureTools();buildPriceGrid();
  const server=await readServer(),local=readLocal(),ids=new Set(server.map(x=>String(x.id)));
  items=[...server,...local.filter(x=>!ids.has(String(x.id)))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  renderList()
}
function calculate(lead){
  const snap=snapOf(lead);if(!snap?.input)throw new Error('В расчёте нет исходных параметров');
  const savedRates=snap?.pricingSnapshot?.rates?window.CanopyPricing.mergePrices(snap.pricingSnapshot.rates):null;
  const currentRates=loadPrices();
  const baseRaw={...snap.input};

  const savedRaw={...baseRaw};savedRaw.trussCount=window.CanopyPricing.autoTrussCount(savedRaw.lengthM,savedRates||currentRates);
  const g=window.TrussGeometry.compute(savedRaw);if(!g.ok)throw new Error(g.errors.join(' '));
  const savedC=window.CanopyPricing.compute(savedRaw,g,savedRates||currentRates);

  const currentRaw={...baseRaw};currentRaw.trussCount=window.CanopyPricing.autoTrussCount(currentRaw.lengthM,currentRates);
  const currentC=window.CanopyPricing.compute(currentRaw,g,currentRates);
  g.trussCount=savedC.trussCount;
  return {snap,g,savedC,currentC,hasSnapshot:Boolean(savedRates)}
}
const dl=rows=>'<dl class="canopy-admin-dl">'+rows.map(([a,b])=>'<div><dt>'+escape(a)+'</dt><dd>'+escape(b)+'</dd></div>').join('')+'</dl>';
function materialTable(c){return '<div class="canopy-admin-table"><table><thead><tr><th>Материал</th><th>Используется</th><th>Хлыстов</th><th>Купить</th><th>Стоимость</th></tr></thead><tbody>'+c.materialRows.map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+fmt(x.used)+' м</td><td>'+x.sticks+'</td><td>'+fmt(x.buy,0)+' м</td><td>'+money(x.cost)+'</td></tr>').join('')+'</tbody></table></div>'}
function cutTable(g,c){
  const rows=[
    ['P1','Верхний пояс',g.chordProfile,window.TrussGeometry.mm(g.topCircle.length),1,c.trussCount,'дуга'],
    ['P2','Нижний пояс',g.chordProfile,window.TrussGeometry.mm(g.lowerTotalM),1,c.trussCount,'дуга + края'],
    ['T','Торцевая стойка',g.webProfile,window.TrussGeometry.mm(g.endPostM),2,2*c.trussCount,'90°']
  ];
  if(g.trussType==='Вертикальная'||g.trussType==='Усиленная'){
    g.verticals.forEach(v=>rows.push([
      'V'+v.index,'Вертикальная стойка '+v.index,g.webProfile,
      window.TrussGeometry.mm(v.lengthM),1,c.trussCount,'90°'
    ]));
  }
  if(g.trussType==='Треугольная'||g.trussType==='Усиленная'){
    g.diagonals.forEach(d=>rows.push([
      'D'+d.index,'Диагональ '+d.index,g.webProfile,
      window.TrussGeometry.mm(d.lengthM),1,c.trussCount,fmt(d.angleDeg,1)+'°'
    ]));
  }
  return '<div class="canopy-admin-table"><table><thead><tr><th>Поз.</th><th>Деталь</th><th>Профиль</th><th>Длина, мм</th><th>На 1</th><th>Всего</th><th>Угол</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
}
function printDoc(title,html){const w=window.open('','_blank');if(!w)return toast('Браузер заблокировал печать',true);w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+escape(title)+'</title><style>body{font:12px Arial,sans-serif;color:#111;margin:22px}h1{font-size:20px}h2{font-size:15px;margin-top:18px}svg{width:100%;height:auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:5px;text-align:left}dl div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:4px}dd{font-weight:bold}.note{margin-top:12px;font-size:10px}</style></head><body>'+html+'</body></html>');w.document.close();setTimeout(()=>{w.focus();w.print()},250)}
function bindInnerTabs(){
  const buttons=[...body.querySelectorAll('[data-canopy-inner]')],panels=[...body.querySelectorAll('[data-canopy-panel]')];
  buttons.forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.canopyInner;
    buttons.forEach(x=>x.classList.toggle('active',x===btn));
    panels.forEach(x=>x.hidden=x.dataset.canopyPanel!==key)
  }))
}
async function openItem(lead){
  try{
    await ensureTools();
    const {snap,g,savedC,currentC,hasSnapshot}=calculate(lead);
    panel.querySelector('#canopyDialogTitle').textContent='Навес #'+lead.id+' · '+(lead.city||'');
    const diff=Math.round(currentC.total-savedC.total);
    body.innerHTML=`
      <nav class="canopy-inner-tabs">
        <button class="canopy-inner-tab active" data-canopy-inner="order" type="button">Заказ</button>
        <button class="canopy-inner-tab" data-canopy-inner="production" type="button">Производство</button>
        <button class="canopy-inner-tab" data-canopy-inner="finance" type="button">Финансы</button>
      </nav>

      <section class="canopy-inner-panel" data-canopy-panel="order">
        <div class="canopy-admin-grid">
          <section class="canopy-admin-box"><h3>Клиент и расчёт</h3>${dl([
            ['Телефон',lead.phone||'—'],['Населённый пункт',lead.city||'—'],['Сохранён',date(lead.created_at)],
            ['Цена клиенту',money(lead.total)],['Размер',fmt(g.widthPostsM)+' × '+fmt(savedC.lengthM)+' м'],['Площадь',fmt(savedC.area,1)+' м²'],
            ['Высота',fmt(savedC.visibleHeightM)+' м'],['Покрытие',savedC.coverage],['Тип фермы',g.trussType],['Материал фермы',g.materialMode],['Установка',savedC.installType],['Покраска',savedC.paint?'да':'нет']
          ])}</section>
          <section class="canopy-admin-box"><h3>Что учитывать</h3>${dl([
            ['Столбов нужно',savedC.totalPosts+' шт'],['Уже есть',savedC.existingPosts+' шт'],['Новых столбов',savedC.newPosts+' шт'],
            ['Продольные балки',savedC.beamsExisting?'есть у заказчика':'изготовить 2 шт'],['Ферм',savedC.trussCount+' шт'],['Лаги 40×20',savedC.lagLines+' линий · '+(savedC.coverage==='Профнастил'?'авто 80–100 см':savedC.lagMode)]
          ])}</section>
        </div>
      </section>

      <section class="canopy-inner-panel" data-canopy-panel="production" hidden>
        <div class="canopy-print-actions"><button class="reset-button canopy-print-primary" id="canopyPrintDrawing" type="button">Распечатать ТЗ сварщику</button></div>
        <h3 class="canopy-section-title">2D‑чертёж фермы</h3>
        <div class="canopy-admin-svg"><svg id="canopyAdminTrussSvg" viewBox="0 0 1200 640"></svg></div>
        <h3 class="canopy-section-title">Раскрой фермы</h3>${cutTable(g,savedC)}
        <h3 class="canopy-section-title">Материалы и закупка</h3>${materialTable(savedC)}
        <div class="canopy-admin-grid" style="margin-top:12px">
          <section class="canopy-admin-box"><h3>Сборка навеса</h3>${dl([
            ['Ферм',savedC.trussCount+' шт'],['Режим лаг',savedC.coverage==='Профнастил'?'Авто 80–100 см':savedC.lagMode],['Линий лаг',savedC.lagLines+' шт'],['Шаг лаг',fmt(savedC.lagStep*100,1)+' см'],
            ['Новых столбов',savedC.newPosts+' шт'],['Продольных балок',savedC.beamCount+' шт'],['Тип фермы',g.trussType],['Материал фермы',g.materialMode],['Внутренних элементов',(g.trussType==='Усиленная'?(g.verticalCount+g.diagonalCount):g.trussType==='Вертикальная'?g.verticalCount:g.diagonalCount)+' шт']
          ])}</section>
          <section class="canopy-admin-box"><h3>Покрытие</h3>${dl([
            ['Тип',savedC.coverage],['Длина покрытия по дуге',fmt(savedC.coverageData.coverArcM)+' м'],['Длина навеса с выпуском',fmt(savedC.coverageData.coverLengthM)+' м'],
            ['Покраска',savedC.paint?'да':'нет']
          ])}</section>
        </div>
      </section>

      <section class="canopy-inner-panel" data-canopy-panel="finance" hidden>
        <div class="canopy-finance-hero">
          <article><small>Цена клиенту</small><b>${money(lead.total)}</b></article>
          <article><small>Прибыль до налогов</small><b>${money(savedC.profit)}</b></article>
          <article><small>Маржа</small><b>${fmt(savedC.margin,1)}%</b></article>
        </div>
        <div class="canopy-snapshot-note">${hasSnapshot
          ?'Себестоимость, ЗП и прибыль ниже рассчитаны по ставкам, которые были зафиксированы в момент сохранения заказа.'
          :'Это старый расчёт без снимка ставок. Зафиксированная экономика недоступна — показан расчёт по текущему прайсу.'}</div>
        <div class="canopy-admin-grid">
          <section class="canopy-admin-box"><h3>Экономика заказа</h3>${dl([
            ['Расчётная база',money(savedC.base)],['Фактические расходы',money(savedC.actualExpenses)],['Наценка',money(savedC.markup)],
            ['Доп. прибыль из монтажа',money(savedC.ownerMount)],['Прибыль до налогов',money(savedC.profit)],['Маржа',fmt(savedC.margin,1)+'%']
          ])}</section>
          <section class="canopy-admin-box"><h3>ЗП / работы</h3>${dl([
            ['Сварка ферм',money(savedC.weld)],['Монтаж навеса',money(savedC.mount)],['Установка новых столбов',money(savedC.postMount)],
            ['Покраска',money(savedC.paintCost)],['Расходники ферм',money(savedC.consumables)]
          ])}</section>
          <section class="canopy-admin-box"><h3>Одна ферма</h3>${dl([
            ['Себестоимость без покраски',money(savedC.oneTruss.cost)],['Цена отдельно без покраски',money(savedC.oneTruss.priceNoPaint)],
            ['Цена отдельно с покраской',money(savedC.oneTruss.pricePaint)],['Прибыль без покраски',money(savedC.oneTruss.profitNoPaint)],['Прибыль с покраской',money(savedC.oneTruss.profitPaint)]
          ])}</section>
          <section class="canopy-admin-box"><h3>По текущим ставкам</h3>${dl([
            ['Текущая расчётная цена',money(currentC.total)],['Разница к сохранённой',((diff>0?'+':'')+money(diff))],
            ['Текущая прибыль',money(currentC.profit)],['Текущая маржа',fmt(currentC.margin,1)+'%']
          ])}</section>
        </div>
        <div class="canopy-print-actions"><button class="reset-button" id="canopyPrintFull" type="button">Печать полного внутреннего расчёта</button></div>
      </section>`;

    const svg=body.querySelector('#canopyAdminTrussSvg');
    window.TrussDrawing.render(svg,g);
    bindInnerTabs();

    body.querySelector('#canopyPrintDrawing').onclick=()=>printDoc(
      'ТЗ навеса '+lead.id,
      '<h1>ТЗ сварщику · навес #'+escape(lead.id)+'</h1>'+
      '<p>Размер навеса: '+fmt(g.widthPostsM)+' × '+fmt(savedC.lengthM)+' м · ферм: '+savedC.trussCount+' шт. · тип: '+escape(g.trussType)+' · материал: '+escape(g.materialMode)+' · лаги: '+escape(savedC.coverage==='Профнастил'?'авто 80–100 см':savedC.lagMode)+'</p>'+
      new XMLSerializer().serializeToString(svg)+
      '<h2>Раскрой фермы</h2>'+cutTable(g,savedC)+
      '<h2>Материалы</h2>'+materialTable(savedC)+
      '<p class="note">Перед серийной резкой изготовить одну контрольную ферму по шаблону.</p>'
    );
    body.querySelector('#canopyPrintFull').onclick=()=>printDoc(
      'Внутренний расчёт навеса '+lead.id,
      '<h1>Внутренний расчёт навеса #'+escape(lead.id)+'</h1>'+
      '<h2>Экономика</h2>'+dl([['Цена клиенту',money(lead.total)],['Расходы',money(savedC.actualExpenses)],['Прибыль',money(savedC.profit)],['Маржа',fmt(savedC.margin,1)+'%']])+
      '<h2>Работы</h2>'+dl([['Сварка',money(savedC.weld)],['Монтаж',money(savedC.mount)],['Столбы',money(savedC.postMount)],['Покраска',money(savedC.paintCost)]])+
      '<h2>Материалы</h2>'+materialTable(savedC)
    );
    dialog.showModal()
  }catch(e){toast(e.message||'Не удалось открыть расчёт',true)}
}

panel.querySelector('#canopyDialogClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
panel.querySelector('#canopyReload').addEventListener('click',load);
panel.querySelector('#canopyResetPrices').addEventListener('click',()=>{localStorage.removeItem(PRICE_KEY);buildPriceGrid();toast('Ставки сброшены')});
tab.addEventListener('click',async()=>{
  document.querySelectorAll('.admin-tab-panel').forEach(x=>x.hidden=x!==panel);
  document.querySelectorAll('.admin-tab').forEach(x=>x.classList.toggle('active',x===tab));
  await load()
})
})();