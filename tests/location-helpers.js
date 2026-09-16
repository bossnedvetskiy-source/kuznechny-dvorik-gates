import {expect} from '@playwright/test';

export async function openLocationSelector(page) {
  const modal = page.locator('#catalogLocationGateModal');
  const autoOpened = await modal.waitFor({state:'visible',timeout:2500}).then(() => true).catch(() => false);
  if (!autoOpened) {
    const lockButton = page.locator('.catalog-location-lock button');
    if (await lockButton.isVisible().catch(() => false)) {
      await lockButton.evaluate(element => element.click());
    } else {
      await page.evaluate(() => document.querySelector('a[href="#catalog"]')?.click());
    }
  }
  await expect(modal).toBeVisible({timeout:5000});
  return {
    modal,
    input:page.locator('#installationLocationInput'),
    action:page.locator('#installationLocationAction'),
    status:page.locator('#installationLocationStatus')
  };
}

export async function beginInstallationPlace(page, place) {
  const firstCard = page.locator('#catalogGrid .product-card').first();
  if (await firstCard.isVisible().catch(() => false)) return {selected:true, firstCard};
  const ui = await openLocationSelector(page);
  await ui.input.fill(place);
  if (await firstCard.isVisible().catch(() => false)) return {...ui, selected:true, firstCard};
  await expect(ui.action).toBeEnabled();
  await ui.action.click();
  return {...ui, selected:false, firstCard};
}

export async function selectInstallationPlace(page, place='Мелеуз') {
  const firstCard = page.locator('#catalogGrid .product-card').first();
  if (await firstCard.isVisible().catch(() => false)) return firstCard;
  const ui = await beginInstallationPlace(page, place);
  if (await firstCard.isVisible().catch(() => false)) return firstCard;
  if (await ui.modal?.isVisible().catch(() => false)) {
    await expect(ui.action).toBeEnabled({timeout:10000});
    const text = String(await ui.action.textContent() || '');
    if (/Да, это нужный пункт/.test(text)) await ui.action.click();
  }
  await expect(firstCard).toBeVisible({timeout:10000});
  return firstCard;
}

export async function openMobileAt(page, place='Мелеуз') {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  return selectInstallationPlace(page, place);
}
