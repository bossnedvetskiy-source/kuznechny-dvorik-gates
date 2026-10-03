const APP_VERSION = '0.1.0';
const DB_NAME = 'kd-surveyor-stage1';
const DB_VERSION = 1;
const STORE_NAMES = ['employees', 'clients', 'surveys', 'meta'];

const WORK_TYPES = {
  gates: { label: 'Ворота / калитка', short: 'Ворота', className: 'gates' },
  fence: { label: 'Забор', short: 'Забор', className: 'fence' },
  canopy: { label: 'Навес', short: 'Навес', className: 'canopy' }
};

const ROLE_LABELS = { owner: 'Собственник', surveyor: 'Замерщик' };
let db;
let currentUser = null;
let currentSurveyFilter = 'all';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          const keyPath = storeName === 'meta' ? 'key' : 'id';
          database.createObjectStore(storeName, { keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

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
  const result = await hashPassword(password, employee.passwordSalt);
  return timingSafeEqual(result.hash, employee.passwordHash);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function seedDatabase() {
  const employees = await idbGetAll('employees');
  if (!employees.length) {
    const ownerPass = await hashPassword('1234');
    const surveyorPass = await hashPassword('1234');
    await idbPut('employees', {
      id: 'emp_owner', name: 'Собственник', login: 'admin', role: 'owner', active: true,
      passwordSalt: ownerPass.salt, passwordHash: ownerPass.hash, createdAt: new Date().toISOString()
    });
    await idbPut('employees', {
      id: 'emp_surveyor', name: 'Замерщик', login: 'zamer', role: 'surveyor', active: true,
      passwordSalt: surveyorPass.salt, passwordHash: surveyorPass.hash, createdAt: new Date().toISOString()
    });
  }
  if (!(await idbGet('meta', 'nextSurveyNumber'))) {
    await idbPut('meta', { key: 'nextSurveyNumber', value: 1 });
  }
}

function saveSession(user) {
  sessionStorage.setItem('kdSurveyorSession', JSON.stringify({ id: user.id, ts: Date.now() }));
}

async function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem('kdSurveyorSession') || 'null');
    if (!session?.id) return null;
    const user = await idbGet('employees', session.id);
    return user?.active ? user : null;
  } catch { return null; }
}

function clearSession() {
  sessionStorage.removeItem('kdSurveyorSession');
}

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

function formatDate(iso) {
  const d = new Date(iso);
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
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function updateNetworkState() {
  const badge = $('#networkBadge');
  const online = navigator.onLine;
  badge.classList.toggle('offline', !online);
  $('span:last-child', badge).textContent = online ? 'Онлайн' : 'Офлайн';
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
}

async function login(username, password) {
  const employees = await idbGetAll('employees');
  const normalized = username.trim().toLowerCase();
  const employee = employees.find(x => x.login.toLowerCase() === normalized && x.active);
  if (!employee || !(await verifyPassword(password, employee))) return null;
  return employee;
}

async function nextSurveyNumber() {
  const item = await idbGet('meta', 'nextSurveyNumber') || { key:'nextSurveyNumber', value:1 };
  const value = Number(item.value || 1);
  item.value = value + 1;
  await idbPut('meta', item);
  return `ЗМ-${String(value).padStart(4, '0')}`;
}

async function upsertClient({ name, phone, address = '' }) {
  const clients = await idbGetAll('clients');
  const phoneDigits = phone.replace(/\D/g, '');
  let client = clients.find(x => x.phone.replace(/\D/g, '') === phoneDigits);
  const now = new Date().toISOString();
  if (client) {
    client = { ...client, name: name.trim() || client.name, phone: formatPhone(phone), address: address.trim() || client.address, updatedAt: now };
  } else {
    client = { id: makeId('cl'), name: name.trim(), phone: formatPhone(phone), address: address.trim(), createdAt: now, updatedAt: now };
  }
  await idbPut('clients', client);
  return client;
}

async function createSurvey(data) {
  const client = await upsertClient(data);
  const now = new Date().toISOString();
  const survey = {
    id: makeId('sv'), number: await nextSurveyNumber(), clientId: client.id,
    clientName: client.name, clientPhone: client.phone, address: data.address.trim(), note: data.note.trim(),
    workTypes: [...data.workTypes], status: 'draft', createdBy: currentUser.id, createdByName: currentUser.name,
    createdAt: now, updatedAt: now, syncState: 'local', archived: false, schemaVersion: 1
  };
  await idbPut('surveys', survey);
  return survey;
}

async function renderSurveys() {
  let surveys = (await idbGetAll('surveys')).filter(x => !x.archived).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  if (currentSurveyFilter !== 'all') surveys = surveys.filter(x => x.status === currentSurveyFilter);
  $('#surveysCounter').textContent = `${surveys.length} ${plural(surveys.length, ['заказ','заказа','заказов'])}`;
  const list = $('#surveyList');
  list.innerHTML = surveys.map(survey => `
    <article class="survey-card" data-survey-id="${survey.id}">
      <div class="card-top">
        <div>
          <div class="order-number">${escapeHtml(survey.number)}</div>
          <div class="card-name">${escapeHtml(survey.clientName)}</div>
          <div class="card-address">${escapeHtml(survey.address)}</div>
        </div>
        <span class="status-pill ${survey.status}">${survey.status === 'ready' ? 'Готов' : 'Черновик'}</span>
      </div>
      <div class="badge-row">${survey.workTypes.map(type => `<span class="type-badge ${WORK_TYPES[type]?.className || ''}">${WORK_TYPES[type]?.short || type}</span>`).join('')}</div>
      <div class="sync-row"><span>${formatDate(survey.updatedAt)}</span><span class="sync-local">На устройстве</span></div>
    </article>`).join('');
  $('#surveyEmpty').hidden = surveys.length > 0;
  $$('.survey-card', list).forEach(card => card.addEventListener('click', () => openSurveyDetails(card.dataset.surveyId)));
}

async function renderClients(query = '') {
  const q = query.trim().toLowerCase();
  let clients = (await idbGetAll('clients')).sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (q) clients = clients.filter(x => `${x.name} ${x.phone} ${x.address}`.toLowerCase().includes(q));
  $('#clientList').innerHTML = clients.map(client => `
    <article class="client-card">
      <div class="client-main"><div class="client-name">${escapeHtml(client.name)}</div><div class="client-meta">${escapeHtml(client.address || 'Адрес не указан')}</div></div>
      <a class="client-phone" href="tel:${client.phone.replace(/\D/g,'')}">${escapeHtml(client.phone)}</a>
    </article>`).join('');
  $('#clientEmpty').hidden = clients.length > 0;
}

async function renderEmployees() {
  if (currentUser?.role !== 'owner') return;
  const employees = (await idbGetAll('employees')).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  $('#employeeList').innerHTML = employees.map(emp => `
    <article class="employee-card ${emp.active ? '' : 'inactive'}">
      <div class="employee-main">
        <div class="employee-name">${escapeHtml(emp.name)}</div>
        <div class="employee-meta">Логин: ${escapeHtml(emp.login)} · ${emp.active ? 'доступ активен' : 'доступ отключён'}</div>
        <span class="role-chip">${ROLE_LABELS[emp.role] || emp.role}</span>
      </div>
      <div class="inline-actions">
        <button class="mini-btn" data-edit-employee="${emp.id}" type="button">Изменить</button>
        ${emp.id !== currentUser.id ? `<button class="mini-btn ${emp.active ? 'danger' : ''}" data-toggle-employee="${emp.id}" type="button">${emp.active ? 'Отключить' : 'Включить'}</button>` : ''}
      </div>
    </article>`).join('');
  $$('[data-edit-employee]').forEach(btn => btn.addEventListener('click', () => openEmployeeDialog(btn.dataset.editEmployee)));
  $$('[data-toggle-employee]').forEach(btn => btn.addEventListener('click', () => toggleEmployee(btn.dataset.toggleEmployee)));
}

async function openSurveyDetails(id) {
  const survey = await idbGet('surveys', id);
  if (!survey) return;
  $('#detailsNumber').textContent = survey.number;
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
    <div class="details-section"><div class="notice notice-lock">Следующий этап добавит сюда визуальный конструктор линии: столбы, пролёты, ворота, калитки и их свободное редактирование.</div></div>
    ${currentUser.role === 'owner' ? `<button class="btn btn-danger btn-block" data-archive-survey="${survey.id}" type="button">Архивировать заказ</button>` : ''}`;
  $('#surveyDetailsDialog').showModal();
  $('[data-archive-survey]')?.addEventListener('click', () => archiveSurvey(survey.id));
}

async function archiveSurvey(id) {
  if (currentUser.role !== 'owner') return;
  const survey = await idbGet('surveys', id);
  if (!survey) return;
  survey.archived = true;
  survey.updatedAt = new Date().toISOString();
  await idbPut('surveys', survey);
  $('#surveyDetailsDialog').close();
  showToast('Заказ перемещён в архив');
  renderSurveys();
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
}

async function openEmployeeDialog(id = '') {
  if (currentUser.role !== 'owner') return;
  $('#employeeForm').reset();
  $('#employeeIdInput').value = id;
  if (id) {
    const emp = await idbGet('employees', id);
    if (!emp) return;
    $('#employeeNameInput').value = emp.name;
    $('#employeeLoginInput').value = emp.login;
    $('#employeeRoleInput').value = emp.role;
    $('#employeePasswordInput').placeholder = 'Оставьте пустым, чтобы не менять';
  } else {
    $('#employeePasswordInput').placeholder = 'Минимум 4 символа';
  }
  $('#employeeDialog').showModal();
}

async function saveEmployee() {
  if (currentUser.role !== 'owner') return;
  const id = $('#employeeIdInput').value;
  const name = $('#employeeNameInput').value.trim();
  const loginValue = $('#employeeLoginInput').value.trim().toLowerCase();
  const role = $('#employeeRoleInput').value;
  const password = $('#employeePasswordInput').value;
  if (!name || !loginValue) return showToast('Заполните имя и логин');
  const employees = await idbGetAll('employees');
  if (employees.some(x => x.login.toLowerCase() === loginValue && x.id !== id)) return showToast('Такой логин уже используется');
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

async function toggleEmployee(id) {
  if (currentUser.role !== 'owner' || id === currentUser.id) return;
  const employee = await idbGet('employees', id);
  if (!employee) return;
  employee.active = !employee.active;
  employee.updatedAt = new Date().toISOString();
  await idbPut('employees', employee);
  showToast(employee.active ? 'Доступ включён' : 'Доступ отключён');
  renderEmployees();
}

function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
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
  const step1 = $('#surveyStep1'), step2 = $('#surveyStep2');
  step1.classList.toggle('active', step === 1);
  step2.classList.toggle('active', step === 2);
  $$('.progress-line span')[1].classList.toggle('active', step === 2);
}

async function bootstrap() {
  db = await openDb();
  await seedDatabase();
  currentUser = await restoreSession();
  bindEvents();
  updateNetworkState();
  if (currentUser) showMain(); else showLogin();
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

function bindEvents() {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginError').hidden = true;
    const user = await login($('#loginInput').value, $('#passwordInput').value);
    if (!user) {
      $('#loginError').textContent = 'Неверный логин или пароль.';
      $('#loginError').hidden = false;
      return;
    }
    currentUser = user; saveSession(user); $('#loginForm').reset(); showMain();
  });
  window.addEventListener('online', updateNetworkState); window.addEventListener('offline', updateNetworkState);
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => btn.dataset.screen && switchScreen(btn.dataset.screen)));
  $('#profileBtn').addEventListener('click', () => switchScreen('settings'));
  $('#logoutBtn').addEventListener('click', () => { clearSession(); currentUser = null; showLogin(); });
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
    const survey = await createSurvey({ name: $('#surveyClientName').value, phone: $('#surveyClientPhone').value, address: $('#surveyAddress').value, note: $('#surveyNote').value, workTypes });
    $('#surveyDialog').close();
    showToast(`${survey.number} сохранён на устройстве`);
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
