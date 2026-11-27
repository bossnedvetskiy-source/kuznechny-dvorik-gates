import {basketLine,readBasket,mountBasket,BASKET_LIMIT} from './v2-basket.js';
import {mountCanopyEditor} from './v2-canopy.js';
import {mountProfileFenceEditor} from './v2-profile-fence.js';
import {mountPicketSiteEditor} from './v2-pickets.js';
import {mountArtFenceEditor} from './v2-art-fences.js';
import {mountArtGateCatalog} from './v2-art-gates.js';
import {mountSwingFrameEditor,SWING_DEFAULTS} from './v2-swing-frame.js';
import {mountProductEditor,SLIDING_DEFAULTS} from './v2-product-editor.js';
// Experimental shell. Only mounted by app.js on an explicitly opted-in local
// preview with the existing real session. No data fetching or role mutation.
export function mountV2Home({role,userId,navigate,newSurvey,open3D,listQuoteTargets,saveQuote,quoteSwing,saveSwing,quoteArtGate,openSavedQuote}) {
  const owner=role==='owner';
  let workspace=owner?'owner':'surveyor';
  let theme='dark';
  try{theme=localStorage.getItem('kd-v2-home-theme')==='light'?'light':'dark'}catch{}
  const root=document.documentElement;
  const main=document.querySelector('#mainView');
  const bottom=main.querySelector('.bottom-nav');
  const topBrand=main.querySelector('.topbar .eyebrow');
  const topTitle=main.querySelector('#screenTitle');
  const originalBrand=topBrand?.textContent||'';
  const oldNav=Array.from(bottom.children);
  oldNav.forEach(btn=>btn.classList.add('kd-v2-legacy-nav'));
  root.classList.add('kd-v2-local');
  let currentScreen='v2Home';
  let catalogOpen=false;
  let productOpen=false, productDraft=null, swingDraft=null, artDraft=null, artFenceDraft=null,picketDraft=null,profileFenceDraft=null,canopyDraft=null;
  // Per-user, per-tab, customer quote inputs only; never store names, prices or owner costs.
  const draftKey=userId?'kd-v2-sliding-draft-v1:'+String(userId):null;
  function loadProductDraft(){
    if(!draftKey)return null;
    try{
      const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
      if(saved?.version!==1||!saved.fields||typeof saved.fields!=='object')return null;
      return Object.fromEntries(Object.entries(saved.fields).filter(([k,v])=>Object.hasOwn(SLIDING_DEFAULTS,k)&&['number','string','boolean'].includes(typeof v)));
    }catch{return null}
  }
  function saveProductDraft(value){
    productDraft=value;
    if(!draftKey)return;
    try{
      if(value===null)sessionStorage.removeItem(draftKey);
      else sessionStorage.setItem(draftKey,JSON.stringify({version:1,fields:value}));
    }catch{}
  }
  productDraft=loadProductDraft();
  const swingDraftKey=userId?'kd-v2-swing-draft-v1:'+String(userId):null;
  function saveSwingDraft(value){
    swingDraft=value;
    if(!swingDraftKey)return;
    try{
      if(value===null)sessionStorage.removeItem(swingDraftKey);
      else sessionStorage.setItem(swingDraftKey,JSON.stringify({version:1,fields:value}));
    }catch{}
  }
  if(swingDraftKey)try{
    const value=JSON.parse(sessionStorage.getItem(swingDraftKey)||'null');
    if(value?.version===1&&value.fields&&typeof value.fields==='object')
      swingDraft=Object.fromEntries(Object.entries(value.fields).filter(([k,v])=>Object.hasOwn(SWING_DEFAULTS,k)&&['number','string','boolean'].includes(typeof v)));
  }catch{}

  const basketKey=userId?'kd-v2-basket-v1:'+String(userId):null;
  let basket=[],basketOpen=false,editId=null,editDraft=null,basketStorageError=false;
  if(basketKey)try{basket=readBasket(JSON.parse(sessionStorage.getItem(basketKey)||'[]'))}catch{basketStorageError=true}
  function persistBasket(){
    if(!basketKey){basketStorageError=true;return}
    try{if(basket.length)sessionStorage.setItem(basketKey,JSON.stringify(basket));else sessionStorage.removeItem(basketKey);basketStorageError=false}catch{basketStorageError=true}
  }
  function clearEdit(){editId=null;editDraft=null}
  function backToCatalogue(){productOpen=false;catalogOpen=!editId;basketOpen=Boolean(editId);clearEdit();render()}
  const activeKind=()=>productOpen===true?'sliding':productOpen;
  function currentDraft(){return editId?editDraft:({sliding:productDraft,frames:swingDraft,artGates:artDraft,artFences:artFenceDraft,pickets:picketDraft,profileFence:profileFenceDraft,canopy:canopyDraft})[activeKind()]}
  function draftFor(value){return editId?editDraft:value}
  function changeDraft(save,value){if(editId)editDraft=value;else save(value)}
  function resetDraft(save){changeDraft(save,null);render()}
  function openBasket(){productOpen=false;catalogOpen=false;basketOpen=true;clearEdit();render()}
  function addBasket(){
    const status=body.querySelector('[data-basket-add-status]');
    try{
      const kind=activeKind(),{draft}=basketLine(kind,currentDraft());
      if(editId){if(!basket.some(row=>row.id===editId))throw Error('Позиция не найдена');basket=basket.map(row=>row.id===editId?{id:row.id,kind,draft}:row)}
      else{if(basket.length>=BASKET_LIMIT)throw Error('Максимум '+BASKET_LIMIT+' изделий');basket.push({id:crypto.randomUUID(),kind,draft})}
      persistBasket();openBasket();
    }catch(error){status.textContent=error.message||'Проверьте параметры изделия'}
  }
  const host=document.createElement('section');
  host.id='v2HomeScreen';host.className='screen kd-v2-home';host.setAttribute('aria-label','Новая главная');
  const style=document.createElement('style');
  style.textContent=`
.kd-v2-home{--vbg:#111827;--vcard:#1f2937;--vtext:#f8fafc;--vmuted:#a5b4c7;--vline:#374151;--vacc:#93c5fd;--vprimary:#2563eb;background:var(--vbg);color:var(--vtext);padding:14px;border-radius:16px;max-width:1050px;margin:0 auto}
.kd-v2-home[data-theme=light]{--vbg:#f1f5f9;--vcard:#fff;--vtext:#172033;--vmuted:#526176;--vline:#d3dce8;--vacc:#1d4ed8;--vprimary:#1d4ed8}
.kd-v2-home *{box-sizing:border-box}#v2HomeScreen button{min-height:46px!important}.kd-v2-home button{font:inherit;color:inherit;cursor:pointer;min-height:44px}.kd-v2-home button:focus-visible{outline:3px solid var(--vacc);outline-offset:2px}.kd-v2-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}.kd-v2-head h2{font-size:17px;margin:0;flex:1}.kd-v2-home small{color:var(--vmuted);font-size:12px;display:block}.kd-v2-iconbtn{border:1px solid var(--vline);background:var(--vcard);border-radius:10px;width:44px;flex:none}.kd-v2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.kd-v2-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.kd-v2-card,.kd-v2-tile{border:1px solid var(--vline);background:var(--vcard);border-radius:12px;padding:12px;min-width:0}.kd-v2-card strong{display:block;font-size:24px}.kd-v2-panel{margin:12px 0}.kd-v2-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;font-size:13px!important;min-height:86px!important;overflow-wrap:anywhere}.kd-v2-home svg{width:25px;height:25px;stroke:var(--vacc);stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.kd-v2-home h3{font-size:16px;margin:16px 0 10px}.kd-v2-action{display:flex;align-items:center;gap:12px;text-align:left;width:100%;margin-bottom:10px;border-radius:12px;padding:14px;border:1px solid var(--vline);background:var(--vcard)}.kd-v2-action.primary{background:var(--vprimary);color:white}.kd-v2-action.primary small{color:#dbeafe}.kd-v2-question{display:block;width:100%;background:transparent;border:0;border-top:1px solid var(--vline);text-align:left;padding:10px 0}.kd-v2-detail{margin:12px 0;line-height:1.4}.kd-v2-note{color:var(--vmuted);font-size:12px;margin:0 0 12px}.kd-v2-home [hidden]{display:none!important}
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

/* Management and plan controls share the shell palette. Preserve geometry,
   preview drawings, status/warning colours and customer-facing presentation. */
.kd-v2-local :is(#ownerScreen,#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-dashboard-hero,.owner-dashboard-section,.owner-kpi,.owner-order-link,.owner-report,.owner-panel-title,.owner-material-card,.owner-material-card details,.owner-expenses,.owner-finance-grid>div,.owner-material-stats>div,.owner-profile-summary,.ownerq-heading,.ownerq-panel,.ownerq-price,.ownerq-finance-grid>div,.ownerq-modes,.ownerq-check){background:var(--kd-card)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important;box-shadow:none!important}
.kd-v2-local :is(#ownerScreen,#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-kpi b,.owner-order-figures b,.owner-order-main b,.ownerq-row strong,.ownerq-finance-grid strong,.ownerq-price strong,.ownerq-back,.ownerq-rate-editor summary,.ownerq-pill b){color:var(--kd-accent)!important}
.kd-v2-local :is(#ownerScreen,#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-dashboard-hero p,.owner-kpi small,.owner-kpi span,.owner-finance-note,.owner-finance-grid small,.owner-material-stats small,.owner-expense-field label,.owner-profile-row label,.ownerq-heading p,.ownerq-price small,.ownerq-price span,.ownerq-field,.ownerq-note,.ownerq-finance-grid small,.ownerq-tag){color:var(--kd-muted)!important}
.kd-v2-local :is(#ownerQuickScreen,#surveyDetailsDialog) :is(.ownerq-field input,.ownerq-field select,.owner-expense-field input,.owner-profile-row input){background:var(--kd-bg)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local :is(#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-detail-tabs,.ownerq-modes){background:var(--kd-soft)!important}
.kd-v2-local :is(#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-detail-tabs button,.ownerq-modes button){color:var(--kd-muted)!important}
.kd-v2-local :is(#ownerQuickScreen,#surveyDetailsDialog) :is(.owner-detail-tabs button.active,.ownerq-modes button.active){background:var(--kd-primary)!important;color:white!important}
.kd-v2-local #surveyDetailsDialog .owner-table-scroll th{background:var(--kd-soft)!important;color:var(--kd-text)!important}
.kd-v2-local #surveyDetailsDialog .owner-table-scroll :is(th,td){border-color:var(--kd-line)!important}
.kd-v2-local #planDialog,.kd-v2-local #planDialog .plan-sheet{background:var(--kd-bg)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local #planDialog .sheet-head{background:var(--kd-bg)!important;border-color:var(--kd-line)!important}
.kd-v2-local #planDialog :is(.sheet-head h2,.plan-elements-head h3,.plan-inline-head b,.plan-quick-head b,.plan-fast-add-caption b,.plan-bottom-sheet h3){color:var(--kd-text)!important;font-family:system-ui,sans-serif!important}
.kd-v2-local #planDialog :is(.plan-mode-switch,.plan-line-tab,.plan-item-row,.plan-inline-editor,.plan-quick-post,.plan-quick-distance,.plan-bottom-sheet,.plan-fast-add-toggle,.plan-fast-add-items,.plan-fast-add-items button,.plan-line-settings){background:var(--kd-card)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local #planDialog :is(.plan-line-tab.active,.plan-mode-switch button.active,.plan-item-row.selected){background:var(--kd-soft)!important;color:var(--kd-accent)!important;border-color:var(--kd-accent)!important}
.kd-v2-local #planDialog :is(.plan-summary span,.plan-item-main span,.plan-elements-head p,.plan-inline-head small,.plan-quick-head small,.plan-quick-distance small,.plan-line-settings>summary,.plan-bottom-sheet .field>span){color:var(--kd-muted)!important}
.kd-v2-local #planDialog :is(.plan-summary b,.plan-fast-add-plus,.plan-fast-add-chevron){color:var(--kd-accent)!important}
.kd-v2-local #planDialog :is(.plan-inline-measure input,.plan-inline-material select,.plan-quick-distance input,.plan-line-settings-body input,.plan-bottom-sheet input,.plan-bottom-sheet select){background:var(--kd-bg)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local #planDialog .plan-footer{background:var(--kd-bg)!important}
.kd-v2-local #planDialog #savePlanBtn{background:var(--kd-primary)!important;border-color:var(--kd-primary)!important;color:white!important;box-shadow:none!important}

/* Shared shell controls; leave WebGL canvas, drawing sheets and warning
   semantics unchanged. The full calculator redesign belongs to stages 2–3. */
.kd-v2-local #mainView .kd-v2-theme-global{width:44px;height:44px;flex:0 0 44px;border:1px solid var(--kd-line);border-radius:12px;background:var(--kd-card);color:var(--kd-accent);font-size:21px}
.kd-v2-local #mainView .kd-v2-theme-global[hidden]{display:none!important}
.kd-v2-local #mainView .topbar{gap:6px}
.kd-v2-local #mainView .topbar>div:first-child{min-width:0;overflow-wrap:anywhere}
.kd-v2-local #mainView .topbar-actions{gap:5px;flex-shrink:0}
.kd-v2-local #mainView .topbar-title{font-size:clamp(16px,4.5vw,22px)}
.kd-v2-local :is(button,input,select,textarea,summary):focus-visible{outline:3px solid var(--kd-accent)!important;outline-offset:2px}
.kd-v2-local #threeDScreen{color:var(--kd-text)!important}
.kd-v2-local #threeDScreen :is(.kd3d-top,.kd3d-form,.kd3d-editor,.kd3d-editor-head,.kd3d-product-panel,.kd3d-compact,.kd3d-side-entry.selected,.kd3d-side-products .kd3d-product-card,.kd3d-side-products .kd3d-product-wicket,.kd3d-side-products .kd3d-built-in,.kd3d-stats>div,.kd3d-back){background:var(--kd-card)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important;box-shadow:none!important}
.kd-v2-local #threeDScreen :is(.kd3d-top small,.kd3d-fields label,.kd3d-select-label,.kd3d-product-head small,.kd3d-product-type,.kd3d-product-fields label,.kd3d-compact-field,.kd3d-compact-segment,.kd3d-compact-head small,.kd3d-compact-number small,.kd3d-side-quick label,.kd3d-gate-fields>label,.kd3d-builtin-fields>label,.kd3d-gate-toggle small,.kd3d-direction-note){color:var(--kd-muted)!important}
.kd-v2-local #threeDScreen :is(.kd3d-editor-head h3,.kd3d-product-head strong,.kd3d-compact-head strong,.kd3d-compact-current,.kd3d-sides-head strong,.kd3d-side-line [data-side],.kd3d-gate-toggle strong,.kd3d-stats b){color:var(--kd-text)!important}
.kd-v2-local #threeDScreen :is(.kd3d-mode,.kd3d-scope,.kd3d-compact-kind-tabs,.kd3d-compact-segment>div,.kd3d-compact-side-tabs button,.kd3d-compact-number,.kd3d-product-note,.kd3d-compact-help,.kd3d-compact-empty,.kd3d-gate-note){background:var(--kd-soft)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local #threeDScreen :is(.kd3d-mode button,.kd3d-scope button,.kd3d-compact-kind-tabs button,.kd3d-compact-segment button){color:var(--kd-muted)!important}
.kd-v2-local #threeDScreen :is(.kd3d-mode button.active,.kd3d-scope button[aria-pressed=true],.kd3d-compact-side-tabs button[aria-pressed=true],.kd3d-compact-kind-tabs button[aria-pressed=true],.kd3d-compact-segment button[aria-pressed=true]){background:var(--kd-primary)!important;border-color:var(--kd-primary)!important;color:white!important}
.kd-v2-local #threeDScreen :is(.kd3d-fields input,.kd3d-select-label select,.kd3d-product-type select,.kd3d-product-fields input,.kd3d-product-fields select,.kd3d-side-quick input,.kd3d-side-quick select,.kd3d-compact-field select,.kd3d-gate-fields input:not([type=checkbox]),.kd3d-gate-fields select,.kd3d-builtin-fields input:not([type=checkbox])){background:var(--kd-bg)!important;color:var(--kd-text)!important;border-color:var(--kd-line)!important}
.kd-v2-local #threeDScreen .kd3d-compact-field input{color:var(--kd-text)!important}
@media(prefers-reduced-motion:reduce){.kd-v2-local #mainView .screen,.kd-v2-local #mainView .btn,.kd-v2-local .kd-v2-home *{animation:none!important;transition:none!important}}

.kd-product-editor{display:grid;gap:10px;padding-bottom:4px}
.kd-product-editor h3{margin:4px 0 8px}
.kd-product-editor .kd-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
.kd-product-editor label{display:grid;gap:5px;min-width:0;font-size:12px;color:var(--vmuted)}
.kd-product-editor input:not([type=checkbox]),.kd-product-editor select{width:100%;min-width:0;height:46px;background:var(--vbg);color:var(--vtext);border:1px solid var(--vline);border-radius:10px;padding:8px;font-size:15px}
.kd-product-editor .kd-product-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.kd-product-editor .kd-product-check{display:flex;align-items:center;gap:8px;min-height:44px;color:var(--vtext);overflow-wrap:anywhere}
.kd-product-editor input[type=checkbox]{accent-color:var(--vprimary);width:19px;height:19px;flex:none}
.kd-product-sketch{background:#fff;border-radius:10px;padding:6px}
.kd-product-sketch svg{width:100%;height:auto;display:block;stroke:initial}
.kd-product-editor details>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:650}
.kd-product-editor details>summary:before{content:'▸';margin-right:8px;color:var(--vacc)}
.kd-product-editor details[open]>summary:before{content:'▾'}
.kd-product-editor .kd-product-row{display:flex;justify-content:space-between;gap:6px;padding:8px 0;border-top:1px solid var(--vline);font-size:13px}
.kd-product-total{position:sticky;bottom:0;z-index:1;box-shadow:0 -4px 16px #0002}
.kd-product-total strong{color:var(--vacc)}
.kd-product-editor [data-product-errors]:not(:empty){color:var(--vtext);border:1px solid #d97706;border-radius:10px;padding:12px}

.kd-v2-local #v2HomeScreen{padding:8px 2px}
.kd-v2-local #v2HomeScreen .kd-v2-head{margin-bottom:8px}
.kd-v2-local #mainView .topbar{padding-block:8px}
.kd-v2-local #v2HomeScreen .kd-v2-grid+.kd-v2-action{margin-top:10px}
.kd-v2-local #v2HomeScreen .kd-v2-soon{font-size:11px;color:var(--vmuted);font-weight:normal}
.kd-v2-local #v2HomeScreen .kd-v2-back{padding:8px 12px;margin-bottom:10px}
.kd-v2-local #v2HomeScreen .kd-v2-note{margin-bottom:8px;line-height:1.35}
.kd-v2-local #v2HomeScreen .kd-v2-panel{margin:8px 0;padding:10px}
.kd-v2-local #v2HomeScreen .kd-v2-tile{min-height:76px!important;padding:8px 4px}
.kd-v2-local #v2HomeScreen .kd-v2-action svg{flex:0 0 25px}
.kd-v2-local #v2HomeScreen .kd-v2-action.primary svg{stroke:#fff}
.kd-v2-local #v2HomeScreen .kd-v2-action{overflow-wrap:anywhere}
@media(min-width:700px){.kd-v2-local #v2HomeScreen{padding:16px}.kd-v2-local #v2HomeScreen .kd-v2-tile{min-height:100px!important}}
@media(min-width:700px){.kd-v2-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.kd-v2-grid.two{grid-template-columns:repeat(4,minmax(0,1fr))}.kd-v2-tile{min-height:105px!important}}
`;
  host.append(style);
  const body=document.createElement('div');host.append(body);
  const globalTheme=document.createElement('button');
  globalTheme.type='button';globalTheme.className='kd-v2-theme-global';globalTheme.id='kdV2GlobalTheme';
  globalTheme.hidden=true;
  main.querySelector('.topbar-actions').prepend(globalTheme);
  function updateThemeButton(){
    globalTheme.textContent=theme==='dark'?'☀':'☾';
    globalTheme.setAttribute('aria-label',theme==='dark'?'Включить светлую тему':'Включить тёмную тему');
    globalTheme.hidden=currentScreen==='v2Home';
  }
  function toggleTheme(){
    theme=theme==='dark'?'light':'dark';
    try{localStorage.setItem('kd-v2-home-theme',theme)}catch{}
    render();
  }
  globalTheme.addEventListener('click',toggleTheme);
  const paths={home:'M3 10l9-7 9 7v10h-6v-6H9v6H3z',menu:'M4 6h16 M4 12h16 M4 18h16',tasks:'M4 3h16v18H4z M7 9l2 2 3-4 M14 10h3 M7 16l2 2 3-4 M14 17h3',clients:'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 5',orders:'M5 4h14v18H5z M9 4V2h6v2 M9 10h6 M9 14h6 M9 18h6',factory:'M3 21V10l6 3V8l6 4V4h5l1 17Z M7 17h2 M12 17h2 M17 17h2',calendar:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18',truck:'M2 5h12v12H2z M14 10h5l3 4v3h-8 M6 17v3 M18 17v3',stock:'M3 7l9-5 9 5v10l-9 5-9-5Z M3 7l9 5 9-5 M12 12v10',wallet:'M3 5h18v15H3z M21 11h-6v5h6 M17 13.5h.1',ads:'M3 9l14-5v16L3 15z M7 16l2 5h3l-2-5 M21 9v6',star:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',ruler:'M3 17L17 3l4 4L7 21z M8 12l3 3 M12 8l3 3',chart:'M3 3v18h18 M7 17v-5 M12 17V8 M17 17V5',calc:'M5 2h14v20H5z M8 6h8 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M8 19h1 M15 19h1',catalog:'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6',file:'M5 2h10l4 4v16H5z M15 2v5h4 M8 12h8 M8 16h8',check:'M5 2h10l4 4v16H5z M8 15l2 2 5-5'};
  Object.assign(paths,{
    quick:paths.calc,measure:paths.ruler,threeD:'M12 2 22 7.5v9L12 22 2 16.5v-9Z M2 7.5l10 5.5 10-5.5M12 13v9',
    artGates:'M2 20V5h20v15M12 5v15M4 8l6 5-6 5M20 8l-6 5 6 5',
    artFences:'M2 21V4M22 21V4M2 7h20M2 19h20M6 7v12M12 7v12M18 7v12M6 9l6 4-6 4M18 9l-6 4 6 4',
    frames:'M2 5h14v15H2zM9 5v15M2 5l7 15M16 5L9 20M18 5h4v15h-4z',
    sliding:'M2 7h14v12H2zM16 7l6 12h-6M2 13h14M7 7v12M12 7v12M2 21h20',
    pickets:'M2 8l2-3 2 3v13H2zM10 8l2-3 2 3v13h-4zM18 8l2-3 2 3v13h-4zM2 12h20M2 18h20',
    profileFence:'M2 5h20v15H2zM6 5v15M10 5v15M14 5v15M18 5v15',
    canopy:'M2 9l10-6 10 6M2 9h20M4 9v12M20 9v12M8 9l4-6 4 6'
  });
  const icon=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[id]||paths.file)+'"/></svg>';
  const ownerItems=[['tasks','Задачи'],['clients','Клиенты'],['orders','Заказы'],['factory','Цех'],['calendar','Календарь'],['truck','Доставка'],['stock','Склад'],['wallet','Финансы'],['ads','Реклама'],['star','Отзывы'],['ruler','Замерщик'],['chart','Аналитика']];
  const surveyItems=[['catalog','Каталог'],['calc','Мои расчёты'],['clients','Клиенты'],['calendar','Календарь'],['file','Предложения'],['check','Договоры']];
  const upcoming=new Set(['tasks','orders','factory','calendar','truck','stock','ads','star','chart','file','check']);
  const tile=([id,label])=>'<button class="kd-v2-tile" type="button" data-v2-action="'+id+'">'+icon(id)+'<span>'+label+'</span>'+(upcoming.has(id)?'<small class="kd-v2-soon">Скоро</small>':'')+'</button>';
  const btn=(id,label,desc,primary=false)=>'<button class="kd-v2-action'+(primary?' primary':'')+'" type="button" data-v2-action="'+id+'">'+icon(id)+'<span><b>'+label+'</b><small>'+desc+'</small></span></button>';
  const catalogItems=[
    ['artGates','Кованые ворота Арт.','38 артикулов · фото и размеры'],
    ['artFences','Кованые заборы Арт.','Размеры и количество секций'],
    ['frames','Каркасы ворот и калиток','Размеры и предварительные материалы'],
    ['sliding','Откатные ворота','Быстрый расчёт в миллиметрах · без заказа.'],
    ['pickets','Евроштакетник','Пролёты и материалы без подрезки'],
    ['profileFence','Забор из профнастила','Листы, опоры и раскрой'],
    ['canopy','Навесы','Фермы, кровля и материалы']
  ];
  function syncHeading(){
    if(topBrand)topBrand.textContent=currentScreen==='v2Home'?'Тестовая версия · DEV':(workspace==='owner'&&owner?'КД Управление · DEV':'КД Замерщик · DEV');
    if(currentScreen==='v2Home'&&topTitle)topTitle.textContent=productOpen?'Быстрый расчёт':basketOpen?'Черновик сметы':catalogOpen?'Каталог изделий':'Главная';
  }
  function render(){
    syncHeading();
    host.dataset.theme=theme;
    root.dataset.kdTheme=theme;
    updateThemeButton();
    const isOwner=workspace==='owner'&&owner;
    body.innerHTML='<div class="kd-v2-head"><h2>'+(isOwner?'КД УПРАВЛЕНИЕ':'КД ЗАМЕРЩИК')+'</h2><button class="kd-v2-iconbtn" type="button" data-v2-action="theme" aria-label="Переключить тему">'+(theme==='dark'?'☀':'☾')+'</button>'+(owner?'<button class="kd-v2-iconbtn" type="button" data-v2-action="workspace" aria-label="Переключить рабочее пространство">⇄</button>':'')+'</div>'+
    (productOpen?'<div data-product-editor-root></div><div class="kd-v2-card"><button type="button" class="kd-v2-action primary" data-basket-add>'+(editId?'Сохранить изменения в черновике':'Добавить в черновик сметы')+'</button><div data-basket-add-status role="status"></div></div>':basketOpen?'<div data-basket-root></div>':catalogOpen?'<button class="kd-v2-action kd-v2-back" type="button" data-v2-action="catalogBack">← Назад</button>'+catalogItems.map(([id,label,desc])=>btn(id,label,desc)).join(''):isOwner?'<div class="kd-v2-grid two">'+['Сумма заказов','К получению','Заказы в работе','Активные клиенты'].map(x=>'<div class="kd-v2-card"><small>'+x+'</small><strong>—</strong></div>').join('')+'</div><div class="kd-v2-card kd-v2-panel"><b>Требует внимания</b><small>Рабочие показатели ещё не подключены.</small></div><h3>Управление предприятием</h3><div class="kd-v2-grid">'+ownerItems.map(tile).join('')+'</div><div class="kd-v2-card kd-v2-panel"><b>КД — Умный помощник</b><small>Скоро · подсказки по управлению</small><button class="kd-v2-question" data-v2-action="tasks">Что сделать сегодня?</button><button class="kd-v2-question" data-v2-action="wallet">Кто должен деньги?</button><button class="kd-v2-question" data-v2-action="orders">Какие заказы требуют внимания?</button></div>':
    btn('quick','Быстрый расчёт',owner?'Действующий калькулятор откатных ворот':'Выбрать изделие · без заказа',true)+btn('measure','Новый замер объекта','Создать карточку объекта')+'<h3>Работа с клиентами</h3><div class="kd-v2-grid two">'+surveyItems.map(tile).join('')+'</div>'+btn('threeD','3D-конструктор','Модель участка и изделий'))+'<div class="kd-v2-card kd-v2-detail" role="status" hidden></div>';
    if(!basketOpen&&!editId){
      const link=document.createElement('button');link.type='button';link.className='kd-v2-action';link.dataset.v2Action='basket';link.textContent='Черновик сметы · '+basket.length+' изд.';body.children[0].after(link);
    }
    if(basketStorageError){const note=document.createElement('p');note.className='kd-v2-note';note.textContent='Локальное сохранение недоступно: черновик может исчезнуть при обновлении.';body.children[0].after(note)}
    if(basketOpen){
      mountBasket(body.querySelector('[data-basket-root]'),basket,{
        onBack:()=>{basketOpen=false;catalogOpen=true;render()},
        onEdit:id=>{const row=basket.find(r=>r.id===id);if(!row)return;editId=id;editDraft=structuredClone(row.draft);basketOpen=false;catalogOpen=false;productOpen=row.kind==='sliding'?true:row.kind;render()},
        onRemove:id=>{if(window.confirm('Удалить изделие из черновика?')){basket=basket.filter(row=>row.id!==id);persistBasket();render()}}
      });
    }
    if(productOpen)body.querySelector('[data-basket-add]').onclick=addBasket;
    if(productOpen==='canopy'){
      mountCanopyEditor(body.querySelector('[data-product-editor-root]'),{draft:draftFor(canopyDraft),onDraft:value=>changeDraft(value=>{canopyDraft=value},value),onReset:()=>resetDraft(value=>{canopyDraft=value}),onBack:backToCatalogue});
    }else if(productOpen==='profileFence'){
      mountProfileFenceEditor(body.querySelector('[data-product-editor-root]'),{draft:draftFor(profileFenceDraft),onDraft:value=>changeDraft(value=>{profileFenceDraft=value},value),onReset:()=>resetDraft(value=>{profileFenceDraft=value}),onBack:backToCatalogue});
    }else if(productOpen==='pickets'){
      mountPicketSiteEditor(body.querySelector('[data-product-editor-root]'),{draft:draftFor(picketDraft),onDraft:value=>changeDraft(value=>{picketDraft=value},value),onReset:()=>resetDraft(value=>{picketDraft=value}),onBack:backToCatalogue});
    }else if(productOpen==='artFences'){
      mountArtFenceEditor(body.querySelector('[data-product-editor-root]'),{draft:draftFor(artFenceDraft),onDraft:value=>changeDraft(value=>{artFenceDraft=value},value),onReset:()=>resetDraft(value=>{artFenceDraft=value}),onBack:backToCatalogue});
    }else if(productOpen==='artGates'){
      mountArtGateCatalog(body.querySelector('[data-product-editor-root]'),{draft:draftFor(artDraft),onDraft:value=>changeDraft(value=>{artDraft=value},value),onQuote:quoteArtGate,onBack:backToCatalogue});
    }else if(productOpen==='frames'){
      mountSwingFrameEditor(body.querySelector('[data-product-editor-root]'),{draft:draftFor(swingDraft),onDraft:value=>changeDraft(saveSwingDraft,value),onQuote:quoteSwing,onSave:saveSwing&&!editId?async input=>{const id=await saveSwing(input);saveSwingDraft(null);productOpen=false;catalogOpen=false;render();await openSavedQuote?.(id)}:null,onReset:()=>resetDraft(saveSwingDraft),onBack:backToCatalogue});
    }else if(productOpen){
      mountProductEditor(body.querySelector('[data-product-editor-root]'),{
        draft:draftFor(productDraft),onDraft:value=>changeDraft(saveProductDraft,value),onReset:()=>resetDraft(saveProductDraft),
        listTargets:listQuoteTargets,
        onSave:saveQuote&&!editId?async(input,targetId)=>{
          const id=await saveQuote(input,targetId);
          saveProductDraft(null);productOpen=false;catalogOpen=false;render();
          try{await openSavedQuote?.(id)}catch(error){console.warn('Saved quote could not open',error);navigate('surveys')}
        }:null,
        onBack:backToCatalogue,
        onLegacy:()=>{productOpen=false;catalogOpen=false;render();navigate('surveys');newSurvey()}
      });
    }
  }
  function pending(label){const detail=body.querySelector('.kd-v2-detail');detail.textContent=label;detail.hidden=false;detail.scrollIntoView({block:'nearest'});}
  body.addEventListener('click',e=>{
    const action=e.target.closest('[data-v2-action]')?.dataset.v2Action;if(!action)return;
    if(action==='theme'){toggleTheme();body.querySelector('[data-v2-action="theme"]')?.focus();return}
    if(action==='workspace'&&owner){clearEdit();basketOpen=false;productOpen=false;catalogOpen=false;workspace=workspace==='owner'?'surveyor':'owner';render();syncNav();return}
    if(action==='ruler'&&owner){clearEdit();basketOpen=false;productOpen=false;catalogOpen=false;workspace='surveyor';render();syncNav();return}
    if(action==='basket'){openBasket();return}
    if(action==='catalog'){clearEdit();basketOpen=false;productOpen=false;catalogOpen=true;render();return}
    if(action==='catalogBack'){catalogOpen=false;render();return}
    if(action==='artFences'){productOpen='artFences';catalogOpen=false;render();return}
    if(action==='profileFence'){productOpen='profileFence';catalogOpen=false;render();return}
    if(action==='frames'){productOpen='frames';catalogOpen=false;render();return}
    if(action==='sliding'){productOpen=true;catalogOpen=false;render();return}
    if(action==='artGates'){productOpen='artGates';catalogOpen=false;render();return}
    if(action==='pickets'){productOpen='pickets';catalogOpen=false;render();return}
    if(action==='canopy'){productOpen='canopy';catalogOpen=false;render();return}

    if(action==='clients'){navigate('clients');return}
    if(action==='calc'){navigate('surveys');return}
    if(action==='orders'&&owner){pending('Реестр заказов появится на этапе 6. Замеры доступны в пространстве замерщика.');return}
    if(action==='wallet'&&owner){
      pending('Учёт фактических оплат и расходов появится на этапе 9. Сейчас доступна только предварительная экономика по замерам.');
      const detail=body.querySelector('.kd-v2-detail');
      const next=document.createElement('button');next.type='button';next.className='kd-v2-action';next.dataset.v2Action='estimateEconomy';next.textContent='Расчётная экономика по замерам';detail.append(next);return
    }
    if(action==='estimateEconomy'&&owner){navigate('owner');return}
    if(action==='quick'&&owner){navigate('ownerQuick');return}
    if(action==='quick'){productOpen=false;catalogOpen=true;render();return}
    if(action==='measure'){navigate('surveys');newSurvey();return}
    if(action==='threeD'){open3D();return}
    pending('Раздел пока не подключён. Его реализация предусмотрена утверждённой дорожной картой.');
  });
  document.querySelector('#mainView .content').prepend(host);
  const navNodes=[];
  function syncNav(screen=currentScreen){
    currentScreen=screen;
    syncHeading();
    updateThemeButton();
    const focusedTarget=navNodes.includes(document.activeElement)?document.activeElement.dataset.screen:null;
    navNodes.splice(0).forEach(n=>n.remove());
    const isOwner=workspace==='owner'&&owner;
    const items=isOwner?[['home','Главная','v2Home'],['orders','Заказы','ordersPending'],['clients','Клиенты','clients'],['factory','Цех','factoryPending'],['menu','Ещё','settings']]:[['home','Главная','v2Home'],['calc','Расчёты','surveys'],['clients','Клиенты','clients'],['menu','Ещё','settings']];
    for(const [id,label,target] of items){
      const nav=document.createElement('button');nav.className='nav-btn kd-v2-nav';nav.type='button';nav.dataset.screen=target;
      nav.innerHTML=icon(id)+'<b>'+label+'</b>';
      const selected=screen===target||(target==='v2Home'&&['owner','ownerQuick'].includes(screen))||(target==='surveys'&&screen==='threeD')||(target==='settings'&&screen==='team');
      nav.classList.toggle('active',selected);if(selected)nav.setAttribute('aria-current','page');
      nav.addEventListener('click',()=>{
        if(target==='ordersPending'||target==='factoryPending'){
          navigate('v2Home');
          pending(target==='ordersPending'?'Полноценный реестр заказов появится на этапе 6. Существующие замеры доступны в рабочем пространстве замерщика.':'Цех будет подключён на этапе 7.');
        }else {if(target==='v2Home'&&(catalogOpen||productOpen||basketOpen)){clearEdit();basketOpen=false;catalogOpen=false;productOpen=false;render()}navigate(target);}
      });
      bottom.append(nav);navNodes.push(nav);
    }
    if(focusedTarget)navNodes.find(n=>n.dataset.screen===focusedTarget)?.focus({preventScroll:true});
  }
  render();syncNav();
  return {onScreen:syncNav,destroy(){if(topBrand)topBrand.textContent=originalBrand;saveProductDraft(null);saveSwingDraft(null);basket=[];persistBasket();clearEdit();host.remove();globalTheme.remove();navNodes.forEach(n=>n.remove());oldNav.forEach(btn=>btn.classList.remove('kd-v2-legacy-nav'));root.classList.remove('kd-v2-local');delete root.dataset.kdTheme;}};
}
