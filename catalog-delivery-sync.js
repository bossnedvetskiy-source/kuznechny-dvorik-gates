(() => {
  if (window.KUZDVOR_CATALOG_DELIVERY_SYNC_READY) return;
  window.KUZDVOR_CATALOG_DELIVERY_SYNC_READY = true;

  const roundMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
  const money = value => new Intl.NumberFormat('ru-RU').format(roundMoney100(value)) + ' ₽';
  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');

  function context() {
    const state = window.GATE_PAGE_API?.deliveryState?.() || {kind:'empty'};
    const kind = String(state.kind || 'empty');
    const city = String(state.shortName || state.resolvedName || state.name || document.getElementById('cityInput')?.value || '').trim();
    const resolved = kind === 'fixed' || kind === 'calculated';
    return {kind, city, resolved, price:resolved ? (Number(state.price) || 0) : 0};
  }

  function sync() {
    const api = window.GATE_PAGE_API;
    const grid = document.getElementById('catalogGrid');
    if (!api?.productById || !grid) return false;

    const delivery = context();
    grid.querySelectorAll('.product-card[data-card-product]').forEach(card => {
      const product = api.productById(card.dataset.cardProduct);
      if (!product) return;

      const deliveryPrice = delivery.resolved ? delivery.price : 0;
      const rows = card.querySelectorAll('.price-row strong');
      if (rows[0]) rows[0].textContent = money(Number(product.price) + Number(product.install) + deliveryPrice);
      if (rows[1]) rows[1].textContent = money(Number(product.price) + Number(product.install) + Number(product.posts) + deliveryPrice);

      const note = card.querySelector('.price-delivery-note');
      if (!note) return;
      if (delivery.resolved) {
        note.textContent = normalize(delivery.city) === 'мелеуз'
          ? '✓ Доставка по Мелеузу бесплатно — уже учтена в цене'
          : `✓ С учётом доставки в ${delivery.city}`;
      } else if (delivery.kind === 'confirm') {
        note.textContent = delivery.city
          ? `Подтвердите ${delivery.city} — пока показана цена без доставки`
          : 'Подтвердите населённый пункт — пока показана цена без доставки';
      } else if (delivery.kind === 'out-of-area' || delivery.kind === 'error') {
        note.textContent = delivery.city
          ? `Доставка в ${delivery.city} уточняется отдельно`
          : 'Стоимость доставки уточняется отдельно';
      } else if (delivery.kind === 'loading' || delivery.kind === 'pending') {
        note.textContent = delivery.city
          ? `Считаем доставку в ${delivery.city} — пока показана цена без доставки`
          : 'Считаем доставку — пока показана цена без доставки';
      } else {
        note.textContent = 'Доставка рассчитывается после выбора места установки';
      }
    });
    return true;
  }

  document.addEventListener('gate:calculated', sync);
  window.addEventListener('pageshow', sync);

  const grid = document.getElementById('catalogGrid');
  if (grid) {
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.product-card') || node.querySelector?.('.product-card'))))) {
        queueMicrotask(sync);
      }
    }).observe(grid, {childList:true,subtree:false});
  }

  window.KUZDVOR_SYNC_CATALOG_DELIVERY = sync;
  sync();
})();
