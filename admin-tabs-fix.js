(() => {
  const nav=document.querySelector('.admin-tabs');
  if(!nav)return;
  nav.addEventListener('click',event=>{
    const button=event.target.closest('.admin-tab');
    if(!button)return;
    const name=button.dataset.adminTab;
    queueMicrotask(()=>{
      const target=document.getElementById(`${name}Tab`);
      if(!target)return;
      document.querySelectorAll('.admin-tab-panel').forEach(panel=>{panel.hidden=panel!==target;});
      nav.querySelectorAll('.admin-tab').forEach(item=>item.classList.toggle('active',item===button));
      if((name==='prices'||name==='catalog')&&typeof loadPriceSettings==='function')loadPriceSettings();
    });
  });
})();
