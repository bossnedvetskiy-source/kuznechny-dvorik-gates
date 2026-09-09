from pathlib import Path

p=Path('scripts/build.mjs')
s=p.read_text(encoding='utf-8')
if 'customerContextSource' not in s:
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

p=Path('shared/delivery.js')
s=p.read_text(encoding='utf-8')
if 'function clearSaved()' not in s:
    end=s.find("\n  function createController")
    if end<0: raise SystemExit('delivery insertion anchor not found')
    addition="\n  function clearSaved() {\n    try { sessionStorage.removeItem(MEMORY_KEY); } catch {}\n    window.KUZDVOR_CUSTOMER?.set({city:''});\n  }\n"
    s=s[:end]+addition+s[end:]
    s=s.replace("    const chooseOther = () => {\n      editingOther = true;", "    const chooseOther = () => {\n      clearSaved();\n      editingOther = true;",1)
    s=s.replace("    const edit = () => {\n      editingOther = false;", "    const edit = () => {\n      clearSaved();\n      editingOther = false;",1)
    p.write_text(s,encoding='utf-8')

p=Path('app.js')
s=p.read_text(encoding='utf-8')
if 'const openProductId = calculatorPanel.hidden' not in s:
    old="function renderProducts() {\n  const visible = catalogProducts.slice(0, visibleCount);"
    new="function renderProducts() {\n  const openProductId = calculatorPanel.hidden ? '' : selectedProductId;\n  if (calculatorPanel.parentElement === grid) calculatorPanel.remove();\n  const visible = catalogProducts.slice(0, visibleCount);"
    if old not in s: raise SystemExit('render start anchor not found')
    s=s.replace(old,new,1)
    marker="\n}\n\nfunction showCardImage"
    pos=s.find(marker)
    if pos<0: raise SystemExit('render end marker not found')
    insert="\n  if(openProductId){\n    const openCard=grid.querySelector(`[data-card-product=\"${CSS.escape(openProductId)}\"]`);\n    if(openCard){\n      placeCalculatorAfterRow(openCard);\n      calculatorPanel.hidden=false;\n      document.body.classList.add('calculator-open');\n      openCard.querySelector('.select-product')?.setAttribute('aria-expanded','true');\n      calculate();\n    } else {\n      calculatorPanel.hidden=true;\n      document.body.classList.remove('calculator-open');\n    }\n  }\n"
    s=s[:pos]+insert+s[pos:]
    p.write_text(s,encoding='utf-8')

p=Path('gate-page-ui.js')
s=p.read_text(encoding='utf-8')
if 'policyBody.dataset.synced' not in s:
    old="  const openPolicy = () => {\n    policyBackdrop?.removeAttribute('hidden');"
    new="  const openPolicy = () => {\n    const policyBody = policyModal?.querySelector('.policy-body');\n    const policySource = document.querySelector('#privacyPolicy .privacy-content');\n    if (policyBody && policySource && !policyBody.dataset.synced) {\n      policyBody.innerHTML = policySource.innerHTML;\n      policyBody.dataset.synced = '1';\n    }\n    policyBackdrop?.removeAttribute('hidden');"
    if old not in s: raise SystemExit('policy modal anchor not found')
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')

print('Gate foundation patch and follow-up fixes applied')
