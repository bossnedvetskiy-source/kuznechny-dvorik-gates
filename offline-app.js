(() => {
  if (!('serviceWorker' in navigator)) return;
  const params=new URLSearchParams(location.search);
  const appMode=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||params.get('app')==='1';
  let installPrompt=null;
  let badge=null;
  let appMenuButton=null;
  function ensureAppMenuButton(){
    if(!appMode)return null;
    if(appMenuButton)return appMenuButton;
    appMenuButton=document.createElement('a');
    appMenuButton.href='/app';
    appMenuButton.textContent='☰ Меню';
    appMenuButton.setAttribute('aria-label','Открыть рабочее меню');
    appMenuButton.style.cssText='position:fixed;z-index:501;left:10px;top:max(8px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:center;min-height:34px;padding:0 10px;border:1px solid rgba(230,189,105,.30);border-radius:999px;background:rgba(12,13,15,.92);color:#f3e6c5;text-decoration:none;box-shadow:0 8px 22px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:900 10px/1 Manrope,Arial,sans-serif';
    document.body.append(appMenuButton);
    return appMenuButton;
  }

  function ensureBadge(){
    if(!appMode)return null;
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id='offlineAppStatus';
    badge.style.cssText='position:fixed;z-index:500;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:7px 11px;border:1px solid rgba(230,189,105,.32);border-radius:999px;background:rgba(12,13,15,.92);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:800 10px/1.2 Manrope,Arial,sans-serif;transition:.2s';
    badge.innerHTML='<span data-text>Проверяем офлайн-базу…</span><button data-install hidden style="border:0;border-radius:999px;background:#d3a044;color:#17120b;padding:6px 9px;font:900 10px Manrope,Arial,sans-serif">Установить</button>';
    document.body.append(badge);
    return badge;
  }
  function setStatus(text,temporary){
    const node=ensureBadge();
    if(!node)return;
    node.querySelector('[data-text]').textContent=text;
    node.hidden=false;
    node.style.opacity='1';
    if(temporary)setTimeout(()=>{if(navigator.onLine)node.style.opacity='.68'},2400);
  }
  function post(type){
    navigator.serviceWorker.ready.then(reg=>{
      const worker=reg.active||reg.waiting||reg.installing;
      if(worker)worker.postMessage({type:type});
    }).catch(()=>{});
  }
  ensureAppMenuButton();
  navigator.serviceWorker.register('/site-sw.js',{scope:'/'}).then(()=>{
    setStatus(navigator.onLine?'Проверяем офлайн-базу…':'Проверяем сохранённую базу…');
    post('GET_OFFLINE_STATUS');
    post('FLUSH_LEADS');
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data||{};
    if(data.type==='OFFLINE_STATUS'){
      if(data.ready&&data.current)setStatus(navigator.onLine?'Офлайн-база готова ✓':'Офлайн · база готова ✓',true);
      else if(data.ready)setStatus('Сохранённая база работает · обновление через меню',true);
      else setStatus(navigator.onLine?'Офлайн-база не скачана · откройте меню':'Офлайн-база не скачана',true);
    }
    if(data.type==='OFFLINE_WARM_START')setStatus('Обновляем офлайн-базу…');
    if(data.type==='OFFLINE_WARM_PROGRESS'){
      const pct=data.total?Math.round(data.current/data.total*100):0;
      setStatus((data.stage==='media'?'Сохраняем фотографии · ':'Обновляем приложение · ')+pct+'%');
    }
    if(data.type==='OFFLINE_READY')setStatus('Офлайн-база обновлена ✓',true);
    if(data.type==='OFFLINE_PARTIAL')setStatus(data.previousReady?'Не всё обновилось · сохранённая база работает':'Офлайн-база скачана не полностью',true);
    if(data.type==='LEAD_QUEUED')setStatus('Нет сети · заявка сохранена на телефоне');
    if(data.type==='LEAD_QUEUE_FLUSHED')setStatus('Отправлено заявок: '+data.sent,true);
  });
  window.addEventListener('offline',()=>setStatus('Офлайн-режим · сайт работает без сети'));
  window.addEventListener('online',()=>{setStatus('Связь появилась');post('GET_OFFLINE_STATUS');post('FLUSH_LEADS')});
  window.addEventListener('beforeinstallprompt',event=>{
    if(params.get('app')!=='1')return;
    event.preventDefault();
    installPrompt=event;
    const node=ensureBadge();
    const button=node&&node.querySelector('[data-install]');
    if(button)button.hidden=false;
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest&&event.target.closest('#offlineAppStatus [data-install]');
    if(!button||!installPrompt)return;
    installPrompt.prompt();
    try{await installPrompt.userChoice}catch{}
    installPrompt=null;
    button.hidden=true;
  });
  window.addEventListener('appinstalled',()=>{setStatus('Приложение установлено · скачайте офлайн-базу в меню',true);post('GET_OFFLINE_STATUS')});
})();