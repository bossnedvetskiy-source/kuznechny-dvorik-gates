(() => {
  if (window.KUZDVOR_COLOR_PHOTO_SITE_READY) return;
  window.KUZDVOR_COLOR_PHOTO_SITE_READY = true;

  const COLORS = [
    {id:'chocolate', label:'Шоколад', short:'Шоколад', ral:'RAL 8017'},
    {id:'graphite', label:'Графит', short:'Графит', ral:'RAL 7024'},
    {id:'moss', label:'Зелёный мох', short:'Мох', ral:'RAL 6005'},
    {id:'mint', label:'Зелёная мята', short:'Мята', ral:'RAL 6029'},
    {id:'wine', label:'Винно-красный', short:'Винный', ral:'RAL 3005'}
  ];
  const COLORS_BY_ID = new Map(COLORS.map(color => [color.id, color]));
  const selectedByProduct = new Map();
  let colorPhotosByArticle = {};

  const style = document.createElement('style');
  style.textContent = `
    .profile-color-option.is-photo-missing{opacity:1;cursor:pointer}
    .profile-color-option:not(.is-more) .profile-color-dot{filter:saturate(1.22) brightness(1.12);background-image:linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.08) 38%,rgba(0,0,0,.18) 100%),repeating-linear-gradient(90deg,rgba(255,255,255,.30) 0 1px,rgba(255,255,255,.10) 1px 3px,rgba(0,0,0,.22) 3px 5px,rgba(255,255,255,.08) 5px 8px);background-blend-mode:soft-light,normal;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 0 0 1px rgba(17,18,20,.22),0 3px 8px rgba(0,0,0,.16)}
    .profile-color-option.is-photo-missing .profile-color-dot::after{content:"…";position:absolute;right:-2px;bottom:-2px;display:grid;place-items:center;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:#aaa39a;color:#fff;font:900 9px/1 Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.18)}
    .profile-color-option.is-photo-ready .profile-color-dot::after{content:"";position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border:2px solid #fff;border-radius:50%;background:#64814a;box-shadow:0 1px 3px rgba(0,0,0,.2)}
    .profile-color-option.is-more{opacity:1!important}
    .profile-color-option.is-more .profile-color-dot::after{content:"+"!important;position:absolute!important;inset:5px!important;width:auto!important;height:auto!important;display:grid!important;place-items:center!important;border:0!important;border-radius:50%!important;background:rgba(0,0,0,.72)!important;color:#fff!important;font-size:17px!important;font-weight:900!important;box-shadow:none!important}
    .profile-color-note b{color:#6e665d;font-weight:900}
    .profile-color-reset{display:inline-flex;align-items:center;justify-content:center;margin:7px 0 0;padding:0;border:0;background:transparent;color:#7b6130;font:800 9px/1.2 Manrope,Arial,sans-serif;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
    .profile-color-reset[hidden]{display:none!important}
    .order-process{padding-top:46px!important;padding-bottom:46px!important}
    .order-process-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.9fr);gap:32px;align-items:end;margin-bottom:20px}.order-process-head h2{margin:0;font:36px/1.08 Prata,serif;letter-spacing:-.8px}.order-process-head p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
    .order-process-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.order-process-card{min-height:168px;padding:18px;border:1px solid rgba(17,18,20,.1);border-radius:16px;background:#fff}.order-process-card>span{display:block;margin-bottom:18px;color:#a47728;font-size:10px;font-weight:900;letter-spacing:.7px}.order-process-card b{display:block;margin-bottom:7px;font:18px/1.2 Prata,serif}.order-process-card p{margin:0;color:#756f67;font-size:11px;line-height:1.55}
    @media(max-width:620px){.product-info>p{display:none!important}.profile-color-picker{padding:8px 10px 8px!important}.profile-color-picker-head{margin-bottom:6px!important}.profile-color-picker-head strong{font-size:11px!important}.profile-color-status{font-size:9px!important}.profile-color-option{font-size:9.5px!important;line-height:1.15!important}.profile-color-dot{width:31px!important;height:31px!important}.profile-color-note{margin-top:6px!important;font-size:9.2px!important;line-height:1.35!important}.profile-color-reset{font-size:9px}.order-process{padding-top:30px!important;padding-bottom:30px!important}.order-process-head{grid-template-columns:1fr;gap:8px;margin-bottom:14px}.order-process-head h2{font-size:28px}.order-process-head p{font-size:11.5px}.order-process-grid{grid-template-columns:1fr 1fr;gap:8px}.order-process-card{min-height:0;padding:13px;border-radius:14px}.order-process-card>span{margin-bottom:9px;font-size:9px}.order-process-card b{font-size:15px}.order-process-card p{font-size:10.5px;line-height:1.45}}
    @media(max-width:390px){.profile-color-option{font-size:9px!important}.profile-color-dot{width:30px!important;height:30px!important}.order-process-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const api = () => window.GATE_PAGE_API;
  const productForCard = card => api()?.productById?.(card?.dataset.cardProduct) || null;
  const visualForCard = card => card?.querySelector('.product-visual') || null;

  function setPressed(card, colorId) {
    card?.querySelectorAll('.profile-color-option').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.profileColor === colorId));
    });
  }

  function setStatus(card, text) {
    const status = card?.querySelector('.profile-color-status');
    if (status) status.textContent = text;
  }

  function selectionForProduct(productId) {
    const colorId = selectedByProduct.get(productId);
    if (!colorId) return null;
    if (colorId === 'other') return {id:'other', label:'Другой цвет', ral:'', url:''};
    const product = api()?.productById?.(productId);
    const color = COLORS_BY_ID.get(colorId);
    if (!product || !color) return null;
    return {...color, url:colorPhotosByArticle?.[product.art]?.[colorId] || ''};
  }

  function syncGalleryControls(card, photoActive = false, selectionActive = photoActive) {
    card?.querySelectorAll('.card-gallery-arrow').forEach(button => { button.hidden = Boolean(photoActive); });
    const reset = card?.querySelector('.profile-color-reset');
    if (reset) {
      reset.hidden = !selectionActive;
      reset.textContent = photoActive ? 'Вернуться к фото модели' : 'Сбросить выбор цвета';
    }
  }

  function syncCalculatorPreview(productId) {
    const product = api()?.selectedProduct?.();
    if (!product || product.id !== productId) return;
    const selection = selectionForProduct(productId);
    const image = document.getElementById('selectedProductImage');
    const caption = document.getElementById('selectedProductCaption');
    if (!image || !caption) return;
    image.src = selection?.url || product.image;
    image.alt = selection
      ? `Ворота с калиткой ${product.art}, профнастил ${selection.label}${selection.ral ? `, ${selection.ral}` : ''}`
      : `Ворота с калиткой ${product.art}`;
    caption.textContent = selection ? `${product.art} · ${selection.label}` : product.art;
  }

  function restoreGalleryPhoto(card, keepSelection = false) {
    const product = productForCard(card);
    const visual = visualForCard(card);
    if (!product || !visual) return;
    const index = Number(visual.dataset.imageIndex) || 0;
    const url = product.gallery?.[index] || product.image;
    const image = visual.querySelector('.product-image-open img');
    const backdrop = visual.querySelector('.product-image-backdrop');
    if (image && url) {
      image.src = url;
      image.alt = `Фотография ворот с калиткой ${product.art}, ${index + 1} из ${Math.max(1, product.gallery?.length || 1)}`;
    }
    if (backdrop && url) backdrop.src = url;
    delete visual.dataset.colorPreview;
    delete visual.dataset.colorPreviewUrl;
    const counter = visual.querySelector('[data-photo-count]');
    if (counter) {
      const count = product.gallery?.length || 1;
      counter.textContent = product.media === 'sketch' ? 'Эскиз' : count > 1 ? `${index + 1} из ${count}` : '1 фото';
    }
    if (!keepSelection) {
      selectedByProduct.delete(card.dataset.cardProduct);
      setPressed(card, '');
    }
    syncGalleryControls(card, false, keepSelection);
    syncCalculatorPreview(card.dataset.cardProduct);
  }

  function applySelectedColor(card, colorId, shouldTrack = true) {
    const product = productForCard(card);
    const visual = visualForCard(card);
    if (!product || !visual) return;

    if (colorId === 'other') {
      restoreGalleryPhoto(card, true);
      selectedByProduct.set(card.dataset.cardProduct, 'other');
      setPressed(card, 'other');
      setStatus(card, '✓ Выбран другой цвет — уточним оттенок при оформлении');
      syncGalleryControls(card, false, true);
      syncCalculatorPreview(card.dataset.cardProduct);
      if (shouldTrack) {
        try { window.ym?.(107269914, 'reachGoal', 'catalog_color_preview', {article:product.art, color:'other'}); } catch {}
      }
      return;
    }

    const color = COLORS_BY_ID.get(colorId);
    if (!color) return;
    const url = colorPhotosByArticle?.[product.art]?.[colorId] || '';
    selectedByProduct.set(card.dataset.cardProduct, colorId);
    setPressed(card, colorId);

    if (!url) {
      restoreGalleryPhoto(card, true);
      setStatus(card, `✓ Выбран: ${color.label} · ${color.ral} — отдельного фото этой модели пока нет`);
      syncGalleryControls(card, false, true);
      syncCalculatorPreview(card.dataset.cardProduct);
      if (shouldTrack) {
        try { window.ym?.(107269914, 'reachGoal', 'catalog_color_select', {article:product.art, color:colorId, photo:0}); } catch {}
      }
      return;
    }

    const image = visual.querySelector('.product-image-open img');
    const backdrop = visual.querySelector('.product-image-backdrop');
    if (image) {
      image.src = url;
      image.alt = `${product.art}, профнастил ${color.label}, ${color.ral}`;
    }
    if (backdrop) backdrop.src = url;
    visual.dataset.colorPreview = colorId;
    visual.dataset.colorPreviewUrl = url;
    const counter = visual.querySelector('[data-photo-count]');
    if (counter) counter.textContent = color.label;
    setStatus(card, `✓ Выбран: ${color.label} · ${color.ral}`);
    syncGalleryControls(card, true, true);
    syncCalculatorPreview(card.dataset.cardProduct);
    if (shouldTrack) {
      try { window.ym?.(107269914, 'reachGoal', 'catalog_color_select', {article:product.art, color:colorId, photo:1}); } catch {}
    }
  }

  function openColorPhoto(card) {
    const product = productForCard(card);
    const visual = visualForCard(card);
    const colorId = visual?.dataset.colorPreview;
    const color = COLORS_BY_ID.get(colorId);
    const url = visual?.dataset.colorPreviewUrl || colorPhotosByArticle?.[product?.art]?.[colorId];
    if (!product || !color || !url) return false;

    const lightbox = document.getElementById('lightbox');
    const image = document.getElementById('lightboxImage');
    if (!lightbox || !image) return false;
    const title = document.getElementById('lightboxTitle');
    const caption = document.getElementById('lightboxPrice');
    const counter = document.getElementById('lightboxCounter');
    const previous = document.getElementById('lightboxPrevious');
    const next = document.getElementById('lightboxNext');
    image.src = url;
    image.alt = `${product.art}, профнастил ${color.label}, ${color.ral}`;
    if (title) title.textContent = `${product.art} · ${color.label}`;
    if (caption) caption.textContent = `Реальное фото цвета · ${color.ral}`;
    if (counter) counter.textContent = '';
    if (previous) previous.hidden = true;
    if (next) next.hidden = true;
    lightbox.dataset.colorOnly = '1';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    return true;
  }

  function ensureResetButton(picker, card) {
    let reset = picker.querySelector('.profile-color-reset');
    if (reset) return reset;
    reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'profile-color-reset';
    reset.textContent = 'Сбросить выбор цвета';
    reset.hidden = true;
    reset.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      restoreGalleryPhoto(card);
      setStatus(card, 'Нажмите на нужный цвет');
      try { window.ym?.(107269914, 'reachGoal', 'catalog_color_reset', {article:productForCard(card)?.art || ''}); } catch {}
    });
    picker.append(reset);
    return reset;
  }

  function syncCard(card) {
    const product = productForCard(card);
    if (!product) return;
    const colorPhotos = colorPhotosByArticle?.[product.art] || {};
    const picker = card.querySelector('.profile-color-picker');
    if (!picker) return;

    const heading = picker.querySelector('.profile-color-picker-head strong');
    const status = picker.querySelector('.profile-color-status');
    const note = picker.querySelector('.profile-color-note');
    ensureResetButton(picker, card);
    if (heading) heading.textContent = 'Выберите цвет профнастила';
    if (note) note.innerHTML = '<b>Показаны популярные цвета.</b> Если есть отдельное фото этой модели — покажем его. Цвет не влияет на предварительную стоимость.';

    for (const button of picker.querySelectorAll('.profile-color-option')) {
      const id = button.dataset.profileColor;
      button.removeAttribute('aria-disabled');
      button.disabled = false;
      if (id === 'other') {
        button.classList.remove('is-photo-missing', 'is-photo-ready');
        button.title = 'Доступны и другие цвета профнастила';
        button.setAttribute('aria-label', 'Выбрать другой цвет профнастила');
        continue;
      }
      const color = COLORS_BY_ID.get(id);
      const ready = Boolean(colorPhotos[id]);
      button.classList.toggle('is-photo-ready', ready);
      button.classList.toggle('is-photo-missing', !ready);
      const missingText = `${color?.label || id}: цвет доступен, отдельного фото этой модели пока нет`;
      button.setAttribute('aria-label', ready
        ? `Выбрать цвет ${color?.label || id}, ${color?.ral || ''}, и показать реальное фото`
        : `Выбрать цвет ${missingText}`);
      button.title = ready ? `${color?.label || id} · ${color?.ral || ''}` : missingText;
    }

    const remembered = selectedByProduct.get(card.dataset.cardProduct);
    if (remembered && (remembered === 'other' || COLORS_BY_ID.has(remembered))) {
      applySelectedColor(card, remembered, false);
    } else {
      selectedByProduct.delete(card.dataset.cardProduct);
      setPressed(card, '');
      syncGalleryControls(card, false, false);
      if (status) status.textContent = 'Нажмите на нужный цвет';
      syncCalculatorPreview(card.dataset.cardProduct);
    }

    const visual = visualForCard(card);
    if (visual && !visual.dataset.colorPhotoObserver) {
      visual.dataset.colorPhotoObserver = '1';
      new MutationObserver(mutations => {
        if (!mutations.some(mutation => mutation.attributeName === 'data-image-index')) return;
        const selection = selectionForProduct(card.dataset.cardProduct);
        if (!selection?.url) return;
        selectedByProduct.delete(card.dataset.cardProduct);
        delete visual.dataset.colorPreview;
        delete visual.dataset.colorPreviewUrl;
        setPressed(card, '');
        syncGalleryControls(card, false, false);
        setStatus(card, 'Нажмите на нужный цвет');
        syncCalculatorPreview(card.dataset.cardProduct);
      }).observe(visual, {attributes:true, attributeFilter:['data-image-index']});
    }
  }

  function syncCards() {
    document.querySelectorAll('.product-card').forEach(syncCard);
  }

  function trackingContext() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmContent: params.get('utm_content') || '',
      utmTerm: params.get('utm_term') || '',
      yclid: params.get('yclid') || '',
      gclid: params.get('gclid') || '',
      referrer: String(document.referrer || '').slice(0, 500),
      landingPage: `${window.location.pathname}${window.location.search}`.slice(0, 500)
    };
  }

  function sourceFromTracking(payload, tracking) {
    const inferredSource = tracking.utmSource || (tracking.yclid ? 'yandex' : tracking.gclid ? 'google' : '');
    const parts = [inferredSource, tracking.utmMedium, tracking.utmCampaign, tracking.utmContent].filter(Boolean);
    if (parts.length) return parts.join(' / ').slice(0, 100);
    if (payload?.source) return String(payload.source).slice(0, 100);
    if (tracking.referrer) {
      try { return `ref:${new URL(tracking.referrer).hostname}`.slice(0, 100); } catch {}
    }
    return 'direct';
  }

  function enrichLeadPayload(payload) {
    if (!payload || payload.category !== 'gates') return payload;
    const product = api()?.selectedProduct?.();
    const selection = product ? selectionForProduct(product.id) : null;
    const tracking = trackingContext();
    const next = {
      ...payload,
      source: sourceFromTracking(payload, tracking),
      configuration: {
        ...(payload.configuration || {}),
        tracking
      }
    };
    if (!selection) return next;
    const colorText = selection.id === 'other' ? 'Другой цвет' : `${selection.label} · ${selection.ral}`;
    const preferredLine = `Предпочитаемый цвет: ${colorText}`;
    const message = String(next.message || '');
    next.color = colorText;
    next.configuration = {
      ...next.configuration,
      color: selection.id,
      colorLabel: selection.label,
      colorRal: selection.ral || '',
      colorPhotoAvailable: Boolean(selection.url)
    };
    next.message = message.includes('Предпочитаемый цвет:') ? message : `${message}${message ? '\n' : ''}${preferredLine}`;
    return next;
  }

  function installLeadEnrichment() {
    const leads = window.KUZDVOR_LEADS;
    if (!leads?.submit || leads.__colorSelectionWrapped) return;
    const originalSubmit = leads.submit.bind(leads);
    leads.submit = payload => originalSubmit(enrichLeadPayload(payload));
    leads.__colorSelectionWrapped = true;
  }

  function installOrderProcess() {
    if (document.querySelector('.order-process')) return;
    const trust = document.querySelector('.trust');
    if (!trust) return;
    const days = Number(window.SITE_SETTINGS?.productionDays) || 30;
    const section = document.createElement('section');
    section.className = 'order-process section-shell';
    section.innerHTML = `<div class="order-process-head"><h2>Как проходит заказ</h2><p>До оплаты вы видите предварительный расчёт. Точные размеры и окончательную сумму подтверждаем после бесплатного замера и фиксируем в договоре.</p></div><div class="order-process-grid"><article class="order-process-card"><span>01</span><b>Бесплатный замер</b><p>Мастер проверит проём, столбы и условия монтажа, уточнит размеры и комплектацию.</p></article><article class="order-process-card"><span>02</span><b>Договор и 50%</b><p>Фиксируем согласованную стоимость, размеры и артикул. Аванс — 50%.</p></article><article class="order-process-card"><span>03</span><b>Изготовление</b><p>Изготавливаем ворота по вашим размерам. Срок — до ${days} рабочих дней.</p></article><article class="order-process-card"><span>04</span><b>Монтаж и оставшиеся 50%</b><p>Устанавливаем, принимаете работу и оплачиваете оставшуюся часть после установки.</p></article></div>`;
    trust.after(section);
  }

  function installStructuredData() {
    if (document.getElementById('localBusinessStructuredData')) return;
    const site = window.SITE_SETTINGS || {};
    const phoneDigits = String(site.phoneDigits || '79373296750').replace(/\D/g, '');
    const script = document.createElement('script');
    script.id = 'localBusinessStructuredData';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@graph':[
        {
          '@type':'LocalBusiness',
          '@id':`${window.location.origin}/#business`,
          name:'Кузнечный ДворикЪ',
          url:`${window.location.origin}/`,
          telephone:`+${phoneDigits}`,
          address:{'@type':'PostalAddress',addressLocality:'Мелеуз',addressRegion:'Республика Башкортостан',addressCountry:'RU'},
          areaServed:`Мелеуз и населённые пункты в радиусе до ${Number(site.serviceAreaKm) || 150} км`,
          openingHoursSpecification:[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'09:00',closes:'18:00'}]
        },
        {
          '@type':'Service',
          '@id':`${window.location.origin}/#gates-service`,
          name:'Изготовление и установка распашных ворот с калиткой',
          provider:{'@id':`${window.location.origin}/#business`},
          areaServed:{'@type':'AdministrativeArea',name:'юг Республики Башкортостан'}
        }
      ]
    });
    document.head.append(script);

    const isTechnicalHost = /(?:workers\.dev|github\.io)$/i.test(window.location.hostname);
    if (!isTechnicalHost) {
      const canonical = document.querySelector('link[rel="canonical"]');
      const ogUrl = document.querySelector('meta[property="og:url"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (canonical) canonical.href = `${window.location.origin}/`;
      if (ogUrl) ogUrl.content = `${window.location.origin}/`;
      if (ogImage) ogImage.content = `${window.location.origin}/hero-gates.jpg`;
    }
  }

  function installDialogFocusTrap() {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const focusables = dialog => [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node => !node.hidden && node.getClientRects().length);
    for (const dialog of dialogs) {
      new MutationObserver(() => {
        if (dialog.hidden) return;
        queueMicrotask(() => focusables(dialog)[0]?.focus?.({preventScroll:true}));
      }).observe(dialog, {attributes:true, attributeFilter:['hidden']});
    }
    document.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const dialog = dialogs.find(item => !item.hidden);
      if (!dialog) return;
      const items = focusables(dialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (api()) api().colorSelectionForProduct = selectionForProduct;
  installLeadEnrichment();
  installOrderProcess();
  installStructuredData();
  installDialogFocusTrap();

  document.addEventListener('click', event => {
    const selectButton = event.target.closest?.('.select-product');
    if (selectButton) queueMicrotask(() => syncCalculatorPreview(selectButton.dataset.product));

    const zoomButton = event.target.closest?.('.product-image-open');
    if (zoomButton) {
      const card = zoomButton.closest('.product-card');
      if (visualForCard(card)?.dataset.colorPreview && openColorPhoto(card)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }

    const reset = event.target.closest?.('.profile-color-reset');
    if (reset) return;

    const button = event.target.closest?.('.profile-color-option');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const card = button.closest('.product-card');
    applySelectedColor(card, button.dataset.profileColor, true);
  }, true);

  document.addEventListener('touchend', event => {
    const button = event.target.closest?.('.product-image-open');
    const card = button?.closest('.product-card');
    if (button && visualForCard(card)?.dataset.colorPreview) event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keydown', event => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || lightbox.hidden || lightbox.dataset.colorOnly !== '1') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    new MutationObserver(() => {
      if (lightbox.hidden) delete lightbox.dataset.colorOnly;
    }).observe(lightbox, {attributes:true, attributeFilter:['hidden']});
  }

  async function loadColorPhotos() {
    try {
      const request = window.KUZDVOR_CATALOG_IMAGES_PROMISE || (window.KUZDVOR_CATALOG_IMAGES_PROMISE = fetch('/api/catalog-images', {cache:'no-store'})
          .then(response => response.ok ? response.json() : null)
          .catch(() => null));
        const data = await request;
        if (!data) throw new Error('catalog');
      colorPhotosByArticle = Object.fromEntries(Object.entries(data.galleries || {}).map(([article, gallery]) => [article, {...(gallery?.colorPhotos || {})}]));
    } catch {
      colorPhotosByArticle = {};
    }
    syncCards();
    const selected = api()?.selectedProduct?.();
    if (selected) syncCalculatorPreview(selected.id);
  }

  const grid = document.getElementById('catalogGrid');
  if (grid) new MutationObserver(() => queueMicrotask(syncCards)).observe(grid, {childList:true, subtree:false});

  queueMicrotask(() => {
    syncCards();
    loadColorPhotos();
  });
})();