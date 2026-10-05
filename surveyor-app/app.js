import {PLAN_ITEM_TYPES,MATERIAL_LABELS,ensureSitePlan,newItem,newLine,lineWidth,itemDescription,trimNumber} from './line-builder.js';

const APP_VERSION = '0.3.4';
const DB_NAME = 'kd-surveyor-stage1';
const DB_VERSION = 1;
const STORE_NAMES = ['employees', 'clients', 'surveys', 'meta'];
const IS_PREVIEW = location.hostname.endsWith('github.io') || ['localhost','127.0.0.1'].includes(location.hostname);
const FORCE_SERVER = new URLSearchParams(location.search).get('server') === '1';
const API_ENABLED = !IS_PREVIEW || FORCE_SERVER;
const API_BASE = IS_PREVIEW ? 'https://kuzdvor.tw1.ru/api/surveyor' : '/api/surveyor';

const WORK_TYPES = {
  gates: { label: 'Ворота / калитка', short: 'Ворота', className: 'gates' },
  fence: { label: 'Забор', short: 'Забор', className: 'fence' },
  canopy: { label: 'Навес', short: 'Навес', className: 'canopy' }
};
const ROLE_LABELS = { owner: 'Собственник', surveyor: 'Замерщик' };

let db;
let currentUser = null;
let currentSurveyFilter = 'all';
let syncInFlight = false;
let lastSyncMessage = '';
let activePlanSurveyId = '';
let activePlanConfiguration = null;
let activePlanLineId = '';
let activePlanItemId = '';
let activeInsertIndex = null;
let activeCalculationSurveyId = '';
const CALC_TRANSFER_KEY = 'kd-surveyor-transfer-v1';
const CALC_EDIT_KEY = 'kd-surveyor-edit-v1';
const DEV_ACCESS_KEY = 'kuzdvor-dev-access-v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: storeName === 'meta' ? 'key' : 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function tx(storeName, mode = 'readonly') { return db.transaction(storeName, mode).objectStore(storeName); }
function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}
function idbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function metaGet(key, fallback = null) {
  const row = await idbGet('meta', key);
  return row ? row.value : fallback;
}
async function metaSet(key, value) { return idbPut('meta', { key, value }); }
async function metaDelete(key) { return idbDelete('meta', key); }

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = saltB64 ? base64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 80000, hash: 'SHA-256' }, keyMaterial, 256);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(bits)) };
}
function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function verifyPassword(password, employee) {
  if (!employee?.passwordSalt || !employee?.passwordHash) return false;
  const result = await hashPassword(password, employee.passwordSalt);
  return timingSafeEqual(result.hash, employee.passwordHash);
}
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function seedDatabase() {
  const employees = await idbGetAll('employees');
  if (IS_PREVIEW && !employees.length) {
    const ownerPass = await hashPassword('1234');
    const surveyorPass = await hashPassword('1234');
    await idbPut('employees', {
      id: 'emp_owner', name: 'Собственник', login: 'admin', role: 'owner', active: true,
      passwordSalt: ownerPass.salt, passwordHash: ownerPass.hash, createdAt: new Date().toISOString(), previewOnly: true
    });
    await idbPut('employees', {
      id: 'emp_surveyor', name: 'Замерщик', login: 'zamer', role: 'surveyor', active: true,
      passwordSalt: surveyorPass.salt, passwordHash: surveyorPass.hash, createdAt: new Date().toISOString(), previewOnly: true
    });
  }
  if (!(await idbGet('meta', 'nextSurveyNumber'))) await metaSet('nextSurveyNumber', 1);
}

function saveSession(user) { sessionStorage.setItem('kdSurveyorSession', JSON.stringify({ id: user.id, ts: Date.now() })); }
async function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem('kdSurveyorSession') || 'null');
    if (!session?.id) return null;
    const user = await idbGet('employees', session.id);
    return user?.active ? user : null;
  } catch { return null; }
}
function clearSession() { sessionStorage.removeItem('kdSurveyorSession'); }

function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let d = digits;
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7') && d.length) d = '7' + d;
  d = d.slice(0, 11);
  if (d.length <= 1) return d ? '+7' : '';
  const p1 = d.slice(1, 4), p2 = d.slice(4, 7), p3 = d.slice(7, 9), p4 = d.slice(9, 11);
  return `+7${p1 ? ' ' + p1 : ''}${p2 ? ' ' + p2 : ''}${p3 ? '-' + p3 : ''}${p4 ? '-' + p4 : ''}`;
}
function parseServerDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value.replace(' ', 'T') + 'Z';
  return value;
}
function formatDate(iso) {
  const d = new Date(parseServerDate(iso));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}
function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[ch]));
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

async function apiRequest(path, options = {}) {
  if (!API_ENABLED) throw Object.assign(new Error('Сервер отключён в DEV-превью'), { offline: true });
  const token = await metaGet('serverToken', '');
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, headers, cache: 'no-store' });
  } catch (error) {
    throw Object.assign(new Error('Сервер недоступен'), { network: true, cause: error });
  }
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status, data });
    if (response.status === 401 && path !== '/login') await metaDelete('serverToken');
    throw error;
  }
  return data;
}

async function cacheAuthenticatedUser(serverUser, username, password) {
  const existing = await idbGet('employees', serverUser.id);
  const verifier = password ? await hashPassword(password) : null;
  const user = {
    ...existing,
    id: serverUser.id,
    name: serverUser.name,
    login: username || existing?.login || '',
    role: serverUser.role,
    active: true,
    source: 'server',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (verifier) {
    user.passwordSalt = verifier.salt;
    user.passwordHash = verifier.hash;
  }
  await idbPut('employees', user);
  return user;
}

async function serverLogin(username, password) {
  const data = await apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password })
  });
  await metaSet('serverToken', data.token);
  await metaSet('serverUser', data.user);
  return cacheAuthenticatedUser(data.user, username.trim().toLowerCase(), password);
}

async function localLogin(username, password) {
  const employees = await idbGetAll('employees');
  const normalized = username.trim().toLowerCase();
  const employee = employees.find(x => String(x.login || '').toLowerCase() === normalized && x.active);
  if (!employee || !(await verifyPassword(password, employee))) return null;
  return employee;
}

async function login(username, password) {
  if (API_ENABLED && navigator.onLine) {
    try {
      return await serverLogin(username, password);
    } catch (error) {
      if (error.status === 401 || error.status === 429 || error.status === 400) return null;
      const cached = await localLogin(username, password);
      if (cached) {
        lastSyncMessage = 'Сервер недоступен — вход по сохранённому офлайн-доступу';
        return cached;
      }
      throw error;
    }
  }
  return localLogin(username, password);
}

async function nextSurveyNumber() {
  const item = await idbGet('meta', 'nextSurveyNumber') || { key:'nextSurveyNumber', value:1 };
  const value = Number(item.value || 1);
  item.value = value + 1;
  await idbPut('meta', item);
  return `ЗМ-${String(value).padStart(4, '0')}`;
}
function displaySurveyNumber(survey) {
  return survey.number || survey.localNumber || 'Замер без номера';
}

async function upsertClient({ name = '', phone, address = '' }) {
  const clients = await idbGetAll('clients');
  const phoneDigits = phone.replace(/\D/g, '');
  let client = clients.find(x => String(x.phone || '').replace(/\D/g, '') === phoneDigits);
  const now = new Date().toISOString();
  if (client) {
    client = {
      ...client, name: name.trim() || client.name, phone: formatPhone(phone),
      address: address.trim() || client.address, updatedAt: now, syncState: API_ENABLED ? 'pending' : 'local'
    };
  } else {
    client = {
      id: makeId('cl'), name: name.trim(), phone: formatPhone(phone), address: address.trim(),
      createdAt: now, updatedAt: now, syncState: API_ENABLED ? 'pending' : 'local', serverRevision: 0
    };
  }
  await idbPut('clients', client);
  return client;
}

async function createSurvey(data) {
  const client = await upsertClient(data);
  const now = new Date().toISOString();
  const id = makeId('sv');
  const survey = {
    id,
    number: API_ENABLED ? '' : await nextSurveyNumber(),
    localNumber: API_ENABLED ? `ЛОК-${id.slice(-5).toUpperCase()}` : '',
    clientId: client.id, clientName: client.name, clientPhone: client.phone,
    address: data.address.trim(), note: data.note.trim(), workTypes: Array.isArray(data.workTypes) ? [...data.workTypes] : [],
    status: 'draft', createdBy: currentUser.id, createdByName: currentUser.name,
    createdAt: now, updatedAt: now, syncState: API_ENABLED ? 'pending' : 'local',
    serverRevision: 0, archived: false, schemaVersion: 3, configuration: {}
  };
  await idbPut('surveys', survey);
  if (API_ENABLED && navigator.onLine) queueMicrotask(() => syncNow({ silent: true }));
  return survey;
}

function serverClientToLocal(server, existing = {}) {
  return {
    ...existing,
    id: server.id,
    name: server.name,
    phone: server.phone,
    address: server.address || '',
    serverRevision: Number(server.serverRevision || 0),
    updatedAt: server.updatedAt || existing.updatedAt || new Date().toISOString(),
    serverUpdatedAt: parseServerDate(server.serverUpdatedAt),
    createdAt: existing.createdAt || server.updatedAt || new Date().toISOString(),
    syncState: 'synced',
    serverConflict: null
  };
}
function serverSurveyToLocal(server, existing = {}) {
  return {
    ...existing,
    id: server.id,
    number: server.number || existing.number || '',
    localNumber: existing.localNumber || '',
    clientId: server.clientId || '',
    clientName: server.clientName,
    clientPhone: server.clientPhone,
    address: server.address,
    note: server.note || '',
    workTypes: Array.isArray(server.workTypes) ? server.workTypes : [],
    configuration: server.configuration && typeof server.configuration === 'object' ? server.configuration : (existing.configuration || {}),
    status: server.status || 'draft',
    archived: !!server.archived,
    createdBy: server.createdBy || existing.createdBy || '',
    createdByName: server.createdByName || existing.createdByName || '',
    serverRevision: Number(server.serverRevision || 0),
    updatedAt: server.updatedAt || existing.updatedAt || new Date().toISOString(),
    createdAt: parseServerDate(server.createdAt) || existing.createdAt || new Date().toISOString(),
    serverUpdatedAt: parseServerDate(server.serverUpdatedAt),
    syncState: 'synced',
    serverConflict: null,
    schemaVersion: 2
  };
}

async function applyServerClient(server, { force = false } = {}) {
  const existing = await idbGet('clients', server.id);
  if (!force && existing && ['pending','conflict'].includes(existing.syncState)) return;
  await idbPut('clients', serverClientToLocal(server, existing || {}));
}
async function applyServerSurvey(server, { force = false } = {}) {
  const existing = await idbGet('surveys', server.id);
  if (!force && existing && ['pending','conflict'].includes(existing.syncState)) return;
  await idbPut('surveys', serverSurveyToLocal(server, existing || {}));
}

async function syncNow({ silent = false } = {}) {
  if (syncInFlight) return false;
  if (!API_ENABLED) {
    lastSyncMessage = 'DEV-превью: локальный режим';
    updateSyncUi();
    return false;
  }
  if (!navigator.onLine) {
    lastSyncMessage = 'Нет интернета — изменения сохранены на телефоне';
    updateSyncUi();
    return false;
  }
  const token = await metaGet('serverToken', '');
  if (!token) {
    lastSyncMessage = 'Для синхронизации нужен серверный вход';
    updateSyncUi();
    return false;
  }
  syncInFlight = true;
  lastSyncMessage = 'Синхронизация…';
  updateSyncUi();
  try {
    const allClients = await idbGetAll('clients');
    const allSurveys = await idbGetAll('surveys');
    const pendingClients = allClients.filter(x => x.syncState === 'pending' || x.syncState === 'conflict');
    const pendingSurveys = allSurveys.filter(x => x.syncState === 'pending' || x.syncState === 'conflict');
    const since = await metaGet('serverLastSync', '1970-01-01 00:00:00');
    const payload = {
      since,
      clients: pendingClients.map(x => ({
        id:x.id,name:x.name,phone:x.phone,address:x.address,updatedAt:x.updatedAt,serverRevision:Number(x.serverRevision||0)
      })),
      surveys: pendingSurveys.map(x => ({
        id:x.id,clientId:x.clientId,clientName:x.clientName,clientPhone:x.clientPhone,address:x.address,note:x.note,
        workTypes:x.workTypes,configuration:x.configuration || {},status:x.status,archived:!!x.archived,createdByName:x.createdByName,
        updatedAt:x.updatedAt,serverRevision:Number(x.serverRevision||0)
      }))
    };
    const data = await apiRequest('/sync', { method:'POST', body:JSON.stringify(payload) });

    for (const item of data.acks?.clients || []) await applyServerClient(item, { force:true });
    for (const item of data.acks?.surveys || []) await applyServerSurvey(item, { force:true });
    const conflictIds = new Set((data.conflicts || []).map(item => item.entity + ':' + item.id));
    for (const item of data.pull?.clients || []) {
      if (!conflictIds.has('client:' + item.id)) await applyServerClient(item);
    }
    for (const item of data.pull?.surveys || []) {
      if (!conflictIds.has('survey:' + item.id)) await applyServerSurvey(item);
    }

    for (const conflict of data.conflicts || []) {
      const store = conflict.entity === 'client' ? 'clients' : 'surveys';
      const local = await idbGet(store, conflict.id);
      if (local) {
        local.syncState = 'conflict';
        local.serverConflict = conflict.server || null;
        await idbPut(store, local);
      }
    }
    if (data.serverNow) await metaSet('serverLastSync', data.serverNow);
    if (data.user?.id) {
      const cached = await idbGet('employees', data.user.id);
      if (cached) {
        cached.name = data.user.name;
        cached.role = data.user.role;
        cached.active = true;
        await idbPut('employees', cached);
        if (currentUser?.id === cached.id) currentUser = cached;
      }
    }
    const conflicts = (data.conflicts || []).length;
    lastSyncMessage = conflicts ? `Есть конфликтов: ${conflicts}` : 'Все изменения синхронизированы';
    if (!silent) showToast(conflicts ? 'Синхронизация завершена с конфликтом' : 'Синхронизация завершена');
    await renderSurveys();
    await renderClients($('#clientSearch')?.value || '');
    updateSyncUi();
    return true;
  } catch (error) {
    if (error.status === 401) {
      lastSyncMessage = 'Сессия сервера истекла — войдите снова при наличии связи';
    } else {
      lastSyncMessage = 'Сервер недоступен — продолжаем офлайн';
    }
    if (!silent) showToast(lastSyncMessage);
    updateSyncUi();
    return false;
  } finally {
    syncInFlight = false;
  }
}

function syncLabel(state) {
  if (state === 'synced') return 'Синхронизировано';
  if (state === 'pending') return 'Ожидает отправки';
  if (state === 'conflict') return 'Нужно проверить';
  return 'На устройстве';
}
function syncClass(state) {
  if (state === 'synced') return 'sync-ok';
  if (state === 'conflict') return 'sync-conflict';
  return 'sync-local';
}

async function updateSyncUi() {
  const status = $('#syncStatusText');
  const detail = $('#syncStatusDetail');
  const button = $('#syncNowBtn');
  if (!status || !detail || !button) return;
  const token = await metaGet('serverToken', '');
  if (!API_ENABLED) {
    status.textContent = 'Локальный DEV';
    detail.textContent = 'Серверная синхронизация подготовлена, но не включена в обычном DEV-превью.';
    button.disabled = true;
    return;
  }
  if (!navigator.onLine) {
    status.textContent = 'Офлайн';
    detail.textContent = lastSyncMessage || 'Все изменения сохраняются на телефоне.';
    button.disabled = true;
    return;
  }
  if (!token) {
    status.textContent = 'Нет серверной сессии';
    detail.textContent = 'Войдите в приложение при наличии интернета.';
    button.disabled = true;
    return;
  }
  status.textContent = syncInFlight ? 'Синхронизация…' : 'Сервер подключён';
  detail.textContent = lastSyncMessage || 'Изменения отправляются в общую базу.';
  button.disabled = syncInFlight;
}

function updateNetworkState() {
  const badge = $('#networkBadge');
  const online = navigator.onLine;
  badge.classList.toggle('offline', !online);
  $('span:last-child', badge).textContent = online ? 'Онлайн' : 'Офлайн';
  updateSyncUi();
}

function applyRoleUi() {
  const isOwner = currentUser?.role === 'owner';
  $('#teamNavBtn')?.classList.toggle('hidden', !isOwner);
  $('#openTeamBtn')?.classList.toggle('hidden', !isOwner);
  if (!isOwner && $('#teamScreen')?.classList.contains('active')) switchScreen('surveys');
  $('#profileBtn').textContent = (currentUser?.name || 'КД').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
}
function switchScreen(name) {
  const titles = { surveys: 'Замеры', calculators: 'Калькуляторы', clients: 'Клиенты', team: 'Сотрудники', settings: 'Ещё' };
  $$('.screen').forEach(el => el.classList.remove('active'));
  $(`#${name}Screen`)?.classList.add('active');
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === name));
  $('#screenTitle').textContent = titles[name] || 'КД Замерщик';
  if (name === 'surveys') renderSurveys();
  if (name === 'clients') renderClients();
  if (name === 'team') renderEmployees();
  if (name === 'settings') updateSyncUi();
}

async function renderSurveys() {
  let surveys = (await idbGetAll('surveys')).filter(x => !x.archived).sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if (currentSurveyFilter !== 'all') surveys = surveys.filter(x => x.status === currentSurveyFilter);
  $('#surveysCounter').textContent = `${surveys.length} ${plural(surveys.length, ['заказ','заказа','заказов'])}`;
  const list = $('#surveyList');
  list.innerHTML = surveys.map(survey => `
    <article class="survey-card" data-survey-id="${survey.id}">
      <div class="card-top">
        <div>
          <div class="order-number">${escapeHtml(displaySurveyNumber(survey))}</div>
          <div class="card-name">${escapeHtml(survey.clientName || survey.clientPhone || 'Клиент без имени')}</div>
          <div class="card-address">${escapeHtml(survey.address)}</div>
        </div>
        <span class="status-pill ${survey.status}">${survey.status === 'ready' ? 'Готов' : 'Черновик'}</span>
      </div>
      <div class="badge-row">${survey.workTypes.length ? survey.workTypes.map(type => `<span class="type-badge ${WORK_TYPES[type]?.className || ''}">${WORK_TYPES[type]?.short || type}</span>`).join('') : '<span class="type-badge">Определим на объекте</span>'}</div>
      ${surveyCalculations(survey).length ? `<div class="survey-card-total"><span>Расчёты</span><b>${formatMoney(surveyCalculationsTotal(survey))}</b></div>` : ''}
      <div class="survey-card-actions">
        <button type="button" class="quick-calc-btn" data-quick-calculation="${survey.id}">+ Расчёт</button>
        <button type="button" class="open-survey-btn" data-open-survey="${survey.id}">Карточка ›</button>
      </div>
      <div class="sync-row"><span>${formatDate(survey.updatedAt)}</span><span class="${syncClass(survey.syncState)}">${syncLabel(survey.syncState)}</span></div>
    </article>`).join('');
  $('#surveyEmpty').hidden = surveys.length > 0;
  list.querySelectorAll('[data-quick-calculation]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openCalculationPicker(button.dataset.quickCalculation);
  }));
  list.querySelectorAll('[data-open-survey]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openSurveyDetails(button.dataset.openSurvey);
  }));
  list.querySelectorAll('.survey-card').forEach(card => card.addEventListener('click', () => openSurveyDetails(card.dataset.surveyId)));
}

async function renderClients(query = '') {
  const q = query.trim().toLowerCase();
  let clients = (await idbGetAll('clients')).sort((a,b) => String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if (q) clients = clients.filter(x => `${x.name} ${x.phone} ${x.address}`.toLowerCase().includes(q));
  $('#clientList').innerHTML = clients.map(client => `
    <article class="client-card">
      <div class="client-main"><div class="client-name">${escapeHtml(client.name || client.phone || 'Контакт')}</div><div class="client-meta">${escapeHtml(client.address || 'Адрес не указан')}${client.name ? '' : ' · имя добавим при договоре'}</div></div>
      <a class="client-phone" href="tel:${String(client.phone||'').replace(/\D/g,'')}">${escapeHtml(client.phone)}</a>
    </article>`).join('');
  $('#clientEmpty').hidden = clients.length > 0;
}

async function fetchServerEmployees() {
  if (!API_ENABLED || !navigator.onLine || !(await metaGet('serverToken',''))) return null;
  const data = await apiRequest('/users');
  for (const emp of data.users || []) {
    const existing = await idbGet('employees', emp.id);
    await idbPut('employees', {
      ...existing, ...emp, id:emp.id, login:emp.login, name:emp.name, role:emp.role,
      active:!!emp.active, source:'server-directory', updatedAt:emp.updatedAt, createdAt:emp.createdAt
    });
  }
  return data.users || [];
}

async function renderEmployees() {
  if (currentUser?.role !== 'owner') return;
  try { await fetchServerEmployees(); } catch (error) { lastSyncMessage = 'Список сотрудников показан из офлайн-кэша'; }
  let employees = (await idbGetAll('employees')).filter(x => !x.previewOnly || IS_PREVIEW);
  if (currentUser?.id?.startsWith('admin:') && !employees.some(x => x.id === currentUser.id)) employees.unshift(currentUser);
  employees.sort((a,b) => Number(b.active) - Number(a.active) || String(a.name).localeCompare(String(b.name),'ru'));
  $('#employeeList').innerHTML = employees.map(emp => `
    <article class="employee-card ${emp.active ? '' : 'inactive'}">
      <div class="employee-main">
        <div class="employee-name">${escapeHtml(emp.name)}</div>
        <div class="employee-meta">${emp.login ? `Логин: ${escapeHtml(emp.login)} · ` : ''}${emp.active ? 'доступ активен' : 'доступ отключён'}</div>
        <span class="role-chip">${ROLE_LABELS[emp.role] || emp.role}</span>
      </div>
      <div class="inline-actions">
        ${emp.id?.startsWith('admin:') ? '<span class="role-chip">Главный доступ</span>' : `<button class="mini-btn" data-edit-employee="${emp.id}" type="button">Изменить</button>`}
        ${emp.id !== currentUser.id && !emp.id?.startsWith('admin:') ? `<button class="mini-btn ${emp.active ? 'danger' : ''}" data-toggle-employee="${emp.id}" type="button">${emp.active ? 'Отключить' : 'Включить'}</button>` : ''}
      </div>
    </article>`).join('');
  $$('[data-edit-employee]').forEach(btn => btn.addEventListener('click', () => openEmployeeDialog(btn.dataset.editEmployee)));
  $$('[data-toggle-employee]').forEach(btn => btn.addEventListener('click', () => toggleEmployee(btn.dataset.toggleEmployee)));
}


function workTypesEditorHtml(survey) {
  const selected = new Set(Array.isArray(survey?.workTypes) ? survey.workTypes : []);
  return `<div class="details-section">
    <div class="section-head compact">
      <div><h3>Что замеряем</h3><p class="muted">${selected.size ? 'Можно изменить состав замера в любой момент.' : 'Выберите уже на объекте, когда станет понятно, что нужно клиенту.'}</p></div>
    </div>
    <div class="work-grid work-grid-compact" data-survey-work-types="${survey.id}">
      ${Object.entries(WORK_TYPES).map(([value,meta]) => `<label class="work-option compact">
        <input type="checkbox" value="${value}" ${selected.has(value) ? 'checked' : ''} />
        <span class="work-icon">${value==='canopy'?'⌒':'▥'}</span>
        <b>${escapeHtml(meta.label)}</b>
      </label>`).join('')}
    </div>
    <button class="btn btn-secondary btn-block work-types-save" data-save-work-types="${survey.id}" type="button">Сохранить состав замера</button>
  </div>`;
}

async function saveSurveyWorkTypes(surveyId) {
  const survey = await idbGet('surveys', surveyId);
  const root = document.querySelector(`[data-survey-work-types="${surveyId}"]`);
  if (!survey || !root) return;
  survey.workTypes = [...root.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  survey.updatedAt = new Date().toISOString();
  survey.syncState = API_ENABLED ? 'pending' : 'local';
  await idbPut('surveys', survey);
  showToast(survey.workTypes.length ? 'Состав замера сохранён' : 'Вид работ пока не выбран');
  await renderSurveys();
  if ($('#surveyDetailsDialog').open) {
    $('#surveyDetailsDialog').close();
    await openSurveyDetails(survey.id);
  }
  if (API_ENABLED && navigator.onLine) syncNow({silent:true});
}

function surveyHasLinearPlan(survey) {
  return Array.isArray(survey?.workTypes) && (survey.workTypes.includes('gates') || survey.workTypes.includes('fence'));
}

function surveyPlanSummaryHtml(survey) {
  if (!surveyHasLinearPlan(survey)) return '';
  const lines = survey?.configuration?.sitePlan?.lines;
  if (!Array.isArray(lines) || !lines.length) {
    return `<div class="details-section">
      <div class="section-head compact"><div><h3>Схема установки</h3><p class="muted">Забор, ворота, калитка и столбы на одной линии.</p></div></div>
      <div class="plan-empty-card">
        <div><b>Схема ещё не заполнена</b><span>Добавьте фактический порядок элементов на объекте.</span></div>
        <button class="btn btn-primary" data-edit-plan="${survey.id}" type="button">Создать схему</button>
      </div>
    </div>`;
  }
  const total = lines.reduce((sum,line)=>sum+lineWidth(line),0);
  const objects = lines.reduce((sum,line)=>sum+(line.items || []).length,0);
  return `<div class="details-section">
    <div class="section-head compact"><div><h3>Схема установки</h3><p class="muted">${lines.length} ${plural(lines.length,['линия','линии','линий'])} · ${trimNumber(total)} м · ${objects} элементов</p></div></div>
    <div class="plan-mini-preview">${lines.slice(0,2).map(line=>miniLineHtml(line)).join('')}</div>
    <button class="btn btn-secondary btn-block" data-edit-plan="${survey.id}" type="button">Редактировать схему</button>
  </div>`;
}

function miniLineHtml(line) {
  const items = Array.isArray(line?.items) ? line.items : [];
  return `<div class="mini-line">
    <div class="mini-line-name">${escapeHtml(line.name || 'Линия')}</div>
    <div class="mini-line-track">${items.map(item => `<span class="mini-plan-part ${item.type}" title="${escapeHtml(itemDescription(item))}" style="--part:${item.type === 'post' ? 0.16 :Math.max(.45,Number(item.width)||1)}"></span>`).join('')}</div>
  </div>`;
}

function currentPlanLine() {
  const lines=activePlanConfiguration?.sitePlan?.lines || [];
  return lines.find(line=>line.id===activePlanLineId) || lines[0] || null;
}

function currentPlanItem() {
  const line=currentPlanLine();
  return line?.items?.find(item=>item.id===activePlanItemId) || null;
}

async function openPlanEditor(surveyId) {
  const survey=await idbGet('surveys',surveyId);
  if (!survey || !surveyHasLinearPlan(survey)) return;
  activePlanSurveyId=survey.id;
  activePlanConfiguration=ensureSitePlan(survey.configuration,survey.workTypes);
  activePlanLineId=activePlanConfiguration.sitePlan.lines[0].id;
  activePlanItemId='';
  activeInsertIndex=null;
  $('#planTitle').textContent=displaySurveyNumber(survey)+' · схема';
  renderPlanEditor();
  $('#planDialog').showModal();
}

function renderPlanEditor() {
  const lines=activePlanConfiguration?.sitePlan?.lines || [];
  let line=currentPlanLine();
  if (!line && lines.length) {
    activePlanLineId=lines[0].id;
    line=lines[0];
  }
  $('#planLineTabs').innerHTML=lines.map((item,index)=>`<button type="button" class="plan-line-tab ${item.id===activePlanLineId?'active':''}" data-plan-line="${item.id}">${escapeHtml(item.name || 'Линия '+(index+1))}</button>`).join('');
  $('#planLinesCount').textContent=String(lines.length);
  if (!line) return;
  $('#planLineName').value=line.name || '';
  $('#planLineWidth').textContent=trimNumber(lineWidth(line))+' м';
  renderPlanCanvas(line);
  renderPlanItems(line);
  renderPlanItemEditor(line);
}

function renderPlanCanvas(line) {
  const items=line.items || [];
  $('#planCanvas').innerHTML=`<div class="plan-track">${items.map(item=>{
    const grow=item.type === 'post' ? 0.16 :Math.max(.45,Number(item.width)||1);
    const selected=item.id===activePlanItemId?' selected':'';
    const label=item.type==='post'?(item.state==='existing'?'есть':'новый'):(trimNumber(item.width)+' м');
    return `<button type="button" class="plan-part ${item.type}${selected}" data-select-plan-item="${item.id}" style="--part:${grow}" title="${escapeHtml(itemDescription(item))}">
      <span class="plan-part-shape"></span><b>${escapeHtml(PLAN_ITEM_TYPES[item.type]?.short || item.type)}</b><small>${escapeHtml(label)}</small>
    </button>`;
  }).join('')}</div>`;
}

function renderPlanItems(line) {
  const items=line.items || [];
  let html='';
  for(let index=0;index<=items.length;index++){
    html+=`<div class="plan-insert-slot"><button type="button" data-plan-insert="${index}" aria-label="Добавить элемент сюда">+</button></div>`;
    if(index<items.length){
      const item=items[index];
      html+=`<article class="plan-item-row ${item.id===activePlanItemId?'selected':''}" data-select-plan-item="${item.id}">
        <div class="plan-item-icon ${item.type}">${item.type==='post'?'│':item.type==='gate'?'▰':item.type==='wicket'?'▯':item.type==='opening'?'↔':'▥'}</div>
        <div class="plan-item-main"><b>${escapeHtml(PLAN_ITEM_TYPES[item.type]?.label || item.type)}</b><span>${escapeHtml(itemDescription(item))}</span></div>
        <span class="plan-item-order">${index+1}</span>
      </article>`;
    }
  }
  $('#planItems').innerHTML=html;
}

function materialOptions(selected, type) {
  const allowed=type==='fence'
    ? ['profsheet','euro_vertical','euro_horizontal']
    : ['forged','profsheet','euro_vertical','euro_horizontal','frame'];
  return allowed.map(value=>`<option value="${value}" ${value===selected?'selected':''}>${MATERIAL_LABELS[value]}</option>`).join('');
}

function renderPlanItemEditor(line) {
  const item=currentPlanItem();
  const editor=$('#planEditor');
  if(!item){ editor.hidden=true; return; }
  editor.hidden=false;
  $('#planEditorTitle').textContent=PLAN_ITEM_TYPES[item.type]?.label || 'Элемент';
  if(item.type==='post'){
    $('#planEditorFields').innerHTML=`
      <div class="plan-field-grid">
        <label class="field"><span>Столб</span><select data-plan-field="state"><option value="new" ${item.state==='new'?'selected':''}>Новый</option><option value="existing" ${item.state==='existing'?'selected':''}>Уже стоит</option></select></label>
        <label class="field"><span>Профиль</span><select data-plan-field="profile">
          ${['60×60×3','80×80×3','100×100×3'].map(v=>`<option value="${v}" ${v===item.profile?'selected':''}>${v}</option>`).join('')}
        </select></label>
      </div>`;
  } else {
    $('#planEditorFields').innerHTML=`
      <div class="plan-field-grid">
        <label class="field"><span>Ширина, м</span><input data-plan-field="width" type="number" min="0.1" max="100" step="0.01" inputmode="decimal" value="${Number(item.width)||1}" /></label>
        ${item.type!=='opening'?`<label class="field"><span>Высота, м</span><input data-plan-field="height" type="number" min="0.5" max="5" step="0.01" inputmode="decimal" value="${Number(item.height)||1.8}" /></label>`:''}
        ${item.type!=='opening'?`<label class="field plan-field-wide"><span>Материал</span><select data-plan-field="material">${materialOptions(item.material,item.type)}</select></label>`:''}
        ${item.type==='gate'?`<label class="field plan-field-wide"><span>Тип ворот</span><select data-plan-field="gateKind"><option value="swing" ${item.gateKind!=='sliding'?'selected':''}>Распашные</option><option value="sliding" ${item.gateKind==='sliding'?'selected':''}>Откатные</option></select></label>`:''}
      </div>`;
  }
  const index=(line.items || []).findIndex(value=>value.id===item.id);
  $('#movePlanItemLeftBtn').disabled=index<=0;
  $('#movePlanItemRightBtn').disabled=index<0 || index>=line.items.length-1;
}

function selectPlanItem(id) {
  activePlanItemId=id;
  activeInsertIndex=null;
  $('#insertPanel').hidden=true;
  renderPlanEditor();
}

function showInsertPanel(index) {
  activeInsertIndex=Number(index);
  activePlanItemId='';
  $('#planEditor').hidden=true;
  $('#insertPanel').hidden=false;
  $('#insertPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  const line=currentPlanLine();
  if(line){ renderPlanCanvas(line); renderPlanItems(line); }
}

function addPlanItem(type) {
  const line=currentPlanLine();
  if(!line || !PLAN_ITEM_TYPES[type]) return;
  const index=Number.isInteger(activeInsertIndex)?Math.max(0,Math.min(line.items.length,activeInsertIndex)):line.items.length;
  const item=newItem(type);
  line.items.splice(index,0,item);
  activePlanItemId=item.id;
  activeInsertIndex=null;
  $('#insertPanel').hidden=true;
  renderPlanEditor();
}

function movePlanItem(direction) {
  const line=currentPlanLine(), item=currentPlanItem();
  if(!line || !item) return;
  const from=line.items.findIndex(value=>value.id===item.id);
  const to=from+direction;
  if(from<0 || to<0 || to>=line.items.length) return;
  [line.items[from],line.items[to]]=[line.items[to],line.items[from]];
  renderPlanEditor();
}

function deletePlanItem() {
  const line=currentPlanLine(), item=currentPlanItem();
  if(!line || !item) return;
  line.items=line.items.filter(value=>value.id!==item.id);
  activePlanItemId='';
  renderPlanEditor();
}

function addPlanLine() {
  const lines=activePlanConfiguration?.sitePlan?.lines;
  if(!lines) return;
  const line=newLine([],lines.length);
  lines.push(line);
  activePlanLineId=line.id;
  activePlanItemId='';
  renderPlanEditor();
}

function deletePlanLine() {
  const lines=activePlanConfiguration?.sitePlan?.lines;
  if(!lines || lines.length<=1) return showToast('В схеме должна остаться хотя бы одна линия');
  const index=lines.findIndex(line=>line.id===activePlanLineId);
  if(index<0) return;
  lines.splice(index,1);
  activePlanLineId=lines[Math.max(0,index-1)]?.id || lines[0]?.id || '';
  activePlanItemId='';
  renderPlanEditor();
}

async function savePlan() {
  const survey=await idbGet('surveys',activePlanSurveyId);
  if(!survey || !activePlanConfiguration) return;
  survey.configuration=activePlanConfiguration;
  survey.updatedAt=new Date().toISOString();
  survey.syncState=API_ENABLED?'pending':'local';
  survey.schemaVersion=3;
  await idbPut('surveys',survey);
  $('#planDialog').close();
  showToast('Схема сохранена');
  if($('#surveyDetailsDialog').open) $('#surveyDetailsDialog').close();
  await openSurveyDetails(survey.id);
  if(API_ENABLED && navigator.onLine) syncNow({silent:true});
}


function surveyCalculations(survey) {
  const rows = survey?.configuration?.calculations;
  return Array.isArray(rows) ? rows : [];
}
function surveyCalculationsTotal(survey) {
  return surveyCalculations(survey).reduce((sum,item)=>sum+(Number(item.total)||0),0);
}
function calculationTypeLabel(type) {
  return type === 'gates' ? 'Ворота' : type === 'fence' ? 'Забор' : type === 'canopy' ? 'Навес' : 'Расчёт';
}
function calcNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? trimNumber(number) : '';
}
function tubeLabel(value) {
  return String(value || '').trim().replace(/[xх*]/gi, '×');
}
function calculationCardDetails(item) {
  const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
  const config = payload.configuration && typeof payload.configuration === 'object' ? payload.configuration : {};
  const fallback = { title:item.title || calculationTypeLabel(item.type), lines:item.summary ? [item.summary] : [], tags:[] };

  if (item.type === 'gates') {
    const article = payload.article || config.article || '';
    const width = payload.width ?? config.width;
    const height = payload.height ?? config.height;
    const wicketWidth = payload.wicketWidth ?? config.wicketWidth;
    const wicketHeight = payload.wicketHeight ?? config.wicketHeight;
    const lines = [];
    if (Number(width) > 0 && Number(height) > 0) lines.push(`Ворота ${calcNumber(width)} × ${calcNumber(height)} м`);
    if (Number(wicketWidth) > 0 && Number(wicketHeight) > 0) lines.push(`Калитка ${calcNumber(wicketWidth)} × ${calcNumber(wicketHeight)} м`);
    const tags = [
      payload.posts ?? config.posts ? 'Новые усиленные столбы' : 'Готовые столбы',
      payload.city ? `Доставка: ${payload.city}` : (payload.deliveryPending ? 'Доставка не рассчитана' : '')
    ].filter(Boolean);
    return {
      title: article ? `Ворота с калиткой · ${article}` : (item.title || 'Ворота с калиткой'),
      lines: lines.length ? lines : fallback.lines,
      tags
    };
  }

  if (item.type === 'fence') {
    const summary = config.summary && typeof config.summary === 'object' ? config.summary : {};
    const sections = Array.isArray(config.sections) ? config.sections : [];
    const heights = [...new Set(sections.map(section => calcNumber(section?.height)).filter(Boolean))];
    const totalLength = Number(summary.totalLength);
    const totalSpans = Number(summary.totalSpans);
    const newPosts = Number(summary.newPosts);
    const existingPosts = Number(summary.existingPostsUsed ?? config.existingPostsCount);
    const lines = [];
    if (totalLength > 0) {
      const sectionText = sections.length ? ` · ${sections.length} ${plural(sections.length,['участок','участка','участков'])}` : '';
      lines.push(`Длина ${calcNumber(totalLength)} м${sectionText}`);
    }
    const construction = [
      heights.length ? `Высота ${heights.join(' / ')} м` : '',
      config.postType ? `Столбы ${tubeLabel(config.postType)}` : ''
    ].filter(Boolean).join(' · ');
    if (construction) lines.push(construction);
    const postText = config.includeNewPosts === false
      ? 'Столбы заказчика'
      : newPosts > 0
        ? `Новых столбов: ${newPosts}${existingPosts > 0 ? ` · готовых: ${existingPosts}` : ''}`
        : existingPosts > 0 ? `Готовых столбов: ${existingPosts}` : '';
    const tags = [
      config.fenceTypeLabel || '',
      totalSpans > 0 ? `${totalSpans} ${plural(totalSpans,['пролёт','пролёта','пролётов'])}` : '',
      postText,
      config.delivery?.name ? `Доставка: ${config.delivery.name}` : ''
    ].filter(Boolean);
    return { title:item.title || 'Забор из евроштакетника', lines:lines.length ? lines : fallback.lines, tags };
  }

  if (item.type === 'canopy') {
    const snap = config.canopy && typeof config.canopy === 'object' ? config.canopy : {};
    const input = snap.input && typeof snap.input === 'object' ? snap.input : {};
    const lines = [];
    if (Number(input.widthPostsM) > 0 && Number(input.lengthM) > 0) {
      lines.push(`Размер ${calcNumber(input.widthPostsM)} × ${calcNumber(input.lengthM)} м${Number(input.visibleHeightM) > 0 ? ` · высота ${calcNumber(input.visibleHeightM)} м` : ''}`);
    }
    const truss = [
      input.materialMode ? `ферма ${tubeLabel(input.materialMode)}` : '',
      input.trussType ? `обрешётка ${input.trussType.toLowerCase()}` : ''
    ].filter(Boolean).join(' · ');
    if (truss) lines.push(truss);
    const support = [];
    if (Number(input.existingPosts) > 0) support.push(`готовые столбы: ${Number(input.existingPosts)}`);
    else if (input.postsNeeded !== false) support.push('новые столбы');
    if (input.beamsExisting) support.push('балки уже есть');
    if (input.paint === false) support.push('без покраски');
    else if (input.paint === true) support.push('с покраской');
    const tags = [
      input.farmType || '',
      input.coverage || '',
      input.installType || '',
      support.join(' · ')
    ].filter(Boolean);
    return { title:item.title || (input.farmType ? `${input.farmType} навес` : 'Навес'), lines:lines.length ? lines : fallback.lines, tags };
  }

  return fallback;
}
function calculationsHtml(survey) {
  const rows = surveyCalculations(survey);
  const total = surveyCalculationsTotal(survey);
  return `<div class="details-section calculation-section">
    <div class="section-head compact">
      <div><h3>Расчёты</h3><p class="muted">${rows.length ? rows.length+' '+plural(rows.length,['объект','объекта','объектов']) : 'Добавьте расчёт прямо с объекта.'}</p></div>
      ${rows.length ? `<strong class="calculation-grand-total">${formatMoney(total)}</strong>` : ''}
    </div>
    <div class="calculation-list">
      ${rows.map(item=>{
        const details = calculationCardDetails(item);
        return `<article class="calculation-card calculation-card-${escapeHtml(item.type)}" data-edit-calculation="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Изменить расчёт: ${escapeHtml(details.title)}">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : `<div class="calculation-card-icon ${escapeHtml(item.type)}">${item.type==='gates'?'▰':item.type==='fence'?'▥':'⌒'}</div>`}
          <div class="calculation-card-copy">
            <small>${escapeHtml(calculationTypeLabel(item.type))}</small>
            <b>${escapeHtml(details.title)}</b>
            ${details.lines.length ? `<div class="calculation-card-lines">${details.lines.map(line=>`<span>${escapeHtml(line)}</span>`).join('')}</div>` : ''}
            ${details.tags.length ? `<div class="calculation-card-tags">${details.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="calculation-card-price">
            <b>${formatMoney(item.total)}</b>
            <div class="calculation-card-actions">
              <button type="button" class="calculation-edit-btn" data-edit-calculation-button="${escapeHtml(item.id)}">Изменить</button>
              <button type="button" class="calculation-delete-btn" data-delete-calculation="${escapeHtml(item.id)}" aria-label="Удалить расчёт">×</button>
            </div>
          </div>
        </article>`;
      }).join('') || '<div class="calculation-empty">Пока нет сохранённых расчётов.</div>'}
    </div>
    <button class="btn btn-primary btn-block" data-add-calculation="${survey.id}" type="button">+ Добавить расчёт</button>
  </div>`;
}
function openCalculationPicker(surveyId) {
  activeCalculationSurveyId = surveyId;
  $('#calculationPickerDialog')?.showModal();
}
function launchCalculation(type, options = {}) {
  const surveyId = options.surveyId || activeCalculationSurveyId;
  if (!surveyId) return;
  const root = new URL('../', location.href);
  let url;
  if (type === 'fence') url = new URL('evroshtaketnik/', root);
  else if (type === 'canopy') url = new URL('naves/', root);
  else url = new URL(root.href);
  if (type === 'gates') url.searchParams.set('app','1');
  url.searchParams.set('surveyor','1');
  url.searchParams.set('survey',surveyId);
  if (options.editId) url.searchParams.set('edit', options.editId);
  url.searchParams.set('returnTo', location.pathname);
  location.href = url.href;
}
async function editCalculation(surveyId, calculationId) {
  const survey = await idbGet('surveys', surveyId);
  const item = surveyCalculations(survey).find(row => row.id === calculationId);
  if (!survey || !item) return showToast('Расчёт не найден');
  try {
    localStorage.setItem(CALC_EDIT_KEY, JSON.stringify({
      version:1,
      surveyId,
      calculationId:item.id,
      calculation:item
    }));
  } catch {
    return showToast('Не удалось открыть расчёт для изменения');
  }
  launchCalculation(item.type, {surveyId, editId:item.id});
}
async function deleteCalculation(surveyId, calculationId) {
  const survey = await idbGet('surveys', surveyId);
  if (!survey) return;
  survey.configuration = survey.configuration && typeof survey.configuration === 'object' ? survey.configuration : {};
  survey.configuration.calculations = surveyCalculations(survey).filter(item => item.id !== calculationId);
  survey.updatedAt = new Date().toISOString();
  survey.syncState = API_ENABLED ? 'pending' : 'local';
  await idbPut('surveys', survey);
  showToast('Расчёт удалён');
  await renderSurveys();
  if ($('#surveyDetailsDialog').open) {
    $('#surveyDetailsDialog').close();
    await openSurveyDetails(surveyId);
  }
  if (API_ENABLED && navigator.onLine) syncNow({silent:true});
}
async function consumeCalculationTransfer() {
  let transfer = null;
  try { transfer = JSON.parse(localStorage.getItem(CALC_TRANSFER_KEY) || 'null'); } catch {}
  if (!transfer?.surveyId || !transfer?.calculation?.id) return '';
  const survey = await idbGet('surveys', transfer.surveyId);
  if (!survey) return '';
  survey.configuration = survey.configuration && typeof survey.configuration === 'object' ? survey.configuration : {};
  const rows = Array.isArray(survey.configuration.calculations) ? survey.configuration.calculations : [];
  const existingIndex = rows.findIndex(item => item.id === transfer.calculation.id);
  if (existingIndex >= 0) rows[existingIndex] = transfer.calculation;
  else rows.push(transfer.calculation);
  survey.configuration.calculations = rows;
  const workType = transfer.calculation.type === 'gates' ? 'gates' : transfer.calculation.type === 'fence' ? 'fence' : transfer.calculation.type === 'canopy' ? 'canopy' : '';
  if (workType && !survey.workTypes.includes(workType)) survey.workTypes.push(workType);
  survey.updatedAt = new Date().toISOString();
  survey.syncState = API_ENABLED ? 'pending' : 'local';
  survey.schemaVersion = Math.max(4, Number(survey.schemaVersion)||0);
  await idbPut('surveys', survey);
  try { localStorage.removeItem(CALC_TRANSFER_KEY); } catch {}
  showToast('Расчёт добавлен в замер');
  if (API_ENABLED && navigator.onLine) syncNow({silent:true});
  return survey.id;
}

async function openSurveyDetails(id) {
  const survey = await idbGet('surveys', id);
  if (!survey) return;
  $('#detailsNumber').textContent = displaySurveyNumber(survey);
  $('#surveyDetailsContent').innerHTML = `
    <div class="details-grid">
      <div class="detail-box"><small>Клиент</small><b>${escapeHtml(survey.clientName || 'Имя не требуется до договора')}</b></div>
      <div class="detail-box"><small>Телефон</small><b>${escapeHtml(survey.clientPhone)}</b></div>
      <div class="detail-box"><small>Статус</small><b>${survey.status === 'ready' ? 'Готов' : 'Черновик'}</b></div>
      <div class="detail-box"><small>Замерщик</small><b>${escapeHtml(survey.createdByName)}</b></div>
    </div>
    <button class="btn btn-secondary btn-block details-edit-data" data-edit-survey-data="${survey.id}" type="button">✎ Изменить данные</button>
    <div class="details-section"><h3>Адрес объекта</h3><div class="details-note">${escapeHtml(survey.address)}</div></div>
    ${workTypesEditorHtml(survey)}
    ${survey.note ? `<div class="details-section"><h3>Комментарий</h3><div class="details-note">${escapeHtml(survey.note)}</div></div>` : ''}
    ${calculationsHtml(survey)}
    ${survey.syncState === 'conflict' ? '<div class="details-section"><div class="notice notice-lock">Есть более новая версия этого замера на сервере. Пока данные не затираются автоматически.</div></div>' : ''}
    ${surveyPlanSummaryHtml(survey)}
    ${currentUser.role === 'owner' ? `<button class="btn btn-danger btn-block" data-archive-survey="${survey.id}" type="button">Архивировать заказ</button>` : ''}`;
  $('#surveyDetailsDialog').showModal();
  $('[data-archive-survey]')?.addEventListener('click', () => archiveSurvey(survey.id));
  $('[data-edit-survey-data]')?.addEventListener('click', () => openSurveyDataDialog(survey.id));
  $('[data-edit-plan]')?.addEventListener('click', () => openPlanEditor(survey.id));
  $('[data-save-work-types]')?.addEventListener('click', () => saveSurveyWorkTypes(survey.id));
  $('[data-add-calculation]')?.addEventListener('click', () => openCalculationPicker(survey.id));
  const detailsRoot = $('#surveyDetailsContent');
  $$('[data-edit-calculation]', detailsRoot).forEach(card => {
    const openEdit = event => {
      if (event?.target?.closest?.('[data-delete-calculation]')) return;
      if (event?.type === 'keydown' && !['Enter',' '].includes(event.key)) return;
      event?.preventDefault?.();
      editCalculation(survey.id, card.dataset.editCalculation);
    };
    card.addEventListener('click', openEdit);
    card.addEventListener('keydown', openEdit);
  });
  $$('[data-delete-calculation]', detailsRoot).forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    deleteCalculation(survey.id, button.dataset.deleteCalculation);
  }));
}

async function archiveSurvey(id) {
  if (currentUser.role !== 'owner') return;
  const survey = await idbGet('surveys', id);
  if (!survey) return;
  survey.archived = true;
  survey.updatedAt = new Date().toISOString();
  survey.syncState = API_ENABLED ? 'pending' : 'local';
  await idbPut('surveys', survey);
  $('#surveyDetailsDialog').close();
  showToast('Заказ перемещён в архив');
  renderSurveys();
  if (API_ENABLED && navigator.onLine) syncNow({ silent:true });
}

async function saveClientFromDialog() {
  const name = $('#clientNameInput').value.trim();
  const phone = $('#clientPhoneInput').value.trim();
  const address = $('#clientAddressInput').value.trim();
  if (phone.replace(/\D/g,'').length < 10) return showToast('Заполните телефон');
  await upsertClient({ name, phone, address });
  $('#clientDialog').close();
  $('#clientForm').reset();
  showToast('Клиент сохранён');
  renderClients($('#clientSearch').value);
  if (API_ENABLED && navigator.onLine) syncNow({ silent:true });
}

async function openEmployeeDialog(id = '') {
  if (currentUser.role !== 'owner') return;
  $('#employeeForm').reset();
  $('#employeeIdInput').value = id;
  if (id) {
    const emp = await idbGet('employees', id);
    if (!emp) return;
    $('#employeeNameInput').value = emp.name || '';
    $('#employeeLoginInput').value = emp.login || '';
    $('#employeeRoleInput').value = emp.role || 'surveyor';
    $('#employeePasswordInput').placeholder = 'Оставьте пустым, чтобы не менять';
  } else {
    $('#employeePasswordInput').placeholder = API_ENABLED ? 'Минимум 6 символов' : 'Минимум 4 символа';
  }
  $('#employeeDialog').showModal();
}

async function saveEmployeeLocal() {
  const id = $('#employeeIdInput').value;
  const name = $('#employeeNameInput').value.trim();
  const loginValue = $('#employeeLoginInput').value.trim().toLowerCase();
  const role = $('#employeeRoleInput').value;
  const password = $('#employeePasswordInput').value;
  if (!name || !loginValue) return showToast('Заполните имя и логин');
  const employees = await idbGetAll('employees');
  if (employees.some(x => String(x.login||'').toLowerCase() === loginValue && x.id !== id)) return showToast('Такой логин уже используется');
  let employee = id ? await idbGet('employees', id) : null;
  if (!employee) employee = { id: makeId('emp'), active: true, createdAt: new Date().toISOString() };
  if (!id && password.length < 4) return showToast('Для нового сотрудника задайте пароль от 4 символов');
  employee.name = name; employee.login = loginValue; employee.role = role; employee.updatedAt = new Date().toISOString();
  if (password) {
    if (password.length < 4) return showToast('Пароль должен быть не короче 4 символов');
    const hashed = await hashPassword(password);
    employee.passwordSalt = hashed.salt; employee.passwordHash = hashed.hash;
  }
  await idbPut('employees', employee);
  $('#employeeDialog').close();
  showToast('Доступ сотрудника сохранён');
  renderEmployees();
}

async function saveEmployee() {
  if (currentUser.role !== 'owner') return;
  if (!API_ENABLED) return saveEmployeeLocal();
  if (!navigator.onLine) return showToast('Изменение сотрудников требует интернет');
  const id = $('#employeeIdInput').value;
  const cached = id ? await idbGet('employees', id) : null;
  const payload = {
    numericId: Number(cached?.numericId || 0),
    name: $('#employeeNameInput').value.trim(),
    login: $('#employeeLoginInput').value.trim().toLowerCase(),
    role: $('#employeeRoleInput').value,
    password: $('#employeePasswordInput').value
  };
  if (!payload.name || !payload.login) return showToast('Заполните имя и логин');
  if (!payload.numericId && payload.password.length < 6) return showToast('Для нового сотрудника задайте пароль от 6 символов');
  try {
    await apiRequest('/users', { method:'POST', body:JSON.stringify(payload) });
    $('#employeeDialog').close();
    showToast('Доступ сотрудника сохранён на сервере');
    await renderEmployees();
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить сотрудника');
  }
}

async function toggleEmployee(id) {
  if (currentUser.role !== 'owner' || id === currentUser.id) return;
  const employee = await idbGet('employees', id);
  if (!employee) return;
  if (!API_ENABLED) {
    employee.active = !employee.active;
    employee.updatedAt = new Date().toISOString();
    await idbPut('employees', employee);
    showToast(employee.active ? 'Доступ включён' : 'Доступ отключён');
    return renderEmployees();
  }
  if (!navigator.onLine) return showToast('Изменение доступа требует интернет');
  try {
    const result = await apiRequest(`/users/${Number(employee.numericId)}/toggle`, { method:'POST', body:'{}' });
    employee.active = !!result.active;
    await idbPut('employees', employee);
    showToast(employee.active ? 'Доступ включён' : 'Доступ отключён');
    renderEmployees();
  } catch (error) {
    showToast(error.message || 'Не удалось изменить доступ');
  }
}

function resetSurveyWizard() {
  $('#surveyForm').reset();
}

async function bootstrap() {
  db = await openDb();
  await seedDatabase();
  currentUser = await restoreSession();
  bindEvents();
  updateNetworkState();
  if (currentUser) {
    const returnedSurveyId = await consumeCalculationTransfer();
    showMain();
    if (returnedSurveyId) setTimeout(() => openSurveyDetails(returnedSurveyId), 0);
    if (API_ENABLED && navigator.onLine) syncNow({ silent:true });
  } else {
    showLogin();
  }
  registerServiceWorker();
}
function showLogin() {
  $('#loginView').hidden = false;
  $('#mainView').hidden = true;
  setTimeout(() => $('#loginInput').focus(), 80);
}
function showMain() {
  $('#loginView').hidden = true;
  $('#mainView').hidden = false;
  if (/\/dev-tools(?:\/|$)/.test(location.pathname)) {
    try { localStorage.setItem(DEV_ACCESS_KEY, '1'); } catch {}
  }
  applyRoleUi();
  switchScreen('surveys');
}
async function logout() {
  if (API_ENABLED && navigator.onLine && await metaGet('serverToken','')) {
    try { await apiRequest('/logout', { method:'POST', body:'{}' }); } catch {}
  }
  await metaDelete('serverToken');
  clearSession();
  try { localStorage.removeItem(DEV_ACCESS_KEY); } catch {}
  currentUser = null;
  showLogin();
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginError').hidden = true;
    try {
      const user = await login($('#loginInput').value, $('#passwordInput').value);
      if (!user) {
        $('#loginError').textContent = navigator.onLine ? 'Неверный логин или пароль.' : 'Офлайн-вход доступен только после успешного входа на этом телефоне.';
        $('#loginError').hidden = false;
        return;
      }
      currentUser = user;
      saveSession(user);
      $('#loginForm').reset();
      const returnedSurveyId = await consumeCalculationTransfer();
      showMain();
      if (returnedSurveyId) setTimeout(() => openSurveyDetails(returnedSurveyId), 0);
      if (lastSyncMessage) showToast(lastSyncMessage);
      if (API_ENABLED && navigator.onLine) syncNow({ silent:true });
    } catch (error) {
      $('#loginError').textContent = error.message || 'Не удалось выполнить вход.';
      $('#loginError').hidden = false;
    }
  });
  window.addEventListener('online', () => { updateNetworkState(); if (currentUser) syncNow({ silent:true }); });
  window.addEventListener('offline', updateNetworkState);
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => btn.dataset.screen && switchScreen(btn.dataset.screen)));
  $('#teamNavBtn')?.addEventListener('click', () => switchScreen('team'));
  $('#profileBtn').addEventListener('click', () => switchScreen('settings'));
  $('#logoutBtn').addEventListener('click', logout);
  $('#syncNowBtn')?.addEventListener('click', () => syncNow({ silent:false }));
  $('#openTeamBtn')?.addEventListener('click', () => switchScreen('team'));
  $('#newSurveyBtn').addEventListener('click', () => { resetSurveyWizard(); $('#surveyDialog').showModal(); });
  $('#saveSurveyBtn').addEventListener('click', async () => {
    const phone = $('#surveyClientPhone').value.replace(/\D/g,'');
    const address = $('#surveyAddress').value.trim();
    if (phone.length < 10 || !address) return showToast('Заполните телефон и адрес объекта');
    const survey = await createSurvey({
      name: '',
      phone: $('#surveyClientPhone').value,
      address,
      note: $('#surveyNote').value,
      workTypes: []
    });
    $('#surveyDialog').close();
    showToast(`${displaySurveyNumber(survey)} создан`);
    renderSurveys();
  });
  $('#surveyClientPhone').addEventListener('input', e => { e.target.value = formatPhone(e.target.value); });
  $('#clientPhoneInput').addEventListener('input', e => { e.target.value = formatPhone(e.target.value); });
  $('#newClientBtn').addEventListener('click', () => { $('#clientForm').reset(); $('#clientDialog').showModal(); });
  $('#saveClientBtn').addEventListener('click', saveClientFromDialog);
  $('#clientSearch').addEventListener('input', e => renderClients(e.target.value));
  $('#newEmployeeBtn').addEventListener('click', () => openEmployeeDialog());
  $('#saveEmployeeBtn').addEventListener('click', saveEmployee);
  $('#closeDetailsBtn').addEventListener('click', () => $('#surveyDetailsDialog').close());
  $('#closeCalculationPickerBtn')?.addEventListener('click', () => $('#calculationPickerDialog')?.close());
  $('#calculationPickerDialog')?.addEventListener('click', event => {
    const button = event.target.closest('[data-launch-calculation]');
    if (!button) return;
    launchCalculation(button.dataset.launchCalculation);
  });
  $('#closePlanBtn').addEventListener('click', () => $('#planDialog').close());
  $('#addPlanLineBtn').addEventListener('click', addPlanLine);
  $('#deletePlanLineBtn').addEventListener('click', deletePlanLine);
  $('#savePlanBtn').addEventListener('click', savePlan);
  $('#cancelInsertBtn').addEventListener('click', () => { activeInsertIndex=null; $('#insertPanel').hidden=true; });
  $('#closePlanEditorBtn').addEventListener('click', () => { activePlanItemId=''; renderPlanEditor(); });
  $('#movePlanItemLeftBtn').addEventListener('click', () => movePlanItem(-1));
  $('#movePlanItemRightBtn').addEventListener('click', () => movePlanItem(1));
  $('#deletePlanItemBtn').addEventListener('click', deletePlanItem);
  $('#planLineName').addEventListener('input', e => {
    const line=currentPlanLine();
    if(!line) return;
    line.name=e.target.value.slice(0,80);
    renderPlanCanvas(line);
    $('#planLineTabs').querySelector('[data-plan-line="'+line.id+'"]')?.replaceChildren(document.createTextNode(line.name || 'Линия'));
  });
  $('#planLineTabs').addEventListener('click', e => {
    const button=e.target.closest('[data-plan-line]');
    if(!button) return;
    activePlanLineId=button.dataset.planLine;
    activePlanItemId='';
    activeInsertIndex=null;
    $('#insertPanel').hidden=true;
    renderPlanEditor();
  });
  $('#planItems').addEventListener('click', e => {
    const insert=e.target.closest('[data-plan-insert]');
    if(insert) return showInsertPanel(Number(insert.dataset.planInsert));
    const row=e.target.closest('[data-select-plan-item]');
    if(row) selectPlanItem(row.dataset.selectPlanItem);
  });
  $('#planCanvas').addEventListener('click', e => {
    const part=e.target.closest('[data-select-plan-item]');
    if(part) selectPlanItem(part.dataset.selectPlanItem);
  });
  $('#insertPanel').addEventListener('click', e => {
    const button=e.target.closest('[data-add-plan-item]');
    if(button) addPlanItem(button.dataset.addPlanItem);
  });
  $('#planEditorFields').addEventListener('change', e => {
    const field=e.target.dataset.planField;
    const item=currentPlanItem();
    if(!field || !item) return;
    let value=e.target.value;
    if(field==='width') value=Math.max(.1,Math.min(100,Number(value)||.1));
    if(field==='height') value=Math.max(.5,Math.min(5,Number(value)||.5));
    item[field]=value;
    renderPlanEditor();
  });
  $$('[data-survey-filter]').forEach(btn => btn.addEventListener('click', () => {
    currentSurveyFilter = btn.dataset.surveyFilter;
    $$('[data-survey-filter]').forEach(x => x.classList.toggle('active', x === btn));
    renderSurveys();
  }));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const inDevShell = /\/dev-tools(?:\/|$)/.test(location.pathname);
    const registration = await navigator.serviceWorker.register(
      inDevShell ? '../site-sw.js' : './sw.js',
      inDevShell ? {scope:'../', updateViaCache:'none'} : {updateViaCache:'none'}
    );
    try { await registration.update(); } catch {}
  } catch (e) {
    console.warn('SW registration failed', e);
  }
}

bootstrap().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif"><h2>Не удалось запустить приложение</h2><pre>${escapeHtml(err?.message || String(err))}</pre></div>`;
});
