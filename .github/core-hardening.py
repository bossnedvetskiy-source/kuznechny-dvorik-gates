from pathlib import Path


def repl(path, old, new, label, count=1):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old in s:
        s=s.replace(old,new,count)
        p.write_text(s,encoding='utf-8')
        return
    if new not in s:
        raise SystemExit(f'{label}: anchor not found in {path}')

# 1) Public page: anti-spam field + fully runtime warranty + clear service-area copy.
repl('index.html',
     '<div class="catalog-trust-strip" aria-label="Почему нам доверяют"><span>Собственное производство</span><span>Бесплатный замер</span><span>Договор</span><span>Гарантия 3 года</span></div>',
     '<div class="catalog-trust-strip" aria-label="Почему нам доверяют"><span>Собственное производство</span><span>Бесплатный замер</span><span>Договор</span><span id="catalogWarranty">Гарантия 3 года</span></div>',
     'runtime catalog warranty')
repl('index.html',
     '            <label class="lead-comment" id="commentLabel">Комментарий<textarea id="commentInput" placeholder="Например: нужен демонтаж старых ворот"></textarea></label>\n          </div>',
     '            <label class="lead-comment" id="commentLabel">Комментарий<textarea id="commentInput" placeholder="Например: нужен демонтаж старых ворот"></textarea></label>\n            <label class="anti-spam-field" aria-hidden="true">Ваш сайт<input id="websiteInput" name="website" type="text" tabindex="-1" autocomplete="off"></label>\n          </div>',
     'lead honeypot')
repl('index.html',
     'По Мелеузу — бесплатно. Для некоторых населённых пунктов используется готовая стоимость доставки, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. Если маршрут не найдётся, заявку всё равно можно отправить — стоимость доставки уточним при подтверждении заявки.',
     'По Мелеузу — бесплатно. Для некоторых населённых пунктов используется готовая стоимость доставки, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. Если место установки дальше стандартной зоны выезда, доставку рассчитаем индивидуально. Если маршрут не найдётся, заявку всё равно можно отправить — стоимость доставки уточним при подтверждении заявки.',
     'delivery area help', 1)
repl('index.html',
     'По Мелеузу доставка бесплатная. Для некоторых населённых пунктов действует готовая стоимость, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. После выбора места установки доставка учитывается в итоговой сумме; если маршрут не найдётся, стоимость уточним при подтверждении заявки.',
     'По Мелеузу доставка бесплатная. Для некоторых населённых пунктов действует готовая стоимость, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. В пределах стандартной зоны выезда доставка учитывается в итоговой сумме; за её пределами или если маршрут не найдётся, стоимость уточним при подтверждении заявки.',
     'faq area copy', 1)

# Off-screen honeypot: accessible tree and keyboard excluded.
p=Path('gate-page.css'); s=p.read_text(encoding='utf-8')
rule='.anti-spam-field{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}\n'
if '.anti-spam-field{' not in s:
    s=rule+s
p.write_text(s,encoding='utf-8')

# 2) Runtime settings: no static warranty islands.
repl('public-site-settings.js',
     "  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');\n  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;",
     "  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');\n  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;\n  const catalogWarranty = document.getElementById('catalogWarranty');\n  if (catalogWarranty && site.warrantyYears) catalogWarranty.textContent = `Гарантия ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;",
     'catalog warranty runtime')
repl('worker/site-settings-d1.js',
     "  trustText: 'Собственное производство в Мелеузе. Бесплатно замерим проём, согласуем комплектацию и зафиксируем стоимость в договоре.',",
     "  trustText: 'Собственное производство в Мелеузе. Бесплатно замерим проём, согласуем комплектацию и зафиксируем стоимость в договоре.',",
     'site defaults noop')

# 3) Shared lead wording.
repl('shared/leads.js',
     "if (!String(city || '').trim()) return {ok:false, field:'city', message:'Укажите населённый пункт'};",
     "if (!String(city || '').trim()) return {ok:false, field:'city', message:'Укажите место установки'};",
     'shared lead city wording')
repl('shared/leads.js',
     "if (!consent) return {ok:false, field:'consent', message:'Подтвердите согласие на обработку данных'};",
     "if (!consent) return {ok:false, field:'consent', message:'Подтвердите согласие на обработку персональных данных'};",
     'shared lead consent wording')

# 4) Gate client: out-of-area is a valid lead state, but delivery stays pending/individual.
repl('app.js',
     "  const delivery=deliveryController?.line() || {name:'Населённый пункт',value:null,display:cityInput.value.trim()||'Не выбран',resolved:false};",
     "  const delivery=deliveryController?.line() || {name:'Место установки',value:null,display:cityInput.value.trim()||'Не выбран',resolved:false};",
     'gate fallback delivery label')
repl('app.js',
     "  if(deliveryKind==='error') note='Доставку автоматически рассчитать не удалось. Уточним её при подтверждении заявки.';\n  else if(deliveryPending)note+=' Укажите и подтвердите место установки, чтобы учесть доставку.';",
     "  if(deliveryKind==='out-of-area') note=`Место установки дальше стандартной зоны выезда ${Number((window.SITE_SETTINGS||{}).serviceAreaKm)||150} км. Доставку рассчитаем индивидуально при подтверждении заявки.`;\n  else if(deliveryKind==='error') note='Доставку автоматически рассчитать не удалось. Уточним её при подтверждении заявки.';\n  else if(deliveryPending)note+=' Укажите и подтвердите место установки, чтобы учесть доставку.';",
     'out of area estimate note')
repl('app.js',
     "    if(['fixed','calculated','error'].includes(state?.kind)){",
     "    if(['fixed','calculated','out-of-area','error'].includes(state?.kind)){",
     'track delivery states')
repl('app.js',
     "  const {product,lines,total,deliveryPending}=calcData();",
     "  const {product,lines,total,deliveryPending,deliveryKind}=calcData();",
     'message delivery kind', 1)
repl('app.js',
     "    deliveryPending?'Доставка ещё не рассчитана — нужно уточнить.':'Доставка учтена в общей сумме.',",
     "    deliveryKind==='out-of-area'?`Доставка: место установки дальше стандартной зоны ${Number((window.SITE_SETTINGS||{}).serviceAreaKm)||150} км — индивидуальный расчёт.`:deliveryPending?'Доставка ещё не рассчитана — нужно уточнить.':'Доставка учтена в общей сумме.',",
     'message out of area')
repl('app.js',
     "    total:Math.round(total),deliveryPending:Boolean(deliveryPending),consent:true,policyVersion:'2026-09-09',comment:commentInput.value.trim(),message:buildMessage()",
     "    total:Math.round(total),deliveryPending:Boolean(deliveryPending),deliveryKind:deliveryController?.getState?.()?.kind||'empty',website:document.getElementById('websiteInput')?.value||'',consent:true,policyVersion:'2026-09-09',comment:commentInput.value.trim(),message:buildMessage()",
     'lead honeypot payload')
repl('app.js',
     "  if(!['fixed','calculated','error'].includes(deliveryState.kind)){",
     "  if(!['fixed','calculated','out-of-area','error'].includes(deliveryState.kind)){",
     'allow out of area lead')

repl('gate-page-ui.js',
     "    deliveryCanProceed = event.detail?.deliveryPending === false || deliveryKind === 'error';",
     "    deliveryCanProceed = event.detail?.deliveryPending === false || ['out-of-area','error'].includes(deliveryKind);",
     'mobile out of area lead')

# 5) Worker route calculation: runtime delivery rate + service-area enforcement + cache keyed by settings.
repl('worker/runtime.js',
     'https://kuznechny-dvorik-gates.dragnaledon1284.chatgpt.site',
     'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev',
     'worker public origin', 99)
repl('worker/runtime.js',
     "async function calculateUnknownDelivery(place) {\n  const cacheKey = place.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/gi, '');",
     "async function calculateUnknownDelivery(place, env) {\n  const site = await loadSiteProfile(env);\n  const runtimeRate = Math.max(0, Number(site.deliveryRate) || FALLBACK_RATE);\n  const serviceAreaKm = Math.max(0, Number(site.serviceAreaKm) || 150);\n  const cacheKey = `${place.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/gi, '')}:${runtimeRate}:${serviceAreaKm}`;",
     'delivery runtime settings')
repl('worker/runtime.js',
     "    price: distanceKm * FALLBACK_RATE,\n    distanceKm,\n    rate: FALLBACK_RATE,",
     "    price: distanceKm > serviceAreaKm ? null : distanceKm * runtimeRate,\n    distanceKm,\n    rate: runtimeRate,\n    serviceAreaKm,\n    outOfArea: distanceKm > serviceAreaKm,",
     'delivery area result')
repl('worker/runtime.js',
     'return json(await calculateUnknownDelivery(place), 200, \'public, max-age=86400\');',
     'return json(await calculateUnknownDelivery(place, env), 200, \'public, max-age=86400\');',
     'delivery api env')

# 6) Build: decode Excel-derived model once at build time and emit server-safe formula functions (no eval/new Function in Worker).
p=Path('scripts/build.mjs'); s=p.read_text(encoding='utf-8')
if "from 'node:zlib'" not in s:
    s=s.replace("import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';",
                "import { readFile, rm, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';\nimport { gunzipSync } from 'node:zlib';")

s=s.replace('catalogMediaSource, leadsSource] = await Promise.all([',
            'catalogMediaSource, gateQuoteSource, leadAntispamSource, leadsSource] = await Promise.all([')
s=s.replace("  readFile('worker/catalog-media-d1.js', 'utf8'),\n  readFile('worker/leads-d1.js', 'utf8')",
            "  readFile('worker/catalog-media-d1.js', 'utf8'),\n  readFile('worker/gate-quote-d1.js', 'utf8'),\n  readFile('worker/lead-antispam.js', 'utf8'),\n  readFile('worker/leads-d1.js', 'utf8')")

anchor="const gateCalcBundle = gateCalcSources.join('\\n');"
if 'const serverGateModelSource' not in s:
    code=r'''const gateCalcBundle = gateCalcSources.join('\n');

const gatePricesMatch = gateCalcSources[0].match(/window\.GATE_CALC_PRICES\s*=\s*({[\s\S]*});?\s*$/);
if (!gatePricesMatch) throw new Error('Не удалось подготовить серверные цены формул ворот');
const defaultGateCalcPrices = Function(`"use strict"; return (${gatePricesMatch[1]});`)();
const compressedGateModels = gateCalcSources.slice(1,5).map((source,index) => {
  const match = source.match(/\+\s*'([^']+)'\s*;?\s*$/);
  if (!match) throw new Error(`Не удалось прочитать часть расчётных моделей ${index+1}`);
  return match[1];
}).join('');
const gateModelsScript = gunzipSync(Buffer.from(compressedGateModels, 'base64')).toString('utf8');
const gateModelsMatch = gateModelsScript.match(/window\.GATE_CALC_MODELS\s*=\s*({[\s\S]*});?\s*$/);
if (!gateModelsMatch) throw new Error('Не удалось распаковать серверные модели ворот');
const rawGateModels = Function(`"use strict"; return (${gateModelsMatch[1]});`)();
const serverGateModelSource = `{models:{${Object.entries(rawGateModels.models || {}).map(([key,model]) => {
  const formulas = Object.entries(model.formulas || {}).map(([ref,expr]) => `${JSON.stringify(ref)}:(ctx,p,v,sum,roundExcel,roundUp)=>(${expr})`).join(',');
  return `${JSON.stringify(key)}:{gateRef:${JSON.stringify(model.gateRef)},wicketRef:${JSON.stringify(model.wicketRef)},literals:${JSON.stringify(model.literals || {})},formulas:{${formulas}}}`;
}).join(',')}}}`;'''
    if anchor not in s: raise SystemExit('build gate bundle anchor missing')
    s=s.replace(anchor,code,1)

s=s.replace("  + siteSettingsSource.trim() + '\\n\\n'\n  + catalogMediaSource.trim() + '\\n\\n'\n  + leadsSource.trim()",
            "  + siteSettingsSource.trim() + '\\n\\n'\n  + leadAntispamSource.trim() + '\\n\\n'\n  + gateQuoteSource.trim() + '\\n\\n'\n  + catalogMediaSource.trim() + '\\n\\n'\n  + leadsSource.trim()")

s=s.replace("  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;'",
            "  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;\\nconst DEFAULT_GATE_CALC_PRICES = __DEFAULT_GATE_CALC_PRICES__;\\nconst DEFAULT_GATE_CALC_MODELS = __DEFAULT_GATE_CALC_MODELS__;\\nconst DEFAULT_DELIVERY_PRICES = __DEFAULT_DELIVERY_PRICES__;'",1)

old_rate='''patchedWorkerSource = patchedWorkerSource
  .replace(
    "  const result = {\\n    requestedName: place,\\n    resolvedName: selected.display_name,\\n    shortName: [...new Set(shortNameParts)].join(', ') || selected.display_name,\\n    price: distanceKm * FALLBACK_RATE,\\n    distanceKm,\\n    rate: FALLBACK_RATE,",
    "  const runtimeDeliveryRate = (await loadSiteProfile(env)).deliveryRate;\\n  const result = {\\n    requestedName: place,\\n    resolvedName: selected.display_name,\\n    shortName: [...new Set(shortNameParts)].join(', ') || selected.display_name,\\n    price: distanceKm * runtimeDeliveryRate,\\n    distanceKm,\\n    rate: runtimeDeliveryRate,"
  )
  .replaceAll('https://kuznechny-dvorik-gates.dragnaledon1284.chatgpt.site', 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev');'''
new_rate="patchedWorkerSource = patchedWorkerSource.replaceAll('https://kuznechny-dvorik-gates.dragnaledon1284.chatgpt.site', 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev');"
if old_rate in s:
    s=s.replace(old_rate,new_rate,1)

s=s.replace("  .replace('__DEFAULT_PRICES__', JSON.stringify(defaultPrices))\n  .replace('__DELIVERY_ORIGIN__'",
            "  .replace('__DEFAULT_PRICES__', JSON.stringify(defaultPrices))\n  .replace('__DEFAULT_GATE_CALC_PRICES__', JSON.stringify(defaultGateCalcPrices))\n  .replace('__DEFAULT_GATE_CALC_MODELS__', serverGateModelSource)\n  .replace('__DEFAULT_DELIVERY_PRICES__', JSON.stringify(deliveryPrices))\n  .replace('__DELIVERY_ORIGIN__'",1)

assert_anchor="const worker = patchedWorkerSource\n"
if 'calculateAuthoritativeGateQuote' not in s.split(assert_anchor)[0][-800:]:
    guard="""for (const requiredWorkerFeature of ['calculateAuthoritativeGateQuote','consumeLeadAttempt','DEFAULT_GATE_CALC_MODELS','DEFAULT_DELIVERY_PRICES']) {\n  if (!patchedWorkerSource.includes(requiredWorkerFeature)) throw new Error(`Worker assembly missing ${requiredWorkerFeature}`);\n}\n\n"""
    if assert_anchor not in s: raise SystemExit('worker final anchor missing')
    s=s.replace(assert_anchor,guard+assert_anchor,1)
p.write_text(s,encoding='utf-8')

# 7) Foundation tests: authoritative quote, antispam, radius, runtime warranty.
p=Path('scripts/test-gate-page.mjs'); s=p.read_text(encoding='utf-8')
s=s.replace('workerLeads, adminLeads, adminHtml, adminJs] = await Promise.all([',
            'workerLeads, gateQuote, antiSpam, workerRuntime, adminLeads, adminHtml, adminJs] = await Promise.all([')
s=s.replace("  readFile('worker/leads-d1.js','utf8'),\n  readFile('admin-leads.js','utf8'),",
            "  readFile('worker/leads-d1.js','utf8'),\n  readFile('worker/gate-quote-d1.js','utf8'),\n  readFile('worker/lead-antispam.js','utf8'),\n  readFile('worker/runtime.js','utf8'),\n  readFile('admin-leads.js','utf8'),")
s=s.replace("assert.equal((leadInsertSql.match(/\\?/g)||[]).length, 21, 'Lead INSERT must have exactly 21 bound placeholders');",
            "assert.equal((leadInsertSql.match(/\\?/g)||[]).length, 25, 'Lead INSERT must have exactly 25 bound placeholders');")
marker="assert(html.includes('class=\"skip-link\"'), 'Gate page must include a keyboard skip link');"
addition=marker+"\nassert(workerLeads.includes('calculateAuthoritativeGateQuote') && workerLeads.includes('client_total') && workerLeads.includes('quote_verified'), 'Gate leads must be recalculated and audited server-side');\nassert(gateQuote.includes('calculateGateProductServer') && !gateQuote.includes('new Function') && !gateQuote.includes('eval('), 'Server gate quote must not use runtime code evaluation');\nassert(antiSpam.includes('honeypotTriggered') && antiSpam.includes('LEAD_RATE_MAX'), 'Public lead anti-spam guard missing');\nassert(html.includes('websiteInput') && app.includes('website:document.getElementById'), 'Lead honeypot must be wired end-to-end');\nassert(workerRuntime.includes('serviceAreaKm') && workerRuntime.includes('outOfArea') && workerRuntime.includes('calculateUnknownDelivery(place, env)'), 'Delivery API must enforce runtime service area');\nassert(delivery.includes('out-of-area') && ui.includes(\"['out-of-area','error']\"), 'Out-of-area delivery must still allow a manual lead');\nassert(html.includes('id=\"catalogWarranty\"') && runtime.includes('catalogWarranty'), 'Warranty must use the shared runtime setting everywhere');"
if addition not in s:
    if marker not in s: raise SystemExit('foundation test marker missing')
    s=s.replace(marker,addition,1)
p.write_text(s,encoding='utf-8')

print('Core hardening patch applied')
