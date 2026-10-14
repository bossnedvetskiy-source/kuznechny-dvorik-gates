import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('compact survey card shows all product choices and gold vector icons on mobile', async ({page}) => {
  await page.goto('/surveyor-app/index.html');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  // A first measurement may have neither a phone number nor an address.
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.v3-product-tile')).toHaveCount(3);
  await expect(page.locator('.v3-product-heading')).toContainText('Что хотите рассчитать?');
  await expect(page.locator('.v3-address')).toContainText('Адрес не указан');
  await expect(page.locator('.v3-survey-meta')).toContainText('Контакты не заполнены');
  await expect(page.locator('.calculation-section')).toContainText('Сохранённые расчёты');
  await expect(page.locator('.calculation-section.is-empty')).toBeVisible();
  await expect(page.locator('.calculation-section .calculation-list')).toHaveCount(0);
  await expect(page.locator('[data-add-calculation]')).toHaveCount(0);
  await expect(page.locator('.v3-complete-action')).toBeVisible();
  await expect(page.locator('.v3-extra summary')).toContainText('Схема участка и заметки');
  const measures=await page.evaluate(()=>{
    const selectors=['.v3-details-dialog .sheet-head','.v3-survey-head','.v3-product-section',
      '.v3-product-tile','.calculation-section'];
    const bounds=selectors.map(sel=>document.querySelector(sel)?.getBoundingClientRect());
    const cards=[...document.querySelectorAll('.v3-product-tile')]
      .map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
    const icons=[...document.querySelectorAll('.v3-product-tile .v3-category-icon svg')];
    return {bounds:bounds.map(x=>x&&({top:x.top,bottom:x.bottom})),cards,
      vectorIcons:icons.length===3 && icons.every(svg=>svg.querySelector('path,rect')),
      tilesHaveNoPhotos:document.querySelectorAll('.v3-product-tile img').length===0,
      viewport:innerWidth};
  });
  expect(measures.cards.every(x=>x.height>=84&&x.height<=145)).toBeTruthy();
  expect(measures.cards.every(x=>x.width<=measures.viewport)).toBeTruthy();
  expect(measures.bounds[4].top).toBeLessThan(1050);
  expect(measures.vectorIcons).toBeTruthy();
  expect(measures.tilesHaveNoPhotos).toBeTruthy();
  await expect(page.locator('[data-v3-calc="canopy"]')).toBeVisible();
});

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

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.v3-product-tile')).toHaveCount(3);
  const card = page.locator('.survey-card').first();
  await expect(card).toContainText('ЗМ-0001');
  await expect(card).toContainText('+7 937');
  await expect(card).toContainText('Расчётов пока нет');
  await expect(card.locator('[data-open-survey]')).toBeVisible();

  await expect(page.locator('#surveyDetailsContent')).toContainText('+7 937');

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
  await expect(page.locator('#surveyDetailsContent')).toContainText('Сохранённые расчёты');
  await expect(page.locator('[data-add-calculation]')).toHaveCount(0);

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
  await expect(page.locator('#surveyDetailsContent')).toContainText('Сохранённые расчёты');
  await expect(page.locator('.calculation-card')).toContainText('Ворота с калиткой');
  await expect(page.locator('.calculation-card-price')).toContainText('56');
  await expect(page.locator('[data-add-calculation]')).toBeVisible();
  await expect(page.locator('[data-show-calculation]')).toBeVisible();
  await page.locator('[data-show-calculation]').click();
  await expect(page.locator('#customerPreviewDialog')).toBeVisible();
  await expect(page.locator('#customerPreviewTitle')).toContainText('Вариант изделия');
  await expect(page.locator('#customerPreviewContent')).toContainText('56');
  await expect(page.locator('#customerPreviewContent')).toContainText('одного варианта');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Себестоимость');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Прибыль');
  await page.locator('#closeCustomerPreviewBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('[data-survey-work-types]')).toHaveCount(0);

  await page.locator('.v3-extra summary').click();
  await page.locator('[data-edit-plan]').click();
  await expect(page.locator('#planDialog')).toBeVisible();
  await expect(page.locator('#planCanvas .plan-part')).toHaveCount(5);
  await expect(page.locator('#planItemsCount')).toHaveText('5');
  await expect(page.locator('#planGeometryAudit')).toContainText('Размеры проверены');

  await expect(page.locator('#planLegacyList')).toBeHidden();
  await expect(page.locator('#planVisualModeBtn')).toHaveAttribute('aria-pressed','true');
  await page.locator('#planListModeBtn').click();
  await expect(page.locator('#planLegacyList')).toBeVisible();
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

  await page.locator('#planVisualModeBtn').click();
  await expect(page.locator('#planLegacyList')).toBeHidden();
  // New linear constructor: edit dimensions without opening the old modal.
  await expect(page.locator('#planCanvas .plan-part-shape svg')).toHaveCount(5);
  // Every + belongs to a dedicated row above illustrations, never over labels.
  const insertionButtonsClearArtwork = await page.locator('#planCanvas [data-plan-insert-canvas]').evaluateAll(buttons =>
    buttons.every(button => {
      const wrap=button.closest('.plan-part-wrap');
      const artwork=wrap.querySelector('.plan-part-shape');
      return button.getBoundingClientRect().bottom <= artwork.getBoundingClientRect().top + 2;
    })
  );
  expect(insertionButtonsClearArtwork).toBe(true);
  await page.locator('#planCanvas .plan-part.gate').first().click();
  await expect(page.locator('#planQuickElementActions')).toBeVisible();
  await expect(page.locator('#planEditor')).toBeHidden();
  await page.locator('[data-plan-inline-field="width"]').fill('3.6');
  await page.locator('[data-plan-inline-field="width"]').press('Tab');
  await expect(page.locator('#planLineWidth')).toHaveText('4,6 м');
  await page.locator('#undoPlanPostBtn').click();
  await expect(page.locator('#planLineWidth')).toHaveText('4,4 м');
  // Quick palette adds an element next to the selected position; undo restores the sketch.
  await page.locator('[data-plan-quick-add="post"]').click();
  await expect(page.locator('#planItemsCount')).toHaveText('6');
  await page.locator('#undoPlanPostBtn').click();
  await expect(page.locator('#planItemsCount')).toHaveText('5');
  // Tap + directly on the visual scheme to insert a span at the correct position.
  await expect(page.locator('#planCanvas [data-plan-insert-canvas]')).toHaveCount(5);
  await page.locator('#planCanvas [data-plan-insert-canvas="3"]').click();
  await expect(page.locator('#insertPanel')).toBeVisible();
  await expect(page.locator('#planSheetBackdrop')).toBeVisible();
  await page.locator('[data-add-plan-item="fence"]').click();
  await expect(page.locator('#planEditor')).toBeVisible();
  await page.locator('[data-plan-field="width"]').fill('1.7');
  await page.locator('[data-plan-field="width"]').blur();
  await page.locator('[data-plan-field="material"]').selectOption('euro_vertical');
  await page.locator('#closePlanEditorBtn').click();
  await page.locator('#planCanvas .plan-part.fence').first().click();
  await expect(page.locator('#planQuickElementActions')).toBeVisible();
  await expect(page.locator('[data-plan-inline-split]')).toBeVisible();
  await expect(page.locator('#planSwipeHint')).toBeVisible();
  // The save button must be after the whole editor, never overlay editable fields.
  const footerDoesNotCoverInputs = await page.evaluate(() => {
    const editor=document.querySelector('#planQuickElementActions').getBoundingClientRect();
    const footer=document.querySelector('#planDialog .plan-footer').getBoundingClientRect();
    return footer.top >= editor.bottom - 1;
  });
  expect(footerDoesNotCoverInputs).toBe(true);
  await expect(page.locator('#savePlanBtn')).toBeVisible();
  await page.locator('#savePlanBtn').click();

  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('.v3-extra summary').click();
  await expect(page.locator('.plan-mini-preview')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('6,1 м');

  await page.locator('[data-complete-survey]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsContent')).toContainText('Замер завершён');
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
  await page.locator('.v3-extra summary').click();
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
