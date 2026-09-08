from pathlib import Path
import re


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'anchor not found: {label}')
    return text.replace(old, new, 1)

# ---------- index.html ----------
p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Stop automatic infinite catalogue loading. Keep the existing explicit Show more button.
s = replace_once(
    s,
    "      button.style.display = 'none';\n\n      if (!('IntersectionObserver' in window)) {",
    "      button.style.display = '';\n      return;\n\n      if (!('IntersectionObserver' in window)) {",
    'disable automatic catalogue loading'
)

# Put a compact trust reminder directly after the first catalogue batch.
s = replace_once(
    s,
    '      <div class="catalog-grid" id="catalogGrid"></div>\n      <div class="empty-state" id="emptyState" hidden>По выбранным параметрам вариантов нет.</div>',
    '      <div class="catalog-grid" id="catalogGrid"></div>\n      <div class="catalog-trust-strip" aria-label="Почему нам доверяют"><span>Собственное производство</span><span>Бесплатный замер</span><span>Договор</span><span>Гарантия 3 года</span></div>\n      <div class="empty-state" id="emptyState" hidden>По выбранным параметрам вариантов нет.</div>',
    'catalog trust strip'
)

# The static hero note is now used on all screen sizes, so do not create a second conflicting note.
s = s.replace(
    "if(heroPrices&&!document.querySelector('.hero-standard-note')){",
    "if(heroPrices&&!document.querySelector('.hero-standard-note')&&!document.querySelector('.hero-size-note')){"
)
s = s.replace(
    'Цена указана для стандартного размера: ворота 3,4 × 1,8 м и калитка 1 × 1,8 м. Другой размер рассчитаем после замера.',
    'Цена указана для стандартного размера: ворота 3,4 × 1,8 м и калитка 1 × 1,8 м. Измените размеры в калькуляторе — стоимость пересчитается сразу.'
)

# Final CTA must never silently calculate the default Art.6.
s = replace_once(
    s,
    '      <div class="final-cta-actions">\n        <a class="button button-primary" href="#catalog">Выбрать модель</a>\n        <a class="button button-ghost" href="#calculator">Рассчитать стоимость</a>\n      </div>',
    '      <div class="final-cta-actions">\n        <a class="button button-primary" href="#catalog">Выбрать ворота и рассчитать</a>\n      </div>',
    'final CTA'
)
p.write_text(s, encoding='utf-8')

# ---------- storefront.css ----------
p = Path('storefront.css')
css = p.read_text(encoding='utf-8')
marker = '/* Conversion audit fixes 2026-09 */'
if marker not in css:
    css += r'''

/* Conversion audit fixes 2026-09 */
.catalog-trust-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0 12px}
.catalog-trust-strip span{display:flex;align-items:center;justify-content:center;min-height:42px;padding:8px 10px;border:1px solid rgba(17,18,20,.08);border-radius:11px;background:#f7f4ee;color:#5f594f;font-size:11px;font-weight:800;text-align:center}
@media(max-width:620px){
  .hero-size-note{display:block!important;margin:9px 0 0!important;color:rgba(255,255,255,.66)!important;font-size:12px!important;line-height:1.45!important}
  .catalog-trust-strip{grid-template-columns:1fr 1fr;gap:6px;margin:12px 0 10px}
  .catalog-trust-strip span{min-height:38px;padding:7px 8px;font-size:10px}
}
'''
p.write_text(css, encoding='utf-8')

# ---------- public-site-settings.js ----------
p = Path('public-site-settings.js')
js = p.read_text(encoding='utf-8')
js = replace_once(
    js,
    "  const heightInput = document.getElementById('heightInput');\n  const sizeNotice = document.getElementById('sizeNotice');",
    "  const heightInput = document.getElementById('heightInput');\n  const wicketHeightInput = document.getElementById('wicketHeightInput');\n  const sizeNotice = document.getElementById('sizeNotice');",
    'mobile wicket height input'
)
js = replace_once(
    js,
    "      const wicket = String(wicketWidthInput?.value || '').replace('.', ',');\n      kicker.textContent = sizeNotice?.hidden === false ? 'Ваш размер' : 'Стандартный размер';\n      value.textContent = wicket ? `Ворота ${width} × ${height} м · калитка ${wicket} м` : `${width} × ${height} м`;",
    "      const wicket = String(wicketWidthInput?.value || '').replace('.', ',');\n      const wicketHeight = String(wicketHeightInput?.value || heightInput?.value || '').replace('.', ',');\n      kicker.textContent = sizeNotice?.hidden === false ? 'Ваш размер' : 'Стандартный размер';\n      value.textContent = wicket ? `Ворота ${width} × ${height} м · калитка ${wicket} × ${wicketHeight} м` : `${width} × ${height} м`;",
    'mobile size summary wicket height'
)
js = replace_once(
    js,
    "    [widthInput, wicketWidthInput, heightInput, productSelect].filter(Boolean).forEach(element => element.addEventListener('input', () => setTimeout(updateSizeSummary, 0)));",
    "    [widthInput, wicketWidthInput, heightInput, wicketHeightInput, productSelect].filter(Boolean).forEach(element => element.addEventListener('input', () => setTimeout(updateSizeSummary, 0)));",
    'mobile size summary listeners'
)
p.write_text(js, encoding='utf-8')

# ---------- app.js ----------
p = Path('app.js')
app = p.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const DELIVERY_MEMORY_KEY='kuzdvor:selected-delivery';\nconst POSTS_MEMORY_KEY='kuzdvor:strengthened-posts';",
    "const DELIVERY_MEMORY_KEY='kuzdvor:selected-delivery';\nconst POSTS_MEMORY_KEY='kuzdvor:strengthened-posts';\nconst DIMENSIONS_MEMORY_KEY='kuzdvor:gate-dimensions';",
    'dimension memory key'
)

anchor = "function selectedProduct(){return products.find(product=>product.id===productSelect.value)}\n\nfunction chooseProduct(id){"
insert = r'''function selectedProduct(){return products.find(product=>product.id===productSelect.value)}

function rememberedDimensions(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(DIMENSIONS_MEMORY_KEY)||'null');
    if(!saved)return null;
    const values={
      gateWidth:Number(saved.gateWidth),gateHeight:Number(saved.gateHeight),
      wicketWidth:Number(saved.wicketWidth),wicketHeight:Number(saved.wicketHeight)
    };
    if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return null;
    if(!Object.values(values).every(Number.isFinite))return null;
    return values;
  }catch{return null}
}

function rememberDimensionsSelection(){
  const product=selectedProduct();
  if(product?.type!=='catalog')return;
  const values={
    gateWidth:Number(widthInput.value),gateHeight:Number(heightInput.value),
    wicketWidth:Number(wicketWidthInput.value),wicketHeight:Number(wicketHeightInput?.value)
  };
  if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return;
  if(!Object.values(values).every(Number.isFinite))return;
  try{sessionStorage.setItem(DIMENSIONS_MEMORY_KEY,JSON.stringify(values))}catch{}
}

function restoreDimensionsSelection(product){
  if(product?.type!=='catalog')return false;
  const saved=rememberedDimensions();
  if(!saved)return false;
  widthInput.value=saved.gateWidth;
  heightInput.value=saved.gateHeight;
  wicketWidthInput.value=saved.wicketWidth;
  if(wicketHeightInput)wicketHeightInput.value=saved.wicketHeight;
  return true;
}

function chooseProduct(id){'''
app = replace_once(app, anchor, insert, 'dimension memory functions')

app = replace_once(
    app,
    "  productSelect.value=id;\n  const product=selectedProduct();\n  widthInput.value=product.standard[0];heightInput.value=product.standard[1];\n  wicketWidthInput.value=product.wicketWidth??1;\n  if(wicketHeightInput) wicketHeightInput.value=product.wicketHeight??product.standard[1];",
    "  productSelect.value=id;\n  const product=selectedProduct();\n  if(!restoreDimensionsSelection(product)){\n    widthInput.value=product.standard[0];heightInput.value=product.standard[1];\n    wicketWidthInput.value=product.wicketWidth??1;\n    if(wicketHeightInput) wicketHeightInput.value=product.wicketHeight??product.standard[1];\n  }",
    'restore dimensions when changing design'
)

# Remember all four dimensions while the client edits them.
listener_anchor = "wicketHeightInput?.addEventListener('change',calculate);\nwindow.GATE_CALC?.ready?.then"
listener_insert = "wicketHeightInput?.addEventListener('change',calculate);\n[widthInput,wicketWidthInput,heightInput,wicketHeightInput].filter(Boolean).forEach(element=>{\n  element.addEventListener('input',rememberDimensionsSelection);\n  element.addEventListener('change',rememberDimensionsSelection);\n});\nwindow.GATE_CALC?.ready?.then"
app = replace_once(app, listener_anchor, listener_insert, 'dimension memory listeners')

# Replace legacy fallback submission that automatically opened WhatsApp.
pattern = re.compile(r"document\.getElementById\('sendButton'\)\.addEventListener\('click',\(\)=>\{.*?\n\}\);\n\ndocument\.querySelectorAll\('a\[href\^=\\\"tel:\\\"\]'\)", re.S)
replacement = r'''document.getElementById('sendButton').addEventListener('click',async()=>{
  const button=document.getElementById('sendButton');
  const phoneDigits=phoneInput.value.replace(/\D/g,'');
  if(phoneDigits.length<10||phoneDigits.length>11){
    phoneInput.setAttribute('aria-invalid','true');phoneInput.focus();showToast('Укажите номер телефона');return;
  }
  if(!cityInput.value.trim()){
    cityInput.focus();showToast('Укажите населённый пункт');return;
  }
  if(consentInput&&!consentInput.checked){
    consentInput.setAttribute('aria-invalid','true');consentInput.focus();showToast('Подтвердите согласие на обработку данных');return;
  }
  const payload=leadPayload();
  button.disabled=true;
  try{
    const response=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Не удалось отправить заявку')}
    if(window.ym)ym(107269914,'reachGoal','lead_saved',{article:selectedProduct().art,city:selectedCityName()});
    document.dispatchEvent(new CustomEvent('lead-sent',{detail:{payload}}));
    showToast('Заявка отправлена');
  }catch(error){showToast(error?.message||'Не удалось отправить заявку')}
  finally{button.disabled=false;}
});

document.querySelectorAll('a[href^="tel:"]')'''
app2, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit(f'legacy send handler replacement count={count}')
app = app2
p.write_text(app, encoding='utf-8')

# ---------- worker/leads-d1.js ----------
p = Path('worker/leads-d1.js')
worker = p.read_text(encoding='utf-8')
worker = replace_once(
    worker,
    "    width REAL,\n    wicket_width REAL,\n    height REAL,",
    "    width REAL,\n    wicket_width REAL,\n    wicket_height REAL,\n    height REAL,",
    'lead wicket height schema'
)
worker = replace_once(
    worker,
    "  `).run();\n  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_created_idx ON site_leads(created_at DESC)').run();",
    "  `).run();\n  try {\n    await env.DB.prepare('ALTER TABLE site_leads ADD COLUMN wicket_height REAL').run();\n  } catch (error) {\n    if (!/duplicate column/i.test(String(error?.message || error))) throw error;\n  }\n  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_created_idx ON site_leads(created_at DESC)').run();",
    'lead wicket height migration'
)
worker = replace_once(
    worker,
    "  const wicketWidth = leadNumber(body.wicketWidth);\n  const height = leadNumber(body.height);",
    "  const wicketWidth = leadNumber(body.wicketWidth);\n  const wicketHeight = leadNumber(body.wicketHeight);\n  const height = leadNumber(body.height);",
    'lead wicket height parse'
)
worker = replace_once(
    worker,
    "  for (const value of [width, wicketWidth, height]) {",
    "  for (const value of [width, wicketWidth, wicketHeight, height]) {",
    'lead wicket height validation'
)
worker = replace_once(
    worker,
    "    status, name, phone, city, article, product_title, width, wicket_width, height,\n    install, posts, color, total, delivery_pending, comment, message\n  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`",
    "    status, name, phone, city, article, product_title, width, wicket_width, wicket_height, height,\n    install, posts, color, total, delivery_pending, comment, message\n  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`",
    'lead wicket height insert columns'
)
worker = replace_once(
    worker,
    "      name, phone, city, article, productTitle, width, wicketWidth, height,\n      body.install ? 1 : 0,",
    "      name, phone, city, article, productTitle, width, wicketWidth, wicketHeight, height,\n      body.install ? 1 : 0,",
    'lead wicket height bind'
)
worker = replace_once(
    worker,
    "    product_title, width, wicket_width, height, install, posts, color, total,",
    "    product_title, width, wicket_width, wicket_height, height, install, posts, color, total,",
    'lead wicket height select'
)
p.write_text(worker, encoding='utf-8')

# ---------- admin-leads.js ----------
p = Path('admin-leads.js')
admin = p.read_text(encoding='utf-8')
admin = admin.replace(
    'Заявка сохраняется перед открытием WhatsApp, поэтому контакт останется в админ-панели.',
    'Заявки с сайта сохраняются здесь сразу после отправки клиентом.'
)
admin = replace_once(
    admin,
    "      const wicket = lead.wicket_width ? `${lead.wicket_width} м` : '—';",
    "      const wicket = [lead.wicket_width ? `${lead.wicket_width} м` : '', lead.wicket_height ? `× ${lead.wicket_height} м` : ''].filter(Boolean).join(' ') || '—';",
    'admin wicket dimensions'
)
p.write_text(admin, encoding='utf-8')

print('Site audit fixes applied')
