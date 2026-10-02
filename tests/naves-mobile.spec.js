import {test, expect} from '@playwright/test';

test('canopy calculator mobile and pricing', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/naves/index.html',{waitUntil:'domcontentloaded'});

  await expect(page.locator('#trussSvg')).toBeVisible();
  await expect(page.locator('#trussSvg path')).not.toHaveCount(0);
  await expect(page.locator('#totalPrice')).toContainText('214');
  await expect(page.locator('#materialsTableBody tr')).toHaveCount(4);
  await expect(page.locator('#cutTableBody tr')).toHaveCount(13);
  await expect(page.locator('#clientSummary')).toContainText('6 шт');
  await expect(page.locator('#clientSummary')).toContainText('новых 8');

  const before=await page.locator('#totalPrice').textContent();
  await page.locator('#existingPosts').fill('2');
  await page.locator('#beamsExisting').check();
  await expect(page.locator('#clientSummary')).toContainText('новых 6');
  await expect(page.locator('#clientSummary')).toContainText('уже есть');
  const after=await page.locator('#totalPrice').textContent();
  expect(after).not.toBe(before);

  await page.locator('#widthPosts').fill('4.2');
  await expect(page.locator('#compositionList')).toContainText('30×30×2');
  await expect(page.locator('#compositionList')).toContainText('25×25×1,5');

  const noHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  expect(noHorizontalOverflow).toBeTruthy();
});