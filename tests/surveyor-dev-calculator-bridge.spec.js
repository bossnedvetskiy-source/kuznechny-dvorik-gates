import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('gate calculator result returns into the same survey card', async ({page}) => {
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

  await page.locator('.survey-card').first().click();
  await page.locator('[data-add-calculation]').click();
  await expect(page.locator('#calculationPickerDialog')).toBeVisible();
  await page.locator('[data-launch-calculation="gates"]').click();

  await expect(page).toHaveURL(/surveyor=1/);
  await expect(page.locator('#kdSurveyorBridge')).toBeVisible({timeout:15000});
  await expect(page).toHaveTitle(/КД Замерщик · Ворота/);
  await expect(page.locator('#catalog')).toBeVisible();
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('.package')).toBeHidden();
  await expect(page.locator('#sendButton')).toBeHidden();
  await page.waitForFunction(() => Boolean(window.KUZDVOR_GATE_APP?.snapshot), null, {timeout:15000});

  await page.locator('#kdSurveyorBridgeSave').click();
  await expect(page).toHaveURL(/\/dev-tools\/\?resumeSurvey=/, {timeout:15000});

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Ворота с калиткой');
  await expect(page.locator('.calculation-card')).toContainText('Арт.');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');

  await page.locator('#closeDetailsBtn').click();
  await expect(page.locator('.survey-card-total').first()).toContainText('₽');
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
  await page.locator('.survey-card').first().click();
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
  await expect(page).toHaveURL(/\/dev-tools\/\?resumeSurvey=/, {timeout:15000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Забор из евроштакетника');
  await expect(page.locator('.calculation-card')).toContainText('10');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');
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
  await expect(page).toHaveURL(/\/dev-tools\/\?resumeSurvey=/, {timeout:15000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible({timeout:15000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Навес');
  await expect(page.locator('.calculation-card')).toContainText('3 × 5.9');
  await expect(page.locator('.calculation-card-price')).toContainText('₽');
});
