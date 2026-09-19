import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openMobileAt, selectInstallationPlace} from './location-helpers.js';

async function chooseFirstGate(page) {
  const card = page.locator('#catalogGrid .product-card').first();
  await expect(card).toBeVisible();
  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  return card;
}

async function revealGate(page, article) {
  const card = page.locator('.product-card').filter({hasText:article}).first();
  for (let attempt=0; attempt<10 && await card.count()===0; attempt+=1) {
    const more = page.locator('#showMoreButton');
    if (await more.isHidden()) break;
    await more.click();
  }
  await expect(card).toBeVisible();
  return card;
}

const rubles = text => Number(String(text || '').replace(/[^\d]/g,''));

test('catalog is visible immediately and common order parameters sit before it', async ({page}) => {
  await openMobileAt(page, '');

  const configurator = page.locator('#catalogOrderConfigurator');
  const firstCard = page.locator('#catalogGrid .product-card').first();
  await expect(configurator).toBeVisible();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator('.catalog-primary-quote')).toBeVisible();
  await expect(firstCard.locator('.price-stack')).toBeHidden();
  await expect(firstCard.locator('.select-product')).toHaveText('Выбрать эту модель');
  await expect(page.locator('.catalog-color-global')).toContainText('Любой цвет профнастила');
  await expect(page.locator('#catalog')).not.toHaveClass(/location-locked/);

  await expect(page.locator('#applyCatalogParams')).toBeHidden();
  await expect(configurator).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toBeHidden();
});

test('mobile customer can choose Meleuz, select gates and submit a lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:101,quote:{verified:true,total:submitted.total}})});
  });

  await openMobileAt(page, 'Мелеуз');
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Мелеуз');
  await expect(page.locator('.selected-order-summary')).toContainText('Мелеуз');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('На замер');

  await page.locator('#mobilePrimaryCta').click();
  await expect(page.locator('#leadRequest')).toBeVisible();
  await page.locator('#phoneInput').fill('+7 937 111-22-33');
  await page.locator('#consentInput').check();
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Отправить заявку');
  await page.locator('#mobilePrimaryCta').click();

  await expect(page.locator('#successModal')).toBeVisible();
  expect(submitted).toBeTruthy();
  expect(submitted.category).toBe('gates');
  expect(submitted.city).toBe('Мелеуз');
  expect(submitted.website).toBe('');
  expect(submitted.install).toBe(true);
  expect(submitted.total).toBeGreaterThan(0);
});

test('common dimensions recalculate visible models and persist between designs', async ({page}) => {
  await openMobileAt(page, '');
  const cards = page.locator('#catalogGrid .product-card');
  const firstBefore = rubles(await cards.first().locator('.catalog-primary-quote strong').textContent());

  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();

  await expect.poll(async () => await cards.first().locator('.catalog-primary-quote strong').textContent())
    .not.toContain('Пересчитываем');
  const firstAfter = rubles(await cards.first().locator('.catalog-primary-quote strong').textContent());
  expect(firstAfter).toBeGreaterThan(0);
  expect(firstAfter).not.toBe(firstBefore);

  await cards.nth(1).locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#widthInput')).toHaveValue('3.8');
  await expect(page.locator('.selected-order-summary')).toContainText('3,8');
});

test('new posts are chosen once and included in every catalog quote', async ({page}) => {
  await openMobileAt(page, '');
  const firstPrice = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong');
  const before = rubles(await firstPrice.textContent());

  await page.locator('[data-posts-choice="1"]').click();
  await expect(page.locator('[data-posts-choice="1"]')).toHaveClass(/is-active/);
  await expect.poll(async () => rubles(await firstPrice.textContent())).toBe(before + 25000);

  await expect(page.locator('#applyCatalogParams')).toBeHidden();
});

test('known delivery is included in the single catalog price', async ({page}) => {
  await openMobileAt(page, '');
  await selectInstallationPlace(page, 'Уфа');

  const quote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote');
  await expect(quote.locator('strong')).toHaveText('82 600 ₽');
  await expect(quote.locator('small')).toContainText('доставкой в Уфа');
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
});

test('unknown destination outside standard area keeps catalog visible with individual delivery', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Дальнее',resolvedName:'Дальнее, Республика Башкортостан',shortName:'Дальнее',price:null,distanceKm:180,rate:90,serviceAreaKm:150,outOfArea:true})
  }));

  await openMobileAt(page, '');
  await selectInstallationPlace(page, 'Дальнее');

  const firstCard = page.locator('#catalogGrid .product-card').first();
  await expect(firstCard).toBeVisible();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Дальнее');
  await expect(firstCard.locator('.catalog-primary-quote small')).toContainText('индивидуально');
});

test('delivery service error is sanitized and never hides the catalog', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    await route.fulfill({status:502,contentType:'text/html',body:'<!DOCTYPE html><html><body>temporary gateway page</body></html>'});
  });

  await openMobileAt(page, '');
  const ui = await beginInstallationPlace(page, 'Тестовый посёлок');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Не удалось автоматически рассчитать доставку');
  await expect(ui.status).not.toContainText('Unexpected token');
  await expect(ui.status).not.toContainText('DOCTYPE');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
  await expect(page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote small')).toContainText('доставка уточняется');
});

test('delivery retry recovers after a temporary HTML response without blocking browsing', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({status:503,contentType:'text/html',body:'<!DOCTYPE html><html><body>maintenance</body></html>'});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({shortName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',price:9000,distanceKm:100,serviceAreaKm:150,outOfArea:false})});
  });

  await openMobileAt(page, '');
  const ui = await beginInstallationPlace(page, 'Тестово');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Найдено: Тестово');
  await expect(ui.action).toHaveText('ОК');
  await ui.action.click();
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
  await expect(page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote small')).toContainText('Тестово');
});

test('color selection is available on the selected model and follows the lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/catalog-images', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({galleries:{
      'Арт.6':{photos:['/catalog/art-6-1.webp'],mediaType:'photo',colorPhotos:{graphite:'/catalog/art-28-1.webp'}}
    }})
  }));
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:202,quote:{verified:true,total:submitted.total}})});
  });

  await openMobileAt(page, 'Мелеуз');
  const card = await revealGate(page, 'Арт.6');
  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();

  await page.locator('.selected-color-panel__head button').click();
  const graphite = page.locator('[data-selected-color="graphite"]');
  await expect(graphite).toBeVisible();
  await graphite.click();

  await expect(page.locator('#selectedProductImage')).toHaveAttribute('src', /art-28-1\.webp/);
  await expect(page.locator('#selectedProductCaption')).toContainText('Графит');

  await page.locator('#mobilePrimaryCta').click();
  await page.locator('#phoneInput').fill('+7 937 111-22-33');
  await page.locator('#consentInput').check();
  await page.locator('#mobilePrimaryCta').click();
  await expect(page.locator('#successModal')).toBeVisible();

  expect(submitted).toBeTruthy();
  expect(submitted.city).toBe('Мелеуз');
  expect(submitted.color).toBe('Графит · RAL 7024');
  expect(submitted.configuration.color).toBe('graphite');
  expect(submitted.configuration.colorLabel).toBe('Графит');
  expect(submitted.message).toContain('Предпочитаемый цвет: Графит · RAL 7024');
});
