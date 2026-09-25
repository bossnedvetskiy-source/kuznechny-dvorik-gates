(() => {
  const ACCESS_KEY = 'kuzdvor-dev-access-v1';
  const PASSWORD_HASH = 'b57fc67c30927633d69af0d2713333c0d67836247070761880aabcb586e5431a';

  const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

  function unlock() {
    localStorage.setItem(ACCESS_KEY, '1');
    document.getElementById('kuzdvor-dev-hide')?.remove();

    if (!document.getElementById('kuzdvor-dev-badge')) {
      const badge = document.createElement('div');
      badge.id = 'kuzdvor-dev-badge';
      badge.textContent = 'DEV · ТЕСТОВАЯ ВЕРСИЯ';
      badge.style.cssText = [
        'position:fixed',
        'z-index:2147483646',
        'right:10px',
        'bottom:10px',
        'padding:8px 12px',
        'border-radius:999px',
        'background:#17191d',
        'color:#f0c96f',
        'border:1px solid rgba(240,201,111,.55)',
        'font:800 11px/1.2 Arial,sans-serif',
        'box-shadow:0 8px 25px rgba(0,0,0,.28)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(badge);
    }
  }

  function showGate() {
    document.documentElement.style.visibility = 'visible';
    const gate = document.createElement('div');
    gate.id = 'kuzdvor-dev-gate';
    gate.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:grid',
      'place-items:center',
      'padding:24px',
      'background:#0c0d0f',
      'color:#fff',
      'visibility:visible'
    ].join(';');

    gate.innerHTML = `
      <form id="kuzdvor-dev-form" style="width:min(420px,100%);background:#15171b;border:1px solid #3d3524;border-radius:22px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.45);font-family:Arial,sans-serif">
        <div style="font-size:12px;letter-spacing:.14em;color:#d9b45c;font-weight:800;margin-bottom:10px">КУЗНЕЧНЫЙ ДВОРИКЪ</div>
        <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px">Тестовая версия сайта</h1>
        <p style="margin:0 0 20px;color:#b7b9bf;line-height:1.45">Эта версия находится в разработке и закрыта от клиентов.</p>
        <input id="kuzdvor-dev-password" type="password" autocomplete="current-password" placeholder="Пароль" style="box-sizing:border-box;width:100%;height:52px;border:1px solid #45484f;border-radius:14px;background:#0f1114;color:#fff;padding:0 15px;font-size:16px;outline:none">
        <div id="kuzdvor-dev-error" style="min-height:22px;padding:8px 2px 0;color:#ff9b9b;font-size:13px"></div>
        <button type="submit" style="width:100%;height:52px;border:0;border-radius:14px;background:#d7aa4c;color:#17120a;font-weight:900;font-size:15px;cursor:pointer">Открыть тестовый сайт</button>
      </form>
    `;
    document.body.appendChild(gate);

    const form = gate.querySelector('#kuzdvor-dev-form');
    const input = gate.querySelector('#kuzdvor-dev-password');
    const error = gate.querySelector('#kuzdvor-dev-error');
    input.focus();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      const candidate = String(input.value || '');
      if (await sha256(candidate) !== PASSWORD_HASH) {
        error.textContent = 'Неверный пароль';
        input.select();
        return;
      }
      gate.remove();
      unlock();
    });
  }

  if (localStorage.getItem(ACCESS_KEY) === '1') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', unlock, {once:true});
    } else {
      unlock();
    }
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate, {once:true});
  } else {
    showGate();
  }
})();
