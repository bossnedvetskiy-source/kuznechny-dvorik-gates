(() => {
  if (window.KUZDVOR_ADMIN_EXCEL_READY) return;
  window.KUZDVOR_ADMIN_EXCEL_READY = true;

  const list = document.getElementById('catalogPriceList');
  if (!list) return;
  const card = list.closest('.settings-card');
  const heading = card?.querySelector('.panel-heading h2');
  const headingLabel = card?.querySelector('.panel-heading span');
  const help = card?.querySelector('.price-help');
  if (heading) heading.textContent = 'Excel-расчёт ворот';
  if (headingLabel) headingLabel.textContent = 'Источник цен ворот';
  if (help) help.textContent = 'без ручного ввода';

  const style = document.createElement('style');
  style.textContent = `
    .excel-import{display:grid;gap:14px}.excel-import-intro{padding:13px 14px;border:1px solid #dfc791;border-radius:13px;background:#fff8e8;color:#67532c;font-size:11px;line-height:1.55}.excel-import-intro b{color:#75531b}.excel-import-source{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px;border:1px solid #e4ded5;border-radius:14px;background:#faf8f4}.excel-import-source strong{display:block;font-size:13px}.excel-import-source small{display:block;margin-top:4px;color:var(--muted);font-size:9.5px;line-height:1.45}.excel-source-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.excel-file-button,.excel-download-button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border:1px solid #c89a49;border-radius:10px;background:#fff;color:#6d4b15;font-size:11px;font-weight:800;cursor:pointer}.excel-download-button{border-color:#1f1f1f;color:#1f1f1f}.excel-download-button:disabled{opacity:.42;cursor:not-allowed}.excel-preview{display:grid;gap:10px}.excel-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.excel-summary>div{padding:10px;border:1px solid #e6e0d6;border-radius:11px;background:#fff}.excel-summary span{display:block;color:var(--muted);font-size:8px;font-weight:800;text-transform:uppercase}.excel-summary b{display:block;margin-top:3px;font-size:14px}.excel-changes{max-height:320px;overflow:auto;border:1px solid #e6e0d6;border-radius:12px}.excel-change{display:grid;grid-template-columns:minmax(100px,1fr) 100px 24px 100px;gap:8px;align-items:center;padding:9px 11px;border-bottom:1px solid #eee9e1;font-size:10px}.excel-change:last-child{border-bottom:0}.excel-change b{font-size:10.5px}.excel-arrow{text-align:center;color:#9f772f}.excel-model-warning{padding:11px 12px;border-radius:11px;background:#fff0ef;color:#913f39;font-size:10px;line-height:1.5}.excel-model-ok{padding:10px 12px;border-radius:11px;background:#eef7ea;color:#4f6f3b;font-size:10px;line-height:1.5}.excel-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px}.excel-publish{min-height:43px;padding:0 16px;border:0;border-radius:10px;background:var(--ink);color:#fff;font-size:11px;font-weight:800}.excel-publish:disabled{opacity:.4}.excel-error{padding:10px 12px;border-radius:10px;background:#fff0ef;color:#913f39;font-size:10px}.excel-hidden{display:none!important}@media(max-width:620px){.excel-import-source{grid-template-columns:1fr}.excel-source-actions{display:grid;grid-template-columns:1fr}.excel-file-button,.excel-download-button{width:100%}.excel-summary{grid-template-columns:1fr 1fr}.excel-change{grid-template-columns:1fr 80px 18px 80px}.excel-actions{display:grid}.excel-publish{width:100%}}
  `;
  document.head.append(style);

  list.className = 'excel-import';
  list.innerHTML = `
    <div class="excel-import-intro"><b>Цена ворот берётся только из Excel.</b> Скачайте текущий расчёт, измените цены материалов и коэффициенты на листе «Лист3», пересчитайте и сохраните файл в Excel, затем загрузите его сюда. После публикации сайт хранит сам .xlsx, поэтому следующая загрузка начинается с последней опубликованной версии.</div>
    <div class="excel-import-source">
      <div><strong id="excelCurrentTitle">Загружаем текущий расчёт…</strong><small id="excelCurrentMeta">Проверяем данные.</small></div>
      <div class="excel-source-actions">
        <button class="excel-download-button" id="excelDownload" type="button" disabled>Скачать текущий Excel</button>
        <label class="excel-file-button" for="gateExcelInput">Загрузить изменённый Excel</label>
      </div>
      <input id="gateExcelInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    </div>
    <div id="excelError" class="excel-error excel-hidden"></div>
    <div id="excelPreview" class="excel-preview excel-hidden">
      <div class="excel-summary"><div><span>Материалов изменено</span><b id="excelMaterialCount">0</b></div><div><span>Моделей изменят цену</span><b id="excelModelCount">0</b></div><div><span>Проверено моделей</span><b id="excelCheckedCount">0</b></div></div>
      <div id="excelModelCheck"></div>
      <div class="excel-changes" id="excelChanges"></div>
      <div class="excel-actions"><button class="excel-publish" id="excelPublish" type="button" disabled>Опубликовать расчёт из Excel</button></div>
    </div>`;

  const fileInput = document.getElementById('gateExcelInput');
  const downloadButton = document.getElementById('excelDownload');
  const currentTitle = document.getElementById('excelCurrentTitle');
  const currentMeta = document.getElementById('excelCurrentMeta');
  const errorBox = document.getElementById('excelError');
  const preview = document.getElementById('excelPreview');
  const changesBox = document.getElementById('excelChanges');
  const modelCheck = document.getElementById('excelModelCheck');
  const publishButton = document.getElementById('excelPublish');
  let currentState = null;
  let pending = null;
  const compiledModels = new WeakMap();

  const money = value => new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const roundExcel = (value, digits = 0) => { const x=Number(value),d=Math.trunc(Number(digits)||0);if(!Number.isFinite(x))return NaN;const factor=10**Math.abs(d),scaled=d>=0?x*factor:x/factor,rounded=scaled>=0?Math.floor(scaled+.5):Math.ceil(scaled-.5);return d>=0?rounded/factor:rounded*factor; };
  const roundUp = (value, digits = 0) => { const x=Number(value),d=Math.trunc(Number(digits)||0);if(!Number.isFinite(x))return NaN;const factor=10**Math.abs(d);if(d>=0)return (x>=0?Math.ceil(x*factor):Math.floor(x*factor))/factor;return (x>=0?Math.ceil(x/factor):Math.floor(x/factor))*factor; };
  const sum = value => Array.isArray(value) ? value.reduce((acc,item)=>acc+Number(item||0),0) : Number(value||0);
  const normalizeArticle = value => String(value ?? '').replace(/^\s*арт\.?\s*/iu,'').replace(/c/giu,'с').replace(/\s+/g,'').trim().toUpperCase();

  function showError(message) { errorBox.textContent = message; errorBox.classList.toggle('excel-hidden', !message); }

  async function modelPack() {
    await Promise.resolve(window.GATE_CALC_MODELS_READY);
    if (!window.GATE_CALC_MODELS?.models) throw new Error('Не загружена модель расчёта сайта');
    return window.GATE_CALC_MODELS;
  }

  function compileModel(model) {
    if (compiledModels.has(model)) return compiledModels.get(model);
    const result = {};
    for (const [ref, expr] of Object.entries(model.formulas || {})) result[ref] = new Function('ctx','p','v','sum','roundExcel','roundUp', `return (${expr});`);
    compiledModels.set(model, result);
    return result;
  }

  function calculateModel(model, prices) {
    const standard = model.standard || {};
    const ctx = {gateWidth:Number(standard.gate_width_m)||3.4,gateHeight:Number(standard.gate_height_m)||1.8,wicketWidth:Number(standard.wicket_width_m)||1,wicketHeight:Number(standard.wicket_height_m)||1.8};
    const cache = {...(model.literals || {})};
    const formulas = compileModel(model);
    const p = ref => Number(prices?.[ref]?.value ?? 0);
    const v = ref => { if(Object.prototype.hasOwnProperty.call(cache,ref))return cache[ref];const fn=formulas[ref];if(!fn)throw new Error(`Не найдена формула ${ref}`);const value=Number(fn(ctx,p,v,sum,roundExcel,roundUp));if(!Number.isFinite(value))throw new Error(`Ошибка формулы ${ref}`);cache[ref]=value;return value; };
    return roundExcel(v(model.gateRef)+v(model.wicketRef),-2);
  }

  async function standardPrices(prices) {
    const pack = await modelPack();
    return Object.fromEntries(Object.entries(pack.models).map(([article,model]) => [article, calculateModel(model, prices)]));
  }

  function articleFromCalcSheet(name) {
    const match = String(name).match(/арт\s*([0-9]+(?:-[0-9]+)?\s*[сc]?)\s*\(р\)/iu);
    return match ? normalizeArticle(match[1]) : '';
  }

  function cachedWorkbookStandards(workbook) {
    const result = {};
    for (const name of workbook.SheetNames || []) {
      const article = articleFromCalcSheet(name);
      if (!article) continue;
      const sheet = workbook.Sheets[name];
      for (let row=1; row<=15; row+=1) {
        if (String(sheet?.[`B${row}`]?.v || '').trim().toLocaleLowerCase('ru-RU') !== 'итого') continue;
        const value = Number(sheet?.[`C${row}`]?.v);
        if (Number.isFinite(value)) result[article] = Math.round(value);
      }
    }
    return result;
  }

  async function sha256(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }

  function refreshDownloadState() {
    downloadButton.disabled = !currentState?.fileAvailable;
    downloadButton.title = currentState?.fileAvailable
      ? 'Скачать последнюю опубликованную версию Excel'
      : 'На сайте пока нет сохранённого .xlsx. Один раз опубликуйте исходный Excel.';
  }

  async function loadCurrent() {
    try {
      const response = await fetch('/api/admin/gate-excel', {cache:'no-store'});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить Excel-настройки');
      currentState = data;
      const meta = data.meta || {};
      currentTitle.textContent = meta.fileName ? `Сейчас: ${meta.fileName}` : 'Сейчас используется исходный Excel-расчёт';
      if (meta.importedAt) currentMeta.textContent = `Последнее обновление: ${new Date(meta.importedAt).toLocaleString('ru-RU')}. Текущий .xlsx можно скачать для следующего редактирования.`;
      else if (data.fileAvailable) currentMeta.textContent = 'Текущий .xlsx сохранён на сайте и готов к скачиванию.';
      else currentMeta.textContent = 'Сам .xlsx ещё не сохранён на сайте. Один раз загрузите и опубликуйте исходный расчёт — дальше его всегда можно будет скачивать отсюда.';
      refreshDownloadState();
    } catch (error) {
      currentTitle.textContent = 'Не удалось проверить текущий Excel-расчёт';
      currentMeta.textContent = error.message || '';
      refreshDownloadState();
    }
  }

  async function downloadCurrentExcel() {
    showError('');
    downloadButton.disabled = true;
    const originalText = downloadButton.textContent;
    downloadButton.textContent = 'Скачиваем…';
    try {
      const response = await fetch('/api/admin/gate-excel/file', {cache:'no-store'});
      if (!response.ok) {
        const text = await response.text().catch(()=> '');
        throw new Error(text || 'Текущий Excel пока не сохранён на сайте');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentState?.meta?.fileName || 'ворота_расчет.xlsx';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (typeof window.showToast === 'function') window.showToast('Текущий Excel скачан');
    } catch (error) {
      showError(error.message || 'Не удалось скачать Excel');
    } finally {
      downloadButton.textContent = originalText;
      refreshDownloadState();
    }
  }

  async function inspectFile(file) {
    showError(''); pending=null; publishButton.disabled=true; preview.classList.add('excel-hidden');
    if (!window.XLSX) throw new Error('Модуль чтения Excel не загрузился. Обновите страницу.');
    if (!file?.name?.toLowerCase().endsWith('.xlsx')) throw new Error('Выберите файл Excel в формате .xlsx');
    if (file.size > 10 * 1024 * 1024) throw new Error('Файл слишком большой. Максимум 10 МБ.');
    if (!currentState?.prices) await loadCurrent();
    if (!currentState?.prices) throw new Error('Не удалось получить текущие входные цены расчёта');

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array', cellFormula:true, cellText:false, cellDates:false});
    const materialSheet = workbook.Sheets?.['Лист3'];
    if (!materialSheet) throw new Error('Это не тот файл расчёта: не найден лист «Лист3».');
    const calcSheets = (workbook.SheetNames || []).filter(name => /\(р\)/iu.test(name));
    if (calcSheets.length < 35) throw new Error(`В файле найдено только ${calcSheets.length} расчётных листов Арт(р). Ожидался полный файл ворот.`);

    const prices = {};
    for (const [ref, current] of Object.entries(currentState.prices)) {
      const value = Number(materialSheet?.[ref]?.v);
      if (!Number.isFinite(value) || value < 0 || value > 10000000) throw new Error(`На листе «Лист3» некорректно заполнена ячейка ${ref} (${current.label || ref}).`);
      prices[ref] = {value, label:current.label || ref};
    }

    const [beforeStandards, afterStandards, hash] = await Promise.all([standardPrices(currentState.prices), standardPrices(prices), sha256(buffer)]);
    const workbookStandards = cachedWorkbookStandards(workbook);
    const checked = Object.keys(afterStandards).filter(article => Number.isFinite(Number(workbookStandards[article])));
    const mismatches = checked.filter(article => Math.round(Number(workbookStandards[article])) !== Math.round(Number(afterStandards[article])));
    if (checked.length < 35) throw new Error('Excel не содержит сохранённых итоговых значений для проверки. Откройте файл в Excel, пересчитайте и сохраните его, затем загрузите снова.');

    const materialChanges = Object.entries(prices).filter(([ref,item]) => Number(item.value) !== Number(currentState.prices?.[ref]?.value)).map(([ref,item]) => ({ref,label:item.label,old:Number(currentState.prices[ref].value),next:Number(item.value)}));
    const modelChanges = Object.entries(afterStandards).filter(([article,value]) => Number(value) !== Number(beforeStandards[article])).map(([article,value]) => ({article,old:Number(beforeStandards[article]),next:Number(value)}));

    document.getElementById('excelMaterialCount').textContent=String(materialChanges.length);
    document.getElementById('excelModelCount').textContent=String(modelChanges.length);
    document.getElementById('excelCheckedCount').textContent=String(checked.length);
    modelCheck.className = mismatches.length ? 'excel-model-warning' : 'excel-model-ok';
    modelCheck.textContent = mismatches.length
      ? `Файл отличается от внедрённой формулы у ${mismatches.length} моделей (${mismatches.slice(0,8).map(a=>'Арт.'+a).join(', ')}${mismatches.length>8?'…':''}). Публикация заблокирована: сначала нужно обновить структуру расчётной модели, иначе сайт и Excel будут считать по-разному.`
      : `Проверка пройдена: сохранённые итоги Excel совпадают с расчётной моделью сайта для ${checked.length} моделей.`;

    const rows = [...materialChanges.slice(0,18).map(change => `<div class="excel-change"><b>${escape(change.label)} <small>${escape(change.ref)}</small></b><span>${money(change.old)}</span><span class="excel-arrow">→</span><span>${money(change.next)}</span></div>`), ...modelChanges.slice(0,22).map(change => `<div class="excel-change"><b>Арт.${escape(change.article)}</b><span>${money(change.old)}</span><span class="excel-arrow">→</span><span>${money(change.next)}</span></div>`)];
    changesBox.innerHTML = rows.length ? rows.join('') : '<div class="excel-change"><b>Изменений цен не найдено</b><span></span><span></span><span></span></div>';
    preview.classList.remove('excel-hidden');
    pending = {prices, standardPrices:afterStandards, meta:{fileName:file.name,fileSize:file.size,sha256:hash}, mismatches, buffer};
    // First publication may only be needed to save the source .xlsx for future downloads.
    publishButton.disabled = Boolean(mismatches.length) || (!materialChanges.length && Boolean(currentState?.fileAvailable));
    if (!materialChanges.length && !currentState?.fileAvailable && !mismatches.length) {
      modelCheck.textContent += ' Цены не изменились, но файл можно опубликовать один раз, чтобы затем всегда скачивать его из админки.';
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    currentTitle.textContent = `Проверяем: ${file.name}`;
    currentMeta.textContent = 'Сверяем материалы и все стандартные расчёты…';
    try { await inspectFile(file); currentTitle.textContent=`Готов к публикации: ${file.name}`; currentMeta.textContent='Ни одно изменение не попадёт на сайт до нажатия «Опубликовать». Сам .xlsx тоже будет сохранён как текущая версия.'; }
    catch(error){showError(error.message||'Не удалось прочитать Excel');currentTitle.textContent='Excel не принят';currentMeta.textContent='Исправьте файл и выберите его ещё раз.';}
    finally { fileInput.value=''; }
  });

  downloadButton.addEventListener('click', downloadCurrentExcel);

  publishButton.addEventListener('click', async () => {
    if (!pending || pending.mismatches?.length) return;
    publishButton.disabled=true;publishButton.textContent='Сохраняем Excel…';showError('');
    try {
      const fileResponse = await fetch('/api/admin/gate-excel/file', {
        method:'PUT',
        headers:{
          'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'x-file-name':encodeURIComponent(pending.meta.fileName || 'ворота_расчет.xlsx'),
          'x-file-sha256':pending.meta.sha256 || ''
        },
        body:pending.buffer
      });
      const fileData = await fileResponse.json().catch(()=>({}));
      if(!fileResponse.ok) throw new Error(fileData.error || 'Не удалось сохранить сам Excel-файл');

      publishButton.textContent='Публикуем расчёт…';
      const response=await fetch('/api/admin/gate-excel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prices:pending.prices,standardPrices:pending.standardPrices,meta:{...pending.meta,fileUploadId:fileData.uploadId},fileUploadId:fileData.uploadId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Не удалось опубликовать Excel-расчёт');
      currentState=data;pending=null;preview.classList.add('excel-hidden');
      currentTitle.textContent=`Сейчас: ${data.meta?.fileName||'Excel-расчёт'}`;
      currentMeta.textContent=`Опубликовано: ${new Date(data.meta?.importedAt||Date.now()).toLocaleString('ru-RU')}. Эта версия .xlsx теперь доступна по кнопке «Скачать текущий Excel».`;
      refreshDownloadState();
      if(typeof window.showToast==='function')window.showToast('Excel-расчёт и сам файл опубликованы на сайте');
    } catch(error){showError(error.message||'Ошибка публикации');publishButton.disabled=false;}
    finally{publishButton.textContent='Опубликовать расчёт из Excel';}
  });

  loadCurrent();
})();
