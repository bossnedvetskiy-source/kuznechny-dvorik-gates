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
      .kd-surveyor-gates #mobileMeasureButton,
      .kd-surveyor-gates .mobile-price-breakdown .mobile-measure-button,
      .kd-surveyor-gates .mobile-payment-note,
      .kd-surveyor-gates .mobile-cta,
      .kd-surveyor-gates #mobilePrimaryCta,
      .kd-surveyor-gates .posts-reassurance{display:none!important}
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
      .kd-surveyor-canopy .client-result{order:2!important;position:static!important}
      .kd-surveyor-canopy .right-column{order:2!important}
      .kd-surveyor-canopy .client-controls .panel-head{margin-bottom:9px}
      .kd-surveyor-canopy .client-main-fields{gap:10px!important}
      .kd-surveyor-canopy .client-main-fields > .field span{font-size:13px}
      .kd-surveyor-canopy .client-main-fields > .field input,
      .kd-surveyor-canopy .client-main-fields > .field select{min-height:48px;border-radius:11px}
      .kd-surveyor-canopy .kd-canopy-step{grid-column:1/-1;font-weight:800;font-size:12px;color:#e2b861;padding-top:5px}
      .kd-surveyor-canopy .kd-canopy-other-types{margin-top:12px;border:1px solid #41464b;border-radius:13px;background:#121518;overflow:hidden}
      .kd-surveyor-canopy .kd-canopy-other-types>summary{list-style:none;cursor:pointer;padding:14px;font-size:12px;font-weight:800;color:#edd399}
      .kd-surveyor-canopy .kd-canopy-other-types>summary::-webkit-details-marker{display:none}
      .kd-surveyor-canopy .kd-canopy-other-types>summary:after{content:'⌄';float:right}
      .kd-surveyor-canopy .kd-canopy-other-types[open]>summary:after{content:'⌃'}
      .kd-surveyor-canopy .kd-canopy-other-types .original-picker{display:grid;border:0;padding:0 12px 14px;gap:12px}
      .kd-surveyor-canopy .kd-canopy-other-types .original-picker-group:nth-child(2){display:none!important}
      .kd-surveyor-canopy .kd-canopy-existing-count[hidden]{display:none!important}
      .kd-surveyor-canopy .kd-canopy-beams-manual{display:none!important}
      .kd-surveyor-canopy.kd-canopy-partial-mode .kd-canopy-beams-manual{display:grid!important}
      .kd-surveyor-canopy .kd-canopy-partial{border:0;background:transparent;color:#edd399;text-align:left;padding:3px 0;font-size:12px;font-weight:700;cursor:pointer}
      .kd-surveyor-canopy .kd-canopy-preset-list{display:grid;grid-template-columns:1fr;gap:7px}
      .kd-surveyor-canopy .kd-canopy-preset-list button{border-radius:11px;min-height:43px}
      .kd-surveyor-canopy .kd-canopy-preset-list button.is-selected:before{content:'✓ ';font-weight:900}
      .kd-surveyor-canopy .kd-canopy-display{border:1px solid #a47c3e;border-radius:11px;background:#242015;color:#efd49a;padding:10px 12px;font-size:12px;font-weight:800;cursor:pointer}
      .kd-surveyor-canopy #kdSurveyorBridge .kd-row{grid-template-columns:auto minmax(0,1fr) auto auto;gap:6px}
      .kd-surveyor-canopy #kdSurveyorBridge .kd-present{background:#30312f;color:#f2d48a;border:1px solid #7c6541}
      .kd-surveyor-canopy.kd-canopy-presenting .client-controls{display:none!important}
      .kd-surveyor-canopy.kd-canopy-presenting .workspace{display:block!important}
      .kd-surveyor-canopy.kd-canopy-presenting .right-column{display:flex!important;flex-direction:column!important}
      .kd-surveyor-canopy.kd-canopy-presenting .canopy-preview-panel{order:0!important}
      .kd-surveyor-canopy.kd-canopy-presenting .client-result{order:1!important}
      .kd-surveyor-canopy.kd-canopy-presenting .canopy-preview-panel .panel-head h2{font-size:19px}
      .kd-surveyor-canopy.kd-canopy-presenting #clientSummary{display:none!important}
      .kd-surveyor-canopy.kd-canopy-presenting #resultStatus{display:none!important}
      .kd-surveyor-canopy.kd-canopy-presenting .preview-note{display:none!important}
      .kd-surveyor-canopy.kd-canopy-presenting .canopy-three-viewport{height:min(62vh,570px);min-height:340px}
      .kd-surveyor-canopy.kd-canopy-presenting .client-result{padding:16px!important}
      .kd-surveyor-canopy.kd-canopy-presenting .client-result .total-price{margin-bottom:0}
      .kd-surveyor-canopy.kd-canopy-presenting #kdSurveyorBridge .kd-present{background:#e2b861;color:#17140d}
      .kd-surveyor-canopy.kd-canopy-presenting #kdSurveyorBridgeSave{visibility:hidden}
      .kd-surveyor-canopy .kd-canopy-preview-jump{display:none!important}
      .kd-surveyor-canopy .client-controls{order:1!important}
      .kd-surveyor-canopy .farm-type-grid{gap:8px!important}
      .kd-surveyor-canopy .farm-type-option{position:relative!important;min-height:85px!important;padding:5px 5px 23px!important;border:1px solid #3f454b!important;border-radius:9px!important;overflow:hidden}
      .kd-surveyor-canopy .farm-type-option.is-selected{border:2px solid #dfb453!important;background:rgba(223,180,83,.08)!important}
      .kd-surveyor-canopy .kd-farm-state{position:absolute;bottom:3px;left:0;right:0;text-align:center;font-weight:800;font-size:10px;line-height:1.3;color:#aeb4bd}
      .kd-surveyor-canopy .farm-type-option.is-selected .kd-farm-state{color:#e2b861}
      .kd-surveyor-canopy .kd-canopy-presets{grid-column:1/-1;display:grid;gap:9px;padding:13px;border-radius:13px;border:1px solid #41403a;background:#1c1d1c}
      .kd-surveyor-canopy .kd-canopy-presets strong{color:#fff;font-size:14px}
      .kd-surveyor-canopy .kd-canopy-presets small{color:#bbb;font-size:12px}
      .kd-surveyor-canopy .kd-canopy-preset-list{display:grid;gap:7px}
      .kd-surveyor-canopy .kd-canopy-preset-list button{min-height:46px;border:1px solid #53565a;background:#24282c;color:#fff;border-radius:10px;padding:9px;font:700 13px/1.25 inherit;cursor:pointer;text-align:left}
      .kd-surveyor-canopy .kd-canopy-preset-list button.is-selected{border-color:#deb566;background:#3a3327;color:#ffdf92}
      .kd-surveyor-canopy .kd-canopy-preview-jump{width:100%;border:1px solid #d2a34e;border-radius:10px;background:#282720;color:#f2d48a;padding:11px;font:800 13px inherit;cursor:pointer}
      .kd-surveyor-canopy .kd-canopy-unsupported{color:#eccb8f;font-size:12px;line-height:1.4}
      .kd-surveyor-canopy #kdSurveyorBridge .kd-copy b{font-size:15px;line-height:1.2}
      .kd-surveyor-canopy #kdSurveyorBridge .kd-copy span{font-size:10px}
      .kd-surveyor-canopy #kdSurveyorBridgeSave:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:600px){
        .kd-surveyor-canopy .client-main-fields{grid-template-columns:1fr 1fr!important}
        .kd-surveyor-canopy .client-main-fields>.field:nth-of-type(3){grid-column:1/-1}
        .kd-surveyor-canopy .client-main-fields>.technical-options{grid-column:1/-1}
        .kd-surveyor-canopy #kdSurveyorBridge .kd-save{font-size:11px;padding:9px 7px}
        .kd-surveyor-canopy #kdSurveyorBridge .kd-present{padding:8px;min-width:44px}
      }

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

    if (calculatorType === 'gates') {
      // This is an on-site estimate. The lead form, payment pitch and booking
      // button belong to the public catalog, never the surveyor experience.
      document.body.classList.remove('mobile-lead-open');
      const leadBackdrop = document.getElementById('leadBackdrop');
      if (leadBackdrop) leadBackdrop.hidden = true;
      const bookButtons = ['mobileMeasureButton','mobilePrimaryCta','sendButton'];
      for (const id of bookButtons) {
        const button = document.getElementById(id);
        if (button) {
          button.hidden = true;
          button.setAttribute('aria-hidden','true');
          button.tabIndex = -1;
        }
      }
      const estimateLabel = document.querySelector('#leadRequest .estimate-top span');
      if (estimateLabel) estimateLabel.textContent = 'Расчёт для клиента';
    }

    const bar = document.createElement('div');
    bar.id = 'kdSurveyorBridge';
    bar.innerHTML = `
      <div class="kd-row">
        <button type="button" class="kd-back" id="kdSurveyorBridgeBack">← В замер</button>
        <div class="kd-copy"><b>${editState ? 'Редактирование расчёта' : 'Расчёт для замера'}</b><span id="kdSurveyorBridgeMessage">${editState ? 'Восстанавливаем сохранённые параметры…' : 'Настройте калькулятор и сохраните результат'}</span></div>
        ${calculatorType === 'canopy' ? '<button type="button" class="kd-present" id="kdCanopyPresent" aria-pressed="false">3D клиенту</button>' : ''}
        <button type="button" class="kd-save" id="kdSurveyorBridgeSave">${editState ? 'Сохранить изменения' : 'Добавить в замер'}</button>
      </div>`;
    document.body.append(bar);

    if (calculatorType === 'canopy') {
      const form = document.querySelector('.client-controls');
      const fieldGrid = document.querySelector('.client-main-fields');
      const originalPicker = document.querySelector('.original-picker');
      const typeGrid = document.querySelector('.farm-type-grid');
      typeGrid?.querySelectorAll('[data-farm-type]').forEach(button => {
        const badge = document.createElement('span');
        badge.className = 'kd-farm-state';
        badge.textContent = button.dataset.farmType === 'Арочный' ? 'Цена онлайн' : 'По запросу';
        button.append(badge);
        button.setAttribute('aria-label', (button.dataset.farmType || 'Ферма') +
          (button.dataset.farmType === 'Арочный' ? ', доступен расчёт цены' : ', цена по запросу'));
      });

      // Move the catalogue to an optional details block. In surveyor mode,
      // on-site dimensions come first, not the 7 decorative farm cards.
      const otherTypes = document.createElement('details');
      otherTypes.className = 'kd-canopy-other-types';
      otherTypes.innerHTML = '<summary>Другие формы и конструкция фермы</summary>';
      originalPicker?.parentElement?.removeChild(originalPicker);
      if (originalPicker) otherTypes.append(originalPicker);
      const technicalOptions=document.querySelector('.technical-options');
      if (technicalOptions) otherTypes.append(technicalOptions);
      form?.querySelector('.simple-options')?.insertAdjacentElement('afterend',otherTypes);

      const step = document.createElement('div');
      step.className='kd-canopy-step';
      step.textContent='1 · Размеры и покрытие';
      fieldGrid?.prepend(step);

      const existing = document.getElementById('existingPosts');
      const beams = document.getElementById('beamsExisting');
      const anchorField = existing?.closest('label');
      anchorField?.classList.add('kd-canopy-existing-count');
      beams?.closest('label')?.classList.add('kd-canopy-beams-manual');
      const presets = document.createElement('section');
      presets.className = 'kd-canopy-presets';
      presets.innerHTML = `<strong>2 · Что уже есть у заказчика?</strong>
        <div class="kd-canopy-preset-list">
          <button type="button" data-canopy-preset="new">Нужны столбы и балки</button>
          <button type="button" data-canopy-preset="posts">Столбы есть, нужны балки</button>
          <button type="button" data-canopy-preset="all">Столбы и балки уже есть</button>
        </div>
        <button type="button" class="kd-canopy-partial" id="kdCanopyPartial" aria-expanded="false">Часть столбов уже есть? Указать количество</button>`;
      anchorField?.insertAdjacentElement('afterend',presets);

      // Put the conditions next to other primary inputs. Only partial-support
      // cases need a separate numeric field; preset buttons cover routine jobs.
      if (fieldGrid && presets) fieldGrid.append(presets);
      const partialButton = presets.querySelector('#kdCanopyPartial');
      let partialOpen = false;
      const syncPartial = () => {
        const totalPosts=Number(window.__CANOPY_PUBLIC?.totalPosts||0);
        const installed=Number(existing?.value||0);
        if(installed>0 && installed<totalPosts)partialOpen=true;
        if(anchorField)anchorField.hidden=!partialOpen;
        document.documentElement.classList.toggle('kd-canopy-partial-mode',partialOpen);
        partialButton?.setAttribute('aria-expanded',partialOpen?'true':'false');
        if(partialButton)partialButton.textContent=partialOpen?'Скрыть ввод количества столбов':'Часть столбов уже есть? Указать количество';
      };
      partialButton?.addEventListener('click',()=>{
        partialOpen=!partialOpen;
        syncPartial();
        if(partialOpen)existing?.focus();
      });
      let presetInProgress = false;
      const updatePresets = () => {
        const totalPosts = Number(window.__CANOPY_PUBLIC?.totalPosts || 0);
        const installed = Number(existing?.value || 0);
        const hasBeams = Boolean(beams?.checked);
        const chosen = installed === 0 && !hasBeams ? 'new' :
          totalPosts > 0 && installed >= totalPosts ? (hasBeams ? 'all' : 'posts') : '';
        presets.querySelectorAll('[data-canopy-preset]').forEach(button =>{
          const selected=button.dataset.canopyPreset===chosen;
          button.classList.toggle('is-selected',selected);
          button.setAttribute('aria-pressed',String(selected));
        });
        syncPartial();
      };
      presets.addEventListener('click', event => {
        const button = event.target.closest('[data-canopy-preset]');
        if (!button || !existing || !beams || presetInProgress) return;
        const totalPosts = Number(window.__CANOPY_PUBLIC?.totalPosts || 0);
        if ((button.dataset.canopyPreset === 'posts' || button.dataset.canopyPreset === 'all') && totalPosts <= 0) return;
        presetInProgress = true;
        partialOpen = false;
        existing.value = button.dataset.canopyPreset === 'new' ? '0' : String(totalPosts);
        beams.checked = button.dataset.canopyPreset === 'all';
        existing.dispatchEvent(new Event('input',{bubbles:true}));
        beams.dispatchEvent(new Event('change',{bubbles:true}));
        presetInProgress = false;
        updatePresets();
      });
      existing?.addEventListener('input',updatePresets);
      beams?.addEventListener('change',updatePresets);
      for (const id of ['lengthPosts','widthPosts']) document.getElementById(id)?.addEventListener('input',updatePresets);
      updatePresets();

      // One touch opens a clear customer presentation with live 3D and public
      // price; the editable inputs return in place without losing their values.
      const present = document.getElementById('kdCanopyPresent');
      const display = document.createElement('button');
      display.type='button';
      display.className='kd-canopy-display';
      display.textContent='3 · Показать клиенту 3D и цену';
      fieldGrid?.append(display);
      const showPresentation = value => {
        const on=Boolean(value);
        document.documentElement.classList.toggle('kd-canopy-presenting',on);
        present?.setAttribute('aria-pressed',String(on));
        if(present)present.textContent=on?'Изменить':'3D клиенту';
        const model=document.getElementById('canopyViewport');
        if(on){
          document.querySelector('.canopy-preview-panel')?.scrollIntoView({behavior:'auto',block:'start'});
        }else{
          form?.scrollIntoView({behavior:'auto',block:'start'});
        }
        if(model && window.__TRUSS_CURRENT?.ok && window.__CANOPY_PUBLIC)
          window.Canopy3D?.render?.(model,window.__TRUSS_CURRENT,window.__CANOPY_PUBLIC);
      };
      display.addEventListener('click',()=>showPresentation(true));
      present?.addEventListener('click',()=>showPresentation(!document.documentElement.classList.contains('kd-canopy-presenting')));
      // Keep all interactive fields available during edit. The presentation
      // mode is never persisted to a saved quote.
      const priceNode = document.getElementById('totalPrice');
      const statusNode = document.getElementById('resultStatus');
      const warningNode = document.getElementById('geometryWarning');
      const titleNode = bar.querySelector('.kd-copy b');
      const messageNode = document.getElementById('kdSurveyorBridgeMessage');
      const saveNode = document.getElementById('kdSurveyorBridgeSave');
      let saving = false;
      const showCanopyPrice = () => {
        if (saving || !titleNode || !messageNode) return;
        const price = (priceNode?.textContent || '').trim();
        const isExample = statusNode?.classList.contains('example');
        const valid = /^\d[\d\s\u00a0\u202f]*₽$/.test(price) && !isExample &&
          !warningNode?.textContent?.includes('пока не') &&
          document.getElementById('farmType')?.value === 'Арочный' &&
          document.getElementById('trussType')?.value !== 'Плоская';
        if (saveNode) saveNode.disabled = !valid;
        titleNode.textContent = valid ? 'Навес · ' + price : 'Навес · цена по запросу';
        messageNode.textContent = valid
          ? 'Покажите 3D клиенту · добавьте в замер'
          : isExample ? 'Укажите размеры навеса на объекте'
          : 'Для выбранного варианта требуется проверка цены';
        messageNode.classList.remove('is-error');
        updatePresets();
      };
      showCanopyPrice();
      const observer = new MutationObserver(showCanopyPrice);
      for (const node of [priceNode,statusNode,warningNode])
        if (node) observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:node===statusNode,attributeFilter:node===statusNode?['class']:undefined});
      bar.addEventListener('click', event => {
        if (event.target.closest('#kdSurveyorBridgeSave') && !saveNode.disabled) saving = true;
      }, {capture:true});
      window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
    }

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
