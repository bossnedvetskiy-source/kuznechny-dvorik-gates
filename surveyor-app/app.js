const APP_VERSION = '0.3.0';
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
let activeLayoutSurveyId = '';
let pendingInsertIndex = 0;

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

async function upsertClient({ name, phone, address = '' }) {
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
    address: data.address.trim(), note: data.note.trim(), workTypes: [...data.workTypes],
    status: 'draft', createdBy: currentUser.id, createdByName: currentUser.name,
    createdAt: now, updatedAt: now, syncState: API_ENABLED ? 'pending' : 'local',
    serverRevision: 0, archived: false, layout: null, schemaVersion: 3
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
    status: server.status || 'draft',
    archived: !!server.archived,
    createdBy: server.createdBy || existing.createdBy || '',
    createdByName: server.createdByName || existing.createdByName || '',
    serverRevision: Number(server.serverRevision || 0),
    updatedAt: server.updatedAt || existing.updatedAt || new Date().toISOString(),
    createdAt: parseServerDate(server.createdAt) || existing.createdAt || new Date().toISOString(),
    serverUpdatedAt: parseServerDate(server.serverUpdatedAt),
    layout: server.layout || existing.layout || null,
    syncState: 'synced',
    serverConflict: null,
    schemaVersion: 3
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
        workTypes:x.workTypes,status:x.status,archived:!!x.archived,createdByName:x.createdByName,
        updatedAt:x.updatedAt,serverRevision:Number(x.serverRevision||0),layout:x.layout || null
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
  $('#teamNavBtn').classList.toggle('hidden', !isOwner);
  if (!isOwner && $('#teamScreen').classList.contains('active')) switchScreen('surveys');
  $('#profileBtn').textContent = (currentUser?.name || 'КД').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
}
function switchScreen(name) {
  const titles = { surveys: 'Замеры', clients: 'Клиенты', team: 'Сотрудники', settings: 'Ещё' };
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
          <div class="card-name">${escapeHtml(survey.clientName)}</div>
          <div class="card-address">${escapeHtml(survey.address)}</div>
        </div>
        <span class="status-pill ${survey.status}">${survey.status === 'ready' ? 'Готов' : 'Черновик'}</span>
      </div>
      <div class="badge-row">${survey.workTypes.map(type => `<span class="type-badge ${WORK_TYPES[type]?.className || ''}">${WORK_TYPES[type]?.short || type}</span>`).join('')}</div>
      <div class="sync-row"><span>${formatDate(survey.updatedAt)}</span><span class="${syncClass(survey.syncState)}">${syncLabel(survey.syncState)}</span></div>
    </article>`).join('');
  $('#surveyEmpty').hidden = surveys.length > 0;
  $$('.survey-card', list).forEach(card => card.addEventListener('click', () => openSurveyDetails(card.dataset.surveyId)));
}

async function renderClients(query = '') {
  const q = query.trim().toLowerCase();
  let clients = (await idbGetAll('clients')).sort((a,b) => String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if (q) clients = clients.filter(x => `${x.name} ${x.phone} ${x.address}`.toLowerCase().includes(q));
  $('#clientList').innerHTML = clients.map(client => `
    <article class="client-card">
      <div class="client-main"><div class="client-name">${escapeHtml(client.name)}</div><div class="client-meta">${escapeHtml(client.address || 'Адрес не указан')}</div></div>
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

async function openSurveyDetails(id) {
  const survey = await idbGet('surveys', id);
  if (!survey) return;
  $('#detailsNumber').textContent = displaySurveyNumber(survey);
  $('#surveyDetailsContent').innerHTML = `
    <div class="details-grid">
      <div class="detail-box"><small>Клиент</small><b>${escapeHtml(survey.clientName)}</b></div>
      <div class="detail-box"><small>Телефон</small><b>${escapeHtml(survey.clientPhone)}</b></div>
      <div class="detail-box"><small>Статус</small><b>${survey.status === 'ready' ? 'Готов' : 'Черновик'}</b></div>
      <div class="detail-box"><small>Замерщик</small><b>${escapeHtml(survey.createdByName)}</b></div>
    </div>
    <div class="details-section"><h3>Адрес объекта</h3><div class="details-note">${escapeHtml(survey.address)}</div></div>
    <div class="details-section"><h3>Что замеряем</h3><div class="badge-row">${survey.workTypes.map(type => `<span class="type-badge ${WORK_TYPES[type]?.className || ''}">${WORK_TYPES[type]?.label || type}</span>`).join('')}</div></div>
    ${survey.note ? `<div class="details-section"><h3>Комментарий</h3><div class="details-note">${escapeHtml(survey.note)}</div></div>` : ''}
    ${survey.syncState === 'conflict' ? '<div class="details-section"><div class="notice notice-lock">Есть более новая версия этого замера на сервере. Пока данные не затираются автоматически.</div></div>' : ''}
    ${survey.workTypes.some(type => type === 'gates' || type === 'fence') ? renderLayoutSummaryCard(survey) : ''}
    ${survey.workTypes.includes('canopy') ? '<div class="details-section"><div class="notice notice-lock">Навес сохранён в этом же заказе. Его отдельный замер подключим следующим модулем конструктора.</div></div>' : ''}
    ${currentUser.role === 'owner' ? `<button class="btn btn-danger btn-block" data-archive-survey="${survey.id}" type="button">Архивировать заказ</button>` : ''}`;
  $('#surveyDetailsDialog').showModal();
  $('[data-archive-survey]')?.addEventListener('click', () => archiveSurvey(survey.id));
  $('[data-open-layout]')?.addEventListener('click', () => openLayoutEditor(survey.id));
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
  if (!name || phone.replace(/\D/g,'').length < 10) return showToast('Заполните имя и телефон');
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


const SEGMENT_LABELS = { fence:'Забор', gate:'Ворота', wicket:'Калитка', opening:'Проём' };
const MATERIAL_LABELS = { profsheet:'Профнастил', picket:'Евроштакетник', forged:'Кованые', frame:'Каркас', other:'Другое' };

function newBoundary() {
  return { id:makeId('post'), kind:'new', profile:'100×100×3', note:'' };
}
function newLayoutLine(index = 0) {
  return { id:makeId('line'), name:`Линия ${index + 1}`, segments:[], boundaries:[newBoundary()] };
}
function defaultSegment(type = 'fence') {
  const presets = {
    fence:{widthMm:2500,heightMm:1800,material:'profsheet'},
    gate:{widthMm:3400,heightMm:1800,material:'forged',gateType:'swing'},
    wicket:{widthMm:1000,heightMm:1800,material:'forged'},
    opening:{widthMm:1000,heightMm:0,material:''}
  };
  return {
    id:makeId('seg'), type, ...(presets[type] || presets.fence),
    fillColor:'', frameColor:'', note:''
  };
}
function normalizeLayoutLine(line, index) {
  const normalized = line && typeof line === 'object' ? line : newLayoutLine(index);
  normalized.id ||= makeId('line');
  normalized.name ||= `Линия ${index + 1}`;
  normalized.segments = Array.isArray(normalized.segments) ? normalized.segments : [];
  normalized.boundaries = Array.isArray(normalized.boundaries) ? normalized.boundaries : [];
  while (normalized.boundaries.length < normalized.segments.length + 1) normalized.boundaries.push(newBoundary());
  if (normalized.boundaries.length > normalized.segments.length + 1) normalized.boundaries.length = normalized.segments.length + 1;
  if (!normalized.boundaries.length) normalized.boundaries.push(newBoundary());
  for (const boundary of normalized.boundaries) {
    boundary.id ||= makeId('post');
    boundary.kind = ['new','existing','none'].includes(boundary.kind) ? boundary.kind : 'new';
    boundary.profile ||= '100×100×3';
    boundary.note ||= '';
  }
  for (const segment of normalized.segments) {
    segment.id ||= makeId('seg');
    segment.type = ['fence','gate','wicket','opening'].includes(segment.type) ? segment.type : 'fence';
    segment.widthMm = Math.max(100, Number(segment.widthMm) || 1000);
    segment.heightMm = segment.type === 'opening' ? 0 : Math.max(100, Number(segment.heightMm) || 1800);
    segment.material ||= segment.type === 'opening' ? '' : 'profsheet';
    segment.fillColor ||= '';
    segment.frameColor ||= '';
    segment.note ||= '';
  }
  return normalized;
}
function ensureSurveyLayout(survey) {
  if (!survey.layout || typeof survey.layout !== 'object') survey.layout = {version:1,lines:[newLayoutLine(0)]};
  survey.layout.version = 1;
  survey.layout.lines = Array.isArray(survey.layout.lines) && survey.layout.lines.length ? survey.layout.lines : [newLayoutLine(0)];
  survey.layout.lines = survey.layout.lines.map(normalizeLayoutLine);
  return survey.layout;
}
function layoutTotalMm(line) {
  return (line.segments || []).reduce((sum, segment) => sum + Math.max(0, Number(segment.widthMm) || 0), 0);
}
function formatMeters(mm) {
  const value = Math.round((Number(mm) || 0) / 10) / 100;
  return value.toLocaleString('ru-RU',{maximumFractionDigits:2}) + ' м';
}
function boundaryLabel(boundary) {
  if (boundary.kind === 'none') return 'Без столба';
  if (boundary.kind === 'existing') return 'Существ.';
  return boundary.profile || 'Столб';
}
function renderMiniLine(line) {
  if (!line?.segments?.length) return '<div class="muted" style="font-size:12px">Схема ещё не собрана</div>';
  let html = '';
  line.segments.forEach((segment,index) => {
    const boundary = line.boundaries[index];
    html += `<span class="layout-mini-post ${boundary?.kind === 'none' ? 'none' : ''}" title="${escapeHtml(boundaryLabel(boundary || {}))}"></span>`;
    html += `<span class="layout-mini-segment ${segment.type}" style="flex:${Math.max(1,Number(segment.widthMm)||1000)}" title="${escapeHtml(SEGMENT_LABELS[segment.type] || segment.type)}">${escapeHtml(SEGMENT_LABELS[segment.type]?.slice(0,1) || '')}</span>`;
  });
  const last = line.boundaries[line.boundaries.length - 1];
  html += `<span class="layout-mini-post ${last?.kind === 'none' ? 'none' : ''}" title="${escapeHtml(boundaryLabel(last || {}))}"></span>`;
  return html;
}
function renderLayoutSummaryCard(survey) {
  const layout = survey.layout && Array.isArray(survey.layout.lines) ? survey.layout : null;
  const lines = layout?.lines || [];
  const segmentCount = lines.reduce((sum,line) => sum + (line.segments?.length || 0),0);
  const total = lines.reduce((sum,line) => sum + layoutTotalMm(line),0);
  const mini = lines[0]?.segments?.length ? `<div class="layout-preview-mini">${renderMiniLine(lines[0])}</div>` : '';
  return `<div class="layout-section-card">
    <div class="card-top">
      <div><h3>Схема ворот и забора</h3><div class="muted" style="font-size:12px">${segmentCount ? `${segmentCount} ${plural(segmentCount,['элемент','элемента','элементов'])} · ${formatMeters(total)}` : 'Схема пока не собрана'}</div></div>
      <button class="btn btn-secondary" data-open-layout type="button">${segmentCount ? 'Изменить' : 'Собрать схему'}</button>
    </div>
    ${mini}
  </div>`;
}
async function saveLayoutSurvey(survey, {sync = true} = {}) {
  survey.updatedAt = new Date().toISOString();
  survey.schemaVersion = Math.max(3,Number(survey.schemaVersion)||0);
  if (survey.syncState !== 'conflict') survey.syncState = API_ENABLED ? 'pending' : 'local';
  await idbPut('surveys',survey);
  if (sync && API_ENABLED && navigator.onLine && survey.syncState !== 'conflict') queueMicrotask(() => syncNow({silent:true}));
}
function findLayoutLine(survey,lineId) {
  return ensureSurveyLayout(survey).lines.find(line => line.id === lineId) || null;
}
function segmentVisualWidth(segment) {
  return Math.max(76,Math.min(230,Math.round((Number(segment.widthMm)||1000)/20)));
}
function renderBoundary(boundary,lineId) {
  const cls = boundary.kind === 'existing' ? 'existing' : boundary.kind === 'none' ? 'none' : 'new';
  return `<button class="layout-boundary ${cls}" data-edit-post="${boundary.id}" data-line-id="${lineId}" type="button" title="${escapeHtml(boundaryLabel(boundary))}">
    <span class="layout-post-shape"></span><span class="layout-post-label">${escapeHtml(boundaryLabel(boundary))}</span>
  </button>`;
}
function renderSegment(segment,lineId,index) {
  const material = segment.type === 'opening' ? '' : (MATERIAL_LABELS[segment.material] || '');
  return `<button class="layout-segment ${segment.type}" data-edit-segment="${segment.id}" data-line-id="${lineId}" type="button" style="width:${segmentVisualWidth(segment)}px">
    <span class="layout-segment-size">${formatMeters(segment.widthMm)}</span>
    <span class="layout-segment-visual"><span class="layout-segment-label">${escapeHtml(SEGMENT_LABELS[segment.type] || segment.type)}${material ? `<br><small>${escapeHtml(material)}</small>` : ''}</span></span>
  </button>`;
}
function addButton(lineId,index) {
  return `<button class="layout-insert" data-insert-line="${lineId}" data-insert-index="${index}" type="button" aria-label="Добавить элемент">+</button>`;
}
function renderLayoutLine(line,index,totalLines) {
  const total = layoutTotalMm(line);
  const newPosts = line.boundaries.filter(x => x.kind === 'new').length;
  const existingPosts = line.boundaries.filter(x => x.kind === 'existing').length;
  let canvas = '';
  if (!line.segments.length) {
    canvas = `<div class="layout-empty"><div>Добавьте первый элемент этой линии</div><div class="layout-add-grid">
      <button class="layout-add-type" data-add-type="fence" data-line-id="${line.id}" type="button"><span>▥</span>Забор</button>
      <button class="layout-add-type" data-add-type="gate" data-line-id="${line.id}" type="button"><span>▥▥</span>Ворота</button>
      <button class="layout-add-type" data-add-type="wicket" data-line-id="${line.id}" type="button"><span>▯</span>Калитка</button>
      <button class="layout-add-type" data-add-type="opening" data-line-id="${line.id}" type="button"><span>↔</span>Проём</button>
    </div></div>`;
  } else {
    canvas += renderBoundary(line.boundaries[0],line.id) + addButton(line.id,0);
    line.segments.forEach((segment,segmentIndex) => {
      canvas += renderSegment(segment,line.id,segmentIndex);
      canvas += renderBoundary(line.boundaries[segmentIndex + 1],line.id);
      canvas += addButton(line.id,segmentIndex + 1);
    });
  }
  return `<section class="layout-line" data-layout-line="${line.id}">
    <div class="layout-line-head">
      <div class="layout-line-title"><input class="layout-line-name" data-line-name="${line.id}" value="${escapeHtml(line.name)}" aria-label="Название линии" /><small>${line.segments.length ? `Общая длина ${formatMeters(total)}` : 'Пустая линия'}</small></div>
      <div class="layout-line-actions">${totalLines > 1 ? `<button class="mini-btn danger" data-delete-line="${line.id}" type="button">Удалить</button>` : ''}</div>
    </div>
    <div class="layout-canvas-scroll"><div class="layout-canvas">${canvas}</div></div>
    <div class="layout-summary"><span><b>${line.segments.length}</b> пролётов</span><span>Новых столбов: <b>${newPosts}</b></span><span>Существующих: <b>${existingPosts}</b></span></div>
  </section>`;
}
async function renderLayoutEditor() {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  if (!survey) return;
  const layout = ensureSurveyLayout(survey);
  $('#layoutSurveyNumber').textContent = displaySurveyNumber(survey);
  $('#layoutLines').innerHTML = layout.lines.map((line,index) => renderLayoutLine(line,index,layout.lines.length)).join('');
}
async function openLayoutEditor(surveyId) {
  const survey = await idbGet('surveys',surveyId);
  if (!survey) return;
  if (!survey.workTypes.some(type => type === 'gates' || type === 'fence')) return;
  const hadLayout = !!survey.layout;
  ensureSurveyLayout(survey);
  if (!hadLayout) await saveLayoutSurvey(survey,{sync:false});
  activeLayoutSurveyId = surveyId;
  await renderLayoutEditor();
  $('#surveyDetailsDialog').close();
  $('#layoutDialog').showModal();
}
async function reopenSurveyDetailsAfterLayout() {
  const id = activeLayoutSurveyId;
  $('#layoutDialog').close();
  activeLayoutSurveyId = '';
  if (id) await openSurveyDetails(id);
}
function updateSegmentFields() {
  const type = $('#segmentTypeInput').value;
  $('#segmentGateTypeField').classList.toggle('hidden',type !== 'gate');
  $('#segmentMaterialField').classList.toggle('hidden',type === 'opening');
  $('#segmentColorFields').classList.toggle('hidden',type === 'opening');
  const height = $('#segmentHeightInput');
  height.disabled = type === 'opening';
  if (type === 'opening') height.value = '0';
}
async function openSegmentDialog(lineId,segmentId = '',insertIndex = 0,type = 'fence') {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,lineId) : null;
  if (!line) return;
  pendingInsertIndex = Math.max(0,Math.min(line.segments.length,Number(insertIndex)||0));
  const segment = segmentId ? line.segments.find(x => x.id === segmentId) : defaultSegment(type);
  if (!segment) return;
  $('#segmentLineId').value = lineId;
  $('#segmentId').value = segmentId || '';
  $('#segmentDialogTitle').textContent = segmentId ? (SEGMENT_LABELS[segment.type] || 'Пролёт') : 'Новый элемент';
  $('#segmentTypeInput').value = segment.type;
  $('#segmentWidthInput').value = segment.widthMm || 1000;
  $('#segmentHeightInput').value = segment.heightMm || 0;
  $('#segmentGateTypeInput').value = segment.gateType || 'swing';
  $('#segmentMaterialInput').value = segment.material || 'profsheet';
  $('#segmentFillColorInput').value = segment.fillColor || '';
  $('#segmentFrameColorInput').value = segment.frameColor || '';
  $('#segmentNoteInput').value = segment.note || '';
  $('#deleteSegmentBtn').classList.toggle('hidden',!segmentId);
  $('#segmentMoveRow').classList.toggle('hidden',!segmentId);
  if (segmentId) {
    const idx = line.segments.findIndex(x => x.id === segmentId);
    $('#moveSegmentLeftBtn').disabled = idx <= 0;
    $('#moveSegmentRightBtn').disabled = idx < 0 || idx >= line.segments.length - 1;
  }
  updateSegmentFields();
  $('#segmentDialog').showModal();
}
async function saveSegmentFromDialog() {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,$('#segmentLineId').value) : null;
  if (!line) return;
  const type = $('#segmentTypeInput').value;
  const widthMm = Math.round(Number($('#segmentWidthInput').value));
  const heightMm = type === 'opening' ? 0 : Math.round(Number($('#segmentHeightInput').value));
  if (!Number.isFinite(widthMm) || widthMm < 100 || widthMm > 50000) return showToast('Проверьте ширину элемента');
  if (type !== 'opening' && (!Number.isFinite(heightMm) || heightMm < 100 || heightMm > 5000)) return showToast('Проверьте высоту элемента');
  const values = {
    type,widthMm,heightMm,gateType:type === 'gate' ? $('#segmentGateTypeInput').value : '',
    material:type === 'opening' ? '' : $('#segmentMaterialInput').value,
    fillColor:type === 'opening' ? '' : $('#segmentFillColorInput').value.trim(),
    frameColor:type === 'opening' ? '' : $('#segmentFrameColorInput').value.trim(),
    note:$('#segmentNoteInput').value.trim()
  };
  const id = $('#segmentId').value;
  if (id) {
    const segment = line.segments.find(x => x.id === id);
    if (!segment) return;
    Object.assign(segment,values);
  } else {
    const segment = {...defaultSegment(type),...values};
    const index = Math.max(0,Math.min(line.segments.length,pendingInsertIndex));
    line.segments.splice(index,0,segment);
    line.boundaries.splice(index + 1,0,newBoundary());
  }
  await saveLayoutSurvey(survey);
  $('#segmentDialog').close();
  await renderLayoutEditor();
}
async function deleteSegmentFromDialog() {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,$('#segmentLineId').value) : null;
  const id = $('#segmentId').value;
  if (!line || !id) return;
  const index = line.segments.findIndex(x => x.id === id);
  if (index < 0) return;
  line.segments.splice(index,1);
  line.boundaries.splice(index + 1,1);
  normalizeLayoutLine(line,0);
  await saveLayoutSurvey(survey);
  $('#segmentDialog').close();
  await renderLayoutEditor();
}
async function moveActiveSegment(direction) {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,$('#segmentLineId').value) : null;
  const id = $('#segmentId').value;
  if (!line || !id) return;
  const index = line.segments.findIndex(x => x.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= line.segments.length) return;
  [line.segments[index],line.segments[target]] = [line.segments[target],line.segments[index]];
  await saveLayoutSurvey(survey);
  $('#segmentDialog').close();
  await renderLayoutEditor();
  showToast(direction < 0 ? 'Элемент сдвинут левее' : 'Элемент сдвинут правее');
}
async function openPostDialog(lineId,postId) {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,lineId) : null;
  const post = line?.boundaries.find(x => x.id === postId);
  if (!post) return;
  $('#postLineId').value = lineId;
  $('#postId').value = postId;
  $('#postKindInput').value = post.kind || 'new';
  $('#postProfileInput').value = ['100×100×3','80×80×3','60×60×2','other'].includes(post.profile) ? post.profile : 'other';
  $('#postNoteInput').value = post.note || '';
  $('#postProfileField').classList.toggle('hidden',post.kind === 'none');
  $('#postDialog').showModal();
}
async function savePostFromDialog() {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,$('#postLineId').value) : null;
  const post = line?.boundaries.find(x => x.id === $('#postId').value);
  if (!post) return;
  post.kind = $('#postKindInput').value;
  post.profile = $('#postProfileInput').value;
  post.note = $('#postNoteInput').value.trim();
  await saveLayoutSurvey(survey);
  $('#postDialog').close();
  await renderLayoutEditor();
}
async function addLayoutLine() {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  if (!survey) return;
  const layout = ensureSurveyLayout(survey);
  layout.lines.push(newLayoutLine(layout.lines.length));
  await saveLayoutSurvey(survey);
  await renderLayoutEditor();
}
async function deleteLayoutLine(lineId) {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  if (!survey) return;
  const layout = ensureSurveyLayout(survey);
  if (layout.lines.length <= 1) return;
  const line = layout.lines.find(x => x.id === lineId);
  if (line?.segments?.length && !confirm('Удалить эту линию вместе со всеми её элементами?')) return;
  layout.lines = layout.lines.filter(x => x.id !== lineId);
  await saveLayoutSurvey(survey);
  await renderLayoutEditor();
}
async function saveLayoutLineName(lineId,value) {
  const survey = await idbGet('surveys',activeLayoutSurveyId);
  const line = survey ? findLayoutLine(survey,lineId) : null;
  if (!line) return;
  const cleaned = String(value || '').trim().slice(0,60);
  if (!cleaned || cleaned === line.name) return;
  line.name = cleaned;
  await saveLayoutSurvey(survey);
}

function resetSurveyWizard() {
  $('#surveyForm').reset();
  $('#surveyStep1').classList.add('active');
  $('#surveyStep2').classList.remove('active');
  $$('.progress-line span')[0].classList.add('active');
  $$('.progress-line span')[1].classList.remove('active');
  $('#workTypeError').hidden = true;
}
function goSurveyStep(step) {
  $('#surveyStep1').classList.toggle('active', step === 1);
  $('#surveyStep2').classList.toggle('active', step === 2);
  $$('.progress-line span')[1].classList.toggle('active', step === 2);
}

async function bootstrap() {
  db = await openDb();
  await seedDatabase();
  currentUser = await restoreSession();
  bindEvents();
  updateNetworkState();
  if (currentUser) {
    showMain();
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
  applyRoleUi();
  switchScreen('surveys');
}
async function logout() {
  if (API_ENABLED && navigator.onLine && await metaGet('serverToken','')) {
    try { await apiRequest('/logout', { method:'POST', body:'{}' }); } catch {}
  }
  await metaDelete('serverToken');
  clearSession();
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
      showMain();
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
  $('#profileBtn').addEventListener('click', () => switchScreen('settings'));
  $('#logoutBtn').addEventListener('click', logout);
  $('#syncNowBtn')?.addEventListener('click', () => syncNow({ silent:false }));
  $('#newSurveyBtn').addEventListener('click', () => { resetSurveyWizard(); $('#surveyDialog').showModal(); });
  $('#toSurveyStep2').addEventListener('click', () => {
    const name = $('#surveyClientName').value.trim(), phone = $('#surveyClientPhone').value.replace(/\D/g,''), address = $('#surveyAddress').value.trim();
    if (!name || phone.length < 10 || !address) return showToast('Заполните имя, телефон и адрес объекта');
    goSurveyStep(2);
  });
  $('#backSurveyStep1').addEventListener('click', () => goSurveyStep(1));
  $('#saveSurveyBtn').addEventListener('click', async () => {
    const workTypes = $$('input[name="workType"]:checked').map(x => x.value);
    if (!workTypes.length) { $('#workTypeError').hidden = false; return; }
    $('#workTypeError').hidden = true;
    const survey = await createSurvey({
      name: $('#surveyClientName').value, phone: $('#surveyClientPhone').value,
      address: $('#surveyAddress').value, note: $('#surveyNote').value, workTypes
    });
    $('#surveyDialog').close();
    showToast(`${displaySurveyNumber(survey)} сохранён`);
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
  $('#closeLayoutBtn')?.addEventListener('click', reopenSurveyDetailsAfterLayout);
  $('#addLayoutLineBtn')?.addEventListener('click', addLayoutLine);
  $('#segmentTypeInput')?.addEventListener('change', updateSegmentFields);
  $('#postKindInput')?.addEventListener('change', () => $('#postProfileField').classList.toggle('hidden',$('#postKindInput').value === 'none'));
  $('#saveSegmentBtn')?.addEventListener('click', saveSegmentFromDialog);
  $('#deleteSegmentBtn')?.addEventListener('click', deleteSegmentFromDialog);
  $('#moveSegmentLeftBtn')?.addEventListener('click', () => moveActiveSegment(-1));
  $('#moveSegmentRightBtn')?.addEventListener('click', () => moveActiveSegment(1));
  $('#savePostBtn')?.addEventListener('click', savePostFromDialog);
  $('#layoutLines')?.addEventListener('change', event => {
    const input = event.target.closest('[data-line-name]');
    if (input) saveLayoutLineName(input.dataset.lineName,input.value);
  });
  $('#layoutLines')?.addEventListener('click', event => {
    const add = event.target.closest('[data-add-type]');
    if (add) return openSegmentDialog(add.dataset.lineId,'',0,add.dataset.addType);
    const insert = event.target.closest('[data-insert-line]');
    if (insert) return openSegmentDialog(insert.dataset.insertLine,'',Number(insert.dataset.insertIndex),'fence');
    const segment = event.target.closest('[data-edit-segment]');
    if (segment) return openSegmentDialog(segment.dataset.lineId,segment.dataset.editSegment);
    const post = event.target.closest('[data-edit-post]');
    if (post) return openPostDialog(post.dataset.lineId,post.dataset.editPost);
    const remove = event.target.closest('[data-delete-line]');
    if (remove) return deleteLayoutLine(remove.dataset.deleteLine);
  });
  $$('[data-survey-filter]').forEach(btn => btn.addEventListener('click', () => {
    currentSurveyFilter = btn.dataset.surveyFilter;
    $$('[data-survey-filter]').forEach(x => x.classList.toggle('active', x === btn));
    renderSurveys();
  }));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('SW registration failed', e); }
}

bootstrap().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif"><h2>Не удалось запустить приложение</h2><pre>${escapeHtml(err?.message || String(err))}</pre></div>`;
});
