import {test, expect} from '@playwright/test';

async function openMobile(page) {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:7000});
}

test('fresh visitor sees no confirmed city and a clean mobile catalog CTA', async ({page}) => {
  await openMobile(page);

  await expect(page.locator('#catalogOrderConfigurator')).toBeVisible();
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#cityInput')).toHaveValue('');
  await expect(page.locator('#deliveryChooser')).toBeVisible();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');

  const firstCard = page.locator('#catalogGrid .product-card').first();
  await expect(firstCard.locator('.product-art')).toBeVisible();
  await expect(firstCard.locator('.product-art')).toContainText('Арт.');
  await expect(page.locator('#showMoreButton')).toHaveText(/↓$/);

  const colorDescription = page.locator('.catalog-color-global > div').first().locator('span');
  await expect(colorDescription).toBeHidden();
});

test('applied parameters stay compact after reload and nonstandard prices do not hang', async ({page}) => {
  await openMobile(page);

  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();

  const firstQuote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong');
  await expect.poll(async () => String(await firstQuote.textContent()), {timeout:8000})
    .not.toContain('Пересчитываем');

  await page.locator('#applyCatalogParams').click();
  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden();
  await expect(page.locator('#catalogOrderSummary')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toContainText('3,8');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:7000});
  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden();
  await expect(page.locator('#catalogOrderSummary')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toContainText('3,8');
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
  await expect.poll(async () => String(await page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong').textContent()), {timeout:8000})
    .not.toContain('Пересчитываем');
});

test('sticky CTA switches from catalog navigation to the selected quote without a fullscreen popup', async ({page}) => {
  await openMobile(page);

  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
  await page.locator('#catalogGrid .product-card').first().locator('.select-product').click();
  const calculator = page.locator('#calculator');
  await expect(calculator).toBeVisible();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText(/^На замер · (?:от )?[\d\s ]+ ₽$/);
  await expect.poll(async () => calculator.evaluate(node => getComputedStyle(node).position), {timeout:5000}).toBe('relative');
  await expect.poll(async () => page.locator('body').evaluate(node => getComputedStyle(node).overflowY), {timeout:5000}).not.toBe('hidden');
  await expect(calculator).toBeInViewport();
});

test('real mobile reload closes the last selected calculator', async ({page}) => {
  await openMobile(page);

  const thirdCard = page.locator('#catalogGrid .product-card').nth(2);
  await expect(thirdCard.locator('.product-art')).toContainText('Арт.31');
  await thirdCard.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#selectedProductCaption')).toContainText('Арт.31');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:7000});
  await expect(page.locator('#calculator')).toBeHidden({timeout:5000});
  await expect(page.locator('body')).not.toHaveClass(/calculator-open/);
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
});
