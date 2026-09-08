(() => {
  const site = window.SITE_SETTINGS || {};

  // Галерея v2: исходное фото всегда показывается целиком, а свободное место
  // заполняется мягкой размытой копией того же снимка вместо чёрных полос.
  const galleryStyle = document.createElement('style');
  galleryStyle.textContent = `
    .product-card.photo .product-visual,
    .product-card.photo.fit-cover .product-visual{
      padding:0!important;
      background:#ece8df!important;
      isolation:isolate;
    }
    .product-card.photo .product-image-backdrop,
    .product-card.photo.fit-cover .product-image-backdrop{
      display:block!important;
      position:absolute!important;
      z-index:0!important;
      inset:-24px!important;
      width:calc(100% + 48px)!important;
      height:calc(100% + 48px)!important;
      max-width:none!important;
      max-height:none!important;
      object-fit:cover!important;
      object-position:center!important;
      filter:blur(22px) saturate(.82) brightness(1.08)!important;
      opacity:.55!important;
      transform:scale(1.14)!important;
      pointer-events:none!important;
    }
    .product-card.photo .product-visual::after{
      content:"";
      position:absolute;
      z-index:1;
      inset:0;
      background:rgba(246,243,236,.18);
      pointer-events:none;
    }
    .product-card.photo .product-image-open,
    .product-card.photo.fit-cover .product-image-open{
      inset:0!important;
      z-index:2!important;
      width:100%!important;
      height:100%!important;
      padding:9px!important;
      background:transparent!important;
    }
    .product-card.photo .product-image-open img,
    .product-card.photo.fit-cover .product-image-open img{
      position:relative!important;
      z-index:3!important;
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      background:transparent!important;
      filter:drop-shadow(0 5px 14px rgba(0,0,0,.16))!important;
    }
    .product-card.sketch .product-image-backdrop{display:none!important}
    .product-art,.product-photo-count{z-index:5!important}
    .card-gallery-arrow{z-index:6!important}

    /* Не меняем position у контейнера: hero-photo на десктопе должен оставаться absolute. */
    .soft-photo-frame{
      isolation:isolate;
      overflow:hidden!important;
      background:#ece8df!important;
    }
    .soft-photo-frame>.soft-gallery-backdrop{
      display:block!important;
      position:absolute!important;
      z-index:0!important;
      inset:-28px!important;
      width:calc(100% + 56px)!important;
      height:calc(100% + 56px)!important;
      max-width:none!important;
      max-height:none!important;
      padding:0!important;
      border-radius:0!important;
      object-fit:cover!important;
      object-position:center!important;
      filter:blur(24px) saturate(.8) brightness(1.06)!important;
      opacity:.52!important;
      transform:scale(1.12)!important;
      pointer-events:none!important;
    }
    .soft-photo-frame>.soft-gallery-main{
      position:relative!important;
      z-index:1!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      background:transparent!important;
    }
    .hero-photo.soft-photo-frame>.soft-gallery-main,
    .work-gallery .soft-photo-frame>.soft-gallery-main{
      padding:0!important;
    }

    /* Десктоп: фото и цены занимают свои колонки и больше не накладываются. */
    @media(min-width:901px){
      .hero>.hero-prices{
        width:590px!important;
        max-width:590px!important;
        margin-left:calc((100vw - min(1280px,100vw))/2)!important;
        margin-right:auto!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
      .hero-photo{
        top:188px!important;
        right:max(24px,calc((100vw - 1280px)/2 + 44px))!important;
        width:min(38vw,480px)!important;
        height:auto!important;
        aspect-ratio:16/10!important;
      }
    }

    .lightbox{
      background:rgba(239,235,226,.985)!important;
    }
    .lightbox-stage{position:relative!important;isolation:isolate}
    .lightbox-stage>.soft-gallery-backdrop{
      position:absolute!important;
      z-index:0!important;
      top:0!important;
      bottom:0!important;
      left:58px!important;
      right:58px!important;
      width:calc(100% - 116px)!important;
      height:100%!important;
      max-width:none!important;
      max-height:none!important;
      object-fit:cover!important;
      object-position:center!important;
      filter:blur(28px) saturate(.8) brightness(1.08)!important;
      opacity:.5!important;
      transform:scale(1.04)!important;
      border-radius:18px!important;
      pointer-events:none!important;
    }
    .lightbox-stage>#lightboxImage{
      position:relative!important;
      z-index:1!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      background:transparent!important;
      border-radius:16px;
    }
    .lightbox-arrow{position:relative;z-index:2;background:rgba(255,255,255,.78)!important;border-color:rgba(17,18,20,.16)!important;color:#17191c!important;box-shadow:0 8px 24px rgba(17,18,20,.12)}
    .lightbox-close{background:rgba(255,255,255,.88)!important;border-color:rgba(17,18,20,.16)!important;color:#17191c!important;box-shadow:0 8px 24px rgba(17,18,20,.12)}
    .lightbox-caption{color:#17191c!important}
    .lightbox-caption span{color:#8a6326!important}
    .lightbox-caption small{color:#756f67!important}

    @media(max-width:620px){
      .product-card.photo .product-image-open,
      .product-card.photo.fit-cover .product-image-open{padding:6px!important}
      .lightbox-stage>.soft-gallery-backdrop{left:39px!important;right:39px!important;width:calc(100% - 78px)!important}
    }
  `;
  document.head.append(galleryStyle);

  const addSoftBackdrop = (frame, image) => {
    if (!frame || !image || frame.querySelector(':scope > .soft-gallery-backdrop')) return;
    frame.classList.add('soft-photo-frame');
    image.classList.add('soft-gallery-main');
    const backdrop = image.cloneNode(false);
    backdrop.removeAttribute('id');
    backdrop.removeAttribute('alt');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.className = 'soft-gallery-backdrop';
    backdrop.loading = 'lazy';
    frame.insertBefore(backdrop, image);

    const sync = () => {
      if (image.currentSrc || image.src) backdrop.src = image.currentSrc || image.src;
    };
    sync();
    new MutationObserver(sync).observe(image, {attributes:true, attributeFilter:['src','srcset']});
  };

  addSoftBackdrop(document.querySelector('.hero-photo'), document.querySelector('.hero-photo img'));
  document.querySelectorAll('.work-gallery button').forEach(button => addSoftBackdrop(button, button.querySelector('img')));

  const lightboxStage = document.querySelector('.lightbox-stage');
  const lightboxImage = document.getElementById('lightboxImage');
  if (lightboxStage && lightboxImage) {
    const backdrop = document.createElement('img');
    backdrop.className = 'soft-gallery-backdrop';
    backdrop.alt = '';
    backdrop.setAttribute('aria-hidden', 'true');
    lightboxStage.insertBefore(backdrop, lightboxImage);
    const syncLightbox = () => {
      if (lightboxImage.currentSrc || lightboxImage.src) backdrop.src = lightboxImage.currentSrc || lightboxImage.src;
    };
    syncLightbox();
    new MutationObserver(syncLightbox).observe(lightboxImage, {attributes:true, attributeFilter:['src','srcset']});
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
  if (heroPoints[0] && site.warrantyYears) {
    setBoldLine(heroPoints[0], `${site.warrantyYears} ${yearWord(site.warrantyYears)}`, 'гарантии на конструкцию');
  }
  if (heroPoints[1] && site.productionDays) {
    setBoldLine(heroPoints[1], `до ${site.productionDays} раб. дней`, 'срок изготовления');
  }

  const productionText = document.querySelector('.package-grid article:nth-child(6) p');
  if (productionText && site.productionDays) {
    productionText.textContent = `По размерам вашего проёма, до ${site.productionDays} рабочих дней.`;
  }

  const trustCopy = document.querySelector('.trust-copy > p');
  if (trustCopy && site.trustText) {
    trustCopy.textContent = `${site.trustText} Гарантия на конструкцию — ${site.warrantyYears} ${yearWord(site.warrantyYears)}.`;
  }
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
})();
