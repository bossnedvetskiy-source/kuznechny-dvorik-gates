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
  if (!notes.length || notes.some(text => !text.includes(`С учётом доставки в ${city}`))) {
    throw new Error(`${label} delivery note mismatch: ${JSON.stringify(notes)}`);
  }
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
  await page.waitForSelector('#catalogGrid .product-card', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => window.GATE_PAGE_API && document.querySelectorAll('#catalogGrid .product-card').length >= 2, null, { timeout: 15000 });

  const before = await readInstalledPrices(page);
  if (before.length < 2 || before.some(value => value <= 0)) {
    throw new Error(`Bad initial catalog prices: ${JSON.stringify(before)}`);
  }

  await page.locator('#catalogGrid .product-card').first().locator('.select-product').click();
  await page.waitForSelector('#calculator', { state: 'visible', timeout: 15000 });
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill(city);
  await page.waitForFunction(expectedCity => String(document.querySelector('#deliverySummaryValue')?.textContent || '').includes(expectedCity), city, { timeout: 10000 });

  const assertDeliveryAdded = async label => {
    await page.waitForFunction(({ expected, delta }) => {
      const cards = [...document.querySelectorAll('#catalogGrid .product-card')].slice(0, expected.length);
      return cards.length === expected.length && cards.every((card, index) => {
        const text = String(card.querySelector('.price-row strong')?.textContent || '');
        const current = Number(text.replace(/[^0-9]/g, '')) || 0;
        return current - expected[index] === delta;
      });
    }, { expected: before, delta: expectedDelivery }, { timeout: 10000 });

    const after = await readInstalledPrices(page);
    console.log(`${label}: before=${before.join(',')} after=${after.join(',')} delivery=${expectedDelivery}`);
  };

  await assertDeliveryAdded('delivery-selected');
  await page.waitForTimeout(1800);
  await assertDeliveryAdded('delivery-stable-after-formula-sync');

  await page.evaluate(() => window.GATE_PAGE_API?.closeCalculator?.());
  await page.waitForTimeout(1000);
  await assertDeliveryAdded('delivery-stable-after-calculator-close');
  await assertEveryVisibleCardUsesDelivery(page, 'delivery-all-initial-cards');
  await assertDeliveryNote(page, 'initial-cards');

  const showMore = page.locator('#showMoreButton');
  if (await showMore.isVisible().catch(() => false)) {
    const beforeCount = await page.locator('#catalogGrid .product-card').count();
    await showMore.click();
    await page.waitForFunction(count => document.querySelectorAll('#catalogGrid .product-card').length > count, beforeCount, { timeout: 10000 });
    await assertEveryVisibleCardUsesDelivery(page, 'delivery-after-show-more');
    await assertDeliveryNote(page, 'show-more-cards');
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#catalogGrid .product-card', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(expectedCity => {
    const state = window.GATE_PAGE_API?.deliveryState?.();
    const selected = String(state?.shortName || state?.resolvedName || state?.name || '');
    return ['fixed','calculated'].includes(String(state?.kind || '')) && selected.includes(expectedCity);
  }, city, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await assertEveryVisibleCardUsesDelivery(page, 'delivery-restored-after-reload');
  await assertDeliveryNote(page, 'reloaded-cards');

  if (errors.length) {
    throw new Error(`Browser errors detected: ${errors.join(' | ')}`);
  }

  console.log(`Delivery-price browser smoke passed for ${baseUrl}: ${city}, +${expectedDelivery}; selection, formula sync, catalog expansion and reload are stable.`);
} finally {
  await browser.close();
}
