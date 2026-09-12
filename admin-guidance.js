(() => {
  const pricesTab=document.getElementById('pricesTab');
  if(pricesTab){
    const title=pricesTab.querySelector('.page-title');
    if(title){
      const note=document.createElement('div');
      note.className='admin-guidance-note';
      note.innerHTML='<b>Важно про цену модели.</b> Это базовая цена стандартного размера. Она теперь является точкой привязки формулы: если увеличить её на 5 000 ₽, расчёт любого другого размера этой модели также увеличится на 5 000 ₽. Монтаж и столбы считаются отдельно.';
      title.after(note);
    }
  }

  const photosTab=document.getElementById('photosTab');
  const actionBar=photosTab?.querySelector('.action-bar');
  if(actionBar){
    const maintenance=document.createElement('button');
    maintenance.type='button';maintenance.className='reset-button media-cleanup-button';maintenance.textContent='Очистить неиспользуемые фото';
    maintenance.addEventListener('click',async()=>{
      if(!confirm('Удалить фотографии, которые не используются ни в одной карточке и были загружены больше суток назад?'))return;
      maintenance.disabled=true;const old=maintenance.textContent;maintenance.textContent='Проверяем…';
      try{const data=await api('/api/admin/media-cleanup',{method:'POST'});showToast(data.removed?`Удалено неиспользуемых файлов: ${data.removed}`:'Неиспользуемых фотографий не найдено');}
      catch(error){showToast(error.message,true);}finally{maintenance.disabled=false;maintenance.textContent=old;}
    });
    const left=actionBar.querySelector(':scope > div');
    if(left)left.append(maintenance);
  }

  const style=document.createElement('style');
  style.textContent=`.admin-guidance-note{margin:-16px 0 18px;padding:12px 14px;border:1px solid #e3c991;border-radius:12px;background:#fff8e9;color:#67532d;font-size:10.5px;line-height:1.55}.admin-guidance-note b{color:#4f3b18}.media-cleanup-button{margin-top:3px;color:#766a5c!important;text-decoration:underline;text-underline-offset:2px}`;
  document.head.append(style);
})();
