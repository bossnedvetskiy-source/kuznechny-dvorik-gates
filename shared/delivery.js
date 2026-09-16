(() => {
  const MEMORY_KEY = 'kuzdvor:delivery-context';
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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

    if (input) {
      input.placeholder = 'Начните вводить населённый пункт';
      input.setAttribute('enterkeyhint','search');
      const label = input.closest('.city-label');
      if (label && !label.querySelector('.delivery-input-help')) {
        const help = document.createElement('small');
        help.className = 'delivery-input-help';
        help.id = 'cityInputHelp';
        help.textContent = 'Например: Салават, Ишимбай, Стерлитамак. Нет в списке — введите название полностью.';
        input.insertAdjacentElement('afterend', help);
        input.setAttribute('aria-describedby','cityInputHelp');
      }
      if (!document.getElementById('deliveryUxStyles')) {
        const style = document.createElement('style');
        style.id = 'deliveryUxStyles';
        style.textContent = `
          #cityInput::-webkit-calendar-picker-indicator{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          #cityInput::-webkit-list-button{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          .calc-form .city-label:not(.is-visible){display:none!important}
          .calc-form .city-label.is-visible{display:grid!important}
          .delivery-input-help{display:block;color:rgba(255,255,255,.58);font-size:10px;line-height:1.45;margin-top:-1px}
          @media(max-width:620px){.delivery-input-help{font-size:11px;line-height:1.45}}
        `;
        document.head.append(style);
      }
    }
    const meleuzButton = chooser?.querySelector('[data-delivery-choice="meleuz"]');
    if (meleuzButton) meleuzButton.textContent = 'Мелеуз — бесплатно';

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

    const syncManualDeliveryMessaging = () => {
      if (!['error','out-of-area'].includes(state.kind)) return;
      queueMicrotask(() => {
        const suffix = state.kind === 'out-of-area' ? 'доставка индивидуально' : 'доставка уточняется';
        [document.getElementById('estimateTotal'), document.getElementById('mobilePriceTotal')].forEach(node => {
          const current = String(node?.textContent || '').trim();
          if (node && current && !current.includes('доставка')) node.textContent = `${current} + ${suffix}`;
        });
        const cta = document.getElementById('mobilePrimaryCta');
        const calculator = document.getElementById('calculator');
        const leadOpen = document.body.classList.contains('mobile-lead-open');
        if (cta && calculator && !calculator.hidden && !leadOpen) {
          cta.textContent = state.kind === 'out-of-area'
            ? 'Заказать бесплатный замер · доставка индивидуально'
            : 'Заказать бесплатный замер · доставка уточняется';
        }
      });
    };

    const syncUi = () => {
      const resolved = ['fixed','calculated'].includes(state.kind);
      const selected = resolved || state.kind === 'out-of-area';
      const city = selectedCityName();
      if (chooser) chooser.hidden = selected || editingOther;
      if (summary) summary.hidden = !selected;
      if (summaryValue && selected) {
        summaryValue.textContent = state.kind === 'out-of-area'
          ? `${city} · доставка индивидуально`
          : normalize(city) === normalize('Мелеуз')
            ? 'Мелеуз · бесплатно'
            : `${city} · доставка учтена`;
      }
      input?.closest('.city-label')?.classList.toggle('is-visible', editingOther && !selected);
      if (result) result.hidden = selected || state.kind === 'empty';
      if (routeButton) routeButton.hidden = selected || state.kind === 'empty';
    };

    const emit = () => {
      syncUi();
      onChange?.(state);
      syncManualDeliveryMessaging();
    };

    const makeRequestError = (message, technical = false) => Object.assign(new Error(message), {technical});

    const requestDelivery = async place => {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(`/api/delivery?place=${encodeURIComponent(place)}`, {headers:{accept:'application/json'}});
          const raw = await response.text();
          let payload = null;
          try { payload = raw ? JSON.parse(raw) : null; } catch {}
          if (!payload || typeof payload !== 'object') {
            throw makeRequestError('Сервис расчёта доставки временно недоступен', true);
          }
          if (!response.ok) {
            const technical = response.status >= 500 || response.status === 429;
            throw makeRequestError(payload.error || 'Не удалось рассчитать доставку', technical);
          }
          return payload;
        } catch (error) {
          lastError = error?.technical === true ? error : error instanceof TypeError
            ? makeRequestError('Сервис расчёта доставки временно недоступен', true)
            : error;
          if (attempt === 0 && lastError?.technical === true) {
            await wait(350);
            if (String(input?.value || '').trim() !== place) throw makeRequestError('Расчёт отменён', false);
            continue;
          }
          throw lastError;
        }
      }
      throw lastError || makeRequestError('Не удалось рассчитать доставку', true);
    };

    const resolveFixed = known => {
      const city = String(known.name || '').trim();
      const price = Number(known.price) || 0;
      if (input) input.value = city;
      state = {kind:'fixed', name:city, resolvedName:city, shortName:city, price, distanceKm:null, serviceAreaKm:data.serviceAreaKm, outOfArea:false};
      editingOther = false;
      setResult(normalize(city) === normalize('Мелеуз')
        ? 'Доставка по Мелеузу — бесплатно'
        : `${city} · доставка учтена в итоговой сумме`, 'success');
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
        setResult('Не нашли точное совпадение? Введите название полностью и нажмите «Рассчитать доставку».', 'pending');
      } else {
        state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) routeButton.hidden = true;
        setResult('', 'pending');
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
        const payload = await requestDelivery(place);
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
        if (String(input?.value || '').trim() !== place) return;
        state = {kind:'error', name:place, resolvedName:'', shortName:'', price:null};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'Повторить расчёт'; }
        const message = error?.technical === true
          ? 'Не удалось автоматически рассчитать доставку.'
          : String(error?.message || 'Не удалось рассчитать доставку.');
        setResult(`${message} Оставьте заявку — стоимость уточним вручную.`, 'pending');
      }
      emit();
    };

    const chooseMeleuz = () => resolveFixed(byKey.get(normalize('Мелеуз')) || {name:'Мелеуз',price:0});
    const chooseOther = () => {
      clearSaved();
      editingOther = true;
      state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
      if (input) input.value = '';
      setResult('', 'pending');
      emit();
      setTimeout(() => input?.focus(), 40);
    };
    const edit = () => {
      const previousCity = selectedCityName();
      clearSaved();
      editingOther = true;
      state = {kind:'empty', name:previousCity, resolvedName:'', shortName:'', price:null};
      if (input) input.value = previousCity;
      setResult('', 'pending');
      emit();
      setTimeout(() => {
        input?.focus();
        input?.select?.();
      }, 40);
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
      const failed = state.kind === 'error';
      return {
        name:'Место установки',
        value:resolved ? Number(state.price)||0 : null,
        display:outOfArea
          ? `${city} · доставка индивидуально`
          : failed
            ? `${city || 'Место установки'} · доставка уточняется`
            : city || 'Не выбрано',
        resolved,
        outOfArea
      };
    };

    restore();
    return {getState:()=>({...state}), selectedCityName, line, updateFromInput, restore, chooseMeleuz, chooseOther};
  }

  window.KUZDVOR_DELIVERY = {createController, normalize};
})();