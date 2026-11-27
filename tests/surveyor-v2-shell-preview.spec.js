import {test,expect} from '@playwright/test';

test.use({viewport:{width:360,height:800}});

test('isolated v2 prototype: owner tiles, theme, role demo and mobile navigation',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/surveyor-app/v2-shell-preview.html');
  await expect(page.locator('#brand')).toHaveText('КД УПРАВЛЕНИЕ');
  await expect(page.locator('.kpi')).toHaveCount(4);
  await expect(page.locator('.kpi strong')).toHaveText(['—','—','—','—']);
  await expect(page.locator('.tiles .tile')).toHaveCount(12);
  await expect(page.locator('#nav button')).toHaveCount(5);
  await page.locator('#theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('.tiles [data-go="wallet"]').click();
  await expect(page.locator('main h1')).toHaveText('Финансы');
  await page.locator('#nav [data-go="home"]').click();
  await page.locator('.tiles [data-go="ruler"]').click();
  await expect(page.locator('#brand')).toHaveText('КД ЗАМЕРЩИК');
  await expect(page.locator('main [data-go="quick"]')).toBeVisible();
  await expect(page.locator('main [data-go="measure"]')).toBeVisible();
  await expect(page.locator('main [data-go="wallet"]')).toHaveCount(0);
  await expect(page.locator('#nav button')).toHaveCount(4);
  await page.locator('[data-go="quick"]').click();
  await expect(page.locator('main h1')).toHaveText('Быстрый расчёт');
  await page.locator('#menu').click();
  await page.locator('[data-role="owner"]').click();
  await expect(page.locator('#brand')).toHaveText('КД УПРАВЛЕНИЕ');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
