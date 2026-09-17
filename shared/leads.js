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

/* Keep the lower half of the landing page concise: one order flow, one CTA. */
(() => {
  const setTextIfDifferent = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };

  const simplifyOrderContent = () => {
    const orderSection = document.getElementById('afterRequest');
    const trustSection = document.querySelector('.trust');
    if (!orderSection || !trustSection) return;

    document.querySelectorAll('[data-order-process]').forEach(section => section.remove());
    document.querySelectorAll('main section').forEach(section => {
      if (section === orderSection) return;
      const heading = section.querySelector('.section-head h2');
      if (String(heading?.textContent || '').trim() === 'Как проходит заказ') section.remove();
    });

    setTextIfDifferent(orderSection.querySelector('.section-head h2'), 'Как проходит заказ');
    setTextIfDifferent(orderSection.querySelector('.section-head > p'), 'Пять шагов от выбора модели до установки. На сайте ничего оплачивать не нужно.');

    const cards = orderSection.querySelectorAll('.order-steps-grid article');
    const copy = [
      ['Выбираете модель','Смотрите реальные цены и получаете предварительный расчёт по своим размерам.'],
      ['Бесплатный замер','Мастер проверит проём, размеры, столбы и условия монтажа.'],
      ['Договор и 50%','Согласуем комплектацию и зафиксируем стоимость в договоре. Оплата — 50%.'],
      ['Изготовление','Изготовим ворота по согласованным размерам. Срок — до 30 рабочих дней.'],
      ['Монтаж и оставшиеся 50%','Установим ворота. Оставшиеся 50% оплачиваются после установки.']
    ];
    cards.forEach((card, index) => {
      const item = copy[index];
      if (!item) return;
      setTextIfDifferent(card.querySelector('b'), item[0]);
      setTextIfDifferent(card.querySelector('p'), item[1]);
    });

    let trustCta = document.querySelector('[data-trust-catalog-cta]');
    if (!trustCta) {
      trustCta = document.createElement('div');
      trustCta.className = 'section-shell';
      trustCta.dataset.trustCatalogCta = 'true';
      trustCta.style.cssText = 'padding-top:0;padding-bottom:18px;display:flex;justify-content:center';
      trustCta.innerHTML = '<a class="button button-primary" href="#catalog" style="width:min(100%,430px);min-height:50px;text-align:center">Выбрать модель и узнать цену</a>';
      trustSection.after(trustCta);
      trustCta.querySelector('a')?.addEventListener('click', () => {
        try { window.ym?.(107269914,'reachGoal','trust_catalog_cta'); } catch {}
      });
    }
  };

  queueMicrotask(simplifyOrderContent);
  window.addEventListener('pageshow', simplifyOrderContent);

  let stopTimer = 0;
  const observer = new MutationObserver(() => {
    queueMicrotask(simplifyOrderContent);
  });
  queueMicrotask(() => {
    if (!document.body) return;
    observer.observe(document.body,{childList:true,subtree:true});
    clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => observer.disconnect(), 2500);
  });
})();
