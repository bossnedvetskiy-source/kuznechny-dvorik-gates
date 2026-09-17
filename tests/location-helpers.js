import {expect} from '@playwright/test';

export async function openLocationSelector(page) {
  const configurator = page.locator('#catalogOrderConfigurator');
  await expect(configurator).toBeVisible({timeout:5000});
  const input = page.locator('#cityInput');
  const action = page.locator('#routeButton');
  const status = page.locator('#deliveryResult');
  return {modal:configurator, input, action, status};
}

export async function beginInstallationPlace(page, place) {
  const ui = await openLocationSelector(page);
  const normalized = String(place || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
  if (normalized === 'мелеуз') {
    await page.locator('#deliveryChooser [data-delivery-choice="meleuz"]').click();
    await expect(page.locator('#deliverySummary')).toBeVisible();
    return {...ui, selected:true, firstCard:page.locator('#catalogGrid .product-card').first()};
  }

  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();
  await ui.input.fill(place);
  await ui.input.dispatchEvent('change');

  const summary = page.locator('#deliverySummary');
  if (await summary.isVisible().catch(() => false)) {
    return {...ui, selected:true, firstCard:page.locator('#catalogGrid .product-card').first()};
  }

  await expect(ui.action).toBeVisible({timeout:5000});
  await expect(ui.action).toBeEnabled();
  await ui.action.click();
  return {...ui, selected:false, firstCard:page.locator('#catalogGrid .product-card').first()};
}

export async function selectInstallationPlace(page, place='Мелеуз') {
  const ui = await beginInstallationPlace(page, place);
  const summary = page.locator('#deliverySummary');
  if (await summary.isVisible().catch(() => false)) return ui.firstCard;

  if (await ui.action.isVisible().catch(() => false)) {
    const text = String(await ui.action.textContent() || '');
    if (/Да, это нужный пункт/.test(text)) await ui.action.click();
  }

  await expect(ui.firstCard).toBeVisible({timeout:10000});
  return ui.firstCard;
}

export async function openMobileAt(page, place='Мелеуз') {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible({timeout:5000});
  if (place) await selectInstallationPlace(page, place);
  return page.locator('#catalogGrid .product-card').first();
}
