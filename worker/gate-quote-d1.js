const gateServerSum = value => Array.isArray(value) ? value.reduce((acc, item) => acc + Number(item || 0), 0) : Number(value || 0);

function normalizeGateArticleServer(value) {
  return String(value ?? '')
    .replace(/^\s*арт\.?\s*/iu, '')
    .replace(/c/giu, 'с')
    .trim()
    .toUpperCase();
}

function gateRoundExcelServer(value, digits = 0) {
  const x = Number(value);
  const d = Math.trunc(Number(digits) || 0);
  if (!Number.isFinite(x)) return NaN;
  const factor = 10 ** Math.abs(d);
  const scaled = d >= 0 ? x * factor : x / factor;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return d >= 0 ? rounded / factor : rounded * factor;
}

function gateRoundUpServer(value, digits = 0) {
  const x = Number(value);
  const d = Math.trunc(Number(digits) || 0);
  if (!Number.isFinite(x)) return NaN;
  const factor = 10 ** Math.abs(d);
  if (d >= 0) return (x >= 0 ? Math.ceil(x * factor) : Math.floor(x * factor)) / factor;
  return (x >= 0 ? Math.ceil(x / factor) : Math.floor(x / factor)) * factor;
}

function validateGateQuoteDimensions(body) {
  const values = {
    gateWidth: Number(body.width),
    gateHeight: Number(body.height),
    wicketWidth: Number(body.wicketWidth),
    wicketHeight: Number(body.wicketHeight)
  };
  const limits = {
    gateWidth: [.8, 8],
    gateHeight: [1, 3],
    wicketWidth: [.7, 2.5],
    wicketHeight: [1, 3]
  };
  for (const [key, value] of Object.entries(values)) {
    const [min, max] = limits[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(new Error('Проверьте размеры ворот и калитки'), {status: 400});
    }
  }
  return values;
}

function calculateGateProductServer({article, gateWidth, gateHeight, wicketWidth, wicketHeight}) {
  const key = normalizeGateArticleServer(article);
  const model = DEFAULT_GATE_CALC_MODELS?.models?.[key];
  if (!model) throw Object.assign(new Error(`Нет расчётной модели для ${article}`), {status: 400});
  const ctx = {gateWidth, gateHeight, wicketWidth, wicketHeight};
  const cache = {...(model.literals || {})};
  const p = ref => Number(DEFAULT_GATE_CALC_PRICES?.[ref]?.value ?? 0);
  const v = ref => {
    if (Object.prototype.hasOwnProperty.call(cache, ref)) return cache[ref];
    const fn = model.formulas?.[ref];
    if (typeof fn !== 'function') throw Object.assign(new Error(`Не найдена формула ${key}:${ref}`), {status: 500});
    const value = Number(fn(ctx, p, v, gateServerSum, gateRoundExcelServer, gateRoundUpServer));
    if (!Number.isFinite(value)) throw Object.assign(new Error(`Ошибка расчёта ${key}:${ref}`), {status: 500});
    cache[ref] = value;
    return value;
  };
  const gatePrice = v(model.gateRef);
  const wicketPrice = v(model.wicketRef);
  return gateRoundExcelServer(gatePrice + wicketPrice, -2);
}

const normalizeDeliveryServer = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/gi, '');

function fixedDeliveryForCity(city, site) {
  const destinations = Array.isArray(DEFAULT_DELIVERY_PRICES?.destinations) ? DEFAULT_DELIVERY_PRICES.destinations : [];
  const known = destinations.find(item => normalizeDeliveryServer(item.name) === normalizeDeliveryServer(city));
  if (!known) return null;
  // Listed destinations are explicit business tariffs. Some may intentionally be outside
  // the normal radius, so price must never be used as a proxy for distance.
  return {
    kind:'fixed',
    city:String(known.name || city),
    price:Math.max(0, Math.round(Number(known.price) || 0)),
    distanceKm:null,
    serviceAreaKm:Math.max(0, Number(site?.serviceAreaKm) || 150),
    outOfArea:false,
    resolved:true
  };
}

async function authoritativeDeliveryForLead(city, env, site) {
  const fixed = fixedDeliveryForCity(city, site);
  if (fixed) return fixed;
  try {
    const routed = await calculateUnknownDelivery(city, env);
    if (routed?.outOfArea) {
      return {
        kind: 'out-of-area', city: routed.shortName || city, price: null,
        distanceKm: Number(routed.distanceKm) || null,
        serviceAreaKm: Number(routed.serviceAreaKm) || Number(site?.serviceAreaKm) || 150,
        outOfArea: true, resolved: false
      };
    }
    return {
      kind: 'calculated', city: routed.shortName || city,
      price: Math.max(0, Math.round(Number(routed.price) || 0)),
      distanceKm: Number(routed.distanceKm) || null,
      serviceAreaKm: Number(routed.serviceAreaKm) || Number(site?.serviceAreaKm) || 150,
      outOfArea: false, resolved: true
    };
  } catch (error) {
    return {
      kind: 'error', city, price: null, distanceKm: null,
      serviceAreaKm: Number(site?.serviceAreaKm) || 150,
      outOfArea: false, resolved: false,
      error: String(error?.message || 'Не удалось рассчитать доставку')
    };
  }
}

function serverMoney(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0))} ₽`;
}

function buildAuthoritativeGateMessage({name, phone, city, article, dimensions, posts, quote, comment}) {
  const deliveryText = quote.delivery.outOfArea
    ? `Доставка: за пределами стандартной зоны ${quote.delivery.serviceAreaKm} км — индивидуальный расчёт.`
    : quote.delivery.resolved
      ? 'Доставка учтена в итоговой сумме.'
      : 'Доставка требует уточнения при подтверждении заявки.';
  return [
    'Заявка на бесплатный замер.',
    name ? `Имя: ${name}` : '',
    phone ? `Телефон: ${phone}` : '',
    city ? `Место установки: ${city}` : '',
    `Изделие: Ворота с калиткой, ${article}`,
    quote.color ? `Предпочитаемый цвет: ${quote.color}` : '',
    `Размер ворот: ${dimensions.gateWidth} × ${dimensions.gateHeight} м`,
    `Размер калитки: ${dimensions.wicketWidth} × ${dimensions.wicketHeight} м`,
    `Ворота с калиткой + установка: ${serverMoney(quote.productPrice + quote.installationPrice)}`,
    posts ? `Новые усиленные столбы: ${serverMoney(quote.postsPrice)}` : '',
    `${quote.delivery.resolved ? 'Предварительно с доставкой' : 'Ориентир без доставки'}: ${serverMoney(quote.total)}`,
    deliveryText,
    comment ? `Комментарий: ${comment}` : ''
  ].filter(Boolean).join('\n');
}

async function calculateAuthoritativeGateQuote(body, env) {
  const dimensions = validateGateQuoteDimensions(body);
  const articleKey = normalizeGateArticleServer(body.article);
  const runtimePrices = await loadPrices(env);
  const site = await loadSiteProfile(env);
  const catalogItem = (runtimePrices.catalog || []).find(item => normalizeGateArticleServer(item.art) === articleKey && item.visible !== false);
  if (!catalogItem) throw Object.assign(new Error('Выбранная модель ворот недоступна'), {status: 400});

  const productPrice = calculateGateProductServer({article: body.article, ...dimensions});
  const installationPrice = Math.max(0, Math.round(Number(runtimePrices.catalogInstallation) || 0));
  const postsPrice = body.posts ? Math.max(0, Math.round(Number(runtimePrices.catalogPosts) || 0)) : 0;
  const color = String(body.color || '').trim().slice(0, 100);
  const city = String(body.city || '').trim();
  if (!city) throw Object.assign(new Error('Укажите место установки'), {status: 400});
  const delivery = await authoritativeDeliveryForLead(city, env, site);
  const total = productPrice + installationPrice + postsPrice + (delivery.resolved ? Number(delivery.price) || 0 : 0);
  return {
    article: catalogItem.art,
    productPrice,
    installationPrice,
    postsPrice,
    color,
    delivery,
    total: Math.round(total),
    deliveryPending: !delivery.resolved,
    quoteVerified: true,
    dimensions
  };
}