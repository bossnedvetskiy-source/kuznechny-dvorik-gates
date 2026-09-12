(() => {
  if (window.KUZDVOR_ADMIN_COLORS_READY) return;
  window.KUZDVOR_ADMIN_COLORS_READY = true;

  const COLORS = [
    {id:'chocolate', label:'Шоколад', ral:'RAL 8017', hex:'#4a2f29'},
    {id:'graphite', label:'Графит', ral:'RAL 7024', hex:'#45494e'},
    {id:'moss', label:'Зелёный мох', ral:'RAL 6005', hex:'#174533'},
    {id:'mint', label:'Зелёная мята', ral:'RAL 6029', hex:'#008754'},
    {id:'wine', label:'Винно-красный', ral:'RAL 3005', hex:'#5e2028'}
  ];

  const style = document.createElement('style');
  style.textContent = `
    .color-photo-panel{margin-top:18px;padding:22px;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 15px 45px rgba(18,16,13,.055)}
    .color-photo-intro{margin:-5px 0 17px;color:var(--muted);font-size:10px;line-height:1.55}
    .color-photo-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .color-photo-card{display:grid;grid-template-rows:120px auto;overflow:hidden;border:1px solid #e3ddd3;border-radius:14px;background:#faf8f4}
    .color-photo-preview{position:relative;display:grid;place-items:center;overflow:hidden;background:#17191c}
    .color-photo-preview img{width:100%;height:100%;display:block;object-fit:contain;background:#17191c}
    .color-photo-empty{display:grid;place-items:center;width:100%;height:100%;padding:12px;color:rgba(255,255,255,.55);font-size:9px;font-weight:700;text-align:center;line-height:1.35}
    .color-photo-swatch{position:absolute;left:8px;top:8px;width:25px;height:25px;border:2px solid #fff;border-radius:50%;background:var(--swatch);box-shadow:0 1px 5px rgba(0,0,0,.28)}
    .color-photo-body{display:grid;gap:8px;padding:10px}
    .color-photo-title{display:grid;gap:2px}.color-photo-title b{font-size:11px}.color-photo-title small{color:var(--muted);font-size:8px;font-weight:800}
    .color-photo-actions{display:grid;grid-template-columns:1fr auto;gap:6px}
    .color-photo-upload,.color-photo-remove{min-height:34px;display:grid;place-items:center;padding:0 8px;border-radius:8px;font-size:9px;font-weight:800}
    .color-photo-upload{border:0;background:var(--ink);color:#fff;cursor:pointer}.color-photo-upload.disabled{opacity:.4;pointer-events:none}
    .color-photo-remove{border:1px solid var(--line);background:#fff;color:var(--danger)}.color-photo-remove:disabled{opacity:.3;cursor:not-allowed}
    .color-photo-state{color:#667755;font-size:9px;font-weight:800}.color-photo-state.loading{color:#9a6721}
    @media(max-width:950px){.color-photo-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:620px){.color-photo-panel{padding:15px;border-radius:16px}.color-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.color-photo-card{grid-template-rows:105px auto}.color-photo-title b{font-size:10px}}
  `;
  document.head.append(style);

  const photosTab = document.getElementById('photosTab');
  if (!photosTab) return;

  const panel = document.createElement('section');
  panel.className = 'color-photo-panel';
  panel.innerHTML = `
    <div class="panel-heading">
      <div><span>Популярные цвета</span><h2>Фото ворот по цветам</h2></div>
      <span class="color-photo-state" id="colorPhotoState">Загружайте реальные фото</span>
    </div>
    <p class="color-photo-intro">Для каждого цвета загрузите отдельную подходящую фотографию этой модели. На сайте клиент увидит именно это фото — без автоматической перекраски.</p>
    <div class="color-photo-grid" id="colorPhotoGrid"></div>
  `;
  const actionBar = photosTab.querySelector('.action-bar');
  if (actionBar) actionBar.before(panel);
  else photosTab.append(panel);

  const grid = panel.querySelector('#colorPhotoGrid');
  const state = panel.querySelector('#colorPhotoState');

  const currentColors = () => ({...(galleries?.[activeArticle]?.colorPhotos || {})});

  function setState(text, loading = false) {
    state.textContent = text;
    state.classList.toggle('loading', loading);
  }

  async function persist(article, colorPhotos) {
    const data = await api(`/api/admin/catalog-colors/${encodeURIComponent(article)}`, {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({colorPhotos})
    });
    if (galleries[article]) galleries[article].colorPhotos = {...(data.colorPhotos || {})};
    return data.colorPhotos || {};
  }

  async function uploadColor(color, file) {
    if (!file) return;
    if (!photoUploadEnabled) return showToast('Загрузка фотографий временно недоступна', true);
    const article = activeArticle;
    const oldMap = currentColors();
    setState(`Загружаем: ${color.label}…`, true);
    try {
      const blob = await optimizeImage(file);
      const uploaded = await api(`/api/admin/upload?article=${encodeURIComponent(article)}`, {
        method:'POST',
        headers:{'content-type':'image/webp'},
        body:blob
      });
      const next = {...oldMap, [color.id]:uploaded.photo.url};
      await persist(article, next);
      if (activeArticle === article) render();
      showToast(`${color.label}: фото опубликовано`);
      setState('Все фото цветов сохраняются сразу');
    } catch (error) {
      showToast(error.message, true);
      setState('Не удалось сохранить фото', false);
    }
  }

  async function removeColor(color) {
    const article = activeArticle;
    const next = currentColors();
    if (!next[color.id]) return;
    if (!window.confirm(`Удалить фото цвета «${color.label}» для ${article}?`)) return;
    delete next[color.id];
    setState(`Удаляем: ${color.label}…`, true);
    try {
      await persist(article, next);
      if (activeArticle === article) render();
      showToast(`${color.label}: фото удалено`);
      setState('Все фото цветов сохраняются сразу');
    } catch (error) {
      showToast(error.message, true);
      setState('Не удалось удалить фото');
    }
  }

  function render() {
    if (!activeArticle || !galleries?.[activeArticle]) {
      grid.replaceChildren();
      return;
    }
    const map = currentColors();
    grid.replaceChildren();
    for (const color of COLORS) {
      const url = map[color.id] || '';
      const card = document.createElement('article');
      card.className = 'color-photo-card';

      const preview = document.createElement('div');
      preview.className = 'color-photo-preview';
      const swatch = document.createElement('span');
      swatch.className = 'color-photo-swatch';
      swatch.style.setProperty('--swatch', color.hex);
      preview.append(swatch);
      if (url) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = `${activeArticle}, ${color.label}`;
        image.loading = 'lazy';
        preview.append(image);
      } else {
        const empty = document.createElement('span');
        empty.className = 'color-photo-empty';
        empty.textContent = 'Фото этого цвета ещё не загружено';
        preview.append(empty);
      }

      const body = document.createElement('div');
      body.className = 'color-photo-body';
      body.innerHTML = `<div class="color-photo-title"><b>${color.label}</b><small>${color.ral}</small></div>`;
      const actions = document.createElement('div');
      actions.className = 'color-photo-actions';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/*';
      input.hidden = true;
      const upload = document.createElement('label');
      upload.className = `color-photo-upload${photoUploadEnabled ? '' : ' disabled'}`;
      upload.textContent = url ? 'Заменить фото' : '+ Загрузить фото';
      upload.append(input);
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        uploadColor(color, file);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'color-photo-remove';
      remove.textContent = '×';
      remove.title = `Удалить фото цвета ${color.label}`;
      remove.setAttribute('aria-label', remove.title);
      remove.disabled = !url;
      remove.addEventListener('click', () => removeColor(color));
      actions.append(upload, remove);
      body.append(actions);
      card.append(preview, body);
      grid.append(card);
    }
    const count = Object.keys(map).length;
    setState(count ? `Загружено ${count} из ${COLORS.length}` : 'Загрузите фото популярных цветов');
  }

  articleSelect?.addEventListener('change', () => setTimeout(render, 0));
  document.addEventListener('admin:ready', render);
})();
