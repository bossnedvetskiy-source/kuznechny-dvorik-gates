/* Standalone gate calculator. Excel-derived formulas are the only source of gate prices. */
(() => {
  const prices = window.GATE_CALC_PRICES;
  if (!prices) throw new Error('Не загружены общие цены расчёта ворот');

  const normalizeArticle = value => String(value ?? '')
    .replace(/^\s*арт\.?\s*/iu, '')
    .replace(/c/giu, 'с')
    .trim()
    .toUpperCase();

  const roundExcel = (value, digits = 0) => {
    const x = Number(value);
    const d = Math.trunc(Number(digits) || 0);
    if (!Number.isFinite(x)) return NaN;
    const factor = 10 ** Math.abs(d);
    const scaled = d >= 0 ? x * factor : x / factor;
    const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
    return d >= 0 ? rounded / factor : rounded * factor;
  };

  const roundUp = (value, digits = 0) => {
    const x = Number(value);
    const d = Math.trunc(Number(digits) || 0);
    if (!Number.isFinite(x)) return NaN;
    const factor = 10 ** Math.abs(d);
    if (d >= 0) return (x >= 0 ? Math.ceil(x * factor) : Math.floor(x * factor)) / factor;
    return (x >= 0 ? Math.ceil(x / factor) : Math.floor(x / factor)) * factor;
  };

  const sum = value => Array.isArray(value) ? value.reduce((acc, item) => acc + Number(item || 0), 0) : Number(value || 0);
  const compiled = new WeakMap();
  const pack = () => window.GATE_CALC_MODELS;

  const compileModel = model => {
    if (compiled.has(model)) return compiled.get(model);
    const result = {};
    for (const [ref, expr] of Object.entries(model.formulas || {})) {
      result[ref] = new Function('ctx','p','v','sum','roundExcel','roundUp', `return (${expr});`);
    }
    compiled.set(model, result);
    return result;
  };

  function rawGateCalculation({ article, gateWidth, gateHeight, wicketWidth, wicketHeight }) {
    const key = normalizeArticle(article);
    const model = pack()?.models?.[key];
    if (!model) throw new Error(`Нет расчётной модели для артикула ${article}`);

    const ctx = {
      gateWidth: Number(gateWidth),
      gateHeight: Number(gateHeight),
      wicketWidth: Number(wicketWidth),
      wicketHeight: Number(wicketHeight),
    };
    for (const [name, value] of Object.entries(ctx)) {
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Некорректный размер: ${name}`);
    }

    const cache = { ...(model.literals || {}) };
    const formulas = compileModel(model);
    const p = ref => Number(prices[ref]?.value ?? 0);
    const v = ref => {
      if (Object.prototype.hasOwnProperty.call(cache, ref)) return cache[ref];
      const fn = formulas[ref];
      if (!fn) throw new Error(`Не найдена формула ${key}:${ref}`);
      const value = Number(fn(ctx, p, v, sum, roundExcel, roundUp));
      if (!Number.isFinite(value)) throw new Error(`Ошибка расчёта ${key}:${ref}`);
      cache[ref] = value;
      return value;
    };

    const gatePrice = v(model.gateRef);
    const wicketPrice = v(model.wicketRef);
    const totalRaw = gatePrice + wicketPrice;
    const total = roundExcel(totalRaw, -2);
    return { article: key, gatePrice, wicketPrice, totalRaw, total };
  }

  function standardDimensions(model) {
    const standard = model?.standard || {};
    return {
      gateWidth: Number(standard.gate_width_m) || 3.4,
      gateHeight: Number(standard.gate_height_m) || 1.8,
      wicketWidth: Number(standard.wicket_width_m) || 1,
      wicketHeight: Number(standard.wicket_height_m) || 1.8
    };
  }

  function calculateGate(input) {
    return rawGateCalculation(input);
  }

  function standardForArticle(article) {
    const key = normalizeArticle(article);
    const model = pack()?.models?.[key];
    if (!model) return null;
    const dimensions = standardDimensions(model);
    const calculation = rawGateCalculation({article, ...dimensions});
    return {...dimensions, price:calculation.total};
  }

  function hasArticle(article) { return Boolean(pack()?.models?.[normalizeArticle(article)]); }
  const ready = Promise.resolve(window.GATE_CALC_MODELS_READY).then(() => true);
  window.GATE_CALC = { calculateGate, standardForArticle, hasArticle, normalizeArticle, roundExcel, roundUp, ready };
})();