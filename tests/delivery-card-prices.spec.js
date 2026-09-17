import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openLocationSelector, selectInstallationPlace} from './location-helpers.js';

async function openPage(page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:5000});
}

test('catalog card uses one price and immediately includes a known delivery tariff', async ({page}) => {
  await openPage(page);
  const card = page.locator('#catalogGrid .product-card').first();
  await selectInstallationPlace(page, 'Уфа');

  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
  await expect(card.locator('.catalog-primary-quote strong')).toHaveText('82 600 ₽');
  await expect(card.locator('.catalog-primary-quote small')).toContainText('доставкой в Уфа');
  await expect(card.locator('.price-stack')).toBeHidden();
});

test('routed village stays browseable before confirmation and enters price only after confirmation', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await openPage(page);
  const card = page.locator('#catalogGrid .product-card').first();
  const ui = await beginInstallationPlace(page, 'Ишеево');

  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(card).toBeVisible();
  await expect(card.locator('.catalog-primary-quote small')).toContainText('доставка пока не учтена');

  await ui.action.click();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Ишеево, Ишимбайский район');
  await expect(card.locator('.catalog-primary-quote strong')).toHaveText('73 200 ₽');
  await expect(card.locator('.catalog-primary-quote small')).toContainText('Ишеево, Ишимбайский район');
});

test('mobile installation place input uses search keyboard and Enter starts route calculation', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await openPage(page);
  const ui = await openLocationSelector(page);
  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();
  await expect(ui.input).toHaveAttribute('enterkeyhint','search');
  await ui.input.fill('Ишеево');
  await ui.input.press('Enter');

  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
});
