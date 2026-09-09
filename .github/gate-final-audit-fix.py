from pathlib import Path

p=Path('app.js')
s=p.read_text(encoding='utf-8')

old="function catalogCalculatedPrice(product) {\n  if(!window.GATE_CALC?.hasArticle(product.art))return product.price;\n  try {\n    return window.GATE_CALC.calculateGate({\n      article:product.art,\n      gateWidth:Number(widthInput.value),\n      gateHeight:Number(heightInput.value),\n      wicketWidth:Number(wicketWidthInput.value),\n      wicketHeight:Number(wicketHeightInput.value)\n    }).total;\n  } catch(error) {\n    console.error('Gate calculation failed',product.art,error);\n    return product.price;\n  }\n}\n\nfunction calcData() {\n  const product=selectedProduct();\n  const base=catalogCalculatedPrice(product)+product.install;\n  const lines=[['Ворота с калиткой и установка',base]];\n  if(postsCheck.checked)lines.push(['Новые усиленные столбы',product.posts]);\n  const delivery=deliveryController?.line() || {name:'Населённый пункт',value:null,display:cityInput.value.trim()||'Не выбран',resolved:false};\n  const total=lines.reduce((sum,[,value])=>sum+(Number(value)||0),0)+(delivery.resolved?(Number(delivery.value)||0):0);\n  return {product,lines,delivery,total,deliveryPending:!delivery.resolved};\n}"
new="function dimensionState() {\n  const specs=[\n    {input:widthInput,min:.8,max:8},\n    {input:heightInput,min:1,max:3},\n    {input:wicketWidthInput,min:.7,max:2.5},\n    {input:wicketHeightInput,min:1,max:3}\n  ];\n  const invalid=specs.find(({input,min,max})=>{\n    const raw=String(input?.value??'').trim();\n    const value=Number(raw);\n    return !raw||!Number.isFinite(value)||value<min||value>max;\n  });\n  return {valid:!invalid,invalidInput:invalid?.input||null,values:{gateWidth:Number(widthInput.value),gateHeight:Number(heightInput.value),wicketWidth:Number(wicketWidthInput.value),wicketHeight:Number(wicketHeightInput.value)}};\n}\n\nfunction calculatedProductPrice(product,dimensions) {\n  if(!dimensions.valid||!window.GATE_CALC?.hasArticle(product.art))return {price:product.price,calculated:false};\n  try {\n    return {price:window.GATE_CALC.calculateGate({article:product.art,...dimensions.values}).total,calculated:true};\n  } catch(error) {\n    console.error('Gate calculation failed',product.art,error);\n    return {price:product.price,calculated:false};\n  }\n}\n\nfunction calcData() {\n  const product=selectedProduct();\n  const dimensions=dimensionState();\n  const productPrice=calculatedProductPrice(product,dimensions);\n  const base=productPrice.price+product.install;\n  const lines=[['Ворота с калиткой и установка',base]];\n  if(postsCheck.checked)lines.push(['Новые усиленные столбы',product.posts]);\n  const delivery=deliveryController?.line() || {name:'Населённый пункт',value:null,display:cityInput.value.trim()||'Не выбран',resolved:false};\n  const deliveryKind=deliveryController?.getState()?.kind||'empty';\n  const total=lines.reduce((sum,[,value])=>sum+(Number(value)||0),0)+(delivery.resolved?(Number(delivery.value)||0):0);\n  return {product,lines,delivery,total,deliveryPending:!delivery.resolved,deliveryKind,dimensionsValid:dimensions.valid,dimensionsCalculated:productPrice.calculated,invalidDimensionInput:dimensions.invalidInput};\n}"
if old not in s: raise SystemExit('calculation block anchor not found')
s=s.replace(old,new,1)

old="function calculate() {\n  const {product,lines,delivery,total,deliveryPending}=calcData();\n  const nonStandard=isNonStandard(product);\n  const dimensionsCalculated=Boolean(window.GATE_CALC?.hasArticle(product.art));\n  const approximate=(nonStandard&&!dimensionsCalculated)||deliveryPending;\n  sizeNotice.hidden=!nonStandard||!dimensionsCalculated;\n  sizeMemoryNote.hidden=!nonStandard;"
new="function calculate() {\n  const {product,lines,delivery,total,deliveryPending,deliveryKind,dimensionsValid,dimensionsCalculated}=calcData();\n  const nonStandard=dimensionsValid&&isNonStandard(product);\n  const approximate=!dimensionsValid||(nonStandard&&!dimensionsCalculated)||deliveryPending;\n  sizeNotice.hidden=!dimensionsValid||!nonStandard||!dimensionsCalculated;\n  sizeMemoryNote.hidden=!dimensionsValid||!nonStandard;"
if old not in s: raise SystemExit('calculate start anchor not found')
s=s.replace(old,new,1)

old="  let note='Доставка учтена в общей сумме. Окончательная стоимость фиксируется в договоре после бесплатного замера.';\n  if(nonStandard&&dimensionsCalculated)note='Стоимость пересчитана по вашим размерам и формуле выбранной модели. Итоговую цену зафиксируем после бесплатного замера.';\n  if(deliveryPending)note+=' Укажите населённый пункт, чтобы учесть доставку.';\n  document.getElementById('estimateNote').textContent=note;\n  if(mobilePriceNote)mobilePriceNote.textContent=note;\n  document.dispatchEvent(new CustomEvent('gate:calculated',{detail:{article:product.art,total,totalText,deliveryPending,nonStandard}}));"
new="  let note='Доставка учтена в общей сумме. Окончательная стоимость фиксируется в договоре после бесплатного замера.';\n  if(!dimensionsValid)note='Проверьте размеры ворот и калитки — пока показываем ориентир по стандартному размеру.';\n  else if(nonStandard&&dimensionsCalculated)note='Стоимость пересчитана по вашим размерам и формуле выбранной модели. Итоговую цену зафиксируем после бесплатного замера.';\n  if(deliveryPending)note+=' Укажите и подтвердите населённый пункт, чтобы учесть доставку.';\n  document.getElementById('estimateNote').textContent=note;\n  if(mobilePriceNote)mobilePriceNote.textContent=note;\n  document.dispatchEvent(new CustomEvent('gate:calculated',{detail:{article:product.art,total,totalText,deliveryPending,deliveryKind,dimensionsValid,nonStandard}}));"
if old not in s: raise SystemExit('calculate note anchor not found')
s=s.replace(old,new,1)

old="[widthInput,wicketWidthInput,heightInput,wicketHeightInput].forEach(input=>{\n  input.addEventListener('input',()=>{rememberDimensions();calculate()});\n  input.addEventListener('change',()=>{rememberDimensions();calculate()});\n});"
new="[widthInput,wicketWidthInput,heightInput,wicketHeightInput].forEach(input=>{\n  input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');rememberDimensions();calculate()});\n  input.addEventListener('change',()=>{input.removeAttribute('aria-invalid');rememberDimensions();calculate()});\n});"
if old not in s: raise SystemExit('dimension listeners anchor not found')
s=s.replace(old,new,1)

old="sendButton.addEventListener('click',async()=>{\n  const validation=window.KUZDVOR_LEADS.validate({phone:phoneInput.value,city:selectedCityName(),consent:consentInput.checked});"
new="sendButton.addEventListener('click',async()=>{\n  const dimensions=dimensionState();\n  if(!dimensions.valid){\n    dimensions.invalidInput?.setAttribute('aria-invalid','true');\n    dimensions.invalidInput?.focus();\n    showToast('Проверьте размеры ворот и калитки');\n    return;\n  }\n  const validation=window.KUZDVOR_LEADS.validate({phone:phoneInput.value,city:selectedCityName(),consent:consentInput.checked});"
if old not in s: raise SystemExit('send validation anchor not found')
s=s.replace(old,new,1)

old="window.GATE_PAGE_API={selectedProduct,productById,closeCalculator,openCalculatorForProduct,showCardImage};"
new="window.GATE_PAGE_API={selectedProduct,productById,closeCalculator,openCalculatorForProduct,showCardImage,deliveryState:()=>deliveryController?.getState()||{kind:'empty'},dimensionState};"
if old not in s: raise SystemExit('API export anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=Path('gate-page-ui.js')
s=p.read_text(encoding='utf-8')
old="  let leadOpen = false;"
new="  let leadOpen = false;\n  let deliveryCanProceed = false;\n  let deliveryKind = 'empty';\n  let dimensionsValid = true;"
if old not in s: raise SystemExit('ui state anchor not found')
s=s.replace(old,new,1)

old="    if (!calculator || calculator.hidden) cta.textContent = 'Выбрать ворота';\n    else if (leadOpen) cta.textContent = `Отправить заявку${price ? ` · ${price}` : ''}`;\n    else cta.textContent = `Заказать бесплатный замер${price ? ` · ${price}` : ''}`;"
new="    if (!calculator || calculator.hidden) cta.textContent = 'Выбрать ворота';\n    else if (leadOpen) cta.textContent = `Отправить заявку${price ? ` · ${price}` : ''}`;\n    else if (!dimensionsValid) cta.textContent = `Проверьте размеры${price ? ` · ${price}` : ''}`;\n    else if (!deliveryCanProceed) cta.textContent = `Указать город${price ? ` · ${price}` : ''}`;\n    else cta.textContent = `Заказать бесплатный замер${price ? ` · ${price}` : ''}`;"
if old not in s: raise SystemExit('cta text anchor not found')
s=s.replace(old,new,1)

old="    if (!calculator || calculator.hidden) {\n      catalog?.scrollIntoView({behavior:'smooth', block:'start'});\n      return;\n    }\n    if (!leadOpen) openLead();"
new="    if (!calculator || calculator.hidden) {\n      catalog?.scrollIntoView({behavior:'smooth', block:'start'});\n      return;\n    }\n    if (!dimensionsValid) {\n      dimensions?.classList.add('is-open');\n      if(sizeToggle){sizeToggle.textContent='Скрыть';sizeToggle.setAttribute('aria-expanded','true');}\n      dimensions?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});\n      setTimeout(()=>widthInput?.focus({preventScroll:true}),260);\n      return;\n    }\n    if (!deliveryCanProceed) {\n      document.getElementById('deliveryChooser')?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});\n      return;\n    }\n    if (!leadOpen) openLead();"
if old not in s: raise SystemExit('cta click anchor not found')
s=s.replace(old,new,1)

old="  document.addEventListener('gate:calculated', () => { updateSizeSummary(); syncMobileCta(); });"
new="  document.addEventListener('gate:calculated', event => {\n    deliveryKind = event.detail?.deliveryKind || 'empty';\n    deliveryCanProceed = event.detail?.deliveryPending === false || deliveryKind === 'error';\n    dimensionsValid = event.detail?.dimensionsValid !== false;\n    updateSizeSummary();\n    syncMobileCta();\n  });"
if old not in s: raise SystemExit('calculated listener anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=Path('scripts/test-gate-page.mjs')
s=p.read_text(encoding='utf-8')
if "deliveryKind" not in s:
    s=s.replace("assert(app.includes('priceData.catalogPosts'), 'Gate page must still use the configured posts price');", "assert(app.includes('priceData.catalogPosts'), 'Gate page must still use the configured posts price');\nassert(app.includes('dimensionState()'), 'Gate page must validate all four dimensions');\nassert(app.includes('deliveryKind'), 'Gate page must expose delivery state to mobile CTA');\nassert(ui.includes('deliveryCanProceed'), 'Mobile CTA must require delivery before opening the lead form');")
    p.write_text(s,encoding='utf-8')

print('Final audit fixes applied')
