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
    const name = button.dataset.adminTab;
    queueMicrotask(() => reconcileTab(name));
  });

  const priceCard = document.querySelector('#pricesTab .settings-card:nth-of-type(2)');
  if (priceCard && !priceCard.querySelector('[data-price-baseline-note]')) {
    const note = document.createElement('p');
    note.dataset.priceBaselineNote = 'true';
    note.className = 'admin-baseline-note';
    note.innerHTML = '<b>Источник цен ворот — Excel.</b> Цены артикулов и перерасчёт по размерам формируются только из расчётного Excel-файла и его формул. Вручную менять цену модели в админке нельзя; здесь можно менять только отдельные настройки вроде монтажа и столбов.';
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

(() => {
  const panel = document.getElementById('leadsTab');
  const list = document.getElementById('leadList');
  if (!panel || !list) return;

  const style = document.createElement('style');
  style.textContent = `
    .lead-quick-work{display:grid;grid-template-columns:minmax(190px,.7fr) minmax(260px,1.8fr) auto;gap:8px;align-items:end;margin:0 0 12px;padding:10px;border:1px solid #e4ddd2;border-radius:11px;background:#fcfaf6}
    .lead-quick-work label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}
    .lead-quick-work input,.lead-quick-work textarea{width:100%;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:11px;text-transform:none;letter-spacing:0}
    .lead-quick-work input{height:39px;padding:0 9px}.lead-quick-work textarea{min-height:54px;padding:8px 9px;resize:vertical}
    .lead-quick-save{min-height:39px;padding:0 13px;border:0;border-radius:9px;background:var(--ink);color:#fff;font-size:10px;font-weight:900;white-space:nowrap}
    @media(max-width:760px){.lead-quick-work{grid-template-columns:1fr}.lead-quick-save{width:100%}}
  `;
  document.head.append(style);

  let loading = false;
  let timer = 0;

  async function getWorkflows(ids) {
    const response = await fetch(`/api/admin/lead-workflows?ids=${encodeURIComponent(ids.join(','))}`, {cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить заметки');
    return response.json();
  }

  async function enhance() {
    if (loading || panel.hidden) return;
    const cards = [...list.querySelectorAll('[data-lead-id]')].filter(card => !card.querySelector('.lead-quick-work'));
    const ids = cards.map(card => Number(card.dataset.leadId)).filter(Boolean);
    if (!ids.length) return;
    loading = true;
    try {
      const data = await getWorkflows(ids);
      for (const card of cards) {
        const id = Number(card.dataset.leadId);
        const item = data.workflows?.[id] || {stage:'new',note:'',nextActionAt:'',lossReason:''};
        const box = document.createElement('div');
        box.className = 'lead-quick-work';
        box.dataset.workflowStage = item.stage || 'new';
        box.dataset.lossReason = item.lossReason || '';
        box.innerHTML = `<label>Дата и время замера<input type="datetime-local" data-measurement-date></label><label>Заметка<textarea data-manager-note maxlength="1200" placeholder="Например: созвониться после 18:00"></textarea></label><button class="lead-quick-save" type="button">Сохранить</button>`;
        box.querySelector('[data-measurement-date]').value = String(item.nextActionAt || '');
        box.querySelector('[data-manager-note]').value = String(item.note || '');
        box.querySelector('.lead-quick-save').addEventListener('click', () => save(card, box));
        const details = card.querySelector('.lead-details');
        if (details) details.before(box); else card.append(box);
      }
    } catch (error) {
      console.warn('Lead note enhancement failed', error);
    } finally {
      loading = false;
    }
  }

  async function save(card, box) {
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

  const schedule = () => { clearTimeout(timer); timer = setTimeout(enhance, 60); };
  new MutationObserver(schedule).observe(list, {childList:true});
  document.querySelector('.admin-tabs')?.addEventListener('click', event => {
    if (event.target.closest('[data-admin-tab="leads"]')) setTimeout(enhance, 120);
  });
  window.addEventListener('admin:ready', () => setTimeout(enhance, 100));
  setTimeout(enhance, 100);
})();

(() => {
  const panel = document.getElementById('leadsTab');
  const list = document.getElementById('leadList');
  if (!panel || !list) return;

  const style = document.createElement('style');
  style.textContent = `
    .lead-toolbar-actions.lead-toolbar-compact{display:flex;align-items:center;gap:8px}.lead-more-actions{position:relative}.lead-more-actions>summary{display:flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:10px;font-weight:800;cursor:pointer;list-style:none}.lead-more-actions>summary::-webkit-details-marker{display:none}.lead-more-menu{position:absolute;z-index:30;right:0;top:calc(100% + 6px);display:grid;gap:6px;min-width:205px;padding:8px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(18,16,13,.14)}.lead-more-menu .reset-button{width:100%;text-align:left}.lead-marketing.is-compact{grid-template-columns:repeat(3,minmax(0,1fr))}.lead-marketing.is-compact:empty{display:none}
    @media(max-width:620px){.lead-toolbar-actions.lead-toolbar-compact{display:grid;grid-template-columns:1fr 1fr}.lead-toolbar-actions.lead-toolbar-compact>#reloadLeadsButton,.lead-toolbar-actions.lead-toolbar-compact>.lead-more-actions{width:100%}.lead-more-actions>summary{width:100%}.lead-more-menu{position:fixed;left:12px;right:12px;top:auto;bottom:14px;min-width:0}.lead-marketing.is-compact{grid-template-columns:1fr 1fr}}
  `;
  document.head.append(style);

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
    if (lower.includes('yandex') || lower.includes('ya.ru') || lower === 'yandex') return 'Яндекс';
    if (lower.includes('vk.com') || lower === 'vk' || lower.includes('vkontakte')) return 'ВКонтакте';
    if (lower.includes('ok.ru') || lower.includes('odnoklassniki')) return 'Одноклассники';
    if (lower.includes('avito')) return 'Авито';
    if (lower.startsWith('ref:')) return 'Переход из приложения';
    return raw;
  }

  function compactToolbar() {
    const toolbar = panel.querySelector('.lead-toolbar-actions');
    if (!toolbar || toolbar.querySelector('.lead-more-actions')) return;
    const details = document.createElement('details');
    details.className = 'lead-more-actions';
    details.innerHTML = '<summary>Ещё</summary><div class="lead-more-menu"></div>';
    const menu = details.querySelector('.lead-more-menu');
    for (const id of ['exportLeadsMarketingCsv','exportLeadsCsv','backupLeadsJson','enableLeadNotifications']) {
      const button = document.getElementById(id);
      if (button) menu.append(button);
    }
    toolbar.append(details);
    toolbar.classList.add('lead-toolbar-compact');
    details.addEventListener('click', event => {
      if (event.target.closest('button')) details.open = false;
    });
  }

  function simplifySourceFilter() {
    const select = document.getElementById('leadSourceFilter');
    if (!select) return;
    for (const option of [...select.options].slice(1)) {
      const count = option.textContent.match(/\s·\s\d+$/)?.[0] || '';
      const label = sourceLabel(option.value);
      const next = `${label}${count}`;
      if (option.textContent !== next) option.textContent = next;
    }
  }

  function simplifyCard(card) {
    const fields = [...card.querySelectorAll('.lead-field')];
    const phoneField = fields.find(field => field.querySelector('span')?.textContent.trim() === 'Телефон');
    const phone = phoneField?.querySelector('b');
    if (phone) {
      const formatted = phoneDisplay(phone.textContent);
      if (formatted && phone.textContent !== formatted) phone.textContent = formatted;
    }

    const meta = card.querySelector('.lead-main span');
    if (meta) {
      const parts = meta.textContent.split(' · ');
      const last = parts.at(-1) || '';
      if (/^(ref:|google$|yandex$|vk$|avito$)/i.test(last) || /googlequicksearchbox|yandex|vk\.com|ok\.ru|avito/i.test(last)) {
        const next = sourceLabel(last);
        if (next !== last) {
          parts[parts.length - 1] = next;
          meta.textContent = parts.join(' · ');
        }
      }
    }

    const block = card.querySelector('.lead-marketing');
    if (!block) return;
    block.classList.add('is-compact');
    for (const cell of [...block.querySelectorAll(':scope > div')]) {
      const label = cell.querySelector('span')?.textContent.trim() || '';
      const valueNode = cell.querySelector('b');
      const value = valueNode?.textContent.trim() || '';
      if (!value || value === '—') {
        cell.remove();
        continue;
      }
      if (label === 'Источник' && valueNode) {
        const friendly = sourceLabel(value);
        if (valueNode.textContent !== friendly) valueNode.textContent = friendly;
        continue;
      }
      if (label === 'Реферер' || label === 'Страница входа') cell.remove();
    }
    const emptyMessage = block.querySelector('.lead-marketing-empty');
    if (emptyMessage) emptyMessage.textContent = 'Рекламных меток нет.';
  }

  let timer = 0;
  function simplify() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      compactToolbar();
      simplifySourceFilter();
      list.querySelectorAll('[data-lead-id]').forEach(simplifyCard);
    }, 80);
  }

  new MutationObserver(simplify).observe(list, {childList:true,subtree:true});
  const sourceFilter = document.getElementById('leadSourceFilter');
  if (sourceFilter) new MutationObserver(simplifySourceFilter).observe(sourceFilter, {childList:true});
  document.querySelector('.admin-tabs')?.addEventListener('click', event => {
    if (event.target.closest('[data-admin-tab="leads"]')) setTimeout(simplify, 150);
  });
  window.addEventListener('admin:ready', () => setTimeout(simplify, 120));
  setTimeout(simplify, 250);
})();