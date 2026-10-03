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

  await expect.poll(
    () => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration('./'))),
    {timeout:7000}
  ).toBe(true);

  // A service worker starts controlling an already-open page only after the
  // next navigation. Reload once online, then verify a real offline reload.
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)),
    {timeout:7000}
  ).toBe(true);

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});

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


test('surveyor builds an editable fence and gate line', async ({page}) => {
  await page.goto('/surveyor-app/index.html');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();

  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientName').fill('Клиент схема');
  await page.locator('#surveyClientPhone').fill('89371111111');
  await page.locator('#surveyAddress').fill('Мелеуз, линия забора');
  await page.locator('#toSurveyStep2').click();
  await page.locator('input[name="workType"][value="gates"]').check();
  await page.locator('input[name="workType"][value="fence"]').check();
  await page.locator('#saveSurveyBtn').click();

  await page.locator('.survey-card').first().click();
  await page.locator('[data-open-layout]').click();
  await expect(page.locator('#layoutDialog')).toBeVisible();

  await page.locator('[data-add-type="fence"]').click();
  await page.locator('#segmentWidthInput').fill('5000');
  await page.locator('#segmentMaterialInput').selectOption('profsheet');
  await page.locator('#saveSegmentBtn').click();

  const endAdd = page.locator('[data-insert-line]').last();
  await endAdd.click();
  await page.locator('#segmentTypeInput').selectOption('gate');
  await page.locator('#segmentWidthInput').fill('3400');
  await page.locator('#segmentMaterialInput').selectOption('forged');
  await page.locator('#saveSegmentBtn').click();

  await page.locator('[data-insert-line]').last().click();
  await page.locator('#segmentTypeInput').selectOption('wicket');
  await page.locator('#segmentWidthInput').fill('1000');
  await page.locator('#segmentMaterialInput').selectOption('forged');
  await page.locator('#saveSegmentBtn').click();

  const line = page.locator('.layout-line').first();
  await line.locator('[data-line-name]').fill('Фасад');
  await line.locator('[data-line-name]').blur();
  await expect(line).toContainText('Забор');
  await expect(line).toContainText('Ворота');
  await expect(line).toContainText('Калитка');
  await expect(line.locator('[data-line-name]')).toHaveValue('Фасад');
  await expect(line).toContainText('9,4 м');

  const middlePost = line.locator('[data-edit-post]').nth(1);
  await middlePost.click();
  await page.locator('#postKindInput').selectOption('existing');
  await page.locator('#savePostBtn').click();
  await expect(line).toContainText('Существ.');

  await page.locator('#closeLayoutBtn').click();
  await expect(page.locator('#surveyDetailsContent')).toContainText('3 элемента');
  await expect(page.locator('.layout-preview-mini')).toBeVisible();
});
