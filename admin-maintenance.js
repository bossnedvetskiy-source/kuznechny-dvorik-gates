(() => {
  const photosTab=document.getElementById('photosTab');
  const actionBar=photosTab?.querySelector('.action-bar');
  if(!actionBar)return;
  const left=actionBar.querySelector(':scope > div');
  if(!left)return;
  const button=document.createElement('button');button.type='button';button.className='reset-button media-cleanup-button';button.textContent='Очистить неиспользуемые фото';button.title='Удалить только неиспользуемые файлы старше суток';
  const style=document.createElement('style');style.textContent='.media-cleanup-button{margin-top:3px;color:#766a5c!important;text-decoration:underline;text-underline-offset:2px}';document.head.append(style);
  button.addEventListener('click',async()=>{if(!confirm('Удалить фотографии, которые не используются ни в одной карточке и были загружены больше суток назад?'))return;button.disabled=true;const old=button.textContent;button.textContent='Проверяем…';try{const data=await api('/api/admin/media-cleanup',{method:'POST'});showToast(data.removed?`Удалено неиспользуемых файлов: ${data.removed}`:'Неиспользуемых фотографий не найдено');}catch(error){showToast(error.message,true);}finally{button.disabled=false;button.textContent=old;}});
  left.append(button);
})();
