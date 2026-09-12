const GATE_EXCEL_SETTINGS_KEY = 'gate_excel_prices';
const GATE_EXCEL_FILE_MAX_BYTES = 10 * 1024 * 1024;
const GATE_EXCEL_FILE_CHUNK_BYTES = 450000;
let gateExcelFileTableReady = false;

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

function cleanGateExcelUploadId(value) {
  const id = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  return id.length >= 12 ? id : '';
}

function normalizeGateExcelMeta(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    fileName: String(source.fileName || '').replace(/[\r\n]/g, ' ').trim().slice(0, 220),
    fileSize: Math.max(0, Math.min(GATE_EXCEL_FILE_MAX_BYTES, Math.round(Number(source.fileSize) || 0))),
    sha256: String(source.sha256 || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64),
    fileUploadId: cleanGateExcelUploadId(source.fileUploadId),
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

async function ensureGateExcelFileTable(env) {
  if (!env.DB) return false;
  if (!gateExcelFileTableReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gate_excel_file_chunks (
      upload_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      bytes BLOB NOT NULL,
      size_bytes INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      PRIMARY KEY (upload_id, chunk_index)
    )`).run();
    gateExcelFileTableReady = true;
  }
  return true;
}

async function sha256GateExcel(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function decodeGateExcelFileName(request) {
  const encoded = String(request.headers.get('x-file-name') || '').slice(0, 700);
  try {
    return decodeURIComponent(encoded).replace(/[\r\n\\/]/g, ' ').trim().slice(0, 220) || 'ворота_расчет.xlsx';
  } catch {
    return 'ворота_расчет.xlsx';
  }
}

async function gateExcelUploadInfo(env, uploadId) {
  if (!uploadId || !await ensureGateExcelFileTable(env)) return null;
  const row = await env.DB.prepare(`SELECT file_name, sha256, SUM(size_bytes) AS total_size, COUNT(*) AS chunk_count
    FROM gate_excel_file_chunks WHERE upload_id = ? GROUP BY file_name, sha256`).bind(uploadId).first();
  if (!row?.chunk_count) return null;
  return {
    uploadId,
    fileName: String(row.file_name || ''),
    sha256: String(row.sha256 || ''),
    fileSize: Number(row.total_size) || 0,
    chunkCount: Number(row.chunk_count) || 0
  };
}

async function storeGateExcelFile(request, env) {
  if (!await ensureGateExcelFileTable(env)) return json({error: 'Хранилище Excel временно недоступно'}, 503);
  const contentType = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && contentType !== 'application/octet-stream') {
    return json({error: 'Поддерживается только файл Excel .xlsx'}, 415);
  }
  const statedLength = Number(request.headers.get('content-length') || 0);
  if (statedLength > GATE_EXCEL_FILE_MAX_BYTES) return json({error: 'Excel слишком большой. Максимум 10 МБ.'}, 413);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > GATE_EXCEL_FILE_MAX_BYTES) return json({error: 'Excel пустой или превышает 10 МБ'}, 413);
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b) return json({error: 'Файл не похож на корректный .xlsx'}, 400);

  const sha256 = await sha256GateExcel(bytes);
  const expectedHash = String(request.headers.get('x-file-sha256') || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64);
  if (expectedHash && expectedHash !== sha256) return json({error: 'Контрольная сумма Excel не совпала. Загрузите файл ещё раз.'}, 400);
  const fileName = decodeGateExcelFileName(request);
  const uploadId = `xlsx_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    for (let offset = 0, chunkIndex = 0; offset < bytes.byteLength; offset += GATE_EXCEL_FILE_CHUNK_BYTES, chunkIndex += 1) {
      const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + GATE_EXCEL_FILE_CHUNK_BYTES));
      await env.DB.prepare(`INSERT INTO gate_excel_file_chunks
        (upload_id, chunk_index, bytes, size_bytes, file_name, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
        .bind(uploadId, chunkIndex, chunk, chunk.byteLength, fileName, sha256).run();
    }
    // Orphan uploads are harmless, but clear old unpublished ones opportunistically.
    await env.DB.prepare(`DELETE FROM gate_excel_file_chunks
      WHERE created_at < datetime('now','-2 days')
      AND upload_id NOT IN (
        SELECT json_extract(value_json, '$.meta.fileUploadId') FROM site_settings WHERE key = ?
      )`).bind(GATE_EXCEL_SETTINGS_KEY).run().catch(() => {});
    return json({ok: true, uploadId, fileName, fileSize: bytes.byteLength, sha256}, 201);
  } catch (error) {
    await env.DB.prepare('DELETE FROM gate_excel_file_chunks WHERE upload_id = ?').bind(uploadId).run().catch(() => {});
    throw error;
  }
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
  const uploadId = cleanGateExcelUploadId(meta?.fileUploadId);
  const fileAvailable = Boolean(uploadId && await gateExcelUploadInfo(env, uploadId));
  return {prices, meta, standardPrices: gateExcelStandardPrices(prices), fileAvailable};
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

  const requestedUploadId = cleanGateExcelUploadId(body?.fileUploadId || body?.meta?.fileUploadId);
  let uploadedFile = null;
  if (requestedUploadId) {
    uploadedFile = await gateExcelUploadInfo(env, requestedUploadId);
    if (!uploadedFile) return json({error: 'Загруженный Excel не найден. Выберите файл ещё раз.'}, 400);
    const requestedHash = String(body?.meta?.sha256 || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64);
    if (requestedHash && uploadedFile.sha256 !== requestedHash) return json({error: 'Excel-файл не совпадает с проверенным расчётом.'}, 400);
  }

  let previousUploadId = '';
  try {
    const previousRow = await env.DB.prepare('SELECT value_json FROM site_settings WHERE key = ?').bind(GATE_EXCEL_SETTINGS_KEY).first();
    if (previousRow?.value_json) previousUploadId = cleanGateExcelUploadId(JSON.parse(previousRow.value_json)?.meta?.fileUploadId);
  } catch {}

  const meta = normalizeGateExcelMeta({
    ...body?.meta,
    ...(uploadedFile ? {fileUploadId: uploadedFile.uploadId, fileName: uploadedFile.fileName, fileSize: uploadedFile.fileSize, sha256: uploadedFile.sha256} : {})
  });
  const saved = {version: 2, prices, meta, standardPrices};
  await env.DB.prepare(`INSERT INTO site_settings (key, value_json, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, 'admin-excel')
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
    .bind(GATE_EXCEL_SETTINGS_KEY, JSON.stringify(saved)).run();

  if (uploadedFile && previousUploadId && previousUploadId !== uploadedFile.uploadId) {
    await env.DB.prepare('DELETE FROM gate_excel_file_chunks WHERE upload_id = ?').bind(previousUploadId).run().catch(() => {});
  }
  return json({ok: true, prices, meta, standardPrices, fileAvailable: Boolean(uploadedFile || previousUploadId)});
}

async function downloadGateExcelFile(env) {
  if (!await ensureSiteSettings(env) || !await ensureGateExcelFileTable(env)) return new Response('Excel не найден', {status: 404});
  let meta = null;
  try {
    const row = await env.DB.prepare('SELECT value_json FROM site_settings WHERE key = ?').bind(GATE_EXCEL_SETTINGS_KEY).first();
    if (row?.value_json) meta = JSON.parse(row.value_json)?.meta || null;
  } catch {}
  const uploadId = cleanGateExcelUploadId(meta?.fileUploadId);
  if (!uploadId) return new Response('Текущий Excel ещё не сохранён на сайте', {status: 404, headers: securityHeaders});
  const info = await gateExcelUploadInfo(env, uploadId);
  if (!info) return new Response('Текущий Excel не найден', {status: 404, headers: securityHeaders});
  const result = await env.DB.prepare('SELECT chunk_index, bytes, size_bytes FROM gate_excel_file_chunks WHERE upload_id = ? ORDER BY chunk_index ASC').bind(uploadId).all();
  const rows = result.results || [];
  if (!rows.length) return new Response('Текущий Excel не найден', {status: 404, headers: securityHeaders});
  const body = new Uint8Array(info.fileSize);
  let offset = 0;
  for (const row of rows) {
    const chunk = row.bytes instanceof ArrayBuffer ? new Uint8Array(row.bytes) : new Uint8Array(row.bytes || []);
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== info.fileSize) return new Response('Excel повреждён в хранилище', {status: 500, headers: securityHeaders});
  const fileName = info.fileName || 'ворота_расчет.xlsx';
  return new Response(body, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-length': String(body.byteLength),
      'content-disposition': `attachment; filename="gate-calculation.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'cache-control': 'private, no-store',
      ...securityHeaders
    }
  });
}

const __handleAdminApiWithoutGateExcel = handleAdminApi;
handleAdminApi = async function handleAdminApiWithGateExcel(request, env, url) {
  const isStateRoute = url.pathname === '/api/admin/gate-excel';
  const isFileRoute = url.pathname === '/api/admin/gate-excel/file';
  if (!isStateRoute && !isFileRoute) return __handleAdminApiWithoutGateExcel(request, env, url);
  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({error: 'Недопустимый источник запроса'}, 403);
  if (!await hasAdminSession(request, env)) return json({error: 'Требуется вход'}, 401);
  try {
    if (isFileRoute) {
      if (request.method === 'GET') return await downloadGateExcelFile(env);
      if (request.method === 'PUT' || request.method === 'POST') return await storeGateExcelFile(request, env);
      return json({error: 'Метод не поддерживается'}, 405);
    }
    if (request.method === 'GET') return json(await loadGateExcelState(env));
    if (request.method === 'POST') return await saveGateExcelState(request, env);
    return json({error: 'Метод не поддерживается'}, 405);
  } catch (error) {
    return json({error: 'Не удалось обновить расчёт из Excel: ' + errorMessage(error)}, 500);
  }
};
