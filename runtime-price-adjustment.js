(() => {
  const calc = window.GATE_CALC;
  const prices = window.PRICE_DATA;
  if (!calc?.calculateGate || !prices?.catalog) return;

  const originalCalculate = calc.calculateGate.bind(calc);
  const catalogByArticle = new Map((prices.catalog || []).map(item => [calc.normalizeArticle(item.art), item]));
  const standardCache = new Map();

  function standardInput(article) {
    const key = calc.normalizeArticle(article);
    const standard = window.GATE_CALC_MODELS?.models?.[key]?.standard || {};
    return {
      article,
      gateWidth:Number(standard.gate_width_m) || 3.4,
      gateHeight:Number(standard.gate_height_m) || 1.8,
      wicketWidth:Number(standard.wicket_width_m) || 1,
      wicketHeight:Number(standard.wicket_height_m) || 1.8
    };
  }

  function standardFormulaTotal(article) {
    const key = calc.normalizeArticle(article);
    if (standardCache.has(key)) return standardCache.get(key);
    const total = Number(originalCalculate(standardInput(article)).total) || 0;
    standardCache.set(key, total);
    return total;
  }

  calc.calculateGate = input => {
    const result = originalCalculate(input);
    const key = calc.normalizeArticle(input?.article);
    const catalogItem = catalogByArticle.get(key);
    const runtimeBase = Math.round(Number(catalogItem?.price));
    if (!Number.isFinite(runtimeBase) || runtimeBase < 0) return result;
    const standardBase = standardFormulaTotal(input.article);
    const delta = runtimeBase - standardBase;
    const adjustedTotal = Math.max(0, calc.roundExcel(Number(result.total) + delta, -2));
    return {
      ...result,
      totalRaw:Number(result.totalRaw) + delta,
      total:adjustedTotal,
      runtimeBasePrice:runtimeBase,
      standardFormulaPrice:standardBase,
      priceAdjustment:delta
    };
  };
})();
