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
