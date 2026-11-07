/**
 * КД Замерщик — закупочная ведомость и маржа. Этот модуль работает только
 * в кабинете собственника. Данные не записываются в клиентские расчёты.
 */
import { calculateFence } from '../evroshtaketnik/engine.js';
import {buildSlidingProduction,SLIDING_RATE_FIELDS,slidingRateKey} from './owner-sliding.js';

const nonnegative = x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0;
const money = x => new Intl.NumberFormat('ru-RU').format(Math.round(Number(x) || 0)) + ' ₽';
const num = x => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(nonnegative(x));
const PROFILE_NAMES = Object.freeze([
  ['40x25x2','40×25×2'],['40x40x2','40×40×2'],['60x40x2','60×40×2'],
  ['25x25x15','25×25×1,5'],['20x20x15','20×20×1,5'],['40x20x2','40×20×2'],
  ['60x60x3','60×60×3'],['80x80x3','80×80×3'],['100x100x3','100×100×3']
]);
const h = x => String(x ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function buildOwnerReport(survey, estimate, overrides = {}) {
  const lines = [];
  const issues = [];
  let knownCost = 0;
  let incomplete = false;
  let materials = 0;
  const fenceRows = [];
  const slidingRows = [];
  const costs = overrides && typeof overrides === 'object' ? overrides : {};
  for (const calc of estimate.selected) {
    const title = calc.title || (calc.type === 'fence' ? 'Забор' : calc.type);
    const publicConfig = calc.payload?.configuration || {};
    if (calc.type === 'sliding') {
      const production=buildSlidingProduction(calc,costs);
      const hasManual=Object.prototype.hasOwnProperty.call(costs,calc.id)&&
        Number.isFinite(Number(costs[calc.id]))&&Number(costs[calc.id])>=0;
      const cost=hasManual?Number(costs[calc.id]):production.calculatedCost??null;
      slidingRows.push({id:calc.id,title,production,hasManual,cost,income:nonnegative(calc.total)});
      if(cost===null){
        incomplete=true;
        lines.push({id:calc.id,title,cost:null,source:'Уточните тарифы производства или общую себестоимость'});
      }else{
        knownCost+=cost;
        lines.push({id:calc.id,title,cost,source:hasManual?'Указанная фактическая себестоимость':'Расчётная себестоимость (не факт)'});
      }
      continue;
    }
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
  // Manually entered additional pipe purchase plan for gates and canopies.
  // Reference only: may already be included in the entered item cost.
  const profiles=PROFILE_NAMES.map(([id,label])=>{
    const qty=nonnegative(costs['tube_'+id+'_qty']);
    const unitPrice=nonnegative(costs['tube_'+id+'_price']);
    return {id,label,qty,unitPrice,total:Math.round(qty*unitPrice)};
  });
  const profilesTotal=profiles.reduce((sum,x)=>sum+x.total,0);
  const extra = nonnegative(costs.extra);
  const income = nonnegative(estimate.total);
  const totalCost = knownCost + extra;
  const estimated = fenceRows.some(row=>!row.hasOverride)||slidingRows.some(row=>!row.hasManual);
  const profit = incomplete ? null : income - totalCost;
  return {income, knownCost, extra, totalCost, profit, incomplete, estimated, materials, profiles, profilesTotal, lines, fenceRows, slidingRows, overrides:costs, issues:[...new Set(issues)]};
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
  const sliding = report.slidingRows.map(entry=>{
    const p=entry.production;
    if(!p.valid)return '<div class="owner-material-card"><h4>'+h(entry.title)+'</h4><p class="owner-warning">'+h(p.reason)+'</p></div>';
    const costRows=p.rows.map(r=>'<tr><td>'+h(r.label)+'</td><td>'+num(r.qty)+'</td><td>'+(r.cost===null?'Указать тариф':money(r.cost))+'</td></tr>').join('');
    const rates=SLIDING_RATE_FIELDS.map(field=>{
      const key=slidingRateKey(entry.id,field.key);
      const raw=Object.prototype.hasOwnProperty.call(report.overrides,key)?report.overrides[key]:field.initial;
      const displayed=raw===undefined?'':raw;
      return '<label class="owner-expense-field">'+h(field.label)+
        '<input data-owner-cost="'+h(key)+'" type="number" min="0" step="any" inputmode="decimal" value="'+h(displayed)+'" placeholder="Укажите тариф"></label>';
    }).join('');
    return '<div class="owner-material-card"><h4>'+h(entry.title)+' · '+num(p.width)+' × '+num(p.height)+' м</h4>'+
      '<p class="owner-finance-note">Ведомость рассчитана из сохранённых размеров. Хлысты по 6 м округлены вверх отдельно по профилям; это предварительная закупка без карты раскроя. Тарифы ниже — ориентиры до сверки с фактическими закупками.</p>'+
      '<div class="owner-material-stats">'+
        '<div><small>60×40×2 · расход</small><b>'+num(p.tube60)+' м</b><small>Закупить '+num(p.stocks60)+' хлыстов</small></div>'+
        '<div><small>20×20×1,5 · расход</small><b>'+num(p.tube20)+' м</b><small>Закупить '+num(p.stocks20)+' хлыстов</small></div>'+
        '<div><small>Площадь окраски профиля</small><b>'+num(p.area)+' м²</b></div>'+
        '<div><small>Калитка · дополнительный металл</small><b>'+num(p.wicket60)+' м 60×40</b><small>'+num(p.wicket20)+' м 20×20, из них в дверце '+num(p.wicketInner20)+' м</small></div>'+
      '</div>'+
      '<details open><summary>Материалы и закупка</summary>'+
        row('Направляющая балка',num(p.beam)+' м · хвост '+num(p.tail)+' м')+
        row('Профнастил',p.sheets?num(p.sheets)+' листов · '+num(p.materialArea)+' м² закупки':'Нет')+
        row('Евроштакетник',p.pickets?num(p.pickets)+' шт + '+num(p.sparePickets)+' запас · длина '+num(p.picketLength)+' м':'Нет')+
        row('Саморезы',num(p.screws)+' шт')+
        row('Петли/замок калитки',p.wicket?'2 петли · 1 комплект замка':'Не требуются')+
        '<div class="owner-table-scroll"><table><thead><tr><th>Статья затрат</th><th>Кол-во</th><th>Расчётный расход</th></tr></thead><tbody>'+costRows+'</tbody></table></div>'+
      '</details>'+
      '<details class="owner-expenses" open><summary>Зарплаты и расчётные затраты</summary>'+
        row('Сварка, маляр, зашивка · всего',p.wage===null?'Уточнить ставки':money(p.wage))+
        row('Материалы и комплектация',p.materialsExpense===null?'Уточнить цены':money(p.materialsExpense))+
        row('Общая себестоимость (расчёт)',p.calculatedCost===null?'Не определена':money(p.calculatedCost))+
        row('Цена клиенту',money(entry.income))+
        row('Прибыль по изделию',entry.cost===null?'Не определена':money(entry.income-entry.cost))+
        (entry.hasManual?'<p class="owner-finance-note">В итог заказа включена введённая вручную себестоимость, а не сумма строк ведомости — двойного учёта нет.</p>':'')+
      '</details>'+
      '<details class="owner-expenses"><summary>✏️ Закупочные тарифы и зарплаты · изменить</summary>'+
        '<p class="owner-finance-note">Тарифы сохраняются отдельно от клиентской сметы. Пустое обязательное поле блокирует расчёт прибыли; ноль означает отсутствие расхода. Для проверки итогов нажмите «Сохранить расходы» внизу карточки.</p>'+
        '<div class="owner-profile-grid">'+rates+'</div>'+
      '</details>'+
      (p.missing.length?'<p class="owner-warning">⚠ Не заполнены тарифы: '+h(p.missing.join(', '))+'. До заполнения всех обязательных ставок прибыль не определена.</p>':'')+
    '</div>';
  }).join('');
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
    ${sliding}
    ${fence || (report.slidingRows.length ? '' : '<p class="owner-finance-note">Для ведомости евроштакетника добавьте расчёт забора в общий заказ.</p>')}
    <details class="owner-expenses"><summary>Дополнительные профтрубы · ворота, навесы</summary>
      <p class="owner-finance-note">Вводите закупку материала, не рассчитанного автоматически. Количество — хлысты 6 м, цена — за один хлыст. Это справочная детализация: её стоимость не прибавляется к расходам второй раз. Укажите полную себестоимость изделия в поле ниже.</p>
      <div class="owner-profile-summary"><b>Введённая стоимость доп. профтрубы:</b> <strong>${money(report.profilesTotal)}</strong></div>
      <div class="owner-profile-grid">
        ${report.profiles.map(p=>`<div class="owner-profile-row"><b>${h(p.label)}</b><label>Хлысты, шт<input data-owner-cost="tube_${p.id}_qty" type="number" min="0" step="1" inputmode="numeric" value="${p.qty||''}" placeholder="0"></label><label>Цена за 6 м, ₽<input data-owner-cost="tube_${p.id}_price" type="number" min="0" step="1" inputmode="decimal" value="${p.unitPrice||''}" placeholder="0"></label><small>${money(p.total)}</small></div>`).join('')}
      </div>
      <p class="owner-finance-note">После ввода данных нажмите «Сохранить расходы» ниже.</p>
    </details>
    <details class="owner-expenses" open><summary>Фактическая себестоимость изделий и объекта</summary>
      <p class="owner-finance-note">Фактическая себестоимость изделия: материалы, зарплаты, покраска, расходники и подрядчики. Для откатных ворот и забора поле можно оставить пустым — будет расчёт при наличии всех тарифов. Если ввести сумму вручную, она заменит расчётную себестоимость, а не добавится к ней.</p>
      ${estimate.selected.map(item=>{const l=report.lines.find(x=>x.id===item.id)||{title:item.title||item.type,cost:null};return `<div class="owner-expense-field"><label>${h(l.title)} · себестоимость, ₽<input data-owner-cost="${h(item.id)}" type="number" min="0" step="100" inputmode="decimal" value="${Object.prototype.hasOwnProperty.call(report.overrides,item.id) ? report.overrides[item.id] : ''}" placeholder="${['fence','sliding'].includes(item.type)?'Необязательно · используется расчёт':'Расходы пока не указаны'}"></label></div>`}).join('')}
      <div class="owner-expense-field"><label>Дополнительные расходы, ₽<input data-owner-cost="extra" type="number" min="0" step="100" inputmode="decimal" value="${report.extra||''}" placeholder="Топливо, брак, накладные…"></label></div>
      <button data-owner-save-expenses class="btn btn-secondary btn-block" type="button">Сохранить расходы</button>
    </details>
    <p class="owner-finance-note">В общей сумме учтены только выбранные изделия (${estimate.selected.length}), без альтернатив. Доставка и корректировки берутся из общей сметы. Для окончательной прибыли проверьте закупочные цены, подрядчиков, налоги и накладные.</p>
  </section>`;
}
