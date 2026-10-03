import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('surveyor can create a mixed survey and reopen it offline', async ({page, context}) => {
  await page.goto('/surveyor-app/index.html');
  await expect(page).toHaveTitle('КД Замерщик');

  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(page.locator('#mainView')).toBeVisible();
  await expect(page.locator('#teamNavBtn')).toHaveClass(/hidden/);

  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientName').fill('Тестовый клиент');
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, тестовый объект');
  await page.locator('#toSurveyStep2').click();

  await page.locator('input[name="workType"][value="gates"]').check();
  await page.locator('input[name="workType"][value="fence"]').check();
  await page.locator('input[name="workType"][value="canopy"]').check();
  await page.locator('#saveSurveyBtn').click();

  const card = page.locator('.survey-card').first();
  await expect(card).toContainText('ЗМ-0001');
  await expect(card).toContainText('Тестовый клиент');
  await expect(card).toContainText('Ворота');
  await expect(card).toContainText('Забор');
  await expect(card).toContainText('Навес');

  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('#mainView')).toBeVisible();
  await expect(page.locator('.survey-card').first()).toContainText('Тестовый клиент');
  await expect(page.locator('#networkBadge')).toContainText('Офлайн');
});

test('owner can manage employee access', async ({page}) => {
  await page.goto('/surveyor-app/index.html');
  await page.locator('#loginInput').fill('admin');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(page.locator('#teamNavBtn')).not.toHaveClass(/hidden/);
  await page.locator('#teamNavBtn').click();
  await expect(page.locator('#employeeList')).toContainText('Замерщик');
  await expect(page.locator('#employeeList')).toContainText('Собственник');

  await page.locator('#newEmployeeBtn').click();
  await page.locator('#employeeNameInput').fill('Второй замерщик');
  await page.locator('#employeeLoginInput').fill('zamer2');
  await page.locator('#employeePasswordInput').fill('5678');
  await page.locator('#saveEmployeeBtn').click();

  await expect(page.locator('#employeeList')).toContainText('Второй замерщик');
});
