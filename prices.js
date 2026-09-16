/*
 * ВАЖНО: цены артикулов ворот НЕ редактируются вручную в этом файле или админке.
 * Источник цены ворот — Excel-derived расчёт: gate-calc-prices.js + формулы моделей.
 * Значения price в catalog ниже являются только резервным снимком для загрузки интерфейса.
 * После загрузки расчётной модели карточки и калькулятор используют цену из Excel-формул.
 *
 * catalogInstallation — монтаж на готовые столбы;
 * catalogPosts        — комплект новых усиленных столбов;
 * Тарифы доставки находятся отдельно в delivery-prices.json / настройках доставки.
 */
window.PRICE_DATA = {
  updatedAt: '2026-09-01',
  catalogInstallation: 8000,
  catalogPosts: 25000,

  catalog: [
    { art: 'Арт.6', price: 56600 },
    { art: 'Арт.18', price: 59800 },
    { art: 'Арт.31', price: 65200 },
    { art: 'Арт.28', price: 74400 },
    { art: 'Арт.15', price: 75400 },
    { art: 'Арт.30', price: 76300 },
    { art: 'Арт.38', price: 76500 },
    { art: 'Арт.9', price: 80000 },
    { art: 'Арт.22-2', price: 80400 },
    { art: 'Арт.21', price: 81600 },
    { art: 'Арт.29', price: 82400 },
    { art: 'Арт.14', price: 82500 },
    { art: 'Арт.36', price: 85200 },
    { art: 'Арт.24', price: 86000 },
    { art: 'Арт.1', price: 87200 },
    { art: 'Арт.12', price: 88400 },
    { art: 'Арт.32', price: 89700 },
    { art: 'Арт.17С', price: 90000 },
    { art: 'Арт.4', price: 90100 },
    { art: 'Арт.33', price: 90500 },
    { art: 'Арт.46', price: 90800 },
    { art: 'Арт.27', price: 91500 },
    { art: 'Арт.8', price: 92600 },
    { art: 'Арт.16', price: 93400 },
    { art: 'Арт.7', price: 138500 },
    { art: 'Арт.34', price: 95100 },
    { art: 'Арт.23С', price: 95300 },
    { art: 'Арт.25', price: 97500 },
    { art: 'Арт.10', price: 97600 },
    { art: 'Арт.35', price: 98000 },
    { art: 'Арт.37', price: 99500 },
    { art: 'Арт.9-3', price: 102200 },
    { art: 'Арт.13', price: 106100 },
    { art: 'Арт.11', price: 107000 },
    { art: 'Арт.20', price: 110200 },
    { art: 'Арт.2', price: 121000 },
    { art: 'Арт.3', price: 143900 },
    { art: 'Арт.5', price: 155500 }
  ],

  extraProducts: [
    { id: 'gates', type: 'swing', art: 'Арт.6', title: 'Только ворота', description: 'Две распашные створки без отдельной калитки.', price: 38200, install: 5300, posts: 13000, standard: [3.4, 1.8] },
    { id: 'wicket', type: 'wicket', art: 'Арт.6', title: 'Только калитка', description: 'Отдельная калитка с замком, ручкой и ключами.', price: 18500, install: 2700, posts: 13000, standard: [1, 1.8] },
    { id: 'frame', type: 'frame', art: 'DIY', title: 'Каркас без покраски', description: 'Каркас ворот и калитки для самостоятельной комплектации.', price: 31800, install: 0, posts: 0, standard: [3.35, 1.8], wicketWidth: 0.95 },
    { id: 'frame-kit', type: 'frame', art: 'DIY+', title: 'Каркас с фурнитурой', description: 'Каркас, петли, замок, ключи, засовы и штыри.', price: 36500, install: 0, posts: 7200, standard: [3.35, 1.8], wicketWidth: 0.95 },
    { id: 'sliding', type: 'sliding', art: 'Откатные', title: 'Откатные ворота', description: 'Откатная конструкция без автоматики.', price: 75000, install: 0, posts: 0, standard: [4, 1.8], from: true },
    { id: 'sliding-auto', type: 'sliding', art: 'Автоматика', title: 'Откатные с автоматикой', description: 'Откатная конструкция с приводом.', price: 105000, install: 0, posts: 0, standard: [4, 1.8], from: true }
  ]
};

/* Mobile UX: make a missing installation place unmistakable instead of looking like a broken button. */
(() => {
  const mobile = window.matchMedia('(max-width: 620px)');
  const calculator = document.getElementById('calculator');
  const cta = document.getElementById('mobilePrimaryCta');
  const deliveryChooser = document.getElementById('deliveryChooser');
  const deliveryBlock = deliveryChooser?.closest('.form-block');
  if (!calculator || !cta || !deliveryBlock) return;

  const style = document.createElement('style');
  style.id = 'deliveryLocationNoticeStyles';
  style.textContent = `
    .delivery-location-notice{display:none}
    @media(max-width:620px){
      .delivery-location-notice{position:fixed;left:12px;right:12px;bottom:74px;z-index:460;display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;padding:12px 13px;border:1px solid rgba(230,189,105,.72);border-radius:15px;background:rgba(17,18,20,.97);color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.42),0 0 0 2px rgba(210,161,67,.1);font-family:Manrope,Arial,sans-serif;opacity:0;visibility:hidden;transform:translateY(14px) scale(.98);pointer-events:none;transition:opacity .18s ease,transform .18s ease,visibility .18s ease;cursor:pointer}
      .delivery-location-notice.is-visible{opacity:1;visibility:visible;transform:none;pointer-events:auto}
      .delivery-location-notice-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:rgba(210,161,67,.16);color:#e6bd69;font-size:22px}
      .delivery-location-notice-copy{display:grid;gap:3px;min-width:0}
      .delivery-location-notice-copy strong{font-size:13px;line-height:1.25;font-weight:900;color:#fff}
      .delivery-location-notice-copy span{font-size:11px;line-height:1.38;font-weight:650;color:rgba(255,255,255,.74)}
      .delivery-location-required{scroll-margin-top:14px!important;border-radius:14px!important;animation:deliveryLocationPulse .72s ease 0s 3}
      .delivery-location-required .delivery-choice-buttons button{border-color:rgba(230,189,105,.86)!important;box-shadow:0 0 0 2px rgba(210,161,67,.12),0 7px 18px rgba(0,0,0,.16)}
      @keyframes deliveryLocationPulse{0%,100%{box-shadow:0 0 0 0 rgba(210,161,67,0)}50%{box-shadow:0 0 0 5px rgba(210,161,67,.18)}}
    }
  `;
  if (!document.getElementById(style.id)) document.head.append(style);

  const notice = document.createElement('div');
  notice.className = 'delivery-location-notice';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','assertive');
  notice.innerHTML = '<div class="delivery-location-notice-icon" aria-hidden="true">⌖</div><div class="delivery-location-notice-copy"><strong>Сначала укажите место установки</strong><span>Это нужно, чтобы учесть доставку и показать итоговую стоимость. Выберите «Мелеуз» или «Другой населённый пункт».</span></div>';
  document.body.append(notice);

  let hideTimer = 0;
  const needsInstallationPlace = () => mobile.matches
    && !calculator.hidden
    && !document.body.classList.contains('mobile-lead-open')
    && String(cta.textContent || '').includes('Указать место установки');

  const hideNotice = () => {
    notice.classList.remove('is-visible');
    deliveryBlock.classList.remove('delivery-location-required');
  };

  const showNotice = () => {
    if (!needsInstallationPlace()) return;
    window.clearTimeout(hideTimer);
    notice.classList.add('is-visible');
    deliveryBlock.classList.remove('delivery-location-required');
    void deliveryBlock.offsetWidth;
    deliveryBlock.classList.add('delivery-location-required');
    hideTimer = window.setTimeout(hideNotice, 5200);
  };

  notice.addEventListener('click', () => {
    deliveryBlock.scrollIntoView({behavior:'smooth',block:'center'});
    window.setTimeout(() => deliveryChooser.querySelector('button')?.focus({preventScroll:true}), 320);
  });

  document.addEventListener('click', event => {
    const target = event.target?.closest?.('#mobilePrimaryCta,.mobile-price-breakdown,.mobile-inline-order-cta');
    if (!target || !needsInstallationPlace()) return;
    showNotice();
  }, true);

  new MutationObserver(() => {
    if (!needsInstallationPlace()) hideNotice();
  }).observe(cta,{childList:true,characterData:true,subtree:true});

  mobile.addEventListener('change', () => {
    if (!mobile.matches) hideNotice();
  });
})();