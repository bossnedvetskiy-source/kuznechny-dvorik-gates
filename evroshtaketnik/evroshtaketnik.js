import { calculateFence, FENCE_SETTINGS } from './engine.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(Math.round(Number(value)||0)) + ' ₽';
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:digits}).format(Number(value)||0);
const normalize = value => String(value||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ');
const isDev = location.hostname.endsWith('github.io') || Boolean(document.querySelector('meta[name="kuzdvor-environment"][content="development"]'));

const form = $('fenceForm');
const typeInput = $('fenceType');
const postInput = $('postType');
const includePostsInput = $('includePosts');
const existingPostsInput = $('existingPostsCount');
const existingPostsWrap = $('existingPostsWrap');
const sectionsList = $('sectionsList');
const addSectionButton = $('addSection');
const removeSectionButton = $('removeSection');
const settlementInput = $('settlement');
const settlementResults = $('settlementResults');
const deliveryStatus = $('deliveryStatus');
const manualDeliveryInput = $('manualDelivery');
const manualDeliveryEnabled = $('manualDeliveryEnabled');
const typeHelp = $('typeHelp');
const totalLabel = $('totalLabel');
const resultNote = $('resultNote');
const internalGrid = $('internalGrid');
const internalToggle = $('internalToggle');
const internalOverview = $('internalOverview');
const mobileQuoteBar = $('mobileQuoteBar');
const mobileBarPrice = $('mobileBarPrice');
const mobileBarNote = $('mobileBarNote');
const leadForm = $('leadForm');
const leadState = $('leadState');
const leadCity = $('leadCity');
const leadSubmit = $('leadSubmit');
const leadEmptyState = $('leadEmptyState');
const leadReadyContent = $('leadReadyContent');
const leadBackToCalc = $('leadBackToCalc');
const savedQuoteBar = $('savedQuoteBar');
const resultLeadButton = $('resultLeadButton');
const includedBlock = $('includedBlock');
const resultSummary = $('resultSummary');
const quoteMainActions = $('quoteMainActions');
const quoteMoreActions = $('quoteMoreActions');
const hasSlopeInput = $('hasSlope');
const hasHardSurfaceInput = $('hasHardSurface');
const existingPostsHint = $('existingPostsHint');
const quoteReference = $('quoteReference');
const schemeSection = document.querySelector('.scheme-section');
const SAVED_QUOTE_KEY = 'kuzdvor:picket-saved-v1';
const DRAFT_QUOTE_KEY = 'kuzdvor:picket-draft-v1';

let visibleSections = 1;
let deliveryRows = [];
let selectedDelivery = null;
let selectedColor = 'Графит';
let lastResult = null;
let runtimeSettings = {...FENCE_SETTINGS};
let toastTimer = 0;
let draftTimer = 0;
let quoteNumber = '';
let restoringState = false;

function sectionMarkup(index) {
  const n = index + 1;
  return `
    <article class="section-card" data-section-card="${index}">
      <div class="section-card-head"><b>Участок ${n}</b><span data-section-caption="${index}">не заполнен</span></div>
      <div class="section-fields">
        <label class="field"><span>Длина линии, м</span><input data-field="length" data-index="${index}" type="number" min="0" max="200" step="0.1" inputmode="decimal" value="" placeholder="Например, 10"></label>
        <label class="field"><span>Высота, м</span><input data-field="height" data-index="${index}" type="number" min="0.5" max="3" step="0.05" inputmode="decimal" value="1.8"></label>
      </div>
      <div class="quick-presets" aria-label="Быстрые размеры участка">
        <div><span>Длина:</span><button type="button" data-preset-field="length" data-index="${index}" data-value="10">10 м</button><button type="button" data-preset-field="length" data-index="${index}" data-value="15">15 м</button><button type="button" data-preset-field="length" data-index="${index}" data-value="20">20 м</button></div>
        <div><span>Высота:</span><button type="button" data-preset-field="height" data-index="${index}" data-value="1.5">1,5 м</button><button type="button" data-preset-field="height" data-index="${index}" data-value="1.8">1,8 м</button><button type="button" data-preset-field="height" data-index="${index}" data-value="2">2 м</button></div>
      </div>
      <details class="section-openings">
        <summary>Есть ворота или калитка в этом участке?</summary>
        <div class="section-fields opening-fields">
          <label class="field"><span>Чистый проём ворот, м</span><input data-field="gateOpening" data-index="${index}" type="number" min="0" max="10" step="0.05" inputmode="decimal" value="0"></label>
          <label class="field"><span>Чистый проём калитки, м</span><input data-field="wicketOpening" data-index="${index}" type="number" min="0" max="3" step="0.05" inputmode="decimal" value="0"></label>
        </div>
        <div class="opening-post-settings">
          <label class="field"><span>Столбы ворот / калитки</span><select data-field="openingPostType" data-index="${index}"><option value="60x60x2">60×60×2</option><option value="80x80x3">80×80×3</option><option value="100x100x3" selected>100×100×3</option></select></label>
          <label class="field opening-position-field" data-opening-position-row="${index}" hidden>
            <span>Забор от начала участка до первого столба узла, м</span>
            <input data-field="openingStartFence" data-index="${index}" type="number" min="0" max="200" step="0.05" inputmode="decimal" value="" placeholder="Например, 2,3">
            <small>Укажите для точной схемы. 0 — если ворота или калитка начинаются сразу от начала линии.</small>
          </label>
          <label class="switch-field compact opening-share-row" data-opening-share-row="${index}">
            <span><b>Общий средний столб</b><small>Включено, если ворота и калитка стоят рядом и используют один общий столб.</small></span>
            <input data-field="openingsSharePost" data-index="${index}" type="checkbox" checked>
            <i aria-hidden="true"></i>
          </label>
          <label class="field between-openings-field" data-between-opening-row="${index}" hidden>
            <span>Забор между воротами и калиткой, м</span>
            <input data-field="betweenOpeningFence" data-index="${index}" type="number" min="0" max="50" step="0.05" inputmode="decimal" value="0" placeholder="Например, 2">
            <small>Чистое расстояние между внутренними столбами. До 2,4 м дополнительный столб не нужен.</small>
          </label>
          <div class="opening-node-summary" data-opening-node-summary="${index}">Укажите проём — здесь появится полный размер узла по линии.</div>
        </div>
        <small>В текущую цену забора ворота, калитка и их столбы не входят — их размеры учитываются только в геометрии линии.</small>
      </details>
      <div class="section-validation" data-section-validation="${index}" hidden></div>
      ${index < 3 ? `
      <label class="switch-field shared-row" data-shared-row="${index}">
        <span><b>Следующий участок начинается от этого же столба</b><small>Включите для угла или продолжения — один столб не посчитается дважды</small></span>
        <input data-field="shared" data-index="${index}" type="checkbox">
        <i aria-hidden="true"></i>
      </label>` : ''}
    </article>`;
}

sectionsList.innerHTML = Array.from({length:4}, (_, index) => sectionMarkup(index)).join('');

function syncVisibleSections() {
  for (let index = 0; index < 4; index += 1) {
    const card = sectionsList.querySelector(`[data-section-card="${index}"]`);
    card.hidden = index >= visibleSections;
    const shared = sectionsList.querySelector(`[data-shared-row="${index}"]`);
    if (shared) shared.hidden = index >= visibleSections - 1;
  }
  addSectionButton.disabled = visibleSections >= 4;
  addSectionButton.style.opacity = visibleSections >= 4 ? '.45' : '';
  removeSectionButton.disabled = visibleSections <= 1;
  removeSectionButton.style.opacity = visibleSections <= 1 ? '.45' : '';
}

function readSections() {
  return Array.from({length:4}, (_, index) => {
    const length = Number(sectionsList.querySelector(`[data-field="length"][data-index="${index}"]`)?.value || 0);
    const height = Number(sectionsList.querySelector(`[data-field="height"][data-index="${index}"]`)?.value || 1.8);
    const gateOpening = Number(sectionsList.querySelector(`[data-field="gateOpening"][data-index="${index}"]`)?.value || 0);
    const wicketOpening = Number(sectionsList.querySelector(`[data-field="wicketOpening"][data-index="${index}"]`)?.value || 0);
    const openingPostType = sectionsList.querySelector(`[data-field="openingPostType"][data-index="${index}"]`)?.value || postInput.value;
    const openingsSharePost = Boolean(sectionsList.querySelector(`[data-field="openingsSharePost"][data-index="${index}"]`)?.checked);
    const betweenOpeningFence = Number(sectionsList.querySelector(`[data-field="betweenOpeningFence"][data-index="${index}"]`)?.value || 0);
    const openingStartRaw = String(sectionsList.querySelector(`[data-field="openingStartFence"][data-index="${index}"]`)?.value ?? '').trim();
    const openingStartFence = openingStartRaw === '' ? null : Math.max(0, Number(openingStartRaw) || 0);
    const shared = Boolean(sectionsList.querySelector(`[data-field="shared"][data-index="${index}"]`)?.checked);
    return {
      length: index < visibleSections ? Math.max(0, length) : 0,
      height: Math.max(.5, height || 1.8),
      gateOpening: index < visibleSections ? Math.max(0, gateOpening) : 0,
      wicketOpening: index < visibleSections ? Math.max(0, wicketOpening) : 0,
      openingPostType,
      openingsSharePost,
      betweenOpeningFence: index < visibleSections ? Math.max(0, betweenOpeningFence) : 0,
      openingStartFence: index < visibleSections ? openingStartFence : null,
      sharedWithNext: index < visibleSections - 1 ? shared : false
    };
  });
}

function deliveryCost() {
  if (manualDeliveryEnabled.checked) return Math.max(0, Number(manualDeliveryInput.value)||0);
  return selectedDelivery ? Math.max(0, Number(selectedDelivery.price)||0) : 0;
}

function deliveryIsKnown() {
  return manualDeliveryEnabled.checked || Boolean(selectedDelivery);
}

const POST_LABELS = {
  '60x60x2':'60×60×2',
  '80x80x3':'80×80×3',
  '100x100x3':'100×100×3'
};

const TYPE_HELP = {
  'vertical-double': 'Штакетник с двух сторон в шахматном порядке — забор меньше просматривается.',
  'vertical-single': 'Штакетник устанавливается с одной стороны — самый простой и экономичный вариант.',
  'horizontal-double': 'Горизонтальные металлические планки с двух сторон. В расчёте добавляются вертикальные прожилины внутри каждого пролёта.'
};

function showToast(message) {
  const toast = $('pageToast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function scrollToLead() {
  $('leadSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(() => $('leadPhone')?.focus({preventScroll:true}), 450);
}

function syncPostOptions() {
  if (existingPostsWrap) existingPostsWrap.hidden = !includePostsInput.checked;
}

function createQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let suffix = '';
  try {
    const bytes = new Uint8Array(2);
    crypto.getRandomValues(bytes);
    suffix = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch {
    suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  }
  return `ЗБ-${yy}${mm}${dd}-${suffix}`;
}

function ensureQuoteNumber() {
  if (!quoteNumber) quoteNumber = createQuoteNumber();
  return quoteNumber;
}

function quoteState() {
  return {
    v: 2,
    quoteNumber: lastResult?.summary.activeSections ? ensureQuoteNumber() : quoteNumber,
    type: typeInput.value,
    post: postInput.value,
    includeNewPosts: includePostsInput.checked,
    existingPostsCount: Math.max(0, Math.floor(Number(existingPostsInput?.value || 0))),
    color: selectedColor,
    siteConditions: {
      slope: Boolean(hasSlopeInput?.checked),
      hardSurface: Boolean(hasHardSurfaceInput?.checked)
    },
    sections: readSections().slice(0, visibleSections),
    delivery: {
      manual: Boolean(manualDeliveryEnabled.checked),
      manualPrice: Math.max(0, Number(manualDeliveryInput.value) || 0),
      name: String(selectedDelivery?.name || settlementInput.value || '').trim(),
      secondary: String(selectedDelivery?.secondary || '').trim(),
      price: Math.max(0, Number(selectedDelivery?.price) || 0)
    }
  };
}

function readDraftQuote() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_QUOTE_KEY) || 'null');
    if (!value || typeof value !== 'object') return null;
    const savedAt = Number(value.savedAt || 0);
    if (savedAt && Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_QUOTE_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function scheduleDraftSave() {
  if (restoringState) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      if (!lastResult?.summary.activeSections) {
        localStorage.removeItem(DRAFT_QUOTE_KEY);
        return;
      }
      localStorage.setItem(DRAFT_QUOTE_KEY, JSON.stringify({...quoteState(), savedAt:Date.now()}));
    } catch {}
  }, 220);
}

function encodeQuoteState(state) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  } catch {
    return '';
  }
}

function decodeQuoteState(value) {
  try {
    const normalized = String(value || '').replace(/-/g,'+').replace(/_/g,'/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readSavedQuote() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_QUOTE_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function syncSavedQuoteBar() {
  if (savedQuoteBar) savedQuoteBar.hidden = !readSavedQuote();
}

function saveQuoteState() {
  if (!lastResult?.summary.activeSections) {
    showToast('Сначала укажите размеры');
    return;
  }
  try {
    localStorage.setItem(SAVED_QUOTE_KEY, JSON.stringify(quoteState()));
    syncSavedQuoteBar();
    showToast('Расчёт сохранён на этом устройстве');
  } catch {
    showToast('Не удалось сохранить расчёт');
  }
}

function setSectionValue(index, field, value) {
  const input = sectionsList.querySelector(`[data-field="${field}"][data-index="${index}"]`);
  if (!input) return;
  if (input.type === 'checkbox') input.checked = Boolean(value);
  else input.value = String(value ?? '');
}

function restoreQuoteState(state, {fromLink = false, fromDraft = false} = {}) {
  if (!state || typeof state !== 'object') return false;
  restoringState = true;
  if (state.type && [...typeInput.options].some(option => option.value === state.type)) typeInput.value = state.type;
  if (state.post && [...postInput.options].some(option => option.value === state.post)) postInput.value = state.post;
  includePostsInput.checked = state.includeNewPosts !== false;
  if (existingPostsInput) existingPostsInput.value = String(Math.max(0, Math.floor(Number(state.existingPostsCount) || 0)));
  selectedColor = String(state.color || 'Графит');
  quoteNumber = String(state.quoteNumber || quoteNumber || '');
  if (hasSlopeInput) hasSlopeInput.checked = Boolean(state.siteConditions?.slope);
  if (hasHardSurfaceInput) hasHardSurfaceInput.checked = Boolean(state.siteConditions?.hardSurface);

  const sections = Array.isArray(state.sections) ? state.sections.slice(0,4) : [];
  visibleSections = Math.min(4, Math.max(1, sections.length || 1));
  for (let index = 0; index < 4; index += 1) {
    const item = sections[index] || {};
    const restoredLength = index < visibleSections ? Math.max(0, Number(item.length) || 0) : 0;
    setSectionValue(index, 'length', restoredLength > 0 ? restoredLength : '');
    setSectionValue(index, 'height', Math.max(.5, Number(item.height) || 1.8));
    setSectionValue(index, 'gateOpening', index < visibleSections ? Math.max(0, Number(item.gateOpening) || 0) : 0);
    setSectionValue(index, 'wicketOpening', index < visibleSections ? Math.max(0, Number(item.wicketOpening) || 0) : 0);
    setSectionValue(index, 'openingPostType', item.openingPostType || '100x100x3');
    setSectionValue(index, 'openingsSharePost', item.openingsSharePost !== false);
    setSectionValue(index, 'betweenOpeningFence', index < visibleSections ? Math.max(0, Number(item.betweenOpeningFence) || 0) : 0);
    setSectionValue(index, 'openingStartFence', index < visibleSections && item.openingStartFence !== null && item.openingStartFence !== undefined ? Math.max(0, Number(item.openingStartFence) || 0) : '');
    setSectionValue(index, 'shared', index < visibleSections - 1 && Boolean(item.sharedWithNext));
  }

  const delivery = state.delivery && typeof state.delivery === 'object' ? state.delivery : {};
  manualDeliveryEnabled.checked = Boolean(delivery.manual);
  manualDeliveryInput.value = String(Math.max(0, Number(delivery.manualPrice) || 0));
  const name = String(delivery.name || '').trim();
  settlementInput.value = name;
  if (leadCity) leadCity.value = name;
  selectedDelivery = null;

  if (!manualDeliveryEnabled.checked && name) {
    const candidates = deliveryRows.filter(item => normalize(item.name) === normalize(name));
    const secondary = normalize(delivery.secondary);
    selectedDelivery = candidates.find(item => secondary && normalize(item.secondary) === secondary)
      || candidates[0]
      || {
        name,
        secondary: String(delivery.secondary || ''),
        price: Math.max(0, Number(delivery.price) || 0)
      };
  }

  if (manualDeliveryEnabled.checked) {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Используется сохранённая ручная стоимость доставки.';
  } else if (selectedDelivery) {
    deliveryStatus.className = 'delivery-status is-ok';
    deliveryStatus.textContent = `${selectedDelivery.name}${selectedDelivery.secondary ? ', ' + selectedDelivery.secondary : ''} · доставка учтена в расчёте`;
  } else if (name) {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Проверьте населённый пункт — стоимость доставки пока не подтверждена.';
  } else {
    deliveryStatus.className = 'delivery-status';
    deliveryStatus.textContent = 'Начните вводить населённый пункт — итог обновится с учётом доставки.';
  }

  syncVisibleSections();
  syncPostOptions();
  syncTypePicker();
  syncColorPicker();
  calculate();
  restoringState = false;
  scheduleDraftSave();
  if (fromLink) showToast('Расчёт из ссылки восстановлен');
  else if (fromDraft) showToast('Черновик расчёта восстановлен');
  return true;
}

async function shareQuoteState() {
  if (!lastResult?.summary.activeSections) {
    showToast('Сначала укажите размеры');
    return;
  }
  const encoded = encodeQuoteState(quoteState());
  if (!encoded) {
    showToast('Не удалось подготовить ссылку');
    return;
  }
  const url = new URL(location.href);
  url.searchParams.set('q', encoded);
  url.hash = '';
  const payload = {
    title: 'Расчёт забора из металлического евроштакетника',
    text: quoteText(),
    url: url.toString()
  };
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast('Ссылка на расчёт скопирована');
  } catch {
    showToast('Не удалось скопировать ссылку');
  }
}

function syncTypeHelp() {
  if (typeHelp) typeHelp.textContent = TYPE_HELP[typeInput.value] || '';
}

function syncTypePicker() {
  document.querySelectorAll('.type-card[data-type]').forEach(card => {
    const selected = card.dataset.type === typeInput.value;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  syncTypeHelp();
}

function syncColorPicker() {
  document.querySelectorAll('.color-choice[data-color]').forEach(button => {
    const selected = button.dataset.color === selectedColor;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function setInternalOpen(open) {
  if (!internalGrid || !internalToggle) return;
  internalGrid.hidden = !open;
  internalToggle.setAttribute('aria-expanded', String(open));
  internalToggle.classList.toggle('is-open', open);
  const label = internalToggle.querySelector('span');
  if (label) label.textContent = open ? 'Скрыть детализацию' : 'Показать детализацию';
  try { sessionStorage.setItem('kuzdvor-picket-internal-open', open ? '1' : '0'); } catch {}
}

function initInternalToggle() {
  if (!internalToggle || internalToggle.dataset.bound === '1') return;
  internalToggle.dataset.bound = '1';
  let open = false;
  try { open = sessionStorage.getItem('kuzdvor-picket-internal-open') === '1'; } catch {}
  setInternalOpen(open);
  internalToggle.addEventListener('click', () => {
    setInternalOpen(internalToggle.getAttribute('aria-expanded') !== 'true');
  });
}

function renderInputValidation(result) {
  const rawSections = readSections();

  rawSections.forEach((raw, index) => {
    const box = sectionsList.querySelector(`[data-section-validation="${index}"]`);
    if (!box) return;

    const lengthInput = sectionsList.querySelector(`[data-field="length"][data-index="${index}"]`);
    const heightInput = sectionsList.querySelector(`[data-field="height"][data-index="${index}"]`);
    const gateInput = sectionsList.querySelector(`[data-field="gateOpening"][data-index="${index}"]`);
    const wicketInput = sectionsList.querySelector(`[data-field="wicketOpening"][data-index="${index}"]`);
    const betweenInput = sectionsList.querySelector(`[data-field="betweenOpeningFence"][data-index="${index}"]`);
    const positionInput = sectionsList.querySelector(`[data-field="openingStartFence"][data-index="${index}"]`);
    const betweenRow = sectionsList.querySelector(`[data-between-opening-row="${index}"]`);
    const positionRow = sectionsList.querySelector(`[data-opening-position-row="${index}"]`);
    const openingShareRow = sectionsList.querySelector(`[data-opening-share-row="${index}"]`);
    const hasGate = raw.gateOpening > 0;
    const hasWicket = raw.wicketOpening > 0;
    const hasBothOpenings = hasGate && hasWicket;
    const canSeparate = hasBothOpenings && !raw.openingsSharePost;

    if (openingShareRow) openingShareRow.hidden = !hasBothOpenings;
    if (betweenRow) betweenRow.hidden = !canSeparate;
    if (positionRow) positionRow.hidden = !(hasGate || hasWicket);
    for (const input of [lengthInput,heightInput,gateInput,wicketInput,betweenInput,positionInput]) input?.removeAttribute('aria-invalid');

    const calculated = result.sections[index] || {};
    const openingWidth = Math.max(0, Number(calculated.openingsWidth) || 0);
    const openingNodeWidth = Math.max(0, Number(calculated.openingNodeWidth) || 0);
    const openingPostsWidth = Math.max(0, Number(calculated.openingPostsWidth) || 0);
    const openingSupportPosts = Math.max(0, Number(calculated.openingSupportPosts) || 0);
    const betweenFence = Math.max(0, Number(calculated.betweenOpeningFence) || 0);
    const bridgeSpans = Math.max(0, Number(calculated.bridgeSpans) || 0);
    const bridgeExtraPosts = Math.max(0, Number(calculated.bridgeExtraPosts) || 0);
    const nodeSummary = sectionsList.querySelector(`[data-opening-node-summary="${index}"]`);

    if (nodeSummary) {
      nodeSummary.hidden = openingWidth <= 0;
      if (openingWidth > 0) {
        const postLabel = POST_LABELS[calculated.openingPostType] || calculated.openingPostType || '';
        const bridgeText = betweenFence > 0
          ? ` Забор между ними: ${number(betweenFence)} м · ${bridgeSpans} прол. · ${bridgeExtraPosts ? `доп. столбов ${bridgeExtraPosts}` : 'без дополнительного столба'}.`
          : '';
        const positionText = calculated.openingPositionKnown
          ? ` До узла: ${number(calculated.openingStartFence)} м · после узла: ${number(calculated.openingEndFence)} м.`
          : ' Привязка по линии пока не указана.';
        nodeSummary.innerHTML = `<b>Узел по линии: ${number(openingNodeWidth)} м</b><span>Чистые проёмы ${number(openingWidth)} м + ${openingSupportPosts} столб. ${postLabel} (${number(openingPostsWidth)} м).${bridgeText}${positionText}</span>`;
      }
    }

    if (index >= visibleSections || raw.length <= 0) {
      box.hidden = true;
      box.textContent = '';
      box.className = 'section-validation';
      return;
    }

    const messages = [];
    if (openingWidth > 0 && !calculated.openingPositionKnown && openingNodeWidth <= raw.length + 1e-9) {
      messages.push({level:'info', text:'Для точного расположения на схеме укажите, сколько метров забора идёт от начала участка до первого столба ворот/калитки.'});
    }
    if (calculated.openingPositionInvalid) {
      messages.push({level:'error', text:`До узла указано ${number(calculated.requestedOpeningStartFence)} м, но максимум здесь ${number(calculated.maxOpeningStartFence)} м.`});
      positionInput?.setAttribute('aria-invalid','true');
    }
    if (openingNodeWidth > raw.length + 1e-9) {
      messages.push({level:'error', text:`Узел ворот/калитки занимает ${number(openingNodeWidth)} м, а длина участка только ${number(raw.length)} м.`});
      lengthInput?.setAttribute('aria-invalid','true');
      gateInput?.setAttribute('aria-invalid','true');
      wicketInput?.setAttribute('aria-invalid','true');
      if (canSeparate) betweenInput?.setAttribute('aria-invalid','true');
    } else if (openingWidth > 0) {
      const totalFence = Math.max(0, Number(calculated.fenceLength) || 0);
      const outsideFence = Math.max(0, totalFence - betweenFence);
      if (calculated.openingPositionKnown && !calculated.openingPositionInvalid) {
        messages.push({level:'info', text:`Привязка: до первого столба узла ${number(calculated.openingStartFence)} м, после узла ${number(calculated.openingEndFence)} м.`});
      }
      if (betweenFence > 0) {
        messages.push({
          level:'info',
          text:`Забора всего ${number(totalFence)} м: между воротами и калиткой ${number(betweenFence)} м, остальная линия ${number(outsideFence)} м.`
        });
        messages.push({
          level:'info',
          text: bridgeExtraPosts > 0
            ? `Между воротами и калиткой: ${bridgeSpans} пролёта, нужен ${bridgeExtraPosts} дополнительный столб.`
            : `Между воротами и калиткой: один пролёт до ${number(runtimeSettings.openingBridgeMaxSpan || 2.4)} м, дополнительный столб не нужен.`
        });
      } else {
        messages.push({
          level: totalFence < .5 ? 'warn' : 'info',
          text: totalFence > 0
            ? `После чистых проёмов и их столбов останется ${number(totalFence)} м линии под забор.`
            : 'После узла ворот/калитки длины под забор не остаётся.'
        });
      }
    }

    const availablePostHeight = Math.max(0, Number(runtimeSettings.postLength) - Number(runtimeSettings.postDepth));
    if (availablePostHeight > 0 && raw.height > availablePostHeight + 1e-9) {
      messages.push({level:'warn', text:`Высота ${number(raw.height)} м выше доступной части столба ${number(availablePostHeight)} м — проверьте столб на замере.`});
      heightInput?.setAttribute('aria-invalid','true');
    }

    if (!messages.length) {
      box.hidden = true;
      box.textContent = '';
      box.className = 'section-validation';
      return;
    }

    const rank = {info:1,warn:2,error:3};
    const level = messages.reduce((best,item) => rank[item.level] > rank[best] ? item.level : best, 'info');
    box.className = `section-validation is-${level}`;
    box.innerHTML = messages.map(item => `<span>${item.text}</span>`).join('');
    box.hidden = false;
  });

  if (existingPostsHint) {
    const requested = Math.max(0, Math.floor(Number(existingPostsInput?.value || 0)));
    const required = Math.max(0, Number(result.summary.postsByScheme) || 0);
    existingPostsHint.classList.remove('is-warn');
    if (includePostsInput.checked && requested > required && required > 0) {
      existingPostsHint.textContent = `По схеме требуется ${required} столбов забора. Указано ${requested} готовых — в расчёте учтём только ${required}.`;
      existingPostsHint.classList.add('is-warn');
    } else {
      existingPostsHint.textContent = 'Если часть столбов забора уже установлена, укажите количество — столбы ворот и калитки здесь не считаются.';
    }
  }
}

function calculate() {
  const result = calculateFence({
    type: typeInput.value,
    post: postInput.value,
    includeNewPosts: includePostsInput.checked,
    existingPostsCount: Number(existingPostsInput?.value || 0),
    sections: readSections(),
    deliveryCost: deliveryCost(),
    settings: runtimeSettings
  });
  lastResult = result;
  renderResult(result);
  renderScheme(result);
  renderInternal(result);
  renderLeadPreview(result);
  renderInputValidation(result);
  scheduleDraftSave();
}

function renderResult(result) {
  const {summary,type} = result;
  const deliveryPending = !deliveryIsKnown();
  const hasQuote = summary.activeSections > 0;
  const currentQuoteNumber = hasQuote ? ensureQuoteNumber() : '';
  if (quoteReference) {
    quoteReference.hidden = !hasQuote;
    quoteReference.textContent = currentQuoteNumber ? `№ ${currentQuoteNumber}` : '';
  }
  $('totalPrice').textContent = hasQuote ? money(summary.total) : '—';
  $('summaryType').textContent = type.label;
  $('summaryLength').textContent = summary.openingsWidth > 0
    ? `${number(summary.totalLength)} м из линии ${number(summary.grossLineLength)} м`
    : `${number(summary.totalLength)} м`;
  $('summaryPosts').textContent = summary.openingSupportPosts > 0
    ? `${summary.postsByScheme} забор + ${summary.openingSupportPosts} у ворот`
    : (result.includeNewPosts ? `${summary.postsByScheme} (новых ${summary.newPosts})` : String(summary.postsByScheme));
  $('summaryDelivery').textContent = deliveryPending
    ? 'не указана'
    : (summary.deliveryCost === 0 ? '0 ₽' : money(summary.deliveryCost));

  if (totalLabel) totalLabel.textContent = !hasQuote
    ? 'Рассчитайте стоимость'
    : (deliveryPending ? 'Предварительная стоимость без доставки' : 'Предварительная стоимость с доставкой');
  if (resultNote) resultNote.textContent = !hasQuote
    ? 'Укажите длину участка — калькулятор сразу покажет предварительную стоимость.'
    : (deliveryPending
        ? 'Укажите населённый пункт, чтобы получить итог с доставкой. Точные размеры и цену зафиксируем после бесплатного замера.'
        : 'Доставка учтена. Точные размеры и итоговую стоимость зафиксируем после бесплатного замера.');

  const status = $('resultStatus');
  status.className = 'result-status';
  if (!summary.activeSections) {
    status.textContent = 'Добавьте длину первого участка';
  } else if (summary.check === 'ГОТОВО') {
    status.textContent = `${summary.totalSpans} пролётов · ${summary.picketsActual} штакетин · ${summary.tubeStocks} хлыстов 40×20`;
    status.classList.add('is-ok');
  } else {
    status.textContent = summary.check;
    status.classList.add('is-warn');
  }

  const chips = [
    '<span class="accent">металлический евроштакетник</span>',
    '<span>каркас 40×20×2</span>',
    '<span>покраска каркаса</span>',
    '<span>монтаж забора</span>',
    '<span>крепёж</span>'
  ];
  if (result.includeNewPosts && summary.newPosts > 0) chips.push(`<span>новые столбы: ${summary.newPosts} шт + установка</span>`);
  if (summary.existingPostsUsed > 0) chips.push(`<span>готовые столбы: ${summary.existingPostsUsed} шт</span>`);
  if (summary.openingNodeWidth > 0) chips.push(`<span>узел ворот/калитки: ${number(summary.openingNodeWidth)} м по линии</span>`);
  if (hasSlopeInput?.checked || hasHardSurfaceInput?.checked) chips.push('<span class="warn">условия монтажа — проверить на замере</span>');
  if ($('includedChips')) $('includedChips').innerHTML = chips.join('');

  result.sections.forEach((item, index) => {
    const caption = sectionsList.querySelector(`[data-section-caption="${index}"]`);
    if (!caption) return;
    caption.textContent = item.active
      ? (item.openingNodeWidth > 0
          ? `${item.spans} прол. · узел ${number(item.openingNodeWidth)} м · забор ${number(item.fenceLength)} м`
          : `${item.spans} прол. · чистый ${number(item.clearSpan)} м`)
      : 'не заполнен';
  });

  if (mobileQuoteBar) mobileQuoteBar.hidden = !hasQuote;
  if (mobileBarPrice) mobileBarPrice.textContent = hasQuote ? money(summary.total) : '—';
  if (mobileBarNote) mobileBarNote.textContent = deliveryPending ? 'без доставки' : 'с доставкой';
  if (resultSummary) resultSummary.hidden = !hasQuote;
  if (includedBlock) includedBlock.hidden = !hasQuote;
  if (quoteMainActions) quoteMainActions.hidden = !hasQuote;
  if (quoteMoreActions) {
    quoteMoreActions.hidden = !hasQuote;
    if (!hasQuote) quoteMoreActions.open = false;
  }
  if (savedQuoteBar && !hasQuote) savedQuoteBar.hidden = true;
  if (resultLeadButton) resultLeadButton.textContent = hasQuote
    ? 'Оставить заявку на бесплатный замер'
    : 'Перейти к размерам';
}


function visualFenceSegment(segment, label, postWidth, extraPosts) {
  if (!segment || segment.footprint <= 1e-9) return null;
  return {
    kind:'fence',
    label:label || 'Забор',
    length:segment.footprint,
    mode:segment.mode,
    spans:segment.spans,
    clearSpan:segment.clearSpan,
    normalPosts:segment.normalPosts,
    postWidth:Number(postWidth || .08),
    extraPosts:Boolean(extraPosts)
  };
}

function buildVisualLine(item, result) {
  if (!item || !item.active || item.grossLength <= 0) return [];
  const outer = item.segments && item.segments.find(segment => segment.key === 'outer');
  const normal = item.segments && item.segments.find(segment => segment.key === 'main');
  const bridge = item.segments && item.segments.find(segment => segment.key === 'between-openings');
  const parts = [];
  const fencePostWidth = Number(result && result.post && result.post.width || .08);

  if (!item.openingSupportPosts) {
    const fence = visualFenceSegment(normal || (item.segments && item.segments[0]), 'Забор', fencePostWidth, false);
    if (fence) parts.push(fence);
    return parts;
  }

  const outerFence = visualFenceSegment(outer, 'Остальной забор', fencePostWidth, false);
  if (outerFence) parts.push(outerFence);

  const supportPost = role => ({
    kind:'post',
    role:role || 'support',
    label:role === 'extra' ? 'Доп. столб' : 'Столб',
    length:item.openingPostWidth
  });
  const gate = () => ({kind:'gate',label:'Ворота',length:item.gateOpening});
  const wicket = () => ({kind:'wicket',label:'Калитка',length:item.wicketOpening});

  if (item.gateOpening > 0 && item.wicketOpening > 0) {
    if (item.openingsSharePost) {
      parts.push(supportPost());
      parts.push(gate());
      parts.push(supportPost('shared'));
      parts.push(wicket());
      parts.push(supportPost());
    } else {
      parts.push(supportPost());
      parts.push(gate());
      parts.push(supportPost());
      if (bridge && bridge.footprint > 0) {
        parts.push(visualFenceSegment(bridge, 'Забор между воротами и калиткой', fencePostWidth, true));
      }
      parts.push(supportPost());
      parts.push(wicket());
      parts.push(supportPost());
    }
  } else if (item.gateOpening > 0) {
    parts.push(supportPost());
    parts.push(gate());
    parts.push(supportPost());
  } else if (item.wicketOpening > 0) {
    parts.push(supportPost());
    parts.push(wicket());
    parts.push(supportPost());
  }

  return parts.filter(part => part && part.length > 1e-9);
}

function fencePostPositions(part) {
  const spans = Math.max(0, Number(part.spans) || 0);
  const clear = Math.max(0, Number(part.clearSpan) || 0);
  const postWidth = Math.max(0, Number(part.postWidth) || 0);
  const positions = [];
  if (!spans || !part.normalPosts) return positions;

  if (part.mode === 'normal') {
    for (let i=0; i<=spans; i+=1) positions.push(i * (clear + postWidth));
  } else if (part.mode === 'attached') {
    for (let i=0; i<spans; i+=1) positions.push(i * (clear + postWidth));
  } else if (part.mode === 'bridge') {
    for (let i=1; i<spans; i+=1) positions.push(i * clear + (i - 1) * postWidth);
  }
  return positions;
}

function renderFencePattern(x, y, w, h, part, scale) {
  const safeW = Math.max(0, w);
  if (safeW <= 0) return '';
  const picketGap = Math.max(5, Math.min(14, safeW / Math.max(4, Math.round(safeW / 9))));
  let pickets = '';
  for (let px=x+4; px<x+safeW-3; px+=picketGap) {
    pickets += '<line x1="' + px.toFixed(1) + '" y1="' + (y+6).toFixed(1) + '" x2="' + px.toFixed(1) + '" y2="' + (y+h-5).toFixed(1) + '" class="visual-picket"/>';
  }

  const internalPosts = fencePostPositions(part).map((meter, index) => {
    const postX = x + meter * scale;
    const pw = Math.max(3, (part.postWidth || .08) * scale);
    const klass = part.extraPosts ? 'visual-extra-post' : 'visual-fence-post';
    const title = part.extraPosts ? 'Дополнительный столб' : 'Столб забора';
    return '<rect x="' + postX.toFixed(1) + '" y="' + (y-7).toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + (h+14).toFixed(1) + '" rx="1.5" class="' + klass + '"><title>' + title + ' ' + (index+1) + '</title></rect>';
  }).join('');

  return '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + safeW.toFixed(1) + '" height="' + h + '" rx="4" class="visual-fence-bg"/>' +
    pickets +
    '<line x1="' + x.toFixed(1) + '" y1="' + (y+11).toFixed(1) + '" x2="' + (x+safeW).toFixed(1) + '" y2="' + (y+11).toFixed(1) + '" class="visual-rail"/>' +
    '<line x1="' + x.toFixed(1) + '" y1="' + (y+h-11).toFixed(1) + '" x2="' + (x+safeW).toFixed(1) + '" y2="' + (y+h-11).toFixed(1) + '" class="visual-rail"/>' +
    internalPosts;
}

function renderVisualSvg(item, result) {
  const parts = buildVisualLine(item, result);
  const total = Math.max(.01, Number(item.grossLength) || 1);
  const svgWidth = 820;
  const left = 36;
  const right = 36;
  const usable = svgWidth - left - right;
  const scale = usable / total;
  const top = 66;
  const objectHeight = 72;
  const baseline = top + objectHeight;
  let cursor = left;
  let body = '';
  let labels = '';

  const partLabel = part => part.kind === 'post' ? '' : part.label + ' · ' + number(part.length) + ' м';

  for (const part of parts) {
    const rawWidth = part.length * scale;
    const w = Math.max(part.kind === 'post' ? 3 : 1, rawWidth);

    if (part.kind === 'fence') {
      body += renderFencePattern(cursor, top, w, objectHeight, part, scale);
    } else if (part.kind === 'gate') {
      const half = w / 2;
      body += '<rect x="' + cursor.toFixed(1) + '" y="' + top + '" width="' + w.toFixed(1) + '" height="' + objectHeight + '" rx="4" class="visual-gate-bg"/>' +
        '<line x1="' + (cursor+half).toFixed(1) + '" y1="' + top + '" x2="' + (cursor+half).toFixed(1) + '" y2="' + baseline + '" class="visual-gate-line"/>' +
        '<line x1="' + (cursor+4).toFixed(1) + '" y1="' + (top+5).toFixed(1) + '" x2="' + (cursor+half-4).toFixed(1) + '" y2="' + (baseline-5).toFixed(1) + '" class="visual-gate-line"/>' +
        '<line x1="' + (cursor+w-4).toFixed(1) + '" y1="' + (top+5).toFixed(1) + '" x2="' + (cursor+half+4).toFixed(1) + '" y2="' + (baseline-5).toFixed(1) + '" class="visual-gate-line"/>';
    } else if (part.kind === 'wicket') {
      body += '<rect x="' + cursor.toFixed(1) + '" y="' + top + '" width="' + w.toFixed(1) + '" height="' + objectHeight + '" rx="4" class="visual-wicket-bg"/>' +
        '<line x1="' + (cursor+4).toFixed(1) + '" y1="' + (top+5).toFixed(1) + '" x2="' + (cursor+w-4).toFixed(1) + '" y2="' + (baseline-5).toFixed(1) + '" class="visual-gate-line"/>';
    } else if (part.kind === 'post') {
      const pw = Math.max(4, w);
      const x = cursor + (w-pw)/2;
      const klass = part.role === 'extra' ? 'visual-extra-post' : 'visual-support-post';
      const title = part.role === 'shared' ? 'Общий столб ворот и калитки' : 'Столб ворот/калитки';
      body += '<rect x="' + x.toFixed(1) + '" y="' + (top-9).toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + (objectHeight+18).toFixed(1) + '" rx="2" class="' + klass + '"><title>' + title + '</title></rect>';
    }

    const label = partLabel(part);
    if (label && w >= 55) {
      labels += '<text x="' + (cursor+w/2).toFixed(1) + '" y="' + (baseline+25).toFixed(1) + '" text-anchor="middle" class="visual-part-label">' + label + '</text>';
    } else if (label && w >= 22) {
      labels += '<text x="' + (cursor+w/2).toFixed(1) + '" y="' + (baseline+25).toFixed(1) + '" text-anchor="middle" class="visual-part-label">' + number(part.length) + ' м</text>';
    }
    cursor += w;
  }

  const totalX2 = left + usable;
  const nodeInfo = item.openingSupportPosts
    ? 'Проёмы ' + number(item.openingsWidth) + ' м · столбы ворот/калитки ' + item.openingSupportPosts + ' шт' + (item.betweenOpeningFence > 0 ? ' · между ними ' + number(item.betweenOpeningFence) + ' м' : '')
    : item.spans + ' прол. · чистый пролёт до ' + number(item.clearSpan) + ' м';

  return '<div class="visual-line-scroll" tabindex="0" aria-label="Схема участка ' + item.index + '. Вся линия показана целиком.">' +
    '<svg class="visual-line-svg" viewBox="0 0 ' + svgWidth + ' 215" role="img" aria-label="Участок ' + item.index + ', общая длина ' + number(item.grossLength) + ' метра">' +
      '<line x1="' + left + '" y1="38" x2="' + totalX2 + '" y2="38" class="visual-dimension"/>' +
      '<path d="M' + left + ' 33 L' + left + ' 43 M' + totalX2 + ' 33 L' + totalX2 + ' 43" class="visual-dimension"/>' +
      '<text x="' + (svgWidth/2) + '" y="27" text-anchor="middle" class="visual-total-label">Вся линия · ' + number(item.grossLength) + ' м</text>' +
      body + labels +
      '<line x1="' + left + '" y1="' + (baseline+42) + '" x2="' + totalX2 + '" y2="' + (baseline+42) + '" class="visual-ground"/>' +
      '<text x="' + left + '" y="204" class="visual-note">' + nodeInfo + '</text>' +
    '</svg></div>';
}

function renderScheme(result) {
  const active = result.sections.filter(item => item.active);
  if (!active.length) {
    $('schemeList').innerHTML = '<div class="empty-state">Добавьте длину участка, чтобы увидеть схему.</div>';
    return;
  }

  $('schemeList').innerHTML = active.map(item => {
    const outerFence = Math.max(0, item.fenceLength - (item.betweenOpeningFence || 0));
    const bridgeText = item.betweenOpeningFence > 0
      ? (item.bridgeExtraPosts > 0
          ? number(item.betweenOpeningFence) + ' м · ' + item.bridgeSpans + ' прол. · +' + item.bridgeExtraPosts + ' столб'
          : number(item.betweenOpeningFence) + ' м · без доп. столба')
      : '';
    const supportPostText = item.openingSupportPosts
      ? item.openingSupportPosts + ' × ' + (POST_LABELS[item.openingPostType] || item.openingPostType)
      : '—';

    return '<article class="scheme-card visual-scheme-card">' +
      '<div class="scheme-top"><div><b>Участок ' + item.index + '</b><small>условная раскладка по линии</small></div><span>' + number(item.grossLength) + ' × ' + number(item.height) + ' м</span></div>' +
      renderVisualSvg(item, result) +
      '<button class="scheme-zoom-button" type="button" data-scheme-zoom aria-pressed="false"><span>Увеличить схему</span><i aria-hidden="true">↔</i></button>' +
      '<div class="visual-summary">' +
        '<div><small>Забор всего</small><b>' + number(item.fenceLength) + ' м</b></div>' +
        (item.openingSupportPosts ? '<div><small>Ворота</small><b>' + (item.gateOpening > 0 ? number(item.gateOpening) + ' м' : '—') + '</b></div>' : '') +
        (item.openingSupportPosts ? '<div><small>Калитка</small><b>' + (item.wicketOpening > 0 ? number(item.wicketOpening) + ' м' : '—') + '</b></div>' : '') +
        (item.openingSupportPosts ? '<div><small>Столбы узла</small><b>' + supportPostText + '</b></div>' : '') +
        (bridgeText ? '<div class="visual-summary-wide"><small>Забор между воротами и калиткой</small><b>' + bridgeText + '</b></div>' : '') +
        (outerFence > 0 && item.openingSupportPosts ? '<div><small>Остальной забор</small><b>' + number(outerFence) + ' м</b></div>' : '') +
      '</div>' +
      (item.sharedPost ? '<div class="shared-note">Последний столб забора общий со следующим участком.</div>' : '') +
      '<div class="visual-layout-note">Порядок элементов показан условно; введённые размеры и количество столбов используются в расчёте.</div>' +
    '</article>';
  }).join('');
}


function initSchemeInteractions() {
  const list = $('schemeList');
  if (list && !list.dataset.zoomReady) {
    list.dataset.zoomReady = '1';
    list.addEventListener('click', event => {
      const button = event.target.closest('[data-scheme-zoom]');
      if (!button) return;
      const card = button.closest('.visual-scheme-card');
      const scroller = card?.querySelector('.visual-line-scroll');
      if (!scroller) return;
      const zoomed = scroller.classList.toggle('is-zoomed');
      button.setAttribute('aria-pressed', String(zoomed));
      const text = button.querySelector('span');
      if (text) text.textContent = zoomed ? 'Показать целиком' : 'Увеличить схему';
      if (!zoomed) scroller.scrollTo({left:0,behavior:'smooth'});
    });
  }

  if (schemeSection && mobileQuoteBar && !schemeSection.dataset.quoteObserverReady && 'IntersectionObserver' in window) {
    schemeSection.dataset.quoteObserverReady = '1';
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      const mobile = window.matchMedia('(max-width:620px)').matches;
      mobileQuoteBar.classList.toggle('is-suppressed', mobile && entry.isIntersecting && entry.intersectionRatio > 0.12);
    }, {threshold:[0,0.12,0.35]});
    observer.observe(schemeSection);
    window.addEventListener('resize', () => {
      if (!window.matchMedia('(max-width:620px)').matches) mobileQuoteBar.classList.remove('is-suppressed');
    }, {passive:true});
  }
}

initSchemeInteractions();

function row(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function renderInternal(result) {
  const panel = $('internalPanel');
  panel.hidden = !isDev;
  if (!isDev) return;

  initInternalToggle();
  if (internalOverview) {
    internalOverview.innerHTML = [
      `<span><b>${result.summary.picketsActual}</b> штакетин</span>`,
      `<span><b>${result.purchase.tubeStocks}</b> хлыстов 40×20</span>`,
      `<span><b>${result.purchase.posts}</b> новых столбов</span>`,
      `<span><b>${money(result.costs.total)}</b> итог</span>`
    ].join('');
  }

  const active = result.sections.filter(item => item.active);
  $('specTable').innerHTML = `
    <thead><tr><th>Участок</th><th>Длина</th><th>Высота</th><th>Прол.</th><th>Чистый</th><th>Перед/прол.</th><th>Зад/прол.</th><th>Перед факт</th><th>Зад факт</th><th>Зазор</th><th>40×20</th><th>Хлыстов</th><th>Новых столбов</th></tr></thead>
    <tbody>${active.map(item => `<tr>
      <td>${item.index}</td><td>${number(item.length)}</td><td>${number(item.height)}</td><td>${item.spans}</td>
      <td>${number(item.clearSpan)}</td><td>${item.frontPerSpan}</td><td>${item.rearPerSpan}</td>
      <td>${item.frontActual}</td><td>${item.rearActual}</td><td>${number(item.actualGap*1000,1)} мм</td>
      <td>${number(item.tubeUsed)} м</td><td>${item.tubeStocks}</td><td>${item.newPosts}</td>
    </tr>`).join('') || '<tr><td colspan="13">Нет активных участков</td></tr>'}</tbody>`;

  $('picketTable').innerHTML = `
    <thead><tr><th>Длина</th><th>Перед факт</th><th>Зад факт</th><th>Запас перед</th><th>Запас зад</th><th>Купить перед</th><th>Купить зад</th><th>Всего</th></tr></thead>
    <tbody>${result.purchase.pickets.map(item => `<tr>
      <td>${number(item.length)} м</td><td>${item.frontActual}</td><td>${item.rearActual}</td>
      <td>${item.reserveFront}</td><td>${item.reserveRear}</td><td>${item.frontBuy}</td><td>${item.rearBuy}</td><td>${item.totalBuy}</td>
    </tr>`).join('') || '<tr><td colspan="8">Нет данных</td></tr>'}</tbody>`;

  $('materialDetails').innerHTML =
    row('Евроштакетник фактически', `${result.summary.picketsActual} шт · ${number(result.summary.picketLmActual)} п.м.`) +
    row('40×20 используется', `${number(result.purchase.tubeUsed)} м`) +
    row('40×20 купить', `${result.purchase.tubeStocks} хлыст. × 6 м`) +
    row('Остаток 40×20', `${number(result.purchase.tubeRemainder)} м`) +
    row('Столбов требуется по схеме', `${result.summary.postsByScheme} шт`) +
    row('Готовых столбов учтено', `${result.summary.existingPostsUsed} шт`) +
    row('Новых столбов', `${result.purchase.posts} шт × 3 м`) +
    row('Проёмы ворот/калитки', `${number(result.summary.openingsWidth)} м`) +
    row('Саморезы', `${result.purchase.screws} шт`);

  const c = result.costs;
  $('costDetails').innerHTML =
    row('Евроштакетник', money(c.picket)) +
    row('Проф. труба 40×20×2', money(c.tube)) +
    row('Столбы', money(c.posts)) +
    row('Материалы всего', money(c.materials)) +
    row('Покраска металла', money(c.paint)) +
    row('Работа по забору', money(c.work)) +
    row('Установка столбов', money(c.postInstall)) +
    row('Саморезы', money(c.screws)) +
    row('Стоимость заказа', money(c.order)) +
    row('ЗП замерщика 4%', money(c.measurer)) +
    row('Доставка', money(c.delivery)) +
    row('Итого', money(c.total));
}

function hideSettlementResults() {
  settlementResults.hidden = true;
  settlementResults.innerHTML = '';
}

function chooseSettlement(item) {
  selectedDelivery = item;
  settlementInput.value = item.name;
  if (leadCity) leadCity.value = item.name;
  hideSettlementResults();
  deliveryStatus.className = 'delivery-status is-ok';
  deliveryStatus.textContent = item.price > 0
    ? `${item.name}${item.secondary ? ', ' + item.secondary : ''} · доставка учтена в расчёте`
    : `${item.name}${item.secondary ? ', ' + item.secondary : ''} · доставка 0 ₽`;
  calculate();
  settlementInput.blur();
}

function settlementMatches(value) {
  const q = normalize(value);
  if (q.length < 2) return [];
  return deliveryRows
    .map(item => {
      const name = normalize(item.name);
      const secondary = normalize(item.secondary);
      let score = 99;
      if (name === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 2;
      else if (secondary.includes(q)) score = 3;
      return {item,score};
    })
    .filter(match => match.score < 99)
    .sort((a,b) => a.score-b.score || a.item.name.localeCompare(b.item.name,'ru'))
    .slice(0,8)
    .map(match => match.item);
}

function renderSettlementResults() {
  const matches = settlementMatches(settlementInput.value);
  if (!matches.length) {
    hideSettlementResults();
    return;
  }
  settlementResults.innerHTML = matches.map((item,index) => `
    <button type="button" class="settlement-option" data-settlement-index="${index}">
      <b>${item.name}</b><span>${item.secondary || 'Башкортостан'} · доставка ${money(item.price)}</span>
    </button>`).join('');
  settlementResults.hidden = false;
  [...settlementResults.querySelectorAll('[data-settlement-index]')].forEach((button,index) => {
    button.addEventListener('click', () => chooseSettlement(matches[index]));
  });
}

async function loadDeliveryBase() {
  try {
    const response = await fetch('/offline-delivery-200km.json', {cache:'no-store'});
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const rows = Array.isArray(data.destinations) ? data.destinations : (data.delivery?.destinations || []);
    deliveryRows = rows
      .map(item => ({name:String(item.name||'').trim(),secondary:String(item.secondary||'').trim(),price:Number(item.price)||0}))
      .filter(item => item.name);
  } catch {
    deliveryRows = [];
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Справочник доставки сейчас недоступен. При необходимости укажите стоимость вручную.';
  }
}

async function resolveUnknownSettlement() {
  if (manualDeliveryEnabled.checked || selectedDelivery || normalize(settlementInput.value).length < 2) return;
  const exact = deliveryRows.filter(item => normalize(item.name) === normalize(settlementInput.value));
  if (exact.length === 1) {
    chooseSettlement(exact[0]);
    return;
  }
  if (location.hostname.endsWith('github.io')) {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'В DEV-версии выберите населённый пункт из подсказки или укажите доставку вручную.';
    return;
  }
  try {
    deliveryStatus.className = 'delivery-status';
    deliveryStatus.textContent = 'Рассчитываем доставку…';
    const response = await fetch(`/api/delivery?place=${encodeURIComponent(settlementInput.value.trim())}`, {cache:'no-store'});
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    selectedDelivery = {
      name: String(data.shortName || settlementInput.value).trim(),
      secondary: String(data.district || data.region || '').trim(),
      price: Number(data.price)||0
    };
    if (leadCity) leadCity.value = selectedDelivery.name;
    deliveryStatus.className = 'delivery-status is-ok';
    deliveryStatus.textContent = `${selectedDelivery.name} · доставка учтена в расчёте`;
    calculate();
  } catch {
    deliveryStatus.className = 'delivery-status is-warn';
    deliveryStatus.textContent = 'Автоматически рассчитать не удалось. Выберите вариант из подсказки или укажите доставку вручную.';
  }
}


function renderLeadPreview(result) {
  const target = $('leadQuotePreview');
  const hasQuote = Boolean(result.summary.activeSections);
  if (leadEmptyState) leadEmptyState.hidden = hasQuote;
  if (leadReadyContent) leadReadyContent.hidden = !hasQuote;
  if (!target || !hasQuote) return;

  const locationText = selectedDelivery?.name || settlementInput.value.trim() || 'населённый пункт не выбран';
  target.innerHTML = `<b>${money(result.summary.total)}${deliveryIsKnown() ? '' : ' · без доставки'}</b><span>${number(result.summary.totalLength)} м · ${result.type.label} · ${locationText}</span>`;
}

async function loadFencePrices() {
  try {
    const response = await fetch('/api/fence-prices', {cache:'no-store',headers:{accept:'application/json'}});
    if (!response.ok) return;
    const data = await response.json();
    if (data?.fence && typeof data.fence === 'object') runtimeSettings = {...FENCE_SETTINGS,...data.fence};
  } catch {}
}

function quoteText() {
  if (!lastResult?.summary.activeSections) return '';
  const sections = lastResult.sections.filter(item => item.active).map(item => {
    const opening = item.openingNodeWidth > 0
      ? `, узел ворот/калитки ${number(item.openingNodeWidth)} м (чистые проёмы ${number(item.openingsWidth)} м + ${item.openingSupportPosts} столб. ${POST_LABELS[item.openingPostType] || item.openingPostType}${item.betweenOpeningFence > 0 ? ` + забор между ними ${number(item.betweenOpeningFence)} м, доп. столбов ${item.bridgeExtraPosts}` : ''})`
      : '';
    return `Участок ${item.index}: линия ${number(item.grossLength ?? item.length)} × ${number(item.height)} м, заполнение ${number(item.fenceLength ?? item.length)} м${opening}, ${item.spans} прол.`;
  }).join('\n');
  const postMode = includePostsInput.checked
    ? `новых ${lastResult.summary.newPosts}, готовых учтено ${lastResult.summary.existingPostsUsed || 0}`
    : 'все столбы готовые';
  const conditions = [
    hasSlopeInput?.checked ? 'заметный уклон / перепад высоты' : '',
    hasHardSurfaceInput?.checked ? 'сложное основание (бетон / асфальт / подпорная стенка)' : ''
  ].filter(Boolean);
  return [
    `Кузнечный ДворикЪ — расчёт ${ensureQuoteNumber()}`,
    'Забор из металлического евроштакетника',
    `Тип: ${lastResult.type.label}`,
    `Столбы: ${postInput.options[postInput.selectedIndex]?.textContent || postInput.value}; ${postMode}`,
    `Цвет: ${selectedColor}`,
    sections,
    `Длина линии: ${number(lastResult.summary.grossLineLength ?? lastResult.summary.totalLength)} м`,
    ...(lastResult.summary.openingNodeWidth > 0 ? [
      `Чистые проёмы: ${number(lastResult.summary.openingsWidth)} м`,
      `Столбы узлов ворот/калиток: ${lastResult.summary.openingSupportPosts} шт · занимают ${number(lastResult.summary.openingPostsWidth)} м`,
      `Узлы ворот/калиток по линии: ${number(lastResult.summary.openingNodeWidth)} м`,
      ...(lastResult.summary.betweenOpeningFence > 0 ? [`Забор между воротами и калиткой: ${number(lastResult.summary.betweenOpeningFence)} м · доп. столбов ${lastResult.summary.bridgeExtraPosts}`] : []),
      `Длина заполнения евроштакетником: ${number(lastResult.summary.totalLength)} м`
    ] : []),
    ...(conditions.length ? [`Условия монтажа: ${conditions.join('; ')} — проверить на замере`] : []),
    `Доставка: ${deliveryIsKnown() ? money(lastResult.summary.deliveryCost) : 'не указана'}`,
    `Предварительная стоимость: ${money(lastResult.summary.total)}${deliveryIsKnown() ? '' : ' без доставки'}`
  ].filter(Boolean).join('\n');
}

function leadPayload() {
  const city = (leadCity?.value || selectedDelivery?.name || settlementInput.value).trim();
  const reference = ensureQuoteNumber();
  return {
    category:'picket-fence',
    source:'site',
    article:reference,
    productTitle:'Забор из металлического евроштакетника',
    name:'',
    phone:$('leadPhone')?.value.trim() || '',
    city,
    consent:Boolean($('leadConsent')?.checked),
    policyVersion:'2026-09-25',
    comment:'',
    total:lastResult?.summary.total || 0,
    posts:includePostsInput.checked,
    message:quoteText(),
    configuration:{
      quoteNumber:reference,
      fenceType:typeInput.value,
      fenceTypeLabel:lastResult?.type.label || '',
      postType:postInput.value,
      includeNewPosts:includePostsInput.checked,
      existingPostsCount:Number(existingPostsInput?.value || 0),
      color:selectedColor,
      siteConditions:{
        slope:Boolean(hasSlopeInput?.checked),
        hardSurface:Boolean(hasHardSurfaceInput?.checked),
        needsManualReview:Boolean(hasSlopeInput?.checked || hasHardSurfaceInput?.checked)
      },
      sections:readSections().filter(item => item.length > 0),
      delivery:{known:deliveryIsKnown(),name:selectedDelivery?.name || settlementInput.value.trim(),price:deliveryCost()},
      calculationSettings:{...runtimeSettings},
      costs:lastResult ? {...lastResult.costs} : null,
      summary:lastResult ? {
        grossLineLength:lastResult.summary.grossLineLength,
        openingsWidth:lastResult.summary.openingsWidth,
        openingSupportPosts:lastResult.summary.openingSupportPosts,
        openingPostsWidth:lastResult.summary.openingPostsWidth,
        openingCoreWidth:lastResult.summary.openingCoreWidth,
        openingNodeWidth:lastResult.summary.openingNodeWidth,
        betweenOpeningFence:lastResult.summary.betweenOpeningFence,
        bridgeSpans:lastResult.summary.bridgeSpans,
        bridgeExtraPosts:lastResult.summary.bridgeExtraPosts,
        totalLength:lastResult.summary.totalLength,
        totalSpans:lastResult.summary.totalSpans,
        postsByScheme:lastResult.summary.postsByScheme,
        existingPostsUsed:lastResult.summary.existingPostsUsed,
        newPosts:lastResult.summary.newPosts,
        picketsActual:lastResult.summary.picketsActual,
        tubeStocks:lastResult.summary.tubeStocks,
        total:lastResult.summary.total
      } : null
    }
  };
}

async function submitLead(event) {
  event.preventDefault();
  if (!leadState || !leadSubmit) return;
  leadState.className = 'lead-state';
  leadState.textContent = '';
  if (!lastResult?.summary.activeSections) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Сначала укажите размеры забора.';
    return;
  }
  const payload = leadPayload();
  const digits = payload.phone.replace(/\D/g,'');
  if (digits.length < 10) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Укажите корректный номер телефона.';
    $('leadPhone')?.focus();
    return;
  }
  if (!payload.city) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Сначала выберите населённый пункт в разделе «Доставка».';
    settlementInput?.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(() => settlementInput?.focus({preventScroll:true}), 350);
    return;
  }
  if (!payload.consent) {
    leadState.classList.add('is-error');
    leadState.textContent = 'Подтвердите согласие на обработку персональных данных.';
    return;
  }

  leadSubmit.disabled = true;
  leadSubmit.textContent = 'Отправляем…';
  try {
    if (isDev) {
      await new Promise(resolve => setTimeout(resolve, 300));
      leadState.textContent = 'DEV: форма и состав заявки проверены. Реальному менеджеру заявка не отправлена.';
      showToast('DEV-заявка подготовлена');
      return;
    }
    const response = await fetch('/api/leads', {
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось отправить заявку');
    leadState.textContent = 'Заявка отправлена. Менеджер получит ваш расчёт и свяжется с вами.';
    try { localStorage.removeItem(DRAFT_QUOTE_KEY); } catch {}
    showToast('Заявка отправлена ✓');
  } catch (error) {
    leadState.classList.add('is-error');
    leadState.textContent = error?.message || 'Не удалось отправить заявку.';
  } finally {
    leadSubmit.disabled = false;
    leadSubmit.textContent = 'Заказать замер';
  }
}

addSectionButton.addEventListener('click', () => {
  if (visibleSections >= 4) return;
  visibleSections += 1;
  syncVisibleSections();
  calculate();
  const nextLength = sectionsList.querySelector(`[data-field="length"][data-index="${visibleSections-1}"]`);
  nextLength?.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(() => nextLength?.focus({preventScroll:true}), 300);
});
removeSectionButton.addEventListener('click', () => {
  if (visibleSections <= 1) return;
  const index = visibleSections - 1;
  const length = sectionsList.querySelector(`[data-field="length"][data-index="${index}"]`);
  const height = sectionsList.querySelector(`[data-field="height"][data-index="${index}"]`);
  const sharedBefore = sectionsList.querySelector(`[data-field="shared"][data-index="${index-1}"]`);
  if (length) length.value = '0';
  if (height) height.value = '1.8';
  const gateOpening = sectionsList.querySelector(`[data-field="gateOpening"][data-index="${index}"]`);
  const wicketOpening = sectionsList.querySelector(`[data-field="wicketOpening"][data-index="${index}"]`);
  if (gateOpening) gateOpening.value = '0';
  if (wicketOpening) wicketOpening.value = '0';
  setSectionValue(index, 'openingPostType', '100x100x3');
  setSectionValue(index, 'openingsSharePost', true);
  setSectionValue(index, 'betweenOpeningFence', 0);
  setSectionValue(index, 'openingStartFence', '');
  if (sharedBefore) sharedBefore.checked = false;
  visibleSections -= 1;
  syncVisibleSections();
  calculate();
});

form.addEventListener('input', event => {
  if (event.target === settlementInput) return;
  calculate();
});
form.addEventListener('change', event => {
  if (event.target === settlementInput) return;
  if (event.target === typeInput) syncTypeHelp();
  if (event.target === includePostsInput) syncPostOptions();
  calculate();
});

settlementInput.addEventListener('input', () => {
  if (leadCity) leadCity.value = settlementInput.value;
  if (selectedDelivery && normalize(selectedDelivery.name) !== normalize(settlementInput.value)) {
    selectedDelivery = null;
    deliveryStatus.className = 'delivery-status';
    deliveryStatus.textContent = 'Выберите населённый пункт из подсказки, чтобы учесть доставку.';
    calculate();
  } else {
    scheduleDraftSave();
  }
  renderSettlementResults();
});
settlementInput.addEventListener('focus', renderSettlementResults);
settlementInput.addEventListener('blur', () => setTimeout(() => {
  hideSettlementResults();
  resolveUnknownSettlement();
}, 160));
settlementInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    resolveUnknownSettlement();
    settlementInput.blur();
  }
});

manualDeliveryEnabled.addEventListener('change', () => {
  deliveryStatus.className = manualDeliveryEnabled.checked ? 'delivery-status is-warn' : 'delivery-status';
  deliveryStatus.textContent = manualDeliveryEnabled.checked
    ? 'Используется указанная вручную стоимость доставки.'
    : (selectedDelivery ? 'Используется автоматическая стоимость доставки.' : 'Выберите населённый пункт из подсказки, чтобы учесть доставку.');
  calculate();
});

document.addEventListener('click', event => {
  if (!settlementResults.contains(event.target) && event.target !== settlementInput) hideSettlementResults();
});

sectionsList.addEventListener('click', event => {
  const button = event.target.closest('[data-preset-field][data-index][data-value]');
  if (!button) return;
  const field = button.dataset.presetField;
  const index = button.dataset.index;
  const input = sectionsList.querySelector(`[data-field="${field}"][data-index="${index}"]`);
  if (!input) return;
  input.value = String(button.dataset.value || '');
  calculate();
});

document.querySelectorAll('.type-card[data-type]').forEach(card => card.addEventListener('click', () => {
  typeInput.value = card.dataset.type;
  syncTypePicker();
  calculate();
}));
document.querySelectorAll('.color-choice[data-color]').forEach(button => button.addEventListener('click', () => {
  selectedColor = button.dataset.color || 'Графит';
  syncColorPicker();
  calculate();
}));
resultLeadButton?.addEventListener('click', () => {
  if (lastResult?.summary.activeSections) {
    scrollToLead();
    return;
  }
  const firstLength = sectionsList.querySelector('[data-field="length"][data-index="0"]');
  firstLength?.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(() => firstLength?.focus({preventScroll:true}), 350);
});
$('mobileLeadButton')?.addEventListener('click', scrollToLead);
$('copyQuote')?.addEventListener('click', async () => {
  const text = quoteText();
  if (!text) { showToast('Сначала укажите размеры'); return; }
  try { await navigator.clipboard.writeText(text); showToast('Расчёт скопирован'); }
  catch { showToast('Не удалось скопировать автоматически'); }
});
$('shareQuote')?.addEventListener('click', shareQuoteState);
$('saveQuote')?.addEventListener('click', saveQuoteState);
$('restoreQuote')?.addEventListener('click', () => {
  const saved = readSavedQuote();
  if (!saved) { syncSavedQuoteBar(); showToast('Сохранённый расчёт не найден'); return; }
  restoreQuoteState(saved);
  showToast('Сохранённый расчёт восстановлен');
});
$('printQuote')?.addEventListener('click', () => {
  if (!lastResult?.summary.activeSections) { showToast('Сначала укажите размеры'); return; }
  window.print();
});
leadForm?.addEventListener('submit', submitLead);
leadBackToCalc?.addEventListener('click', () => {
  const firstLength = sectionsList.querySelector('[data-field="length"][data-index="0"]');
  firstLength?.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(() => firstLength?.focus({preventScroll:true}), 350);
});

syncVisibleSections();
syncTypePicker();
syncColorPicker();
syncPostOptions();
syncSavedQuoteBar();
await Promise.all([loadDeliveryBase(), loadFencePrices()]);
const sharedState = decodeQuoteState(new URL(location.href).searchParams.get('q'));
if (sharedState && restoreQuoteState(sharedState, {fromLink:true})) {
  // shared links are authoritative
} else {
  const draftState = readDraftQuote();
  if (!draftState || !restoreQuoteState(draftState, {fromDraft:true})) calculate();
}
