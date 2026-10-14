const CACHE='kuzdvor-manager-v5';
const SHELL=['/manager','/manager.html','/manager-app.js','/manager-manifest.webmanifest','/manager-icon.svg'];
const isManager=url=>['/manager','/manager.html'].includes(new URL(url).pathname);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
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
  if(event.request.method!=='GET'||url.origin!==location.origin||!SHELL.includes(url.pathname))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(!response.ok)throw new Error('Manager shell unavailable');
      const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());return response;
    }catch{
      const cached=await caches.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await caches.match('/manager.html'))||Response.error();
      return Response.error();
    }
  })());
});
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let payload={};try{payload=event.data?.json()||{}}catch{}
    const receivedAt=Date.now();
    const type=['test','lead','reminder'].includes(payload.type)?payload.type:'lead';
    const target=new URL(payload.url||'/manager',location.origin);
    const url=target.origin===location.origin&&isManager(target.href)?target.pathname+target.search:'/manager';
    await self.registration.showNotification(payload.title||'Новая заявка с сайта',{
      body:payload.body||'Откройте КД Менеджер, чтобы посмотреть заявку.',
      tag:payload.tag||'kuzdvor-lead-'+receivedAt,
      data:{url,type,testId:payload.testId,leadId:payload.leadId},
      icon:'/manager-icon.svg',badge:'/manager-icon.svg',timestamp:receivedAt,
      vibrate:[220,90,220],
    });
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    windows.filter(client=>isManager(client.url)).forEach(client=>client.postMessage({type:'MANAGER_PUSH_RECEIVED',eventType:type,testId:payload.testId,leadId:payload.leadId,receivedAt}));
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=event.notification.data?.url||'/manager';
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>isManager(client.url));
    if(existing){await existing.navigate(url);return existing.focus()}
    return clients.openWindow(url);
  })());
});
