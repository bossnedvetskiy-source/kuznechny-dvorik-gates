const priceData = window.PRICE_DATA;
if (!priceData) throw new Error('Не найден файл prices.js');
const catalogImageData = window.CATALOG_IMAGES;
if (!catalogImageData) throw new Error('Не найден файл catalog-images.js');
if (!window.KUZDVOR_DELIVERY || !window.KUZDVOR_LEADS || !window.KUZDVOR_CUSTOMER) throw new Error('Не загружены общие модули сайта');

const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
const reachGoal = (name, params = {}) => { try { if (typeof window.ym === 'function') window.ym(107269914, 'reachGoal', name, params); } catch {} };
const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const sketchArticles = new Set(['Арт.4','Арт.11','Арт.34','Арт.37']);
const orderedCatalogPrices = [...priceData.catalog]
  .filter(item => item.visible !== false)
  .sort((a,b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));

const catalogProducts = orderedCatalogPrices.map(({art,price}, index) => {
  const article = art.replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s');
  const gallery = Array.isArray(catalogImageData[art]) ? catalogImageData[art] : [];
  return {
    id:`catalog-${article}`,
    type:'catalog',
    art,
    title:'Ворота с калиткой',
    description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м. Доставку рассчитаем после выбора места установки.',
    price:Number(price)||0,
    install:Number(priceData.catalogInstallation)||0,
    posts:Number(priceData.catalogPosts)||0,
    standard:[3.4,1.8],
    wicketWidth:1,
    wicketHeight:1.8,
    meta:['Любой цвет профнастила'],
    badge:art==='Арт.6'?'Хит продаж':'',
    rank:index+1,
    gallery:gallery.length?gallery:['/hero-gates.jpg'],
    image:gallery[0]||'/hero-gates.jpg',
    media:sketchArticles.has(art)?'sketch':'photo'
  };
});
if (!catalogProducts.length) throw new Error('Каталог ворот пуст');

const grid = document.getElementById('catalogGrid');
const calculatorPanel = document.getElementById('calculator');
const showMoreButton = document.getElementById('showMoreButton');
const catalogMore = document.getElementById('catalogMore');
const catalogProgress = document.getElementById('catalogProgress');
const catalogCount = document.getElementById('catalogCount');
const emptyState = document.getElementById('emptyState');
const mobileCatalogMedia = window.matchMedia('(max-width: 620px)');
const postsCheck = document.getElementById('postsCheck');
const postsPrice = document.getElementById('postsPrice');
const postsTitle = document.getElementById('postsTitle');
const postsHint = document.getElementById('postsHint');
const baseInstallNote = document.getElementById('baseInstallNote');
const widthInput = document.getElementById('widthInput');
const wicketWidthInput = document.getElementById('wicketWidthInput');
const heightInput = document.getElementById('heightInput');
const wicketHeightInput = document.getElementById('wicketHeightInput');
const sizeNotice = document.getElementById('sizeNotice');
const sizeMemoryNote = document.getElementById('sizeMemoryNote');
const selectedProductImage = document.getElementById('selectedProductImage');
const selectedProductCaption = document.getElementById('selectedProductCaption');
const cityInput = document.getElementById('cityInput');
const phoneInput = document.getElementById('phoneInput');
const nameInput = document.getElementById('nameInput');
const consentInput = document.getElementById('consentInput');
const commentInput = document.getElementById('commentInput');
const sendButton = document.getElementById('sendButton');
const mobilePriceTotal = document.getElementById('mobilePriceTotal');
const mobilePriceLines = document.getElementById('mobilePriceLines');
const mobilePriceNote = document.getElementById('mobilePriceNote');

const pageSize = () => mobileCatalogMedia.matches ? 6 : 12;
let visibleCount = pageSize();
let selectedProductId = catalogProducts[0].id;
let deliveryController = null;
const POSTS_MEMORY_KEY = 'kuzdvor:strengthened-posts';
const DIMENSIONS_MEMORY_KEY = 'kuzdvor:gate-dimensions';

const cheapest = catalogProducts.reduce((best,item) => item.price < best.price ? item : best, catalogProducts[0]);
document.getElementById('heroInstalledPrice').textContent = `от ${money(cheapest.price + cheapest.install)}`;
document.getElementById('heroTurnkeyPrice').textContent = `от ${money(cheapest.price + cheapest.install + cheapest.posts)}`;

function pluralModels(count) {
  const mod100=count%100, mod10=count%10;
  if (mod100>=11 && mod100<=14) return 'моделей';
  if (mod10===1) return 'модель';
  if (mod10>=2 && mod10<=4) return 'модели';
  return 'моделей';
}

function productById(id) { return catalogProducts.find(item => item.id === id) || null; }
function selectedProduct() { return productById(selectedProductId) || catalogProducts[0]; }

function renderProducts() {
  const openProductId = calculatorPanel.hidden ? '' : selectedProductId;
  if (calculatorPanel.parentElement === grid) calculatorPanel.remove();
  const visible = catalogProducts.slice(0, visibleCount);
  grid.innerHTML = visible.map(product => `<article class="product-card ${product.media}" data-card-product="${product.id}">
    <div class="product-visual" data-gallery-card="${product.id}" data-image-index="0">
      <img class="product-image-backdrop" src="${product.image}" alt="" aria-hidden="true" loading="lazy">
      <span class="product-art">${product.art}</span>
      <button class="product-image-open" data-zoom="${product.id}" type="button" aria-label="Открыть ${product.media==='sketch'?'эскиз':'галерею'} ${product.art}">
        <img src="${product.image}" alt="${product.media==='sketch'?'Эскиз':'Фотография'} ворот с калиткой ${product.art}" loading="lazy">
      </button>
      ${product.gallery.length>1?`<button class="card-gallery-arrow previous" data-gallery-shift="-1" type="button" aria-label="Предыдущая фотография ${product.art}">‹</button><button class="card-gallery-arrow next" data-gallery-shift="1" type="button" aria-label="Следующая фотография ${product.art}">›</button>`:''}
      <span class="product-photo-count" data-photo-count>${product.media==='sketch'?'Эскиз':product.gallery.length>1?`1 из ${product.gallery.length}`:'1 фото'}</span>
    </div>
    <div class="product-info">${product.badge?`<div class="product-labels"><span>${product.badge}</span></div>`:''}<h3>Ворота с калиткой</h3><p>${product.description}</p>
      <div class="product-meta"><span>Любой цвет профнастила</span></div>
      <div class="product-bottom"><div class="price-stack">
        <div class="price-row"><small>Если подходящие столбы уже есть</small><strong>${money(product.price+product.install)}</strong></div>
        <div class="price-row turnkey"><small>С новыми усиленными столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>
      </div><button class="select-product" data-product="${product.id}" type="button" aria-expanded="false">Рассчитать стоимость</button></div>
    </div>
  </article>`).join('');

  catalogCount.textContent = `${catalogProducts.length} ${pluralModels(catalogProducts.length)}`;
  emptyState.hidden = catalogProducts.length > 0;
  catalogMore.hidden = catalogProducts.length === 0;
  const remaining = Math.max(0,catalogProducts.length-visible.length);
  const nextCount = Math.min(pageSize(),remaining);
  catalogProgress.textContent = `Показано ${visible.length} из ${catalogProducts.length}`;
  showMoreButton.hidden = visible.length >= catalogProducts.length;
  showMoreButton.textContent = nextCount ? `Показать ещё ${nextCount} ${pluralModels(nextCount)}` : '';

  grid.querySelectorAll('.select-product').forEach(button => button.addEventListener('click', () => {
    if (window.ym) ym(107269914,'reachGoal','calculator_start',{article:button.dataset.product});
    openCalculatorForProduct(button.dataset.product,true);
  }));
  grid.querySelectorAll('[data-gallery-shift]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const visual = button.closest('[data-gallery-card]');
    const current = Number(visual?.dataset.imageIndex)||0;
    showCardImage(visual,current + Number(button.dataset.galleryShift));
  }));
  grid.querySelectorAll('[data-zoom]').forEach(button => {
    let startX=0;
    let swiped=false;
    button.addEventListener('touchstart',event=>{startX=event.touches[0]?.clientX||0;swiped=false},{passive:true});
    button.addEventListener('touchend',event=>{
      const visual=button.closest('[data-gallery-card]');
      const delta=(event.changedTouches[0]?.clientX||0)-startX;
      if(Math.abs(delta)<45)return;
      swiped=true;
      const current=Number(visual?.dataset.imageIndex)||0;
      showCardImage(visual,current+(delta<0?1:-1));
    },{passive:true});
    button.addEventListener('click',()=>{
      if(swiped){swiped=false;return;}
      const visual=button.closest('[data-gallery-card]');
      openLightbox(button.dataset.zoom,Number(visual?.dataset.imageIndex)||0);
    });
  });
  if(openProductId){
    const openCard=grid.querySelector(`[data-card-product="${CSS.escape(openProductId)}"]`);
    if(openCard){
      placeCalculatorAfterRow(openCard);
      calculatorPanel.hidden=false;
      document.body.classList.add('calculator-open');
      openCard.querySelector('.select-product')?.setAttribute('aria-expanded','true');
      calculate();
    } else {
      calculatorPanel.hidden=true;
      document.body.classList.remove('calculator-open');
    }
  }

}

function showCardImage(visual,index) {
  const product = productById(visual?.dataset.galleryCard);
  if (!product || !visual || !product.gallery.length) return;
  const count=product.gallery.length;
  const next=(Number(index)+count)%count;
  visual.dataset.imageIndex=String(next);
  const image=visual.querySelector('.product-image-open img');
  const backdrop=visual.querySelector('.product-image-backdrop');
  if(image){image.src=product.gallery[next];image.alt=`Фотография ворот с калиткой ${product.art}, ${next+1} из ${count}`;}
  if(backdrop) backdrop.src=product.gallery[next];
  const counter=visual.querySelector('[data-photo-count]');
  if(counter) counter.textContent=product.media==='sketch'?'Эскиз':count>1?`${next+1} из ${count}`:'1 фото';
}

showMoreButton.addEventListener('click',()=>{visibleCount+=pageSize();reachGoal('catalog_show_more',{visible:Math.min(visibleCount,catalogProducts.length),total:catalogProducts.length});renderProducts()});
mobileCatalogMedia.addEventListener('change',()=>{visibleCount=pageSize();renderProducts()});

async function loadPublishedGalleries() {
  try {
    const response=await fetch('/api/catalog-images',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json();
    for(const product of catalogProducts){
      const published=data.galleries?.[product.art];
      if(!published||!Array.isArray(published.photos)||!published.photos.length)continue;
      const photos=published.photos.filter(url=>typeof url==='string'&&url.startsWith('/'));
      if(!photos.length)continue;
      product.gallery=photos;
      product.image=photos[0];
      product.media=published.mediaType==='sketch'?'sketch':'photo';
    }
    renderProducts();
    updateSelectedPreview();
  } catch {}
}

function rememberedDimensions() {
  try {
    const saved=JSON.parse(sessionStorage.getItem(DIMENSIONS_MEMORY_KEY)||'null');
    if(!saved)return null;
    const values={gateWidth:Number(saved.gateWidth),gateHeight:Number(saved.gateHeight),wicketWidth:Number(saved.wicketWidth),wicketHeight:Number(saved.wicketHeight)};
    if(!Object.values(values).every(Number.isFinite))return null;
    if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return null;
    return values;
  } catch { return null; }
}

function rememberDimensions() {
  const values={gateWidth:Number(widthInput.value),gateHeight:Number(heightInput.value),wicketWidth:Number(wicketWidthInput.value),wicketHeight:Number(wicketHeightInput.value)};
  if(!Object.values(values).every(Number.isFinite))return;
  if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return;
  try{sessionStorage.setItem(DIMENSIONS_MEMORY_KEY,JSON.stringify(values))}catch{}
}

function applyDimensions(product) {
  const saved=rememberedDimensions();
  if(saved){
    widthInput.value=saved.gateWidth;heightInput.value=saved.gateHeight;wicketWidthInput.value=saved.wicketWidth;wicketHeightInput.value=saved.wicketHeight;
  } else {
    widthInput.value=product.standard[0];heightInput.value=product.standard[1];wicketWidthInput.value=product.wicketWidth;wicketHeightInput.value=product.wicketHeight;
  }
}

function updateSelectedPreview() {
  const product=selectedProduct();
  selectedProductImage.src=product.image;
  selectedProductImage.alt=`Ворота с калиткой ${product.art}`;
  selectedProductCaption.textContent=product.art;
  postsPrice.textContent=`+${money(product.posts)}`;
  postsHint.textContent='Установка, бетонирование и усиленная связка между столбами под землёй';
  postsTitle.textContent=postsCheck.checked?'✓ Новые усиленные столбы добавлены':'Добавить новые усиленные столбы';
  baseInstallNote.textContent=postsCheck.checked?'Расчёт с новыми усиленными столбами':'Установка ворот и калитки на ваши подходящие столбы уже входит в цену';
}

function chooseProduct(id) {
  const product=productById(id);
  if(!product)return;
  selectedProductId=id;
  applyDimensions(product);
  try{postsCheck.checked=sessionStorage.getItem(POSTS_MEMORY_KEY)==='1'}catch{postsCheck.checked=false}
  updateSelectedPreview();
  calculate();
}

function placeCalculatorAfterRow(card) {
  const cards=[...grid.querySelectorAll('.product-card')];
  const cardIndex=cards.indexOf(card);
  const columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
  const rowEnd=Math.min(cards.length-1,Math.floor(cardIndex/columns)*columns+columns-1);
  cards[rowEnd].after(calculatorPanel);
}

function closeCalculator() {
  if (calculatorPanel.parentElement===grid) calculatorPanel.remove();
  calculatorPanel.hidden=true;
  document.body.classList.remove('calculator-open');
  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded','false'));
}

function openCalculatorForProduct(id,scroll=false) {
  let card=grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
  if(!card){card=grid.querySelector('.product-card');if(!card)return;id=card.dataset.cardProduct;}
  chooseProduct(id);
  placeCalculatorAfterRow(card);
  calculatorPanel.hidden=false;
  document.body.classList.add('calculator-open');
  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.product===id)));
  calculate();
  if(scroll)setTimeout(()=>calculatorPanel.querySelector('.selected-product-preview')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
}

function isNonStandard(product) {
  return Math.abs((Number(widthInput.value)||0)-product.standard[0])>.01 ||
    Math.abs((Number(heightInput.value)||0)-product.standard[1])>.01 ||
    Math.abs((Number(wicketWidthInput.value)||0)-product.wicketWidth)>.01 ||
    Math.abs((Number(wicketHeightInput.value)||0)-product.wicketHeight)>.01;
}

function dimensionState() {
  const specs=[
    {input:widthInput,min:.8,max:8},
    {input:heightInput,min:1,max:3},
    {input:wicketWidthInput,min:.7,max:2.5},
    {input:wicketHeightInput,min:1,max:3}
  ];
  const invalid=specs.find(({input,min,max})=>{
    const raw=String(input?.value??'').trim();
    const value=Number(raw);
    return !raw||!Number.isFinite(value)||value<min||value>max;
  });
  return {valid:!invalid,invalidInput:invalid?.input||null,values:{gateWidth:Number(widthInput.value),gateHeight:Number(heightInput.value),wicketWidth:Number(wicketWidthInput.value),wicketHeight:Number(wicketHeightInput.value)}};
}

function calculatedProductPrice(product,dimensions) {
  if(!dimensions.valid||!window.GATE_CALC?.hasArticle(product.art))return {price:product.price,calculated:false};
  try {
    return {price:window.GATE_CALC.calculateGate({article:product.art,...dimensions.values}).total,calculated:true};
  } catch(error) {
    console.error('Gate calculation failed',product.art,error);
    return {price:product.price,calculated:false};
  }
}

function calcData() {
  const product=selectedProduct();
  const dimensions=dimensionState();
  const productPrice=calculatedProductPrice(product,dimensions);
  const base=productPrice.price+product.install;
  const lines=[['Ворота с калиткой + установка',base]];
  if(postsCheck.checked)lines.push(['Новые усиленные столбы',product.posts]);
  const delivery=deliveryController?.line() || {name:'Место установки',value:null,display:cityInput.value.trim()||'Не выбран',resolved:false};
  const deliveryKind=deliveryController?.getState()?.kind||'empty';
  const total=lines.reduce((sum,[,value])=>sum+(Number(value)||0),0)+(delivery.resolved?(Number(delivery.value)||0):0);
  return {product,lines,delivery,total,deliveryPending:!delivery.resolved,deliveryKind,dimensionsValid:dimensions.valid,dimensionsCalculated:productPrice.calculated,invalidDimensionInput:dimensions.invalidInput};
}

function renderEstimateLines(lines,delivery) {
  return [...lines,{delivery:true,name:delivery.name,value:delivery.value,display:delivery.display}].map(item=>{
    if(Array.isArray(item))return `<div class="estimate-line"><span>${escapeHTML(item[0])}</span><strong>${money(item[1])}</strong></div>`;
    return `<div class="estimate-line"><span>${escapeHTML(item.name)}</span><strong class="${item.value===null?'pending':''}">${escapeHTML(item.display)}</strong></div>`;
  }).join('');
}

function calculate() {
  const {product,lines,delivery,total,deliveryPending,deliveryKind,dimensionsValid,dimensionsCalculated}=calcData();
  const nonStandard=dimensionsValid&&isNonStandard(product);
  const approximate=!dimensionsValid||(nonStandard&&!dimensionsCalculated)||deliveryPending;
  sizeNotice.hidden=!dimensionsValid||!nonStandard||!dimensionsCalculated;
  sizeMemoryNote.hidden=!dimensionsValid||!nonStandard;
  updateSelectedPreview();

  document.getElementById('estimateProduct').textContent=`Ворота с калиткой · ${product.art}`;
  const linesHtml=renderEstimateLines(lines,delivery);
  document.getElementById('estimateLines').innerHTML=linesHtml;
  document.getElementById('estimateTotalLabel').textContent=deliveryPending?'Ориентир без доставки':'Предварительно с доставкой';
  const totalText=(approximate?'от ':'')+money(total);
  document.getElementById('estimateTotal').textContent=totalText;
  if(mobilePriceTotal)mobilePriceTotal.textContent=totalText;
  if(mobilePriceLines)mobilePriceLines.innerHTML=linesHtml;

  let note='Доставка учтена в общей сумме. Окончательная стоимость фиксируется в договоре после бесплатного замера.';
  if(!dimensionsValid)note='Проверьте размеры ворот и калитки — пока показываем ориентир по стандартному размеру.';
  else if(nonStandard&&dimensionsCalculated)note='Стоимость пересчитана по вашим размерам и формуле выбранной модели. Итоговую цену зафиксируем после бесплатного замера.';
  if(deliveryKind==='out-of-area') note=`Место установки дальше стандартной зоны выезда ${Number((window.SITE_SETTINGS||{}).serviceAreaKm)||150} км. Доставку рассчитаем индивидуально при подтверждении заявки.`;
  else if(deliveryKind==='error') note='Доставку автоматически рассчитать не удалось. Уточним её при подтверждении заявки.';
  else if(deliveryPending)note+=' Укажите и подтвердите место установки, чтобы учесть доставку.';
  document.getElementById('estimateNote').textContent=note;
  if(mobilePriceNote)mobilePriceNote.textContent=note;
  document.dispatchEvent(new CustomEvent('gate:calculated',{detail:{article:product.art,total,totalText,deliveryPending,deliveryKind,dimensionsValid,nonStandard}}));
}

[widthInput,wicketWidthInput,heightInput,wicketHeightInput].forEach(input=>{
  input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');rememberDimensions();calculate()});
  input.addEventListener('change',()=>{input.removeAttribute('aria-invalid');rememberDimensions();calculate()});
});
postsCheck.addEventListener('change',()=>{
  try{sessionStorage.setItem(POSTS_MEMORY_KEY,postsCheck.checked?'1':'0')}catch{}
  reachGoal('gate_posts_toggle',{article:selectedProduct().art,enabled:postsCheck.checked?1:0});
  updateSelectedPreview();
  calculate();
});

window.KUZDVOR_CUSTOMER.bindContact({nameInput,phoneInput});
let lastDeliveryGoalKey='';
deliveryController=window.KUZDVOR_DELIVERY.createController({
  input:cityInput,
  datalist:document.getElementById('citySuggestions'),
  result:document.getElementById('deliveryResult'),
  routeButton:document.getElementById('routeButton'),
  chooser:document.getElementById('deliveryChooser'),
  summary:document.getElementById('deliverySummary'),
  summaryValue:document.getElementById('deliverySummaryValue'),
  changeButton:document.getElementById('deliveryChange'),
  onChange:(state)=>{
    calculate();
    if(['fixed','calculated','out-of-area','error'].includes(state?.kind)){
      const city=deliveryController?.selectedCityName?.()||cityInput.value.trim();
      const key=`${state.kind}:${city}`;
      if(key!==lastDeliveryGoalKey){lastDeliveryGoalKey=key;reachGoal('delivery_result',{kind:state.kind,city});}
    }
  }
});

function selectedCityName(){return deliveryController?.selectedCityName()||cityInput.value.trim()}
function sizeMessageLines(){return [`Размер ворот: ${widthInput.value} × ${heightInput.value} м`,`Размер калитки: ${wicketWidthInput.value} × ${wicketHeightInput.value} м`]}
function buildMessage(){
  const {product,lines,total,deliveryPending,deliveryKind}=calcData();
  const city=selectedCityName();
  const nonStandard=isNonStandard(product);
  return [
    'Здравствуйте! Хочу получить бесплатный замер.',
    nameInput.value.trim()?`Имя: ${nameInput.value.trim()}`:'',
    phoneInput.value.trim()?`Телефон: ${phoneInput.value.trim()}`:'',
    city?`Населённый пункт: ${city}`:'',
    `Изделие: Ворота с калиткой, ${product.art}`,
    ...sizeMessageLines(),
    ...lines.map(([name,value])=>`${name}: ${money(value)}`),
    `${deliveryPending?'Ориентир без доставки':'Предварительно с доставкой'}: ${nonStandard||deliveryPending?'от ':''}${money(total)}`,
    deliveryKind==='out-of-area'?`Доставка: место установки дальше стандартной зоны ${Number((window.SITE_SETTINGS||{}).serviceAreaKm)||150} км — индивидуальный расчёт.`:deliveryPending?'Доставка ещё не рассчитана — нужно уточнить.':'Доставка учтена в общей сумме.',
    commentInput.value.trim()?`Комментарий: ${commentInput.value.trim()}`:''
  ].filter(Boolean).join('\n');
}

function leadPayload(){
  const {product,total,deliveryPending}=calcData();
  const tracking=new URLSearchParams(window.location.search);
  const source=[tracking.get('utm_source'),tracking.get('utm_campaign')].filter(Boolean).join(' / ');
  return {
    category:'gates',source,
    name:nameInput.value.trim(),phone:phoneInput.value.trim(),city:selectedCityName(),
    article:product.art,productTitle:product.title,
    width:Number(widthInput.value)||null,height:Number(heightInput.value)||null,
    wicketWidth:Number(wicketWidthInput.value)||null,wicketHeight:Number(wicketHeightInput.value)||null,
    install:true,posts:Boolean(postsCheck.checked),color:'',
    configuration:{article:product.art,width:Number(widthInput.value)||null,height:Number(heightInput.value)||null,wicketWidth:Number(wicketWidthInput.value)||null,wicketHeight:Number(wicketHeightInput.value)||null,posts:Boolean(postsCheck.checked)},
    total:Math.round(total),deliveryPending:Boolean(deliveryPending),deliveryKind:deliveryController?.getState?.()?.kind||'empty',website:document.getElementById('websiteInput')?.value||'',consent:true,policyVersion:'2026-09-09',comment:commentInput.value.trim(),message:buildMessage()
  };
}

function showToast(message){
  const toast=document.getElementById('toast');
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}

phoneInput.addEventListener('input',()=>phoneInput.removeAttribute('aria-invalid'));
consentInput.addEventListener('change',()=>consentInput.removeAttribute('aria-invalid'));
sendButton.addEventListener('click',async()=>{
  const dimensions=dimensionState();
  if(!dimensions.valid){
    dimensions.invalidInput?.setAttribute('aria-invalid','true');
    dimensions.invalidInput?.focus();
    showToast('Проверьте размеры ворот и калитки');
    return;
  }
  const deliveryState=deliveryController?.getState?.()||{kind:'empty'};
  if(!['fixed','calculated','out-of-area','error'].includes(deliveryState.kind)){
    const message=deliveryState.kind==='confirm'?'Подтвердите найденный населённый пункт':deliveryState.kind==='loading'?'Дождитесь расчёта доставки':'Сначала укажите место установки и рассчитайте доставку';
    reachGoal('lead_validation_error',{field:'delivery',kind:deliveryState.kind});
    document.getElementById('deliveryChooser')?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(['empty','pending'].includes(deliveryState.kind)) setTimeout(()=>cityInput.focus({preventScroll:true}),260);
    showToast(message);
    return;
  }
  const validation=window.KUZDVOR_LEADS.validate({phone:phoneInput.value,city:selectedCityName(),consent:consentInput.checked});
  if(!validation.ok){
    if(validation.field==='phone'){phoneInput.setAttribute('aria-invalid','true');phoneInput.focus();}
    else if(validation.field==='city'){cityInput.focus();}
    else {consentInput.setAttribute('aria-invalid','true');consentInput.focus();}
    reachGoal('lead_validation_error',{field:validation.field});
    showToast(validation.message);return;
  }
  const payload=leadPayload();
  const original=sendButton.textContent;
  sendButton.disabled=true;sendButton.textContent='Отправляем…';
  try{
    await window.KUZDVOR_LEADS.submit(payload);
    window.KUZDVOR_CUSTOMER.set({name:nameInput.value,phone:phoneInput.value,city:selectedCityName()});
    reachGoal('lead_saved',{article:selectedProduct().art,city:selectedCityName()});
    document.dispatchEvent(new CustomEvent('lead-sent',{detail:{payload}}));
    showToast('Заявка отправлена');
  }catch(error){showToast(error?.message||'Не удалось отправить заявку')}
  finally{sendButton.disabled=false;sendButton.textContent=original||'Отправить заявку';}
});

document.getElementById('copyButton').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(buildMessage());showToast('Расчёт скопирован')}catch{showToast('Не удалось скопировать')}
});
document.querySelectorAll('a[href^="tel:"]').forEach(link=>link.addEventListener('click',()=>reachGoal('phone_click')));

const lightbox=document.getElementById('lightbox');
const lightboxImage=document.getElementById('lightboxImage');
const lightboxPrevious=document.getElementById('lightboxPrevious');
const lightboxNext=document.getElementById('lightboxNext');
const lightboxCounter=document.getElementById('lightboxCounter');
let lightboxGallery=[];
let lightboxIndex=0;
let lightboxAlt='';

function showLightboxImage(){
  const count=lightboxGallery.length;
  lightboxIndex=(lightboxIndex+count)%count;
  lightboxImage.src=lightboxGallery[lightboxIndex];
  lightboxImage.alt=`${lightboxAlt}, фото ${lightboxIndex+1}`;
  lightboxCounter.textContent=count>1?`${lightboxIndex+1} из ${count}`:'';
  lightboxPrevious.hidden=count<2;lightboxNext.hidden=count<2;
}
function openGallery(gallery,title,caption,alt,initialIndex=0){
  lightboxGallery=gallery.length?gallery:['/hero-gates.jpg'];lightboxIndex=Math.max(0,Math.min(initialIndex,lightboxGallery.length-1));lightboxAlt=alt;
  document.getElementById('lightboxTitle').textContent=title;document.getElementById('lightboxPrice').textContent=caption;showLightboxImage();
  lightbox.hidden=false;document.body.style.overflow='hidden';
}
function openLightbox(id,initialIndex=0){const product=productById(id);if(product)openGallery(product.gallery,product.art,`с установкой, без доставки · ${money(product.price+product.install)}`,`Ворота с калиткой ${product.art}`,initialIndex)}
function closeLightbox(){lightbox.hidden=true;document.body.style.overflow=''}
document.getElementById('lightboxClose').addEventListener('click',closeLightbox);
lightboxPrevious.addEventListener('click',()=>{lightboxIndex-=1;showLightboxImage()});
lightboxNext.addEventListener('click',()=>{lightboxIndex+=1;showLightboxImage()});
lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox()});
document.addEventListener('keydown',event=>{
  if(lightbox.hidden)return;
  if(event.key==='Escape')closeLightbox();
  if(event.key==='ArrowLeft'&&lightboxGallery.length>1){lightboxIndex-=1;showLightboxImage()}
  if(event.key==='ArrowRight'&&lightboxGallery.length>1){lightboxIndex+=1;showLightboxImage()}
});
document.querySelectorAll('[data-proof-image]').forEach(button=>button.addEventListener('click',()=>openGallery([button.dataset.proofImage],'Выполненная работа','Мелеуз и ближайшие районы','Выполненная работа Кузнечного Дворика')));

window.GATE_PAGE_API={selectedProduct,productById,closeCalculator,openCalculatorForProduct,showCardImage,deliveryState:()=>deliveryController?.getState()||{kind:'empty'},dimensionState};
renderProducts();
loadPublishedGalleries();
chooseProduct(selectedProductId);
window.GATE_CALC?.ready?.then(()=>{calculate();}).catch(error=>console.error('Gate models load failed',error));
