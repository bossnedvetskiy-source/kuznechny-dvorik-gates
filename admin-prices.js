const adminTabs = [...document.querySelectorAll('[data-admin-tab]')];
const photosTab = document.getElementById('photosTab');
const pricesTab = document.getElementById('pricesTab');
const priceForm = document.getElementById('priceForm');
const catalogInstallationInput = document.getElementById('catalogInstallationInput');
const catalogPostsInput = document.getElementById('catalogPostsInput');
const catalogPriceList = document.getElementById('catalogPriceList');
const extraPriceList = document.getElementById('extraPriceList');
const priceSaveState = document.getElementById('priceSaveState');
const savePricesButton = document.getElementById('savePricesButton');

let priceSettings = null;
let priceDirty = false;
let pricesLoaded = false;
let pricesLoading = false;

function moneyInputValue(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? String(number) : '0';
}

function setPriceDirty(value = true) {
  priceDirty = value;
  savePricesButton.disabled = !value;
  priceSaveState.textContent = value ? 'Есть несохранённые изменения' : 'Все цены сохранены';
  priceSaveState.classList.toggle('dirty', value);
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
  catalogPriceList.replaceChildren();
  for (const item of priceSettings.catalog || []) {
    const row = document.createElement('label');
    row.className = 'catalog-price-row';

    const title = document.createElement('span');
    title.className = 'price-item-title';
    title.innerHTML = `<b>${item.art}</b><small>Цена изделия</small>`;

    const input = createMoneyInput(item.price, {priceArt: item.art});
    row.append(title, input);
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

function renderPrices() {
  if (!priceSettings) return;
  catalogInstallationInput.value = moneyInputValue(priceSettings.catalogInstallation);
  catalogPostsInput.value = moneyInputValue(priceSettings.catalogPosts);
  renderCatalogPrices();
  renderExtraPrices();
  setPriceDirty(false);
}

async function loadPriceSettings(force = false) {
  if (pricesLoading || (pricesLoaded && !force)) return;
  pricesLoading = true;
  priceSaveState.textContent = 'Загружаем цены…';
  try {
    const data = await api('/api/admin/prices');
    priceSettings = data.prices;
    pricesLoaded = true;
    renderPrices();
  } catch (error) {
    priceSaveState.textContent = 'Не удалось загрузить цены';
    showToast(error.message, true);
  } finally {
    pricesLoading = false;
  }
}

function collectPrices() {
  const catalogByArt = new Map((priceSettings.catalog || []).map(item => [item.art, {...item}]));
  catalogPriceList.querySelectorAll('[data-price-art]').forEach(input => {
    const item = catalogByArt.get(input.dataset.priceArt);
    if (item) item.price = Number(input.value);
  });

  const extraById = new Map((priceSettings.extraProducts || []).map(item => [item.id, {...item}]));
  extraPriceList.querySelectorAll('[data-extra-id]').forEach(input => {
    const item = extraById.get(input.dataset.extraId);
    if (item) item[input.dataset.extraField] = Number(input.value);
  });

  return {
    ...priceSettings,
    catalogInstallation: Number(catalogInstallationInput.value),
    catalogPosts: Number(catalogPostsInput.value),
    catalog: [...catalogByArt.values()],
    extraProducts: [...extraById.values()]
  };
}

function switchAdminTab(name) {
  const nextIsPrices = name === 'prices';
  photosTab.hidden = nextIsPrices;
  pricesTab.hidden = !nextIsPrices;
  adminTabs.forEach(button => button.classList.toggle('active', button.dataset.adminTab === name));
  if (nextIsPrices) loadPriceSettings();
}

adminTabs.forEach(button => button.addEventListener('click', () => {
  if (button.dataset.adminTab === 'prices' && dirty) {
    showToast('Сначала сохраните изменения фотографий', true);
    return;
  }
  if (button.dataset.adminTab === 'photos' && priceDirty) {
    showToast('Сначала сохраните изменения цен', true);
    return;
  }
  switchAdminTab(button.dataset.adminTab);
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
    showToast('Цены опубликованы на сайте');
  } catch (error) {
    setPriceDirty(true);
    showToast(error.message, true);
  } finally {
    savePricesButton.textContent = 'Сохранить цены';
    savePricesButton.disabled = !priceDirty;
  }
});

window.addEventListener('admin:ready', () => {
  switchAdminTab('photos');
});

window.addEventListener('beforeunload', event => {
  if (!priceDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
