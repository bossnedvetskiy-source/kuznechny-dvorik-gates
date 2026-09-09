from pathlib import Path

p=Path('scripts/build.mjs')
s=p.read_text(encoding='utf-8')

def repl(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'{label}: anchor not found')
    s=s.replace(old,new,1)

repl(
"const [htmlSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([",
"const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all([",
'build variables')

repl(
"  readFile('index.html', 'utf8'),\n",
"  readFile('index.html', 'utf8'),\n  readFile('home.html', 'utf8'),\n  readFile('home.css', 'utf8'),\n  readFile('product-categories.js', 'utf8'),\n",
'home input files')

repl(
"const html = htmlSource\n",
"const homeHtml = homeHtmlSource\n  .replace('<link rel=\"stylesheet\" href=\"home.css\">', `<style>${homeCss}</style>`)\n  .replace('<script src=\"product-categories.js\"></script>', `<script>${productCategoriesSource}</script>`);\n\nconst html = htmlSource\n",
'home html bundle')

repl(
"  + workerSource.slice(authEnd);\n",
"  + workerSource.slice(authEnd);\n\npatchedWorkerSource = patchedWorkerSource.replace(\n  'const PAGE = __PUBLIC_PAGE__;',\n  'const PAGE = __PUBLIC_PAGE__;\\nconst HOME_PAGE = __HOME_PAGE__;'\n);\n",
'home worker constant')

old="patchedWorkerSource = patchedWorkerSource.replace('return html(PAGE);\\n  }\\n};', 'return html(await renderPublicPage(env));\\n  }\\n};');"
new="""patchedWorkerSource = patchedWorkerSource.replace(
  "    if (url.pathname !== '/' && url.pathname !== '/index.html')",
  "    if (url.pathname === '/napravleniya' || url.pathname === '/napravleniya/') return html(await renderProductHub(env));\\n    if (url.pathname !== '/' && url.pathname !== '/index.html' && url.pathname !== '/vorota' && url.pathname !== '/vorota/')"
);
patchedWorkerSource = patchedWorkerSource.replace('return html(PAGE);\\n  }\\n};', 'return html(await renderPublicPage(env));\\n  }\\n};');"""
repl(old,new,'public category routes')

repl(
"  .replace('__PUBLIC_PAGE__', JSON.stringify(html))\n  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))",
"  .replace('__PUBLIC_PAGE__', JSON.stringify(html))\n  .replace('__HOME_PAGE__', JSON.stringify(homeHtml))\n  .replace('__ADMIN_PAGE__', JSON.stringify(adminHtml))",
'home page placeholder')

p.write_text(s,encoding='utf-8')

p=Path('worker/site-settings-d1.js')
s=p.read_text(encoding='utf-8')
if 'async function renderProductHub(env)' not in s:
    s += """

async function renderProductHub(env) {
  const site = await loadSiteProfile(env);
  const serializedSite = JSON.stringify(site).replace(/</g, '\\u003c');
  return HOME_PAGE.replace('__RUNTIME_SITE_DATA__', serializedSite);
}
"""
p.write_text(s,encoding='utf-8')
print('Stage 2 applied')
