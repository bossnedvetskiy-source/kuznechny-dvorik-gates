(() => {
  if (window.KUZDVOR_FORMULA_PRICE_SYNC_READY) return;
  window.KUZDVOR_FORMULA_PRICE_SYNC_READY = true;

  const roundMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
  const money = value => new Intl.NumberFormat('ru-RU').format(roundMoney100(value)) + ' ₽';
  const idForArticle = art => `catalog-${String(art||'').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;
  const standardInput = art => ({article:art,gateWidth:3.4,gateHeight:1.8,wicketWidth:1,wicketHeight:1.8});
  const normalizeCity = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');

  function formulaPrice(art) {
    if (!window.GATE_CALC?.hasArticle(art)) return null;
    try { return Number(window.GATE_CALC.calculateGate(standardInput(art)).total); }
    catch { return null; }
  }

  function deliveryContext() {
    const state = window.GATE_PAGE_API?.deliveryState?.() || {kind:'empty'};
    const kind = String(state.kind || 'empty');
    const city = String(state.city || state.shortName || state.resolvedName || state.name || document.getElementById('cityInput')?.value || '').trim();
    const confirmed = kind === 'fixed' || kind === 'calculated';
    const priced = confirmed || kind === 'confirm';
    return {kind, city, confirmed, priced, price:priced ? (Number(state.price) || 0) : 0};
  }

  function syncProducts() {
    const catalog = Array.isArray(window.PRICE_DATA?.catalog) ? window.PRICE_DATA.catalog : [];
    const api = window.GATE_PAGE_API;
    let cheapest = null;
    const installation = Number(window.PRICE_DATA?.catalogInstallation) || 0;
    const posts = Number(window.PRICE_DATA?.catalogPosts) || 0;

    for (const item of catalog) {
      if (item?.visible === false) continue;
      const price = formulaPrice(item.art);
      if (!Number.isFinite(price)) continue;
      item.price = price;
      const product = api?.productById?.(idForArticle(item.art));
      if (product) product.price = price;
      if (!cheapest || price < cheapest) cheapest = price;
    }

    if (Number.isFinite(cheapest)) {
      const installed = document.getElementById('heroInstalledPrice');
      const turnkey = document.getElementById('heroTurnkeyPrice');
      const installedText = `от ${money(cheapest + installation)}`;
      const turnkeyText = `от ${money(cheapest + installation + posts)}`;
      if (installed && installed.textContent !== installedText) installed.textContent = installedText;
      if (turnkey && turnkey.textContent !== turnkeyText) turnkey.textContent = turnkeyText;
    }
    syncVisibleCards();
  }

  function syncVisibleCards() {
    const delivery = deliveryContext();
    document.querySelectorAll('[data-card-product]').forEach(card => {
      const art = card.querySelector('.product-art')?.textContent?.trim();
      if (!art) return;
      const price = formulaPrice(art);
      if (!Number.isFinite(price)) return;
      const rows = card.querySelectorAll('.price-row strong');
      const installation = Number(window.PRICE_DATA?.catalogInstallation) || 0;
      const posts = Number(window.PRICE_DATA?.catalogPosts) || 0;
      const installedText = money(price + installation + delivery.price);
      const turnkeyText = money(price + installation + posts + delivery.price);
      if (rows[0] && rows[0].textContent !== installedText) rows[0].textContent = installedText;
      if (rows[1] && rows[1].textContent !== turnkeyText) rows[1].textContent = turnkeyText;

      const note = card.querySelector('.price-delivery-note');
      if (!note) return;
      let noteText = 'Доставка рассчитывается после выбора места установки';
      if (delivery.confirmed) {
        noteText = normalizeCity(delivery.city) === 'мелеуз'
          ? '✓ Доставка по Мелеузу бесплатно — уже учтена в цене'
          : `✓ С учётом доставки в ${delivery.city}`;
      } else if (delivery.kind === 'confirm') {
        noteText = delivery.city
          ? `≈ С учётом доставки в ${delivery.city} · подтвердите пункт`
          : '≈ Доставка уже учтена · подтвердите населённый пункт';
      } else if (delivery.kind === 'out-of-area' || delivery.kind === 'error') {
        noteText = delivery.city
          ? `Доставка в ${delivery.city} уточняется отдельно`
          : 'Стоимость доставки уточняется отдельно';
      } else if (delivery.kind === 'loading' || delivery.kind === 'pending') {
        noteText = delivery.city
          ? `Считаем доставку в ${delivery.city} — пока показана цена без доставки`
          : 'Считаем доставку — пока показана цена без доставки';
      }
      if (note.textContent !== noteText) note.textContent = noteText;
    });
  }

  let syncQueued = false;
  const scheduleSync = () => {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncVisibleCards();
    });
  };

  const syncBurst = () => {
    scheduleSync();
    [50, 180, 500, 1200].forEach(delay => setTimeout(scheduleSync, delay));
  };

  const start = async () => {
    try {
      await Promise.resolve(window.GATE_CALC?.ready);
      syncProducts();
      const grid = document.getElementById('catalogGrid');
      if (grid) {
        new MutationObserver(records => {
          const priceWasTouched = records.some(record => {
            const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
            if (target?.closest?.('.price-row strong')) return true;
            return [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('[data-card-product]') || node.querySelector?.('[data-card-product]')));
          });
          if (priceWasTouched) scheduleSync();
        }).observe(grid, {childList:true,subtree:true,characterData:true});
      }

      // Delivery changes are emitted by the calculator. A short retry burst also
      // wins against late Excel/site-settings refreshes that may rewrite base-only
      // prices after the delivery calculation has already finished.
      document.addEventListener('gate:calculated', syncBurst);
      window.addEventListener('pageshow', syncBurst);

      // Final safety net for mobile browsers / restored tabs: while delivery has a
      // real price, visible cards are periodically reconciled with that same state.
      setInterval(() => {
        if (document.hidden) return;
        if (deliveryContext().priced) syncVisibleCards();
      }, 750);
    } catch (error) { console.error('Excel formula price sync failed', error); }
  };
  start();
})();
