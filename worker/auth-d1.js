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
    const passwordHash = await digestHex(`${auth.password_salt}:${String(body.password || '')}`);
    const validUsername = constantTimeEqual(username, String(auth.username));
    const validPassword = constantTimeEqual(passwordHash, String(auth.password_hash));

    if (!validUsername || !validPassword) {
      registerFailedLogin(request);
      return json({error: 'Неверный логин или пароль'}, 401);
    }

    loginAttempts.delete(clientKey(request));
    return json({ok: true}, 200, 'no-store', {'set-cookie': await createSessionCookie(env, auth)});
  } catch {
    return json({error: 'Не удалось выполнить вход'}, 400);
  }
}
