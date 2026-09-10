(() => {
  const phoneDigits = value => String(value || '').replace(/\D/g,'');

  function validate({phone, city, consent} = {}) {
    const digits = phoneDigits(phone);
    if (digits.length < 10 || digits.length > 11) return {ok:false, field:'phone', message:'Укажите номер телефона'};
    if (!String(city || '').trim()) return {ok:false, field:'city', message:'Укажите место установки'};
    if (!consent) return {ok:false, field:'consent', message:'Подтвердите согласие на обработку персональных данных'};
    return {ok:true};
  }

  async function submit(payload) {
    const response = await fetch('/api/leads', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      keepalive:true
    });
    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || 'Не удалось отправить заявку');
    }
    return response.json().catch(()=>({ok:true}));
  }

  window.KUZDVOR_LEADS = {validate, submit, phoneDigits};
})();
