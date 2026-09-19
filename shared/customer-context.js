(() => {
  const CITY_KEY = 'kuzdvor:customer-city';
  const SESSION_KEY = 'kuzdvor:customer-session';

  const safeJson = value => {
    try { return JSON.parse(value || 'null'); } catch { return null; }
  };

  function read() {
    let city = '';
    let session = {};
    try { city = String(localStorage.getItem(CITY_KEY) || '').trim(); } catch {}
    try { session = safeJson(sessionStorage.getItem(SESSION_KEY)) || {}; } catch {}
    return {
      city,
      name: String(session.name || '').trim(),
      phone: String(session.phone || '').trim()
    };
  }

  function set(patch = {}) {
    const current = read();
    const next = {...current, ...patch};
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
      try {
        const city = String(next.city || '').trim();
        if (city) localStorage.setItem(CITY_KEY, city);
        else localStorage.removeItem(CITY_KEY);
      } catch {}
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        name: String(next.name || '').trim(),
        phone: String(next.phone || '').trim()
      }));
    } catch {}
    return next;
  }

  function bindContact({nameInput, phoneInput} = {}) {
    const saved = read();
    if (nameInput && !nameInput.value && saved.name) nameInput.value = saved.name;
    if (phoneInput && !phoneInput.value && saved.phone) phoneInput.value = saved.phone;
    nameInput?.addEventListener('input', () => set({name:nameInput.value}));
    phoneInput?.addEventListener('input', () => set({phone:phoneInput.value}));
  }

  window.KUZDVOR_CUSTOMER = {read, set, bindContact};
})();

(() => {
  if (window.KUZDVOR_GLOBAL_CATALOG_FLOW) return;
  window.KUZDVOR_GLOBAL_CATALOG_FLOW = true;

  const money = value => `${new Intl.NumberFormat('ru-RU').format(Math.round((Number(value) || 0) / 100) * 100)} ₽`;
  const num = node => Number(String(node?.value ?? '').replace(',', '.'));
  const closeTo = (a, b) => Math.abs(Number(a) - Number(b)) < 0.001;

  const ready = () => {
    const catalog = document.getElementById('catalog');
    const grid = document.getElementById('catalogGrid');
    const calculator = document.getElementById('calculator');
    const sizeBlock = document.getElementById('gateDimensions')?.closest('.form-block');
    const postsBlock = document.getElementById('postsCheck')?.closest('.form-block');
    const deliveryBlock = document.getElementById('deliveryChooser')?.closest('.form-block');
    const api = window.GATE_PAGE_API;
    return catalog && grid && calculator && sizeBlock && postsBlock && deliveryBlock && api?.productById && api?.deliveryState
      ? {catalog, grid, calculator, sizeBlock, postsBlock, deliveryBlock, api}
      : null;
  };

  function install() {
    if (document.getElementById('catalogOrderConfigurator')) return true;
    const refs = ready();
    if (!refs) return false;
    const {catalog, grid, calculator, sizeBlock, postsBlock, deliveryBlock, api} = refs;

    const widthInput = document.getElementById('widthInput');
    const wicketWidthInput = document.getElementById('wicketWidthInput');
    const heightInput = document.getElementById('heightInput');
    const wicketHeightInput = document.getElementById('wicketHeightInput');
    const postsCheck = document.getElementById('postsCheck');
    const cityInput = document.getElementById('cityInput');
    const showMore = document.getElementById('showMoreButton');
    const mobileCta = document.getElementById('mobilePrimaryCta');

    const style = document.createElement('style');
    style.id = 'catalogGlobalFlowStyles';
    style.textContent = `
      .catalog-order-config{margin:0 0 18px;padding:18px;border:1px solid rgba(210,161,67,.34);border-radius:18px;background:linear-gradient(155deg,#17181b,#0e0f11);color:#fff;box-shadow:0 14px 34px rgba(17,18,20,.10)}
      .catalog-order-config__head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}.catalog-order-config__eyebrow{display:block;margin:0 0 5px;color:#e6bd69;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.catalog-order-config h3{margin:0;font:25px/1.15 Prata,serif}.catalog-order-config__head p{max-width:540px;margin:6px 0 0;color:rgba(255,255,255,.66);font-size:11px;line-height:1.5}
      .catalog-order-config__fields.calc-form{display:grid;grid-template-columns:1.08fr .92fr .92fr;gap:12px;padding:0!important;background:transparent!important}.catalog-order-config .form-block{min-width:0;margin:0!important;padding:13px!important;border:1px solid rgba(255,255,255,.11)!important;border-radius:14px!important;background:rgba(255,255,255,.045)!important}.catalog-order-config .step-label{margin-bottom:10px!important}.catalog-order-config .base-install-note,.catalog-order-config .option-list,.catalog-order-config .color-note,.catalog-order-config .size-notice,.catalog-order-config .size-memory-note{display:none!important}
      .catalog-order-config .posts-reassurance{margin:8px 0 0!important;color:rgba(255,255,255,.58)!important;font-size:9.5px!important;line-height:1.4!important}.catalog-order-config .posts-reassurance strong{color:#fff!important}.catalog-order-config .dimension-help{display:block;margin-top:7px;color:rgba(255,255,255,.56);font-size:9.5px;line-height:1.4}.catalog-order-config .mobile-size-summary{margin-bottom:8px}.catalog-order-config .mobile-size-summary button{min-height:34px}
      .catalog-posts-choice{display:grid;grid-template-columns:1fr 1fr;gap:7px}.catalog-posts-choice button{display:grid;gap:3px;min-height:62px;padding:9px 10px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:rgba(255,255,255,.045);color:#fff;text-align:left;font-family:Manrope,Arial,sans-serif;cursor:pointer}.catalog-posts-choice button b{font-size:11px;line-height:1.2}.catalog-posts-choice button small{color:rgba(255,255,255,.55);font-size:8.5px;line-height:1.3}.catalog-posts-choice button.is-active{border-color:#d2a143;background:rgba(210,161,67,.14);box-shadow:inset 0 0 0 1px rgba(210,161,67,.15)}.catalog-posts-choice button.is-active b{color:#e6bd69}
      .catalog-order-config .delivery-help{margin-top:8px}.catalog-order-config .delivery-input-help{color:rgba(255,255,255,.54)!important}.catalog-order-config .delivery-choice-buttons button{min-height:42px}.catalog-order-config .delivery-selected-summary{margin:0}.catalog-order-config .city-label input{min-height:44px}.catalog-order-config .route-button{min-height:42px}
      .catalog-order-config__actions{display:flex;align-items:center;gap:12px;margin-top:14px}.catalog-order-config__apply{min-height:46px;padding:10px 20px;border:0;border-radius:11px;background:#d2a143;color:#17130d;font:900 11px/1.2 Manrope,Arial,sans-serif;cursor:pointer}.catalog-order-config__actions small{color:rgba(255,255,255,.53);font-size:9.5px;line-height:1.4}
      .catalog-order-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:11px 13px;border:1px solid rgba(17,18,20,.11);border-radius:13px;background:#fff}.catalog-order-summary[hidden]{display:none!important}.catalog-order-summary__copy{display:grid;gap:2px;min-width:0}.catalog-order-summary__copy span{color:#8d857a;font-size:8.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.catalog-order-summary__copy strong{font-size:11px;line-height:1.35}.catalog-order-summary button{flex:0 0 auto;min-height:34px;padding:7px 10px;border:1px solid rgba(210,161,67,.46);border-radius:9px;background:transparent;color:#8a6320;font:800 9.5px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .catalog-color-global{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#f0eadf;color:#3c372f}.catalog-color-global strong{font-size:10px}.catalog-color-global span{color:#7c7368;font-size:9.5px;line-height:1.35}.catalog-color-swatches{display:flex;gap:5px;flex:0 0 auto}.catalog-color-swatches i{width:17px;height:17px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(17,18,20,.13)}.catalog-color-swatches i:nth-child(1){background:#3a302b}.catalog-color-swatches i:nth-child(2){background:#4b4c4e}.catalog-color-swatches i:nth-child(3){background:#31513c}.catalog-color-swatches i:nth-child(4){background:#1d7b4a}.catalog-color-swatches i:nth-child(5){background:#6d3036}
      .product-card .price-stack,.product-card>.price-delivery-note,.product-card .product-meta,.product-card .profile-color-picker{display:none!important}.product-card .product-info>p{display:none!important}.catalog-primary-quote{display:grid;gap:3px;margin:10px 0 11px;padding:10px 11px;border-radius:11px;background:#f6f1e8}.catalog-primary-quote strong{font-size:20px;line-height:1.1;color:#171717}.catalog-primary-quote small{color:#766e64;font-size:9.5px;line-height:1.35}.catalog-primary-quote.is-manual strong{font-size:15px}.product-card .select-product{min-height:44px}
      .selected-order-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;margin:0 0 11px;padding:11px 12px;border:1px solid rgba(230,189,105,.22);border-radius:11px;background:rgba(200,152,60,.07);color:#fff}.selected-order-summary span{display:block;color:rgba(255,255,255,.55);font-size:8.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.selected-order-summary strong{display:block;margin-top:3px;font-size:10.5px;line-height:1.4}.selected-order-summary button{grid-row:1/3;grid-column:2;min-height:34px;padding:7px 9px;border:1px solid rgba(230,189,105,.35);border-radius:9px;background:transparent;color:#e6bd69;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .selected-color-panel{margin:0 0 11px;padding:11px 12px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.035);color:#fff}.selected-color-panel__head{display:flex;align-items:center;justify-content:space-between;gap:10px}.selected-color-panel__head strong{font-size:10.5px}.selected-color-panel__head button{border:0;background:transparent;color:#e6bd69;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer}.selected-color-panel__options{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.selected-color-panel__options[hidden]{display:none!important}.selected-color-panel__options button{min-height:31px;padding:6px 8px;border:1px solid rgba(255,255,255,.13);border-radius:8px;background:rgba(255,255,255,.05);color:#fff;font:700 8.5px/1.1 Manrope,Arial,sans-serif;cursor:pointer}.selected-color-panel__options button.is-active{border-color:#d2a143;color:#e6bd69;background:rgba(210,161,67,.12)}
      #calculator .size-notice,#calculator .size-memory-note{display:none!important}#calculator .mobile-payment-note{padding:7px 0 0!important;border:0!important;background:transparent!important;font-size:9.5px!important}#calculator .mobile-payment-note strong{display:inline!important;margin:0!important;font-size:9.5px!important}.order-process{display:none!important}
      @media(max-width:900px){.catalog-order-config__fields.calc-form{grid-template-columns:1fr}.catalog-order-config__head{display:block}.catalog-order-config h3{font-size:22px}}
      @media(max-width:620px){
        .catalog-order-config{margin:0 0 11px;padding:11px 12px 12px;border-radius:14px;box-shadow:0 8px 22px rgba(17,18,20,.09)}
        .catalog-order-config__head{margin-bottom:7px!important}
        .catalog-order-config__eyebrow{margin-bottom:3px;font-size:8px}
        .catalog-order-config h3{font-size:18px;line-height:1.12}
        .catalog-order-config__head p{display:none!important}
        .catalog-order-config__fields.calc-form{gap:0!important}
        .catalog-order-config .form-block{padding:10px 0!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.10)!important;border-radius:0!important;background:transparent!important}
        .catalog-order-config .form-block:first-child{padding-top:7px!important}
        .catalog-order-config .form-block:last-child{padding-bottom:5px!important;border-bottom:0!important}
        .catalog-order-config .step-label{margin-bottom:7px!important;font-size:9px!important}
        .catalog-order-config .mobile-size-summary{margin-bottom:4px!important;padding:9px 10px!important;border-radius:10px!important}
        .catalog-order-config .mobile-size-summary small{font-size:8.5px!important}
        .catalog-order-config .mobile-size-summary strong{font-size:12px!important}
        .catalog-order-config .mobile-size-summary button{min-height:34px!important;padding:0 10px!important}
        .catalog-order-config .dimension-help{margin-top:5px!important;font-size:9px!important;line-height:1.35!important}
        .catalog-posts-choice{gap:6px}
        .catalog-posts-choice button{min-height:50px;padding:7px 9px}
        .catalog-posts-choice button b{font-size:10.5px}
        .catalog-posts-choice button small{font-size:8px}
        .catalog-order-config .posts-reassurance{display:none!important}
        .catalog-order-config .city-label input{min-height:46px!important}
        .catalog-order-config .delivery-input-help{font-size:9.5px!important;line-height:1.35!important}
        .catalog-order-config .delivery-result{margin-top:6px!important;padding:7px 8px!important;font-size:10px!important}
        .catalog-order-config .delivery-help{margin-top:5px!important}
        .catalog-order-config .delivery-help summary{font-size:9.5px!important}
        .catalog-order-config__actions{display:grid;gap:5px;margin-top:9px!important}
        .catalog-order-config__apply{width:100%;min-height:42px}
        .catalog-order-config__actions small{display:none!important}
        .catalog-order-summary{margin-bottom:10px;padding:10px 11px;border-color:rgba(210,161,67,.42);background:linear-gradient(135deg,#fffaf0,#f5ead3);box-shadow:0 7px 20px rgba(133,94,26,.08)}
        .catalog-order-summary__copy{gap:3px}
        .catalog-order-summary__copy span{color:#8a6320;font-size:8px}
        .catalog-order-summary__copy strong{font-size:10.5px;line-height:1.35;color:#27221b}
        .catalog-order-summary button{min-height:36px;padding:7px 10px;background:#fff8e8}
        .catalog-color-global{margin-bottom:10px;padding:9px 10px}.catalog-color-global span{font-size:9px}.catalog-color-swatches i{width:15px;height:15px}
        .catalog-primary-quote{margin:7px 0 9px;padding:9px 10px}.catalog-primary-quote strong{font-size:18px}.catalog-primary-quote small{font-size:9px}
      }
    `;
    document.head.append(style);

    const config = document.createElement('section');
    config.id = 'catalogOrderConfigurator';
    config.className = 'catalog-order-config';
    config.innerHTML = `
      <div class="catalog-order-config__head">
        <div><span class="catalog-order-config__eyebrow">Один раз для всего каталога</span><h3>Узнайте цены для вашего заказа</h3><p>Укажите размеры, место установки и столбы. Все модели ниже пересчитаются по одним и тем же условиям. Можно ничего не менять и сразу смотреть стандартные цены.</p></div>
      </div>
      <div class="catalog-order-config__fields calc-form" id="catalogOrderFields"></div>
      <div class="catalog-order-config__actions"><button class="catalog-order-config__apply" id="applyCatalogParams" type="button">Показать цены</button><small>Не знаете размеры? Оставьте стандартные — уточним на бесплатном замере.</small></div>`;

    const summary = document.createElement('div');
    summary.id = 'catalogOrderSummary';
    summary.className = 'catalog-order-summary';
    summary.hidden = true;
    summary.innerHTML = `<div class="catalog-order-summary__copy"><span>✓ Цены рассчитаны по вашим параметрам</span><strong></strong></div><button type="button">Изменить</button>`;

    const colors = document.createElement('div');
    colors.className = 'catalog-color-global';
    colors.innerHTML = `<div><strong>Любой цвет профнастила</strong><br><span>Цвет не меняет предварительную стоимость. Выбрать оттенок можно после выбора модели.</span></div><div class="catalog-color-swatches" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>`;

    const sectionHead = catalog.querySelector('.section-head');
    sectionHead?.after(config, summary, colors);
    const fields = config.querySelector('#catalogOrderFields');
    fields.append(sizeBlock, postsBlock, deliveryBlock);

    const catalogIntro = sectionHead?.querySelector('p');
    if (catalogIntro) catalogIntro.textContent = 'Сравнивайте дизайн и уже пересчитанную стоимость. Параметры выше действуют сразу для всех 38 моделей.';

    const postsSegment = document.createElement('div');
    postsSegment.className = 'catalog-posts-choice';
    postsSegment.innerHTML = `<button type="button" data-posts-choice="0"><b>На мои столбы</b><small>Установка уже включена</small></button><button type="button" data-posts-choice="1"><b>Нужны новые</b><small>Усиленные столбы со связкой</small></button>`;
    postsBlock.querySelector('.option-list')?.before(postsSegment);
    const postsStep = postsBlock.querySelector('.step-label');
    if (postsStep) postsStep.textContent = '02 · Столбы';
    const postsHint = postsBlock.querySelector('.posts-reassurance');
    if (postsHint) postsHint.innerHTML = '<strong>Не уверены?</strong> Проверим ваши столбы на бесплатном замере.';

    const deliveryStep = deliveryBlock.querySelector('.step-label');
    if (deliveryStep) deliveryStep.textContent = '03 · Место установки';

    const sizeNotice = document.getElementById('sizeNotice');
    const sizeMemory = document.getElementById('sizeMemoryNote');
    if (sizeNotice) sizeNotice.hidden = true;
    if (sizeMemory) sizeMemory.hidden = true;

    const selectedSummary = document.createElement('div');
    selectedSummary.className = 'selected-order-summary';
    selectedSummary.innerHTML = `<div><span>Ваш расчёт</span><strong></strong></div><button type="button">Изменить</button>`;
    const preview = calculator.querySelector('.selected-product-preview');
    preview?.after(selectedSummary);

    const selectedColor = document.createElement('div');
    selectedColor.className = 'selected-color-panel';
    selectedColor.innerHTML = `<div class="selected-color-panel__head"><strong>Цвет профнастила</strong><button type="button" aria-expanded="false">Посмотреть цвета</button></div><div class="selected-color-panel__options" hidden></div>`;
    selectedSummary.after(selectedColor);
    const colorOptions = [
      ['chocolate','Шоколад'], ['graphite','Графит'], ['moss','Зелёный мох'],
      ['mint','Зелёная мята'], ['wine','Винно-красный'], ['other','Другой цвет']
    ];
    const colorOptionsNode = selectedColor.querySelector('.selected-color-panel__options');
    colorOptionsNode.innerHTML = colorOptions.map(([id,label]) => `<button type="button" data-selected-color="${id}">${label}</button>`).join('');

    const calcHeading = calculator.querySelector('.section-head h2');
    const calcIntro = calculator.querySelector('.section-head p');
    if (calcHeading) calcHeading.textContent = 'Выбранная модель и предварительный итог';
    if (calcIntro) calcIntro.textContent = 'Параметры применены ко всему каталогу. Здесь можно проверить итог и заказать бесплатный замер.';

    let calcLoadPromise = null;
    let quoteFrame = 0;
    let inputTimer = 0;
    let lastSelectedProduct = '';

    const dimensions = () => ({
      gateWidth:num(widthInput),
      gateHeight:num(heightInput),
      wicketWidth:num(wicketWidthInput),
      wicketHeight:num(wicketHeightInput)
    });

    const dimensionsValid = d => [d.gateWidth,d.gateHeight,d.wicketWidth,d.wicketHeight].every(value => Number.isFinite(value) && value > 0);
    const isStandard = d => closeTo(d.gateWidth,3.4) && closeTo(d.gateHeight,1.8) && closeTo(d.wicketWidth,1) && closeTo(d.wicketHeight,1.8);

    const delivery = () => {
      const state = api.deliveryState?.() || {kind:'empty'};
      const kind = String(state.kind || 'empty');
      const city = String(state.shortName || state.resolvedName || state.name || cityInput?.value || '').trim();
      const resolved = kind === 'fixed' || kind === 'calculated';
      return {state, kind, city, resolved, price:resolved ? Number(state.price) || 0 : 0};
    };

    const selectedPosts = () => Boolean(postsCheck?.checked);
    const summaryText = () => {
      const d = dimensions();
      const place = delivery();
      const fmt = value => Number(value).toLocaleString('ru-RU', {maximumFractionDigits:2});
      const size = dimensionsValid(d)
        ? `ворота ${fmt(d.gateWidth)}×${fmt(d.gateHeight)} м · калитка ${fmt(d.wicketWidth)}×${fmt(d.wicketHeight)} м`
        : 'проверьте размеры';
      const city = place.city && (place.resolved || place.kind === 'out-of-area')
        ? place.city
        : place.city
          ? `${place.city} · не подтверждено`
          : 'место не указано';
      return `${size} · ${city} · ${selectedPosts() ? 'новые столбы' : 'на ваши столбы'}`;
    };

    const syncPostsSegment = () => {
      postsSegment.querySelectorAll('[data-posts-choice]').forEach(button => {
        button.classList.toggle('is-active', (button.dataset.postsChoice === '1') === selectedPosts());
      });
    };

    const ensureCalculator = () => {
      if (window.GATE_CALC?.calculateGate) return Promise.resolve(window.GATE_CALC);
      if (!window.KUZDVOR_ENSURE_CALCULATOR) return Promise.resolve(null);
      if (!calcLoadPromise) {
        calcLoadPromise = window.KUZDVOR_ENSURE_CALCULATOR()
          .catch(() => null)
          .finally(() => { calcLoadPromise = null; });
      }
      return calcLoadPromise;
    };

    const productBase = (product, d) => {
      if (!product || !dimensionsValid(d)) return {value:null, manual:true};
      if (isStandard(d)) return {value:Number(product.price) || 0, manual:false};
      if (!window.GATE_CALC?.calculateGate || !window.GATE_CALC?.hasArticle?.(product.art)) return {value:null, loading:true};
      try {
        const result = window.GATE_CALC.calculateGate({
          article:product.art,
          gateWidth:d.gateWidth,
          gateHeight:d.gateHeight,
          wicketWidth:d.wicketWidth,
          wicketHeight:d.wicketHeight
        });
        const value = Number(result?.total);
        return Number.isFinite(value) && value > 0 ? {value, manual:false} : {value:null, manual:true};
      } catch {
        return {value:null, manual:true};
      }
    };

    const ensureQuoteNode = card => {
      let node = card.querySelector('.catalog-primary-quote');
      if (!node) {
        node = document.createElement('div');
        node.className = 'catalog-primary-quote';
        node.innerHTML = '<strong></strong><small></small>';
        const action = card.querySelector('.select-product');
        (action?.parentElement || card.querySelector('.product-info') || card).insertBefore(node, action || null);
      }
      const action = card.querySelector('.select-product');
      if (action) action.textContent = 'Выбрать эту модель';
      return node;
    };

    const quoteContext = place => {
      const posts = selectedPosts();
      const packageText = posts ? 'С установкой и новыми столбами' : 'С установкой';
      if (place.resolved) return `${packageText} и доставкой в ${place.city}`;
      if (place.kind === 'out-of-area') return `${packageText} · доставка рассчитывается индивидуально`;
      if (place.kind === 'error') return `${packageText} · доставка уточняется`;
      if (place.kind === 'loading' || place.kind === 'pending' || place.kind === 'confirm') return `${packageText} · доставка пока не учтена`;
      return `${packageText} · доставка после выбора места установки`;
    };

    const syncCardQuotes = () => {
      quoteFrame = 0;
      const d = dimensions();
      const place = delivery();
      grid.querySelectorAll('.product-card[data-card-product]').forEach(card => {
        const product = api.productById(card.dataset.cardProduct);
        if (!product) return;
        const node = ensureQuoteNode(card);
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        const base = productBase(product, d);
        node.classList.toggle('is-manual', Boolean(base.manual));
        if (base.loading) {
          strong.textContent = 'Пересчитываем…';
          small.textContent = 'Загружаем расчёт по вашим размерам';
          return;
        }
        if (base.manual || !Number.isFinite(base.value)) {
          strong.textContent = 'Нужен индивидуальный расчёт';
          small.textContent = 'Выбранный размер уточним на бесплатном замере';
          return;
        }
        const total = base.value + Number(product.install || 0) + (selectedPosts() ? Number(product.posts || 0) : 0) + place.price;
        strong.textContent = money(total);
        small.textContent = quoteContext(place);
      });
    };

    const scheduleQuotes = () => {
      if (quoteFrame) cancelAnimationFrame(quoteFrame);
      quoteFrame = requestAnimationFrame(syncCardQuotes);
    };

    const syncSummaries = () => {
      const text = summaryText();
      summary.querySelector('strong').textContent = text;
      selectedSummary.querySelector('strong').textContent = text;
      syncPostsSegment();
    };

    const syncSelectedColor = () => {
      const product = api.selectedProduct?.();
      if (!product) return;
      const card = grid.querySelector(`.product-card[data-card-product="${CSS.escape(product.id)}"]`);
      if (!card) return;
      colorOptionsNode.querySelectorAll('[data-selected-color]').forEach(button => {
        const original = card.querySelector(`[data-profile-color="${CSS.escape(button.dataset.selectedColor)}"]`);
        const active = original?.getAttribute('aria-pressed') === 'true';
        button.classList.toggle('is-active', active);
      });
      lastSelectedProduct = product.id;
    };

    const syncAll = () => {
      syncSummaries();
      scheduleQuotes();
      if (!calculator.hidden) syncSelectedColor();
    };

    const openConfigurator = () => {
      config.hidden = false;
      summary.hidden = true;
      config.scrollIntoView({behavior:'smooth', block:'start'});
    };

    const collapseConfigurator = ({scroll=true} = {}) => {
      config.hidden = true;
      summary.hidden = false;
      syncAll();
      if (scroll) {
        const firstCard = grid.querySelector('.product-card');
        firstCard?.scrollIntoView({behavior:'smooth', block:'start'});
      }
    };

    postsSegment.addEventListener('click', event => {
      const button = event.target.closest('[data-posts-choice]');
      if (!button || !postsCheck) return;
      postsCheck.checked = button.dataset.postsChoice === '1';
      postsCheck.dispatchEvent(new Event('change', {bubbles:true}));
      syncAll();
    });

    config.querySelector('#applyCatalogParams')?.addEventListener('click', () => {
      const d = dimensions();
      const load = !isStandard(d) ? ensureCalculator() : Promise.resolve();
      Promise.resolve(load).finally(() => {
        syncAll();
        collapseConfigurator();
      });
    });

    summary.querySelector('button')?.addEventListener('click', openConfigurator);
    selectedSummary.querySelector('button')?.addEventListener('click', openConfigurator);

    selectedColor.querySelector('.selected-color-panel__head button')?.addEventListener('click', event => {
      const willOpen = colorOptionsNode.hidden;
      colorOptionsNode.hidden = !willOpen;
      event.currentTarget.setAttribute('aria-expanded', String(willOpen));
      event.currentTarget.textContent = willOpen ? 'Скрыть цвета' : 'Посмотреть цвета';
      if (willOpen) syncSelectedColor();
    });

    colorOptionsNode.addEventListener('click', event => {
      const button = event.target.closest('[data-selected-color]');
      if (!button) return;
      const product = api.selectedProduct?.();
      const card = product ? grid.querySelector(`.product-card[data-card-product="${CSS.escape(product.id)}"]`) : null;
      const original = card?.querySelector(`[data-profile-color="${CSS.escape(button.dataset.selectedColor)}"]`);
      original?.click();
      setTimeout(syncSelectedColor, 0);
    });

    [widthInput,wicketWidthInput,heightInput,wicketHeightInput].forEach(input => {
      input?.addEventListener('input', () => {
        clearTimeout(inputTimer);
        inputTimer = window.setTimeout(async () => {
          const d = dimensions();
          if (!isStandard(d)) await ensureCalculator();
          syncAll();
        }, 180);
      });
      input?.addEventListener('change', syncAll);
    });
    postsCheck?.addEventListener('change', syncAll);
    cityInput?.addEventListener('input', syncAll);
    cityInput?.addEventListener('change', syncAll);

    document.addEventListener('gate:calculated', () => {
      syncAll();
      setTimeout(syncAll, 80);
    });

    let lastConfirmedDeliveryKey = '';
    document.addEventListener('delivery:changed', event => {
      const state = event.detail?.state || {};
      const kind = String(state.kind || '');
      syncAll();
      if (config.hidden || !['fixed','calculated','out-of-area'].includes(kind)) return;
      const city = String(state.shortName || state.resolvedName || state.name || cityInput?.value || '').trim();
      const key = `${kind}:${city}`;
      if (!city || key === lastConfirmedDeliveryKey) return;
      lastConfirmedDeliveryKey = key;
      window.setTimeout(() => {
        if (!config.hidden) collapseConfigurator({scroll:true});
      }, 120);
    });

    const gridObserver = new MutationObserver(records => {
      const addedCard = records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.product-card') || node.querySelector?.('.product-card'))));
      if (addedCard) {
        scheduleQuotes();
        setTimeout(syncSelectedColor, 0);
      }
    });
    gridObserver.observe(grid, {childList:true,subtree:true});

    const removeDuplicateOrderProcess = () => {
      if (!document.querySelector('.order-steps')) return;
      document.querySelectorAll('.order-process').forEach(section => section.remove());
    };
    removeDuplicateOrderProcess();
    new MutationObserver(removeDuplicateOrderProcess).observe(document.body, {childList:true,subtree:true});

    if (showMore) {
      showMore.addEventListener('click', () => {
        const before = grid.querySelectorAll('.product-card').length;
        setTimeout(() => {
          const cards = grid.querySelectorAll('.product-card');
          cards[before]?.scrollIntoView({behavior:'smooth',block:'start'});
        }, 180);
      });
    }

    if (mobileCta) {
      let ctaSyncing = false;
      const syncCta = () => {
        if (ctaSyncing) return;
        ctaSyncing = true;
        requestAnimationFrame(() => {
          ctaSyncing = false;
          if (document.body.classList.contains('mobile-lead-open')) return;
          if (calculator.hidden) {
            mobileCta.textContent = 'К моделям';
            return;
          }
          const total = String(document.getElementById('mobilePriceTotal')?.textContent || document.getElementById('estimateTotal')?.textContent || '').trim();
          mobileCta.textContent = total ? `На замер · ${total}` : 'На бесплатный замер';
        });
      };
      mobileCta.addEventListener('click', event => {
        if (!calculator.hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        grid.scrollIntoView({behavior:'smooth',block:'start'});
      }, true);
      new MutationObserver(syncCta).observe(calculator, {attributes:true,attributeFilter:['hidden']});
      const total = document.getElementById('mobilePriceTotal');
      if (total) new MutationObserver(syncCta).observe(total,{childList:true,subtree:true,characterData:true});
      document.addEventListener('gate:calculated', syncCta);
      syncCta();
    }

    const cardSelectionObserver = new MutationObserver(() => {
      const product = api.selectedProduct?.();
      if (!calculator.hidden && product?.id !== lastSelectedProduct) {
        lastSelectedProduct = product?.id || '';
        syncSelectedColor();
      }
    });
    cardSelectionObserver.observe(calculator,{attributes:true,attributeFilter:['hidden']});

    document.addEventListener('click', event => {
      if (!event.target.closest?.('.select-product')) return;
      setTimeout(() => {
        syncSummaries();
        syncSelectedColor();
      }, 30);
    });

    const catalogProgress = document.getElementById('catalogProgress');
    if (catalogProgress) catalogProgress.setAttribute('aria-live','polite');

    const sharedParams = new URLSearchParams(window.location.search);
    const sharedMode = sharedParams.get('share') === '1' ||
      ['city','loc','place','name','posts','gw','gh','ww','wh','art'].some(name => sharedParams.has(name));

    const numberParam = (name, fallback, min, max) => {
      const raw = sharedParams.get(name);
      if (raw === null || raw === '') return fallback;
      const value = Number(String(raw).replace(',', '.'));
      return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
    };

    const applySharedOrder = async () => {
      if (!sharedMode) return;
      const city = String(sharedParams.get('city') || sharedParams.get('loc') || '').trim();
      const routePlace = String(sharedParams.get('place') || city).trim();
      const lookupName = String(sharedParams.get('name') || city).trim();
      if (!city) return;

      const sharedDimensions = {
        gateWidth:numberParam('gw',3.4,.8,8),
        gateHeight:numberParam('gh',1.8,1,3),
        wicketWidth:numberParam('ww',1,.7,2.5),
        wicketHeight:numberParam('wh',1.8,1,3)
      };
      const pairs = [
        [widthInput,sharedDimensions.gateWidth],
        [heightInput,sharedDimensions.gateHeight],
        [wicketWidthInput,sharedDimensions.wicketWidth],
        [wicketHeightInput,sharedDimensions.wicketHeight]
      ];
      pairs.forEach(([input,value]) => {
        if (!input) return;
        input.value = String(value);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });

      const postsValue = String(sharedParams.get('posts') || 'own').trim().toLowerCase();
      const wantsPosts = ['new','1','yes','true','новые'].includes(postsValue);
      if (postsCheck) {
        postsCheck.checked = wantsPosts;
        postsCheck.dispatchEvent(new Event('change',{bubbles:true}));
      }

      config.hidden = true;
      summary.hidden = false;
      const summaryStrong = summary.querySelector('strong');
      if (summaryStrong) summaryStrong.textContent = `Считаем актуальные цены · ${city}`;
      syncAll();

      try {
        await api.setDeliveryPlace?.(routePlace, {label:city, lookupName});
      } catch {
        // Delivery controller already exposes a safe manual state on failure.
      }

      syncAll();
      config.hidden = true;
      summary.hidden = false;

      const article = String(sharedParams.get('art') || '').trim();
      window.setTimeout(() => {
        if (article && api.showProductByArticle?.(article)) return;
        grid.scrollIntoView({behavior:'smooth',block:'start'});
      }, 140);
    };

    syncAll();
    applySharedOrder();
    return true;
  }

  const tryInstall = () => {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts > 120) window.clearInterval(timer);
    }, 50);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInstall, {once:true});
  else tryInstall();
})();
