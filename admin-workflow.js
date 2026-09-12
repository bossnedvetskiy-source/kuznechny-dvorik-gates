(() => {
  const panel=document.getElementById('leadsTab');
  const list=panel?.querySelector('#leadList');
  if(!panel||!list)return;
  const STAGES=[['new','Новая заявка'],['contacted','Связались'],['measurement_scheduled','Замер назначен'],['measurement_done','Замер выполнен'],['contract','Договор заключён'],['production','В производстве'],['installation','Монтаж'],['completed','Выполнено'],['lost','Отказ / не состоялось']];
  const labels=new Map(STAGES);
  const style=document.createElement('style');
  style.textContent=`#leadsTab .lead-status{display:none!important}.lead-workflow-panel{display:grid;gap:10px;margin-top:12px;padding:12px;border:1px solid #e4ddd2;border-radius:12px;background:#fcfaf6}.lead-workflow-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.lead-workflow-head b{font-size:11px}.lead-stage-pill{padding:5px 8px;border-radius:999px;background:#efe8dc;color:#795c2a;font-size:9px;font-weight:900}.lead-workflow-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:8px}.lead-workflow-grid label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}.lead-workflow-grid select,.lead-workflow-grid input,.lead-workflow-grid textarea{width:100%;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:11px;text-transform:none;letter-spacing:0}.lead-workflow-grid select,.lead-workflow-grid input{height:39px;padding:0 9px}.lead-workflow-grid textarea{min-height:70px;padding:9px;resize:vertical}.lead-workflow-note,.lead-loss-reason{grid-column:1/-1}.lead-workflow-save{justify-self:end;min-height:38px;padding:0 13px;border:0;border-radius:9px;background:var(--ink);color:#fff;font-size:10px;font-weight:900}.lead-workflow-color{color:var(--muted);font-size:9px}.lead-card[data-workflow-stage="lost"]{opacity:.78}.lead-card[data-workflow-stage="completed"]{border-color:#b7c4ac}.lead-card[data-workflow-stage="measurement_scheduled"]{border-color:#d8bd85}@media(max-width:700px){.lead-workflow-grid{grid-template-columns:1fr}.lead-workflow-note,.lead-loss-reason{grid-column:auto}.lead-workflow-save{width:100%;justify-self:stretch}}`;
  document.head.append(style);

  let loading=false,timer=0;
  async function enhance(){
    if(loading||panel.hidden)return;
    const cards=[...list.querySelectorAll('[data-lead-id]')].filter(card=>!card.querySelector('.lead-workflow-panel'));
    const ids=cards.map(card=>Number(card.dataset.leadId)).filter(Boolean);
    if(!ids.length)return;
    loading=true;
    try{
      const data=await api(`/api/admin/lead-workflows?ids=${encodeURIComponent(ids.join(','))}`);
      for(const card of cards){
        const id=Number(card.dataset.leadId),item=data.workflows?.[id];if(!item)continue;
        card.dataset.workflowStage=item.stage;
        const box=document.createElement('div');box.className='lead-workflow-panel';box.dataset.workflowFor=String(id);
        const options=STAGES.map(([value,label])=>`<option value="${value}" ${item.stage===value?'selected':''}>${label}</option>`).join('');
        box.innerHTML=`<div class="lead-workflow-head"><b>Работа с заявкой</b><span class="lead-stage-pill">${labels.get(item.stage)||item.stage}</span></div><div class="lead-workflow-grid"><label>Этап<select data-field="stage">${options}</select></label><label>Следующее действие<input data-field="nextActionAt" type="datetime-local" value="${String(item.nextActionAt||'').replace(/"/g,'&quot;')}"></label><label class="lead-workflow-note">Внутренняя заметка<textarea data-field="note" maxlength="1200" placeholder="Например: созвониться после 18:00"></textarea></label><label class="lead-loss-reason" ${item.stage==='lost'?'':'hidden'}>Причина отказа<input data-field="lossReason" maxlength="400" placeholder="Цена, отложил, выбрал другого…"></label></div>${item.color?`<div class="lead-workflow-color">Предпочитаемый цвет: <b>${String(item.color).replace(/[<>&]/g,'')}</b></div>`:''}<button class="lead-workflow-save" type="button">Сохранить этап и заметку</button>`;
        box.querySelector('[data-field="note"]').value=item.note||'';
        box.querySelector('[data-field="lossReason"]').value=item.lossReason||'';
        const stage=box.querySelector('[data-field="stage"]'),loss=box.querySelector('.lead-loss-reason');
        stage.addEventListener('change',()=>{loss.hidden=stage.value!=='lost';});
        box.querySelector('.lead-workflow-save').addEventListener('click',()=>save(card,box));
        const details=card.querySelector('.lead-details'); if(details)details.before(box);else card.append(box);
      }
    }catch(error){console.warn('Lead workflow enhancement failed',error);}finally{loading=false;}
  }
  async function save(card,box){
    const id=Number(card.dataset.leadId),button=box.querySelector('.lead-workflow-save'),value=name=>box.querySelector(`[data-field="${name}"]`)?.value||'';
    button.disabled=true;button.textContent='Сохраняем…';
    try{const data=await api(`/api/admin/lead-workflows/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:value('stage'),nextActionAt:value('nextActionAt'),note:value('note'),lossReason:value('lossReason')})});card.dataset.workflowStage=data.stage;box.querySelector('.lead-stage-pill').textContent=labels.get(data.stage)||data.stage;showToast('Этап и заметка сохранены');}catch(error){showToast(error.message,true);}finally{button.disabled=false;button.textContent='Сохранить этап и заметку';}
  }
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40);}).observe(list,{childList:true});
  document.querySelector('.admin-tabs')?.addEventListener('click',event=>{if(event.target.closest('[data-admin-tab="leads"]'))setTimeout(enhance,120);});
  enhance();
})();
