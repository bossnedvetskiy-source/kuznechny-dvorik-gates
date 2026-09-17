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

test('sticky CTA switches from catalog navigation to the selected quote', async ({page}) => {
  await openMobile(page);

  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
  await page.locator('#catalogGrid .product-card').first().locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#mobilePrimaryCta')).toHaveText(/^На замер · (?:от )?[\d\s ]+ ₽$/);
});

test('real mobile reload closes the last selected calculator', async ({page}) => {
  await page.addInitScript(() => {
    window.__kuzdvorHiddenTrace = [];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
    if (!descriptor?.get || !descriptor?.set) return;
    Object.defineProperty(HTMLElement.prototype, 'hidden', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        if (this.id === 'calculator') {
          window.__kuzdvorHiddenTrace.push({
            value:Boolean(value),
            at:performance.now(),
            stack:new Error('calculator.hidden write').stack,
            parent:this.parentElement?.id || this.parentElement?.className || '',
            body:document.body?.className || ''
          });
        }
        return descriptor.set.call(this, value);
      }
    });
  });

  await openMobile(page);

  const thirdCard = page.locator('#catalogGrid .product-card').nth(2);
  await expect(thirdCard.locator('.product-art')).toContainText('Арт.31');
  await thirdCard.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#selectedProductCaption')).toContainText('Арт.31');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:7000});
  await page.waitForTimeout(4800);
  const diagnostic = await page.evaluate(() => ({
    trace:window.__kuzdvorHiddenTrace || [],
    hidden:document.getElementById('calculator')?.hidden,
    parent:document.getElementById('calculator')?.parentElement?.id || document.getElementById('calculator')?.parentElement?.className || '',
    body:document.body.className,
    selected:document.getElementById('selectedProductCaption')?.textContent || '',
    nav:performance.getEntriesByType('navigation')[0]?.type || '',
    active:document.activeElement?.outerHTML?.slice(0,300) || ''
  }));
  console.log('CALCULATOR_RELOAD_DIAGNOSTIC', JSON.stringify(diagnostic));

  await expect(page.locator('#calculator')).toBeHidden({timeout:500});
  await expect(page.locator('body')).not.toHaveClass(/calculator-open/);
  await expect(page.locator('#mobilePrimaryCta')).toHaveText('К моделям');
});