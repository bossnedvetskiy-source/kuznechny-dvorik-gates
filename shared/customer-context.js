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
  const mobile = window.matchMedia('(max-width: 620px)');

  const install = () => {
    const priceBody = document.querySelector('.mobile-price-breakdown-body');
    const paymentNote = priceBody?.querySelector('.mobile-payment-note');
    const stickyCta = document.getElementById('mobilePrimaryCta');
    const stickyBar = document.querySelector('.mobile-cta');
    const priceNode = document.getElementById('mobilePriceTotal');
    const estimateCard = document.querySelector('.mobile-price-breakdown');
    if (!priceBody || !stickyCta || !stickyBar || !priceNode || !estimateCard) return false;
    if (priceBody.querySelector('.mobile-inline-order-cta')) return true;

    const style = document.createElement('style');
    style.id = 'mobileInlineOrderCtaStyles';
    style.textContent = `
      .mobile-inline-order-cta{display:none}
      @media(max-width:620px){
        .mobile-inline-order-cta{display:grid;width:100%;min-height:62px;margin:12px 0 0;padding:11px 16px;border:0;border-radius:12px;background:#d2a143;color:#17130d;place-items:center;gap:2px;font-family:Manrope,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.18)}
        .mobile-inline-order-cta strong{font-size:14px;line-height:1.25;font-weight:900}
        .mobile-inline-order-cta small{font-size:10px;line-height:1.3;font-weight:800;opacity:.78}
        .mobile-cta.is-inline-cta-visible{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
        .mobile-price-breakdown.mobile-estimate-order-target{cursor:pointer;touch-action:manipulation;transition:border-color .15s ease,box-shadow .15s ease,transform .08s ease}
        .mobile-price-breakdown.mobile-estimate-order-target:active{transform:translateY(1px);border-color:rgba(230,189,105,.62);box-shadow:0 0 0 2px rgba(210,161,67,.12)}
        .mobile-price-breakdown.mobile-estimate-order-target:focus-visible{outline:2px solid #d2a143;outline-offset:3px}
      }
    `;
    if (!document.getElementById(style.id)) document.head.append(style);

    estimateCard.classList.add('mobile-estimate-order-target');
    estimateCard.setAttribute('role','button');
    estimateCard.setAttribute('tabindex','0');
    estimateCard.setAttribute('aria-label','Перейти к заказу бесплатного замера');

    const activateEstimateOrder = event => {
      if (!mobile.matches) return;
      const interactive = event.target?.closest?.('button,a,input,textarea,select,label,[role="button"]');
      if (interactive && interactive !== estimateCard) return;
      event.preventDefault();
      stickyCta.click();
    };

    estimateCard.addEventListener('click', activateEstimateOrder);
    estimateCard.addEventListener('keydown', event => {
      if (!mobile.matches || event.target !== estimateCard || !['Enter',' '].includes(event.key)) return;
      event.preventDefault();
      stickyCta.click();
    });

    const inlineCta = document.createElement('button');
    inlineCta.type = 'button';
    inlineCta.className = 'mobile-inline-order-cta';
    inlineCta.setAttribute('aria-label','Заказать бесплатный замер');
    inlineCta.innerHTML = '<strong>Заказать бесплатный замер</strong><small></small>';
    (paymentNote || priceBody.lastElementChild)?.after?.(inlineCta) || priceBody.append(inlineCta);

    const inlinePrice = inlineCta.querySelector('small');
    const syncPrice = () => {
      const price = String(priceNode.textContent || '').trim();
      inlinePrice.textContent = price ? `Предварительный расчёт: ${price}` : 'Предварительный расчёт';
    };
    syncPrice();

    new MutationObserver(syncPrice).observe(priceNode,{childList:true,characterData:true,subtree:true});
    document.addEventListener('gate:calculated', () => requestAnimationFrame(syncPrice));

    inlineCta.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      stickyCta.click();
    });

    const syncStickyVisibility = visible => {
      stickyBar.classList.toggle('is-inline-cta-visible', Boolean(visible && mobile.matches));
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const entry = entries[0];
        syncStickyVisibility(Boolean(entry?.isIntersecting && entry.intersectionRatio >= .35));
      },{threshold:[0,.35,.7,1]});
      observer.observe(inlineCta);
      mobile.addEventListener('change', () => {
        if (!mobile.matches) syncStickyVisibility(false);
      });
    }

    return true;
  };

  queueMicrotask(() => {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(() => observer.disconnect(),5000);
  });
})();

(() => {
  const install = () => {
    if (document.getElementById('catalogLocationGateModal')) return true;
    const catalog = document.getElementById('catalog');
    const catalogSummary = catalog?.querySelector('.catalog-summary');
    const sourceChooser = document.getElementById('deliveryChooser');
    const sourceCity = document.getElementById('cityInput');
    const sourceResult = document.getElementById('deliveryResult');
    const sourceRoute = document.getElementById('routeButton');
    const sourceSummary = document.getElementById('deliverySummary');
    const sourceSummaryValue = document.getElementById('deliverySummaryValue');
    const sourceOther = sourceChooser?.querySelector('[data-delivery-choice="other"]');
    const deliveryBlock = sourceChooser?.closest('.form-block');
    const calculator = document.getElementById('calculator');
    const stickyCta = document.getElementById('mobilePrimaryCta');
    const catalogGrid = document.getElementById('catalogGrid');
    if (!catalog || !catalogSummary || !sourceChooser || !sourceCity || !sourceResult || !sourceRoute || !sourceSummary || !sourceSummaryValue || !sourceOther || !deliveryBlock || !calculator || !stickyCta || !window.GATE_PAGE_API?.deliveryState) return false;

    document.getElementById('catalogLocationPanel')?.remove();
    document.getElementById('catalogLocationPanelStyles')?.remove();

    const style = document.createElement('style');
    style.id = 'catalogLocationGateStyles';
    style.textContent = `
      body.installation-location-modal-open{overflow:hidden!important}
      .catalog.location-locked .catalog-summary,.catalog.location-locked .catalog-grid,.catalog.location-locked .catalog-trust-strip,.catalog.location-locked .catalog-more,.catalog.location-locked .empty-state{display:none!important}
      .catalog-location-lock{display:grid;justify-items:center;gap:9px;margin:0;padding:24px 18px;border:1px solid rgba(210,161,67,.3);border-radius:18px;background:#fff;text-align:center;box-shadow:0 10px 28px rgba(17,18,20,.06)}
      .catalog-location-lock[hidden],.catalog-location-bar[hidden]{display:none!important}
      .catalog-location-lock strong{font-size:17px;line-height:1.25;color:#171717}.catalog-location-lock span{max-width:560px;color:#746e65;font-size:12px;line-height:1.5}.catalog-location-lock button{min-height:46px;margin-top:3px;padding:10px 20px;border:0;border-radius:12px;background:#d2a143;color:#17130d;font:900 12px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .catalog-location-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 16px;padding:11px 13px;border:1px solid rgba(17,18,20,.11);border-radius:13px;background:#fff;color:#171717}
      .catalog-location-bar-copy{display:grid;gap:2px;min-width:0}.catalog-location-bar-copy span{color:#8b8378;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.catalog-location-bar-copy strong{font-size:12px;line-height:1.3;font-weight:900}.catalog-location-bar button{flex:0 0 auto;min-height:36px;padding:8px 11px;border:1px solid rgba(210,161,67,.42);border-radius:9px;background:transparent;color:#8a6320;font:800 10px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
      .delivery-location-source-hidden .delivery-choice-buttons,.delivery-location-source-hidden .city-label,.delivery-location-source-hidden .delivery-result,.delivery-location-source-hidden .route-button,.delivery-location-source-hidden .delivery-help,.delivery-location-source-hidden #deliveryChange{display:none!important}
      .delivery-location-source-hidden .delivery-selected-summary{display:flex!important;margin-top:0!important}.delivery-location-source-hidden .delivery-selected-summary>div>span{font-size:10px!important}.delivery-location-source-hidden .delivery-selected-summary>div>strong{font-size:14px!important}.delivery-location-readonly-note{display:block;margin:8px 0 0;color:rgba(255,255,255,.62);font-size:10px;line-height:1.45}
      .installation-location-backdrop{position:fixed;inset:0;z-index:12000;background:rgba(5,6,8,.68);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.installation-location-backdrop[hidden],.installation-location-modal[hidden]{display:none!important}
      .installation-location-modal{position:fixed;z-index:12001;left:50%;top:50%;width:min(520px,calc(100vw - 28px));box-sizing:border-box;transform:translate(-50%,-50%);padding:22px;border:1px solid rgba(230,189,105,.38);border-radius:20px;background:linear-gradient(155deg,#191a1d,#0e0f11);color:#fff;box-shadow:0 26px 80px rgba(0,0,0,.48);font-family:Manrope,Arial,sans-serif}
      .installation-location-close{position:absolute;right:12px;top:12px;width:38px;height:38px;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:#202125;color:#fff;font-size:22px;line-height:1;cursor:pointer}.installation-location-modal h2{margin:0 46px 7px 0;font-size:21px;line-height:1.2}.installation-location-modal>p{margin:0 0 16px;color:rgba(255,255,255,.68);font-size:11.5px;line-height:1.5}.installation-location-field{display:grid;gap:6px}.installation-location-field span{color:rgba(255,255,255,.72);font-size:10px;font-weight:800}.installation-location-field input{width:100%;min-height:50px;box-sizing:border-box;padding:11px 13px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:#fff;color:#171717;font:700 16px/1.2 Manrope,Arial,sans-serif;outline:none}.installation-location-field input:focus{border-color:#d2a143;box-shadow:0 0 0 3px rgba(210,161,67,.15)}.installation-location-status{min-height:18px;margin:8px 0 0;color:rgba(255,255,255,.69);font-size:10.5px;line-height:1.45}.installation-location-action{width:100%;min-height:48px;margin-top:11px;border:0;border-radius:12px;background:#d2a143;color:#17130d;font:900 12px/1.2 Manrope,Arial,sans-serif;cursor:pointer}.installation-location-action:disabled{opacity:.48;cursor:not-allowed}.installation-location-hint{display:block;margin-top:9px;color:rgba(255,255,255,.47);font-size:9.5px;line-height:1.4;text-align:center}
      @media(max-width:620px){body:not(.catalog-journey-started) .mobile-cta,body.installation-location-modal-open .mobile-cta{display:none!important}.catalog-location-lock{padding:19px 14px;border-radius:15px}.catalog-location-lock strong{font-size:15px}.catalog-location-lock span{font-size:11px}.catalog-location-lock button{width:100%;min-height:48px}.catalog-location-bar{margin-bottom:12px;padding:10px 11px}.catalog-location-bar-copy strong{font-size:11.5px}.installation-location-modal{left:0;right:0;top:auto;bottom:0;width:100%;max-height:min(82dvh,640px);transform:none;padding:20px 16px max(18px,env(safe-area-inset-bottom));border-radius:22px 22px 0 0}.installation-location-modal h2{font-size:19px}.installation-location-modal>p{font-size:11px}.installation-location-field input{min-height:52px;font-size:16px}.installation-location-action{min-height:50px}}
    `;
    document.head.append(style);

    const startJourney = () => document.body.classList.add('catalog-journey-started');

    deliveryBlock.classList.add('delivery-location-source-hidden');
    const stepLabel = deliveryBlock.querySelector('.step-label');
    if (stepLabel) stepLabel.textContent = '03 · Место установки';
    let readonlyNote = deliveryBlock.querySelector('.delivery-location-readonly-note');
    if (!readonlyNote) {
      readonlyNote = document.createElement('small');
      readonlyNote.className = 'delivery-location-readonly-note';
      sourceSummary.after(readonlyNote);
    }
    const sourceSummaryLabel = sourceSummary.querySelector('span');
    if (sourceSummaryLabel) sourceSummaryLabel.textContent = 'Место установки';

    const lock = document.createElement('div');
    lock.className = 'catalog-location-lock';
    lock.innerHTML = '<strong>Сначала укажите место установки</strong><span>После этого откроем каталог и сразу покажем цены с учётом доставки.</span><button type="button">Указать населённый пункт</button>';
    catalog.querySelector('.section-head')?.after(lock);

    const bar = document.createElement('div');
    bar.className = 'catalog-location-bar';
    bar.hidden = true;
    bar.innerHTML = '<div class="catalog-location-bar-copy"><span>Место установки</span><strong></strong></div><button type="button">Изменить</button>';
    catalogSummary.before(bar);
    const barValue = bar.querySelector('strong');

    const backdrop = document.createElement('div');
    backdrop.className = 'installation-location-backdrop';
    backdrop.hidden = true;
    const modal = document.createElement('section');
    modal.id = 'catalogLocationGateModal';
    modal.className = 'installation-location-modal';
    modal.hidden = true;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','installationLocationTitle');
    modal.innerHTML = `
      <button class="installation-location-close" type="button" aria-label="Закрыть">×</button>
      <h2 id="installationLocationTitle">Куда устанавливаем ворота?</h2>
      <p>Введите населённый пункт. После выбора мы откроем каталог уже с ценами, рассчитанными для вашего места установки.</p>
      <label class="installation-location-field"><span>Населённый пункт</span><input id="installationLocationInput" list="citySuggestions" type="text" placeholder="Например: Салават" autocomplete="address-level2" enterkeyhint="search"></label>
      <div class="installation-location-status" id="installationLocationStatus" role="status" aria-live="polite"></div>
      <button class="installation-location-action" id="installationLocationAction" type="button" disabled>Продолжить</button>
      <small class="installation-location-hint">Телефон и регистрация не нужны — сначала просто покажем актуальные цены.</small>`;
    document.body.append(backdrop,modal);

    const modalInput = modal.querySelector('#installationLocationInput');
    const modalStatus = modal.querySelector('#installationLocationStatus');
    const modalAction = modal.querySelector('#installationLocationAction');
    const modalClose = modal.querySelector('.installation-location-close');
    let navigateAfterSelection = false;
    let autoPromptDismissed = false;
    let closing = false;
    let noteSyncQueued = false;

    const getState = () => window.GATE_PAGE_API?.deliveryState?.() || {kind:'empty'};
    const cityFromState = state => String(state?.shortName || state?.resolvedName || state?.name || sourceCity.value || '').trim();
    const isSelected = state => ['fixed','calculated','out-of-area'].includes(String(state?.kind || '')) && Boolean(cityFromState(state));

    const normalizeCatalogNotes = state => {
      if (!catalogGrid || !isSelected(state)) return;
      const city = cityFromState(state);
      const outOfArea = String(state.kind || '') === 'out-of-area';
      const wanted = outOfArea
        ? `Доставка в ${city} рассчитывается индивидуально`
        : `✓ Цена с учётом доставки в ${city}`;
      catalogGrid.querySelectorAll('.price-delivery-note').forEach(node => {
        if (node.textContent !== wanted) node.textContent = wanted;
      });
    };

    const queueNoteSync = state => {
      if (noteSyncQueued) return;
      noteSyncQueued = true;
      requestAnimationFrame(() => {
        noteSyncQueued = false;
        normalizeCatalogNotes(state || getState());
      });
    };

    const syncModal = () => {
      const state = getState();
      const kind = String(state.kind || 'empty');
      const sourceText = String(sourceResult.textContent || '').trim();
      if (document.activeElement !== modalInput && !modalInput.value && sourceCity.value) modalInput.value = sourceCity.value;
      modalStatus.textContent = kind === 'empty' && !modalInput.value
        ? 'Введите название населённого пункта.'
        : sourceText;
      if (kind === 'loading') {
        modalAction.disabled = true;
        modalAction.textContent = 'Считаем доставку…';
      } else if (!sourceRoute.hidden && !sourceRoute.disabled) {
        modalAction.disabled = false;
        modalAction.textContent = String(sourceRoute.textContent || 'Продолжить');
      } else {
        modalAction.disabled = modalInput.value.trim().length < 2;
        modalAction.textContent = 'Продолжить';
      }
    };

    const closeModal = ({navigate = false} = {}) => {
      if (closing) return;
      closing = true;
      modal.hidden = true;
      backdrop.hidden = true;
      document.body.classList.remove('installation-location-modal-open');
      const shouldNavigate = navigate && isSelected(getState());
      navigateAfterSelection = false;
      window.setTimeout(() => {
        closing = false;
        if (shouldNavigate) catalog.scrollIntoView({behavior:'smooth',block:'start'});
      },80);
    };

    const sync = () => {
      const state = getState();
      const selected = isSelected(state);
      const city = cityFromState(state);
      if (!calculator.hidden) startJourney();
      catalog.classList.toggle('location-locked', !selected);
      lock.hidden = selected;
      bar.hidden = !selected;
      if (selected) {
        barValue.textContent = city;
        if (sourceSummaryValue.textContent !== city) sourceSummaryValue.textContent = city;
        readonlyNote.textContent = String(state.kind || '') === 'out-of-area'
          ? 'Стоимость доставки уточним индивидуально.'
          : 'Доставка уже учтена в общей стоимости.';
        window.KUZDVOR_SYNC_CATALOG_DELIVERY_PRICES?.(state);
        queueNoteSync(state);
        if (!modal.hidden) {
          if (navigateAfterSelection) startJourney();
          closeModal({navigate:navigateAfterSelection});
        }
      } else {
        if (calculator.hidden && stickyCta.textContent !== 'Указать место установки') stickyCta.textContent = 'Указать место установки';
        syncModal();
      }
      if (!calculator.hidden && selected && sourceSummary.hidden) sourceSummary.hidden = false;
      const mobilePriceNote = document.getElementById('mobilePriceNote');
      if (selected && /^мелеуз$/i.test(city.replace(/ё/g,'е')) && mobilePriceNote && /бесплат/i.test(mobilePriceNote.textContent || '')) {
        mobilePriceNote.textContent = 'Доставка до Мелеуза учтена в общей стоимости.';
      }
    };

    const openModal = ({navigate = false, change = false} = {}) => {
      const before = getState();
      const previousCity = cityFromState(before);
      if (change || !isSelected(before)) {
        sourceOther.click();
        modalInput.value = change ? previousCity : '';
        sourceCity.value = change ? previousCity : '';
      }
      navigateAfterSelection = navigate;
      autoPromptDismissed = false;
      backdrop.hidden = false;
      modal.hidden = false;
      document.body.classList.add('installation-location-modal-open');
      syncModal();
      window.setTimeout(() => {
        modalInput.focus({preventScroll:true});
        if (change && modalInput.value) modalInput.select?.();
      },100);
    };

    modalInput.addEventListener('input', () => {
      sourceCity.value = modalInput.value;
      sourceCity.dispatchEvent(new Event('input',{bubbles:true}));
      requestAnimationFrame(() => {
        syncModal();
        sync();
      });
    });
    modalInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!modalAction.disabled) modalAction.click();
    });
    modalAction.addEventListener('click', () => {
      const value = modalInput.value.trim();
      if (value.length < 2) {
        modalStatus.textContent = 'Введите населённый пункт полностью.';
        modalInput.focus();
        return;
      }
      const current = getState();
      if (String(current.kind || '') === 'confirm' && !sourceRoute.hidden && !sourceRoute.disabled) {
        sourceRoute.click();
        window.setTimeout(syncModal,0);
        return;
      }
      sourceCity.value = value;
      sourceCity.dispatchEvent(new Event('input',{bubbles:true}));
      window.setTimeout(() => {
        if (!isSelected(getState()) && !sourceRoute.hidden && !sourceRoute.disabled) sourceRoute.click();
        syncModal();
      },0);
    });

    const dismiss = () => {
      autoPromptDismissed = true;
      closeModal();
    };
    modalClose.addEventListener('click', dismiss);
    backdrop.addEventListener('click', dismiss);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) dismiss();
    });

    lock.querySelector('button')?.addEventListener('click', () => {
      startJourney();
      openModal({navigate:true});
    });
    bar.querySelector('button')?.addEventListener('click', () => {
      startJourney();
      openModal({change:true});
    });

    document.addEventListener('click', event => {
      const target = event.target?.closest?.('a[href="#catalog"],#mobilePrimaryCta');
      if (!target) return;
      if (target.matches('a[href="#catalog"]')) startJourney();
      if (isSelected(getState())) return;
      event.preventDefault();
      event.stopPropagation();
      openModal({navigate:true});
    }, true);

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < .18 || isSelected(getState()) || !modal.hidden || autoPromptDismissed) return;
        openModal({navigate:true});
      },{threshold:[0,.18,.4]});
      observer.observe(catalog);
    }

    [sourceCity,sourceResult,sourceRoute,sourceSummaryValue].forEach(node => {
      if (!node) return;
      new MutationObserver(() => requestAnimationFrame(sync)).observe(node,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});
    });
    sourceCity.addEventListener('input', () => requestAnimationFrame(sync));
    sourceCity.addEventListener('change', () => requestAnimationFrame(sync));
    sourceRoute.addEventListener('click', () => window.setTimeout(sync,20));
    document.addEventListener('gate:calculated', () => requestAnimationFrame(sync));
    window.addEventListener('pageshow', () => requestAnimationFrame(sync));

    if (catalogGrid) {
      new MutationObserver(() => queueNoteSync(getState())).observe(catalogGrid,{childList:true,subtree:true,characterData:true});
    }
    new MutationObserver(() => {
      if (!isSelected(getState()) && calculator.hidden && stickyCta.textContent !== 'Указать место установки') stickyCta.textContent = 'Указать место установки';
    }).observe(stickyCta,{childList:true,characterData:true,subtree:true});

    sync();
    return true;
  };

  const start = () => {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 70) window.clearInterval(timer);
    },100);
  };
  queueMicrotask(start);
})();