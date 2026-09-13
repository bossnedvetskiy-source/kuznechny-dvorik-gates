import {test, expect} from '@playwright/test';

test('mobile Back closes gate photo viewer without leaving the site', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();

  const startUrl = page.url();
  await page.locator('#catalogGrid .product-card').first().locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(true);

  await page.goBack();

  await expect(page.locator('#lightbox')).toBeHidden();
  expect(page.url()).toBe(startUrl);
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
});

test('closing the photo viewer manually removes its temporary history entry', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();

  const startUrl = page.url();
  await page.locator('#catalogGrid .product-card').first().locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(true);

  await page.locator('#lightboxClose').click();

  await expect(page.locator('#lightbox')).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(false);
  expect(page.url()).toBe(startUrl);
});
