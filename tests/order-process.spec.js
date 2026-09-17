import {test, expect} from '@playwright/test';

test('mobile page shows one five-step order process section', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});

  const process = page.locator('[data-order-process]');
  await expect(process).toHaveCount(1);
  await expect(page.getByRole('heading', {name:'Как проходит заказ', exact:true})).toHaveCount(1);
  await expect(process.locator('.order-steps-grid article')).toHaveCount(5);
  await expect(page.locator('#afterRequest')).toHaveCount(1);
  await expect(process.locator('.order-steps-grid')).toHaveCSS('grid-template-columns', /\d+(\.\d+)?px/);
});
