import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [site, ui, admin, worker, quote, build, publicSite] = await Promise.all([
  readFile('color-photo-site.js','utf8'),
  readFile('gate-page-ui.js','utf8'),
  readFile('admin-colors.js','utf8'),
  readFile('worker/catalog-colors-d1.js','utf8'),
  readFile('worker/gate-quote-d1.js','utf8'),
  readFile('scripts/build.mjs','utf8'),
  readFile('public-site-settings.js','utf8')
]);

const expected = ['chocolate','graphite','moss','mint','wine'];
for (const id of expected) {
  assert(site.includes(`id:'${id}'`), `Public color UI missing ${id}`);
  assert(ui.includes(`id:'${id}'`), `Gate picker missing ${id}`);
  assert(admin.includes(`id:'${id}'`), `Admin color slots missing ${id}`);
  assert(worker.includes(`'${id}'`), `Server color allowlist missing ${id}`);
}

assert(site.includes('Выберите цвет профнастила'), 'Color palette must stay visible even before color photos are uploaded');
assert(site.includes('Нажмите на нужный цвет'), 'Empty color-photo state must invite the customer to use the palette');
assert(site.includes('✓ Выбран:'), 'A color must remain selected even when its dedicated photo is missing');
assert(site.includes('отдельного фото этой модели пока нет'), 'Missing-photo copy must explain that the color is still selected');
assert(site.includes('profile-color-reset') && site.includes('Сбросить выбор цвета'), 'Selected color must have a clear reset action');
assert(site.includes('syncCalculatorPreview') && site.includes('selectedProductImage'), 'Selected color must flow into calculator preview');
assert(site.includes('colorSelectionForProduct'), 'Color selection must be exposed to the gate flow');
assert(site.includes('KUZDVOR_LEADS') && site.includes('Предпочитаемый цвет:'), 'Lead payload must preserve the preferred color');
assert(site.includes('colorLabel') && site.includes('colorRal'), 'Lead configuration must keep human-readable color metadata');
assert(site.includes('utm_medium') && site.includes('utm_content') && site.includes('utm_term') && site.includes('yclid'), 'Lead payload must preserve advertising attribution');
assert(site.includes('Как проходит заказ') && site.includes('Договор и 50%'), 'Customer journey block must explain the order process');
assert(site.includes('application/ld+json') && site.includes('LocalBusiness'), 'Public page must install structured business data');
assert(site.includes('repeating-linear-gradient(90deg'), 'Color swatches must contain corrugated-sheet texture');
assert(!publicSite.includes('sheetTexture') && !publicSite.includes('applyProfileSheetTexture'), 'Profile texture must stay in the color UI instead of runtime settings');
assert(quote.includes('quote.color') && quote.includes('Предпочитаемый цвет:'), 'Authoritative server message must preserve selected color');
assert(site.includes("lightbox.dataset.colorOnly = '1'"), 'Color lightbox must be isolated from the regular gallery');
assert(!site.includes('mix-blend-mode') && !site.includes('--profile-preview-color'), 'Automatic photo recoloring must not return');
assert(build.includes('colorPhotoSiteSource') && build.includes('adminColorsJsSource'), 'Production build must bundle public and admin color-photo modules');

console.log('Color photo flow checks: OK');