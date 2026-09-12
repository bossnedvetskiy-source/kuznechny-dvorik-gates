const ADMIN_HISTORY_KEYS = new Set(['prices','site_profile','delivery_prices']);
const LEAD_WORKFLOW_STAGES = new Set(['new','contacted','measurement_scheduled','measurement_done','contract','production','installation','completed','lost']);
let adminOpsReady = false;

async function ensureAdminOps(env) {
  if (!env.DB) return false;
  if (adminOpsReady) return true;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    saved_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by TEXT NOT NULL DEFAULT 'admin'
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS site_settings_history_key_idx ON site_settings_history(setting_key, id DESC)').run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_workflow (
    lead_id INTEGER PRIMARY KEY NOT NULL,
    stage TEXT NOT NULL DEFAULT 'new',
    admin_note TEXT NOT NULL DEFAULT '',
    next_action_at TEXT NOT NULL DEFAULT '',
    loss_reason TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  adminOpsReady = true;
  return true;
}

async function archiveSetting(env, key) {
  if (!ADMIN_HISTORY_KEYS.has(key) || !await ensureAdminOps(env)) return;
  const row = await env.DB.prepare('SELECT value_json FROM site_settings WHERE key = ?').bind(key).first();
  if (!row?.value_json) return;
  await env.DB.prepare(`INSERT INTO site_settings_history (setting_key, value_json, saved_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, 'admin')`).bind(key, row.value_json).run();
  await env.DB.prepare(`DELETE FROM site_settings_history
    WHERE setting_key = ? AND id NOT IN (
      SELECT id FROM site_settings_history WHERE setting_key = ? ORDER BY id DESC LIMIT 20
    )`).bind(key, key).run();
}

const __savePricesWithoutHistory = savePrices;
savePrices = async function savePricesWithHistory(request, env) {
  await archiveSetting(env, 'prices');
  return __savePricesWithoutHistory(request, env);
};

const __saveSiteProfileWithoutHistory = saveSiteProfile;
saveSiteProfile = async function saveSiteProfileWithHistory(request, env) {
  await archiveSetting(env, 'site_profile');
  return __saveSiteProfileWithoutHistory(request, env);
};

const __saveDeliveryWithoutHistory = saveDeliverySettings;
saveDeliverySettings = async function saveDeliveryWithHistory(request, env) {
  await archiveSetting(env, 'delivery_prices');
  return __saveDeliveryWithoutHistory(request, env);
};

function workflowStageForStatus(status) {
  if (status === 'done') return 'completed';
  if (status === 'archived') return 'lost';
  if (status === 'contacted') return 'contacted';
  return 'new';
}

function workflowCoarseStatus(stage) {
  if (stage === 'new') return 'new';
  if (stage === 'completed' || stage === 'lost') return 'done';
  return 'contacted';
}

async function listLeadWorkflows(env, searchParams) {
  await ensureLeadSchema(env);
  await ensureAdminOps(env);
  const ids = String(searchParams?.get('ids') || '').split(',')
    .map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0).slice(0,200);
  if (!ids.length) return {workflows:{}};
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(`SELECT l.id, l.status, l.color,
      w.stage, w.admin_note, w.next_action_at, w.loss_reason, w.updated_at AS workflow_updated_at
    FROM site_leads l LEFT JOIN lead_workflow w ON w.lead_id = l.id
    WHERE l.id IN (${placeholders})`).bind(...ids).all();
  const workflows = {};
  for (const row of result.results || []) {
    workflows[row.id] = {
      stage:LEAD_WORKFLOW_STAGES.has(row.stage) ? row.stage : workflowStageForStatus(row.status),
      note:String(row.admin_note || ''),
      nextActionAt:String(row.next_action_at || ''),
      lossReason:String(row.loss_reason || ''),
      updatedAt:String(row.workflow_updated_at || ''),
      color:String(row.color || '')
    };
  }
  return {workflows};
}

async function saveLeadWorkflow(request, env, id) {
  await ensureLeadSchema(env);
  await ensureAdminOps(env);
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) return json({error:'Заявка не найдена'},404);
  let body;
  try { body = await request.json(); } catch { return json({error:'Некорректный запрос'},400); }
  const stage = String(body?.stage || '').trim();
  if (!LEAD_WORKFLOW_STAGES.has(stage)) return json({error:'Некорректный этап заявки'},400);
  const note = String(body?.note || '').trim().slice(0,1200);
  const nextActionAt = String(body?.nextActionAt || '').trim().slice(0,40);
  const lossReason = String(body?.lossReason || '').trim().slice(0,400);
  if (nextActionAt && !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(nextActionAt)) return json({error:'Некорректная дата следующего действия'},400);
  const lead = await env.DB.prepare('SELECT status FROM site_leads WHERE id = ?').bind(leadId).first();
  if (!lead) return json({error:'Заявка не найдена'},404);
  await env.DB.prepare(`INSERT INTO lead_workflow (lead_id, stage, admin_note, next_action_at, loss_reason, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(lead_id) DO UPDATE SET stage=excluded.stage, admin_note=excluded.admin_note,
      next_action_at=excluded.next_action_at, loss_reason=excluded.loss_reason, updated_at=CURRENT_TIMESTAMP`)
    .bind(leadId, stage, note, nextActionAt, lossReason).run();
  if (lead.status !== 'archived') {
    await env.DB.prepare('UPDATE site_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(workflowCoarseStatus(stage), leadId).run();
  }
  return json({ok:true,id:leadId,stage,note,nextActionAt,lossReason});
}

async function listSettingsHistory(env, key) {
  if (!ADMIN_HISTORY_KEYS.has(key)) return json({error:'Неизвестный раздел истории'},400);
  await ensureAdminOps(env);
  const result = await env.DB.prepare(`SELECT id, setting_key, saved_at, updated_by, value_json
    FROM site_settings_history WHERE setting_key = ? ORDER BY id DESC LIMIT 10`).bind(key).all();
  const history = (result.results || []).map(row => ({
    id:Number(row.id),key:row.setting_key,savedAt:row.saved_at,updatedBy:row.updated_by,
    value:(() => { try { return JSON.parse(row.value_json); } catch { return null; } })()
  }));
  return json({history});
}

async function restoreSettingsHistory(request, env) {
  await ensureAdminOps(env);
  let body;
  try { body = await request.json(); } catch { return json({error:'Некорректный запрос'},400); }
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return json({error:'Версия не найдена'},404);
  const row = await env.DB.prepare('SELECT setting_key, value_json FROM site_settings_history WHERE id = ?').bind(id).first();
  if (!row || !ADMIN_HISTORY_KEYS.has(row.setting_key)) return json({error:'Версия не найдена'},404);
  await archiveSetting(env, row.setting_key);
  await env.DB.prepare(`INSERT INTO site_settings (key, value_json, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, 'history-restore')
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=CURRENT_TIMESTAMP, updated_by=excluded.updated_by`)
    .bind(row.setting_key, row.value_json).run();
  if (row.setting_key === 'delivery_prices') deliveryCache.clear();
  return json({ok:true,key:row.setting_key});
}

const __handleAdminApiWithoutOps = handleAdminApi;
handleAdminApi = async function handleAdminApiWithOps(request, env, url) {
  const path = url.pathname;
  const ours = path === '/api/admin/delivery' || path === '/api/admin/history' || path === '/api/admin/history/restore' ||
    path === '/api/admin/lead-workflows' || path.startsWith('/api/admin/lead-workflows/');
  if (!ours) return __handleAdminApiWithoutOps(request, env, url);
  if (request.method !== 'GET' && !sameOrigin(request,url)) return json({error:'Недопустимый источник запроса'},403);
  if (!await hasAdminSession(request,env)) return json({error:'Требуется вход'},401);
  try {
    if (path === '/api/admin/delivery') {
      if (request.method === 'GET') return json({delivery:await loadDeliverySettings(env)});
      if (request.method === 'POST') return saveDeliverySettings(request,env);
      return json({error:'Метод не поддерживается'},405);
    }
    if (path === '/api/admin/history') {
      if (request.method !== 'GET') return json({error:'Метод не поддерживается'},405);
      return listSettingsHistory(env,String(url.searchParams.get('key') || ''));
    }
    if (path === '/api/admin/history/restore') {
      if (request.method !== 'POST') return json({error:'Метод не поддерживается'},405);
      return restoreSettingsHistory(request,env);
    }
    if (path === '/api/admin/lead-workflows') {
      if (request.method !== 'GET') return json({error:'Метод не поддерживается'},405);
      return json(await listLeadWorkflows(env,url.searchParams));
    }
    if (path.startsWith('/api/admin/lead-workflows/')) {
      if (request.method !== 'POST') return json({error:'Метод не поддерживается'},405);
      return saveLeadWorkflow(request,env,path.slice('/api/admin/lead-workflows/'.length));
    }
  } catch (error) {
    return json({error:errorMessage(error)}, Number(error?.status) || 500);
  }
  return json({error:'Маршрут не найден'},404);
};
