const round100 = value => Math.round((Number(value) || 0) / 100) * 100;

export function money(value) {
  return new Intl.NumberFormat('ru-RU').format(round100(value)) + ' ₽';
}

export async function ensureGateCalculator() {
  if (!window.GATE_CALC || !window.PRICE_DATA) throw new Error('Калькулятор ворот не загружен');
  await window.GATE_CALC.ready;
  return window.GATE_CALC;
}

export async function gateCatalog() {
  const calc = await ensureGateCalculator();
  const rows = Array.isArray(window.PRICE_DATA?.catalog) ? window.PRICE_DATA.catalog : [];
  return rows
    .filter(item => item.visible !== false && calc.hasArticle(item.art))
    .sort((a,b) => (Number(a.order) || 9999) - (Number(b.order) || 9999))
    .map((item,index) => {
      const standard = calc.standardForArticle(item.art) || {
        gateWidth:3.4, gateHeight:1.8, wicketWidth:1, wicketHeight:1.8, price:Number(item.price)||0
      };
      const gallery = Array.isArray(window.CATALOG_IMAGES?.[item.art]) ? window.CATALOG_IMAGES[item.art] : [];
      const productPrice = Number(standard.price) || Number(item.price) || 0;
      const installPrice = Number(window.PRICE_DATA.catalogInstallation) || 0;
      const postsPrice = Number(window.PRICE_DATA.catalogPosts) || 0;
      return {
        index, art:item.art, image:gallery[0] || '',
        gateWidth:Number(standard.gateWidth)||3.4,
        gateHeight:Number(standard.gateHeight)||1.8,
        wicketWidth:Number(standard.wicketWidth)||1,
        wicketHeight:Number(standard.wicketHeight)||1.8,
        productPrice, installPrice, postsPrice,
        installedTotal:round100(productPrice + installPrice),
        turnkeyTotal:round100(productPrice + installPrice + postsPrice)
      };
    });
}

export async function calculateGateQuote(input) {
  const calc = await ensureGateCalculator();
  const gateWidth = Number(input.gateWidth);
  const gateHeight = Number(input.gateHeight);
  const wicketWidth = Number(input.wicketWidth);
  const wicketHeight = Number(input.wicketHeight);
  if (!(gateWidth >= .8 && gateWidth <= 8)) throw new Error('Проверьте ширину ворот');
  if (!(gateHeight >= 1 && gateHeight <= 3)) throw new Error('Проверьте высоту ворот');
  if (!(wicketWidth >= .7 && wicketWidth <= 2.5)) throw new Error('Проверьте ширину калитки');
  if (!(wicketHeight >= 1 && wicketHeight <= 3)) throw new Error('Проверьте высоту калитки');

  const calculation = calc.calculateGate({
    article:input.article, gateWidth, gateHeight, wicketWidth, wicketHeight
  });
  const installPrice = Number(window.PRICE_DATA?.catalogInstallation) || 0;
  const postsPrice = input.posts ? (Number(window.PRICE_DATA?.catalogPosts) || 0) : 0;
  const productPrice = Number(calculation.total) || 0;
  const total = round100(productPrice + installPrice + postsPrice);
  const gallery = Array.isArray(window.CATALOG_IMAGES?.[input.article]) ? window.CATALOG_IMAGES[input.article] : [];

  return {
    article:input.article,
    image:gallery[0] || '',
    gateWidth, gateHeight, wicketWidth, wicketHeight,
    posts:Boolean(input.posts),
    productPrice,
    installPrice,
    postsPrice,
    deliveryPrice:Number(input.deliveryPrice)||0,
    total:round100(total + (Number(input.deliveryPrice)||0))
  };
}
