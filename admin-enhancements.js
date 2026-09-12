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

  // Existing admin sections were historically added by independent scripts. Reconcile their final state
  // after every tab click so transitions such as “Заявки → Фото” can never leave an empty editor.
  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button) return;
    const name = button.dataset.adminTab;
    queueMicrotask(() => reconcileTab(name));
  });

  const priceCard = document.querySelector('#pricesTab .settings-card:nth-of-type(2)');
  if (priceCard && !priceCard.querySelector('[data-price-baseline-note]')) {
    const note = document.createElement('p');
    note.dataset.priceBaselineNote = 'true';
    note.className = 'admin-baseline-note';
    note.innerHTML = '<b>Важно:</b> цена изделия — это базовая цена стандартного размера 3,4 × 1,8 м + калитка 1 × 1,8 м. После сохранения калькулятор и серверный расчёт автоматически используют её как базу для этой модели.';
    priceCard.querySelector('.panel-heading')?.after(note);
  }

  const style = document.createElement('style');
  style.textContent = `
    .admin-baseline-note{margin:-5px 0 15px;padding:11px 12px;border:1px solid #dfc791;border-radius:11px;background:#fff8e8;color:#67532c;font-size:10.5px;line-height:1.5}.admin-baseline-note b{color:#7b5720}
    .lead-marketing{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:0 0 12px}.lead-marketing>div{display:grid;gap:2px;padding:8px 9px;border:1px dashed #ddd1bb;border-radius:9px;background:#fffaf0}.lead-marketing span{color:var(--muted);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}.lead-marketing b{font-size:9.5px;word-break:break-word}.lead-marketing-empty{grid-column:1/-1;color:var(--muted);font-size:9.5px}
    @media(max-width:900px){.lead-marketing{grid-template-columns:1fr 1fr}}@media(max-width:620px){.lead-marketing{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const leadsPanel = document.getElementById('leadsTab');
  const leadsList = document.getElementById('leadList');
  const toolbar = leadsPanel?.querySelector('.lead-toolbar-actions');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

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

  const trackingOf = lead => lead?.configuration?.tracking && typeof lead.configuration.tracking === 'object'
    ? lead.configuration.tracking : {};

  function trackingCell(label, value) {
    return `<div><span>${escape(label)}</span><b>${escape(value || '—')}</b></div>`;
  }

  let enhanceTimer = 0;
  async function enhanceVisibleLeadCards() {
    if (!leadsList || leadsPanel?.hidden) return;
    const cards = [...leadsList.querySelectorAll('[data-lead-id]')];
    if (!cards.length) return;
    try {
      const data = await fetchLeadPage(currentLeadQuery(200));
      const byId = new Map((data.leads || []).map(lead => [String(lead.id), lead]));
      for (const card of cards) {
        const lead = byId.get(card.dataset.leadId);
        if (!lead) continue;
        card.querySelector('.lead-marketing')?.remove();
        const tracking = trackingOf(lead);
        const block = document.createElement('div');
        block.className = 'lead-marketing';
        const hasTracking = tracking.utmSource || tracking.utmCampaign || tracking.utmContent || tracking.utmTerm || tracking.yclid || tracking.gclid || tracking.referrer;
        block.innerHTML = hasTracking
          ? [
              trackingCell('Источник', tracking.utmSource || lead.source),
              trackingCell('Кампания', tracking.utmCampaign),
              trackingCell('Объявление', tracking.utmContent),
              trackingCell('Ключ / запрос', tracking.utmTerm),
              tracking.yclid ? trackingCell('yclid', tracking.yclid) : '',
              tracking.gclid ? trackingCell('gclid', tracking.gclid) : '',
              tracking.referrer ? trackingCell('Реферер', tracking.referrer) : '',
              tracking.landingPage ? trackingCell('Страница входа', tracking.landingPage) : ''
            ].join('')
          : '<span class="lead-marketing-empty">Рекламные метки для этой заявки не переданы.</span>';
        const grid = card.querySelector('.lead-grid');
        if (grid) grid.after(block);
      }
    } catch {}
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceVisibleLeadCards, 120);
  }

  if (leadsList) new MutationObserver(scheduleEnhance).observe(leadsList, {childList:true});
  nav.addEventListener('click', event => {
    if (event.target.closest('[data-admin-tab="leads"]')) setTimeout(enhanceVisibleLeadCards, 180);
  });

  function csvQuote(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function download(filename, text) {
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
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

  if (toolbar && !document.getElementById('exportLeadsMarketingCsv')) {
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
})();