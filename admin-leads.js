(() => {
  const nav = document.querySelector('.admin-tabs');
  const shell = document.querySelector('.editor-shell');
  if (!nav || !shell) return;

  const tab = document.createElement('button');
  tab.className = 'admin-tab';
  tab.type = 'button';
  tab.dataset.adminTab = 'leads';
  tab.textContent = '📥 Заявки';
  nav.prepend(tab);

  const panel = document.createElement('section');
  panel.className = 'admin-tab-panel';
  panel.id = 'leadsTab';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="page-title">
      <div><p class="eyebrow">Заявки с сайта</p><h1>Клиенты и расчёты</h1></div>
      <p>Заявки с сайта сохраняются здесь сразу после отправки клиентом.</p>
    </div>
    <div class="lead-toolbar">
      <div class="lead-stats" id="leadStats"></div>
      <div class="lead-toolbar-actions">
        <button class="reset-button" id="exportLeadsCsv" type="button">Экспорт выборки CSV</button>
        <button class="reset-button" id="backupLeadsJson" type="button">Полный резерв JSON</button>
        <button class="reset-button" id="enableLeadNotifications" type="button">🔔 Уведомления</button>
        <button class="reset-button" id="reloadLeadsButton" type="button">Обновить</button>
      </div>
    </div>
    <div class="lead-search-panel">
      <label class="lead-search-main"><span>Поиск</span><input id="leadSearchInput" type="search" placeholder="Имя, телефон, населённый пункт, артикул…" autocomplete="off"></label>
      <label><span>Источник</span><select id="leadSourceFilter"><option value="">Все источники</option></select></label>
      <label><span>С даты</span><input id="leadDateFrom" type="date"></label>
      <label><span>По дату</span><input id="leadDateTo" type="date"></label>
      <button class="reset-button lead-clear-filters" id="clearLeadFilters" type="button">Сбросить</button>
    </div>
    <p class="lead-export-note" id="leadExportNote"></p>
    <div class="lead-filters" id="leadFilters">
      <button class="active" data-lead-filter="all" type="button">Все</button>
      <button data-lead-filter="new" type="button">Новые</button>
      <button data-lead-filter="contacted" type="button">Связались</button>
      <button data-lead-filter="done" type="button">Закрытые</button>
      <button data-lead-filter="archived" type="button">Архив</button>
    </div>
    <div class="lead-list" id="leadList"></div>
    <p class="empty-photos" id="emptyLeads" hidden>По выбранным условиям заявок нет.</p>
    <div class="lead-more-wrap"><button class="reset-button" id="loadMoreLeads" type="button" hidden>Показать ещё</button></div>`;
  shell.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .lead-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.lead-toolbar-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.lead-stats{display:flex;gap:8px;flex-wrap:wrap}.lead-stat{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:10px;font-weight:800}.lead-stat b{color:var(--ink)}
    .lead-search-panel{display:grid;grid-template-columns:minmax(260px,2fr) minmax(160px,1fr) minmax(135px,.75fr) minmax(135px,.75fr) auto;gap:8px;align-items:end;margin:0 0 12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#faf8f4}.lead-search-panel label{display:grid;gap:5px}.lead-search-panel label>span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}.lead-search-panel input,.lead-search-panel select{width:100%;height:40px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;font-size:11px}.lead-search-panel input:focus,.lead-search-panel select:focus{outline:2px solid rgba(198,147,63,.22);border-color:#c6933f}.lead-clear-filters{height:40px}
    .lead-export-note{margin:0 0 13px;padding:9px 11px;border:1px solid #e6c990;border-radius:10px;background:#fff8e9;color:#6c5427;font-size:10px;line-height:1.45}
    .lead-filters{display:flex;gap:7px;overflow:auto;margin-bottom:16px;padding-bottom:2px}.lead-filters button{min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:11px;font-weight:800;white-space:nowrap}.lead-filters button.active{background:var(--ink);border-color:var(--ink);color:#fff}
    .lead-list{display:grid;gap:10px}.lead-card{padding:16px;border:1px solid #e2ddd4;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(18,16,13,.045)}.lead-card.is-new{border-color:rgba(198,147,63,.52);box-shadow:0 0 0 1px rgba(198,147,63,.12),0 10px 30px rgba(18,16,13,.045)}
    .lead-card-head{display:flex;align-items:start;justify-content:space-between;gap:18px;margin-bottom:13px}.lead-main{display:grid;gap:4px}.lead-main b{font-size:15px}.lead-main span{color:var(--muted);font-size:10px}.lead-total{font:20px Prata,serif;color:#8a6326;white-space:nowrap}
    .lead-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.lead-field{display:grid;gap:3px;padding:9px 10px;border-radius:10px;background:#f7f4ef}.lead-field span{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.4px}.lead-field b{font-size:11px;word-break:break-word}
    .lead-note{margin:0 0 12px;padding:10px 12px;border-left:3px solid #d1a95f;background:#faf7f1;color:#5f584f;font-size:11px;line-height:1.55}.lead-card-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.lead-contact-actions{display:flex;gap:7px}.lead-contact-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:11px;font-weight:800}.lead-contact-actions a:first-child{background:var(--ink);border-color:var(--ink);color:#fff}
    .lead-status{height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:11px;font-weight:800}.lead-details{margin-top:10px}.lead-details summary{cursor:pointer;color:var(--muted);font-size:10px;font-weight:800}.lead-details pre{overflow:auto;max-height:220px;margin:8px 0 0;padding:10px;border-radius:10px;background:#111315;color:#eee8de;font:10px/1.5 monospace;white-space:pre-wrap}.lead-more-wrap{display:flex;justify-content:center;padding:16px 0 4px}.lead-more-wrap .reset-button{min-width:180px}
    @media(max-width:1050px){.lead-search-panel{grid-template-columns:2fr 1fr 1fr 1fr}.lead-clear-filters{grid-column:1/-1;width:100%}}
    @media(max-width:900px){.lead-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-search-panel{grid-template-columns:1fr 1fr}.lead-search-main{grid-column:1/-1}}
    @media(max-width:620px){.lead-toolbar{align-items:stretch;flex-direction:column}.lead-toolbar-actions{display:grid;grid-template-columns:1fr 1fr}.lead-toolbar .reset-button{width:100%}.lead-search-panel{grid-template-columns:1fr}.lead-search-main{grid-column:auto}.lead-clear-filters{grid-column:auto}.lead-card{padding:13px}.lead-card-head{gap:8px}.lead-total{font-size:17px}.lead-grid{grid-template-columns:1fr 1fr}.lead-card-actions{align-items:stretch;flex-direction:column}.lead-contact-actions{display:grid;grid-template-columns:1fr 1fr}.lead-status{width:100%}}
  `;
  document.head.append(style);

  const list = panel.querySelector('#leadList');
  const empty = panel.querySelector('#emptyLeads');
  const stats = panel.querySelector('#leadStats');
  const reloadButton = panel.querySelector('#reloadLeadsButton');
  const loadMoreButton = panel.querySelector('#loadMoreLeads');
  const notificationButton = panel.querySelector('#enableLeadNotifications');
  const exportCsvButton = panel.querySelector('#exportLeadsCsv');
  const backupJsonButton = panel.querySelector('#backupLeadsJson');
  const exportNote = panel.querySelector('#leadExportNote');
  const searchInput = panel.querySelector('#leadSearchInput');
  const sourceFilter = panel.querySelector('#leadSourceFilter');
  const dateFrom = panel.querySelector('#leadDateFrom');
  const dateTo = panel.querySelector('#leadDateTo');
  const clearFiltersButton = panel.querySelector('#clearLeadFilters');
  const filters = [...panel.querySelectorAll('[data-lead-filter]')];
  let leads = [];
  let activeFilter = 'all';
  let loaded = false;
  let latestLeadId = 0;
  let nextBeforeId = null;
  let hasMore = false;
  let totalCount = 0;
  let filteredTotal = 0;
  let pollingTimer = 0;
  let searchTimer = 0;

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0) + ' ₽';
  const formatDate = value => {
    const date = new Date(String(value).replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'});
  };
  const statusLabel = status => ({new:'Новая',contacted:'Связались',done:'Закрыта',archived:'Архив'})[status] || status;
  const categoryLabel = category => ({gates:'Ворота с калиткой',canopy:'Автомобильный навес','forged-fence':'Кованый забор','profsheet-fence':'Забор из профнастила','picket-fence':'Евроштакетник'})[category] || 'Изделие';
  const configLabel = key => ({width:'ширина',height:'высота',length:'длина',wicketWidth:'калитка',wicketHeight:'высота калитки',type:'тип',roof:'кровля',color:'цвет'})[key] || key;
  const phoneDigits = value => String(value || '').replace(/\D/g, '');

  function hasUnsavedChanges() {
    return [...document.querySelectorAll('#saveButton,#savePricesButton,#saveCatalogButton,#saveSiteSettingsButton')].some(button => !button.disabled);
  }

  function currentFilters() {
    return {
      q: searchInput.value.trim(),
      source: sourceFilter.value,
      from: dateFrom.value,
      to: dateTo.value
    };
  }

  function hasExtraFilters() {
    const {q, source, from, to} = currentFilters();
    return Boolean(q || source || from || to);
  }

  function renderStats(counts = {}) {
    const newCount=Number(counts.new)||0;
    stats.innerHTML = `<span class="lead-stat">Новые <b>${newCount}</b></span><span class="lead-stat">Связались <b>${Number(counts.contacted)||0}</b></span><span class="lead-stat">Закрытые <b>${Number(counts.done)||0}</b></span><span class="lead-stat">Архив <b>${Number(counts.archived)||0}</b></span>`;
    tab.textContent = newCount ? `📥 Заявки · ${newCount}` : '📥 Заявки';
  }

  function notifyArrivals(items) {
    if (!items.length) return;
    showToast(items.length===1?'Получена новая заявка':`Новых заявок: ${items.length}`);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lead=items[0];
    try { new Notification(items.length===1?'Новая заявка с сайта':`Новых заявок: ${items.length}`, {body:`${categoryLabel(lead.category||'gates')} · ${lead.city} · ${money(lead.total)}`, tag:`lead-${lead.id}`}); } catch {}
  }

  function syncNotificationButton() {
    if (!notificationButton) return;
    if (!('Notification' in window)) { notificationButton.hidden=true; return; }
    notificationButton.textContent = Notification.permission==='granted' ? '🔔 Включены' : Notification.permission==='denied' ? '🔕 Запрещены' : '🔔 Уведомления';
    notificationButton.disabled = Notification.permission==='denied';
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function leadsUrl({beforeId=null, limit=50, status=activeFilter, useFilters=true} = {}) {
    const params = new URLSearchParams({limit:String(limit)});
    if (beforeId) params.set('before_id', String(beforeId));
    if (status && status !== 'all') params.set('status', status);
    if (useFilters) {
      const {q, source, from, to} = currentFilters();
      if (q) params.set('q', q);
      if (source) params.set('source', source);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return `/api/admin/leads?${params.toString()}`;
  }

  function syncSourceOptions(items = []) {
    const current = sourceFilter.value;
    const options = ['<option value="">Все источники</option>'];
    for (const item of items) {
      const value = String(item?.value || '').trim();
      if (!value) continue;
      options.push(`<option value="${escape(value)}">${escape(value)}${Number(item.count) ? ` · ${Number(item.count)}` : ''}</option>`);
    }
    sourceFilter.innerHTML = options.join('');
    if ([...sourceFilter.options].some(option => option.value === current)) sourceFilter.value = current;
  }

  async function fetchAllLeads({filtered=true} = {}) {
    const all = [];
    const seen = new Set();
    let cursor = null;
    let guard = 0;
    while (guard < 10000) {
      guard += 1;
      const data = await api(leadsUrl({beforeId:cursor, limit:200, status:filtered?activeFilter:'all', useFilters:filtered}));
      const page = Array.isArray(data.leads) ? data.leads : [];
      for (const lead of page) {
        const id = Number(lead.id);
        if (!seen.has(id)) {
          seen.add(id);
          all.push(lead);
        }
      }
      if (!data.page?.hasMore || !data.page?.nextBeforeId) break;
      if (Number(data.page.nextBeforeId) === Number(cursor)) throw new Error('Сервер вернул повторяющийся курсор заявок');
      cursor = data.page.nextBeforeId;
    }
    if (guard >= 10000) throw new Error('Превышен безопасный предел страниц при экспорте');
    return all;
  }

  async function runFullExport(button, mode) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = mode === 'csv' ? 'Собираем выборку…' : 'Собираем все заявки…';
    try {
      const exportFiltered = mode === 'csv';
      const allLeads = await fetchAllLeads({filtered:exportFiltered});
      if (!allLeads.length) return showToast('Нет заявок для экспорта', true);
      const date = new Date().toISOString().slice(0,10);
      if (mode === 'csv') {
        const columns = ['id','created_at','status','name','phone','city','category','article','product_title','width','height','wicket_width','wicket_height','install','posts','total','client_total','quote_verified','delivery_pending','delivery_out_of_area','delivery_distance_km','source','comment','message'];
        const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [columns.join(';'), ...allLeads.map(lead => columns.map(key => quote(lead[key])).join(';'))];
        downloadText(`kuznechny-dvorik-leads-${date}.csv`, '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
        showToast(`Экспортировано заявок: ${allLeads.length}`);
      } else {
        const payload = {exportedAt:new Date().toISOString(), complete:true, count:allLeads.length, leads:allLeads};
        downloadText(`kuznechny-dvorik-leads-backup-${date}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
        showToast(`Полный резерв сохранён: ${allLeads.length} заявок`);
      }
    } catch (error) {
      showToast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function render() {
    empty.hidden = leads.length > 0;
    list.innerHTML = leads.map(lead => {
      const category=lead.category||'gates';
      const categoryName=categoryLabel(category);
      const dimensions = [lead.width ? `${lead.width} м` : '', lead.height ? `× ${lead.height} м` : ''].filter(Boolean).join(' ');
      const wicket = [lead.wicket_width ? `${lead.wicket_width} м` : '', lead.wicket_height ? `× ${lead.wicket_height} м` : ''].filter(Boolean).join(' ') || '—';
      const options = [lead.install ? 'монтаж' : '', lead.posts ? 'новые столбы' : '', lead.color || ''].filter(Boolean).join(' · ') || 'без дополнительных опций';
      const config=lead.configuration&&typeof lead.configuration==='object'?lead.configuration:{};
      const genericParams=Object.entries(config).filter(([key,value])=>value!==null&&value!==''&&value!==false&&!['article','install','posts'].includes(key)).slice(0,5).map(([key,value])=>`${configLabel(key)}: ${value}`).join(' · ') || '—';
      const digits = phoneDigits(lead.phone);
      const productLine=[categoryName,lead.article].filter(Boolean).join(' · ');
      const sourceLine=lead.source?` · ${lead.source}`:'';
      const fieldTwoLabel=category==='gates'?'Ворота':'Параметры';
      const fieldTwoValue=category==='gates'?(dimensions||'—'):genericParams;
      const fieldThreeLabel=category==='gates'?'Калитка':'Изделие';
      const fieldThreeValue=category==='gates'?wicket:(lead.product_title||categoryName);
      return `<article class="lead-card ${lead.status==='new'?'is-new':''}" data-lead-id="${lead.id}">
        <div class="lead-card-head"><div class="lead-main"><b>#${lead.id} · ${escape(productLine)} · ${escape(lead.name || 'Без имени')}</b><span>${escape(formatDate(lead.created_at))} · ${escape(lead.city)}${escape(sourceLine)}</span></div><strong class="lead-total">${money(lead.total)}</strong></div>
        <div class="lead-grid">
          <div class="lead-field"><span>Телефон</span><b>${escape(lead.phone)}</b></div>
          <div class="lead-field"><span>${escape(fieldTwoLabel)}</span><b>${escape(fieldTwoValue)}</b></div>
          <div class="lead-field"><span>${escape(fieldThreeLabel)}</span><b>${escape(fieldThreeValue)}</b></div>
          <div class="lead-field"><span>Комплектация</span><b>${escape(options)}</b></div>
        </div>
        ${lead.comment?`<p class="lead-note">${escape(lead.comment)}</p>`:''}
        <div class="lead-card-actions">
          <div class="lead-contact-actions"><a href="tel:+${digits}">Позвонить</a><a href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a></div>
          <select class="lead-status" aria-label="Статус заявки ${lead.id}">${['new','contacted','done','archived'].map(status=>`<option value="${status}" ${lead.status===status?'selected':''}>${statusLabel(status)}</option>`).join('')}</select>
        </div>
        <details class="lead-details"><summary>Показать текст расчёта</summary><pre>${escape(lead.message)}</pre></details>
      </article>`;
    }).join('');

    loadMoreButton.hidden = !hasMore;
    const statusScope = activeFilter === 'all' ? 'всего' : `в статусе «${statusLabel(activeFilter)}»`;
    const filteredLabel = hasExtraFilters() ? ' по выбранным условиям' : '';
    exportNote.textContent = `Показано ${leads.length} из ${filteredTotal} ${statusScope}${filteredLabel}. CSV сохраняет текущую выборку; JSON — полный резерв всех заявок.`;

    list.querySelectorAll('.lead-status').forEach(select => select.addEventListener('change', async () => {
      const card = select.closest('[data-lead-id]');
      const id = Number(card.dataset.leadId);
      select.disabled = true;
      try {
        await api(`/api/admin/leads/${id}`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({status:select.value})});
        showToast('Статус заявки обновлён');
        loaded = false;
        await load(true);
      } catch (error) {
        showToast(error.message, true);
      } finally {
        select.disabled = false;
      }
    }));
  }

  async function load(reset = true, silent = false) {
    if (loaded && !reset) { render(); return; }
    if (!silent && reset) { reloadButton.disabled = true; reloadButton.textContent = 'Загружаем…'; }
    if (!silent && !reset) { loadMoreButton.disabled = true; loadMoreButton.textContent = 'Загружаем…'; }
    try {
      const data = await api(leadsUrl({beforeId:reset?null:nextBeforeId, limit:50, status:activeFilter}));
      const nextLeads = Array.isArray(data.leads) ? data.leads : [];
      const newestId = nextLeads.reduce((max,lead)=>Math.max(max,Number(lead.id)||0),0);
      const arrivals = reset && activeFilter === 'all' && !hasExtraFilters() && latestLeadId ? nextLeads.filter(lead => Number(lead.id)>latestLeadId) : [];
      leads = reset ? nextLeads : [...leads, ...nextLeads.filter(lead => !leads.some(current => Number(current.id) === Number(lead.id)))];
      nextBeforeId = data.page?.nextBeforeId || null;
      hasMore = Boolean(data.page?.hasMore);
      totalCount = Number(data.totalCount) || 0;
      filteredTotal = Number(data.filteredTotal ?? totalCount) || 0;
      renderStats(data.counts || {});
      syncSourceOptions(data.sources || []);
      if (activeFilter === 'all' && !hasExtraFilters() && newestId > latestLeadId) latestLeadId = newestId;
      loaded = true;
      render();
      notifyArrivals(arrivals);
    } catch (error) {
      if (!silent) showToast(error.message, true);
    } finally {
      if (!silent && reset) { reloadButton.disabled = false; reloadButton.textContent = 'Обновить'; }
      if (!silent && !reset) { loadMoreButton.disabled = false; loadMoreButton.textContent = 'Показать ещё'; }
    }
  }

  async function applyLeadFilters() {
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      showToast('Дата начала не может быть позже даты окончания', true);
      return;
    }
    loaded = false;
    nextBeforeId = null;
    hasMore = false;
    await load(true);
  }

  filters.forEach(button => button.addEventListener('click', async () => {
    filters.forEach(item => item.classList.toggle('active', item === button));
    activeFilter = button.dataset.leadFilter;
    await applyLeadFilters();
  }));
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(applyLeadFilters, 350);
  });
  searchInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    clearTimeout(searchTimer);
    applyLeadFilters();
  });
  sourceFilter.addEventListener('change', applyLeadFilters);
  dateFrom.addEventListener('change', applyLeadFilters);
  dateTo.addEventListener('change', applyLeadFilters);
  clearFiltersButton.addEventListener('click', async () => {
    searchInput.value = '';
    sourceFilter.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    await applyLeadFilters();
  });
  reloadButton.addEventListener('click', () => load(true));
  loadMoreButton.addEventListener('click', () => load(false));
  exportCsvButton?.addEventListener('click', () => runFullExport(exportCsvButton, 'csv'));
  backupJsonButton?.addEventListener('click', () => runFullExport(backupJsonButton, 'json'));
  notificationButton?.addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    try { await Notification.requestPermission(); } catch {}
    syncNotificationButton();
  });
  syncNotificationButton();

  tab.addEventListener('click', event => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      showToast('Сначала сохраните изменения в текущем разделе', true);
      return;
    }
    document.querySelectorAll('.admin-tab-panel').forEach(item => item.hidden = item !== panel);
    nav.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item === tab));
    load(true);
  });

  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button || button === tab || panel.hidden) return;
    panel.hidden = true;
    tab.classList.remove('active');
  });

  window.addEventListener('admin:ready', () => {
    document.querySelectorAll('.admin-tab-panel').forEach(item => { item.hidden = item !== panel; });
    nav.querySelectorAll('.admin-tab').forEach(item => item.classList.toggle('active', item === tab));
    load(true);
    if (!pollingTimer) pollingTimer = window.setInterval(() => { if (activeFilter === 'all' && !hasExtraFilters()) load(true, true); }, 30000);
  });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && activeFilter === 'all' && !hasExtraFilters()) load(true,true); });
})();
