const leadRateAttempts = new Map();
const LEAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const LEAD_RATE_MAX = 8;

function leadClientKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (ip) return `ip:${ip}`;
  const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 120);
  return `ua:${userAgent}`;
}

function consumeLeadAttempt(request) {
  const key = leadClientKey(request);
  const now = Date.now();
  const cutoff = now - LEAD_RATE_WINDOW_MS;
  const recent = (leadRateAttempts.get(key) || []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= LEAD_RATE_MAX) {
    const retryAfterMs = Math.max(1000, LEAD_RATE_WINDOW_MS - (now - recent[0]));
    return {allowed:false, retryAfterSeconds:Math.ceil(retryAfterMs / 1000)};
  }
  recent.push(now);
  leadRateAttempts.set(key, recent);
  if (leadRateAttempts.size > 1000) {
    for (const [candidateKey, timestamps] of leadRateAttempts) {
      const active = timestamps.filter(timestamp => timestamp > cutoff);
      if (active.length) leadRateAttempts.set(candidateKey, active);
      else leadRateAttempts.delete(candidateKey);
      if (leadRateAttempts.size <= 700) break;
    }
  }
  return {allowed:true, retryAfterSeconds:0};
}

function honeypotTriggered(body) {
  return Boolean(String(body?.website || body?.company_site || '').trim());
}
