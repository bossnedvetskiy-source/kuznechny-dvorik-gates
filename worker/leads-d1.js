const LEAD_STATUSES = new Set(['new', 'contacted', 'done', 'archived']);
const LEAD_CATEGORIES = new Set(['gates', 'canopy', 'forged-fence', 'profsheet-fence', 'picket-fence']);

async function notifyNewLead(env, lead) {
  const endpoint = String(env.LEAD_NOTIFY_WEBHOOK_URL || '').trim();
  if (!endpoint) return;
  const headers = {'content-type':'application/json'};
  const token = String(env.LEAD_NOTIFY_WEBHOOK_TOKEN || '').trim();
  if (token) headers.authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify({event:'new_lead', lead}), signal:controller.signal});
    if (!response.ok) console.warn('Lead notification webhook returned', response.status);
  } catch (error) {
    console.warn('Lead notification webhook failed', String(error?.message || error));
  } finally {
    clearTimeout(timer);
  }
}

async function ensureLeadSchema(env) {
  if (!env.DB) throw new Error('База данных временно недоступна');
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'new',
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'gates',
    source TEXT NOT NULL DEFAULT '',
    article TEXT NOT NULL DEFAULT '',
    product_title TEXT NOT NULL DEFAULT '',
    configuration_json TEXT NOT NULL DEFAULT '{}',
    width REAL,
    wicket_width REAL,
    wicket_height REAL,
    height REAL,
    install INTEGER NOT NULL DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL DEFAULT 0,
    client_total INTEGER NOT NULL DEFAULT 0,
    quote_verified INTEGER NOT NULL DEFAULT 0,
    delivery_pending INTEGER NOT NULL DEFAULT 0,
    delivery_out_of_area INTEGER NOT NULL DEFAULT 0,
    delivery_distance_km REAL,
    consent INTEGER NOT NULL DEFAULT 0,
    consent_at TEXT NOT NULL DEFAULT '',
    policy_version TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL
  )`).run();
  const migrations = [
    'ALTER TABLE site_leads ADD COLUMN wicket_height REAL',
    "ALTER TABLE site_leads ADD COLUMN category TEXT NOT NULL DEFAULT 'gates'",
    "ALTER TABLE site_leads ADD COLUMN source TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE site_leads ADD COLUMN configuration_json TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE site_leads ADD COLUMN client_total INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE site_leads ADD COLUMN quote_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE site_leads ADD COLUMN delivery_out_of_area INTEGER NOT NULL DEFAULT 0",
    'ALTER TABLE site_leads ADD COLUMN delivery_distance_km REAL',
    "ALTER TABLE site_leads ADD COLUMN consent INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE site_leads ADD COLUMN consent_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE site_leads ADD COLUMN policy_version TEXT NOT NULL DEFAULT ''"
  ];
  for (const statement of migrations) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      if (!/duplicate column/i.test(String(error?.message || error))) throw error;
    }
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_created_idx ON site_leads(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_status_idx ON site_leads(status)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_category_idx ON site_leads(category)').run();
}

const leadText = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const leadNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function parseLeadConfiguration(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeLeadRow(row) {
  return {
    ...row,
    configuration: parseLeadConfiguration(row.configuration_json),
    configuration_json: undefined,
    install: Boolean(row.install),
    posts: Boolean(row.posts),
    quote_verified: Boolean(row.quote_verified),
    delivery_pending: Boolean(row.delivery_pending),
    delivery_out_of_area: Boolean(row.delivery_out_of_area),
    consent: Boolean(row.consent),
    quote_mismatch: Boolean(row.quote_verified) && Number(row.client_total) !== Number(row.total)
  };
}

async function createLead(request, env, url) {
  if (!sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!env.DB) return json({error: 'База заявок временно недоступна'}, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32768) return json({error: 'Слишком большой запрос'}, 413);

  let body;
  try { body = await request.json(); } catch { return json({error: 'Некорректная заявка'}, 400); }
  if (honeypotTriggered(body)) return json({ok:true, id:null}, 201);
  const rate = await consumeLeadAttempt(request, env);
  if (!rate.allowed) {
    return json({error:'Слишком много заявок за короткое время. Попробуйте немного позже.'}, 429, 'no-store', {'retry-after':String(rate.retryAfterSeconds)});
  }

  const name = leadText(body.name, 100);
  const phone = leadText(body.phone, 40);
  const phoneDigits = phone.replace(/\D/g, '');
  const city = leadText(body.city, 150);
  const requestedCategory = leadText(body.category, 40) || 'gates';
  const category = LEAD_CATEGORIES.has(requestedCategory) ? requestedCategory : 'gates';
  const source = leadText(body.source, 100);
  const article = leadText(body.article, 50);
  const productTitle = leadText(body.productTitle, 120);
  const color = leadText(body.color, 100);
  const comment = leadText(body.comment, 1000);
  const clientMessage = leadText(body.message, 8000);
  const consent = body.consent === true;
  const policyVersion = leadText(body.policyVersion, 64);
  const width = leadNumber(body.width);
  const wicketWidth = leadNumber(body.wicketWidth);
  const wicketHeight = leadNumber(body.wicketHeight);
  const height = leadNumber(body.height);
  const clientTotal = Math.round(Math.max(0, Math.min(10000000, Number(body.total) || 0)));

  if (phoneDigits.length < 10 || phoneDigits.length > 11) return json({error: 'Укажите корректный номер телефона'}, 400);
  if (!consent) return json({error: 'Подтвердите согласие на обработку персональных данных'}, 400);
  if (!city || !clientMessage) return json({error: 'В заявке не хватает обязательных данных'}, 400);
  for (const value of [width, wicketWidth, wicketHeight, height]) {
    if (value !== null && (value <= 0 || value > 100)) return json({error: 'Некорректные размеры в заявке'}, 400);
  }

  let quote = null;
  if (category === 'gates') {
    try {
      quote = await calculateAuthoritativeGateQuote({...body, article, city, width, wicketWidth, wicketHeight, height}, env);
    } catch (error) {
      return json({error:errorMessage(error)}, Number(error?.status) || 400);
    }
  }

  const storedArticle = quote?.article || article;
  const storedProductTitle = category === 'gates' ? 'Ворота с калиткой' : productTitle;
  const storedInstall = category === 'gates' ? 1 : (body.install ? 1 : 0);
  const storedPosts = body.posts ? 1 : 0;
  const total = quote?.total ?? clientTotal;
  const deliveryPending = quote ? quote.deliveryPending : Boolean(body.deliveryPending);
  const deliveryOutOfArea = Boolean(quote?.delivery?.outOfArea);
  const deliveryDistanceKm = quote?.delivery?.distanceKm ?? null;
  const quoteVerified = Boolean(quote?.quoteVerified);
  const message = quote
    ? buildAuthoritativeGateMessage({
        name, phone, city, article:storedArticle,
        dimensions:quote.dimensions, posts:Boolean(storedPosts), quote, comment
      })
    : clientMessage;

  const defaultConfiguration = {
    article:storedArticle,
    width,
    height,
    wicketWidth,
    wicketHeight,
    install:Boolean(storedInstall),
    posts:Boolean(storedPosts),
    color
  };
  const configuration = body.configuration && typeof body.configuration === 'object' && !Array.isArray(body.configuration)
    ? {...body.configuration, ...defaultConfiguration}
    : defaultConfiguration;
  let configurationJson = '{}';
  try { configurationJson = JSON.stringify(configuration); } catch { configurationJson = JSON.stringify(defaultConfiguration); }
  if (configurationJson.length > 8000) return json({error: 'Слишком много параметров в заявке'}, 413);

  await ensureLeadSchema(env);
  const result = await env.DB.prepare(`INSERT INTO site_leads (
    status, name, phone, city, category, source, article, product_title, configuration_json,
    width, wicket_width, wicket_height, height, install, posts, color, total, client_total, quote_verified,
    delivery_pending, delivery_out_of_area, delivery_distance_km, consent, consent_at, policy_version, comment, message
  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`)
    .bind(
      name, phone, city, category, source, storedArticle, storedProductTitle, configurationJson,
      width, wicketWidth, wicketHeight, height,
      storedInstall, storedPosts, color, total, clientTotal, quoteVerified ? 1 : 0,
      deliveryPending ? 1 : 0, deliveryOutOfArea ? 1 : 0, deliveryDistanceKm,
      consent ? 1 : 0, policyVersion, comment, message
    ).run();

  const leadId = result.meta?.last_row_id || null;
  await notifyNewLead(env, {id:leadId, category, name, phone, city, article:storedArticle, productTitle:storedProductTitle, total, source, message});
  return json({
    ok:true,
    id:leadId,
    quote: quote ? {
      total,
      verified:true,
      deliveryPending,
      deliveryOutOfArea,
      deliveryDistanceKm
    } : null
  }, 201);
}

async function listLeads(env, searchParams = null) {
  await ensureLeadSchema(env);

  const requestedLimit = Number(searchParams?.get?.('limit'));
  const limit = Math.max(1, Math.min(200, Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 50));
  const requestedBeforeId = Number(searchParams?.get?.('before_id'));
  const beforeId = Number.isInteger(requestedBeforeId) && requestedBeforeId > 0 ? requestedBeforeId : null;
  const requestedStatus = String(searchParams?.get?.('status') || '').trim();
  const status = LEAD_STATUSES.has(requestedStatus) ? requestedStatus : null;

  const where = [];
  const bindings = [];
  if (beforeId) {
    where.push('id < ?');
    bindings.push(beforeId);
  }
  if (status) {
    where.push('status = ?');
    bindings.push(status);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const pageLimit = limit + 1;
  bindings.push(pageLimit);

  const [result, countResult] = await Promise.all([
    env.DB.prepare(`SELECT id, created_at, updated_at, status, name, phone, city, category, source, article,
      product_title, configuration_json, width, wicket_width, wicket_height, height, install, posts, color, total,
      client_total, quote_verified, delivery_pending, delivery_out_of_area, delivery_distance_km,
      consent, consent_at, policy_version, comment, message
      FROM site_leads${whereSql} ORDER BY id DESC LIMIT ?`).bind(...bindings).all(),
    env.DB.prepare('SELECT status, COUNT(*) AS count FROM site_leads GROUP BY status').all()
  ]);

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const leads = pageRows.map(normalizeLeadRow);
  const counts = {new:0, contacted:0, done:0, archived:0};
  for (const row of countResult.results || []) if (row.status in counts) counts[row.status] = Number(row.count) || 0;
  const totalCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const filteredTotal = status ? counts[status] : totalCount;
  const nextBeforeId = hasMore && leads.length ? Number(leads[leads.length - 1].id) : null;

  return {
    leads,
    counts,
    totalCount,
    filteredTotal,
    limited:false,
    page:{
      limit,
      beforeId,
      nextBeforeId,
      hasMore,
      status:status || 'all'
    }
  };
}

async function updateLeadStatus(request, env, id) {
  await ensureLeadSchema(env);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return json({error: 'Заявка не найдена'}, 404);
  let body;
  try { body = await request.json(); } catch { return json({error: 'Некорректный запрос'}, 400); }
  const status = String(body.status || '');
  if (!LEAD_STATUSES.has(status)) return json({error: 'Некорректный статус заявки'}, 400);
  const result = await env.DB.prepare('UPDATE site_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, numericId).run();
  if (!result.meta?.changes) return json({error: 'Заявка не найдена'}, 404);
  return json({ok: true, id: numericId, status});
}
