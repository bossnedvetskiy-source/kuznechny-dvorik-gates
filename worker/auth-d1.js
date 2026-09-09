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

async function loadAdminAuth(env) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(
      'SELECT username, password_salt, password_hash, session_secret FROM admin_auth WHERE id = 1'
    ).first();
  } catch {
    return null;
  }
}

async function pbkdf2Hex(password, salt, iterations = 210000) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(String(salt || '')),
    iterations
  }, keyMaterial, 256);
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function parsePbkdf2Hash(value) {
  const match = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{64})$/i.exec(String(value || ''));
  if (!match) return null;
  const iterations = Number(match[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return null;
  return {iterations, hash: match[2].toLowerCase()};
}

async function verifyAdminPassword(password, auth) {
  const stored = String(auth?.password_hash || '');
  const modern = parsePbkdf2Hash(stored);
  if (modern) {
    const derived = await pbkdf2Hex(password, auth.password_salt, modern.iterations);
    return {valid: constantTimeEqual(derived, modern.hash), needsUpgrade: false};
  }
  const legacy = await digestHex(`${auth.password_salt}:${String(password || '')}`);
  return {valid: constantTimeEqual(legacy, stored), needsUpgrade: true};
}

async function upgradeAdminPasswordHash(env, password, auth) {
  const iterations = 210000;
  const derived = await pbkdf2Hex(password, auth.password_salt, iterations);
  const encoded = `pbkdf2-sha256$${iterations}$${derived}`;
  await env.DB.prepare('UPDATE admin_auth SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1')
    .bind(encoded).run();
}

async function createSessionCookie(env, authOverride = null) {
  const auth = authOverride || await loadAdminAuth(env);
  if (!auth?.session_secret) throw new Error('Вход в редактор ещё не настроен');
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  const signature = await hmacHex(auth.session_secret, expires);
  return `${SESSION_COOKIE}=${expires}.${signature}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

async function hasAdminSession(request, env) {
  const auth = await loadAdminAuth(env);
  if (!auth?.session_secret) return false;
  const session = parseCookies(request)[SESSION_COOKIE] || '';
  const [expires, signature, extra] = session.split('.');
  if (!expires || !signature || extra || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;
  const expected = await hmacHex(auth.session_secret, expires);
  return constantTimeEqual(signature, expected);
}

async function handleLogin(request, env, url) {
  if (!sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!env.DB) return json({error: 'Вход в редактор ещё не настроен'}, 503);
  if (!canAttemptLogin(request)) return json({error: 'Слишком много попыток. Попробуйте через 15 минут.'}, 429);

  try {
    const auth = await loadAdminAuth(env);
    if (!auth?.username || !auth?.password_salt || !auth?.password_hash || !auth?.session_secret) {
      return json({error: 'Вход в редактор ещё не настроен'}, 503);
    }

    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return json({error: 'Слишком большой запрос'}, 413);
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const validUsername = constantTimeEqual(username, String(auth.username));
    const passwordCheck = await verifyAdminPassword(password, auth);

    if (!validUsername || !passwordCheck.valid) {
      registerFailedLogin(request);
      return json({error: 'Неверный логин или пароль'}, 401);
    }

    if (passwordCheck.needsUpgrade) {
      try { await upgradeAdminPasswordHash(env, password, auth); } catch (error) {
        console.warn('Admin password hash upgrade failed', String(error?.message || error));
      }
    }

    loginAttempts.delete(clientKey(request));
    return json({ok: true}, 200, 'no-store', {'set-cookie': await createSessionCookie(env, auth)});
  } catch {
    return json({error: 'Не удалось выполнить вход'}, 400);
  }
}
