(() => {
  const site = window.SITE_SETTINGS || {};

  const removeColorBadges = root => {
    if (!root) return;
    if (root.nodeType === 1 && root.matches?.('.color-profile-badge')) root.remove();
    root.querySelectorAll?.('.color-profile-badge').forEach(node => node.remove());
  };

  const enhanceColorPicker = picker => {
    if (!picker) return;
    const alreadyEnhanced = picker.dataset.optionalColorUi === 'true';
    const head = picker.querySelector('.profile-color-picker-head');
    const title = head?.querySelector('strong');
    const status = picker.querySelector('.profile-color-status');
    const swatches = picker.querySelector('.profile-color-swatches');
    const note = picker.querySelector('.profile-color-note');
    const desiredTitle = 'Любой цвет профнастила';
    const desiredNote = 'Цвет можно выбрать позже — на предварительную стоимость он не влияет.';
    if (title && title.textContent !== desiredTitle) title.textContent = desiredTitle;
    if (note && note.textContent !== desiredNote) note.textContent = desiredNote;
    if (alreadyEnhanced) return;

    picker.dataset.optionalColorUi = 'true';
    if (status) status.style.display = 'none';
    if (swatches) swatches.style.display = 'none';
    if (note) note.style.display = 'none';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'profile-color-toggle';
    toggle.textContent = 'Посмотреть цвета';
    toggle.setAttribute('aria-expanded','false');
    toggle.style.cssText = 'width:100%;min-height:34px;margin:1px 0 0;padding:7px 10px;border:1px solid rgba(17,18,20,.13);border-radius:9px;background:#f6f3ed;color:#514b43;font:800 9px/1.2 Manrope,Arial,sans-serif;cursor:pointer;text-align:center';

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Скрыть цвета' : 'Посмотреть цвета';
      if (status) status.style.display = open ? '' : 'none';
      if (swatches) swatches.style.display = open ? '' : 'none';
      if (note) note.style.display = open ? '' : 'none';
    });

    head?.after(toggle);
  };

  const syncCatalogDecor = root => {
    if (!root) return;
    removeColorBadges(root);
    if (root.nodeType === 1 && root.matches?.('.profile-color-picker')) enhanceColorPicker(root);
    root.querySelectorAll?.('.profile-color-picker').forEach(enhanceColorPicker);
  };

  const catalogGridForBadges = document.getElementById('catalogGrid');
  if (catalogGridForBadges) {
    syncCatalogDecor(catalogGridForBadges);
    new MutationObserver(records => {
      records.forEach(record => {
        const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
        const picker = target?.matches?.('.profile-color-picker') ? target : target?.closest?.('.profile-color-picker');
        if (picker) enhanceColorPicker(picker);
        record.addedNodes.forEach(node => syncCatalogDecor(node));
      });
    }).observe(catalogGridForBadges,{childList:true,subtree:true});
  }

  const lightboxForHistory = document.getElementById('lightbox');
  if (lightboxForHistory) {
    const LIGHTBOX_HISTORY_KEY = '__kuzdvorLightbox';
    let historyEntryActive = false;
    let closingFromPopstate = false;
    const lightboxIsOpen = () => !lightboxForHistory.hidden;

    const pushLightboxHistory = () => {
      if (history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = true;
        return;
      }
      history.pushState({...(history.state || {}), [LIGHTBOX_HISTORY_KEY]: true}, '', window.location.href);
      historyEntryActive = true;
    };

    const closeLightboxFromHistory = () => {
      if (!lightboxIsOpen()) return;
      closingFromPopstate = true;
      lightboxForHistory.hidden = true;
      document.body.style.overflow = '';
      requestAnimationFrame(() => { closingFromPopstate = false; });
    };

    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'hidden')) return;
      if (lightboxIsOpen()) {
        pushLightboxHistory();
        return;
      }
      if (closingFromPopstate) return;
      if (historyEntryActive && history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = false;
        history.back();
      } else if (!history.state?.[LIGHTBOX_HISTORY_KEY]) {
        historyEntryActive = false;
      }
    }).observe(lightboxForHistory,{attributes:true,attributeFilter:['hidden']});

    window.addEventListener('popstate', event => {
      if (lightboxIsOpen()) {
        historyEntryActive = false;
        closeLightboxFromHistory();
        return;
      }
      if (!event.state?.[LIGHTBOX_HISTORY_KEY]) historyEntryActive = false;
    });

    if (lightboxIsOpen()) pushLightboxHistory();
  }

  const robots = document.querySelector('meta[name="robots"]');
  if (robots) {
    const technicalHost = /(?:workers\.dev|github\.io)$/i.test(window.location.hostname);
    robots.content = technicalHost ? 'noindex,follow' : 'index,follow,max-image-preview:large';
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
  if (heroPoints[0] && site.warrantyYears) setBoldLine(heroPoints[0], `${site.warrantyYears} ${yearWord(site.warrantyYears)}`, 'гарантии на конструкцию');
  if (heroPoints[1] && site.productionDays) setBoldLine(heroPoints[1], `до ${site.productionDays} раб. дней`, 'срок изготовления');

  const productionText = document.querySelector('.package-grid article[data-package="production"] p');
  if (productionText && site.productionDays) productionText.textContent = `По размерам вашего проёма, до ${site.productionDays} рабочих дней.`;

  const trustCopy = document.querySelector('.trust-copy > p');
  if (trustCopy && site.trustText) trustCopy.textContent = `${site.trustText} Гарантия на конструкцию — ${site.warrantyYears} ${yearWord(site.warrantyYears)}.`;
  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');
  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;
  const catalogWarranty = document.getElementById('catalogWarranty');
  if (catalogWarranty && site.warrantyYears) catalogWarranty.textContent = `Гарантия ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;

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

  const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value)) || 0) + ' ₽';
  const productIdForArticle = article => `catalog-${String(article || '').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;

  async function syncExcelDerivedGatePrices() {
    if (!window.GATE_CALC?.ready || !window.GATE_PAGE_API?.productById) return;
    try {
      await window.GATE_CALC.ready;
      const visibleProducts = [];
      for (const item of window.PRICE_DATA?.catalog || []) {
        const standard = window.GATE_CALC.standardForArticle?.(item.art);
        if (!standard) continue;
        const product = window.GATE_PAGE_API.productById(productIdForArticle(item.art));
        if (!product) continue;
        product.price = Number(standard.price) || 0;
        product.standard = [standard.gateWidth, standard.gateHeight];
        product.wicketWidth = standard.wicketWidth;
        product.wicketHeight = standard.wicketHeight;
        if (item.visible !== false) visibleProducts.push(product);
      }

      document.querySelectorAll('.product-card[data-card-product]').forEach(card => {
        const product = window.GATE_PAGE_API.productById(card.dataset.cardProduct);
        if (!product) return;
        const prices = card.querySelectorAll('.price-row strong');
        if (prices[0]) prices[0].textContent = money(product.price + product.install);
        if (prices[1]) prices[1].textContent = money(product.price + product.install + product.posts);
      });

      if (visibleProducts.length) {
        const cheapest = visibleProducts.reduce((best, product) => product.price < best.price ? product : best, visibleProducts[0]);
        const heroInstalled = document.getElementById('heroInstalledPrice');
        const heroTurnkey = document.getElementById('heroTurnkeyPrice');
        if (heroInstalled) heroInstalled.textContent = `от ${money(cheapest.price + cheapest.install)}`;
        if (heroTurnkey) heroTurnkey.textContent = `от ${money(cheapest.price + cheapest.install + cheapest.posts)}`;
      }
    } catch (error) {
      console.error('Excel-derived catalog price sync failed', error);
    }
  }

  syncExcelDerivedGatePrices();

  if (window.matchMedia('(max-width: 620px)').matches) {
    const packageSection = document.querySelector('.package');
    const trustSection = document.querySelector('.trust');
    if (packageSection) packageSection.style.paddingBottom = '20px';
    if (trustSection) trustSection.style.paddingTop = '34px';
  }
})();