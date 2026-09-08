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

s = s.replace('<div><small>На готовые столбы</small><strong id="heroInstalledPrice">', '<div><small>Если столбы уже есть</small><strong id="heroInstalledPrice">', 1)
s = s.replace('<div><small>Полностью под ключ</small><strong id="heroTurnkeyPrice">', '<div><small>Под ключ с новыми столбами</small><strong id="heroTurnkeyPrice">', 1)
s = s.replace('<div><span class="section-number">02</span><h2>Что входит в комплект</h2></div>\n        <p>Стоимость модели уже включает изготовление готовых ворот и калитки стандартного размера.</p>', '<div><span class="section-number">02</span><h2>Что входит в цену, если столбы уже есть</h2></div>\n        <p>В базовую цену входит изготовление ворот с калиткой и их установка на ваши готовые столбы.</p>', 1)
s = s.replace('<p class="package-note">Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. В базовую цену входит установка на готовые столбы. Новые усиленные столбы и доставка рассчитываются отдельно.</p>', '<p class="package-note">Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. В цену входят изготовление и установка ворот с калиткой, если подходящие столбы уже есть. Новые усиленные столбы и доставка рассчитываются отдельно.</p>', 1)
s = s.replace('<label><span id="widthLabelText">Ширина ворот, м</span><input id="widthInput"', '<label><span id="widthLabelText">Ширина ворот без калитки, м</span><input id="widthInput"', 1)
s = s.replace('            </div>\n            <div class="size-notice" id="sizeNotice" hidden>', '            </div>\n            <small class="dimension-help" id="dimensionHelp">Ворота и калитка указываются отдельно.</small>\n            <div class="size-notice" id="sizeNotice" hidden>', 1)
s = s.replace('<input id="cityInput" list="citySuggestions" type="text" value="Мелеуз" placeholder="Выберите или введите название"', '<input id="cityInput" list="citySuggestions" type="text" value="" placeholder="Введите ваш населённый пункт"', 1)

# Remove dead automatic catalogue loader. The app.js Show more button is the only catalogue pagination path.
s = re.sub(r'\n  <script>\n    \(\(\) => \{\n      const more = document\.getElementById\(\'catalogMore\'\);.*?observer\.observe\(more\);\n    \}\)\(\);\n  </script>', '', s, count=1, flags=re.S)

# Return to the exact card the customer was comparing, not to the top of the catalogue.
s = s.replace("          catalog?.scrollIntoView({behavior:'smooth',block:'start'});", "          const activeId=productSelect?.value||'';\n          const activeCard=activeId?catalog?.querySelector(`[data-card-product=\"${CSS.escape(activeId)}\"]`):null;\n          (activeCard||catalog)?.scrollIntoView({behavior:'smooth',block:'center'});", 1)

# Close success dialog in place instead of jumping back to catalogue.
s = s.replace("      doneButton.addEventListener('click',()=>{closeSuccess();catalog?.scrollIntoView({behavior:'smooth',block:'start'});});", "      doneButton.addEventListener('click',closeSuccess);", 1)

# Replace the old delivery summary with an explicit first-time choice.
old_delivery = r'''      const deliveryBlock=cityInput?.closest('.form-block');
      if(deliveryBlock&&!deliveryBlock.classList.contains('mobile-delivery-wrap')){
        deliveryBlock.classList.add('mobile-delivery-wrap');
        const summary=document.createElement('div');
        summary.className='mobile-delivery-summary';
        summary.innerHTML='<span>Доставка</span><strong></strong><button type="button">Изменить</button>';
        deliveryBlock.querySelector('.step-label')?.after(summary);
        const summaryValue=summary.querySelector('strong');
        const syncDeliverySummary=()=>{
          const city=(cityInput?.value||'').trim();
          const result=(deliveryResult?.textContent||'').toLowerCase();
          if(!city) summaryValue.textContent='Укажите населённый пункт';
          else if(city.toLowerCase().replace('ё','е')==='мелеуз') summaryValue.textContent='Мелеуз — бесплатно';
          else if(result.includes('бесплат')) summaryValue.textContent=`${city} — бесплатно`;
          else if(result.includes('выбран')||result.includes('подтвержд')) summaryValue.textContent=`${city} — доставка учтена в итоге`;
          else summaryValue.textContent=city;
          const chosen=Boolean(city)&&(result.includes('бесплат')||result.includes('выбран')||result.includes('подтвержд'));
          if(chosen) deliveryBlock.classList.remove('is-editing');
        };
        if(cityInput) cityInput.placeholder='Введите ваш населённый пункт';
        summary.querySelector('button').addEventListener('click',()=>{
          deliveryBlock.classList.add('is-editing');
          if(cityInput){
            cityInput.value='';
            cityInput.placeholder='Введите ваш населённый пункт';
            cityInput.dispatchEvent(new Event('input',{bubbles:true}));
          }
          setTimeout(()=>cityInput?.focus(),80);
        });
        cityInput?.addEventListener('input',syncDeliverySummary);
        cityInput?.addEventListener('change',syncDeliverySummary);
        if(deliveryResult) new MutationObserver(syncDeliverySummary).observe(deliveryResult,{childList:true,subtree:true,characterData:true});
        syncDeliverySummary();
      }
'''
new_delivery = r'''      const deliveryBlock=cityInput?.closest('.form-block');
      if(deliveryBlock&&!deliveryBlock.classList.contains('delivery-choice-wrap')){
        deliveryBlock.classList.add('delivery-choice-wrap');
        const cityLabel=deliveryBlock.querySelector('.city-label');
        const chooser=document.createElement('div');
        chooser.className='delivery-choice-buttons';
        chooser.innerHTML='<button type="button" data-delivery-choice="meleuz">Мелеуз</button><button type="button" data-delivery-choice="other">Другой населённый пункт</button>';
        cityLabel?.before(chooser);
        const meleuzButton=chooser.querySelector('[data-delivery-choice="meleuz"]');
        const otherButton=chooser.querySelector('[data-delivery-choice="other"]');
        const normalized=value=>String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
        const syncDeliveryChoice=()=>{
          const city=(cityInput?.value||'').trim();
          const isMeleuz=normalized(city)==='мелеуз';
          const isOther=Boolean(city)&&!isMeleuz;
          meleuzButton?.classList.toggle('is-active',isMeleuz);
          otherButton?.classList.toggle('is-active',isOther||deliveryBlock.dataset.mode==='other');
          meleuzButton?.setAttribute('aria-pressed',String(isMeleuz));
          otherButton?.setAttribute('aria-pressed',String(isOther||deliveryBlock.dataset.mode==='other'));
          cityLabel?.classList.toggle('is-visible',isOther||deliveryBlock.dataset.mode==='other');
        };
        meleuzButton?.addEventListener('click',()=>{
          deliveryBlock.dataset.mode='meleuz';
          if(cityInput){cityInput.value='Мелеуз';cityInput.dispatchEvent(new Event('input',{bubbles:true}));cityInput.blur();}
          syncDeliveryChoice();
        });
        otherButton?.addEventListener('click',()=>{
          deliveryBlock.dataset.mode='other';
          if(cityInput&&normalized(cityInput.value)==='мелеуз'){cityInput.value='';cityInput.dispatchEvent(new Event('input',{bubbles:true}));}
          syncDeliveryChoice();
          setTimeout(()=>cityInput?.focus(),60);
        });
        cityInput?.addEventListener('input',()=>{if(cityInput.value.trim()&&normalized(cityInput.value)!=='мелеуз')deliveryBlock.dataset.mode='other';syncDeliveryChoice();});
        cityInput?.addEventListener('change',syncDeliveryChoice);
        syncDeliveryChoice();
      }
'''
if old_delivery not in s:
    raise SystemExit('anchor not found: delivery UX block')
s = s.replace(old_delivery, new_delivery, 1)

# Keep one submit request in app.js. This UI layer only reacts to the successful lead event.
pattern = re.compile(r"      sendButton\?\.addEventListener\('click',async event=>\{.*?\n      \},true\);", re.S)
replacement = r'''      document.addEventListener('lead-sent',event=>{
        const payload=event.detail?.payload||null;
        if(payload){
          const whatsappDigits=String((window.SITE_SETTINGS||{}).whatsappDigits||'79373296750');
          waButton.href=`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(payload.message||'Здравствуйте! Хочу уточнить заказ.')}`;
        }
        successBackdrop.hidden=false;
        successModal.hidden=false;
        syncFriendlyCta();
      });'''
s, count = pattern.subn(lambda m: replacement, s, count=1)
if count != 1:
    raise SystemExit(f'submit UI block replacement count={count}')

# The final mobile CTA controller at the bottom remains authoritative.
s = re.sub(r"      const syncFriendlyCta=\(\)=>\{.*?\n      \};", "      const syncFriendlyCta=()=>{};", s, count=1, flags=re.S)
s = s.replace("let text='Выбрать модель';", "let text='Выбрать ворота';", 1)

p.write_text(s, encoding='utf-8')

# ---------- app.js ----------
p = Path('app.js')
app = p.read_text(encoding='utf-8')
app = app.replace('<div class="price-row"><small>На готовые столбы</small>', '<div class="price-row"><small>Если столбы уже есть</small>', 1)
app = app.replace('<div class="price-row turnkey"><small>Под ключ со столбами</small>', '<div class="price-row turnkey"><small>Под ключ с новыми столбами</small>', 1)
app = app.replace("  mobilePrimaryCta.textContent = 'Рассчитать стоимость';\n", '', 1)
app = app.replace("let deliveryState = {kind:'fixed',name:'Мелеуз',resolvedName:'Мелеуз',price:0};", "let deliveryState = {kind:'empty',name:'',resolvedName:'',price:null};", 1)
app = app.replace("const sizeNotice=document.getElementById('sizeNotice');", "const sizeNotice=document.getElementById('sizeNotice');\nconst dimensionHelp=document.getElementById('dimensionHelp');", 1)
app = app.replace("  installHint.textContent=product.type==='frame'?'Самостоятельная сборка':product.type==='sliding'?'Рассчитывается после замера':'На готовые столбы';", "  installHint.textContent=product.type==='frame'?'Самостоятельная сборка':product.type==='sliding'?'Рассчитывается после замера':'Если столбы уже есть';", 1)
app = app.replace("  widthLabelText.textContent=product.type==='wicket'?'Ширина калитки, м':product.type==='sliding'?'Ширина проёма, м':'Ширина ворот, м';", "  widthLabelText.textContent=product.type==='wicket'?'Ширина калитки, м':product.type==='sliding'?'Ширина проёма, м':'Ширина ворот без калитки, м';\n  if(dimensionHelp) dimensionHelp.hidden=product.type!=='catalog';", 1)
app = app.replace("  if(!calculatorPanel.hidden) mobilePrimaryCta.textContent=`К заявке · ${approximate?'от ':''}${money(total)}`;\n", '', 1)
p.write_text(app, encoding='utf-8')

# ---------- public-site-settings.js ----------
p = Path('public-site-settings.js')
js = p.read_text(encoding='utf-8')
js = js.replace("setText('.hero-prices > div:nth-child(2) small', 'Под ключ');", "setText('.hero-prices > div:nth-child(2) small', 'Под ключ с новыми столбами');", 1)
js = js.replace('С установкой на готовые столбы', 'Если столбы уже есть')
js = js.replace('В цену уже входит установка на готовые столбы', 'Если столбы уже есть — установка ворот и калитки уже входит в цену')
p.write_text(js, encoding='utf-8')

# ---------- storefront.css ----------
p = Path('storefront.css')
css = p.read_text(encoding='utf-8')
marker='/* Final usability polish 2026-09-09 */'
if marker not in css:
    css += r'''

/* Final usability polish 2026-09-09 */
.dimension-help{display:block;margin:8px 0 0;color:rgba(255,255,255,.58);font-size:12px;line-height:1.4}
.delivery-choice-buttons{display:grid;grid-template-columns:1fr 1.35fr;gap:8px;margin:8px 0 10px}
.delivery-choice-buttons button{min-height:46px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#101113;color:#fff;padding:9px 12px;font-size:13px;font-weight:800;cursor:pointer}
.delivery-choice-buttons button.is-active{border-color:rgba(230,189,105,.72);background:rgba(230,189,105,.12);color:var(--gold-light)}
.delivery-choice-wrap .city-label{display:none}
.delivery-choice-wrap .city-label.is-visible{display:grid}

@media(max-width:620px){
  .hero>.hero-photo{display:none!important}
  .hero>.hero-size-note{order:5!important;margin:9px 0 0!important}
  .hero>.hero-actions{order:6!important}
  .hero>.hero-points{order:7!important}
  .price-row small{font-size:11px!important;line-height:1.35!important}
  .filter-tabs .filter,.mobile-delivery-summary button{min-height:44px!important}
  .delivery-choice-buttons{grid-template-columns:1fr 1.35fr;gap:7px;margin:8px 0 9px}
  .delivery-choice-buttons button{min-height:46px;font-size:12px;padding:8px 9px}
  .dimension-help{font-size:12px!important;color:rgba(255,255,255,.66)!important}
}
@media(max-width:390px){
  .price-stack{grid-template-columns:1fr!important}
  .price-row small{min-height:0!important}
}
'''
p.write_text(css, encoding='utf-8')

print('Final usability polish applied')
