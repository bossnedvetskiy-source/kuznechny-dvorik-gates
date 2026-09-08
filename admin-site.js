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
      <p>Телефон, WhatsApp, сроки, гарантия и основные тексты меняются здесь и публикуются сразу после сохранения.</p>
    </div>

    <form id="siteSettingsForm" class="site-settings-form">
      <section class="settings-card">
        <div class="panel-heading"><div><span>Контакты</span><h2>Связь с клиентами</h2></div></div>
        <div class="site-settings-grid two">
          <label>Телефон на сайте<input id="sitePhoneDisplay" type="text" maxlength="40" required></label>
          <label>Телефон для звонка, только цифры<input id="sitePhoneDigits" type="text" inputmode="numeric" maxlength="20" required></label>
          <label>WhatsApp, только цифры<input id="siteWhatsappDigits" type="text" inputmode="numeric" maxlength="20" required></label>
          <label>График работы<input id="siteBusinessHours" type="text" maxlength="100" required></label>
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
        <p class="settings-hint">Тариф ₽/км применяется к населённым пунктам, которых нет в фиксированном списке доставки.</p>
      </section>

      <section class="settings-card">
        <div class="panel-heading"><div><span>Первый экран</span><h2>Главный оффер</h2></div></div>
        <div class="site-settings-grid one">
          <label>Строка над заголовком<input id="siteHeroEyebrow" type="text" maxlength="120" required></label>
          <div class="site-settings-grid two nested">
            <label>Главный заголовок<input id="siteHeroTitleMain" type="text" maxlength="120" required></label>
            <label>Вторая строка заголовка<input id="siteHeroTitleAccent" type="text" maxlength="120" required></label>
          </div>
          <label>Описание<textarea id="siteHeroText" maxlength="320" rows="3" required></textarea></label>
        </div>
      </section>

      <section class="settings-card">
        <div class="panel-heading"><div><span>Доверие и финальный блок</span><h2>Тексты страницы</h2></div></div>
        <div class="site-settings-grid one">
          <label>Текст о производстве и гарантиях<textarea id="siteTrustText" maxlength="500" rows="4" required></textarea></label>
          <label>Заголовок финального блока<input id="siteFinalCtaTitle" type="text" maxlength="180" required></label>
          <label>Описание финального блока<textarea id="siteFinalCtaText" maxlength="320" rows="3" required></textarea></label>
        </div>
      </section>

      <div class="action-bar price-action-bar">
        <span class="save-state" id="siteSettingsSaveState">Настройки загружены</span>
        <button class="primary-button save-button" id="saveSiteSettingsButton" type="submit" disabled>Сохранить настройки</button>
      </div>
    </form>`;
  shell.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .site-settings-form{display:grid;gap:0}.site-settings-grid{display:grid;gap:14px}.site-settings-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.site-settings-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.site-settings-grid.one{grid-template-columns:1fr}.site-settings-grid.nested{margin:0}
    .site-settings-grid label{display:grid;gap:7px;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.55px}
    .site-settings-grid input,.site-settings-grid textarea{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:15px;font-weight:700;outline:none;text-transform:none;letter-spacing:0;resize:vertical}
    .site-settings-grid input{height:46px}.site-settings-grid input:focus,.site-settings-grid textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(198,147,63,.13)}
    .settings-hint{margin:13px 0 0;color:var(--muted);font-size:10px;line-height:1.55}
    @media(max-width:900px){.site-settings-grid.four{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.site-settings-grid.two,.site-settings-grid.four{grid-template-columns:1fr}.site-settings-grid input,.site-settings-grid textarea{font-size:16px}}
  `;
  document.head.append(style);

  const form = panel.querySelector('#siteSettingsForm');
  const saveButton = panel.querySelector('#saveSiteSettingsButton');
  const saveState = panel.querySelector('#siteSettingsSaveState');
  const oldTabs = [...nav.querySelectorAll('.admin-tab')].filter(button => button !== tab);

  const fields = {
    phoneDisplay: panel.querySelector('#sitePhoneDisplay'),
    phoneDigits: panel.querySelector('#sitePhoneDigits'),
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

  function setDirty(value = true) {
    siteDirty = value;
    saveButton.disabled = !value;
    saveState.textContent = value ? 'Есть несохранённые изменения' : 'Все настройки сохранены';
    saveState.classList.toggle('dirty', value);
  }

  function fill(settings) {
    siteSettings = settings;
    for (const [key, input] of Object.entries(fields)) {
      input.value = settings[key] ?? '';
    }
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
      saveState.textContent = 'Не удалось загрузить настройки';
      showToast(error.message, true);
    } finally {
      loading = false;
    }
  }

  function collect() {
    return {
      phoneDisplay: fields.phoneDisplay.value.trim(),
      phoneDigits: fields.phoneDigits.value.replace(/\D/g, ''),
      whatsappDigits: fields.whatsappDigits.value.replace(/\D/g, ''),
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

  Object.values(fields).forEach(input => input.addEventListener('input', () => setDirty()));

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
    panel.hidden = true;
    tab.classList.remove('active');
  }, true));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!siteSettings || !siteDirty) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Сохраняем…';
    try {
      const data = await api('/api/admin/site-settings', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({site: collect()})
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
