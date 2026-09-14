(() => {
  if (window.KUZDVOR_ADMIN_ENHANCEMENTS_READY) return;
  window.KUZDVOR_ADMIN_ENHANCEMENTS_READY = true;

  const nav = document.querySelector('.admin-tabs');
  if (!nav) return;

  const hasUnsavedChanges = () =>
    [...document.querySelectorAll('#saveButton,#savePricesButton,#saveCatalogButton,#saveSiteSettingsButton')]
      .some(button => button && !button.disabled);

  const panelFor = name => document.getElementById({
    photos:'photosTab', prices:'pricesTab', catalog:'catalogTab', settings:'settingsTab', leads:'leadsTab'
  }[name] || '');

  function reconcileTab(name) {
    if (!name || hasUnsavedChanges()) return;
    const panel = panelFor(name);
    if (!panel) return;
    document.querySelectorAll('.admin-tab-panel').forEach(item => { item.hidden = item !== panel; });
    nav.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item.dataset.adminTab === name));
    if ((name === 'prices' || name === 'catalog') && typeof window.loadPriceSettings === 'function') {
      window.loadPriceSettings();
    }
  }

  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button) return;
    queueMicrotask(() => {
      reconcileTab(button.dataset.adminTab);
      if (window.matchMedia?.('(max-width:620px)').matches && button.classList.contains('active')) {
        button.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
      }
    });
  });

  const safeSessionGet = key => {
    try { return window.sessionStorage.getItem(key) || ''; } catch { return ''; }
  };
  const safeSessionSet = (key, value) => {
    try { window.sessionStorage.setItem(key, String(value || '')); } catch {}
  };

  const catalogTabButton = nav.querySelector('[data-admin-tab="catalog"]');
  if (catalogTabButton) catalogTabButton.textContent = '🗂 Каталог';

  const photoArticleStorageKey = 'kuzdvor-admin-photo-article-v1';
  const articleSelect = document.getElementById('articleSelect');
  const mainPhotoGrid = document.getElementById('photoGrid');

  function restorePhotoArticle() {
    if (!articleSelect || hasUnsavedChanges()) return;
    const article = safeSessionGet(photoArticleStorageKey);
    if (!article || articleSelect.value === article) return;
    if (![...articleSelect.options].some(option => option.value === article)) return;
    articleSelect.value = article;
    articleSelect.dispatchEvent(new Event('change', {bubbles:true}));
  }

  articleSelect?.addEventListener('change', () => {
    window.setTimeout(() => {
      safeSessionSet(photoArticleStorageKey, articleSelect.value);
      mainPhotoGrid?.classList.remove('photo-actions-armed');
    }, 0);
  });

  mainPhotoGrid?.addEventListener('click', event => {
    if (!event.target.closest('.photo-thumb')) return;
    mainPhotoGrid.classList.add('photo-actions-armed');
  });

  window.addEventListener('admin:ready', () => {
    window.requestAnimationFrame(() => window.setTimeout(restorePhotoArticle, 0));
  });

  const priceCard = document.querySelector('#pricesTab .settings-card:nth-of-type(2)');
  if (priceCard && !priceCard.querySelector('[data-price-baseline-note]')) {
    const note = document.createElement('p');
    note.dataset.priceBaselineNote = 'true';
    note.className = 'admin-baseline-note';
    note.innerHTML = '<b>Источник цен ворот — Excel.</b> Цены артикулов и перерасчёт по размерам формируются только из расчётного Excel-файла и его формул. Вручную менять цену модели в админке нельзя; здесь можно менять только отдельные настройки вроде монтажа и столбов.';
    priceCard.querySelector('.panel-heading')?.after(note);
  }

  const leadsPanel = document.getElementById('leadsTab');
  const leadsList = document.getElementById('leadList');
  if (!leadsPanel || !leadsList) return;

  const leadViewStorageKey = 'kuzdvor-admin-lead-view-v1';
  let restoringLeadView = false;

  function leadViewState() {
    return {
      status: document.querySelector('[data-lead-filter].active')?.dataset.leadFilter || 'all',
      q: document.getElementById('leadSearchInput')?.value || '',
      source: document.getElementById('leadSourceFilter')?.value || '',
      from: document.getElementById('leadDateFrom')?.value || '',
      to: document.getElementById('leadDateTo')?.value || ''
    };
  }

  function rememberLeadView() {
    if (restoringLeadView) return;
    try { window.sessionStorage.setItem(leadViewStorageKey, JSON.stringify(leadViewState())); } catch {}
  }

  function savedLeadView() {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(leadViewStorageKey) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function restoreLeadView(attempt = 0) {
    const saved = savedLeadView();
    if (!saved) return;
    const search = document.getElementById('leadSearchInput');
    const source = document.getElementById('leadSourceFilter');
    const from = document.getElementById('leadDateFrom');
    const to = document.getElementById('leadDateTo');
    if (!search || !source || !from || !to) return;

    const sourceReady = !saved.source || [...source.options].some(option => option.value === saved.source);
    if (!sourceReady && attempt < 12) {
      window.setTimeout(() => restoreLeadView(attempt + 1), 100);
      return;
    }

    restoringLeadView = true;
    search.value = String(saved.q || '');
    source.value = sourceReady ? String(saved.source || '') : '';
    from.value = String(saved.from || '');
    to.value = String(saved.to || '');
    const status = ['all','new','contacted','done','archived'].includes(saved.status) ? saved.status : 'all';
    const statusButton = leadsPanel.querySelector(`[data-lead-filter="${status}"]`);
    statusButton?.click();
    if (saved.source || saved.from || saved.to) leadsPanel.querySelector('.lead-search-panel')?.classList.add('is-expanded');
    window.setTimeout(() => {
      restoringLeadView = false;
      rememberLeadView();
    }, 0);
  }

  leadsPanel.addEventListener('input', event => {
    if (event.target.matches('#leadSearchInput')) rememberLeadView();
  });
  leadsPanel.addEventListener('change', event => {
    if (event.target.matches('#leadSourceFilter,#leadDateFrom,#leadDateTo')) rememberLeadView();
  });
  leadsPanel.addEventListener('click', event => {
    if (event.target.closest('[data-lead-filter],#clearLeadFilters')) window.setTimeout(rememberLeadView, 0);
  });

  const style = document.createElement('style');
  style.textContent = `
    .admin-baseline-note{margin:-5px 0 15px;padding:11px 12px;border:1px solid #dfc791;border-radius:11px;background:#fff8e8;color:#67532c;font-size:10.5px;line-height:1.5}.admin-baseline-note b{color:#7b5720}
    .lead-marketing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 12px}.lead-marketing>div{display:grid;gap:2px;padding:8px 9px;border:1px dashed #ddd1bb;border-radius:9px;background:#fffaf0}.lead-marketing span{color:var(--muted);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}.lead-marketing b{font-size:9.5px;word-break:break-word}.lead-marketing-empty{grid-column:1/-1;color:var(--muted);font-size:9.5px}
    .lead-quick-work{display:grid;grid-template-columns:minmax(190px,.7fr) minmax(260px,1.8fr) auto;gap:8px;align-items:end;margin:0 0 12px;padding:10px;border:1px solid #e4ddd2;border-radius:11px;background:#fcfaf6}.lead-quick-work label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}.lead-quick-work input,.lead-quick-work textarea{width:100%;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:11px;text-transform:none;letter-spacing:0}.lead-quick-work input{height:39px;padding:0 9px}.lead-quick-work textarea{min-height:54px;padding:8px 9px;resize:vertical}.lead-quick-save{min-height:39px;padding:0 13px;border:0;border-radius:9px;background:var(--ink);color:#fff;font-size:10px;font-weight:900;white-space:nowrap}
    .lead-toolbar-actions.lead-toolbar-compact{display:flex;align-items:center;gap:8px}.lead-more-actions{position:relative}.lead-more-actions>summary{display:flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:10px;font-weight:800;cursor:pointer;list-style:none}.lead-more-actions>summary::-webkit-details-marker{display:none}.lead-more-menu{position:absolute;z-index:30;right:0;top:calc(100% + 6px);display:grid;gap:6px;min-width:205px;padding:8px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(18,16,13,.14)}.lead-more-menu .reset-button{width:100%;text-align:left}
    .lead-filter-toggle{display:none}.lead-export-note{display:none!important}
    @media(max-width:900px){.lead-marketing{grid-template-columns:1fr 1fr}}
    @media(max-width:760px){.lead-quick-work{grid-template-columns:1fr}.lead-quick-save{width:100%}}
    @media(max-width:620px){
      .admin-tabs{display:flex!important;width:100%!important;gap:3px!important;padding:4px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
      .admin-tabs::-webkit-scrollbar{display:none}
      .admin-tabs .admin-tab{flex:0 0 auto!important;min-width:82px!important;padding:0 10px!important;font-size:11px!important;scroll-snap-align:start}
      #leadsTab .page-title h1{font-size:36px!important;line-height:1.08!important}
      #leadStats .lead-stat:nth-child(-n+4){display:none}
      .lead-toolbar-actions.lead-toolbar-compact{display:grid!important;grid-template-columns:1fr 1fr;width:100%;gap:8px}
      .lead-toolbar-actions.lead-toolbar-compact>#reloadLeadsButton,.lead-toolbar-actions.lead-toolbar-compact>.lead-more-actions{width:100%}
      .lead-toolbar-actions.lead-toolbar-compact>#reloadLeadsButton,.lead-more-actions>summary{width:100%;min-height:42px!important;padding:0 12px!important;border:1px solid var(--line)!important;border-radius:10px!important;background:#fff!important;color:var(--ink)!important;font-size:10px!important;font-weight:800!important;text-align:center!important}
      .lead-more-menu{position:fixed;left:12px;right:12px;top:auto;bottom:14px;min-width:0}
      #leadsTab .lead-search-panel{grid-template-columns:minmax(0,1fr) auto!important;align-items:end}
      #leadsTab .lead-search-main{grid-column:1/2!important;grid-row:1}
      #leadsTab .lead-filter-toggle{display:block;grid-column:2/3;grid-row:1;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:10px;font-weight:800;white-space:nowrap}
      #leadsTab .lead-search-panel:not(.is-expanded) .lead-advanced-filter{display:none!important}
      #leadsTab .lead-search-panel.is-expanded label.lead-advanced-filter{display:grid!important;grid-column:1/-1}
      #leadsTab .lead-search-panel.is-expanded button.lead-advanced-filter{display:block!important;grid-column:1/-1;width:100%}
      .lead-marketing{grid-template-columns:1fr 1fr}
    }
  `;
  document.head.append(style);

  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function phoneDisplay(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
    if (digits.length !== 10) return String(value || '');
    return `8 ${digits.slice(0,3)} ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8,10)}`;
  }

  function sourceLabel(value) {
    const raw = String(value || '').trim();
    const lower = raw.toLowerCase();
    if (!raw || lower === 'direct' || lower === 'прямой') return 'Прямой заход';
    if (lower.includes('googlequicksearchbox') || lower === 'google' || lower.includes('google.')) return 'Google';
    if (lower.includes('yandex') || lower.includes('ya.ru')) return 'Яндекс';
    if (lower.includes('vk.com') || lower === 'vk' || lower.includes('vkontakte')) return 'ВКонтакте';
    if (lower.includes('ok.ru') || lower.includes('odnoklassniki')) return 'Одноклассники';
    if (lower.includes('avito')) return 'Авито';
    if (lower.startsWith('ref:')) return 'Переход из приложения';
    return raw;
  }

  const trackingOf = lead => lead?.configuration?.tracking && typeof lead.configuration.tracking === 'object'
    ? lead.configuration.tracking : {};

  function currentLeadQuery(limit = 200, beforeId = null) {
    const params = new URLSearchParams({limit:String(limit)});
    const activeStatus = document.querySelector('[data-lead-filter].active')?.dataset.leadFilter || 'all';
    if (activeStatus !== 'all') params.set('status', activeStatus);
    const q = document.getElementById('leadSearchInput')?.value.trim();
    const source = document.getElementById('leadSourceFilter')?.value;
    const from = document.getElementById('leadDateFrom')?.value;
    const to = document.getElementById('leadDateTo')?.value;
    if (q) params.set('q', q);
    if (source) params.set('source', source);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (beforeId) params.set('before_id', String(beforeId));
    return params;
  }

  async function fetchLeadPage(params) {
    const response = await fetch(`/api/admin/leads?${params}`, {cache:'no-store'});
    if (response.status === 401) throw new Error('Сеанс завершён. Войдите снова.');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить заявки');
    return data;
  }

  function csvQuote(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function download(filename, text) {
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function fetchAllFilteredLeads() {
    const rows = [];
    let beforeId = null;
    for (let page = 0; page < 1000; page += 1) {
      const data = await fetchLeadPage(currentLeadQuery(200, beforeId));
      rows.push(...(data.leads || []));
      if (!data.hasMore || !data.nextBeforeId) break;
      beforeId = data.nextBeforeId;
    }
    return rows;
  }

  function setupMarketingExport() {
    const toolbar = leadsPanel.querySelector('.lead-toolbar-actions');
    if (!toolbar || document.getElementById('exportLeadsMarketingCsv')) return;
    const button = document.createElement('button');
    button.className = 'reset-button';
    button.id = 'exportLeadsMarketingCsv';
    button.type = 'button';
    button.textContent = 'CSV с рекламой';
    toolbar.prepend(button);
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Готовим CSV…';
      try {
        const rows = await fetchAllFilteredLeads();
        if (!rows.length) throw new Error('Нет заявок для экспорта');
        const columns = ['id','created_at','status','name','phone','city','article','color','total','source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid','gclid','referrer','landing_page','comment'];
        const lines = [columns.join(';')];
        for (const lead of rows) {
          const t = trackingOf(lead);
          const values = [lead.id,lead.created_at,lead.status,lead.name,lead.phone,lead.city,lead.article,lead.color,lead.total,lead.source,t.utmSource,t.utmMedium,t.utmCampaign,t.utmContent,t.utmTerm,t.yclid,t.gclid,t.referrer,t.landingPage,lead.comment];
          lines.push(values.map(csvQuote).join(';'));
        }
        download(`kuznechny-dvorik-marketing-${new Date().toISOString().slice(0,10)}.csv`, '\ufeff' + lines.join('\n'));
        if (typeof window.showToast === 'function') window.showToast(`Экспортировано заявок: ${rows.length}`);
      } catch (error) {
        if (typeof window.showToast === 'function') window.showToast(error.message || 'Не удалось экспортировать', true);
      } finally {
        button.disabled = false;
        button.textContent = 'CSV с рекламой';
      }
    });
  }

  function compactToolbar() {
    const toolbar = leadsPanel.querySelector('.lead-toolbar-actions');
    if (!toolbar) return;
    const reload = document.getElementById('reloadLeadsButton');
    if (reload) reload.textContent = '↻ Обновить';
    let details = toolbar.querySelector('.lead-more-actions');
    if (!details) {
      details = document.createElement('details');
      details.className = 'lead-more-actions';
      details.innerHTML = '<summary>⋯ Ещё</summary><div class="lead-more-menu"></div>';
      const menu = details.querySelector('.lead-more-menu');
      for (const id of ['exportLeadsMarketingCsv','exportLeadsCsv','backupLeadsJson','enableLeadNotifications']) {
        const button = document.getElementById(id);
        if (button) menu.append(button);
      }
      toolbar.append(details);
      details.addEventListener('click', event => {
        if (event.target.closest('button')) details.open = false;
      });
    }
    details.querySelector('summary').textContent = '⋯ Ещё';
    toolbar.classList.add('lead-toolbar-compact');
  }

  function setupFilterCollapse() {
    const searchPanel = leadsPanel.querySelector('.lead-search-panel');
    if (!searchPanel || searchPanel.querySelector('.lead-filter-toggle')) return;
    const source = document.getElementById('leadSourceFilter');
    const from = document.getElementById('leadDateFrom');
    const to = document.getElementById('leadDateTo');
    const clear = document.getElementById('clearLeadFilters');
    [source?.closest('label'), from?.closest('label'), to?.closest('label'), clear].filter(Boolean)
      .forEach(item => item.classList.add('lead-advanced-filter'));

    const toggle = document.createElement('button');
    toggle.className = 'lead-filter-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    searchPanel.append(toggle);

    const sync = () => {
      const active = [source?.value, from?.value, to?.value].filter(Boolean).length;
      toggle.textContent = active ? `Фильтры · ${active}` : 'Фильтры';
    };
    toggle.addEventListener('click', () => {
      const expanded = searchPanel.classList.toggle('is-expanded');
      toggle.setAttribute('aria-expanded', String(expanded));
    });
    [source, from, to].filter(Boolean).forEach(control => control.addEventListener('change', sync));
    clear?.addEventListener('click', () => setTimeout(sync, 0));
    sync();
  }

  function simplifySourceFilter() {
    const select = document.getElementById('leadSourceFilter');
    if (!select) return;
    for (const option of [...select.options].slice(1)) {
      const count = option.textContent.match(/\s·\s\d+$/)?.[0] || '';
      const next = `${sourceLabel(option.value)}${count}`;
      if (option.textContent !== next) option.textContent = next;
    }
  }

  function formatCardBasics(card, lead) {
    const fields = [...card.querySelectorAll('.lead-field')];
    const phoneField = fields.find(field => field.querySelector('span')?.textContent.trim() === 'Телефон');
    const phone = phoneField?.querySelector('b');
    if (phone) {
      const formatted = phoneDisplay(phone.textContent);
      if (formatted && phone.textContent !== formatted) phone.textContent = formatted;
    }
    const meta = card.querySelector('.lead-main span');
    if (meta && lead) {
      const parts = meta.textContent.split(' · ');
      const last = parts.at(-1) || '';
      const tracking = trackingOf(lead);
      const knownSources = [lead.source, tracking.utmSource].filter(Boolean).map(sourceLabel);
      if (knownSources.includes(sourceLabel(last))) {
        parts.pop();
        meta.textContent = parts.join(' · ');
      }
    }
  }

  function marketingBlock(lead) {
    const tracking = trackingOf(lead);
    const items = [
      ['Источник', sourceLabel(tracking.utmSource || lead.source)],
      ['Кампания', tracking.utmCampaign],
      ['Объявление', tracking.utmContent],
      ['Ключ / запрос', tracking.utmTerm],
      ['yclid', tracking.yclid],
      ['gclid', tracking.gclid]
    ].filter(([,value]) => String(value || '').trim());
    const block = document.createElement('div');
    block.className = 'lead-marketing';
    block.innerHTML = items.length
      ? items.map(([label,value]) => `<div><span>${escape(label)}</span><b>${escape(value)}</b></div>`).join('')
      : '<span class="lead-marketing-empty">Рекламных меток нет.</span>';
    return block;
  }

  async function getWorkflows(ids) {
    if (!ids.length) return {workflows:{}};
    const response = await fetch(`/api/admin/lead-workflows?ids=${encodeURIComponent(ids.join(','))}`, {cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить заметки');
    return response.json();
  }

  async function saveWorkflow(card, box) {
    const id = Number(card.dataset.leadId);
    const date = box.querySelector('[data-measurement-date]').value || '';
    const note = box.querySelector('[data-manager-note]').value || '';
    const button = box.querySelector('.lead-quick-save');
    let stage = String(box.dataset.workflowStage || 'new');
    if (date) stage = 'measurement_scheduled';
    else if (stage === 'measurement_scheduled') stage = 'contacted';
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    try {
      const response = await fetch(`/api/admin/lead-workflows/${id}`, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({stage,nextActionAt:date,note,lossReason:box.dataset.lossReason || ''})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить');
      box.dataset.workflowStage = data.stage || stage;
      if (date) {
        const status = card.querySelector('.lead-status');
        if (status && status.value === 'new') status.value = 'contacted';
      }
      if (typeof window.showToast === 'function') window.showToast('Замер и заметка сохранены');
    } catch (error) {
      if (typeof window.showToast === 'function') window.showToast(error.message || 'Не удалось сохранить', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Сохранить';
    }
  }

  function workflowBox(item, card) {
    const box = document.createElement('div');
    box.className = 'lead-quick-work';
    box.dataset.workflowStage = item.stage || 'new';
    box.dataset.lossReason = item.lossReason || '';
    box.innerHTML = `<label>Дата и время замера<input type="datetime-local" data-measurement-date></label><label>Заметка<textarea data-manager-note maxlength="1200" placeholder="Например: созвониться после 18:00"></textarea></label><button class="lead-quick-save" type="button">Сохранить</button>`;
    box.querySelector('[data-measurement-date]').value = String(item.nextActionAt || '');
    box.querySelector('[data-manager-note]').value = String(item.note || '');
    box.querySelector('.lead-quick-save').addEventListener('click', () => saveWorkflow(card, box));
    return box;
  }

  let enhancing = false;
  let enhanceTimer = 0;
  async function enhanceCards() {
    if (enhancing || leadsPanel.hidden) return;
    const cards = [...leadsList.querySelectorAll('[data-lead-id]')];
    if (!cards.length) return;
    enhancing = true;
    try {
      const ids = cards.map(card => Number(card.dataset.leadId)).filter(Boolean);
      const [leadData, workflowData] = await Promise.all([
        fetchLeadPage(currentLeadQuery(200)),
        getWorkflows(ids)
      ]);
      const byId = new Map((leadData.leads || []).map(lead => [String(lead.id), lead]));
      for (const card of cards) {
        const lead = byId.get(card.dataset.leadId);
        formatCardBasics(card, lead);
        if (lead) {
          card.querySelector('.lead-marketing')?.remove();
          const grid = card.querySelector('.lead-grid');
          if (grid) grid.after(marketingBlock(lead));
        }
        if (!card.querySelector('.lead-quick-work')) {
          const item = workflowData.workflows?.[Number(card.dataset.leadId)] || {stage:'new',note:'',nextActionAt:'',lossReason:''};
          const box = workflowBox(item, card);
          const details = card.querySelector('.lead-details');
          if (details) details.before(box); else card.append(box);
        }
      }
    } catch (error) {
      console.warn('Lead enhancement failed', error);
    } finally {
      enhancing = false;
    }
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceCards, 100);
  }

  setupMarketingExport();
  compactToolbar();
  setupFilterCollapse();
  simplifySourceFilter();
  document.getElementById('leadExportNote')?.setAttribute('hidden', '');

  new MutationObserver(scheduleEnhance).observe(leadsList, {childList:true});
  const sourceFilter = document.getElementById('leadSourceFilter');
  if (sourceFilter) new MutationObserver(simplifySourceFilter).observe(sourceFilter, {childList:true});
  const toolbar = leadsPanel.querySelector('.lead-toolbar-actions');
  if (toolbar) new MutationObserver(compactToolbar).observe(toolbar, {childList:true});

  nav.addEventListener('click', event => {
    if (event.target.closest('[data-admin-tab="leads"]')) {
      setTimeout(() => {
        compactToolbar();
        setupFilterCollapse();
        simplifySourceFilter();
        enhanceCards();
      }, 150);
    }
  });
  window.addEventListener('admin:ready', () => {
    setTimeout(scheduleEnhance, 100);
    setTimeout(() => restoreLeadView(), 180);
  });
  setTimeout(scheduleEnhance, 200);
})();