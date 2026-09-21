(() => {
  if (!('serviceWorker' in navigator)) return;
  const params=new URLSearchParams(location.search);
  const appMode=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||params.get('app')==='1';
  let installPrompt=null;
  let badge=null;
  function ensureBadge(){
    if(!appMode)return null;
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id='offlineAppStatus';
    badge.style.cssText='position:fixed;z-index:500;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:7px 11px;border:1px solid rgba(230,189,105,.32);border-radius:999px;background:rgba(12,13,15,.92);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.22);backdrop-filter:blur(8px);font:800 10px/1.2 Manrope,Arial,sans-serif;transition:.2s';
    badge.innerHTML='<span data-text>Готовим офлайн-режим…</span><button data-install hidden style="border:0;border-radius:999px;background:#d3a044;color:#17120b;padding:6px 9px;font:900 10px Manrope,Arial,sans-serif">Установить</button>';
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
  navigator.serviceWorker.register('/site-sw.js',{scope:'/'}).then(()=>{
    setStatus(navigator.onLine?'Готовим сайт для работы без сети…':'Офлайн-режим');
    post('WARM_OFFLINE');
    post('FLUSH_LEADS');
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data||{};
    if(data.type==='OFFLINE_WARM_START')setStatus('Готовим сайт для работы без сети…');
    if(data.type==='OFFLINE_WARM_PROGRESS'){
      const pct=data.total?Math.round(data.current/data.total*100):0;
      setStatus((data.stage==='media'?'Сохраняем фотографии · ':'Подготавливаем приложение · ')+pct+'%');
    }
    if(data.type==='OFFLINE_READY')setStatus('Офлайн готов ✓',true);
    if(data.type==='LEAD_QUEUED')setStatus('Нет сети · заявка сохранена на телефоне');
    if(data.type==='LEAD_QUEUE_FLUSHED')setStatus('Отправлено заявок: '+data.sent,true);
  });
  window.addEventListener('offline',()=>setStatus('Офлайн-режим · сайт работает без сети'));
  window.addEventListener('online',()=>{setStatus('Связь появилась · обновляем данные');post('WARM_OFFLINE');post('FLUSH_LEADS')});
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
  window.addEventListener('appinstalled',()=>setStatus('Приложение установлено · готовим офлайн',true));
})();