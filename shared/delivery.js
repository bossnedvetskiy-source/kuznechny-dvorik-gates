(() => {
  const MEMORY_KEY = 'kuzdvor:delivery-context';
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

  function readData() {
    const node = document.getElementById('deliveryData');
    const site = window.SITE_SETTINGS || {};
    try {
      const data = JSON.parse(node?.textContent || '{}');
      const referenceRatePerKm = Number(data.fallbackRatePerKm) || 90;
      return {
        destinations: Array.isArray(data.destinations) ? data.destinations : [],
        referenceRatePerKm,
        fallbackRatePerKm: Number(site.deliveryRate) || referenceRatePerKm,
        serviceAreaKm: Number(site.serviceAreaKm) || 150,
        origin: data.origin || 'Мелеуз'
      };
    } catch {
      return {
        destinations:[], referenceRatePerKm:90,
        fallbackRatePerKm:Number(site.deliveryRate)||90,
        serviceAreaKm:Number(site.serviceAreaKm)||150,
        origin:'Мелеуз'
      };
    }
  }

  function readSaved() {
    try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) || 'null'); } catch { return null; }
  }

  function saveSelected(state) {
    if (!['fixed','calculated','out-of-area'].includes(state.kind)) return;
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

    const selectedCityName = () => ['fixed','calculated','out-of-area'].includes(state.kind)
      ? String(state.shortName || state.resolvedName || state.name || input?.value || '').trim()
      : String(input?.value || '').trim();

    const syncUi = () => {
      const resolved = ['fixed','calculated'].includes(state.kind);
      const selected = resolved || state.kind === 'out-of-area';
      const city = selectedCityName();
      if (chooser) chooser.hidden = selected || editingOther;
      if (summary) summary.hidden = !selected;
      if (summaryValue && selected) {
        summaryValue.textContent = state.kind === 'out-of-area'
          ? `${city} — доставка рассчитывается индивидуально`
          : normalize(city) === normalize('Мелеуз')
            ? 'Мелеуз — бесплатно'
            : `${city} — доставка учтена в итоговой сумме`;
      }
      input?.closest('.city-label')?.classList.toggle('is-visible', editingOther && !selected);
      if (result) result.hidden = selected;
      if (routeButton) routeButton.hidden = selected || state.kind === 'empty';
    };

    const emit = () => {
      syncUi();
      onChange?.(state);
    };

    const fixedDistanceEstimate = known => {
      if (normalize(known?.name) === normalize('Мелеуз')) return 0;
      const price = Math.max(0, Number(known?.price) || 0);
      return Math.ceil(price / Math.max(1, data.referenceRatePerKm));
    };

    const resolveFixed = known => {
      const city = String(known.name || '').trim();
      const price = Number(known.price) || 0;
      const distanceKm = fixedDistanceEstimate(known);
      const outOfArea = distanceKm > data.serviceAreaKm;
      if (input) input.value = city;
      state = outOfArea
        ? {kind:'out-of-area', name:city, resolvedName:city, shortName:city, price:null, distanceKm, serviceAreaKm:data.serviceAreaKm, outOfArea:true}
        : {kind:'fixed', name:city, resolvedName:city, shortName:city, price, distanceKm, serviceAreaKm:data.serviceAreaKm, outOfArea:false};
      editingOther = false;
      setResult(outOfArea
        ? `Место установки дальше стандартной зоны выезда ${data.serviceAreaKm} км. Стоимость доставки рассчитаем индивидуально.`
        : normalize(city) === normalize('Мелеуз')
          ? 'Доставка по Мелеузу — бесплатно'
          : `${city} · доставка учтена в итоговой сумме`, outOfArea ? 'pending' : 'success');
      saveSelected(state);
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
        setResult('Для этого населённого пункта нет готовой стоимости доставки. Рассчитайте её по автомобильному маршруту.', 'pending');
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
        setResult(`${state.shortName} · доставка учтена в итоговой сумме`, 'success');
        saveSelected(state);
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
        if (payload.outOfArea) {
          state = {
            kind:'out-of-area', name:place, resolvedName:payload.resolvedName || shortName, shortName,
            price:null, distanceKm:Number(payload.distanceKm)||null,
            serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm, outOfArea:true
          };
          editingOther = false;
          if (routeButton) { routeButton.hidden = true; routeButton.disabled = false; routeButton.textContent = 'Рассчитать доставку'; }
          setResult(`Расстояние около ${state.distanceKm || '—'} км — дальше стандартной зоны выезда ${state.serviceAreaKm} км. Стоимость доставки рассчитаем индивидуально.`, 'pending');
          saveSelected(state);
          emit();
          return;
        }
        state = {kind:'confirm', name:place, resolvedName:payload.resolvedName || shortName, shortName, price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null, serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm};
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
      setResult('Выберите место установки.', 'pending');
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
      if (saved && normalize(saved.city) === normalize(city) && ['calculated','out-of-area'].includes(saved.kind)) {
        if (input) input.value = city;
        state = saved.kind === 'out-of-area'
          ? {kind:'out-of-area', name:saved.name || city, resolvedName:saved.resolvedName || city, shortName:saved.shortName || city, price:null, distanceKm:Number(saved.distanceKm)||null, serviceAreaKm:Number(saved.serviceAreaKm)||data.serviceAreaKm, outOfArea:true}
          : {kind:'calculated', name:saved.name || city, resolvedName:saved.resolvedName || city, shortName:saved.shortName || city, price:Number(saved.price)||0, distanceKm:Number(saved.distanceKm)||null, serviceAreaKm:Number(saved.serviceAreaKm)||data.serviceAreaKm};
        editingOther = false;
        saveSelected(state);
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
      const outOfArea = state.kind === 'out-of-area';
      return {
        name:'Место установки',
        value:resolved ? Number(state.price)||0 : null,
        display:outOfArea ? `${city} · доставка индивидуально` : city || 'Не выбрано',
        resolved,
        outOfArea
      };
    };

    restore();
    return {getState:()=>({...state}), selectedCityName, line, updateFromInput, restore, chooseMeleuz, chooseOther};
  }

  window.KUZDVOR_DELIVERY = {createController, normalize};
})();