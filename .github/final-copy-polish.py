from pathlib import Path


def replace(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old in s:
        p.write_text(s.replace(old, new), encoding='utf-8')
        return
    if new not in s:
        raise SystemExit(f'{label}: neither old nor new text found in {path}')

# Public gate page: remove ambiguity around delivery, posts and consent.
replace('index.html',
        'content="Ворота с калиткой на заказ в Мелеузе: каталог моделей, предварительный расчёт монтажа, столбов и доставки."',
        'content="Ворота с калиткой на заказ в Мелеузе: каталог моделей и предварительный расчёт стоимости с установкой, новыми столбами при необходимости и доставкой."',
        'meta description')
replace('index.html',
        'content="Каталог ворот с реальными ценами. Рассчитайте размеры, столбы и доставку онлайн."',
        'content="Каталог ворот с ценами. Рассчитайте стоимость по своим размерам с установкой, новыми столбами при необходимости и доставкой."',
        'og description')
replace('index.html',
        'Выберите дизайн и сразу узнайте предварительную стоимость с установкой, столбами и доставкой.',
        'Выберите дизайн и рассчитайте предварительную стоимость по своим размерам — с учётом установки, новых столбов при необходимости и доставки.',
        'hero text')
replace('index.html',
        '<div><small>Если столбы уже есть</small><strong id="heroInstalledPrice">от 64 600 ₽</strong><span>ворота, калитка и установка</span></div>',
        '<div><small>Если подходящие столбы уже есть</small><strong id="heroInstalledPrice">от 64 600 ₽</strong><span>ворота, калитка и установка · без доставки</span></div>',
        'hero installed price label')
replace('index.html',
        '<div><small>Под ключ с новыми столбами</small><strong id="heroTurnkeyPrice">от 89 600 ₽</strong><span>с новыми усиленными столбами</span></div>',
        '<div><small>С новыми усиленными столбами</small><strong id="heroTurnkeyPrice">от 89 600 ₽</strong><span>ворота, калитка, установка и столбы · без доставки</span></div>',
        'hero posts price label')
replace('index.html',
        'Цены указаны для стандартного размера: ворота 3,4×1,8 м и калитка 1×1,8 м. Другие размеры можно рассчитать на сайте.',
        'Цены выше указаны для стандартного размера и без доставки: ворота 3,4×1,8 м и калитка 1×1,8 м. Свои размеры и доставку можно рассчитать на сайте.',
        'hero size note')
replace('index.html',
        '<span><b>Бесплатно</b> замер и окончательный расчёт</span>',
        '<span><b>Бесплатный замер</b> и окончательный расчёт</span>',
        'hero free measurement')
replace('index.html',
        '<div><span class="section-number">02</span><h2>Что входит в цену, если столбы уже есть</h2></div>',
        '<div><span class="section-number">02</span><h2>Что входит в цену, если подходящие столбы уже есть</h2></div>',
        'package title')
replace('index.html',
        'В базовую цену входит изготовление ворот с калиткой и установка на ваши подходящие существующие столбы.',
        'В базовую цену входит изготовление ворот с калиткой и установка на ваши столбы, если они подходят по прочности и состоянию.',
        'package intro')
replace('index.html',
        'Новые усиленные столбы и доставка рассчитываются отдельно. Цвет профнастила выберете при оформлении заказа — он не усложняет предварительный расчёт.',
        'Новые усиленные столбы при необходимости и доставка автоматически добавляются к расчёту. Цвет профнастила выберете при оформлении заказа — на предварительную стоимость он не влияет.',
        'package note')
replace('index.html',
        '<small id="postsHint">Связка, установка и бетонирование</small>',
        '<small id="postsHint">Установка, бетонирование и усиленная связка столбов</small>',
        'posts hint')
replace('index.html',
        '<label class="city-label">Населённый пункт<input id="cityInput"',
        '<label class="city-label">Место установки<input id="cityInput"',
        'delivery label')
replace('index.html',
        '<div class="delivery-result pending" id="deliveryResult">Выберите, где устанавливаем.</div>',
        '<div class="delivery-result pending" id="deliveryResult">Выберите место установки.</div>',
        'delivery initial prompt')
replace('index.html',
        'По Мелеузу — бесплатно. Для населённых пунктов из прайса используется готовая стоимость, для остальных — автомобильный маршрут от Мелеуза по общей ставке доставки. Если маршрут не найдётся, заявку всё равно можно отправить.',
        'По Мелеузу — бесплатно. Для некоторых населённых пунктов используется готовая стоимость доставки, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. Если маршрут не найдётся, заявку всё равно можно отправить — стоимость доставки уточним при подтверждении заявки.',
        'delivery help')
replace('index.html',
        '<span>Согласен на обработку данных. <a href="#privacyPolicy">Политика обработки данных</a></span>',
        '<span>Даю согласие на обработку персональных данных. <a href="#privacyPolicy">Политика обработки персональных данных</a></span>',
        'consent copy')
replace('index.html',
        'Заявка сохранится в защищённой админ-панели. WhatsApp после отправки — только по желанию.',
        'После отправки мы свяжемся с вами для согласования замера. При желании расчёт можно продублировать в WhatsApp.',
        'lead privacy copy')
replace('index.html',
        '<div class="section-head"><div><span class="section-number">04</span><h2>Ответы на вопросы</h2></div><p>Коротко о размерах, установке, сроках и доставке.</p></div>',
        '<div class="section-head"><div><span class="section-number">04</span><h2>Ответы на вопросы</h2></div><p>Коротко о размерах, цвете, установке и доставке.</p></div>',
        'faq intro')
replace('index.html',
        'По Мелеузу доставка бесплатная. Для населённых пунктов из списка действует готовая стоимость, для остальных используем автомобильный маршрут от Мелеуза. Во всех направлениях сайта будет использоваться одна и та же логика доставки.',
        'По Мелеузу доставка бесплатная. Для некоторых населённых пунктов действует готовая стоимость, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. Доставка автоматически учитывается в итоговой сумме.',
        'faq delivery')
replace('index.html',
        '<a href="#privacyPolicy">Обработка данных</a>',
        '<a href="#privacyPolicy">Персональные данные</a>',
        'footer privacy label')
replace('index.html',
        '<h2>Политика обработки данных</h2>',
        '<h2>Политика обработки персональных данных</h2>',
        'policy modal title')

# Gate-specific runtime strings.
replace('app.js',
        "description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м.',",
        "description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. Доставка добавится в расчёте.',",
        'card description')
replace('app.js',
        '<div class="price-row"><small>Если столбы уже есть</small><strong>${money(product.price+product.install)}</strong></div>',
        '<div class="price-row"><small>Если подходящие столбы уже есть</small><strong>${money(product.price+product.install)}</strong></div>',
        'card existing posts label')
replace('app.js',
        '<div class="price-row turnkey"><small>Под ключ с новыми столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>',
        '<div class="price-row turnkey"><small>С новыми усиленными столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>',
        'card new posts label')
replace('app.js',
        "postsHint.textContent='Связка, установка и бетонирование';",
        "postsHint.textContent='Установка, бетонирование и усиленная связка столбов';",
        'dynamic posts hint')
replace('app.js',
        "baseInstallNote.textContent=postsCheck.checked?'Расчёт под ключ с новыми усиленными столбами':'Установка ворот и калитки на ваши подходящие столбы уже входит в цену';",
        "baseInstallNote.textContent=postsCheck.checked?'Расчёт с новыми усиленными столбами':'Установка ворот и калитки на ваши подходящие столбы уже входит в цену';",
        'dynamic posts note')
replace('app.js',
        "const lines=[['Ворота с калиткой и установка',base]];",
        "const lines=[['Ворота с калиткой + установка',base]];",
        'estimate base line')
replace('app.js',
        "  if(deliveryPending)note+=' Укажите и подтвердите населённый пункт, чтобы учесть доставку.';",
        "  if(deliveryKind==='error') note='Доставку автоматически рассчитать не удалось. Уточним её при подтверждении заявки.';\n  else if(deliveryPending)note+=' Укажите и подтвердите место установки, чтобы учесть доставку.';",
        'delivery estimate note')
replace('app.js',
        "'Сначала укажите населённый пункт и рассчитайте доставку'",
        "'Сначала укажите место установки и рассчитайте доставку'",
        'delivery validation copy')
replace('app.js',
        "`с установкой · ${money(product.price+product.install)}`",
        "`с установкой, без доставки · ${money(product.price+product.install)}`",
        'lightbox price copy')

# Shared delivery language: client-facing, no internal 'price list' jargon.
replace('shared/delivery.js',
        "summaryValue.textContent = normalize(city) === normalize('Мелеуз') ? 'Мелеуз — бесплатно' : `${city} — доставка учтена в цене`;",
        "summaryValue.textContent = normalize(city) === normalize('Мелеуз') ? 'Мелеуз — бесплатно' : `${city} — доставка учтена в итоговой сумме`;",
        'delivery summary')
replace('shared/delivery.js',
        "setResult(normalize(city) === normalize('Мелеуз') ? 'Доставка по Мелеузу — бесплатно' : `${city} · доставка учтена в итоговой цене`, 'success');",
        "setResult(normalize(city) === normalize('Мелеуз') ? 'Доставка по Мелеузу — бесплатно' : `${city} · доставка учтена в итоговой сумме`, 'success');",
        'fixed delivery result')
replace('shared/delivery.js',
        "setResult('Пункта нет в прайсе — рассчитайте доставку по маршруту.', 'pending');",
        "setResult('Для этого населённого пункта нет готовой стоимости доставки. Рассчитайте её по автомобильному маршруту.', 'pending');",
        'delivery pending copy')
replace('shared/delivery.js',
        "setResult(`${state.shortName} · доставка учтена в итоговой цене`, 'success');",
        "setResult(`${state.shortName} · доставка учтена в итоговой сумме`, 'success');",
        'calculated delivery result')
replace('shared/delivery.js',
        "setResult('Выберите, где устанавливаем.', 'pending');",
        "setResult('Выберите место установки.', 'pending');",
        'delivery edit prompt')
replace('shared/delivery.js',
        "return {name:'Населённый пункт', value:resolved ? Number(state.price)||0 : null, display:city || 'Не выбран', resolved};",
        "return {name:'Место установки', value:resolved ? Number(state.price)||0 : null, display:city || 'Не выбрано', resolved};",
        'delivery estimate line')

# Mobile CTA wording must cover villages and settlements, not only cities.
replace('gate-page-ui.js',
        "else if (!deliveryCanProceed) cta.textContent = `Указать город${price ? ` · ${price}` : ''}`;",
        "else if (!deliveryCanProceed) cta.textContent = `Указать место установки${price ? ` · ${price}` : ''}`;",
        'mobile delivery CTA')

# Defaults and legacy migration for runtime-admin text, so old defaults in D1 do not restore ambiguity.
replace('worker/site-settings-d1.js',
        "heroText: 'Выберите дизайн и сразу узнайте предварительную стоимость с монтажом, столбами и доставкой.',",
        "heroText: 'Выберите дизайн и рассчитайте предварительную стоимость по своим размерам — с учётом установки, новых столбов при необходимости и доставки.',",
        'default hero text')
replace('worker/site-settings-d1.js',
        "finalCtaText: 'Калькулятор учтёт комплектацию и доставку. Итоговую сумму зафиксируем в договоре после замера.'",
        "finalCtaText: 'Калькулятор учтёт ваши размеры, новые усиленные столбы при необходимости и доставку. Итоговую сумму зафиксируем в договоре после бесплатного замера.'",
        'default final cta')
replace('worker/site-settings-d1.js',
        "function normalizeSiteProfile(input) {\n  const source = input && typeof input === 'object' ? input : {};\n  return {",
        "function normalizeSiteProfile(input) {\n  const source = input && typeof input === 'object' ? {...input} : {};\n  const legacyHeroTexts = new Set([\n    'Выберите дизайн и сразу узнайте предварительную стоимость с монтажом, столбами и доставкой.',\n    'Выберите дизайн и сразу узнайте предварительную стоимость с установкой, столбами и доставкой.'\n  ]);\n  if (legacyHeroTexts.has(String(source.heroText || '').trim())) source.heroText = DEFAULT_SITE_PROFILE.heroText;\n  if (String(source.finalCtaText || '').trim() === 'Калькулятор учтёт комплектацию и доставку. Итоговую сумму зафиксируем в договоре после замера.') source.finalCtaText = DEFAULT_SITE_PROFILE.finalCtaText;\n  return {",
        'legacy site copy migration')

# Guard the polished wording in permanent foundation tests.
p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace("assert(app.includes(\"Ворота с калиткой и установка\"), 'Base gate estimate must combine product and installation');",
              "assert(app.includes(\"Ворота с калиткой + установка\"), 'Base gate estimate must combine product and installation');")
marker = "assert(build.includes('gatePageCss') && build.includes('customerContextSource') && build.includes('gatePageUiSource'), 'Production build does not bundle the gate foundation');"
addition = marker + "\n\nfor (const ambiguous of ['Под ключ с новыми столбами','<b>Бесплатно</b> замер','Пункта нет в прайсе','Согласен на обработку данных.']) {\n  assert(!html.includes(ambiguous), `Ambiguous public copy returned: ${ambiguous}`);\n}\nassert(!app.includes('Под ключ с новыми столбами') && !app.includes('Расчёт под ключ'), 'Ambiguous turnkey wording returned to gate runtime');\nassert(!delivery.includes('Пункта нет в прайсе') && delivery.includes('нет готовой стоимости доставки'), 'Delivery copy must avoid internal price-list jargon');\nassert(html.includes('Если подходящие столбы уже есть') && html.includes('без доставки'), 'Initial prices must clearly state posts condition and delivery exclusion');\nassert(html.includes('Даю согласие на обработку персональных данных.'), 'Consent wording must explicitly mention personal data');\nassert(ui.includes('Указать место установки'), 'Mobile CTA must work for cities, villages and settlements');"
if addition not in s:
    if marker not in s:
        raise SystemExit('test marker not found')
    s = s.replace(marker, addition, 1)
p.write_text(s, encoding='utf-8')

print('Final client copy polish applied')
