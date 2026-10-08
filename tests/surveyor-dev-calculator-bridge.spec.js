import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('gate calculator result returns into the same survey card', async ({page}) => {
  test.setTimeout(90000); // Real gate catalog can take longer on cold mobile navigation.
  await page.addInitScript(() => {
    localStorage.setItem('kuzdvor-dev-access-v1','1');
  });

  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();

  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, тест расчёта');
  await page.locator('#saveSurveyBtn').click();

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-add-calculation]').click();
  await expect(page.locator('#calculationPickerDialog')).toBeVisible();
  await page.locator('[data-launch-calculation="gates"]').click();

  await expect(page).toHaveURL(/\/surveyor-gates\/\?surveyor=1/);
  await expect(page).toHaveURL(/survey=sv_/);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page).toHaveTitle(/КД Замерщик · Ворота/);
  await expect(page.locator('#catalog')).toBeVisible();
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('.package')).toBeHidden();
  await expect(page.locator('#sendButton')).toBeHidden();
  await expect(page.locator('#mobileMeasureButton')).toBeHidden();
  await expect(page.locator('.mobile-payment-note')).toBeHidden();
  await expect(page.locator('.mobile-cta')).toBeHidden();
  await expect(page.locator('#mobilePrimaryCta')).toBeHidden();
  await expect(page.locator('#leadRequest .estimate-top')).toContainText('Расчёт для клиента');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeVisible();
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Добавить в замер');
  await page.waitForFunction(() => Boolean(window.KUZDVOR_GATE_APP?.snapshot), null, {timeout:15000});

  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Ворота с калиткой');
  await expect(page.locator('.calculation-card')).toContainText('Арт.');
  await expect(page.locator('.calculation-card-lines')).toContainText('Ворота 3,4 × 1,8 м');
  await expect(page.locator('.calculation-card-lines')).toContainText('Калитка 1 × 1,8 м');
  await expect(page.locator('.calculation-card-tags')).toContainText('столб');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');

  await page.locator('#closeDetailsBtn').click();
  await expect(page.locator('.survey-card-total').first()).toContainText('₽');

  await page.locator('.survey-card').first().click();
  await page.locator('.calculation-card-copy').click();
  await expect(page).toHaveURL(/edit=calc_/);
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Сохранить изменения');
  await expect(page.locator('#widthInput')).toHaveValue('3.4');
  await expect(page.locator('#heightInput')).toHaveValue('1.8');
  await page.locator('#widthInput').fill('3.6');
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card-lines')).toContainText('Ворота 3,6 × 1,8 м');
});



test('regular DEV gate catalog keeps public ordering UI outside a survey', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/?app=1');
  await expect(page.locator('#catalog')).toBeVisible();
  await expect(page.locator('#kdSurveyorBridge')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/kd-surveyor-gates/);
  await expect(page.locator('#mobileMeasureButton')).not.toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.mobile-payment-note')).toHaveCount(1);
});

async function loginAndCreateSurvey(page, address) {
  await page.addInitScript(() => {
    localStorage.setItem('kuzdvor-dev-access-v1','1');
  });
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill(address);
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-add-calculation]').click();
}

test('fence calculator result returns into the same survey card', async ({page}) => {
  await loginAndCreateSurvey(page, 'Мелеуз, тест забора');
  await page.locator('[data-launch-calculation="fence"]').click();

  await expect(page).toHaveURL(/\/evroshtaketnik\//);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page).toHaveTitle(/КД Замерщик · Евроштакетник/);
  await expect(page.locator('.calculator')).toBeVisible();
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('#leadSection')).toBeHidden();
  await expect(page.locator('#resultLeadButton')).toBeHidden();
  await page.locator('[data-field="length"][data-index="0"]').fill('10');
  await page.waitForFunction(() => {
    const text = document.querySelector('#totalPrice')?.textContent || '';
    return text.includes('₽') && !text.startsWith('0');
  });
  await page.waitForFunction(() => Boolean(window.KUZDVOR_FENCE_APP?.snapshot), null, {timeout:15000});

  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Забор из евроштакетника');
  await expect(page.locator('.calculation-card img')).toHaveAttribute('src', /fence-double-brown-20260927\.webp/);
  await expect(page.locator('.calculation-card-lines')).toContainText('Длина 10 м');
  await expect(page.locator('.calculation-card-tags')).toContainText('Вертикальный');
  await expect(page.locator('.calculation-card-tags')).toContainText('прол');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');

  await page.locator('.calculation-card-copy').click();
  await expect(page).toHaveURL(/edit=calc_/);
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Сохранить изменения');
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('10');
  await page.locator('[data-field="length"][data-index="0"]').fill('12');
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card-lines')).toContainText('Длина 12 м');
});

test('canopy calculator result returns into the same survey card', async ({page}) => {
  await loginAndCreateSurvey(page, 'Мелеуз, тест навеса');
  await page.locator('[data-launch-calculation="canopy"]').click();

  await expect(page).toHaveURL(/\/naves\//);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page).toHaveTitle(/КД Замерщик · Навес/);
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('#showSave')).toBeHidden();
  await expect(page.locator('.client-info-strip')).toBeHidden();
  await page.locator('#widthPosts').fill('3');
  await page.locator('#lengthPosts').fill('5.9');
  await page.waitForFunction(() => {
    const text = document.querySelector('#totalPrice')?.textContent || '';
    return text.includes('₽') && !text.startsWith('0');
  });
  await page.waitForFunction(() => Boolean(window.TrussApp?.snapshot), null, {timeout:15000});

  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Навес');
  await expect(page.locator('.calculation-card img.canopy-farm-photo')).toHaveAttribute('src', /naves\/farm-icons\/icon-arched\.jpg$/);
  await expect(page.locator('.calculation-card-lines')).toContainText('Размер 3 × 5,9 м');
  await expect(page.locator('.calculation-card-lines')).toContainText('ферма');
  await expect(page.locator('.calculation-card-tags')).toContainText('Арочный');
  await expect(page.locator('.calculation-card-tags')).toContainText('Поликарбонат');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');

  await page.locator('.calculation-card-copy').click();
  await expect(page).toHaveURL(/edit=calc_/);
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Сохранить изменения');
  await expect(page.locator('#widthPosts')).toHaveValue('3');
  await expect(page.locator('#lengthPosts')).toHaveValue('5.9');
  await page.locator('#lengthPosts').fill('6.2');
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card-lines')).toContainText('Размер 3 × 6,2 м');
});


for (const [type, file] of [
  ['vertical-single', 'fence-single-gray-20260927.webp'],
  ['horizontal-double', 'fence-horizontal-real.webp']
]) {
  test(`fence ${type}: photo and price survive roundtrip, public survey payload only`, async ({page}) => {
    await loginAndCreateSurvey(page, 'Мелеуз, тест ' + type);
    await page.locator('[data-launch-calculation="fence"]').click();
    await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
    await page.locator(`[data-type="${type}"]`).click();
    await page.locator('[data-field="length"][data-index="0"]').fill('9.5');
    await expect(page.locator('#kdSurveyorBridge .kd-copy b')).toContainText('₽');
    await expect(page.locator('#kdSurveyorBridgeMessage')).toContainText('Без доставки');
    await page.locator('#kdSurveyorBridgeSave').click();
    await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
    await expect(page.locator('.calculation-card')).toHaveCount(1);
    await expect(page.locator('.calculation-card img')).toHaveAttribute('src', new RegExp(file.replace('.', '\\.') + '$'));
    await expect(page.locator('.calculation-card-tags')).toContainText('Стоимость без доставки');

    const saved = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('kd-surveyor-stage1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const surveys = await new Promise((resolve, reject) => {
        const request = db.transaction('surveys').objectStore('surveys').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return surveys.at(-1).configuration.calculations[0];
    });
    expect(saved.payload.configuration.fenceType).toBe(type);
    expect(saved.payload.configuration).not.toHaveProperty('costs');
    expect(saved.payload.configuration).not.toHaveProperty('calculationSettings');
    expect(saved.payload.configuration.summary).not.toHaveProperty('tubeStocks');
    expect(saved.image).toContain(file);

    await page.locator('[data-v3-preview]').click();
    await expect(page.locator('.v3-customer-item img')).toHaveAttribute('src', new RegExp(file.replace('.', '\\.') + '$'));
    await expect(page.locator('#customerPreviewContent')).toContainText('Стоимость изделия без доставки. Доставка рассчитывается отдельно.');
    await page.locator('#closeCustomerPreviewBtn').click();
    await page.locator('.calculation-card-copy').click();
    await expect(page.locator('#fenceType')).toHaveValue(type);
    await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('9.5');
  });
}


test('canopy surveyor: photos and support presets update a real public quote without exposing pricing rates', async ({page}) => {
  await loginAndCreateSurvey(page, 'Мелеуз, тест готовых опор навеса');
  await page.locator('[data-launch-calculation="canopy"]').click();
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page.locator('[data-farm-type]')).toHaveCount(7);
  await expect(page.locator('[data-farm-type="Арочный"] .kd-farm-state')).toHaveText('Цена онлайн');
  await expect(page.locator('[data-farm-type="Полуарочный"] .kd-farm-state')).toHaveText('По запросу');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeDisabled();

  await page.locator('#widthPosts').fill('3');
  await page.locator('#lengthPosts').fill('5.9');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled();
  await expect(page.locator('#kdSurveyorBridge .kd-copy b')).toContainText('₽');
  await expect(page.locator('#canopyViewport canvas')).toBeVisible({timeout:15000});
  const before = await page.locator('#totalPrice').textContent();

  await page.locator('[data-canopy-preset="all"]').click();
  await expect(page.locator('#beamsExisting')).toBeChecked();
  const postCount = Number(await page.locator('#existingPosts').inputValue());
  expect(postCount).toBeGreaterThan(0);
  await expect(page.locator('[data-canopy-preset="all"]')).toHaveClass(/is-selected/);
  const after = await page.locator('#totalPrice').textContent();
  expect(after).not.toBe(before);

  await page.locator('#coverage').selectOption('Профнастил');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled();
  await page.locator('[data-farm-type="Полуарочный"]').click();
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeDisabled();
  await page.locator('[data-farm-type="Арочный"]').click();
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled();
  await page.locator('#kdSurveyorBridgeSave').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card img.canopy-farm-photo')).toHaveAttribute('src',/naves\/farm-icons\/icon-arched\.jpg$/);
  await expect(page.locator('.calculation-card-tags')).toContainText('балки уже есть');
  await expect(page.locator('.calculation-card-tags')).toContainText('Профнастил');

  const saved = await page.evaluate(async () => {
    const db = await new Promise((resolve,reject) => {
      const request = indexedDB.open('kd-surveyor-stage1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve,reject) => {
      const request = db.transaction('surveys').objectStore('surveys').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows.at(-1).configuration.calculations[0];
  });
  expect(saved.image).toContain('icon-arched.jpg');
  expect(saved.payload.configuration.canopy).not.toHaveProperty('pricingSnapshot');
  expect(saved.payload.configuration.canopy.input.beamsExisting).toBe(true);
  expect(saved.payload.configuration.canopy.input.existingPosts).toBe(postCount);
  expect(saved.payload.configuration.canopy.input.coverage).toBe('Профнастил');

  await page.locator('[data-v3-preview]').click();
  await expect(page.locator('.v3-customer-item img.canopy-farm-photo')).toHaveAttribute('src',/naves\/farm-icons\/icon-arched\.jpg$/);
  await expect(page.locator('#customerPreviewContent')).toContainText('Стоимость изделия без доставки');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('pricingSnapshot');
  await page.locator('#closeCustomerPreviewBtn').click();
  await page.locator('.calculation-card-copy').click();
  await expect(page.locator('#beamsExisting')).toBeChecked();
  await expect(page.locator('#existingPosts')).toHaveValue(String(postCount));
  await expect(page.locator('#coverage')).toHaveValue('Профнастил');
});


test('staff-only gates route recovers lost URL parameters, never shows client booking', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('kuzdvor-dev-access-v1','1');
    localStorage.setItem('kd-surveyor-active-gates-v1',JSON.stringify({
      version:1,surveyId:'sv_123456',returnTo:'/kuznechny-dvorik-gates/dev-tools/',
      editId:'',createdAt:Date.now()
    }));
  });
  await page.goto('/kuznechny-dvorik-gates/surveyor-gates/');
  await expect(page).toHaveURL(/\/surveyor-gates\/\?surveyor=1&survey=sv_123456/);
  await expect(page).toHaveTitle('КД Замерщик · Ворота');
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible();
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Добавить в замер');
  await expect(page.locator('#mobileMeasureButton')).toBeHidden();
  await expect(page.locator('.mobile-price-breakdown .mobile-measure-button')).toBeHidden();
  await expect(page.locator('.mobile-payment-note')).toBeHidden();
  await expect(page.locator('#sendButton')).toBeHidden();
  await expect(page.locator('.mobile-cta')).toBeHidden();
});

test('staff-only gate entry without survey context returns to app, never the customer catalog', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('kuzdvor-dev-access-v1','1');
    localStorage.removeItem('kd-surveyor-active-gates-v1');
  });
  await page.goto('/kuznechny-dvorik-gates/surveyor-gates/');
  await expect(page).toHaveURL(/\/dev-tools\//,{timeout:15000});
  await expect(page.locator('#mobileMeasureButton')).toHaveCount(0);
});
