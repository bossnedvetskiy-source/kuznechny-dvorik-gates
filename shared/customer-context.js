(() => {
  const CITY_KEY = 'kuzdvor:customer-city';
  const SESSION_KEY = 'kuzdvor:customer-session';

  const safeJson = value => {
    try { return JSON.parse(value || 'null'); } catch { return null; }
  };

  function read() {
    let city = '';
    let session = {};
    try { city = String(localStorage.getItem(CITY_KEY) || '').trim(); } catch {}
    try { session = safeJson(sessionStorage.getItem(SESSION_KEY)) || {}; } catch {}
    return {
      city,
      name: String(session.name || '').trim(),
      phone: String(session.phone || '').trim()
    };
  }

  function set(patch = {}) {
    const current = read();
    const next = {...current, ...patch};
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
      try {
        const city = String(next.city || '').trim();
        if (city) localStorage.setItem(CITY_KEY, city);
        else localStorage.removeItem(CITY_KEY);
      } catch {}
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        name: String(next.name || '').trim(),
        phone: String(next.phone || '').trim()
      }));
    } catch {}
    return next;
  }

  function bindContact({nameInput, phoneInput} = {}) {
    const saved = read();
    if (nameInput && !nameInput.value && saved.name) nameInput.value = saved.name;
    if (phoneInput && !phoneInput.value && saved.phone) phoneInput.value = saved.phone;
    nameInput?.addEventListener('input', () => set({name:nameInput.value}));
    phoneInput?.addEventListener('input', () => set({phone:phoneInput.value}));
  }

  window.KUZDVOR_CUSTOMER = {read, set, bindContact};
})();

(() => {
  const mobile = window.matchMedia('(max-width: 620px)');

  const install = () => {
    const priceBody = document.querySelector('.mobile-price-breakdown-body');
    const paymentNote = priceBody?.querySelector('.mobile-payment-note');
    const stickyCta = document.getElementById('mobilePrimaryCta');
    const stickyBar = document.querySelector('.mobile-cta');
    const priceNode = document.getElementById('mobilePriceTotal');
    if (!priceBody || !stickyCta || !stickyBar || !priceNode) return false;
    if (priceBody.querySelector('.mobile-inline-order-cta')) return true;

    const style = document.createElement('style');
    style.id = 'mobileInlineOrderCtaStyles';
    style.textContent = `
      .mobile-inline-order-cta{display:none}
      @media(max-width:620px){
        .mobile-inline-order-cta{display:grid;width:100%;min-height:62px;margin:12px 0 0;padding:11px 16px;border:0;border-radius:12px;background:#d2a143;color:#17130d;place-items:center;gap:2px;font-family:Manrope,Arial,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.18)}
        .mobile-inline-order-cta strong{font-size:14px;line-height:1.25;font-weight:900}
        .mobile-inline-order-cta small{font-size:10px;line-height:1.3;font-weight:800;opacity:.78}
        .mobile-cta.is-inline-cta-visible{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
      }
    `;
    if (!document.getElementById(style.id)) document.head.append(style);

    const inlineCta = document.createElement('button');
    inlineCta.type = 'button';
    inlineCta.className = 'mobile-inline-order-cta';
    inlineCta.setAttribute('aria-label','Заказать бесплатный замер');
    inlineCta.innerHTML = '<strong>Заказать бесплатный замер</strong><small></small>';
    (paymentNote || priceBody.lastElementChild)?.after?.(inlineCta) || priceBody.append(inlineCta);

    const inlinePrice = inlineCta.querySelector('small');
    const syncPrice = () => {
      const price = String(priceNode.textContent || '').trim();
      inlinePrice.textContent = price ? `Предварительный расчёт: ${price}` : 'Предварительный расчёт';
    };
    syncPrice();

    new MutationObserver(syncPrice).observe(priceNode,{childList:true,characterData:true,subtree:true});
    document.addEventListener('gate:calculated', () => requestAnimationFrame(syncPrice));

    inlineCta.addEventListener('click', event => {
      event.preventDefault();
      stickyCta.click();
    });

    const syncStickyVisibility = visible => {
      stickyBar.classList.toggle('is-inline-cta-visible', Boolean(visible && mobile.matches));
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const entry = entries[0];
        syncStickyVisibility(Boolean(entry?.isIntersecting && entry.intersectionRatio >= .35));
      },{threshold:[0,.35,.7,1]});
      observer.observe(inlineCta);
      mobile.addEventListener('change', () => {
        if (!mobile.matches) syncStickyVisibility(false);
      });
    }

    return true;
  };

  queueMicrotask(() => {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(() => observer.disconnect(),5000);
  });
})();
