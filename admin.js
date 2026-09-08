const loginView = document.getElementById('loginView');
const editorView = document.getElementById('editorView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const articleSelect = document.getElementById('articleSelect');
const photoInput = document.getElementById('photoInput');
const photoGrid = document.getElementById('photoGrid');
const coverPreview = document.getElementById('coverPreview');
const cardPreview = document.getElementById('cardPreview');
const previewPhotoBadge = document.getElementById('previewPhotoBadge');
const cropHelp = document.getElementById('cropHelp');
const centerPhotoButton = document.getElementById('centerPhotoButton');
const bottomPhotoButton = document.getElementById('bottomPhotoButton');
const fitPhotoButton = document.getElementById('fitPhotoButton');
const fillPhotoButton = document.getElementById('fillPhotoButton');
const cropZoom = document.getElementById('cropZoom');
const cropZoomValue = document.getElementById('cropZoomValue');
const cropZoomMinus = document.getElementById('cropZoomMinus');
const cropZoomPlus = document.getElementById('cropZoomPlus');
const previewArticle = document.getElementById('previewArticle');
const articleBadge = document.getElementById('articleBadge');
const photoCounter = document.getElementById('photoCounter');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const saveState = document.getElementById('saveState');
const uploadNote = document.getElementById('uploadNote');
const emptyPhotos = document.getElementById('emptyPhotos');
const toastElement = document.getElementById('toast');

let galleries = {};
let activeArticle = '';
let draft = null;
let dirty = false;
let removedUrls = [];
let selectedPhotoIndex = 0;
let toastTimer;
const DRAG_RESERVE = .08;

function displayZoom(zoom) {
  return zoom >= 1 ? zoom + DRAG_RESERVE : zoom;
}

function showToast(message, error = false) {
  window.clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.className = `toast show${error ? ' error' : ''}`;
  toastTimer = window.setTimeout(() => { toastElement.className = 'toast'; }, 3000);
}

async function api(path, options = {}) {
  const response = await fetch(path, {cache: 'no-store', ...options});
  let data = {};
  try { data = await response.json(); } catch {}
  if (response.status === 401) {
    showLogin();
    throw new Error('Сеанс завершён. Войдите снова.');
  }
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}

function showLogin() {
  editorView.hidden = true;
  loginView.hidden = false;
  document.getElementById('passwordInput').value = '';
}

function showEditor() {
  loginView.hidden = true;
  editorView.hidden = false;
}

function setDirty(value = true) {
  dirty = value;
  saveButton.disabled = !dirty;
  saveState.textContent = dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
  saveState.classList.toggle('dirty', dirty);
}

function cloneGallery(gallery) {
  const positions = {};
  const zooms = {};
  for (const url of gallery.photos) {
    const saved = gallery.positions?.[url] || {x: 50, y: 50};
    positions[url] = {x: Number(saved.x) || 0, y: Number(saved.y) || 0};
    const savedZoom = Number(gallery.zooms?.[url]);
    zooms[url] = Number.isFinite(savedZoom) ? Math.max(.4, Math.min(4, savedZoom)) : 1;
  }
  return {
    photos: [...gallery.photos],
    positions,
    zooms,
    defaultPhotos: [...gallery.defaultPhotos],
    fitMode: 'contain',
    mediaType: gallery.mediaType || 'photo',
    customized: Boolean(gallery.customized)
  };
}

function selectArticle(article) {
  activeArticle = article;
  articleSelect.value = article;
  draft = cloneGallery(galleries[article]);
  removedUrls = [];
  selectedPhotoIndex = 0;
  setDirty(false);
  render();
}

function pluralPhotos(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'фотографий';
  if (mod10 === 1) return 'фотография';
  if (mod10 >= 2 && mod10 <= 4) return 'фотографии';
  return 'фотографий';
}

function actionButton(label, title, disabled, handler, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  if (className) button.className = className;
  button.addEventListener('click', handler);
  return button;
}

function renderPhotos() {
  photoGrid.replaceChildren();
  emptyPhotos.hidden = draft.photos.length > 0;
  draft.photos.forEach((url, index) => {
    const item = document.createElement('article');
    item.className = `photo-item${index === selectedPhotoIndex ? ' selected' : ''}`;
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = `photo-thumb fit-${draft.fitMode}`;
    thumb.title = `Настроить область показа фотографии ${index + 1}`;
    thumb.setAttribute('aria-label', thumb.title);
    thumb.addEventListener('click', () => {
      selectedPhotoIndex = index;
      render();
    });
    const image = document.createElement('img');
    image.src = url;
    const position = draft.positions[url] || {x: 50, y: 50};
    const zoom = draft.zooms[url] || 1;
    image.style.objectPosition = 'center';
    image.style.objectFit = 'contain';
    image.style.transformOrigin = 'center';
    image.style.transform = 'none';
    image.alt = `Фотография ${index + 1} для ${activeArticle}`;
    image.loading = 'lazy';
    const number = document.createElement('span');
    number.className = `photo-number${index === 0 ? ' cover' : ''}`;
    number.textContent = index === 0 ? 'Обложка' : String(index + 1);
    thumb.append(image, number);

    const actions = document.createElement('div');
    actions.className = 'photo-actions';
    actions.append(
      actionButton(index === 0 ? 'Обложка' : 'На обложку', `Сделать фотографию ${index + 1} обложкой`, index === 0, () => moveToCover(index)),
      actionButton('←', `Переместить фотографию ${index + 1} влево`, index === 0, () => movePhoto(index, -1)),
      actionButton('→', `Переместить фотографию ${index + 1} вправо`, index === draft.photos.length - 1, () => movePhoto(index, 1)),
      actionButton('×', `Удалить фотографию ${index + 1}`, draft.photos.length <= 1, () => removePhoto(index), 'delete-photo')
    );
    item.append(thumb, actions);
    photoGrid.append(item);
  });
}

function render() {
  selectedPhotoIndex = Math.max(0, Math.min(selectedPhotoIndex, draft.photos.length - 1));
  const selectedUrl = draft.photos[selectedPhotoIndex] || '';
  const selectedPosition = draft.positions[selectedUrl] || {x: 50, y: 50};
  const selectedZoom = draft.zooms[selectedUrl] || 1;
  previewArticle.textContent = activeArticle;
  articleBadge.textContent = activeArticle;
  photoCounter.textContent = `${draft.photos.length} ${pluralPhotos(draft.photos.length)}`;
  previewPhotoBadge.textContent = selectedPhotoIndex === 0 ? 'Обложка' : `Фото ${selectedPhotoIndex + 1}`;
  coverPreview.src = selectedUrl;
  coverPreview.alt = `Фотография ${selectedPhotoIndex + 1} ворот ${activeArticle}`;
  coverPreview.style.objectPosition = 'center';
  coverPreview.style.objectFit = 'contain';
  coverPreview.style.transformOrigin = 'center';
  coverPreview.style.transform = 'none';
  cardPreview.className = 'card-preview fit-contain';
  cardPreview.classList.remove('can-drag');
  cropHelp.hidden = true;
  cropZoom.value = String(Math.round(selectedZoom * 100));
  cropZoomValue.value = `${Math.round(selectedZoom * 100)}%`;
  cropZoomValue.textContent = cropZoomValue.value;
  document.querySelectorAll('input[name="fitMode"]').forEach(input => { input.checked = input.value === draft.fitMode; });
  resetButton.disabled = !draft.customized && !dirty;
  renderPhotos();
}

function setSelectedPosition(x, y) {
  const url = draft.photos[selectedPhotoIndex];
  if (!url) return;
  const next = {
    x: Math.round(Math.max(0, Math.min(100, x)) * 10) / 10,
    y: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10
  };
  draft.positions[url] = next;
  coverPreview.style.objectPosition = `${next.x}% ${next.y}%`;
  coverPreview.style.transformOrigin = `${next.x}% ${next.y}%`;
  const thumbnail = photoGrid.children[selectedPhotoIndex]?.querySelector('img');
  if (thumbnail) {
    thumbnail.style.objectPosition = `${next.x}% ${next.y}%`;
    thumbnail.style.transformOrigin = `${next.x}% ${next.y}%`;
  }
  setDirty();
}

function setSelectedZoom(value) {
  const url = draft.photos[selectedPhotoIndex];
  if (!url) return;
  const zoom = Math.round(Math.max(.4, Math.min(4, value)) * 100) / 100;
  draft.zooms[url] = zoom;
  if (zoom < 1) draft.positions[url] = {x: 50, y: 50};
  const position = draft.positions[url] || {x: 50, y: 50};
  coverPreview.style.objectFit = draft.fitMode === 'cover' && zoom >= 1 ? 'cover' : 'contain';
  coverPreview.style.objectPosition = `${position.x}% ${position.y}%`;
  coverPreview.style.transformOrigin = `${position.x}% ${position.y}%`;
  coverPreview.style.transform = draft.fitMode === 'cover' ? `scale(${displayZoom(zoom)})` : 'none';
  const thumbnail = photoGrid.children[selectedPhotoIndex]?.querySelector('img');
  if (thumbnail) {
    thumbnail.style.objectFit = draft.fitMode === 'cover' && zoom >= 1 ? 'cover' : 'contain';
    thumbnail.style.objectPosition = `${position.x}% ${position.y}%`;
    thumbnail.style.transformOrigin = `${position.x}% ${position.y}%`;
    thumbnail.style.transform = draft.fitMode === 'cover' ? `scale(${displayZoom(zoom)})` : 'none';
  }
  cardPreview.classList.toggle('can-drag', draft.fitMode === 'cover' && zoom >= 1);
  cropZoom.value = String(Math.round(zoom * 100));
  cropZoomValue.value = `${Math.round(zoom * 100)}%`;
  cropZoomValue.textContent = cropZoomValue.value;
  setDirty();
}

let dragState = null;

cardPreview.addEventListener('pointerdown', event => {
  if (draft?.fitMode !== 'cover' || !draft.photos[selectedPhotoIndex]) return;
  if ((draft.zooms[draft.photos[selectedPhotoIndex]] || 1) < 1) return;
  const position = draft.positions[draft.photos[selectedPhotoIndex]] || {x: 50, y: 50};
  dragState = {pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, position: {...position}};
  cardPreview.setPointerCapture(event.pointerId);
  cardPreview.classList.add('dragging');
  event.preventDefault();
});

cardPreview.addEventListener('pointermove', event => {
  if (!dragState || dragState.pointerId !== event.pointerId || !coverPreview.naturalWidth) return;
  const width = cardPreview.clientWidth;
  const height = cardPreview.clientHeight;
  const zoom = draft.zooms[draft.photos[selectedPhotoIndex]] || 1;
  const renderedZoom = displayZoom(zoom);
  const scale = zoom >= 1
    ? Math.max(width / coverPreview.naturalWidth, height / coverPreview.naturalHeight)
    : Math.min(width / coverPreview.naturalWidth, height / coverPreview.naturalHeight);
  const overflowX = Math.max(0, coverPreview.naturalWidth * scale * renderedZoom - width);
  const overflowY = Math.max(0, coverPreview.naturalHeight * scale * renderedZoom - height);
  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;
  const x = overflowX > .5 ? dragState.position.x - deltaX / width * 100 : 50;
  const y = overflowY > .5 ? dragState.position.y - deltaY / height * 100 : 50;
  setSelectedPosition(x, y);
});

function finishDragging(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  cardPreview.classList.remove('dragging');
}

cardPreview.addEventListener('pointerup', finishDragging);
cardPreview.addEventListener('pointercancel', finishDragging);

centerPhotoButton.addEventListener('click', () => {
  setSelectedPosition(50, 50);
  render();
});

bottomPhotoButton.addEventListener('click', () => {
  const url = draft.photos[selectedPhotoIndex];
  const position = draft.positions[url] || { x: 50, y: 50 };
  setSelectedPosition(position.x, 100);
  render();
});

fitPhotoButton.addEventListener('click', () => {
  setSelectedPosition(50, 50);
  setSelectedZoom(.95);
  render();
});

fillPhotoButton.addEventListener('click', () => {
  setSelectedPosition(50, 50);
  setSelectedZoom(1);
  render();
});

cropZoom.addEventListener('input', () => setSelectedZoom(Number(cropZoom.value) / 100));

cropZoomMinus.addEventListener('click', () => {
  const url = draft.photos[selectedPhotoIndex];
  if (!url) return;
  setSelectedZoom((draft.zooms[url] || 1) - .01);
});

cropZoomPlus.addEventListener('click', () => {
  const url = draft.photos[selectedPhotoIndex];
  if (!url) return;
  setSelectedZoom((draft.zooms[url] || 1) + .01);
});

function movePhoto(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= draft.photos.length) return;
  const selectedUrl = draft.photos[selectedPhotoIndex];
  [draft.photos[index], draft.photos[next]] = [draft.photos[next], draft.photos[index]];
  selectedPhotoIndex = draft.photos.indexOf(selectedUrl);
  setDirty();
  render();
}

function moveToCover(index) {
  const selectedUrl = draft.photos[selectedPhotoIndex];
  const [photo] = draft.photos.splice(index, 1);
  draft.photos.unshift(photo);
  selectedPhotoIndex = draft.photos.indexOf(selectedUrl);
  setDirty();
  render();
}

function removePhoto(index) {
  if (draft.photos.length <= 1) {
    showToast('Сначала добавьте фотографию на замену', true);
    return;
  }
  const [removed] = draft.photos.splice(index, 1);
  if (removed.startsWith('/catalog-media/')) removedUrls.push(removed);
  delete draft.positions[removed];
  delete draft.zooms[removed];
  if (selectedPhotoIndex > index) selectedPhotoIndex -= 1;
  else if (selectedPhotoIndex === index) selectedPhotoIndex = Math.min(index, draft.photos.length - 1);
  setDirty();
  render();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть фотографию')); };
    image.src = url;
  });
}

async function optimizeImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: выбран не файл фотографии`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: исходный файл превышает 25 МБ`);
  const image = await loadImage(file);
  const ratio = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', {alpha: false});
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
  if (!blob) throw new Error(`${file.name}: не удалось подготовить фотографию`);
  return blob;
}

async function uploadFiles(files) {
  const available = 12 - draft.photos.length;
  if (available <= 0) return showToast('В карточке уже 12 фотографий', true);
  const selected = [...files].slice(0, available);
  photoInput.disabled = true;
  uploadNote.classList.add('loading');
  try {
    for (let index = 0; index < selected.length; index += 1) {
      uploadNote.textContent = `Подготавливаем и загружаем ${index + 1} из ${selected.length}…`;
      const blob = await optimizeImage(selected[index]);
      const data = await api(`/api/admin/upload?article=${encodeURIComponent(activeArticle)}`, {
        method: 'POST',
        headers: {'content-type': 'image/webp'},
        body: blob
      });
      draft.photos.push(data.photo.url);
      draft.positions[data.photo.url] = {x: 50, y: 50};
      draft.zooms[data.photo.url] = 1;
      selectedPhotoIndex = draft.photos.length - 1;
      draft.mediaType = 'photo';
      setDirty();
      render();
    }
    showToast(selected.length === 1 ? 'Фотография добавлена. Не забудьте сохранить.' : 'Фотографии добавлены. Не забудьте сохранить.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    photoInput.value = '';
    photoInput.disabled = false;
    uploadNote.classList.remove('loading');
    uploadNote.textContent = 'Можно загрузить до 12 фотографий. Большие файлы автоматически уменьшаются без изменения пропорций.';
  }
}

async function loadCatalog() {
  try {
    const data = await api('/api/admin/catalog');
    galleries = data.galleries;
    const articles = Object.keys(galleries);
    articleSelect.innerHTML = articles.map(article => `<option value="${article}">${article}</option>`).join('');
    showEditor();
    selectArticle(articles[0]);
  } catch (error) {
    if (!loginView.hidden) return;
    showToast(error.message, true);
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  loginError.hidden = true;
  try {
    await api('/api/admin/login', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({username: document.getElementById('loginInput').value, password: document.getElementById('passwordInput').value})
    });
    await loadCatalog();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

articleSelect.addEventListener('change', () => {
  if (dirty) {
    showToast('Сначала сохраните изменения в текущей карточке', true);
    articleSelect.value = activeArticle;
    return;
  }
  selectArticle(articleSelect.value);
});

document.querySelectorAll('input[name="fitMode"]').forEach(input => input.addEventListener('change', () => {
  draft.fitMode = 'contain';
  setDirty();
  render();
}));

photoInput.addEventListener('change', () => uploadFiles(photoInput.files));

saveButton.addEventListener('click', async () => {
  if (!dirty || !draft.photos.length) return;
  saveButton.disabled = true;
  saveButton.textContent = 'Сохраняем…';
  try {
    const data = await api(`/api/admin/catalog/${encodeURIComponent(activeArticle)}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({photos: draft.photos, positions: draft.positions, zooms: draft.zooms, fitMode: 'contain', mediaType: draft.mediaType, removedUrls})
    });
    galleries[activeArticle] = {...cloneGallery(draft), ...data.gallery, defaultPhotos: [...draft.defaultPhotos]};
    draft.customized = true;
    removedUrls = [];
    setDirty(false);
    render();
    showToast('Изменения опубликованы в каталоге');
  } catch (error) {
    setDirty(true);
    showToast(error.message, true);
  } finally {
    saveButton.textContent = 'Сохранить изменения';
    saveButton.disabled = !dirty;
  }
});

resetButton.addEventListener('click', async () => {
  if (!window.confirm(`Вернуть для ${activeArticle} фотографии, которые были на сайте изначально?`)) return;
  try {
    const data = await api(`/api/admin/catalog/${encodeURIComponent(activeArticle)}`, {method: 'DELETE'});
    galleries[activeArticle] = {...data.gallery, defaultPhotos: [...data.gallery.photos]};
    selectArticle(activeArticle);
    showToast('Исходные фотографии восстановлены');
  } catch (error) {
    showToast(error.message, true);
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', {method: 'POST'}); } catch {}
  showLogin();
});

window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

loadCatalog();
