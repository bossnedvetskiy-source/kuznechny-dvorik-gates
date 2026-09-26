const adminTabs = [...document.querySelectorAll('[data-admin-tab]')];
const photosTab = document.getElementById('photosTab');
const pricesTab = document.getElementById('pricesTab');
const catalogTab = document.getElementById('catalogTab');
const priceForm = document.getElementById('priceForm');
const catalogInstallationInput = document.getElementById('catalogInstallationInput');
const catalogPostsInput = document.getElementById('catalogPostsInput');
const catalogPriceList = document.getElementById('catalogPriceList');
const extraPriceList = document.getElementById('extraPriceList');
const fencePriceList = document.getElementById('fencePriceList');
const priceSaveState = document.getElementById('priceSaveState');
const savePricesButton = document.getElementById('savePricesButton');
const priceActionBar = savePricesButton?.closest('.action-bar');
const catalogManageList = document.getElementById('catalogManageList');
const catalogSaveState = document.getElementById('catalogSaveState');
const saveCatalogButton = document.getElementById('saveCatalogButton');
const catalogActionBar = saveCatalogButton?.closest('.action-bar');

let priceSettings = null;
let priceDirty = false;
let catalogDirty = false;
let pricesLoaded = false;
let pricesLoading = false;
let catalogDraft = [];
let catalogSearchQuery = '';
let catalogDragState = null;

const moneyDisplay = value => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0))} ₽`;

function moneyInputValue(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? String(number) : '0';
}

function setPriceDirty(value = true) {
  priceDirty = value;
  savePricesButton.disabled = !value;
  priceSaveState.textContent = value ? 'Есть несохранённые изменения' : 'Настройки сохранены';
  priceSaveState.classList.toggle('dirty', value);
  if (priceActionBar) priceActionBar.hidden = !value;
}

function setCatalogDirty(value = true) {
  catalogDirty = value;
  saveCatalogButton.disabled = !value;
  catalogSaveState.textContent = value ? 'Есть несохранённые изменения' : 'Каталог сохранён';
  catalogSaveState.classList.toggle('dirty', value);
  if (catalogActionBar) catalogActionBar.hidden = !value;
}

function createMoneyInput(value, dataset = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '10000000';
  input.step = '100';
  input.inputMode = 'numeric';
  input.value = moneyInputValue(value);
  Object.assign(input.dataset, dataset);
  input.addEventListener('input', () => setPriceDirty());
  return input;
}

function renderCatalogPrices() {
  // The gate product price itself is controlled by admin-excel-import.js.
  // Once that module is mounted, normal settings refreshes must never replace it with manual price rows.
  if (window.KUZDVOR_ADMIN_EXCEL_READY) return;
  catalogPriceList.replaceChildren();
  const note = document.createElement('p');
  note.className = 'upload-note';
  note.innerHTML = '<b>Цены ворот не редактируются вручную.</b> Они рассчитываются из Excel-модели: стоимость материалов и формулы из расчётного файла определяют цену каждого артикула и любого размера.';
  catalogPriceList.append(note);

  for (const item of priceSettings.catalog || []) {
    const row = document.createElement('div');
    row.className = 'catalog-price-row';

    const title = document.createElement('span');
    title.className = 'price-item-title';
    title.innerHTML = `<b>${item.art}</b><small>Источник цены — Excel-расчёт</small>`;

    const source = document.createElement('strong');
    source.textContent = 'Из Excel';
    source.style.fontSize = '11px';
    source.style.color = '#8a6326';
    row.append(title, source);
    catalogPriceList.append(row);
  }
}

function renderExtraPrices() {
  extraPriceList.replaceChildren();
  for (const item of priceSettings.extraProducts || []) {
    const card = document.createElement('section');
    card.className = 'extra-price-card compact-extra-price';

    const heading = document.createElement('div');
    heading.className = 'extra-price-heading compact-extra-heading';
    const headingTitle = document.createElement('div');
    headingTitle.innerHTML = `<b>${item.title || item.art || item.id}</b><small>${item.art || ''}</small>`;

    const fields = document.createElement('div');
    fields.className = 'extra-price-fields';
    fields.hidden = true;
    const definitions = [
      ['price', 'Изделие, ₽'],
      ['install', 'Монтаж, ₽'],
      ['posts', 'Столбы, ₽']
    ];
    let priceInput = null;
    for (const [field, labelText] of definitions) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = createMoneyInput(item[field] || 0, {extraId: item.id, extraField: field});
      if (field === 'price') priceInput = input;
      label.append(input);
      fields.append(label);
    }

    const actions = document.createElement('div');
    actions.className = 'extra-price-compact-actions';
    const current = document.createElement('strong');
    current.className = 'extra-price-current';
    current.textContent = moneyDisplay(priceInput?.value || item.price || 0);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'extra-price-edit';
    edit.textContent = 'Изменить';
    edit.setAttribute('aria-expanded', 'false');
    edit.addEventListener('click', () => {
      const opening = fields.hidden;
      fields.hidden = !opening;
      card.classList.toggle('is-open', opening);
      edit.textContent = opening ? 'Свернуть' : 'Изменить';
      edit.setAttribute('aria-expanded', String(opening));
      if (opening) priceInput?.focus({preventScroll:true});
    });
    priceInput?.addEventListener('input', () => { current.textContent = moneyDisplay(priceInput.value); });
    actions.append(current, edit);
    heading.append(headingTitle, actions);

    card.append(heading, fields);
    extraPriceList.append(card);
  }
}


const FENCE_PRICE_DEFINITIONS = [
  ['picketSinglePrice','Евроштакетник односторонний','₽/п.м.',1,'prices'],
  ['picketDoublePrice','Евроштакетник двусторонний','₽/п.м.',1,'prices'],
  ['tube40Price','Труба 40×20×2','₽/м',1,'prices'],
  ['post60Price','Столб 60×60×2','₽/м',1,'prices'],
  ['post80Price','Столб 80×80×3','₽/м',1,'prices'],
  ['post100Price','Столб 100×100×3','₽/м',1,'prices'],
  ['paintPrice','Покраска профильных труб','₽/м²',10,'prices'],
  ['workVerticalSingle','Работа: вертикальный односторонний','₽/п.м.',10,'prices'],
  ['workVerticalDouble','Работа: вертикальный двусторонний','₽/п.м.',10,'prices'],
  ['workHorizontalDouble','Работа: горизонтальный двусторонний','₽/п.м.',10,'prices'],
  ['postInstallPrice','Установка столба','₽/шт',10,'prices'],
  ['screwPrice','Саморез','₽/шт',1,'prices'],
  ['markupPercent','Наценка / резерв','%',0.1,'prices'],
  ['measurerPercent','ЗП замерщика','%',0.1,'prices'],

  ['picketWidth','Ширина планки евроштакетника','м',0.005,'technology'],
  ['gapSingle','Макс. зазор: односторонний','м',0.005,'technology'],
  ['gapDouble','Макс. зазор: шахматка / двусторонний','м',0.005,'technology'],
  ['maxSpan','Максимальный чистый пролёт','м',0.05,'technology'],
  ['openingBridgeMaxSpan','Макс. пролёт между воротами и калиткой без доп. столба','м',0.05,'technology'],
  ['postLength','Длина столба','м',0.1,'technology'],
  ['postDepth','Заглубление столба','м',0.05,'technology'],
  ['tubeStockLength','Длина хлыста 40×20×2','м',0.5,'technology'],
  ['screwVertical','Саморезов на вертикальную планку','шт',1,'technology'],
  ['screwHorizontal','Саморезов на горизонтальную планку','шт',1,'technology'],
  ['picketReservePerSide','Запас штакетника на каждую сторону','шт',1,'technology']
];

function renderFencePrices() {
  if (!fencePriceList) return;
  fencePriceList.replaceChildren();
  const fence = priceSettings?.fence || {};
  let previousGroup = '';
  for (const [key,labelText,unit,step,group] of FENCE_PRICE_DEFINITIONS) {
    if (group !== previousGroup) {
      const title = document.createElement('div');
      title.className = 'fence-price-group-title';
      title.innerHTML = group === 'technology'
        ? '<b>Технологические параметры</b><small>Меняйте только если изменилась конструкция или материал.</small>'
        : '<b>Цены и работа</b><small>Используются в расчёте клиента.</small>';
      fencePriceList.append(title);
      previousGroup = group;
    }
    const label = document.createElement('label');
    label.className = 'fence-price-field';
    const title = document.createElement('span');
    title.innerHTML = `<b>${labelText}</b><small>${unit}</small>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = ['picketWidth','maxSpan','openingBridgeMaxSpan','postLength','tubeStockLength'].includes(key) ? '0.01' : '0';
    input.max = key.includes('Percent')
      ? '100'
      : ['picketWidth','gapSingle','gapDouble','maxSpan','openingBridgeMaxSpan','postLength','postDepth','tubeStockLength'].includes(key)
        ? '20'
        : '10000000';
    input.step = String(step);
    input.inputMode = 'decimal';
    input.value = String(Number(fence[key]) || 0);
    input.dataset.fenceKey = key;
    input.addEventListener('input', () => setPriceDirty());
    label.append(title,input);
    fencePriceList.append(label);
  }
}

function normalizeCatalogDraft() {
  catalogDraft = (priceSettings?.catalog || [])
    .map((item, index) => ({...item, visible: item.visible !== false, order: Number(item.order) || index + 1}))
    .sort((a, b) => a.order - b.order);
  catalogDraft.forEach((item, index) => { item.order = index + 1; });
}

function normalizeCatalogSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/^арт\.?/i, '');
}

function catalogItemMatches(item) {
  const query = normalizeCatalogSearch(catalogSearchQuery);
  if (!query) return true;
  return normalizeCatalogSearch(item.art).includes(query);
}

function syncCatalogDraftFromDom() {
  const rows = [...catalogManageList.querySelectorAll('.catalog-manage-row[data-art]')];
  if (rows.length !== catalogDraft.length) return false;
  const currentOrder = rows.map(row => row.dataset.art);
  const before = catalogDraft.map(item => item.art);
  if (currentOrder.every((art, index) => art === before[index])) return false;
  const byArt = new Map(catalogDraft.map(item => [item.art, item]));
  catalogDraft = currentOrder.map(art => byArt.get(art)).filter(Boolean);
  catalogDraft.forEach((item, index) => { item.order = index + 1; });
  return true;
}

function endCatalogDrag(event) {
  const state = catalogDragState;
  if (!state || (event && event.pointerId !== state.pointerId)) return;
  try { state.handle.releasePointerCapture?.(state.pointerId); } catch {}
  state.handle.removeEventListener('pointermove', moveCatalogDrag);
  state.handle.removeEventListener('pointerup', endCatalogDrag);
  state.handle.removeEventListener('pointercancel', endCatalogDrag);
  state.row.classList.remove('is-dragging');
  document.body.classList.remove('catalog-drag-active');
  catalogDragState = null;
  if (syncCatalogDraftFromDom()) setCatalogDirty();
  renderCatalogManagement();
}

function moveCatalogDrag(event) {
  const state = catalogDragState;
  if (!state || event.pointerId !== state.pointerId) return;
  event.preventDefault();
  state.row.style.pointerEvents = 'none';
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.catalog-manage-row[data-art]');
  state.row.style.pointerEvents = '';
  if (!target || target === state.row || target.parentElement !== catalogManageList) return;
  const rect = target.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  catalogManageList.insertBefore(state.row, after ? target.nextSibling : target);
}

function beginCatalogDrag(event, row, handle) {
  if (catalogSearchQuery) {
    showToast('Очистите поиск, чтобы менять порядок', true);
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  catalogDragState = {row, handle, pointerId: event.pointerId};
  row.classList.add('is-dragging');
  document.body.classList.add('catalog-drag-active');
  try { handle.setPointerCapture?.(event.pointerId); } catch {}
  handle.addEventListener('pointermove', moveCatalogDrag);
  handle.addEventListener('pointerup', endCatalogDrag);
  handle.addEventListener('pointercancel', endCatalogDrag);
}

function renderCatalogManagement() {
  catalogManageList.replaceChildren();
  const filtered = catalogDraft
    .map((item, index) => ({item, index}))
    .filter(({item}) => catalogItemMatches(item));

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'catalog-search-empty';
    empty.textContent = 'Такой артикул не найден.';
    catalogManageList.append(empty);
    return;
  }

  filtered.forEach(({item, index}) => {
    const row = document.createElement('article');
    row.className = `catalog-manage-row${item.visible ? '' : ' is-hidden'}`;
    row.dataset.art = item.art;

    const dragHandle = document.createElement('button');
    dragHandle.className = 'catalog-drag-handle';
    dragHandle.type = 'button';
    dragHandle.disabled = Boolean(catalogSearchQuery);
    dragHandle.title = catalogSearchQuery ? 'Очистите поиск, чтобы менять порядок' : 'Зажмите и перетащите модель';
    dragHandle.setAttribute('aria-label', dragHandle.title);
    const position = document.createElement('span');
    position.className = 'catalog-position';
    position.textContent = String(index + 1);
    const grip = document.createElement('span');
    grip.className = 'catalog-drag-grip';
    grip.textContent = '⠿';
    grip.setAttribute('aria-hidden', 'true');
    dragHandle.append(position, grip);
    dragHandle.addEventListener('pointerdown', event => beginCatalogDrag(event, row, dragHandle));

    const name = document.createElement('div');
    name.className = 'catalog-manage-name';
    name.innerHTML = `<b>${item.art}</b><small>Цена — из Excel-расчёта</small>`;

    const visibility = document.createElement('label');
    visibility.className = 'catalog-visibility';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.visible;
    const visibilityText = document.createElement('span');
    visibilityText.textContent = item.visible ? 'На сайте' : 'Скрыто';
    checkbox.addEventListener('change', () => {
      if (!checkbox.checked && catalogDraft.filter(entry => entry.visible).length <= 1) {
        checkbox.checked = true;
        showToast('В каталоге должна остаться хотя бы одна модель', true);
        return;
      }
      item.visible = checkbox.checked;
      visibilityText.textContent = item.visible ? 'На сайте' : 'Скрыто';
      setCatalogDirty();
      renderCatalogManagement();
    });
    visibility.append(checkbox, visibilityText);

    const actions = document.createElement('div');
    actions.className = 'catalog-order-actions';
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '↑';
    up.title = catalogSearchQuery ? 'Очистите поиск, чтобы менять порядок' : 'Поднять выше';
    up.disabled = Boolean(catalogSearchQuery) || index === 0;
    up.addEventListener('click', () => moveCatalogItem(index, -1));
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = catalogSearchQuery ? 'Очистите поиск, чтобы менять порядок' : 'Опустить ниже';
    down.disabled = Boolean(catalogSearchQuery) || index === catalogDraft.length - 1;
    down.addEventListener('click', () => moveCatalogItem(index, 1));
    actions.append(up, down);

    row.append(dragHandle, name, visibility, actions);
    catalogManageList.append(row);
  });
}

function setupCatalogManagementUi() {
  if (!catalogManageList || document.getElementById('catalogSearchInput')) return;
  const tools = document.createElement('div');
  tools.className = 'catalog-manage-tools';
  tools.innerHTML = '<label><span>Найти артикул</span><input id="catalogSearchInput" type="search" inputmode="search" autocomplete="off" placeholder="Например: 18 или 17С"></label>';
  catalogManageList.before(tools);
  const search = tools.querySelector('#catalogSearchInput');
  search.addEventListener('input', () => {
    catalogSearchQuery = search.value.trim();
    renderCatalogManagement();
  });

  if (!document.getElementById('catalogManageCompactStyle')) {
    const style = document.createElement('style');
    style.id = 'catalogManageCompactStyle';
    style.textContent = `
      .catalog-manage-tools{margin:0 0 10px}.catalog-manage-tools label{display:grid;gap:5px}.catalog-manage-tools label>span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}.catalog-manage-tools input{width:100%;height:42px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;font-size:12px;outline:none}.catalog-manage-tools input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(198,147,63,.13)}
      .catalog-drag-handle{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;height:38px;padding:3px 5px;border:0;border-radius:9px;background:#f1ede6;color:#70685f;touch-action:none;cursor:grab}.catalog-drag-handle:active{cursor:grabbing}.catalog-drag-handle:disabled{cursor:not-allowed;opacity:.55}.catalog-drag-handle .catalog-position{width:26px;height:26px;background:#fff}.catalog-drag-grip{font-size:16px;line-height:1;color:#978b7d}.catalog-manage-row.is-dragging{position:relative;z-index:4;opacity:.8;box-shadow:0 10px 24px rgba(18,16,13,.14);transform:scale(1.01)}.catalog-drag-active{user-select:none}.catalog-search-empty{margin:0;padding:22px;text-align:center;color:var(--muted);font-size:12px}
      @media(max-width:620px){
        #catalogTab .settings-card{padding:12px}#catalogTab .panel-heading{margin-bottom:10px}#catalogTab .panel-heading .price-help{display:none}.catalog-manage-tools{margin-bottom:7px}.catalog-manage-tools input{height:40px;font-size:16px}.catalog-manage-list{gap:5px}.catalog-manage-row{grid-template-columns:44px minmax(0,1fr) auto 72px!important;gap:7px!important;min-height:54px;padding:7px 8px!important}.catalog-manage-name{gap:0;min-width:0}.catalog-manage-name b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.catalog-manage-name small{display:none!important}.catalog-visibility{grid-column:auto!important;grid-row:auto!important;gap:5px;font-size:10px;white-space:nowrap}.catalog-visibility input{width:16px;height:16px}.catalog-order-actions{grid-column:auto!important;grid-row:auto!important;gap:4px}.catalog-order-actions button{width:34px;height:34px;padding:0;font-size:16px}.catalog-drag-handle{height:36px;padding:2px 3px}.catalog-drag-handle .catalog-position{width:23px;height:23px;font-size:9px}.catalog-drag-grip{font-size:14px}#catalogTab .price-action-bar{bottom:8px;align-items:center!important;flex-direction:row!important;padding:8px!important;border-radius:12px}#catalogTab .price-action-bar .save-state{display:none}#catalogTab .price-action-bar .save-button{width:100%;min-height:44px}
      }
    `;
    document.head.append(style);
  }
}

function setupPriceCompactUi() {
  if (!pricesTab || document.getElementById('priceCompactStyle')) return;
  const style = document.createElement('style');
  style.id = 'priceCompactStyle';
  style.textContent = `
    #pricesTab .extra-price-list{gap:7px}
    #pricesTab .compact-extra-price{padding:11px 12px;background:#fff}
    #pricesTab .compact-extra-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0}
    #pricesTab .compact-extra-heading>div:first-child{min-width:0}
    #pricesTab .compact-extra-heading b{font-size:12px}
    #pricesTab .compact-extra-heading small{font-size:8px}
    #pricesTab .extra-price-compact-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
    #pricesTab .extra-price-current{font-size:11px;font-weight:900;white-space:nowrap;color:#6c5732}
    #pricesTab .extra-price-edit{min-height:34px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font-size:9px;font-weight:800}
    #pricesTab .compact-extra-price.is-open .extra-price-fields{margin-top:10px}
    #pricesTab .fence-price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    #pricesTab .fence-price-group-title{grid-column:1/-1;display:grid;gap:2px;margin-top:6px;padding:9px 10px;border-radius:10px;background:#f1ede6;color:#463d33}
    #pricesTab .fence-price-group-title:first-child{margin-top:0}
    #pricesTab .fence-price-group-title b{font-size:11px}
    #pricesTab .fence-price-group-title small{color:#81776c;font-size:8px}
    #pricesTab .fence-price-field{display:grid;grid-template-columns:minmax(0,1fr) 130px;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:#fff}
    #pricesTab .fence-price-field>span{display:grid;gap:2px;min-width:0}
    #pricesTab .fence-price-field b{font-size:10px}
    #pricesTab .fence-price-field small{color:var(--muted);font-size:8px}
    #pricesTab .fence-price-field input{width:100%;height:38px;padding:0 9px;border:1px solid var(--line);border-radius:9px;background:#faf9f6;font:inherit;font-size:12px}
    @media(max-width:620px){
      #pricesTab .settings-card{padding:13px}
      #pricesTab .extra-price-list{grid-template-columns:1fr!important}
      #pricesTab .compact-extra-price{padding:9px 10px;border-radius:11px}
      #pricesTab .extra-price-fields{grid-template-columns:1fr!important;gap:7px!important}
      #pricesTab .extra-price-fields input{height:41px!important}
      #pricesTab .extra-price-current{font-size:10px}
      #pricesTab .extra-price-edit{min-height:32px;padding:0 8px}
      #pricesTab .fence-price-grid{grid-template-columns:1fr!important}#pricesTab .fence-price-field{grid-template-columns:minmax(0,1fr) 105px;padding:8px 9px}#pricesTab .fence-price-field input{font-size:16px}
      #pricesTab .price-action-bar{bottom:8px;align-items:center!important;flex-direction:row!important;padding:8px!important;border-radius:12px}
      #pricesTab .price-action-bar .save-state{display:none}
      #pricesTab .price-action-bar .save-button{width:100%;min-height:44px}
    }
  `;
  document.head.append(style);
}

function moveCatalogItem(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= catalogDraft.length) return;
  [catalogDraft[index], catalogDraft[next]] = [catalogDraft[next], catalogDraft[index]];
  catalogDraft.forEach((item, itemIndex) => { item.order = itemIndex + 1; });
  setCatalogDirty();
  renderCatalogManagement();
}

function renderPrices() {
  if (!priceSettings) return;
  catalogInstallationInput.value = moneyInputValue(priceSettings.catalogInstallation);
  catalogPostsInput.value = moneyInputValue(priceSettings.catalogPosts);
  renderCatalogPrices();
  renderExtraPrices();
  renderFencePrices();
  normalizeCatalogDraft();
  setupCatalogManagementUi();
  renderCatalogManagement();
  setPriceDirty(false);
  setCatalogDirty(false);
}

async function loadPriceSettings(force = false) {
  if (pricesLoading || (pricesLoaded && !force)) return;
  pricesLoading = true;
  priceSaveState.textContent = 'Загружаем настройки…';
  catalogSaveState.textContent = 'Загружаем каталог…';
  try {
    const data = await api('/api/admin/prices');
    priceSettings = data.prices;
    pricesLoaded = true;
    renderPrices();
  } catch (error) {
    priceSaveState.textContent = 'Не удалось загрузить настройки';
    catalogSaveState.textContent = 'Не удалось загрузить каталог';
    showToast(error.message, true);
  } finally {
    pricesLoading = false;
  }
}

function collectPrices() {
  const catalog = (priceSettings.catalog || []).map(item => ({...item}));
  const extraById = new Map((priceSettings.extraProducts || []).map(item => [item.id, {...item}]));
  extraPriceList.querySelectorAll('[data-extra-id]').forEach(input => {
    const item = extraById.get(input.dataset.extraId);
    if (item) item[input.dataset.extraField] = Number(input.value);
  });

  const fence = {...(priceSettings.fence || {})};
  fencePriceList?.querySelectorAll('[data-fence-key]').forEach(input => {
    fence[input.dataset.fenceKey] = Number(input.value);
  });

  return {
    ...priceSettings,
    catalogInstallation: Number(catalogInstallationInput.value),
    catalogPosts: Number(catalogPostsInput.value),
    catalog,
    extraProducts: [...extraById.values()],
    fence
  };
}

function collectCatalogSettings() {
  const byArt = new Map((priceSettings.catalog || []).map(item => [item.art, {...item}]));
  catalogDraft.forEach((draftItem, index) => {
    const item = byArt.get(draftItem.art);
    if (!item) return;
    item.visible = draftItem.visible !== false;
    item.order = index + 1;
  });
  return {...priceSettings, catalog: [...byArt.values()]};
}

function currentAdminTab() {
  return adminTabs.find(button => button.classList.contains('active'))?.dataset.adminTab || 'photos';
}

function switchAdminTab(name) {
  photosTab.hidden = name !== 'photos';
  pricesTab.hidden = name !== 'prices';
  catalogTab.hidden = name !== 'catalog';
  adminTabs.forEach(button => button.classList.toggle('active', button.dataset.adminTab === name));
  if (name === 'prices' || name === 'catalog') loadPriceSettings();
}

adminTabs.forEach(button => button.addEventListener('click', () => {
  const target = button.dataset.adminTab;
  const current = currentAdminTab();
  if (current === target) return;
  if (dirty) {
    showToast('Сначала сохраните изменения фотографий', true);
    return;
  }
  if (priceDirty) {
    showToast('Сначала сохраните изменения настроек', true);
    return;
  }
  if (catalogDirty) {
    showToast('Сначала сохраните изменения каталога', true);
    return;
  }
  switchAdminTab(target);
}));

catalogInstallationInput?.addEventListener('input', () => setPriceDirty());
catalogPostsInput?.addEventListener('input', () => setPriceDirty());
setupCatalogManagementUi();
setupPriceCompactUi();
if (catalogActionBar) catalogActionBar.hidden = true;
if (priceActionBar) priceActionBar.hidden = true;

priceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!priceSettings || !priceDirty) return;
  savePricesButton.disabled = true;
  savePricesButton.textContent = 'Сохраняем…';
  try {
    const data = await api('/api/admin/prices', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({prices: collectPrices()})
    });
    priceSettings = data.prices;
    renderPrices();
    showToast('Настройки опубликованы на сайте');
  } catch (error) {
    setPriceDirty(true);
    showToast(error.message, true);
  } finally {
    savePricesButton.textContent = 'Сохранить настройки';
    savePricesButton.disabled = !priceDirty;
  }
});

saveCatalogButton?.addEventListener('click', async () => {
  if (!priceSettings || !catalogDirty) return;
  saveCatalogButton.disabled = true;
  saveCatalogButton.textContent = 'Сохраняем…';
  try {
    const data = await api('/api/admin/prices', {
      method: 'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({prices: collectCatalogSettings()})
    });
    priceSettings = data.prices;
    renderPrices();
    showToast('Каталог опубликован на сайте');
  } catch (error) {
    setCatalogDirty(true);
    showToast(error.message, true);
  } finally {
    saveCatalogButton.textContent = 'Сохранить каталог';
    saveCatalogButton.disabled = !catalogDirty;
  }
});

window.addEventListener('beforeunload', event => {
  if (!priceDirty && !catalogDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
