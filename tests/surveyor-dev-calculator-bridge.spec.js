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
