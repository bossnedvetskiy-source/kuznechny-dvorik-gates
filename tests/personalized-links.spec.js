import {test, expect} from '@playwright/test';

async function openShared(page, query) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?' + query, {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:8000});
  await expect(page.locator('#catalogOrderSummary')).toBeVisible({timeout:8000});
}

test('personalized link applies city and own posts without asking the customer', async ({page}) => {
  await openShared(page, 'share=1&city=%D0%A1%D0%B0%D0%BB%D0%B0%D0%B2%D0%B0%D1%82&posts=own');

  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden();
  await expect(page.locator('#cityInput')).toHaveValue('Салават');
  await expect(page.locator('#postsCheck')).not.toBeChecked();
  await expect(page.locator('#catalogOrderSummary')).toContainText('Салават');
  await expect(page.locator('#catalogOrderSummary')).toContainText('на ваши столбы');

  const quote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote');
  await expect(quote).toContainText('С доставкой');
  await expect(quote.locator('strong')).not.toContainText('Пересчитываем');
});

test('personalized link can include new posts and exact dimensions', async ({page}) => {
  await openShared(page, 'share=1&city=%D0%9C%D0%B5%D0%BB%D0%B5%D1%83%D0%B7&posts=new&gw=3.8&gh=1.9&ww=1.05&wh=1.9');

  await expect(page.locator('#postsCheck')).toBeChecked();
  await expect(page.locator('#widthInput')).toHaveValue('3.8');
  await expect(page.locator('#heightInput')).toHaveValue('1.9');
  await expect(page.locator('#wicketWidthInput')).toHaveValue('1.05');
  await expect(page.locator('#wicketHeightInput')).toHaveValue('1.9');
  await expect(page.locator('#catalogOrderSummary')).toContainText('новые столбы');
  await expect(page.locator('#catalogOrderSummary')).toContainText('Мелеуз');

  const price = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong');
  await expect.poll(async () => String(await price.textContent()), {timeout:10000}).not.toContain('Пересчитываем');
});

test('personalized link article reveals the requested model without opening calculator', async ({page}) => {
  await openShared(page, 'share=1&city=%D0%9C%D0%B5%D0%BB%D0%B5%D1%83%D0%B7&posts=own&art=18');

  const card = page.locator('#catalogGrid .product-card').filter({hasText:'Арт.18'}).first();
  await expect(card).toBeVisible({timeout:8000});
  await expect(page.locator('#calculator')).toBeHidden();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
});
