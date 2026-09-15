import { chromium } from '@playwright/test';

const baseUrl = String(process.env.TARGET_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const city = String(process.env.DELIVERY_CITY || 'Салават');
const expectedDelivery = Number(process.env.EXPECTED_DELIVERY || 4500);

if (!Number.isFinite(expectedDelivery) || expectedDelivery < 0) {
  throw new Error(`Invalid EXPECTED_DELIVERY: ${process.env.EXPECTED_DELIVERY || ''}`);
}

const readInstalledPrices = page => page.locator('#catalogGrid .product-card').evaluateAll(cards => cards.slice(0, 3).map(card => {
  const text = String(card.querySelector('.price-row strong')?.textContent || '');
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}));

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

  const notes = await page.locator('#catalogGrid .product-card .price-delivery-note').evaluateAll(nodes => nodes.slice(0, 3).map(node => String(node.textContent || '')));
  if (notes.some(text => !text.includes(`С учётом доставки в ${city}`))) {
    throw new Error(`Delivery note mismatch: ${JSON.stringify(notes)}`);
  }

  if (errors.length) {
    throw new Error(`Browser errors detected: ${errors.join(' | ')}`);
  }

  console.log(`Delivery-price browser smoke passed for ${baseUrl}: ${city}, +${expectedDelivery}.`);
} finally {
  await browser.close();
}
