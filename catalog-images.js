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

/* Storefront mobile UX polish. Kept with the tiny initial catalog payload so the
   fixes run before the optional heavy calculator bundle is requested. */
(() => {
  if (window.KUZDVOR_CATALOG_POLISH_V2) return;
  window.KUZDVOR_CATALOG_POLISH_V2 = true;

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
          #showMoreButton{min-height:44px!important}
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
