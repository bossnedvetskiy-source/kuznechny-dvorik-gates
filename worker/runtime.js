const PAGE = __PUBLIC_PAGE__;
const ADMIN_PAGE = __ADMIN_PAGE__;
const DEFAULT_GALLERIES = __DEFAULT_GALLERIES__;
const ORIGIN = __DELIVERY_ORIGIN__;
const FALLBACK_RATE = __DELIVERY_RATE__;

const SKETCH_ARTICLES = new Set(['Арт.4', 'Арт.11', 'Арт.34', 'Арт.37']);
const ALLOWED_ARTICLES = new Set(Object.keys(DEFAULT_GALLERIES));
const SESSION_COOKIE = 'kd_admin_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const deliveryCache = new Map();
const loginAttempts = new Map();
let geocodeQueue = Promise.resolve();
let lastGeocodeAt = 0;

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

const json = (data, status = 200, cacheControl = 'no-store', extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    ...securityHeaders,
    ...extraHeaders
  }
});

const html = (content, status = 200, admin = false) => new Response(content, {
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, max-age=0, must-revalidate',
    ...securityHeaders,
    ...(admin ? {'x-frame-options': 'DENY'} : {})
  }
});

const errorMessage = error => error instanceof Error ? error.message : 'Неизвестная ошибка';

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(value => {
    const index = value.indexOf('=');
    if (index < 0) return ['', ''];
    return [value.slice(0, index).trim(), value.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

async function digestHex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function createSessionCookie(env) {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  const signature = await hmacHex(env.ADMIN_SESSION_SECRET, expires);
  return `${SESSION_COOKIE}=${expires}.${signature}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

async function hasAdminSession(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const session = parseCookies(request)[SESSION_COOKIE] || '';
  const [expires, signature, extra] = session.split('.');
  if (!expires || !signature || extra || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;
  const expected = await hmacHex(env.ADMIN_SESSION_SECRET, expires);
  return constantTimeEqual(signature, expected);
}

function sameOrigin(request, url) {
  return request.headers.get('origin') === url.origin;
}

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function canAttemptLogin(request) {
  const key = clientKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.delete(key);
    return true;
  }
  return attempt.count < 5;
}

function registerFailedLogin(request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, {count: 1, resetAt: now + 15 * 60 * 1000});
  } else {
    current.count += 1;
  }
  if (loginAttempts.size > 500) loginAttempts.clear();
}

async function handleLogin(request, env, url) {
  if (!sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({error: 'Вход в редактор ещё не настроен'}, 503);
  }
  if (!canAttemptLogin(request)) return json({error: 'Слишком много попыток. Попробуйте через 15 минут.'}, 429);
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return json({error: 'Слишком большой запрос'}, 413);
    const body = await request.json();
    const username = String(body.username || '').trim();
    const passwordHash = await digestHex(String(body.password || ''));
    const expectedPasswordHash = await digestHex(env.ADMIN_PASSWORD);
    const validUsername = constantTimeEqual(username, env.ADMIN_USERNAME);
    const validPassword = constantTimeEqual(passwordHash, expectedPasswordHash);
    if (!validUsername || !validPassword) {
      registerFailedLogin(request);
      return json({error: 'Неверный логин или пароль'}, 401);
    }
    loginAttempts.delete(clientKey(request));
    return json({ok: true}, 200, 'no-store', {'set-cookie': await createSessionCookie(env)});
  } catch {
    return json({error: 'Не удалось выполнить вход'}, 400);
  }
}

function defaultGallery(article) {
  const photos = [...(DEFAULT_GALLERIES[article] || [])];
  return {
    photos,
    positions: Object.fromEntries(photos.map(url => [url, {x: 50, y: 50}])),
    zooms: Object.fromEntries(photos.map(url => [url, 1])),
    fitMode: 'contain',
    mediaType: SKETCH_ARTICLES.has(article) ? 'sketch' : 'photo',
    customized: false
  };
}

function parseStoredGallery(row) {
  try {
    const storedPhotos = JSON.parse(row.photos_json);
    if (!Array.isArray(storedPhotos)) return null;
    const photos = [];
    const positions = {};
    const zooms = {};
    for (const stored of storedPhotos) {
      const url = typeof stored === 'string' ? stored : stored?.url;
      if (typeof url !== 'string') return null;
      const x = Number(typeof stored === 'object' ? stored.x : 50);
      const y = Number(typeof stored === 'object' ? stored.y : 50);
      const rawZoom = Number(typeof stored === 'object' ? stored.zoom : 1);
      photos.push(url);
      positions[url] = {
        x: Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50,
        y: Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50
      };
      zooms[url] = Number.isFinite(rawZoom) ? Math.max(.4, Math.min(4, rawZoom)) : 1;
    }
    return {
      photos,
      positions,
      zooms,
      fitMode: 'contain',
      mediaType: row.media_type === 'sketch' ? 'sketch' : 'photo',
      customized: true
    };
  } catch {
    return null;
  }
}

async function allGalleries(env, includeDefaults = false) {
  const galleries = Object.fromEntries([...ALLOWED_ARTICLES].map(article => [article, defaultGallery(article)]));
  if (env.DB) {
    const result = await env.DB.prepare('SELECT article, photos_json, fit_mode, media_type FROM catalog_galleries').all();
    for (const row of result.results || []) {
      if (!ALLOWED_ARTICLES.has(row.article)) continue;
      const stored = parseStoredGallery(row);
      if (stored && stored.photos.length) galleries[row.article] = stored;
    }
  }
  if (!includeDefaults) {
    for (const gallery of Object.values(galleries)) delete gallery.customized;
    return galleries;
  }
  for (const [article, gallery] of Object.entries(galleries)) {
    gallery.defaultPhotos = [...DEFAULT_GALLERIES[article]];
  }
  return galleries;
}

function articleSlug(article) {
  return article.replace(/^Арт\.\s*/i, '').toLocaleLowerCase('ru-RU').replace(/с/g, 's').replace(/[^a-z0-9-]/g, '') || 'model';
}

function mediaKeyFromUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/catalog-media/')) return null;
  try {
    const key = decodeURIComponent(value.slice('/catalog-media/'.length));
    if (!key.startsWith('catalog/') || key.includes('..') || key.startsWith('/')) return null;
    return key;
  } catch {
    return null;
  }
}

function validPhotoUrl(article, value) {
  if (DEFAULT_GALLERIES[article]?.includes(value)) return true;
  const key = mediaKeyFromUrl(value);
  return Boolean(key && key.startsWith(`catalog/${articleSlug(article)}/`));
}

async function storedGallery(env, article) {
  const row = await env.DB.prepare('SELECT article, photos_json, fit_mode, media_type FROM catalog_galleries WHERE article = ?').bind(article).first();
  return row ? parseStoredGallery(row) : null;
}

async function saveGallery(request, env, article) {
  if (!env.DB || !env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 65536) return json({error: 'Слишком большой запрос'}, 413);
  const body = await request.json();
  const photos = Array.isArray(body.photos) ? [...new Set(body.photos.map(value => String(value)))] : [];
  if (!photos.length) return json({error: 'В карточке должна остаться хотя бы одна фотография'}, 400);
  if (photos.length > 12) return json({error: 'Для одной модели можно добавить не больше 12 фотографий'}, 400);
  if (!photos.every(value => validPhotoUrl(article, value))) return json({error: 'В списке есть недопустимая фотография'}, 400);
  const fitMode = 'contain';
  const mediaType = body.mediaType === 'sketch' ? 'sketch' : 'photo';
  const requestedPositions = body.positions && typeof body.positions === 'object' ? body.positions : {};
  const requestedZooms = body.zooms && typeof body.zooms === 'object' ? body.zooms : {};
  const positions = {};
  const zooms = {};
  const storedPhotos = photos.map(url => {
    const requested = requestedPositions[url] || {};
    const rawX = Number(requested.x);
    const rawY = Number(requested.y);
    const x = Number.isFinite(rawX) ? Math.max(0, Math.min(100, rawX)) : 50;
    const y = Number.isFinite(rawY) ? Math.max(0, Math.min(100, rawY)) : 50;
    const rawZoom = Number(requestedZooms[url]);
    const zoom = Number.isFinite(rawZoom) ? Math.max(.4, Math.min(4, rawZoom)) : 1;
    positions[url] = {x, y};
    zooms[url] = zoom;
    return {url, x, y, zoom};
  });
  const previous = await storedGallery(env, article);
  const updatedBy = 'admin';
  await env.DB.prepare(`INSERT INTO catalog_galleries (article, photos_json, fit_mode, media_type, updated_at, updated_by)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(article) DO UPDATE SET photos_json = excluded.photos_json, fit_mode = excluded.fit_mode,
    media_type = excluded.media_type, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
    .bind(article, JSON.stringify(storedPhotos), fitMode, mediaType, updatedBy).run();

  const retained = new Set(photos.map(mediaKeyFromUrl).filter(Boolean));
  const removed = new Set([
    ...(previous?.photos || []).map(mediaKeyFromUrl).filter(Boolean),
    ...(Array.isArray(body.removedUrls) ? body.removedUrls.map(mediaKeyFromUrl).filter(Boolean) : [])
  ]);
  await Promise.allSettled([...removed].filter(key => !retained.has(key)).map(key => env.BUCKET.delete(key)));
  return json({ok: true, gallery: {photos, positions, zooms, fitMode, mediaType, customized: true}});
}

async function resetGallery(env, article) {
  if (!env.DB || !env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);
  const previous = await storedGallery(env, article);
  await env.DB.prepare('DELETE FROM catalog_galleries WHERE article = ?').bind(article).run();
  const keys = (previous?.photos || []).map(mediaKeyFromUrl).filter(Boolean);
  await Promise.allSettled(keys.map(key => env.BUCKET.delete(key)));
  return json({ok: true, gallery: defaultGallery(article)});
}

async function uploadPhoto(request, env, article) {
  if (!env.BUCKET) return json({error: 'Хранилище фотографий временно недоступно'}, 503);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(type)) return json({error: 'Поддерживаются фотографии JPG, PNG и WebP'}, 415);
  const statedLength = Number(request.headers.get('content-length') || 0);
  if (statedLength > MAX_UPLOAD_BYTES) return json({error: 'Файл слишком большой. Максимум 8 МБ.'}, 413);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_UPLOAD_BYTES) return json({error: 'Файл пустой или превышает 8 МБ'}, 413);
  const extension = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
  const key = `catalog/${articleSlug(article)}/${crypto.randomUUID()}.${extension}`;
  await env.BUCKET.put(key, bytes, {
    httpMetadata: {contentType: type, cacheControl: 'public, max-age=31536000, immutable'},
    customMetadata: {article}
  });
  return json({photo: {url: `/catalog-media/${encodeURI(key)}`}}, 201);
}

async function serveCatalogMedia(env, pathname) {
  if (!env.BUCKET) return new Response('Файл не найден', {status: 404});
  let key;
  try {
    key = decodeURIComponent(pathname.slice('/catalog-media/'.length));
  } catch {
    return new Response('Файл не найден', {status: 404});
  }
  if (!key.startsWith('catalog/') || key.includes('..') || key.startsWith('/')) return new Response('Файл не найден', {status: 404});
  const object = await env.BUCKET.get(key);
  if (!object) return new Response('Файл не найден', {status: 404});
  const headers = new Headers({'cache-control': 'public, max-age=31536000, immutable', ...securityHeaders});
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, {headers});
}

const haversine = (lat1, lon1, lat2, lon2) => {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

async function searchPlace(place) {
  let releaseQueue;
  const previousRequest = geocodeQueue;
  geocodeQueue = new Promise(resolve => { releaseQueue = resolve; });
  await previousRequest;
  try {
    const delay = Math.max(0, 1050 - (Date.now() - lastGeocodeAt));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastGeocodeAt = Date.now();
    const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
    searchUrl.searchParams.set('q', place + ', Россия');
    searchUrl.searchParams.set('format', 'jsonv2');
    searchUrl.searchParams.set('addressdetails', '1');
    searchUrl.searchParams.set('accept-language', 'ru');
    searchUrl.searchParams.set('countrycodes', 'ru');
    searchUrl.searchParams.set('limit', '5');
    const response = await fetch(searchUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'KuznechnyDvorikDeliveryCalculator/1.1 (https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev)',
        'referer': 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev/'
      }
    });
    if (!response.ok) throw new Error('Сервис поиска населённых пунктов временно недоступен');
    return response.json();
  } finally {
    releaseQueue();
  }
}

async function calculateUnknownDelivery(place, env) {
  const site = await loadSiteProfile(env);
  const runtimeRate = Math.max(0, Number(site.deliveryRate) || FALLBACK_RATE);
  const serviceAreaKm = Math.max(0, Number(site.serviceAreaKm) || 150);
  const cacheKey = `${place.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/gi, '')}:${runtimeRate}:${serviceAreaKm}`;
  const cached = deliveryCache.get(cacheKey);
  if (cached) return cached;
  const results = await searchPlace(place);
  const settlementTypes = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'locality', 'settlement']);
  const settlements = results.filter(result => result.category === 'place' || settlementTypes.has(result.addresstype));
  const candidates = settlements.length ? settlements : results;
  if (!candidates.length) throw Object.assign(new Error('Населённый пункт не найден. Уточните название или добавьте район.'), {status: 404});
  const selected = candidates
    .map(candidate => ({...candidate, proximity: haversine(ORIGIN.lat, ORIGIN.lon, Number(candidate.lat), Number(candidate.lon))}))
    .sort((a, b) => a.proximity - b.proximity)[0];
  const routeUrl = new URL(`https://router.project-osrm.org/route/v1/driving/${ORIGIN.lon},${ORIGIN.lat};${selected.lon},${selected.lat}`);
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('alternatives', 'false');
  routeUrl.searchParams.set('steps', 'false');
  const routeResponse = await fetch(routeUrl, {
    headers: {'accept': 'application/json', 'user-agent': 'KuznechnyDvorikDeliveryCalculator/1.1 (https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev)'}
  });
  if (!routeResponse.ok) throw new Error('Сервис маршрутов временно недоступен');
  const routeData = await routeResponse.json();
  const distanceMeters = routeData.routes?.[0]?.distance;
  if (!Number.isFinite(distanceMeters)) throw new Error('Не удалось построить автомобильный маршрут до этого пункта');
  const distanceKm = Math.ceil(distanceMeters / 1000);
  const address = selected.address || {};
  const shortNameParts = [selected.name || address.city || address.town || address.village || address.hamlet, address.county || address.municipality || address.city_district || address.district, address.state].filter(Boolean);
  const result = {
    requestedName: place,
    resolvedName: selected.display_name,
    shortName: [...new Set(shortNameParts)].join(', ') || selected.display_name,
    price: distanceKm > serviceAreaKm ? null : distanceKm * runtimeRate,
    distanceKm,
    rate: runtimeRate,
    serviceAreaKm,
    outOfArea: distanceKm > serviceAreaKm,
    attribution: '© OpenStreetMap contributors'
  };
  if (deliveryCache.size >= 200) deliveryCache.clear();
  deliveryCache.set(cacheKey, result);
  return result;
}

async function handleAdminApi(request, env, url) {
  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!await hasAdminSession(request, env)) return json({error: 'Требуется вход'}, 401);
  if (url.pathname === '/api/admin/catalog' && request.method === 'GET') {
    try {
      return json({galleries: await allGalleries(env, true)});
    } catch (error) {
      return json({error: 'Не удалось загрузить карточки: ' + errorMessage(error)}, 503);
    }
  }
  if (url.pathname === '/api/admin/upload' && request.method === 'POST') {
    const article = (url.searchParams.get('article') || '').trim();
    if (!ALLOWED_ARTICLES.has(article)) return json({error: 'Модель не найдена'}, 404);
    try {
      return await uploadPhoto(request, env, article);
    } catch (error) {
      return json({error: 'Не удалось загрузить фотографию: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname.startsWith('/api/admin/catalog/')) {
    let article;
    try {
      article = decodeURIComponent(url.pathname.slice('/api/admin/catalog/'.length));
    } catch {
      return json({error: 'Модель не найдена'}, 404);
    }
    if (!ALLOWED_ARTICLES.has(article)) return json({error: 'Модель не найдена'}, 404);
    try {
      if (request.method === 'POST') return await saveGallery(request, env, article);
      if (request.method === 'DELETE') return await resetGallery(env, article);
    } catch (error) {
      return json({error: 'Не удалось сохранить карточку: ' + errorMessage(error)}, 500);
    }
  }
  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ok: true}, 200, 'no-store', {'set-cookie': `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`});
  }
  return json({error: 'Метод не найден'}, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/admin/login' && request.method === 'POST') return handleLogin(request, env, url);
    if (url.pathname.startsWith('/api/admin/')) return handleAdminApi(request, env, url);
    if (url.pathname === '/admin' || url.pathname === '/admin/') return html(ADMIN_PAGE, 200, true);
    if (url.pathname.startsWith('/catalog-media/')) return serveCatalogMedia(env, url.pathname);
    if (url.pathname === '/api/catalog-images' && request.method === 'GET') {
      try {
        return json({galleries: await allGalleries(env)}, 200, 'no-store');
      } catch {
        return json({galleries: Object.fromEntries([...ALLOWED_ARTICLES].map(article => [article, defaultGallery(article)]))}, 200, 'no-store');
      }
    }
    if (url.pathname === '/api/delivery') {
      if (request.method !== 'GET') return json({error: 'Метод не поддерживается'}, 405);
      const place = (url.searchParams.get('place') || '').trim().replace(/\s+/g, ' ');
      if (place.length < 2 || place.length > 100) return json({error: 'Укажите название населённого пункта'}, 400);
      try {
        return json(await calculateUnknownDelivery(place, env), 200, 'public, max-age=86400');
      } catch (error) {
        return json({error: errorMessage(error) || 'Не удалось рассчитать доставку'}, error.status || 502);
      }
    }
    if (url.pathname === '/favicon.ico') return new Response(null, {status: 204});
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Страница не найдена', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    return html(PAGE);
  }
};
