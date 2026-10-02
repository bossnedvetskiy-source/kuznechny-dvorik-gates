import {test, expect} from '@playwright/test';

test('canopy client is simple and saved order keeps production/finance in admin', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/naves/index.html',{waitUntil:'domcontentloaded'});

  await expect(page.locator('#canopySvg')).toBeVisible();
  await expect(page.locator('#canopySvg line')).not.toHaveCount(0);
  await expect(page.locator('#totalPrice')).toContainText('214');
  await expect(page.locator('#resultStatus')).toContainText('Пример расчёта');
  await expect(page.locator('#clientSummary')).toContainText('3,40 × 8,40 м');
  await expect(page.locator('#clientSummary')).toContainText('Поликарбонат');

  // Production-only data is absent from the client summary/page.
  await expect(page.locator('#clientSummary')).not.toContainText('Ферм');
  await expect(page.locator('#clientSummary')).not.toContainText('Опор');
  await expect(page.locator('#ownerSummary')).toHaveCount(0);
  await expect(page.locator('#materialsTableBody')).toHaveCount(0);
  await expect(page.locator('#cutTableBody')).toHaveCount(0);
  await expect(page.locator('#trussSvg')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Прибыль до налогов');
  await expect(page.locator('body')).not.toContainText('Материалы и закупка');
  await expect(page.locator('body')).not.toContainText('ТЗ сварщику');

  // Technical geometry is available only in a collapsed advanced block.
  await expect(page.locator('.advanced-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('#rise')).not.toBeVisible();
  await page.locator('.advanced-settings summary').click();
  await expect(page.locator('#rise')).toBeVisible();
  await page.locator('.advanced-settings summary').click();

  // On mobile: inputs first, then price / preview.
  const formBox=await page.locator('#trussForm').boundingBox();
  const resultBox=await page.locator('.client-result').boundingBox();
  expect(formBox.y).toBeLessThan(resultBox.y);

  // Changing width turns the example into a real preliminary calculation.
  await page.locator('#widthPosts').fill('4.2');
  await expect(page.locator('#rise')).toHaveValue(/700/);
  await expect(page.locator('#resultStatus')).toContainText('Предварительный расчёт готов');
  await expect(page.locator('#canopySvg')).toBeVisible();
  await expect(page.locator('#canopySvg')).toContainText('4,20');

  // DEV has no backend: force the local saved-order route.
  await page.route('**/api/leads', route => route.fulfill({
    status:503,
    contentType:'application/json',
    body:JSON.stringify({error:'DEV backend unavailable'})
  }));

  await page.locator('#showSave').click();
  await expect(page.locator('#savePanel')).toBeVisible();
  await page.locator('#savePhone').fill('8 937 329-67-50');
  await page.locator('#saveCity').fill('Мелеуз');
  await page.locator('#saveConsent').check();
  await page.locator('#saveCalculation').click();
  await expect(page.locator('#saveStatus')).toContainText('сохранён');

  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kuzdvor-dev-canopy-saved-v1')||'[]'));
  expect(saved.length).toBeGreaterThan(0);
  expect(saved[0].category).toBe('canopy');
  expect(saved[0].configuration.canopy.input.widthPostsM).toBe(4.2);
  expect(saved[0].configuration.canopy.pricingSnapshot.rates.tube25).toBeGreaterThan(0);

  const overflow=await page.evaluate(()=>{
    const offenders=[...document.querySelectorAll('body *')].map(el=>{
      const r=el.getBoundingClientRect();
      return {tag:el.tagName,id:el.id,left:Math.round(r.left),right:Math.round(r.right)};
    }).filter(x=>x.right>window.innerWidth+1||x.left<-1);
    return {offenders,innerWidth:window.innerWidth};
  });
  expect(overflow.offenders,JSON.stringify(overflow)).toHaveLength(0);

  // Open the same saved calculation in the DEV admin workspace.
  await page.goto('/naves/admin.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-admin-tab="canopy-orders"]')).toBeVisible();
  await page.locator('[data-admin-tab="canopy-orders"]').click();
  await expect(page.locator('#canopyOrderList')).toContainText('Мелеуз');
  await expect(page.locator('#canopyOrderList')).toContainText('4,20 × 8,40 м');
  await page.locator('[data-open-canopy]').first().click();

  await expect(page.locator('#canopyAdminDialog')).toBeVisible();
  await expect(page.locator('[data-canopy-inner="order"]')).toHaveClass(/active/);
  await expect(page.locator('[data-canopy-panel="order"]')).toContainText('Цена клиенту');

  await page.locator('[data-canopy-inner="production"]').click();
  await expect(page.locator('[data-canopy-panel="production"]')).toBeVisible();
  await expect(page.locator('#canopyAdminTrussSvg')).toBeVisible();
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('Раскрой фермы');
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('Материалы и закупка');
  await expect(page.locator('#canopyPrintDrawing')).toContainText('Распечатать ТЗ сварщику');

  await page.locator('[data-canopy-inner="finance"]').click();
  await expect(page.locator('[data-canopy-panel="finance"]')).toBeVisible();
  await expect(page.locator('[data-canopy-panel="finance"]')).toContainText('Прибыль до налогов');
  await expect(page.locator('[data-canopy-panel="finance"]')).toContainText('ЗП / работы');
  await expect(page.locator('[data-canopy-panel="finance"]')).toContainText('зафиксированы в момент сохранения');
  await expect(page.locator('[data-canopy-panel="finance"]')).toContainText('По текущим ставкам');
});