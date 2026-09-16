(() => {
  const STORAGE_KEY = 'kuzdvor:favorites';
  const priceData = window.PRICE_DATA;
  const imageData = window.CATALOG_IMAGES || {};
  const grid = document.getElementById('catalogGrid');
  const catalog = document.getElementById('catalog');
  const catalogSummary = catalog?.querySelector('.catalog-summary');
  if (!priceData?.catalog || !grid || !catalogSummary) return;

  const roundMoney100 = value => Math.round((Number(value) || 0) / 100) * 100;
  const money = value => `${new Intl.NumberFormat('ru-RU').format(roundMoney100(value))} ₽`;
  const normalizeId = art => `catalog-${String(art || '').replace(/^Арт\.\s*/,'').toLowerCase().replace('с','s')}`;
  const safeJson = value => { try { return JSON.parse(value || 'null'); } catch { return null; } };
  const track = (name, params = {}) => { try { window.ym?.(107269914,'reachGoal',name,params); } catch {} };

  const products = priceData.catalog
    .filter(item => item.visible !== false)
    .map(item => {
      const art = String(item.art || '').trim();
      const gallery = Array.isArray(imageData[art]) && imageData[art].length ? imageData[art] : ['/hero-gates.jpg'];
      return {
        id: normalizeId(art),
        art,
        base: Number(item.price) || 0,
        install: Number(priceData.catalogInstallation) || 0,
        posts: Number(priceData.catalogPosts) || 0,
        image: gallery[0] || '/hero-gates.jpg'
      };
    });
  const byId = new Map(products.map(product => [product.id, product]));

  const storedFavorites = (() => {
    try { return safeJson(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  })();
  let favorites = new Set(storedFavorites.filter(id => byId.has(id)));
  let modalOpen = false;
  let mutationFrame = 0;
  let toastTimer = 0;

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites])); } catch {}
  };

  const deliveryContext = () => {
    const state = window.GATE_PAGE_API?.deliveryState?.() || {kind:'empty',price:0};
    const kind = String(state.kind || 'empty');
    const city = String(state.shortName || state.resolvedName || state.name || window.KUZDVOR_CUSTOMER?.read?.().city || '').trim();
    return {
      kind,
      city,
      price:['fixed','calculated'].includes(kind) ? Number(state.price) || 0 : 0,
      resolved:['fixed','calculated'].includes(kind),
      manual:kind === 'out-of-area'
    };
  };

  const style = document.createElement('style');
  style.id = 'gateFavoritesStyles';
  style.textContent = `
    .catalog-summary{display:flex!important;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .favorites-open-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 12px;border:1px solid rgba(17,18,20,.16);border-radius:11px;background:#fff;color:#2b2925;font:800 11px/1.2 Manrope,Arial,sans-serif;cursor:pointer;box-shadow:0 5px 16px rgba(17,18,20,.05)}
    .favorites-open-button .favorites-heart{font-size:17px;line-height:1;color:#a87723}.favorites-open-button.has-favorites{border-color:rgba(210,161,67,.5);background:#fffaf0}.favorites-count{display:grid;min-width:20px;height:20px;padding:0 5px;place-items:center;border-radius:999px;background:#171819;color:#e6bd69;font-size:9px;font-weight:900}
    .favorite-toggle{position:absolute;z-index:12;right:10px;top:10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:7px 9px;border:1px solid rgba(17,18,20,.14);border-radius:999px;background:rgba(255,255,255,.93);color:#4b463f;font:800 9px/1 Manrope,Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.14);cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .favorite-toggle .heart{font-size:16px;line-height:1;color:#9b7a42}.favorite-toggle[aria-pressed="true"]{border-color:#d2a143;background:#171819;color:#fff}.favorite-toggle[aria-pressed="true"] .heart{color:#e6bd69}
    .favorites-floating{position:fixed;z-index:260;right:14px;bottom:18px;display:flex;align-items:center;gap:7px;min-height:44px;padding:9px 13px;border:1px solid rgba(230,189,105,.55);border-radius:999px;background:#171819;color:#fff;font:900 11px/1.2 Manrope,Arial,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.25);cursor:pointer}.favorites-floating[hidden]{display:none!important}.favorites-floating b{display:grid;min-width:21px;height:21px;padding:0 5px;place-items:center;border-radius:999px;background:#d2a143;color:#17130d;font-size:9px}
    .favorites-backdrop{position:fixed;inset:0;z-index:12500;background:rgba(4,5,7,.68);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.favorites-backdrop[hidden],.favorites-modal[hidden]{display:none!important}
    .favorites-modal{position:fixed;z-index:12501;left:50%;top:50%;width:min(980px,calc(100vw - 30px));max-height:min(86dvh,820px);box-sizing:border-box;transform:translate(-50%,-50%);display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(230,189,105,.34);border-radius:22px;background:#f6f2e9;color:#171717;box-shadow:0 28px 90px rgba(0,0,0,.5);font-family:Manrope,Arial,sans-serif}
    .favorites-modal-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:20px 22px 15px;border-bottom:1px solid rgba(17,18,20,.1);background:#fff}.favorites-modal-head h2{margin:0;font:27px/1.15 Prata,serif}.favorites-modal-head p{grid-column:1;margin:5px 0 0;color:#766f65;font-size:11px;line-height:1.45}.favorites-modal-close{grid-column:2;grid-row:1/3;align-self:start;width:38px;height:38px;border:0;border-radius:50%;background:#171819;color:#fff;font-size:22px;line-height:1;cursor:pointer}
    .favorites-content{min-height:0;overflow:auto;padding:18px 20px 22px}.favorites-location{display:flex;align-items:center;gap:7px;margin:0 0 13px;color:#746c62;font-size:10px;font-weight:700}.favorites-location strong{color:#2e2a25}.favorites-empty{display:grid;justify-items:center;gap:8px;padding:42px 18px;text-align:center}.favorites-empty span{font-size:34px;color:#bc8d3c}.favorites-empty strong{font:20px/1.25 Prata,serif}.favorites-empty p{max-width:420px;margin:0;color:#766f65;font-size:11px;line-height:1.5}
    .favorites-compare{display:grid;grid-template-columns:repeat(var(--favorite-count),minmax(0,1fr));gap:11px;align-items:stretch}.favorite-compare-card{position:relative;display:grid;grid-template-rows:auto auto 1fr auto;min-width:0;overflow:hidden;border:1px solid rgba(17,18,20,.11);border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(17,18,20,.05)}.favorite-compare-image{position:relative;aspect-ratio:4/3;background:#ece9e2}.favorite-compare-image img{width:100%;height:100%;display:block;object-fit:contain;background:#fff}.favorite-compare-art{position:absolute;left:9px;top:9px;padding:5px 7px;border-radius:7px;background:rgba(17,18,20,.88);color:#e6bd69;font-size:9px;font-weight:900}.favorite-remove{position:absolute;right:8px;top:8px;z-index:2;width:31px;height:31px;border:1px solid rgba(17,18,20,.12);border-radius:50%;background:rgba(255,255,255,.94);color:#6d6257;font-size:16px;cursor:pointer}.favorite-compare-title{padding:11px 12px 7px;font:17px/1.2 Prata,serif}.favorite-compare-prices{display:grid;gap:8px;padding:4px 12px 12px}.favorite-price-row{display:grid;gap:2px;padding:9px 10px;border-radius:10px;background:#f6f3ed}.favorite-price-row small{color:#746e65;font-size:9px;line-height:1.3}.favorite-price-row strong{font-size:16px;line-height:1.15;color:#171717}.favorite-price-row.turnkey{background:#171819}.favorite-price-row.turnkey small{color:rgba(255,255,255,.63)}.favorite-price-row.turnkey strong{color:#e6bd69}.favorite-delivery-note{margin:0;color:#8a8277;font-size:9px;line-height:1.4}.favorite-compare-action{margin:0 12px 12px;min-height:42px;border:0;border-radius:10px;background:#d2a143;color:#17130d;font:900 10px/1.2 Manrope,Arial,sans-serif;cursor:pointer}
    .favorites-toast{position:fixed;z-index:12600;left:50%;bottom:22px;transform:translate(-50%,12px);max-width:min(420px,calc(100vw - 28px));padding:10px 14px;border:1px solid rgba(230,189,105,.35);border-radius:12px;background:#171819;color:#fff;font:800 11px/1.35 Manrope,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .16s,transform .16s}.favorites-toast.is-visible{opacity:1;transform:translate(-50%,0)}
    body.favorites-modal-open{overflow:hidden!important}
    @media(max-width:620px){
      .favorite-toggle{right:8px;top:8px;min-height:32px;padding:6px 8px;font-size:8px}.favorite-toggle .heart{font-size:15px}
      .favorites-open-button{min-height:36px;padding:7px 10px;font-size:10px}.favorites-open-button .favorites-heart{font-size:15px}
      .favorites-floating{right:10px;bottom:72px;min-height:42px;padding:8px 11px;font-size:10px}.dimension-keyboard-open .favorites-floating,.mobile-lead-open .favorites-floating,body.installation-location-modal-open .favorites-floating{display:none!important}
      .favorites-modal{left:0;right:0;top:auto;bottom:0;width:100%;max-height:88dvh;transform:none;border-radius:22px 22px 0 0}.favorites-modal-head{padding:17px 16px 13px}.favorites-modal-head h2{font-size:22px}.favorites-modal-head p{font-size:10.5px}.favorites-content{padding:14px 12px max(18px,env(safe-area-inset-bottom))}.favorites-compare{display:flex;gap:9px;overflow-x:auto;padding:1px 1px 8px;scroll-snap-type:x mandatory;overscroll-behavior-x:contain}.favorite-compare-card{flex:0 0 min(82vw,300px);scroll-snap-align:start}.favorite-compare-title{font-size:16px}.favorite-price-row strong{font-size:15px}
    }
  `;
  document.head.append(style);

  const toolbarButton = document.createElement('button');
  toolbarButton.type = 'button';
  toolbarButton.className = 'favorites-open-button';
  toolbarButton.setAttribute('aria-label','Открыть избранные модели и сравнить');
  toolbarButton.innerHTML = '<span class="favorites-heart">♡</span><span>Избранное</span><b class="favorites-count">0</b>';
  catalogSummary.append(toolbarButton);

  const floatingButton = document.createElement('button');
  floatingButton.type = 'button';
  floatingButton.className = 'favorites-floating';
  floatingButton.hidden = true;
  floatingButton.innerHTML = '<span>♥ Избранное</span><b>0</b>';
  document.body.append(floatingButton);

  const backdrop = document.createElement('div');
  backdrop.className = 'favorites-backdrop';
  backdrop.hidden = true;
  const modal = document.createElement('section');
  modal.className = 'favorites-modal';
  modal.hidden = true;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','favoritesModalTitle');
  modal.innerHTML = `
    <div class="favorites-modal-head">
      <div><h2 id="favoritesModalTitle">Избранное и сравнение</h2><p>Сохраните несколько моделей и сравните их фото и актуальные цены.</p></div>
      <button class="favorites-modal-close" type="button" aria-label="Закрыть">×</button>
    </div>
    <div class="favorites-content"></div>`;
  document.body.append(backdrop, modal);
  const modalContent = modal.querySelector('.favorites-content');
  const modalClose = modal.querySelector('.favorites-modal-close');

  const toast = document.createElement('div');
  toast.className = 'favorites-toast';
  toast.setAttribute('role','status');
  document.body.append(toast);

  const showToast = text => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1600);
  };

  const syncButtons = () => {
    const count = favorites.size;
    const delivery = deliveryContext();
    const catalogUnlocked = delivery.resolved || delivery.manual;
    toolbarButton.querySelector('.favorites-count').textContent = String(count);
    toolbarButton.querySelector('.favorites-heart').textContent = count ? '♥' : '♡';
    toolbarButton.classList.toggle('has-favorites', count > 0);
    floatingButton.hidden = count === 0 || modalOpen || !catalogUnlocked;
    floatingButton.querySelector('b').textContent = String(count);

    grid.querySelectorAll('.favorite-toggle').forEach(button => {
      const active = favorites.has(button.dataset.favoriteId);
      const state = active ? '1' : '0';
      if (button.dataset.favoriteState === state) return;
      button.dataset.favoriteState = state;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? 'Убрать модель из избранного' : 'Сохранить модель в избранное');
      button.title = active ? 'Убрать из избранного' : 'Сохранить';
      button.innerHTML = `<span class="heart">${active ? '♥' : '♡'}</span><span>${active ? 'Сохранено' : 'Сохранить'}</span>`;
    });
  };

  const toggleFavorite = id => {
    const product = byId.get(id);
    if (!product) return;
    if (favorites.has(id)) {
      favorites.delete(id);
      showToast(`${product.art} удалён из избранного`);
      track('favorite_remove',{article:product.art});
    } else {
      favorites.add(id);
      showToast(`${product.art} сохранён — можно сравнить`);
      track('favorite_add',{article:product.art,count:favorites.size});
    }
    save();
    syncButtons();
    if (modalOpen) renderModal();
  };

  const installFavoriteButtons = root => {
    const cards = [];
    if (root?.nodeType === 1 && root.matches?.('.product-card')) cards.push(root);
    root?.querySelectorAll?.('.product-card').forEach(card => cards.push(card));
    cards.forEach(card => {
      if (card.querySelector('.favorite-toggle')) return;
      const id = String(card.dataset.cardProduct || '').trim();
      if (!byId.has(id)) return;
      const visual = card.querySelector('.product-visual');
      if (!visual) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-toggle';
      button.dataset.favoriteId = id;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(id);
      });
      visual.append(button);
    });
    syncButtons();
  };

  const priceView = product => {
    const delivery = deliveryContext();
    const installed = product.base + product.install + delivery.price;
    const turnkey = installed + product.posts;
    let note = '';
    if (delivery.resolved) note = delivery.city ? `Цена с учётом доставки в ${delivery.city}.` : 'Доставка учтена в цене.';
    else if (delivery.manual) note = 'Доставка рассчитывается индивидуально.';
    else note = 'Место установки не выбрано.';
    return {installed,turnkey,note,delivery};
  };

  const openProduct = async id => {
    closeModal();
    let card = grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
    const showMore = document.getElementById('showMoreButton');
    for (let attempt = 0; !card && attempt < 10 && showMore && !showMore.hidden; attempt += 1) {
      showMore.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      card = grid.querySelector(`[data-card-product="${CSS.escape(id)}"]`);
    }
    if (!card) {
      catalog.scrollIntoView({behavior:'smooth',block:'start'});
      showToast('Откройте эту модель в каталоге');
      return;
    }
    card.querySelector('.select-product')?.click();
    track('favorite_compare_calculate',{article:byId.get(id)?.art || id});
  };

  function renderModal() {
    const selected = [...favorites].map(id => byId.get(id)).filter(Boolean);
    const delivery = deliveryContext();
    if (!selected.length) {
      modalContent.innerHTML = '<div class="favorites-empty"><span>♡</span><strong>Пока ничего не сохранено</strong><p>Нажмите «♡ Сохранить» на понравившихся воротах. Здесь они останутся рядом для сравнения.</p></div>';
      return;
    }

    const locationText = delivery.city
      ? `Место установки: <strong>${delivery.city}</strong>`
      : '<strong>Место установки не выбрано</strong>';
    modalContent.innerHTML = `<div class="favorites-location">${locationText}</div><div class="favorites-compare" style="--favorite-count:${Math.min(selected.length,4)}">${selected.map(product => {
      const view = priceView(product);
      return `<article class="favorite-compare-card" data-favorite-card="${product.id}">
        <div class="favorite-compare-image"><img src="${product.image}" alt="Ворота с калиткой ${product.art}" loading="lazy"><span class="favorite-compare-art">${product.art}</span><button class="favorite-remove" type="button" data-favorite-remove="${product.id}" aria-label="Убрать ${product.art} из избранного">×</button></div>
        <div class="favorite-compare-title">Ворота с калиткой</div>
        <div class="favorite-compare-prices">
          <div class="favorite-price-row"><small>Если подходящие столбы уже есть</small><strong>${money(view.installed)}</strong></div>
          <div class="favorite-price-row turnkey"><small>С новыми усиленными столбами</small><strong>${money(view.turnkey)}</strong></div>
          <p class="favorite-delivery-note">${view.note}</p>
        </div>
        <button class="favorite-compare-action" type="button" data-favorite-calculate="${product.id}">Рассчитать эту модель</button>
      </article>`;
    }).join('')}</div>`;

    modalContent.querySelectorAll('[data-favorite-remove]').forEach(button => {
      button.addEventListener('click', () => toggleFavorite(button.dataset.favoriteRemove));
    });
    modalContent.querySelectorAll('[data-favorite-calculate]').forEach(button => {
      button.addEventListener('click', () => openProduct(button.dataset.favoriteCalculate));
    });
  }

  function openModal() {
    modalOpen = true;
    renderModal();
    backdrop.hidden = false;
    modal.hidden = false;
    document.body.classList.add('favorites-modal-open');
    syncButtons();
    track('favorite_open',{count:favorites.size});
    requestAnimationFrame(() => modalClose.focus({preventScroll:true}));
  }

  function closeModal() {
    modalOpen = false;
    backdrop.hidden = true;
    modal.hidden = true;
    document.body.classList.remove('favorites-modal-open');
    syncButtons();
  }

  toolbarButton.addEventListener('click', openModal);
  floatingButton.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modalOpen) closeModal();
  });
  document.addEventListener('gate:calculated', () => {
    if (modalOpen) renderModal();
  });

  installFavoriteButtons(grid);
  new MutationObserver(records => {
    if (mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = 0;
      records.forEach(record => record.addedNodes.forEach(node => installFavoriteButtons(node)));
      installFavoriteButtons(grid);
    });
  }).observe(grid,{childList:true,subtree:true});
  new MutationObserver(syncButtons).observe(catalog,{attributes:true,attributeFilter:['class']});

  document.addEventListener('gate:calculated', syncButtons);
  window.addEventListener('pageshow', syncButtons);

  window.KUZDVOR_FAVORITES = {
    open:openModal,
    count:() => favorites.size,
    ids:() => [...favorites]
  };
})();
