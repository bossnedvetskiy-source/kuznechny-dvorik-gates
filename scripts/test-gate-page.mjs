import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const [html, app, runtime, ui, build, delivery, customer, leads, workerLeads, gateQuote, antiSpam, workerRuntime, adminLeads, adminHtml, adminJs] = await Promise.all([
  readFile('index.html','utf8'),
  readFile('app.js','utf8'),
  readFile('public-site-settings.js','utf8'),
  readFile('gate-page-ui.js','utf8'),
  readFile('scripts/build.mjs','utf8'),
  readFile('shared/delivery.js','utf8'),
  readFile('shared/customer-context.js','utf8'),
  readFile('shared/leads.js','utf8'),
  readFile('worker/leads-d1.js','utf8'),
  readFile('worker/gate-quote-d1.js','utf8'),
  readFile('worker/lead-antispam.js','utf8'),
  readFile('worker/runtime.js','utf8'),
  readFile('admin-leads.js','utf8'),
  readFile('admin.html','utf8'),
  readFile('admin.js','utf8')
]);

for (const obsolete of ['priceFilters','sortSelect','articleSearch','installCheck','colorSelect','data-client-ux-pass']) {
  assert(!html.includes(obsolete), `index.html still contains obsolete UI: ${obsolete}`);
  assert(!app.includes(obsolete), `app.js still contains obsolete UI dependency: ${obsolete}`);
}

for (const required of ['deliveryChooser','deliverySummary','postsCheck','mobile-size-summary','shared/customer-context.js','shared/delivery.js','shared/leads.js','gate-page-ui.js']) {
  assert(html.includes(required), `index.html missing required foundation element: ${required}`);
}

assert(app.includes("install:true"), 'Gate leads must record installation as included');
assert(app.includes("Ворота с калиткой + установка"), 'Base gate estimate must combine product and installation');
assert(app.includes('priceData.catalogInstallation'), 'Gate page must still use the configured installation price');
assert(app.includes('priceData.catalogPosts'), 'Gate page must still use the configured posts price');
assert(app.includes('dimensionState()'), 'Gate page must validate all four dimensions');
assert(app.includes('deliveryKind'), 'Gate page must expose delivery state to mobile CTA');
assert(app.includes("['fixed','calculated','out-of-area','error'].includes(deliveryState.kind)"), 'Lead submission must require a resolved or intentionally manual delivery state');
assert(html.includes('data-desktop-src="/hero-gates.jpg"') && !html.includes('img src="/hero-gates.jpg" alt="Готовые распашные'), 'Mobile HTML must not eagerly request the desktop hero');
assert(ui.includes('deliveryCanProceed'), 'Mobile CTA must require delivery before opening the lead form');
assert(!runtime.includes("document.createElement('style')"), 'Runtime settings must not inject CSS patches');
assert(!ui.includes("fetch('/api/leads'"), 'UI controller must not duplicate lead submission');
assert(delivery.includes('window.KUZDVOR_DELIVERY'), 'Shared delivery API missing');
assert(delivery.includes('window.KUZDVOR_CUSTOMER'), 'Delivery must reuse shared customer city');
assert(customer.includes('window.KUZDVOR_CUSTOMER'), 'Shared customer context API missing');
assert(leads.includes('window.KUZDVOR_LEADS'), 'Shared lead API missing');
assert(workerLeads.includes('consent_at') && workerLeads.includes('policy_version'), 'Server must store consent evidence');
const leadInsertSql = workerLeads.match(/INSERT INTO site_leads \([\s\S]*?\)\s*VALUES \([\s\S]*?\)`\)/)?.[0] || '';
assert.equal((leadInsertSql.match(/\?/g)||[]).length, 25, 'Lead INSERT must have exactly 25 bound placeholders');
assert(workerLeads.includes('LEAD_NOTIFY_WEBHOOK_URL'), 'Optional lead notification webhook missing');
assert(adminLeads.includes('Notification.requestPermission') && adminLeads.includes('30000'), 'Admin new-lead polling/notifications missing');
assert(build.includes('gatePageCss') && build.includes('customerContextSource') && build.includes('gatePageUiSource'), 'Production build does not bundle the gate foundation');

for (const ambiguous of ['Под ключ с новыми столбами','<b>Бесплатно</b> замер','Пункта нет в прайсе','Согласен на обработку данных.']) {
  assert(!html.includes(ambiguous), `Ambiguous public copy returned: ${ambiguous}`);
}
assert(!app.includes('Под ключ с новыми столбами') && !app.includes('Расчёт под ключ'), 'Ambiguous turnkey wording returned to gate runtime');
assert(!delivery.includes('Пункта нет в прайсе') && delivery.includes('нет готовой стоимости доставки'), 'Delivery copy must avoid internal price-list jargon');
assert(html.includes('Если подходящие столбы уже есть') && html.includes('без доставки'), 'Initial prices must clearly state posts condition and delivery exclusion');
assert(html.includes('Даю согласие на обработку персональных данных.'), 'Consent wording must explicitly mention personal data');
assert(ui.includes('Указать место установки'), 'Mobile CTA must work for cities, villages and settlements');
assert(!adminHtml.includes('cropHelp') && !adminHtml.includes('name="fitMode"'), 'Admin must not contain hidden crop UI');
assert(!adminJs.includes('setSelectedZoom') && !adminJs.includes('dragState'), 'Admin must not contain inactive crop/drag logic');
assert(html.includes('связка между столбами под землёй'), 'Posts wording must explain what the linkage means');
assert(html.includes('свяжемся с вами в рабочее время'), 'Lead confirmation must set a realistic contact expectation');
assert(html.includes('class="skip-link"'), 'Gate page must include a keyboard skip link');
assert(workerLeads.includes('calculateAuthoritativeGateQuote') && workerLeads.includes('client_total') && workerLeads.includes('quote_verified'), 'Gate leads must be recalculated and audited server-side');
assert(gateQuote.includes('calculateGateProductServer') && !gateQuote.includes('new Function') && !gateQuote.includes('eval('), 'Server gate quote must not use runtime code evaluation');
assert(antiSpam.includes('honeypotTriggered') && antiSpam.includes('LEAD_RATE_MAX'), 'Public lead anti-spam guard missing');
assert(html.includes('websiteInput') && app.includes('website:document.getElementById'), 'Lead honeypot must be wired end-to-end');
assert(workerRuntime.includes('serviceAreaKm') && workerRuntime.includes('outOfArea') && workerRuntime.includes('calculateUnknownDelivery(place, env)'), 'Delivery API must enforce runtime service area');
assert(delivery.includes('out-of-area') && ui.includes("['out-of-area','error']"), 'Out-of-area delivery must still allow a manual lead');
assert(html.includes('id="catalogWarranty"') && runtime.includes('catalogWarranty'), 'Warranty must use the shared runtime setting everywhere');

console.log('Gate page foundation checks: OK');
