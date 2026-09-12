(() => {
  const mobile = window.matchMedia('(max-width: 620px)');
  const desktopHero = window.matchMedia('(min-width: 621px)');
  const heroImage = document.getElementById('heroDesktopImage');
  const trackGoal = (name, params = {}) => { try { if (typeof window.ym === 'function') window.ym(107269914, 'reachGoal', name, params); } catch {} };
  const PROFILE_COLORS = [
    {id:'chocolate',label:'Шоколад',short:'Шоколад',ral:'RAL 8017',hex:'#4a2f29'},
    {id:'graphite',label:'Графит',short:'Графит',ral:'RAL 7024',hex:'#45494e'},
    {id:'moss',label:'Зелёный мох',short:'Мох',ral:'RAL 6005',hex:'#174533'},
    {id:'mint',label:'Зелёная мята',short:'Мята',ral:'RAL 6029',hex:'#008754'},
    {id:'wine',label:'Винно-красный',short:'Винный',ral:'RAL 3005',hex:'#5e2028'}
  ];
  const colorPreviewState = new Map();

  const colorBadgeStyle = document.createElement('style');
  colorBadgeStyle.textContent = `
    .color-profile-badge{position:absolute;left:12px;top:12px;z-index:7;display:flex;align-items:center;gap:8px;width:180px;min-height:52px;padding:6px 10px 6px 8px;box-sizing:border-box;pointer-events:none;background:linear-gradient(180deg,#161616 0%,#050505 100%);border:2px solid #d2a143;box-shadow:inset 0 0 0 1px #6f4a13,0 5px 16px rgba(0,0,0,.24);clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px);opacity:0;visibility:hidden;transform:translateY(-3px);transition:opacity .18s ease,transform .18s ease,visibility .18s ease}
    .product-visual[data-image-index="0"] .color-profile-badge{opacity:1;visibility:visible;transform:none}
    .color-fan{position:relative;flex:0 0 42px;width:42px;height:38px}
    .color-fan i{position:absolute;left:17px;bottom:3px;width:9px;height:32px;border-radius:4px 4px 2px 2px;transform-origin:50% 100%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),0 1px 2px rgba(0,0,0,.25)}
    .color-fan i:nth-child(1){background:#d92d1f;transform:rotate(-34deg)}
    .color-fan i:nth-child(2){background:#f39a22;transform:rotate(-22deg)}
    .color-fan i:nth-child(3){background:#f0d329;transform:rotate(-10deg)}
    .color-fan i:nth-child(4){background:#2fa64a;transform:rotate(2deg)}
    .color-fan i:nth-child(5){background:#1794b8;transform:rotate(14deg)}
    .color-fan i:nth-child(6){background:#2866c2;transform:rotate(26deg)}
    .color-fan i:nth-child(7){background:#8c3bc2;transform:rotate(38deg)}
    .color-copy{display:grid;gap:0;min-width:0;line-height:1.03;text-align:left}
    .color-copy strong{color:#e1ae4c;font-size:13px;font-weight:900;letter-spacing:-.15px;white-space:nowrap}
    .color-copy span{margin-top:2px;color:#fff;font-size:12px;font-weight:700;white-space:nowrap}
    .product-meta{display:none!important}
    .mobile-price-breakdown>summary{cursor:default!important}
    .mobile-payment-note{margin:10px 0 0;padding:10px 11px;border:1px solid rgba(230,189,105,.22);border-radius:10px;background:rgba(200,152,60,.07);color:rgba(255,255,255,.68);font-size:10px;line-height:1.5}
    .mobile-payment-note strong{display:block;margin-bottom:2px;color:#fff;font-size:11px}
    .profile-color-wash{position:absolute;inset:0;z-index:4;pointer-events:none;background:var(--profile-preview-color,transparent);mix-blend-mode:color;opacity:0;transition:opacity .2s ease;-webkit-mask-image:radial-gradient(ellipse 82% 62% at 50% 62%,#000 26%,rgba(0,0,0,.94) 54%,rgba(0,0,0,.4) 72%,transparent 92%);mask-image:radial-gradient(ellipse 82% 62% at 50% 62%,#000 26%,rgba(0,0,0,.94) 54%,rgba(0,0,0,.4) 72%,transparent 92%)}
    .product-visual.is-color-preview .profile-color-wash{opacity:.56}
    .profile-color-picker{padding:10px 12px 9px;border-top:1px solid rgba(17,18,20,.08);background:#fff;color:#171717}
    .profile-color-picker-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
    .profile-color-picker-head strong{font-size:11px;line-height:1.2;font-weight:900}
    .profile-color-status{min-width:0;color:#8d6b2d;font-size:9px;line-height:1.25;font-weight:800;text-align:right}
    .profile-color-swatches{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;align-items:start}
    .profile-color-option{display:grid;justify-items:center;gap:4px;min-width:0;padding:0;border:0;background:transparent;color:#706a62;font:700 8px/1.1 Manrope,Arial,sans-serif;cursor:pointer}
    .profile-color-dot{position:relative;display:block;width:31px;height:31px;border-radius:50%;background:var(--swatch);border:2px solid #fff;box-shadow:0 0 0 1px rgba(17,18,20,.18),0 2px 6px rgba(0,0,0,.12);transition:transform .15s ease,box-shadow .15s ease}
    .profile-color-option[aria-pressed="true"]{color:#171717}
    .profile-color-option[aria-pressed="true"] .profile-color-dot{transform:scale(1.08);box-shadow:0 0 0 2px #c7973c,0 3px 8px rgba(0,0,0,.16)}
    .profile-color-option.is-more .profile-color-dot{background:conic-gradient(#d92d1f,#f39a22,#f0d329,#2fa64a,#1794b8,#2866c2,#8c3bc2,#d92d1f)}
    .profile-color-option.is-more .profile-color-dot::after{content:"+";position:absolute;inset:5px;display:grid;place-items:center;border-radius:50%;background:rgba(0,0,0,.72);color:#fff;font-size:17px;font-weight:900}
    .profile-color-note{margin:7px 0 0;color:#8a8379;font-size:8.5px;line-height:1.35}
    @media(max-width:620px){.color-profile-badge{left:9px;top:9px;width:166px;min-height:48px;padding:5px 8px 5px 6px;gap:6px}.color-fan{flex-basis:38px;width:38px;height:34px}.color-fan i{left:15px;width:8px;height:29px}.color-copy strong{font-size:12px}.color-copy span{font-size:11px}.profile-color-picker{padding:9px 10px 8px}.profile-color-picker-head{margin-bottom:7px}.profile-color-picker-head strong{font-size:10px}.profile-color-status{font-size:8.5px}.profile-color-swatches{gap:3px}.profile-color-dot{width:29px;height:29px}.profile-color-option{font-size:7.5px}.profile-color-note{font-size:8px}}
    @media(max-width:390px){.color-profile-badge{width:150px;min-height:44px}.color-fan{flex-basis:33px;width:33px;height:31px}.color-fan i{left:13px;width:7px;height:26px}.color-copy strong{font-size:11px}.color-copy span{font-size:10px}.profile-color-dot{width:27px;height:27px}.profile-color-option{font-size:7px}}
  `;
  document.head.append(colorBadgeStyle);

  const installColorBadges = () => {
    document.querySelectorAll('.product-visual').forEach(visual => {
      if (visual.querySelector('.color-profile-badge')) return;
      const badge = document.createElement('div');
      badge.className = 'color-profile-badge';
      badge.setAttribute('aria-hidden','true');
      badge.innerHTML = '<span class="color-fan"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="color-copy"><strong>Любой цвет</strong><span>профнастила</span></span>';
      visual.append(badge);
    });
  };

  const applyProfileColor = (card, colorId, shouldTrack = true) => {
    if (!card) return;
    const visual = card.querySelector('.product-visual');
    const status = card.querySelector('.profile-color-status');
    const product = window.GATE_PAGE_API?.productById?.(card.dataset.cardProduct);
    card.querySelectorAll('.profile-color-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.profileColor === colorId)));
    if (colorId === 'other') {
      colorPreviewState.set(card.dataset.cardProduct,'other');
      visual?.classList.remove('is-color-preview');
      visual?.style.removeProperty('--profile-preview-color');
      if (status) status.textContent = 'Другой цвет — при оформлении';
      if (shouldTrack) trackGoal('catalog_color_preview',{article:product?.art||card.dataset.cardProduct,color:'other'});
      return;
    }
    const color = PROFILE_COLORS.find(item => item.id === colorId);
    if (!color) {
      colorPreviewState.delete(card.dataset.cardProduct);
      visual?.classList.remove('is-color-preview');
      visual?.style.removeProperty('--profile-preview-color');
      if (status) status.textContent = 'Нажмите на оттенок';
      return;
    }
    colorPreviewState.set(card.dataset.cardProduct,color.id);
    visual?.style.setProperty('--profile-preview-color',color.hex);
    visual?.classList.add('is-color-preview');
    if (status) status.textContent = `${color.label} · ${color.ral}`;
    if (shouldTrack) trackGoal('catalog_color_preview',{article:product?.art||card.dataset.cardProduct,color:color.id});
  };

  const installColorPickers = () => {
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.profile-color-picker')) return;
      const visual = card.querySelector('.product-visual');
      if (!visual) return;
      if (!visual.querySelector('.profile-color-wash')) {
        const wash = document.createElement('span');
        wash.className = 'profile-color-wash';
        wash.setAttribute('aria-hidden','true');
        visual.append(wash);
      }
      const picker = document.createElement('div');
      picker.className = 'profile-color-picker';
      picker.innerHTML = `<div class="profile-color-picker-head"><strong>Примерьте цвет профнастила</strong><span class="profile-color-status" aria-live="polite">Нажмите на оттенок</span></div><div class="profile-color-swatches">${PROFILE_COLORS.map(color => `<button class="profile-color-option" type="button" data-profile-color="${color.id}" aria-pressed="false" aria-label="Показать цвет ${color.label}, ${color.ral}" title="${color.label} · ${color.ral}"><span class="profile-color-dot" style="--swatch:${color.hex}"></span><span>${color.short}</span></button>`).join('')}<button class="profile-color-option is-more" type="button" data-profile-color="other" aria-pressed="false" aria-label="Другой цвет профнастила"><span class="profile-color-dot"></span><span>Другой</span></button></div><p class="profile-color-note">Есть и другие цвета. Предпросмотр приблизительный; на предварительную цену цвет не влияет.</p>`;
      picker.querySelectorAll('.profile-color-option').forEach(button => button.addEventListener('click', event => {
        event.stopPropagation();
        applyProfileColor(card,button.dataset.profileColor,true);
      }));
      const anchor = card.querySelector('.card-thumbnails') || visual;
      anchor.after(picker);
      const remembered = colorPreviewState.get(card.dataset.cardProduct);
      if (remembered) applyProfileColor(card,remembered,false);
    });
  };

  let mobilePriceBreakdown = document.querySelector('.mobile-price-breakdown');
  if (mobilePriceBreakdown?.tagName === 'DETAILS') {
    const staticBreakdown = document.createElement('div');
    staticBreakdown.className = mobilePriceBreakdown.className;
    while (mobilePriceBreakdown.firstChild) staticBreakdown.append(mobilePriceBreakdown.firstChild);
    mobilePriceBreakdown.replaceWith(staticBreakdown);
    mobilePriceBreakdown = staticBreakdown;
  }
  const mobilePriceSummary = mobilePriceBreakdown?.querySelector('summary');
  const mobilePriceHint = mobilePriceSummary?.querySelector('small');
  if (mobilePriceSummary) {
    mobilePriceSummary.setAttribute('aria-disabled','true');
    mobilePriceSummary.removeAttribute('tabindex');
  }
  if (mobilePriceHint) mobilePriceHint.textContent = 'Состав предварительной стоимости';
  const mobilePriceBody = mobilePriceBreakdown?.querySelector('.mobile-price-breakdown-body');
  if (mobilePriceBody && !mobilePriceBody.querySelector('.mobile-payment-note')) {
    const paymentNote = document.createElement('div');
    paymentNote.className = 'mobile-payment-note';
    paymentNote.innerHTML = '<strong>Сейчас оплачивать ничего не нужно.</strong>Оплата — 50% при заключении договора, оставшиеся 50% после установки.';
    mobilePriceBody.append(paymentNote);
  }

  const syncHeroImage = () => {
    if (!heroImage) return;
    if (desktopHero.matches && !heroImage.hasAttribute('src')) {
      heroImage.loading = 'eager';
      heroImage.fetchPriority = 'high';
      heroImage.src = heroImage.dataset.desktopSrc || '/hero-gates.jpg';
    } else if (!desktopHero.matches && heroImage.hasAttribute('src')) {
      heroImage.removeAttribute('src');
    }
  };
  syncHeroImage();
  desktopHero.addEventListener('change', syncHeroImage);
  const calculator = document.getElementById('calculator');
  const catalog = document.getElementById('catalog');
  const cta = document.getElementById('mobilePrimaryCta');
  const leadRequest = document.getElementById('leadRequest');
  const leadBackdrop = document.getElementById('leadBackdrop');
  const leadClose = document.getElementById('leadSheetClose');
  const sendButton = document.getElementById('sendButton');
  const mobilePriceTotal = document.getElementById('mobilePriceTotal');
  let leadOpen = false;
  let deliveryCanProceed = false;
  let deliveryKind = 'empty';
  let dimensionsValid = true;

  const dimensions = document.getElementById('gateDimensions');
  const sizeToggle = document.getElementById('sizeToggle');
  const sizeSummaryLabel = document.getElementById('sizeSummaryLabel');
  const sizeSummaryValue = document.getElementById('sizeSummaryValue');
  const widthInput = document.getElementById('widthInput');
  const wicketWidthInput = document.getElementById('wicketWidthInput');
  const heightInput = document.getElementById('heightInput');
  const wicketHeightInput = document.getElementById('wicketHeightInput');
  const sizeNotice = document.getElementById('sizeNotice');

  function updateSizeSummary() {
    if (!sizeSummaryValue) return;
    const format = value => String(value || '').replace('.', ',');
    sizeSummaryLabel.textContent = sizeNotice?.hidden === false ? 'Ваш размер' : 'Стандартный размер';
    sizeSummaryValue.textContent = `Ворота ${format(widthInput?.value)} × ${format(heightInput?.value)} м · калитка ${format(wicketWidthInput?.value)} × ${format(wicketHeightInput?.value || heightInput?.value)} м`;
  }

  sizeToggle?.addEventListener('click', () => {
    const open = dimensions?.classList.toggle('is-open');
    sizeToggle.textContent = open ? 'Скрыть' : 'Изменить';
    sizeToggle.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) { trackGoal('gate_size_edit_open'); setTimeout(() => widthInput?.focus({preventScroll:true}), 40); }
  });
  [widthInput,wicketWidthInput,heightInput,wicketHeightInput].filter(Boolean).forEach(input => {
    input.addEventListener('input', () => setTimeout(updateSizeSummary,0));
    input.addEventListener('change', () => setTimeout(updateSizeSummary,0));
  });

  document.getElementById('changeProductButton')?.addEventListener('click', () => {
    window.GATE_PAGE_API?.closeCalculator?.();
    const active = window.GATE_PAGE_API?.selectedProduct?.();
    const card = active ? document.querySelector(`[data-card-product="${CSS.escape(active.id)}"]`) : null;
    (card || catalog)?.scrollIntoView({behavior:'smooth', block:card?'center':'start'});
  });

  const commentToggle = document.getElementById('commentToggle');
  const commentLabel = document.getElementById('commentLabel');
  commentToggle?.addEventListener('click', () => {
    const open = commentLabel?.classList.toggle('is-open');
    commentToggle.classList.toggle('is-open', Boolean(open));
    commentToggle.textContent = open ? 'Скрыть комментарий' : 'Добавить комментарий';
    if (open) setTimeout(() => commentLabel?.querySelector('textarea')?.focus({preventScroll:true}), 40);
  });

  function syncMobileCta() {
    if (!cta) return;
    const price = mobilePriceTotal?.textContent?.trim() || '';
    if (!calculator || calculator.hidden) cta.textContent = 'Выбрать ворота';
    else if (leadOpen) cta.textContent = `Отправить заявку${price ? ` · ${price}` : ''}`;
    else if (!dimensionsValid) cta.textContent = `Проверьте размеры${price ? ` · ${price}` : ''}`;
    else if (!deliveryCanProceed) cta.textContent = `Указать место установки${price ? ` · ${price}` : ''}`;
    else cta.textContent = `Заказать бесплатный замер${price ? ` · ${price}` : ''}`;
  }

  function openLead() {
    if (!mobile.matches || leadOpen) return;
    leadOpen = true;
    trackGoal('lead_form_open');
    document.body.classList.add('mobile-lead-open');
    leadBackdrop?.removeAttribute('hidden');
    syncMobileCta();
  }

  function closeLead() {
    if (!leadOpen) return;
    leadOpen = false;
    document.body.classList.remove('mobile-lead-open');
    leadBackdrop?.setAttribute('hidden','');
    document.activeElement?.blur?.();
    syncMobileCta();
  }

  leadBackdrop?.addEventListener('click', closeLead);
  leadClose?.addEventListener('click', closeLead);

  cta?.addEventListener('click', event => {
    if (!mobile.matches) return;
    event.preventDefault();
    if (!calculator || calculator.hidden) {
      catalog?.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    if (!dimensionsValid) {
      dimensions?.classList.add('is-open');
      if(sizeToggle){sizeToggle.textContent='Скрыть';sizeToggle.setAttribute('aria-expanded','true');}
      dimensions?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>widthInput?.focus({preventScroll:true}),260);
      return;
    }
    if (!deliveryCanProceed) {
      document.getElementById('deliveryChooser')?.closest('.form-block')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if (!leadOpen) openLead();
    else sendButton?.click();
  });

  const policyBackdrop = document.getElementById('policyBackdrop');
  const policyModal = document.getElementById('policyModal');
  const openPolicy = () => {
    const policyBody = policyModal?.querySelector('.policy-body');
    const policySource = document.querySelector('#privacyPolicy .privacy-content');
    if (policyBody && policySource && !policyBody.dataset.synced) {
      policyBody.innerHTML = policySource.innerHTML;
      policyBody.dataset.synced = '1';
    }
    policyBackdrop?.removeAttribute('hidden');
    policyModal?.removeAttribute('hidden');
    document.body.classList.add('modal-open');
  };
  const closePolicy = () => {
    policyBackdrop?.setAttribute('hidden','');
    policyModal?.setAttribute('hidden','');
    document.body.classList.remove('modal-open');
  };
  document.querySelectorAll('a[href="#privacyPolicy"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    openPolicy();
  }));
  policyBackdrop?.addEventListener('click', closePolicy);
  document.getElementById('policyClose')?.addEventListener('click', closePolicy);
  document.getElementById('policyContinue')?.addEventListener('click', closePolicy);

  const successBackdrop = document.getElementById('successBackdrop');
  const successModal = document.getElementById('successModal');
  const successWhatsApp = document.getElementById('successWhatsApp');
  const closeSuccess = () => {
    successBackdrop?.setAttribute('hidden','');
    successModal?.setAttribute('hidden','');
    document.body.classList.remove('modal-open');
  };
  const openSuccess = payload => {
    closeLead();
    const digits = String((window.SITE_SETTINGS || {}).whatsappDigits || '79373296750').replace(/\D/g,'');
    if (successWhatsApp) successWhatsApp.href = `https://wa.me/${digits}?text=${encodeURIComponent(payload?.message || '')}`;
    successBackdrop?.removeAttribute('hidden');
    successModal?.removeAttribute('hidden');
    document.body.classList.add('modal-open');
  };
  successBackdrop?.addEventListener('click', closeSuccess);
  document.getElementById('successClose')?.addEventListener('click', closeSuccess);
  document.getElementById('successDone')?.addEventListener('click', closeSuccess);
  successWhatsApp?.addEventListener('click', () => {
    if (window.ym) ym(107269914,'reachGoal','whatsapp_after_lead');
  });
  document.addEventListener('lead-sent', event => openSuccess(event.detail?.payload));

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!policyModal?.hasAttribute('hidden')) closePolicy();
    else if (!successModal?.hasAttribute('hidden')) closeSuccess();
    else closeLead();
  });

  const installDesktopThumbnails = () => {
    if (mobile.matches) {
      document.querySelectorAll('.card-thumbnails').forEach(node => node.remove());
      return;
    }
    const api = window.GATE_PAGE_API;
    if (!api) return;
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.card-thumbnails')) return;
      const product = api.productById?.(card.dataset.cardProduct);
      if (!product?.gallery || product.gallery.length < 2) return;
      const visual = card.querySelector('[data-gallery-card]');
      const strip = document.createElement('div');
      strip.className = 'card-thumbnails';
      product.gallery.forEach((url,index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card-thumb';
        button.setAttribute('aria-label', `Показать фото ${index+1}`);
        button.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
        button.addEventListener('click', event => {
          event.stopPropagation();
          api.showCardImage?.(visual,index);
        });
        strip.append(button);
      });
      visual.after(strip);
    });
  };

  const grid = document.getElementById('catalogGrid');
  const syncCatalogEnhancements = () => {
    installColorBadges();
    installDesktopThumbnails();
    installColorPickers();
  };
  if (grid) new MutationObserver(() => queueMicrotask(syncCatalogEnhancements)).observe(grid,{childList:true});
  mobile.addEventListener('change', syncCatalogEnhancements);
  document.addEventListener('gate:calculated', event => {
    deliveryKind = event.detail?.deliveryKind || 'empty';
    deliveryCanProceed = event.detail?.deliveryPending === false || ['out-of-area','error'].includes(deliveryKind);
    dimensionsValid = event.detail?.dimensionsValid !== false;
    updateSizeSummary();
    syncMobileCta();
  });
  if (calculator) new MutationObserver(() => { if (calculator.hidden) closeLead(); syncMobileCta(); }).observe(calculator,{attributes:true,attributeFilter:['hidden']});

  updateSizeSummary();
  syncMobileCta();
  queueMicrotask(syncCatalogEnhancements);
})();