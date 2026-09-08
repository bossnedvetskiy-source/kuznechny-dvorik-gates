from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace("const chosen=Boolean(city)&&(result.includes('бесплат')||result.includes('учтена')||result.includes('подтвержд')||result.includes('населённый пункт выбран'));", "const chosen=deliveryBlock.dataset.editing!=='1'&&Boolean(city)&&(result.includes('бесплат')||result.includes('учтена')||result.includes('подтвержд')||result.includes('населённый пункт выбран'));", 1)

s=s.replace("        meleuzButton?.addEventListener('click',()=>{\n          deliveryBlock.dataset.mode='meleuz';", "        meleuzButton?.addEventListener('click',()=>{\n          deliveryBlock.dataset.mode='meleuz';\n          deliveryBlock.dataset.editing='';\n          deliveryBlock.dataset.editOriginal='';", 1)

s=s.replace("        otherButton?.addEventListener('click',()=>{\n          deliveryBlock.dataset.mode='other';", "        otherButton?.addEventListener('click',()=>{\n          deliveryBlock.dataset.mode='other';\n          deliveryBlock.dataset.editing='1';\n          deliveryBlock.dataset.editOriginal=(cityInput?.value||'').trim();", 1)

s=s.replace("        selectedSummary.querySelector('button')?.addEventListener('click',()=>{\n          deliveryBlock.classList.remove('is-selected');\n          selectedSummary.hidden=true;\n          deliveryBlock.dataset.mode=normalized(cityInput?.value)==='мелеуз'?'meleuz':'other';", "        selectedSummary.querySelector('button')?.addEventListener('click',()=>{\n          deliveryBlock.classList.remove('is-selected');\n          selectedSummary.hidden=true;\n          deliveryBlock.dataset.editing='1';\n          deliveryBlock.dataset.editOriginal=(cityInput?.value||'').trim();\n          deliveryBlock.dataset.mode=normalized(cityInput?.value)==='мелеуз'?'meleuz':'other';", 1)

old="        cityInput?.addEventListener('input',()=>{if(cityInput.value.trim()&&normalized(cityInput.value)!=='мелеуз')deliveryBlock.dataset.mode='other';syncDeliveryChoice();});"
new="        cityInput?.addEventListener('input',()=>{const current=cityInput.value.trim();if(deliveryBlock.dataset.editing==='1'&&current!==deliveryBlock.dataset.editOriginal)deliveryBlock.dataset.editing='';if(current&&normalized(current)!=='мелеуз')deliveryBlock.dataset.mode='other';syncDeliveryChoice();});"
if old not in s:
    raise SystemExit('city input listener anchor not found')
s=s.replace(old,new,1)

marker='data-delivery-summary-global="2026-09-09"'
if marker not in s:
    extra='''
<style data-delivery-summary-global="2026-09-09">
.delivery-selected-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 13px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:#0d0e10;color:#fff}
.delivery-selected-summary[hidden]{display:none!important}
.delivery-selected-summary div{display:grid;gap:3px;min-width:0}
.delivery-selected-summary span{font-size:11px;color:rgba(255,255,255,.5)}
.delivery-selected-summary strong{font-size:14px;color:#fff;white-space:normal}
.delivery-selected-summary button{min-height:44px;border:1px solid rgba(230,189,105,.48);border-radius:9px;background:transparent;color:var(--gold-light);padding:0 12px;font-size:12px;font-weight:800;cursor:pointer}
.delivery-choice-wrap.is-selected .delivery-choice-buttons,
.delivery-choice-wrap.is-selected .city-label,
.delivery-choice-wrap.is-selected .delivery-result,
.delivery-choice-wrap.is-selected .route-button,
.delivery-choice-wrap.is-selected .delivery-help{display:none!important}
.size-memory-note{margin:8px 0 0;padding:8px 10px;border-radius:9px;background:rgba(230,189,105,.10);color:var(--gold-light);font-size:12px;line-height:1.4;font-weight:700}
.size-memory-note[hidden]{display:none!important}
</style>
'''
    s=s.replace('\n</body>',extra+'\n</body>',1)

p.write_text(s,encoding='utf-8')
