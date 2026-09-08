/* Standalone gate calculator. Excel is not required at runtime. */
(() => {
  const pack = window.GATE_CALC_MODELS;
  const prices = window.GATE_CALC_PRICES;
  if (!pack?.models || !prices) throw new Error('Не загружена модель расчёта ворот');

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

  const compileModel = model => {
    if (compiled.has(model)) return compiled.get(model);
    const result = {};
    for (const [ref, expr] of Object.entries(model.formulas || {})) {
      result[ref] = new Function('ctx','p','v','sum','roundExcel','roundUp', `return (${expr});`);
    }
    compiled.set(model, result);
    return result;
  };

  function calculateGate({ article, gateWidth, gateHeight, wicketWidth, wicketHeight }) {
    const key = normalizeArticle(article);
    const model = pack.models[key];
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

  function hasArticle(article) { return Boolean(pack.models[normalizeArticle(article)]); }
  window.GATE_CALC = { calculateGate, hasArticle, normalizeArticle, roundExcel, roundUp };
})();
