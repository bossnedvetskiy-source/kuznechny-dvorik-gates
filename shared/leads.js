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

  const savedCalculator = restoreCalculatorMemory();

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

  if (savedCalculator?.productId) {
    setTimeout(() => {
      try { window.GATE_PAGE_API?.openCalculatorForProduct?.(String(savedCalculator.productId), false); } catch {}
    }, 0);
  }

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

  const applyFinalUx = () => {
    normalizeOrderFlow();
    syncCtaCopy();
    bindPackageNumbering();
    syncPackageNumbers();
    bindEndVisibility();
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