let siteSettingsReady = false;

async function ensureSiteSettings(env) {
  if (!env.DB) return false;
  if (!siteSettingsReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_by TEXT DEFAULT '' NOT NULL
    )`).run();
    siteSettingsReady = true;
  }
  return true;
}

function positiveMoney(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 && number <= 10000000 ? number : fallback;
}

function positiveOrder(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 10000 ? number : fallback;
}

function normalizePrices(input) {
  const source = input && typeof input === 'object' ? input : {};
  const defaultCatalog = Array.isArray(DEFAULT_PRICES.catalog) ? DEFAULT_PRICES.catalog : [];
  const inputCatalog = new Map((Array.isArray(source.catalog) ? source.catalog : []).map(item => [String(item?.art || ''), item]));
  const defaultExtras = Array.isArray(DEFAULT_PRICES.extraProducts) ? DEFAULT_PRICES.extraProducts : [];
  const inputExtras = new Map((Array.isArray(source.extraProducts) ? source.extraProducts : []).map(item => [String(item?.id || ''), item]));

  const catalog = defaultCatalog.map((defaultItem, index) => {
    const item = inputCatalog.get(defaultItem.art) || {};
    return {
      art: defaultItem.art,
      price: positiveMoney(item.price, defaultItem.price),
      visible: item.visible !== false,
      order: positiveOrder(item.order, index + 1)
    };
  }).sort((left, right) => left.order - right.order || left.art.localeCompare(right.art, 'ru'));

  catalog.forEach((item, index) => { item.order = index + 1; });
  if (catalog.length && !catalog.some(item => item.visible)) catalog[0].visible = true;

  return {
    updatedAt: new Date().toISOString().slice(0, 10),
    catalogInstallation: positiveMoney(source.catalogInstallation, DEFAULT_PRICES.catalogInstallation),
    catalogPosts: positiveMoney(source.catalogPosts, DEFAULT_PRICES.catalogPosts),
    catalog,
    extraProducts: defaultExtras.map(defaultItem => {
      const item = inputExtras.get(defaultItem.id) || {};
      return {
        ...defaultItem,
        price: positiveMoney(item.price, defaultItem.price),
        install: positiveMoney(item.install, defaultItem.install || 0),
        posts: positiveMoney(item.posts, defaultItem.posts || 0)
      };
    })
  };
}

async function loadPrices(env) {
  if (!await ensureSiteSettings(env)) return normalizePrices(DEFAULT_PRICES);
  try {
    const row = await env.DB.prepare("SELECT value_json FROM site_settings WHERE key = 'prices'").first();
    if (!row?.value_json) return normalizePrices(DEFAULT_PRICES);
    return normalizePrices(JSON.parse(row.value_json));
  } catch {
    return normalizePrices(DEFAULT_PRICES);
  }
}

async function savePrices(request, env) {
  if (!await ensureSiteSettings(env)) return json({error: 'База данных временно недоступна'}, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 131072) return json({error: 'Слишком большой запрос'}, 413);
  const body = await request.json();
  const prices = normalizePrices(body?.prices);
  await env.DB.prepare(`INSERT INTO site_settings (key, value_json, updated_at, updated_by)
    VALUES ('prices', ?, CURRENT_TIMESTAMP, 'admin')
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(prices)).run();
  return json({ok: true, prices});
}

async function renderPublicPage(env) {
  const prices = await loadPrices(env);
  const serialized = JSON.stringify(prices).replace(/</g, '\\u003c');
  return PAGE.replace('__RUNTIME_PRICE_DATA__', serialized);
}
