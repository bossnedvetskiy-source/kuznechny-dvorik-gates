(() => {
  const MEMORY_KEY = 'kuzdvor:delivery-context';
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

  function readData() {
    const node = document.getElementById('deliveryData');
    try {
      const data = JSON.parse(node?.textContent || '{}');
      return {
        destinations: Array.isArray(data.destinations) ? data.destinations : [],
        fallbackRatePerKm: Number(data.fallbackRatePerKm) || 90,
        origin: data.origin || 'Мелеуз'
      };
    } catch {
      return {destinations:[], fallbackRatePerKm:90, origin:'Мелеуз'};
    }
  }

  function readSaved() {
    try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) || 'null'); } catch { return null; }
  }

  function saveResolved(state) {
    if (!['fixed','calculated'].includes(state.kind)) return;
    const city = String(state.shortName || state.resolvedName || state.name || '').trim();
    if (!city) return;
    try {
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify({...state, city, price:Number(state.price)||0}));
    } catch {}
    window.KUZDVOR_CUSTOMER?.set({city});
  }

  function clearSaved() {
    try { sessionStorage.removeItem(MEMORY_KEY); } catch {}
    window.KUZDVOR_CUSTOMER?.set({city:''});
  }

  function createController({input, datalist, result, routeButton, chooser, summary, summaryValue, changeButton, onChange} = {}) {
    const data = readData();
    const destinations = [...data.destinations].sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
    const byKey = new Map(destinations.map(item => [normalize(item.name), item]));
    if (!byKey.has(normalize('Мелеуз'))) byKey.set(normalize('Мелеуз'), {name:'Мелеуз', price:0});
    if (datalist) datalist.innerHTML = destinations.map(item => `<option value="${escapeHTML(item.name)}"></option>`).join('');

    let state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
    let editingOther = false;

    const setResult = (message, kind='') => {
      if (!result) return;
      result.textContent = message;
      result.className = `delivery-result${kind ? ` ${kind}` : ''}`;
    };

    const selectedCityName = () => ['fixed','calculated'].includes(state.kind)
      ? String(state.shortName || state.resolvedName || state.name || input?.value || '').trim()
      : String(input?.value || '').trim();

    const syncUi = () => {
      const resolved = ['fixed','calculated'].includes(state.kind);
      const city = selectedCityName();
      if (chooser) chooser.hidden = resolved || editingOther;
      if (summary) summary.hidden = !resolved;
      if (summaryValue && resolved) summaryValue.textContent = normalize(city) === normalize('Мелеуз') ? 'Мелеуз — бесплатно' : `${city} — доставка учтена в цене`;
      input?.closest('.city-label')?.classList.toggle('is-visible', editingOther && !resolved);
      if (result) result.hidden = resolved;
      if (routeButton) routeButton.hidden = resolved || state.kind === 'empty';
    };

    const emit = () => {
      syncUi();
      onChange?.(state);
    };

    const resolveFixed = known => {
      const city = String(known.name || '').trim();
      if (input) input.value = city;
      state = {kind:'fixed', name:city, resolvedName:city, shortName:city, price:Number(known.price)||0};
      editingOther = false;
      setResult(normalize(city) === normalize('Мелеуз') ? 'Доставка по Мелеузу — бесплатно' : `${city} · доставка учтена в итоговой цене`, 'success');
      saveResolved(state);
      emit();
    };

    const updateFromInput = () => {
      const entered = String(input?.value || '').trim();
      const known = byKey.get(normalize(entered));
      if (known) {
        resolveFixed(known);
        return;
      }
      if (entered.length >= 2) {
        state = {kind:'pending', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) {
          routeButton.hidden = false;
          routeButton.disabled = false;
          routeButton.textContent = 'Рассчитать доставку';
        }
        setResult('Пункта нет в прайсе — рассчитайте доставку по маршруту.', 'pending');
      } else {
        state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) routeButton.hidden = true;
        setResult('Введите населённый пункт.', 'pending');
      }
      emit();
    };

    const calculateRoute = async () => {
      const place = String(input?.value || '').trim();
      if (place.length < 2) {
        editingOther = true;
        updateFromInput();
        input?.focus();
        return;
      }
      if (state.kind === 'confirm') {
        state = {...state, kind:'calculated'};
        editingOther = false;
        setResult(`${state.shortName} · доставка учтена в итоговой цене`, 'success');
        saveResolved(state);
        emit();
        return;
      }
      state = {kind:'loading', name:place, resolvedName:'', shortName:'', price:null};
      if (routeButton) { routeButton.disabled = true; routeButton.textContent = 'Считаем…'; }
      setResult('Ищем населённый пункт и автомобильный маршрут…', 'pending');
      emit();
      try {
        const response = await fetch(`/api/delivery?place=${encodeURIComponent(place)}`, {headers:{accept:'application/json'}});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Не удалось рассчитать доставку');
        if (String(input?.value || '').trim() !== place) return;
        const shortName = payload.shortName || payload.resolvedName || place;
        state = {kind:'confirm', name:place, resolvedName:payload.resolvedName || shortName, shortName, price:Number(payload.price)||0};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'Да, это нужный пункт'; }
        setResult(`Найдено: ${shortName}. Подтвердите населённый пункт.`, 'pending');
      } catch (error) {
        state = {kind:'error', name:place, resolvedName:'', shortName:'', price:null};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'Повторить расчёт'; }
        setResult(`${error?.message || 'Не удалось рассчитать доставку.'} Можно отправить заявку — стоимость уточним вручную.`, 'error');
      }
      emit();
    };

    const chooseMeleuz = () => resolveFixed(byKey.get(normalize('Мелеуз')) || {name:'Мелеуз',price:0});
    const chooseOther = () => {
      clearSaved();
      editingOther = true;
      state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
      if (input) input.value = '';
      setResult('Введите населённый пункт.', 'pending');
      emit();
      setTimeout(() => input?.focus(), 40);
    };
    const edit = () => {
      clearSaved();
      editingOther = false;
      state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
      if (input) input.value = '';
      setResult('Выберите, где устанавливаем.', 'pending');
      emit();
    };

    chooser?.querySelector('[data-delivery-choice="meleuz"]')?.addEventListener('click', chooseMeleuz);
    chooser?.querySelector('[data-delivery-choice="other"]')?.addEventListener('click', chooseOther);
    changeButton?.addEventListener('click', edit);
    input?.addEventListener('input', updateFromInput);
    input?.addEventListener('change', updateFromInput);
    routeButton?.addEventListener('click', calculateRoute);

    const restore = () => {
      const customerCity = window.KUZDVOR_CUSTOMER?.read()?.city || '';
      const saved = readSaved();
      const city = String(customerCity || saved?.city || '').trim();
      if (!city) { emit(); return false; }
      const known = byKey.get(normalize(city));
      if (known) { resolveFixed(known); return true; }
      if (saved && normalize(saved.city) === normalize(city) && saved.kind === 'calculated' && Number.isFinite(Number(saved.price))) {
        if (input) input.value = city;
        state = {kind:'calculated', name:saved.name || city, resolvedName:saved.resolvedName || city, shortName:saved.shortName || city, price:Number(saved.price)||0};
        editingOther = false;
        saveResolved(state);
        emit();
        return true;
      }
      if (input) input.value = city;
      editingOther = true;
      updateFromInput();
      return false;
    };

    const line = () => {
      const city = selectedCityName();
      const resolved = ['fixed','calculated'].includes(state.kind);
      return {name:'Населённый пункт', value:resolved ? Number(state.price)||0 : null, display:city || 'Не выбран', resolved};
    };

    restore();
    return {getState:()=>({...state}), selectedCityName, line, updateFromInput, restore, chooseMeleuz, chooseOther};
  }

  window.KUZDVOR_DELIVERY = {createController, normalize};
})();
