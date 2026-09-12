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

let priceSettings = null;
let priceDirty = false;
let catalogDirty = false;
let pricesLoaded = false;
let pricesLoading = false;
let catalogDraft = [];

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

function renderCatalogManagement() {
  catalogManageList.replaceChildren();
  catalogDraft.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = `catalog-manage-row${item.visible ? '' : ' is-hidden'}`;

    const position = document.createElement('span');
    position.className = 'catalog-position';
    position.textContent = String(index + 1);

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
    up.title = 'Поднять выше';
    up.disabled = index === 0;
    up.addEventListener('click', () => moveCatalogItem(index, -1));
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'Опустить ниже';
    down.disabled = index === catalogDraft.length - 1;
    down.addEventListener('click', () => moveCatalogItem(index, 1));
    actions.append(up, down);

    row.append(position, name, visibility, actions);
    catalogManageList.append(row);
  });
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
