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

    let placeChoices = null;
    let searchShell = null;
    if (input) {
      input.placeholder = 'Начните вводить населённый пункт';
      input.setAttribute('enterkeyhint','search');
      const label = input.closest('.city-label');
      if (label && !label.querySelector('.delivery-input-help')) {
        const help = document.createElement('small');
        help.className = 'delivery-input-help';
        help.id = `${input.id || 'cityInput'}Help`;
        help.textContent = 'Например: Салават, Ишимбай, Покровка. Если названий несколько — покажем районы для выбора.';
        input.insertAdjacentElement('afterend', help);
        input.setAttribute('aria-describedby', help.id);
      }
      if (label) {
        searchShell = document.createElement('div');
        searchShell.className = 'delivery-search-shell';
        label.parentNode?.insertBefore(searchShell, label);
        searchShell.append(label);

        placeChoices = document.createElement('div');
        placeChoices.className = 'delivery-place-choices';
        placeChoices.hidden = true;
        placeChoices.setAttribute('aria-live','polite');
        placeChoices.setAttribute('role','listbox');
        searchShell.append(placeChoices);
      }
      if (!document.getElementById('deliveryUxStyles')) {
        const style = document.createElement('style');
        style.id = 'deliveryUxStyles';
        style.textContent = `
          #cityInput::-webkit-calendar-picker-indicator,#installationLocationInput::-webkit-calendar-picker-indicator{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          #cityInput::-webkit-list-button,#installationLocationInput::-webkit-list-button{display:none!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important}
          .delivery-search-shell{position:relative;display:grid;min-width:0}
          .calc-form .city-label:not(.is-visible){display:none!important}
          .calc-form .city-label.is-visible{display:grid!important}
          .calc-form .city-label.is-visible.is-place-confirming{display:none!important}
          .delivery-input-help{display:block;color:rgba(255,255,255,.58);font-size:10px;line-height:1.45;margin-top:-1px}
          .delivery-place-choices{display:grid;gap:8px;margin:8px 0 2px;padding:12px;border:1px solid rgba(212,175,55,.42);border-radius:14px;background:rgba(16,16,16,.98)}
          .delivery-place-choices.is-dropdown{position:static;max-height:196px;overflow-y:auto;overscroll-behavior:contain;box-shadow:none;border-color:rgba(255,255,255,.13);background:rgba(14,15,17,.96)}
          .delivery-place-choices[hidden]{display:none!important}
          .delivery-place-choices__title{font-size:14px;font-weight:800;line-height:1.25;color:#fff}
          .delivery-place-choices__hint{font-size:12px;line-height:1.35;color:rgba(255,255,255,.68);margin-top:-3px}
          .delivery-place-choices__button{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:3px;width:100%;text-align:left;padding:12px 13px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.055);color:#fff;cursor:pointer;touch-action:manipulation}
          .delivery-place-choices__button:hover,.delivery-place-choices__button:focus-visible{border-color:rgba(212,175,55,.8);background:rgba(212,175,55,.10);outline:none}
          .delivery-place-choices__button.is-selected{border-color:#d4af37;background:rgba(212,175,55,.16);box-shadow:inset 0 0 0 1px rgba(212,175,55,.18)}
          .delivery-place-choices.is-confirming{grid-template-columns:minmax(0,1fr) auto;align-items:stretch}
          .delivery-place-choices.is-confirming{position:static;max-height:none;overflow:visible;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
          .delivery-place-choices.is-confirming .delivery-place-choices__title,.delivery-place-choices.is-confirming .delivery-place-choices__hint,.delivery-place-choices.is-confirming .delivery-place-choices__button:not(.is-selected){display:none!important}
          .delivery-place-choices__confirm-actions{display:grid;align-content:stretch;min-width:92px}
          .delivery-place-choices__edit{min-width:92px;border:1px solid rgba(212,175,55,.55);border-radius:10px;background:rgba(212,175,55,.10);color:#e1b55a;font:900 11px/1.1 Manrope,Arial,sans-serif;cursor:pointer}
          .delivery-place-choices__button:active{transform:translateY(1px)}
          .delivery-place-choices__name{grid-column:1;font-size:14px;font-weight:800;line-height:1.25}
          .delivery-place-choices__area{grid-column:1;font-size:12px;line-height:1.35;color:rgba(255,255,255,.68)}
          .delivery-place-choices__action{grid-column:2;grid-row:1 / span 2;align-self:center;white-space:nowrap;color:#e2b75e;font-size:12px;font-weight:900}
          .delivery-place-choices__button.is-selected .delivery-place-choices__action{display:none}
          .delivery-place-choices__button.is-selected .delivery-place-choices__name::before{content:"✓ ";color:#e2b75e}
          .calc-form .city-label.is-visible.is-place-confirming{display:none!important}
          @media(max-width:620px){
            .delivery-input-help{font-size:9.5px;line-height:1.35}
            .delivery-place-choices{margin:6px 0 1px;padding:8px;gap:6px;border-radius:11px;background:rgba(12,13,15,.98)}
            .delivery-place-choices.is-dropdown{position:static;max-height:184px;box-shadow:none}
            .delivery-place-choices__title{font-size:11px}
            .delivery-place-choices__hint{font-size:9.5px;margin-top:-1px}
            .delivery-place-choices__button{min-height:46px;padding:7px 9px;border-radius:9px;column-gap:8px}
            .delivery-place-choices__name{font-size:12px}
            .delivery-place-choices__area{font-size:9.5px}
            .delivery-place-choices__action{font-size:10.5px}
            .delivery-place-choices.is-single .delivery-place-choices__title,.delivery-place-choices.is-single .delivery-place-choices__hint{display:none!important}
            .delivery-place-choices.is-confirming{margin:4px 0 0;padding:0;gap:6px}
            .delivery-place-choices.is-confirming .delivery-place-choices__button.is-selected{min-height:44px;padding:6px 8px}
            .delivery-place-choices__confirm-actions{min-width:82px}
            .delivery-place-choices__edit{min-width:82px;min-height:44px;border-radius:9px;font-size:10px}
          }
        `;
        document.head.append(style);
      }
    }
    const meleuzButton = chooser?.querySelector('[data-delivery-choice="meleuz"]');
    if (meleuzButton) meleuzButton.textContent = 'Мелеуз — бесплатно';

    let state = {kind:'empty', name:'', resolvedName:'', shortName:'', price:null};
    let editingOther = false;
    let searchTimer = null;
    let searchSequence = 0;
    let pendingPlaceChoice = null;

    const setResult = (message, kind='') => {
      if (!result) return;
      result.textContent = message;
      result.className = `delivery-result${kind ? ` ${kind}` : ''}`;
    };

    const clearPlaceChoices = () => {
      if (!placeChoices) return;
      placeChoices.hidden = true;
      placeChoices.classList.remove('is-dropdown','is-confirming','is-single');
      input?.closest('.city-label')?.classList.remove('is-place-confirming','is-place-results');
      placeChoices.replaceChildren();
    };

    const cancelPlaceSearch = () => {
      searchSequence += 1;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
      pendingPlaceChoice = null;
      clearPlaceChoices();
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
      const choosing = state.kind === 'choosing';
      const confirmingPlace = state.kind === 'place-confirm';
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
      if (result) result.hidden = selected || state.kind === 'empty' || choosing || confirmingPlace;
      if (routeButton) routeButton.hidden = selected || state.kind === 'empty' || choosing || confirmingPlace;
      if (placeChoices && !choosing && !confirmingPlace) placeChoices.hidden = true;
    };

    const emit = () => {
      syncUi();
      onChange?.(state);
      syncManualDeliveryMessaging();
    };

    const makeRequestError = (message, technical = false) => Object.assign(new Error(message), {technical});

    const requestDelivery = async (place, expectedInputValue = String(input?.value || '').trim()) => {
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
            if (String(input?.value || '').trim() !== expectedInputValue) throw makeRequestError('Расчёт отменён', false);
            continue;
          }
          throw lastError;
        }
      }
      throw lastError || makeRequestError('Не удалось рассчитать доставку', true);
    };

    const requestPlaceChoices = async place => {
      const response = await fetch(`/api/delivery-search?place=${encodeURIComponent(place)}`, {headers:{accept:'application/json'}});
      const payload = response.ok ? await response.json().catch(() => null) : null;
      const remoteChoices = Array.isArray(payload?.choices) ? payload.choices : [];

      const queryKey = normalize(place);
      const rawOrigin = data.origin;
      const originName = String(
        rawOrigin && typeof rawOrigin === 'object'
          ? rawOrigin.name || 'Мелеуз'
          : rawOrigin || 'Мелеуз'
      ).trim();
      const originKey = normalize(originName);
      const localChoices = [];
      if (queryKey && originKey.startsWith(queryKey)) {
        localChoices.push({
          name:originName,
          label:originName,
          secondary:'Республика Башкортостан',
          query:`${originName}, Республика Башкортостан, Россия`
        });
      }

      const seen = new Set();
      return [...localChoices, ...remoteChoices].filter(choice => {
        const key = `${normalize(choice.name)}|${normalize(choice.secondary)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);
    };

    const resolveFixed = known => {
      cancelPlaceSearch();
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

    const renderPlaceChoices = (entered, choices) => {
      if (!placeChoices || !choices.length) return false;
      const sameName = choices.length > 1 && choices.every(choice => normalize(choice.name) === normalize(choices[0]?.name));
      input?.closest('.city-label')?.classList.remove('is-place-confirming');
      input?.closest('.city-label')?.classList.add('is-place-results');
      placeChoices.classList.remove('is-confirming');
      placeChoices.classList.add('is-dropdown');
      placeChoices.classList.toggle('is-single', choices.length === 1);
      placeChoices.replaceChildren();

      const title = document.createElement('div');
      title.className = 'delivery-place-choices__title';
      title.textContent = sameName ? 'Выберите район' : 'Выберите населённый пункт';
      placeChoices.append(title);

      const hint = document.createElement('div');
      hint.className = 'delivery-place-choices__hint';
      hint.textContent = sameName ? '' : 'Нажмите на подходящий вариант:';
      if (hint.textContent) placeChoices.append(hint);

      choices.forEach(choice => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'delivery-place-choices__button';

        const name = document.createElement('span');
        name.className = 'delivery-place-choices__name';
        name.textContent = String(choice.name || entered).trim();
        button.append(name);

        const area = String(choice.secondary || '').trim();
        if (area) {
          const secondary = document.createElement('span');
          secondary.className = 'delivery-place-choices__area';
          secondary.textContent = area;
          button.append(secondary);
        }

        const action = document.createElement('span');
        action.className = 'delivery-place-choices__action';
        action.textContent = 'Выбрать →';
        button.append(action);

        button.addEventListener('click', () => {
          const label = String(choice.label || choice.name || entered).trim();
          const query = String(choice.query || label).trim();
          searchSequence += 1;
          if (searchTimer) clearTimeout(searchTimer);
          searchTimer = null;
          const sameLocalityCount = choices.filter(item => normalize(item.name) === normalize(choice.name)).length;
          const knownDestination = byKey.get(normalize(choice.name));
          pendingPlaceChoice = {
            ...choice, label, query,
            fixedName: knownDestination && sameLocalityCount === 1 ? String(knownDestination.name || choice.name || '').trim() : ''
          };
          if (input) input.value = label;
          placeChoices.querySelectorAll('.delivery-place-choices__button').forEach(item => item.classList.toggle('is-selected', item === button));
          placeChoices.classList.remove('is-dropdown');
          placeChoices.classList.add('is-confirming');
          input?.closest('.city-label')?.classList.add('is-place-confirming');
          placeChoices.querySelector('.delivery-place-choices__confirm-actions')?.remove();
          const confirmActions = document.createElement('div');
          confirmActions.className = 'delivery-place-choices__confirm-actions';

          const editButton = document.createElement('button');
          editButton.type = 'button';
          editButton.className = 'delivery-place-choices__edit';
          editButton.textContent = 'Изменить';
          editButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            searchSequence += 1;
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = null;
            pendingPlaceChoice = null;
            clearPlaceChoices();
            const entered = String(input?.value || '').trim();
            state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
            setResult('', '');
            if (routeButton) routeButton.hidden = true;
            emit();
            window.setTimeout(() => {
              input?.focus();
              input?.select?.();
            }, 0);
          });

          confirmActions.append(editButton);
          placeChoices.append(confirmActions);
          state = {kind:'place-confirm', name:label, resolvedName:label, shortName:label, price:null};
          setResult('', 'pending');
          if (routeButton) routeButton.hidden = true;
          emit();
          placeChoices.hidden = false;

          const selectedChoice = pendingPlaceChoice;
          window.setTimeout(() => {
            if (state.kind !== 'place-confirm' || normalize(state.name) !== normalize(label)) return;
            pendingPlaceChoice = null;
            if (selectedChoice?.fixedName) {
              const known = byKey.get(normalize(selectedChoice.fixedName));
              if (known) {
                resolveFixed(known);
                return;
              }
            }
            calculateRoute(query, {preferredLabel:label, skipConfirm:true});
          }, 0);
        });
        placeChoices.append(button);
      });

      state = {kind:'choosing', name:entered, resolvedName:'', shortName:'', price:null};
      placeChoices.hidden = false;
      if (routeButton) routeButton.hidden = true;
      emit();
      placeChoices.hidden = false;
      return true;
    };

    const showSearchFallback = entered => {
      if (String(input?.value || '').trim() !== entered || state.kind !== 'pending') return;
      setResult('Не нашли точный вариант в списке. Можно рассчитать маршрут по введённому названию.', 'pending');
      if (routeButton) {
        routeButton.hidden = false;
        routeButton.disabled = false;
        routeButton.textContent = 'Рассчитать доставку';
      }
      emit();
    };

    const searchPlaces = entered => {
      if (!input || entered.length < 2) return;
      const sequence = ++searchSequence;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        searchTimer = null;
        try {
          const choices = await requestPlaceChoices(entered);
          if (sequence !== searchSequence || String(input.value || '').trim() !== entered) return;
          if (!choices.length) {
            showSearchFallback(entered);
            return;
          }

          const exact = choices.filter(choice => normalize(choice.name) === normalize(entered));
          renderPlaceChoices(entered, exact.length ? exact : choices);
        } catch {
          if (sequence !== searchSequence || String(input?.value || '').trim() !== entered) return;
          showSearchFallback(entered);
        }
      }, 420);
    };

    const updateFromInput = (options = {}) => {
      const entered = String(input?.value || '').trim();
      cancelPlaceSearch();
      const known = byKey.get(normalize(entered));
      const directKnown = options?.directKnown === true;
      if (known && (directKnown || normalize(entered) === normalize('Мелеуз'))) {
        resolveFixed(known);
        return;
      }
      if (entered.length >= 2) {
        state = {kind:'pending', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) {
          routeButton.hidden = true;
          routeButton.disabled = false;
          routeButton.textContent = 'Рассчитать доставку';
        }
        setResult('Ищем населённый пункт. Затем выберите нужный вариант.', 'pending');
        emit();
        searchPlaces(entered);
      } else {
        state = {kind:'empty', name:entered, resolvedName:'', shortName:'', price:null};
        if (routeButton) routeButton.hidden = true;
        setResult('', 'pending');
        emit();
      }
    };

    async function calculateRoute(requestedPlace = '', options = {}) {
      const displayAtStart = String(input?.value || '').trim();
      const place = String(requestedPlace || displayAtStart).trim();
      const preferredLabel = String(options.preferredLabel || '').trim();
      const skipConfirm = options.skipConfirm === true;
      if (place.length < 2) {
        editingOther = true;
        updateFromInput();
        input?.focus();
        return;
      }
      if (!requestedPlace && state.kind === 'place-confirm' && pendingPlaceChoice) {
        const choice = pendingPlaceChoice;
        const label = String(choice.label || choice.name || displayAtStart || place).trim();
        const query = String(choice.query || label).trim();
        pendingPlaceChoice = null;
        clearPlaceChoices();
        if (choice.fixedName) {
          const known = byKey.get(normalize(choice.fixedName));
          if (known) {
            resolveFixed(known);
            return;
          }
        }
        if (input) input.value = label;
        return calculateRoute(query, {preferredLabel:label, skipConfirm:true});
      }
      cancelPlaceSearch();
      if (!requestedPlace && state.kind === 'confirm') {
        state = {...state, kind:'calculated'};
        editingOther = false;
        setResult(`${state.shortName} · доставка учтена в итоговой сумме`, 'success');
        saveSelected(state);
        emit();
        return;
      }
      state = {kind:'loading', name:preferredLabel || displayAtStart || place, resolvedName:'', shortName:'', price:null};
      if (routeButton) { routeButton.hidden = false; routeButton.disabled = true; routeButton.textContent = 'Считаем…'; }
      setResult('Ищем населённый пункт и автомобильный маршрут…', 'pending');
      emit();
      try {
        const payload = await requestDelivery(place, displayAtStart);
        if (String(input?.value || '').trim() !== displayAtStart) return;
        const shortName = preferredLabel || payload.shortName || payload.resolvedName || displayAtStart || place;
        if (input && preferredLabel) input.value = preferredLabel;
        if (payload.outOfArea) {
          state = {
            kind:'out-of-area', name:shortName, resolvedName:preferredLabel || payload.resolvedName || shortName, shortName,
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
        if (skipConfirm) {
          state = {
            kind:'calculated', name:shortName, resolvedName:preferredLabel || payload.resolvedName || shortName, shortName,
            price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null,
            serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm
          };
          editingOther = false;
          if (routeButton) { routeButton.hidden = true; routeButton.disabled = false; routeButton.textContent = 'Рассчитать доставку'; }
          setResult(`${shortName} · доставка учтена в итоговой сумме`, 'success');
          saveSelected(state);
          emit();
          return;
        }
        state = {kind:'confirm', name:displayAtStart || place, resolvedName:payload.resolvedName || shortName, shortName, price:Number(payload.price)||0, distanceKm:Number(payload.distanceKm)||null, serviceAreaKm:Number(payload.serviceAreaKm)||data.serviceAreaKm};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'ОК'; }
        setResult(`Найдено: ${shortName}. Подтвердите населённый пункт.`, 'pending');
      } catch (error) {
        if (String(input?.value || '').trim() !== displayAtStart) return;
        state = {kind:'error', name:displayAtStart || place, resolvedName:'', shortName:'', price:null};
        if (routeButton) { routeButton.hidden = false; routeButton.disabled = false; routeButton.textContent = 'Повторить расчёт'; }
        const message = error?.technical === true
          ? 'Не удалось автоматически рассчитать доставку.'
          : String(error?.message || 'Не удалось рассчитать доставку.');
        setResult(`${message} Оставьте заявку — стоимость уточним вручную.`, 'pending');
      }
      emit();
    }

    const chooseMeleuz = () => resolveFixed(byKey.get(normalize('Мелеуз')) || {name:'Мелеуз',price:0});
    const chooseOther = () => {
      clearSaved();
      cancelPlaceSearch();
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
      cancelPlaceSearch();
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
    input?.addEventListener('change', () => {
      // Tapping a search result blurs the input before the result's click fires.
      // Do not clear the visible choices during that blur/change sequence.
      if (state.kind === 'choosing' || state.kind === 'place-confirm') return;
      updateFromInput();
    });
    routeButton?.addEventListener('click', async () => {
      if (state.kind === 'pending') {
        const entered = String(input?.value || '').trim();
        if (entered.length >= 2) {
          routeButton.disabled = true;
          routeButton.textContent = 'Ищем…';
          try {
            const choices = await requestPlaceChoices(entered);
            if (String(input?.value || '').trim() !== entered) return;
            if (choices.length) {
              const exact = choices.filter(choice => normalize(choice.name) === normalize(entered));
              renderPlaceChoices(entered, exact.length ? exact : choices);
              return;
            }
          } catch {}
          routeButton.disabled = false;
          routeButton.textContent = 'Рассчитать доставку';
        }
      }
      calculateRoute();
    });

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
    return {getState:()=>({...state}), selectedCityName, line, updateFromInput, calculateRoute, restore, chooseMeleuz, chooseOther};
  }

  window.KUZDVOR_DELIVERY = {createController, normalize};
})();