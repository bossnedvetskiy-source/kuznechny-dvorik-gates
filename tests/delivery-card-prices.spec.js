import {test, expect} from '@playwright/test';

async function openFirstGate(page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const card = page.locator('#catalogGrid .product-card').first();
  await expect(card).toBeVisible();
  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  return card;
}

test('catalog card price immediately includes a known delivery tariff', async ({page}) => {
  const card = await openFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Уфа');

  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа — доставка учтена в итоговой сумме');
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('82 600 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('107 600 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('С учётом доставки в Уфа');
});

test('catalog card price updates after an unknown destination is routed and confirmed', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      requestedName:'Тестово',
      resolvedName:'Тестово, Республика Башкортостан',
      shortName:'Тестово',
      price:9000,
      distanceKm:100,
      rate:90,
      serviceAreaKm:150,
      outOfArea:false
    })
  }));

  const card = await openFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Тестово');
  await page.locator('#routeButton').click();
  await expect(page.locator('#routeButton')).toHaveText('Да, это нужный пункт');
  await page.locator('#routeButton').click();

  await expect(page.locator('#deliverySummaryValue')).toContainText('доставка учтена в итоговой сумме');
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 600 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 600 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('С учётом доставки в Тестово');
});
