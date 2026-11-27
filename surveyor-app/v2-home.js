// Experimental shell. Only mounted by app.js on an explicitly opted-in local
// preview with the existing real session. No data fetching or role mutation.
export function mountV2Home({role,navigate,newSurvey,open3D}) {
  const owner=role==='owner';
  let workspace=owner?'owner':'surveyor';
  let theme='dark';
  try{theme=localStorage.getItem('kd-v2-home-theme')==='light'?'light':'dark'}catch{}
  const root=document.documentElement;
  const main=document.querySelector('#mainView');
  const bottom=main.querySelector('.bottom-nav');
  const oldNav=Array.from(bottom.children);
  oldNav.forEach(btn=>btn.classList.add('kd-v2-legacy-nav'));
  root.classList.add('kd-v2-local');
  let currentScreen='v2Home';
  let catalogOpen=false;
  const host=document.createElement('section');
  host.id='v2HomeScreen';host.className='screen kd-v2-home';host.setAttribute('aria-label','Новая главная');
  const style=document.createElement('style');
  style.textContent=`
.kd-v2-home{--vbg:#111827;--vcard:#1f2937;--vtext:#f8fafc;--vmuted:#a5b4c7;--vline:#374151;--vacc:#93c5fd;--vprimary:#2563eb;background:var(--vbg);color:var(--vtext);padding:14px;border-radius:16px;max-width:1050px;margin:0 auto}
.kd-v2-home[data-theme=light]{--vbg:#f1f5f9;--vcard:#fff;--vtext:#172033;--vmuted:#526176;--vline:#d3dce8;--vacc:#1d4ed8;--vprimary:#1d4ed8}
.kd-v2-home *{box-sizing:border-box}.kd-v2-home button{font:inherit;color:inherit;cursor:pointer;min-height:44px}.kd-v2-home button:focus-visible{outline:3px solid var(--vacc);outline-offset:2px}.kd-v2-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}.kd-v2-head h2{font-size:17px;margin:0;flex:1}.kd-v2-home small{color:var(--vmuted);font-size:12px;display:block}.kd-v2-iconbtn{border:1px solid var(--vline);background:var(--vcard);border-radius:10px;width:44px;flex:none}.kd-v2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.kd-v2-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.kd-v2-card,.kd-v2-tile{border:1px solid var(--vline);background:var(--vcard);border-radius:12px;padding:12px;min-width:0}.kd-v2-card strong{display:block;font-size:24px}.kd-v2-panel{margin:12px 0}.kd-v2-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;font-size:13px!important;min-height:86px!important;overflow-wrap:anywhere}.kd-v2-home svg{width:25px;height:25px;stroke:var(--vacc);stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.kd-v2-home h3{font-size:16px;margin:16px 0 10px}.kd-v2-action{display:flex;align-items:center;gap:12px;text-align:left;width:100%;margin-bottom:10px;border-radius:12px;padding:14px;border:1px solid var(--vline);background:var(--vcard)}.kd-v2-action.primary{background:var(--vprimary);color:white}.kd-v2-action.primary small{color:#dbeafe}.kd-v2-question{display:block;width:100%;background:transparent;border:0;border-top:1px solid var(--vline);text-align:left;padding:10px 0}.kd-v2-detail{margin:12px 0;line-height:1.4}.kd-v2-note{color:var(--vmuted);font-size:12px;margin:0 0 12px}.kd-v2-home [hidden]{display:none!important}
html.kd-v2-local{--bg:var(--kd-bg);--surface:var(--kd-card);--surface-2:var(--kd-soft);--text:var(--kd-text);--muted:var(--kd-muted);--line:var(--kd-line);--gold:var(--kd-accent);--gold-2:var(--kd-accent);--dark:var(--kd-card);--kd-bg:#111827;--kd-card:#1f2937;--kd-soft:#283548;--kd-text:#f8fafc;--kd-muted:#a5b4c7;--kd-line:#374151;--kd-accent:#93c5fd;--kd-primary:#2563eb;color-scheme:dark}
html.kd-v2-local[data-kd-theme=light]{--kd-bg:#f1f5f9;--kd-card:#fff;--kd-soft:#e2e8f0;--kd-text:#172033;--kd-muted:#526176;--kd-line:#d3dce8;--kd-accent:#1d4ed8;--kd-primary:#1d4ed8;color-scheme:light}
.kd-v2-local body,.kd-v2-local #mainView{background:var(--kd-bg)!important;color:var(--kd-text)!important}
.kd-v2-local #mainView .topbar,.kd-v2-local #mainView .bottom-nav{background:var(--kd-card)!important;border-color:var(--kd-line)!important;color:var(--kd-text)!important}
.kd-v2-local #mainView .topbar-title,.kd-v2-local #mainView .eyebrow{font-family:system-ui,sans-serif!important;color:var(--kd-text)!important}
.kd-v2-local #mainView .network-badge,.kd-v2-local #mainView .avatar-btn{background:var(--kd-soft)!important;border-color:var(--kd-line)!important;color:var(--kd-accent)!important}
.kd-v2-local #mainView .kd-v2-legacy-nav{display:none!important}
.kd-v2-local #mainView .bottom-nav{display:flex;gap:3px}
.kd-v2-local #mainView .kd-v2-nav{flex:1;min-width:0;min-height:48px;color:var(--kd-muted)!important;background:transparent!important}
.kd-v2-local #mainView .kd-v2-nav.active{color:var(--kd-accent)!important;background:var(--kd-soft)!important}
.kd-v2-local #mainView .kd-v2-nav svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen,#settingsScreen,#teamScreen) :is(.survey-card,.client-card,.settings-card,.employee-card,.v3-hero,.searchbox,.segmented,.empty-state,.survey-card-total,.survey-card-variants){background:var(--kd-card)!important;border-color:var(--kd-line)!important;color:var(--kd-text)!important;box-shadow:none}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen,#settingsScreen,#teamScreen) :is(h2,h3,.card-name,.client-name,.order-number,.empty-state h3,.searchbox input){color:var(--kd-text)!important;font-family:system-ui,sans-serif!important}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen,#settingsScreen,#teamScreen) :is(.muted,.card-address,.client-meta,.sync-row,.v3-hero p,.survey-card-total span,.survey-card-variants span){color:var(--kd-muted)!important;border-color:var(--kd-line)!important}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen) :is(.type-badge,.v3-open-survey,.client-phone,.segmented-btn.active){background:var(--kd-soft)!important;color:var(--kd-accent)!important;border-color:var(--kd-line)!important}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen) :is(#newSurveyBtn,#newClientBtn){background:var(--kd-primary)!important;color:#fff!important;border-color:var(--kd-primary)!important}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen) .searchbox input{background:transparent!important}
.kd-v2-local #mainView :is(#surveysScreen,#clientsScreen) .searchbox input::placeholder{color:var(--kd-muted)!important}
.kd-v2-local #mainView .nav-btn:focus-visible,.kd-v2-local #mainView .btn:focus-visible{outline:3px solid var(--kd-accent);outline-offset:2px}

/* Apply the shell palette to ordinary forms and survey cards, not the customer
   presentation or the drawing canvas; those retain their existing rendering. */
.kd-v2-local :is(#surveyDialog,#clientDialog,#employeeDialog,#surveyDataDialog,#calculationPickerDialog,#surveyDetailsDialog) .sheet{background:var(--kd-bg)!important;color:var(--kd-text)!important}
.kd-v2-local #surveyDetailsDialog{background:var(--kd-bg)!important;color:var(--kd-text)!important}
.kd-v2-local :is(#surveyDialog,#clientDialog,#employeeDialog,#surveyDataDialog,#calculationPickerDialog,#surveyDetailsDialog) .sheet-head{background:var(--kd-bg)!important;border-color:var(--kd-line)!important}
.kd-v2-local :is(#surveyDialog,#clientDialog,#employeeDialog,#surveyDataDialog,#calculationPickerDialog,#surveyDetailsDialog) :is(h2,h3,.field>span,.eyebrow){font-family:system-ui,sans-serif!important;color:var(--kd-text)!important}
.kd-v2-local :is(#surveyDialog,#clientDialog,#employeeDialog,#surveyDataDialog,#calculationPickerDialog,#surveyDetailsDialog) :is(.field input,.field textarea,.field select,.icon-btn,.btn-secondary){background:var(--kd-card)!important;color:var(--kd-text)!important;border:1px solid var(--kd-line)!important}
.kd-v2-local :is(#surveyDialog,#clientDialog,#employeeDialog,#surveyDataDialog,#calculationPickerDialog,#surveyDetailsDialog) .btn-primary{background:var(--kd-primary)!important;color:#fff!important;border-color:var(--kd-primary)!important;box-shadow:none!important}
.kd-v2-local #surveyDetailsDialog :is(.v3-survey-head,.v3-product-tile,.calculation-section,.calculation-card,.v3-extra,.v3-preview-bar,.calculation-empty,.v3-note){background:var(--kd-card)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important;box-shadow:none!important}
.kd-v2-local #surveyDetailsDialog :is(.v3-category-icon,.v3-edit-link,.calculation-edit-btn,.v3-add-more,.calculation-card-tags>span){background:var(--kd-soft)!important;color:var(--kd-accent)!important;border-color:var(--kd-line)!important}
.kd-v2-local #surveyDetailsDialog :is(.v3-address b,.v3-product-label b,.calculation-card-copy>b,.calculation-section .section-head h3,.v3-preview-bar b){color:var(--kd-text)!important;font-family:system-ui,sans-serif!important}
.kd-v2-local #surveyDetailsDialog :is(.v3-address span,.v3-survey-meta,.v3-product-hint,.v3-product-label small,.calculation-card-lines>span,.calculation-card-copy>small,.calculation-card-price small,.v3-preview-bar small,.estimate-help,.v3-saved-count){color:var(--kd-muted)!important}
.kd-v2-local #surveyDetailsDialog :is(.v3-product-arrow,.calculation-card-price>b,.v3-extra summary span){color:var(--kd-accent)!important}
.kd-v2-local #surveyDetailsDialog .calculation-show-btn{background:var(--kd-primary)!important;color:white!important;border-color:var(--kd-primary)!important}
.kd-v2-local #surveyDetailsDialog .v3-product-tile{grid-template-columns:58px minmax(0,1fr) 20px!important;min-height:86px!important;gap:10px!important;padding:10px!important;border-radius:14px!important}
.kd-v2-local #surveyDetailsDialog .v3-category-icon{width:58px!important;height:58px!important;border-radius:12px!important}
.kd-v2-local #surveyDetailsDialog .v3-category-icon svg{max-width:48px;max-height:48px}
.kd-v2-local #surveyDetailsDialog .v3-product-label b{font-size:16px!important;font-weight:700!important;overflow-wrap:anywhere}
.kd-v2-local #surveyDetailsDialog .v3-product-label small{font-size:12px!important}
.kd-v2-local #surveyDetailsDialog .v3-product-section h3{font-size:19px!important;font-weight:700!important}
.kd-v2-local #surveyDetailsDialog .v3-complete-action .btn{min-height:48px!important;font-size:15px!important}
@media(min-width:700px){.kd-v2-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.kd-v2-grid.two{grid-template-columns:repeat(4,minmax(0,1fr))}.kd-v2-tile{min-height:105px!important}}
`;
  host.append(style);
  const body=document.createElement('div');host.append(body);
  const paths={home:'M3 10l9-7 9 7v10h-6v-6H9v6H3z',menu:'M4 6h16 M4 12h16 M4 18h16',tasks:'M4 3h16v18H4z M7 9l2 2 3-4 M14 10h3 M7 16l2 2 3-4 M14 17h3',clients:'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 5',orders:'M5 4h14v18H5z M9 4V2h6v2 M9 10h6 M9 14h6 M9 18h6',factory:'M3 21V10l6 3V8l6 4V4h5l1 17Z M7 17h2 M12 17h2 M17 17h2',calendar:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18',truck:'M2 5h12v12H2z M14 10h5l3 4v3h-8 M6 17v3 M18 17v3',stock:'M3 7l9-5 9 5v10l-9 5-9-5Z M3 7l9 5 9-5 M12 12v10',wallet:'M3 5h18v15H3z M21 11h-6v5h6 M17 13.5h.1',ads:'M3 9l14-5v16L3 15z M7 16l2 5h3l-2-5 M21 9v6',star:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',ruler:'M3 17L17 3l4 4L7 21z M8 12l3 3 M12 8l3 3',chart:'M3 3v18h18 M7 17v-5 M12 17V8 M17 17V5',calc:'M5 2h14v20H5z M8 6h8 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M8 19h1 M15 19h1',catalog:'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6',file:'M5 2h10l4 4v16H5z M15 2v5h4 M8 12h8 M8 16h8',check:'M5 2h10l4 4v16H5z M8 15l2 2 5-5'};
  const icon=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[id]||paths.file)+'"/></svg>';
  const ownerItems=[['tasks','Задачи'],['clients','Клиенты'],['orders','Заказы'],['factory','Цех'],['calendar','Календарь'],['truck','Доставка'],['stock','Склад'],['wallet','Финансы'],['ads','Реклама'],['star','Отзывы'],['ruler','Замерщик'],['chart','Аналитика']];
  const surveyItems=[['catalog','Каталог'],['calc','Мои расчёты'],['clients','Клиенты'],['calendar','Календарь'],['file','Предложения'],['check','Договоры']];
  const tile=([id,label])=>'<button class="kd-v2-tile" type="button" data-v2-action="'+id+'">'+icon(id)+'<span>'+label+'</span></button>';
  const btn=(id,label,desc,primary=false)=>'<button class="kd-v2-action'+(primary?' primary':'')+'" type="button" data-v2-action="'+id+'">'+icon(id)+'<span><b>'+label+'</b><small>'+desc+'</small></span></button>';
  const catalogItems=[
    ['artGates','Кованые ворота Арт.','Действующий каталог ворот и калиток по артикулам.'],
    ['artFences','Кованые заборы Арт.','Отдельный каталог секций · требуется база моделей и формул.'],
    ['frames','Каркасы ворот и калиток','Серийные каркасы · отдельный редактор на этапе 2.'],
    ['sliding','Откатные ворота','Действующий калькулятор через замер.'],
    ['pickets','Евроштакетник','Действующий калькулятор через замер.'],
    ['canopy','Навесы','Действующий калькулятор через замер.']
  ];
  function render(){
    host.dataset.theme=theme;
    root.dataset.kdTheme=theme;
    const isOwner=workspace==='owner'&&owner;
    body.innerHTML='<div class="kd-v2-head"><h2>'+(isOwner?'КД УПРАВЛЕНИЕ':'КД ЗАМЕРЩИК')+'</h2><button class="kd-v2-iconbtn" type="button" data-v2-action="theme" aria-label="Переключить тему">'+(theme==='dark'?'☀':'☾')+'</button>'+(owner?'<button class="kd-v2-iconbtn" type="button" data-v2-action="workspace" aria-label="Переключить рабочее пространство">⇄</button>':'')+'</div><p class="kd-v2-note">Тестовая оболочка · действующие функции открываются в прежнем редакторе.</p>'+
    (catalogOpen?'<button class="kd-v2-action" type="button" data-v2-action="catalogBack">← К разделам замерщика</button><h3>Каталог изделий</h3><p class="kd-v2-note">Выберите направление. Новые редакторы подключаются на этапе 2.</p>'+catalogItems.map(([id,label,desc])=>btn(id,label,desc)).join(''):isOwner?'<div class="kd-v2-grid two">'+['Сумма заказов','К получению','Заказы в работе','Активные клиенты'].map(x=>'<div class="kd-v2-card"><small>'+x+'</small><strong>—</strong></div>').join('')+'</div><div class="kd-v2-card kd-v2-panel"><b>Требует внимания</b><small>Рабочие показатели ещё не подключены.</small></div><h3>Управление предприятием</h3><div class="kd-v2-grid">'+ownerItems.map(tile).join('')+'</div><div class="kd-v2-card kd-v2-panel"><b>КД — Умный помощник</b><small>Сценарии подключаются на этапе 11</small><button class="kd-v2-question" data-v2-action="tasks">Что сделать сегодня?</button><button class="kd-v2-question" data-v2-action="wallet">Кто должен деньги?</button><button class="kd-v2-question" data-v2-action="orders">Какие заказы требуют внимания?</button></div>':
    btn('quick','Быстрый расчёт',owner?'Действующий калькулятор откатных ворот':'Без заказа — появится на этапе 2',true)+btn('measure','Новый замер объекта','Открыть действующий редактор замера')+'<h3>Работа с клиентами</h3><div class="kd-v2-grid two">'+surveyItems.map(tile).join('')+'</div>'+btn('threeD','3D-конструктор','Вспомогательный инструмент до этапа 3'))+'<div class="kd-v2-card kd-v2-detail" role="status" hidden></div>';
  }
  function pending(label){const detail=body.querySelector('.kd-v2-detail');detail.textContent=label;detail.hidden=false;detail.scrollIntoView({block:'nearest'});}
  body.addEventListener('click',e=>{
    const action=e.target.closest('[data-v2-action]')?.dataset.v2Action;if(!action)return;
    if(action==='theme'){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('kd-v2-home-theme',theme)}catch{}render();return}
    if(action==='workspace'&&owner){catalogOpen=false;workspace=workspace==='owner'?'surveyor':'owner';render();syncNav();return}
    if(action==='ruler'&&owner){catalogOpen=false;workspace='surveyor';render();syncNav();return}
    if(action==='catalog'){catalogOpen=true;render();return}
    if(action==='catalogBack'){catalogOpen=false;render();return}
    if(action==='artFences'){pending('Кованые заборы Арт.: отдельный редактор на этапе 2. До утверждения моделей, размеров, материалов и тарифов стоимость не рассчитывается.');return}
    if(action==='frames'){pending('Серийные каркасы: отдельный редактор на этапе 2.');return}
    if(['artGates','sliding','pickets','canopy'].includes(action)){
      pending('Действующий калькулятор доступен через новый замер. В редакторе замера выберите соответствующее изделие.');
      const detail=body.querySelector('.kd-v2-detail');
      const next=document.createElement('button');next.type='button';next.className='kd-v2-action primary';next.dataset.v2Action='measure';next.textContent='Создать замер';detail.append(next);return
    }
    if(action==='clients'){navigate('clients');return}
    if(action==='calc'){navigate('surveys');return}
    if(action==='orders'&&owner){pending('Реестр заказов появится на этапе 6. Замеры доступны в пространстве замерщика.');return}
    if(action==='wallet'&&owner){navigate('owner');return}
    if(action==='quick'&&owner){navigate('ownerQuick');return}
    if(action==='measure'){navigate('surveys');newSurvey();return}
    if(action==='threeD'){open3D();return}
    pending('Раздел пока не подключён. Его реализация предусмотрена утверждённой дорожной картой.');
  });
  document.querySelector('#mainView .content').prepend(host);
  const navNodes=[];
  function syncNav(screen=currentScreen){
    currentScreen=screen;
    navNodes.splice(0).forEach(n=>n.remove());
    const isOwner=workspace==='owner'&&owner;
    const items=isOwner?[['home','Главная','v2Home'],['orders','Заказы','ordersPending'],['clients','Клиенты','clients'],['factory','Цех','factoryPending'],['menu','Ещё','settings']]:[['home','Главная','v2Home'],['calc','Расчёты','surveys'],['clients','Клиенты','clients'],['menu','Ещё','settings']];
    for(const [id,label,target] of items){
      const nav=document.createElement('button');nav.className='nav-btn kd-v2-nav';nav.type='button';nav.dataset.screen=target;
      nav.innerHTML=icon(id)+'<b>'+label+'</b>';
      const selected=screen===target||(target==='v2Home'&&['owner','ownerQuick'].includes(screen))||(target==='surveys'&&screen==='threeD');
      nav.classList.toggle('active',selected);if(selected)nav.setAttribute('aria-current','page');
      nav.addEventListener('click',()=>{
        if(target==='ordersPending'||target==='factoryPending'){
          navigate('v2Home');
          pending(target==='ordersPending'?'Полноценный реестр заказов появится на этапе 6. Существующие замеры доступны в рабочем пространстве замерщика.':'Цех будет подключён на этапе 7.');
        }else {if(target==='v2Home'&&catalogOpen){catalogOpen=false;render()}navigate(target);}
      });
      bottom.append(nav);navNodes.push(nav);
    }
  }
  render();syncNav();
  return {onScreen:syncNav,destroy(){host.remove();navNodes.forEach(n=>n.remove());oldNav.forEach(btn=>btn.classList.remove('kd-v2-legacy-nav'));root.classList.remove('kd-v2-local');delete root.dataset.kdTheme;}};
}
