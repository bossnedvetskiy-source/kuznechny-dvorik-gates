const VERSION='kuzdvor-offline-2026-09-26-v31';
const SHELL_CACHE=VERSION+'-shell';
const MEDIA_CACHE=VERSION+'-media';
const API_CACHE=VERSION+'-api';
const DB_NAME='kuzdvor-offline-v1';
const STORE='leadQueue';
const META_URL='/__kuzdvor_offline_meta__';

const CORE=['/','/work-app.html','/link-app.html','/offline-delivery-200km.json','/site.css','/site.bundle.js','/calculator.bundle.js','/catalog-enhancements.bundle.js','/hero-gates.jpg','/site-manifest.webmanifest','/site-icon.svg','/evroshtaketnik/','/evroshtaketnik/evroshtaketnik.css','/evroshtaketnik/evroshtaketnik.js','/evroshtaketnik/engine.js','/evroshtaketnik/assets/fence-double.webp','/evroshtaketnik/assets/fence-single.webp','/evroshtaketnik/assets/fence-horizontal.webp'];
const NAV_FALLBACKS={'/':'/','/app':'/work-app.html','/links':'/link-app.html','/evroshtaketnik':'/evroshtaketnik/','/evroshtaketnik/':'/evroshtaketnik/'};
const STATIC_MEDIA=["/catalog/art-6-1.webp","/catalog/art-6-2.webp","/catalog/art-6-3.webp","/catalog/art-18-2.webp","/catalog/art-18-1.webp","/catalog/art-18-3.webp","/catalog/art-31-1.webp","/catalog/art-31-2.webp","/catalog/art-31-3.webp","/catalog/art-28-1.webp","/catalog/art-28-2.webp","/catalog/art-28-3.webp","/catalog/art-15-2.webp","/catalog/art-15-1.webp","/catalog/art-15-3.webp","/catalog/art-30-1.webp","/catalog/art-30-2.webp","/catalog/art-30-3.webp","/catalog/art-38-2.webp","/catalog/art-38-3.webp","/catalog/art-9-1.webp","/catalog/art-9-2.webp","/catalog/art-9-3.webp","/catalog/art-22-2-3.webp","/catalog/art-22-2-2.webp","/catalog/art-21-2.webp","/catalog/art-21-3.webp","/catalog/art-21-1.webp","/catalog/art-29-1.webp","/catalog/art-29-2.webp","/catalog/art-14-2.webp","/catalog/art-14-1.webp","/catalog/art-14-3.webp","/catalog/art-36-1.webp","/catalog/art-36-2.webp","/catalog/art-36-3.webp","/catalog/art-24-1.webp","/catalog/art-24-2.webp","/catalog/art-24-3.webp","/catalog/art-1-3.webp","/catalog/art-1-1.webp","/catalog/art-1-2.webp","/catalog/art-12-2.webp","/catalog/art-12-1.webp","/catalog/art-12-3.webp","/catalog/art-32-2.webp","/catalog/art-32-1.webp","/catalog/art-32-3.webp","/catalog/art-17s-3.webp","/catalog/art-17s-1.webp","/catalog/art-17s-2.webp","/catalog/art-4-1.webp","/catalog/art-33-1.webp","/catalog/art-33-2.webp","/catalog/art-33-3.webp","/catalog/art-46-3.webp","/catalog/art-46-1.webp","/catalog/art-46-2.webp","/catalog/art-27-3.webp","/catalog/art-27-1.webp","/catalog/art-27-2.webp","/catalog/art-8-3.webp","/catalog/art-8-1.webp","/catalog/art-8-2.webp","/catalog/art-16-1.webp","/catalog/art-16-2.webp","/catalog/art-16-3.webp","/catalog/art-7-1.webp","/catalog/art-34-1.webp","/catalog/art-23s-1.webp","/catalog/art-23s-2.webp","/catalog/art-23s-3.webp","/catalog/art-25-1.webp","/catalog/art-25-2.webp","/catalog/art-10-2.webp","/catalog/art-10-1.webp","/catalog/art-10-3.webp","/catalog/art-35-3.webp","/catalog/art-35-1.webp","/catalog/art-35-2.webp","/catalog/art-37-1.webp","/catalog/art-9-3-1.webp","/catalog/art-9-3-2.webp","/catalog/art-9-3-3.webp","/catalog/art-13-1.webp","/catalog/art-13-2.webp","/catalog/art-11-1.webp","/catalog/art-20-1.webp","/catalog/art-20-2.webp","/catalog/art-20-3.webp","/catalog/art-2-1.webp","/catalog/art-2-2.webp","/catalog/art-2-3.webp","/catalog/art-3-1.webp","/catalog/art-3-2.webp","/catalog/art-3-3.webp","/catalog/art-5-3.webp","/catalog/art-5-2.webp","/catalog/art-5-1.webp"];
STATIC_MEDIA.push('/evroshtaketnik/assets/fence-double.webp','/evroshtaketnik/assets/fence-single.webp','/evroshtaketnik/assets/fence-horizontal.webp');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const FETCH_ATTEMPTS=3;
const FETCH_RETRY_DELAY=350;

async function safePut(cache,url,response){
  if(response && (response.ok || response.type==='opaque')){
    try{await cache.put(url,response.clone());return true}catch{}
  }
  return false;
}
async function useCachedFallback(cache,url){
  try{
    const local=await cache.match(url,{ignoreSearch:true});
    if(local)return true;
    const previous=await caches.match(url,{ignoreSearch:true});
    if(previous){
      try{await cache.put(url,previous.clone());return true}catch{}
    }
  }catch{}
  return false;
}
async function fetchAndCache(cache,url){
  for(let attempt=1;attempt<=FETCH_ATTEMPTS;attempt+=1){
    try{
      const response=await fetch(new Request(url,{cache:attempt===1?'reload':'no-store'}));
      if(response && (response.ok || response.type==='opaque')){
        if(await safePut(cache,url,response))return true;
      }
    }catch{}
    if(attempt<FETCH_ATTEMPTS)await sleep(FETCH_RETRY_DELAY*attempt);
  }
  return useCachedFallback(cache,url);
}
async function cacheBatch(urls,cacheName,onProgress){
  const cache=await caches.open(cacheName);
  let done=0,total=urls.length;
  const failed=[];
  for(let i=0;i<urls.length;i+=4){
    const chunk=urls.slice(i,i+4);
    const results=await Promise.all(chunk.map(url=>fetchAndCache(cache,url)));
    results.forEach((ok,index)=>{if(!ok)failed.push(chunk[index])});
    done+=results.filter(Boolean).length;
    onProgress?.(Math.min(i+chunk.length,total),total,done);
    await sleep(0);
  }
  return {done,total,failed};
}
async function fetchCatalogSnapshot(){
  for(let attempt=1;attempt<=FETCH_ATTEMPTS;attempt+=1){
    try{
      const response=await fetch('/api/catalog-images',{cache:attempt===1?'no-store':'reload',headers:{accept:'application/json'}});
      if(response.ok){
        const data=await response.clone().json().catch(()=>null);
        if(data)return {response,data};
      }
    }catch{}
    if(attempt<FETCH_ATTEMPTS)await sleep(FETCH_RETRY_DELAY*attempt);
  }
  return null;
}
async function fetchOfflineContentVersion(){
  try{
    const response=await fetch('/api/offline-version',{cache:'no-store',headers:{accept:'application/json'}});
    if(!response.ok)return null;
    const data=await response.json().catch(()=>null);
    const version=typeof data?.version==='string'?data.version:'';
    return version?{version,data}:null;
  }catch{return null}
}
function collectMedia(value,set){
  if(typeof value==='string'){
    if(/^\/(?:catalog|catalog-media)\/.*\.(?:webp|jpe?g|png)$/i.test(value))set.add(value);
    return;
  }
  if(Array.isArray(value)){value.forEach(item=>collectMedia(item,set));return}
  if(value && typeof value==='object')Object.values(value).forEach(item=>collectMedia(item,set));
}
async function writeOfflineMeta(meta){
  const cache=await caches.open(SHELL_CACHE);
  await cache.put(META_URL,new Response(JSON.stringify(meta),{headers:{'content-type':'application/json'}}));
}

async function readOfflineMeta(){
  const keys=await caches.keys();
  const candidates=[SHELL_CACHE,...keys.filter(key=>key.startsWith('kuzdvor-offline-')&&key.endsWith('-shell')&&key!==SHELL_CACHE)];
  let completeFallback=null;
  let anyFallback=null;
  for(const key of candidates){
    try{
      const response=await caches.open(key).then(cache=>cache.match(META_URL));
      if(!response)continue;
      const meta=await response.json();
      const candidate={...meta,current:key===SHELL_CACHE,cacheName:key};
      if(candidate.current&&candidate.complete)return candidate;
      if(candidate.complete&&!completeFallback)completeFallback=candidate;
      if(!anyFallback)anyFallback=candidate;
    }catch{}
  }
  return completeFallback||anyFallback;
}

async function cleanupOldOfflineCaches(){
  const keep=new Set([SHELL_CACHE,MEDIA_CACHE,API_CACHE]);
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('kuzdvor-offline-')&&!keep.has(key)).map(key=>caches.delete(key)));
}

async function verifyOfflineSnapshot(meta={cacheName:SHELL_CACHE}){
  const shellName=meta?.cacheName||SHELL_CACHE;
  const prefix=shellName.endsWith('-shell')?shellName.slice(0,-6):VERSION;
  const shellCache=await caches.open(shellName);
  const mediaCache=await caches.open(prefix+'-media');
  const apiCache=await caches.open(prefix+'-api');
  const corePresent=await Promise.all(CORE.map(url=>shellCache.match(url,{ignoreSearch:true})));
  if(!corePresent.every(Boolean))return {ok:false,missingCore:true,missingMedia:0,mediaTotal:0};

  let catalogResponse=null;
  try{catalogResponse=await apiCache.match('/api/catalog-images')}catch{}
  if(!catalogResponse)return {ok:false,missingCatalog:true,missingMedia:0,mediaTotal:0};

  const all=new Set(STATIC_MEDIA);
  try{
    const data=await catalogResponse.clone().json();
    collectMedia(data,all);
  }catch{return {ok:false,missingCatalog:true,missingMedia:0,mediaTotal:0}}

  const urls=[...all];
  const present=await Promise.all(urls.map(url=>mediaCache.match(url,{ignoreSearch:true})));
  const missingMediaUrls=urls.filter((url,index)=>!present[index]);
  return {
    ok:true,
    mediaComplete:missingMediaUrls.length===0,
    missingMedia:missingMediaUrls.length,
    missingMediaUrls,
    mediaTotal:urls.length
  };
}

async function offlineStatus(){
  const meta=await readOfflineMeta();
  const verification=meta?.complete ? await verifyOfflineSnapshot(meta) : {ok:false,missingMedia:0,missingMediaUrls:[],mediaTotal:0};
  const currentReady=Boolean(meta?.current && meta?.complete && verification.ok);
  const ready=Boolean(meta?.complete && verification.ok);
  return {
    type:'OFFLINE_STATUS',
    ready,
    current:currentReady,
    stale:Boolean(ready && !currentReady),
    updatedAt:meta?.updatedAt||null,
    mediaCount:verification.mediaTotal || Number(meta?.mediaCount)||0,
    failedCount:verification.missingMedia || Number(meta?.failedMediaCount)||0,
    missingMediaCount:verification.missingMedia || Number(meta?.failedMediaCount)||0,
    missingMediaUrls:(Array.isArray(verification.missingMediaUrls)&&verification.missingMediaUrls.length?verification.missingMediaUrls:(Array.isArray(meta?.failedMediaUrls)?meta.failedMediaUrls:[])).slice(0,50),
    contentVersion:meta?.contentVersion||''
  };
}

async function broadcast(message){
  const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clientsList.forEach(client=>client.postMessage(message));
}
let warmPromise=null;
async function warmOffline(targetVersion=''){
  if(warmPromise)return warmPromise;
  warmPromise=(async()=>{
    const previousStatus=await offlineStatus().catch(()=>({ready:false,current:false}));
    const remoteVersion=targetVersion || (await fetchOfflineContentVersion())?.version || '';
    await broadcast({type:'OFFLINE_WARM_START'});

    // 1) Save the small, mandatory application shell first.
    const shellResult=await cacheBatch(CORE,SHELL_CACHE,(current,total)=>broadcast({type:'OFFLINE_WARM_PROGRESS',current,total,stage:'shell'}));

    // 2) Save the catalog JSON BEFORE photos. This prevents a large photo cache
    // from consuming browser quota and blocking the mandatory offline data.
    const catalogSnapshot=await fetchCatalogSnapshot();
    const catalogApiOk=Boolean(catalogSnapshot);
    let catalogStored=false;
    if(shellResult.failed.length===0 && catalogSnapshot){
      try{
        const apiCache=await caches.open(API_CACHE);
        await apiCache.put('/api/catalog-images',catalogSnapshot.response.clone());
        catalogStored=true;
      }catch{}
    }

    const coreComplete=Boolean(shellResult.failed.length===0&&catalogApiOk&&catalogStored);
    const criticalFailures=[
      ...shellResult.failed,
      ...(!catalogApiOk?['/api/catalog-images']:[]),
      ...(catalogApiOk&&!catalogStored?['offline-catalog-storage']:[])
    ];

    // Mark the base usable as soon as all mandatory data is safe. Photos below
    // are best-effort and must never turn a usable base into a failed one.
    const baseUpdatedAt=new Date().toISOString();
    if(coreComplete){
      await writeOfflineMeta({
        complete:true,
        updatedAt:baseUpdatedAt,
        mediaCount:0,
        mediaTotal:0,
        failedCount:0,
        failedMediaCount:0,
        failedMediaUrls:[],
        catalogApiOk:true,
        contentVersion:remoteVersion
      });
    }

    // 3) Download photos last. Individual failures are non-blocking.
    const all=new Set(STATIC_MEDIA);
    if(catalogSnapshot)collectMedia(catalogSnapshot.data,all);
    const media=[...all];
    const mediaResult=await cacheBatch(media,MEDIA_CACHE,(current,total)=>broadcast({type:'OFFLINE_WARM_PROGRESS',current,total,stage:'media'}));

    let verification={ok:false,missingMedia:mediaResult.failed.length,missingMediaUrls:mediaResult.failed,mediaTotal:mediaResult.total};
    if(coreComplete){
      verification=await verifyOfflineSnapshot({complete:true,cacheName:SHELL_CACHE,current:true});
    }

    const complete=Boolean(coreComplete&&verification.ok);
    const missingMediaCount=Number(verification.missingMedia)||mediaResult.failed.length||0;
    const meta={
      complete,
      updatedAt:baseUpdatedAt,
      mediaCount:Math.max(0,mediaResult.total-missingMediaCount),
      mediaTotal:mediaResult.total,
      failedCount:complete?0:Math.max(criticalFailures.length,1),
      failedMediaCount:missingMediaCount,
      failedMediaUrls:Array.isArray(verification.missingMediaUrls)?verification.missingMediaUrls.slice(0,50):mediaResult.failed.slice(0,50),
      catalogApiOk,
      contentVersion:remoteVersion
    };

    if(complete)await writeOfflineMeta(meta);
    else if(!previousStatus.ready)await writeOfflineMeta(meta);
    if(complete)await cleanupOldOfflineCaches();

    await broadcast({
      type:complete?'OFFLINE_READY':'OFFLINE_PARTIAL',
      count:meta.mediaCount,
      total:mediaResult.total,
      failedCount:meta.failedCount,
      missingMediaCount,
      missingMediaUrls:meta.failedMediaUrls.slice(0,50),
      criticalFailures:criticalFailures.slice(0,20),
      previousReady:Boolean(previousStatus.ready),
      contentVersion:remoteVersion,
      updatedAt:meta.updatedAt
    });
    return meta;
  })().finally(()=>{warmPromise=null});
  return warmPromise;
}

async function retryMissingMedia(){
  if(warmPromise)return warmPromise;
  warmPromise=(async()=>{
    const status=await offlineStatus().catch(()=>({ready:false,missingMediaUrls:[]}));
    const urls=Array.isArray(status.missingMediaUrls)?status.missingMediaUrls.filter(Boolean):[];
    if(!status.ready || !urls.length){
      await broadcast({
        type:'OFFLINE_MEDIA_RETRY_DONE',
        retried:0,
        remaining:0,
        missingMediaUrls:[]
      });
      return {retried:0,remaining:0};
    }

    await broadcast({type:'OFFLINE_MEDIA_RETRY_START',total:urls.length});
    const mediaResult=await cacheBatch(urls,MEDIA_CACHE,(current,total)=>broadcast({type:'OFFLINE_MEDIA_RETRY_PROGRESS',current,total}));
    const meta=await readOfflineMeta();
    const verification=await verifyOfflineSnapshot(meta||{cacheName:SHELL_CACHE});
    const remainingUrls=Array.isArray(verification.missingMediaUrls)?verification.missingMediaUrls:[];
    const nextMeta={
      ...(meta||{}),
      complete:true,
      failedMediaCount:remainingUrls.length,
      failedMediaUrls:remainingUrls.slice(0,50),
      mediaTotal:Number(verification.mediaTotal)||Number(meta?.mediaTotal)||0,
      mediaCount:Math.max(0,(Number(verification.mediaTotal)||Number(meta?.mediaTotal)||0)-remainingUrls.length)
    };
    await writeOfflineMeta(nextMeta);
    await broadcast({
      type:'OFFLINE_MEDIA_RETRY_DONE',
      retried:urls.length,
      remaining:remainingUrls.length,
      missingMediaUrls:remainingUrls.slice(0,50),
      mediaCount:nextMeta.mediaCount
    });
    return {retried:urls.length,remaining:remainingUrls.length};
  })().finally(()=>{warmPromise=null});
  return warmPromise;
}

async function checkOfflineUpdate({auto=false,allowInitial=false}={}){
  if(warmPromise)return warmPromise;
  const status=await offlineStatus().catch(()=>({ready:false,contentVersion:''}));
  if(!status.ready){
    if(allowInitial)return warmOffline((await fetchOfflineContentVersion())?.version||'');
    await broadcast({type:'OFFLINE_NEEDS_INITIAL'});
    return {needsInitial:true};
  }

  const remote=await fetchOfflineContentVersion();
  if(!remote){
    await broadcast({type:'OFFLINE_UPDATE_CHECK_FAILED',ready:true});
    return {checked:false};
  }

  const meta=await readOfflineMeta();
  const localVersion=String(meta?.contentVersion||'');
  if(localVersion && localVersion===remote.version){
    await broadcast({
      type:'OFFLINE_UP_TO_DATE',
      updatedAt:meta?.updatedAt||null,
      mediaCount:status.mediaCount||0,
      missingMediaCount:status.missingMediaCount||0,
      missingMediaUrls:Array.isArray(status.missingMediaUrls)?status.missingMediaUrls.slice(0,50):[]
    });
    return {checked:true,changed:false};
  }

  await broadcast({type:'OFFLINE_UPDATE_AVAILABLE'});
  if(auto)return warmOffline(remote.version);
  return {checked:true,changed:true};
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
    await self.clients.claim();
    flushLeadQueue().catch(()=>{});
    const status=await offlineStatus();
    await broadcast(status);
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
  const cached=await cache.match(request,{ignoreSearch:true}) || await matchAny(request);
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
  if(event.data?.type==='CHECK_OFFLINE_UPDATE')event.waitUntil(checkOfflineUpdate({auto:Boolean(event.data?.auto),allowInitial:Boolean(event.data?.allowInitial)}));
  if(event.data?.type==='RETRY_MISSING_MEDIA')event.waitUntil(retryMissingMedia());
  if(event.data?.type==='FLUSH_LEADS')event.waitUntil(flushLeadQueue());
  if(event.data?.type==='GET_OFFLINE_STATUS')event.waitUntil(offlineStatus().then(status=>broadcast(status)));
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
    const freshRequest=new Request(request,{cache:'no-store'});
    const fallback=NAV_FALLBACKS[url.pathname]||'/';
    event.respondWith(networkFirst(freshRequest,SHELL_CACHE,fallback).catch(async()=>await matchAny(request) || await caches.match(fallback,{ignoreSearch:true}) || await caches.match('/')));
    return;
  }
  if(url.pathname==='/api/catalog-images'){
    event.respondWith((async()=>{
      try{
        // Return live data while online, but do not mutate the saved offline snapshot.
        return await fetch(request);
      }catch{
        const cached=await caches.open(API_CACHE).then(cache=>cache.match('/api/catalog-images')) || await matchAny(request);
        return cached||new Response(JSON.stringify({error:'Нет сохранённого каталога'}),{status:503,headers:{'content-type':'application/json'}});
      }
    })());
    return;
  }
  if(url.pathname==='/api/fence-prices'){
    event.respondWith(networkFirst(request,API_CACHE).catch(async()=>{
      const cached=await caches.open(API_CACHE).then(cache=>cache.match(request,{ignoreSearch:true})) || await matchAny(request);
      return cached||new Response(JSON.stringify({fence:{}}),{status:200,headers:{'content-type':'application/json'}});
    }));
    return;
  }
  if(url.pathname==='/api/share-link'){
    event.respondWith(networkFirst(request,API_CACHE).catch(async()=>{
      const cached=await caches.open(API_CACHE).then(cache=>cache.match(request,{ignoreSearch:false})) || await matchAny(request);
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