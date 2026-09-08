const priceData = window.PRICE_DATA;
if (!priceData) throw new Error('Не найден файл prices.js');
const catalogImageData = window.CATALOG_IMAGES;
if (!catalogImageData) throw new Error('Не найден файл catalog-images.js');

const deliveryDataElement = document.getElementById('deliveryData');
const deliveryData = JSON.parse(deliveryDataElement?.textContent || '{}');
if (!Array.isArray(deliveryData.destinations)) throw new Error('Не найден файл delivery-prices.json');

const tierFor = price => price + priceData.catalogInstallation < 80000 ? 'value' : price + priceData.catalogInstallation < 100000 ? 'middle' : 'premium';
const sketchArticles = new Set(['Арт.4','Арт.11','Арт.34','Арт.37']);
const catalogProducts = priceData.catalog.map(({art,price},index)=>{
  const article = art.replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s');
  const tier = tierFor(price);
  const gallery = catalogImageData[art] || [];
  const image = gallery[0] || '/hero-gates.jpg';
  const positions = Object.fromEntries(gallery.map(url=>[url,{x:50,y:50}]));
  const zooms = Object.fromEntries(gallery.map(url=>[url,1]));
  const media = sketchArticles.has(art) ? 'sketch' : 'photo';
  return {
    id:`catalog-${article}`,type:'catalog',style:tier,art,title:'Ворота с калиткой',
    description:'Стандарт: ворота 3,4×1,8 м и калитка 1×1,8 м.',
    price,install:priceData.catalogInstallation,posts:priceData.catalogPosts,standard:[3.4,1.8],wicketWidth:1,wicketHeight:1.8,
    meta:['Любой цвет профнастила','Порошковая окраска'],
    badge:art==='Арт.6'?'Хит продаж':'',rank:index+1,image,gallery,positions,zooms,tier,media,fitMode:'contain'
  };
});

const extraProducts = priceData.extraProducts.map(product=>({...product}));
const products = [...catalogProducts,...extraProducts];

const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
const normalize = value => value.toLowerCase().replace(/арт\.?|\s/g,'').replace('c','с');
const normalizePlace = value => value.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
const escapeHTML = value => String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const photoPosition = (product,url) => {
  const position=product.positions?.[url]||{x:50,y:50};
  const x=Math.max(0,Math.min(100,Number(position.x)||0));
  const y=Math.max(0,Math.min(100,Number(position.y)||0));
  return `${x}% ${y}%`;
};
const photoZoom = (product,url) => {
  const zoom=Number(product.zooms?.[url]);
  return Number.isFinite(zoom)?Math.max(.4,Math.min(4,zoom)):1;
};
const photoDisplayZoom = zoom => zoom>=1?zoom+.08:zoom;
const photoStyle = () => 'object-fit:contain;object-position:center;transform-origin:center;transform:none';

const startingProduct = catalogProducts.reduce((best,product)=>product.price<best.price?product:best,catalogProducts[0]);
document.getElementById('heroInstalledPrice').textContent = `от ${money(startingProduct.price + startingProduct.install)}`;
document.getElementById('heroTurnkeyPrice').textContent = `от ${money(startingProduct.price + startingProduct.install + startingProduct.posts)}`;

const destinations = [...deliveryData.destinations].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
const destinationByKey = new Map(destinations.map(destination=>[normalizePlace(destination.name),destination]));

const grid = document.getElementById('catalogGrid');
const calculatorPanel = document.getElementById('calculator');
const productSelect = document.getElementById('productSelect');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('articleSearch');
const filters = [...document.querySelectorAll('.filter')];
const showMoreButton = document.getElementById('showMoreButton');
const catalogMore = document.getElementById('catalogMore');
const catalogProgress = document.getElementById('catalogProgress');
const mobileCatalogMedia = window.matchMedia('(max-width: 620px)');
const mobilePrimaryCta = document.getElementById('mobilePrimaryCta');
const mobileLeadButton = document.getElementById('mobileLeadButton');
const mobileEstimateProduct = document.getElementById('mobileEstimateProduct');
const mobileEstimateTotal = document.getElementById('mobileEstimateTotal');
const mobileEstimateLabel = document.getElementById('mobileEstimateLabel');
const catalogPageSize = () => mobileCatalogMedia.matches ? 6 : 12;
let activeFilter = 'all';
let visibleCount = catalogPageSize();

function closeInlineCalculator(){
  if (calculatorPanel.parentElement === grid) calculatorPanel.remove();
  calculatorPanel.hidden = true;
  document.body.classList.remove('calculator-open');
  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded','false'));
}

function renderProducts(){
  const openProductId = calculatorPanel.hidden ? '' : productSelect.value;
  closeInlineCalculator();
  const query = normalize(searchInput.value.trim());
  let shown = catalogProducts.filter(product => (activeFilter==='all'||product.tier===activeFilter) && (!query||normalize(product.art).includes(query)));
  if(sortSelect.value==='price-asc') shown.sort((a,b)=>a.price-b.price);
  if(sortSelect.value==='price-desc') shown.sort((a,b)=>b.price-a.price);
  if(sortSelect.value==='recommended') shown.sort((a,b)=>a.rank-b.rank);
  const visible = shown.slice(0,visibleCount);
  grid.innerHTML = visible.map(product=>`<article class="product-card ${product.style} ${product.media} fit-${product.fitMode||'contain'}" data-card-product="${product.id}">
    <div class="product-visual" data-gallery-card="${product.id}" data-image-index="0">
      <img class="product-image-backdrop" src="${product.image}" alt="" aria-hidden="true" loading="lazy">
      <span class="product-art">${product.art}</span>
      <button class="product-image-open" data-zoom="${product.id}" type="button" aria-label="Открыть ${product.media==='sketch'?'эскиз':'галерею'} ${product.art}">
        <img src="${product.image}" style="${photoStyle(product,product.image)}" alt="${product.media==='sketch'?'Эскиз':'Фотография'} ворот с калиткой ${product.art}" loading="lazy">
      </button>
      ${product.gallery.length>1?`<button class="card-gallery-arrow previous" data-gallery-shift="-1" type="button" aria-label="Предыдущая фотография ${product.art}">‹</button><button class="card-gallery-arrow next" data-gallery-shift="1" type="button" aria-label="Следующая фотография ${product.art}">›</button>`:''}
      <span class="product-photo-count" data-photo-count>${product.media==='sketch'?'Эскиз':product.gallery.length>1?`1 из ${product.gallery.length}`:'1 фото'}</span>
    </div>
    <div class="product-info">${product.badge?`<div class="product-labels"><span>${product.badge}</span></div>`:''}<h3>Ворота с калиткой</h3><p>${product.description}</p>
      <div class="product-meta">${product.meta.map(item=>`<span>${item}</span>`).join('')}</div>
      <div class="product-bottom"><div class="price-stack">
        <div class="price-row"><small>Если столбы уже есть</small><strong>${money(product.price+product.install)}</strong></div>
        <div class="price-row turnkey"><small>Под ключ с новыми столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>
      </div><button class="select-product" data-product="${product.id}" type="button" aria-expanded="false"><span class="button-label-desktop">Рассчитать стоимость</span><span class="button-label-mobile">Рассчитать стоимость</span></button></div>
    </div>
  </article>`).join('');
  document.getElementById('catalogCount').textContent = `${shown.length} ${pluralModels(shown.length)}`;
  document.getElementById('emptyState').hidden = shown.length>0;
  const remaining = Math.max(0,shown.length-visible.length);
  const nextCount = Math.min(catalogPageSize(),remaining);
  catalogProgress.textContent = `Показано ${visible.length} из ${shown.length}`;
  catalogMore.hidden = shown.length===0;
  showMoreButton.hidden = visible.length>=shown.length;
  showMoreButton.textContent = nextCount ? `Показать ещё ${nextCount} ${pluralModels(nextCount)}` : '';
  grid.querySelectorAll('.select-product').forEach(button=>button.addEventListener('click',()=>{
    if(window.ym) ym(107269914,'reachGoal','calculator_start',{article:button.dataset.product});
    openCalculatorForProduct(button.dataset.product,true);
  }));
  grid.querySelectorAll('[data-gallery-shift]').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();
    shiftCardImage(button.closest('[data-gallery-card]'),Number(button.dataset.galleryShift));
  }));
  grid.querySelectorAll('[data-zoom]').forEach(element=>{
    let touchStartX=0;
    let ignoreNextClick=false;
    element.addEventListener('touchstart',event=>{touchStartX=event.touches[0]?.clientX||0},{passive:true});
    element.addEventListener('touchend',event=>{
      const distance=(event.changedTouches[0]?.clientX||0)-touchStartX;
      if(Math.abs(distance)<45)return;
      ignoreNextClick=true;
      shiftCardImage(element.closest('[data-gallery-card]'),distance<0?1:-1);
      window.setTimeout(()=>{ignoreNextClick=false},450);
    },{passive:true});
    element.addEventListener('click',()=>{
      if(ignoreNextClick)return;
      const card=element.closest('[data-gallery-card]');
      openLightbox(element.dataset.zoom,Number(card.dataset.imageIndex)||0);
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
    }
  }
}

function shiftCardImage(card,direction){
  const product=catalogProducts.find(item=>item.id===card?.dataset.galleryCard);
  if(!product||product.gallery.length<2)return;
  const current=Number(card.dataset.imageIndex)||0;
  const next=(current+direction+product.gallery.length)%product.gallery.length;
  card.dataset.imageIndex=String(next);
  const image=card.querySelector('.product-image-open img');
  image.src=product.gallery[next];
  const backdrop=card.querySelector('.product-image-backdrop');
  if(backdrop)backdrop.src=product.gallery[next];
  image.style.objectFit='contain';
  image.style.objectPosition='center';
  image.style.transformOrigin='center';
  image.style.transform='none';
  image.alt=`Фотография ворот с калиткой ${product.art}, ${next+1} из ${product.gallery.length}`;
  card.querySelector('[data-photo-count]').textContent=`${next+1} из ${product.gallery.length}`;
}

function pluralModels(count){
  const mod100=count%100,mod10=count%10;
  if(mod100>=11&&mod100<=14)return 'моделей';
  if(mod10===1)return 'модель';
  if(mod10>=2&&mod10<=4)return 'модели';
  return 'моделей';
}

async function loadPublishedGalleries(){
  try{
    const response=await fetch('/api/catalog-images',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json();
    for(const product of catalogProducts){
      const published=data.galleries?.[product.art];
      if(!published||!Array.isArray(published.photos)||!published.photos.length)continue;
      product.gallery=published.photos.filter(url=>typeof url==='string'&&url.startsWith('/'));
      if(!product.gallery.length)continue;
      product.image=product.gallery[0];
      product.positions=published.positions&&typeof published.positions==='object'?published.positions:Object.fromEntries(product.gallery.map(url=>[url,{x:50,y:50}]));
      product.zooms=published.zooms&&typeof published.zooms==='object'?published.zooms:Object.fromEntries(product.gallery.map(url=>[url,1]));
      product.fitMode='contain';
      product.media=published.mediaType==='sketch'?'sketch':'photo';
    }
    renderProducts();
    const selected=selectedProduct();
    if(selected?.image)updateControls();
  }catch{
    // Встроенные фотографии остаются запасным вариантом при временной недоступности хранилища.
  }
}

filters.forEach(button=>button.addEventListener('click',()=>{
  filters.forEach(item=>item.classList.remove('active'));
  button.classList.add('active');activeFilter=button.dataset.filter;visibleCount=catalogPageSize();renderProducts();
}));
sortSelect.addEventListener('change',()=>{visibleCount=catalogPageSize();renderProducts()});
searchInput.addEventListener('input',()=>{visibleCount=catalogPageSize();renderProducts()});
showMoreButton.addEventListener('click',()=>{visibleCount+=catalogPageSize();renderProducts()});
mobileCatalogMedia.addEventListener('change',event=>{
  visibleCount=catalogPageSize();
  estimateBreakdown.open=!event.matches;
  renderProducts();
});

function renderProductSelect(selectedId=productSelect.value){
  productSelect.innerHTML = `<optgroup label="Ворота с калиткой — с монтажом">${catalogProducts.map(product=>`<option value="${product.id}">${product.art} — ${money(product.price+product.install)}</option>`).join('')}</optgroup>
  <optgroup label="Другие варианты">${extraProducts.map(product=>`<option value="${product.id}">${product.title} · ${product.art} — ${product.from?'от ':''}${money(product.price)}</option>`).join('')}</optgroup>`;
  if(products.some(product=>product.id===selectedId)) productSelect.value=selectedId;
}
renderProductSelect('catalog-6');

const widthInput=document.getElementById('widthInput');
const wicketWidthInput=document.getElementById('wicketWidthInput');
const wicketWidthWrap=document.getElementById('wicketWidthWrap');
const heightInput=document.getElementById('heightInput');
const wicketHeightInput=document.getElementById('wicketHeightInput');
const wicketHeightWrap=document.getElementById('wicketHeightWrap');
const installCheck=document.getElementById('installCheck');
const postsCheck=document.getElementById('postsCheck');
const installPrice=document.getElementById('installPrice');
const postsPrice=document.getElementById('postsPrice');
const installHint=document.getElementById('installHint');
const postsTitle=document.getElementById('postsTitle');
const postsHint=document.getElementById('postsHint');
const widthLabelText=document.getElementById('widthLabelText');
const colorLabel=document.getElementById('colorLabel');
const sizeNotice=document.getElementById('sizeNotice');
const dimensionHelp=document.getElementById('dimensionHelp');
const cityInput=document.getElementById('cityInput');
const citySuggestions=document.getElementById('citySuggestions');
const deliveryResult=document.getElementById('deliveryResult');
const routeButton=document.getElementById('routeButton');
const phoneInput=document.getElementById('phoneInput');
const consentInput=document.getElementById('consentInput');
const selectedProductImage=document.getElementById('selectedProductImage');
const selectedProductCaption=document.getElementById('selectedProductCaption');
const estimateBreakdown=document.getElementById('estimateBreakdown');

if(mobileCatalogMedia.matches) estimateBreakdown.open=false;
wicketHeightInput?.addEventListener('input',calculate);
wicketHeightInput?.addEventListener('change',calculate);
[widthInput,wicketWidthInput,heightInput,wicketHeightInput].filter(Boolean).forEach(element=>{
  element.addEventListener('input',rememberDimensionsSelection);
  element.addEventListener('change',rememberDimensionsSelection);
});
window.GATE_CALC?.ready?.then(()=>{ if(!calculatorPanel.hidden) calculate(); renderProducts(); }).catch(error=>console.error('Gate models load failed',error));

citySuggestions.innerHTML = destinations.map(destination=>`<option value="${escapeHTML(destination.name)}"></option>`).join('');

let deliveryState = {kind:'empty',name:'',resolvedName:'',price:null};
const DELIVERY_MEMORY_KEY='kuzdvor:selected-delivery';
const POSTS_MEMORY_KEY='kuzdvor:strengthened-posts';
const DIMENSIONS_MEMORY_KEY='kuzdvor:gate-dimensions';

function rememberDeliverySelection(){
  if(!['fixed','calculated'].includes(deliveryState.kind))return;
  const city=(deliveryState.resolvedName||deliveryState.shortName||cityInput.value||'').trim();
  if(!city)return;
  try{
    sessionStorage.setItem(DELIVERY_MEMORY_KEY,JSON.stringify({
      kind:deliveryState.kind,
      city,
      name:deliveryState.name||city,
      resolvedName:deliveryState.resolvedName||city,
      shortName:deliveryState.shortName||city,
      price:Number(deliveryState.price)||0
    }));
  }catch{}
}

function restoreDeliverySelection(){
  let saved=null;
  try{saved=JSON.parse(sessionStorage.getItem(DELIVERY_MEMORY_KEY)||'null')}catch{}
  if(!saved?.city)return false;
  const known=destinationByKey.get(normalizePlace(saved.city));
  if(known){
    cityInput.value=known.name;
    deliveryState={kind:'fixed',name:known.name,resolvedName:known.name,price:known.price};
    routeButton.hidden=true;
    setDeliveryResult(`${known.name} · населённый пункт выбран`,'success');
    rememberDeliverySelection();
    return true;
  }
  if(saved.kind==='calculated'&&Number.isFinite(Number(saved.price))){
    const city=String(saved.shortName||saved.resolvedName||saved.city).trim();
    cityInput.value=city;
    deliveryState={kind:'calculated',name:saved.name||city,resolvedName:saved.resolvedName||city,shortName:city,price:Number(saved.price)||0};
    routeButton.hidden=true;
    setDeliveryResult(`${city} · населённый пункт подтверждён`,'success');
    return true;
  }
  return false;
}

function selectedProduct(){return products.find(product=>product.id===productSelect.value)}

function rememberedDimensions(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(DIMENSIONS_MEMORY_KEY)||'null');
    if(!saved)return null;
    const values={
      gateWidth:Number(saved.gateWidth),gateHeight:Number(saved.gateHeight),
      wicketWidth:Number(saved.wicketWidth),wicketHeight:Number(saved.wicketHeight)
    };
    if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return null;
    if(!Object.values(values).every(Number.isFinite))return null;
    return values;
  }catch{return null}
}

function rememberDimensionsSelection(){
  const product=selectedProduct();
  if(product?.type!=='catalog')return;
  const values={
    gateWidth:Number(widthInput.value),gateHeight:Number(heightInput.value),
    wicketWidth:Number(wicketWidthInput.value),wicketHeight:Number(wicketHeightInput?.value)
  };
  if(values.gateWidth<.8||values.gateWidth>8||values.gateHeight<1||values.gateHeight>3||values.wicketWidth<.7||values.wicketWidth>2.5||values.wicketHeight<1||values.wicketHeight>3)return;
  if(!Object.values(values).every(Number.isFinite))return;
  try{sessionStorage.setItem(DIMENSIONS_MEMORY_KEY,JSON.stringify(values))}catch{}
}

function restoreDimensionsSelection(product){
  if(product?.type!=='catalog')return false;
  const saved=rememberedDimensions();
  if(!saved)return false;
  widthInput.value=saved.gateWidth;
  heightInput.value=saved.gateHeight;
  wicketWidthInput.value=saved.wicketWidth;
  if(wicketHeightInput)wicketHeightInput.value=saved.wicketHeight;
  return true;
}

function chooseProduct(id){
  productSelect.value=id;
  const product=selectedProduct();
  if(!restoreDimensionsSelection(product)){
    widthInput.value=product.standard[0];heightInput.value=product.standard[1];
    wicketWidthInput.value=product.wicketWidth??1;
    if(wicketHeightInput) wicketHeightInput.value=product.wicketHeight??product.standard[1];
  }
  installCheck.checked=product.install>0;
  if(product.type==='catalog'&&product.posts){
    try{postsCheck.checked=sessionStorage.getItem(POSTS_MEMORY_KEY)==='1'}catch{postsCheck.checked=false}
  }else{
    postsCheck.checked=false;
  }
  if(!cityInput.value.trim())restoreDeliverySelection();
  updateControls();calculate();
}

function placeCalculatorAfterRow(card){
  const cards=[...grid.querySelectorAll('.product-card')];
  const cardIndex=cards.indexOf(card);
  const columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
  const rowEnd=Math.min(cards.length-1,Math.floor(cardIndex/columns)*columns+columns-1);
  cards[rowEnd].after(calculatorPanel);
}

function openCalculatorForProduct(id,scroll=false){
  let card=grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
  if(!card){card=grid.querySelector('.product-card');if(!card)return;id=card.dataset.cardProduct;}
  chooseProduct(id);
  placeCalculatorAfterRow(card);
  calculatorPanel.hidden=false;
  document.body.classList.add('calculator-open');
  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.product===id)));
  calculate();
  if(scroll) calculatorPanel.scrollIntoView({behavior:'smooth',block:'start'});
}

function updateControls(){
  const product=selectedProduct();
  installPrice.textContent=product.install?`+${money(product.install)}`:'По замеру';
  postsPrice.textContent=product.posts?`+${money(product.posts)}`:'По замеру';
  installHint.textContent=product.type==='frame'?'Самостоятельная сборка':product.type==='sliding'?'Рассчитывается после замера':'Если столбы уже есть';
  if(product.type==='frame'){
    postsTitle.textContent='Добавить комплект столбов';
    postsHint.textContent='Без установки и бетонирования';
  }else{
    postsTitle.textContent='Новые усиленные столбы';
    postsHint.textContent='Со связкой, установкой и бетонированием';
  }
  const hasSeparateWicket=Number.isFinite(product.wicketWidth);
  wicketWidthWrap.hidden=!hasSeparateWicket;
  if(wicketHeightWrap) wicketHeightWrap.hidden=!hasSeparateWicket;
  widthLabelText.textContent=product.type==='wicket'?'Ширина калитки, м':product.type==='sliding'?'Ширина проёма, м':'Ширина ворот без калитки, м';
  if(dimensionHelp) dimensionHelp.hidden=product.type!=='catalog';
  colorLabel.hidden=product.type==='frame';
  installCheck.disabled=!product.install;postsCheck.disabled=!product.posts;
  installCheck.closest('.choice').classList.toggle('disabled',!product.install);
  postsCheck.closest('.choice').classList.toggle('disabled',!product.posts);
  if(!product.install)installCheck.checked=false;
  if(!product.posts)postsCheck.checked=false;
  const preview=selectedProductImage.closest('.selected-product-preview');
  preview.hidden=!product.image;
  if(product.image){
    selectedProductImage.src=product.image;
    selectedProductImage.alt=`${product.title} ${product.art}`;
    selectedProductCaption.textContent=`${product.title} · ${product.art}`;
  }
}

function deliveryLine(){
  const entered=cityInput.value.trim();
  if(deliveryState.kind==='fixed') return ['Населённый пункт',deliveryState.price,'delivery',deliveryState.name];
  if(deliveryState.kind==='calculated') return ['Населённый пункт',deliveryState.price,'delivery',deliveryState.shortName||entered];
  return ['Населённый пункт',null,'delivery',entered||'Не выбран'];
}

function isNonStandard(product){
  const gateWidthChanged=Math.abs((Number(widthInput.value)||0)-product.standard[0])>.01;
  const gateHeightChanged=Math.abs((Number(heightInput.value)||0)-product.standard[1])>.01;
  const wicketWidthChanged=Number.isFinite(product.wicketWidth)&&Math.abs((Number(wicketWidthInput.value)||0)-product.wicketWidth)>.01;
  const wicketHeightChanged=Number.isFinite(product.wicketWidth)&&Math.abs((Number(wicketHeightInput?.value)||0)-(product.wicketHeight??product.standard[1]))>.01;
  return gateWidthChanged||gateHeightChanged||wicketWidthChanged||wicketHeightChanged;
}

function sizeMessageLines(product){
  if(product.type==='wicket') return [`Размер калитки: ${widthInput.value} × ${heightInput.value} м`];
  if(Number.isFinite(product.wicketWidth)) return [`Размер ворот: ${widthInput.value} × ${heightInput.value} м`,`Размер калитки: ${wicketWidthInput.value} × ${wicketHeightInput?.value||heightInput.value} м`];
  return [`Размер: ${widthInput.value} × ${heightInput.value} м`];
}

function catalogCalculatedPrice(product){
  if(product.type!=='catalog'||!window.GATE_CALC?.hasArticle(product.art)) return product.price;
  try{
    return window.GATE_CALC.calculateGate({
      article:product.art,
      gateWidth:Number(widthInput.value),
      gateHeight:Number(heightInput.value),
      wicketWidth:Number(wicketWidthInput.value),
      wicketHeight:Number(wicketHeightInput?.value||heightInput.value)
    }).total;
  }catch(error){
    console.error('Gate calculation failed',product.art,error);
    return product.price;
  }
}

function calcData(){
  const product=selectedProduct(),lines=[['Изделие',catalogCalculatedPrice(product)]];
  if(installCheck.checked&&product.install)lines.push(['Монтаж',product.install]);
  if(postsCheck.checked&&product.posts)lines.push([product.type==='frame'?'Комплект столбов':'Столбы и установка',product.posts]);
  lines.push(deliveryLine());
  const deliveryPending=!['fixed','calculated'].includes(deliveryState.kind);
  return {p:product,lines,total:lines.reduce((sum,[,value])=>sum+(Number.isFinite(value)?value:0),0),deliveryPending};
}

function calculate(){
  const {p,lines,total,deliveryPending}=calcData();
  const nonStandard=isNonStandard(p);
  const dimensionsCalculated=p.type==='catalog'&&Boolean(window.GATE_CALC?.hasArticle(p.art));
  const approximate=(nonStandard&&!dimensionsCalculated)||p.from||deliveryPending;
  sizeNotice.hidden=!nonStandard||!dimensionsCalculated;
  document.getElementById('estimateProduct').textContent=`${p.title} · ${p.art}`;
  document.getElementById('estimateLines').innerHTML=lines.map(([name,value,kind,displayValue])=>`<div class="estimate-line"><span>${escapeHTML(name)}</span><strong class="${value===null?'pending':''}">${kind==='delivery'?escapeHTML(displayValue):value===null?'Уточняется':money(value)}</strong></div>`).join('');
  document.getElementById('estimateTotalLabel').textContent=deliveryPending?'Ориентир без доставки':'Предварительно с доставкой';
  document.getElementById('estimateTotal').textContent=(approximate?'от ':'')+money(total);
  mobileEstimateProduct.textContent=`${p.art} · текущая цена`;
  mobileEstimateTotal.textContent=(approximate?'от ':'')+money(total);
  mobileEstimateLabel.textContent=deliveryPending?'Без доставки — уточним населённый пункт':'Предварительно с доставкой';
  let note='Доставка учтена в общей сумме. Окончательная стоимость фиксируется в договоре после бесплатного замера.';
  if(nonStandard&&dimensionsCalculated) note='Стоимость изделия пересчитана по указанным размерам и формуле выбранной модели. Доставка учтена в общей сумме. Итоговую стоимость зафиксируем после замера.';
  else if(nonStandard) note='Размер отличается от стандартного. Точную стоимость подтвердим после замера. Доставка учтена в общей сумме.';
  if(deliveryPending) note+=' Рассчитайте доставку или отправьте заявку — стоимость уточним вручную.';
  document.getElementById('estimateNote').textContent=note;
}

function setDeliveryResult(message,state=''){
  deliveryResult.textContent=message;
  deliveryResult.className=`delivery-result${state?` ${state}`:''}`;
}

function updateDeliveryFromCity(){
  const entered=cityInput.value.trim();
  const known=destinationByKey.get(normalizePlace(entered));
  if(known){
    cityInput.value=known.name;
    deliveryState={kind:'fixed',name:known.name,resolvedName:known.name,price:known.price};
    routeButton.hidden=true;
    setDeliveryResult(`${known.name} · населённый пункт выбран`,'success');
    rememberDeliverySelection();
  }else if(entered.length>=2){
    deliveryState={kind:'pending',name:entered,resolvedName:'',price:null};
    routeButton.hidden=false;routeButton.disabled=false;routeButton.textContent='Рассчитать доставку';
    setDeliveryResult('Пункта нет в прайсе — рассчитайте доставку по маршруту.','pending');
  }else{
    deliveryState={kind:'empty',name:entered,resolvedName:'',price:null};
    routeButton.hidden=true;
    setDeliveryResult('Выберите пункт из списка или введите название.','pending');
  }
  calculate();
}

cityInput.addEventListener('input',updateDeliveryFromCity);
cityInput.addEventListener('change',updateDeliveryFromCity);
postsCheck.addEventListener('change',()=>{
  const product=selectedProduct();
  if(product?.type!=='catalog')return;
  try{sessionStorage.setItem(POSTS_MEMORY_KEY,postsCheck.checked?'1':'0')}catch{}
});
if(restoreDeliverySelection())calculate();

routeButton.addEventListener('click',async()=>{
  const place=cityInput.value.trim();
  if(place.length<2){updateDeliveryFromCity();cityInput.focus();return;}
  if(deliveryState.kind==='confirm'){
    deliveryState={...deliveryState,kind:'calculated'};
    routeButton.hidden=true;
    setDeliveryResult(`${deliveryState.shortName} · населённый пункт подтверждён`,'success');
    rememberDeliverySelection();
    calculate();
    return;
  }
  deliveryState={kind:'loading',name:place,resolvedName:'',price:null};
  routeButton.disabled=true;routeButton.textContent='Считаем…';
  setDeliveryResult('Ищем населённый пункт и автомобильный маршрут…','pending');
  calculate();
  try{
    const response=await fetch(`/api/delivery?place=${encodeURIComponent(place)}`,{headers:{accept:'application/json'}});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||'Не удалось рассчитать доставку');
    if(cityInput.value.trim()!==place)return;
    const shortName=result.shortName||result.resolvedName;
    deliveryState={kind:'confirm',name:place,resolvedName:result.resolvedName,shortName,price:result.price};
    routeButton.hidden=false;routeButton.disabled=false;routeButton.textContent='Да, это нужный пункт';
    setDeliveryResult(`Найдено: ${shortName}. Подтвердите пункт или уточните название и район в поле выше.`,'pending');
  }catch(error){
    deliveryState={kind:'error',name:place,resolvedName:'',price:null};
    routeButton.hidden=false;routeButton.disabled=false;routeButton.textContent='Повторить расчёт';
    setDeliveryResult(`${error.message||'Не удалось рассчитать доставку.'} Можно отправить заявку — стоимость уточним вручную.`,'error');
    if(window.ym)ym(107269914,'reachGoal','delivery_error',{place});
  }
  calculate();
});

function lineText(name,value,kind){return kind==='delivery'?'':`${name}: ${value===null?'уточняется':money(value)}`}
function selectedCityName(){return ['fixed','calculated'].includes(deliveryState.kind)?deliveryState.resolvedName||cityInput.value.trim():cityInput.value.trim()}
function buildMessage(){
  const {p,lines,total,deliveryPending}=calcData();
  const name=document.getElementById('nameInput').value.trim();
  const phone=phoneInput.value.trim();
  const comment=document.getElementById('commentInput').value.trim();
  const city=selectedCityName();
  const color=p.type==='frame'?'':`Цвет: ${document.getElementById('colorSelect').value}`;
  const nonStandard=isNonStandard(p);
  const totalLabel=deliveryPending?'Ориентир без доставки':'Предварительно с доставкой';
  return ['Здравствуйте! Хочу получить бесплатный замер.',name?`Имя: ${name}`:'',phone?`Телефон: ${phone}`:'',city?`Населённый пункт: ${city}`:'',`Изделие: ${p.title}, ${p.art}`,...sizeMessageLines(p),color,...lines.map(([lineName,value,kind])=>lineText(lineName,value,kind)),`${totalLabel}: ${nonStandard||p.from||deliveryPending?'от ':''}${money(total)}`,nonStandard?'Нужен перерасчёт нестандартного размера.':'',deliveryPending?'Доставка ещё не рассчитана — нужно уточнить.':'',comment?`Комментарий: ${comment}`:''].filter(Boolean).join('\n');
}

function leadPayload(){
  const {p,total,deliveryPending}=calcData();
  return {
    name:document.getElementById('nameInput').value.trim(),
    phone:phoneInput.value.trim(),
    city:selectedCityName(),
    article:p.art,
    productTitle:p.title,
    width:Number(widthInput.value)||null,
    wicketWidth:Number.isFinite(p.wicketWidth)?(Number(wicketWidthInput.value)||null):null,
    wicketHeight:Number.isFinite(p.wicketWidth)?(Number(wicketHeightInput?.value)||null):null,
    height:Number(heightInput.value)||null,
    install:Boolean(installCheck.checked&&p.install),
    posts:Boolean(postsCheck.checked&&p.posts),
    color:p.type==='frame'?'':document.getElementById('colorSelect').value,
    total:Math.round(total),
    deliveryPending:Boolean(deliveryPending),
    comment:document.getElementById('commentInput').value.trim(),
    message:buildMessage()
  };
}

function showToast(message){
  const toast=document.getElementById('toast');
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}

[productSelect,widthInput,wicketWidthInput,heightInput,installCheck,postsCheck,document.getElementById('colorSelect')].forEach(element=>element.addEventListener('input',()=>{
  if(element===productSelect)updateControls();
  calculate();
}));

document.querySelectorAll('a[href="#calculator"]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  if(link===mobilePrimaryCta&&!calculatorPanel.hidden){
    document.getElementById('leadRequest').scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  const selectedCard=grid.querySelector(`[data-card-product="${CSS.escape(productSelect.value)}"]`)||grid.querySelector('.product-card');
  if(selectedCard)openCalculatorForProduct(selectedCard.dataset.cardProduct,true);
}));

mobileLeadButton.addEventListener('click',()=>{
  document.getElementById('leadRequest').scrollIntoView({behavior:'smooth',block:'start'});
});

document.getElementById('copyButton').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(buildMessage());if(window.ym)ym(107269914,'reachGoal','estimate_copy',{article:selectedProduct().art});showToast('Смета скопирована')}catch{showToast('Не удалось скопировать')}
});
phoneInput.addEventListener('input',()=>phoneInput.removeAttribute('aria-invalid'));
consentInput?.addEventListener('change',()=>consentInput.removeAttribute('aria-invalid'));
document.getElementById('sendButton').addEventListener('click',async()=>{
  const button=document.getElementById('sendButton');
  const phoneDigits=phoneInput.value.replace(/\D/g,'');
  if(phoneDigits.length<10||phoneDigits.length>11){
    phoneInput.setAttribute('aria-invalid','true');phoneInput.focus();showToast('Укажите номер телефона');return;
  }
  if(!cityInput.value.trim()){
    cityInput.focus();showToast('Укажите населённый пункт');return;
  }
  if(consentInput&&!consentInput.checked){
    consentInput.setAttribute('aria-invalid','true');consentInput.focus();showToast('Подтвердите согласие на обработку данных');return;
  }
  const payload=leadPayload();
  button.disabled=true;
  try{
    const response=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Не удалось отправить заявку')}
    if(window.ym)ym(107269914,'reachGoal','lead_saved',{article:selectedProduct().art,city:selectedCityName()});
    document.dispatchEvent(new CustomEvent('lead-sent',{detail:{payload}}));
    showToast('Заявка отправлена');
  }catch(error){showToast(error?.message||'Не удалось отправить заявку')}
  finally{button.disabled=false;}
});

document.querySelectorAll('a[href^="tel:"]').forEach(link=>link.addEventListener('click',()=>{
  if(window.ym)ym(107269914,'reachGoal','phone_click');
}));

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
  lightboxPrevious.hidden=count<2;
  lightboxNext.hidden=count<2;
}

function openGallery(gallery,title,caption,alt,initialIndex=0){
  lightboxGallery=gallery.length?gallery:['/hero-gates.jpg'];
  lightboxIndex=Math.max(0,Math.min(initialIndex,lightboxGallery.length-1));
  lightboxAlt=alt;
  document.getElementById('lightboxTitle').textContent=title;
  document.getElementById('lightboxPrice').textContent=caption;
  showLightboxImage();
  lightbox.hidden=false;document.body.style.overflow='hidden';
}

function openLightbox(id,initialIndex=0){
  const product=catalogProducts.find(item=>item.id===id);
  if(!product)return;
  openGallery(product.gallery,product.art,`с установкой · ${money(product.price+product.install)}`,`Ворота с калиткой ${product.art}`,initialIndex);
}
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

document.querySelectorAll('[data-proof-image]').forEach(button=>button.addEventListener('click',()=>{
  openGallery([button.dataset.proofImage],'Выполненная работа','Мелеуз и ближайшие районы','Выполненная работа Кузнечного Дворика');
}));

renderProducts();
loadPublishedGalleries();
chooseProduct('catalog-6');
updateDeliveryFromCity();
