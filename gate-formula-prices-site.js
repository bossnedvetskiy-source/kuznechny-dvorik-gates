(() => {
  if (window.KUZDVOR_FORMULA_PRICE_SYNC_READY) return;
  window.KUZDVOR_FORMULA_PRICE_SYNC_READY = true;

  const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
  const idForArticle = art => `catalog-${String(art||'').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;
  const standardInput = art => ({article:art,gateWidth:3.4,gateHeight:1.8,wicketWidth:1,wicketHeight:1.8});

  function formulaPrice(art) {
    if (!window.GATE_CALC?.hasArticle(art)) return null;
    try { return Number(window.GATE_CALC.calculateGate(standardInput(art)).total); }
    catch { return null; }
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
      if (installed) installed.textContent = `от ${money(cheapest + installation)}`;
      if (turnkey) turnkey.textContent = `от ${money(cheapest + installation + posts)}`;
    }
    syncVisibleCards();
  }

  function syncVisibleCards() {
    document.querySelectorAll('[data-card-product]').forEach(card => {
      const art = card.querySelector('.product-art')?.textContent?.trim();
      if (!art) return;
      const price = formulaPrice(art);
      if (!Number.isFinite(price)) return;
      const rows = card.querySelectorAll('.price-row strong');
      const installation = Number(window.PRICE_DATA?.catalogInstallation) || 0;
      const posts = Number(window.PRICE_DATA?.catalogPosts) || 0;
      if (rows[0]) rows[0].textContent = money(price + installation);
      if (rows[1]) rows[1].textContent = money(price + installation + posts);
    });
  }

  const start = async () => {
    try {
      await Promise.resolve(window.GATE_CALC?.ready);
      syncProducts();
      const grid = document.getElementById('catalogGrid');
      if (grid) new MutationObserver(() => queueMicrotask(syncVisibleCards)).observe(grid, {childList:true,subtree:true});
    } catch (error) { console.error('Excel formula price sync failed', error); }
  };
  start();
})();
