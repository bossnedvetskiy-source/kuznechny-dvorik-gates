import {test, expect} from '@playwright/test';

test('manual arc rise recalculates canopy and keeps 3D mounted through intermediate values', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/naves/index.html',{waitUntil:'domcontentloaded'});
  const canvas=page.locator('#canopyViewport canvas');
  await expect(canvas).toBeVisible({timeout:15000});
  const originalPrice=await page.locator('#totalPrice').innerText();
  const originalArc=await page.evaluate(()=>window.__TRUSS_CURRENT.topCircle.length);

  await page.locator('.advanced-settings summary').click();
  // Typing 800 can pass through 8 and 80: those intermediate states must not destroy 3D.
  await page.locator('#rise').fill('100');
  await expect(page.locator('#drawingStatus')).toHaveText('проверьте размеры');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#canopyViewport .three-geometry-notice')).toBeVisible();

  await page.locator('#rise').fill('800');
  await expect(page.locator('#autoRise')).not.toBeChecked();
  await expect(page.locator('#drawingStatus')).toHaveText('готово');
  await expect(page.locator('#canopyViewport .three-geometry-notice')).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(page.locator('#totalPrice')).toContainText('₽');
  await expect(page.locator('#totalPrice')).not.toHaveText(originalPrice);
  const state=await page.evaluate(()=>({
    rise:window.__TRUSS_CURRENT.riseM,
    arc:window.__TRUSS_CURRENT.topCircle.length,
    total:window.__CANOPY_PUBLIC.total
  }));
  expect(state.rise).toBeCloseTo(0.8,5);
  expect(state.arc).toBeGreaterThan(originalArc);
  expect(state.total).toBeGreaterThan(0);

  // Even if a third-party component clears the container, the next edit restores WebGL.
  await page.evaluate(()=>{document.getElementById('canopyViewport').innerHTML='';});
  await page.locator('#rise').fill('750');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#drawingStatus')).toHaveText('готово');
});

test('canopy client is simple and saved order keeps production/finance in admin', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/naves/index.html',{waitUntil:'domcontentloaded'});

  await expect(page.locator('#canopyViewport')).toBeVisible();
  await expect(page.locator('#canopyViewport canvas')).toBeVisible({timeout:15000});
  await expect(page.locator('#reset3dView')).toBeVisible();
  await expect(page.locator('#totalPrice')).toContainText('₽');
  await expect(page.locator('#totalPrice')).not.toHaveText('0 ₽');
  await expect(page.locator('#farmType')).toHaveValue('Арочный');
  await expect(page.locator('#farmTypeCaption')).toHaveText('Арочный');
  await expect(page.locator('[data-farm-type]')).toHaveCount(7);
  await expect(page.locator('[data-farm-type="Арочный"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-farm-type] img')).toHaveCount(7);
  const farmImagesLoaded=await page.locator('[data-farm-type] img').evaluateAll(imgs=>imgs.length===7&&imgs.every(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0));
  expect(farmImagesLoaded).toBeTruthy();
  await expect(page.locator('#farmPreset')).toHaveValue('Стандарт');
  await expect(page.locator('[data-preset-option]')).toHaveCount(4);
  await expect(page.locator('[data-preset-option="Стандарт"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#trussType')).toHaveValue('Треугольная');
  await expect(page.locator('[data-truss-option]')).toHaveCount(4);
  await expect(page.locator('[data-truss-option="Треугольная"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#materialMode')).toHaveValue('30×30×2');
  await expect(page.locator('#lagMode')).toHaveValue('Стандарт');
  await expect(page.locator('#resultStatus')).toContainText('Пример расчёта');
  await expect(page.locator('#clientSummary')).toContainText('3,40 × 8,40 м');
  await expect(page.locator('#clientSummary')).toContainText('Поликарбонат');

  // Production-only data is absent from the client summary/page.
  await expect(page.locator('#clientSummary dt').filter({hasText:/^Ферм$/})).toHaveCount(0);
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

  // 3 m canopy: standard vs economy purlin layout.
  await page.locator('#widthPosts').fill('3');
  await page.locator('#lengthPosts').fill('5.9');
  await page.locator('#coverage').selectOption({label:'Без покрытия'});
  await expect(page.locator('#rise')).toHaveValue(/500/);
  await expect(page.locator('#lagModeInfo')).toContainText('10 линий');

  await page.locator('[data-lag-option="Эконом"]').click();
  await expect(page.locator('#lagMode')).toHaveValue('Эконом');
  await expect(page.locator('#lagModeInfo')).toContainText('8 линий');

  // Visual truss cards and material buttons.
  await page.locator('[data-truss-option="Усиленная"]').click();
  await page.locator('#materialMode').selectOption({label:'40×20×2'});
  await expect(page.locator('#trussType')).toHaveValue('Усиленная');
  await expect(page.locator('#materialMode')).toHaveValue('40×20×2');
  await expect(page.locator('[data-truss-option="Усиленная"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#clientSummary')).toContainText('Усиленная');
  await expect(page.locator('#clientSummary')).toContainText('40×20×2');
  await expect(page.locator('#clientSummary')).toContainText('Эконом · 8 линий');
  await expect(page.locator('#canopyViewport canvas')).toBeVisible();

  // Changed parameters turn the example into a real preliminary calculation.
  await expect(page.locator('#resultStatus')).toContainText('Предварительный расчёт готов');
  await expect(page.locator('#canopyViewport canvas')).toBeVisible();
  const canvasSize=await page.locator('#canopyViewport canvas').boundingBox();
  expect(canvasSize.width).toBeGreaterThan(300);
  expect(canvasSize.height).toBeGreaterThan(300);
  await page.locator('#reset3dView').click();

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
  expect(saved[0].configuration.canopy.input.widthPostsM).toBe(3);
  expect(saved[0].configuration.canopy.input.lengthM).toBe(5.9);
  expect(saved[0].configuration.canopy.input.farmType).toBe('Арочный');
  expect(saved[0].configuration.canopy.input.trussType).toBe('Усиленная');
  expect(saved[0].configuration.canopy.input.materialMode).toBe('40×20×2');
  expect(saved[0].configuration.canopy.input.lagMode).toBe('Эконом');
  expect(saved[0].configuration.canopy.pricingSnapshot.rates.tube30).toBeGreaterThan(0);
  expect(saved[0].configuration.canopy.pricingSnapshot.rates.tube40x20).toBeGreaterThan(0);

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
  await expect(page.locator('#canopyOrderList')).toContainText('3,00 × 5,90 м');
  await page.locator('[data-open-canopy]').first().click();

  await expect(page.locator('#canopyAdminDialog')).toBeVisible();
  await expect(page.locator('[data-canopy-inner="order"]')).toHaveClass(/active/);
  await expect(page.locator('[data-canopy-panel="order"]')).toContainText('Цена клиенту');

  await page.locator('[data-canopy-inner="production"]').click();
  await expect(page.locator('[data-canopy-panel="production"]')).toBeVisible();
  await expect(page.locator('#canopyAdminTrussSvg')).toBeVisible();
  await expect(page.locator('#canopyAdminTrussSvg')).toContainText('V1');
  await expect(page.locator('#canopyAdminTrussSvg')).toContainText('D1');
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('Усиленная');
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('40×20×2');
  await expect(page.locator('[data-canopy-panel="production"]')).toContainText('Эконом');
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