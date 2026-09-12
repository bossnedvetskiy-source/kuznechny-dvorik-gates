(() => {
  const targets=[
    {key:'prices',anchor:'#savePricesButton',label:'История цен'},
    {key:'site_profile',anchor:'#saveSiteSettingsButton',label:'История настроек'},
    {key:'delivery_prices',anchor:'#saveDeliveryButton',label:'История доставки'}
  ];
  const style=document.createElement('style');
  style.textContent=`.history-button{min-height:38px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:#746653;font-size:10px;font-weight:800}.admin-history-modal{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:18px;background:rgba(8,9,10,.66)}.admin-history-card{width:min(620px,100%);max-height:min(720px,90dvh);overflow:auto;padding:20px;border-radius:18px;background:#f7f4ef;box-shadow:0 30px 90px rgba(0,0,0,.35)}.admin-history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.admin-history-head h2{margin:0;font:25px Prata,serif}.admin-history-close{width:38px;height:38px;border:1px solid var(--line);border-radius:50%;background:#fff;font-size:20px}.admin-history-list{display:grid;gap:8px}.admin-history-item{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.admin-history-item div{display:grid;gap:4px}.admin-history-item b{font-size:11px}.admin-history-item small{color:var(--muted);font-size:9px;line-height:1.45}.admin-history-item button{min-height:36px;padding:0 10px;border:0;border-radius:8px;background:var(--ink);color:#fff;font-size:9px;font-weight:900}.admin-history-empty{padding:22px;color:var(--muted);text-align:center;font-size:11px}@media(max-width:620px){.admin-history-item{grid-template-columns:1fr}.admin-history-item button{width:100%}}`;
  document.head.append(style);

  const modal=document.createElement('div'); modal.className='admin-history-modal'; modal.hidden=true;
  modal.innerHTML='<section class="admin-history-card" role="dialog" aria-modal="true"><div class="admin-history-head"><h2>История</h2><button class="admin-history-close" type="button" aria-label="Закрыть">×</button></div><div class="admin-history-list"></div></section>';
  document.body.append(modal);
  const title=modal.querySelector('h2'); const list=modal.querySelector('.admin-history-list');
  const close=()=>{modal.hidden=true;}; modal.querySelector('.admin-history-close').addEventListener('click',close); modal.addEventListener('click',event=>{if(event.target===modal)close();});

  const summary=(key,value)=>{
    if(!value)return 'Сохранённая версия';
    if(key==='prices')return `Монтаж ${Number(value.catalogInstallation)||0} ₽ · столбы ${Number(value.catalogPosts)||0} ₽ · моделей ${value.catalog?.length||0}`;
    if(key==='site_profile')return `${value.phoneDisplay||''} · гарантия ${value.warrantyYears||'—'} · срок ${value.productionDays||'—'} раб. дней`;
    if(key==='delivery_prices')return `Фиксированных населённых пунктов: ${value.destinations?.length||0}`;
    return 'Сохранённая версия';
  };

  async function openHistory(target){
    title.textContent=target.label; list.innerHTML='<div class="admin-history-empty">Загружаем…</div>'; modal.hidden=false;
    try{
      const data=await api(`/api/admin/history?key=${encodeURIComponent(target.key)}`); const history=data.history||[];
      if(!history.length){list.innerHTML='<div class="admin-history-empty">Предыдущих версий пока нет.</div>';return;}
      list.replaceChildren();
      history.forEach(item=>{
        const row=document.createElement('article');row.className='admin-history-item';
        const info=document.createElement('div');const date=document.createElement('b');date.textContent=new Date(String(item.savedAt).replace(' ','T')+'Z').toLocaleString('ru-RU');const small=document.createElement('small');small.textContent=summary(target.key,item.value);info.append(date,small);
        const restore=document.createElement('button');restore.type='button';restore.textContent='Вернуть эту версию';restore.addEventListener('click',async()=>{
          if(!confirm('Вернуть выбранную версию? Текущее состояние сначала сохранится в истории.'))return;
          restore.disabled=true;restore.textContent='Восстанавливаем…';
          try{await api('/api/admin/history/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id})});showToast('Версия восстановлена');setTimeout(()=>location.reload(),500);}catch(error){showToast(error.message,true);restore.disabled=false;restore.textContent='Вернуть эту версию';}
        });
        row.append(info,restore);list.append(row);
      });
    }catch(error){list.innerHTML=`<div class="admin-history-empty">${String(error.message||error)}</div>`;}
  }

  targets.forEach(target=>{
    const anchor=document.querySelector(target.anchor); if(!anchor)return;
    const button=document.createElement('button');button.type='button';button.className='history-button';button.textContent='↶ '+target.label;button.addEventListener('click',()=>openHistory(target));anchor.parentElement?.insertBefore(button,anchor);
  });
})();
