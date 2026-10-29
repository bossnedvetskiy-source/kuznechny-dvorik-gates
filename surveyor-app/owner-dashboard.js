import {buildOwnerReport} from './owner-report.js';

const sum=(rows,fn)=>rows.reduce((s,x)=>s+fn(x),0);
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽':'—';
const count=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);

export function buildOwnerDashboard(surveys, getEstimate, costsForSurvey) {
  const active=surveys.filter(s=>!s.archived).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const rows=active.map(survey=>{
    const estimate=getEstimate(survey);
    const included=estimate.selected.length>0;
    const report=included?buildOwnerReport(survey,estimate,costsForSurvey(survey)||{}):null;
    return {survey,estimate,report,included};
  });
  const quoted=rows.filter(row=>row.included);
  const hasMissing=quoted.some(row=>row.report?.incomplete);
  const hasEstimated=quoted.some(row=>row.report?.estimated);
  const revenue=sum(quoted,row=>row.report.income);
  const knownCosts=sum(quoted,row=>row.report.knownCost+row.report.extra);
  const front=sum(quoted,row=>sum(row.report.fenceRows,f=>sum(f.result.purchase.pickets,b=>b.frontBuy)));
  const rear=sum(quoted,row=>sum(row.report.fenceRows,f=>sum(f.result.purchase.pickets,b=>b.rearBuy)));
  const tubes=sum(quoted,row=>sum(row.report.fenceRows,f=>f.result.purchase.tubeStocks));
  const posts=sum(quoted,row=>sum(row.report.fenceRows,f=>f.result.purchase.posts));
  return {rows,quoted,hasMissing,hasEstimated,revenue,knownCosts,profit:hasMissing?null:revenue-knownCosts,
    front,rear,tubes,posts,pending:active.filter(x=>x.status!=='ready').length,orders:active.length};
}

export function ownerDashboardHtml(model,{preview=false}={}) {
  const stat=(label,value,note='')=>`<div class="owner-kpi"><small>${esc(label)}</small><b>${esc(value)}</b>${note?`<span>${esc(note)}</span>`:''}</div>`;
  const orderRows=model.rows.slice(0,35).map(({survey,estimate,report,included})=>`<button type="button" class="owner-order-link" data-owner-open="${esc(survey.id)}">
     <span class="owner-order-main"><b>${esc(survey.number||survey.localNumber||'Новый замер')}</b><small>${esc(survey.address||survey.clientName||'Адрес не указан')}</small><small>${survey.status==='ready'?'Замер завершён':'Черновик'}</small></span>
     <span class="owner-order-figures"><b>${included?money(estimate.total):'Без расчёта'}</b><small>${!included?'':report.incomplete?'Прибыль не определена':(report.estimated?'Оценка прибыли: ':'Остаток: ')+money(report.profit)}</small></span><span aria-hidden="true">›</span>
   </button>`).join('');
  const coverage=model.quoted.length-model.quoted.filter(x=>x.report.incomplete).length;
  return `<section class="owner-dashboard" aria-label="Панель собственника">
    <div class="owner-dashboard-hero">
      <div class="eyebrow">КУЗНЕЧНЫЙ ДВОРИКЪ · СОБСТВЕННИК</div>
      <h2>КД Управление</h2><p>Заказы, материалы и экономика производства в одном месте</p>
    </div>
    ${preview?'<p class="owner-warning">DEV-превью: нет защищённого сервера. Внутренние расходы здесь тестовые и сохраняются только в текущей сессии. Не вводите реальные конфиденциальные суммы.</p>':''}
    <div class="owner-dashboard-kpis">
      ${stat('Выручка по выбранным сметам',money(model.revenue),model.quoted.length+' с расчётами')}
      ${stat('Расчётные и введённые затраты',money(model.knownCosts),'Не все расходы могут быть известны')}
      ${stat(model.hasEstimated?'Оценка прибыли':'Предварительная прибыль',model.profit==null?'—':money(model.profit),model.hasMissing?'Не хватает себестоимости изделий':'До налогов и неучтённых затрат')}
      ${stat('Заказы / черновики',String(model.orders)+' / '+String(model.pending),coverage+' из '+model.quoted.length+' с определяемой маржой')}
    </div>
    <section class="owner-dashboard-section">
      <div class="owner-section-heading"><h3>Материалы по выбранным заборам</h3><small>Закупочные количества · предварительно</small></div>
      <div class="owner-dashboard-materials">
        ${stat('Штакетник · перед',count(model.front)+' шт')}
        ${stat('Штакетник · зад',count(model.rear)+' шт')}
        ${stat('Профиль 40×20×2',count(model.tubes)+' хлыстов')}
        ${stat('Новые столбы',count(model.posts)+' шт')}
      </div>
      <p class="owner-finance-note">Сумма по заказам — справочная. Разные длины штакетника и профиль необходимо проверять по ведомости каждого объекта. Заказы с неизвестными размерами не включены в количества.</p>
    </section>
    <section class="owner-dashboard-section">
      <div class="owner-section-heading"><h3>Заказы</h3><small>${model.rows.length} записей</small></div>
      ${orderRows||'<p class="owner-finance-note">Замеров пока нет. Создайте первый замер в разделе «Замеры».</p>'}
      <button class="btn btn-secondary btn-block" type="button" data-owner-go-surveys>Перейти ко всем замерам</button>
    </section>
  </section>`;
}
