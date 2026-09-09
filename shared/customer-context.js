(() => {
  const CITY_KEY = 'kuzdvor:customer-city';
  const SESSION_KEY = 'kuzdvor:customer-session';

  const safeJson = value => {
    try { return JSON.parse(value || 'null'); } catch { return null; }
  };

  function read() {
    let city = '';
    let session = {};
    try { city = String(localStorage.getItem(CITY_KEY) || '').trim(); } catch {}
    try { session = safeJson(sessionStorage.getItem(SESSION_KEY)) || {}; } catch {}
    return {
      city,
      name: String(session.name || '').trim(),
      phone: String(session.phone || '').trim()
    };
  }

  function set(patch = {}) {
    const current = read();
    const next = {...current, ...patch};
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
      try {
        const city = String(next.city || '').trim();
        if (city) localStorage.setItem(CITY_KEY, city);
        else localStorage.removeItem(CITY_KEY);
      } catch {}
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        name: String(next.name || '').trim(),
        phone: String(next.phone || '').trim()
      }));
    } catch {}
    return next;
  }

  function bindContact({nameInput, phoneInput} = {}) {
    const saved = read();
    if (nameInput && !nameInput.value && saved.name) nameInput.value = saved.name;
    if (phoneInput && !phoneInput.value && saved.phone) phoneInput.value = saved.phone;
    nameInput?.addEventListener('input', () => set({name:nameInput.value}));
    phoneInput?.addEventListener('input', () => set({phone:phoneInput.value}));
  }

  window.KUZDVOR_CUSTOMER = {read, set, bindContact};
})();
