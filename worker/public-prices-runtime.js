const __renderPublicPageWithoutStandardPriceProjection = renderPublicPage;
renderPublicPage = async function renderPublicPageWithStandardPrices(env) {
  const now = Date.now();
  if (publicRenderCache.value && publicRenderCache.expiresAt > now) return publicRenderCache.value;

  const [prices, site, delivery, gateCalcPrices] = await Promise.all([
    loadPrices(env),
    loadSiteProfile(env),
    loadDeliverySettings(env),
    loadGateCalcInputs(env)
  ]);

  try {
    const standardPrices = gateExcelStandardPrices(gateCalcPrices);
    prices.catalog = (prices.catalog || []).map(item => {
      const article = normalizeGateArticleServer(item.art);
      const projected = Number(standardPrices?.[article]);
      return Number.isFinite(projected) ? {...item, price: projected} : item;
    });
  } catch (error) {
    console.error('Standard public price projection failed', error);
  }

  const serializedPrices = JSON.stringify(prices).replace(/</g, '\\u003c');
  const serializedSite = JSON.stringify(site).replace(/</g, '\\u003c');
  const serializedDelivery = JSON.stringify(delivery).replace(/</g, '\\u003c');
  const serializedGateCalcPrices = JSON.stringify(gateCalcPrices).replace(/</g, '\\u003c');
  const value = PAGE
    .replace('__RUNTIME_PRICE_DATA__', serializedPrices)
    .replace('__RUNTIME_SITE_DATA__', serializedSite)
    .replace('__RUNTIME_DELIVERY_DATA__', serializedDelivery)
    .replace('__RUNTIME_GATE_CALC_PRICES__', serializedGateCalcPrices);

  publicRenderCache = {value, expiresAt: now + PUBLIC_RENDER_CACHE_MS};
  return value;
};
