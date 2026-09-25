export const FENCE_SETTINGS = Object.freeze({
  picketWidth: 0.12,
  gapSingle: 0.05,
  gapDouble: 0.06,
  picketSinglePrice: 110,
  picketDoublePrice: 130,
  tube40Price: 144,
  paintPrice: 650,
  workVerticalSingle: 1300,
  workVerticalDouble: 1800,
  workHorizontalDouble: 2000,
  postInstallPrice: 800,
  postLength: 3,
  postDepth: 0.7,
  maxSpan: 2.5,
  screwVertical: 4,
  screwHorizontal: 6,
  screwPrice: 2,
  markupPercent: 0,
  tubeStockLength: 6,
  measurerPercent: 4
});

export const FENCE_TYPES = Object.freeze({
  'vertical-single': {
    label: 'Вертикальный односторонний',
    picketPrice: FENCE_SETTINGS.picketSinglePrice,
    maxGap: FENCE_SETTINGS.gapSingle,
    workRate: FENCE_SETTINGS.workVerticalSingle,
    screwsPerPicket: FENCE_SETTINGS.screwVertical,
    isVertical: true,
    isDouble: false
  },
  'vertical-double': {
    label: 'Вертикальный двусторонний',
    picketPrice: FENCE_SETTINGS.picketDoublePrice,
    maxGap: FENCE_SETTINGS.gapDouble,
    workRate: FENCE_SETTINGS.workVerticalDouble,
    screwsPerPicket: FENCE_SETTINGS.screwVertical,
    isVertical: true,
    isDouble: true
  },
  'horizontal-double': {
    label: 'Горизонтальный двусторонний',
    picketPrice: FENCE_SETTINGS.picketDoublePrice,
    maxGap: FENCE_SETTINGS.gapDouble,
    workRate: FENCE_SETTINGS.workHorizontalDouble,
    screwsPerPicket: FENCE_SETTINGS.screwHorizontal,
    isVertical: false,
    isDouble: true
  }
});

export const POST_TYPES = Object.freeze({
  '60x60x2': { label: '60×60×2', width: 0.06, pricePerM: 305, perimeter: 0.24 },
  '80x80x3': { label: '80×80×3', width: 0.08, pricePerM: 600, perimeter: 0.32 },
  '100x100x3': { label: '100×100×3', width: 0.10, pricePerM: 750, perimeter: 0.40 }
});

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const ceilDiv = (count, perStock) => count <= 0 ? 0 : Math.ceil(count / Math.max(1, perStock));
const roundMoney = value => Math.round(Math.max(0, finite(value)));
const round = (value, digits = 3) => {
  const m = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * m) / m;
};

function tubeStockPlan(spans, clearSpan, height, horizontalDouble, stockLength) {
  if (spans <= 0 || clearSpan <= 0) return { variantA: 0, variantB: 0, stocks: 0 };

  const horizontalPieces = 2 * spans;
  const capHorizontal = Math.max(1, Math.floor(stockLength / clearSpan));

  if (!horizontalDouble) {
    const stocks = ceilDiv(horizontalPieces, capHorizontal);
    return { variantA: stocks, variantB: stocks, stocks };
  }

  const verticalPieces = 3 * spans;
  const capVertical = Math.max(1, Math.floor(stockLength / height));

  // Exact port of the two safe cutting strategies used in the Excel workbook.
  const horizontalFirstBase = ceilDiv(horizontalPieces, capHorizontal);
  const horizontalFullStocks = Math.floor(horizontalPieces / capHorizontal);
  const verticalFitAfterFullHorizontal = Math.max(0, Math.floor((stockLength - capHorizontal * clearSpan) / height));
  const horizontalRemainder = horizontalPieces % capHorizontal;
  const verticalFitAfterRemainder = horizontalRemainder > 0
    ? Math.max(0, Math.floor((stockLength - horizontalRemainder * clearSpan) / height))
    : 0;
  const verticalRemaining = Math.max(
    0,
    verticalPieces
      - horizontalFullStocks * verticalFitAfterFullHorizontal
      - verticalFitAfterRemainder
  );
  const variantA = horizontalFirstBase + ceilDiv(verticalRemaining, capVertical);

  const verticalFirstBase = ceilDiv(verticalPieces, capVertical);
  const verticalFullStocks = Math.floor(verticalPieces / capVertical);
  const horizontalFitAfterFullVertical = Math.max(0, Math.floor((stockLength - capVertical * height) / clearSpan));
  const verticalRemainder = verticalPieces % capVertical;
  const horizontalFitAfterRemainder = verticalRemainder > 0
    ? Math.max(0, Math.floor((stockLength - verticalRemainder * height) / clearSpan))
    : 0;
  const horizontalRemaining = Math.max(
    0,
    horizontalPieces
      - verticalFullStocks * horizontalFitAfterFullVertical
      - horizontalFitAfterRemainder
  );
  const variantB = verticalFirstBase + ceilDiv(horizontalRemaining, capHorizontal);

  return { variantA, variantB, stocks: Math.min(variantA, variantB) };
}

export function calculateFence(input = {}) {
  const settings = { ...FENCE_SETTINGS, ...(input.settings || {}) };
  const type = FENCE_TYPES[input.type] || FENCE_TYPES['vertical-double'];
  const post = POST_TYPES[input.post] || POST_TYPES['80x80x3'];
  const includeNewPosts = input.includeNewPosts !== false;
  const rawSections = Array.isArray(input.sections) ? input.sections.slice(0, 4) : [];
  const sectionsInput = Array.from({ length: 4 }, (_, index) => {
    const item = rawSections[index] || {};
    return {
      length: Math.max(0, finite(item.length)),
      height: Math.max(0, finite(item.height) || 1.8),
      sharedWithNext: Boolean(item.sharedWithNext)
    };
  });
  const activeFlags = sectionsInput.map(item => item.length > 0);
  const seenPicketLengths = new Set();

  const sections = sectionsInput.map((item, index) => {
    const active = item.length > 0;
    if (!active) {
      return {
        index: index + 1,
        active: false,
        length: 0,
        height: item.height,
        sharedWithNext: false,
        spans: 0,
        clearSpan: 0,
        frontPerSpan: 0,
        rearPerSpan: 0,
        actualGap: 0,
        actualCount: 0,
        actualPicketLm: 0,
        tubeUsed: 0,
        basePosts: 0,
        sharedPost: 0,
        newPosts: 0,
        tubeStocks: 0,
        tubePurchased: 0,
        tubeRemainder: 0,
        frontActual: 0,
        rearActual: 0,
        reserveFront: 0,
        reserveRear: 0,
        frontCosted: 0,
        rearCosted: 0,
        costedPicketLm: 0,
        picketLength: 0,
        picketLengthMm: 0,
        tubeVariantA: 0,
        tubeVariantB: 0
      };
    }

    const spans = Math.max(1, Math.ceil(Math.max(0, item.length - post.width) / (settings.maxSpan + post.width)));
    const clearSpan = Math.max(0, (item.length - (spans + 1) * post.width) / spans);
    const measure = type.isVertical ? clearSpan : item.height;
    const frontPerSpan = Math.max(
      1,
      Math.ceil((measure + type.maxGap) / (settings.picketWidth + type.maxGap))
    );
    const rearPerSpan = type.isDouble ? Math.max(0, frontPerSpan - 1) : 0;
    const actualGap = frontPerSpan <= 1
      ? 0
      : Math.max(0, (measure - frontPerSpan * settings.picketWidth) / (frontPerSpan - 1));
    const actualCount = spans * (frontPerSpan + rearPerSpan);
    const picketLength = type.isVertical ? item.height : clearSpan;
    const actualPicketLm = actualCount * picketLength;
    const tubeUsed = type.isVertical
      ? spans * 2 * clearSpan
      : spans * (2 * clearSpan + 3 * item.height);
    const basePosts = spans + 1;
    const sharedPost = item.sharedWithNext && index < 3 && activeFlags[index + 1] ? 1 : 0;
    const newPosts = includeNewPosts ? Math.max(0, basePosts - sharedPost) : 0;
    const cutting = tubeStockPlan(spans, clearSpan, item.height, !type.isVertical, settings.tubeStockLength);
    const tubePurchased = cutting.stocks * settings.tubeStockLength;
    const frontActual = spans * frontPerSpan;
    const rearActual = spans * rearPerSpan;
    const picketLengthMm = Math.round(picketLength * 1000);

    let reserveFront = 0;
    let reserveRear = 0;
    if (type.isDouble && !seenPicketLengths.has(picketLengthMm)) {
      reserveFront = 2;
      reserveRear = 2;
      seenPicketLengths.add(picketLengthMm);
    }
    const frontCosted = frontActual + reserveFront;
    const rearCosted = rearActual + reserveRear;
    const costedPicketLm = (frontCosted + rearCosted) * picketLength;

    return {
      index: index + 1,
      active: true,
      length: item.length,
      height: item.height,
      sharedWithNext: Boolean(sharedPost),
      spans,
      clearSpan,
      frontPerSpan,
      rearPerSpan,
      actualGap,
      actualCount,
      actualPicketLm,
      tubeUsed,
      basePosts,
      sharedPost,
      newPosts,
      tubeStocks: cutting.stocks,
      tubePurchased,
      tubeRemainder: Math.max(0, tubePurchased - tubeUsed),
      frontActual,
      rearActual,
      reserveFront,
      reserveRear,
      frontCosted,
      rearCosted,
      costedPicketLm,
      picketLength,
      picketLengthMm,
      tubeVariantA: cutting.variantA,
      tubeVariantB: cutting.variantB
    };
  });

  const activeSections = sections.filter(item => item.active);
  const sum = (key) => activeSections.reduce((acc, item) => acc + finite(item[key]), 0);
  const totalLength = sum('length');
  const totalSpans = sum('spans');
  const sharedPosts = sum('sharedPost');
  const postsByScheme = Math.max(0, sum('basePosts') - sharedPosts);
  const newPosts = sum('newPosts');
  const picketsActual = sum('actualCount');
  const picketLmActual = sum('actualPicketLm');
  const picketLmCosted = sum('costedPicketLm');
  const tubeUsed = sum('tubeUsed');
  const tubeStocks = sum('tubeStocks');
  const tubePurchased = tubeStocks * settings.tubeStockLength;
  const tubeRemainder = Math.max(0, tubePurchased - tubeUsed);
  const screws = picketsActual * type.screwsPerPicket;
  const postLm = newPosts * settings.postLength;

  const picketCost = roundMoney(picketLmCosted * type.picketPrice);
  const tubeCost = roundMoney(tubePurchased * settings.tube40Price);
  const postCost = roundMoney(postLm * post.pricePerM);
  const materialsTotal = picketCost + tubeCost + postCost;
  const paintArea = tubeUsed * 0.12 + postLm * post.perimeter;
  const paintCost = roundMoney(paintArea * settings.paintPrice);
  const workCost = roundMoney(totalLength * type.workRate);
  const postInstallCost = roundMoney(newPosts * settings.postInstallPrice);
  const screwCost = roundMoney(screws * settings.screwPrice);
  const beforeMarkup = materialsTotal + paintCost + workCost + postInstallCost + screwCost;
  const orderCost = roundMoney(beforeMarkup * (1 + settings.markupPercent / 100));
  const measurerCost = roundMoney(orderCost * settings.measurerPercent / 100);
  const deliveryCost = roundMoney(input.deliveryCost);
  const total = orderCost + measurerCost + deliveryCost;

  const uniquePickets = new Map();
  for (const item of activeSections) {
    const key = item.picketLengthMm;
    if (!uniquePickets.has(key)) {
      uniquePickets.set(key, {
        lengthMm: key,
        length: key / 1000,
        frontActual: 0,
        rearActual: 0,
        reserveFront: 0,
        reserveRear: 0,
        frontBuy: 0,
        rearBuy: 0,
        totalBuy: 0,
        cost: 0
      });
    }
    const row = uniquePickets.get(key);
    row.frontActual += item.frontActual;
    row.rearActual += item.rearActual;
    row.reserveFront += item.reserveFront;
    row.reserveRear += item.reserveRear;
  }
  for (const row of uniquePickets.values()) {
    row.frontBuy = row.frontActual + row.reserveFront;
    row.rearBuy = row.rearActual + row.reserveRear;
    row.totalBuy = row.frontBuy + row.rearBuy;
    row.cost = roundMoney(row.totalBuy * row.length * type.picketPrice);
  }

  let check = 'ГОТОВО';
  if (!activeSections.length) check = 'Добавьте участок';
  else if (activeSections.some(item => item.clearSpan > settings.maxSpan + 1e-9)) check = 'ОШИБКА: ПРОЛЁТ > 2,5 м';
  else if (activeSections.some(item => item.height > settings.postLength - settings.postDepth)) check = 'ПРОВЕРЬТЕ ВЫСОТУ / ДЛИНУ СТОЛБА';

  return {
    typeKey: Object.keys(FENCE_TYPES).find(key => FENCE_TYPES[key] === type) || 'vertical-double',
    type,
    postKey: Object.keys(POST_TYPES).find(key => POST_TYPES[key] === post) || '80x80x3',
    post,
    includeNewPosts,
    sections,
    purchase: {
      pickets: [...uniquePickets.values()].sort((a, b) => a.length - b.length),
      tubeStocks,
      tubePurchased,
      tubeUsed,
      tubeRemainder,
      posts: newPosts,
      postLm,
      screws
    },
    summary: {
      activeSections: activeSections.length,
      totalLength: round(totalLength),
      totalSpans,
      sharedPosts,
      postsByScheme,
      newPosts,
      picketsActual,
      picketLmActual: round(picketLmActual),
      picketLmCosted: round(picketLmCosted),
      tubeUsed: round(tubeUsed),
      tubeStocks,
      tubePurchased: round(tubePurchased),
      tubeRemainder: round(tubeRemainder),
      screws,
      check,
      deliveryCost,
      total
    },
    costs: {
      picket: picketCost,
      tube: tubeCost,
      posts: postCost,
      materials: materialsTotal,
      paint: paintCost,
      work: workCost,
      postInstall: postInstallCost,
      screws: screwCost,
      beforeMarkup,
      order: orderCost,
      measurer: measurerCost,
      delivery: deliveryCost,
      total
    }
  };
}
