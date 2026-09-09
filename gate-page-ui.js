(() => {
  const mobile = window.matchMedia('(max-width: 620px)');
  const calculator = document.getElementById('calculator');
  const catalog = document.getElementById('catalog');
  const cta = document.getElementById('mobilePrimaryCta');
  const leadRequest = document.getElementById('leadRequest');
  const leadBackdrop = document.getElementById('leadBackdrop');
  const leadClose = document.getElementById('leadSheetClose');
  const sendButton = document.getElementById('sendButton');
  const mobilePriceTotal = document.getElementById('mobilePriceTotal');
  let leadOpen = false;

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
    if (open) setTimeout(() => widthInput?.focus({preventScroll:true}), 40);
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
    else cta.textContent = `Заказать бесплатный замер${price ? ` · ${price}` : ''}`;
  }

  function openLead() {
    if (!mobile.matches || leadOpen) return;
    leadOpen = true;
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
  if (grid) new MutationObserver(() => queueMicrotask(installDesktopThumbnails)).observe(grid,{childList:true});
  mobile.addEventListener('change', installDesktopThumbnails);
  document.addEventListener('gate:calculated', () => { updateSizeSummary(); syncMobileCta(); });
  if (calculator) new MutationObserver(() => { if (calculator.hidden) closeLead(); syncMobileCta(); }).observe(calculator,{attributes:true,attributeFilter:['hidden']});

  updateSizeSummary();
  syncMobileCta();
  queueMicrotask(installDesktopThumbnails);
})();
