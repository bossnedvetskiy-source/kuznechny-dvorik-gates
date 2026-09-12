const GATE_EXCEL_SETTINGS_KEY = 'gate_excel_prices';

function normalizeGateCalcPriceInputs(input, strict = false) {
  const source = input && typeof input === 'object' ? input : {};
  const result = {};
  for (const [ref, fallback] of Object.entries(DEFAULT_GATE_CALC_PRICES || {})) {
    const raw = source[ref];
    if (strict && raw === undefined) throw new Error(`В Excel отсутствует обязательное значение ${ref}`);
    const value = Number(raw && typeof raw === 'object' ? raw.value : raw ?? fallback?.value);
    if (!Number.isFinite(value) || value < 0 || value > 10000000) {
      throw new Error(`Некорректное значение ${ref}`);
    }
    result[ref] = {value, label: String(fallback?.label || ref).slice(0, 160)};
  }
  return result;
}

function normalizeGateExcelMeta(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    fileName: String(source.fileName || '').replace(/[\r\n]/g, ' ').trim().slice(0, 220),
    fileSize: Math.max(0, Math.min(20 * 1024 * 1024, Math.round(Number(source.fileSize) || 0))),
    sha256: String(source.sha256 || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64),
    importedAt: new Date().toISOString(),
    source: 'xlsx-admin'
  };
}

function gateExcelStandardPrices(priceInputs) {
  const prices = {};
  for (const [article, model] of Object.entries(DEFAULT_GATE_CALC_MODELS?.models || {})) {
    const standard = model?.standard || {};
    const dims = {
      article,
      gateWidth: Number(standard.gate_width_m) || 3.4,
      gateHeight: Number(standard.gate_height_m) || 1.8,
      wicketWidth: Number(standard.wicket_width_m) || 1,
      wicketHeight: Number(standard.wicket_height_m) || 1.8
    };
    const total = calculateGateProductServer(dims, priceInputs);
    if (!Number.isFinite(total) || total < 0) throw new Error(`Не удалось проверить расчёт ${article}`);
    prices[article] = total;
  }
  return prices;
}

async function loadGateCalcInputs(env) {
  const fallback = normalizeGateCalcPriceInputs(DEFAULT_GATE_CALC_PRICES);
  if (!await ensureSiteSettings(env)) return fallback;
  try {
    const row = await env.DB.prepare('SELECT value_json FROM site_settings WHERE key = ?').bind(GATE_EXCEL_SETTINGS_KEY).first();
    if (!row?.value_json) return fallback;
    const saved = JSON.parse(row.value_json);
    return normalizeGateCalcPriceInputs(saved?.prices || saved);
  } catch {
    return fallback;
  }
}

async function loadGateExcelState(env) {
  const prices = await loadGateCalcInputs(env);
  let meta = null;
  if (await ensureSiteSettings(env)) {
    try {
      const row = await env.DB.prepare('SELECT value_json, updated_at FROM site_settings WHERE key = ?').bind(GATE_EXCEL_SETTINGS_KEY).first();
      if (row?.value_json) {
        const saved = JSON.parse(row.value_json);
        meta = saved?.meta && typeof saved.meta === 'object' ? {...saved.meta, storedAt: row.updated_at || ''} : null;
      }
    } catch {}
  }
  return {prices, meta, standardPrices: gateExcelStandardPrices(prices)};
}

async function saveGateExcelState(request, env) {
  if (!await ensureSiteSettings(env)) return json({error: 'База данных временно недоступна'}, 503);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 262144) return json({error: 'Слишком большой запрос'}, 413);
  const body = await request.json();
  const prices = normalizeGateCalcPriceInputs(body?.prices, true);
  const standardPrices = gateExcelStandardPrices(prices);
  const clientStandards = body?.standardPrices && typeof body.standardPrices === 'object' ? body.standardPrices : {};
  for (const [article, value] of Object.entries(clientStandards)) {
    if (!(article in standardPrices)) continue;
    if (Math.round(Number(value)) !== Math.round(Number(standardPrices[article]))) {
      return json({error: `Проверка Excel не пройдена для Арт.${article}. Обновление отменено.`}, 400);
    }
  }
  const meta = normalizeGateExcelMeta(body?.meta);
  const saved = {version: 1, prices, meta, standardPrices};
  await env.DB.prepare(`INSERT INTO site_settings (key, value_json, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, 'admin-excel')
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
    .bind(GATE_EXCEL_SETTINGS_KEY, JSON.stringify(saved)).run();
  return json({ok: true, prices, meta, standardPrices});
}

const __handleAdminApiWithoutGateExcel = handleAdminApi;
handleAdminApi = async function handleAdminApiWithGateExcel(request, env, url) {
  if (url.pathname !== '/api/admin/gate-excel') return __handleAdminApiWithoutGateExcel(request, env, url);
  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!await hasAdminSession(request, env)) return json({error: 'Требуется вход'}, 401);
  try {
    if (request.method === 'GET') return json(await loadGateExcelState(env));
    if (request.method === 'POST') return await saveGateExcelState(request, env);
    return json({error: 'Метод не поддерживается'}, 405);
  } catch (error) {
    return json({error: 'Не удалось обновить расчёт из Excel: ' + errorMessage(error)}, 500);
  }
};
