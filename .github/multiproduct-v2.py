from pathlib import Path


def load(path):
    return Path(path).read_text(encoding='utf-8')


def save(path, text):
    Path(path).write_text(text, encoding='utf-8')


def repl(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: anchor not found')
    return text.replace(old, new, 1)

# 1) Existing gate calculator sends universal lead metadata/configuration.
p='app.js'; s=load(p)
s=repl(s,
"""function leadPayload(){
  const {p,total,deliveryPending}=calcData();
  return {
    name:document.getElementById('nameInput').value.trim(),""",
"""function leadPayload(){
  const {p,total,deliveryPending}=calcData();
  const tracking=new URLSearchParams(window.location.search);
  const source=[tracking.get('utm_source'),tracking.get('utm_campaign')].filter(Boolean).join(' / ');
  return {
    category:'gates',
    source,
    name:document.getElementById('nameInput').value.trim(),""",
'app lead metadata')
s=repl(s,
"""    color:p.type==='frame'?'':document.getElementById('colorSelect').value,
    total:Math.round(total),""",
"""    color:p.type==='frame'?'':document.getElementById('colorSelect').value,
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
    total:Math.round(total),""",
'app lead configuration')
save(p,s)

# 2) Admin terminology/order becomes product-oriented without changing gate controls.
p='admin.html'; s=load(p)
s=repl(s,'Здесь можно управлять каталогом, фотографиями и ценами сайта.','Здесь можно управлять заявками, изделиями, фотографиями, ценами и настройками сайта.','admin login copy')
s=repl(s,'<button class="admin-tab active" data-admin-tab="photos" type="button">📷 Фото</button>','<button class="admin-tab" data-admin-tab="photos" type="button">🖼 Фото</button>','photos tab')
s=repl(s,'<button class="admin-tab" data-admin-tab="prices" type="button">₽ Цены</button>','<button class="admin-tab" data-admin-tab="prices" type="button">🧮 Цены</button>','prices tab')
s=repl(s,'<button class="admin-tab" data-admin-tab="catalog" type="button">🗂 Каталог</button>','<button class="admin-tab" data-admin-tab="catalog" type="button">🛍 Изделия</button>','catalog tab')
s=repl(s,'<h1>Фотографии моделей</h1>','<h1>Фотографии · Ворота с калиткой</h1>','photos heading')
s=repl(s,'<h1>Цены</h1>','<h1>Цены · Ворота с калиткой</h1>','prices heading')
s=repl(s,'<h1>Порядок моделей</h1>','<h1>Ворота с калиткой</h1>','catalog heading')
style='.admin-tab.active{background:var(--ink);color:#fff;box-shadow:0 6px 18px rgba(17,19,21,.13)}'
s=repl(s,style,style+'\n    .admin-tab[data-admin-tab="leads"]{order:1}.admin-tab[data-admin-tab="catalog"]{order:2}.admin-tab[data-admin-tab="prices"]{order:3}.admin-tab[data-admin-tab="photos"]{order:4}.admin-tab[data-admin-tab="settings"]{order:5}','admin tab order')
save(p,s)

# 3) Photos are no longer forced as the initial admin panel.
p='admin-prices.js'; s=load(p)
s=repl(s,"""window.addEventListener('admin:ready', () => {
  switchAdminTab('photos');
});

""",'', 'remove photo landing')
save(p,s)

# 4) Clarify that hero copy belongs to the gates landing page.
p='admin-site.js'; s=load(p)
s=repl(s,'<div class="panel-heading"><div><span>Первый экран</span><h2>Главный оффер</h2></div></div>','<div class="panel-heading"><div><span>Страница ворот</span><h2>Главный оффер</h2></div></div>','settings gate label')
save(p,s)

# 5) Leads become first/default and can render future product configurations.
p='admin-leads.js'; s=load(p)
s=repl(s,'  nav.append(tab);','  nav.prepend(tab);','prepend leads')
anchor="  const statusLabel = status => ({new:'Новая',contacted:'Связались',done:'Закрыта',archived:'Архив'})[status] || status;\n"
addition=anchor+"  const categoryLabel = category => ({gates:'Ворота с калиткой',canopy:'Автомобильный навес','forged-fence':'Кованый забор','profsheet-fence':'Забор из профнастила','picket-fence':'Евроштакетник'})[category] || 'Изделие';\n  const configLabel = key => ({width:'ширина',height:'высота',length:'длина',wicketWidth:'калитка',wicketHeight:'высота калитки',type:'тип',roof:'кровля',color:'цвет'})[key] || key;\n"
s=repl(s,anchor,addition,'lead label helpers')
old="""      const dimensions = [lead.width ? `${lead.width} м` : '', lead.height ? `× ${lead.height} м` : ''].filter(Boolean).join(' ');
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
new="""      const category=lead.category||'gates';
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
s=repl(s,old,new,'universal lead card')
end="""  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button || button === tab || panel.hidden) return;
    panel.hidden = true;
    tab.classList.remove('active');
  });
})();
"""
end_new="""  nav.addEventListener('click', event => {
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
s=repl(s,end,end_new,'lead default landing')
save(p,s)

# 6) Build both the current gates page and a safe category hub preview.
p='scripts/build.mjs'; s=load(p)
s=repl(s,'const [htmlSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([','const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([','build variable list')
s=repl(s,"  readFile('index.html', 'utf8'),\n","  readFile('index.html', 'utf8'),\n  readFile('home.html', 'utf8'),\n  readFile('home.css', 'utf8'),\n  readFile('product-categories.js', 'utf8'),\n",'build home inputs')
marker='const html = htmlSource\n'
home="""const homeHtml = homeHtmlSource
  .replace('<link rel="stylesheet" href="home.css">', `<style>${homeCss}</style>`)
  .replace('<script src="product-categories.js"></script>', `<script>${productCategoriesSource}</script>`);

"""
s=repl(s,marker,home+marker,'home html build')
insert="""patchedWorkerSource = patchedWorkerSource.replace(
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;',
  'const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;\nconst DEFAULT_PRICES = __DEFAULT_PRICES__;'
);
"""
insert_new=insert+"""
patchedWorkerSource = patchedWorkerSource.replace(
  'const PAGE = __PUBLIC_PAGE__;',
  'const PAGE = __PUBLIC_PAGE__;\nconst HOME_PAGE = __HOME_PAGE__;'
);
"""
s=repl(s,insert,insert_new,'inject home worker constant')
old_route="patchedWorkerSource = patchedWorkerSource.replace('return html(PAGE);\\n  }\\n};', 'return html(await renderPublicPage(env));\\n  }\\n};');"
new_route="""patchedWorkerSource = patchedWorkerSource.replace(
  "    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});\n    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});\n    return html(PAGE);",
  "    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});\n    if (url.pathname === '/napravleniya' || url.pathname === '/napravleniya/') return html(await renderProductHub(env));\n    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/vorota' || url.pathname === '/vorota/') return html(await renderPublicPage(env));\n    return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});"
);"""
s=repl(s,old_route,new_route,'public route patch')
s=repl(s,"  .replace('__PUBLIC_PAGE__', JSON.stringify(html))\n  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))","  .replace('__PUBLIC_PAGE__', JSON.stringify(html))\n  .replace('__HOME_PAGE__', JSON.stringify(homeHtml))\n  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))",'home worker placeholder')
save(p,s)

# 7) Render hub with global contact/service settings.
p='worker/site-settings-d1.js'; s=load(p)
if 'async function renderProductHub(env)' not in s:
    s += """

async function renderProductHub(env) {
  const site = await loadSiteProfile(env);
  const serializedSite = JSON.stringify(site).replace(/</g, '\\u003c');
  return HOME_PAGE.replace('__RUNTIME_SITE_DATA__', serializedSite);
}
"""
save(p,s)

print('Multi-product foundation v2 applied')
