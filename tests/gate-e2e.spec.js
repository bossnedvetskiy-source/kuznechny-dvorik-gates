import {test, expect} from '@playwright/test';

async function openMobile(page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
}

async function chooseFirstGate(page) {
  await page.locator('.select-product').first().click();
  await expect(page.locator('#calculator')).toBeVisible();
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
  await page.locator('#sendButton').click();

  await expect(page.locator('#successModal')).toBeVisible();
  expect(submitted).toBeTruthy();
  expect(submitted.category).toBe('gates');
  expect(submitted.city).toBe('Мелеуз');
  expect(submitted.website).toBe('');
  expect(submitted.install).toBe(true);
  expect(submitted.total).toBeGreaterThan(0);
});

test('gate dimensions persist when comparing another design', async ({page}) => {
  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();
  await expect(page.locator('#sizeSummaryValue')).toContainText('3,8');
  await page.locator('#changeProductButton').click();
  await page.locator('.select-product').nth(1).click();
  await expect(page.locator('#widthInput')).toHaveValue('3.8');
});

test('fixed destination outside 150 km becomes an individual delivery quote', async ({page}) => {
  await openMobile(page);
  await chooseFirstGate(page);
  await page.locator('[data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Уфа');

  await expect(page.locator('#deliverySummary')).toBeVisible();
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
