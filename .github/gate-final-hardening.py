from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'{label}: anchor not found in {path}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')

# 1) Hero image: do not give mobile browsers the heavy desktop hero URL.
replace_once(
    'index.html',
    '<figure class="hero-photo"><img src="/hero-gates.jpg" alt="Готовые распашные ворота с калиткой производства Кузнечного Дворика" fetchpriority="high"></figure>',
    '<figure class="hero-photo"><img id="heroDesktopImage" data-desktop-src="/hero-gates.jpg" alt="Готовые распашные ворота с калиткой производства Кузнечного Дворика" decoding="async"></figure>',
    'hero image'
)

# 2) App: reusable goal helper, desktop delivery gate, consent proof, funnel goals.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = "const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';\nconst escapeHTML"
new = "const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';\nconst reachGoal = (name, params = {}) => { try { if (typeof window.ym === 'function') window.ym(107269914, 'reachGoal', name, params); } catch {} };\nconst escapeHTML"
if old not in s: raise SystemExit('goal helper anchor not found')
s=s.replace(old,new,1)

old = "showMoreButton.addEventListener('click',()=>{visibleCount+=pageSize();renderProducts()});"
new = "showMoreButton.addEventListener('click',()=>{visibleCount+=pageSize();reachGoal('catalog_show_more',{visible:Math.min(visibleCount,catalogProducts.length),total:catalogProducts.length});renderProducts()});"
if old not in s: raise SystemExit('show more anchor not found')
s=s.replace(old,new,1)

old = "postsCheck.addEventListener('change',()=>{\n  try{sessionStorage.setItem(POSTS_MEMORY_KEY,postsCheck.checked?'1':'0')}catch{}\n  updateSelectedPreview();\n  calculate();\n});"
new = "postsCheck.addEventListener('change',()=>{\n  try{sessionStorage.setItem(POSTS_MEMORY_KEY,postsCheck.checked?'1':'0')}catch{}\n  reachGoal('gate_posts_toggle',{article:selectedProduct().art,enabled:postsCheck.checked?1:0});\n  updateSelectedPreview();\n  calculate();\n});"
if old not in s: raise SystemExit('posts anchor not found')
s=s.replace(old,new,1)

old = "window.KUZDVOR_CUSTOMER.bindContact({nameInput,phoneInput});\ndeliveryController=window.KUZDVOR_DELIVERY.createController({"
new = "window.KUZDVOR_CUSTOMER.bindContact({nameInput,phoneInput});\nlet lastDeliveryGoalKey='';\ndeliveryController=window.KUZDVOR_DELIVERY.createController({"
if old not in s: raise SystemExit('delivery init anchor not found')
s=s.replace(old,new,1)
old = "  changeButton:document.getElementById('deliveryChange'),\n  onChange:()=>calculate()\n});"
new = "  changeButton:document.getElementById('deliveryChange'),\n  onChange:(state)=>{\n    calculate();\n    if(['fixed','calculated','error'].includes(state?.kind)){\n      const city=deliveryController?.selectedCityName?.()||cityInput.value.trim();\n      const key=`${state.kind}:${city}`;\n      if(key!==lastDeliveryGoalKey){lastDeliveryGoalKey=key;reachGoal('delivery_result',{kind:state.kind,city});}\n    }\n  }\n});"
if old not in s: raise SystemExit('delivery callback anchor not found')
s=s.replace(old,new,1)

old = "    total:Math.round(total),deliveryPending:Boolean(deliveryPending),comment:commentInput.value.trim(),message:buildMessage()"
new = "    total:Math.round(total),deliveryPending:Boolean(deliveryPending),consent:true,policyVersion:'2026-09-09',comment:commentInput.value.trim(),message:buildMessage()"
if old not in s: raise SystemExit('lead payload anchor not found')
s=s.replace(old,new,1)

old = "  const validation=window.KUZDVOR_LEADS.validate({phone:phoneInput.value,city:selectedCityName(),consent:consentInput.checked});"
new = "  const deliveryState=deliveryController?.getState?.()||{kind:'empty'};\n  if(!['fixed','calculated','error'].includes(deliveryState.kind)){\n    const message=deliveryState.kind==='confirm'?'Подтвердите найденный населённый пункт':deliveryState.kind==='loading'?'Дождитесь расчёта доставки':'Сначала укажите населённый пункт и рассчитайте доставку';\n    reachGoal('lead_validation_error',{field:'delivery',kind:deliveryState.kind});\n    document.getElementById('deliveryChooser')?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});\n    if(['empty','pending'].includes(deliveryState.kind)) setTimeout(()=>cityInput.focus({preventScroll:true}),260);\n    showToast(message);\n    return;\n  }\n  const validation=window.KUZDVOR_LEADS.validate({phone:phoneInput.value,city:selectedCityName(),consent:consentInput.checked});"
if old not in s: raise SystemExit('delivery validation anchor not found')
s=s.replace(old,new,1)

old = "    showToast(validation.message);return;"
new = "    reachGoal('lead_validation_error',{field:validation.field});\n    showToast(validation.message);return;"
if old not in s: raise SystemExit('validation goal anchor not found')
s=s.replace(old,new,1)
s=s.replace("if(window.ym)ym(107269914,'reachGoal','lead_saved',{article:selectedProduct().art,city:selectedCityName()});", "reachGoal('lead_saved',{article:selectedProduct().art,city:selectedCityName()});", 1)
s=s.replace("document.querySelectorAll('a[href^=\"tel:\"]').forEach(link=>link.addEventListener('click',()=>{if(window.ym)ym(107269914,'reachGoal','phone_click')}));", "document.querySelectorAll('a[href^=\"tel:\"]').forEach(link=>link.addEventListener('click',()=>reachGoal('phone_click')));", 1)
p.write_text(s,encoding='utf-8')

# 3) Mobile/desktop UI: lazy desktop hero, size/edit and lead-open goals.
p=Path('gate-page-ui.js')
s=p.read_text(encoding='utf-8')
old="  const mobile = window.matchMedia('(max-width: 620px)');\n  const calculator"
new="  const mobile = window.matchMedia('(max-width: 620px)');\n  const desktopHero = window.matchMedia('(min-width: 621px)');\n  const heroImage = document.getElementById('heroDesktopImage');\n  const trackGoal = (name, params = {}) => { try { if (typeof window.ym === 'function') window.ym(107269914, 'reachGoal', name, params); } catch {} };\n  const syncHeroImage = () => {\n    if (!heroImage) return;\n    if (desktopHero.matches && !heroImage.hasAttribute('src')) {\n      heroImage.loading = 'eager';\n      heroImage.fetchPriority = 'high';\n      heroImage.src = heroImage.dataset.desktopSrc || '/hero-gates.jpg';\n    } else if (!desktopHero.matches && heroImage.hasAttribute('src')) {\n      heroImage.removeAttribute('src');\n    }\n  };\n  syncHeroImage();\n  desktopHero.addEventListener('change', syncHeroImage);\n  const calculator"
if old not in s: raise SystemExit('hero loader ui anchor not found')
s=s.replace(old,new,1)
old="    if (open) setTimeout(() => widthInput?.focus({preventScroll:true}), 40);"
new="    if (open) { trackGoal('gate_size_edit_open'); setTimeout(() => widthInput?.focus({preventScroll:true}), 40); }"
if old not in s: raise SystemExit('size goal anchor not found')
s=s.replace(old,new,1)
old="    leadOpen = true;\n    document.body.classList.add('mobile-lead-open');"
new="    leadOpen = true;\n    trackGoal('lead_form_open');\n    document.body.classList.add('mobile-lead-open');"
if old not in s: raise SystemExit('lead open goal anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 4) Four dimensions remain a symmetric 2x2 grid on mobile.
p=Path('gate-page.css')
s=p.read_text(encoding='utf-8')
s=s.replace('.dimensions.is-open label:last-child{grid-column:1/-1}', '', 1)
p.write_text(s,encoding='utf-8')

# 5) Regression for corrected Art.9-3 non-standard calculation.
p=Path('scripts/test-gate-calculator.mjs')
s=p.read_text(encoding='utf-8')
anchor="console.table(rows);\nconsole.log(`Control cases: ${cases.length}; failures: ${failures}`);"
insert="""const correctedRegressions = [
  ['9-3','Ворота 3,8; калитка 0,9',3.8,1.8,0.9,1.8,109400],
];
for (const [article, scenario, gateWidth, gateHeight, wicketWidth, wicketHeight, expectedTotal] of correctedRegressions) {
  const actual = context.GATE_CALC.calculateGate({article, gateWidth, gateHeight, wicketWidth, wicketHeight});
  const ok = actual.total === expectedTotal;
  if (!ok) failures += 1;
  rows.push({article, scenario, excelTotal: expectedTotal, siteTotal: actual.total, diffRub: actual.total - expectedTotal, ok});
}

console.table(rows);
console.log(`Control cases: ${cases.length + correctedRegressions.length}; failures: ${failures}`);"""
if anchor not in s: raise SystemExit('calculator regression anchor not found')
s=s.replace(anchor,insert,1)
p.write_text(s,encoding='utf-8')

# 6) Server: record consent proof and support optional lead webhook notification.
p=Path('worker/leads-d1.js')
s=p.read_text(encoding='utf-8')
old="const LEAD_CATEGORIES = new Set(['gates', 'canopy', 'forged-fence', 'profsheet-fence', 'picket-fence']);\n"
new=old+"\nasync function notifyNewLead(env, lead) {\n  const endpoint = String(env.LEAD_NOTIFY_WEBHOOK_URL || '').trim();\n  if (!endpoint) return;\n  const headers = {'content-type':'application/json'};\n  const token = String(env.LEAD_NOTIFY_WEBHOOK_TOKEN || '').trim();\n  if (token) headers.authorization = `Bearer ${token}`;\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), 1500);\n  try {\n    const response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify({event:'new_lead', lead}), signal:controller.signal});\n    if (!response.ok) console.warn('Lead notification webhook returned', response.status);\n  } catch (error) {\n    console.warn('Lead notification webhook failed', String(error?.message || error));\n  } finally {\n    clearTimeout(timer);\n  }\n}\n"
if old not in s: raise SystemExit('worker notify anchor not found')
s=s.replace(old,new,1)
old="    total INTEGER NOT NULL DEFAULT 0,\n    delivery_pending INTEGER NOT NULL DEFAULT 0,\n    comment TEXT NOT NULL DEFAULT '',"
new="    total INTEGER NOT NULL DEFAULT 0,\n    delivery_pending INTEGER NOT NULL DEFAULT 0,\n    consent INTEGER NOT NULL DEFAULT 0,\n    consent_at TEXT NOT NULL DEFAULT '',\n    policy_version TEXT NOT NULL DEFAULT '',\n    comment TEXT NOT NULL DEFAULT '',"
if old not in s: raise SystemExit('worker schema consent anchor not found')
s=s.replace(old,new,1)
old="    \"ALTER TABLE site_leads ADD COLUMN configuration_json TEXT NOT NULL DEFAULT '{}'\"\n  ];"
new="    \"ALTER TABLE site_leads ADD COLUMN configuration_json TEXT NOT NULL DEFAULT '{}'\",\n    \"ALTER TABLE site_leads ADD COLUMN consent INTEGER NOT NULL DEFAULT 0\",\n    \"ALTER TABLE site_leads ADD COLUMN consent_at TEXT NOT NULL DEFAULT ''\",\n    \"ALTER TABLE site_leads ADD COLUMN policy_version TEXT NOT NULL DEFAULT ''\"\n  ];"
if old not in s: raise SystemExit('worker migrations anchor not found')
s=s.replace(old,new,1)
old="  const message = leadText(body.message, 8000);\n  const width"
new="  const message = leadText(body.message, 8000);\n  const consent = body.consent === true;\n  const policyVersion = leadText(body.policyVersion, 64);\n  const width"
if old not in s: raise SystemExit('worker parse consent anchor not found')
s=s.replace(old,new,1)
old="  if (phoneDigits.length < 10 || phoneDigits.length > 11) return json({error: 'Укажите корректный номер телефона'}, 400);\n  if (!city || !message)"
new="  if (phoneDigits.length < 10 || phoneDigits.length > 11) return json({error: 'Укажите корректный номер телефона'}, 400);\n  if (!consent) return json({error: 'Подтвердите согласие на обработку данных'}, 400);\n  if (!city || !message)"
if old not in s: raise SystemExit('worker consent validation anchor not found')
s=s.replace(old,new,1)
old="    width, wicket_width, wicket_height, height, install, posts, color, total, delivery_pending, comment, message\n  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)\n    .bind(\n      name, phone, city, category, source, article, productTitle, configurationJson,\n      width, wicketWidth, wicketHeight, height,\n      body.install ? 1 : 0, body.posts ? 1 : 0, color, total,\n      body.deliveryPending ? 1 : 0, comment, message\n    ).run();\n\n  return json({ok: true, id: result.meta?.last_row_id || null}, 201);"
new="    width, wicket_width, wicket_height, height, install, posts, color, total, delivery_pending, consent, consent_at, policy_version, comment, message\n  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`)\n    .bind(\n      name, phone, city, category, source, article, productTitle, configurationJson,\n      width, wicketWidth, wicketHeight, height,\n      body.install ? 1 : 0, body.posts ? 1 : 0, color, total,\n      body.deliveryPending ? 1 : 0, consent ? 1 : 0, policyVersion, comment, message\n    ).run();\n\n  const leadId = result.meta?.last_row_id || null;\n  await notifyNewLead(env, {id:leadId, category, name, phone, city, article, productTitle, total, source, message});\n  return json({ok: true, id: leadId}, 201);"
if old not in s: raise SystemExit('worker insert consent anchor not found')
s=s.replace(old,new,1)
old="    product_title, configuration_json, width, wicket_width, wicket_height, height, install, posts, color, total,\n    delivery_pending, comment, message"
new="    product_title, configuration_json, width, wicket_width, wicket_height, height, install, posts, color, total,\n    delivery_pending, consent, consent_at, policy_version, comment, message"
if old not in s: raise SystemExit('worker select consent anchor not found')
s=s.replace(old,new,1)
old="    posts: Boolean(row.posts),\n    delivery_pending: Boolean(row.delivery_pending)"
new="    posts: Boolean(row.posts),\n    delivery_pending: Boolean(row.delivery_pending),\n    consent: Boolean(row.consent)"
if old not in s: raise SystemExit('worker list consent anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 7) Admin: automatic 30s refresh + opt-in browser notifications + new-lead badge.
p=Path('admin-leads.js')
s=p.read_text(encoding='utf-8')
old='<div class="lead-stats" id="leadStats"></div>\n      <button class="reset-button" id="reloadLeadsButton" type="button">Обновить</button>'
new='<div class="lead-stats" id="leadStats"></div>\n      <div class="lead-toolbar-actions"><button class="reset-button" id="enableLeadNotifications" type="button">🔔 Уведомления</button><button class="reset-button" id="reloadLeadsButton" type="button">Обновить</button></div>'
if old not in s: raise SystemExit('admin toolbar anchor not found')
s=s.replace(old,new,1)
old="    .lead-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.lead-stats"
new="    .lead-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.lead-toolbar-actions{display:flex;gap:8px}.lead-stats"
if old not in s: raise SystemExit('admin toolbar css anchor not found')
s=s.replace(old,new,1)
s=s.replace("@media(max-width:620px){.lead-toolbar{align-items:stretch;flex-direction:column}.lead-toolbar .reset-button{width:100%}", "@media(max-width:620px){.lead-toolbar{align-items:stretch;flex-direction:column}.lead-toolbar-actions{display:grid;grid-template-columns:1fr 1fr}.lead-toolbar .reset-button{width:100%}",1)
old="  const reloadButton = panel.querySelector('#reloadLeadsButton');\n  const filters"
new="  const reloadButton = panel.querySelector('#reloadLeadsButton');\n  const notificationButton = panel.querySelector('#enableLeadNotifications');\n  const filters"
if old not in s: raise SystemExit('admin notification button anchor not found')
s=s.replace(old,new,1)
old="  let loaded = false;\n\n  const escape"
new="  let loaded = false;\n  let latestLeadId = 0;\n  let pollingTimer = 0;\n\n  const escape"
if old not in s: raise SystemExit('admin state anchor not found')
s=s.replace(old,new,1)
old="  function renderStats(counts = {}) {\n    stats.innerHTML = `<span class=\"lead-stat\">Новые <b>${Number(counts.new)||0}</b></span><span class=\"lead-stat\">Связались <b>${Number(counts.contacted)||0}</b></span><span class=\"lead-stat\">Закрытые <b>${Number(counts.done)||0}</b></span>`;\n  }"
new="  function renderStats(counts = {}) {\n    const newCount=Number(counts.new)||0;\n    stats.innerHTML = `<span class=\"lead-stat\">Новые <b>${newCount}</b></span><span class=\"lead-stat\">Связались <b>${Number(counts.contacted)||0}</b></span><span class=\"lead-stat\">Закрытые <b>${Number(counts.done)||0}</b></span>`;\n    tab.textContent = newCount ? `📥 Заявки · ${newCount}` : '📥 Заявки';\n  }\n\n  function notifyArrivals(items) {\n    if (!items.length) return;\n    showToast(items.length===1?'Получена новая заявка':`Новых заявок: ${items.length}`);\n    if (!('Notification' in window) || Notification.permission !== 'granted') return;\n    const lead=items[0];\n    try { new Notification(items.length===1?'Новая заявка с сайта':`Новых заявок: ${items.length}`, {body:`${categoryLabel(lead.category||'gates')} · ${lead.city} · ${money(lead.total)}`, tag:`lead-${lead.id}`}); } catch {}\n  }\n\n  function syncNotificationButton() {\n    if (!notificationButton) return;\n    if (!('Notification' in window)) { notificationButton.hidden=true; return; }\n    notificationButton.textContent = Notification.permission==='granted' ? '🔔 Включены' : Notification.permission==='denied' ? '🔕 Запрещены' : '🔔 Уведомления';\n    notificationButton.disabled = Notification.permission==='denied';\n  }"
if old not in s: raise SystemExit('admin render stats anchor not found')
s=s.replace(old,new,1)
old="  async function load(force = false) {\n    if (loaded && !force) { render(); return; }\n    reloadButton.disabled = true;\n    reloadButton.textContent = 'Загружаем…';\n    try {\n      const data = await api('/api/admin/leads');\n      leads = Array.isArray(data.leads) ? data.leads : [];\n      renderStats(data.counts || {});\n      loaded = true;\n      render();\n    } catch (error) {\n      showToast(error.message, true);\n    } finally {\n      reloadButton.disabled = false;\n      reloadButton.textContent = 'Обновить';\n    }\n  }"
new="  async function load(force = false, silent = false) {\n    if (loaded && !force) { render(); return; }\n    if (!silent) { reloadButton.disabled = true; reloadButton.textContent = 'Загружаем…'; }\n    try {\n      const data = await api('/api/admin/leads');\n      const nextLeads = Array.isArray(data.leads) ? data.leads : [];\n      const newestId = nextLeads.reduce((max,lead)=>Math.max(max,Number(lead.id)||0),0);\n      const arrivals = latestLeadId ? nextLeads.filter(lead => Number(lead.id)>latestLeadId) : [];\n      leads = nextLeads;\n      renderStats(data.counts || {});\n      if (newestId > latestLeadId) latestLeadId = newestId;\n      loaded = true;\n      render();\n      notifyArrivals(arrivals);\n    } catch (error) {\n      if (!silent) showToast(error.message, true);\n    } finally {\n      if (!silent) { reloadButton.disabled = false; reloadButton.textContent = 'Обновить'; }\n    }\n  }"
if old not in s: raise SystemExit('admin load anchor not found')
s=s.replace(old,new,1)
old="  reloadButton.addEventListener('click', () => load(true));\n\n  tab.addEventListener"
new="  reloadButton.addEventListener('click', () => load(true));\n  notificationButton?.addEventListener('click', async () => {\n    if (!('Notification' in window)) return;\n    try { await Notification.requestPermission(); } catch {}\n    syncNotificationButton();\n  });\n  syncNotificationButton();\n\n  tab.addEventListener"
if old not in s: raise SystemExit('admin notification listener anchor not found')
s=s.replace(old,new,1)
old="    load(true);\n  });\n})();"
new="    load(true);\n    if (!pollingTimer) pollingTimer = window.setInterval(() => load(true, true), 30000);\n  });\n  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) load(true,true); });\n})();"
if old not in s: raise SystemExit('admin polling anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 8) Environment documentation for closed-browser notification integration.
p=Path('ENVIRONMENT-EXAMPLE.txt')
s=p.read_text(encoding='utf-8')
if 'LEAD_NOTIFY_WEBHOOK_URL' not in s:
    s += "\n# Необязательное мгновенное уведомление о новой заявке во внешний сервис.\n# URL и токен храните только в Cloudflare variables/secrets, не коммитьте реальные значения.\nLEAD_NOTIFY_WEBHOOK_URL=https://example.invalid/new-lead\nLEAD_NOTIFY_WEBHOOK_TOKEN=secret_optional\n"
p.write_text(s,encoding='utf-8')

# 9) Foundation tests cover the new hardening rules.
p=Path('scripts/test-gate-page.mjs')
s=p.read_text(encoding='utf-8')
old="const [html, app, runtime, ui, build, delivery, customer, leads] = await Promise.all(["
new="const [html, app, runtime, ui, build, delivery, customer, leads, workerLeads, adminLeads] = await Promise.all(["
if old not in s: raise SystemExit('test variables anchor not found')
s=s.replace(old,new,1)
old="  readFile('shared/leads.js','utf8')\n]);"
new="  readFile('shared/leads.js','utf8'),\n  readFile('worker/leads-d1.js','utf8'),\n  readFile('admin-leads.js','utf8')\n]);"
if old not in s: raise SystemExit('test files anchor not found')
s=s.replace(old,new,1)
old="assert(app.includes('deliveryKind'), 'Gate page must expose delivery state to mobile CTA');"
new=old+"\nassert(app.includes(\"['fixed','calculated','error'].includes(deliveryState.kind)\"), 'Lead submission must require a resolved delivery state');\nassert(html.includes('data-desktop-src=\"/hero-gates.jpg\"') && !html.includes('img src=\"/hero-gates.jpg\" alt=\"Готовые распашные'), 'Mobile HTML must not eagerly request the desktop hero');"
if old not in s: raise SystemExit('test delivery assertion anchor not found')
s=s.replace(old,new,1)
old="assert(leads.includes('window.KUZDVOR_LEADS'), 'Shared lead API missing');"
new=old+"\nassert(workerLeads.includes('consent_at') && workerLeads.includes('policy_version'), 'Server must store consent evidence');\nassert(workerLeads.includes('LEAD_NOTIFY_WEBHOOK_URL'), 'Optional lead notification webhook missing');\nassert(adminLeads.includes('Notification.requestPermission') && adminLeads.includes('30000'), 'Admin new-lead polling/notifications missing');"
if old not in s: raise SystemExit('test hardening assertions anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

print('Gate hardening patch applied')
