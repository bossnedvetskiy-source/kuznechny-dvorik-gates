(() => {
  const settingsPanel = document.getElementById('settingsTab');
  const form = settingsPanel?.querySelector('#siteSettingsForm');
  if (!settingsPanel || !form) return;

  const section = document.createElement('section');
  section.className = 'settings-card delivery-admin-card';
  section.innerHTML = `
    <div class="panel-heading">
      <div><span>Фиксированные тарифы</span><h2>Доставка по населённым пунктам</h2></div>
      <button class="reset-button delivery-add" type="button">+ Добавить пункт</button>
    </div>
    <p class="settings-hint">Если населённый пункт есть здесь, сайт использует эту фиксированную стоимость. Для остальных пунктов применяется тариф ₽/км из блока выше.</p>
    <div class="delivery-admin-list" id="deliveryAdminList"></div>
    <div class="delivery-admin-actions">
      <span class="save-state" id="deliverySaveState">Тарифы не загружены</span>
      <button class="primary-button" id="saveDeliveryButton" type="button" disabled>Сохранить доставку</button>
    </div>`;
  const mainAction = form.querySelector('.action-bar');
  if (mainAction) mainAction.before(section); else form.append(section);

  const style = document.createElement('style');
  style.textContent = `
    .delivery-admin-card{display:grid;gap:12px}.delivery-admin-card .panel-heading{margin-bottom:0}.delivery-add{min-height:36px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:#fff!important;text-align:center!important}.delivery-admin-list{display:grid;gap:7px}.delivery-admin-row{display:grid;grid-template-columns:minmax(180px,1fr) 150px 40px;gap:8px;align-items:center}.delivery-admin-row input{width:100%;height:42px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font-size:14px;font-weight:700}.delivery-admin-row input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(198,147,63,.13)}.delivery-admin-row button{height:40px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--danger);font-weight:900}.delivery-admin-row.is-origin input:first-child{background:#f1eee8;color:#71695f}.delivery-admin-row.is-origin button{visibility:hidden}.delivery-admin-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}.delivery-admin-actions .primary-button{min-width:190px}.delivery-admin-empty{padding:15px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:11px;text-align:center}
    @media(max-width:620px){.delivery-admin-row{grid-template-columns:1fr 105px 38px}.delivery-admin-row input{font-size:16px}.delivery-admin-actions{align-items:stretch;flex-direction:column}.delivery-admin-actions .primary-button{width:100%}}
  `;
  document.head.append(style);

  const list = section.querySelector('#deliveryAdminList');
  const addButton = section.querySelector('.delivery-add');
  const saveButton = section.querySelector('#saveDeliveryButton');
  const saveState = section.querySelector('#deliverySaveState');
  const settingsTabButton = document.querySelector('[data-admin-tab="settings"]');
  let loaded = false;
  let loading = false;
  let dirtyDelivery = false;
  let rows = [];

  function setDirty(value = true) {
    dirtyDelivery = value;
    saveButton.disabled = !value;
    saveState.textContent = value ? 'Есть несохранённые изменения доставки' : 'Тарифы доставки сохранены';
    saveState.classList.toggle('dirty', value);
  }

  function normalizedRows() {
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const name = String(row.name || '').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const price = name.toLocaleLowerCase('ru-RU') === 'мелеуз' ? 0 : Math.max(0, Math.round(Number(row.price) || 0));
      result.push({name, price});
    }
    if (!result.some(row => row.name.toLocaleLowerCase('ru-RU') === 'мелеуз')) result.unshift({name:'Мелеуз',price:0});
    return result;
  }

  function render() {
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div'); empty.className='delivery-admin-empty'; empty.textContent='Добавьте населённый пункт'; list.append(empty); return;
    }
    rows.forEach((row,index) => {
      const origin = String(row.name || '').toLocaleLowerCase('ru-RU') === 'мелеуз';
      const wrap = document.createElement('div');
      wrap.className = `delivery-admin-row${origin?' is-origin':''}`;
      const name = document.createElement('input');
      name.type='text'; name.value=row.name; name.maxLength=120; name.placeholder='Населённый пункт'; name.disabled=origin;
      name.setAttribute('aria-label', `Населённый пункт ${index+1}`);
      const price = document.createElement('input');
      price.type='number'; price.min='0'; price.max='1000000'; price.step='100'; price.inputMode='numeric'; price.value=String(row.price ?? 0);
      price.disabled=origin; price.setAttribute('aria-label', `Стоимость доставки ${row.name || index+1}`);
      const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.title=`Удалить ${row.name || 'пункт'}`;
      name.addEventListener('input',()=>{rows[index].name=name.value;setDirty();});
      price.addEventListener('input',()=>{rows[index].price=Number(price.value);setDirty();});
      remove.addEventListener('click',()=>{rows.splice(index,1);setDirty();render();});
      wrap.append(name,price,remove); list.append(wrap);
    });
  }

  async function load(force=false) {
    if (loading || (loaded && !force)) return;
    loading=true; saveState.textContent='Загружаем тарифы…';
    try {
      const data=await api('/api/admin/delivery');
      rows=(data.delivery?.destinations||[]).map(item=>({name:item.name,price:Number(item.price)||0}));
      loaded=true; setDirty(false); render();
    } catch(error) {
      saveState.textContent='Не удалось загрузить доставку'; showToast(error.message,true);
    } finally { loading=false; }
  }

  addButton.addEventListener('click',()=>{rows.push({name:'',price:0});setDirty();render();setTimeout(()=>list.querySelector('.delivery-admin-row:last-child input')?.focus(),0);});
  saveButton.addEventListener('click',async()=>{
    if(!dirtyDelivery)return;
    saveButton.disabled=true; saveButton.textContent='Сохраняем…';
    try {
      const data=await api('/api/admin/delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({delivery:{destinations:normalizedRows()}})});
      rows=(data.delivery?.destinations||[]).map(item=>({name:item.name,price:Number(item.price)||0}));
      render(); setDirty(false); showToast('Тарифы доставки опубликованы на сайте');
    } catch(error) { setDirty(true); showToast(error.message,true); }
    finally { saveButton.textContent='Сохранить доставку'; saveButton.disabled=!dirtyDelivery; }
  });

  settingsTabButton?.addEventListener('click',()=>load());
  document.querySelector('.admin-tabs')?.addEventListener('click',event=>{
    const button=event.target.closest('.admin-tab');
    if(!button || button===settingsTabButton || !dirtyDelivery)return;
    event.preventDefault(); event.stopImmediatePropagation();
    showToast('Сначала сохраните изменения доставки',true);
  },true);
  window.addEventListener('beforeunload',event=>{if(!dirtyDelivery)return;event.preventDefault();event.returnValue='';});
})();
