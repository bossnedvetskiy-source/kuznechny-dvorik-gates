import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openLocationSelector, openMobileAt} from './location-helpers.js';

async function chooseFirstGate(page) {
  await page.locator('.product-card').first().locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
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

test('mobile customer can select Meleuz, choose gates and submit a lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:101,quote:{verified:true,total:submitted.total}})});
  });

  await openMobileAt(page, 'Мелеуз');
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Мелеуз');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
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

test('real color photo follows customer into calculator and lead', async ({page}) => {
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
  const graphite = card.locator('[data-profile-color="graphite"]');
  const mint = card.locator('[data-profile-color="mint"]');
  const colorToggle = card.locator('.profile-color-toggle');

  await expect(card.locator('.profile-color-picker-head strong')).toHaveText('Любой цвет профнастила');
  await expect(colorToggle).toHaveText('Посмотреть цвета');
  await expect(graphite).toBeHidden();
  await colorToggle.click();
  await expect(graphite).toBeVisible();
  await expect(card.locator('.profile-color-note')).toContainText('Цвет можно выбрать позже');
  await expect(graphite).toHaveClass(/is-photo-ready/);

  await graphite.click();
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-28-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeVisible();
  await expect(card.locator('.profile-color-status')).toContainText('Графит');

  await mint.click();
  await expect(card.locator('.profile-color-status')).toContainText('отдельного фото этой модели пока нет');
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-6-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeVisible();
  await expect(mint).toHaveAttribute('aria-pressed','true');

  await graphite.click();
  await card.locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lightboxTitle')).toContainText('Графит');
  await expect(page.locator('#lightboxPrevious')).toBeHidden();
  await expect(page.locator('#lightboxNext')).toBeHidden();
  await page.locator('#lightboxClose').click();

  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
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

test('gate dimensions persist when comparing another design', async ({page}) => {
  await openMobileAt(page, 'Мелеуз');
  await chooseFirstGate(page);
  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();
  await expect(page.locator('#sizeSummaryValue')).toContainText('3,8');
  await page.locator('#changeProductButton').click();

  const secondGate = page.locator('.product-card').nth(1).locator('.select-product');
  await secondGate.scrollIntoViewIfNeeded();
  await secondGate.click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#widthInput')).toHaveValue('3.8');
});

test('explicit delivery tariff is honored after installation place selection', async ({page}) => {
  await openMobileAt(page, 'Уфа');
  await chooseFirstGate(page);

  await expect(page.locator('#deliverySummary')).toBeVisible();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('Доставка уже учтена');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
});

test('unknown destination outside standard area unlocks catalog with individual delivery quote', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Дальнее',resolvedName:'Дальнее, Республика Башкортостан',shortName:'Дальнее',price:null,distanceKm:180,rate:90,serviceAreaKm:150,outOfArea:true})
  }));

  await openMobileAt(page, 'Дальнее');
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Дальнее');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('индивидуально');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Ориентир без доставки');
});

test('unknown destination can be routed and confirmed in installation place modal', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',shortName:'Тестово',price:9000,distanceKm:100,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестово');
  await expect(ui.status).toContainText('Найдено: Тестово');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await ui.action.click();
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Тестово');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('Доставка уже учтена');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
});

test('delivery service error is sanitized in installation place selector and can be retried', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    await route.fulfill({status:502,contentType:'text/html',body:'<!DOCTYPE html><html><body>temporary gateway page</body></html>'});
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестовый посёлок');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Не удалось автоматически рассчитать доставку');
  await expect(ui.status).not.toContainText('Unexpected token');
  await expect(ui.status).not.toContainText('DOCTYPE');
  await expect(ui.status).toContainText('стоимость уточним вручную');
  await expect(ui.action).toHaveText('Повторить расчёт');
  await expect(page.locator('#catalog')).toHaveClass(/location-locked/);
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
});

test('delivery retry recovers in installation place selector when first response is temporary HTML', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({status:503,contentType:'text/html',body:'<!DOCTYPE html><html><body>maintenance</body></html>'});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({shortName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',price:9000,distanceKm:100,serviceAreaKm:150,outOfArea:false})});
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестово');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Найдено: Тестово');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await ui.action.click();
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
});
