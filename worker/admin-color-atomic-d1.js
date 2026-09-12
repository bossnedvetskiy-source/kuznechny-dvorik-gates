const __handleAdminApiWithoutAtomicColorUploads = handleAdminApi;
handleAdminApi = async function handleAdminApiWithAtomicColorUploads(request, env, url) {
  const uploadPrefix='/api/admin/catalog-color-upload/';
  const slotPrefix='/api/admin/catalog-color-slot/';
  const pathname=url.pathname;
  if (!pathname.startsWith(uploadPrefix) && !pathname.startsWith(slotPrefix)) {
    return __handleAdminApiWithoutAtomicColorUploads(request, env, url);
  }
  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({error:'Недопустимый источник запроса'},403);
  if (!await hasAdminSession(request, env)) return json({error:'Требуется вход'},401);

  const prefix=pathname.startsWith(uploadPrefix)?uploadPrefix:slotPrefix;
  let remainder;
  try { remainder=decodeURIComponent(pathname.slice(prefix.length)); } catch { return json({error:'Некорректный адрес'},400); }
  const slash=remainder.lastIndexOf('/');
  if (slash<=0) return json({error:'Некорректный адрес'},400);
  const article=remainder.slice(0,slash);
  const colorId=remainder.slice(slash+1);
  if(!ALLOWED_ARTICLES.has(article) || !CATALOG_COLOR_ID_SET.has(colorId)) return json({error:'Модель или цвет не найдены'},404);

  if (pathname.startsWith(uploadPrefix)) {
    if (request.method !== 'POST') return json({error:'Метод не поддерживается'},405);
    const storedResponse=await storeCatalogMedia(request,env,article);
    if(!storedResponse.ok)return storedResponse;
    const payload=await storedResponse.json();
    const uploadedUrl=payload?.photo?.url;
    if(!uploadedUrl)return json({error:'Не удалось сохранить фотографию'},500);
    try {
      const all=await loadCatalogColorPhotos(env);
      const next={...(all[article]||{}),[colorId]:uploadedUrl};
      const colorPhotos=await saveCatalogColorPhotos(env,article,next);
      return json({ok:true,colorId,url:uploadedUrl,colorPhotos},201);
    } catch(error) {
      await deleteCatalogMediaObject(env,mediaKeyFromUrl(uploadedUrl));
      return json({error:'Не удалось привязать фотографию к цвету: '+errorMessage(error)},500);
    }
  }

  if (request.method === 'DELETE') {
    const all=await loadCatalogColorPhotos(env);
    const next={...(all[article]||{})};
    delete next[colorId];
    const colorPhotos=await saveCatalogColorPhotos(env,article,next);
    return json({ok:true,colorId,colorPhotos});
  }
  return json({error:'Метод не поддерживается'},405);
};
