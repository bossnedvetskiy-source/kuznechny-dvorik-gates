(() => {
  const params = new URLSearchParams(location.search);
  const surveyId = params.get('survey') || '';
  if (params.get('surveyor') !== '1' || !surveyId) return;

  const TRANSFER_KEY = 'kd-surveyor-transfer-v1';
  const EDIT_KEY = 'kd-surveyor-edit-v1';
  const editId = params.get('edit') || '';
  const scriptUrl = new URL(document.currentScript?.src || location.href);
  const scriptPath = scriptUrl.pathname;
  const requestedReturn = params.get('returnTo') || '';
  const safeReturnPath = requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '';
  const appPath = safeReturnPath || (scriptPath.endsWith('/surveyor-bridge.js')
    ? scriptPath.replace(/\/surveyor-bridge\.js$/, '/dev-tools/')
    : scriptPath.replace(/\/calculator-bridge\.js$/, '/'));
  const returnUrl = () => {
    const target = new URL(appPath, location.origin);
    target.searchParams.set('resumeSurvey', surveyId);
    return target.pathname + target.search;
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'
  }[ch]));

  function typeFromPath() {
    if (location.pathname.includes('/evroshtaketnik/')) return 'fence';
    if (location.pathname.includes('/naves/')) return 'canopy';
    return 'gates';
  }

  function readEditState() {
    if (!editId) return null;
    try {
      const state = JSON.parse(localStorage.getItem(EDIT_KEY) || 'null');
      if (!state || state.surveyId !== surveyId || state.calculationId !== editId || !state.calculation) return null;
      if (state.calculation.type !== typeFromPath()) return null;
      return state;
    } catch {
      return null;
    }
  }

  function waitFor(test, timeout = 15000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        let value = null;
        try { value = test(); } catch {}
        if (value) return resolve(value);
        if (Date.now() - started >= timeout) return reject(new Error('Калькулятор не успел загрузиться'));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async function restoreGateCalculation(item) {
    if (window.GATE_CALC?.ready) { try { await window.GATE_CALC.ready; } catch {} }
    const api = await waitFor(() => window.GATE_PAGE_API);
    await waitFor(() => window.KUZDVOR_GATE_APP?.snapshot);
    const payload = item?.payload || {};
    const config = payload.configuration || {};
    const article = payload.article || config.article || '';
    if (article && !api.showProductByArticle?.(article, {open:true})) throw new Error('Не удалось открыть сохранённый Арт.');
    const setNumber = (id, value) => {
      const input = document.getElementById(id);
      if (!input || !(Number(value) > 0)) return;
      input.value = String(value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    };
    setNumber('widthInput', payload.width ?? config.width);
    setNumber('heightInput', payload.height ?? config.height);
    setNumber('wicketWidthInput', payload.wicketWidth ?? config.wicketWidth);
    setNumber('wicketHeightInput', payload.wicketHeight ?? config.wicketHeight);
    const posts = document.getElementById('postsCheck');
    if (posts) {
      posts.checked = Boolean(payload.posts ?? config.posts);
      posts.dispatchEvent(new Event('change', {bubbles:true}));
    }
    if (payload.city && api.setDeliveryPlace) { try { await api.setDeliveryPlace(payload.city); } catch {} }
    const dimensions = document.getElementById('gateDimensions');
    const sizeToggle = document.getElementById('sizeToggle');
    dimensions?.classList.add('is-open');
    if (sizeToggle) {
      sizeToggle.textContent = 'Скрыть';
      sizeToggle.setAttribute('aria-expanded', 'true');
    }
  }

  async function restoreFenceCalculation(item) {
    const api = await waitFor(() => window.KUZDVOR_FENCE_APP?.restore ? window.KUZDVOR_FENCE_APP : null);
    if (api.ready) { try { await api.ready; } catch {} }
    const config = item?.payload?.configuration || {};
    const delivery = config.delivery || {};
    const state = {
      quoteNumber: config.quoteNumber || '',
      type: config.fenceType || '',
      post: config.postType || '',
      includeNewPosts: config.includeNewPosts !== false,
      existingPostsCount: Number(config.existingPostsCount) || 0,
      siteConditions: config.siteConditions || {},
      sections: Array.isArray(config.sections) ? config.sections : [],
      delivery: {manual:Boolean(delivery.manual), manualPrice:Number(delivery.manualPrice) || 0, name:delivery.name || item?.payload?.city || '', secondary:'', price:Number(delivery.price) || 0}
    };
    if (!api.restore(state)) throw new Error('Не удалось восстановить расчёт забора');
  }

  async function restoreCanopyCalculation(item) {
    const api = await waitFor(() => window.TrussApp?.restore ? window.TrussApp : null);
    const snap = item?.payload?.configuration?.canopy;
    if (!snap || !api.restore(snap)) throw new Error('Не удалось восстановить расчёт навеса');
  }

  async function restoreEditingCalculation(editState) {
    if (!editState?.calculation) return false;
    const type = typeFromPath();
    if (type === 'gates') await restoreGateCalculation(editState.calculation);
    else if (type === 'fence') await restoreFenceCalculation(editState.calculation);
    else await restoreCanopyCalculation(editState.calculation);
    return true;
  }
  function money(value) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
  }

  function gateSnapshot() {
    const payload = window.KUZDVOR_GATE_APP?.snapshot?.();
    if (!payload) throw new Error('Калькулятор ворот ещё не готов');
    const total = Number(payload.total) || 0;
    if (!(total > 0)) throw new Error('Сначала выполните расчёт ворот');
    const article = payload.article || payload.configuration?.article || '';
    const rawImage = Array.isArray(window.CATALOG_IMAGES?.[article]) ? window.CATALOG_IMAGES[article][0] : '';
    // Persist an image URL that also works when the survey card opens from
    // /dev-tools/ or /zamer-app-v2/, not only from the gate catalog page.
    const previewPrefix = location.pathname.startsWith('/kuznechny-dvorik-gates/')
      ? '/kuznechny-dvorik-gates/' : '/';
    const image = /^\/catalog\//.test(rawImage)
      ? previewPrefix + rawImage.replace(/^\/+/, '')
      : rawImage;
    return {
      type:'gates',
      title:article ? `Ворота с калиткой · ${article}` : 'Ворота с калиткой',
      total,
      image,
      summary:[
        article,
        payload.width && payload.height ? `${payload.width} × ${payload.height} м` : '',
        payload.wicketWidth && payload.wicketHeight ? `калитка ${payload.wicketWidth} × ${payload.wicketHeight} м` : '',
        payload.posts ? 'новые столбы' : 'готовые столбы'
      ].filter(Boolean).join(' · '),
      payload
    };
  }

  const FENCE_PHOTOS = Object.freeze({
    'vertical-double': 'fence-double-brown-20260927.webp',
    'vertical-single': 'fence-single-gray-20260927.webp',
    'horizontal-double': 'fence-horizontal-real.webp'
  });

  function fenceSnapshot() {
    const source = window.KUZDVOR_FENCE_APP?.snapshot?.();
    if (!source) throw new Error('Калькулятор забора ещё не готов');
    const total = Number(source.total) || 0;
    const config = source.configuration || {};
    const summary = config.summary || {};
    if (!(total > 0) || !(Number(summary.totalLength) > 0)) throw new Error('Сначала укажите размеры забора');

    // The survey card stores public fields only. Full calculationSettings,
    // internal costs and material purchase data are NOT transferred to IndexedDB.
    const type = FENCE_PHOTOS[config.fenceType] ? config.fenceType : 'vertical-double';
    const image = new URL('./assets/' + FENCE_PHOTOS[type], location.href).pathname;
    const delivery = config.delivery || {};
    const manual = Boolean(document.getElementById('manualDeliveryEnabled')?.checked);
    const publicSummary = {};
    for (const key of [
      'totalLength','grossLineLength','openingsWidth','openingSupportPosts',
      'openingPostsWidth','openingNodeWidth','betweenOpeningFence',
      'bridgeSpans','bridgeExtraPosts','totalSpans','postsByScheme',
      'existingPostsUsed','newPosts','total'
    ]) {
      if (Number.isFinite(Number(summary[key]))) publicSummary[key] = Number(summary[key]);
    }
    const sections = Array.isArray(config.sections) ? config.sections.slice(0,4).map(section => ({
      length:Number(section.length) || 0,
      height:Number(section.height) || 1.8,
      gateOpening:Number(section.gateOpening) || 0,
      wicketOpening:Number(section.wicketOpening) || 0,
      openingPostType:String(section.openingPostType || '100x100x3'),
      openingsSharePost:section.openingsSharePost !== false,
      betweenOpeningFence:Number(section.betweenOpeningFence) || 0,
      openingStartFence:section.openingStartFence == null ? null : Number(section.openingStartFence),
      sharedWithNext:Boolean(section.sharedWithNext)
    })) : [];
    const publicConfig = {
      quoteNumber:String(config.quoteNumber || ''),
      fenceType:type,
      fenceTypeLabel:String(config.fenceTypeLabel || ''),
      postType:String(config.postType || '80x80x3'),
      includeNewPosts:config.includeNewPosts !== false,
      existingPostsCount:Number(config.existingPostsCount) || 0,
      siteConditions:{
        slope:Boolean(config.siteConditions?.slope),
        hardSurface:Boolean(config.siteConditions?.hardSurface)
      },
      sections,
      delivery:{
        known:Boolean(delivery.known),
        name:String(delivery.name || ''),
        price:Number(delivery.price) || 0,
        manual,
        manualPrice:manual ? Math.max(0, Number(document.getElementById('manualDelivery')?.value) || 0) : 0
      },
      summary:publicSummary
    };
    return {
      type:'fence',
      title:'Забор из евроштакетника',
      total,
      image,
      summary:[
        publicConfig.fenceTypeLabel,
        Number(summary.totalLength) ? `${Number(summary.totalLength).toLocaleString('ru-RU')} м` : '',
        Number(summary.totalSpans) ? `${summary.totalSpans} прол.` : ''
      ].filter(Boolean).join(' · '),
      payload:{
        category:'picket-fence',
        productTitle:'Забор из евроштакетника',
        total,
        city:String(source.city || ''),
        deliveryPending:!Boolean(delivery.known),
        configuration:publicConfig
      }
    };
  }

  const CANOPY_FARM_IMAGES = Object.freeze({
    'Арочный':'icon-arched.jpg',
    'Полуарочный':'icon-semi-arched.jpg',
    'Односкатный':'icon-shed-low.jpg',
    'Треугольный':'icon-shed-high.jpg',
    'Швелер':'icon-channel.jpg',
    'Двухскатный':'icon-gable-vertical.jpg',
    'Двухскатный арочный':'icon-gable-arched.jpg'
  });

  function canopySnapshot() {
    const snap = window.TrussApp?.snapshot?.();
    if (!snap) throw new Error('Сначала выполните расчёт навеса');
    const total = Number(snap.publicSummary?.total) || 0;
    const input = snap.input || {};
    if (!(total > 0) || input.farmType !== 'Арочный' || input.trussType === 'Плоская'
        || document.getElementById('totalPrice')?.textContent?.includes('Требуется уточнение')) {
      throw new Error('Для выбранной фермы нет готовой цены. Выберите арочную ферму и проверьте размеры.');
    }
    const photo = CANOPY_FARM_IMAGES[input.farmType];
    const publicInput = {};
    for (const key of [
      'widthPostsM','lengthM','visibleHeightM','installType','coverage',
      'farmType','farmPreset','trussType','lagMode','riseMm','autoRise',
      'heightMm','overhangMm','endFlatMm','cellStepMm','materialMode',
      'existingPosts','beamsExisting','postsNeeded','paint','delivery'
    ]) {
      if (Object.prototype.hasOwnProperty.call(input, key)) publicInput[key] = input[key];
    }
    // PricingSnapshot contains confidential rates. It must never reach the
    // surveyor's local records or customer view; restore() only needs input.
    const publicSnap = {version:6,input:publicInput,publicSummary:{total}};
    return {
      type:'canopy',
      title:'Арочный навес',
      total,
      image:photo ? new URL('./farm-icons/' + photo,location.href).pathname : '',
      summary:[
        Number(input.widthPostsM)>0&&Number(input.lengthM)>0 ? `${input.widthPostsM} × ${input.lengthM} м` : '',
        input.coverage || '',
        Number(input.existingPosts)>0 ? `готовых столбов ${input.existingPosts}` : 'новые столбы',
        input.beamsExisting ? 'готовые балки' : 'новые балки'
      ].filter(Boolean).join(' · '),
      payload:{
        category:'canopy',
        productTitle:'Арочный навес',
        total,
        deliveryPending:Number(input.delivery || 0)===0,
        configuration:{canopy:publicSnap}
      }
    };
  }

  async function waitForGateSnapshot(timeout = 4000) {
    if (window.GATE_CALC?.ready) {
      try { await window.GATE_CALC.ready; } catch {}
    }
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeout) {
      try {
        return gateSnapshot();
      } catch (error) {
        lastError = error;
      }
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw lastError || new Error('Калькулятор ворот ещё не готов');
  }

  async function takeSnapshot() {
    const type = typeFromPath();
    if (type === 'fence') return fenceSnapshot();
    if (type === 'canopy') return canopySnapshot();
    return waitForGateSnapshot();
  }

  function showMessage(message, error = false) {
    const node = document.getElementById('kdSurveyorBridgeMessage');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
  }

  function install() {
    if (document.getElementById('kdSurveyorBridge')) return;
    const calculatorType = typeFromPath();
    const calculatorLabel = calculatorType === 'gates' ? 'Ворота' : calculatorType === 'fence' ? 'Евроштакетник' : 'Навес';
    const editState = readEditState();
    document.documentElement.classList.add('kd-surveyor-mode', `kd-surveyor-${calculatorType}`);
    document.title = `КД Замерщик · ${calculatorLabel}`;
    const style = document.createElement('style');
    style.textContent = `
      body{padding-bottom:max(88px,calc(76px + env(safe-area-inset-bottom)))!important}
      #kdSurveyorBridge{position:fixed;z-index:2147483000;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,760px);padding:9px 10px max(9px,env(safe-area-inset-bottom));background:rgba(18,18,18,.97);color:#fff;border-top:1px solid rgba(231,195,111,.35);box-shadow:0 -10px 30px rgba(0,0,0,.22);font-family:Inter,Arial,sans-serif}
      #kdSurveyorBridge .kd-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center}
      #kdSurveyorBridge button{min-height:44px;border:0;border-radius:12px;padding:9px 12px;font:800 12px/1.1 inherit;cursor:pointer}
      #kdSurveyorBridge .kd-back{background:#292929;color:#eee}
      #kdSurveyorBridge .kd-save{background:linear-gradient(135deg,#b77f21,#d8ab4e);color:#fff;padding-inline:16px}
      #kdSurveyorBridge .kd-copy{min-width:0}
      #kdSurveyorBridge .kd-copy b{display:block;font-size:12px;color:#e7c36f}
      #kdSurveyorBridge .kd-copy span{display:block;font-size:10px;color:#c8c8c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
      #kdSurveyorBridgeMessage.is-error{color:#ffaaaa!important}

      /* Surveyor mode: keep the calculators intact, but remove customer-facing
         marketing, lead forms and duplicate save/share actions. These rules only
         exist when the calculator is opened from a survey card (?surveyor=1). */
      .kd-surveyor-gates .topbar,
      .kd-surveyor-gates .hero,
      .kd-surveyor-gates .package,
      .kd-surveyor-gates .trust,
      .kd-surveyor-gates .order-steps,
      .kd-surveyor-gates .faq,
      .kd-surveyor-gates .privacy-section,
      .kd-surveyor-gates .final-cta,
      .kd-surveyor-gates footer,
      .kd-surveyor-gates #leadBackdrop,
      .kd-surveyor-gates #policyModal,
      .kd-surveyor-gates #successModal,
      .kd-surveyor-gates #leadSheetClose,
      .kd-surveyor-gates .mobile-lead-heading,
      .kd-surveyor-gates .lead-fields,
      .kd-surveyor-gates #leadRequest>.consent-row,
      .kd-surveyor-gates #sendButton,
      .kd-surveyor-gates #copyButton,
      .kd-surveyor-gates .privacy-copy,
      .kd-surveyor-gates #mobileMeasureButton{display:none!important}
      .kd-surveyor-gates .catalog{padding-top:22px!important;padding-bottom:30px!important}
      .kd-surveyor-gates .catalog .section-head{margin-bottom:18px!important}
      .kd-surveyor-gates .calculator{padding-top:24px!important;padding-bottom:28px!important}
      .kd-surveyor-gates .calculator>.section-head.light p{display:none!important}
      .kd-surveyor-gates #leadRequest{margin-bottom:8px}
      .kd-surveyor-gates .estimate-card{top:12px}

      .kd-surveyor-fence .topbar,
      .kd-surveyor-fence .hero,
      .kd-surveyor-fence .trust-strip,
      .kd-surveyor-fence .process-section,
      .kd-surveyor-fence #leadSection,
      .kd-surveyor-fence .footer,
      .kd-surveyor-fence #resultLeadButton,
      .kd-surveyor-fence .result-call,
      .kd-surveyor-fence #quoteMainActions,
      .kd-surveyor-fence #quoteMoreActions,
      .kd-surveyor-fence #savedQuoteBar,
      .kd-surveyor-fence #resultNote,
      .kd-surveyor-fence .mobile-quote-bar{display:none!important}
      .kd-surveyor-fence .calculator{padding-top:18px!important}
      .kd-surveyor-fence .result-card{order:initial!important}
      .kd-surveyor-fence #internalPanel{display:none!important}
      .kd-surveyor-fence .scheme-section{padding-bottom:28px!important}
      .kd-surveyor-fence #kdSurveyorBridge .kd-copy b{font-size:15px;line-height:1.2}
      .kd-surveyor-fence #kdSurveyorBridge .kd-copy span{font-size:10px}

      .kd-surveyor-canopy .topbar,
      .kd-surveyor-canopy .hero,
      .kd-surveyor-canopy #showSave,
      .kd-surveyor-canopy #savePanel,
      .kd-surveyor-canopy .client-info-strip,
      .kd-surveyor-canopy .client-price-note{display:none!important}
      .kd-surveyor-canopy .page{padding-top:12px!important}
      .kd-surveyor-canopy .workspace{margin-top:0!important}

      @media(max-width:520px){
        #kdSurveyorBridge .kd-row{grid-template-columns:46px minmax(0,1fr) auto}
        #kdSurveyorBridge .kd-back{font-size:0;padding:8px}
        #kdSurveyorBridge .kd-back:before{content:'←';font-size:20px}
        .kd-surveyor-gates .catalog{padding-top:14px!important;padding-bottom:20px!important}
        .kd-surveyor-gates .calculator{padding-top:16px!important}
        .kd-surveyor-fence .calculator{padding-top:10px!important}
        .kd-surveyor-canopy .page{padding-top:8px!important}
      }
    `;
    document.head.append(style);

    const bar = document.createElement('div');
    bar.id = 'kdSurveyorBridge';
    bar.innerHTML = `
      <div class="kd-row">
        <button type="button" class="kd-back" id="kdSurveyorBridgeBack">← В замер</button>
        <div class="kd-copy"><b>${editState ? 'Редактирование расчёта' : 'Расчёт для замера'}</b><span id="kdSurveyorBridgeMessage">${editState ? 'Восстанавливаем сохранённые параметры…' : 'Настройте калькулятор и сохраните результат'}</span></div>
        <button type="button" class="kd-save" id="kdSurveyorBridgeSave">${editState ? 'Сохранить изменения' : 'Добавить в замер'}</button>
      </div>`;
    document.body.append(bar);

    // On a phone the surveyor sees the chosen photo and lengths first; the
    // actual recalculated fence price stays visible in the bottom action bar.
    if (calculatorType === 'fence') {
      const priceNode = document.getElementById('totalPrice');
      const labelNode = document.getElementById('totalLabel');
      const titleNode = bar.querySelector('.kd-copy b');
      const messageNode = document.getElementById('kdSurveyorBridgeMessage');
      const showFencePrice = () => {
        if (!titleNode || !messageNode || messageNode.classList.contains('is-error')) return;
        const price = (priceNode?.textContent || '').trim();
        const label = (labelNode?.textContent || '').trim();
        if (price && price !== '—' && price !== '0 ₽') {
          titleNode.textContent = 'Забор · ' + price;
          messageNode.textContent = label.includes('без доставки') ? 'Без доставки · уточните адрес' : 'Цена с учётом выбранных условий';
        } else {
          titleNode.textContent = 'Забор · укажите длину';
          messageNode.textContent = 'Выберите фото и введите размеры участка';
        }
      };
      showFencePrice();
      const observer = new MutationObserver(showFencePrice);
      if (priceNode) observer.observe(priceNode, {subtree:true,childList:true,characterData:true});
      if (labelNode) observer.observe(labelNode, {subtree:true,childList:true,characterData:true});
      window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
    }

    document.getElementById('kdSurveyorBridgeBack')?.addEventListener('click', () => {
      if (editState) { try { localStorage.removeItem(EDIT_KEY); } catch {} }
      location.href = returnUrl();
    });
    document.getElementById('kdSurveyorBridgeSave')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (button?.disabled) return;
      if (button) {
        button.disabled = true;
        button.textContent = editState ? 'Сохраняем…' : 'Добавляем…';
      }
      showMessage('Проверяем расчёт…');
      try {
        const calc = await takeSnapshot();
        const now = new Date().toISOString();
        const transfer = {
          version:1,
          surveyId,
          calculation:{
            id:editState?.calculationId || ('calc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8)),
            ...calc,
            createdAt:editState?.calculation?.createdAt || now,
            updatedAt:now
          }
        };
        localStorage.setItem(TRANSFER_KEY, JSON.stringify(transfer));
        if (editState) localStorage.removeItem(EDIT_KEY);
        showMessage(`${editState ? 'Изменения сохранены' : 'Сохранено'} · ${money(calc.total)}`);
        setTimeout(() => { location.href = returnUrl(); }, 120);
      } catch (error) {
        showMessage(error?.message || 'Не удалось сохранить расчёт', true);
        if (button) {
          button.disabled = false;
          button.textContent = editState ? 'Сохранить изменения' : 'Добавить в замер';
        }
      }
    });

    (async () => {
      try {
        if (editState) {
          await restoreEditingCalculation(editState);
          showMessage('Параметры восстановлены — можно изменить расчёт');
        } else {
          const calc = await takeSnapshot();
          if (calculatorType !== 'fence') showMessage(`${calc.title} · ${money(calc.total)}`);
        }
      } catch (error) {
        // An empty new fence quote is expected until the surveyor enters length.
        // Do not lock the live-price message into an error state on first open.
        if (calculatorType !== 'fence' || editState) {
          showMessage(error?.message || 'Не удалось восстановить расчёт', true);
        }
      }
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
