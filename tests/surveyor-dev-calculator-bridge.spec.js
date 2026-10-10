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

test('owner hands off a canopy survey into fabrication and reissues after a change', async ({page}) => {
  test.setTimeout(90000);
  await page.addInitScript(()=>localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('admin');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();

  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyAddress').fill('Мелеуз, производство арочного навеса');
  await page.locator('#surveyNote').fill('Проверить фундамент перед установкой');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();

  await page.locator('[data-v3-calc="canopy"]').click();
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await page.locator('#widthPosts').fill('3.4');
  await page.locator('#lengthPosts').fill('8.4');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled();
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/,{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('[data-send-canopy-production]')).toHaveText('Передать в производство');
  await expect(page.locator('[data-open-canopy-production]')).toHaveCount(0);

  await page.locator('[data-send-canopy-production]').click();
  await expect(page.locator('.canopy-production-state')).toContainText('ТЗ сформировано');
  await expect(page.locator('[data-open-canopy-production]')).toBeVisible();
  const initial=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('kd-surveyor-stage1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    const all=await new Promise((resolve,reject)=>{
      const req=db.transaction('surveys').objectStore('surveys').getAll();
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    db.close();
    const survey=all.find(x=>x.address==='Мелеуз, производство арочного навеса');
    const job=survey.configuration.productionJobs[0];
    return {surveyId:survey.id,job,calculation:survey.configuration.calculations[0]};
  });
  expect(initial.job.input.widthPostsM).toBe(3.4);
  expect(initial.job.input.lengthM).toBe(8.4);
  expect(initial.job.sourceUpdatedAt).toBe(initial.calculation.updatedAt);
  expect(initial.job).not.toHaveProperty('pricingSnapshot');
  expect(JSON.stringify(initial.job)).not.toMatch(/pricingSnapshot|profit|margin|tube30|rates|weld|ownerMount/);

  await page.locator('[data-open-canopy-production]').click();
  await expect(page).toHaveURL(/\/naves\/admin\.html\?surveyId=/);
  await expect(page.locator('#canopyAdminDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('[data-canopy-panel="production"]')).toBeVisible();
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('Проверить фундамент перед установкой');
  await expect(page.locator('#canopyAdminTrussSvg')).toContainText('D1');
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('3700'); // width in millimetres
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('84 деталей');
  await expect(page.locator('#canopyOrderList')).toContainText('Из карточки замерщика');
  await expect(page.locator('#canopyOrderList')).toContainText('Мелеуз, производство арочного навеса');

  await page.goto('/kuznechny-dvorik-gates/dev-tools/?resumeSurvey='+encodeURIComponent(initial.surveyId));
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await page.locator('.calculation-card-copy').click();
  await expect(page).toHaveURL(/edit=calc_/);
  await page.locator('#lengthPosts').fill('6.2');
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/,{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.canopy-production-state')).toContainText('нужно обновить');
  await expect(page.locator('[data-open-canopy-production]')).toHaveCount(0);
  await expect(page.locator('[data-send-canopy-production]')).toHaveText('Обновить ТЗ');
  await page.locator('[data-send-canopy-production]').click();
  await expect(page.locator('.canopy-production-state')).toContainText('ТЗ сформировано');
  const refreshed=await page.evaluate(async(id)=>{
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('kd-surveyor-stage1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    const survey=await new Promise((resolve,reject)=>{
      const req=db.transaction('surveys').objectStore('surveys').get(id);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    db.close();
    return survey.configuration.productionJobs;
  },initial.surveyId);
  expect(refreshed).toHaveLength(1);
  expect(refreshed[0].input.lengthM).toBe(6.2);
});

test('surveyor cannot dispatch a canopy or open the owner finance admin', async ({page}) => {
  await loginAndCreateSurvey(page,'Мелеуз, замер без финансов');
  await page.locator('[data-launch-calculation="canopy"]').click();
  await page.locator('#widthPosts').fill('3.4');
  await page.locator('#lengthPosts').fill('6.2');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled({timeout:15000});
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/,{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('[data-send-canopy-production]')).toHaveCount(0);
  await expect(page.locator('[data-open-canopy-production]')).toHaveCount(0);
  await page.goto('/naves/admin.html');
  await expect(page.locator('#canopyAdminAccess')).toBeVisible();
  await expect(page.locator('[data-admin-tab="canopy-orders"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Прибыль до налогов');
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


test('surveyor canopy has simple steps and 3D customer presentation without losing quote', async ({page}) => {
  await loginAndCreateSurvey(page, 'Мелеуз, 3D показ клиенту');
  await page.locator('[data-launch-calculation="canopy"]').click();
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});

  const details=page.locator('.kd-canopy-other-types');
  await expect(details).not.toHaveAttribute('open','');
  await expect(page.locator('[data-farm-type="Полуарочный"]')).toBeHidden();
  await expect(page.locator('#widthPosts')).toBeVisible();
  await expect(page.locator('#coverage')).toBeVisible();
  await expect(page.locator('.kd-canopy-step')).toContainText('Размеры');
  await expect(page.locator('[data-canopy-preset="new"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#existingPosts')).toBeHidden();
  await expect(page.locator('.kd-canopy-beams-manual')).toBeHidden();

  await page.locator('#widthPosts').fill('3.6');
  await page.locator('#lengthPosts').fill('6');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeEnabled({timeout:15000});
  const first=await page.locator('#totalPrice').textContent();

  await page.locator('[data-canopy-preset="posts"]').click();
  await expect(page.locator('[data-canopy-preset="posts"]')).toHaveClass(/is-selected/);
  const totalPosts=Number(await page.locator('#existingPosts').inputValue());
  expect(totalPosts).toBeGreaterThan(0);
  await expect(page.locator('#beamsExisting')).not.toBeChecked();

  await page.locator('#kdCanopyPartial').click();
  await expect(page.locator('#existingPosts')).toBeVisible();
  await expect(page.locator('#beamsExisting')).toBeVisible();
  await page.locator('#existingPosts').fill('2');
  await page.locator('#beamsExisting').check();
  await expect(page.locator('#totalPrice')).not.toHaveText(first);

  await page.locator('.kd-canopy-display').click();
  await expect(page.locator('html')).toHaveClass(/kd-canopy-presenting/);
  await expect(page.locator('.client-controls')).toBeHidden();
  await expect(page.locator('#canopyViewport canvas')).toBeVisible();
  await expect(page.locator('#totalPrice')).toBeVisible();
  await expect(page.locator('#kdCanopyPresent')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeHidden();

  await page.locator('#kdCanopyPresent').click();
  await expect(page.locator('html')).not.toHaveClass(/kd-canopy-presenting/);
  await expect(page.locator('#widthPosts')).toBeVisible();
  await expect(page.locator('#widthPosts')).toHaveValue('3.6');
  await expect(page.locator('#existingPosts')).toHaveValue('2');
  await expect(page.locator('#beamsExisting')).toBeChecked();
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeVisible();
  await page.locator('#kdSurveyorBridgeSave').click();

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:45000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card-tags')).toContainText('Арочный');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');
  const surveyCalc=await page.evaluate(async()=>{
    const request=indexedDB.open('kd-surveyor-stage1');
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const all=await new Promise((resolve,reject)=>{
      const tx=db.transaction('surveys').objectStore('surveys').getAll();
      tx.onsuccess=()=>resolve(tx.result);tx.onerror=()=>reject(tx.error);
    });
    db.close();
    return all.at(-1)?.configuration?.calculations?.[0];
  });
  expect(surveyCalc.payload.configuration.canopy).not.toHaveProperty('pricingSnapshot');
  expect(surveyCalc.payload.configuration.canopy.input.widthPostsM).toBe(3.6);
  expect(surveyCalc.payload.configuration.canopy.input.existingPosts).toBe(2);
  expect(surveyCalc.payload.configuration.canopy.input.beamsExisting).toBe(true);
});

test('canopy surveyor: photos and support presets update a real public quote without exposing pricing rates', async ({page}) => {
  await loginAndCreateSurvey(page, 'Мелеуз, тест готовых опор навеса');
  await page.locator('[data-launch-calculation="canopy"]').click();
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page.locator('[data-farm-type]')).toHaveCount(7);
  await expect(page.locator('[data-farm-type="Арочный"] .kd-farm-state')).toHaveText('Цена онлайн');
  await expect(page.locator('[data-farm-type="Полуарочный"] .kd-farm-state')).toHaveText('По запросу');
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeDisabled();
  await expect(page.locator('#kdCanopyPresent')).toBeDisabled();

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
  await page.locator('.kd-canopy-other-types summary').click();
  await page.locator('[data-farm-type="Полуарочный"]').click();
  await expect(page.locator('#kdSurveyorBridgeSave')).toBeDisabled();
  await expect(page.locator('#kdCanopyPresent')).toBeDisabled();
  await page.locator('[data-farm-type="Арочный"]').click();
  await expect(page.locator('#kdCanopyPresent')).toBeEnabled();
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


test('fresh DEV entry reuses existing survey database and launches staff-only gates', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, проверка старого замера');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await expect(page).toHaveTitle(/новая версия/);
  await expect(page.locator('body')).toContainText('НОВАЯ СБОРКА');
  await expect(page.locator('.survey-card')).toHaveCount(1);
  await page.locator('.survey-card').first().click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-add-calculation]').click();
  await page.locator('[data-launch-calculation="gates"]').click();
  await expect(page).toHaveURL(/\/surveyor-gates\/\?surveyor=1/);
  await expect(page.locator('#kdSurveyorBridgeSave')).toHaveText('Добавить в замер');
  await expect(page.locator('#mobileMeasureButton')).toBeHidden();
  await expect(page.locator('.mobile-payment-note')).toBeHidden();
});

test('legacy catalog URL from cached app is redirected into staff-only route', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/?app=1&surveyor=1&survey=sv_legacy');
  await expect(page).toHaveURL(/\/surveyor-gates\/\?/,{timeout:15000});
  await expect(page).toHaveTitle('КД Замерщик · Ворота');
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible();
  await expect(page.locator('#mobileMeasureButton')).toBeHidden();
});


test('fresh surveyor app displays downloaded canopy thumbnail and fallback online', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1', '1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, проверка изображения навеса');
  await page.locator('#saveSurveyBtn').click();
  const photo = page.locator('[data-v3-calc="canopy"] img');
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(el => el.complete && el.naturalWidth > 0),{timeout:15000}).toBe(true);
  const main = await page.request.get('/kuznechny-dvorik-gates/naves/farm-icons/original-farms.webp');
  const backup = await page.request.get('/kuznechny-dvorik-gates/naves/farm-icons/icon-arched.jpg');
  expect(main.ok()).toBe(true);
  expect(backup.ok()).toBe(true);
});


test('fence reset clears four sections and delivery after confirmation, preserves saved quote', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/evroshtaketnik/?surveyor=1&survey=sv_reset-a');
  await page.evaluate(() => window.KUZDVOR_FENCE_APP.ready);
  await page.locator('[data-field="length"][data-index="0"]').fill('13');
  await page.locator('#addSection').click();
  await page.locator('[data-field="length"][data-index="1"]').fill('9');
  await page.locator('[data-section-card="0"] .section-openings summary').click();
  await page.locator('[data-field="gateOpening"][data-index="0"]').fill('3.4');
  await page.locator('.manual-delivery summary').click();
  await page.locator('#manualDeliveryEnabled').evaluate(el => el.click());
  await page.locator('#manualDelivery').fill('1500');
  await page.locator('.site-conditions summary').click();
  await page.locator('#hasSlope').evaluate(el => el.click());
  await page.locator('[data-type="horizontal-double"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('kuzdvor:picket-draft-v1:survey:sv_reset-a'))),{timeout:6000}).toBe(true);
  await page.evaluate(() => localStorage.setItem('kuzdvor:picket-saved-v1', JSON.stringify({marker:'preserved'})));
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#resetFenceQuote').click();
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('13');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#resetFenceQuote').click();
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('');
  await expect(page.locator('[data-section-card="1"]')).toBeHidden();
  await expect(page.locator('[data-field="gateOpening"][data-index="0"]')).toHaveValue('0');
  await expect(page.locator('[data-field="height"][data-index="0"]')).toHaveValue('1.8');
  await expect(page.locator('#manualDeliveryEnabled')).not.toBeChecked();
  await expect(page.locator('#manualDelivery')).toHaveValue('0');
  await expect(page.locator('#hasSlope')).not.toBeChecked();
  await expect(page.locator('#fenceType')).toHaveValue('vertical-double');
  await expect(page.locator('#totalPrice')).toHaveText('—');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kuzdvor:picket-draft-v1:survey:sv_reset-a')),{timeout:6000}).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kuzdvor:picket-saved-v1')).marker)).toBe('preserved');
  await page.reload();
  await page.evaluate(() => window.KUZDVOR_FENCE_APP.ready);
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('');
});

test('new fence survey does not inherit previous survey draft; previous survey keeps its own work', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/evroshtaketnik/?surveyor=1&survey=sv_unique-a');
  await page.evaluate(() => window.KUZDVOR_FENCE_APP.ready);
  await page.locator('[data-field="length"][data-index="0"]').fill('18');
  await page.locator('#addSection').click();
  await page.locator('[data-field="length"][data-index="1"]').fill('12');
  await expect.poll(() => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('kuzdvor:picket-draft-v1:survey:sv_unique-a') || 'null');
    return data?.sections?.[0]?.length === 18 && data?.sections?.[1]?.length === 12;
  }),{timeout:6000}).toBe(true);
  await page.goto('/kuznechny-dvorik-gates/evroshtaketnik/?surveyor=1&survey=sv_unique-b');
  await page.evaluate(() => window.KUZDVOR_FENCE_APP.ready);
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('');
  await expect(page.locator('[data-section-card="1"]')).toBeHidden();
  await expect(page.locator('#totalPrice')).toHaveText('—');
  await page.locator('[data-field="length"][data-index="0"]').fill('7');
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('kuzdvor:picket-draft-v1:survey:sv_unique-b'))),{timeout:6000}).toBe(true);
  await page.goto('/kuznechny-dvorik-gates/evroshtaketnik/?surveyor=1&survey=sv_unique-a');
  await page.evaluate(() => window.KUZDVOR_FENCE_APP.ready);
  await expect(page.locator('[data-field="length"][data-index="0"]')).toHaveValue('18');
  await expect(page.locator('[data-field="length"][data-index="1"]')).toHaveValue('12');
  await expect(page.locator('[data-section-card="1"]')).toBeVisible();
});
