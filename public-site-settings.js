(() => {
  const site = window.SITE_SETTINGS || {};

  // Витрина v3: товарная фотогалерея без чёрных полей и размытого фона.
  // Исходные фото всегда показываются целиком, без обрезки и искажения.
  const storefrontStyle = document.createElement('style');
  storefrontStyle.textContent = `
    /* Первый экран: строгая двухколоночная сетка, без наложений. */
    @media(min-width:901px){
      .hero{
        display:grid!important;
        grid-template-columns:minmax(0,560px) minmax(360px,520px)!important;
        grid-template-rows:auto auto auto auto auto auto!important;
        column-gap:64px!important;
        align-content:center!important;
        justify-content:center!important;
        min-height:700px!important;
        padding:132px 44px 54px!important;
      }
      .hero>*:not(.hero-photo){
        width:100%!important;
        max-width:560px!important;
        margin-left:0!important;
        margin-right:0!important;
      }
      .hero>.eyebrow{grid-column:1;grid-row:1;margin-bottom:17px!important}
      .hero>h1{grid-column:1;grid-row:2;font-size:clamp(46px,4.25vw,64px)!important;line-height:1.05!important;margin:0 0 20px!important}
      .hero>p{grid-column:1;grid-row:3;font-size:15px!important;line-height:1.62!important;margin:0 0 20px!important;color:rgba(255,255,255,.68)!important}
      .hero>.hero-prices{
        grid-column:1;grid-row:4;
        width:100%!important;
        max-width:560px!important;
        margin:0!important;
        display:grid!important;
        grid-template-columns:1fr 1fr!important;
        gap:9px!important;
      }
      .hero-prices>div{padding:13px 14px!important;border-radius:13px!important;min-width:0}
      .hero-prices small{font-size:10px!important}.hero-prices strong{font-size:20px!important}.hero-prices span{font-size:10px!important}
      .hero>.hero-actions{grid-column:1;grid-row:5;margin:18px 0 0!important}
      .hero>.hero-actions .button{min-height:49px;padding:13px 21px!important}
      .hero>.hero-points{grid-column:1;grid-row:6;margin:25px 0 0!important;gap:30px!important}
      .hero-points b{font-size:20px!important}.hero-points span{font-size:10px!important}
      .hero>.hero-photo{
        grid-column:2!important;
        grid-row:1 / 7!important;
        align-self:center!important;
        position:relative!important;
        inset:auto!important;
        top:auto!important;
        right:auto!important;
        bottom:auto!important;
        left:auto!important;
        width:100%!important;
        height:auto!important;
        max-width:520px!important;
        aspect-ratio:16/10!important;
        margin:0!important;
        border-radius:22px!important;
        overflow:hidden!important;
        background:#eeeae2!important;
        box-shadow:0 28px 70px rgba(0,0,0,.34)!important;
      }
      .hero>.hero-photo img{
        position:relative!important;
        width:100%!important;
        height:100%!important;
        object-fit:contain!important;
        object-position:center!important;
        background:#eeeae2!important;
        transform:none!important;
      }
      .catalog{padding-top:70px!important}
    }

    @media(min-width:901px) and (max-width:1180px){
      .hero{grid-template-columns:minmax(0,1.08fr) minmax(350px,.92fr)!important;column-gap:34px!important;padding-left:28px!important;padding-right:28px!important}
      .hero>h1{font-size:clamp(43px,4.5vw,57px)!important}
      .hero>.hero-photo{max-width:470px!important}
    }

    /* Каталог: светлая товарная галерея. */
    .product-card{background:#fff!important}
    .product-card.photo .product-visual,
    .product-card.photo.fit-cover .product-visual,
    .product-card.sketch .product-visual{
      position:relative!important;
      isolation:isolate!important;
      padding:0!important;
      aspect-ratio:13/8!important;
      background:#f1eee7!important;
      overflow:hidden!important;
    }
    .product-image-backdrop{display:none!important}
    .product-card.photo .product-image-open,
    .product-card.photo.fit-cover .product-image-open,
    .product-card.sketch .product-image-open{
      position:absolute!important;
      inset:0!important;
      z-index:1!important;
      width:100%!important;
      height:100%!important;
      padding:10px!important;
      background:#f1eee7!important;
      display:grid!important;
      place-items:center!important;
    }
    .product-card.photo .product-image-open img,
    .product-card.photo.fit-cover .product-image-open img,
    .product-card.sketch .product-image-open img{
      width:100%!important;
      height:100%!important;
      max-width:100%!important;
      max-height:100%!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      filter:none!important;
      background:transparent!important;
      padding:0!important;
    }
    .product-art{
      z-index:5!important;
      top:12px!important;
      right:12px!important;
      background:rgba(255,255,255,.92)!important;
      color:#17191c!important;
      border:1px solid rgba(17,18,20,.12)!important;
      box-shadow:0 5px 18px rgba(17,18,20,.08)!important;
    }
    .product-photo-count{
      z-index:5!important;
      left:auto!important;
      right:12px!important;
      bottom:10px!important;
      padding:6px 9px!important;
      background:rgba(255,255,255,.92)!important;
      color:#5f574d!important;
      border-color:rgba(17,18,20,.12)!important;
      box-shadow:0 4px 14px rgba(17,18,20,.08)!important;
    }
    .card-gallery-arrow{
      z-index:6!important;
      width:34px!important;
      height:34px!important;
      border-color:rgba(17,18,20,.14)!important;
      background:rgba(255,255,255,.92)!important;
      color:#17191c!important;
      box-shadow:0 5px 16px rgba(17,18,20,.12)!important;
    }
    .card-gallery-arrow.previous{left:10px!important}.card-gallery-arrow.next{right:10px!important}

    .card-thumbnails{
      display:flex;
      gap:6px;
      padding:8px 10px 0;
      overflow-x:auto;
      scrollbar-width:none;
      background:#fff;
    }
    .card-thumbnails::-webkit-scrollbar{display:none}
    .card-thumb{
      flex:0 0 56px;
      width:56px;
      height:42px;
      padding:2px;
      border:1px solid #ded8cf;
      border-radius:8px;
      background:#f4f1eb;
      cursor:pointer;
      overflow:hidden;
    }
    .card-thumb img{width:100%;height:100%;display:block;object-fit:contain;object-position:center}
    .card-thumb.is-active{border-color:#c8983c;box-shadow:0 0 0 1px #c8983c inset}

    .product-info{padding:14px 18px 18px!important}
    .product-labels{margin:0 0 7px!important}
    .product-info h3{font-size:20px!important;margin:0 0 5px!important}
    .product-info>p{margin:0 0 10px!important;min-height:0!important;font-size:11px!important}
    .product-meta{margin-bottom:13px!important}
    .product-meta span{font-size:9px!important;padding:5px 7px!important}
    .price-row strong{font-size:20px!important}.price-row.turnkey strong{font-size:16px!important}

    /* Hero, выполненные работы и калькулятор: без чёрных боковых полей. */
    .hero-photo,
    .work-gallery button,
    .selected-product-preview img{background:#f1eee7!important}
    .hero-photo img,
    .work-gallery img,
    .selected-product-preview img{
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      background:#f1eee7!important;
    }
    .work-gallery img{padding:5px!important}

    /* Большой просмотр: светлый фотокаталог с миниатюрами. */
    .lightbox{
      grid-template-rows:minmax(0,1fr) auto auto!important;
      gap:10px!important;
      padding:28px 20px 22px!important;
      background:rgba(244,241,235,.99)!important;
    }
    .lightbox-stage{
      position:relative!important;
      width:min(1240px,96vw)!important;
      height:min(72vh,760px)!important;
      display:grid!important;
      grid-template-columns:48px minmax(0,1fr) 48px!important;
      gap:10px!important;
      align-items:center!important;
    }
    .lightbox-stage>#lightboxImage{
      width:100%!important;
      height:100%!important;
      max-width:none!important;
      max-height:none!important;
      padding:12px!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
      background:#fff!important;
      border:1px solid rgba(17,18,20,.1)!important;
      border-radius:16px!important;
      box-shadow:0 18px 48px rgba(17,18,20,.1)!important;
    }
    .lightbox-arrow{
      background:#fff!important;
      border-color:rgba(17,18,20,.16)!important;
      color:#17191c!important;
      box-shadow:0 7px 22px rgba(17,18,20,.11)!important;
    }
    .lightbox-close{
      background:#fff!important;
      border-color:rgba(17,18,20,.16)!important;
      color:#17191c!important;
      box-shadow:0 7px 22px rgba(17,18,20,.11)!important;
    }
    .lightbox-thumbnails{
      display:flex;
      justify-content:center;
      gap:7px;
      max-width:min(850px,92vw);
      padding:2px 0;
      overflow-x:auto;
      scrollbar-width:none;
    }
    .lightbox-thumbnails::-webkit-scrollbar{display:none}
    .lightbox-thumb{
      flex:0 0 78px;
      width:78px;
      height:56px;
      padding:3px;
      border:1px solid #d6d0c7;
      border-radius:9px;
      background:#fff;
      overflow:hidden;
      cursor:pointer;
    }
    .lightbox-thumb img{width:100%;height:100%;display:block;object-fit:contain;object-position:center}
    .lightbox-thumb.is-active{border-color:#c8983c;box-shadow:0 0 0 1px #c8983c inset}
    .lightbox-caption{padding-top:0!important;color:#17191c!important}
    .lightbox-caption span{color:#8a6326!important}.lightbox-caption small{color:#756f67!important}

    /* Планшет и мобильный: тот же путь без лишней высоты. */
    @media(max-width:900px){
      .hero{
        min-height:0!important;
        padding-top:120px!important;
        padding-bottom:34px!important;
      }
      .hero-photo{
        position:relative!important;
        inset:auto!important;
        width:min(100%,620px)!important;
        height:auto!important;
        aspect-ratio:16/10!important;
        margin:26px auto 0!important;
        border-radius:18px!important;
        background:#f1eee7!important;
      }
      .catalog{padding-top:58px!important}
    }

    @media(max-width:620px){
      .hero{padding-top:102px!important;padding-bottom:26px!important}
      .hero h1{font-size:34px!important;line-height:1.08!important;margin-bottom:14px!important}
      .hero>p{font-size:13px!important;line-height:1.5!important}
      .hero-prices{grid-template-columns:1fr 1fr!important;gap:7px!important}
      .hero-prices>div{padding:10px 10px!important}.hero-prices strong{font-size:17px!important}.hero-prices span{font-size:9px!important}
      .hero-actions{margin-top:13px!important}.hero-actions .button{min-height:48px!important}
      .hero-points{margin-top:18px!important;grid-template-columns:repeat(3,1fr)!important;gap:7px!important}
      .hero-points b{font-size:15px!important}.hero-points span{font-size:9px!important}
      .hero-photo{margin-top:20px!important;aspect-ratio:16/10!important}
      .catalog{padding-top:50px!important}
      .product-card.photo .product-image-open,.product-card.photo.fit-cover .product-image-open,.product-card.sketch .product-image-open{padding:6px!important}
      .card-thumbnails{padding:7px 8px 0;gap:5px}.card-thumb{flex-basis:52px;width:52px;height:39px}
      .product-info{padding:13px 15px 16px!important}.product-info>p{display:none!important}.product-meta{margin-bottom:11px!important}
      .lightbox{padding:56px 7px 15px!important;gap:8px!important}
      .lightbox-stage{width:100%!important;height:64vh!important;grid-template-columns:36px minmax(0,1fr) 36px!important;gap:3px!important}
      .lightbox-stage>#lightboxImage{padding:5px!important;border-radius:10px!important}
      .lightbox-thumbnails{justify-content:flex-start;max-width:88vw}.lightbox-thumb{flex-basis:64px;width:64px;height:47px}
      .lightbox-caption{gap:5px!important;text-align:center!important;align-items:center!important}
    }
  `;
  document.head.append(storefrontStyle);

  // Удаляем элементы старой версии с размытым фоном, если страница обновилась из кэша частично.
  document.querySelectorAll('.soft-gallery-backdrop').forEach(node => node.remove());
  document.querySelectorAll('.soft-photo-frame').forEach(node => node.classList.remove('soft-photo-frame'));

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

  // Миниатюры в большом просмотре.
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
    lightboxThumbStrip.querySelectorAll('.lightbox-thumb').forEach(button => {
      button.classList.toggle('is-active', button.dataset.src === current);
    });
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
      const card = zoomButton.closest('.product-card');
      const product = findCatalogProduct(card);
      if (product) setTimeout(() => renderLightboxThumbs(product.gallery), 0);
      return;
    }
    if (event.target.closest('[data-proof-image]')) {
      setTimeout(() => renderLightboxThumbs([]), 0);
    }
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
