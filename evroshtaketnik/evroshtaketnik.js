import { calculateFence, FENCE_TYPES, POST_TYPES } from './engine.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(Math.round(Number(value)||0)) + ' ₽';
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:digits}).format(Number(value)||0);
const normalize = value => String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ');

const form = $('fenceForm');
const typeInput = $('fenceType');
const postInput = $('postType');
const includePostsInput = $('includePosts');
const sectionsList = $('sectionsList');
const addSectionButton = $('addSection');
const removeSectionButton = $('removeSection');
const settlementInput = $('settlement');
const settlementResults = $('settlementResults');
const deliveryStatus = $('deliveryStatus');
const manualDeliveryInput = $('manualDelivery');
const manualDeliveryEnabled = $('manualDeliveryEnabled');
const typeHelp = $('typeHelp');
const totalLabel = $('totalLabel');
const resultNote = $('resultNote');
const internalGrid = $('internalGrid');
const internalToggle = $('internalToggle');
const internalOverview = $('internalOverview');

let visibleSections = 1;
let deliveryRows = [];
let selectedDelivery = null;
let lastResult = null;

function sectionMarkup(index) {
  const n = index + 1;
  return `
    <article class="section-card" data-section-card="${index}">
      <div class="section-card-head"><b>Участок ${n}</b><span data-section-caption="${index}">не заполнен</span></div>
      <div class="section-fields">
        <label class="field"><span>Длина, м</span><input data-field="length" data-index="${index}" type="number" min="0" max="200" step="0.1" inputmode="decimal" value="0"></label>
        <label class="field"><span>Высота, м</span><input data-field="height" data-index="${index}" type="number" min="0.5" max="3" step="0.05" inputmode="decimal" value="1.8"></label>
      </div>
      ${index < 3 ? `
      <label class="switch-field shared-row" data-shared-row="${index}">
        <span><b>Следующий участок начинается от этого же столба</b><small>Включите для угла или продолжения — один столб не посчитается дважды</small></span>
        <input data-field="shared" data-index="${index}" type="checkbox">
        <i aria-hidden="true"></i>
      </label>` : ''}
    </article>`;
}

sectionsList.innerHTML = Array.from({length:4}, (_, index) => sectionMarkup(index)).join('');

function syncVisibleSections() {
  for (let index = 0; index < 4; index += 1) {
    const card = sectionsList.querySelector(`[data-section-card="${index}"]`);
    card.hidden = index >= visibleSections;
    const shared = sectionsList.querySelector(`[data-shared-row="${index}"]`);
    if (shared) shared.hidden = index >= visibleSections - 1;
  }
  addSectionButton.disabled = visibleSections >= 4;
  addSectionButton.style.opacity = visibleSections >= 4 ? '.45' : '';
  removeSectionButton.disabled = visibleSections <= 1;
  removeSectionButton.style.opacity = visibleSections <= 1 ? '.45' : '';
}

function readSections() {
  return Array.from({length:4}, (_, index) => {
    const length = Number(sectionsList.querySelector(`[data-field="length"][data-index="${index}"]`)?.value || 0);
    const height = Number(sectionsList.querySelector(`[data-field="height"][data-index="${index}"]`)?.value || 1.8);
    const shared = Boolean(sectionsList.querySelector(`[data-field="shared"][data-index="${index}"]`)?.checked);
    return {
      length: index < visibleSections ? Math.max(0, length) : 0,
      height: Math.max(.5, height || 1.8),
      sharedWithNext: index < visibleSections - 1 ? shared : false
    };
  });
}

function deliveryCost() {
  if (manualDeliveryEnabled.checked) return Math.max(0, Number(manualDeliveryInput.value)||0);
  return selectedDelivery ? Math.max(0, Number(selectedDelivery.price)||0) : 0;
}

function deliveryIsKnown() {
  return manualDeliveryEnabled.checked || Boolean(selectedDelivery);
}

const TYPE_HELP = {
  'vertical-double': 'Штакетник с двух сторон в шахматном порядке — забор меньше просматривается.',
  'vertical-single': 'Штакетник устанавливается с одной стороны — самый простой и экономичный вариант.',
  'horizontal-double': 'Горизонтальные планки с двух сторон. В расчёте добавляются вертикальные прожилины внутри каждого пролёта.'
};

function syncTypeHelp() {
  if (typeHelp) typeHelp.textContent = TYPE_HELP[typeInput.value] || '';
}

function setInternalOpen(open) {
  if (!internalGrid || !internalToggle) return;
  internalGrid.hidden = !open;
  internalToggle.setAttribute('aria-expanded', String(open));
  internalToggle.classList.toggle('is-open', open);
  const label = internalToggle.querySelector('span');
  if (label) label.textContent = open ? 'Скрыть детализацию' : 'Показать детализацию';
  try { sessionStorage.setItem('kuzdvor-picket-internal-open', open ? '1' : '0'); } catch {}
}

function initInternalToggle() {
  if (!internalToggle || internalToggle.dataset.bound === '1') return;
  internalToggle.dataset.bound = '1';
  let open = false;
  try { open = sessionStorage.getItem('kuzdvor-picket-internal-open') === '1'; } catch {}
  setInternalOpen(open);
  internalToggle.addEventListener('click', () => {
    setInternalOpen(internalToggle.getAttribute('aria-expanded') !== 'true');
  });
}

function calculate() {
  const result = calculateFence({
    type: typeInput.value,
    post: postInput.value,
    includeNewPosts: includePostsInput.checked,
    sections: readSections(),
    deliveryCost: deliveryCost()
  });
  lastResult = result;
  renderResult(result);
  renderScheme(result);
  renderInternal(result);
}

function renderResult(result) {
  const {summary,type} = result;
  const deliveryPending = !deliveryIsKnown();
  $('totalPrice').textContent = summary.activeSections ? money(summary.total) : '0 ₽';
  $('summaryType').textContent = type.label;
  $('summaryLength').textContent = `${number(summary.totalLength)} м`;
  $('summaryPosts').textContent = String(summary.postsByScheme);
  $('summaryDelivery').textContent = deliveryPending
    ? 'не указана'
    : (summary.deliveryCost === 0 ? '0 ₽' : money(summary.deliveryCost));

  if (totalLabel) totalLabel.textContent = deliveryPending
    ? 'Предварительная стоимость без доставки'
    : 'Предварительная стоимость';
  if (resultNote) resultNote.textContent = deliveryPending
    ? 'Укажите населённый пункт, чтобы получить итог с доставкой. Точные размеры и цену зафиксируем после бесплатного замера.'
    : 'Это предварительный расчёт с учётом доставки. Точные размеры и итоговую стоимость зафиксируем после бесплатного замера.';

  const status = $('resultStatus');
  status.className = 'result-status';
  if (!summary.activeSections) {
    status.textContent = 'Добавьте длину первого участка';
  } else if (summary.check === 'ГОТОВО') {
    status.textContent = `${summary.totalSpans} пролётов · ${summary.picketsActual} штакетин · ${summary.tubeStocks} хлыстов 40×20`;
    status.classList.add('is-ok');
  } else {
    status.textContent = summary.check;
    status.classList.add('is-warn');
  }

  result.sections.forEach((item, index) => {
    const caption = sectionsList.querySelector(`[data-section-caption="${index}"]`);
    if (!caption) return;
    caption.textContent = item.active
      ? `${item.spans} прол. · чистый ${number(item.clearSpan)} м`
      : 'не заполнен';
  });
}

function renderScheme(result) {
  const active = result.sections.filter(item => item.active);
  if (!active.length) {
    $('schemeList').innerHTML = '<div class="empty-state">Добавьте длину участка, чтобы увидеть схему.</div>';
    return;
  }
  $('schemeList').innerHTML = active.map(item => {
    const visibleSpans = Math.min(item.spans, 12);
    const line = Array.from({length:visibleSpans}, () => '<span class="scheme-post"></span><span class="scheme-span"></span>').join('') + '<span class="scheme-post"></span>';
    const compact = item.spans > visibleSpans ? `<div class="shared-note">На схеме показано ${visibleSpans} из ${item.spans} пролётов</div>` : '';
    const shared = item.sharedPost ? '<div class="shared-note">Последний столб общий со следующим участком</div>' : '';
    return `
      <article class="scheme-card">
        <div class="scheme-top"><b>Участок ${item.index}</b><span>${number(item.length)} × ${number(item.height)} м</span></div>
        <div class="scheme-line">${line}</div>
        <div class="scheme-data">
          <div><small>Пролётов</small><b>${item.spans}</b></div>
          <div><small>Чистый пролёт</small><b>${number(item.clearSpan)} м</b></div>
          <div><small>Факт. зазор</small><b>${number(item.actualGap*1000,1)} мм</b></div>
        </div>
        ${shared}${compact}
      </article>`;
  }).join('');
}

function row(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function renderInternal(result) {
  const panel = $('internalPanel');
  const isDev = Boolean(document.querySelector('meta[name="kuzdvor-environment"][content="development"]'));
  panel.hidden = !isDev;
  if (!isDev) return;

  initInternalToggle();
  if (internalOverview) {
    internalOverview.innerHTML = [
      `<span><b>${result.summary.picketsActual}</b> штакетин</span>`,
      `<span><b>${result.purchase.tubeStocks}</b> хлыстов 40×20</span>`,
      `<span><b>${result.purchase.posts}</b> новых столбов</span>`,
      `<span><b>${money(result.costs.total)}</b> итог</span>`
    ].join('');
  }

  const active = result.sections.filter(item => item.active);
  $('specTable').innerHTML = `
    <thead><tr><th>Участок</th><th>Длина</th><th>Высота</th><th>Прол.</th><th>Чистый</th><th>Перед/прол.</th><th>Зад/прол.</th><th>Перед факт</th><th>Зад факт</th><th>Зазор</th><th>40×20</th><th>Хлыстов</th><th>Новых столбов</th></tr></thead>
    <tbody>${active.map(item => `<tr>
      <td>${item.index}</td><td>${number(item.length)}</td><td>${number(item.height)}</td><td>${item.spans}</td>
      <td>${number(item.clearSpan)}</td><td>${item.frontPerSpan}</td><td>${item.rearPerSpan}</td>
      <td>${item.frontActual}</td><td>${item.rearActual}</td><td>${number(item.actualGap*1000,1)} мм</td>
      <td>${number(item.tubeUsed)} м</td><td>${item.tubeStocks}</td><td>${item.newPosts}</td>
    </tr>`).join('') || '<tr><td colspan="13">Нет активных участков</td></tr>'}</tbody>`;

  $('picketTable').innerHTML = `
    <thead><tr><th>Длина</th><th>Перед факт</th><th>Зад факт</th><th>Запас перед</th><th>Запас зад</th><th>Купить перед</th><th>Купить зад</th><th>Всего</th></tr></thead>
    <tbody>${result.purchase.pickets.map(item => `<tr>
      <td>${number(item.length)} м</td><td>${item.frontActual}</td><td>${item.rearActual}</td>
      <td>${item.reserveFront}</td><td>${item.reserveRear}</td><td>${item.frontBuy}</td><td>${item.rearBuy}</td><td>${item.totalBuy}</td>
    </tr>`).join('') || '<tr><td colspan="8">Нет данных</td></tr>'}</tbody>`;

  $('materialDetails').innerHTML =
    row('Евроштакетник фактически', `${result.summary.picketsActual} шт · ${number(result.summary.picketLmActual)} п.м.`) +
    row('40×20 используется', `${number(result.purchase.tubeUsed)} м`) +
    row('40×20 купить', `${result.purchase.tubeStocks} хлыст. × 6 м`) +
    row('Остаток 40×20', `${number(result.purchase.tubeRemainder)} м`) +
    row('Новые столбы', `${result.purchase.posts} шт × 3 м`) +
    row('Саморезы', `${result.purchase.screws} шт`);

  const c = result.costs;
  $('costDetails').innerHTML =
    row('Евроштакетник', money(c.picket)) +
    row('Проф. труба 40×20×2', money(c.tube)) +
    row('Столбы', money(c.posts)) +
    row('Материалы всего', money(c.materials)) +
    row('Покраска металла', money(c.paint)) +
    row('Работа по забору', money(c.work)) +
    row('Установка столбов', money(c.postInstall)) +
    row('Саморезы', money(c.screws)) +
    row('Стоимость заказа', money(c.order)) +
    row('ЗП замерщика 4%', money(c.measurer)) +
    row('Доставка', money(c.delivery)) +
    row('Итого', money(c.total));
}

function hideSettlementResults() {
  settlementResults.hidden = true;
  settlementResults.innerHTML = '';
}

function chooseSettlement(item) {
  selectedDelivery = item;
  settlementInput.value = item.name;
  hideSettlementResults();
  deliveryStatus.className = 'delivery-status is-ok';
  deliveryStatus.textContent = item.price > 0
    ? `${item.name}${item.secondary ? ', ' + item.secondary : ''} · доставка учтена в расчёте`
    : `${item.name}${item.secondary ? ', ' + item.secondary : ''} · доставка 0 ₽`;
  calculate();
}

function settlementMatches(value) {
  const q = normalize(value);
  if (q.length < 2) return [];
  return deliveryRows
    .map(item => {
      const name = normalize(item.name);
      const secondary = normalize(item.secondary);
      let score = 99;
      if (name === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 2;
      else if (secondary.includes(q)) score = 3;
      return {item,score};
    })
    .filter(match => match.score < 99)
    .sort((a,b) => a.score-b.score || a.item.name.localeCompare(b.item.name,'ru'))
    .slice(0,8)
    .map(match => match.item);
}

function renderSettlementResults() {
  const matches = settlementMatches(settlementInput.value);
  if (!matches.length) {
    hideSettlementResults();
    return;
  }
  settlementResults.innerHTML = matches.map((item,index) => `
    <button type="button" class="settlement-option" data-settlement-index="${index}">
      <b>${item.name}</b><span>${item.secondary || 'Башкортостан'} · доставка ${money(item.price)}</span>
    </button>`).join('');
  settlementResults.hidden = false;
  [...settlementResults.querySelectorAll('[data-settlement-index]')].forEach((button,index) => {
    button.addEventListener('click', () => chooseSettlement(matches[index]));
  });
}

async function loadDeliveryBase() {
  try {
    const response = await fetch('/offline-delivery-200km.json', {cache:'no-store'});
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const rows = Array.isArray(data.destinations) ? data.destinations : (data.delivery?.destinations || []);
    deliveryRows = rows
      .map(item => ({name:String(item.name||'').trim(),secondary:String(item.secondary||'').trim(),price:Number(item.price)||0}))
      .filter(item => item.name);
  } catch {
    deliveryRows = [];
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Справочник доставки сейчас недоступен. При необходимости укажите стоимость вручную.';
  }
}

async function resolveUnknownSettlement() {
  if (manualDeliveryEnabled.checked || selectedDelivery || normalize(settlementInput.value).length < 2) return;
  const exact = deliveryRows.filter(item => normalize(item.name) === normalize(settlementInput.value));
  if (exact.length === 1) {
    chooseSettlement(exact[0]);
    return;
  }
  if (location.hostname.endsWith('github.io')) {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'В DEV-версии выберите населённый пункт из подсказки или укажите доставку вручную.';
    return;
  }
  try {
    deliveryStatus.className = 'delivery-status';
    deliveryStatus.textContent = 'Рассчитываем доставку…';
    const response = await fetch(`/api/delivery?place=${encodeURIComponent(settlementInput.value.trim())}`, {cache:'no-store'});
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    selectedDelivery = {
      name: String(data.shortName || settlementInput.value).trim(),
      secondary: String(data.district || data.region || '').trim(),
      price: Number(data.price)||0
    };
    deliveryStatus.className = 'delivery-status is-ok';
    deliveryStatus.textContent = `${selectedDelivery.name} · доставка учтена в расчёте`;
    calculate();
  } catch {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Автоматически рассчитать не удалось. Выберите вариант из подсказки или укажите доставку вручную.';
  }
}

addSectionButton.addEventListener('click', () => {
  if (visibleSections >= 4) return;
  visibleSections += 1;
  syncVisibleSections();
  calculate();
  sectionsList.querySelector(`[data-field="length"][data-index="${visibleSections-1}"]`)?.focus();
});
removeSectionButton.addEventListener('click', () => {
  if (visibleSections <= 1) return;
  const index = visibleSections - 1;
  const length = sectionsList.querySelector(`[data-field="length"][data-index="${index}"]`);
  const height = sectionsList.querySelector(`[data-field="height"][data-index="${index}"]`);
  const sharedBefore = sectionsList.querySelector(`[data-field="shared"][data-index="${index-1}"]`);
  if (length) length.value = '0';
  if (height) height.value = '1.8';
  if (sharedBefore) sharedBefore.checked = false;
  visibleSections -= 1;
  syncVisibleSections();
  calculate();
});

form.addEventListener('input', event => {
  if (event.target === settlementInput) return;
  calculate();
});
form.addEventListener('change', event => {
  if (event.target === settlementInput) return;
  if (event.target === typeInput) syncTypeHelp();
  calculate();
});

settlementInput.addEventListener('input', () => {
  if (selectedDelivery && normalize(selectedDelivery.name) !== normalize(settlementInput.value)) {
    selectedDelivery = null;
    deliveryStatus.className = 'delivery-status';
    deliveryStatus.textContent = 'Выберите населённый пункт из подсказки, чтобы учесть доставку.';
    calculate();
  }
  renderSettlementResults();
});
settlementInput.addEventListener('focus', renderSettlementResults);
settlementInput.addEventListener('blur', () => setTimeout(() => {
  hideSettlementResults();
  resolveUnknownSettlement();
}, 160));
settlementInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    resolveUnknownSettlement();
    settlementInput.blur();
  }
});

manualDeliveryEnabled.addEventListener('change', () => {
  deliveryStatus.className = manualDeliveryEnabled.checked ? 'delivery-status is-warn' : 'delivery-status';
  deliveryStatus.textContent = manualDeliveryEnabled.checked
    ? 'Используется указанная вручную стоимость доставки.'
    : (selectedDelivery ? 'Используется автоматическая стоимость доставки.' : 'Выберите населённый пункт из подсказки, чтобы учесть доставку.');
  calculate();
});

document.addEventListener('click', event => {
  if (!settlementResults.contains(event.target) && event.target !== settlementInput) hideSettlementResults();
});

syncVisibleSections();
syncTypeHelp();
await loadDeliveryBase();
calculate();
