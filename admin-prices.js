const adminTabs = [...document.querySelectorAll('[data-admin-tab]')];
const photosTab = document.getElementById('photosTab');
const pricesTab = document.getElementById('pricesTab');
const catalogTab = document.getElementById('catalogTab');
const priceForm = document.getElementById('priceForm');
const catalogInstallationInput = document.getElementById('catalogInstallationInput');
const catalogPostsInput = document.getElementById('catalogPostsInput');
const catalogPriceList = document.getElementById('catalogPriceList');
const extraPriceList = document.getElementById('extraPriceList');
const priceSaveState = document.getElementById('priceSaveState');
const savePricesButton = document.getElementById('savePricesButton');
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

function moneyInputValue(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? String(number) : '0';
}

function setPriceDirty(value = true) {
  priceDirty = value;
  savePricesButton.disabled = !value;
  priceSaveState.textContent = value ? 'Есть несохранённые изменения' : 'Настройки сохранены';
  priceSaveState.classList.toggle('dirty', value);
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
    card.className = 'extra-price-card';

    const heading = document.createElement('div');
    heading.className = 'extra-price-heading';
    const headingTitle = document.createElement('div');
    headingTitle.innerHTML = `<b>${item.title || item.art || item.id}</b><small>${item.art || ''}</small>`;
    heading.append(headingTitle);

    const fields = document.createElement('div');
    fields.className = 'extra-price-fields';
    const definitions = [
      ['price', 'Изделие, ₽'],
      ['install', 'Монтаж, ₽'],
      ['posts', 'Столбы, ₽']
    ];
    for (const [field, labelText] of definitions) {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.append(createMoneyInput(item[field] || 0, {extraId: item.id, extraField: field}));
      fields.append(label);
    }

    card.append(heading, fields);
    extraPriceList.append(card);
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

  return {
    ...priceSettings,
    catalogInstallation: Number(catalogInstallationInput.value),
    catalogPosts: Number(catalogPostsInput.value),
    catalog,
    extraProducts: [...extraById.values()]
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
if (catalogActionBar) catalogActionBar.hidden = true;

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
