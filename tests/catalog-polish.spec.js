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
  const mobilePrimary = page.locator('#mobilePrimaryCta');
  await expect(mobilePrimary).toHaveText('К моделям');
  await expect.poll(async () => mobilePrimary.evaluate(node => getComputedStyle(node,'::after').content)).toMatch(/^(none|""|'')$/);

  const firstCard = page.locator('#catalogGrid .product-card').first();
  await expect(firstCard.locator('.product-art')).toBeVisible();
  await expect(firstCard.locator('.product-art')).toContainText('Арт.');

  const more = page.locator('#catalogMore');
  const showMore = page.locator('#showMoreButton');
  const trust = page.locator('.catalog-trust-strip');
  await expect(more).toBeVisible();
  await expect(page.locator('#catalogProgress')).toHaveText(/Ещё 32 модели в каталоге/);
  await expect(showMore).toHaveText(/Показать ещё 6 моделей ↓$/);
  await expect.poll(async () => showMore.evaluate(node => getComputedStyle(node).backgroundImage)).not.toBe('none');
  await expect.poll(async () => showMore.evaluate(node => getComputedStyle(node).color)).toMatch(/rgb\(23,\s*18,\s*11\)/);
  await expect.poll(async () => showMore.evaluate(node => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(48);
  await expect.poll(async () => page.evaluate(() => {
    const more = document.getElementById('catalogMore');
    const trust = document.querySelector('.catalog-trust-strip');
    return Boolean(more && trust && (more.compareDocumentPosition(trust) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);

  const colorDescription = page.locator('.catalog-color-global > div').first().locator('span');
  await expect(colorDescription).toBeHidden();
  await expect(page.locator('#catalogOrderConfigurator .mobile-size-summary small')).toBeHidden();
  await expect(page.locator('#catalogOrderConfigurator .catalog-posts-choice small').first()).toBeHidden();
  await expect.poll(async () => page.locator('#catalogOrderConfigurator .catalog-posts-choice button').first().evaluate(node => Math.round(node.getBoundingClientRect().height))).toBeLessThanOrEqual(42);
});

test('applied parameters stay compact after reload and nonstandard prices do not hang', async ({page}) => {
  await openMobile(page);

  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();

  const firstQuote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong');
  await expect.poll(async () => String(await firstQuote.textContent()), {timeout:8000})
    .not.toContain('Пересчитываем');

  await expect(page.locator('#applyCatalogParams')).toBeHidden();
  await page.locator('#deliveryChooser [data-delivery-choice="meleuz"]').click();
  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden();
  await expect(page.locator('#catalogOrderSummary')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toContainText('3,8');
  await expect(page.locator('#catalogOrderSummary')).toContainText('Мелеуз');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:7000});
  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden();
  await expect(page.locator('#catalogOrderSummary')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toContainText('3,8');
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
  await expect.poll(async () => String(await page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote strong').textContent()), {timeout:8000})
    .not.toContain('Пересчитываем');
});

test('sticky CTA switches to selected quote and calculator has a compact close button', async ({page}) => {
  await openMobile(page);

  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
  await page.locator('#catalogGrid .product-card').first().locator('.select-product').click();
  const calculator = page.locator('#calculator');
  const closeButton = page.locator('#changeProductButton');
  await expect(calculator).toBeVisible();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText(/^На замер · (?:от )?[\d\s ]+ ₽$/);
  await expect.poll(async () => page.locator('#mobilePrimaryCta').evaluate(node => getComputedStyle(node,'::after').content)).toMatch(/^(none|""|'')$/);
  await expect.poll(async () => calculator.evaluate(node => getComputedStyle(node).position), {timeout:5000}).toBe('relative');
  await expect.poll(async () => page.locator('body').evaluate(node => getComputedStyle(node).overflowY), {timeout:5000}).not.toBe('hidden');
  await expect(calculator).toBeInViewport();
  await expect(closeButton).toHaveText('×');
  await expect(closeButton).toHaveAttribute('aria-label','Закрыть расчёт');

  await closeButton.click();
  await expect(calculator).toBeHidden();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
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


test('show more CTA updates remaining count and reveals the next six models', async ({page}) => {
  await openMobile(page);

  const before = await page.locator('#catalogGrid .product-card').count();
  expect(before).toBe(6);
  await expect(page.locator('#catalogProgress')).toHaveText('Ещё 32 модели в каталоге');

  await page.locator('#showMoreButton').click();

  await expect(page.locator('#catalogGrid .product-card')).toHaveCount(12);
  await expect(page.locator('#catalogProgress')).toHaveText('Ещё 26 моделей в каталоге');
  await expect(page.locator('#showMoreButton')).toHaveText('Показать ещё 6 моделей ↓');
});
