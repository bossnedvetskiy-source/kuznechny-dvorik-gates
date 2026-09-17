import {test, expect} from '@playwright/test';
import {selectInstallationPlace} from './location-helpers.js';

test('customer can save gates immediately and compare favorites with chosen installation place', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});

  const cards = page.locator('#catalogGrid .product-card');
  await expect(cards.first()).toBeVisible();

  const firstSave = cards.first().locator('.favorite-toggle');
  await expect(firstSave).toBeVisible();
  await firstSave.click();
  await expect(firstSave).toHaveAttribute('aria-pressed','true');

  if (await cards.nth(1).isVisible().catch(() => false)) await cards.nth(1).locator('.favorite-toggle').click();

  await selectInstallationPlace(page, 'Мелеуз');

  const favoritesButton = page.locator('.favorites-open-button');
  await expect(favoritesButton).toBeVisible();
  await favoritesButton.click();

  await expect(page.locator('.favorites-modal')).toBeVisible();
  await expect(page.locator('.favorite-compare-card').first()).toBeVisible();
  await expect(page.locator('.favorites-location')).toContainText('Мелеуз');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
  await expect(page.locator('.favorites-open-button .favorites-count')).not.toHaveText('0');
});
