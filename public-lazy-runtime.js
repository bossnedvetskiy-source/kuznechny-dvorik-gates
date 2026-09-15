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
    calculatorPromise = loadScript('/calculator.bundle.js?v=delivery-20260915-4')
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
    window.toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
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

  // Once delivery is found, preview its cost directly in every visible catalog
  // card. For routed places the preview starts already on the confirmation step,
  // while the order flow still requires the customer to confirm the exact place.
  const catalogGrid = document.getElementById('catalogGrid');
  const cityInput = document.getElementById('cityInput');
  const deliverySummary = document.getElementById('deliverySummary');
  const deliverySummaryValue = document.getElementById('deliverySummaryValue');
  const deliveryResult = document.getElementById('deliveryResult');
  const routeButton = document.getElementById('routeButton');
  const deliveryChooser = document.getElementById('deliveryChooser');
  const deliveryChange = document.getElementById('deliveryChange');
  const catalogMoney = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value)) || 0) + ' ₽';
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
    let state = isDeliveryState(stateOverride) ? stateOverride : window.GATE_PAGE_API?.deliveryState?.() || null;
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

  // Single public synchronizer for any module that updates the base gate prices.
  // This prevents a later Excel/formula refresh from leaving cards without delivery.
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
    [40, 120, 300, 700, 1500].forEach(delay => setTimeout(() => scheduleCatalogDeliverySync(), delay));
  };

  // app.js emits this after every calculation, including every delivery state
  // transition. Repeat the sync briefly because lazy formula scripts can finish
  // after the first event and rewrite the same card price with a base-only value.
  document.addEventListener('gate:calculated', () => {
    const state = window.GATE_PAGE_API?.deliveryState?.() || readSavedDeliveryState();
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
      if (relevant) scheduleCatalogDeliverySync();
    }).observe(catalogGrid,{childList:true,subtree:true,characterData:true});
  }

  const deliveryUiObserver = new MutationObserver(() => scheduleCatalogDeliverySync());
  [deliverySummary,deliverySummaryValue,deliveryResult,routeButton,deliveryChooser].filter(Boolean).forEach(node => {
    deliveryUiObserver.observe(node,{attributes:true,childList:true,subtree:true,characterData:true});
  });
  cityInput?.addEventListener('input', () => scheduleCatalogDeliverySync());
  cityInput?.addEventListener('change', () => scheduleCatalogDeliverySync());
  routeButton?.addEventListener('click', () => { resyncDeliveryBurst(); });
  deliveryChooser?.addEventListener('click', () => setTimeout(() => resyncDeliveryBurst(), 0));
  deliveryChange?.addEventListener('click', () => setTimeout(() => resyncDeliveryBurst(), 0));
  window.addEventListener('pageshow', () => resyncDeliveryBurst());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resyncDeliveryBurst();
  });

  // Keep the visible catalog consistent even when another late-loading module
  // rewrites a base price after delivery has already been chosen. This also
  // repairs mobile pages restored from the browser back/forward cache.
  setInterval(() => {
    if (document.hidden) return;
    syncCatalogDeliveryPrices();
  }, 250);

  let catalogDeliveryReadyAttempts = 0;
  const waitForCatalogDeliveryApi = () => {
    if (syncCatalogDeliveryPrices()) return;
    catalogDeliveryReadyAttempts += 1;
    if (catalogDeliveryReadyAttempts < 120) setTimeout(waitForCatalogDeliveryApi, 100);
  };
  waitForCatalogDeliveryApi();

  let catalogWorkStarted = false;
  const catalogJobs = [];
  const startCatalogDeferredWork = () => {
    if (catalogWorkStarted) return;
    catalogWorkStarted = true;
    loadScript('/catalog-enhancements.bundle.js').catch(error => console.error('Catalog enhancements load failed', error));
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