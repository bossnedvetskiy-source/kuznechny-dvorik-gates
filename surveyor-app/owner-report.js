/**
 * КД Замерщик — закупочная ведомость и маржа. Этот модуль работает только
 * в кабинете собственника. Данные не записываются в клиентские расчёты.
 */
import { calculateFence } from '../evroshtaketnik/engine.js';

const nonnegative = x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0;
const money = x => new Intl.NumberFormat('ru-RU').format(Math.round(nonnegative(x))) + ' ₽';
const num = x => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(nonnegative(x));
const h = x => String(x ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function buildOwnerReport(survey, estimate, overrides = {}) {
  const lines = [];
  const issues = [];
  let knownCost = 0;
  let incomplete = false;
  let materials = 0;
  const fenceRows = [];
  const costs = overrides && typeof overrides === 'object' ? overrides : {};
  for (const calc of estimate.selected) {
    const title = calc.title || (calc.type === 'fence' ? 'Забор' : calc.type);
    const publicConfig = calc.payload?.configuration || {};
    if (calc.type !== 'fence') {
      const cost = Number(costs[calc.id]);
      if (Number.isFinite(cost) && cost >= 0 && Object.prototype.hasOwnProperty.call(costs,calc.id)) {
        knownCost += cost;
        lines.push({id:calc.id,title, cost, source:'Введённая себестоимость'});
      } else {
        incomplete = true;
        lines.push({id:calc.id,title, cost:null, source:'Укажите фактические расходы'});
      }
      continue;
    }
    const config = publicConfig;
    if (!Array.isArray(config.sections) || !config.sections.length) {
      incomplete = true;
      lines.push({id:calc.id,title, cost:null, source:'Нет размеров для пересчёта'});
      continue;
    }
    // Public quote configurations never contain cost settings. For newly saved
    // quotes, the owner sees a deterministic *current-price estimate*, not
    // a falsely asserted historical purchase price.
    // The persisted client quote has no private tariffs. Use only the public
    // geometry and show the current engine's costs as a rough estimate.
    issues.push('Материалы и количество рассчитаны по сохранённым размерам. Стоимость по умолчанию оценочная, пока не введены фактические расходы.');
    const delivery = config.delivery || {};
    const deliveryCost = delivery.manual ? nonnegative(delivery.manualPrice) : nonnegative(delivery.price);
    const input = {
      type:config.fenceType, post:config.postType,
      includeNewPosts:config.includeNewPosts !== false,
      existingPostsCount:nonnegative(config.existingPostsCount),
      sections:config.sections,
      deliveryCost
    };
    let result;
    try { result = calculateFence(input); } catch { result = null; }
    if (!result || result.summary.check !== 'ГОТОВО' || !result.summary.activeSections) {
      incomplete = true;
      lines.push({id:calc.id,title, cost:null, source:'Проверьте параметры забора'});
      continue;
    }
    const p = result.purchase;
    const c = result.costs;
    const materialCost = c.materials + c.screws;
    materials += materialCost;
    const calculatedCost = materialCost + c.paint + c.work + c.postInstall + c.measurer + c.delivery;
    const hasOverride = Object.prototype.hasOwnProperty.call(costs,calc.id) &&
      Number.isFinite(Number(costs[calc.id])) && Number(costs[calc.id]) >= 0;
    const cost = hasOverride ? Number(costs[calc.id]) : calculatedCost;
    knownCost += cost;
    lines.push({id:calc.id,title,cost,source:hasOverride?'Указанные фактические расходы':'Расчётная себестоимость (не факт)'});
    fenceRows.push({id:calc.id,title, result, materialCost, cost, calculatedCost, hasOverride, income:nonnegative(calc.total)});
  }
  const extra = nonnegative(costs.extra);
  const income = nonnegative(estimate.total);
  const totalCost = knownCost + extra;
  const estimated = fenceRows.some(row=>!row.hasOverride);
  const profit = incomplete ? null : income - totalCost;
  return {income, knownCost, extra, totalCost, profit, incomplete, estimated, materials, lines, fenceRows, overrides:costs, issues:[...new Set(issues)]};
}

export function ownerReportHtml(report, estimate) {
  const row = (label,value) => `<div class="owner-finance-row"><span>${h(label)}</span><strong>${h(value)}</strong></div>`;
  const finance = `<div class="owner-finance-grid">
    <div><small>Цена клиенту</small><strong>${money(report.income)}</strong></div>
    <div><small>Материалы забора¹</small><strong>${money(report.materials)}</strong></div>
    <div><small>Расходы по расчёту²</small><strong>${money(report.totalCost)}</strong></div>
    <div><small>${report.estimated ? 'Оценка прибыли³' : 'Остаток / прибыль³'}</small><strong>${report.profit == null ? 'Не определена' : money(report.profit)}</strong></div>
  </div>
  <p class="owner-finance-note">¹ Штакетник, профтрубы, столбы и саморезы. ² Включая введённые расходы по другим изделиям и дополнительные траты. ³ Предварительная прибыль до неучтённых расходов и налогов, не бухгалтерская чистая прибыль.</p>`;
  const fence = report.fenceRows.map(f => {
    const r=f.result, p=r.purchase, c=r.costs;
    const pickets = p.pickets.map(b=>`<tr><td>${num(b.length)} м</td><td>${num(b.frontActual)}</td><td>${num(b.rearActual)}</td><td>${num(b.reserveFront)}</td><td>${num(b.reserveRear)}</td><td><b>${num(b.frontBuy)}</b></td><td><b>${num(b.rearBuy)}</b></td><td>${num(b.totalBuy)}</td><td>${money(b.cost)}</td></tr>`).join('');
    return `<div class="owner-material-card"><h4>${h(f.title)}</h4><div class="owner-material-stats">
      <div><small>Перед / купить</small><b>${num(p.pickets.reduce((s,b)=>s+b.frontBuy,0))} шт</b></div>
      <div><small>Зад / купить</small><b>${num(p.pickets.reduce((s,b)=>s+b.rearBuy,0))} шт</b></div>
      <div><small>40×20×2</small><b>${num(p.tubeStocks)} хлыстов</b></div>
      <div><small>Столбы новые</small><b>${num(p.posts)} шт</b></div>
    </div>
    <details open><summary>Евроштакетник по длинам · отдельно перед / зад</summary>
      <div class="owner-table-scroll"><table><thead><tr><th>Длина</th><th>Перед факт</th><th>Зад факт</th><th>Запас перед</th><th>Запас зад</th><th>Купить перед</th><th>Купить зад</th><th>Всего</th><th>Расход, ₽</th></tr></thead><tbody>${pickets}</tbody></table></div>
    </details>
    <details open><summary>Профиль, столбы, расходники</summary>
      ${row('40×20×2: закупка',num(p.tubeStocks)+' шт × '+num(p.tubePurchased / (p.tubeStocks||1))+' м = '+num(p.tubePurchased)+' п.м.')}
      ${row('40×20×2: в конструкцию',num(p.tubeUsed)+' п.м.; остаток '+num(p.tubeRemainder)+' п.м.')}
      ${row('Столбы '+(r.post?.label||''),num(p.posts)+' шт · '+num(p.postLm)+' п.м.')}
      ${row('Саморезы',num(p.screws)+' шт')}
      ${row('Евроштакетник',money(c.picket))}
      ${row('Профиль 40×20×2',money(c.tube))}
      ${row('Столбы (расчётная цена)',money(c.posts))}
      ${row('Саморезы',money(c.screws))}
      ${row('Материалы и крепёж',money(f.materialCost))}
    </details>
    <details><summary>Работы и расчётные затраты</summary>
      ${row('Покраска',money(c.paint))}
      ${row('Работы по забору',money(c.work))}
      ${row('Установка столбов',money(c.postInstall))}
      ${row('Замерщик (из калькулятора)',money(c.measurer))}
      ${row('Доставка',money(c.delivery))}
      ${row('Всего расчётных затрат',money(f.calculatedCost))}
      ${f.hasOverride ? row('Фактические расходы (введены владельцем)',money(f.cost)) : ''}
      ${row('Цена клиенту',money(f.income))}
      ${row('Разница до дополнительных расходов',money(f.income-f.cost))}
    </details></div>`;
  }).join('');
  return `<section class="owner-report" aria-label="Внутренние финансы и материалы">
    <div class="owner-report-head"><div><span class="eyebrow">Только собственник</span><h3>Материалы и прибыль заказа</h3></div><span class="owner-private">🔒 Внутреннее</span></div>
    ${finance}
    ${report.incomplete ? '<p class="owner-warning">⚠ Не хватает данных о себестоимости некоторых изделий. Итоговая прибыль не рассчитана — заполните расходы ниже.</p>' : ''}
    ${report.issues.map(issue=>`<p class="owner-warning">⚠ ${h(issue)}</p>`).join('')}
    ${fence || '<p class="owner-finance-note">Для ведомости евроштакетника добавьте расчёт забора в общий заказ.</p>'}
    <details class="owner-expenses" open><summary>Расходы по остальным изделиям и объекту</summary>
      <p class="owner-finance-note">Укажите полную себестоимость ворот, навеса и откатных ворот: материалы, зарплаты, покраска, расходники, доставка и монтаж. Значения сохраняются отдельно от клиентской цены.</p>
      ${estimate.selected.map(item=>{const l=report.lines.find(x=>x.id===item.id)||{title:item.title||item.type,cost:null};return `<div class="owner-expense-field"><label>${h(l.title)} · себестоимость, ₽<input data-owner-cost="${h(item.id)}" type="number" min="0" step="100" inputmode="decimal" value="${Object.prototype.hasOwnProperty.call(report.overrides,item.id) ? report.overrides[item.id] : ''}" placeholder="${item.type==='fence'?'Необязательно · используется расчёт':'Расходы пока не указаны'}"></label></div>`}).join('')}
      <div class="owner-expense-field"><label>Дополнительные расходы, ₽<input data-owner-cost="extra" type="number" min="0" step="100" inputmode="decimal" value="${report.extra||''}" placeholder="Топливо, брак, накладные…"></label></div>
      <button data-owner-save-expenses class="btn btn-secondary btn-block" type="button">Сохранить расходы</button>
    </details>
    <p class="owner-finance-note">В общей сумме учтены только выбранные изделия (${estimate.selected.length}), без альтернатив. Доставка и корректировки берутся из общей сметы. Для окончательной прибыли проверьте закупочные цены, подрядчиков, налоги и накладные.</p>
  </section>`;
}
