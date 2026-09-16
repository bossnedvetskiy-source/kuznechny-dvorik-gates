#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path.cwd()

def read(path):
    p = ROOT / path
    if not p.exists():
        raise SystemExit(f'Missing file: {path}')
    return p.read_text(encoding='utf-8')

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')
    print(f'updated: {path}')

def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        print(f'already patched: {label}')
        return text
    raise SystemExit(f'Expected fragment not found: {label}')

# favorites_complete_fix: 1) bundle favorites into production.
path = 'scripts/build.mjs'
s = read(path)
if 'favoritesSharedSource' not in s:
    s = replace_once(s,
        'customerContextSource, deliverySharedSource, leadsSharedSource, lazyRuntimeSource',
        'customerContextSource, deliverySharedSource, leadsSharedSource, favoritesSharedSource, lazyRuntimeSource',
        'build destructuring')
    s = replace_once(s,
        "  readFile('shared/leads.js', 'utf8'),\n  readFile('public-lazy-runtime.js', 'utf8'),",
        "  readFile('shared/leads.js', 'utf8'),\n  readFile('shared/favorites.js', 'utf8'),\n  readFile('public-lazy-runtime.js', 'utf8'),",
        'build favorites read')
    s = replace_once(s,
        "  publicSiteJsSource,\n  gatePageUiSource\n].join('\\n');",
        "  publicSiteJsSource,\n  gatePageUiSource,\n  favoritesSharedSource\n].join('\\n');",
        'build public bundle')
if 'Избранное ворот не попало в production bundle' not in s:
    marker = """if (!publicSiteBundle.includes('/calculator.bundle.js') || !publicSiteBundle.includes('/catalog-enhancements.bundle.js')) {
  throw new Error('Начальный bundle не содержит lazy-loader для тяжёлых модулей');
}
"""
    s = replace_once(s, marker, marker + """if (!publicSiteBundle.includes('KUZDVOR_FAVORITES')) {
  throw new Error('Избранное ворот не попало в production bundle');
}
""", 'build favorites assertion')
write(path, s)

# favorites_complete_fix: 2) remove separate runtime loader.
path = 'shared/leads.js'
s = read(path)
loader_re = re.compile(
    r"\n\(\(\) => \{\n  const loadFavorites = \(\) => \{[\s\S]*?"
    r"if \(document\.readyState === 'loading'\) document\.addEventListener\('DOMContentLoaded', loadFavorites, \{once:true\}\);\n"
    r"  else loadFavorites\(\);\n\}\)\(\);\s*$"
)
if loader_re.search(s):
    s = loader_re.sub('\n', s)
    write(path, s)
else:
    print('favorites runtime loader already removed')

# favorites_complete_fix: 3) visibility follows real delivery state, not only CSS class.
path = 'shared/favorites.js'
s = read(path)
class_line = "    const catalogUnlocked = !catalog.classList.contains('location-locked');"
delivery_lines = "    const delivery = deliveryContext();\n    const catalogUnlocked = delivery.resolved || delivery.manual;"
if delivery_lines not in s:
    if class_line in s:
        s = s.replace(class_line, delivery_lines, 1)
    else:
        old = "  const syncButtons = () => {\n    const count = favorites.size;\n    toolbarButton.querySelector('.favorites-count').textContent = String(count);"
        new = "  const syncButtons = () => {\n    const count = favorites.size;\n    const delivery = deliveryContext();\n    const catalogUnlocked = delivery.resolved || delivery.manual;\n    toolbarButton.querySelector('.favorites-count').textContent = String(count);"
        s = replace_once(s, old, new, 'favorites delivery unlock')
s = s.replace(
    '    floatingButton.hidden = count === 0 || modalOpen;',
    '    floatingButton.hidden = count === 0 || modalOpen || !catalogUnlocked;'
)
end_marker = "  window.KUZDVOR_FAVORITES = {\n    open:openModal,"
if "document.addEventListener('gate:calculated', syncButtons);" not in s:
    s = replace_once(s, end_marker,
        "  document.addEventListener('gate:calculated', syncButtons);\n  window.addEventListener('pageshow', syncButtons);\n\n" + end_marker,
        'favorites resync listeners')
write(path, s)

# favorites_complete_fix: 4) Timeweb package/live checks.
path = '.github/workflows/deploy-timeweb-main.yml'
s = read(path)
if "grep -Fq 'KUZDVOR_FAVORITES' timeweb-dist/site.bundle.js" not in s:
    s = replace_once(s,
        '          test -s timeweb-dist/site.bundle.js\n          test -s timeweb-dist/xlsx.bundle.js',
        "          test -s timeweb-dist/site.bundle.js\n          grep -Fq 'KUZDVOR_FAVORITES' timeweb-dist/site.bundle.js\n          test -s timeweb-dist/xlsx.bundle.js",
        'Timeweb package favorites check')
if "grep -Fq 'KUZDVOR_FAVORITES' /tmp/timeweb-site.js" not in s:
    s = replace_once(s,
        "          grep -Fq 'С учётом доставки' /tmp/timeweb-site.js\n          curl -fsS",
        "          grep -Fq 'С учётом доставки' /tmp/timeweb-site.js\n          grep -Fq 'KUZDVOR_FAVORITES' /tmp/timeweb-site.js\n          curl -fsS",
        'Timeweb live favorites check')
write(path, s)

# Shared public-location helpers for E2E tests.
write('tests/location-helpers.js', r'''import {expect} from '@playwright/test';

export async function openLocationSelector(page) {
  const modal = page.locator('#catalogLocationGateModal');
  if (!await modal.isVisible().catch(() => false)) {
    const lockButton = page.locator('.catalog-location-lock button');
    if (await lockButton.isVisible().catch(() => false)) await lockButton.click();
    else await page.locator('a[href="#catalog"]').first().click();
  }
  await expect(modal).toBeVisible();
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
''')

write('tests/gate-e2e.spec.js', r'''import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openLocationSelector, openMobileAt} from './location-helpers.js';

async function chooseFirstGate(page) {
  await page.locator('.product-card').first().locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
}

async function revealGate(page, article) {
  const card = page.locator('.product-card').filter({hasText:article}).first();
  for (let attempt=0; attempt<10 && await card.count()===0; attempt+=1) {
    const more = page.locator('#showMoreButton');
    if (await more.isHidden()) break;
    await more.click();
  }
  await expect(card).toBeVisible();
  return card;
}

test('mobile customer can select Meleuz, choose gates and submit a lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:101,quote:{verified:true,total:submitted.total}})});
  });

  await openMobileAt(page, 'Мелеуз');
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Мелеуз');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
  await page.locator('#mobilePrimaryCta').click();
  await expect(page.locator('#leadRequest')).toBeVisible();
  await page.locator('#phoneInput').fill('+7 937 111-22-33');
  await page.locator('#consentInput').check();
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Отправить заявку');
  await page.locator('#mobilePrimaryCta').click();

  await expect(page.locator('#successModal')).toBeVisible();
  expect(submitted).toBeTruthy();
  expect(submitted.category).toBe('gates');
  expect(submitted.city).toBe('Мелеуз');
  expect(submitted.website).toBe('');
  expect(submitted.install).toBe(true);
  expect(submitted.total).toBeGreaterThan(0);
});

test('real color photo follows customer into calculator and lead', async ({page}) => {
  let submitted = null;
  await page.route('**/api/catalog-images', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({galleries:{
      'Арт.6':{photos:['/catalog/art-6-1.webp'],mediaType:'photo',colorPhotos:{graphite:'/catalog/art-28-1.webp'}}
    }})
  }));
  await page.route('**/api/leads', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:202,quote:{verified:true,total:submitted.total}})});
  });

  await openMobileAt(page, 'Мелеуз');
  const card = await revealGate(page, 'Арт.6');
  const graphite = card.locator('[data-profile-color="graphite"]');
  const mint = card.locator('[data-profile-color="mint"]');
  const colorToggle = card.locator('.profile-color-toggle');

  await expect(card.locator('.profile-color-picker-head strong')).toHaveText('Любой цвет профнастила');
  await expect(colorToggle).toHaveText('Посмотреть цвета');
  await expect(graphite).toBeHidden();
  await colorToggle.click();
  await expect(graphite).toBeVisible();
  await expect(card.locator('.profile-color-note')).toContainText('Цвет можно выбрать позже');
  await expect(graphite).toHaveClass(/is-photo-ready/);

  await graphite.click();
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-28-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeVisible();
  await expect(card.locator('.profile-color-status')).toContainText('Графит');

  await mint.click();
  await expect(card.locator('.profile-color-status')).toContainText('отдельного фото этой модели пока нет');
  await expect(card.locator('.product-image-open img')).toHaveAttribute('src', /art-6-1\.webp/);
  await expect(card.locator('.profile-color-reset')).toBeVisible();
  await expect(mint).toHaveAttribute('aria-pressed','true');

  await graphite.click();
  await card.locator('.product-image-open').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lightboxTitle')).toContainText('Графит');
  await expect(page.locator('#lightboxPrevious')).toBeHidden();
  await expect(page.locator('#lightboxNext')).toBeHidden();
  await page.locator('#lightboxClose').click();

  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#selectedProductImage')).toHaveAttribute('src', /art-28-1\.webp/);
  await expect(page.locator('#selectedProductCaption')).toContainText('Графит');

  await page.locator('#mobilePrimaryCta').click();
  await page.locator('#phoneInput').fill('+7 937 111-22-33');
  await page.locator('#consentInput').check();
  await page.locator('#mobilePrimaryCta').click();
  await expect(page.locator('#successModal')).toBeVisible();

  expect(submitted).toBeTruthy();
  expect(submitted.city).toBe('Мелеуз');
  expect(submitted.color).toBe('Графит · RAL 7024');
  expect(submitted.configuration.color).toBe('graphite');
  expect(submitted.configuration.colorLabel).toBe('Графит');
  expect(submitted.message).toContain('Предпочитаемый цвет: Графит · RAL 7024');
});

test('gate dimensions persist when comparing another design', async ({page}) => {
  await openMobileAt(page, 'Мелеуз');
  await chooseFirstGate(page);
  await page.locator('#sizeToggle').click();
  await page.locator('#widthInput').fill('3.8');
  await page.locator('#widthInput').blur();
  await expect(page.locator('#sizeSummaryValue')).toContainText('3,8');
  await page.locator('#changeProductButton').click();

  const secondGate = page.locator('.product-card').nth(1).locator('.select-product');
  await secondGate.scrollIntoViewIfNeeded();
  await secondGate.click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect(page.locator('#widthInput')).toHaveValue('3.8');
});

test('explicit delivery tariff is honored after installation place selection', async ({page}) => {
  await openMobileAt(page, 'Уфа');
  await chooseFirstGate(page);

  await expect(page.locator('#deliverySummary')).toBeVisible();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('Доставка уже учтена');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('Заказать бесплатный замер');
});

test('unknown destination outside standard area unlocks catalog with individual delivery quote', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Дальнее',resolvedName:'Дальнее, Республика Башкортостан',shortName:'Дальнее',price:null,distanceKm:180,rate:90,serviceAreaKm:150,outOfArea:true})
  }));

  await openMobileAt(page, 'Дальнее');
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Дальнее');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('индивидуально');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Ориентир без доставки');
  await expect(page.locator('#mobilePriceTotal')).toContainText('доставка индивидуально');
  await expect(page.locator('#mobilePrimaryCta')).toContainText('доставка индивидуально');
});

test('unknown destination can be routed and confirmed in installation place modal', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',shortName:'Тестово',price:9000,distanceKm:100,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестово');
  await expect(ui.status).toContainText('Найдено: Тестово');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await ui.action.click();
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
  await chooseFirstGate(page);
  await expect(page.locator('#deliverySummaryValue')).toContainText('Тестово');
  await expect(page.locator('.delivery-location-readonly-note')).toContainText('Доставка уже учтена');
  await expect(page.locator('#estimateTotalLabel')).toHaveText('Предварительно с доставкой');
});

test('delivery service error is sanitized in installation place selector and can be retried', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    await route.fulfill({status:502,contentType:'text/html',body:'<!DOCTYPE html><html><body>temporary gateway page</body></html>'});
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестовый посёлок');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Не удалось автоматически рассчитать доставку');
  await expect(ui.status).not.toContainText('Unexpected token');
  await expect(ui.status).not.toContainText('DOCTYPE');
  await expect(ui.status).toContainText('стоимость уточним вручную');
  await expect(ui.action).toHaveText('Повторить расчёт');
  await expect(page.locator('#catalog')).toHaveClass(/location-locked/);
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
});

test('delivery retry recovers in installation place selector when first response is temporary HTML', async ({page}) => {
  let requests = 0;
  await page.route('**/api/delivery?*', async route => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({status:503,contentType:'text/html',body:'<!DOCTYPE html><html><body>maintenance</body></html>'});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({shortName:'Тестово',resolvedName:'Тестово, Республика Башкортостан',price:9000,distanceKm:100,serviceAreaKm:150,outOfArea:false})});
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Тестово');
  await expect.poll(() => requests).toBe(2);
  await expect(ui.status).toContainText('Найдено: Тестово');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await ui.action.click();
  await expect(page.locator('#catalogGrid .product-card').first()).toBeVisible();
});
''')

write('tests/delivery-card-prices.spec.js', r'''import {test, expect} from '@playwright/test';
import {beginInstallationPlace, openLocationSelector, selectInstallationPlace} from './location-helpers.js';

async function openFirstGate(page, place='Мелеуз') {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const card = await selectInstallationPlace(page, place);
  await card.locator('.select-product').click();
  await expect(page.locator('#calculator')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.KUZDVOR_FORMULA_PRICE_SYNC_READY === true)).toBe(true);
  return card;
}

test('catalog card price immediately includes a known delivery tariff', async ({page}) => {
  const card = await openFirstGate(page, 'Уфа');
  await expect(page.locator('#deliverySummaryValue')).toContainText('Уфа');
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('82 600 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('107 600 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Уфа');
});

test('routed village is confirmed before catalog opens and keeps district in card prices', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await beginInstallationPlace(page, 'Ишеево');
  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
  await ui.action.click();

  const card = page.locator('#catalogGrid .product-card').first();
  await expect(card).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.KUZDVOR_FORMULA_PRICE_SYNC_READY === true)).toBe(true);
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 240 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 240 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Ишеево, Ишимбайский район');

  await card.evaluate(node => {
    const prices = node.querySelectorAll('.price-row strong');
    prices[0].textContent = '64 600 ₽';
    prices[1].textContent = '89 600 ₽';
  });
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 240 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 240 ₽');
  await page.waitForTimeout(1300);
  await expect(card.locator('.price-row').nth(0).locator('strong')).toHaveText('73 240 ₽');
  await expect(card.locator('.price-row').nth(1).locator('strong')).toHaveText('98 240 ₽');
  await expect(card.locator('.price-delivery-note')).toContainText('Ишеево, Ишимбайский район');
});

test('mobile installation place input uses search keyboard and Enter starts delivery calculation', async ({page}) => {
  await page.route('**/api/delivery?*', route => route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({requestedName:'Ишеево',resolvedName:'Ишеево, Ишимбайский район',shortName:'Ишеево, Ишимбайский район',localityName:'Ишеево',price:8640,distanceKm:96,rate:90,serviceAreaKm:150,outOfArea:false})
  }));

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const ui = await openLocationSelector(page);
  await expect(ui.input).toHaveAttribute('enterkeyhint','search');
  await ui.input.fill('Ишеево');
  await ui.input.press('Enter');
  await expect(ui.status).toContainText('Найдено: Ишеево, Ишимбайский район');
  await expect(ui.action).toHaveText('Да, это нужный пункт');
  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
});
''')

write('tests/lightbox-history.spec.js', r'''import {test, expect} from '@playwright/test';
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
''')

write('tests/favorites.spec.js', r'''import {test, expect} from '@playwright/test';
import {selectInstallationPlace} from './location-helpers.js';

test('customer can save gates and compare favorites after choosing installation place', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});

  await expect(page.locator('#catalogGrid .product-card').first()).toBeHidden();
  await selectInstallationPlace(page, 'Мелеуз');

  const cards = page.locator('#catalogGrid .product-card');
  await expect(cards.first()).toBeVisible();

  const firstSave = cards.first().locator('.favorite-toggle');
  await expect(firstSave).toBeVisible();
  await firstSave.click();
  await expect(firstSave).toHaveAttribute('aria-pressed','true');

  if (await cards.nth(1).isVisible().catch(() => false)) await cards.nth(1).locator('.favorite-toggle').click();

  const favoritesButton = page.locator('.favorites-open-button');
  await expect(favoritesButton).toBeVisible();
  await favoritesButton.click();

  await expect(page.locator('.favorites-modal')).toBeVisible();
  await expect(page.locator('.favorite-compare-card').first()).toBeVisible();
  await expect(page.locator('.favorites-location')).toContainText('Мелеуз');

  await page.reload({waitUntil:'domcontentloaded'});
  await selectInstallationPlace(page, 'Мелеуз');
  await expect(page.locator('.favorites-open-button .favorites-count')).not.toHaveText('0');
});
''')

print('favorites_complete_fix + new location E2E updates prepared')
