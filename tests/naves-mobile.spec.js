import {test, expect} from '@playwright/test';

test('canopy client page is simple, mobile and saves into DEV admin storage', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/naves/index.html',{waitUntil:'domcontentloaded'});

  await expect(page.locator('#canopySvg')).toBeVisible();
  await expect(page.locator('#canopySvg line')).not.toHaveCount(0);
  await expect(page.locator('#totalPrice')).toContainText('214');
  await expect(page.locator('#clientSummary')).toContainText('3,40 × 8,40 м');
  await expect(page.locator('#clientSummary')).toContainText('6 шт');

  await expect(page.locator('#ownerSummary')).toHaveCount(0);
  await expect(page.locator('#materialsTableBody')).toHaveCount(0);
  await expect(page.locator('#cutTableBody')).toHaveCount(0);
  await expect(page.locator('#trussSvg')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Прибыль до налогов');
  await expect(page.locator('body')).not.toContainText('Материалы и закупка');
  await expect(page.locator('body')).not.toContainText('ТЗ сварщику');

  await page.locator('#widthPosts').fill('4.2');
  await expect(page.locator('#rise')).toHaveValue(/700/);
  await expect(page.locator('#canopySvg')).toBeVisible();

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

  const noHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  expect(noHorizontalOverflow).toBeTruthy();

  await page.goto('/naves/admin.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-admin-tab="canopy-orders"]')).toBeVisible();
  await page.locator('[data-admin-tab="canopy-orders"]').click();
  await expect(page.locator('#canopyOrderList')).toContainText('Мелеуз');
  await expect(page.locator('#canopyOrderList')).toContainText('4,20 × 8,40 м');
  await page.locator('[data-open-canopy]').first().click();
  await expect(page.locator('#canopyAdminDialog')).toBeVisible();
  await expect(page.locator('#canopyAdminDialog')).toContainText('Прибыль до налогов');
  await expect(page.locator('#canopyAdminDialog')).toContainText('ЗП / работы');
  await expect(page.locator('#canopyAdminTrussSvg')).toBeVisible();
  await expect(page.locator('#canopyAdminDialog')).toContainText('ТЗ сварщику');
});