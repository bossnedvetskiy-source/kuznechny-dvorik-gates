import {test, expect} from '@playwright/test';

async function openMobile(page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
}

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

test('mobile customer can select gates, choose Meleuz and submit a lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:101,quote:{verified:true,total:submitted.total}})});
  });

  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="meleuz"]').click();
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
      'Арт.6':{
        photos:['/catalog/art-6-1.webp'],
        mediaType:'photo',
        colorPhotos:{graphite:'/catalog/art-28-1.webp'}
      }
    }})
  }));
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:202,quote:{verified:true,total:submitted.total}})});
  });

  await openMobile(page);
  const card = await revealGate(page, 'Арт.6');
  const graphite = card.locator('[data-profile-color="graphite"]');
  const mint = card.locator('[data-profile-color="mint"]');
  await expect(graphite).toHaveClass(/is-photo-ready/);

  await graphite.click();
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-28-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeVisible();
  await expect(card.locator('.profile-color-status')).toContainText('Графит');

  await mint.click();
  await expect(card.locator('.profile-color-status')).toContainText('цвет доступен');
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-6-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeHidden();

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

  await page.locator('[data-delivery-choice="meleuz"]').click();
  await page.locator('#mobilePrimaryCta').click();
  await page.locator('#phoneInput').fill('+7 937 111-22-33');
  await page.locator('#consentInput').check();
  await page.locator('#mobilePrimaryCta').click();
  await expect(page.locator('#successModal')).toBeVisible();

  expect(submitted).toBeTruthy();
  expect(submitted.color).toBe('Графит · RAL 7024');
  expect(submitted.configuration.color).toBe('graphite');
  expect(submitted.configuration.colorLabel).toBe('Графит');
  expect(submitted.message).toContain('Предпочитаемый цвет: Графит · RAL 7024');
});

test('gate dimensions persist when comparing another design', async ({page}) => {
  await openMobile(page);
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

test('explicit delivery tariff is honored without inferring distance from its price', async ({page}) => {
  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Уфа');

  await expect(page.locator('#deliverySummary')).toBeVisible();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа — доставка учтена в итоговой сумме');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
});

test('unknown destination outside standard area becomes an individual delivery quote', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      requestedName:'Дальнее',resolvedName:'Дальнее, Республика Башкортостан',shortName:'Дальнее',
      price:null,distanceKm:180,rate:90,serviceAreaKm:150,outOfArea:true
    })
  }));

  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Дальнее');
  await page.locator('#routeButton').click();
  await expect(page.locator('#deliverySummaryValue')).toContainText('индивидуально');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Ориентир без доставки');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
});

test('unknown destination can be routed and confirmed inside the standard area', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      requestedName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',shortName:'Тестово',
      price:9000,distanceKm:100,rate:90,serviceAreaKm:150,outOfArea:false
    })
  }));

  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Тестово');
  await page.locator('#routeButton').click();
  await expect(page.locator('#deliveryResult')).toContainText('Найдено: Тестово');
  await expect(page.locator('#routeButton')).toHaveText('Да, это нужный пункт');
  await page.locator('#routeButton').click();
  await expect(page.locator('#deliverySummaryValue')).toContainText('доставка учтена в итоговой сумме');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
});

test('delivery service error still lets customer request a manual quote', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:502,
    contentType:'application/json',
    body:JSON.stringify({error:'Сервис маршрутов временно недоступен'})
  }));

  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Тестовый посёлок');
  await page.locator('#routeButton').click();
  await expect(page.locator('#deliveryResult')).toContainText('стоимость уточним вручную');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
});
