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
      .hero>.hero-photo{display:none!important}
      .hero{min-height:0!important;padding-bottom:18px!important}
      .hero>.hero-points{margin-top:12px!important}
      .catalog{padding-top:34px!important}
    }
  `;
  document.head.append(mobileHeroStyle);

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
})();