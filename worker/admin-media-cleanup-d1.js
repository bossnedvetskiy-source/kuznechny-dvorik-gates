async function referencedCatalogMediaKeys(env) {
  const galleries=await allGalleries(env,true);
  const keys=new Set();
  for(const gallery of Object.values(galleries||{})){
    for(const url of gallery?.photos||[]){const key=mediaKeyFromUrl(url);if(key)keys.add(key);}
    for(const url of Object.values(gallery?.colorPhotos||{})){const key=mediaKeyFromUrl(url);if(key)keys.add(key);}
  }
  return keys;
}

async function cleanupUnusedCatalogMedia(env) {
  const referenced=await referencedCatalogMediaKeys(env);
  let removed=0;
  const removedKeys=[];
  if(env.DB){
    await ensureCatalogMediaTable(env);
    const result=await env.DB.prepare("SELECT key FROM catalog_media WHERE created_at < datetime('now','-1 day')").all();
    for(const row of result.results||[]){
      const key=String(row.key||'');
      if(!key||referenced.has(key))continue;
      await env.DB.prepare('DELETE FROM catalog_media WHERE key = ?').bind(key).run();
      removed+=1;removedKeys.push(key);
    }
  }
  if(env.BUCKET){
    let cursor=undefined;
    do{
      const listed=await env.BUCKET.list({prefix:'catalog/',cursor,limit:1000});
      for(const object of listed.objects||[]){
        const key=String(object.key||'');
        if(!key||referenced.has(key))continue;
        const uploadedAt=object.uploaded ? new Date(object.uploaded).getTime() : NaN;
        if(!Number.isFinite(uploadedAt) || Date.now()-uploadedAt < 24*60*60*1000)continue;
        await env.BUCKET.delete(key);removed+=1;removedKeys.push(key);
      }
      cursor=listed.truncated?listed.cursor:undefined;
    }while(cursor);
  }
  return {removed,removedKeys:removedKeys.slice(0,100),referenced:referenced.size};
}

const __handleAdminApiWithoutMediaCleanup=handleAdminApi;
handleAdminApi=async function handleAdminApiWithMediaCleanup(request,env,url){
  if(url.pathname!=='/api/admin/media-cleanup')return __handleAdminApiWithoutMediaCleanup(request,env,url);
  if(request.method!=='POST')return json({error:'Метод не поддерживается'},405);
  if(!sameOrigin(request,url))return json({error:'Недопустимый источник запроса'},403);
  if(!await hasAdminSession(request,env))return json({error:'Требуется вход'},401);
  try{return json({ok:true,...await cleanupUnusedCatalogMedia(env)});}catch(error){return json({error:'Не удалось очистить хранилище: '+errorMessage(error)},500);}
};
