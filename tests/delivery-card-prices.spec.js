import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openLocationSelector, selectInstallationPlace} from './location-helpers.js';

async function openFirstGate(page, place='Мелеуз') {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const card = await selectInstallationPlace(page, place);
  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.KUZDVOR_FORMULA_PRICE_SYNC_READY === true)).toBe(true);
  return card;
}

test('catalog card price immediately includes a known delivery tariff', async ({page}) => {
  const card = await openFirstGate(page, 'Уфа');
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('82 600 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('107 600 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Уфа');
});

test('routed village is confirmed before catalog opens and keeps district in card prices', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Ишеево');
  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
  await ui.action.click();

  const card = page.locator('#catalogGrid .product-card').first();
  await expect(card).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.KUZDVOR_FORMULA_PRICE_SYNC_READY === true)).toBe(true);
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 200 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 200 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Ишеево, Ишимбайский район');

  await card.evaluate(node => {
    const prices = node.querySelectorAll('.price-row strong');
    prices[0].textContent = '64 600 ₽';
    prices[1].textContent = '89 600 ₽';
  });
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 200 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 200 ₽');
  await page.waitForTimeout(1300);
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 200 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 200 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Ишеево, Ишимбайский район');
});

test('mobile installation place input uses search keyboard and Enter starts delivery calculation', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await openLocationSelector(page);
  await expect(ui.input).toHaveAttribute('enterkeyhint','search');
  await ui.input.fill('Ишеево');
  await ui.input.press('Enter');
  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
});
