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

// На странице уже есть полноценный блок из пяти этапов. Помечаем его как основной,
// чтобы public-site-settings.js не создавал второй блок с тем же смыслом.
if (typeof document !== 'undefined') {
  const orderProcess = document.getElementById('afterRequest');
  if (orderProcess) {
    orderProcess.dataset.orderProcess = 'true';
    const heading = orderProcess.querySelector('h2');
    const intro = orderProcess.querySelector('.section-head > p');
    if (heading) heading.textContent = 'Как проходит заказ';
    if (intro) intro.textContent = 'Пять шагов от выбора модели до установки. На сайте ничего оплачивать не нужно.';

    const steps = orderProcess.querySelectorAll('.order-steps-grid article');
    const firstTitle = steps[0]?.querySelector('b');
    const firstText = steps[0]?.querySelector('p');
    if (firstTitle) firstTitle.textContent = 'Выбираете модель';
    if (firstText) firstText.textContent = 'Смотрите реальные цены и получаете предварительный расчёт по своим размерам.';

    const syncOrderProcessLayout = () => {
      const grid = orderProcess.querySelector('.order-steps-grid');
      if (!grid) return;
      if (window.matchMedia?.('(max-width: 620px)').matches) {
        grid.style.setProperty('grid-template-columns', '1fr', 'important');
      } else {
        grid.style.removeProperty('grid-template-columns');
      }
    };
    syncOrderProcessLayout();
    window.matchMedia?.('(max-width: 620px)').addEventListener?.('change', syncOrderProcessLayout);
  }

  // Расчёт выбранной модели — временное состояние интерфейса, а не отдельная
  // страница. Некоторые мобильные Chromium-браузеры восстанавливают динамически
  // открытый calculator при обновлении/возврате из BFCache. Из-за этого после
  // обычного Reload пользователь снова видел последнюю модель вместо каталога.
  const closeTransientCalculator = ({scrollToCatalog = false} = {}) => {
    const calculator = document.getElementById('calculator');
    if (!calculator) return false;
    const wasOpen = !calculator.hidden || document.body.classList.contains('calculator-open');
    if (!wasOpen) return false;

    calculator.hidden = true;
    const parking = document.getElementById('calculatorParking');
    if (parking && calculator.parentElement !== parking) parking.append(calculator);
    document.body.classList.remove('calculator-open', 'mobile-lead-open');
    document.getElementById('leadBackdrop')?.setAttribute('hidden', '');
    document.querySelectorAll('.select-product[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));

    if (scrollToCatalog) {
      requestAnimationFrame(() => {
        document.getElementById('catalog')?.scrollIntoView({block:'start', behavior:'auto'});
      });
    }
    return true;
  };

  const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];
  const isReload = navigationEntry?.type === 'reload' || performance.navigation?.type === 1;
  if (isReload) closeTransientCalculator({scrollToCatalog:true});

  window.addEventListener('pageshow', event => {
    if (event.persisted) closeTransientCalculator({scrollToCatalog:true});
  });
}

window.PRICE_DATA = {
  updatedAt: '2026-09-01',
  catalogInstallation: 8000,
  catalogPosts: 25000,

  // Расценки калькулятора забора из металлического евроштакетника.
  // Геометрические правила остаются в engine.js, здесь только изменяемые ставки.
  fence: {
    picketSinglePrice: 110,
    picketDoublePrice: 130,
    tube40Price: 144,
    post60Price: 305,
    post80Price: 600,
    post100Price: 750,
    paintPrice: 650,
    workVerticalSingle: 1300,
    workVerticalDouble: 1800,
    workHorizontalDouble: 2000,
    postInstallPrice: 800,
    screwPrice: 2,
    markupPercent: 0,
    measurerPercent: 4,

    // Технологические параметры забора — редактируются в админке.
    picketWidth: 0.12,
    gapSingle: 0.05,
    gapDouble: 0.06,
    postLength: 3,
    postDepth: 0.7,
    maxSpan: 2.5,
    openingBridgeMaxSpan: 2.4,
    screwVertical: 4,
    screwHorizontal: 6,
    tubeStockLength: 6,
    picketReservePerSide: 2
  },

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