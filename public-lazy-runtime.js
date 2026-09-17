(() => {
  if (window.KUZDVOR_LAZY_RUNTIME_READY) return;
  window.KUZDVOR_LAZY_RUNTIME_READY = true;

  // The selected-model calculator is transient UI, not navigation state. Mobile
  // browsers can restore the mutated DOM on Reload/BFCache, so normalize it both
  // before app.js reads calculator.hidden and again on the real pageshow event.
  const closeTransientCalculator = ({scrollToCatalog = false} = {}) => {
    const calculator = document.getElementById('calculator');
    if (!calculator) return false;
    const wasOpen = !calculator.hidden || document.body.classList.contains('calculator-open');
    if (!wasOpen) return false;

    if (window.GATE_PAGE_API?.closeCalculator) {
      window.GATE_PAGE_API.closeCalculator();
    } else {
      calculator.hidden = true;
      const parking = document.getElementById('calculatorParking');
      if (parking && calculator.parentElement !== parking) parking.append(calculator);
      document.body.classList.remove('calculator-open');
      document.querySelectorAll('.select-product[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded','false'));
    }
    document.body.classList.remove('mobile-lead-open');
    document.getElementById('leadBackdrop')?.setAttribute('hidden','');

    if (scrollToCatalog) {
      requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({block:'start',behavior:'auto'}));
    }
    return true;
  };

  // First pass runs before the catalog application initializes. The pageshow pass
  // catches browsers that restore form/DOM state after deferred scripts execute.
  closeTransientCalculator();
  window.addEventListener('pageshow', () => closeTransientCalculator({scrollToCatalog:true}));

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
    calculatorPromise = loadScript('/calculator.bundle.js')
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