import {test, expect} from '@playwright/test';
import {openMobileAt} from './location-helpers.js';

test('mobile Back closes gate photo viewer without leaving the site', async ({page}) => {
  await openMobileAt(page, 'Мелеуз');
  const card = page.locator('#catalogGrid .product-card').first();
  const startUrl = page.url();
  await card.locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(true);

  await page.goBack();

  await expect(page.locator('#lightbox')).toBeHidden();
  expect(page.url()).toBe(startUrl);
  await expect(card).toBeVisible();
});

test('closing the photo viewer manually removes its temporary history entry', async ({page}) => {
  await openMobileAt(page, 'Мелеуз');
  const card = page.locator('#catalogGrid .product-card').first();
  const startUrl = page.url();
  await card.locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(true);

  await page.locator('#lightboxClose').click();

  await expect(page.locator('#lightbox')).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__kuzdvorLightbox))).toBe(false);
  expect(page.url()).toBe(startUrl);
});

test('mobile photo viewer is focused, full-width and supports swipe navigation', async ({page}) => {
  await page.route('**/api/catalog-images', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({galleries:{'Арт.6':{photos:['/catalog/art-6-1.webp','/catalog/art-6-2.webp'],mediaType:'photo',colorPhotos:{}}}})
  }));

  await openMobileAt(page, 'Мелеуз');
  const card = page.locator('#catalogGrid .product-card').first();
  await expect(card.locator('[data-photo-count]')).toHaveText('1 из 2');
  await card.locator('.product-image-open').click();

  const lightbox = page.locator('#lightbox');
  const image = page.locator('#lightboxImage');
  const mobileMeta = page.locator('[data-mobile-lightbox-meta]');
  await expect(lightbox).toBeVisible();
  await expect(page.locator('.mobile-cta')).toBeHidden();
  await expect(page.locator('#lightboxPrice')).toBeHidden();
  await expect(mobileMeta).toContainText('Арт.6');
  await expect(mobileMeta).toContainText('фото 1 из 2');

  const presentation = await page.evaluate(() => {
    const overlay = document.getElementById('lightbox');
    const image = document.getElementById('lightboxImage');
    const close = document.getElementById('lightboxClose');
    const imageRect = image.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    return {
      background:getComputedStyle(overlay).backgroundColor,
      imageWidth:imageRect.width,
      viewportWidth:window.innerWidth,
      closeTop:closeRect.top,
      imageBackground:getComputedStyle(image).backgroundColor,
      imageBorder:getComputedStyle(image).borderTopWidth
    };
  });
  expect(presentation.background).not.toBe('rgb(244, 241, 235)');
  expect(presentation.imageWidth).toBeGreaterThanOrEqual(presentation.viewportWidth * 0.98);
  expect(presentation.closeTop).toBeLessThan(40);
  expect(presentation.imageBackground).toBe('rgba(0, 0, 0, 0)');
  expect(presentation.imageBorder).toBe('0px');

  const firstSrc = await image.getAttribute('src');
  await page.mouse.move(330,420);
  await page.mouse.down();
  await page.mouse.move(60,420,{steps:6});
  await page.mouse.up();
  await expect(image).not.toHaveAttribute('src', firstSrc);
  await expect(mobileMeta).toContainText('фото 2 из 2');
});
