const CACHE='kuzdvor-manager-v4';
const SHELL=['/manager','/manager.html','/manager-manifest.webmanifest','/manager-icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('kuzdvor-manager-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
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
  // Show immediately. A background push must not depend on the manager login
  // cookie or an extra API request, otherwise Android may terminate the event
  // before a notification becomes visible.
  event.waitUntil((async()=>{
    const receivedAt=Date.now();
    await self.registration.showNotification('Новая заявка с сайта',{
      body:'Откройте КД Менеджер, чтобы посмотреть клиента и расчёт.',
      tag:'kuzdvor-new-lead',
      data:{url:'/manager'},
      renotify:true,
      requireInteraction:true,
      silent:false,
      icon:'/manager-icon.svg',
      badge:'/manager-icon.svg',
      vibrate:[220,90,220,90,260],
      timestamp:receivedAt
    });
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    windows.forEach(client=>client.postMessage({type:'MANAGER_PUSH_RECEIVED',receivedAt}));
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