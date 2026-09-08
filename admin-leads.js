(() => {
  const nav = document.querySelector('.admin-tabs');
  const shell = document.querySelector('.editor-shell');
  if (!nav || !shell) return;

  const tab = document.createElement('button');
  tab.className = 'admin-tab';
  tab.type = 'button';
  tab.dataset.adminTab = 'leads';
  tab.textContent = '📥 Заявки';
  nav.append(tab);

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
      <button class="reset-button" id="reloadLeadsButton" type="button">Обновить</button>
    </div>
    <div class="lead-filters" id="leadFilters">
      <button class="active" data-lead-filter="all" type="button">Все</button>
      <button data-lead-filter="new" type="button">Новые</button>
      <button data-lead-filter="contacted" type="button">Связались</button>
      <button data-lead-filter="done" type="button">Закрытые</button>
      <button data-lead-filter="archived" type="button">Архив</button>
    </div>
    <div class="lead-list" id="leadList"></div>
    <p class="empty-photos" id="emptyLeads" hidden>Заявок пока нет.</p>`;
  shell.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .lead-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.lead-stats{display:flex;gap:8px;flex-wrap:wrap}.lead-stat{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:10px;font-weight:800}.lead-stat b{color:var(--ink)}
    .lead-filters{display:flex;gap:7px;overflow:auto;margin-bottom:16px;padding-bottom:2px}.lead-filters button{min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:11px;font-weight:800;white-space:nowrap}.lead-filters button.active{background:var(--ink);border-color:var(--ink);color:#fff}
    .lead-list{display:grid;gap:10px}.lead-card{padding:16px;border:1px solid #e2ddd4;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(18,16,13,.045)}.lead-card.is-new{border-color:rgba(198,147,63,.52);box-shadow:0 0 0 1px rgba(198,147,63,.12),0 10px 30px rgba(18,16,13,.045)}
    .lead-card-head{display:flex;align-items:start;justify-content:space-between;gap:18px;margin-bottom:13px}.lead-main{display:grid;gap:4px}.lead-main b{font-size:15px}.lead-main span{color:var(--muted);font-size:10px}.lead-total{font:20px Prata,serif;color:#8a6326;white-space:nowrap}
    .lead-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.lead-field{display:grid;gap:3px;padding:9px 10px;border-radius:10px;background:#f7f4ef}.lead-field span{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.4px}.lead-field b{font-size:11px;word-break:break-word}
    .lead-note{margin:0 0 12px;padding:10px 12px;border-left:3px solid #d1a95f;background:#faf7f1;color:#5f584f;font-size:11px;line-height:1.55}.lead-card-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.lead-contact-actions{display:flex;gap:7px}.lead-contact-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:11px;font-weight:800}.lead-contact-actions a:first-child{background:var(--ink);border-color:var(--ink);color:#fff}
    .lead-status{height:38px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:11px;font-weight:800}.lead-details{margin-top:10px}.lead-details summary{cursor:pointer;color:var(--muted);font-size:10px;font-weight:800}.lead-details pre{overflow:auto;max-height:220px;margin:8px 0 0;padding:10px;border-radius:10px;background:#111315;color:#eee8de;font:10px/1.5 monospace;white-space:pre-wrap}
    @media(max-width:900px){.lead-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.lead-toolbar{align-items:stretch;flex-direction:column}.lead-toolbar .reset-button{width:100%}.lead-card{padding:13px}.lead-card-head{gap:8px}.lead-total{font-size:17px}.lead-grid{grid-template-columns:1fr 1fr}.lead-card-actions{align-items:stretch;flex-direction:column}.lead-contact-actions{display:grid;grid-template-columns:1fr 1fr}.lead-status{width:100%}}
  `;
  document.head.append(style);

  const list = panel.querySelector('#leadList');
  const empty = panel.querySelector('#emptyLeads');
  const stats = panel.querySelector('#leadStats');
  const reloadButton = panel.querySelector('#reloadLeadsButton');
  const filters = [...panel.querySelectorAll('[data-lead-filter]')];
  let leads = [];
  let activeFilter = 'all';
  let loaded = false;

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0) + ' ₽';
  const formatDate = value => {
    const date = new Date(String(value).replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'});
  };
  const statusLabel = status => ({new:'Новая',contacted:'Связались',done:'Закрыта',archived:'Архив'})[status] || status;
  const phoneDigits = value => String(value || '').replace(/\D/g, '');

  function hasUnsavedChanges() {
    return [...document.querySelectorAll('#saveButton,#savePricesButton,#saveCatalogButton,#saveSiteSettingsButton')].some(button => !button.disabled);
  }

  function renderStats(counts = {}) {
    stats.innerHTML = `<span class="lead-stat">Новые <b>${Number(counts.new)||0}</b></span><span class="lead-stat">Связались <b>${Number(counts.contacted)||0}</b></span><span class="lead-stat">Закрытые <b>${Number(counts.done)||0}</b></span>`;
  }

  function render() {
    const shown = activeFilter === 'all' ? leads : leads.filter(lead => lead.status === activeFilter);
    empty.hidden = shown.length > 0;
    list.innerHTML = shown.map(lead => {
      const dimensions = [lead.width ? `${lead.width} м` : '', lead.height ? `× ${lead.height} м` : ''].filter(Boolean).join(' ');
      const wicket = [lead.wicket_width ? `${lead.wicket_width} м` : '', lead.wicket_height ? `× ${lead.wicket_height} м` : ''].filter(Boolean).join(' ') || '—';
      const options = [lead.install ? 'монтаж' : '', lead.posts ? 'новые столбы' : '', lead.color || ''].filter(Boolean).join(' · ') || 'без дополнительных опций';
      const digits = phoneDigits(lead.phone);
      return `<article class="lead-card ${lead.status==='new'?'is-new':''}" data-lead-id="${lead.id}">
        <div class="lead-card-head"><div class="lead-main"><b>#${lead.id} · ${escape(lead.article)} · ${escape(lead.name || 'Без имени')}</b><span>${escape(formatDate(lead.created_at))} · ${escape(lead.city)}</span></div><strong class="lead-total">${money(lead.total)}</strong></div>
        <div class="lead-grid">
          <div class="lead-field"><span>Телефон</span><b>${escape(lead.phone)}</b></div>
          <div class="lead-field"><span>Ворота</span><b>${escape(dimensions || '—')}</b></div>
          <div class="lead-field"><span>Калитка</span><b>${escape(wicket)}</b></div>
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

  async function load(force = false) {
    if (loaded && !force) { render(); return; }
    reloadButton.disabled = true;
    reloadButton.textContent = 'Загружаем…';
    try {
      const data = await api('/api/admin/leads');
      leads = Array.isArray(data.leads) ? data.leads : [];
      renderStats(data.counts || {});
      loaded = true;
      render();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      reloadButton.disabled = false;
      reloadButton.textContent = 'Обновить';
    }
  }

  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(item => item.classList.toggle('active', item === button));
    activeFilter = button.dataset.leadFilter;
    render();
  }));
  reloadButton.addEventListener('click', () => load(true));

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
})();
