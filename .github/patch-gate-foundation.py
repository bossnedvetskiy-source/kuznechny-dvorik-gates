from pathlib import Path

p=Path('scripts/build.mjs')
s=p.read_text(encoding='utf-8')

old="const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, catalogImages, pricesSource, deliveryPricesSource, js, publicSiteJsSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all(["
new="const [htmlSource, homeHtmlSource, homeCss, productCategoriesSource, css, storefrontCss, gatePageCss, catalogImages, pricesSource, deliveryPricesSource, customerContextSource, deliverySharedSource, leadsSharedSource, js, publicSiteJsSource, gatePageUiSource, adminHtmlSource, adminCss, adminJsSource, adminPricesJsSource, adminSiteJsSource, adminLeadsJsSource, workerSource, adminAuthSource, siteSettingsSource, catalogMediaSource, leadsSource] = await Promise.all(["
if old not in s: raise SystemExit('build destructuring anchor not found')
s=s.replace(old,new,1)

old="  readFile('storefront.css', 'utf8'),\n  readFile('catalog-images.js', 'utf8'),\n  readFile('prices.js', 'utf8'),\n  readFile('delivery-prices.json', 'utf8'),\n  readFile('app.js', 'utf8'),\n  readFile('public-site-settings.js', 'utf8'),"
new="  readFile('storefront.css', 'utf8'),\n  readFile('gate-page.css', 'utf8'),\n  readFile('catalog-images.js', 'utf8'),\n  readFile('prices.js', 'utf8'),\n  readFile('delivery-prices.json', 'utf8'),\n  readFile('shared/customer-context.js', 'utf8'),\n  readFile('shared/delivery.js', 'utf8'),\n  readFile('shared/leads.js', 'utf8'),\n  readFile('app.js', 'utf8'),\n  readFile('public-site-settings.js', 'utf8'),\n  readFile('gate-page-ui.js', 'utf8'),"
if old not in s: raise SystemExit('build input anchor not found')
s=s.replace(old,new,1)

start=s.find("let publicJs = js.replace(")
end=s.find("\nconst homeHtml = homeHtmlSource",start)
if start<0 or end<0: raise SystemExit('publicJs patch block not found')
s=s[:start]+"const publicJs = js;\n"+s[end:]

old="  .replace('<link rel=\"stylesheet\" href=\"styles.css\">', `<style>${css}\\n${storefrontCss}</style>`)"
new="  .replace('<link rel=\"stylesheet\" href=\"styles.css\">', `<style>${css}\\n${storefrontCss}\\n${gatePageCss}</style>`)\n  .replace('<link rel=\"stylesheet\" href=\"storefront.css\">', '')\n  .replace('<link rel=\"stylesheet\" href=\"gate-page.css\">', '')"
if old not in s: raise SystemExit('style bundle anchor not found')
s=s.replace(old,new,1)

old="  .replace('<script src=\"gate-calc-engine.js\"></script>', '')\n  .replace('<script src=\"app.js\"></script>', `<script>${publicJs}</script><script>${publicSiteJsSource}</script>`);"
new="  .replace('<script src=\"gate-calc-engine.js\"></script>', '')\n  .replace('<script src=\"shared/customer-context.js\"></script>', `<script>${customerContextSource}</script>`)\n  .replace('<script src=\"shared/delivery.js\"></script>', `<script>${deliverySharedSource}</script>`)\n  .replace('<script src=\"shared/leads.js\"></script>', `<script>${leadsSharedSource}</script>`)\n  .replace('<script src=\"app.js\"></script>', `<script>${publicJs}</script>`)\n  .replace('<script src=\"public-site-settings.js\"></script>', `<script>${publicSiteJsSource}</script>`)\n  .replace('<script src=\"gate-page-ui.js\"></script>', `<script>${gatePageUiSource}</script>`);"
if old not in s: raise SystemExit('script bundle anchor not found')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('Gate foundation build patch applied')
