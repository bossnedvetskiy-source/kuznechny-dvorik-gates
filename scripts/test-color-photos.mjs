import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [site, ui, admin, worker, build] = await Promise.all([
  readFile('color-photo-site.js','utf8'),
  readFile('gate-page-ui.js','utf8'),
  readFile('admin-colors.js','utf8'),
  readFile('worker/catalog-colors-d1.js','utf8'),
  readFile('scripts/build.mjs','utf8')
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
assert(!site.includes('.profile-color-picker.is-color-empty .profile-color-swatches,'), 'Empty color-photo state must not hide the swatches');
assert(site.includes('цвет доступен — отдельного фото пока нет'), 'Missing-color copy must stay customer-friendly');
assert(site.includes('profile-color-reset') && site.includes('Вернуться к фото модели'), 'Color preview must offer a clear return to the regular gallery');
assert(site.includes('syncCalculatorPreview') && site.includes('selectedProductImage'), 'Selected real color photo must flow into calculator preview');
assert(site.includes('colorSelectionForProduct'), 'Color selection must be exposed to the gate flow');
assert(site.includes('KUZDVOR_LEADS') && site.includes('Предпочитаемый цвет:'), 'Lead payload must preserve the preferred color');
assert(site.includes('colorLabel') && site.includes('colorRal'), 'Lead configuration must keep human-readable color metadata');
assert(site.includes("lightbox.dataset.colorOnly = '1'"), 'Color lightbox must be isolated from the regular gallery');
assert(!site.includes('mix-blend-mode') && !site.includes('--profile-preview-color'), 'Automatic photo recoloring must not return');
assert(build.includes('colorPhotoSiteSource') && build.includes('adminColorsJsSource'), 'Production build must bundle public and admin color-photo modules');

console.log('Color photo flow checks: OK');
