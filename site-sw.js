const VERSION='kuzdvor-offline-2026-09-21-v2';
const SHELL_CACHE=VERSION+'-shell';
const MEDIA_CACHE=VERSION+'-media';
const API_CACHE=VERSION+'-api';
const DB_NAME='kuzdvor-offline-v1';
const STORE='leadQueue';

const CORE=['/','/app','/links','/offline-delivery-200km.json','/site.css','/site.bundle.js','/calculator.bundle.js','/catalog-enhancements.bundle.js','/hero-gates.jpg','/site-manifest.webmanifest','/site-icon.svg'];
const STATIC_MEDIA=["/catalog/art-6-1.webp","/catalog/art-6-2.webp","/catalog/art-6-3.webp","/catalog/art-18-2.webp","/catalog/art-18-1.webp","/catalog/art-18-3.webp","/catalog/art-31-1.webp","/catalog/art-31-2.webp","/catalog/art-31-3.webp","/catalog/art-28-1.webp","/catalog/art-28-2.webp","/catalog/art-28-3.webp","/catalog/art-15-2.webp","/catalog/art-15-1.webp","/catalog/art-15-3.webp","/catalog/art-30-1.webp","/catalog/art-30-2.webp","/catalog/art-30-3.webp","/catalog/art-38-2.webp","/catalog/art-38-3.webp","/catalog/art-9-1.webp","/catalog/art-9-2.webp","/catalog/art-9-3.webp","/catalog/art-22-2-3.webp","/catalog/art-22-2-2.webp","/catalog/art-21-2.webp","/catalog/art-21-3.webp","/catalog/art-21-1.webp","/catalog/art-29-1.webp","/catalog/art-29-2.webp","/catalog/art-14-2.webp","/catalog/art-14-1.webp","/catalog/art-14-3.webp","/catalog/art-36-1.webp","/catalog/art-36-2.webp","/catalog/art-36-3.webp","/catalog/art-24-1.webp","/catalog/art-24-2.webp","/catalog/art-24-3.webp","/catalog/art-1-3.webp","/catalog/art-1-1.webp","/catalog/art-1-2.webp","/catalog/art-12-2.webp","/catalog/art-12-1.webp","/catalog/art-12-3.webp","/catalog/art-32-2.webp","/catalog/art-32-1.webp","/catalog/art-32-3.webp","/catalog/art-17s-3.webp","/catalog/art-17s-1.webp","/catalog/art-17s-2.webp","/catalog/art-4-1.webp","/catalog/art-33-1.webp","/catalog/art-33-2.webp","/catalog/art-33-3.webp","/catalog/art-46-3.webp","/catalog/art-46-1.webp","/catalog/art-46-2.webp","/catalog/art-27-3.webp","/catalog/art-27-1.webp","/catalog/art-27-2.webp","/catalog/art-8-3.webp","/catalog/art-8-1.webp","/catalog/art-8-2.webp","/catalog/art-16-1.webp","/catalog/art-16-2.webp","/catalog/art-16-3.webp","/catalog/art-7-1.webp","/catalog/art-34-1.webp","/catalog/art-23s-1.webp","/catalog/art-23s-2.webp","/catalog/art-23s-3.webp","/catalog/art-25-1.webp","/catalog/art-25-2.webp","/catalog/art-10-2.webp","/catalog/art-10-1.webp","/catalog/art-10-3.webp","/catalog/art-35-3.webp","/catalog/art-35-1.webp","/catalog/art-35-2.webp","/catalog/art-37-1.webp","/catalog/art-9-3-1.webp","/catalog/art-9-3-2.webp","/catalog/art-9-3-3.webp","/catalog/art-13-1.webp","/catalog/art-13-2.webp","/catalog/art-11-1.webp","/catalog/art-20-1.webp","/catalog/art-20-2.webp","/catalog/art-20-3.webp","/catalog/art-2-1.webp","/catalog/art-2-2.webp","/catalog/art-2-3.webp","/catalog/art-3-1.webp","/catalog/art-3-2.webp","/catalog/art-3-3.webp","/catalog/art-5-3.webp","/catalog/art-5-2.webp","/catalog/art-5-1.webp"];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function safePut(cache,url,response){
  if(response && (response.ok || response.type==='opaque')){
    try{await cache.put(url,response.clone())}catch{}
  }
}
async function fetchAndCache(cache,url){
  try{
    const response=await fetch(new Request(url,{cache:'reload'}));
    await safePut(cache,url,response);
    return true;
  }catch{return false}
}
async function cacheBatch(urls,cacheName,onProgress){
  const cache=await caches.open(cacheName);
  let done=0,total=urls.length;
  for(let i=0;i<urls.length;i+=6){
    const chunk=urls.slice(i,i+6);
    const results=await Promise.all(chunk.map(url=>fetchAndCache(cache,url)));
    done+=results.filter(Boolean).length;
    onProgress?.(Math.min(i+chunk.length,total),total,done);
    await sleep(0);
  }
}
function collectMedia(value,set){
  if(typeof value==='string'){
    if(/^\/catalog\/.*\.(?:webp|jpe?g|png)$/i.test(value))set.add(value);
    return;
  }
  if(Array.isArray(value)){value.forEach(item=>collectMedia(item,set));return}
  if(value && typeof value==='object')Object.values(value).forEach(item=>collectMedia(item,set));
}
async function broadcast(message){
  const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clientsList.forEach(client=>client.postMessage(message));
}
let warmPromise=null;
async function warmOffline(){
  if(warmPromise)return warmPromise;
  warmPromise=(async()=>{
    await broadcast({type:'OFFLINE_WARM_START'});
    await cacheBatch(CORE,SHELL_CACHE,(current,total)=>broadcast({type:'OFFLINE_WARM_PROGRESS',current,total,stage:'shell'}));
    const all=new Set(STATIC_MEDIA);
    try{
      const response=await fetch('/api/catalog-images',{cache:'no-store',headers:{accept:'application/json'}});
      if(response.ok){
        const apiCache=await caches.open(API_CACHE);
        await apiCache.put('/api/catalog-images',response.clone());
        const data=await response.json().catch(()=>null);
        collectMedia(data,all);
      }
    }catch{}
    const media=[...all];
    await cacheBatch(media,MEDIA_CACHE,(current,total)=>broadcast({type:'OFFLINE_WARM_PROGRESS',current,total,stage:'media'}));
    await broadcast({type:'OFFLINE_READY',count:media.length});
  })().finally(()=>{warmPromise=null});
  return warmPromise;
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await Promise.allSettled(CORE.map(async url=>{
      const response=await fetch(new Request(url,{cache:'reload'}));
      await safePut(cache,url,response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keep=new Set([SHELL_CACHE,MEDIA_CACHE,API_CACHE]);
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('kuzdvor-offline-')&&!keep.has(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
    warmOffline().catch(()=>{});
    flushLeadQueue().catch(()=>{});
  })());
});
async function matchAny(request){return (await caches.match(request,{ignoreSearch:true}))||null}
async function networkFirst(request,cacheName,fallbackUrl=''){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request);
    await safePut(cache,request,response);
    return response;
  }catch{
    const cached=await cache.match(request,{ignoreSearch:true})||(fallbackUrl?await cache.match(fallbackUrl,{ignoreSearch:true}):null)||await matchAny(request);
    if(cached)return cached;
    throw new Error('offline');
  }
}
async function cacheFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached){
    fetch(request).then(response=>safePut(cache,request,response)).catch(()=>{});
    return cached;
  }
  const response=await fetch(request);
  await safePut(cache,request,response);
  return response;
}
function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id',autoIncrement:true})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function queueLead(request){
  const body=await request.clone().text();
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).add({url:request.url,body,createdAt:Date.now()});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  try{await self.registration.sync.register('kuzdvor-leads-sync')}catch{}
  await broadcast({type:'LEAD_QUEUED'});
}
async function queuedLeads(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const rows=[];
    const req=tx.objectStore(STORE).openCursor();
    req.onsuccess=()=>{const cursor=req.result;if(!cursor){resolve(rows);return}rows.push({key:cursor.primaryKey,...cursor.value});cursor.continue()};
    req.onerror=()=>reject(req.error);
  });
}
async function deleteLead(key){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function flushLeadQueue(){
  const rows=await queuedLeads().catch(()=>[]);
  let sent=0;
  for(const row of rows){
    try{
      const response=await fetch(row.url,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:row.body});
      if(!response.ok)continue;
      await deleteLead(row.key);
      sent+=1;
    }catch{break}
  }
  if(sent)await broadcast({type:'LEAD_QUEUE_FLUSHED',sent});
}
self.addEventListener('sync',event=>{if(event.tag==='kuzdvor-leads-sync')event.waitUntil(flushLeadQueue())});
self.addEventListener('message',event=>{
  if(event.data?.type==='WARM_OFFLINE')event.waitUntil(warmOffline());
  if(event.data?.type==='FLUSH_LEADS')event.waitUntil(flushLeadQueue());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.method==='POST'&&url.pathname==='/api/leads'){
    event.respondWith((async()=>{
      try{return await fetch(request.clone())}
      catch{
        await queueLead(request);
        return new Response(JSON.stringify({ok:true,queued:true,offline:true}),{status:202,headers:{'content-type':'application/json'}});
      }
    })());
    return;
  }
  if(request.method!=='GET')return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,SHELL_CACHE,'/').catch(()=>caches.match('/')));
    event.waitUntil(warmOffline().catch(()=>{}));
    return;
  }
  if(url.pathname==='/api/catalog-images'||url.pathname==='/api/share-link'){
    event.respondWith(networkFirst(request,API_CACHE).catch(async()=>{
      const cached=await caches.open(API_CACHE).then(cache=>cache.match(request,{ignoreSearch:false}));
      return cached||new Response(JSON.stringify({error:'Нет сети'}),{status:503,headers:{'content-type':'application/json'}});
    }));
    return;
  }
  if(/\.(?:js|css|json|webmanifest)$/i.test(url.pathname)){
    event.respondWith(networkFirst(request,SHELL_CACHE));
    return;
  }
  if(/\.(?:webp|jpe?g|png|svg)$/i.test(url.pathname)){
    event.respondWith(cacheFirst(request,MEDIA_CACHE));
    return;
  }
});