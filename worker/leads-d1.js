const LEAD_STATUSES = new Set(['new', 'contacted', 'done', 'archived']);

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
    article TEXT NOT NULL,
    product_title TEXT NOT NULL DEFAULT '',
    width REAL,
    wicket_width REAL,
    height REAL,
    install INTEGER NOT NULL DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL DEFAULT 0,
    delivery_pending INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_created_idx ON site_leads(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_leads_status_idx ON site_leads(status)').run();
}

const leadText = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const leadNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

async function createLead(request, env, url) {
  if (!sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!env.DB) return json({error: 'База заявок временно недоступна'}, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32768) return json({error: 'Слишком большой запрос'}, 413);

  let body;
  try { body = await request.json(); } catch { return json({error: 'Некорректная заявка'}, 400); }

  const name = leadText(body.name, 100);
  const phone = leadText(body.phone, 40);
  const phoneDigits = phone.replace(/\D/g, '');
  const city = leadText(body.city, 150);
  const article = leadText(body.article, 50);
  const productTitle = leadText(body.productTitle, 120);
  const color = leadText(body.color, 100);
  const comment = leadText(body.comment, 1000);
  const message = leadText(body.message, 8000);
  const width = leadNumber(body.width);
  const wicketWidth = leadNumber(body.wicketWidth);
  const height = leadNumber(body.height);
  const total = Math.round(Math.max(0, Math.min(10000000, Number(body.total) || 0)));

  if (phoneDigits.length < 10 || phoneDigits.length > 11) return json({error: 'Укажите корректный номер телефона'}, 400);
  if (!city || !article || !message) return json({error: 'В заявке не хватает обязательных данных'}, 400);
  for (const value of [width, wicketWidth, height]) {
    if (value !== null && (value <= 0 || value > 100)) return json({error: 'Некорректные размеры в заявке'}, 400);
  }

  await ensureLeadSchema(env);
  const result = await env.DB.prepare(`INSERT INTO site_leads (
    status, name, phone, city, article, product_title, width, wicket_width, height,
    install, posts, color, total, delivery_pending, comment, message
  ) VALUES ('new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      name, phone, city, article, productTitle, width, wicketWidth, height,
      body.install ? 1 : 0, body.posts ? 1 : 0, color, total,
      body.deliveryPending ? 1 : 0, comment, message
    ).run();

  return json({ok: true, id: result.meta?.last_row_id || null}, 201);
}

async function listLeads(env) {
  await ensureLeadSchema(env);
  const result = await env.DB.prepare(`SELECT id, created_at, updated_at, status, name, phone, city, article,
    product_title, width, wicket_width, height, install, posts, color, total,
    delivery_pending, comment, message
    FROM site_leads ORDER BY id DESC LIMIT 200`).all();
  const leads = (result.results || []).map(row => ({
    ...row,
    install: Boolean(row.install),
    posts: Boolean(row.posts),
    delivery_pending: Boolean(row.delivery_pending)
  }));
  const counts = {new: 0, contacted: 0, done: 0, archived: 0};
  for (const lead of leads) if (lead.status in counts) counts[lead.status] += 1;
  return {leads, counts};
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
