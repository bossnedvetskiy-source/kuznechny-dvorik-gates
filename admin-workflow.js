(() => {
  const panel = document.getElementById('leadsTab');
  const list = panel?.querySelector('#leadList');
  if (!panel || !list) return;

  const STAGES = [
    ['new','Новая заявка'],
    ['contacted','Связались'],
    ['measurement_scheduled','Замер назначен'],
    ['measurement_done','Замер выполнен'],
    ['contract','Договор заключён'],
    ['production','В производстве'],
    ['installation','Монтаж'],
    ['completed','Выполнено'],
    ['lost','Отказ / не состоялось']
  ];
  const stageLabel = new Map(STAGES);

  const style = document.createElement('style');
  style.textContent = `
    #leadsTab .lead-status{display:none!important}.lead-workflow-panel{display:grid;gap:10px;margin-top:12px;padding:12px;border:1px solid #e4ddd2;border-radius:12px;background:#fcfaf6}.lead-workflow-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.lead-workflow-head b{font-size:11px}.lead-stage-pill{padding:5px 8px;border-radius:999px;background:#efe8dc;color:#795c2a;font-size:9px;font-weight:900}.lead-workflow-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:8px}.lead-workflow-grid label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}.lead-workflow-grid select,.lead-workflow-grid input,.lead-workflow-grid textarea{width:100%;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:11px;text-transform:none;letter-spacing:0}.lead-workflow-grid select,.lead-workflow-grid input{height:39px;padding:0 9px}.lead-workflow-grid textarea{min-height:70px;padding:9px;resize:vertical}.lead-workflow-note{grid-column:1/-1}.lead-loss-reason{grid-column:1/-1}.lead-workflow-save{justify-self:end;min-height:38px;padding:0 13px;border:0;border-radius:9px;background:var(--ink);color:#fff;font-size:10px;font-weight:900}.lead-marketing{border-top:1px solid #e9e3da;padding-top:8px}.lead-marketing summary{cursor:pointer;color:#7a6d5e;font-size:9px;font-weight:900}.lead-marketing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.lead-marketing-item{display:grid;gap:2px;padding:7px 8px;border-radius:8px;background:#f5f1ea;min-width:0}.lead-marketing-item span{color:var(--muted);font-size:8px;text-transform:uppercase}.lead-marketing-item b{overflow:hidden;text-overflow:ellipsis;color:#4c4741;font-size:9px;white-space:nowrap}.lead-marketing-item.wide{grid-column:1/-1}.lead-marketing-empty{color:var(--muted);font-size:9px}.lead-card[data-workflow-stage="lost"]{opacity:.78}.lead-card[data-workflow-stage="completed"]{border-color:#b7c4ac}.lead-card[data-workflow-stage="measurement_scheduled"]{border-color:#d8bd85}
    @media(max-width:700px){.lead-workflow-grid{grid-template-columns:1fr}.lead-workflow-note,.lead-loss-reason{grid-column:auto}.lead-marketing-grid{grid-template-columns:1fr 1fr}.lead-marketing-item.wide{grid-column:1/-1}.lead-workflow-save{width:100%;justify-self:stretch}}
  `;
  document.head.append(style);

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  let enhancementTimer = 0;
  let loading = false;

  function marketingItem(label, value, wide=false) {
    if (!value) return '';
    return `<div class="lead-marketing-item${wide?' wide':''}"><span>${esc(label)}</span><b title="${esc(value)}">${esc(value)}</b></div>`;
  }

  function workflowMarkup(id, data) {
    const tracking = data?.tracking || {};
    const options = STAGES.map(([value,label]) => `<option value="${value}" ${data.stage===value?'selected':''}>${label}</option>`).join('');
    const anyTracking = Object.values(tracking).some(Boolean);
    const marketing = anyTracking ? `
      <details class="lead-marketing"><summary>Реклама и метки</summary><div class="lead-marketing-grid">
        ${marketingItem('Источник',tracking.utmSource)}${marketingItem('Канал',tracking.utmMedium)}${marketingItem('Кампания',tracking.utmCampaign)}
        ${marketingItem('Объявление',tracking.utmContent)}${marketingItem('Ключ',tracking.utmTerm)}${marketingItem('yclid',tracking.yclid)}${marketingItem('gclid',tracking.gclid)}
        ${marketingItem('Страница входа',tracking.landingPage,true)}${marketingItem('Реферер',tracking.referrer,true)}
      </div></details>` : '<div class="lead-marketing-empty">Рекламные метки не переданы.</div>';
    return `<div class="lead-workflow-panel" data-workflow-for="${id}">
      <div class="lead-workflow-head"><b>Работа с заявкой</b><span class="lead-stage-pill">${esc(stageLabel.get(data.stage)||data.stage)}</span></div>
      <div class="lead-workflow-grid">
        <label>Этап<select data-workflow-field="stage">${options}</select></label>
        <label>Следующее действие<input data-workflow-field="nextActionAt" type="datetime-local" value="${esc(data.nextActionAt||'')}"></label>
        <label class="lead-workflow-note">Внутренняя заметка<textarea data-workflow-field="note" maxlength="1200" placeholder="Например: созвониться после 18:00">${esc(data.note||'')}</textarea></label>
        <label class="lead-loss-reason" ${data.stage==='lost'?'':'hidden'}>Причина отказа<input data-workflow-field="lossReason" maxlength="400" value="${esc(data.lossReason||'')}" placeholder="Цена, отложил, выбрал другого…"></label>
      </div>
      ${data.color?`<div class="lead-marketing-empty">Предпочитаемый цвет: <b>${esc(data.color)}</b></div>`:''}
      ${marketing}
      <button class="lead-workflow-save" type="button">Сохранить этап и заметку</button>
    </div>`;
  }

  async function loadForVisibleCards() {
    if (loading) return;
    const cards=[...list.querySelectorAll('[data-lead-id]')];
    const pending=cards.filter(card=>!card.querySelector('.lead-workflow-panel'));
    if(!pending.length)return;
    const ids=pending.map(card=>Number(card.dataset.leadId)).filter(Boolean);
    if(!ids.length)return;
    loading=true;
    try {
      const data=await api(`/api/admin/lead-workflows?ids=${encodeURIComponent(ids.join(','))}`);
      for(const card of pending){
        const id=Number(card.dataset.leadId); const item=data.workflows?.[id]; if(!item)continue;
        card.dataset.workflowStage=item.stage;
        const target=card.querySelector('.lead-details');
        const holder=document.createElement('div'); holder.innerHTML=workflowMarkup(id,item);
        const workflow=holder.firstElementChild;
        if(target) target.before(workflow); else card.append(workflow);
        const stage=workflow.querySelector('[data-workflow-field="stage"]');
        const loss=workflow.querySelector('.lead-loss-reason');
        stage.addEventListener('change',()=>{loss.hidden=stage.value!=='lost';});
        workflow.querySelector('.lead-workflow-save').addEventListener('click',()=>saveWorkflow(card,workflow));
      }
    } catch(error) { console.warn('Lead workflow enhancement failed',error); }
    finally { loading=false; }
  }

  async function saveWorkflow(card, workflow) {
    const id=Number(card.dataset.leadId); const button=workflow.querySelector('.lead-workflow-save');
    const value=name=>workflow.querySelector(`[data-workflow-field="${name}"]`)?.value||'';
    button.disabled=true; button.textContent='Сохраняем…';
    try {
      const data=await api(`/api/admin/lead-workflows/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:value('stage'),nextActionAt:value('nextActionAt'),note:value('note'),lossReason:value('lossReason')})});
      card.dataset.workflowStage=data.stage;
      workflow.querySelector('.lead-stage-pill').textContent=stageLabel.get(data.stage)||data.stage;
      showToast('Этап и заметка сохранены');
    } catch(error) { showToast(error.message,true); }
    finally { button.disabled=false; button.textContent='Сохранить этап и заметку'; }
  }

  const observer=new MutationObserver(()=>{
    clearTimeout(enhancementTimer); enhancementTimer=setTimeout(loadForVisibleCards,30);
  });
  observer.observe(list,{childList:true});
  loadForVisibleCards();

  function leadQuery({cursor=null,filtered=true}={}) {
    const params=new URLSearchParams({limit:'200'});
    const active=panel.querySelector('[data-lead-filter].active')?.dataset.leadFilter||'all';
    if(filtered&&active!=='all')params.set('status',active);
    if(cursor)params.set('before_id',String(cursor));
    if(filtered){
      const q=panel.querySelector('#leadSearchInput')?.value.trim(); const source=panel.querySelector('#leadSourceFilter')?.value;
      const from=panel.querySelector('#leadDateFrom')?.value; const to=panel.querySelector('#leadDateTo')?.value;
      if(q)params.set('q',q); if(source)params.set('source',source); if(from)params.set('from',from); if(to)params.set('to',to);
    }
    return `/api/admin/leads?${params}`;
  }

  async function fetchAll(filtered=true) {
    const all=[]; let cursor=null; let guard=0;
    do {
      if(++guard>1000)throw new Error('Слишком много страниц заявок');
      const data=await api(leadQuery({cursor,filtered}));
      all.push(...(data.leads||[]));
      cursor=data.page?.hasMore?data.page?.nextBeforeId:null;
    } while(cursor);
    return all;
  }

  async function workflowMapFor(ids) {
    const result={};
    for(let index=0;index<ids.length;index+=150){
      const part=ids.slice(index,index+150); if(!part.length)continue;
      const data=await api(`/api/admin/lead-workflows?ids=${encodeURIComponent(part.join(','))}`);
      Object.assign(result,data.workflows||{});
    }
    return result;
  }

  function download(filename,text,type) {
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const link=document.createElement('a');
    link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const csvButton=panel.querySelector('#exportLeadsCsv');
  csvButton?.addEventListener('click',async event=>{
    event.preventDefault(); event.stopImmediatePropagation(); csvButton.disabled=true;
    try {
      const leads=await fetchAll(true); if(!leads.length)return showToast('Нет заявок для экспорта',true);
      const workflows=await workflowMapFor(leads.map(item=>item.id));
      const columns=['id','created_at','stage','name','phone','city','article','color','total','client_total','quote_verified','source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid','gclid','referrer','landing_page','next_action','admin_note','loss_reason','comment','message'];
      const quote=value=>`"${String(value??'').replace(/"/g,'""')}"`;
      const rows=[columns.join(';')];
      for(const lead of leads){const wf=workflows[lead.id]||{};const t=wf.tracking||{};const row={...lead,stage:wf.stage||lead.status,color:wf.color||lead.color,utm_source:t.utmSource,utm_medium:t.utmMedium,utm_campaign:t.utmCampaign,utm_content:t.utmContent,utm_term:t.utmTerm,yclid:t.yclid,gclid:t.gclid,referrer:t.referrer,landing_page:t.landingPage,next_action:wf.nextActionAt,admin_note:wf.note,loss_reason:wf.lossReason};rows.push(columns.map(key=>quote(row[key])).join(';'));}
      const date=new Date().toISOString().slice(0,10); download(`kuznechny-dvorik-leads-${date}.csv`,'\ufeff'+rows.join('\n'),'text/csv;charset=utf-8'); showToast(`Экспортировано заявок: ${leads.length}`);
    } catch(error){showToast(error.message,true);} finally{csvButton.disabled=false;}
  },true);

  const backupButton=panel.querySelector('#backupLeadsJson');
  backupButton?.addEventListener('click',async event=>{
    event.preventDefault(); event.stopImmediatePropagation(); backupButton.disabled=true;
    try {
      const leads=await fetchAll(false); const workflows=await workflowMapFor(leads.map(item=>item.id));
      const date=new Date().toISOString().slice(0,10); download(`kuznechny-dvorik-leads-backup-${date}.json`,JSON.stringify({exportedAt:new Date().toISOString(),complete:true,count:leads.length,leads,workflows},null,2),'application/json;charset=utf-8'); showToast(`Полный резерв сохранён: ${leads.length} заявок`);
    } catch(error){showToast(error.message,true);} finally{backupButton.disabled=false;}
  },true);
})();
