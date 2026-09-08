from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

s = s.replace('Точная смета откроется под выбранной моделью.', 'Предварительный расчёт откроется под выбранной моделью.', 1)
s = s.replace('<div class="catalog-summary"><span id="catalogCount">38 моделей</span><span>В карточках — цена с монтажом и под ключ</span></div>', '<div class="catalog-summary"><span id="catalogCount">38 моделей</span></div>', 1)
s = s.replace('<small class="dimension-help" id="dimensionHelp">Ворота и калитка указываются отдельно.</small>', '<small class="dimension-help" id="dimensionHelp">Ворота и калитка указываются отдельно. Не знаете точные размеры? Оставьте стандартные — замерщик измерит проём бесплатно.</small>', 1)
s = s.replace('<div class="size-notice" id="sizeNotice" hidden>Цена пересчитана по выбранным размерам</div>', '<div class="size-notice" id="sizeNotice" hidden>Цена пересчитана по выбранным размерам</div>\n            <div class="size-memory-note" id="sizeMemoryNote" hidden>✓ Размер сохранён — можно сравнивать другие дизайны</div>', 1)

old = '''      const deliveryBlock=cityInput?.closest('.form-block');
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

new = '''      const deliveryBlock=cityInput?.closest('.form-block');
      if(deliveryBlock&&!deliveryBlock.classList.contains('delivery-choice-wrap')){
        deliveryBlock.classList.add('delivery-choice-wrap');
        const cityLabel=deliveryBlock.querySelector('.city-label');
        const chooser=document.createElement('div');
        chooser.className='delivery-choice-buttons';
        chooser.innerHTML='<button type="button" data-delivery-choice="meleuz">Мелеуз</button><button type="button" data-delivery-choice="other">Другой населённый пункт</button>';
        cityLabel?.before(chooser);
        const selectedSummary=document.createElement('div');
        selectedSummary.className='delivery-selected-summary';
        selectedSummary.hidden=true;
        selectedSummary.innerHTML='<div><span>Доставка</span><strong></strong></div><button type="button">Изменить</button>';
        chooser.after(selectedSummary);
        const selectedValue=selectedSummary.querySelector('strong');
        const meleuzButton=chooser.querySelector('[data-delivery-choice="meleuz"]');
        const otherButton=chooser.querySelector('[data-delivery-choice="other"]');
        const normalized=value=>String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
        const syncDeliveryChoice=()=>{
          const city=(cityInput?.value||'').trim();
          const result=(deliveryResult?.textContent||'').toLocaleLowerCase('ru-RU');
          const isMeleuz=normalized(city)==='мелеуз';
          const isOther=Boolean(city)&&!isMeleuz;
          const chosen=Boolean(city)&&(result.includes('бесплат')||result.includes('учтена')||result.includes('подтвержд')||result.includes('населённый пункт выбран'));
          meleuzButton?.classList.toggle('is-active',isMeleuz);
          otherButton?.classList.toggle('is-active',isOther||deliveryBlock.dataset.mode==='other');
          meleuzButton?.setAttribute('aria-pressed',String(isMeleuz));
          otherButton?.setAttribute('aria-pressed',String(isOther||deliveryBlock.dataset.mode==='other'));
          cityLabel?.classList.toggle('is-visible',!chosen&&(isOther||deliveryBlock.dataset.mode==='other'));
          deliveryBlock.classList.toggle('is-selected',chosen);
          selectedSummary.hidden=!chosen;
          if(chosen&&selectedValue) selectedValue.textContent=isMeleuz?'Мелеуз — бесплатно':`${city} — доставка учтена в цене`;
        };
        meleuzButton?.addEventListener('click',()=>{
          deliveryBlock.dataset.mode='meleuz';
          if(cityInput){cityInput.value='Мелеуз';cityInput.dispatchEvent(new Event('input',{bubbles:true}));cityInput.blur();}
          syncDeliveryChoice();
        });
        otherButton?.addEventListener('click',()=>{
          deliveryBlock.dataset.mode='other';
          if(cityInput&&normalized(cityInput.value)==='мелеуз'){cityInput.value='';cityInput.dispatchEvent(new Event('input',{bubbles:true}));}
          deliveryBlock.classList.remove('is-selected');
          selectedSummary.hidden=true;
          syncDeliveryChoice();
          setTimeout(()=>cityInput?.focus(),60);
        });
        selectedSummary.querySelector('button')?.addEventListener('click',()=>{
          deliveryBlock.classList.remove('is-selected');
          selectedSummary.hidden=true;
          deliveryBlock.dataset.mode=normalized(cityInput?.value)==='мелеуз'?'meleuz':'other';
          syncDeliveryChoice();
          if(deliveryBlock.dataset.mode==='other') setTimeout(()=>cityInput?.focus(),60);
        });
        cityInput?.addEventListener('input',()=>{if(cityInput.value.trim()&&normalized(cityInput.value)!=='мелеуз')deliveryBlock.dataset.mode='other';syncDeliveryChoice();});
        cityInput?.addEventListener('change',syncDeliveryChoice);
        if(deliveryResult) new MutationObserver(syncDeliveryChoice).observe(deliveryResult,{childList:true,subtree:true,characterData:true});
        syncDeliveryChoice();
      }
'''

if old not in s:
    raise SystemExit('delivery chooser anchor not found')
s = s.replace(old, new, 1)

anchor = "      const consentRow=document.querySelector('#leadRequest .consent-row span');"
addition = '''      const sizeMemoryNote=document.getElementById('sizeMemoryNote');
      const sizeNotice=document.getElementById('sizeNotice');
      const syncSizeMemoryNote=()=>{if(sizeMemoryNote)sizeMemoryNote.hidden=!sizeNotice||sizeNotice.hidden;};
      if(sizeNotice)new MutationObserver(syncSizeMemoryNote).observe(sizeNotice,{attributes:true,attributeFilter:['hidden']});
      syncSizeMemoryNote();

'''
if addition not in s:
    s = s.replace(anchor, addition + anchor, 1)

s = s.replace('.simplified-posts-block .compact-post-switch small{display:none!important}', '.simplified-posts-block .compact-post-switch small{display:block!important;margin-top:3px!important;font-size:11px!important;line-height:1.35!important;color:rgba(255,255,255,.56)!important}', 1)

marker = 'data-final-clarity-polish="2026-09-09"'
if marker not in s:
    extra = '''
<style data-final-clarity-polish="2026-09-09">
@media(max-width:620px){
  .simplified-posts-block .compact-post-switch{min-height:58px!important}
  .delivery-selected-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 13px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:#0d0e10}
  .delivery-selected-summary[hidden]{display:none!important}
  .delivery-selected-summary div{display:grid;gap:3px;min-width:0}
  .delivery-selected-summary span{font-size:11px;color:rgba(255,255,255,.5)}
  .delivery-selected-summary strong{font-size:14px;color:#fff;white-space:normal}
  .delivery-selected-summary button{min-height:44px;border:1px solid rgba(230,189,105,.48);border-radius:9px;background:transparent;color:var(--gold-light);padding:0 12px;font-size:12px;font-weight:800}
  .delivery-choice-wrap.is-selected .delivery-choice-buttons,
  .delivery-choice-wrap.is-selected .city-label,
  .delivery-choice-wrap.is-selected .delivery-result,
  .delivery-choice-wrap.is-selected .route-button,
  .delivery-choice-wrap.is-selected .delivery-help{display:none!important}
  .size-memory-note{margin:8px 0 0;padding:8px 10px;border-radius:9px;background:rgba(230,189,105,.10);color:var(--gold-light);font-size:12px;line-height:1.4;font-weight:700}
  .size-memory-note[hidden]{display:none!important}
}
</style>
'''
    s = s.replace('\n</body>', extra + '\n</body>', 1)

p.write_text(s, encoding='utf-8')

p = Path('app.js')
app = p.read_text(encoding='utf-8')
app = app.replace("meta:['Любой цвет профнастила','Порошковая окраска']", "meta:['Любой цвет профнастила']", 1)
p.write_text(app, encoding='utf-8')
