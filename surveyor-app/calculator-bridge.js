(() => {
  const params = new URLSearchParams(location.search);
  const surveyId = params.get('survey') || '';
  if (params.get('surveyor') !== '1' || !surveyId) return;

  const TRANSFER_KEY = 'kd-surveyor-transfer-v1';
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

  function money(value) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
  }

  function gateSnapshot() {
    const payload = window.KUZDVOR_GATE_APP?.snapshot?.();
    if (!payload) throw new Error('Калькулятор ворот ещё не готов');
    const total = Number(payload.total) || 0;
    if (!(total > 0)) throw new Error('Сначала выполните расчёт ворот');
    const article = payload.article || payload.configuration?.article || '';
    const image = Array.isArray(window.CATALOG_IMAGES?.[article]) ? window.CATALOG_IMAGES[article][0] : '';
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

  function fenceSnapshot() {
    const payload = window.KUZDVOR_FENCE_APP?.snapshot?.();
    if (!payload) throw new Error('Калькулятор забора ещё не готов');
    const total = Number(payload.total) || 0;
    const summary = payload.configuration?.summary || {};
    if (!(total > 0) || !(Number(summary.totalLength) > 0)) throw new Error('Сначала укажите размеры забора');
    return {
      type:'fence',
      title:'Забор из евроштакетника',
      total,
      image:'',
      summary:[
        payload.configuration?.fenceTypeLabel || '',
        Number(summary.totalLength) ? `${Number(summary.totalLength).toLocaleString('ru-RU')} м` : '',
        Number(summary.totalSpans) ? `${summary.totalSpans} прол.` : ''
      ].filter(Boolean).join(' · '),
      payload
    };
  }

  function canopySnapshot() {
    const snap = window.TrussApp?.snapshot?.();
    if (!snap) throw new Error('Калькулятор навеса ещё не готов');
    const total = Number(snap.publicSummary?.total) || 0;
    if (!(total > 0)) throw new Error('Сначала выполните расчёт навеса');
    const input = snap.input || {};
    return {
      type:'canopy',
      title:input.farmType ? `${input.farmType} навес` : 'Навес',
      total,
      image:'',
      summary:[
        input.widthPostsM && input.lengthM ? `${input.widthPostsM} × ${input.lengthM} м` : '',
        input.coverage || '',
        input.installType || ''
      ].filter(Boolean).join(' · '),
      payload:{
        category:'canopy',
        productTitle:'Навес',
        total,
        configuration:{canopy:snap}
      }
    };
  }

  function takeSnapshot() {
    const type = typeFromPath();
    if (type === 'fence') return fenceSnapshot();
    if (type === 'canopy') return canopySnapshot();
    return gateSnapshot();
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
    document.documentElement.classList.add('kd-surveyor-mode', `kd-surveyor-${calculatorType}`);
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
      .kd-surveyor-canopy #showSave,.kd-surveyor-canopy #savePanel{display:none!important}
      @media(max-width:520px){#kdSurveyorBridge .kd-row{grid-template-columns:46px minmax(0,1fr) auto}#kdSurveyorBridge .kd-back{font-size:0;padding:8px}#kdSurveyorBridge .kd-back:before{content:'←';font-size:20px}}
    `;
    document.head.append(style);

    const bar = document.createElement('div');
    bar.id = 'kdSurveyorBridge';
    bar.innerHTML = `
      <div class="kd-row">
        <button type="button" class="kd-back" id="kdSurveyorBridgeBack">← В замер</button>
        <div class="kd-copy"><b>Расчёт для замера</b><span id="kdSurveyorBridgeMessage">Настройте калькулятор и сохраните результат</span></div>
        <button type="button" class="kd-save" id="kdSurveyorBridgeSave">Добавить в замер</button>
      </div>`;
    document.body.append(bar);

    document.getElementById('kdSurveyorBridgeBack')?.addEventListener('click', () => {
      location.href = returnUrl();
    });
    document.getElementById('kdSurveyorBridgeSave')?.addEventListener('click', () => {
      try {
        const calc = takeSnapshot();
        const transfer = {
          version:1,
          surveyId,
          calculation:{
            id:'calc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
            ...calc,
            createdAt:new Date().toISOString()
          }
        };
        localStorage.setItem(TRANSFER_KEY, JSON.stringify(transfer));
        showMessage(`Сохранено · ${money(calc.total)}`);
        setTimeout(() => { location.href = returnUrl(); }, 180);
      } catch (error) {
        showMessage(error?.message || 'Не удалось сохранить расчёт', true);
      }
    });

    try {
      const calc = takeSnapshot();
      showMessage(`${calc.title} · ${money(calc.total)}`);
    } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
