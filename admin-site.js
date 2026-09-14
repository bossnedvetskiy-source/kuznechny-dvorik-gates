(() => {
  const nav = document.querySelector('.admin-tabs');
  const shell = document.querySelector('.editor-shell');
  if (!nav || !shell) return;

  const tab = document.createElement('button');
  tab.className = 'admin-tab';
  tab.type = 'button';
  tab.dataset.adminTab = 'settings';
  tab.textContent = '⚙️ Настройки';
  nav.append(tab);

  const panel = document.createElement('section');
  panel.className = 'admin-tab-panel';
  panel.id = 'settingsTab';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="page-title">
      <div>
        <p class="eyebrow">Управление сайтом</p>
        <h1>Тексты и контакты</h1>
      </div>
      <p>Контакты, сроки и тексты сайта. Изменения публикуются после сохранения.</p>
    </div>

    <form id="siteSettingsForm" class="site-settings-form">
      <section class="settings-card">
        <div class="panel-heading"><div><span>Контакты</span><h2>Связь с клиентами</h2></div></div>
        <div class="site-settings-grid two">
          <label>Телефон<input id="sitePhoneDisplay" type="text" maxlength="40" required></label>
          <label>WhatsApp<input id="siteWhatsappDigits" type="text" inputmode="tel" maxlength="24" required></label>
          <label class="site-settings-wide">График работы<input id="siteBusinessHours" type="text" maxlength="100" required></label>
        </div>
      </section>

      <section class="settings-card">
        <div class="panel-heading"><div><span>Условия работы</span><h2>Сроки, гарантия и доставка</h2></div></div>
        <div class="site-settings-grid four">
          <label>Гарантия, лет<input id="siteWarrantyYears" type="number" min="1" max="20" step="1" inputmode="numeric" required></label>
          <label>Срок изготовления, раб. дней<input id="siteProductionDays" type="number" min="1" max="365" step="1" inputmode="numeric" required></label>
          <label>Радиус выезда, км<input id="siteServiceAreaKm" type="number" min="0" max="1000" step="1" inputmode="numeric" required></label>
          <label>Доставка для новых пунктов, ₽/км<input id="siteDeliveryRate" type="number" min="0" max="5000" step="1" inputmode="numeric" required></label>
        </div>
        <p class="settings-hint" id="siteDeliveryHint">Для населённых пунктов без фиксированной цены применяется тариф ₽/км.</p>
      </section>

      <details class="settings-card site-settings-collapsible">
        <summary class="site-settings-summary">
          <div><span>Страница ворот</span><h2>Главный оффер</h2></div>
          <span class="site-settings-summary-action">Изменить</span>
        </summary>
        <div class="site-settings-collapsible-body">
          <div class="site-settings-grid one">
            <label>Строка над заголовком<input id="siteHeroEyebrow" type="text" maxlength="120" required></label>
            <div class="site-settings-grid two nested">
              <label>Главный заголовок<input id="siteHeroTitleMain" type="text" maxlength="120" required></label>
              <label>Вторая строка заголовка<input id="siteHeroTitleAccent" type="text" maxlength="120" required></label>
            </div>
            <label>Описание<textarea id="siteHeroText" maxlength="320" rows="2" required></textarea></label>
          </div>
        </div>
      </details>

      <details class="settings-card site-settings-collapsible">
        <summary class="site-settings-summary">
          <div><span>Доверие и финальный блок</span><h2>Тексты страницы</h2></div>
          <span class="site-settings-summary-action">Изменить</span>
        </summary>
        <div class="site-settings-collapsible-body">
          <div class="site-settings-grid one">
            <label>Текст о производстве и гарантиях<textarea id="siteTrustText" maxlength="500" rows="2" required></textarea></label>
            <label>Заголовок финального блока<input id="siteFinalCtaTitle" type="text" maxlength="180" required></label>
            <label>Описание финального блока<textarea id="siteFinalCtaText" maxlength="320" rows="2" required></textarea></label>
          </div>
        </div>
      </details>

      <div class="action-bar price-action-bar site-settings-action" hidden>
        <span class="save-state" id="siteSettingsSaveState">Все настройки сохранены</span>
        <button class="primary-button save-button" id="saveSiteSettingsButton" type="submit" disabled>Сохранить настройки</button>
      </div>
    </form>`;
  shell.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .site-settings-form{display:grid;gap:0}.site-settings-grid{display:grid;gap:14px}.site-settings-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.site-settings-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.site-settings-grid.one{grid-template-columns:1fr}.site-settings-grid.nested{margin:0}.site-settings-wide{grid-column:1/-1}
    .site-settings-grid label{display:grid;gap:7px;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.55px}
    .site-settings-grid input,.site-settings-grid textarea{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:15px;font-weight:700;outline:none;text-transform:none;letter-spacing:0;resize:vertical}
    .site-settings-grid input{height:46px}.site-settings-grid textarea{min-height:68px;line-height:1.35;transition:min-height .16s ease}.site-settings-grid textarea:focus{min-height:112px}.site-settings-grid input:focus,.site-settings-grid textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(198,147,63,.13)}
    .settings-hint{margin:13px 0 0;color:var(--muted);font-size:10px;line-height:1.55}
    .site-settings-collapsible{padding:0;overflow:hidden}.site-settings-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;cursor:pointer;list-style:none}.site-settings-summary::-webkit-details-marker{display:none}.site-settings-summary>div{display:grid;gap:3px}.site-settings-summary span:first-child{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.55px}.site-settings-summary h2{margin:0;font-family:Prata,serif;font-size:24px;font-weight:400}.site-settings-summary-action{padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font-size:9px;font-weight:800;white-space:nowrap}.site-settings-collapsible[open] .site-settings-summary-action{font-size:0}.site-settings-collapsible[open] .site-settings-summary-action::after{content:'Свернуть';font-size:9px}.site-settings-collapsible-body{padding:0 22px 22px;border-top:1px solid #eee9e1}.site-settings-collapsible-body>.site-settings-grid{padding-top:18px}
    .site-settings-action[hidden]{display:none!important}.site-settings-action{position:sticky;z-index:14;bottom:10px;margin-top:4px}
    @media(max-width:900px){.site-settings-grid.four{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){
      #settingsTab .page-title{gap:9px;margin-bottom:18px}#settingsTab .page-title h1{font-size:29px;line-height:1.08}#settingsTab .page-title>p{font-size:11px;line-height:1.5}
      #settingsTab .settings-card{margin-bottom:12px;padding:15px;border-radius:16px}#settingsTab details.settings-card{padding:0}
      .site-settings-grid.two,.site-settings-grid.four{grid-template-columns:1fr}.site-settings-wide{grid-column:auto}.site-settings-grid{gap:10px}.site-settings-grid input,.site-settings-grid textarea{font-size:16px}.site-settings-grid input{height:43px}.site-settings-grid textarea{min-height:64px}.site-settings-grid textarea:focus{min-height:105px}
      .site-settings-summary{padding:14px 15px}.site-settings-summary h2{font-size:22px}.site-settings-collapsible-body{padding:0 15px 15px}.site-settings-collapsible-body>.site-settings-grid{padding-top:14px}
      .settings-hint{margin-top:9px;font-size:9.5px}.site-settings-action{bottom:8px;padding:10px!important}
    }
  `;
  document.head.append(style);

  const form = panel.querySelector('#siteSettingsForm');
  const saveButton = panel.querySelector('#saveSiteSettingsButton');
  const saveState = panel.querySelector('#siteSettingsSaveState');
  const actionBar = panel.querySelector('.site-settings-action');
  const deliveryHint = panel.querySelector('#siteDeliveryHint');
  const oldTabs = [...nav.querySelectorAll('.admin-tab')].filter(button => button !== tab);

  const fields = {
    phoneDisplay: panel.querySelector('#sitePhoneDisplay'),
    whatsappDigits: panel.querySelector('#siteWhatsappDigits'),
    businessHours: panel.querySelector('#siteBusinessHours'),
    warrantyYears: panel.querySelector('#siteWarrantyYears'),
    productionDays: panel.querySelector('#siteProductionDays'),
    serviceAreaKm: panel.querySelector('#siteServiceAreaKm'),
    deliveryRate: panel.querySelector('#siteDeliveryRate'),
    heroEyebrow: panel.querySelector('#siteHeroEyebrow'),
    heroTitleMain: panel.querySelector('#siteHeroTitleMain'),
    heroTitleAccent: panel.querySelector('#siteHeroTitleAccent'),
    heroText: panel.querySelector('#siteHeroText'),
    trustText: panel.querySelector('#siteTrustText'),
    finalCtaTitle: panel.querySelector('#siteFinalCtaTitle'),
    finalCtaText: panel.querySelector('#siteFinalCtaText')
  };

  let loaded = false;
  let loading = false;
  let siteDirty = false;
  let siteSettings = null;

  const hasOtherDirty = () =>
    (typeof dirty !== 'undefined' && dirty) ||
    (typeof priceDirty !== 'undefined' && priceDirty) ||
    (typeof catalogDirty !== 'undefined' && catalogDirty);

  const activeTabStorageKey = 'kuzdvor-admin-active-tab-v1';
  const validTabNames = new Set(['leads', 'catalog', 'prices', 'photos', 'settings']);

  function rememberActiveTab(name) {
    if (!validTabNames.has(name)) return;
    try { window.sessionStorage.setItem(activeTabStorageKey, name); } catch {}
  }

  function rememberedActiveTab() {
    try {
      const name = window.sessionStorage.getItem(activeTabStorageKey) || '';
      return validTabNames.has(name) ? name : '';
    } catch {
      return '';
    }
  }

  nav.addEventListener('click', event => {
    const button = event.target.closest('.admin-tab');
    if (!button) return;
    queueMicrotask(() => {
      if (button.classList.contains('active')) rememberActiveTab(button.dataset.adminTab || '');
    });
  });

  window.addEventListener('admin:ready', () => {
    const name = rememberedActiveTab();
    if (!name) return;
    window.requestAnimationFrame(() => {
      const button = nav.querySelector(`.admin-tab[data-admin-tab="${name}"]`);
      if (!button || button.classList.contains('active')) return;
      button.click();
    });
  });

  function normalizePhoneDigits(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    if (digits.length === 10) digits = `7${digits}`;
    return digits;
  }

  function updateDeliveryHint() {
    const rate = Number(fields.deliveryRate.value);
    deliveryHint.textContent = Number.isFinite(rate) && rate >= 0
      ? `Для населённых пунктов без фиксированной цены: ${rate.toLocaleString('ru-RU')} ₽/км.`
      : 'Для населённых пунктов без фиксированной цены применяется тариф ₽/км.';
  }

  function setDirty(value = true) {
    siteDirty = value;
    saveButton.disabled = !value;
    saveState.textContent = value ? 'Есть несохранённые изменения' : 'Все настройки сохранены';
    saveState.classList.toggle('dirty', value);
    actionBar.hidden = !value;
  }

  function fill(settings) {
    siteSettings = settings;
    for (const [key, input] of Object.entries(fields)) input.value = settings[key] ?? '';
    updateDeliveryHint();
    setDirty(false);
  }

  async function load(force = false) {
    if (loading || (loaded && !force)) return;
    loading = true;
    saveState.textContent = 'Загружаем настройки…';
    try {
      const data = await api('/api/admin/site-settings');
      fill(data.site);
      loaded = true;
    } catch (error) {
      actionBar.hidden = false;
      saveState.textContent = 'Не удалось загрузить настройки';
      showToast(error.message, true);
    } finally {
      loading = false;
    }
  }

  function collect() {
    const phoneDisplay = fields.phoneDisplay.value.trim();
    return {
      phoneDisplay,
      phoneDigits: normalizePhoneDigits(phoneDisplay),
      whatsappDigits: normalizePhoneDigits(fields.whatsappDigits.value),
      businessHours: fields.businessHours.value.trim(),
      warrantyYears: Number(fields.warrantyYears.value),
      productionDays: Number(fields.productionDays.value),
      serviceAreaKm: Number(fields.serviceAreaKm.value),
      deliveryRate: Number(fields.deliveryRate.value),
      heroEyebrow: fields.heroEyebrow.value.trim(),
      heroTitleMain: fields.heroTitleMain.value.trim(),
      heroTitleAccent: fields.heroTitleAccent.value.trim(),
      heroText: fields.heroText.value.trim(),
      trustText: fields.trustText.value.trim(),
      finalCtaTitle: fields.finalCtaTitle.value.trim(),
      finalCtaText: fields.finalCtaText.value.trim()
    };
  }

  Object.values(fields).forEach(input => input.addEventListener('input', () => {
    if (input === fields.deliveryRate) updateDeliveryHint();
    setDirty();
  }));

  form.addEventListener('invalid', event => {
    const details = event.target.closest('details');
    if (details) details.open = true;
  }, true);

  tab.addEventListener('click', () => {
    if (hasOtherDirty()) {
      showToast('Сначала сохраните изменения в текущем разделе', true);
      return;
    }
    document.getElementById('photosTab').hidden = true;
    document.getElementById('pricesTab').hidden = true;
    document.getElementById('catalogTab').hidden = true;
    oldTabs.forEach(button => button.classList.remove('active'));
    tab.classList.add('active');
    panel.hidden = false;
    load();
  });

  oldTabs.forEach(button => button.addEventListener('click', event => {
    if (siteDirty) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('Сначала сохраните изменения настроек', true);
      return;
    }
    if (panel.hidden) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    panel.hidden = true;
    tab.classList.remove('active');
    const target = button.dataset.adminTab;
    document.getElementById('photosTab').hidden = target !== 'photos';
    document.getElementById('pricesTab').hidden = target !== 'prices';
    document.getElementById('catalogTab').hidden = target !== 'catalog';
    oldTabs.forEach(item => item.classList.toggle('active', item === button));
    if (target === 'prices' || target === 'catalog') loadPriceSettings();
  }, true));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!siteSettings || !siteDirty) return;
    const payload = collect();
    if (!/^7\d{10}$/.test(payload.phoneDigits)) {
      showToast('Проверьте телефон: нужен российский номер из 11 цифр', true);
      fields.phoneDisplay.focus();
      return;
    }
    if (!/^7\d{10}$/.test(payload.whatsappDigits)) {
      showToast('Проверьте номер WhatsApp: нужен российский номер из 11 цифр', true);
      fields.whatsappDigits.focus();
      return;
    }
    saveButton.disabled = true;
    saveButton.textContent = 'Сохраняем…';
    try {
      const data = await api('/api/admin/site-settings', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({site: payload})
      });
      fill(data.site);
      showToast('Настройки опубликованы на сайте');
    } catch (error) {
      setDirty(true);
      showToast(error.message, true);
    } finally {
      saveButton.textContent = 'Сохранить настройки';
      saveButton.disabled = !siteDirty;
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!siteDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();