// DEV-only UI for preparing the shared surveyor + calculator offline cache.
// The service worker is authoritative: 'online' and IndexedDB alone do not
// mean the three calculators have been downloaded.
(() => {
  const container = document.getElementById('kdOfflineReadiness');
  if (!container || !('serviceWorker' in navigator)) {
    if (container) container.querySelector('#kdOfflineState').textContent = 'Этот браузер не поддерживает офлайн-загрузку';
    return;
  }

  const status = document.getElementById('kdOfflineState');
  const button = document.getElementById('kdOfflineDownload');
  let busy = false;
  let prepared = false;

  function setState(message, {loading = false, ready = false} = {}) {
    busy = loading;
    prepared = ready;
    status.textContent = message;
    button.disabled = loading;
    button.textContent = loading ? 'Загружаем…' : (ready ? 'Обновить базу' : 'Скачать базу');
  }

  async function worker() {
    const registration = await navigator.serviceWorker.ready;
    const active = navigator.serviceWorker.controller || registration.active;
    if (!active || !new URL(active.scriptURL).pathname.endsWith('/site-sw.js')) {
      throw new Error('Ожидаем запуск общего офлайн-модуля');
    }
    return active;
  }

  async function send(type) {
    const active = await worker();
    active.postMessage({type});
  }

  function reportSnapshot(data) {
    if (busy) return;
    if (!data.ready) {
      setState(navigator.onLine
        ? 'Файлы калькуляторов ещё не проверены. Загрузите базу перед выездом.'
        : 'Нет полной офлайн-базы. Подключитесь к интернету для загрузки.');
      return;
    }
    const missing = Number(data.missingMediaCount || data.failedMediaCount || 0);
    if (data.stale) {
      setState('Старая база доступна. Рекомендуется обновить её перед выездом.', {ready: true});
    } else if (missing) {
      setState('Расчётная база готова; не загружено фотографий: ' + missing + '. Проверьте каталог.', {ready: true});
    } else {
      setState('База сохранена на телефоне. Проверьте расчёты в режиме полёта.', {ready: true});
    }
  }

  navigator.serviceWorker.addEventListener('message', event => {
    const data = event.data || {};
    if (data.type === 'OFFLINE_STATUS') reportSnapshot(data);
    if (data.type === 'OFFLINE_WARM_START') setState('Сохраняем калькуляторы и каталог…', {loading: true});
    if (data.type === 'OFFLINE_WARM_PROGRESS') {
      const stage = data.stage === 'media' ? 'Фотографии' : 'Файлы и расчёты';
      setState(stage + ': ' + Number(data.current || 0) + ' / ' + Number(data.total || 0), {loading: true});
    }
    if (data.type === 'OFFLINE_READY') {
      busy = false;
      setState('Загрузка закончена. Проверяем сохранённые данные…', {ready: true});
      send('GET_OFFLINE_STATUS').catch(error => setState(error.message));
    }
    if (data.type === 'OFFLINE_PARTIAL') {
      setState('Загрузка не завершена. Проверьте интернет и повторите.');
    }
    if (data.type === 'OFFLINE_UP_TO_DATE') {
      if (!busy) setState('База актуальна. Проверьте калькуляторы без интернета.', {ready: true});
    }
  });

  button.addEventListener('click', async () => {
    if (busy) return;
    if (!navigator.onLine) {
      setState('Для загрузки базы нужен интернет.');
      return;
    }
    setState('Начинаем загрузку…', {loading: true});
    try {
      await send('WARM_OFFLINE');
    } catch (error) {
      setState('Не удалось начать загрузку: ' + error.message);
    }
  });

  const refresh = () => {
    if (!busy) send('GET_OFFLINE_STATUS').catch(error => setState(error.message));
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  navigator.serviceWorker.addEventListener('controllerchange', refresh);
  refresh();
})();
