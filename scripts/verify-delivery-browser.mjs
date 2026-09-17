import { chromium } from '@playwright/test';

const baseUrl = String(process.env.TARGET_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const city = String(process.env.DELIVERY_CITY || 'Салават');
const expectedDelivery = Number(process.env.EXPECTED_DELIVERY || 4500);

if (!Number.isFinite(expectedDelivery) || expectedDelivery < 0) {
  throw new Error(`Invalid EXPECTED_DELIVERY: ${process.env.EXPECTED_DELIVERY || ''}`);
}

const readInstalledPrices = (page, limit = 3) => page.locator('#catalogGrid .product-card').evaluateAll((cards, max) => cards.slice(0, max).map(card => {
  const text = String(card.querySelector('.price-row strong')?.textContent || '');
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}), limit);

const assertEveryVisibleCardUsesDelivery = async (page, label) => {
  await page.waitForFunction(delta => {
    const api = window.GATE_PAGE_API;
    const cards = [...document.querySelectorAll('#catalogGrid .product-card')];
    if (!api?.productById || cards.length < 1) return false;
    return cards.every(card => {
      const product = api.productById(card.dataset.cardProduct);
      const text = String(card.querySelector('.price-row strong')?.textContent || '');
      const shown = Number(text.replace(/[^0-9]/g, '')) || 0;
      return product && shown === Math.round(Number(product.price) + Number(product.install) + delta);
    });
  }, expectedDelivery, { timeout: 10000 });

  const count = await page.locator('#catalogGrid .product-card').count();
  console.log(`${label}: ${count} visible cards include delivery=${expectedDelivery}`);
};

const assertDeliveryNote = async (page, label) => {
  const notes = await page.locator('#catalogGrid .product-card .price-delivery-note').evaluateAll(nodes => nodes.map(node => String(node.textContent || '')));
  const expectedText = `учётом доставки в ${city}`.toLocaleLowerCase('ru-RU');
  if (!notes.length || notes.some(text => !text.toLocaleLowerCase('ru-RU').includes(expectedText))) {
    throw new Error(`${label} delivery note mismatch: ${JSON.stringify(notes)}`);
  }
};

const readOrderProcessSnapshot = page => page.evaluate(() => [...document.querySelectorAll('section')]
  .map(section => ({
    id: String(section.id || ''),
    marked: section.hasAttribute('data-order-process'),
    heading: String(section.querySelector('h2')?.textContent || '').trim(),
    steps: section.querySelectorAll('.order-steps-grid article, article').length
  }))
  .filter(item => /^(Как проходит заказ|Что будет после заявки)$/i.test(item.heading)));

const assertSingleOrderProcess = async (page, label) => {
  await page.waitForTimeout(1400);
  const snapshot = await readOrderProcessSnapshot(page);
  console.log(`${label} order-process snapshot: ${JSON.stringify(snapshot)}`);
  if (snapshot.length !== 1 || snapshot[0].steps !== 5) {
    throw new Error(`${label} order process mismatch: ${JSON.stringify(snapshot)}`);
  }
  console.log(`${label}: one 5-step order process section is present (${snapshot[0].heading}).`);
};

const selectInstallationPlace = async page => {
  const firstCard = page.locator('#catalogGrid .product-card').first();
  if (await firstCard.isVisible().catch(() => false)) return firstCard;

  const modal = page.locator('#catalogLocationGateModal');
  const autoOpened = await modal.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
  if (!autoOpened) {
    const lockButton = page.locator('.catalog-location-lock button');
    if (await lockButton.isVisible().catch(() => false)) await lockButton.evaluate(element => element.click());
    else await page.evaluate(() => document.querySelector('a[href="#catalog"]')?.click());
  }

  await modal.waitFor({ state: 'visible', timeout: 5000 });
  const input = page.locator('#installationLocationInput');
  const action = page.locator('#installationLocationAction');
  await input.fill(city);

  if (!(await firstCard.isVisible().catch(() => false))) {
    await action.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('#installationLocationAction');
      return button && !button.disabled;
    }, null, { timeout: 10000 });
    await action.click();
  }

  if (!(await firstCard.isVisible().catch(() => false)) && await modal.isVisible().catch(() => false)) {
    await page.waitForFunction(() => {
      const button = document.querySelector('#installationLocationAction');
      return button && !button.disabled && /Да, это нужный пункт/.test(String(button.textContent || ''));
    }, null, { timeout: 10000 });
    await action.click();
  }

  await firstCard.waitFor({ state: 'visible', timeout: 10000 });
  return firstCard;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

  await page.goto(`${baseUrl}/?delivery_smoke=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForFunction(() => window.GATE_PAGE_API && document.querySelectorAll('#catalogGrid .product-card').length >= 2, null, { timeout: 15000 });
  await assertSingleOrderProcess(page, 'initial-page');
  const firstCard = await selectInstallationPlace(page);

  await page.waitForFunction(({ expectedCity, delta }) => {
    const state = window.GATE_PAGE_API?.deliveryState?.();
    const selected = String(state?.shortName || state?.resolvedName || state?.name || '');
    return ['fixed','calculated'].includes(String(state?.kind || '')) && selected.includes(expectedCity) && Number(state?.price) === delta;
  }, { expectedCity: city, delta: expectedDelivery }, { timeout: 10000 });

  await assertEveryVisibleCardUsesDelivery(page, 'delivery-location-selected');
  await assertDeliveryNote(page, 'initial-cards');
  const installed = await readInstalledPrices(page);
  if (installed.length < 2 || installed.some(value => value <= expectedDelivery)) {
    throw new Error(`Bad catalog prices after delivery selection: ${JSON.stringify(installed)}`);
  }

  await firstCard.locator('.select-product').click();
  await page.waitForSelector('#calculator', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(expectedCity => String(document.querySelector('#deliverySummaryValue')?.textContent || '').includes(expectedCity), city, { timeout: 10000 });
  await page.waitForTimeout(1300);
  await assertEveryVisibleCardUsesDelivery(page, 'delivery-stable-after-formula-sync');

  await page.evaluate(() => window.GATE_PAGE_API?.closeCalculator?.());
  await page.waitForTimeout(700);
  await assertEveryVisibleCardUsesDelivery(page, 'delivery-stable-after-calculator-close');
  await assertDeliveryNote(page, 'calculator-close-cards');

  const showMore = page.locator('#showMoreButton');
  if (await showMore.isVisible().catch(() => false)) {
    const beforeCount = await page.locator('#catalogGrid .product-card').count();
    await showMore.click();
    await page.waitForFunction(count => document.querySelectorAll('#catalogGrid .product-card').length > count, beforeCount, { timeout: 10000 });
    await assertEveryVisibleCardUsesDelivery(page, 'delivery-after-show-more');
    await assertDeliveryNote(page, 'show-more-cards');
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(expectedCity => {
    const state = window.GATE_PAGE_API?.deliveryState?.();
    const selected = String(state?.shortName || state?.resolvedName || state?.name || '');
    return ['fixed','calculated'].includes(String(state?.kind || '')) && selected.includes(expectedCity);
  }, city, { timeout: 15000 });
  await page.waitForSelector('#catalogGrid .product-card', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  await assertSingleOrderProcess(page, 'reloaded-page');
  await assertEveryVisibleCardUsesDelivery(page, 'delivery-restored-after-reload');
  await assertDeliveryNote(page, 'reloaded-cards');

  if (errors.length) {
    throw new Error(`Browser errors detected: ${errors.join(' | ')}`);
  }

  console.log(`Delivery-price browser smoke passed for ${baseUrl}: ${city}, +${expectedDelivery}; location-first selection, single order process, formula sync, catalog expansion and reload are stable.`);
} finally {
  await browser.close();
}
