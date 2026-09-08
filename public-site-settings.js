(() => {
  const site = window.SITE_SETTINGS || {};

  const heroPriceStyle = document.createElement('style');
  heroPriceStyle.textContent = `
    .hero-prices>div{
      display:grid!important;
      grid-template-columns:1fr!important;
      align-content:start!important;
      justify-items:start!important;
      gap:5px!important;
      text-align:left!important;
    }
    .hero-prices small{
      display:block!important;
      margin:0!important;
      min-width:0!important;
      color:rgba(255,255,255,.64)!important;
      font-size:11px!important;
      line-height:1.25!important;
      font-weight:600!important;
    }
    .hero-prices strong{
      display:block!important;
      margin:0!important;
      color:var(--gold-light)!important;
      font:22px/1.08 Prata,serif!important;
      letter-spacing:-.35px!important;
      white-space:nowrap!important;
    }
    .hero-prices span{
      display:block!important;
      margin:1px 0 0!important;
      color:rgba(255,255,255,.66)!important;
      font-size:10px!important;
      line-height:1.35!important;
    }
    @media(max-width:620px){
      .hero-prices>div{padding:12px!important;gap:4px!important}
      .hero-prices small{font-size:10px!important}
      .hero-prices strong{font-size:20px!important}
      .hero-prices span{font-size:9px!important}
    }
    @media(max-width:430px){
      .hero-prices{grid-template-columns:1fr!important}
      .hero-prices strong{font-size:22px!important}
      .hero-prices span{font-size:10px!important}
    }
  `;
  document.head.append(heroPriceStyle);

  const mobileHeroStyle = document.createElement('style');
  mobileHeroStyle.textContent = `
    @media(max-width:620px){
      .hero{display:flex!important;flex-direction:column!important;min-height:0!important;padding-bottom:18px!important}
      .hero>.hero-photo{display:none!important}
      .hero>.hero-prices{order:4!important}
      .hero>.hero-points{order:5!important;margin-top:12px!important}
      .hero>.hero-actions{order:6!important;margin-top:14px!important;margin-bottom:0!important}
      .catalog{padding-top:30px!important}
    }
  `;
  document.head.append(mobileHeroStyle);

  const calculatorUxStyle = document.createElement('style');
  calculatorUxStyle.textContent = `
    .mobile-size-summary,.mobile-comment-toggle{display:none}
    @media(max-width:620px){
      .calculator.inline-calculator{padding-bottom:20px!important;scroll-margin-top:6px!important}
      .calculator-open .mobile-calc-summary{display:none!important}
      .calc-form{padding:14px!important;border-radius:17px!important}
      .selected-product-preview{margin:0 0 13px!important;padding:8px!important;grid-template-columns:76px 1fr!important;gap:10px!important;border-radius:13px!important;scroll-margin-top:6px!important}
      .selected-product-preview img{width:76px!important;height:56px!important;border-radius:10px!important}
      .selected-product-preview figcaption{gap:2px!important}
      .selected-product-preview figcaption span{display:none!important}
      .selected-product-preview figcaption strong{font-size:16px!important;line-height:1.2!important}
      .product-picker-label{display:none!important}
      .form-block{padding:0 0 18px!important;margin:0 0 18px!important}
      .form-block:last-child{padding-bottom:0!important;margin-bottom:0!important}
      .step-label{margin-bottom:12px!important;font-size:10px!important}

      .mobile-size-summary{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:12px 13px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:#101113;margin-bottom:0}
      .mobile-size-summary>div{display:grid;gap:4px;min-width:0}
      .mobile-size-summary small{color:rgba(255,255,255,.48);font-size:10px;text-transform:uppercase;letter-spacing:.7px}
      .mobile-size-summary strong{color:#fff;font-size:13px;line-height:1.35;font-weight:700}
      .mobile-size-summary button{border:1px solid rgba(230,189,105,.38);background:rgba(200,152,60,.08);color:var(--gold-light);border-radius:10px;padding:9px 10px;font-size:11px;font-weight:800;white-space:nowrap}
      .dimensions.mobile-collapsible{display:none!important;margin-top:10px!important;gap:9px!important}
      .dimensions.mobile-collapsible.is-open{display:grid!important;grid-template-columns:1fr 1fr!important}
      .dimensions.mobile-collapsible.is-open label:last-child{grid-column:1/-1}
      .dimensions.mobile-collapsible label{font-size:11px!important;gap:6px!important}
      .dimensions.mobile-collapsible input{min-height:48px!important;font-size:16px!important}
      .size-notice{margin-top:9px!important}

      .option-list{gap:9px!important}
      .choice{min-height:82px!important;padding:12px 13px!important;gap:11px!important;border-radius:14px!important;transition:border-color .18s ease,background .18s ease,box-shadow .18s ease}
      .choice input{width:25px!important;height:25px!important;border:1px solid rgba(255,255,255,.28)!important;border-radius:7px!important;background:#0d0e10!important}
      .choice input:checked{background:var(--gold)!important;border-color:var(--gold)!important}
      .choice input:checked::after{left:6px!important;top:1px!important;font-size:14px!important}
      .choice:has(input:checked){border-color:rgba(230,189,105,.7)!important;background:rgba(200,152,60,.09)!important;box-shadow:0 0 0 1px rgba(230,189,105,.08) inset!important}
      .choice b{font-size:14px!important}.choice small{font-size:10px!important;line-height:1.4!important}.choice strong{font-size:13px!important;white-space:nowrap!important}
      .color-label{margin-top:12px!important;font-size:11px!important}.color-label select{min-height:49px!important;font-size:16px!important}

      .city-label{font-size:11px!important}.city-label input{min-height:49px!important;font-size:16px!important}
      .delivery-result{margin-top:9px!important;padding:10px 11px!important;font-size:11px!important;border-radius:11px!important}
      .delivery-help{margin-top:9px!important}.delivery-help summary{font-size:11px!important}

      .estimate-card{padding:13px!important;border-radius:16px!important}
      .estimate-breakdown{margin-bottom:12px!important}
      .estimate-breakdown>summary{min-height:0!important;padding:11px 13px!important;border-radius:11px!important;font-size:12px!important;line-height:1.25!important}
      .mobile-lead-heading{margin-bottom:11px!important}
      .mobile-lead-heading>span{font-size:9px!important}
      .mobile-lead-heading h3{font-size:21px!important;margin:4px 0!important;line-height:1.18!important}
      .mobile-lead-heading p{font-size:11px!important;line-height:1.45!important}
      .lead-fields{gap:10px!important;margin-bottom:10px!important}
      .lead-fields label{font-size:11px!important}.lead-fields input{min-height:50px!important;font-size:16px!important}
      .mobile-comment-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;border:1px solid var(--line);background:#fff;color:#5f5a53;border-radius:12px;padding:12px 13px;margin:0;font-size:12px;font-weight:800;text-align:left}
      .mobile-comment-toggle::after{content:"+";color:#9f772f;font-size:20px;font-weight:500;line-height:1}
      .mobile-comment-toggle.is-open::after{content:"−"}
      .lead-comment{display:none!important}
      .lead-comment.is-open{display:grid!important;margin-top:0!important}
      .lead-comment textarea{min-height:76px!important;font-size:15px!important}
      .consent-row{font-size:10px!important;margin:10px 0 4px!important;gap:8px!important}
      #sendButton,.copy-button{display:none!important}
      .privacy-copy{display:none!important}

      .mobile-cta{height:56px!important;padding:6px 8px!important;grid-template-columns:.58fr 1.42fr!important}
      .mobile-cta a{font-size:11px!important}
      .mobile-cta a:last-child{font-size:12px!important;line-height:1.15!important;text-align:center!important;padding:0 8px!important}
    }
  `;
  document.head.append(calculatorUxStyle);

  const simplifiedInstallStyle = document.createElement('style');
  simplifiedInstallStyle.textContent = `
    .simplified-posts-block .base-install-choice{display:none!important}
    .base-install-note{margin:-2px 0 10px;color:rgba(255,255,255,.58);font-size:11px;line-height:1.45}
    @media(max-width:620px){
      .simplified-posts-block{padding-bottom:15px!important;margin-bottom:15px!important}
      .simplified-posts-block .step-label{margin-bottom:7px!important}
      .base-install-note{margin:0 0 8px!important;font-size:9px!important;line-height:1.4!important;color:rgba(255,255,255,.5)!important}
      .simplified-posts-block .option-list{gap:0!important}
      .simplified-posts-block .choice{min-height:64px!important;padding:9px 11px!important;gap:9px!important;border-radius:12px!important;grid-template-columns:22px minmax(0,1fr) auto!important}
      .simplified-posts-block .choice input{width:22px!important;height:22px!important;border-radius:6px!important}
      .simplified-posts-block .choice input:checked::after{left:5px!important;top:0!important;font-size:13px!important}
      .simplified-posts-block .choice b{font-size:13px!important;line-height:1.25!important}
      .simplified-posts-block .choice small{font-size:9px!important;line-height:1.32!important}
      .simplified-posts-block .choice strong{font-size:12px!important}
      .simplified-posts-block .color-label{margin-top:10px!important}
      #calcForm .mobile-price-breakdown>summary small{font-size:0!important}
      #calcForm .mobile-price-breakdown>summary small::after{content:"С установкой на готовые столбы";font-size:9px!important;color:rgba(255,255,255,.42)!important}
      #calcForm:has(#postsCheck:checked) .mobile-price-breakdown>summary small::after{content:"Под ключ с новыми усиленными столбами"}
    }
  `;
  document.head.append(simplifiedInstallStyle);

  const findCatalogProduct = card => {
    const id = card?.dataset.cardProduct;
    if (!id || typeof catalogProducts === 'undefined') return null;
    return catalogProducts.find(item => item.id === id) || null;
  };

  const syncCardThumbs = card => {
    const strip = card.querySelector('.card-thumbnails');
    const visual = card.querySelector('[data-gallery-card]');
    if (!strip || !visual) return;
    const current = Number(visual.dataset.imageIndex) || 0;
    strip.querySelectorAll('.card-thumb').forEach((button, index) => button.classList.toggle('is-active', index === current));
  };

  const installCardThumbnails = () => {
    const catalogGrid = document.getElementById('catalogGrid');
    if (!catalogGrid) return;
    catalogGrid.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.card-thumbnails')) return;
      const product = findCatalogProduct(card);
      const gallery = product?.gallery || [];
      if (gallery.length < 2) return;
      const visual = card.querySelector('[data-gallery-card]');
      if (!visual) return;

      const strip = document.createElement('div');
      strip.className = 'card-thumbnails';
      strip.setAttribute('aria-label', `Фотографии ${product.art}`);
      gallery.forEach((url, index) => {
        const button = document.createElement('button');
        button.className = `card-thumb${index === 0 ? ' is-active' : ''}`;
        button.type = 'button';
        button.setAttribute('aria-label', `Показать фото ${index + 1}`);
        const image = document.createElement('img');
        image.src = url;
        image.alt = '';
        image.loading = 'lazy';
        button.append(image);
        button.addEventListener('click', event => {
          event.stopPropagation();
          const current = Number(visual.dataset.imageIndex) || 0;
          const delta = index - current;
          if (delta && typeof shiftCardImage === 'function') shiftCardImage(visual, delta);
          syncCardThumbs(card);
        });
        strip.append(button);
      });
      visual.after(strip);
      new MutationObserver(() => syncCardThumbs(card)).observe(visual, {attributes:true, attributeFilter:['data-image-index']});
    });
  };

  const catalogGrid = document.getElementById('catalogGrid');
  if (catalogGrid) {
    installCardThumbnails();
    new MutationObserver(() => queueMicrotask(installCardThumbnails)).observe(catalogGrid, {childList:true, subtree:false});
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxStage = document.querySelector('.lightbox-stage');
  const lightboxImage = document.getElementById('lightboxImage');
  let lightboxThumbStrip = null;
  if (lightbox && lightboxStage && lightboxImage) {
    lightboxThumbStrip = document.createElement('div');
    lightboxThumbStrip.className = 'lightbox-thumbnails';
    lightboxThumbStrip.hidden = true;
    const caption = lightbox.querySelector('.lightbox-caption');
    lightbox.insertBefore(lightboxThumbStrip, caption || null);
  }

  const syncLightboxThumbs = () => {
    if (!lightboxThumbStrip || !lightboxImage) return;
    const current = lightboxImage.getAttribute('src') || '';
    lightboxThumbStrip.querySelectorAll('.lightbox-thumb').forEach(button => button.classList.toggle('is-active', button.dataset.src === current));
  };

  const renderLightboxThumbs = gallery => {
    if (!lightboxThumbStrip) return;
    lightboxThumbStrip.replaceChildren();
    if (!Array.isArray(gallery) || gallery.length < 2) {
      lightboxThumbStrip.hidden = true;
      return;
    }
    gallery.forEach((url, index) => {
      const button = document.createElement('button');
      button.className = 'lightbox-thumb';
      button.type = 'button';
      button.dataset.src = url;
      button.setAttribute('aria-label', `Открыть фото ${index + 1}`);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
      button.addEventListener('click', () => {
        if (typeof lightboxIndex !== 'undefined') lightboxIndex = index;
        if (typeof showLightboxImage === 'function') showLightboxImage();
        syncLightboxThumbs();
      });
      lightboxThumbStrip.append(button);
    });
    lightboxThumbStrip.hidden = false;
    syncLightboxThumbs();
  };

  document.addEventListener('click', event => {
    const zoomButton = event.target.closest('[data-zoom]');
    if (zoomButton) {
      const product = findCatalogProduct(zoomButton.closest('.product-card'));
      if (product) setTimeout(() => renderLightboxThumbs(product.gallery), 0);
      return;
    }
    if (event.target.closest('[data-proof-image]')) setTimeout(() => renderLightboxThumbs([]), 0);
  });
  if (lightboxImage) new MutationObserver(syncLightboxThumbs).observe(lightboxImage, {attributes:true, attributeFilter:['src']});

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
  setText('.hero-prices > div:nth-child(2) small', 'Под ключ');

  const heroPoints = document.querySelectorAll('.hero-points > span');
  if (heroPoints[0] && site.warrantyYears) setBoldLine(heroPoints[0], `${site.warrantyYears} ${yearWord(site.warrantyYears)}`, 'гарантии на конструкцию');
  if (heroPoints[1] && site.productionDays) setBoldLine(heroPoints[1], `до ${site.productionDays} раб. дней`, 'срок изготовления');

  const productionText = document.querySelector('.package-grid article:nth-child(6) p');
  if (productionText && site.productionDays) productionText.textContent = `По размерам вашего проёма, до ${site.productionDays} рабочих дней.`;

  const trustCopy = document.querySelector('.trust-copy > p');
  if (trustCopy && site.trustText) trustCopy.textContent = `${site.trustText} Гарантия на конструкцию — ${site.warrantyYears} ${yearWord(site.warrantyYears)}.`;
  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');
  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;

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

  // Упрощаем управление каталогом: поиск по артикулу убран, сортировка только по цене.
  const articleSearchLabel = document.querySelector('.search-label');
  if (articleSearchLabel) articleSearchLabel.remove();
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.querySelector('option[value="recommended"]')?.remove();
    sortSelect.value = 'price-asc';
    sortSelect.dispatchEvent(new Event('change'));
  }

  // Мобильный калькулятор: стандартный размер сворачиваем, чтобы не тратить экран на поля, которые редко меняют.
  const dimensions = document.querySelector('.dimensions');
  const widthInput = document.getElementById('widthInput');
  const wicketWidthInput = document.getElementById('wicketWidthInput');
  const heightInput = document.getElementById('heightInput');
  const wicketHeightInput = document.getElementById('wicketHeightInput');
  const sizeNotice = document.getElementById('sizeNotice');
  const productSelect = document.getElementById('productSelect');
  if (dimensions && !document.querySelector('.mobile-size-summary')) {
    dimensions.classList.add('mobile-collapsible');
    const summary = document.createElement('div');
    summary.className = 'mobile-size-summary';
    const copy = document.createElement('div');
    const kicker = document.createElement('small');
    kicker.textContent = 'Стандартный размер';
    const value = document.createElement('strong');
    value.id = 'mobileSizeSummaryText';
    copy.append(kicker, value);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Изменить';
    toggle.setAttribute('aria-expanded', 'false');
    summary.append(copy, toggle);
    dimensions.before(summary);

    const updateSizeSummary = () => {
      const width = String(widthInput?.value || '').replace('.', ',');
      const height = String(heightInput?.value || '').replace('.', ',');
      const wicket = String(wicketWidthInput?.value || '').replace('.', ',');
      const wicketHeight = String(wicketHeightInput?.value || heightInput?.value || '').replace('.', ',');
      kicker.textContent = sizeNotice?.hidden === false ? 'Ваш размер' : 'Стандартный размер';
      value.textContent = wicket ? `Ворота ${width} × ${height} м · калитка ${wicket} × ${wicketHeight} м` : `${width} × ${height} м`;
    };
    toggle.addEventListener('click', () => {
      const open = dimensions.classList.toggle('is-open');
      toggle.textContent = open ? 'Скрыть' : 'Изменить';
      toggle.setAttribute('aria-expanded', String(open));
      if (open) widthInput?.focus({preventScroll:true});
    });
    [widthInput, wicketWidthInput, heightInput, wicketHeightInput, productSelect].filter(Boolean).forEach(element => element.addEventListener('input', () => setTimeout(updateSizeSummary, 0)));
    productSelect?.addEventListener('change', () => setTimeout(updateSizeSummary, 0));
    updateSizeSummary();
  }

  // Комментарий раскрывается только по желанию клиента.
  const commentLabel = document.querySelector('.lead-comment');
  if (commentLabel && !document.querySelector('.mobile-comment-toggle')) {
    const commentToggle = document.createElement('button');
    commentToggle.type = 'button';
    commentToggle.className = 'mobile-comment-toggle';
    commentToggle.textContent = 'Добавить комментарий';
    commentLabel.before(commentToggle);
    commentToggle.addEventListener('click', () => {
      const open = commentLabel.classList.toggle('is-open');
      commentToggle.classList.toggle('is-open', open);
      commentToggle.textContent = open ? 'Скрыть комментарий' : 'Добавить комментарий';
      if (open) commentLabel.querySelector('textarea')?.focus({preventScroll:true});
    });
  }

  // Согласие делаем короче, сохраняя ссылку на политику.
  const consentText = document.querySelector('.consent-row > span');
  if (consentText) {
    const link = consentText.querySelector('a');
    if (link) {
      link.textContent = 'Политика обработки данных';
      consentText.replaceChildren(document.createTextNode('Согласен на обработку данных. '), link);
    }
  }

  // Понятный статус доставки без дублирования населённого пункта.
  const cityInput = document.getElementById('cityInput');
  const deliveryResult = document.getElementById('deliveryResult');
  if (deliveryResult && cityInput) {
    let deliveryRewriteBusy = false;
    const simplifyDelivery = () => {
      if (deliveryRewriteBusy) return;
      const current = deliveryResult.textContent.trim();
      const city = cityInput.value.trim();
      let next = current;
      if (/населённый пункт выбран/i.test(current)) {
        next = city.toLocaleLowerCase('ru-RU') === 'мелеуз' ? 'Доставка по Мелеузу — бесплатно' : `${city} · доставка учтена в итоговой цене`;
      } else if (/населённый пункт подтверждён/i.test(current)) {
        next = `${city} · доставка учтена в итоговой цене`;
      }
      if (next !== current) {
        deliveryRewriteBusy = true;
        deliveryResult.textContent = next;
        queueMicrotask(() => { deliveryRewriteBusy = false; });
      }
    };
    new MutationObserver(simplifyDelivery).observe(deliveryResult, {childList:true, subtree:true, characterData:true});
    cityInput.addEventListener('change', () => setTimeout(simplifyDelivery, 0));
    simplifyDelivery();
  }

  // Монтаж входит в базовую цену: скрываем его как отдельную опцию и оставляем только компактный выбор новых столбов.
  const installCheck = document.getElementById('installCheck');
  const postsCheck = document.getElementById('postsCheck');
  const postsTitle = document.getElementById('postsTitle');
  const installationBlock = installCheck?.closest('.form-block');
  if (installCheck && postsCheck && installationBlock) {
    installationBlock.classList.add('simplified-posts-block');
    installCheck.closest('.choice')?.classList.add('base-install-choice');
    if (!installCheck.checked) {
      installCheck.checked = true;
      installCheck.dispatchEvent(new Event('change', {bubbles:true}));
    }
    const stepLabel = installationBlock.querySelector('.step-label');
    if (stepLabel) stepLabel.textContent = '02 · Столбы';
    if (postsTitle) postsTitle.textContent = 'Добавить новые усиленные столбы';
    let note = installationBlock.querySelector('.base-install-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'base-install-note';
      const optionList = installationBlock.querySelector('.option-list');
      if (optionList) optionList.before(note);
    }
    const syncInstallNote = () => {
      note.textContent = postsCheck.checked
        ? 'Расчёт под ключ с новыми усиленными столбами'
        : 'В цену уже входит установка на готовые столбы';
    };
    postsCheck.addEventListener('change', syncInstallNote);
    syncInstallNote();
  }

  // В раскрываемом составе мобильной цены не дублируем монтаж отдельной строкой.
  const simplifyMobilePriceLines = () => {
    document.querySelectorAll('.mobile-price-lines .estimate-line').forEach(line => {
      if (/монтаж/i.test(line.textContent || '')) line.style.display = 'none';
    });
  };
  new MutationObserver(simplifyMobilePriceLines).observe(document.body, {childList:true, subtree:true});
  simplifyMobilePriceLines();

  // Мобильная карточка выбранной модели — компактно показываем только артикул.
  const selectedProductCaption = document.getElementById('selectedProductCaption');
  let captionSyncBusy = false;
  const simplifySelectedCaption = () => {
    if (!selectedProductCaption || window.innerWidth > 620 || captionSyncBusy) return;
    const current = selectedProductCaption.textContent.trim();
    const match = current.match(/Арт\.\s*[0-9А-Яа-яA-Za-z-]+/u);
    if (match && current !== match[0]) {
      captionSyncBusy = true;
      selectedProductCaption.textContent = match[0];
      queueMicrotask(() => { captionSyncBusy = false; });
    }
  };
  if (selectedProductCaption) {
    new MutationObserver(simplifySelectedCaption).observe(selectedProductCaption, {childList:true, subtree:true, characterData:true});
    simplifySelectedCaption();
  }

  // Последний шаг формулируем короче и понятнее.
  const leadHeadingText = document.querySelector('.mobile-lead-heading p');
  if (leadHeadingText) leadHeadingText.textContent = 'Телефон нужен для согласования бесплатного замера.';

  // Нижняя панель становится главным действием: сначала «Продолжить», затем «Отправить».
  const calculator = document.getElementById('calculator');
  const leadRequest = document.getElementById('leadRequest');
  const mobilePrimaryCta = document.getElementById('mobilePrimaryCta');
  const mobileEstimateTotal = document.getElementById('mobileEstimateTotal');
  const sendButton = document.getElementById('sendButton');
  const estimateSummary = document.querySelector('#estimateBreakdown > summary');
  let leadStageActive = false;
  let ctaSyncBusy = false;

  const syncEstimateSummary = () => {
    if (!estimateSummary || window.innerWidth > 620) return;
    const price = mobileEstimateTotal?.textContent?.trim() || '';
    estimateSummary.textContent = price ? `Что входит в ${price}` : 'Что входит в стоимость';
  };

  const syncMobileCta = () => {
    if (!mobilePrimaryCta || ctaSyncBusy) return;
    let next = 'Рассчитать стоимость';
    if (calculator && !calculator.hidden) {
      const price = mobileEstimateTotal?.textContent?.trim() || '';
      next = `${leadStageActive ? 'Отправить' : 'Продолжить'}${price ? ` · ${price}` : ''}`;
    }
    if (mobilePrimaryCta.textContent !== next) {
      ctaSyncBusy = true;
      mobilePrimaryCta.textContent = next;
      queueMicrotask(() => { ctaSyncBusy = false; });
    }
    syncEstimateSummary();
  };

  const updateLeadStage = () => {
    if (!leadRequest || !calculator || calculator.hidden || window.innerWidth > 620) {
      leadStageActive = false;
      syncMobileCta();
      return;
    }
    const rect = leadRequest.getBoundingClientRect();
    const next = rect.top < window.innerHeight * .72 && rect.bottom > 80;
    if (next !== leadStageActive) {
      leadStageActive = next;
      syncMobileCta();
    }
  };

  if (mobilePrimaryCta) {
    mobilePrimaryCta.addEventListener('click', event => {
      if (!calculator || calculator.hidden) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (leadStageActive) sendButton?.click();
      else leadRequest?.scrollIntoView({behavior:'smooth', block:'start'});
    }, true);
    new MutationObserver(syncMobileCta).observe(mobilePrimaryCta, {childList:true, subtree:true, characterData:true});
  }
  if (mobileEstimateTotal) new MutationObserver(() => { syncMobileCta(); syncEstimateSummary(); }).observe(mobileEstimateTotal, {childList:true, subtree:true, characterData:true});
  if (calculator) new MutationObserver(() => { updateLeadStage(); syncMobileCta(); }).observe(calculator, {attributes:true, attributeFilter:['hidden']});

  // После выбора модели доводим прокрутку ровно до начала калькулятора, без хвоста предыдущей карточки.
  if (catalogGrid) {
    catalogGrid.addEventListener('click', event => {
      if (!event.target.closest('.select-product') || window.innerWidth > 620) return;
      window.setTimeout(() => {
        const preview = document.querySelector('.selected-product-preview');
        if (preview && calculator && !calculator.hidden) preview.scrollIntoView({behavior:'smooth', block:'start'});
      }, 460);
    }, true);
  }

  window.addEventListener('scroll', updateLeadStage, {passive:true});
  window.addEventListener('resize', () => { updateLeadStage(); simplifySelectedCaption(); syncEstimateSummary(); }, {passive:true});
  updateLeadStage();
  syncEstimateSummary();
  syncMobileCta();


  // Desktop UX sync with mobile flow 2026-09
  if (window.innerWidth > 620) {
    const desktopUiStyle = document.createElement('style');
    desktopUiStyle.textContent = `
      .desktop-overlay{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.6);backdrop-filter:blur(3px)}
      .desktop-dialog{position:relative;width:min(620px,calc(100vw - 48px));max-height:min(82vh,760px);overflow:auto;background:#f5f1e9;color:#17191c;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.42);padding:28px}
      .desktop-dialog h3{font:30px/1.15 Prata,serif;margin:0 42px 10px 0}
      .desktop-dialog p{color:#6d675f;font-size:13px;line-height:1.6;margin:8px 0}
      .desktop-dialog-close{position:absolute;right:16px;top:14px;width:36px;height:36px;border:0;border-radius:50%;background:#e8e1d6;color:#17191c;font-size:24px;cursor:pointer}
      .desktop-dialog-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
      .desktop-dialog-actions button,.desktop-dialog-actions a{min-height:46px;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
      .desktop-dialog-actions .secondary{border:1px solid rgba(17,18,20,.14);background:#fff;color:#17191c}
      .desktop-dialog-actions .primary{border:0;background:linear-gradient(135deg,var(--gold-light),var(--gold));color:#17120b}
      .desktop-policy-content{margin-top:14px;padding-top:6px;border-top:1px solid rgba(17,18,20,.1)}
      .desktop-policy-content h2{font:24px/1.25 Prata,serif;margin:18px 0 10px}
      .desktop-policy-content p{font-size:12px;line-height:1.65}
      #leadRequest.desktop-sending{opacity:.78;pointer-events:none}
    `;
    document.head.append(desktopUiStyle);

    const selectedPreviewCaption = document.querySelector('.selected-product-preview figcaption');
    if (selectedPreviewCaption && !selectedPreviewCaption.querySelector('.desktop-change-model')) {
      const changeButton = document.createElement('button');
      changeButton.type = 'button';
      changeButton.className = 'desktop-change-model';
      changeButton.textContent = '← Выбрать другой дизайн';
      changeButton.addEventListener('click', () => {
        if (typeof closeInlineCalculator === 'function') closeInlineCalculator();
        document.getElementById('catalog')?.scrollIntoView({behavior:'smooth', block:'start'});
      });
      selectedPreviewCaption.append(changeButton);
    }

    const desktopLeadFields = document.querySelector('#leadRequest .lead-fields');
    const desktopPhoneInput = document.getElementById('phoneInput');
    const desktopNameInput = document.getElementById('nameInput');
    const desktopPhoneLabel = desktopPhoneInput?.closest('label');
    const desktopNameLabel = desktopNameInput?.closest('label');
    if (desktopLeadFields && desktopPhoneLabel && desktopNameLabel) {
      desktopLeadFields.prepend(desktopPhoneLabel);
      desktopPhoneLabel.after(desktopNameLabel);
      const nameText = [...desktopNameLabel.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
      if (nameText) nameText.textContent = 'Как к вам обращаться (необязательно)';
    }

    const desktopLeadHeading = document.querySelector('#leadRequest .mobile-lead-heading h3');
    const desktopLeadText = document.querySelector('#leadRequest .mobile-lead-heading p');
    if (desktopLeadHeading) desktopLeadHeading.textContent = 'Заказать бесплатный замер';
    if (desktopLeadText) desktopLeadText.textContent = 'Оставьте телефон — мы свяжемся, согласуем замер и окончательную стоимость.';
    const desktopSendButton = document.getElementById('sendButton');
    if (desktopSendButton) desktopSendButton.textContent = 'Отправить заявку';

    const removeDesktopOverlay = overlay => {
      overlay?.remove();
      document.body.style.overflow = '';
    };

    const makeDesktopOverlay = ({title, body, actions = [], className = ''}) => {
      const overlay = document.createElement('div');
      overlay.className = 'desktop-overlay';
      const dialog = document.createElement('div');
      dialog.className = `desktop-dialog ${className}`.trim();
      dialog.setAttribute('role','dialog');
      dialog.setAttribute('aria-modal','true');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'desktop-dialog-close';
      close.setAttribute('aria-label','Закрыть');
      close.textContent = '×';
      const heading = document.createElement('h3');
      heading.textContent = title;
      dialog.append(close, heading);
      if (body instanceof Node) dialog.append(body); else if (body) {
        const paragraph = document.createElement('p');
        paragraph.textContent = body;
        dialog.append(paragraph);
      }
      if (actions.length) {
        const footer = document.createElement('div');
        footer.className = 'desktop-dialog-actions';
        actions.forEach(action => footer.append(action));
        dialog.append(footer);
      }
      overlay.append(dialog);
      document.body.append(overlay);
      document.body.style.overflow = 'hidden';
      const finish = () => removeDesktopOverlay(overlay);
      close.addEventListener('click', finish);
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(); });
      document.addEventListener('keydown', function onKey(event){ if(event.key==='Escape'){ finish(); document.removeEventListener('keydown',onKey); } });
      return {overlay, dialog, close:finish};
    };

    document.querySelectorAll('a[href="#privacyPolicy"]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const source = document.querySelector('#privacyPolicy .privacy-content');
        const content = source ? source.cloneNode(true) : document.createElement('div');
        content.classList.add('desktop-policy-content');
        const continueButton = document.createElement('button');
        continueButton.type = 'button';
        continueButton.className = 'primary';
        continueButton.textContent = 'Продолжить оформление заказа';
        const modal = makeDesktopOverlay({title:'Политика обработки персональных данных', body:content, actions:[continueButton]});
        continueButton.addEventListener('click', () => modal.close());
      });
    });

    const showDesktopSuccess = payload => {
      const message = document.createElement('div');
      message.innerHTML = '<p><b>Заявка получена.</b> Мы свяжемся с вами для согласования бесплатного замера.</p><p>Дополнительно писать в WhatsApp не обязательно.</p>';
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'secondary';
      closeButton.textContent = 'Закрыть';
      const whatsapp = document.createElement('a');
      whatsapp.className = 'primary';
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener';
      whatsapp.textContent = 'Написать в WhatsApp';
      const whatsappDigits = String((window.SITE_SETTINGS||{}).whatsappDigits||'79373296750');
      whatsapp.href = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(payload.message || '')}`;
      const modal = makeDesktopOverlay({title:'Спасибо! Заявка получена', body:message, actions:[closeButton, whatsapp]});
      closeButton.addEventListener('click', () => modal.close());
      whatsapp.addEventListener('click', () => { if(window.ym) ym(107269914,'reachGoal','whatsapp_after_lead',{article:payload.article||''}); });
    };

    document.addEventListener('click', async event => {
      const button = event.target.closest('#sendButton');
      if (!button || window.innerWidth <= 620) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const phone = document.getElementById('phoneInput');
      const city = document.getElementById('cityInput');
      const consent = document.getElementById('consentInput');
      const phoneDigits = String(phone?.value || '').replace(/\D/g,'');
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        phone?.setAttribute('aria-invalid','true');
        phone?.focus();
        if (typeof showToast === 'function') showToast('Укажите номер телефона');
        return;
      }
      if (!city?.value.trim()) {
        city?.focus();
        if (typeof showToast === 'function') showToast('Укажите населённый пункт');
        return;
      }
      if (consent && !consent.checked) {
        consent.setAttribute('aria-invalid','true');
        consent.focus();
        if (typeof showToast === 'function') showToast('Подтвердите согласие на обработку данных');
        return;
      }
      if (typeof leadPayload !== 'function') {
        if (typeof showToast === 'function') showToast('Не удалось подготовить заявку');
        return;
      }

      const payload = leadPayload();
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Отправляем…';
      document.getElementById('leadRequest')?.classList.add('desktop-sending');
      try {
        const response = await fetch('/api/leads', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify(payload)
        });
        if (!response.ok) {
          const data = await response.json().catch(()=>({}));
          throw new Error(data.error || 'Не удалось сохранить заявку');
        }
        if (window.ym && typeof selectedProduct === 'function') ym(107269914,'reachGoal','lead_saved',{article:selectedProduct().art,city:typeof selectedCityName==='function'?selectedCityName():city.value.trim()});
        showDesktopSuccess(payload);
      } catch (error) {
        if (typeof showToast === 'function') showToast(error?.message || 'Не удалось отправить заявку');
      } finally {
        button.disabled = false;
        button.textContent = originalText || 'Отправить заявку';
        document.getElementById('leadRequest')?.classList.remove('desktop-sending');
      }
    }, true);
  }

})();