let leadRateSchemaReady = false;
const LEAD_RATE_WINDOW_SECONDS = 10 * 60;
const LEAD_RATE_MAX = 8;
let leadRateCleanupTick = 0;

async function ensureLeadRateSchema(env) {
  if (!env.DB) return false;
  if (!leadRateSchemaReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_rate_limits (
      rate_key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    )`).run();
    leadRateSchemaReady = true;
  }
  return true;
}

async function leadClientKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const fallback = (request.headers.get('user-agent') || 'unknown').slice(0, 160);
  return digestHex(ip ? `ip:${ip}` : `ua:${fallback}`);
}

async function consumeLeadAttempt(request, env) {
  if (!await ensureLeadRateSchema(env)) return {allowed:true, retryAfterSeconds:0};
  const now = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(now / LEAD_RATE_WINDOW_SECONDS) * LEAD_RATE_WINDOW_SECONDS;
  const expiresAt = bucketStart + LEAD_RATE_WINDOW_SECONDS;
  const client = await leadClientKey(request);
  const rateKey = `${client}:${bucketStart}`;
  await env.DB.prepare(`INSERT INTO lead_rate_limits (rate_key, count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at`)
    .bind(rateKey, expiresAt).run();
  const row = await env.DB.prepare('SELECT count FROM lead_rate_limits WHERE rate_key = ?').bind(rateKey).first();
  const count = Number(row?.count) || 1;
  leadRateCleanupTick += 1;
  if (leadRateCleanupTick % 64 === 0) {
    try { await env.DB.prepare('DELETE FROM lead_rate_limits WHERE expires_at < ?').bind(now - LEAD_RATE_WINDOW_SECONDS).run(); } catch {}
  }
  return {
    allowed: count <= LEAD_RATE_MAX,
    retryAfterSeconds: count <= LEAD_RATE_MAX ? 0 : Math.max(1, expiresAt - now)
  };
}

function honeypotTriggered(body) {
  return Boolean(String(body?.website || body?.company_site || '').trim());
}
