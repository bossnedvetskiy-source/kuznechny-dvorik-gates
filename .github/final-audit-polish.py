from pathlib import Path


def replace(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old in s:
        p.write_text(s.replace(old, new), encoding='utf-8')
        return
    if new not in s:
        raise SystemExit(f'{label}: neither old nor new text found in {path}')

replace('index.html', '<body>\n  <header class="topbar">', '<body>\n  <a class="skip-link" href="#catalog">Перейти к каталогу ворот</a>\n  <header class="topbar">', 'skip link')
replace('index.html', 'Новые усиленные столбы при необходимости и доставка автоматически добавляются к расчёту. Цвет профнастила выберете при оформлении заказа — на предварительную стоимость он не влияет.', 'Новые усиленные столбы при необходимости и доставка добавляются к расчёту. Цвет профнастила выберете при оформлении заказа — на предварительную стоимость он не влияет.', 'package note accuracy')
replace('index.html', 'Установка, бетонирование и усиленная связка столбов', 'Установка, бетонирование и усиленная связка между столбами под землёй', 'posts explanation')
replace('index.html', 'После отправки мы свяжемся с вами для согласования замера. При желании расчёт можно продублировать в WhatsApp.', 'После отправки мы свяжемся с вами в рабочее время для согласования замера. При желании расчёт можно продублировать в WhatsApp.', 'lead contact timing')
replace('index.html', 'По Мелеузу доставка бесплатная. Для некоторых населённых пунктов действует готовая стоимость, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. Доставка автоматически учитывается в итоговой сумме.', 'По Мелеузу доставка бесплатная. Для некоторых населённых пунктов действует готовая стоимость, для остальных она рассчитывается по автомобильному маршруту от Мелеуза. После выбора места установки доставка учитывается в итоговой сумме; если маршрут не найдётся, стоимость уточним при подтверждении заявки.', 'faq delivery edge case')
replace('index.html', 'Данные не предназначены для продажи третьим лицам.', 'Данные не продаются третьим лицам.', 'privacy plain language')
replace('index.html', '<h2>Спасибо! Заявка получена</h2><p><b>Мы свяжемся с вами</b>, чтобы согласовать бесплатный замер и окончательную стоимость.</p>', '<h2>Спасибо! Заявка получена</h2><p><b>Мы свяжемся с вами в рабочее время</b>, чтобы согласовать бесплатный замер и окончательную стоимость.</p>', 'success timing')

replace('app.js', "description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. Доставка добавится в расчёте.',", "description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. Доставку рассчитаем после выбора места установки.',", 'card delivery wording')
replace('app.js', "postsHint.textContent='Установка, бетонирование и усиленная связка столбов';", "postsHint.textContent='Установка, бетонирование и усиленная связка между столбами под землёй';", 'dynamic posts explanation')

# Keyboard users should be able to skip directly to the catalog without changing the visual layout.
p = Path('gate-page.css')
s = p.read_text(encoding='utf-8')
rule = ".skip-link{position:fixed;z-index:900;left:12px;top:12px;padding:10px 13px;border-radius:10px;background:#fff;color:#111315;font-size:12px;font-weight:800;box-shadow:0 8px 28px rgba(0,0,0,.22);transform:translateY(-180%);transition:transform .15s}.skip-link:focus{transform:translateY(0)}\n"
if '.skip-link{' not in s:
    s = rule + s
p.write_text(s, encoding='utf-8')

# Keep the final copy guard aligned with the new wording.
p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
marker = "assert(ui.includes('Указать место установки'), 'Mobile CTA must work for cities, villages and settlements');"
addition = marker + "\nassert(html.includes('связка между столбами под землёй'), 'Posts wording must explain what the linkage means');\nassert(html.includes('свяжемся с вами в рабочее время'), 'Lead confirmation must set a realistic contact expectation');\nassert(html.includes('class=\"skip-link\"'), 'Gate page must include a keyboard skip link');"
if addition not in s:
    if marker not in s:
        raise SystemExit('test copy marker not found')
    s = s.replace(marker, addition, 1)
p.write_text(s, encoding='utf-8')

print('Final audit polish applied')
