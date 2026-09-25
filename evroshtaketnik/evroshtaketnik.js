import { calculateFence, FENCE_SETTINGS } from './engine.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(Math.round(Number(value)||0)) + ' ₽';
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:digits}).format(Number(value)||0);
const normalize = value => String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ');
const isDev = location.hostname.endsWith('github.io') || Boolean(document.querySelector('meta[name="kuzdvor-environment"][content="development"]'));

const form = $('fenceForm');
const typeInput = $('fenceType');
const postInput = $('postType');
const includePostsInput = $('includePosts');
const existingPostsInput = $('existingPostsCount');
const existingPostsWrap = $('existingPostsWrap');
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
const mobileQuoteBar = $('mobileQuoteBar');
const mobileBarPrice = $('mobileBarPrice');
const mobileBarNote = $('mobileBarNote');
const leadForm = $('leadForm');
const leadState = $('leadState');
const leadCity = $('leadCity');
const leadSubmit = $('leadSubmit');
const savedQuoteBar = $('savedQuoteBar');
const SAVED_QUOTE_KEY = 'kuzdvor:picket-saved-v1';

let visibleSections = 1;
let deliveryRows = [];
let selectedDelivery = null;
let selectedColor = 'Графит';
let lastResult = null;
let runtimeSettings = {...FENCE_SETTINGS};
let toastTimer = 0;

function sectionMarkup(index) {
  const n = index + 1;
  return `
    <article class="section-card" data-section-card="${index}">
      <div class="section-card-head"><b>Участок ${n}</b><span data-section-caption="${index}">не заполнен</span></div>
      <div class="section-fields">
        <label class="field"><span>Длина линии, м</span><input data-field="length" data-index="${index}" type="number" min="0" max="200" step="0.1" inputmode="decimal" value="0"></label>
        <label class="field"><span>Высота, м</span><input data-field="height" data-index="${index}" type="number" min="0.5" max="3" step="0.05" inputmode="decimal" value="1.8"></label>
      </div>
      <details class="section-openings">
        <summary>Есть ворота или калитка в этом участке?</summary>
        <div class="section-fields opening-fields">
          <label class="field"><span>Проём ворот, м</span><input data-field="gateOpening" data-index="${index}" type="number" min="0" max="10" step="0.05" inputmode="decimal" value="0"></label>
          <label class="field"><span>Проём калитки, м</span><input data-field="wicketOpening" data-index="${index}" type="number" min="0" max="3" step="0.05" inputmode="decimal" value="0"></label>
        </div>
        <small>Проёмы вычитаются из длины забора. Стоимость самих ворот и калитки в этот расчёт не входит.</small>
      </details>
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
    const gateOpening = Number(sectionsList.querySelector(`[data-field="gateOpening"][data-index="${index}"]`)?.value || 0);
    const wicketOpening = Number(sectionsList.querySelector(`[data-field="wicketOpening"][data-index="${index}"]`)?.value || 0);
    const shared = Boolean(sectionsList.querySelector(`[data-field="shared"][data-index="${index}"]`)?.checked);
    return {
      length: index < visibleSections ? Math.max(0, length) : 0,
      height: Math.max(.5, height || 1.8),
      gateOpening: index < visibleSections ? Math.max(0, gateOpening) : 0,
      wicketOpening: index < visibleSections ? Math.max(0, wicketOpening) : 0,
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
  'horizontal-double': 'Горизонтальные металлические планки с двух сторон. В расчёте добавляются вертикальные прожилины внутри каждого пролёта.'
};

function showToast(message) {
  const toast = $('pageToast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function scrollToLead() {
  $('leadSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(() => $('leadPhone')?.focus({preventScroll:true}), 450);
}

function syncTypeHelp() {
  if (typeHelp) typeHelp.textContent = TYPE_HELP[typeInput.value] || '';
}

function syncTypePicker() {
  document.querySelectorAll('.type-card[data-type]').forEach(card => {
    const selected = card.dataset.type === typeInput.value;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  syncTypeHelp();
}

function syncColorPicker() {
  document.querySelectorAll('.color-choice[data-color]').forEach(button => {
    const selected = button.dataset.color === selectedColor;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
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
    existingPostsCount: Number(existingPostsInput?.value || 0),
    sections: readSections(),
    deliveryCost: deliveryCost(),
    settings: runtimeSettings
  });
  lastResult = result;
  renderResult(result);
  renderScheme(result);
  renderInternal(result);
  renderLeadPreview(result);
}

function renderResult(result) {
  const {summary,type} = result;
  const deliveryPending = !deliveryIsKnown();
  $('totalPrice').textContent = summary.activeSections ? money(summary.total) : '0 ₽';
  $('summaryType').textContent = type.label;
  $('summaryLength').textContent = summary.openingsWidth > 0
    ? `${number(summary.totalLength)} м из линии ${number(summary.grossLineLength)} м`
    : `${number(summary.totalLength)} м`;
  $('summaryPosts').textContent = result.includeNewPosts
    ? `${summary.postsByScheme} (новых ${summary.newPosts})`
    : String(summary.postsByScheme);
  $('summaryDelivery').textContent = deliveryPending
    ? 'не указана'
    : (summary.deliveryCost === 0 ? '0 ₽' : money(summary.deliveryCost));

  if (totalLabel) totalLabel.textContent = deliveryPending
    ? 'Предварительная стоимость без доставки'
    : 'Предварительная стоимость с доставкой';
  if (resultNote) resultNote.textContent = deliveryPending
    ? 'Укажите населённый пункт, чтобы получить итог с доставкой. Точные размеры и цену зафиксируем после бесплатного замера.'
    : 'Доставка учтена. Точные размеры и итоговую стоимость зафиксируем после бесплатного замера.';

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

  const chips = [
    '<span class="accent">металлический евроштакетник</span>',
    '<span>каркас 40×20×2</span>',
    '<span>покраска каркаса</span>',
    '<span>монтаж забора</span>',
    '<span>крепёж</span>'
  ];
  if (result.includeNewPosts && summary.newPosts > 0) chips.push(`<span>новые столбы: ${summary.newPosts} шт + установка</span>`);
  if (summary.existingPostsUsed > 0) chips.push(`<span>готовые столбы: ${summary.existingPostsUsed} шт</span>`);
  if (summary.openingsWidth > 0) chips.push(`<span>проёмы вычтены: ${number(summary.openingsWidth)} м</span>`);
  if ($('includedChips')) $('includedChips').innerHTML = chips.join('');

  result.sections.forEach((item, index) => {
    const caption = sectionsList.querySelector(`[data-section-caption="${index}"]`);
    if (!caption) return;
    caption.textContent = item.active
      ? (item.openingsWidth > 0
          ? `${item.spans} прол. · забор ${number(item.fenceLength)} из ${number(item.grossLength)} м`
          : `${item.spans} прол. · чистый ${number(item.clearSpan)} м`)
      : 'не заполнен';
  });

  const hasQuote = summary.activeSections > 0;
  if (mobileQuoteBar) mobileQuoteBar.hidden = !hasQuote;
  if (mobileBarPrice) mobileBarPrice.textContent = hasQuote ? money(summary.total) : '0 ₽';
  if (mobileBarNote) mobileBarNote.textContent = deliveryPending ? 'без доставки' : 'с доставкой';
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
    const openings = item.openingsWidth > 0
      ? `<div class="shared-note">Проёмы ворот/калитки: ${number(item.openingsWidth)} м · в заборе считается ${number(item.fenceLength)} м</div>`
      : '';
    return `
      <article class="scheme-card">
        <div class="scheme-top"><b>Участок ${item.index}</b><span>${number(item.length)} × ${number(item.height)} м</span></div>
        <div class="scheme-line">${line}</div>
        <div class="scheme-data">
          <div><small>Пролётов</small><b>${item.spans}</b></div>
          <div><small>Чистый пролёт</small><b>${number(item.clearSpan)} м</b></div>
          <div><small>Факт. зазор</small><b>${number(item.actualGap*1000,1)} мм</b></div>
        </div>
        ${openings}${shared}${compact}
      </article>`;
  }).join('');
}

function row(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function renderInternal(result) {
  const panel = $('internalPanel');
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
    row('Столбов требуется по схеме', `${result.summary.postsByScheme} шт`) +
    row('Готовых столбов учтено', `${result.summary.existingPostsUsed} шт`) +
    row('Новых столбов', `${result.purchase.posts} шт × 3 м`) +
    row('Проёмы ворот/калитки', `${number(result.summary.openingsWidth)} м`) +
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
  if (leadCity) leadCity.value = item.name;
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
    if (leadCity) leadCity.value = selectedDelivery.name;
    deliveryStatus.className = 'delivery-status is-ok';
    deliveryStatus.textContent = `${selectedDelivery.name} · доставка учтена в расчёте`;
    calculate();
  } catch {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Автоматически рассчитать не удалось. Выберите вариант из подсказки или укажите доставку вручную.';
  }
}


function renderLeadPreview(result) {
  const target = $('leadQuotePreview');
  if (!target) return;
  if (!result.summary.activeSections) {
    target.textContent = 'Сначала укажите длину участка.';
    return;
  }
  const postText = result.includeNewPosts
    ? `новых столбов: ${result.summary.newPosts}, готовых: ${result.summary.existingPostsUsed}`
    : 'на готовые столбы';
  target.innerHTML = `<b>${money(result.summary.total)}${deliveryIsKnown() ? '' : ' · без доставки'}</b><br>${result.type.label} · ${number(result.summary.totalLength)} м забора${result.summary.openingsWidth > 0 ? ` из линии ${number(result.summary.grossLineLength)} м` : ''} · ${result.summary.totalSpans} пролётов · ${postText} · цвет: ${selectedColor}`;
}

async function loadFencePrices() {
  try {
    const response = await fetch('/api/fence-prices', {cache:'no-store',headers:{accept:'application/json'}});
    if (!response.ok) return;
    const data = await response.json();
    if (data?.fence && typeof data.fence === 'object') runtimeSettings = {...FENCE_SETTINGS,...data.fence};
  } catch {}
}

function quoteText() {
  if (!lastResult?.summary.activeSections) return '';
  const sections = lastResult.sections.filter(item => item.active).map(item => {
    const opening = item.openingsWidth > 0 ? `, проёмы ${number(item.openingsWidth)} м, забор ${number(item.fenceLength)} м` : '';
    return `Участок ${item.index}: линия ${number(item.grossLength)} × ${number(item.height)} м${opening}, ${item.spans} прол.`;
  }).join('\n');
  return [
    'Кузнечный ДворикЪ — предварительный расчёт забора из металлического евроштакетника',
    `Тип: ${lastResult.type.label}`,
    `Столбы: ${postInput.options[postInput.selectedIndex]?.textContent || postInput.value}; требуется ${lastResult.summary.postsByScheme}, готовых учтено ${lastResult.summary.existingPostsUsed}, новых ${lastResult.summary.newPosts}`,
    `Цвет: ${selectedColor}`,
    sections,
    `Общая длина: ${number(lastResult.summary.totalLength)} м`,
    `Доставка: ${deliveryIsKnown() ? money(lastResult.summary.deliveryCost) : 'не указана'}`,
    `Предварительная стоимость: ${money(lastResult.summary.total)}${deliveryIsKnown() ? '' : ' без доставки'}`
  ].filter(Boolean).join('\n');
}

function leadPayload() {
  const city = (leadCity?.value || selectedDelivery?.name || settlementInput.value).trim();
  return {
    category:'picket-fence',
    source:'evroshtaketnik-calculator',
    productTitle:'Забор из металлического евроштакетника',
    name:$('leadName')?.value.trim() || '',
    phone:$('leadPhone')?.value.trim() || '',
    city,
    consent:Boolean($('leadConsent')?.checked),
    policyVersion:'2026-09-25',
    comment:$('leadComment')?.value.trim() || '',
    total:lastResult?.summary.total || 0,
    posts:includePostsInput.checked,
    message:quoteText(),
    configuration:{
      fenceType:typeInput.value,
      fenceTypeLabel:lastResult?.type.label || '',
      postType:postInput.value,
      includeNewPosts:includePostsInput.checked,
      existingPostsCount:Number(existingPostsInput?.value || 0),
      color:selectedColor,
      sections:readSections().filter(item => item.length > 0),
      delivery:{known:deliveryIsKnown(),name:selectedDelivery?.name || settlementInput.value.trim(),price:deliveryCost()},
      summary:lastResult ? {
        totalLength:lastResult.summary.totalLength,
        totalSpans:lastResult.summary.totalSpans,
        postsByScheme:lastResult.summary.postsByScheme,
        picketsActual:lastResult.summary.picketsActual,
        tubeStocks:lastResult.summary.tubeStocks,
        total:lastResult.summary.total
      } : null
    }
  };
}

async function submitLead(event) {
  event.preventDefault();
  if (!leadState || !leadSubmit) return;
  leadState.className = 'lead-state';
  leadState.textContent = '';
  if (!lastResult?.summary.activeSections) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Сначала укажите размеры забора.';
    return;
  }
  const payload = leadPayload();
  const digits = payload.phone.replace(/\D/g,'');
  if (digits.length < 10) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Укажите корректный номер телефона.';
    $('leadPhone')?.focus();
    return;
  }
  if (!payload.city) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Укажите населённый пункт.';
    leadCity?.focus();
    return;
  }
  if (!payload.consent) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Подтвердите согласие на обработку персональных данных.';
    return;
  }

  leadSubmit.disabled = true;
  leadSubmit.textContent = 'Отправляем…';
  try {
    if (isDev) {
      await new Promise(resolve => setTimeout(resolve, 300));
      leadState.textContent = 'DEV: форма и состав заявки проверены. Реальному менеджеру заявка не отправлена.';
      showToast('DEV-заявка подготовлена');
      return;
    }
    const response = await fetch('/api/leads', {
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось отправить заявку');
    leadState.textContent = 'Заявка отправлена. Менеджер получит ваш расчёт и свяжется с вами.';
    showToast('Заявка отправлена ✓');
  } catch (error) {
    leadState.classList.add('is-error');
    leadState.textContent = error?.message || 'Не удалось отправить заявку.';
  } finally {
    leadSubmit.disabled = false;
    leadSubmit.textContent = 'Заказать бесплатный замер';
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
  if (leadCity) leadCity.value = settlementInput.value;
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

document.querySelectorAll('.type-card[data-type]').forEach(card => card.addEventListener('click', () => {
  typeInput.value = card.dataset.type;
  syncTypePicker();
  calculate();
}));
document.querySelectorAll('.color-choice[data-color]').forEach(button => button.addEventListener('click', () => {
  selectedColor = button.dataset.color || 'Графит';
  syncColorPicker();
  calculate();
}));
$('resultLeadButton')?.addEventListener('click', scrollToLead);
$('mobileLeadButton')?.addEventListener('click', scrollToLead);
$('copyQuote')?.addEventListener('click', async () => {
  const text = quoteText();
  if (!text) { showToast('Сначала укажите размеры'); return; }
  try { await navigator.clipboard.writeText(text); showToast('Расчёт скопирован'); }
  catch { showToast('Не удалось скопировать автоматически'); }
});
$('printQuote')?.addEventListener('click', () => {
  if (!lastResult?.summary.activeSections) { showToast('Сначала укажите размеры'); return; }
  window.print();
});
leadForm?.addEventListener('submit', submitLead);

syncVisibleSections();
syncTypePicker();
syncColorPicker();
await Promise.all([loadDeliveryBase(), loadFencePrices()]);
calculate();
