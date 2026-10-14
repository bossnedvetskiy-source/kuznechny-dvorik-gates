(() => {
    const loginView=document.getElementById('loginView');
    const appView=document.getElementById('appView');
    const loginForm=document.getElementById('loginForm');
    const loginButton=document.getElementById('loginButton');
    const loginError=document.getElementById('loginError');
    const logoutButton=document.getElementById('logoutButton');
    const refreshButton=document.getElementById('refreshButton');
    const pushButton=document.getElementById('pushButton');
    const pushStatusText=document.getElementById('pushStatusText');
    const leadList=document.getElementById('leadList');
    const emptyView=document.getElementById('emptyView');
    const syncText=document.getElementById('syncText');
    const offlineBadge=document.getElementById('offlineBadge');
    const toast=document.getElementById('toast');
    const installCard=document.getElementById('installCard');
    const installButton=document.getElementById('installButton');
    const tabs=[...document.querySelectorAll('.tab[data-filter]')];
    const CACHE_KEY='kuzdvor-manager-leads-v2';
    const DRAFT_KEY='kuzdvor-manager-drafts-v2';
    const ACCESS_KEY='kuzdvor-manager-access-v2';
    const STAGES=['new','contacted','measurement_scheduled','measurement_done','contract','production','installation','completed','lost'];
    let drafts={};
    let loading=null;
    let saving=false;
    let savedAt=0;
    let authenticated=false;
    let offlineKey=null;
    const offlineButton=document.getElementById('offlineButton');
    const offlineForm=document.getElementById('offlineForm');
    const offlinePin=document.getElementById('offlinePin');
    const search=document.getElementById('search');
    const dayFilter=document.getElementById('dayFilter');
    const roleText=document.getElementById('roleText');
    let session={};
    let team=[];
    
    let leads=[];
    let workflows={};
    let activeFilter='new';
    let latestId=0;
    let pollTimer=0;
    let installPrompt=null;
    let awaitingPushReceipt=false;
    let pushReceiptTimer=0;
    let pendingPushTestId='';
    let requestedLead=Number(new URL(location.href).searchParams.get('lead'))||0;

    const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const money=value=>new Intl.NumberFormat('ru-RU').format(Number(value)||0)+' ₽';
    const phoneDigits=value=>{let digits=String(value||'').replace(/\D/g,'');if(digits.length===10)digits='7'+digits;if(digits.length===11&&digits[0]==='8')digits='7'+digits.slice(1);return /^7\d{10}$/.test(digits)?digits:''};
    const fmt=value=>{const d=new Date(String(value||'').replace(' ','T')+'Z');return Number.isNaN(d.getTime())?String(value||''):d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
    const stageOf=lead=>String(workflows[String(lead.id)]?.stage || (lead.status==='done'?'completed':lead.status==='archived'?'lost':lead.status==='contacted'?'contacted':'new'));
    const stageLabel=stage=>({new:'Новая',contacted:'В работе',measurement_scheduled:'Замер назначен',measurement_done:'Замер выполнен',contract:'Договор',production:'Производство',installation:'Монтаж',completed:'Закрыта',lost:'Отказ'})[stage]||stage;
    const categoryLabel=value=>({gates:'Ворота с калиткой',canopy:'Навес','forged-fence':'Кованый забор','profsheet-fence':'Забор из профнастила','picket-fence':'Евроштакетник'})[value]||'Изделие';

    function showToast(message,error=false){toast.textContent=message;toast.className='toast'+(error?' error':'');toast.hidden=false;clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.hidden=true,2800)}
    async function api(url,options={}){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
        const data=await response.json().catch(()=>{throw new Error('Сервер вернул некорректный ответ')});
        if(response.status===401&&url!=='/api/admin/login'){authenticated=false;lockCache();showLogin();throw Object.assign(new Error('Сессия закончилась. Войдите снова.'),{auth:true,status:401})}
        if(!response.ok)throw Object.assign(new Error(data.error||'Ошибка сервера'),{status:response.status,workflow:data.workflow});
        return data;
      }catch(error){if(error.name==='AbortError')throw new Error('Сервер не ответил вовремя. Повторите попытку.');throw error}finally{clearTimeout(timer)}
    }
    function showLogin(){loginView.hidden=false;appView.hidden=true;logoutButton.hidden=true;clearTimeout(pollTimer);offlineForm.hidden=!localStorage.getItem(ACCESS_KEY)}
    function showApp(){loginView.hidden=true;appView.hidden=false;logoutButton.hidden=false;startPolling()}
    const bytesTo64=bytes=>{let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(raw)};
    const from64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
    async function deriveKey(pin,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
    async function writeEncrypted(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},offlineKey,new TextEncoder().encode(JSON.stringify(value)));localStorage.setItem(key,JSON.stringify({iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(encrypted))}))}
    async function readEncrypted(key){const raw=JSON.parse(localStorage.getItem(key)||'null');if(!raw)return null;return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(raw.iv)},offlineKey,from64(raw.data))))}
    let cacheWrite=Promise.resolve();
    function saveCache(){if(!offlineKey)return cacheWrite;const snapshot=JSON.parse(JSON.stringify({leads,workflows,savedAt,session}));const pending=JSON.parse(JSON.stringify(drafts));cacheWrite=cacheWrite.catch(()=>{}).then(async()=>{await writeEncrypted(CACHE_KEY,snapshot);await writeEncrypted(DRAFT_KEY,pending)}).catch(()=>{showToast('Не удалось сохранить данные на устройстве. Проверьте свободное место.',true)});return cacheWrite}
    async function loadCache(){if(!offlineKey)return false;const v=await readEncrypted(CACHE_KEY);if(!v||!Array.isArray(v.leads))return false;leads=v.leads;workflows=v.workflows||{};savedAt=v.savedAt||0;session=v.session||{};drafts=await readEncrypted(DRAFT_KEY)||{};latestId=Math.max(0,...leads.map(x=>Number(x.id)||0));render();return true}
    function lockCache(){offlineKey=null;leads=[];workflows={};drafts={};leadList.innerHTML='';document.getElementById('password').value='';offlinePin.value=''}
    function clearCache(){localStorage.removeItem(CACHE_KEY);localStorage.removeItem(DRAFT_KEY);localStorage.removeItem(ACCESS_KEY);localStorage.removeItem('kuzdvor-manager-leads-v1');lockCache()}
    function syncLabel(prefix='Обновлено'){syncText.textContent=prefix+(savedAt?' · '+new Date(savedAt).toLocaleString('ru-RU'):'')}
    function capture(card){const id=card.dataset.leadId;const base=drafts[id]||{expectedRevision:workflows[id]?.revision??0};drafts[id]={...base,stage:card.querySelector('[data-stage]').value,nextActionAt:card.querySelector('[data-measurement]').value,note:card.querySelector('[data-note]').value,lossReason:card.querySelector('[data-loss]').value,actionType:card.querySelector('[data-action-type]').value,timeZone:card.querySelector('[data-time-zone]').value,address:card.querySelector('[data-address]').value,measurement:Object.fromEntries([...card.querySelectorAll('[data-m]')].map(x=>[x.dataset.m,x.value]))};drafts[id].measurement.photos=[...(base.measurement?.photos||workflows[id]?.measurement?.photos||[])];const assigned=card.querySelector('[data-assigned]');if(assigned)drafts[id].assignedTo=Number(assigned.value)||null;card.querySelector('[data-draft-state]').textContent='Есть несохранённые изменения';saveCache()}
    offlineButton.addEventListener('click',async()=>{
      if(!authenticated){showToast('Для настройки офлайн-доступа сначала войдите через интернет.',true);return}
      const existing=JSON.parse(localStorage.getItem(ACCESS_KEY)||'null');
      const pin=window.prompt(existing&&!offlineKey?'Введите пароль ранее сохранённых данных, чтобы восстановить офлайн-черновики.':'Создайте пароль офлайн-доступа (не менее 8 символов). Он защищает данные на этом устройстве.');if(!pin)return;if(pin.length<8){showToast('Нужно не менее 8 символов',true);return}
      try{if(existing&&!offlineKey){const onlineSession=session;const onlineLeads=leads;const onlineWorkflows=workflows;if(existing.ownerId&&existing.ownerId!==session.id)throw new Error('Данные сохранены для другого сотрудника');offlineKey=await deriveKey(pin,from64(existing.salt));await loadCache();session=onlineSession;leads=onlineLeads;workflows=onlineWorkflows;existing.expiresAt=Date.now()+24*60*60*1000;localStorage.setItem(ACCESS_KEY,JSON.stringify(existing));await saveCache();render();showToast('Офлайн-черновики восстановлены. Проверьте и сохраните их на сервере.');return}const salt=crypto.getRandomValues(new Uint8Array(16));offlineKey=await deriveKey(pin,salt);localStorage.setItem(ACCESS_KEY,JSON.stringify({salt:bytesTo64(salt),ownerId:session.id,expiresAt:Date.now()+24*60*60*1000}));await saveCache();showToast('Офлайн-доступ включён на 24 часа. Для открытия используйте созданный пароль.')}catch{showToast('Не удалось включить офлайн-доступ',true)}
    });
    offlineForm.addEventListener('submit',async event=>{
      event.preventDefault();try{const access=JSON.parse(localStorage.getItem(ACCESS_KEY)||'null');if(!access||access.expiresAt<Date.now())throw new Error('Офлайн-доступ закончился. Войдите через интернет.');offlineKey=await deriveKey(offlinePin.value,from64(access.salt));if(!await loadCache())throw new Error('Нет сохранённых заявок');offlinePin.value='';showApp();syncLabel('Сохранённые данные');offlineBadge.textContent='Офлайн-доступ · изменения сохраняются как черновики';offlineBadge.hidden=false;if(navigator.onLine)loadLeads();}catch(error){offlineKey=null;showToast(error.name==='OperationError'?'Неверный пароль офлайн-доступа':error.message,true)}
    });

    function matches(lead){
      const stage=drafts[String(lead.id)]?.stage||stageOf(lead);
      const query=search.value.trim().toLocaleLowerCase('ru-RU');
      if(query&&![lead.name,lead.phone,lead.city,lead.article,lead.comment,workflows[String(lead.id)]?.address].some(v=>String(v||'').toLocaleLowerCase('ru-RU').includes(query)))return false;
      if(activeFilter==='closed')return ['completed','lost'].includes(stage);
      if(activeFilter==='measurement'&&dayFilter.value){const when=workflows[String(lead.id)]?.nextActionAt||'';const today=new Date();const day=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);if(dayFilter.value==='overdue'){if(!when||when>=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,16))return false}else{if(dayFilter.value==='tomorrow'){today.setDate(today.getDate()+1)}const target=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);if(when.slice(0,10)!==target)return false}}
      if(activeFilter==='new') return stage==='new';
      if(activeFilter==='work') return ['contacted','measurement_done','contract','production','installation'].includes(stage);
      if(activeFilter==='measurement') return stage==='measurement_scheduled';
      return true;
    }

    function updateCounts(){
      const stages=leads.map(stageOf);
      document.getElementById('countNew').textContent=stages.filter(x=>x==='new').length;
      document.getElementById('countWork').textContent=stages.filter(x=>['contacted','measurement_done','contract','production','installation'].includes(x)).length;
      document.getElementById('countMeasurement').textContent=stages.filter(x=>x==='measurement_scheduled').length;
    }

    function render(){
      updateCounts();roleText.textContent=session.username?session.username+' · '+({admin:'Администратор',manager:'Менеджер',surveyor:'Замерщик'}[session.role]||''):'Заявки';
      const openDetails=[...leadList.querySelectorAll('.measurement-details[open]')].map(x=>x.closest('.lead-card').dataset.leadId);
      const focused=document.activeElement;const focusId=focused?.closest?.('.lead-card')?.dataset.leadId;const focusField=focused?.getAttribute?.('data-field');const position=focused?.selectionStart;
      const items=leads.filter(matches).sort((a,b)=>activeFilter==='measurement'?String(workflows[String(a.id)]?.nextActionAt||'9999').localeCompare(String(workflows[String(b.id)]?.nextActionAt||'9999')):Number(b.id)-Number(a.id));
      emptyView.hidden=items.length>0;
      leadList.innerHTML=items.map(lead=>{
        const wf={...(workflows[String(lead.id)]||{}),...(drafts[String(lead.id)]||{})};
        const stage=wf.stage||stageOf(lead);
        const digits=phoneDigits(lead.phone);
        const wa=digits?('https://wa.me/'+(digits.startsWith('8')?'7'+digits.slice(1):digits)):'#';
        const title=[categoryLabel(lead.category),lead.article].filter(Boolean).join(' · ');
        const size=lead.width&&lead.height?lead.width+'×'+lead.height+' м':'—';
        const wicket=lead.wicket_width?lead.wicket_width+(lead.wicket_height?'×'+lead.wicket_height:'')+' м':'—';
        const when=String(wf.nextActionAt||'').slice(0,16);const m=wf.measurement||{};
        return `<article class="lead-card ${stage==='new'?'is-new':''}" data-lead-id="${lead.id}">
          <div class="lead-head"><div class="lead-title"><b>${escape(lead.name||'Клиент')} · ${escape(lead.city||'')}</b><span>№${lead.id} · ${escape(fmt(lead.created_at))} · ${escape(title)}</span></div><div class="lead-total">${money(lead.total??lead.client_total)}<small>${lead.quote_verified?'Расчёт проверен':'Предварительная цена'}</small></div></div>
          <div class="lead-info">
            <div class="info"><span>Телефон</span><b>${escape(lead.phone||'—')}</b></div>
            <div class="info"><span>${lead.category==='gates'?'Размер ворот':'Размер изделия'}</span><b>${escape(size)}</b></div>
            <div class="info"><span>Калитка</span><b>${escape(wicket)}</b></div>
            <div class="info"><span>Столбы</span><b>${lead.posts?'Нужны новые':'Свои'}</b></div>
          </div>
          <div class="lead-details"><p><b>Цвет:</b> ${escape(lead.color||'Не указан')} · <b>Монтаж:</b> ${lead.install?'Нужен':'Не заказан'}</p>
          ${lead.delivery_pending?'<p class="error">Стоимость доставки требует уточнения</p>':''}${lead.delivery_out_of_area?'<p class="error">Объект вне зоны обслуживания</p>':''}
          ${lead.comment?`<p><b>Комментарий клиента:</b> ${escape(lead.comment)}</p>`:''}
          <details><summary>Полная заявка</summary><p>${escape(lead.message||'')}</p>${Object.entries(lead.configuration||{}).map(([k,v])=>`<p>${escape(k)}: ${escape(typeof v==='object'?JSON.stringify(v):v)}</p>`).join('')}</details></div>
          <div class="contact-row">${digits?`<a href="tel:+${digits}">☎ Позвонить</a><a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:'<span>Телефон требует уточнения</span>'}</div>
          <div class="workflow">
            <div class="workflow-grid">
              <label class="field"><span>Статус</span><select data-stage data-field="stage">
                ${STAGES.map(value=>`<option value="${value}" ${value===stage?'selected':''}>${stageLabel(value)}</option>`).join('')}
              </select></label>
              <label class="field"><span>Дата и время следующего действия</span><input data-measurement data-field="date" type="datetime-local" value="${escape(when)}"></label>
              <label class="field"><span>Следующее действие</span><select data-action-type data-field="actionType">${[['measurement','Замер'],['call','Звонок'],['other','Другое']].map(([v,l])=>`<option value="${v}" ${(wf.actionType||'measurement')===v?'selected':''}>${l}</option>`).join('')}</select></label>
              <label class="field"><span>Часовой пояс назначения</span><select data-time-zone data-field="timeZone">${[...new Set([wf.timeZone||'Asia/Yekaterinburg',Intl.DateTimeFormat().resolvedOptions().timeZone,'Europe/Moscow','Asia/Yekaterinburg'])].map(v=>`<option value="${escape(v)}" ${(wf.timeZone||'Asia/Yekaterinburg')===v?'selected':''}>${escape(v)}</option>`).join('')}</select></label>
              <label class="field"><span>Адрес и ориентир</span><input data-address data-field="address" maxlength="500" value="${escape(wf.address||'')}"></label>
              ${session.role!=='surveyor'?`<label class="field"><span>Исполнитель</span><select data-assigned data-field="assigned"><option value="">Не назначен</option>${team.map(u=>`<option value="${u.id}" ${u.id===wf.assignedTo?'selected':''}>${escape(u.username)}</option>`).join('')}</select></label>`:''}
              <label class="field"><span>Внутренняя заметка</span><textarea data-note data-field="note" maxlength="1200">${escape(wf.note||'')}</textarea></label>
              <label class="field"><span>Причина отказа</span><input data-loss data-field="loss" maxlength="400" value="${escape(wf.lossReason||'')}"></label>
            </div>
            <details class="measurement-details"><summary>Результат замера</summary><p>Размеры в метрах, уклон в сантиметрах. Фотографии сжимаются перед сохранением.</p><div class="workflow-grid">
            ${[['width','Фактическая ширина'],['height','Фактическая высота'],['wicketWidth','Ширина калитки'],['wicketHeight','Высота калитки'],['diagonal1','Диагональ 1'],['diagonal2','Диагональ 2'],['slope','Перепад уровня, см'],['posts','Материал и состояние столбов'],['opening','Направление открывания'],['obstacles','Препятствия'],['notes','Пожелания и условия монтажа'],['sketch','Эскиз и расположение элементов']].map(([key,label])=>`<label class="field"><span>${label}</span><textarea data-m="${key}" data-field="m-${key}" maxlength="4000">${escape(m[key]||'')}</textarea></label>`).join('')}
            </div><label class="field"><span>До 4 фотографий объекта или эскиза</span><input data-photo type="file" accept="image/*" capture="environment" multiple></label>
            <div class="photo-list">${(m.photos||[]).map((photo,i)=>`<div><img src="${escape(photo)}" alt="Фото объекта ${i+1}" loading="lazy"><button type="button" data-remove-photo="${i}">Удалить фото ${i+1}</button></div>`).join('')}</div></details>
            ${drafts[String(lead.id)]?.conflict?`<div class="conflict"><p>На сервере: ${escape(stageLabel(workflows[String(lead.id)]?.stage||'new'))}, ${escape(workflows[String(lead.id)]?.nextActionAt||'без даты')}<br>Заметка: ${escape(workflows[String(lead.id)]?.note||'—')}</p><button type="button" data-rebase>Сохранить мой черновик поверх этой версии</button><button type="button" data-discard>Принять серверную версию</button></div>`:''}
            <p data-draft-state role="status">${drafts[String(lead.id)]?'Есть несохранённые изменения':''}</p>
            <div class="save-row"><button class="measurement-button" data-schedule type="button">📅 Назначить замер</button><button class="save-button" data-save type="button">Сохранить</button></div>
          </div>
        </article>`;
      }).join('');
      for(const id of openDetails){const details=leadList.querySelector(`[data-lead-id="${Number(id)}"] .measurement-details`);if(details)details.open=true}
      if(focusId&&focusField){const input=leadList.querySelector(`[data-lead-id="${Number(focusId)}"] [data-field="${focusField}"]`);input?.focus({preventScroll:true});try{if(position!=null)input.setSelectionRange(position,position)}catch{}}
    }

    async function loadLeads({silent=false}={}){
      if(loading||saving||!navigator.onLine)return loading;
      loading=(async()=>{
        if(!silent)syncText.textContent='Обновляем заявки…';
        try{
          const next=[];const nextWorkflows={};let before=0;const seen=new Set();
          do{
            const data=await api('/api/admin/leads?limit=100'+(before?'&before_id='+before:''));if(data.user){if(session.id&&session.id!==data.user.id){await cacheWrite;clearCache()}session=data.user}
            const batch=Array.isArray(data.leads)?data.leads:[];next.push(...batch);
            const ids=batch.map(x=>Number(x.id)).filter(Boolean);if(ids.length){const wfData=await api('/api/admin/lead-workflows?ids='+encodeURIComponent(ids.join(',')));Object.assign(nextWorkflows,wfData.workflows||{})}
            const cursor=Number(data.page?.nextBeforeId)||0;if(!data.page?.hasMore||!cursor)break;if(seen.has(cursor))throw new Error('Ошибка загрузки следующей страницы');seen.add(cursor);before=cursor;
          }while(true);
          const oldLatest=latestId;leads=[...new Map(next.map(x=>[x.id,x])).values()];for(const [id,draft] of Object.entries(drafts)){if(nextWorkflows[id]&&draft.expectedRevision!==nextWorkflows[id].revision)draft.conflict=true}workflows=nextWorkflows;authenticated=true;savedAt=Date.now();latestId=Math.max(0,...leads.map(x=>Number(x.id)||0));
          if(offlineKey){const access=JSON.parse(localStorage.getItem(ACCESS_KEY)||'null');if(access){access.expiresAt=Date.now()+24*60*60*1000;localStorage.setItem(ACCESS_KEY,JSON.stringify(access))}}saveCache();if(requestedLead){activeFilter='all';tabs.forEach(t=>{t.classList.toggle('active',t.dataset.filter==='all');t.setAttribute('aria-pressed',String(t.dataset.filter==='all'))})}render();if(requestedLead){const card=leadList.querySelector(`[data-lead-id="${requestedLead}"]`);if(card){card.scrollIntoView({block:'center'});card.classList.add('is-new');requestedLead=0}}syncLabel();offlineBadge.hidden=true;
          if(oldLatest&&latestId>oldLatest)showToast('Есть новые заявки');
        }catch(error){if(!error.auth){syncLabel('Не удалось обновить');offlineBadge.textContent=navigator.onLine?'Сервер недоступен · данные могут быть устаревшими':'Нет сети · доступны сохранённые данные';offlineBadge.hidden=false;if(!silent)showToast(error.message,true)}}
      })();try{await loading}finally{loading=null}
    }
    async function saveWorkflow(card){
      if(saving)return;capture(card);const id=String(card.dataset.leadId);const payload={...drafts[id]};
      if(payload.stage==='measurement_scheduled'&&(!payload.nextActionAt||payload.actionType!=='measurement')){showToast('Для назначения замера укажите дату и выберите действие «Замер».',true);return}
      if(payload.stage==='measurement_done'&&(!payload.address.trim()||!payload.measurement.width||!payload.measurement.height||!payload.measurement.posts)){showToast('Для завершения замера укажите адрес, фактические ширину/высоту и состояние столбов.',true);return}
      if(payload.stage==='lost'&&!payload.lossReason.trim()){showToast('Укажите причину отказа.',true);return}
      if(!navigator.onLine){await saveCache();showToast(offlineKey?'Черновик сохранён на устройстве. Отправьте его после восстановления связи.':'Нет сети. Изменения остаются в открытом приложении; включите офлайн-доступ для сохранения на устройстве.',!offlineKey);return}
      saving=true;const button=card.querySelector('[data-save]');for(const input of card.querySelectorAll('input,select,textarea,button'))input.disabled=true;button.disabled=true;button.textContent='Сохраняем…';
      try{await loading;const result=await api('/api/admin/lead-workflows/'+id,{method:'POST',body:JSON.stringify(payload)});workflows[id]={...(workflows[id]||{}),...payload,...result};delete drafts[id];await saveCache();render();showToast('Сохранено на сервере');}
      catch(error){if(!error.auth){showToast(error.status===409&&error.workflow?'Заявка изменена другим сотрудником. Ваш черновик сохранён. Обновите данные и проверьте изменения.':error.message,true);if(error.status===409&&error.workflow){drafts[id].conflict=true;if(error.workflow)workflows[id]=error.workflow;await saveCache();render()}}}
      finally{saving=false;for(const input of card.querySelectorAll('input,select,textarea,button'))input.disabled=false;button.disabled=false;button.textContent='Сохранить'}
    }
    leadList.addEventListener('input',event=>{const card=event.target.closest('.lead-card');if(card)capture(card)});
    leadList.addEventListener('change',event=>{const card=event.target.closest('.lead-card');if(card&&!event.target.matches('[data-photo]'))capture(card)});
    leadList.addEventListener('click',event=>{
      const card=event.target.closest('.lead-card');if(!card)return;
      const id=card.dataset.leadId;
      if(event.target.closest('[data-discard]')){delete drafts[id];saveCache();render();return}
      if(event.target.closest('[data-rebase]')){if(window.confirm('Вы сравнили данные и хотите заменить серверную версию своим черновиком?')){drafts[id].expectedRevision=workflows[id]?.revision??0;delete drafts[id].conflict;saveWorkflow(card)}return}
      const remove=event.target.closest('[data-remove-photo]');if(remove){capture(card);drafts[id].measurement.photos.splice(Number(remove.dataset.removePhoto),1);saveCache();render();return}
      if(event.target.closest('[data-save]')){saveWorkflow(card);return}
      if(event.target.closest('[data-schedule]')){card.querySelector('[data-stage]').value='measurement_scheduled';card.querySelector('[data-action-type]').value='measurement';const input=card.querySelector('[data-measurement]');input.focus();capture(card);showToast('Выберите согласованную дату и нажмите «Сохранить».')}
    });
    tabs.forEach(tab=>tab.addEventListener('click',()=>{tabs.forEach(x=>{x.classList.toggle('active',x===tab);x.setAttribute('aria-pressed',String(x===tab))});activeFilter=tab.dataset.filter;dayFilter.hidden=activeFilter!=='measurement';render()}));
    search.addEventListener('input',render);dayFilter.addEventListener('change',render);
    loginForm.addEventListener('submit',async event=>{
      event.preventDefault();loginError.hidden=true;loginButton.disabled=true;loginButton.textContent='Входим…';
      try{const data=await api('/api/admin/login',{method:'POST',body:JSON.stringify({username:document.getElementById('username').value.trim(),password:document.getElementById('password').value})});const cacheAccess=JSON.parse(localStorage.getItem(ACCESS_KEY)||'null');await cacheWrite;if(cacheAccess&&cacheAccess.ownerId&&cacheAccess.ownerId!==data.user?.id)clearCache();else lockCache();session=data.user||{};authenticated=true;document.getElementById('password').value='';showApp();await loadTeam();await loadLeads();await syncPushButton();}
      catch(error){loginError.textContent=error.message;loginError.hidden=false}
      finally{loginButton.disabled=false;loginButton.textContent='Войти'}
    });
    logoutButton.addEventListener('click',async()=>{
      if(Object.keys(drafts).length&&!window.confirm('Есть несохранённые изменения. При выходе они будут удалены. Выйти?'))return;
      try{if(!navigator.onLine)throw new Error('Для завершения серверной сессии нужен интернет.');const sub=await currentSubscription().catch(()=>null);if(sub){await api('/api/admin/manager-push-subscriptions',{method:'DELETE',body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe()}await api('/api/admin/logout',{method:'POST',body:'{}'});authenticated=false;await cacheWrite;clearCache();showLogin();showToast('Вы вышли. Данные на устройстве удалены.')}catch(error){showToast(error.message,true)}
    });
    refreshButton.addEventListener('click',()=>{if(!appView.hidden)loadLeads()});
    window.addEventListener('online',()=>{if(!appView.hidden){loadLeads();showToast('Связь восстановлена. Сохраните оставшиеся черновики.')}});
    window.addEventListener('offline',()=>{offlineBadge.textContent='Нет сети · изменения сохраняются как черновики';offlineBadge.hidden=false;syncLabel('Сохранённые данные')});
    window.addEventListener('beforeunload',event=>{if(Object.keys(drafts).length&&!offlineKey){event.preventDefault();event.returnValue=''}});
    function startPolling(){clearTimeout(pollTimer);pollTimer=setTimeout(async()=>{if(document.visibilityState==='visible')await loadLeads({silent:true});if(!appView.hidden)startPolling()},15000)}
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!appView.hidden)loadLeads({silent:true})});

    async function loadTeam(){
      document.getElementById('teamPanel').hidden=session.role!=='admin';
      if(session.role==='surveyor')return;
      try{team=(await api('/api/admin/manager-team')).users||[];document.getElementById('teamList').innerHTML=team.filter(u=>u.role!=='admin').map(u=>`<p>${escape(u.username)} · ${u.role==='surveyor'?'Замерщик':'Менеджер'} <button type="button" data-disable-user="${u.id}">Отключить</button></p>`).join('')}catch(error){if(!error.auth)showToast(error.message,true)}
    }
    document.getElementById('teamForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.target;const button=form.querySelector('button');button.disabled=true;try{await api('/api/admin/manager-team',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();await loadTeam();render();showToast('Сотрудник создан')}catch(error){showToast(error.message,true)}finally{button.disabled=false}});
    document.getElementById('teamList').addEventListener('click',async event=>{const b=event.target.closest('[data-disable-user]');if(!b||!window.confirm('Отключить сотрудника и завершить его сессии?'))return;try{await api('/api/admin/manager-team',{method:'DELETE',body:JSON.stringify({id:Number(b.dataset.disableUser)})});await loadTeam();render()}catch(error){showToast(error.message,true)}});
    leadList.addEventListener('change',async event=>{
      if(!event.target.matches('[data-photo]'))return;const card=event.target.closest('.lead-card');capture(card);const id=card.dataset.leadId;
      try{for(const file of event.target.files){if(drafts[id].measurement.photos.length>=4)throw new Error('Можно добавить не более четырёх фотографий');if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw new Error('Выберите изображение размером до 15 МБ');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const photo=canvas.toDataURL('image/jpeg',0.65);if(photo.length>400000)throw new Error('Фото слишком большое после сжатия');drafts[id].measurement.photos.push(photo)}await saveCache();render()}catch(error){showToast(error.message,true)}
    });

    function b64ToUint8(value){const pad='='.repeat((4-value.length%4)%4);const base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)))}
    async function waitForManagerWorker(reg){
      if(reg.active)return reg;
      await new Promise((resolve,reject)=>{
        const worker=reg.installing||reg.waiting;
        if(!worker){resolve();return}
        const timer=setTimeout(()=>reject(new Error('Не удалось запустить службу уведомлений')),12000);
        const done=()=>{if(worker.state==='activated'||reg.active){clearTimeout(timer);resolve()}};
        worker.addEventListener('statechange',done);
        done();
      });
      return reg;
    }
    async function getRegistration(){
      if(!('serviceWorker'in navigator))throw new Error('Этот браузер не поддерживает фоновые уведомления');
      const reg=await navigator.serviceWorker.register('/manager-sw.js',{scope:'/manager',updateViaCache:'none'});
      await reg.update().catch(()=>{});
      return waitForManagerWorker(reg);
    }
    async function currentSubscription(){const reg=await getRegistration();return reg.pushManager.getSubscription()}
    async function saveSubscriptionOnServer(sub){
      if(!sub)return false;
      await api('/api/admin/manager-push-subscriptions',{method:'POST',body:JSON.stringify({subscription:sub.toJSON(),userAgent:navigator.userAgent})});
      return true;
    }
    async function createFreshSubscription(){
      const reg=await getRegistration();
      const existing=await reg.pushManager.getSubscription();
      if(existing){await saveSubscriptionOnServer(existing);return existing}
      const key=await api('/api/admin/manager-push-key');
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(key.publicKey)});
      await saveSubscriptionOnServer(sub);
      return sub;
    }
    function setPushState(text,kind=''){
      pushStatusText.textContent=text;
      pushStatusText.className='push-state'+(kind?' '+kind:'');
    }
    async function serverPushStatus(sub){
      if(!sub)return {registered:false};
      return api('/api/admin/manager-push-status',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})});
    }
    async function syncPushButton({repairServer=true}={}){
      if(!('Notification'in window)||!('PushManager'in window)){
        pushButton.hidden=true;
        setPushState('Этот браузер не поддерживает фоновые push-уведомления','bad');
        return null;
      }
      if(Notification.permission==='denied'){
        pushButton.classList.remove('is-on');
        pushButton.textContent='🔔 Исправить уведомления';
        setPushState('Уведомления запрещены в настройках телефона','bad');
        return null;
      }
      try{
        const sub=await currentSubscription();
        if(!sub){
          pushButton.classList.remove('is-on');
          pushButton.textContent='🔔 Включить уведомления';
          setPushState('Push-подписки на этом телефоне нет','warn');
          return null;
        }
        if(repairServer) await saveSubscriptionOnServer(sub);
        const status=await serverPushStatus(sub);
        const on=Notification.permission==='granted'&&status?.registered===true;
        pushButton.classList.toggle('is-on',on);
        pushButton.textContent=on?'🔔 Уведомления включены · проверить':'🔔 Исправить уведомления';
        if(on){
          const last=Number(status?.lastStatus);
          if(last>=200&&last<300) setPushState('Телефон зарегистрирован · последняя отправка принята push-сервисом','ok');
          else setPushState('Телефон зарегистрирован на сервере · нажмите «проверить»','ok');
        }else{
          setPushState('Телефон не зарегистрирован на сервере','bad');
        }
        return sub;
      }catch(error){
        pushButton.classList.remove('is-on');
        pushButton.textContent='🔔 Исправить уведомления';
        setPushState('Не удалось проверить push: '+(error?.message||'ошибка'),'bad');
        return null;
      }
    }

    navigator.serviceWorker?.addEventListener('message',event=>{
      if(event.data?.type!=='MANAGER_PUSH_RECEIVED')return;
      if(awaitingPushReceipt&&event.data.eventType==='test'&&event.data.testId===pendingPushTestId){
        awaitingPushReceipt=false;
        clearTimeout(pushReceiptTimer);
        setPushState('Тест дошёл до телефона ✓','ok');
        showToast('Тестовое уведомление дошло до телефона ✓');
      }
    });

    pushButton.addEventListener('click',async()=>{
      pushButton.disabled=true;
      pushButton.textContent='🔔 Проверяем…';
      setPushState('Проверяем подписку этого телефона…');
      try{
        const permission=await Notification.requestPermission();
        if(permission!=='granted')throw new Error('Разрешите уведомления для КД Менеджер в настройках телефона');

        // Test the existing subscription first; checking must not disable it.
        const sub=await createFreshSubscription();
        const status=await serverPushStatus(sub);
        if(!status?.registered)throw new Error('Сервер не сохранил push-подписку');

        pendingPushTestId=crypto.randomUUID();
        awaitingPushReceipt=true;
        clearTimeout(pushReceiptTimer);
        pushReceiptTimer=setTimeout(()=>{
          if(!awaitingPushReceipt)return;
          awaitingPushReceipt=false;
          setPushState('Push-сервис принял тест, но телефон не подтвердил получение. Проверьте системные уведомления Chrome/КД Менеджер.','warn');
        },8000);

        const test=await api('/api/admin/manager-push-test',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint,testId:pendingPushTestId})});
        if(!(test?.sent>0))throw new Error('Push-сервис не принял тест');

        if(awaitingPushReceipt)setPushState('Тест принят push-сервисом · ожидаем телефон','warn');
        showToast('Тест отправлен · ждём уведомление');
      }catch(error){
        awaitingPushReceipt=false;
        clearTimeout(pushReceiptTimer);
        const detail=error?.message||'Не удалось проверить уведомления';
        showToast(detail,true);
        pushButton.classList.remove('is-on');
        pushButton.textContent='🔔 Исправить уведомления';
        setPushState(detail,'bad');
      }finally{
        pushButton.disabled=false;
        if(pushButton.textContent==='🔔 Проверяем…')pushButton.textContent='🔔 Включить уведомления';
      }
    });

    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installCard.hidden=false});
    installButton.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installCard.hidden=true});
    window.addEventListener('appinstalled',()=>installCard.hidden=true);

    async function boot(){
      localStorage.removeItem('kuzdvor-manager-leads-v1');
      if('serviceWorker'in navigator)navigator.serviceWorker.register('/manager-sw.js',{scope:'/manager',updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
      showLogin();
      try{const data=await api('/api/admin/leads?limit=1');session=data.user||{};authenticated=true;showApp();await loadTeam();await loadLeads();await syncPushButton()}catch(error){showLogin();if(!error.auth&&navigator.onLine){loginError.textContent=error.message;loginError.hidden=false}}
    }
    boot();
  })();
