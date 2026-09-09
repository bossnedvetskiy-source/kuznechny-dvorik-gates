import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [html, app, runtime, ui, build, delivery, customer, leads] = await Promise.all([
  readFile('index.html','utf8'),
  readFile('app.js','utf8'),
  readFile('public-site-settings.js','utf8'),
  readFile('gate-page-ui.js','utf8'),
  readFile('scripts/build.mjs','utf8'),
  readFile('shared/delivery.js','utf8'),
  readFile('shared/customer-context.js','utf8'),
  readFile('shared/leads.js','utf8')
]);

for (const obsolete of ['priceFilters','sortSelect','articleSearch','installCheck','colorSelect','data-client-ux-pass']) {
  assert(!html.includes(obsolete), `index.html still contains obsolete UI: ${obsolete}`);
  assert(!app.includes(obsolete), `app.js still contains obsolete UI dependency: ${obsolete}`);
}

for (const required of ['deliveryChooser','deliverySummary','postsCheck','mobile-size-summary','shared/customer-context.js','shared/delivery.js','shared/leads.js','gate-page-ui.js']) {
  assert(html.includes(required), `index.html missing required foundation element: ${required}`);
}

assert(app.includes("install:true"), 'Gate leads must record installation as included');
assert(app.includes("Ворота с калиткой и установка"), 'Base gate estimate must combine product and installation');
assert(app.includes('priceData.catalogInstallation'), 'Gate page must still use the configured installation price');
assert(app.includes('priceData.catalogPosts'), 'Gate page must still use the configured posts price');
assert(!runtime.includes("document.createElement('style')"), 'Runtime settings must not inject CSS patches');
assert(!ui.includes("fetch('/api/leads'"), 'UI controller must not duplicate lead submission');
assert(delivery.includes('window.KUZDVOR_DELIVERY'), 'Shared delivery API missing');
assert(delivery.includes('window.KUZDVOR_CUSTOMER'), 'Delivery must reuse shared customer city');
assert(customer.includes('window.KUZDVOR_CUSTOMER'), 'Shared customer context API missing');
assert(leads.includes('window.KUZDVOR_LEADS'), 'Shared lead API missing');
assert(build.includes('gatePageCss') && build.includes('customerContextSource') && build.includes('gatePageUiSource'), 'Production build does not bundle the gate foundation');

console.log('Gate page foundation checks: OK');
