import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

async function startNewSurvey(page) {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, тест V3');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
}

test('V3: begin survey, show 3 direct calculators, gate saves back to same survey, client view returns', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await startNewSurvey(page);
  await expect(page.locator('.v3-product-tile')).toHaveCount(3);
  await expect(page.locator('.v3-product-tile').nth(0)).toContainText('Ворота и калитки');
  await expect(page.locator('.v3-product-tile').nth(1)).toContainText('Забор');
  await expect(page.locator('.v3-product-tile').nth(2)).toContainText('Навес');
  await expect(page.locator('.v3-extra')).not.toHaveAttribute('open');
  await page.locator('[data-v3-calc="gates"]').click();
  await expect(page).toHaveURL(/surveyor=1/);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page.locator('#catalog')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.KUZDVOR_GATE_APP?.snapshot), null, {timeout:15000});
  await page.locator('#kdSurveyorBridgeSave').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/, {waitUntil:'domcontentloaded', timeout:45000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.v3-preview-bar')).toContainText('₽');
  await page.locator('[data-v3-preview]').click();
  await expect(page.locator('#customerPreviewDialog')).toBeVisible();
  await expect(page.locator('#customerPreviewContent')).toContainText('Ворота с калиткой');
  await expect(page.locator('#customerPreviewContent')).toContainText('₽');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Себестоимость');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Прибыль');
  await page.locator('#closeCustomerPreviewBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('V3: shortcut for fence and canopy opens their real calculators', async ({page}) => {
  await startNewSurvey(page);
  await page.locator('[data-v3-calc="fence"]').click();
  await expect(page).toHaveURL(/\/evroshtaketnik\//);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculator')).toBeVisible();
  await page.locator('#kdSurveyorBridgeBack').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-v3-calc="canopy"]').click();
  await expect(page).toHaveURL(/\/naves\//);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page.locator('.workspace')).toBeVisible();
});


test('V3: find surveys instantly by phone, address or number without losing local drafts', async ({page}) => {
  await startNewSurvey(page);
  const number = (await page.locator('#detailsNumber').textContent()).trim();
  await page.locator('#closeDetailsBtn').click();
  await expect(page.locator('.survey-card')).toHaveCount(1);
  const search = page.locator('#surveySearch');
  await search.fill('несуществующий адрес');
  await expect(page.locator('.survey-card')).toHaveCount(0);
  await expect(page.locator('#surveyEmpty')).toContainText('По вашему запросу ничего нет');
  await search.fill('89370000000');
  await expect(page.locator('.survey-card')).toHaveCount(1);
  await search.fill('Мелеуз, тест V3');
  await expect(page.locator('.survey-card')).toHaveCount(1);
  await search.fill(number);
  await expect(page.locator('.survey-card')).toHaveCount(1);
  await search.fill('');
  await expect(page.locator('.survey-card')).toHaveCount(1);
});


async function loginWithoutNewSurvey(page) {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
}
async function savedRows(page) {
  return page.evaluate(async () => {
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('kd-surveyor-stage1');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const read=store=>new Promise((resolve,reject)=>{
      const request=db.transaction(store).objectStore(store).getAll();
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const result={surveys:await read('surveys'),clients:await read('clients')};
    db.close();
    return result;
  });
}

test('empty phone and address: two independent numbered surveys, open and edit later', async ({page}) => {
  await loginWithoutNewSurvey(page);
  for (let n=1;n<=2;n++) {
    await page.locator('#newSurveyBtn').click();
    await expect(page.locator('#surveyClientPhone')).not.toHaveAttribute('required');
    await expect(page.locator('#surveyAddress')).not.toHaveAttribute('required');
    await expect(page.locator('#surveyStep1')).toContainText('можно оставить пустыми');
    await page.locator('#saveSurveyBtn').click();
    await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
    await expect(page.locator('#detailsNumber')).toHaveText('ЗМ-'+String(n).padStart(4,'0'));
    await expect(page.locator('#surveyDetailsContent')).toContainText('Адрес пока не указан');
    await expect(page.locator('#surveyDetailsContent')).toContainText('Телефон пока не указан');
    await expect(page.locator('.v3-product-tile')).toHaveCount(3);
    await page.locator('#closeDetailsBtn').click();
  }
  const result=await savedRows(page);
  expect(result.surveys).toHaveLength(2);
  expect(result.clients).toHaveLength(0);
  expect(result.surveys[0].id).not.toBe(result.surveys[1].id);
  expect(result.surveys.every(x=>x.clientId==='' && x.clientPhone==='' && x.address==='')).toBe(true);
  await expect(page.locator('.survey-card')).toHaveCount(2);
  await expect(page.locator('.survey-card').first()).toContainText('Контакт не указан');
  await page.locator('.survey-card').first().locator('[data-open-survey]').click();
  await page.locator('[data-edit-survey-data]').click();
  await page.locator('#surveyDataName').fill('Новый клиент');
  await page.locator('#surveyDataPhone').fill('89371234567');
  await page.locator('#surveyDataAddress').fill('Мелеуз');
  await page.locator('#saveSurveyDataBtn').click();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Мелеуз');
  await expect(page.locator('#surveyDetailsContent')).toContainText('+7 937 123-45-67');
  const edited=await savedRows(page);
  expect(edited.clients).toHaveLength(1);
  expect(edited.surveys.filter(x=>!x.clientId)).toHaveLength(1);
  expect(edited.surveys.filter(x=>x.clientId)).toHaveLength(1);
});

test('address-only survey allows saving, later editing without phone', async ({page}) => {
  await loginWithoutNewSurvey(page);
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyAddress').fill('Стерлитамак');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Стерлитамак');
  await page.locator('[data-edit-survey-data]').click();
  await page.locator('#surveyDataAddress').fill('Ишимбай');
  await page.locator('#saveSurveyDataBtn').click();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Ишимбай');
  const result=await savedRows(page);
  expect(result.clients).toHaveLength(0);
  expect(result.surveys[0].address).toBe('Ишимбай');
  expect(result.surveys[0].clientPhone).toBe('');
});

test('phone-only survey saves, and incomplete phone is rejected without creating records', async ({page}) => {
  await loginWithoutNewSurvey(page);
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('+7 937');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).not.toBeVisible();
  expect((await savedRows(page)).surveys).toHaveLength(0);
  await page.locator('#surveyClientPhone').fill('89371234567');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('+7 937 123-45-67');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Адрес пока не указан');
  const result=await savedRows(page);
  expect(result.clients).toHaveLength(1);
  expect(result.surveys[0].address).toBe('');
  expect(result.surveys[0].clientId).toBe(result.clients[0].id);
});
