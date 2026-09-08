/*
 * ЕДИНСТВЕННЫЙ ФАЙЛ ДЛЯ ИЗМЕНЕНИЯ ЦЕН.
 *
 * price   — стоимость изделия без монтажа;
 * install — монтаж на готовые столбы;
 * posts   — комплект столбов с установкой (если применимо);
 * Тарифы доставки находятся отдельно в delivery-prices.json.
 */
window.PRICE_DATA = {
  updatedAt: '2026-09-01',
  catalogInstallation: 8000,
  catalogPosts: 25000,

  catalog: [
    { art: 'Арт.6', price: 56600 },
    { art: 'Арт.18', price: 59800 },
    { art: 'Арт.39', price: 64100 },
    { art: 'Арт.31', price: 65200 },
    { art: 'Арт.40', price: 67700 },
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
