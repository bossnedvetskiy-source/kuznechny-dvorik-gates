const CACHE='kuzdvor-manager-v1';
const SHELL=['/manager','/manager.html','/manager-manifest.webmanifest','/manager-icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.pathname.startsWith('/api/'))return;
  if(url.origin!==location.origin)return;
  if(url.pathname==='/manager'||url.pathname==='/manager.html'||url.pathname.startsWith('/manager-')){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/manager.html'))));
  }
});
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let title='Новая заявка с сайта';
    let body='Откройте приложение менеджера';
    let tag='kuzdvor-new-lead';
    let data={url:'/manager'};
    try{
      const response=await fetch('/api/admin/leads?limit=1',{credentials:'include',cache:'no-store'});
      if(response.ok){
        const payload=await response.json();
        const lead=Array.isArray(payload.leads)?payload.leads[0]:null;
        if(lead){
          const amount=new Intl.NumberFormat('ru-RU').format(Number(lead.client_total||lead.total)||0);
          body=[lead.name||'Клиент',lead.city||'',lead.article||'',amount?amount+' ₽':''].filter(Boolean).join(' · ');
          tag='lead-'+lead.id;
          data={url:'/manager',leadId:lead.id};
        }
      }
    }catch{}
    await self.registration.showNotification(title,{body,tag,data,renotify:true,requireInteraction:false,icon:'/manager-icon.svg',badge:'/manager-icon.svg'});
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=event.notification.data?.url||'/manager';
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if('focus'in client){client.navigate?.(url);return client.focus()}}
    return clients.openWindow?clients.openWindow(url):undefined;
  })());
});