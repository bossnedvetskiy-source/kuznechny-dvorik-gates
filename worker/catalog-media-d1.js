let catalogMediaReady = false;
const D1_MEDIA_MAX_BYTES = 1500000;

async function ensureCatalogMediaTable(env) {
  if (!env.DB) return false;
  if (!catalogMediaReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS catalog_media (
      key TEXT PRIMARY KEY NOT NULL,
      article TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`).run();
    catalogMediaReady = true;
  }
  return true;
}

function catalogMediaKeyFromPath(pathname) {
  if (!pathname.startsWith('/catalog-media/')) return null;
  try {
    const key = decodeURIComponent(pathname.slice('/catalog-media/'.length));
    if (!key.startsWith('catalog/') || key.includes('..') || key.startsWith('/')) return null;
    return key;
  } catch {
    return null;
  }
}

async function storeCatalogMedia(request, env, article) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(type)) {
    return json({error: 'Поддерживаются фотографии JPG, PNG и WebP'}, 415);
  }

  const statedLength = Number(request.headers.get('content-length') || 0);
  const maxBytes = env.BUCKET ? MAX_UPLOAD_BYTES : D1_MEDIA_MAX_BYTES;
  if (statedLength > maxBytes) {
    return json({error: env.BUCKET ? 'Файл слишком большой. Максимум 8 МБ.' : 'Фото слишком большое. Попробуйте выбрать другое изображение.'}, 413);
  }

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > maxBytes) {
    return json({error: env.BUCKET ? 'Файл пустой или превышает 8 МБ' : 'Фото не удалось подготовить для хранения'}, 413);
  }

  const extension = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
  const key = `catalog/${articleSlug(article)}/${crypto.randomUUID()}.${extension}`;

  if (env.BUCKET) {
    await env.BUCKET.put(key, bytes, {
      httpMetadata: {contentType: type, cacheControl: 'public, max-age=31536000, immutable'},
      customMetadata: {article}
    });
  } else {
    if (!await ensureCatalogMediaTable(env)) return json({error: 'Хранилище фотографий временно недоступно'}, 503);
    await env.DB.prepare(`INSERT INTO catalog_media (key, article, content_type, bytes, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(key, article, type, bytes, bytes.byteLength).run();
  }

  return json({photo: {url: `/catalog-media/${encodeURI(key)}`}}, 201);
}

async function readCatalogMedia(env, pathname) {
  const key = catalogMediaKeyFromPath(pathname);
  if (!key) return new Response('Файл не найден', {status: 404});

  if (env.BUCKET) {
    const object = await env.BUCKET.get(key);
    if (object) {
      const headers = new Headers({'cache-control': 'public, max-age=31536000, immutable', ...securityHeaders});
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      return new Response(object.body, {headers});
    }
  }

  if (!await ensureCatalogMediaTable(env)) return new Response('Файл не найден', {status: 404});
  const row = await env.DB.prepare('SELECT content_type, bytes FROM catalog_media WHERE key = ?').bind(key).first();
  if (!row?.bytes) return new Response('Файл не найден', {status: 404});

  const body = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
  return new Response(body, {
    headers: {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      ...securityHeaders
    }
  });
}

async function deleteCatalogMediaObject(env, key) {
  if (!key) return;
  const jobs = [];
  if (env.BUCKET) jobs.push(env.BUCKET.delete(key));
  if (env.DB) {
    await ensureCatalogMediaTable(env);
    jobs.push(env.DB.prepare('DELETE FROM catalog_media WHERE key = ?').bind(key).run());
  }
  if (jobs.length) await Promise.allSettled(jobs);
}
