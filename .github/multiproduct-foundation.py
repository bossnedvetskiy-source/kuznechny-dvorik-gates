from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{label}: anchor not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Current gates lead becomes the first category of a universal lead format.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = """function leadPayload(){
  const {p,total,deliveryPending}=calcData();
  return {
    name:document.getElementById('nameInput').value.trim(),"""
new = """function leadPayload(){
  const {p,total,deliveryPending}=calcData();
  const tracking=new URLSearchParams(window.location.search);
  const source=[tracking.get('utm_source'),tracking.get('utm_campaign')].filter(Boolean).join(' / ');
  return {
    category:'gates',
    source,
    name:document.getElementById('nameInput').value.trim(),"""
if old not in s:
    raise SystemExit('app lead payload start not found')
s = s.replace(old, new, 1)
old = """    color:p.type==='frame'?'':document.getElementById('colorSelect').value,
    total:Math.round(total),"""
new = """    color:p.type==='frame'?'':document.getElementById('colorSelect').value,
    configuration:{
      article:p.art,
      width:Number(widthInput.value)||null,
      height:Number(heightInput.value)||null,
      wicketWidth:Number.isFinite(p.wicketWidth)?(Number(wicketWidthInput.value)||null):null,
      wicketHeight:Number.isFinite(p.wicketWidth)?(Number(wicketHeightInput?.value)||null):null,
      install:Boolean(installCheck.checked&&p.install),
      posts:Boolean(postsCheck.checked&&p.posts),
      color:p.type==='frame'?'':document.getElementById('colorSelect').value
    },
    total:Math.round(total),"""
if old not in s:
    raise SystemExit('app lead payload config anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Admin navigation: leads first, then products/prices/photos/settings.
p = Path('admin.html')
s = p.read_text(encoding='utf-8')
s = s.replace('Здесь можно управлять каталогом, фотографиями и ценами сайта.', 'Здесь можно управлять заявками, изделиями, фотографиями, ценами и настройками сайта.', 1)
s = s.replace('<button class="admin-tab active" data-admin-tab="photos" type="button">📷 Фото</button>', '<button class="admin-tab" data-admin-tab="photos" type="button">🖼 Фото</button>', 1)
s = s.replace('<button class="admin-tab" data-admin-tab="prices" type="button">₽ Цены</button>', '<button class="admin-tab" data-admin-tab="prices" type="button">🧮 Цены</button>', 1)
s = s.replace('<button class="admin-tab" data-admin-tab="catalog" type="button">🗂 Каталог</button>', '<button class="admin-tab" data-admin-tab="catalog" type="button">🛍 Изделия</button>', 1)
s = s.replace('<h1>Фотографии моделей</h1>', '<h1>Фотографии · Ворота с калиткой</h1>', 1)
s = s.replace('<h1>Цены</h1>', '<h1>Цены · Ворота с калиткой</h1>', 1)
s = s.replace('<h1>Порядок моделей</h1>', '<h1>Ворота с калиткой</h1>', 1)
style_anchor = '.admin-tab.active{background:var(--ink);color:#fff;box-shadow:0 6px 18px rgba(17,19,21,.13)}'
style_add = style_anchor + '\n    .admin-tab[data-admin-tab="leads"]{order:1}.admin-tab[data-admin-tab="catalog"]{order:2}.admin-tab[data-admin-tab="prices"]{order:3}.admin-tab[data-admin-tab="photos"]{order:4}.admin-tab[data-admin-tab="settings"]{order:5}'
if style_anchor not in s:
    raise SystemExit('admin tab style anchor not found')
s = s.replace(style_anchor, style_add, 1)
p.write_text(s, encoding='utf-8')

# Do not force Photos as the landing tab anymore.
p = Path('admin-prices.js')
s = p.read_text(encoding='utf-8')
old = """window.addEventListener('admin:ready', () => {
  switchAdminTab('photos');
});

"""
if old not in s:
    raise SystemExit('admin ready photo handler not found')
s = s.replace(old, '', 1)
p.write_text(s, encoding='utf-8')

# Settings text is currently scoped to the gates page, while contacts stay global.
p = Path('admin-site.js')
s = p.read_text(encoding='utf-8')
s = s.replace('<div class="panel-heading"><div><span>Первый экран</span><h2>Главный оффер</h2></div></div>', '<div class="panel-heading"><div><span>Страница ворот</span><h2>Главный оффер</h2></div></div>', 1)
p.write_text(s, encoding='utf-8')

# Universal lead UI and default admin landing page.
p = Path('admin-leads.js')
s = p.read_text(encoding='utf-8')
s = s.replace('  nav.append(tab);', '  nav.prepend(tab);', 1)
status_anchor = "  const statusLabel = status => ({new:'Новая',contacted:'Связались',done:'Закрыта',archived:'Архив'})[status] || status;\n"
status_add = status_anchor + "  const categoryLabel = category => ({gates:'Ворота с калиткой',canopy:'Автомобильный навес','forged-fence':'Кованый забор','profsheet-fence':'Забор из профнастила','picket-fence':'Евроштакетник'})[category] || 'Изделие';\n  const configLabel = key => ({width:'ширина',height:'высота',length:'длина',wicketWidth:'калитка',wicketHeight:'высота калитки',type:'тип',roof:'кровля',color:'цвет'})[key] || key;\n"
if status_anchor not in s:
    raise SystemExit('lead category label anchor not found')
s = s.replace(status_anchor, status_add, 1)
old = """      const dimensions = [lead.width ? `${lead.width} м` : '', lead.height ? `× ${lead.height} м` : ''].filter(Boolean).join(' ');
      const wicket = [lead.wicket_width ? `${lead.wicket_width} м` : '', lead.wicket_height ? `× ${lead.wicket_height} м` : ''].filter(Boolean).join(' ') || '—';
      const options = [lead.install ? 'монтаж' : '', lead.posts ? 'новые столбы' : '', lead.color || ''].filter(Boolean).join(' · ') || 'без дополнительных опций';
      const digits = phoneDigits(lead.phone);
      return `<article class="lead-card ${lead.status==='new'?'is-new':''}" data-lead-id="${lead.id}">
        <div class="lead-card-head"><div class="lead-main"><b>#${lead.id} · ${escape(lead.article)} · ${escape(lead.name || 'Без имени')}</b><span>${escape(formatDate(lead.created_at))} · ${escape(lead.city)}</span></div><strong class="lead-total">${money(lead.total)}</strong></div>
        <div class="lead-grid">
          <div class="lead-field"><span>Телефон</span><b>${escape(lead.phone)}</b></div>
          <div class="lead-field"><span>Ворота</span><b>${escape(dimensions || '—')}</b></div>
          <div class="lead-field"><span>Калитка</span><b>${escape(wicket)}</b></div>
          <div class="lead-field"><span>Комплектация</span><b>${escape(options)}</b></div>
        </div>"""
new = """      const category=lead.category||'gates';
      const categoryName=categoryLabel(category);
      const dimensions = [lead.width ? `${lead.width} м` : '', lead.height ? `× ${lead.height} м` : ''].filter(Boolean).join(' ');
      const wicket = [lead.wicket_width ? `${lead.wicket_width} м` : '', lead.wicket_height ? `× ${lead.wicket_height} м` : ''].filter(Boolean).join(' ') || '—';
      const options = [lead.install ? 'монтаж' : '', lead.posts ? 'новые столбы' : '', lead.color || ''].filter(Boolean).join(' · ') || 'без дополнительных опций';
      const config=lead.configuration&&typeof lead.configuration==='object'?lead.configuration:{};
      const genericParams=Object.entries(config).filter(([key,value])=>value!==null&&value!==''&&value!==false&&!['article','install','posts'].includes(key)).slice(0,5).map(([key,value])=>`${configLabel(key)}: ${value}`).join(' · ') || '—';
      const digits = phoneDigits(lead.phone);
      const productLine=[categoryName,lead.article].filter(Boolean).join(' · ');
      const sourceLine=lead.source?` · ${lead.source}`:'';
      const fieldTwoLabel=category==='gates'?'Ворота':'Параметры';
      const fieldTwoValue=category==='gates'?(dimensions||'—'):genericParams;
      const fieldThreeLabel=category==='gates'?'Калитка':'Изделие';
      const fieldThreeValue=category==='gates'?wicket:(lead.product_title||categoryName);
      return `<article class="lead-card ${lead.status==='new'?'is-new':''}" data-lead-id="${lead.id}">
        <div class="lead-card-head"><div class="lead-main"><b>#${lead.id} · ${escape(productLine)} · ${escape(lead.name || 'Без имени')}</b><span>${escape(formatDate(lead.created_at))} · ${escape(lead.city)}${escape(sourceLine)}</span></div><strong class="lead-total">${money(lead.total)}</strong></div>
        <div class="lead-grid">
          <div class="lead-field"><span>Телефон</span><b>${escape(lead.phone)}</b></div>
          <div class="lead-field"><span>${escape(fieldTwoLabel)}</span><b>${escape(fieldTwoValue)}</b></div>
          <div class="lead-field"><span>${escape(fieldThreeLabel)}</span><b>${escape(fieldThreeValue)}</b></div>
          <div class="lead-field"><span>Комплектация</span><b>${escape(options)}</b></div>
        </div>"""
if old not in s:
    raise SystemExit('lead card block not found')
s = s.replace(old, new, 1)
end_anchor = """  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button || button === tab || panel.hidden) return;
    panel.hidden = true;
    tab.classList.remove('active');
  });
})();
"""
end_new = """  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button || button === tab || panel.hidden) return;
    panel.hidden = true;
    tab.classList.remove('active');
  });

  window.addEventListener('admin:ready', () => {
    document.querySelectorAll('.admin-tab-panel').forEach(item => { item.hidden = item !== panel; });
    nav.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item === tab));
    load(true);
  });
})();
"""
if end_anchor not in s:
    raise SystemExit('lead admin ready anchor not found')
s = s.replace(end_anchor, end_new, 1)
p.write_text(s, encoding='utf-8')

# Add product hub build inputs and routing while preserving / as the current gates landing page.
p = Path('scripts/build.mjs')
s = p.read_text(encoding='utf-8')
old_decl = "const [htmlSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([\n  readFile('index.html', 'utf8'),"
new_decl = "const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([\n  readFile('index.html', 'utf8'),\n  readFile('home.html', 'utf8'),\n  readFile('home.css', 'utf8'),\n  readFile('product-categories.js', 'utf8'),"
if old_decl not in s:
    raise SystemExit('build input declaration anchor not found')
s = s.replace(old_decl, new_decl, 1)
html_anchor = """const html = htmlSource
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}\n${storefrontCss}</style>`)"""
home_block = """const homeHtml = homeHtmlSource
  .replace('<link rel="stylesheet" href="home.css">', `<style>${homeCss}</style>`)
  .replace('<script src="product-categories.js"></script>', `<script>${productCategoriesSource}</script>`);

const html = htmlSource
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}\n${storefrontCss}</style>`)"""
if html_anchor not in s:
    raise SystemExit('home html build anchor not found')
s = s.replace(html_anchor, home_block, 1)
worker_const_anchor = """let patchedWorkerSource = workerSource.slice(0, authStart)
  + adminAuthSource.trim() + '\n\n'"""
worker_const_new = """let patchedWorkerSource = workerSource.slice(0, authStart)
  + adminAuthSource.trim() + '\n\n'"""
if worker_const_anchor not in s:
    raise SystemExit('worker patch start not found')
# insert HOME_PAGE constant after patched worker has been assembled
insert_anchor = """patchedWorkerSource = patchedWorkerSource.replace(
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;',
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;'
);
"""
insert_new = insert_anchor + """
patchedWorkerSource = patchedWorkerSource.replace(
  'const PAGE = __PUBLIC_PAGE__;',
  'const PAGE = __PUBLIC_PAGE__;\nconst HOME_PAGE = __HOME_PAGE__;'
);
"""
if insert_anchor not in s:
    raise SystemExit('worker const injection anchor not found')
s = s.replace(insert_anchor, insert_new, 1)
old_route_patch = "patchedWorkerSource = patchedWorkerSource.replace('return html(PAGE);\\n  }\\n};', 'return html(await renderPublicPage(env));\\n  }\\n};');"
new_route_patch = """patchedWorkerSource = patchedWorkerSource.replace(
  "    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});\n    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});\n    return html(PAGE);",
  "    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});\n    if (url.pathname === '/napravleniya' || url.pathname === '/napravleniya/') return html(await renderProductHub(env));\n    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/vorota' || url.pathname === '/vorota/') return html(await renderPublicPage(env));\n    return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});"
);"""
if old_route_patch not in s:
    raise SystemExit('worker route patch anchor not found')
s = s.replace(old_route_patch, new_route_patch, 1)
replace_anchor = """const worker = patchedWorkerSource
  .replace('__PUBLIC_PAGE__', JSON.stringify(html))
  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))"""
replace_new = """const worker = patchedWorkerSource
  .replace('__PUBLIC_PAGE__', JSON.stringify(html))
  .replace('__HOME_PAGE__', JSON.stringify(homeHtml))
  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))"""
if replace_anchor not in s:
    raise SystemExit('worker home replacement anchor not found')
s = s.replace(replace_anchor, replace_new, 1)
p.write_text(s, encoding='utf-8')

# Runtime helper for the product hub uses only the global site profile.
p = Path('worker/site-settings-d1.js')
s = p.read_text(encoding='utf-8')
if 'async function renderProductHub(env)' not in s:
    s += """

async function renderProductHub(env) {
  const site = await loadSiteProfile(env);
  const serializedSite = JSON.stringify(site).replace(/</g, '\\u003c');
  return HOME_PAGE.replace('__RUNTIME_SITE_DATA__', serializedSite);
}
"""
p.write_text(s, encoding='utf-8')

print('Multi-product foundation applied')
