export const FENCE_SETTINGS = Object.freeze({
  picketWidth: 0.12,
  gapSingle: 0.05,
  gapDouble: 0.06,
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
  postLength: 3,
  postDepth: 0.7,
  maxSpan: 2.5,
  openingBridgeMaxSpan: 2.4,
  screwVertical: 4,
  screwHorizontal: 6,
  screwPrice: 2,
  markupPercent: 0,
  tubeStockLength: 6,
  picketReservePerSide: 2,
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
const positive = (value, fallback) => finite(value) > 0 ? finite(value) : fallback;
const normalizedSettings = input => {
  const settings = {...FENCE_SETTINGS, ...(input || {})};
  settings.picketWidth = positive(settings.picketWidth, FENCE_SETTINGS.picketWidth);
  settings.maxSpan = positive(settings.maxSpan, FENCE_SETTINGS.maxSpan);
  settings.openingBridgeMaxSpan = positive(settings.openingBridgeMaxSpan, FENCE_SETTINGS.openingBridgeMaxSpan);
  settings.postLength = positive(settings.postLength, FENCE_SETTINGS.postLength);
  settings.tubeStockLength = positive(settings.tubeStockLength, FENCE_SETTINGS.tubeStockLength);
  settings.gapSingle = Math.max(0, finite(settings.gapSingle));
  settings.gapDouble = Math.max(0, finite(settings.gapDouble));
  settings.postDepth = Math.max(0, finite(settings.postDepth));
  if (settings.postDepth >= settings.postLength) settings.postDepth = Math.min(FENCE_SETTINGS.postDepth, Math.max(0, settings.postLength - 0.1));
  settings.screwVertical = Math.max(0, Math.floor(finite(settings.screwVertical)));
  settings.screwHorizontal = Math.max(0, Math.floor(finite(settings.screwHorizontal)));
  settings.picketReservePerSide = Math.max(0, Math.floor(finite(settings.picketReservePerSide)));
  return settings;
};
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
  const settings = normalizedSettings(input.settings);
  const typeKey = FENCE_TYPES[input.type] ? input.type : 'vertical-double';
  const baseType = FENCE_TYPES[typeKey];
  const type = {
    ...baseType,
    picketPrice: typeKey === 'vertical-single' ? settings.picketSinglePrice : settings.picketDoublePrice,
    maxGap: typeKey === 'vertical-single' ? settings.gapSingle : settings.gapDouble,
    workRate: typeKey === 'vertical-single'
      ? settings.workVerticalSingle
      : typeKey === 'horizontal-double'
        ? settings.workHorizontalDouble
        : settings.workVerticalDouble,
    screwsPerPicket: typeKey === 'horizontal-double'
      ? settings.screwHorizontal
      : settings.screwVertical
  };
  const postKey = POST_TYPES[input.post] ? input.post : '80x80x3';
  const basePost = POST_TYPES[postKey];
  const postPriceMap = {
    '60x60x2': settings.post60Price,
    '80x80x3': settings.post80Price,
    '100x100x3': settings.post100Price
  };
  const post = {...basePost, pricePerM: Number(postPriceMap[postKey]) || basePost.pricePerM};
  const includeNewPosts = input.includeNewPosts !== false;
  const rawSections = Array.isArray(input.sections) ? input.sections.slice(0, 4) : [];
  const sectionsInput = Array.from({ length: 4 }, (_, index) => {
    const item = rawSections[index] || {};
    return {
      length: Math.max(0, finite(item.length)),
      height: Math.max(0, finite(item.height) || 1.8),
      gateOpening: Math.max(0, finite(item.gateOpening)),
      wicketOpening: Math.max(0, finite(item.wicketOpening)),
      openingPostType: POST_TYPES[item.openingPostType] ? item.openingPostType : postKey,
      openingsSharePost: item.openingsSharePost !== false,
      betweenOpeningFence: Math.max(0, finite(item.betweenOpeningFence)),
      openingStartFence: item.openingStartFence === '' || item.openingStartFence === null || item.openingStartFence === undefined
        ? null
        : Math.max(0, finite(item.openingStartFence)),
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
        grossLength: 0,
        fenceLength: 0,
        openingsWidth: 0,
        gateOpening: 0,
        wicketOpening: 0,
        openingPostType: item.openingPostType,
        openingPostWidth: POST_TYPES[item.openingPostType]?.width || post.width,
        openingSupportPosts: 0,
        openingPostsWidth: 0,
        openingCoreWidth: 0,
        openingNodeWidth: 0,
        openingsSharePost: item.openingsSharePost,
        betweenOpeningFence: 0,
        requestedBetweenOpeningFence: item.betweenOpeningFence,
        openingPositionKnown: false,
        requestedOpeningStartFence: item.openingStartFence,
        openingStartFence: 0,
        openingEndFence: 0,
        maxOpeningStartFence: 0,
        openingPositionInvalid: false,
        bridgeSpans: 0,
        bridgeExtraPosts: 0,
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
        requiredPosts: 0,
        existingPosts: 0,
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
        tubeVariantB: 0,
        segments: [],
        picketBatches: []
      };
    }

    const grossLength = item.length;
    const gateOpening = Math.max(0, item.gateOpening);
    const wicketOpening = Math.max(0, item.wicketOpening);
    const openingsWidth = gateOpening + wicketOpening;
    const openingPostType = POST_TYPES[item.openingPostType] ? item.openingPostType : postKey;
    const openingPostWidth = POST_TYPES[openingPostType]?.width || post.width;
    const hasGate = gateOpening > 0;
    const hasWicket = wicketOpening > 0;
    const hasOpeningNode = hasGate || hasWicket;
    const openingsSharePost = hasGate && hasWicket ? item.openingsSharePost !== false : true;
    const openingSupportPosts = hasGate && hasWicket
      ? (openingsSharePost ? 3 : 4)
      : (hasOpeningNode ? 2 : 0);
    const openingPostsWidth = openingSupportPosts * openingPostWidth;
    const openingCoreWidth = openingsWidth + openingPostsWidth;
    const canHaveBetweenFence = hasGate && hasWicket && !openingsSharePost;
    const requestedBetweenOpeningFence = canHaveBetweenFence ? Math.max(0, item.betweenOpeningFence) : 0;
    const availableFenceFootprint = Math.max(0, grossLength - openingCoreWidth);
    const betweenOpeningFence = Math.min(requestedBetweenOpeningFence, availableFenceFootprint);
    const openingNodeWidth = openingCoreWidth + requestedBetweenOpeningFence;
    const fenceLength = availableFenceFootprint;
    const outerFenceFootprint = Math.max(0, fenceLength - betweenOpeningFence);
    const openingPositionKnown = hasOpeningNode && item.openingStartFence !== null;
    const requestedOpeningStartFence = openingPositionKnown ? Math.max(0, item.openingStartFence) : null;
    const maxOpeningStartFence = Math.max(0, grossLength - openingNodeWidth);
    const openingPositionInvalid = openingPositionKnown && requestedOpeningStartFence > maxOpeningStartFence + 1e-9;
    const openingStartFence = openingPositionKnown ? Math.min(requestedOpeningStartFence, maxOpeningStartFence) : 0;
    const openingEndFence = openingPositionKnown ? Math.max(0, outerFenceFootprint - openingStartFence) : 0;

    const segmentMetrics = (footprint, mode, maxSpan, key) => {
      if (footprint <= 1e-9) return null;
      let spans = 1;
      let normalPosts = 0;
      if (mode === 'normal') {
        spans = Math.max(1, Math.ceil(Math.max(0, footprint - post.width) / (maxSpan + post.width)));
        normalPosts = spans + 1;
      } else if (mode === 'attached') {
        spans = Math.max(1, Math.ceil(footprint / (maxSpan + post.width)));
        normalPosts = spans;
      } else {
        spans = Math.max(1, Math.ceil((footprint + post.width) / (maxSpan + post.width)));
        normalPosts = Math.max(0, spans - 1);
      }

      const clearSpan = Math.max(0, (footprint - normalPosts * post.width) / spans);
      const measure = type.isVertical ? clearSpan : item.height;
      const frontPerSpan = spans > 0
        ? Math.max(1, Math.ceil((measure + type.maxGap) / (settings.picketWidth + type.maxGap)))
        : 0;
      const rearPerSpan = type.isDouble ? Math.max(0, frontPerSpan - 1) : 0;
      const actualGap = frontPerSpan <= 1
        ? 0
        : Math.max(0, (measure - frontPerSpan * settings.picketWidth) / (frontPerSpan - 1));
      const frontActual = spans * frontPerSpan;
      const rearActual = spans * rearPerSpan;
      const actualCount = frontActual + rearActual;
      const picketLength = type.isVertical ? item.height : clearSpan;
      const picketLengthMm = Math.round(picketLength * 1000);
      const actualPicketLm = actualCount * picketLength;
      const tubeUsed = type.isVertical
        ? spans * 2 * clearSpan
        : spans * (2 * clearSpan + 3 * item.height);
      const cutting = tubeStockPlan(spans, clearSpan, item.height, !type.isVertical, settings.tubeStockLength);

      let reserveFront = 0;
      let reserveRear = 0;
      if (actualCount > 0 && type.isDouble && !seenPicketLengths.has(picketLengthMm)) {
        reserveFront = Math.max(0, Math.floor(finite(settings.picketReservePerSide)));
        reserveRear = Math.max(0, Math.floor(finite(settings.picketReservePerSide)));
        seenPicketLengths.add(picketLengthMm);
      }
      const frontCosted = frontActual + reserveFront;
      const rearCosted = rearActual + reserveRear;

      return {
        key,
        mode,
        footprint,
        maxSpan,
        spans,
        normalPosts,
        clearSpan,
        frontPerSpan,
        rearPerSpan,
        actualGap,
        frontActual,
        rearActual,
        actualCount,
        picketLength,
        picketLengthMm,
        actualPicketLm,
        reserveFront,
        reserveRear,
        frontCosted,
        rearCosted,
        costedPicketLm: (frontCosted + rearCosted) * picketLength,
        tubeUsed,
        tubeStocks: cutting.stocks,
        tubePurchased: cutting.stocks * settings.tubeStockLength,
        tubeVariantA: cutting.variantA,
        tubeVariantB: cutting.variantB
      };
    };

    const segments = [];
    if (!hasOpeningNode) {
      const segment = segmentMetrics(grossLength, 'normal', settings.maxSpan, 'main');
      if (segment) segments.push(segment);
    } else if (openingPositionKnown) {
      const before = segmentMetrics(openingStartFence, 'attached', settings.maxSpan, 'before-opening');
      if (before) segments.push(before);
      const bridge = segmentMetrics(betweenOpeningFence, 'bridge', settings.openingBridgeMaxSpan, 'between-openings');
      if (bridge) segments.push(bridge);
      const after = segmentMetrics(openingEndFence, 'attached', settings.maxSpan, 'after-opening');
      if (after) segments.push(after);
    } else {
      const outer = segmentMetrics(outerFenceFootprint, 'attached', settings.maxSpan, 'outer');
      if (outer) segments.push(outer);
      const bridge = segmentMetrics(betweenOpeningFence, 'bridge', settings.openingBridgeMaxSpan, 'between-openings');
      if (bridge) segments.push(bridge);
    }

    const sumSegments = key => segments.reduce((total, segment) => total + finite(segment[key]), 0);
    const spans = sumSegments('spans');
    const basePosts = sumSegments('normalPosts');
    const rightmostSegment = openingPositionKnown
      ? segments.find(segment => segment.key === 'after-opening')
      : (segments.find(segment => segment.key === 'outer') || segments.find(segment => segment.key === 'main'));
    const sharedPost = rightmostSegment?.normalPosts > 0 && item.sharedWithNext && index < 3 && activeFlags[index + 1] ? 1 : 0;
    const requiredPosts = Math.max(0, basePosts - sharedPost);
    const bridgeSegment = segments.find(segment => segment.key === 'between-openings');
    const bridgeSpans = bridgeSegment?.spans || 0;
    const bridgeExtraPosts = bridgeSegment?.normalPosts || 0;

    const actualCount = sumSegments('actualCount');
    const actualPicketLm = sumSegments('actualPicketLm');
    const tubeUsed = sumSegments('tubeUsed');
    const tubeStocks = sumSegments('tubeStocks');
    const tubePurchased = sumSegments('tubePurchased');
    const frontActual = sumSegments('frontActual');
    const rearActual = sumSegments('rearActual');
    const reserveFront = sumSegments('reserveFront');
    const reserveRear = sumSegments('reserveRear');
    const frontCosted = sumSegments('frontCosted');
    const rearCosted = sumSegments('rearCosted');
    const costedPicketLm = sumSegments('costedPicketLm');
    const clearSpan = segments.length ? Math.max(...segments.map(segment => segment.clearSpan)) : 0;
    const actualGap = segments.length ? Math.max(...segments.map(segment => segment.actualGap)) : 0;
    const frontPerSpan = segments.length ? Math.max(...segments.map(segment => segment.frontPerSpan)) : 0;
    const rearPerSpan = segments.length ? Math.max(...segments.map(segment => segment.rearPerSpan)) : 0;
    const primaryPicketLength = segments[0]?.picketLength || 0;
    const primaryPicketLengthMm = segments[0]?.picketLengthMm || 0;

    return {
      index: index + 1,
      active: true,
      length: grossLength,
      grossLength,
      fenceLength,
      openingsWidth,
      gateOpening,
      wicketOpening,
      openingPostType,
      openingPostWidth,
      openingSupportPosts,
      openingPostsWidth,
      openingCoreWidth,
      openingNodeWidth,
      openingsSharePost,
      betweenOpeningFence,
      requestedBetweenOpeningFence,
      openingPositionKnown,
      requestedOpeningStartFence,
      openingStartFence,
      openingEndFence,
      maxOpeningStartFence,
      openingPositionInvalid,
      bridgeSpans,
      bridgeExtraPosts,
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
      requiredPosts,
      existingPosts: 0,
      newPosts: 0,
      tubeStocks,
      tubePurchased,
      tubeRemainder: Math.max(0, tubePurchased - tubeUsed),
      frontActual,
      rearActual,
      reserveFront,
      reserveRear,
      frontCosted,
      rearCosted,
      costedPicketLm,
      picketLength: primaryPicketLength,
      picketLengthMm: primaryPicketLengthMm,
      tubeVariantA: sumSegments('tubeVariantA'),
      tubeVariantB: sumSegments('tubeVariantB'),
      segments,
      picketBatches: segments.map(segment => ({
        length: segment.picketLength,
        lengthMm: segment.picketLengthMm,
        frontActual: segment.frontActual,
        rearActual: segment.rearActual,
        reserveFront: segment.reserveFront,
        reserveRear: segment.reserveRear
      }))
    };
  });
  const activeSections = sections.filter(item => item.active);
  const sum = (key) => activeSections.reduce((acc, item) => acc + finite(item[key]), 0);
  const grossLineLength = sum('grossLength');
  const openingsWidth = sum('openingsWidth');
  const openingSupportPosts = sum('openingSupportPosts');
  const openingPostsWidth = sum('openingPostsWidth');
  const openingCoreWidth = sum('openingCoreWidth');
  const openingNodeWidth = sum('openingNodeWidth');
  const betweenOpeningFence = sum('betweenOpeningFence');
  const bridgeSpans = sum('bridgeSpans');
  const bridgeExtraPosts = sum('bridgeExtraPosts');
  const totalLength = sum('fenceLength');
  const totalSpans = sum('spans');
  const sharedPosts = sum('sharedPost');
  const postsByScheme = Math.max(0, sum('requiredPosts'));
  const requestedExistingPosts = Math.max(0, Math.floor(finite(input.existingPostsCount)));
  const existingPostsUsed = includeNewPosts ? Math.min(postsByScheme, requestedExistingPosts) : postsByScheme;
  const newPosts = includeNewPosts ? Math.max(0, postsByScheme - existingPostsUsed) : 0;

  let remainingExistingPosts = existingPostsUsed;
  for (const item of activeSections) {
    const used = Math.min(item.requiredPosts, remainingExistingPosts);
    item.existingPosts = used;
    item.newPosts = includeNewPosts ? Math.max(0, item.requiredPosts - used) : 0;
    remainingExistingPosts -= used;
  }

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
    const batches = Array.isArray(item.picketBatches) && item.picketBatches.length
      ? item.picketBatches
      : [{
          lengthMm:item.picketLengthMm,
          length:item.picketLength,
          frontActual:item.frontActual,
          rearActual:item.rearActual,
          reserveFront:item.reserveFront,
          reserveRear:item.reserveRear
        }];
    for (const batch of batches) {
      const key = batch.lengthMm;
      if (!key) continue;
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
      row.frontActual += batch.frontActual;
      row.rearActual += batch.rearActual;
      row.reserveFront += batch.reserveFront;
      row.reserveRear += batch.reserveRear;
    }
  }
  for (const row of uniquePickets.values()) {
    row.frontBuy = row.frontActual + row.reserveFront;
    row.rearBuy = row.rearActual + row.reserveRear;
    row.totalBuy = row.frontBuy + row.rearBuy;
    row.cost = roundMoney(row.totalBuy * row.length * type.picketPrice);
  }

  let check = 'ГОТОВО';
  if (!activeSections.length) check = 'Добавьте участок';
  else if (activeSections.some(item => item.openingNodeWidth > item.grossLength + 1e-9)) check = 'ПРОВЕРЬТЕ УЗЕЛ ВОРОТ: ПРОЁМЫ, СТОЛБЫ И ЗАБОР МЕЖДУ НИМИ БОЛЬШЕ УЧАСТКА';
  else if (activeSections.some(item => item.openingPositionInvalid)) check = 'ПРОВЕРЬТЕ ПРИВЯЗКУ ВОРОТ: УЗЕЛ НЕ ПОМЕЩАЕТСЯ В ЛИНИЮ';
  else if (totalLength <= 0) check = 'ПОСЛЕ ПРОЁМОВ НЕ ОСТАЛОСЬ ДЛИНЫ ЗАБОРА';
  else if (activeSections.some(item => item.segments.some(segment => segment.clearSpan > segment.maxSpan + 1e-9))) check = 'ОШИБКА: СЛИШКОМ БОЛЬШОЙ ПРОЛЁТ';
  else if (activeSections.some(item => item.height > settings.postLength - settings.postDepth)) check = 'ПРОВЕРЬТЕ ВЫСОТУ / ДЛИНУ СТОЛБА';

  return {
    typeKey,
    type,
    postKey,
    post,
    includeNewPosts,
    existingPostsCount: requestedExistingPosts,
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
      grossLineLength: round(grossLineLength),
      openingsWidth: round(openingsWidth),
      openingSupportPosts,
      openingPostsWidth: round(openingPostsWidth),
      openingCoreWidth: round(openingCoreWidth),
      openingNodeWidth: round(openingNodeWidth),
      betweenOpeningFence: round(betweenOpeningFence),
      bridgeSpans,
      bridgeExtraPosts,
      totalLength: round(totalLength),
      totalSpans,
      sharedPosts,
      postsByScheme,
      existingPostsUsed,
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
