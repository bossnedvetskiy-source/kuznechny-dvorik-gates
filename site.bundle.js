/* Storefront mobile UX polish. Kept with the tiny initial catalog payload so the
   fixes run before the optional heavy calculator bundle is requested. */
(() => {
  if (window.KUZDVOR_CATALOG_POLISH_V2) return;
  window.KUZDVOR_CATALOG_POLISH_V2 = true;
  if (typeof document === 'undefined') return;

  const CONFIG_APPLIED_KEY = 'kuzdvor:catalog-config-applied-v2';
  const STANDARD = {gateWidth:3.4, gateHeight:1.8, wicketWidth:1, wicketHeight:1.8};
  const closeTo = (a,b) => Math.abs(Number(a) - Number(b)) < 0.001;
  const readNumber = node => Number(String(node?.value ?? '').replace(',', '.'));

  const waitForCatalogFlow = () => {
    let attempts = 0;
    const tryInstall = () => {
      attempts += 1;
      if (install() || attempts >= 160) return;
      window.setTimeout(tryInstall, 50);
    };
    tryInstall();
  };

  function install() {
    const config = document.getElementById('catalogOrderConfigurator');
    const summary = document.getElementById('catalogOrderSummary');
    const grid = document.getElementById('catalogGrid');
    const calculator = document.getElementById('calculator');
    const cta = document.getElementById('mobilePrimaryCta');
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const wicketWidthInput = document.getElementById('wicketWidthInput');
    const wicketHeightInput = document.getElementById('wicketHeightInput');
    const showMore = document.getElementById('showMoreButton');
    if (!config || !summary || !grid || !calculator || !cta || !widthInput || !heightInput || !wicketWidthInput || !wicketHeightInput || !showMore) return false;
    if (config.dataset.catalogPolishV2 === '1') return true;
    config.dataset.catalogPolishV2 = '1';

    if (!document.getElementById('catalogPolishV2Styles')) {
      const style = document.createElement('style');
      style.id = 'catalogPolishV2Styles';
      style.textContent = `
        .product-card .product-art{position:absolute!important;left:9px!important;top:9px!important;right:auto!important;bottom:auto!important;z-index:9!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:28px!important;padding:5px 9px!important;border:1px solid rgba(230,189,105,.82)!important;border-radius:999px!important;background:rgba(12,13,15,.88)!important;color:#f1cb78!important;font:900 10px/1 Manrope,Arial,sans-serif!important;letter-spacing:.01em!important;box-shadow:0 5px 16px rgba(0,0,0,.24)!important;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
        #showMoreButton{font-weight:900!important;border-color:rgba(17,18,20,.24)!important;box-shadow:0 5px 16px rgba(17,18,20,.08)!important}
        @media(max-width:620px){
          .catalog-order-config{padding:12px!important}
          .catalog-order-config__head{margin-bottom:10px!important}
          .catalog-order-config__head p{display:none!important}
          .catalog-order-config__fields.calc-form{gap:7px!important}
          .catalog-order-config .form-block{padding:10px!important}
          .catalog-order-config .dimension-help{font-size:9px!important;line-height:1.35!important;margin-top:6px!important}
          .catalog-order-config .posts-reassurance{font-size:9px!important;margin-top:6px!important}
          .catalog-order-config__actions{margin-top:10px!important}
          .catalog-order-config__actions small{font-size:9px!important}
          .catalog-color-global{min-height:38px!important;margin-bottom:9px!important;padding:7px 9px!important;gap:8px!important}
          .catalog-color-global>div:first-child br,.catalog-color-global>div:first-child span{display:none!important}
          .catalog-color-global strong{font-size:9.5px!important;line-height:1.2!important}
          .catalog-color-swatches{gap:4px!important}
          .catalog-color-swatches i{width:14px!important;height:14px!important}
          .product-card .product-art{left:8px!important;top:8px!important;min-height:26px!important;padding:5px 8px!important;font-size:9.5px!important}
          #mobilePrimaryCta{white-space:nowrap!important;font-size:11.5px!important;line-height:1.1!important}
          #mobilePrimaryCta::after{content:none!important;display:none!important}
          #showMoreButton{min-height:56px!important}
        }
      `;
      document.head.append(style);
    }

    const dimensions = () => ({
      gateWidth:readNumber(widthInput), gateHeight:readNumber(heightInput),
      wicketWidth:readNumber(wicketWidthInput), wicketHeight:readNumber(wicketHeightInput)
    });
    const isNonStandard = () => {
      const d = dimensions();
      return !closeTo(d.gateWidth,STANDARD.gateWidth) || !closeTo(d.gateHeight,STANDARD.gateHeight) || !closeTo(d.wicketWidth,STANDARD.wicketWidth) || !closeTo(d.wicketHeight,STANDARD.wicketHeight);
    };

    const setAppliedState = applied => {
      try {
        if (applied) sessionStorage.setItem(CONFIG_APPLIED_KEY,'1');
        else sessionStorage.removeItem(CONFIG_APPLIED_KEY);
      } catch {}
    };
    const appliedBeforeReload = (() => {
      try { return sessionStorage.getItem(CONFIG_APPLIED_KEY) === '1'; } catch { return false; }
    })();
    if (appliedBeforeReload) {
      config.hidden = true;
      summary.hidden = false;
    }
    config.querySelector('#applyCatalogParams')?.addEventListener('click', () => setAppliedState(true));
    summary.querySelector('button')?.addEventListener('click', () => setAppliedState(false));
    document.querySelector('.selected-order-summary button')?.addEventListener('click', () => setAppliedState(false));

    let priceLoadTimer = 0;
    let fallbackTimer = 0;
    const replaceStuckLoading = () => {
      if (!isNonStandard() || window.GATE_CALC?.calculateGate) return;
      grid.querySelectorAll('.catalog-primary-quote').forEach(node => {
        const strong = node.querySelector('strong');
        const small = node.querySelector('small');
        if (!strong || !/Пересчитываем/i.test(strong.textContent || '')) return;
        node.classList.add('is-manual');
        strong.textContent = 'Нужен индивидуальный расчёт';
        if (small) small.textContent = 'Выбранный размер уточним на бесплатном замере';
      });
    };
    const resyncQuotes = () => {
      clearTimeout(fallbackTimer);
      if (!isNonStandard()) return;
      const notifyExistingFlow = () => widthInput.dispatchEvent(new Event('change',{bubbles:true}));
      if (window.GATE_CALC?.calculateGate) {
        notifyExistingFlow();
        return;
      }
      const ensure = window.KUZDVOR_ENSURE_CALCULATOR;
      if (typeof ensure === 'function') {
        Promise.resolve(ensure()).then(() => {
          notifyExistingFlow();
        }).catch(() => {
          replaceStuckLoading();
        });
      }
      fallbackTimer = window.setTimeout(replaceStuckLoading, 4500);
    };
    [widthInput,heightInput,wicketWidthInput,wicketHeightInput].forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(priceLoadTimer);
        priceLoadTimer = window.setTimeout(resyncQuotes, 240);
      });
    });
    if (isNonStandard()) window.setTimeout(resyncQuotes, 0);

    let ctaQueued = false;
    const syncCta = () => {
      if (ctaQueued) return;
      ctaQueued = true;
      requestAnimationFrame(() => {
        ctaQueued = false;
        if (document.body.classList.contains('mobile-lead-open')) return;
        let desired = 'К моделям';
        if (!calculator.hidden) {
          const source = String(document.getElementById('mobilePriceTotal')?.textContent || document.getElementById('estimateTotal')?.textContent || '').trim();
          const match = source.match(/(?:от\s*)?[\d\s\u00a0]+\s*₽/i);
          desired = match ? `На замер · ${match[0].replace(/\s+/g,' ').trim()}` : 'На бесплатный замер';
        }
        if (cta.textContent !== desired) cta.textContent = desired;
      });
    };
    new MutationObserver(syncCta).observe(cta,{childList:true,subtree:true,characterData:true});
    new MutationObserver(syncCta).observe(calculator,{attributes:true,attributeFilter:['hidden']});
    new MutationObserver(syncCta).observe(document.body,{attributes:true,attributeFilter:['class']});
    ['mobilePriceTotal','estimateTotal'].forEach(id => {
      const node = document.getElementById(id);
      if (node) new MutationObserver(syncCta).observe(node,{childList:true,subtree:true,characterData:true});
    });
    document.addEventListener('gate:calculated', syncCta);
    syncCta();

    const syncShowMore = () => {
      const text = String(showMore.textContent || '').trim();
      if (text && !text.endsWith('↓')) showMore.textContent = `${text} ↓`;
    };
    new MutationObserver(syncShowMore).observe(showMore,{childList:true,subtree:true,characterData:true});
    syncShowMore();

    return true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForCatalogFlow, {once:true});
  else waitForCatalogFlow();
})();

/* Фотографии каталога. Цены изменяются только в prices.js. */
/* Первое фото в массиве — обложка карточки. Обложки выбраны по принципу: изделие целиком, реальный объект, максимально фронтальный ракурс. */
window.CATALOG_IMAGES = {
  "Арт.6": [
    "/catalog/art-6-1.webp",
    "/catalog/art-6-2.webp",
    "/catalog/art-6-3.webp"
  ],
  "Арт.18": [
    "/catalog/art-18-2.webp",
    "/catalog/art-18-1.webp",
    "/catalog/art-18-3.webp"
  ],
  "Арт.31": [
    "/catalog/art-31-1.webp",
    "/catalog/art-31-2.webp",
    "/catalog/art-31-3.webp"
  ],
  "Арт.28": [
    "/catalog/art-28-1.webp",
    "/catalog/art-28-2.webp",
    "/catalog/art-28-3.webp"
  ],
  "Арт.15": [
    "/catalog/art-15-2.webp",
    "/catalog/art-15-1.webp",
    "/catalog/art-15-3.webp"
  ],
  "Арт.30": [
    "/catalog/art-30-1.webp",
    "/catalog/art-30-2.webp",
    "/catalog/art-30-3.webp"
  ],
  "Арт.38": [
    "/catalog/art-38-2.webp",
    "/catalog/art-38-3.webp"
  ],
  "Арт.9": [
    "/catalog/art-9-1.webp",
    "/catalog/art-9-2.webp",
    "/catalog/art-9-3.webp"
  ],
  "Арт.22-2": [
    "/catalog/art-22-2-3.webp",
    "/catalog/art-22-2-2.webp"
  ],
  "Арт.21": [
    "/catalog/art-21-2.webp",
    "/catalog/art-21-3.webp",
    "/catalog/art-21-1.webp"
  ],
  "Арт.29": [
    "/catalog/art-29-1.webp",
    "/catalog/art-29-2.webp"
  ],
  "Арт.14": [
    "/catalog/art-14-2.webp",
    "/catalog/art-14-1.webp",
    "/catalog/art-14-3.webp"
  ],
  "Арт.36": [
    "/catalog/art-36-1.webp",
    "/catalog/art-36-2.webp",
    "/catalog/art-36-3.webp"
  ],
  "Арт.24": [
    "/catalog/art-24-1.webp",
    "/catalog/art-24-2.webp",
    "/catalog/art-24-3.webp"
  ],
  "Арт.1": [
    "/catalog/art-1-3.webp",
    "/catalog/art-1-1.webp",
    "/catalog/art-1-2.webp"
  ],
  "Арт.12": [
    "/catalog/art-12-2.webp",
    "/catalog/art-12-1.webp",
    "/catalog/art-12-3.webp"
  ],
  "Арт.32": [
    "/catalog/art-32-2.webp",
    "/catalog/art-32-1.webp",
    "/catalog/art-32-3.webp"
  ],
  "Арт.17С": [
    "/catalog/art-17s-3.webp",
    "/catalog/art-17s-1.webp",
    "/catalog/art-17s-2.webp"
  ],
  "Арт.4": [
    "/catalog/art-4-1.webp"
  ],
  "Арт.33": [
    "/catalog/art-33-1.webp",
    "/catalog/art-33-2.webp",
    "/catalog/art-33-3.webp"
  ],
  "Арт.46": [
    "/catalog/art-46-3.webp",
    "/catalog/art-46-1.webp",
    "/catalog/art-46-2.webp"
  ],
  "Арт.27": [
    "/catalog/art-27-3.webp",
    "/catalog/art-27-1.webp",
    "/catalog/art-27-2.webp"
  ],
  "Арт.8": [
    "/catalog/art-8-3.webp",
    "/catalog/art-8-1.webp",
    "/catalog/art-8-2.webp"
  ],
  "Арт.16": [
    "/catalog/art-16-1.webp",
    "/catalog/art-16-2.webp",
    "/catalog/art-16-3.webp"
  ],
  "Арт.7": [
    "/catalog/art-7-1.webp"
  ],
  "Арт.34": [
    "/catalog/art-34-1.webp"
  ],
  "Арт.23С": [
    "/catalog/art-23s-1.webp",
    "/catalog/art-23s-2.webp",
    "/catalog/art-23s-3.webp"
  ],
  "Арт.25": [
    "/catalog/art-25-1.webp",
    "/catalog/art-25-2.webp"
  ],
  "Арт.10": [
    "/catalog/art-10-2.webp",
    "/catalog/art-10-1.webp",
    "/catalog/art-10-3.webp"
  ],
  "Арт.35": [
    "/catalog/art-35-3.webp",
    "/catalog/art-35-1.webp",
    "/catalog/art-35-2.webp"
  ],
  "Арт.37": [
    "/catalog/art-37-1.webp"
  ],
  "Арт.9-3": [
    "/catalog/art-9-3-1.webp",
    "/catalog/art-9-3-2.webp",
    "/catalog/art-9-3-3.webp"
  ],
  "Арт.13": [
    "/catalog/art-13-1.webp",
    "/catalog/art-13-2.webp"
  ],
  "Арт.11": [
    "/catalog/art-11-1.webp"
  ],
  "Арт.20": [
    "/catalog/art-20-1.webp",
    "/catalog/art-20-2.webp",
    "/catalog/art-20-3.webp"
  ],
  "Арт.2": [
    "/catalog/art-2-1.webp",
    "/catalog/art-2-2.webp",
    "/catalog/art-2-3.webp"
  ],
  "Арт.3": [
    "/catalog/art-3-1.webp",
    "/catalog/art-3-2.webp",
    "/catalog/art-3-3.webp"
  ],
  "Арт.5": [
    "/catalog/art-5-3.webp",
    "/catalog/art-5-2.webp",
    "/catalog/art-5-1.webp"
  ]
};
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
      .catalog-order-config__head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}.catalog-order-config__eyebrow{display:block;margin:0 0 5px;color:#e6bd69;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.catalog-order-config h3{margin:0;font:25px/1.15 Prata,serif}.catalog-order-title-mobile{display:none}.catalog-order-config__head p{max-width:540px;margin:6px 0 0;color:rgba(255,255,255,.66);font-size:11px;line-height:1.5}
      .catalog-order-config__fields.calc-form{display:grid;grid-template-columns:1.08fr .92fr .92fr;gap:12px;padding:0!important;background:transparent!important}.catalog-order-config .form-block{min-width:0;margin:0!important;padding:13px!important;border:1px solid rgba(255,255,255,.11)!important;border-radius:14px!important;background:rgba(255,255,255,.045)!important}.catalog-order-config .step-label{margin-bottom:10px!important}.catalog-order-config .base-install-note,.catalog-order-config .option-list,.catalog-order-config .color-note,.catalog-order-config .size-notice,.catalog-order-config .size-memory-note{display:none!important}
      .catalog-order-config .posts-reassurance{margin:8px 0 0!important;color:rgba(255,255,255,.58)!important;font-size:9.5px!important;line-height:1.4!important}.catalog-order-config .posts-reassurance strong{color:#fff!important}.catalog-order-config .dimension-help{display:block;margin-top:7px;color:rgba(255,255,255,.56);font-size:9.5px;line-height:1.4}.catalog-order-config .mobile-size-summary{margin-bottom:8px}.catalog-order-config .mobile-size-summary button{min-height:34px}
      .catalog-posts-choice{display:grid;grid-template-columns:1fr 1fr;gap:7px}.catalog-posts-choice button{display:grid;gap:3px;min-height:62px;padding:9px 10px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:rgba(255,255,255,.045);color:#fff;text-align:left;font-family:Manrope,Arial,sans-serif;cursor:pointer}.catalog-posts-choice button b{font-size:11px;line-height:1.2}.catalog-posts-choice button small{color:rgba(255,255,255,.55);font-size:8.5px;line-height:1.3}.catalog-posts-choice button.is-active{border-color:#d2a143;background:rgba(210,161,67,.14);box-shadow:inset 0 0 0 1px rgba(210,161,67,.15)}.catalog-posts-choice button.is-active b{color:#e6bd69}
      .catalog-order-config .delivery-help{margin-top:8px}.catalog-order-config .delivery-input-help{color:rgba(255,255,255,.54)!important}.catalog-order-config .delivery-choice-buttons button{min-height:42px}.catalog-order-config .delivery-selected-summary{margin:0}.catalog-order-config .city-label input{min-height:44px}.catalog-order-config .route-button{min-height:42px}
      .catalog-order-config__actions{display:flex;align-items:center;gap:12px;margin-top:14px}.catalog-order-config__apply{min-height:46px;padding:10px 20px;border:0;border-radius:11px;background:#d2a143;color:#17130d;font:900 11px/1.2 Manrope,Arial,sans-serif;cursor:pointer}.catalog-order-config__actions small{color:rgba(255,255,255,.53);font-size:9.5px;line-height:1.4}
      .catalog-order-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:11px 13px;border:1px solid rgba(17,18,20,.11);border-radius:13px;background:#fff}.catalog-order-summary[hidden]{display:none!important}.catalog-order-summary__copy{display:grid;gap:2px;min-width:0}.catalog-order-summary__copy span{color:#8d857a;font-size:8.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.catalog-order-summary__copy strong{font-size:11px;line-height:1.35}.catalog-order-summary button{flex:0 0 auto;min-height:34px;padding:7px 10px;border:1px solid rgba(210,161,67,.46);border-radius:9px;background:transparent;color:#8a6320;font:800 9.5px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .catalog-section-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important;gap:7px 14px!important;margin-bottom:18px!important}
      .catalog-section-head>div:first-child{grid-column:1/-1!important}
      .catalog-section-head .catalog-section-subtitle{grid-column:1!important;display:block!important;max-width:none!important;margin:0!important;color:#776f64!important;font-size:11px!important;line-height:1.35!important}
      .catalog-section-head .catalog-section-subtitle strong{color:#28241f!important;font-weight:900!important}
      .catalog-section-head>.catalog-summary{grid-column:2!important;display:flex!important;justify-content:flex-end!important;margin:0!important;color:inherit!important}
      .catalog-section-head>.catalog-summary[hidden]{display:none!important}
      .catalog-color-global{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#f0eadf;color:#3c372f}.catalog-color-global strong{font-size:10px}.catalog-color-global span{color:#7c7368;font-size:9.5px;line-height:1.35}.catalog-color-swatches{display:flex;gap:5px;flex:0 0 auto}.catalog-color-swatches i{width:17px;height:17px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(17,18,20,.13)}.catalog-color-swatches i:nth-child(1){background:#3a302b}.catalog-color-swatches i:nth-child(2){background:#4b4c4e}.catalog-color-swatches i:nth-child(3){background:#31513c}.catalog-color-swatches i:nth-child(4){background:#1d7b4a}.catalog-color-swatches i:nth-child(5){background:#6d3036}
      .product-card .price-stack,.product-card>.price-delivery-note,.product-card .product-meta,.product-card .profile-color-picker{display:none!important}.product-card .product-info>p{display:none!important}.catalog-primary-quote{display:grid;gap:3px;margin:10px 0 11px;padding:10px 11px;border-radius:11px;background:#f6f1e8}.catalog-primary-quote strong{font-size:20px;line-height:1.1;color:#171717}.catalog-primary-quote small{color:#766e64;font-size:9.5px;line-height:1.35}.catalog-primary-quote.is-manual strong{font-size:15px}.product-card .select-product{min-height:44px}
      .selected-order-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;margin:0 0 11px;padding:11px 12px;border:1px solid rgba(230,189,105,.22);border-radius:11px;background:rgba(200,152,60,.07);color:#fff}.selected-order-summary span{display:block;color:rgba(255,255,255,.55);font-size:8.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.selected-order-summary strong{display:block;margin-top:3px;font-size:10.5px;line-height:1.4}.selected-order-summary button{grid-row:1/3;grid-column:2;min-height:34px;padding:7px 9px;border:1px solid rgba(230,189,105,.35);border-radius:9px;background:transparent;color:#e6bd69;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .selected-color-panel{margin:0 0 11px;padding:11px 12px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.035);color:#fff}.selected-color-panel__head{display:flex;align-items:center;justify-content:space-between;gap:10px}.selected-color-panel__head strong{font-size:10.5px}.selected-color-panel__head button{border:0;background:transparent;color:#e6bd69;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer}.selected-color-panel__options{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.selected-color-panel__options[hidden]{display:none!important}.selected-color-panel__options button{min-height:31px;padding:6px 8px;border:1px solid rgba(255,255,255,.13);border-radius:8px;background:rgba(255,255,255,.05);color:#fff;font:700 8.5px/1.1 Manrope,Arial,sans-serif;cursor:pointer}.selected-color-panel__options button.is-active{border-color:#d2a143;color:#e6bd69;background:rgba(210,161,67,.12)}
      #calculator .size-notice,#calculator .size-memory-note{display:none!important}#calculator .mobile-payment-note{padding:7px 0 0!important;border:0!important;background:transparent!important;font-size:9.5px!important}#calculator .mobile-payment-note strong{display:inline!important;margin:0!important;font-size:9.5px!important}.order-process{display:none!important}
      @media(max-width:900px){.catalog-order-config__fields.calc-form{grid-template-columns:1fr}.catalog-order-config__head{display:block}.catalog-order-config h3{font-size:22px}}
      @media(max-width:620px){
        .catalog-order-config{margin:0 0 10px;padding:10px 11px 10px;border-radius:14px;box-shadow:0 8px 22px rgba(17,18,20,.09)}
        .catalog-order-config__head{margin-bottom:4px!important}
        .catalog-order-config__eyebrow{display:none!important}
        .catalog-order-title-desktop{display:none!important}.catalog-order-title-mobile{display:inline!important}
        .catalog-order-config h3{font:15px/1.15 Manrope,Arial,sans-serif;font-weight:900}
        .catalog-order-config__head p{display:none!important}
        .catalog-order-config__fields.calc-form{gap:0!important}
        .catalog-order-config .form-block{padding:6px 0!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.09)!important;border-radius:0!important;background:transparent!important}
        .catalog-order-config .form-block:first-child{padding-top:4px!important}
        .catalog-order-config .form-block:last-child{padding-bottom:2px!important;border-bottom:0!important}
        .catalog-order-config .step-label{margin-bottom:4px!important;font-size:8.5px!important}
        .catalog-order-config .mobile-size-summary{margin-bottom:0!important;padding:7px 8px!important;border-radius:9px!important}
        .catalog-order-config .mobile-size-summary small{display:none!important}
        .catalog-order-config .mobile-size-summary strong{font-size:11.5px!important;line-height:1.25!important}
        .catalog-order-config .mobile-size-summary button{min-height:30px!important;padding:0 9px!important;font-size:9px!important}
        .catalog-order-config .dimension-help{display:none!important}
        .catalog-posts-choice{gap:5px}
        .catalog-posts-choice button{display:flex;align-items:center;min-height:39px;padding:6px 9px}
        .catalog-posts-choice button b{font-size:10.5px}
        .catalog-posts-choice button small{display:none!important}
        .catalog-order-config .posts-reassurance{display:none!important}
        .catalog-order-config .city-label{font-size:0!important;gap:0!important}
        .catalog-order-config .city-label input{min-height:44px!important;font-size:16px!important}
        .catalog-order-config .delivery-input-help{display:none!important}
        .catalog-order-config .delivery-result{margin-top:5px!important;padding:6px 8px!important;font-size:9.5px!important}
        .catalog-order-config .delivery-help{display:none!important}
        .catalog-order-config__actions{display:none!important}
        .catalog-order-summary{margin-bottom:10px;padding:10px 11px;border-color:rgba(210,161,67,.42);background:linear-gradient(135deg,#fffaf0,#f5ead3);box-shadow:0 7px 20px rgba(133,94,26,.08)}
        .catalog-order-summary__copy{gap:3px}
        .catalog-order-summary__copy span{color:#8a6320;font-size:8px}
        .catalog-order-summary__copy strong{font-size:10.5px;line-height:1.35;color:#27221b}
        .catalog-order-summary button{min-height:36px;padding:7px 10px;background:#fff8e8}
        .catalog-section-head{gap:5px 10px!important;margin-bottom:13px!important}
        .catalog-section-head h2{font-size:32px!important}
        .catalog-section-head .catalog-section-subtitle{font-size:10.5px!important}
        .catalog-section-head>.catalog-summary{align-self:center!important}
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
        <div><span class="catalog-order-config__eyebrow">Один раз для всего каталога</span><h3><span class="catalog-order-title-desktop">Узнайте цены для вашего заказа</span><span class="catalog-order-title-mobile">Параметры расчёта</span></h3><p>Укажите размеры, место установки и столбы. Все модели ниже пересчитаются по одним и тем же условиям. Можно ничего не менять и сразу смотреть стандартные цены.</p></div>
      </div>
      <div class="catalog-order-config__fields calc-form" id="catalogOrderFields"></div>
      <div class="catalog-order-config__actions"><button class="catalog-order-config__apply" id="applyCatalogParams" type="button">Показать цены</button><small>Не знаете размеры? Оставьте стандартные — уточним на бесплатном замере.</small></div>`;

    const summary = document.createElement('div');
    summary.id = 'catalogOrderSummary';
    summary.className = 'catalog-order-summary';
    summary.hidden = true;
    summary.innerHTML = `<div class="catalog-order-summary__copy"><span>✓ Цены рассчитаны по вашим параметрам</span><strong></strong></div><button type="button">Изменить</button>`;

    const sectionHead = catalog.querySelector('.section-head');
    sectionHead?.after(config, summary);
    const fields = config.querySelector('#catalogOrderFields');
    fields.append(sizeBlock, postsBlock, deliveryBlock);

    const catalogIntro = sectionHead?.querySelector('.catalog-section-subtitle');
    if (catalogIntro && !catalogIntro.querySelector('#catalogCount')) {
      catalogIntro.innerHTML = '<strong id="catalogCount">38 моделей</strong><span> · цены по вашим параметрам</span>';
    }

    const sizeStep = sizeBlock.querySelector('.step-label');
    if (sizeStep) sizeStep.textContent = 'Размеры';

    const postsSegment = document.createElement('div');
    postsSegment.className = 'catalog-posts-choice';
    postsSegment.innerHTML = `<button type="button" data-posts-choice="0"><b>На мои столбы</b><small>Установка уже включена</small></button><button type="button" data-posts-choice="1"><b>Нужны новые</b><small>Усиленные столбы со связкой</small></button>`;
    postsBlock.querySelector('.option-list')?.before(postsSegment);
    const postsStep = postsBlock.querySelector('.step-label');
    if (postsStep) postsStep.textContent = 'Столбы';
    const postsHint = postsBlock.querySelector('.posts-reassurance');
    if (postsHint) postsHint.innerHTML = '<strong>Не уверены?</strong> Проверим ваши столбы на бесплатном замере.';

    const deliveryStep = deliveryBlock.querySelector('.step-label');
    if (deliveryStep) deliveryStep.textContent = 'Место установки';

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

    const CONFIG_APPLIED_KEY = 'kuzdvor:catalog-config-applied-v2';
    const rememberConfigState = applied => {
      try {
        if (applied) sessionStorage.setItem(CONFIG_APPLIED_KEY, '1');
        else sessionStorage.removeItem(CONFIG_APPLIED_KEY);
      } catch {}
    };

    const openConfigurator = () => {
      rememberConfigState(false);
      config.hidden = false;
      summary.hidden = true;
      config.scrollIntoView({behavior:'smooth', block:'start'});
    };

    const collapseConfigurator = ({scroll=true} = {}) => {
      rememberConfigState(true);
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

(() => {
  const MEMORY_KEY = 'kuzdvor:delivery-context';
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function readData() {
    const node = document.getElementById('deliveryData');
    const site = window.SITE_SETTINGS || {};
    try {
      const data = JSON.parse(node?.textContent || '{}');
      const referenceRatePerKm = Number(data.fallbackRatePerKm) || 90;
      return {
        destinations: Array.isArray(data.destinations) ? data.destinations : [],
        referenceRatePerKm,
        fallbackRatePerKm: Number(site.deliveryRate) || referenceRatePerKm,
        serviceAreaKm: Number(site.serviceAreaKm) || 150,
        origin: data.origin || 'Мелеуз'
      };
    } catch {
      return {
        destinations:[], referenceRatePerKm:90,
        fallbackRatePerKm:Number(site.deliveryRate)||90,
        serviceAreaKm:Number(site.serviceAreaKm)||150,
        origin:'Мелеуз'
      };
    }
  }

  function readSaved() {
    try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) || 'null'); } catch { return null; }
  }

  function saveSelected(state) {
    if (!['fixed','calculated','out-of-area'].includes(state.kind)) return;
    const city = String(state.shortName || state.resolvedName || state.name || '').trim();
    if (!city) return;
    try {
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify({...state, city, price:Number(state.price)||0}));
    } catch {}
    window.KUZDVOR_CUSTOMER?.set({city});
  }

  function clearSaved() {
    try { sessionStorage.removeItem(MEMORY_KEY); } catch {}
    window.KUZDVOR_CUSTOMER?.set({city:''});
  }

  function createController({input, datalist, result, routeButton, chooser, summary, summaryValue, changeButton, onChange} = {}) {
    const data = readData();
    const destinations = [...data.destinations].sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
    const byKey = new Map(destinations.map(item => [normalize(item.name), item]));
    if (!byKey.has(normalize('Мелеуз'))) byKey.set(normalize('Мелеуз'), {name:'Мелеуз', price:0});
    if (datalist) datalist.innerHTML = destinations.map(item => `<option value="${escapeHTML(item.name)}"></option>`).join('');

    let placeChoices = null;
    let searchShell = null;
    if (input) {
      input.placeholder = 'Начните вводить населённый пункт';
      input.setAttribute('enterkeyhint','search');
      const label = input.closest('.city-label');
      if (label && !label.querySelector('.delivery-input-help')) {
        const help = document.createElement('small');
        help.className = 'delivery-input-help';
        help.id = `${input.id || 'cityInput'}Help`;
        help.textContent = 'Например: Салават, Ишимбай, Покровка. Если названий несколько — покажем районы для выбора.';
        input.insertAdjacentElement('afterend', help);
        input.setAttribute('aria-describedby', help.id);
      }
      if (label) {
        searchShell = document.createElement('div');
        searchShell.className = 'delivery-search-shell';
        label.parentNode?.insertBefore(searchShell, label);
        searchShell.append(label);

        placeChoices = document.createElement('div');
        placeChoices.className = 'delivery-place-choices';
        placeChoices.hidden = true;
        placeChoices.setAttribute('aria-live','polite');
        placeChoices.setAttribute('role','listbox');
        searchShell.append(placeChoices);
      }
      if (!document.getElementById('deliveryUxStyles')) {
        const style = document.createElement('style');
        style.id = 'deliveryUxStyles';
        style.textContent = `
          #cityInput::-webkit-calendar-picker-indicator,#installationLocationInput::-webkit-calendar-picker-indicator{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          #cityInput::-webkit-list-button,#installationLocationInput::-webkit-list-button{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          .delivery-search-shell{position:relative;display:grid;min-width:0}
          .calc-form .city-label:not(.is-visible){display:none!important}
          .calc-form .city-label.is-visible{display:grid!important}
          .calc-form .city-label.is-visible.is-place-confirming{display:none!important}
          .delivery-input-help{display:block;color:rgba(255,255,255,.58);font-size:10px;line-height:1.45;margin-top:-1px}
          .delivery-place-choices{display:grid;gap:8px;margin:8px 0 2px;padding:12px;border:1px solid rgba(212,175,55,.42);border-radius:14px;background:rgba(16,16,16,.98)}
          .delivery-place-choices.is-dropdown{position:static;max-height:196px;overflow-y:auto;overscroll-behavior:contain;box-shadow:none;border-color:rgba(255,255,255,.13);background:rgba(14,15,17,.96)}
          .delivery-place-choices[hidden]{display:none!important}
          .delivery-place-choices__title{font-size:14px;font-weight:800;line-height:1.25;color:#fff}
          .delivery-place-choices__hint{font-size:12px;line-height:1.35;color:rgba(255,255,255,.68);margin-top:-3px}
          .delivery-place-choices__button{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:3px;width:100%;text-align:left;padding:12px 13px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.055);color:#fff;cursor:pointer;touch-action:manipulation}
          .delivery-place-choices__button:hover,.delivery-place-choices__button:focus-visible{border-color:rgba(212,175,55,.8);background:rgba(212,175,55,.10);outline:none}
          .delivery-place-choices__button.is-selected{border-color:#d4af37;background:rgba(212,175,55,.16);box-shadow:inset 0 0 0 1px rgba(212,175,55,.18)}
          .delivery-place-choices.is-confirming{grid-template-columns:minmax(0,1fr) auto;align-items:stretch}
          .delivery-place-choices.is-confirming{position:static;max-height:none;overflow:visible;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
          .delivery-place-choices.is-confirming .delivery-place-choices__title,.delivery-place-choices.is-confirming .delivery-place-choices__hint,.delivery-place-choices.is-confirming .delivery-place-choices__button:not(.is-selected){display:none!important}
          .delivery-place-choices__confirm-actions{display:grid;align-content:stretch;min-width:92px}
          .delivery-place-choices__edit{min-width:92px;border:1px solid rgba(212,175,55,.55);border-radius:10px;background:rgba(212,175,55,.10);color:#e1b55a;font:900 11px/1.1 Manrope,Arial,sans-serif;cursor:pointer}
          .delivery-place-choices__button:active{transform:translateY(1px)}
          .delivery-place-choices__name{grid-column:1;font-size:14px;font-weight:800;line-height:1.25}
          .delivery-place-choices__area{grid-column:1;font-size:12px;line-height:1.35;color:rgba(255,255,255,.68)}
          .delivery-place-choices__action{grid-column:2;grid-row:1 / span 2;align-self:center;white-space:nowrap;color:#e2b75e;font-size:12px;font-weight:900}
          .delivery-place-choices__button.is-selected .delivery-place-choices__action{display:none}
          .delivery-place-choices__button.is-selected .delivery-place-choices__name::before{content:"✓ ";color:#e2b75e}
          .calc-form .city-label.is-visible.is-place-confirming{display:none!important}
          @media(max-width:620px){
            .delivery-input-help{font-size:9.5px;line-height:1.35}
            .delivery-place-choices{margin:6px 0 1px;padding:8px;gap:6px;border-radius:11px;background:rgba(12,13,15,.98)}
            .delivery-place-choices.is-dropdown{position:static;max-height:184px;box-shadow:none}
            .delivery-place-choices__title{font-size:11px}
            .delivery-place-choices__hint{font-size:9.5px;margin-top:-1px}
            .delivery-place-choices__button{min-height:46px;padding:7px 9px;border-radius:9px;column-gap:8px}
            .delivery-place-choices__name{font-size:12px}
            .delivery-place-choices__area{font-size:9.5px}
            .delivery-place-choices__action{font-size:10.5px}
            .delivery-place-choices.is-single .delivery-place-choices__title,.delivery-place-choices.is-single .delivery-place-choices__hint{display:none!important}
            .delivery-place-choices.is-confirming{margin:4px 0 0;padding:0;gap:6px}
            .delivery-place-choices.is-confirming .delivery-place-choices__button.is-selected{min-height:44px;padding:6px 8px}
            .delivery-place-choices__confirm-actions{min-width:82px}
            .delivery-place-choices__edit{min-width:82px;min-height:44px;border-radius:9px;font-size:10px}
          }
        `;
        document.head.append(style);
      }
    }
    const meleuzButton = chooser?.querySelector('[data-delivery-choice="meleuz"]');
    if (meleuzButton) meleuzButton.textContent = 'Мелеуз — бесплатно';

    let state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
    let editingOther = false;
    let searchTimer = null;
    let searchSequence = 0;
    let pendingPlaceChoice = null;

    const setResult = (message, kind='') => {
      if (!result) return;
      result.textContent = message;
      result.className = `delivery-result${kind ? ` ${kind}` : ''}`;
    };

    const clearPlaceChoices = () => {
      if (!placeChoices) return;
      placeChoices.hidden = true;
      placeChoices.classList.remove('is-dropdown','is-confirming','is-single');
      input?.closest('.city-label')?.classList.remove('is-place-confirming','is-place-results');
      placeChoices.replaceChildren();
    };

    const cancelPlaceSearch = () => {
      searchSequence += 1;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
      pendingPlaceChoice = null;
      clearPlaceChoices();
    };

    const selectedCityName = () => ['fixed','calculated','out-of-area'].includes(state.kind)
      ? String(state.shortName || state.resolvedName || state.name || input?.value || '').trim()
      : String(input?.value || '').trim();

    const syncManualDeliveryMessaging = () => {
      if (!['error','out-of-area'].includes(state.kind)) return;
      queueMicrotask(() => {
        const suffix = state.kind === 'out-of-area' ? 'доставка индивидуально' : 'доставка уточняется';
        [document.getElementById('estimateTotal'), document.getElementById('mobilePriceTotal')].forEach(node => {
          const current = String(node?.textContent || '').trim();
          if (node && current && !current.includes('доставка')) node.textContent = `${current} + ${suffix}`;
        });
        const cta = document.getElementById('mobilePrimaryCta');
        const calculator = document.getElementById('calculator');
        const leadOpen = document.body.classList.contains('mobile-lead-open');
        if (cta && calculator && !calculator.hidden && !leadOpen) {
          cta.textContent = state.kind === 'out-of-area'
            ? 'Заказать бесплатный замер · доставка индивидуально'
            : 'Заказать бесплатный замер · доставка уточняется';
        }
      });
    };

    const syncUi = () => {
      const resolved = ['fixed','calculated'].includes(state.kind);
      const selected = resolved || state.kind === 'out-of-area';
      const choosing = state.kind === 'choosing';
      const confirmingPlace = state.kind === 'place-confirm';
      const city = selectedCityName();
      if (chooser) chooser.hidden = selected || editingOther;
      if (summary) summary.hidden = !selected;
      if (summaryValue && selected) {
        summaryValue.textContent = state.kind === 'out-of-area'
          ? `${city} · доставка индивидуально`
          : normalize(city) === normalize('Мелеуз')
            ? 'Мелеуз · бесплатно'
            : `${city} · доставка учтена`;
      }
      input?.closest('.city-label')?.classList.toggle('is-visible', editingOther && !selected);
      if (result) result.hidden = selected || state.kind === 'empty' || choosing || confirmingPlace;
      if (routeButton) routeButton.hidden = selected || state.kind === 'empty' || choosing || confirmingPlace;
      if (placeChoices && !choosing && !confirmingPlace) placeChoices.hidden = true;
    };

    const emit = () => {
      syncUi();
      onChange?.(state);
      syncManualDeliveryMessaging();
    };

    const makeRequestError = (message, technical = false) => Object.assign(new Error(message), {technical});

    const requestDelivery = async (place, expectedInputValue = String(input?.value || '').trim(), options = {}) => {
      let lastError = null;
      const params = new URLSearchParams({place});
      const lat = Number(options?.lat);
      const lon = Number(options?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        params.set('lat', String(lat));
        params.set('lon', String(lon));
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(`/api/delivery?${params.toString()}`, {headers:{accept:'application/json'}});
          const raw = await response.text();
          let payload = null;
          try { payload = raw ? JSON.parse(raw) : null; } catch {}
          if (!payload || typeof payload !== 'object') {
            throw makeRequestError('Сервис расчёта доставки временно недоступен', true);
          }
          if (!response.ok) {
            const technical = response.status >= 500 || response.status === 429;
            throw makeRequestError(payload.error || 'Не удалось рассчитать доставку', technical);
          }
          return payload;
        } catch (error) {
          lastError = error?.technical === true ? error : error instanceof TypeError
            ? makeRequestError('Сервис расчёта доставки временно недоступен', true)
            : error;
          if (attempt === 0 && lastError?.technical === true) {
            await wait(350);
            if (String(input?.value || '').trim() !== expectedInputValue) throw makeRequestError('Расчёт отменён', false);
            continue;
          }
          throw lastError;
        }
      }
      throw lastError || makeRequestError('Не удалось рассчитать доставку', true);
    };

    const requestPlaceChoices = async place => {
      const response = await fetch(`/api/delivery-search?place=${encodeURIComponent(place)}`, {headers:{accept:'application/json'}});
      const payload = response.ok ? await response.json().catch(() => null) : null;
      const remoteChoices = Array.isArray(payload?.choices) ? payload.choices : [];

      const queryKey = normalize(place);
      const rawOrigin = data.origin;
      const originName = String(
        rawOrigin && typeof rawOrigin === 'object'
          ? rawOrigin.name || 'Мелеуз'
          : rawOrigin || 'Мелеуз'
      ).trim();
      const originKey = normalize(originName);
      const localChoices = [];
      if (queryKey && originKey.startsWith(queryKey)) {
        localChoices.push({
          name:originName,
          label:originName,
          secondary:'Республика Башкортостан',
          query:`${originName}, Республика Башкортостан, Россия`
        });
      }

      const seen = new Set();
      return [...localChoices, ...remoteChoices].filter(choice => {
        const key = `${normalize(choice.name)}|${normalize(choice.secondary)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);
    };

    const resolveFixed = known => {
      cancelPlaceSearch();
      const city = String(known.name || '').trim();
      const price = Number(known.price) || 0;
      if (input) input.value = city;
      state = {kind:'fixed', name:city, resolvedName:city, shortName:city, price, distanceKm:null, serviceAreaKm:data.serviceAreaKm, outOfArea:false};
      editingOther = false;
      setResult(normalize(city) === normalize('Мелеуз')
        ? 'Доставка по Мелеузу — бесплатно'
        : `${city} · доставка учтена в итоговой сумме`, 'success');
      saveSelected(state);
      emit();
    };

    const renderPlaceChoices = (entered, choices) => {
      if (!placeChoices || !choices.length) return false;
      const sameName = choices.length > 1 && choices.every(choice => normalize(choice.name) === normalize(choices[0]?.name));
      input?.closest('.city-label')?.classList.remove('is-place-confirming');
      input?.closest('.city-label')?.classList.add('is-place-results');
      placeChoices.classList.remove('is-confirming');
      placeChoices.classList.add('is-dropdown');
      placeChoices.classList.toggle('is-single', choices.length === 1);
      placeChoices.replaceChildren();

      const title = document.createElement('div');
      title.className = 'delivery-place-choices__title';
      title.textContent = sameName ? 'Выберите район' : 'Выберите населённый пункт';
      placeChoices.append(title);

      const hint = document.createElement('div');
      hint.className = 'delivery-place-choices__hint';
      hint.textContent = sameName ? '' : 'Нажмите на подходящий вариант:';
      if (hint.textContent) placeChoices.append(hint);

      choices.forEach(choice => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'delivery-place-choices__button';

        const name = document.createElement('span');
        name.className = 'delivery-place-choices__name';
        name.textContent = String(choice.name || entered).trim();
        button.append(name);

        const area = String(choice.secondary || '').trim();
        if (area) {
          const secondary = document.createElement('span');
          secondary.className = 'delivery-place-choices__area';
          secondary.textContent = area;
          button.append(secondary);
        }

        const action = document.createElement('span');
        action.className = 'delivery-place-choices__action';
        action.textContent = 'Выбрать →';
        button.append(action);

        button.addEventListener('click', () => {
          const label = String(choice.label || choice.name || entered).trim();
          const query = String(choice.query || label).trim();
          searchSequence += 1;
          if (searchTimer) clearTimeout(searchTimer);
          searchTimer = null;
          const sameLocalityCount = choices.filter(item => normalize(item.name) === normalize(choice.name)).length;
          const knownDestination = byKey.get(normalize(choice.name));
          pendingPlaceChoice = {
            ...choice, label, query,
            fixedName: knownDestination && sameLocalityCount === 1 ? String(knownDestination.name || choice.name || '').trim() : ''
          };
          if (input) input.value = label;
          placeChoices.querySelectorAll('.delivery-place-choices__button').forEach(item => item.classList.toggle('is-selected', item === button));
          placeChoices.classList.remove('is-dropdown');
          placeChoices.classList.add('is-confirming');
          input?.closest('.city-label')?.classList.add('is-place-confirming');
          placeChoices.querySelector('.delivery-place-choices__confirm-actions')?.remove();
          const confirmActions = document.createElement('div');
          confirmActions.className = 'delivery-place-choices__confirm-actions';

          const editButton = document.createElement('button');
          editButton.type = 'button';
          editButton.className = 'delivery-place-choices__edit';
          editButton.textContent = 'Изменить';
          editButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            searchSequence += 1;
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = null;
            pendingPlaceChoice = null;
            clearPlaceChoices();
            const entered = String(input?.value || '').trim();
            state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
            setResult('', '');
            if (routeButton) routeButton.hidden = true;
            emit();
            window.setTimeout(() => {
              input?.focus();
              input?.select?.();
            }, 0);
          });

          confirmActions.append(editButton);
          placeChoices.append(confirmActions);
          state = {kind:'place-confirm', name:label, resolvedName:label, shortName:label, price:null};
          setResult('', 'pending');
          if (routeButton) routeButton.hidden = true;
          emit();
          placeChoices.hidden = false;

          const selectedChoice = pendingPlaceChoice;
          const selectionSequence = searchSequence;
          window.setTimeout(async () => {
            if (state.kind !== 'place-confirm' || normalize(state.name) !== normalize(label)) return;
            pendingPlaceChoice = null;

            if (selectedChoice?.fixedName) {
              const known = byKey.get(normalize(selectedChoice.fixedName));
              if (known) {
                resolveFixed(known);
                return;
              }
            }

            try {
              const payload = await requestDelivery(query, label, {
                lat:selectedChoice?.lat,
                lon:selectedChoice?.lon
              });
              if (selectionSequence !== searchSequence || state.kind !== 'place-confirm' || normalize(state.name) !== normalize(label)) return;

              const shortName = label || payload.shortName || payload.resolvedName || query;
              if (payload.outOfArea) {
                state = {
                  kind:'out-of-area', name:shortName, resolvedName:label || payload.resolvedName || shortName, shortName,
                  price:null, distanceKm:Number(payload.distanceKm)||null,
                  serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm, outOfArea:true
                };
                editingOther = false;
                setResult(`Расстояние около ${state.distanceKm || '—'} км — доставка рассчитывается индивидуально.`, 'pending');
              } else {
                state = {
                  kind:'calculated', name:shortName, resolvedName:label || payload.resolvedName || shortName, shortName,
                  price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null,
                  serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm
                };
                editingOther = false;
                setResult(`${shortName} · доставка учтена в итоговой сумме`, 'success');
              }
              saveSelected(state);
              emit();
            } catch (error) {
              if (selectionSequence !== searchSequence || state.kind !== 'place-confirm') return;
              clearPlaceChoices();
              state = {kind:'error', name:label, resolvedName:'', shortName:'', price:null};
              const message = error?.technical === true
                ? 'Не удалось автоматически рассчитать доставку.'
                : String(error?.message || 'Не удалось рассчитать доставку.');
              setResult(`${message} Оставьте заявку — стоимость уточним вручную.`, 'pending');
              if (routeButton) {
                routeButton.hidden = false;
                routeButton.disabled = false;
                routeButton.textContent = 'Повторить расчёт';
              }
              emit();
            }
          }, 0);
        });
        placeChoices.append(button);
      });

      state = {kind:'choosing', name:entered, resolvedName:'', shortName:'', price:null};
      placeChoices.hidden = false;
      if (routeButton) routeButton.hidden = true;
      emit();
      placeChoices.hidden = false;
      return true;
    };

    const showSearchFallback = entered => {
      if (String(input?.value || '').trim() !== entered || state.kind !== 'pending') return;
      setResult('Не нашли точный вариант в списке. Можно рассчитать маршрут по введённому названию.', 'pending');
      if (routeButton) {
        routeButton.hidden = false;
        routeButton.disabled = false;
        routeButton.textContent = 'Рассчитать доставку';
      }
      emit();
    };

    const searchPlaces = entered => {
      if (!input || entered.length < 2) return;
      const sequence = ++searchSequence;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        searchTimer = null;
        try {
          const choices = await requestPlaceChoices(entered);
          if (sequence !== searchSequence || String(input.value || '').trim() !== entered) return;
          if (!choices.length) {
            showSearchFallback(entered);
            return;
          }

          const exact = choices.filter(choice => normalize(choice.name) === normalize(entered));
          renderPlaceChoices(entered, exact.length ? exact : choices);
        } catch {
          if (sequence !== searchSequence || String(input?.value || '').trim() !== entered) return;
          showSearchFallback(entered);
        }
      }, 420);
    };

    const updateFromInput = (options = {}) => {
      const entered = String(input?.value || '').trim();
      cancelPlaceSearch();
      const known = byKey.get(normalize(entered));
      const directKnown = options?.directKnown === true;
      if (known && (directKnown || normalize(entered) === normalize('Мелеуз'))) {
        resolveFixed(known);
        return;
      }
      if (entered.length >= 2) {
        state = {kind:'pending', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) {
          routeButton.hidden = true;
          routeButton.disabled = false;
          routeButton.textContent = 'Рассчитать доставку';
        }
        setResult('Ищем населённый пункт. Затем выберите нужный вариант.', 'pending');
        emit();
        searchPlaces(entered);
      } else {
        state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) routeButton.hidden = true;
        setResult('', 'pending');
        emit();
      }
    };

    async function calculateRoute(requestedPlace = '', options = {}) {
      const displayAtStart = String(input?.value || '').trim();
      const place = String(requestedPlace || displayAtStart).trim();
      const preferredLabel = String(options.preferredLabel || '').trim();
      const skipConfirm = options.skipConfirm === true;
      if (place.length < 2) {
        editingOther = true;
        updateFromInput();
        input?.focus();
        return;
      }
      if (!requestedPlace && state.kind === 'place-confirm' && pendingPlaceChoice) {
        const choice = pendingPlaceChoice;
        const label = String(choice.label || choice.name || displayAtStart || place).trim();
        const query = String(choice.query || label).trim();
        pendingPlaceChoice = null;
        clearPlaceChoices();
        if (choice.fixedName) {
          const known = byKey.get(normalize(choice.fixedName));
          if (known) {
            resolveFixed(known);
            return;
          }
        }
        if (input) input.value = label;
        return calculateRoute(query, {preferredLabel:label, skipConfirm:true});
      }
      cancelPlaceSearch();
      if (!requestedPlace && state.kind === 'confirm') {
        state = {...state, kind:'calculated'};
        editingOther = false;
        setResult(`${state.shortName} · доставка учтена в итоговой сумме`, 'success');
        saveSelected(state);
        emit();
        return;
      }
      state = {kind:'loading', name:preferredLabel || displayAtStart || place, resolvedName:'', shortName:'', price:null};
      if (routeButton) { routeButton.hidden = false; routeButton.disabled = true; routeButton.textContent = 'Считаем…'; }
      setResult('Ищем населённый пункт и автомобильный маршрут…', 'pending');
      emit();
      try {
        const payload = await requestDelivery(place, displayAtStart);
        if (String(input?.value || '').trim() !== displayAtStart) return;
        const shortName = preferredLabel || payload.shortName || payload.resolvedName || displayAtStart || place;
        if (input && preferredLabel) input.value = preferredLabel;
        if (payload.outOfArea) {
          state = {
            kind:'out-of-area', name:shortName, resolvedName:preferredLabel || payload.resolvedName || shortName, shortName,
            price:null, distanceKm:Number(payload.distanceKm)||null,
            serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm, outOfArea:true
          };
          editingOther = false;
          if (routeButton) { routeButton.hidden = true; routeButton.disabled = false; routeButton.textContent = 'Рассчитать доставку'; }
          setResult(`Расстояние около ${state.distanceKm || '—'} км — дальше стандартной зоны выезда ${state.serviceAreaKm} км. Стоимость доставки рассчитаем индивидуально.`, 'pending');
          saveSelected(state);
          emit();
          return;
        }
        if (skipConfirm) {
          state = {
            kind:'calculated', name:shortName, resolvedName:preferredLabel || payload.resolvedName || shortName, shortName,
            price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null,
            serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm
          };
          editingOther = false;
          if (routeButton) { routeButton.hidden = true; routeButton.disabled = false; routeButton.textContent = 'Рассчитать доставку'; }
          setResult(`${shortName} · доставка учтена в итоговой сумме`, 'success');
          saveSelected(state);
          emit();
          return;
        }
        state = {kind:'confirm', name:displayAtStart || place, resolvedName:payload.resolvedName || shortName, shortName, price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null, serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'ОК'; }
        setResult(`Найдено: ${shortName}. Подтвердите населённый пункт.`, 'pending');
      } catch (error) {
        if (String(input?.value || '').trim() !== displayAtStart) return;
        state = {kind:'error', name:displayAtStart || place, resolvedName:'', shortName:'', price:null};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'Повторить расчёт'; }
        const message = error?.technical === true
          ? 'Не удалось автоматически рассчитать доставку.'
          : String(error?.message || 'Не удалось рассчитать доставку.');
        setResult(`${message} Оставьте заявку — стоимость уточним вручную.`, 'pending');
      }
      emit();
    }

    const chooseMeleuz = () => resolveFixed(byKey.get(normalize('Мелеуз')) || {name:'Мелеуз',price:0});
    const chooseOther = () => {
      clearSaved();
      cancelPlaceSearch();
      editingOther = true;
      state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
      if (input) input.value = '';
      setResult('', 'pending');
      emit();
      setTimeout(() => input?.focus(), 40);
    };
    const edit = () => {
      const previousCity = selectedCityName();
      clearSaved();
      cancelPlaceSearch();
      editingOther = true;
      state = {kind:'empty', name:previousCity, resolvedName:'', shortName:'', price:null};
      if (input) input.value = previousCity;
      setResult('', 'pending');
      emit();
      setTimeout(() => {
        input?.focus();
        input?.select?.();
      }, 40);
    };

    chooser?.querySelector('[data-delivery-choice="meleuz"]')?.addEventListener('click', chooseMeleuz);
    chooser?.querySelector('[data-delivery-choice="other"]')?.addEventListener('click', chooseOther);
    changeButton?.addEventListener('click', edit);
    input?.addEventListener('input', updateFromInput);
    input?.addEventListener('change', () => {
      // Tapping a search result blurs the input before the result's click fires.
      // Do not clear the visible choices during that blur/change sequence.
      if (state.kind === 'choosing' || state.kind === 'place-confirm') return;
      updateFromInput();
    });
    routeButton?.addEventListener('click', async () => {
      if (state.kind === 'pending') {
        const entered = String(input?.value || '').trim();
        if (entered.length >= 2) {
          routeButton.disabled = true;
          routeButton.textContent = 'Ищем…';
          try {
            const choices = await requestPlaceChoices(entered);
            if (String(input?.value || '').trim() !== entered) return;
            if (choices.length) {
              const exact = choices.filter(choice => normalize(choice.name) === normalize(entered));
              renderPlaceChoices(entered, exact.length ? exact : choices);
              return;
            }
          } catch {}
          routeButton.disabled = false;
          routeButton.textContent = 'Рассчитать доставку';
        }
      }
      calculateRoute();
    });

    const restore = () => {
      const customerCity = window.KUZDVOR_CUSTOMER?.read()?.city || '';
      const saved = readSaved();
      const city = String(customerCity || saved?.city || '').trim();
      if (!city) { emit(); return false; }
      const known = byKey.get(normalize(city));
      if (known) { resolveFixed(known); return true; }
      if (saved && normalize(saved.city) === normalize(city) && ['calculated','out-of-area'].includes(saved.kind)) {
        if (input) input.value = city;
        state = saved.kind === 'out-of-area'
          ? {kind:'out-of-area', name:saved.name || city, resolvedName:saved.resolvedName || city, shortName:saved.shortName || city, price:null, distanceKm:Number(saved.distanceKm)||null, serviceAreaKm:Number(saved.serviceAreaKm)||data.serviceAreaKm, outOfArea:true}
          : {kind:'calculated', name:saved.name || city, resolvedName:saved.resolvedName || city, shortName:saved.shortName || city, price:Number(saved.price)||0, distanceKm:Number(saved.distanceKm)||null, serviceAreaKm:Number(saved.serviceAreaKm)||data.serviceAreaKm};
        editingOther = false;
        saveSelected(state);
        emit();
        return true;
      }
      if (input) input.value = city;
      editingOther = true;
      updateFromInput();
      return false;
    };

    const line = () => {
      const city = selectedCityName();
      const resolved = ['fixed','calculated'].includes(state.kind);
      const outOfArea = state.kind === 'out-of-area';
      const failed = state.kind === 'error';
      return {
        name:'Место установки',
        value:resolved ? Number(state.price)||0 : null,
        display:outOfArea
          ? `${city} · доставка индивидуально`
          : failed
            ? `${city || 'Место установки'} · доставка уточняется`
            : city || 'Не выбрано',
        resolved,
        outOfArea
      };
    };

    restore();
    return {getState:()=>({...state}), selectedCityName, line, updateFromInput, calculateRoute, restore, chooseMeleuz, chooseOther};
  }

  window.KUZDVOR_DELIVERY = {createController, normalize};
})();
(() => {
  const phoneDigits = value => String(value || '').replace(/\D/g,'');
  const ATTRIBUTION_KEY = 'kuzdvor:utm-attribution';
  const CALCULATOR_KEY = 'kuzdvor:calculator-memory';
  const LAST_LEAD_KEY = 'kuzdvor:last-lead-submit';
  const CALCULATOR_TTL = 30 * 24 * 60 * 60 * 1000;
  const ATTRIBUTION_TTL = 30 * 24 * 60 * 60 * 1000;
  const DUPLICATE_WINDOW = 2 * 60 * 1000;

  const readJson = (storage, key) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
  };

  function captureAttribution() {
    const params = new URLSearchParams(window.location.search);
    const current = {
      utmSource: String(params.get('utm_source') || '').trim(),
      utmMedium: String(params.get('utm_medium') || '').trim(),
      utmCampaign: String(params.get('utm_campaign') || '').trim(),
      utmContent: String(params.get('utm_content') || '').trim(),
      utmTerm: String(params.get('utm_term') || '').trim(),
      yclid: String(params.get('yclid') || '').trim(),
      gclid: String(params.get('gclid') || '').trim(),
      referrer: String(document.referrer || '').slice(0,500),
      landingPage: `${window.location.pathname}${window.location.search}`.slice(0,1000),
      savedAt: Date.now()
    };
    const hasCampaign = Boolean(current.utmSource || current.utmMedium || current.utmCampaign || current.utmContent || current.utmTerm || current.yclid || current.gclid);
    if (hasCampaign) {
      try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current)); } catch {}
      return current;
    }
    const saved = readJson(localStorage, ATTRIBUTION_KEY);
    if (saved && Date.now() - Number(saved.savedAt || 0) <= ATTRIBUTION_TTL) return saved;
    if (saved) { try { localStorage.removeItem(ATTRIBUTION_KEY); } catch {} }
    return current;
  }

  let attribution = captureAttribution();
  const tracking = () => ({
    utmSource:String(attribution?.utmSource || ''),
    utmMedium:String(attribution?.utmMedium || ''),
    utmCampaign:String(attribution?.utmCampaign || ''),
    utmContent:String(attribution?.utmContent || ''),
    utmTerm:String(attribution?.utmTerm || ''),
    yclid:String(attribution?.yclid || ''),
    gclid:String(attribution?.gclid || ''),
    referrer:String(attribution?.referrer || ''),
    landingPage:String(attribution?.landingPage || '')
  });
  const attributionSource = () => [attribution?.utmSource, attribution?.utmMedium, attribution?.utmCampaign].filter(Boolean).join(' / ').slice(0,100);

  function validate({phone, city, consent} = {}) {
    const digits = phoneDigits(phone);
    if (digits.length < 10 || digits.length > 11) return {ok:false, field:'phone', message:'Укажите номер телефона'};
    if (!String(city || '').trim()) return {ok:false, field:'city', message:'Укажите место установки'};
    if (!consent) return {ok:false, field:'consent', message:'Подтвердите согласие на обработку персональных данных'};
    return {ok:true};
  }

  function enrich(payload = {}) {
    const source = attributionSource();
    return {
      ...payload,
      source: source || String(payload.source || ''),
      configuration: {
        ...(payload.configuration && typeof payload.configuration === 'object' ? payload.configuration : {}),
        tracking: tracking()
      }
    };
  }

  function leadFingerprint(payload = {}) {
    const normalized = {
      phone:phoneDigits(payload.phone),
      city:String(payload.city || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е'),
      category:String(payload.category || ''),
      article:String(payload.article || ''),
      width:Number(payload.width) || 0,
      height:Number(payload.height) || 0,
      wicketWidth:Number(payload.wicketWidth) || 0,
      wicketHeight:Number(payload.wicketHeight) || 0,
      posts:Boolean(payload.posts),
      total:Math.round(Number(payload.total) || 0)
    };
    return JSON.stringify(normalized);
  }

  async function submit(payload) {
    const enriched = enrich(payload);
    const fingerprint = leadFingerprint(enriched);
    const previous = readJson(localStorage, LAST_LEAD_KEY);
    if (previous && previous.fingerprint === fingerprint && Date.now() - Number(previous.savedAt || 0) < DUPLICATE_WINDOW) {
      return {...(previous.result || {ok:true}), duplicateSuppressed:true};
    }
    const response = await fetch('/api/leads', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(enriched),
      keepalive:true
    });
    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || 'Не удалось отправить заявку');
    }
    const result = await response.json().catch(()=>({ok:true}));
    try { localStorage.setItem(LAST_LEAD_KEY, JSON.stringify({fingerprint, savedAt:Date.now(), result})); } catch {}
    return result;
  }

  function restoreCalculatorMemory() {
    const saved = readJson(localStorage, CALCULATOR_KEY);
    if (!saved || Date.now() - Number(saved.savedAt || 0) > CALCULATOR_TTL) {
      if (saved) { try { localStorage.removeItem(CALCULATOR_KEY); } catch {} }
      return null;
    }
    const dimensions = saved.dimensions;
    if (dimensions && [dimensions.gateWidth,dimensions.gateHeight,dimensions.wicketWidth,dimensions.wicketHeight].every(Number.isFinite)) {
      try { sessionStorage.setItem('kuzdvor:gate-dimensions', JSON.stringify(dimensions)); } catch {}
    }
    try { sessionStorage.setItem('kuzdvor:strengthened-posts', saved.posts ? '1' : '0'); } catch {}
    return saved;
  }

  // Keep useful order parameters between visits, but never reopen the last selected
  // model automatically. The selected-model calculator is a temporary UI state;
  // opening it on every reload trapped mobile visitors on the previous article.
  restoreCalculatorMemory();

  function saveCalculatorMemory(patch = {}) {
    const current = readJson(localStorage, CALCULATOR_KEY) || {};
    const next = {...current, ...patch, savedAt:Date.now()};
    try { localStorage.setItem(CALCULATOR_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function snapshotCalculator() {
    const width = Number(document.getElementById('widthInput')?.value);
    const height = Number(document.getElementById('heightInput')?.value);
    const wicketWidth = Number(document.getElementById('wicketWidthInput')?.value);
    const wicketHeight = Number(document.getElementById('wicketHeightInput')?.value);
    const dimensions = {gateWidth:width, gateHeight:height, wicketWidth, wicketHeight};
    if (![width,height,wicketWidth,wicketHeight].every(Number.isFinite)) return;
    saveCalculatorMemory({dimensions, posts:Boolean(document.getElementById('postsCheck')?.checked)});
  }

  document.addEventListener('input', event => {
    if (['widthInput','heightInput','wicketWidthInput','wicketHeightInput'].includes(event.target?.id)) snapshotCalculator();
  });
  document.addEventListener('change', event => {
    if (['widthInput','heightInput','wicketWidthInput','wicketHeightInput','postsCheck'].includes(event.target?.id)) snapshotCalculator();
  });
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-product]');
    if (button?.dataset?.product) saveCalculatorMemory({productId:String(button.dataset.product)});
  });

  window.KUZDVOR_LEADS = {validate, submit, phoneDigits, tracking, attributionSource};
})();

/* Final storefront UX pass: concise order flow, readable mobile copy and modal calculator. */
(() => {
  const mobile = window.matchMedia('(max-width: 620px)');
  const style = document.createElement('style');
  style.id = 'kuzdvorFinalUxPass';
  style.textContent = `
    .privacy-section{display:none!important}
    @media(max-width:620px){
      .hero>p{font-size:14px!important;line-height:1.56!important;color:rgba(255,255,255,.78)!important}
      .hero [data-conversion-hero-note]{font-size:11.5px!important;line-height:1.45!important;color:rgba(255,255,255,.9)!important}
      .hero-prices small{font-size:11px!important;line-height:1.35!important;color:rgba(255,255,255,.74)!important}
      .hero-prices span{font-size:10.5px!important;line-height:1.4!important;color:rgba(255,255,255,.72)!important}
      .hero-size-note{font-size:11px!important;line-height:1.5!important;color:rgba(255,255,255,.7)!important}
      .hero-points span{font-size:9.7px!important;line-height:1.35!important;color:rgba(255,255,255,.64)!important}

      .package{padding-top:34px!important;padding-bottom:26px!important}
      .trust{padding-top:28px!important;padding-bottom:30px!important}
      .order-steps{padding-top:30px!important;padding-bottom:34px!important}
      .faq{padding-top:30px!important;padding-bottom:34px!important}
      .package .section-head,.order-steps .section-head,.faq .section-head{margin-bottom:15px!important}

      body.calculator-open{overflow:hidden!important}
      .calculator.inline-calculator:not([hidden]){
        position:fixed!important;inset:0!important;z-index:260!important;
        width:100vw!important;height:100dvh!important;max-width:none!important;
        margin:0!important;padding:max(8px,env(safe-area-inset-top)) 10px calc(76px + env(safe-area-inset-bottom))!important;
        overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;
        background:#0c0d0f!important;box-sizing:border-box!important;
      }
      .calculator.inline-calculator:not([hidden])>.section-head{display:none!important}
      .calculator.inline-calculator:not([hidden]) .calculator-layout{display:block!important;width:100%!important;max-width:620px!important;margin:0 auto!important}
      .calculator.inline-calculator:not([hidden]) .calc-form{margin:0!important;padding:10px!important;border-radius:16px!important}
      .calculator.inline-calculator:not([hidden]) .selected-product-preview{
        position:sticky!important;top:0!important;z-index:20!important;
        margin:0 0 12px!important;padding:8px 8px 42px!important;
        background:#141517!important;border:1px solid rgba(255,255,255,.09)!important;
        box-shadow:0 8px 22px rgba(0,0,0,.28)!important;
      }
      .calculator.inline-calculator:not([hidden]) .change-product{color:#f0c96f!important;font-size:12px!important;font-weight:900!important}
      .calculator.inline-calculator:not([hidden]) .mobile-price-breakdown{margin-bottom:4px!important}

      .mobile-cta{transition:transform .2s ease,opacity .18s ease,visibility .18s ease!important}
      body.ux-end-visible:not(.calculator-open) .mobile-cta{
        transform:translateY(calc(100% + 12px))!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;
      }
    }
  `;
  document.head.append(style);

  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };

  const normalizeOrderFlow = () => {
    const keep = document.getElementById('afterRequest');
    document.querySelectorAll('[data-order-process]').forEach(section => section.remove());
    document.querySelectorAll('[data-trust-catalog-cta]').forEach(node => node.remove());
    document.querySelectorAll('main section').forEach(section => {
      if (section === keep) return;
      const heading = String(section.querySelector('.section-head h2')?.textContent || '').trim();
      if (heading === 'Как проходит заказ') section.remove();
    });
    if (!keep) return;

    setText(keep.querySelector('.section-head h2'), 'Как проходит заказ');
    setText(keep.querySelector('.section-head > p'), 'Пять шагов от выбора модели до установки. На сайте ничего оплачивать не нужно.');
    const copy = [
      ['Выбираете модель','Смотрите реальные цены и получаете предварительный расчёт по своим размерам.'],
      ['Бесплатный замер','Мастер проверит проём, размеры, столбы и условия монтажа.'],
      ['Договор и 50%','Согласуем комплектацию и зафиксируем стоимость в договоре. Оплата — 50%.'],
      ['Изготовление','Изготовим ворота по согласованным размерам. Срок — до 30 рабочих дней.'],
      ['Монтаж и оставшиеся 50%','Установим ворота. Оставшиеся 50% оплачиваются после установки.']
    ];
    keep.querySelectorAll('.order-steps-grid article').forEach((card, index) => {
      const item = copy[index];
      if (!item) return;
      setText(card.querySelector('b'), item[0]);
      setText(card.querySelector('p'), item[1]);
    });
  };

  const syncCtaCopy = () => {
    setText(document.querySelector('.hero .hero-actions .button-primary'), 'Выбрать модель и узнать цену ↓');
    setText(document.querySelector('.final-cta .button-primary'), 'Выбрать модель и узнать цену');
    const change = document.getElementById('changeProductButton');
    if (change) setText(change, '← Вернуться к каталогу');
  };

  const syncPackageNumbers = () => {
    const grid = document.querySelector('.package-grid');
    if (!grid) return;
    const articles = [...grid.querySelectorAll('article')];
    articles.forEach(article => {
      const badge = article.querySelector(':scope > span');
      if (badge && !badge.dataset.originalNumber) badge.dataset.originalNumber = String(badge.textContent || '').trim();
    });
    const toggle = document.querySelector('[data-package-toggle]');
    const collapsedMobile = mobile.matches && toggle && toggle.getAttribute('aria-expanded') !== 'true';
    if (!collapsedMobile) {
      articles.forEach(article => {
        const badge = article.querySelector(':scope > span');
        if (badge?.dataset.originalNumber) setText(badge, badge.dataset.originalNumber);
      });
      return;
    }
    const visible = articles.filter(article => getComputedStyle(article).display !== 'none');
    visible.forEach((article, index) => setText(article.querySelector(':scope > span'), String(index + 1).padStart(2,'0')));
  };

  const bindPackageNumbering = () => {
    const grid = document.querySelector('.package-grid');
    if (!grid || grid.dataset.uxNumberingBound === '1') return;
    grid.dataset.uxNumberingBound = '1';
    new MutationObserver(() => requestAnimationFrame(syncPackageNumbers)).observe(grid,{subtree:true,attributes:true,attributeFilter:['style']});
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('[data-package-toggle]')) return;
      setTimeout(syncPackageNumbers,0);
    });
    mobile.addEventListener('change', syncPackageNumbers);
  };

  const bindEndVisibility = () => {
    if (document.body.dataset.uxEndObserverBound === '1' || !('IntersectionObserver' in window)) return;
    const targets = [document.querySelector('.final-cta'), document.querySelector('footer')].filter(Boolean);
    if (!targets.length) return;
    document.body.dataset.uxEndObserverBound = '1';
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      document.body.classList.toggle('ux-end-visible', visible.size > 0);
    },{threshold:0.08});
    targets.forEach(target => observer.observe(target));
  };

  const syncLeadBackdropLayer = () => {
    const calculator = document.getElementById('calculator');
    const backdrop = document.getElementById('leadBackdrop');
    if (calculator && backdrop && backdrop.parentElement !== calculator) calculator.append(backdrop);
  };

  const applyFinalUx = () => {
    normalizeOrderFlow();
    syncCtaCopy();
    bindPackageNumbering();
    syncPackageNumbers();
    bindEndVisibility();
    syncLeadBackdropLayer();
  };

  queueMicrotask(applyFinalUx);
  setTimeout(applyFinalUx,0);
  setTimeout(applyFinalUx,250);
  window.addEventListener('load', () => {
    applyFinalUx();
    setTimeout(applyFinalUx,400);
  }, {once:true});

  const duplicateGuard = new MutationObserver(records => {
    if (!records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('[data-order-process]') || node.querySelector?.('[data-order-process]'))))) return;
    normalizeOrderFlow();
  });
  if (document.body) {
    duplicateGuard.observe(document.body,{childList:true,subtree:true});
    setTimeout(() => duplicateGuard.disconnect(),10000);
  }
})();
(() => {
  if (window.KUZDVOR_LAZY_RUNTIME_READY) return;
  window.KUZDVOR_LAZY_RUNTIME_READY = true;

  const scriptPromises = new Map();
  const loadScript = src => {
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const target = new URL(src, location.href);
      const existing = [...document.scripts].find(script => {
        if (!script.src) return false;
        try { return new URL(script.src, location.href).href === target.href; } catch { return false; }
      });
      if (existing?.dataset.loaded === '1') return resolve();
      const script = existing || document.createElement('script');
      const onLoad = () => { script.dataset.loaded = '1'; resolve(); };
      const onError = () => reject(new Error(`Не удалось загрузить ${src}`));
      script.addEventListener('load', onLoad, {once:true});
      script.addEventListener('error', onError, {once:true});
      if (!existing) {
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      }
    }).catch(error => {
      scriptPromises.delete(src);
      throw error;
    });
    scriptPromises.set(src, promise);
    return promise;
  };

  let calculatorPromise = null;
  window.KUZDVOR_ENSURE_CALCULATOR = () => {
    if (window.KUZDVOR_CALCULATOR_LOADED && window.GATE_CALC?.calculateGate) return Promise.resolve(window.GATE_CALC);
    if (calculatorPromise) return calculatorPromise;
    calculatorPromise = loadScript('/calculator.bundle.js?v=afcbf6f8cd8b')
      .then(() => {
        if (!window.GATE_CALC?.ready) throw new Error('Калькулятор не инициализирован');
        return Promise.resolve(window.GATE_CALC.ready);
      })
      .then(() => {
        if (!window.GATE_CALC?.calculateGate) throw new Error('Калькулятор недоступен');
        window.KUZDVOR_CALCULATOR_LOADED = true;
        return window.GATE_CALC;
      })
      .catch(error => {
        calculatorPromise = null;
        throw error;
      });
    return calculatorPromise;
  };

  const showLoadError = () => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = 'Не удалось загрузить калькулятор. Обновите страницу и попробуйте ещё раз.';
    toast.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  };

  document.addEventListener('pointerover', event => {
    if (event.target?.closest?.('.select-product')) window.KUZDVOR_ENSURE_CALCULATOR().catch(() => {});
  }, {passive:true, capture:true});
  document.addEventListener('focusin', event => {
    if (event.target?.closest?.('.select-product')) window.KUZDVOR_ENSURE_CALCULATOR().catch(() => {});
  }, true);

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('.select-product');
    if (!button || window.KUZDVOR_CALCULATOR_LOADED) return;
    event.preventDefault();
    event.stopPropagation();
    const productId = button.dataset.product;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Готовим расчёт…';
    window.KUZDVOR_ENSURE_CALCULATOR()
      .then(() => {
        button.disabled = false;
        button.textContent = originalText || 'Рассчитать стоимость';
        window.GATE_PAGE_API?.openCalculatorForProduct?.(productId, true);
      })
      .catch(error => {
        console.error('Lazy calculator load failed', error);
        button.disabled = false;
        button.textContent = originalText || 'Рассчитать стоимость';
        showLoadError();
      });
  }, true);

  // Preserve the exact viewport when more catalog cards are appended. Mobile
  // browsers may otherwise anchor the focused button and move the viewport.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#showMoreButton');
    if (!button || button.hidden) return;
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    const root = document.documentElement;
    const previousOverflowAnchor = root.style.overflowAnchor;
    button.blur();
    root.style.overflowAnchor = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({left:scrollLeft, top:scrollTop, behavior:'auto'});
      setTimeout(() => { root.style.overflowAnchor = previousOverflowAnchor; }, 90);
    }));
  }, true);

  // Delivery is a single piece of state for both the calculator and every catalog
  // card. Capture that exact state at the source instead of reconstructing it later
  // from DOM mutations. This avoids races with lazy Excel/formula price refreshes.
  let directDeliveryState = null;
  const originalCreateDeliveryController = window.KUZDVOR_DELIVERY?.createController;
  if (originalCreateDeliveryController && !window.KUZDVOR_DELIVERY.__catalogPriceSyncWrapped) {
    window.KUZDVOR_DELIVERY.__catalogPriceSyncWrapped = true;
    window.KUZDVOR_DELIVERY.createController = options => {
      const originalOnChange = typeof options?.onChange === 'function' ? options.onChange : null;
      return originalCreateDeliveryController({
        ...(options || {}),
        onChange: state => {
          directDeliveryState = state && typeof state === 'object' ? {...state} : null;
          window.KUZDVOR_CATALOG_DELIVERY_STATE = directDeliveryState ? {...directDeliveryState} : null;
          originalOnChange?.(state);
          queueMicrotask(() => window.KUZDVOR_SYNC_CATALOG_DELIVERY_PRICES?.(directDeliveryState));
        }
      });
    };
  }

  const catalogGrid = document.getElementById('catalogGrid');
  const cityInput = document.getElementById('cityInput');

  // Mobile keyboard UX for the delivery field. Chromium-based Android browsers
  // may overlay the page with the virtual keyboard, while the fixed bottom CTA can
  // cover the city field at the same time. Ask the browser to resize the content,
  // hide the fixed CTA while typing, and keep the field inside the visual viewport.
  const mobileKeyboardMedia = window.matchMedia('(max-width: 620px)');
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta && !/interactive-widget\s*=/.test(viewportMeta.content || '')) {
    viewportMeta.content = `${viewportMeta.content || 'width=device-width, initial-scale=1.0'}, interactive-widget=resizes-content`;
  }
  if (cityInput) {
    cityInput.setAttribute('enterkeyhint','done');
    cityInput.setAttribute('autocapitalize','words');
    cityInput.setAttribute('spellcheck','false');
  }

  const keyboardStyle = document.createElement('style');
  keyboardStyle.textContent = '@media(max-width:620px){body.city-keyboard-open .mobile-cta{display:none!important}.city-label.is-visible{scroll-margin-top:14px;scroll-margin-bottom:24px}}';
  document.head.append(keyboardStyle);

  let cityKeyboardActive = false;
  let cityKeyboardTimer = 0;
  const ensureCityInputVisible = () => {
    if (!cityInput || !cityKeyboardActive || !mobileKeyboardMedia.matches || document.activeElement !== cityInput) return;
    const viewport = window.visualViewport;
    const viewportTop = Number(viewport?.offsetTop) || 0;
    const viewportHeight = Number(viewport?.height) || window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const rect = cityInput.getBoundingClientRect();
    const topGap = 14;
    const bottomGap = 22;
    const minTop = viewportTop + topGap;
    const maxBottom = viewportBottom - bottomGap;
    if (rect.top >= minTop && rect.bottom <= maxBottom) return;
    const preferredTop = viewportTop + Math.max(topGap, Math.min(72, viewportHeight * 0.18));
    window.scrollBy({top:rect.top - preferredTop, left:0, behavior:'smooth'});
  };
  const scheduleCityInputVisibility = () => {
    clearTimeout(cityKeyboardTimer);
    requestAnimationFrame(ensureCityInputVisible);
    cityKeyboardTimer = window.setTimeout(ensureCityInputVisible, 140);
  };
  const setCityKeyboardActive = active => {
    cityKeyboardActive = Boolean(active && mobileKeyboardMedia.matches);
    document.body.classList.toggle('city-keyboard-open', cityKeyboardActive);
    if (cityKeyboardActive) {
      scheduleCityInputVisibility();
      window.setTimeout(ensureCityInputVisible, 320);
    }
  };

  cityInput?.addEventListener('focus', () => setCityKeyboardActive(true));
  cityInput?.addEventListener('blur', () => window.setTimeout(() => setCityKeyboardActive(false), 80));
  cityInput?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const routeButton = document.getElementById('routeButton');
    const shouldCalculate = Boolean(routeButton && !routeButton.hidden && !routeButton.disabled && /Рассчитать|Повторить/.test(routeButton.textContent || ''));
    cityInput.blur();
    if (shouldCalculate) window.setTimeout(() => routeButton.click(), 0);
  });
  window.visualViewport?.addEventListener('resize', scheduleCityInputVisibility, {passive:true});
  window.visualViewport?.addEventListener('scroll', scheduleCityInputVisibility, {passive:true});
  mobileKeyboardMedia.addEventListener('change', () => {
    if (!mobileKeyboardMedia.matches) setCityKeyboardActive(false);
  });

  const roundCatalogMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
  const catalogMoney = value => new Intl.NumberFormat('ru-RU').format(roundCatalogMoney100(value)) + ' ₽';
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const isDeliveryState = value => Boolean(value && !Array.isArray(value) && typeof value === 'object' && typeof value.kind === 'string');
  let catalogDeliverySyncQueued = false;
  let pendingDeliveryState = null;

  const readSavedDeliveryState = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('kuzdvor:delivery-context') || 'null');
      return isDeliveryState(saved) ? saved : null;
    } catch {
      return null;
    }
  };

  const currentDeliveryContext = stateOverride => {
    let state = isDeliveryState(stateOverride)
      ? stateOverride
      : isDeliveryState(directDeliveryState)
        ? directDeliveryState
        : window.GATE_PAGE_API?.deliveryState?.() || null;

    if (!isDeliveryState(state) || ['empty','pending','loading'].includes(String(state.kind || 'empty'))) {
      const apiState = window.GATE_PAGE_API?.deliveryState?.() || null;
      if (isDeliveryState(apiState) && !['empty','pending','loading'].includes(String(apiState.kind || 'empty'))) state = apiState;
    }
    if (!isDeliveryState(state) || ['empty','pending','loading'].includes(String(state.kind || 'empty'))) {
      const saved = readSavedDeliveryState();
      if (saved && ['fixed','calculated','out-of-area'].includes(String(saved.kind || ''))) state = saved;
    }
    if (!isDeliveryState(state)) state = {kind:'empty'};

    const kind = String(state.kind || 'empty');
    const city = String(state.city || state.shortName || state.resolvedName || state.name || cityInput?.value || '').trim();
    const confirmed = kind === 'fixed' || kind === 'calculated';
    const priced = confirmed || kind === 'confirm';
    return {kind, city, confirmed, priced, price:priced ? (Number(state.price) || 0) : 0};
  };

  const syncCatalogDeliveryPrices = stateOverride => {
    if (!catalogGrid || !window.GATE_PAGE_API?.productById) return false;
    const delivery = currentDeliveryContext(stateOverride);
    const cards = catalogGrid.querySelectorAll('.product-card[data-card-product]');

    cards.forEach(card => {
      const product = window.GATE_PAGE_API.productById(card.dataset.cardProduct);
      if (!product) return;

      const deliveryPrice = delivery.priced ? delivery.price : 0;
      const prices = card.querySelectorAll('.price-row strong');
      setText(prices[0], catalogMoney(Number(product.price) + Number(product.install) + deliveryPrice));
      setText(prices[1], catalogMoney(Number(product.price) + Number(product.install) + Number(product.posts) + deliveryPrice));

      const note = card.querySelector('.price-delivery-note');
      if (delivery.confirmed) {
        const meleuz = /^мелеуз$/i.test(delivery.city.replace(/ё/g,'е'));
        setText(note, meleuz
          ? '✓ Доставка по Мелеузу бесплатно — уже учтена в цене'
          : `✓ С учётом доставки в ${delivery.city}`);
      } else if (delivery.kind === 'confirm') {
        setText(note, delivery.city
          ? `≈ С учётом доставки в ${delivery.city} · подтвердите пункт`
          : '≈ Доставка уже учтена · подтвердите населённый пункт');
      } else if (delivery.kind === 'out-of-area' || delivery.kind === 'error') {
        setText(note, delivery.city
          ? `Доставка в ${delivery.city} уточняется отдельно`
          : 'Стоимость доставки уточняется отдельно');
      } else if (delivery.kind === 'loading' || delivery.kind === 'pending') {
        setText(note, delivery.city
          ? `Считаем доставку в ${delivery.city} — пока показана цена без доставки`
          : 'Считаем доставку — пока показана цена без доставки');
      } else {
        setText(note, 'Доставка рассчитывается после выбора места установки');
      }
    });
    return true;
  };

  window.KUZDVOR_SYNC_CATALOG_DELIVERY_PRICES = syncCatalogDeliveryPrices;

  const scheduleCatalogDeliverySync = stateOverride => {
    if (isDeliveryState(stateOverride)) pendingDeliveryState = stateOverride;
    if (catalogDeliverySyncQueued) return;
    catalogDeliverySyncQueued = true;
    requestAnimationFrame(() => {
      catalogDeliverySyncQueued = false;
      const state = pendingDeliveryState;
      pendingDeliveryState = null;
      syncCatalogDeliveryPrices(state);
    });
  };

  const resyncDeliveryBurst = stateOverride => {
    scheduleCatalogDeliverySync(stateOverride);
    [40, 120, 300, 700, 1500].forEach(delay => setTimeout(() => scheduleCatalogDeliverySync(stateOverride), delay));
  };

  document.addEventListener('gate:calculated', () => {
    const state = isDeliveryState(directDeliveryState)
      ? directDeliveryState
      : window.GATE_PAGE_API?.deliveryState?.() || readSavedDeliveryState();
    resyncDeliveryBurst(state);
  });

  if (catalogGrid) {
    new MutationObserver(records => {
      const relevant = records.some(record => {
        if (record.type === 'characterData') return Boolean(record.target?.parentElement?.closest?.('.price-row strong'));
        if (record.type !== 'childList') return false;
        if (record.target?.nodeType === 1 && record.target.closest?.('.price-row strong')) return true;
        return [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.product-card') || node.querySelector?.('.product-card')));
      });
      if (relevant) scheduleCatalogDeliverySync(directDeliveryState);
    }).observe(catalogGrid,{childList:true,subtree:true,characterData:true});
  }

  window.addEventListener('pageshow', () => resyncDeliveryBurst(directDeliveryState));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resyncDeliveryBurst(directDeliveryState);
  });

  // Late formula/Excel updates can rewrite the same DOM nodes. Keep card totals
  // reconciled to the captured delivery state without relying on event ordering.
  setInterval(() => {
    if (document.hidden) return;
    syncCatalogDeliveryPrices(directDeliveryState);
  }, 350);

  let catalogDeliveryReadyAttempts = 0;
  const waitForCatalogDeliveryApi = () => {
    if (syncCatalogDeliveryPrices(directDeliveryState)) return;
    catalogDeliveryReadyAttempts += 1;
    if (catalogDeliveryReadyAttempts < 120) setTimeout(waitForCatalogDeliveryApi, 100);
  };
  waitForCatalogDeliveryApi();

  let catalogWorkStarted = false;
  const catalogJobs = [];
  const startCatalogDeferredWork = () => {
    if (catalogWorkStarted) return;
    catalogWorkStarted = true;
    loadScript('/catalog-enhancements.bundle.js?v=afcbf6f8cd8b').catch(error => console.error('Catalog enhancements load failed', error));
    for (const job of catalogJobs.splice(0)) {
      try { Promise.resolve(job()).catch(() => {}); } catch {}
    }
  };

  window.KUZDVOR_SCHEDULE_CATALOG_DATA = job => {
    if (typeof job !== 'function') return;
    if (catalogWorkStarted) {
      Promise.resolve().then(job).catch(() => {});
      return;
    }
    catalogJobs.push(job);
  };

  const catalog = document.getElementById('catalog');
  if (catalog && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      startCatalogDeferredWork();
    }, {rootMargin:'120px 0px'});
    observer.observe(catalog);
  }
  document.addEventListener('pointerdown', event => {
    if (event.target?.closest?.('#catalog')) startCatalogDeferredWork();
  }, {passive:true, capture:true});
  document.addEventListener('focusin', event => {
    if (event.target?.closest?.('#catalog')) startCatalogDeferredWork();
  }, true);
  setTimeout(startCatalogDeferredWork, 3500);
})();

const priceData = window.PRICE_DATA;
if (!priceData) throw new Error('Не найден файл prices.js');
const catalogImageData = window.CATALOG_IMAGES;
if (!catalogImageData) throw new Error('Не найден файл catalog-images.js');
if (!window.KUZDVOR_DELIVERY || !window.KUZDVOR_LEADS || !window.KUZDVOR_CUSTOMER) throw new Error('Не загружены общие модули сайта');

const roundMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
const money = value => new Intl.NumberFormat('ru-RU').format(roundMoney100(value)) + ' ₽';
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
const calculatorParking = document.getElementById('calculatorParking');
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

function productCardMarkup(product) {
  return `<article class="product-card ${product.media}" data-card-product="${product.id}">
    <div class="product-visual" data-gallery-card="${product.id}" data-image-index="0">
      <span class="product-art">${product.art}</span>
      <button class="product-image-open" data-zoom="${product.id}" type="button" aria-label="Открыть ${product.media==='sketch'?'эскиз':'галерею'} ${product.art}">
        <img src="${product.image}" alt="${product.media==='sketch'?'Эскиз':'Фотография'} ворот с калиткой ${product.art}" loading="lazy" decoding="async" fetchpriority="low">
      </button>
      ${product.gallery.length>1?`<button class="card-gallery-arrow previous" data-gallery-shift="-1" type="button" aria-label="Предыдущая фотография ${product.art}">‹</button><button class="card-gallery-arrow next" data-gallery-shift="1" type="button" aria-label="Следующая фотография ${product.art}">›</button>`:''}
      <span class="product-photo-count" data-photo-count>${product.media==='sketch'?'Эскиз':product.gallery.length>1?`1 из ${product.gallery.length}`:'1 фото'}</span>
    </div>
    <div class="product-info">${product.badge?`<div class="product-labels"><span>${product.badge}</span></div>`:''}<h3>Ворота с калиткой</h3><p>${product.description}</p>
      <div class="product-meta"><span>Любой цвет профнастила</span></div>
      <div class="product-bottom"><div class="price-stack">
        <div class="price-row"><small>Если подходящие столбы уже есть</small><strong>${money(product.price+product.install)}</strong></div>
        <div class="price-row turnkey"><small>С новыми усиленными столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>
        <div class="price-delivery-note">Доставка рассчитывается после выбора места установки</div>
      </div><button class="select-product" data-product="${product.id}" type="button" aria-expanded="false">Рассчитать стоимость</button></div>
    </div>
  </article>`;
}

function bindSelectButton(button) {
  if (!button || button.dataset.catalogSelectBound === '1') return;
  button.dataset.catalogSelectBound = '1';
  button.addEventListener('click', () => {
    if (window.ym) ym(107269914,'reachGoal','calculator_start',{article:button.dataset.product});
    openCalculatorForProduct(button.dataset.product,true);
  });
}

function bindGalleryShiftButton(button) {
  if (!button || button.dataset.catalogGalleryBound === '1') return;
  button.dataset.catalogGalleryBound = '1';
  button.addEventListener('click', event => {
    event.stopPropagation();
    const visual = button.closest('[data-gallery-card]');
    const current = Number(visual?.dataset.imageIndex)||0;
    showCardImage(visual,current + Number(button.dataset.galleryShift));
  });
}

function bindZoomButton(button) {
  if (!button || button.dataset.catalogZoomBound === '1') return;
  button.dataset.catalogZoomBound = '1';
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
}

function bindCardInteractions(cards) {
  for (const card of cards) {
    bindSelectButton(card.querySelector('.select-product'));
    card.querySelectorAll('[data-gallery-shift]').forEach(bindGalleryShiftButton);
    bindZoomButton(card.querySelector('[data-zoom]'));
  }
}

function syncCatalogControls() {
  const shown = Math.min(visibleCount,catalogProducts.length);
  catalogCount.textContent = `${catalogProducts.length} ${pluralModels(catalogProducts.length)}`;
  emptyState.hidden = catalogProducts.length > 0;
  const remaining = Math.max(0,catalogProducts.length-shown);
  const nextCount = Math.min(pageSize(),remaining);
  catalogMore.hidden = catalogProducts.length === 0 || remaining === 0;
  catalogProgress.textContent = remaining ? `Ещё ${remaining} ${pluralModels(remaining)} в каталоге` : '';
  showMoreButton.hidden = remaining === 0;
  showMoreButton.textContent = nextCount ? `Показать ещё ${nextCount} ${pluralModels(nextCount)} ↓` : '';
}

function restoreOpenCalculator(openProductId) {
  if (!openProductId) return;
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

function renderProducts() {
  const openProductId = calculatorPanel.hidden ? '' : selectedProductId;
  if (calculatorPanel.parentElement === grid) calculatorPanel.remove();
  const visible = catalogProducts.slice(0, visibleCount);
  grid.innerHTML = visible.map(productCardMarkup).join('');
  bindCardInteractions(grid.querySelectorAll('.product-card'));
  syncCatalogControls();
  restoreOpenCalculator(openProductId);
}

function appendProducts(fromIndex,toIndex) {
  const additions = catalogProducts.slice(fromIndex,toIndex);
  if (!additions.length) { syncCatalogControls(); return []; }
  const template=document.createElement('template');
  template.innerHTML=additions.map(productCardMarkup).join('');
  const cards=[...template.content.querySelectorAll('.product-card')];
  grid.append(template.content);
  bindCardInteractions(cards);
  syncCatalogControls();
  return cards;
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

function rebuildDesktopThumbnails(card,product) {
  if (!card || !product) return;
  card.querySelector('.card-thumbnails')?.remove();
  if (mobileCatalogMedia.matches || product.gallery.length < 2) return;
  const visual=card.querySelector('[data-gallery-card]');
  if(!visual)return;
  const strip=document.createElement('div');
  strip.className='card-thumbnails';
  product.gallery.forEach((url,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='card-thumb';
    button.setAttribute('aria-label',`Показать фото ${index+1}`);
    button.innerHTML=`<img src="${url}" alt="" loading="lazy">`;
    button.addEventListener('click',event=>{event.stopPropagation();showCardImage(visual,index);});
    strip.append(button);
  });
  visual.after(strip);
}

function syncProductCardMedia(product) {
  const card=grid.querySelector(`[data-card-product="${CSS.escape(product.id)}"]`);
  if(!card)return;
  card.classList.toggle('sketch',product.media==='sketch');
  card.classList.toggle('photo',product.media!=='sketch');
  const visual=card.querySelector('[data-gallery-card]');
  if(!visual)return;
  visual.dataset.galleryCard=product.id;
  const imageButton=visual.querySelector('.product-image-open');
  if(imageButton){
    imageButton.dataset.zoom=product.id;
    imageButton.setAttribute('aria-label',`Открыть ${product.media==='sketch'?'эскиз':'галерею'} ${product.art}`);
  }
  visual.querySelectorAll('.card-gallery-arrow').forEach(button=>button.remove());
  const counter=visual.querySelector('[data-photo-count]');
  if(product.gallery.length>1){
    const previous=document.createElement('button');
    previous.className='card-gallery-arrow previous';previous.dataset.galleryShift='-1';previous.type='button';previous.setAttribute('aria-label',`Предыдущая фотография ${product.art}`);previous.textContent='‹';
    const next=document.createElement('button');
    next.className='card-gallery-arrow next';next.dataset.galleryShift='1';next.type='button';next.setAttribute('aria-label',`Следующая фотография ${product.art}`);next.textContent='›';
    if(counter){counter.before(previous,next)}else{visual.append(previous,next)}
    bindGalleryShiftButton(previous);bindGalleryShiftButton(next);
    if(visual.dataset.colorPreview){previous.hidden=true;next.hidden=true;}
  }
  if(!visual.dataset.colorPreview){
    const current=Math.max(0,Number(visual.dataset.imageIndex)||0);
    const safeIndex=Math.min(current,Math.max(0,product.gallery.length-1));
    if(safeIndex!==current)visual.dataset.imageIndex=String(safeIndex);
    const image=visual.querySelector('.product-image-open img');
    const url=product.gallery[safeIndex]||product.image;
    if(image&&url){image.src=url;image.alt=`${product.media==='sketch'?'Эскиз':'Фотография'} ворот с калиткой ${product.art}${product.gallery.length>1?`, ${safeIndex+1} из ${product.gallery.length}`:''}`;}
    const backdrop=visual.querySelector('.product-image-backdrop');
    if(backdrop&&url)backdrop.src=url;
    if(counter)counter.textContent=product.media==='sketch'?'Эскиз':product.gallery.length>1?`${safeIndex+1} из ${product.gallery.length}`:'1 фото';
  }
  rebuildDesktopThumbnails(card,product);
}

showMoreButton.addEventListener('click',()=>{
  const previousVisible=Math.min(visibleCount,catalogProducts.length);
  visibleCount=Math.min(catalogProducts.length,visibleCount+pageSize());
  reachGoal('catalog_show_more',{visible:visibleCount,total:catalogProducts.length});
  appendProducts(previousVisible,visibleCount);
});
mobileCatalogMedia.addEventListener('change',()=>{
  const previousVisible=Math.min(visibleCount,catalogProducts.length);
  visibleCount=Math.min(catalogProducts.length,Math.max(visibleCount,pageSize()));
  if(visibleCount>previousVisible)appendProducts(previousVisible,visibleCount);
  else syncCatalogControls();
  catalogProducts.slice(0,visibleCount).forEach(product=>rebuildDesktopThumbnails(grid.querySelector(`[data-card-product="${CSS.escape(product.id)}"]`),product));
  if(!calculatorPanel.hidden){
    requestAnimationFrame(()=>{
      const card=grid.querySelector(`[data-card-product="${CSS.escape(selectedProductId)}"]`);
      if(card)placeCalculatorAfterRow(card);
    });
  }
});

function loadCatalogImagesData() {
  if (!window.KUZDVOR_CATALOG_IMAGES_PROMISE) {
    window.KUZDVOR_CATALOG_IMAGES_PROMISE = fetch('/api/catalog-images',{cache:'no-store'})
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return window.KUZDVOR_CATALOG_IMAGES_PROMISE;
}

async function loadPublishedGalleries() {
  try {
    const data=await loadCatalogImagesData();
    if(!data)return;
    const changedVisible=[];
    for(const product of catalogProducts){
      const published=data.galleries?.[product.art];
      if(!published||!Array.isArray(published.photos)||!published.photos.length)continue;
      const photos=published.photos.filter(url=>typeof url==='string'&&url.startsWith('/'));
      if(!photos.length)continue;
      const nextMedia=published.mediaType==='sketch'?'sketch':'photo';
      const changed=product.media!==nextMedia || product.gallery.length!==photos.length || product.gallery.some((url,index)=>url!==photos[index]);
      if(!changed)continue;
      product.gallery=photos;
      product.image=photos[0];
      product.media=nextMedia;
      if(product.rank<=visibleCount)changedVisible.push(product);
    }
    changedVisible.forEach(syncProductCardMedia);
    const selected=selectedProduct();
    const selectionResolver=window.GATE_PAGE_API?.['color'+'SelectionForProduct'];
    const preferredColor=selectionResolver?.(selected.id);
    if(!preferredColor&&selectedProductImage){
      selectedProductImage.src=selected.image;
      selectedProductImage.alt=`Ворота с калиткой ${selected.art}`;
    }
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
  calculatorPanel.hidden=true;
  if (calculatorParking && calculatorPanel.parentElement !== calculatorParking) calculatorParking.append(calculatorPanel);
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
    document.dispatchEvent(new CustomEvent('delivery:changed',{detail:{state:{...(state||{})}}}));
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
    total:roundMoney100(total),deliveryPending:Boolean(deliveryPending),deliveryKind:deliveryController?.getState?.()?.kind||'empty',website:document.getElementById('websiteInput')?.value||'',consent:true,policyVersion:'2026-09-09',comment:commentInput.value.trim(),message:buildMessage()
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

function normalizeArticleLookup(value) {
  return String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g,'е')
    .replace(/^арт\.?\s*/i,'')
    .replace(/\s+/g,'');
}

function productByArticle(article) {
  const wanted=normalizeArticleLookup(article);
  if(!wanted)return null;
  return catalogProducts.find(product=>normalizeArticleLookup(product.art)===wanted)||null;
}

async function setDeliveryPlace(place, options = {}) {
  const routeQuery=String(place||'').trim();
  const label=String(options?.label||routeQuery).trim();
  const lookupName=String(options?.lookupName||label).trim();
  if(!deliveryController)return {kind:'empty'};
  if(!routeQuery && !lookupName){
    deliveryController.chooseOther?.();
    return deliveryController.getState?.()||{kind:'empty'};
  }
  const normalize=window.KUZDVOR_DELIVERY?.normalize||((input)=>String(input||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,''));
  if(normalize(lookupName)===normalize('Мелеуз')){
    deliveryController.chooseMeleuz?.();
    return deliveryController.getState?.()||{kind:'fixed',name:'Мелеуз',price:0};
  }

  // Preserve configured fixed tariffs when the selected locality is already
  // in the delivery table. For ambiguous villages the exact district query
  // below is used instead.
  if(cityInput)cityInput.value=lookupName;
  deliveryController.updateFromInput?.({directKnown:true});
  const immediate=deliveryController.getState?.()||{kind:'empty'};
  if(immediate.kind==='fixed')return immediate;

  if(cityInput)cityInput.value=label||lookupName||routeQuery;
  await deliveryController.calculateRoute?.(routeQuery||lookupName,{preferredLabel:label||lookupName,skipConfirm:true});
  return deliveryController.getState?.()||{kind:'empty'};
}

function showProductByArticle(article,{open=false}={}) {
  const product=productByArticle(article);
  if(!product)return false;
  const index=catalogProducts.findIndex(item=>item.id===product.id);
  if(index>=visibleCount){
    visibleCount=Math.min(catalogProducts.length,index+1);
    renderProducts();
  }
  const card=grid.querySelector(`[data-card-product="${CSS.escape(product.id)}"]`);
  if(!card)return false;
  if(open)openCalculatorForProduct(product.id,true);
  else window.setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),80);
  return true;
}

window.GATE_PAGE_API={
  selectedProduct,productById,productByArticle,closeCalculator,openCalculatorForProduct,showProductByArticle,showCardImage,
  deliveryState:()=>deliveryController?.getState()||{kind:'empty'},
  resolveDelivery:()=>deliveryController?.calculateRoute?.(),
  setDeliveryPlace,
  dimensionState
};
renderProducts();
window.KUZDVOR_SCHEDULE_CATALOG_DATA?.(loadPublishedGalleries);
chooseProduct(selectedProductId);
window.GATE_CALC?.ready?.then(()=>{calculate();}).catch(error=>console.error('Gate models load failed',error));
(() => {
  const site = window.SITE_SETTINGS || {};

  const removeColorBadges = root => {
    if (!root) return;
    if (root.nodeType === 1 && root.matches?.('.color-profile-badge')) root.remove();
    root.querySelectorAll?.('.color-profile-badge').forEach(node => node.remove());
  };

  const enhanceColorPicker = picker => {
    if (!picker) return;
    const alreadyEnhanced = picker.dataset.optionalColorUi === 'true';
    const head = picker.querySelector('.profile-color-picker-head');
    const title = head?.querySelector('strong');
    const status = picker.querySelector('.profile-color-status');
    const swatches = picker.querySelector('.profile-color-swatches');
    const note = picker.querySelector('.profile-color-note');
    const desiredTitle = 'Любой цвет профнастила';
    const desiredNote = 'Цвет можно выбрать позже — на предварительную стоимость он не влияет.';
    if (title && title.textContent !== desiredTitle) title.textContent = desiredTitle;
    if (note && note.textContent !== desiredNote) note.textContent = desiredNote;
    if (alreadyEnhanced) return;

    picker.dataset.optionalColorUi = 'true';
    if (status) status.style.display = 'none';
    if (swatches) swatches.style.display = 'none';
    if (note) note.style.display = 'none';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'profile-color-toggle';
    toggle.textContent = 'Посмотреть цвета';
    toggle.setAttribute('aria-expanded','false');
    toggle.style.cssText = 'width:100%;min-height:34px;margin:1px 0 0;padding:7px 10px;border:1px solid rgba(17,18,20,.13);border-radius:9px;background:#f6f3ed;color:#514b43;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer;text-align:center';

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Скрыть цвета' : 'Посмотреть цвета';
      if (status) status.style.display = open ? '' : 'none';
      if (swatches) swatches.style.display = open ? '' : 'none';
      if (note) note.style.display = open ? '' : 'none';
    });

    head?.after(toggle);
  };

  const syncCatalogDecor = root => {
    if (!root) return;
    removeColorBadges(root);
    if (root.nodeType === 1 && root.matches?.('.profile-color-picker')) enhanceColorPicker(root);
    root.querySelectorAll?.('.profile-color-picker').forEach(enhanceColorPicker);
  };

  const catalogGridForBadges = document.getElementById('catalogGrid');
  if (catalogGridForBadges) {
    syncCatalogDecor(catalogGridForBadges);
    new MutationObserver(records => {
      records.forEach(record => {
        const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
        const picker = target?.matches?.('.profile-color-picker') ? target : target?.closest?.('.profile-color-picker');
        if (picker) enhanceColorPicker(picker);
        record.addedNodes.forEach(node => syncCatalogDecor(node));
      });
    }).observe(catalogGridForBadges,{childList:true,subtree:true});
  }

  const lightboxForHistory = document.getElementById('lightbox');
  if (lightboxForHistory) {
    const LIGHTBOX_HISTORY_KEY = '__kuzdvorLightbox';
    const mobileLightboxMedia = window.matchMedia('(max-width: 620px)');
    const lightboxStage = lightboxForHistory.querySelector('.lightbox-stage');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrevious = document.getElementById('lightboxPrevious');
    const lightboxNext = document.getElementById('lightboxNext');
    const lightboxCaption = lightboxForHistory.querySelector('.lightbox-caption');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxPrice = document.getElementById('lightboxPrice');
    const lightboxCounter = document.getElementById('lightboxCounter');
    const lightboxThumbnails = lightboxForHistory.querySelector('.lightbox-thumbnails');
    const mobileCta = document.querySelector('.mobile-cta');
    let historyEntryActive = false;
    let closingFromPopstate = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerActive = false;
    const lightboxIsOpen = () => !lightboxForHistory.hidden;
    const important = (element, property, value) => element?.style.setProperty(property, value, 'important');
    const clearStyle = (element, property) => element?.style.removeProperty(property);

    let lightboxMobileMeta = lightboxCaption?.querySelector('[data-mobile-lightbox-meta]') || null;
    if (lightboxCaption && !lightboxMobileMeta) {
      lightboxMobileMeta = document.createElement('div');
      lightboxMobileMeta.dataset.mobileLightboxMeta = 'true';
      lightboxCaption.append(lightboxMobileMeta);
    }

    const updateLightboxMeta = () => {
      if (!lightboxMobileMeta) return;
      const title = String(lightboxTitle?.textContent || '').trim();
      const count = String(lightboxCounter?.textContent || '').trim().replace(/^фото\s+/i,'');
      lightboxMobileMeta.textContent = [title, count ? `фото ${count}` : ''].filter(Boolean).join(' · ');
    };

    const restoreDesktopLightboxStyles = () => {
      const elements = [lightboxForHistory, lightboxStage, lightboxImage, lightboxClose, lightboxPrevious, lightboxNext, lightboxCaption, lightboxTitle, lightboxPrice, lightboxCounter, lightboxThumbnails, lightboxMobileMeta];
      const properties = ['background','padding','gap','grid-template-rows','align-items','width','height','max-width','max-height','display','grid-template-columns','place-items','box-sizing','position','inset','top','right','left','bottom','z-index','border','border-radius','box-shadow','color','font-size','font-weight','line-height','text-align','justify-content','min-height','object-fit','object-position','transform','margin','touch-action','user-select','-webkit-user-select','backdrop-filter','-webkit-backdrop-filter','opacity'];
      elements.forEach(element => properties.forEach(property => clearStyle(element, property)));
      clearStyle(mobileCta, 'display');
    };

    const syncMobileLightboxPresentation = () => {
      const mobile = mobileLightboxMedia.matches;
      const open = lightboxIsOpen();
      if (!mobile) {
        restoreDesktopLightboxStyles();
        return;
      }

      important(lightboxForHistory, 'background', 'rgba(7,8,10,.985)');
      important(lightboxForHistory, 'padding', '0');
      important(lightboxForHistory, 'gap', '0');
      important(lightboxForHistory, 'grid-template-rows', 'minmax(0,1fr) auto');
      important(lightboxForHistory, 'align-items', 'stretch');

      important(lightboxStage, 'position', 'relative');
      important(lightboxStage, 'width', '100vw');
      important(lightboxStage, 'height', 'calc(100dvh - 58px)');
      important(lightboxStage, 'max-width', 'none');
      important(lightboxStage, 'max-height', 'none');
      important(lightboxStage, 'display', 'grid');
      important(lightboxStage, 'grid-template-columns', '1fr');
      important(lightboxStage, 'gap', '0');
      important(lightboxStage, 'place-items', 'center');
      important(lightboxStage, 'padding', '58px 0 10px');
      important(lightboxStage, 'box-sizing', 'border-box');

      important(lightboxImage, 'width', '100vw');
      important(lightboxImage, 'height', '100%');
      important(lightboxImage, 'max-width', '100vw');
      important(lightboxImage, 'max-height', 'calc(100dvh - 126px)');
      important(lightboxImage, 'padding', '0');
      important(lightboxImage, 'margin', '0');
      important(lightboxImage, 'object-fit', 'contain');
      important(lightboxImage, 'object-position', 'center');
      important(lightboxImage, 'background', 'transparent');
      important(lightboxImage, 'border', '0');
      important(lightboxImage, 'border-radius', '0');
      important(lightboxImage, 'box-shadow', 'none');
      important(lightboxImage, 'transform', 'none');
      important(lightboxImage, 'touch-action', 'manipulation');
      important(lightboxImage, 'user-select', 'none');
      important(lightboxImage, '-webkit-user-select', 'none');
      if (lightboxImage) lightboxImage.draggable = false;

      important(lightboxClose, 'position', 'fixed');
      important(lightboxClose, 'top', 'max(12px, env(safe-area-inset-top))');
      important(lightboxClose, 'right', 'max(12px, env(safe-area-inset-right))');
      important(lightboxClose, 'left', 'auto');
      important(lightboxClose, 'bottom', 'auto');
      important(lightboxClose, 'z-index', '10002');
      important(lightboxClose, 'width', '46px');
      important(lightboxClose, 'height', '46px');
      important(lightboxClose, 'background', 'rgba(16,17,20,.78)');
      important(lightboxClose, 'border', '1px solid rgba(255,255,255,.28)');
      important(lightboxClose, 'border-radius', '50%');
      important(lightboxClose, 'box-shadow', '0 8px 24px rgba(0,0,0,.34)');
      important(lightboxClose, 'color', '#fff');
      important(lightboxClose, 'backdrop-filter', 'blur(8px)');
      important(lightboxClose, '-webkit-backdrop-filter', 'blur(8px)');

      [lightboxPrevious, lightboxNext].forEach(button => {
        important(button, 'position', 'absolute');
        important(button, 'top', '50%');
        important(button, 'bottom', 'auto');
        important(button, 'z-index', '10001');
        important(button, 'width', '42px');
        important(button, 'height', '42px');
        important(button, 'transform', 'translateY(-50%)');
        important(button, 'background', 'rgba(12,13,15,.74)');
        important(button, 'border', '1px solid rgba(255,255,255,.24)');
        important(button, 'border-radius', '50%');
        important(button, 'box-shadow', '0 6px 20px rgba(0,0,0,.3)');
        important(button, 'color', '#fff');
        important(button, 'backdrop-filter', 'blur(8px)');
        important(button, '-webkit-backdrop-filter', 'blur(8px)');
      });
      important(lightboxPrevious, 'left', '8px');
      important(lightboxPrevious, 'right', 'auto');
      important(lightboxNext, 'right', '8px');
      important(lightboxNext, 'left', 'auto');

      important(lightboxCaption, 'display', 'flex');
      important(lightboxCaption, 'align-items', 'center');
      important(lightboxCaption, 'justify-content', 'center');
      important(lightboxCaption, 'min-height', '58px');
      important(lightboxCaption, 'padding', '8px 16px max(12px, env(safe-area-inset-bottom))');
      important(lightboxCaption, 'box-sizing', 'border-box');
      important(lightboxCaption, 'background', 'rgba(7,8,10,.985)');
      important(lightboxCaption, 'color', '#fff');
      important(lightboxCaption, 'text-align', 'center');

      important(lightboxTitle, 'display', 'none');
      important(lightboxPrice, 'display', 'none');
      important(lightboxCounter, 'display', 'none');
      important(lightboxThumbnails, 'display', 'none');
      important(lightboxMobileMeta, 'display', 'block');
      important(lightboxMobileMeta, 'max-width', 'calc(100vw - 32px)');
      important(lightboxMobileMeta, 'color', 'rgba(255,255,255,.9)');
      important(lightboxMobileMeta, 'font-size', '13px');
      important(lightboxMobileMeta, 'font-weight', '800');
      important(lightboxMobileMeta, 'line-height', '1.35');
      important(lightboxMobileMeta, 'text-align', 'center');

      if (open) important(mobileCta, 'display', 'none');
      else clearStyle(mobileCta, 'display');
      updateLightboxMeta();
    };

    const pushLightboxHistory = () => {
      if (history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = true;
        return;
      }
      history.pushState({...(history.state || {}), [LIGHTBOX_HISTORY_KEY]: true}, '', window.location.href);
      historyEntryActive = true;
    };

    const closeLightboxFromHistory = () => {
      if (!lightboxIsOpen()) return;
      closingFromPopstate = true;
      lightboxForHistory.hidden = true;
      document.body.style.overflow = '';
      syncMobileLightboxPresentation();
      requestAnimationFrame(() => { closingFromPopstate = false; });
    };

    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'hidden')) return;
      syncMobileLightboxPresentation();
      if (lightboxIsOpen()) {
        pushLightboxHistory();
        return;
      }
      if (closingFromPopstate) return;
      if (historyEntryActive && history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = false;
        history.back();
      } else if (!history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = false;
      }
    }).observe(lightboxForHistory,{attributes:true,attributeFilter:['hidden']});

    const metaObserver = new MutationObserver(() => updateLightboxMeta());
    if (lightboxTitle) metaObserver.observe(lightboxTitle,{childList:true,characterData:true,subtree:true});
    if (lightboxCounter) metaObserver.observe(lightboxCounter,{childList:true,characterData:true,subtree:true});

    lightboxStage?.addEventListener('pointerdown', event => {
      if (!mobileLightboxMedia.matches || !lightboxIsOpen()) return;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerActive = true;
    });
    lightboxStage?.addEventListener('pointercancel', () => { pointerActive = false; });
    lightboxStage?.addEventListener('pointerup', event => {
      if (!pointerActive || !mobileLightboxMedia.matches || !lightboxIsOpen()) return;
      pointerActive = false;
      const deltaX = event.clientX - pointerStartX;
      const deltaY = event.clientY - pointerStartY;
      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
      const target = deltaX < 0 ? lightboxNext : lightboxPrevious;
      if (!target || target.hidden) return;
      target.click();
      try { window.ym?.(107269914, 'reachGoal', 'catalog_photo_swipe', {direction:deltaX < 0 ? 'next' : 'previous'}); } catch {}
    });
    lightboxImage?.addEventListener('dragstart', event => event.preventDefault());
    lightboxStage?.addEventListener('click', event => {
      if (!mobileLightboxMedia.matches || !lightboxIsOpen()) return;
      if (event.target === lightboxStage) lightboxClose?.click();
    });

    window.addEventListener('popstate', event => {
      if (lightboxIsOpen()) {
        historyEntryActive = false;
        closeLightboxFromHistory();
        return;
      }
      if (!event.state?.[LIGHTBOX_HISTORY_KEY]) historyEntryActive = false;
    });

    mobileLightboxMedia.addEventListener('change', syncMobileLightboxPresentation);
    syncMobileLightboxPresentation();
    if (lightboxIsOpen()) pushLightboxHistory();
  }

  const robots = document.querySelector('meta[name="robots"]');
  if (robots) {
    const technicalHost = /(?:workers\.dev|github\.io)$/i.test(window.location.hostname);
    robots.content = technicalHost ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  }

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  const yearWord = value => {
    const n = Math.abs(Number(value)) % 100;
    const n10 = n % 10;
    if (n > 10 && n < 20) return 'лет';
    if (n10 === 1) return 'год';
    if (n10 >= 2 && n10 <= 4) return 'года';
    return 'лет';
  };

  const setBoldLine = (element, boldText, tailText) => {
    if (!element) return;
    const bold = document.createElement('b');
    bold.textContent = boldText;
    element.replaceChildren(bold, document.createTextNode(` ${tailText}`));
  };

  const phoneDigits = String(site.phoneDigits || '').replace(/\D/g, '');
  const phoneDisplay = site.phoneDisplay || '';
  if (phoneDigits) {
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.href = `tel:+${phoneDigits}`;
      if (link.classList.contains('phone') || link.closest('footer')) link.textContent = phoneDisplay || `+${phoneDigits}`;
    });
  }

  const rangePill = document.querySelector('.private-pill');
  if (rangePill && Number.isFinite(Number(site.serviceAreaKm))) {
    const dot = document.createElement('i');
    rangePill.replaceChildren(dot, document.createTextNode(` Мелеуз · выезд до ${site.serviceAreaKm} км`));
  }

  setText('.hero .eyebrow', site.heroEyebrow);
  setText('.hero h1 span', site.heroTitleMain);
  setText('.hero h1 em', site.heroTitleAccent);
  setText('.hero > p', site.heroText);

  const heroPoints = document.querySelectorAll('.hero-points > span');
  if (heroPoints[0] && site.warrantyYears) setBoldLine(heroPoints[0], `${site.warrantyYears} ${yearWord(site.warrantyYears)}`, 'гарантии на конструкцию');
  if (heroPoints[1] && site.productionDays) setBoldLine(heroPoints[1], `до ${site.productionDays} раб. дней`, 'срок изготовления');

  const productionText = document.querySelector('.package-grid article[data-package="production"] p');
  if (productionText && site.productionDays) productionText.textContent = `По размерам вашего проёма, до ${site.productionDays} рабочих дней.`;

  const trustCopy = document.querySelector('.trust-copy > p');
  if (trustCopy && site.trustText) trustCopy.textContent = `${site.trustText} Гарантия на конструкцию — ${site.warrantyYears} ${yearWord(site.warrantyYears)}.`;
  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');
  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;
  const catalogWarranty = document.getElementById('catalogWarranty');
  if (catalogWarranty && site.warrantyYears) catalogWarranty.textContent = `Гарантия ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;

  setText('.final-cta h2', site.finalCtaTitle);
  setText('.final-cta p', site.finalCtaText);

  const footer = document.querySelector('footer');
  if (footer && site.businessHours) {
    let hours = footer.querySelector('[data-runtime-hours]');
    if (!hours) {
      hours = document.createElement('span');
      hours.dataset.runtimeHours = 'true';
      const phoneLink = footer.querySelector('a[href^="tel:"]');
      if (phoneLink) footer.insertBefore(hours, phoneLink);
      else footer.append(hours);
    }
    hours.textContent = site.businessHours;
  }

  const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value)) || 0) + ' ₽';
  const productIdForArticle = article => `catalog-${String(article || '').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;

  const installConversionEnhancements = () => {
    const mobileConversionMedia = window.matchMedia('(max-width: 620px)');
    const catalog = document.getElementById('catalog');
    const catalogGrid = document.getElementById('catalogGrid');

    const setIfDifferent = (element, value) => {
      if (element && element.textContent !== value) element.textContent = value;
    };

    const syncPriceCopy = root => {
      const scope = root?.querySelectorAll ? root : document;
      scope.querySelectorAll?.('.product-card .price-stack').forEach(stack => {
        const rows = stack.querySelectorAll('.price-row');
        setIfDifferent(rows[0]?.querySelector('small'), 'На ваши подходящие столбы — ворота + калитка + установка');
        setIfDifferent(rows[1]?.querySelector('small'), 'С новыми усиленными столбами — всё под ключ');
      });
      const heroRows = document.querySelectorAll('.hero-prices > div');
      setIfDifferent(heroRows[0]?.querySelector('small'), 'На ваши подходящие столбы');
      setIfDifferent(heroRows[0]?.querySelector('span'), 'ворота + калитка + установка · без доставки');
      setIfDifferent(heroRows[1]?.querySelector('small'), 'С новыми усиленными столбами');
      setIfDifferent(heroRows[1]?.querySelector('span'), 'ворота + калитка + установка + столбы · без доставки');
    };

    syncPriceCopy(document);
    if (catalogGrid) {
      new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType === 1) syncPriceCopy(node);
        }));
      }).observe(catalogGrid,{childList:true,subtree:true});
    }

    const heroText = document.querySelector('.hero > p');
    if (heroText && !heroText.querySelector('[data-conversion-hero-note]')) {
      const note = document.createElement('span');
      note.dataset.conversionHeroNote = 'true';
      note.textContent = '38 дизайнов · расчёт без регистрации и телефона · любой цвет профнастила.';
      note.style.cssText = 'display:block;margin-top:8px;color:rgba(255,255,255,.86);font-weight:800;font-size:12px;line-height:1.45';
      heroText.append(note);
    }

    const packageGrid = document.querySelector('.package-grid');
    if (packageGrid && !document.querySelector('[data-package-toggle]')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.dataset.packageToggle = 'true';
      toggle.textContent = 'Показать всё, что входит';
      toggle.setAttribute('aria-expanded','false');
      toggle.style.cssText = 'display:none;width:100%;min-height:44px;margin:10px 0 0;padding:10px 14px;border:1px solid rgba(17,18,20,.14);border-radius:11px;background:#fff;color:#4c463f;font:800 11px/1.2 Manrope,Arial,sans-serif;cursor:pointer';
      packageGrid.after(toggle);
      let expanded = false;
      const primaryIndexes = new Set([0,1,4,6]);
      const syncPackage = () => {
        const mobile = mobileConversionMedia.matches;
        const articles = [...packageGrid.querySelectorAll('article')];
        if (!mobile) {
          articles.forEach(article => article.style.removeProperty('display'));
          toggle.style.display = 'none';
          return;
        }
        toggle.style.display = 'block';
        articles.forEach((article,index) => {
          const show = expanded || primaryIndexes.has(index);
          article.style.setProperty('display', show ? 'grid' : 'none', 'important');
        });
        toggle.textContent = expanded ? 'Скрыть подробности' : 'Показать всё, что входит';
        toggle.setAttribute('aria-expanded', String(expanded));
      };
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        syncPackage();
        try { window.ym?.(107269914,'reachGoal','package_details_toggle',{open:expanded?1:0}); } catch {}
      });
      mobileConversionMedia.addEventListener('change',syncPackage);
      syncPackage();
    }

    const workGallery = document.querySelector('.work-gallery');
    if (workGallery && !workGallery.querySelector('[data-real-work-proof]')) {
      const proof = document.createElement('div');
      proof.dataset.realWorkProof = 'true';
      proof.textContent = 'На фото — реальные выполненные работы: Арт.6, Арт.28 и Арт.35.';
      proof.style.cssText = 'grid-column:1/-1;margin-top:2px;padding:10px 12px;border-radius:11px;background:#f4f0e8;color:#625a50;font-size:11px;line-height:1.45;font-weight:700;text-align:center';
      workGallery.append(proof);
    }

    const trust = document.querySelector('.trust');
    const faq = document.querySelector('.faq');
    if (trust && faq && !document.querySelector('[data-order-process]')) {
      const days = Number(site.productionDays) || 30;
      const process = document.createElement('section');
      process.className = 'section-shell';
      process.dataset.orderProcess = 'true';
      process.style.cssText = 'padding-top:56px;padding-bottom:56px';
      process.innerHTML = `
        <div class="section-head">
          <div><span class="section-number">04</span><h2>Как проходит заказ</h2></div>
          <p>Вы заранее понимаете порядок работ и оплаты. На сайте ничего оплачивать не нужно.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
          <article style="padding:17px;border:1px solid rgba(17,18,20,.09);border-radius:15px;background:#fff"><span style="display:block;margin-bottom:8px;color:#a8792e;font-size:10px;font-weight:900">01</span><b style="display:block;margin-bottom:6px;font:18px/1.25 Prata,serif">Выбираете дизайн</b><p style="margin:0;color:#716a61;font-size:11px;line-height:1.5">Смотрите реальные цены и получаете предварительный расчёт по своим размерам.</p></article>
          <article style="padding:17px;border:1px solid rgba(17,18,20,.09);border-radius:15px;background:#fff"><span style="display:block;margin-bottom:8px;color:#a8792e;font-size:10px;font-weight:900">02</span><b style="display:block;margin-bottom:6px;font:18px/1.25 Prata,serif">Бесплатный замер</b><p style="margin:0;color:#716a61;font-size:11px;line-height:1.5">Мастер проверяет проём, размеры и состояние столбов перед изготовлением.</p></article>
          <article style="padding:17px;border:1px solid rgba(200,152,60,.28);border-radius:15px;background:#fbf6eb"><span style="display:block;margin-bottom:8px;color:#a8792e;font-size:10px;font-weight:900">03</span><b style="display:block;margin-bottom:6px;font:18px/1.25 Prata,serif">Договор и 50%</b><p style="margin:0;color:#716a61;font-size:11px;line-height:1.5">Согласованную стоимость фиксируем в договоре. При заключении договора — 50% оплаты.</p></article>
          <article style="padding:17px;border:1px solid rgba(17,18,20,.09);border-radius:15px;background:#fff"><span style="display:block;margin-bottom:8px;color:#a8792e;font-size:10px;font-weight:900">04</span><b style="display:block;margin-bottom:6px;font:18px/1.25 Prata,serif">Изготавливаем</b><p style="margin:0;color:#716a61;font-size:11px;line-height:1.5">Изготавливаем ворота по согласованным размерам. Срок — до ${days} рабочих дней.</p></article>
          <article style="padding:17px;border:1px solid rgba(17,18,20,.09);border-radius:15px;background:#fff"><span style="display:block;margin-bottom:8px;color:#a8792e;font-size:10px;font-weight:900">05</span><b style="display:block;margin-bottom:6px;font:18px/1.25 Prata,serif">Монтаж и оставшиеся 50%</b><p style="margin:0;color:#716a61;font-size:11px;line-height:1.5">Устанавливаем ворота. Оставшиеся 50% оплачиваются после установки.</p></article>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:18px"><a class="button button-primary" href="#catalog" data-order-process-cta>Выбрать ворота и рассчитать</a><span style="color:#746d63;font-size:11px;line-height:1.45;font-weight:700">Без регистрации · без оплаты на сайте · бесплатный замер</span></div>`;
      faq.before(process);
      process.querySelector('[data-order-process-cta]')?.addEventListener('click', () => {
        try { window.ym?.(107269914,'reachGoal','order_process_cta'); } catch {}
      });
    }

    const estimateCard = document.querySelector('.estimate-card');
    const consent = estimateCard?.querySelector('.consent-row');
    if (estimateCard && consent && !estimateCard.querySelector('[data-payment-assurance]')) {
      const assurance = document.createElement('div');
      assurance.dataset.paymentAssurance = 'true';
      assurance.innerHTML = '<b>Сейчас оплачивать ничего не нужно.</b><span>50% — при заключении договора, оставшиеся 50% — после установки.</span>';
      assurance.style.cssText = 'display:grid;gap:3px;margin:2px 0 11px;padding:10px 11px;border:1px solid rgba(230,189,105,.26);border-radius:10px;background:rgba(200,152,60,.07);font-size:10px;line-height:1.45';
      assurance.querySelector('b').style.cssText = 'color:inherit;font-size:11px';
      assurance.querySelector('span').style.cssText = 'color:inherit;opacity:.74';
      consent.before(assurance);
    }

    const finalCtaCopy = document.querySelector('.final-cta > div:first-child');
    if (finalCtaCopy && !finalCtaCopy.querySelector('[data-final-assurance]')) {
      const assurance = document.createElement('div');
      assurance.dataset.finalAssurance = 'true';
      assurance.textContent = 'Сейчас ничего оплачивать не нужно. 50% — после замера при заключении договора, оставшиеся 50% — после установки.';
      assurance.style.cssText = 'margin-top:12px;padding:10px 12px;border:1px solid rgba(230,189,105,.24);border-radius:10px;color:rgba(255,255,255,.78);font-size:11px;line-height:1.5;font-weight:700';
      finalCtaCopy.append(assurance);
    }
  };

  installConversionEnhancements();

  async function syncExcelDerivedGatePrices() {
    if (!window.GATE_CALC?.ready || !window.GATE_PAGE_API?.productById) return;
    try {
      await window.GATE_CALC.ready;
      const visibleProducts = [];
      for (const item of window.PRICE_DATA?.catalog || []) {
        const standard = window.GATE_CALC.standardForArticle?.(item.art);
        if (!standard) continue;
        const product = window.GATE_PAGE_API.productById(productIdForArticle(item.art));
        if (!product) continue;
        product.price = Number(standard.price) || 0;
        product.standard = [standard.gateWidth, standard.gateHeight];
        product.wicketWidth = standard.wicketWidth;
        product.wicketHeight = standard.wicketHeight;
        if (item.visible !== false) visibleProducts.push(product);
      }

      document.querySelectorAll('.product-card[data-card-product]').forEach(card => {
        const product = window.GATE_PAGE_API.productById(card.dataset.cardProduct);
        if (!product) return;
        const prices = card.querySelectorAll('.price-row strong');
        if (prices[0]) prices[0].textContent = money(product.price + product.install);
        if (prices[1]) prices[1].textContent = money(product.price + product.install + product.posts);
      });

      if (visibleProducts.length) {
        const cheapest = visibleProducts.reduce((best, product) => product.price < best.price ? product : best, visibleProducts[0]);
        const heroInstalled = document.getElementById('heroInstalledPrice');
        const heroTurnkey = document.getElementById('heroTurnkeyPrice');
        if (heroInstalled) heroInstalled.textContent = `от ${money(cheapest.price + cheapest.install)}`;
        if (heroTurnkey) heroTurnkey.textContent = `от ${money(cheapest.price + cheapest.install + cheapest.posts)}`;
      }
    } catch (error) {
      console.error('Excel-derived catalog price sync failed', error);
    }
  }

  syncExcelDerivedGatePrices();

  if (window.matchMedia('(max-width: 620px)').matches) {
    const packageSection = document.querySelector('.package');
    const trustSection = document.querySelector('.trust');
    if (packageSection) packageSection.style.paddingBottom = '20px';
    if (trustSection) trustSection.style.paddingTop = '34px';
  }
})();
(() => {
  const mobile = window.matchMedia('(max-width: 620px)');
  const desktopHero = window.matchMedia('(min-width: 621px)');
  const heroImage = document.getElementById('heroDesktopImage');
  const trackGoal = (name, params = {}) => { try { if (typeof window.ym === 'function') window.ym(107269914, 'reachGoal', name, params); } catch {} };
  const PROFILE_COLORS = [
    {id:'chocolate',label:'Шоколад',short:'Шоколад',ral:'RAL 8017',hex:'#4a2f29'},
    {id:'graphite',label:'Графит',short:'Графит',ral:'RAL 7024',hex:'#45494e'},
    {id:'moss',label:'Зелёный мох',short:'Мох',ral:'RAL 6005',hex:'#174533'},
    {id:'mint',label:'Зелёная мята',short:'Мята',ral:'RAL 6029',hex:'#008754'},
    {id:'wine',label:'Винно-красный',short:'Винный',ral:'RAL 3005',hex:'#5e2028'}
  ];

  const colorBadgeStyle = document.createElement('style');
  colorBadgeStyle.textContent = `
    .color-profile-badge{position:absolute;left:12px;top:12px;z-index:7;display:flex;align-items:center;gap:8px;width:180px;min-height:52px;padding:6px 10px 6px 8px;box-sizing:border-box;pointer-events:none;background:linear-gradient(180deg,#161616 0%,#050505 100%);border:2px solid #d2a143;box-shadow:inset 0 0 0 1px #6f4a13,0 5px 16px rgba(0,0,0,.24);clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px);opacity:0;visibility:hidden;transform:translateY(-3px);transition:opacity .18s ease,transform .18s ease,visibility .18s ease}
    .product-visual[data-image-index="0"] .color-profile-badge{opacity:1;visibility:visible;transform:none}
    .color-fan{position:relative;flex:0 0 42px;width:42px;height:38px}
    .color-fan i{position:absolute;left:17px;bottom:3px;width:9px;height:32px;border-radius:4px 4px 2px 2px;transform-origin:50% 100%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),0 1px 2px rgba(0,0,0,.25)}
    .color-fan i:nth-child(1){background:#d92d1f;transform:rotate(-34deg)}
    .color-fan i:nth-child(2){background:#f39a22;transform:rotate(-22deg)}
    .color-fan i:nth-child(3){background:#f0d329;transform:rotate(-10deg)}
    .color-fan i:nth-child(4){background:#2fa64a;transform:rotate(2deg)}
    .color-fan i:nth-child(5){background:#1794b8;transform:rotate(14deg)}
    .color-fan i:nth-child(6){background:#2866c2;transform:rotate(26deg)}
    .color-fan i:nth-child(7){background:#8c3bc2;transform:rotate(38deg)}
    .color-copy{display:grid;gap:0;min-width:0;line-height:1.03;text-align:left}
    .color-copy strong{color:#e1ae4c;font-size:13px;font-weight:900;letter-spacing:-.15px;white-space:nowrap}
    .color-copy span{margin-top:2px;color:#fff;font-size:12px;font-weight:700;white-space:nowrap}
    .product-meta{display:none!important}
    .mobile-price-breakdown>summary{cursor:default!important}
    .mobile-payment-note{margin:10px 0 0;padding:10px 11px;border:1px solid rgba(230,189,105,.22);border-radius:10px;background:rgba(200,152,60,.07);color:rgba(255,255,255,.68);font-size:10px;line-height:1.5}
    .mobile-payment-note strong{display:block;margin-bottom:2px;color:#fff;font-size:11px}
    .choice.is-selected{border-color:rgba(230,189,105,.5)!important;background:rgba(200,152,60,.09)!important;box-shadow:inset 0 0 0 1px rgba(230,189,105,.08)}
    .choice.is-selected input{accent-color:#d2a143}
    .profile-color-picker{padding:10px 12px 9px;border-top:1px solid rgba(17,18,20,.08);background:#fff;color:#171717}
    .profile-color-picker-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
    .profile-color-picker-head strong{font-size:11px;line-height:1.2;font-weight:900}
    .profile-color-status{min-width:0;color:#8d6b2d;font-size:9px;line-height:1.25;font-weight:800;text-align:right}
    .profile-color-swatches{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;align-items:start}
    .profile-color-option{display:grid;justify-items:center;gap:4px;min-width:0;padding:0;border:0;background:transparent;color:#706a62;font:700 8px/1.1 Manrope,Arial,sans-serif;cursor:pointer}
    .profile-color-dot{position:relative;display:block;width:31px;height:31px;border-radius:50%;background:var(--swatch);border:2px solid #fff;box-shadow:0 0 0 1px rgba(17,18,20,.18),0 2px 6px rgba(0,0,0,.12);transition:transform .15s ease,box-shadow .15s ease}
    .profile-color-option[aria-pressed="true"]{color:#171717}
    .profile-color-option[aria-pressed="true"] .profile-color-dot{transform:scale(1.08);box-shadow:0 0 0 2px #c7973c,0 3px 8px rgba(0,0,0,.16)}
    .profile-color-option.is-more .profile-color-dot{background:conic-gradient(#d92d1f,#f39a22,#f0d329,#2fa64a,#1794b8,#2866c2,#8c3bc2,#d92d1f)}
    .profile-color-option.is-more .profile-color-dot::after{content:"+";position:absolute;inset:5px;display:grid;place-items:center;border-radius:50%;background:rgba(0,0,0,.72);color:#fff;font-size:17px;font-weight:900}
    .profile-color-note{margin:7px 0 0;color:#8a8379;font-size:8.5px;line-height:1.35}
    @media(max-width:620px){.color-profile-badge{left:9px;top:9px;width:166px;min-height:48px;padding:5px 8px 5px 6px;gap:6px}.color-fan{flex-basis:38px;width:38px;height:34px}.color-fan i{left:15px;width:8px;height:29px}.color-copy strong{font-size:12px}.color-copy span{font-size:11px}.profile-color-picker{padding:9px 10px 8px}.profile-color-picker-head{margin-bottom:7px}.profile-color-picker-head strong{font-size:10px}.profile-color-status{font-size:8.5px}.profile-color-swatches{gap:3px}.profile-color-dot{width:29px;height:29px}.profile-color-option{font-size:7.5px}.profile-color-note{font-size:8px}.dimension-help,.color-note,.delivery-help summary{color:rgba(255,255,255,.68)!important}body.dimension-keyboard-open .mobile-cta{display:none!important}.dimensions label{scroll-margin-top:14px;scroll-margin-bottom:28px}}
    @media(max-width:390px){.color-profile-badge{width:150px;min-height:44px}.color-fan{flex-basis:33px;width:33px;height:31px}.color-fan i{left:13px;width:7px;height:26px}.color-copy strong{font-size:11px}.color-copy span{font-size:10px}.profile-color-dot{width:27px;height:27px}.profile-color-option{font-size:7px}}
  `;
  document.head.append(colorBadgeStyle);

  const installColorBadges = () => {
    document.querySelectorAll('.product-visual').forEach(visual => {
      if (visual.querySelector('.color-profile-badge')) return;
      const badge = document.createElement('div');
      badge.className = 'color-profile-badge';
      badge.setAttribute('aria-hidden','true');
      badge.innerHTML = '<span class="color-fan"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="color-copy"><strong>Любой цвет</strong><span>профнастила</span></span>';
      visual.append(badge);
    });
  };

  const installColorPickers = () => {
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.profile-color-picker')) return;
      const visual = card.querySelector('.product-visual');
      if (!visual) return;
      const picker = document.createElement('div');
      picker.className = 'profile-color-picker';
      picker.innerHTML = `<div class="profile-color-picker-head"><strong>Посмотрите цвет на реальном фото</strong><span class="profile-color-status" aria-live="polite">Загрузка цветов…</span></div><div class="profile-color-swatches">${PROFILE_COLORS.map(color => `<button class="profile-color-option" type="button" data-profile-color="${color.id}" aria-pressed="false" aria-label="Показать реальное фото: ${color.label}, ${color.ral}" title="${color.label} · ${color.ral}"><span class="profile-color-dot" style="--swatch:${color.hex}"></span><span>${color.short}</span></button>`).join('')}<button class="profile-color-option is-more" type="button" data-profile-color="other" aria-pressed="false" aria-label="Другие цвета профнастила"><span class="profile-color-dot"></span><span>Другой</span></button></div><p class="profile-color-note"><b>Показаны популярные цвета.</b> Доступны и другие варианты; цвет не влияет на предварительную стоимость.</p>`;
      const anchor = card.querySelector('.card-thumbnails') || visual;
      anchor.after(picker);
    });
  };

  let mobilePriceBreakdown = document.querySelector('.mobile-price-breakdown');
  if (mobilePriceBreakdown?.tagName === 'DETAILS') {
    const staticBreakdown = document.createElement('div');
    staticBreakdown.className = mobilePriceBreakdown.className;
    while (mobilePriceBreakdown.firstChild) staticBreakdown.append(mobilePriceBreakdown.firstChild);
    mobilePriceBreakdown.replaceWith(staticBreakdown);
    mobilePriceBreakdown = staticBreakdown;
  }
  const mobilePriceSummary = mobilePriceBreakdown?.querySelector('summary');
  const mobilePriceHint = mobilePriceSummary?.querySelector('small');
  if (mobilePriceSummary) {
    mobilePriceSummary.setAttribute('aria-disabled','true');
    mobilePriceSummary.removeAttribute('tabindex');
  }
  if (mobilePriceHint) mobilePriceHint.textContent = 'Состав предварительной стоимости';
  const mobilePriceBody = mobilePriceBreakdown?.querySelector('.mobile-price-breakdown-body');
  if (mobilePriceBody && !mobilePriceBody.querySelector('.mobile-payment-note')) {
    const paymentNote = document.createElement('div');
    paymentNote.className = 'mobile-payment-note';
    paymentNote.innerHTML = '<strong>Сейчас оплачивать ничего не нужно.</strong>Оплата — 50% при заключении договора, оставшиеся 50% после установки.';
    mobilePriceBody.append(paymentNote);
  }

  const syncHeroImage = () => {
    if (!heroImage) return;
    if (desktopHero.matches && !heroImage.hasAttribute('src')) {
      heroImage.loading = 'eager';
      heroImage.fetchPriority = 'high';
      heroImage.src = heroImage.dataset.desktopSrc || '/hero-gates.jpg';
    } else if (!desktopHero.matches && heroImage.hasAttribute('src')) {
      heroImage.removeAttribute('src');
    }
  };
  syncHeroImage();
  desktopHero.addEventListener('change', syncHeroImage);
  const calculator = document.getElementById('calculator');
  const catalog = document.getElementById('catalog');
  const cta = document.getElementById('mobilePrimaryCta');
  const leadRequest = document.getElementById('leadRequest');
  const leadBackdrop = document.getElementById('leadBackdrop');
  const leadClose = document.getElementById('leadSheetClose');
  const sendButton = document.getElementById('sendButton');
  const mobilePriceTotal = document.getElementById('mobilePriceTotal');
  const mobilePriceNote = document.getElementById('mobilePriceNote');
  const estimateNote = document.getElementById('estimateNote');
  let leadOpen = false;
  let deliveryCanProceed = false;
  let deliveryKind = 'empty';
  let dimensionsValid = true;

  const dimensions = document.getElementById('gateDimensions');
  const sizeToggle = document.getElementById('sizeToggle');
  const sizeSummaryLabel = document.getElementById('sizeSummaryLabel');
  const sizeSummaryValue = document.getElementById('sizeSummaryValue');
  const widthInput = document.getElementById('widthInput');
  const wicketWidthInput = document.getElementById('wicketWidthInput');
  const heightInput = document.getElementById('heightInput');
  const wicketHeightInput = document.getElementById('wicketHeightInput');
  const sizeNotice = document.getElementById('sizeNotice');
  const postsCheck = document.getElementById('postsCheck');
  const postsChoice = postsCheck?.closest('.choice');
  const dimensionInputs = [widthInput,wicketWidthInput,heightInput,wicketHeightInput].filter(Boolean);
  let dimensionKeyboardTimer = 0;

  const ensureDimensionInputVisible = () => {
    if (!mobile.matches) return;
    const input = dimensionInputs.find(item => item === document.activeElement);
    if (!input) return;
    const viewport = window.visualViewport;
    const viewportTop = Number(viewport?.offsetTop) || 0;
    const viewportHeight = Number(viewport?.height) || window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const target = input.closest('label') || input;
    const rect = target.getBoundingClientRect();
    const minTop = viewportTop + 14;
    const maxBottom = viewportBottom - 18;
    if (rect.top >= minTop && rect.bottom <= maxBottom) return;
    const preferredTop = viewportTop + Math.max(14, Math.min(72, viewportHeight * 0.14));
    window.scrollBy({top:rect.top - preferredTop,left:0,behavior:'smooth'});
  };

  const scheduleDimensionInputVisibility = () => {
    clearTimeout(dimensionKeyboardTimer);
    requestAnimationFrame(ensureDimensionInputVisible);
    dimensionKeyboardTimer = window.setTimeout(ensureDimensionInputVisible, 140);
  };

  const setDimensionKeyboardActive = active => {
    const enabled = Boolean(active && mobile.matches);
    document.body.classList.toggle('dimension-keyboard-open', enabled);
    if (!enabled) return;
    scheduleDimensionInputVisibility();
    window.setTimeout(ensureDimensionInputVisible, 320);
  };

  dimensionInputs.forEach((input,index) => {
    input.setAttribute('enterkeyhint', index < dimensionInputs.length - 1 ? 'next' : 'done');
    input.addEventListener('focus', () => setDimensionKeyboardActive(true));
    input.addEventListener('blur', () => window.setTimeout(() => {
      if (!dimensionInputs.includes(document.activeElement)) setDimensionKeyboardActive(false);
    }, 90));
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const next = dimensionInputs[index + 1];
      if (next) {
        next.focus({preventScroll:true});
        scheduleDimensionInputVisibility();
      } else {
        input.blur();
      }
    });
  });
  window.visualViewport?.addEventListener('resize', scheduleDimensionInputVisibility, {passive:true});
  window.visualViewport?.addEventListener('scroll', scheduleDimensionInputVisibility, {passive:true});
  mobile.addEventListener('change', () => {
    if (!mobile.matches) setDimensionKeyboardActive(false);
  });

  const syncPostsChoice = () => {
    postsChoice?.classList.toggle('is-selected', Boolean(postsCheck?.checked));
  };
  postsCheck?.addEventListener('change', syncPostsChoice);

  function updateSizeSummary() {
    if (!sizeSummaryValue) return;
    const format = value => String(value || '').replace('.', ',');
    sizeSummaryLabel.textContent = sizeNotice?.hidden === false ? 'Ваш размер' : 'Стандартный размер';
    sizeSummaryValue.textContent = `Ворота ${format(widthInput?.value)} × ${format(heightInput?.value)} м · калитка ${format(wicketWidthInput?.value)} × ${format(wicketHeightInput?.value || heightInput?.value)} м`;
  }

  function syncResolvedDeliveryNote(detail = {}) {
    if (detail.deliveryPending !== false || detail.dimensionsValid === false) return;
    const state = window.GATE_PAGE_API?.deliveryState?.() || {};
    const kind = String(state.kind || '');
    if (!['fixed','calculated'].includes(kind)) return;
    const city = String(state.shortName || state.resolvedName || state.name || '').trim();
    const normalized = city.toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
    const deliveryText = normalized === 'мелеуз'
      ? 'Доставка по Мелеузу — бесплатно.'
      : city
        ? `Доставка до ${city} учтена в стоимости.`
        : 'Доставка учтена в стоимости.';
    const finalText = detail.nonStandard
      ? `${deliveryText} Итоговую цену по вашим размерам зафиксируем после бесплатного замера.`
      : `${deliveryText} Окончательная стоимость фиксируется в договоре после бесплатного замера.`;
    if (estimateNote) estimateNote.textContent = finalText;
    if (mobilePriceNote) mobilePriceNote.textContent = finalText;
  }

  sizeToggle?.addEventListener('click', () => {
    const open = dimensions?.classList.toggle('is-open');
    sizeToggle.textContent = open ? 'Скрыть' : 'Изменить';
    sizeToggle.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) { trackGoal('gate_size_edit_open'); setTimeout(() => widthInput?.focus({preventScroll:true}), 40); }
  });
  [widthInput,wicketWidthInput,heightInput,wicketHeightInput].filter(Boolean).forEach(input => {
    input.addEventListener('input', () => setTimeout(updateSizeSummary,0));
    input.addEventListener('change', () => setTimeout(updateSizeSummary,0));
  });

  document.getElementById('changeProductButton')?.addEventListener('click', () => {
    window.GATE_PAGE_API?.closeCalculator?.();
    const active = window.GATE_PAGE_API?.selectedProduct?.();
    const card = active ? document.querySelector(`[data-card-product="${CSS.escape(active.id)}"]`) : null;
    (card || catalog)?.scrollIntoView({behavior:'smooth', block:card?'center':'start'});
  });

  const commentToggle = document.getElementById('commentToggle');
  const commentLabel = document.getElementById('commentLabel');
  commentToggle?.addEventListener('click', () => {
    const open = commentLabel?.classList.toggle('is-open');
    commentToggle.classList.toggle('is-open', Boolean(open));
    commentToggle.textContent = open ? 'Скрыть комментарий' : 'Добавить комментарий';
    if (open) setTimeout(() => commentLabel?.querySelector('textarea')?.focus({preventScroll:true}), 40);
  });

  function syncMobileCta() {
    if (!cta) return;
    const price = mobilePriceTotal?.textContent?.trim() || '';
    if (!calculator || calculator.hidden) cta.textContent = 'Выбрать ворота';
    else if (leadOpen) cta.textContent = `Отправить заявку${price ? ` · ${price}` : ''}`;
    else if (!dimensionsValid) cta.textContent = `Проверьте размеры${price ? ` · ${price}` : ''}`;
    else if (!deliveryCanProceed) cta.textContent = `Указать место установки${price ? ` · ${price}` : ''}`;
    else cta.textContent = `Заказать бесплатный замер${price ? ` · расчёт ${price}` : ''}`;
  }

  function openLead() {
    if (!mobile.matches || leadOpen) return;
    leadOpen = true;
    trackGoal('lead_form_open');
    document.body.classList.add('mobile-lead-open');
    leadBackdrop?.removeAttribute('hidden');
    syncMobileCta();
  }

  function closeLead() {
    if (!leadOpen) return;
    leadOpen = false;
    document.body.classList.remove('mobile-lead-open');
    leadBackdrop?.setAttribute('hidden','');
    document.activeElement?.blur?.();
    syncMobileCta();
  }

  leadBackdrop?.addEventListener('click', closeLead);
  leadClose?.addEventListener('click', closeLead);

  cta?.addEventListener('click', event => {
    if (!mobile.matches) return;
    event.preventDefault();
    if (!calculator || calculator.hidden) {
      catalog?.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    if (!dimensionsValid) {
      dimensions?.classList.add('is-open');
      if(sizeToggle){sizeToggle.textContent='Скрыть';sizeToggle.setAttribute('aria-expanded','true');}
      dimensions?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>widthInput?.focus({preventScroll:true}),260);
      return;
    }
    if (!deliveryCanProceed) {
      document.getElementById('deliveryChooser')?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if (!leadOpen) openLead();
    else sendButton?.click();
  });

  const policyBackdrop = document.getElementById('policyBackdrop');
  const policyModal = document.getElementById('policyModal');
  const openPolicy = () => {
    const policyBody = policyModal?.querySelector('.policy-body');
    const policySource = document.querySelector('#privacyPolicy .privacy-content');
    if (policyBody && policySource && !policyBody.dataset.synced) {
      policyBody.innerHTML = policySource.innerHTML;
      policyBody.dataset.synced = '1';
    }
    policyBackdrop?.removeAttribute('hidden');
    policyModal?.removeAttribute('hidden');
    document.body.classList.add('modal-open');
  };
  const closePolicy = () => {
    policyBackdrop?.setAttribute('hidden','');
    policyModal?.setAttribute('hidden','');
    document.body.classList.remove('modal-open');
  };
  document.querySelectorAll('a[href="#privacyPolicy"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    openPolicy();
  }));
  policyBackdrop?.addEventListener('click', closePolicy);
  document.getElementById('policyClose')?.addEventListener('click', closePolicy);
  document.getElementById('policyContinue')?.addEventListener('click', closePolicy);

  const successBackdrop = document.getElementById('successBackdrop');
  const successModal = document.getElementById('successModal');
  const successWhatsApp = document.getElementById('successWhatsApp');
  const closeSuccess = () => {
    successBackdrop?.setAttribute('hidden','');
    successModal?.setAttribute('hidden','');
    document.body.classList.remove('modal-open');
  };
  const openSuccess = payload => {
    closeLead();
    const digits = String((window.SITE_SETTINGS || {}).whatsappDigits || '79373296750').replace(/\D/g,'');
    if (successWhatsApp) successWhatsApp.href = `https://wa.me/${digits}?text=${encodeURIComponent(payload?.message || '')}`;
    successBackdrop?.removeAttribute('hidden');
    successModal?.removeAttribute('hidden');
    document.body.classList.add('modal-open');
  };
  successBackdrop?.addEventListener('click', closeSuccess);
  document.getElementById('successClose')?.addEventListener('click', closeSuccess);
  document.getElementById('successDone')?.addEventListener('click', closeSuccess);
  successWhatsApp?.addEventListener('click', () => {
    if (window.ym) ym(107269914,'reachGoal','whatsapp_after_lead');
  });
  document.addEventListener('lead-sent', event => openSuccess(event.detail?.payload));

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!policyModal?.hasAttribute('hidden')) closePolicy();
    else if (!successModal?.hasAttribute('hidden')) closeSuccess();
    else closeLead();
  });

  const installDesktopThumbnails = () => {
    if (mobile.matches) {
      document.querySelectorAll('.card-thumbnails').forEach(node => node.remove());
      return;
    }
    const api = window.GATE_PAGE_API;
    if (!api) return;
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.card-thumbnails')) return;
      const product = api.productById?.(card.dataset.cardProduct);
      if (!product?.gallery || product.gallery.length < 2) return;
      const visual = card.querySelector('[data-gallery-card]');
      const strip = document.createElement('div');
      strip.className = 'card-thumbnails';
      product.gallery.forEach((url,index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card-thumb';
        button.setAttribute('aria-label', `Показать фото ${index+1}`);
        button.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
        button.addEventListener('click', event => {
          event.stopPropagation();
          api.showCardImage?.(visual,index);
        });
        strip.append(button);
      });
      visual.after(strip);
    });
  };

  const grid = document.getElementById('catalogGrid');
  const syncCatalogEnhancements = () => {
    installColorBadges();
    installDesktopThumbnails();
    installColorPickers();
  };
  if (grid) new MutationObserver(() => queueMicrotask(syncCatalogEnhancements)).observe(grid,{childList:true});
  mobile.addEventListener('change', syncCatalogEnhancements);
  document.addEventListener('gate:calculated', event => {
    deliveryKind = event.detail?.deliveryKind || 'empty';
    deliveryCanProceed = event.detail?.deliveryPending === false || ['out-of-area','error'].includes(deliveryKind);
    dimensionsValid = event.detail?.dimensionsValid !== false;
    updateSizeSummary();
    syncPostsChoice();
    syncResolvedDeliveryNote(event.detail || {});
    syncMobileCta();
  });
  if (calculator) new MutationObserver(() => { if (calculator.hidden) closeLead(); syncMobileCta(); }).observe(calculator,{attributes:true,attributeFilter:['hidden']});

  updateSizeSummary();
  syncPostsChoice();
  syncMobileCta();
  queueMicrotask(syncCatalogEnhancements);
})();
(() => {
  const STORAGE_KEY = 'kuzdvor:favorites';
  const priceData = window.PRICE_DATA;
  const imageData = window.CATALOG_IMAGES || {};
  const grid = document.getElementById('catalogGrid');
  const catalog = document.getElementById('catalog');
  const catalogSummary = catalog?.querySelector('.catalog-summary');
  if (!priceData?.catalog || !grid || !catalogSummary) return;

  const roundMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
  const money = value => `${new Intl.NumberFormat('ru-RU').format(roundMoney100(value))} ₽`;
  const normalizeId = art => `catalog-${String(art || '').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;
  const safeJson = value => { try { return JSON.parse(value || 'null'); } catch { return null; } };
  const track = (name, params = {}) => { try { window.ym?.(107269914,'reachGoal',name,params); } catch {} };

  const products = priceData.catalog
    .filter(item => item.visible !== false)
    .map(item => {
      const art = String(item.art || '').trim();
      const gallery = Array.isArray(imageData[art]) && imageData[art].length ? imageData[art] : ['/hero-gates.jpg'];
      return {
        id: normalizeId(art),
        art,
        base: Number(item.price) || 0,
        install: Number(priceData.catalogInstallation) || 0,
        posts: Number(priceData.catalogPosts) || 0,
        image: gallery[0] || '/hero-gates.jpg'
      };
    });
  const byId = new Map(products.map(product => [product.id, product]));

  const storedFavorites = (() => {
    try { return safeJson(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  })();
  let favorites = new Set(storedFavorites.filter(id => byId.has(id)));
  let modalOpen = false;
  let mutationFrame = 0;
  let toastTimer = 0;

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites])); } catch {}
  };

  const deliveryContext = () => {
    const state = window.GATE_PAGE_API?.deliveryState?.() || {kind:'empty',price:0};
    const kind = String(state.kind || 'empty');
    const city = String(state.shortName || state.resolvedName || state.name || window.KUZDVOR_CUSTOMER?.read?.().city || '').trim();
    return {
      kind,
      city,
      price:['fixed','calculated'].includes(kind) ? Number(state.price) || 0 : 0,
      resolved:['fixed','calculated'].includes(kind),
      manual:kind === 'out-of-area'
    };
  };

  const style = document.createElement('style');
  style.id = 'gateFavoritesStyles';
  style.textContent = `
    .catalog-summary{display:flex!important;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.catalog-summary[hidden]{display:none!important}
    .favorites-open-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:6px 9px;border:1px solid rgba(17,18,20,.12);border-radius:9px;background:transparent;color:#625a50;font:800 9.5px/1.2 Manrope,Arial,sans-serif;cursor:pointer;box-shadow:none}.favorites-open-button[hidden]{display:none!important}
    .favorites-open-button .favorites-heart{font-size:17px;line-height:1;color:#a87723}.favorites-open-button.has-favorites{border-color:rgba(210,161,67,.5);background:#fffaf0}.favorites-count{display:grid;min-width:20px;height:20px;padding:0 5px;place-items:center;border-radius:999px;background:#171819;color:#e6bd69;font-size:9px;font-weight:900}
    .favorite-toggle{position:absolute;z-index:12;right:10px;top:10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:7px 9px;border:1px solid rgba(17,18,20,.14);border-radius:999px;background:rgba(255,255,255,.93);color:#4b463f;font:800 9px/1 Manrope,Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.14);cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .favorite-toggle .heart{font-size:16px;line-height:1;color:#9b7a42}.favorite-toggle[aria-pressed="true"]{border-color:#d2a143;background:#171819;color:#fff}.favorite-toggle[aria-pressed="true"] .heart{color:#e6bd69}
    .favorites-floating{position:fixed;z-index:260;right:14px;bottom:18px;display:flex;align-items:center;gap:7px;min-height:44px;padding:9px 13px;border:1px solid rgba(230,189,105,.55);border-radius:999px;background:#171819;color:#fff;font:900 11px/1.2 Manrope,Arial,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.25);cursor:pointer}.favorites-floating[hidden]{display:none!important}.favorites-floating b{display:grid;min-width:21px;height:21px;padding:0 5px;place-items:center;border-radius:999px;background:#d2a143;color:#17130d;font-size:9px}
    .favorites-backdrop{position:fixed;inset:0;z-index:12500;background:rgba(4,5,7,.68);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.favorites-backdrop[hidden],.favorites-modal[hidden]{display:none!important}
    .favorites-modal{position:fixed;z-index:12501;left:50%;top:50%;width:min(980px,calc(100vw - 30px));max-height:min(86dvh,820px);box-sizing:border-box;transform:translate(-50%,-50%);display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(230,189,105,.34);border-radius:22px;background:#f6f2e9;color:#171717;box-shadow:0 28px 90px rgba(0,0,0,.5);font-family:Manrope,Arial,sans-serif}
    .favorites-modal-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:20px 22px 15px;border-bottom:1px solid rgba(17,18,20,.1);background:#fff}.favorites-modal-head h2{margin:0;font:27px/1.15 Prata,serif}.favorites-modal-head p{grid-column:1;margin:5px 0 0;color:#766f65;font-size:11px;line-height:1.45}.favorites-modal-close{grid-column:2;grid-row:1/3;align-self:start;width:38px;height:38px;border:0;border-radius:50%;background:#171819;color:#fff;font-size:22px;line-height:1;cursor:pointer}
    .favorites-content{min-height:0;overflow:auto;padding:18px 20px 22px}.favorites-location{display:flex;align-items:center;gap:7px;margin:0 0 13px;color:#746c62;font-size:10px;font-weight:700}.favorites-location strong{color:#2e2a25}.favorites-empty{display:grid;justify-items:center;gap:8px;padding:42px 18px;text-align:center}.favorites-empty span{font-size:34px;color:#bc8d3c}.favorites-empty strong{font:20px/1.25 Prata,serif}.favorites-empty p{max-width:420px;margin:0;color:#766f65;font-size:11px;line-height:1.5}
    .favorites-compare{display:grid;grid-template-columns:repeat(var(--favorite-count),minmax(0,1fr));gap:11px;align-items:stretch}.favorite-compare-card{position:relative;display:grid;grid-template-rows:auto auto 1fr auto;min-width:0;overflow:hidden;border:1px solid rgba(17,18,20,.11);border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(17,18,20,.05)}.favorite-compare-image{position:relative;aspect-ratio:4/3;background:#ece9e2}.favorite-compare-image img{width:100%;height:100%;display:block;object-fit:contain;background:#fff}.favorite-compare-art{position:absolute;left:9px;top:9px;padding:5px 7px;border-radius:7px;background:rgba(17,18,20,.88);color:#e6bd69;font-size:9px;font-weight:900}.favorite-remove{position:absolute;right:8px;top:8px;z-index:2;width:31px;height:31px;border:1px solid rgba(17,18,20,.12);border-radius:50%;background:rgba(255,255,255,.94);color:#6d6257;font-size:16px;cursor:pointer}.favorite-compare-title{padding:11px 12px 7px;font:17px/1.2 Prata,serif}.favorite-compare-prices{display:grid;gap:8px;padding:4px 12px 12px}.favorite-price-row{display:grid;gap:2px;padding:9px 10px;border-radius:10px;background:#f6f3ed}.favorite-price-row small{color:#746e65;font-size:9px;line-height:1.3}.favorite-price-row strong{font-size:16px;line-height:1.15;color:#171717}.favorite-price-row.turnkey{background:#171819}.favorite-price-row.turnkey small{color:rgba(255,255,255,.63)}.favorite-price-row.turnkey strong{color:#e6bd69}.favorite-delivery-note{margin:0;color:#8a8277;font-size:9px;line-height:1.4}.favorite-compare-action{margin:0 12px 12px;min-height:42px;border:0;border-radius:10px;background:#d2a143;color:#17130d;font:900 10px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
    .favorites-toast{position:fixed;z-index:12600;left:50%;bottom:22px;transform:translate(-50%,12px);max-width:min(420px,calc(100vw - 28px));padding:10px 14px;border:1px solid rgba(230,189,105,.35);border-radius:12px;background:#171819;color:#fff;font:800 11px/1.35 Manrope,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .16s,transform .16s}.favorites-toast.is-visible{opacity:1;transform:translate(-50%,0)}
    body.favorites-modal-open{overflow:hidden!important}
    @media(max-width:620px){
      .favorite-toggle{right:8px;top:8px;min-height:32px;padding:6px 8px;font-size:8px}.favorite-toggle .heart{font-size:15px}
      .favorites-open-button{min-height:36px;padding:7px 10px;font-size:10px}.favorites-open-button .favorites-heart{font-size:15px}
      .favorites-floating{right:10px;bottom:72px;min-height:42px;padding:8px 11px;font-size:10px}.dimension-keyboard-open .favorites-floating,.mobile-lead-open .favorites-floating,body.installation-location-modal-open .favorites-floating{display:none!important}
      .favorites-modal{left:0;right:0;top:auto;bottom:0;width:100%;max-height:88dvh;transform:none;border-radius:22px 22px 0 0}.favorites-modal-head{padding:17px 16px 13px}.favorites-modal-head h2{font-size:22px}.favorites-modal-head p{font-size:10.5px}.favorites-content{padding:14px 12px max(18px,env(safe-area-inset-bottom))}.favorites-compare{display:flex;gap:9px;overflow-x:auto;padding:1px 1px 8px;scroll-snap-type:x mandatory;overscroll-behavior-x:contain}.favorite-compare-card{flex:0 0 min(82vw,300px);scroll-snap-align:start}.favorite-compare-title{font-size:16px}.favorite-price-row strong{font-size:15px}
    }
  `;
  document.head.append(style);

  const toolbarButton = document.createElement('button');
  toolbarButton.type = 'button';
  toolbarButton.className = 'favorites-open-button';
  toolbarButton.setAttribute('aria-label','Открыть избранные модели и сравнить');
  toolbarButton.innerHTML = '<span class="favorites-heart">♡</span><span>Избранное</span><b class="favorites-count">0</b>';
  toolbarButton.hidden = favorites.size === 0;
  catalogSummary.hidden = favorites.size === 0;
  catalogSummary.append(toolbarButton);

  const floatingButton = document.createElement('button');
  floatingButton.type = 'button';
  floatingButton.className = 'favorites-floating';
  floatingButton.hidden = true;
  floatingButton.innerHTML = '<span>♥ Избранное</span><b>0</b>';
  document.body.append(floatingButton);

  const backdrop = document.createElement('div');
  backdrop.className = 'favorites-backdrop';
  backdrop.hidden = true;
  const modal = document.createElement('section');
  modal.className = 'favorites-modal';
  modal.hidden = true;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','favoritesModalTitle');
  modal.innerHTML = `
    <div class="favorites-modal-head">
      <div><h2 id="favoritesModalTitle">Избранное и сравнение</h2><p>Сохраните несколько моделей и сравните их фото и актуальные цены.</p></div>
      <button class="favorites-modal-close" type="button" aria-label="Закрыть">×</button>
    </div>
    <div class="favorites-content"></div>`;
  document.body.append(backdrop, modal);
  const modalContent = modal.querySelector('.favorites-content');
  const modalClose = modal.querySelector('.favorites-modal-close');

  const toast = document.createElement('div');
  toast.className = 'favorites-toast';
  toast.setAttribute('role','status');
  document.body.append(toast);

  const showToast = text => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1600);
  };

  const syncButtons = () => {
    const count = favorites.size;
    const delivery = deliveryContext();
    const catalogUnlocked = delivery.resolved || delivery.manual;
    toolbarButton.querySelector('.favorites-count').textContent = String(count);
    toolbarButton.querySelector('.favorites-heart').textContent = count ? '♥' : '♡';
    toolbarButton.classList.toggle('has-favorites', count > 0);
    toolbarButton.hidden = count === 0;
    catalogSummary.hidden = count === 0;
    floatingButton.hidden = count === 0 || modalOpen || !catalogUnlocked;
    floatingButton.querySelector('b').textContent = String(count);

    grid.querySelectorAll('.favorite-toggle').forEach(button => {
      const active = favorites.has(button.dataset.favoriteId);
      const state = active ? '1' : '0';
      if (button.dataset.favoriteState === state) return;
      button.dataset.favoriteState = state;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? 'Убрать модель из избранного' : 'Сохранить модель в избранное');
      button.title = active ? 'Убрать из избранного' : 'Сохранить';
      button.innerHTML = `<span class="heart">${active ? '♥' : '♡'}</span><span>${active ? 'Сохранено' : 'Сохранить'}</span>`;
    });
  };

  const toggleFavorite = id => {
    const product = byId.get(id);
    if (!product) return;
    if (favorites.has(id)) {
      favorites.delete(id);
      showToast(`${product.art} удалён из избранного`);
      track('favorite_remove',{article:product.art});
    } else {
      favorites.add(id);
      showToast(`${product.art} сохранён — можно сравнить`);
      track('favorite_add',{article:product.art,count:favorites.size});
    }
    save();
    syncButtons();
    if (modalOpen) renderModal();
  };

  const installFavoriteButtons = root => {
    const cards = [];
    if (root?.nodeType === 1 && root.matches?.('.product-card')) cards.push(root);
    root?.querySelectorAll?.('.product-card').forEach(card => cards.push(card));
    cards.forEach(card => {
      if (card.querySelector('.favorite-toggle')) return;
      const id = String(card.dataset.cardProduct || '').trim();
      if (!byId.has(id)) return;
      const visual = card.querySelector('.product-visual');
      if (!visual) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-toggle';
      button.dataset.favoriteId = id;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(id);
      });
      visual.append(button);
    });
    syncButtons();
  };

  const priceView = product => {
    const delivery = deliveryContext();
    const installed = product.base + product.install + delivery.price;
    const turnkey = installed + product.posts;
    let note = '';
    if (delivery.resolved) note = delivery.city ? `Цена с учётом доставки в ${delivery.city}.` : 'Доставка учтена в цене.';
    else if (delivery.manual) note = 'Доставка рассчитывается индивидуально.';
    else note = 'Место установки не выбрано.';
    return {installed,turnkey,note,delivery};
  };

  const openProduct = async id => {
    closeModal();
    let card = grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
    const showMore = document.getElementById('showMoreButton');
    for (let attempt = 0; !card && attempt < 10 && showMore && !showMore.hidden; attempt += 1) {
      showMore.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      card = grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
    }
    if (!card) {
      catalog.scrollIntoView({behavior:'smooth',block:'start'});
      showToast('Откройте эту модель в каталоге');
      return;
    }
    card.querySelector('.select-product')?.click();
    track('favorite_compare_calculate',{article:byId.get(id)?.art || id});
  };

  function renderModal() {
    const selected = [...favorites].map(id => byId.get(id)).filter(Boolean);
    const delivery = deliveryContext();
    if (!selected.length) {
      modalContent.innerHTML = '<div class="favorites-empty"><span>♡</span><strong>Пока ничего не сохранено</strong><p>Нажмите «♡ Сохранить» на понравившихся воротах. Здесь они останутся рядом для сравнения.</p></div>';
      return;
    }

    const locationText = delivery.city
      ? `Место установки: <strong>${delivery.city}</strong>`
      : '<strong>Место установки не выбрано</strong>';
    modalContent.innerHTML = `<div class="favorites-location">${locationText}</div><div class="favorites-compare" style="--favorite-count:${Math.min(selected.length,4)}">${selected.map(product => {
      const view = priceView(product);
      return `<article class="favorite-compare-card" data-favorite-card="${product.id}">
        <div class="favorite-compare-image"><img src="${product.image}" alt="Ворота с калиткой ${product.art}" loading="lazy"><span class="favorite-compare-art">${product.art}</span><button class="favorite-remove" type="button" data-favorite-remove="${product.id}" aria-label="Убрать ${product.art} из избранного">×</button></div>
        <div class="favorite-compare-title">Ворота с калиткой</div>
        <div class="favorite-compare-prices">
          <div class="favorite-price-row"><small>Если подходящие столбы уже есть</small><strong>${money(view.installed)}</strong></div>
          <div class="favorite-price-row turnkey"><small>С новыми усиленными столбами</small><strong>${money(view.turnkey)}</strong></div>
          <p class="favorite-delivery-note">${view.note}</p>
        </div>
        <button class="favorite-compare-action" type="button" data-favorite-calculate="${product.id}">Рассчитать эту модель</button>
      </article>`;
    }).join('')}</div>`;

    modalContent.querySelectorAll('[data-favorite-remove]').forEach(button => {
      button.addEventListener('click', () => toggleFavorite(button.dataset.favoriteRemove));
    });
    modalContent.querySelectorAll('[data-favorite-calculate]').forEach(button => {
      button.addEventListener('click', () => openProduct(button.dataset.favoriteCalculate));
    });
  }

  function openModal() {
    modalOpen = true;
    renderModal();
    backdrop.hidden = false;
    modal.hidden = false;
    document.body.classList.add('favorites-modal-open');
    syncButtons();
    track('favorite_open',{count:favorites.size});
    requestAnimationFrame(() => modalClose.focus({preventScroll:true}));
  }

  function closeModal() {
    modalOpen = false;
    backdrop.hidden = true;
    modal.hidden = true;
    document.body.classList.remove('favorites-modal-open');
    syncButtons();
  }

  toolbarButton.addEventListener('click', openModal);
  floatingButton.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modalOpen) closeModal();
  });
  document.addEventListener('gate:calculated', () => {
    if (modalOpen) renderModal();
  });

  installFavoriteButtons(grid);
  new MutationObserver(records => {
    if (mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = 0;
      records.forEach(record => record.addedNodes.forEach(node => installFavoriteButtons(node)));
      installFavoriteButtons(grid);
    });
  }).observe(grid,{childList:true,subtree:true});
  new MutationObserver(syncButtons).observe(catalog,{attributes:true,attributeFilter:['class']});

  document.addEventListener('gate:calculated', syncButtons);
  window.addEventListener('pageshow', syncButtons);

  window.KUZDVOR_FAVORITES = {
    open:openModal,
    count:() => favorites.size,
    ids:() => [...favorites]
  };
})();
