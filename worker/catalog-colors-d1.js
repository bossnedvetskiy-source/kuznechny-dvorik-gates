const CATALOG_COLOR_IDS = Object.freeze(['chocolate','graphite','moss','mint','wine']);
const CATALOG_COLOR_ID_SET = new Set(CATALOG_COLOR_IDS);
const CATALOG_COLOR_SETTINGS_KEY = 'catalog_color_photos';

function cleanCatalogColorMap(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = {};
  for (const [article, colors] of Object.entries(source)) {
    if (!ALLOWED_ARTICLES.has(article) || !colors || typeof colors !== 'object') continue;
    const clean = {};
    for (const colorId of CATALOG_COLOR_IDS) {
      const url = typeof colors[colorId] === 'string' ? colors[colorId].trim() : '';
      if (url && validPhotoUrl(article, url)) clean[colorId] = url;
    }
    if (Object.keys(clean).length) result[article] = clean;
  }
  return result;
}

async function loadCatalogColorPhotos(env) {
  if (!await ensureSiteSettings(env)) return {};
  try {
    const row = await env.DB.prepare('SELECT value_json FROM site_settings WHERE key = ?')
      .bind(CATALOG_COLOR_SETTINGS_KEY).first();
    if (!row?.value_json) return {};
    return cleanCatalogColorMap(JSON.parse(row.value_json));
  } catch {
    return {};
  }
}

async function saveCatalogColorPhotos(env, article, input) {
  if (!await ensureSiteSettings(env)) throw new Error('База данных временно недоступна');
  if (!ALLOWED_ARTICLES.has(article)) throw new Error('Модель не найдена');

  const all = await loadCatalogColorPhotos(env);
  const previous = {...(all[article] || {})};
  const source = input && typeof input === 'object' ? input : {};
  const clean = {};
  for (const colorId of CATALOG_COLOR_IDS) {
    const value = typeof source[colorId] === 'string' ? source[colorId].trim() : '';
    if (!value) continue;
    if (!validPhotoUrl(article, value)) throw new Error(`Недопустимая фотография для цвета ${colorId}`);
    clean[colorId] = value;
  }

  if (Object.keys(clean).length) all[article] = clean;
  else delete all[article];

  await env.DB.prepare(`INSERT INTO site_settings (key, value_json, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, 'admin')
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
    .bind(CATALOG_COLOR_SETTINGS_KEY, JSON.stringify(all)).run();

  const regular = await storedGallery(env, article) || defaultGallery(article);
  const retained = new Set([
    ...(regular?.photos || []).map(mediaKeyFromUrl).filter(Boolean),
    ...Object.values(clean).map(mediaKeyFromUrl).filter(Boolean)
  ]);
  const obsolete = Object.values(previous)
    .map(mediaKeyFromUrl)
    .filter(Boolean)
    .filter(key => !retained.has(key));
  await Promise.allSettled(obsolete.map(key => deleteCatalogMediaObject(env, key)));
  return clean;
}

const __allGalleriesWithoutColorPhotos = allGalleries;
allGalleries = async function allGalleriesWithColorPhotos(env, includeDefaults = false) {
  const galleries = await __allGalleriesWithoutColorPhotos(env, includeDefaults);
  const colorPhotos = await loadCatalogColorPhotos(env);
  for (const [article, gallery] of Object.entries(galleries)) {
    gallery.colorPhotos = {...(colorPhotos[article] || {})};
  }
  return galleries;
};

const __handleAdminApiWithoutCatalogColors = handleAdminApi;
handleAdminApi = async function handleAdminApiWithCatalogColors(request, env, url) {
  if (!url.pathname.startsWith('/api/admin/catalog-colors/')) {
    return __handleAdminApiWithoutCatalogColors(request, env, url);
  }

  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!await hasAdminSession(request, env)) return json({error: 'Требуется вход'}, 401);

  let article;
  try {
    article = decodeURIComponent(url.pathname.slice('/api/admin/catalog-colors/'.length));
  } catch {
    return json({error: 'Модель не найдена'}, 404);
  }
  if (!ALLOWED_ARTICLES.has(article)) return json({error: 'Модель не найдена'}, 404);

  try {
    if (request.method === 'GET') {
      const all = await loadCatalogColorPhotos(env);
      return json({colorPhotos: {...(all[article] || {})}});
    }
    if (request.method === 'POST') {
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 32768) return json({error: 'Слишком большой запрос'}, 413);
      const body = await request.json();
      const colorPhotos = await saveCatalogColorPhotos(env, article, body?.colorPhotos);
      return json({ok: true, colorPhotos});
    }
    return json({error: 'Метод не поддерживается'}, 405);
  } catch (error) {
    return json({error: 'Не удалось сохранить фотографии цветов: ' + errorMessage(error)}, 500);
  }
};
