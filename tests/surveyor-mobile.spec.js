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
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, тестовый объект');
  await page.locator('#saveSurveyBtn').click();

  const card = page.locator('.survey-card').first();
  await expect(card).toContainText('ЗМ-0001');
  await expect(card).toContainText('+7 937');
  await expect(card).toContainText('Расчётов пока нет');
  await expect(card.locator('[data-quick-calculation]')).toBeVisible();

  await card.locator('[data-open-survey]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Имя не требуется до договора');

  await page.locator('[data-edit-survey-data]').click();
  await expect(page.locator('#surveyDataDialog')).toBeVisible();
  await page.locator('#surveyDataName').fill('Иван Петров');
  await page.locator('#surveyDataPhone').fill('89371234567');
  await page.locator('#surveyDataAddress').fill('Мелеуз, ул. Ленина, 10');
  await page.locator('#surveyDataNote').fill('Позвонить за час');
  await page.locator('#saveSurveyDataBtn').click();

  await expect(page.locator('#surveyDataDialog')).not.toBeVisible();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Иван Петров');
  await expect(page.locator('#surveyDetailsContent')).toContainText('+7 937 123-45-67');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Мелеуз, ул. Ленина, 10');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Позвонить за час');
  await expect(page.locator('[data-survey-work-types]')).toHaveCount(0);
  await expect(page.locator('#surveyDetailsContent')).toContainText('Расчёты / варианты');
  await expect(page.locator('[data-add-calculation]')).toBeVisible();

  const surveyId = await card.getAttribute('data-survey-id');
  expect(surveyId).toBeTruthy();
  await page.evaluate(({surveyId}) => {
    localStorage.setItem('kd-surveyor-transfer-v1', JSON.stringify({
      version:1,
      surveyId,
      calculation:{
        id:'calc_test_gate',
        type:'gates',
        title:'Ворота с калиткой',
        summary:'Арт.6 · 3,4 × 1,8 м',
        total:56600,
        createdAt:new Date().toISOString(),
        payload:{
          article:'Арт.6',
          width:3.4,
          height:1.8,
          wicketWidth:1,
          wicketHeight:1.8,
          posts:true,
          configuration:{article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:true}
        }
      }
    }));
  }, {surveyId});
  await page.reload();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Расчёты / варианты');
  await expect(page.locator('.calculation-card')).toContainText('Ворота с калиткой');
  await expect(page.locator('.calculation-card-price')).toContainText('56');
  await expect(page.locator('[data-survey-work-types]')).toHaveCount(0);

  await page.locator('[data-edit-plan]').click();
  await expect(page.locator('#planDialog')).toBeVisible();
  await expect(page.locator('#planCanvas .plan-part')).toHaveCount(5);
  await expect(page.locator('#planItemsCount')).toHaveText('5');

  const rowHeights = await page.locator('#planItems .plan-item-row').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  expect(Math.max(...rowHeights)).toBeLessThanOrEqual(66);

  const gateRow = page.locator('#planItems [data-select-plan-item]').filter({hasText:'Ворота'}).first();
  await gateRow.click();
  await expect(page.locator('#planEditor')).toBeVisible();
  await expect(page.locator('#planSheetBackdrop')).toBeVisible();
  const editorBox = await page.locator('#planEditor').boundingBox();
  expect(editorBox).not.toBeNull();
  expect(editorBox.height).toBeLessThan(620);
  expect(editorBox.y + editorBox.height).toBeGreaterThan(820);
  await page.locator('#closePlanEditorBtn').click();
  await expect(page.locator('#planEditor')).toBeHidden();
  await expect(page.locator('#planSheetBackdrop')).toBeHidden();

  // Insert a fence span between the middle post and wicket.
  await page.locator('[data-plan-insert="3"]').click();
  await expect(page.locator('#insertPanel')).toBeVisible();
  await expect(page.locator('#planSheetBackdrop')).toBeVisible();
  await page.locator('[data-add-plan-item="fence"]').click();
  await expect(page.locator('#planEditor')).toBeVisible();
  await page.locator('[data-plan-field="width"]').fill('1.7');
  await page.locator('[data-plan-field="width"]').blur();
  await page.locator('[data-plan-field="material"]').selectOption('euro_vertical');
  await page.locator('#closePlanEditorBtn').click();
  await expect(page.locator('#savePlanBtn')).toBeVisible();
  await page.locator('#savePlanBtn').click();

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.plan-mini-preview')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('6,1 м');

  await page.locator('[data-complete-survey]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Готов');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Замер завершён');
  await page.locator('#closeDetailsBtn').click();

  await expect(page.locator('.survey-card').first().locator('.status-pill')).toContainText('Готов');
  await page.locator('[data-survey-filter="ready"]').click();
  await expect(page.locator('.survey-card')).toHaveCount(1);
  await page.locator('[data-survey-filter="all"]').click();

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
  await expect(page.locator('.survey-card').first()).toContainText('Иван Петров');
  await expect(page.locator('.survey-card').first()).toContainText('ул. Ленина, 10');
  await expect(page.locator('#networkBadge')).toContainText('Офлайн');

  await page.locator('.survey-card').first().locator('[data-open-survey]').click();
  await expect(page.locator('.plan-mini-preview')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('+7 937 123-45-67');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Позвонить за час');
  await expect(page.locator('#surveyDetailsContent')).toContainText('6,1 м');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Замер завершён');
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
