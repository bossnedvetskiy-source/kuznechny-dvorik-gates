(() => {
  if (window.KUZDVOR_COLOR_PHOTO_SITE_READY) return;
  window.KUZDVOR_COLOR_PHOTO_SITE_READY = true;

  const COLORS = [
    {id:'chocolate', label:'Шоколад', short:'Шоколад', ral:'RAL 8017'},
    {id:'graphite', label:'Графит', short:'Графит', ral:'RAL 7024'},
    {id:'moss', label:'Зелёный мох', short:'Мох', ral:'RAL 6005'},
    {id:'mint', label:'Зелёная мята', short:'Мята', ral:'RAL 6029'},
    {id:'wine', label:'Винно-красный', short:'Винный', ral:'RAL 3005'}
  ];
  const COLORS_BY_ID = new Map(COLORS.map(color => [color.id, color]));
  const selectedByProduct = new Map();
  let colorPhotosByArticle = {};

  const style = document.createElement('style');
  style.textContent = `
    .profile-color-wash{display:none!important}
    .product-visual.is-color-preview .profile-color-wash{display:none!important}
    .profile-color-option.is-photo-missing{opacity:.42;cursor:not-allowed}
    .profile-color-option.is-photo-missing .profile-color-dot{filter:saturate(.55)}
    .profile-color-option.is-photo-ready .profile-color-dot::after{content:"";position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border:2px solid #fff;border-radius:50%;background:#64814a;box-shadow:0 1px 3px rgba(0,0,0,.2)}
    .profile-color-note b{color:#6e665d;font-weight:900}
  `;
  document.head.append(style);

  const api = () => window.GATE_PAGE_API;
  const productForCard = card => api()?.productById?.(card?.dataset.cardProduct) || null;
  const visualForCard = card => card?.querySelector('.product-visual') || null;

  function setPressed(card, colorId) {
    card?.querySelectorAll('.profile-color-option').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.profileColor === colorId));
    });
  }

  function restoreGalleryPhoto(card, keepOther = false) {
    const product = productForCard(card);
    const visual = visualForCard(card);
    if (!product || !visual) return;
    const index = Number(visual.dataset.imageIndex) || 0;
    const url = product.gallery?.[index] || product.image;
    const image = visual.querySelector('.product-image-open img');
    const backdrop = visual.querySelector('.product-image-backdrop');
    if (image && url) {
      image.src = url;
      image.alt = `Фотография ворот с калиткой ${product.art}, ${index + 1} из ${Math.max(1, product.gallery?.length || 1)}`;
    }
    if (backdrop && url) backdrop.src = url;
    visual.classList.remove('is-color-preview');
    visual.style.removeProperty('--profile-preview-color');
    delete visual.dataset.colorPreview;
    const counter = visual.querySelector('[data-photo-count]');
    if (counter) {
      const count = product.gallery?.length || 1;
      counter.textContent = product.media === 'sketch' ? 'Эскиз' : count > 1 ? `${index + 1} из ${count}` : '1 фото';
    }
    if (!keepOther) {
      selectedByProduct.delete(card.dataset.cardProduct);
      setPressed(card, '');
    }
  }

  function applyUploadedColor(card, colorId, shouldTrack = true) {
    const product = productForCard(card);
    const visual = visualForCard(card);
    const status = card?.querySelector('.profile-color-status');
    if (!product || !visual) return;

    if (colorId === 'other') {
      restoreGalleryPhoto(card, true);
      selectedByProduct.set(card.dataset.cardProduct, 'other');
      setPressed(card, 'other');
      if (status) status.textContent = 'Другие цвета — при оформлении';
      if (shouldTrack) {
        try { window.ym?.(107269914, 'reachGoal', 'catalog_color_preview', {article:product.art, color:'other'}); } catch {}
      }
      return;
    }

    const color = COLORS_BY_ID.get(colorId);
    const url = colorPhotosByArticle?.[product.art]?.[colorId];
    if (!color || !url) {
      restoreGalleryPhoto(card);
      if (status) status.textContent = color ? `${color.label}: фото пока не загружено` : 'Выберите цвет';
      return;
    }

    const image = visual.querySelector('.product-image-open img');
    const backdrop = visual.querySelector('.product-image-backdrop');
    if (image) {
      image.src = url;
      image.alt = `${product.art}, профнастил ${color.label}, ${color.ral}`;
    }
    if (backdrop) backdrop.src = url;
    visual.classList.remove('is-color-preview');
    visual.style.removeProperty('--profile-preview-color');
    visual.dataset.colorPreview = colorId;
    selectedByProduct.set(card.dataset.cardProduct, colorId);
    setPressed(card, colorId);
    const counter = visual.querySelector('[data-photo-count]');
    if (counter) counter.textContent = color.label;
    if (status) status.textContent = `${color.label} · ${color.ral}`;
    if (shouldTrack) {
      try { window.ym?.(107269914, 'reachGoal', 'catalog_color_preview', {article:product.art, color:colorId}); } catch {}
    }
  }

  function syncCard(card) {
    const product = productForCard(card);
    if (!product) return;
    const colorPhotos = colorPhotosByArticle?.[product.art] || {};
    const picker = card.querySelector('.profile-color-picker');
    if (!picker) return;

    const heading = picker.querySelector('.profile-color-picker-head strong');
    const status = picker.querySelector('.profile-color-status');
    const note = picker.querySelector('.profile-color-note');
    if (heading) heading.textContent = 'Посмотрите цвет на реальном фото';
    if (note) note.innerHTML = '<b>Показаны популярные цвета.</b> Доступны и другие варианты; цвет не влияет на предварительную стоимость.';

    for (const button of picker.querySelectorAll('.profile-color-option')) {
      const id = button.dataset.profileColor;
      if (id === 'other') {
        button.classList.remove('is-photo-missing');
        button.classList.add('is-photo-ready');
        button.disabled = false;
        button.title = 'Доступны и другие цвета профнастила';
        continue;
      }
      const color = COLORS_BY_ID.get(id);
      const ready = Boolean(colorPhotos[id]);
      button.classList.toggle('is-photo-ready', ready);
      button.classList.toggle('is-photo-missing', !ready);
      button.disabled = !ready;
      button.setAttribute('aria-label', ready
        ? `Показать реальное фото: ${color?.label || id}, ${color?.ral || ''}`
        : `${color?.label || id}: фото пока не загружено`);
      button.title = ready
        ? `${color?.label || id} · ${color?.ral || ''}`
        : `${color?.label || id}: фото пока не загружено`;
    }

    const remembered = selectedByProduct.get(card.dataset.cardProduct);
    if (remembered && (remembered === 'other' || colorPhotos[remembered])) {
      applyUploadedColor(card, remembered, false);
    } else {
      selectedByProduct.delete(card.dataset.cardProduct);
      setPressed(card, '');
      if (status) status.textContent = Object.keys(colorPhotos).length ? 'Выберите цвет' : 'Фото цветов скоро добавим';
    }

    const visual = visualForCard(card);
    if (visual && !visual.dataset.colorPhotoObserver) {
      visual.dataset.colorPhotoObserver = '1';
      new MutationObserver(mutations => {
        if (!mutations.some(mutation => mutation.attributeName === 'data-image-index')) return;
        if (!selectedByProduct.has(card.dataset.cardProduct)) return;
        selectedByProduct.delete(card.dataset.cardProduct);
        delete visual.dataset.colorPreview;
        setPressed(card, '');
        const currentStatus = card.querySelector('.profile-color-status');
        if (currentStatus) currentStatus.textContent = 'Выберите цвет';
      }).observe(visual, {attributes:true, attributeFilter:['data-image-index']});
    }
  }

  function syncCards() {
    document.querySelectorAll('.product-card').forEach(syncCard);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.profile-color-option');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    const card = button.closest('.product-card');
    applyUploadedColor(card, button.dataset.profileColor, true);
  }, true);

  async function loadColorPhotos() {
    try {
      const response = await fetch('/api/catalog-images', {cache:'no-store'});
      if (!response.ok) throw new Error('catalog');
      const data = await response.json();
      colorPhotosByArticle = Object.fromEntries(Object.entries(data.galleries || {}).map(([article, gallery]) => [article, {...(gallery?.colorPhotos || {})}]));
    } catch {
      colorPhotosByArticle = {};
    }
    syncCards();
  }

  const grid = document.getElementById('catalogGrid');
  if (grid) new MutationObserver(() => queueMicrotask(syncCards)).observe(grid, {childList:true, subtree:false});

  queueMicrotask(() => {
    document.querySelectorAll('.profile-color-wash').forEach(node => node.remove());
    document.querySelectorAll('.product-visual').forEach(visual => {
      visual.classList.remove('is-color-preview');
      visual.style.removeProperty('--profile-preview-color');
    });
    syncCards();
    loadColorPhotos();
  });
})();
