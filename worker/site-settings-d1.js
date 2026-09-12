let siteSettingsReady = false;

const DEFAULT_SITE_PROFILE = Object.freeze({
  phoneDisplay: '8 937 329-67-50',
  phoneDigits: '79373296750',
  whatsappDigits: '79373296750',
  businessHours: 'Пн–Пт, 9:00–18:00',
  serviceAreaKm: 150,
  warrantyYears: 3,
  productionDays: 30,
  deliveryRate: 90,
  heroEyebrow: 'Собственное производство · Мелеуз',
  heroTitleMain: 'Ворота с калиткой',
  heroTitleAccent: 'по вашим размерам',
  heroText: 'Выберите дизайн и рассчитайте предварительную стоимость по своим размерам — с учётом установки, новых столбов при необходимости и доставки.',
  trustText: 'Собственное производство в Мелеузе. Бесплатно замерим проём, согласуем комплектацию и зафиксируем стоимость в договоре.',
  finalCtaTitle: 'Выберите модель и получите предварительную стоимость',
  finalCtaText: 'Калькулятор учтёт ваши размеры, новые усиленные столбы при необходимости и доставку. Итоговую сумму зафиксируем в договоре после бесплатного замера.'
});

async function ensureSiteSettings(env) {
  if (!env.DB) return false;
  if (!siteSettingsReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_by TEXT DEFAULT '' NOT NULL
    )`).run();
    siteSettingsReady = true;
  }
  return true;
}

function positiveMoney(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 && number <= 10000000 ? number : fallback;
}
function positiveOrder(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 10000 ? number : fallback;
}
function integerSetting(value, fallback, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}
function cleanText(value, fallback, maxLength = 300) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : fallback;
}
function cleanDigits(value, fallback) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 20);
  return digits.length >= 10 ? digits : fallback;
}

function normalizeSiteProfile(input) {
  const source = input && typeof input === 'object' ? {...input} : {};
  const legacyHeroTexts = new Set([
    'Выберите дизайн и сразу узнайте предварительную стоимость с монтажом, столбами и доставкой.',
    'Выберите дизайн и сразу узнайте предварительную стоимость с установкой, столбами и доставкой.'
  ]);
  if (legacyHeroTexts.has(String(source.heroText || '').trim())) source.heroText = DEFAULT_SITE_PROFILE.heroText;
  if (String(source.finalCtaText || '').trim() === 'Калькулятор учтёт комплектацию и доставку. Итоговую сумму зафиксируем в договоре после замера.') source.finalCtaText = DEFAULT_SITE_PROFILE.finalCtaText;
  return {
    phoneDisplay: cleanText(source.phoneDisplay, DEFAULT_SITE_PROFILE.phoneDisplay, 40),
    phoneDigits: cleanDigits(source.phoneDigits, DEFAULT_SITE_PROFILE.phoneDigits),
    whatsappDigits: cleanDigits(source.whatsappDigits, DEFAULT_SITE_PROFILE.whatsappDigits),
    businessHours: cleanText(source.businessHours, DEFAULT_SITE_PROFILE.businessHours, 100),
    serviceAreaKm: integerSetting(source.serviceAreaKm, DEFAULT_SITE_PROFILE.serviceAreaKm, 0, 1000),
    warrantyYears: integerSetting(source.warrantyYears, DEFAULT_SITE_PROFILE.warrantyYears, 1, 20),
    productionDays: integerSetting(source.productionDays, DEFAULT_SITE_PROFILE.productionDays, 1, 365),
    deliveryRate: integerSetting(source.deliveryRate, DEFAULT_SITE_PROFILE.deliveryRate, 0, 5000),
    heroEyebrow: cleanText(source.heroEyebrow, DEFAULT_SITE_PROFILE.heroEyebrow, 120),
    heroTitleMain: cleanText(source.heroTitleMain, DEFAULT_SITE_PROFILE.heroTitleMain, 120),
    heroTitleAccent: cleanText(source.heroTitleAccent, DEFAULT_SITE_PROFILE.heroTitleAccent, 120),
    heroText: cleanText(source.heroText, DEFAULT_SITE_PROFILE.heroText, 320),
    trustText: cleanText(source.trustText, DEFAULT_SITE_PROFILE.trustText, 500),
    finalCtaTitle: cleanText(source.finalCtaTitle, DEFAULT_SITE_PROFILE.finalCtaTitle, 180),
    finalCtaText: cleanText(source.finalCtaText, DEFAULT_SITE_PROFILE.finalCtaText, 320)
  };
}

function normalizePrices(input) {
  const source = input && typeof input === 'object' ? input : {};
  const defaultCatalog = Array.isArray(DEFAULT_PRICES.catalog) ? DEFAULT_PRICES.catalog : [];
  const inputCatalog = new Map((Array.isArray(source.catalog) ? source.catalog : []).map(item => [String(item?.art || ''), item]));
  const defaultExtras = Array.isArray(DEFAULT_PRICES.extraProducts) ? DEFAULT_PRICES.extraProducts : [];
  const inputExtras = new Map((Array.isArray(source.extraProducts) ? source.extraProducts : []).map(item => [String(item?.id || ''), item]));
  const catalog = defaultCatalog.map((defaultItem, index) => {
    const item = inputCatalog.get(defaultItem.art) || {};
    return {art:defaultItem.art,price:positiveMoney(item.price,defaultItem.price),visible:item.visible!==false,order:positiveOrder(item.order,index+1)};
  }).sort((left,right)=>left.order-right.order||left.art.localeCompare(right.art,'ru'));
  catalog.forEach((item,index)=>{item.order=index+1;});
  if (catalog.length && !catalog.some(item=>item.visible)) catalog[0].visible=true;
  return {
    updatedAt:new Date().toISOString().slice(0,10),
    catalogInstallation:positiveMoney(source.catalogInstallation,DEFAULT_PRICES.catalogInstallation),
    catalogPosts:positiveMoney(source.catalogPosts,DEFAULT_PRICES.catalogPosts),
    catalog,
    extraProducts:defaultExtras.map(defaultItem=>{
      const item=inputExtras.get(defaultItem.id)||{};
      return {...defaultItem,price:positiveMoney(item.price,defaultItem.price),install:positiveMoney(item.install,defaultItem.install||0),posts:positiveMoney(item.posts,defaultItem.posts||0)};
    })
  };
}

function normalizeDeliverySettings(input) {
  const defaults=Array.isArray(DEFAULT_DELIVERY_PRICES?.destinations)?DEFAULT_DELIVERY_PRICES.destinations:[];
  const source=input&&typeof input==='object'&&Array.isArray(input.destinations)?input.destinations:defaults;
  const seen=new Set(),destinations=[];
  for(const item of source){
    const name=cleanText(item?.name,'',120);if(!name)continue;
    const key=name.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9]/gi,'');
    if(!key||seen.has(key))continue;seen.add(key);
    destinations.push({name,price:key==='мелеуз'?0:positiveMoney(item?.price,0)});
    if(destinations.length>=250)break;
  }
  if(!seen.has('мелеуз'))destinations.unshift({name:'Мелеуз',price:0});
  destinations.sort((a,b)=>a.name==='Мелеуз'?-1:b.name==='Мелеуз'?1:a.name.localeCompare(b.name,'ru'));
  return {origin:DEFAULT_DELIVERY_PRICES?.origin||{name:'Мелеуз'},fallbackRatePerKm:Number(DEFAULT_DELIVERY_PRICES?.fallbackRatePerKm)||90,destinations};
}

async function loadPrices(env) {
  if(!await ensureSiteSettings(env))return normalizePrices(DEFAULT_PRICES);
  try{const row=await env.DB.prepare("SELECT value_json FROM site_settings WHERE key = 'prices'").first();return row?.value_json?normalizePrices(JSON.parse(row.value_json)):normalizePrices(DEFAULT_PRICES);}catch{return normalizePrices(DEFAULT_PRICES);}
}
async function loadSiteProfile(env) {
  if(!await ensureSiteSettings(env))return normalizeSiteProfile(DEFAULT_SITE_PROFILE);
  try{const row=await env.DB.prepare("SELECT value_json FROM site_settings WHERE key = 'site_profile'").first();return row?.value_json?normalizeSiteProfile(JSON.parse(row.value_json)):normalizeSiteProfile(DEFAULT_SITE_PROFILE);}catch{return normalizeSiteProfile(DEFAULT_SITE_PROFILE);}
}
async function loadDeliverySettings(env) {
  if(!await ensureSiteSettings(env))return normalizeDeliverySettings(DEFAULT_DELIVERY_PRICES);
  try{const row=await env.DB.prepare("SELECT value_json FROM site_settings WHERE key = 'delivery_prices'").first();return row?.value_json?normalizeDeliverySettings(JSON.parse(row.value_json)):normalizeDeliverySettings(DEFAULT_DELIVERY_PRICES);}catch{return normalizeDeliverySettings(DEFAULT_DELIVERY_PRICES);}
}

async function savePrices(request,env) {
  if(!await ensureSiteSettings(env))return json({error:'База данных временно недоступна'},503);
  if(Number(request.headers.get('content-length')||0)>131072)return json({error:'Слишком большой запрос'},413);
  const body=await request.json(),prices=normalizePrices(body?.prices);
  await env.DB.prepare(`INSERT INTO site_settings (key,value_json,updated_at,updated_by) VALUES ('prices',?,CURRENT_TIMESTAMP,'admin') ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`).bind(JSON.stringify(prices)).run();
  return json({ok:true,prices});
}
async function saveSiteProfile(request,env) {
  if(!await ensureSiteSettings(env))return json({error:'База данных временно недоступна'},503);
  if(Number(request.headers.get('content-length')||0)>65536)return json({error:'Слишком большой запрос'},413);
  const body=await request.json(),site=normalizeSiteProfile(body?.site);
  await env.DB.prepare(`INSERT INTO site_settings (key,value_json,updated_at,updated_by) VALUES ('site_profile',?,CURRENT_TIMESTAMP,'admin') ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`).bind(JSON.stringify(site)).run();
  return json({ok:true,site});
}
async function saveDeliverySettings(request,env) {
  if(!await ensureSiteSettings(env))return json({error:'База данных временно недоступна'},503);
  if(Number(request.headers.get('content-length')||0)>131072)return json({error:'Слишком большой запрос'},413);
  const body=await request.json(),delivery=normalizeDeliverySettings(body?.delivery);
  await env.DB.prepare(`INSERT INTO site_settings (key,value_json,updated_at,updated_by) VALUES ('delivery_prices',?,CURRENT_TIMESTAMP,'admin') ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`).bind(JSON.stringify(delivery)).run();
  deliveryCache.clear();
  return json({ok:true,delivery});
}

async function renderPublicPage(env) {
  const [prices,site,delivery]=await Promise.all([loadPrices(env),loadSiteProfile(env),loadDeliverySettings(env)]);
  const serializedPrices=JSON.stringify(prices).replace(/</g,'\\u003c');
  const serializedSite=JSON.stringify(site).replace(/</g,'\\u003c');
  const serializedDelivery=JSON.stringify(delivery).replace(/</g,'\\u003c');
  return PAGE.replace('__RUNTIME_PRICE_DATA__',serializedPrices).replace('__RUNTIME_SITE_DATA__',serializedSite).replace('__RUNTIME_DELIVERY_DATA__',serializedDelivery);
}
async function renderProductHub(env) {
  const site=await loadSiteProfile(env),serializedSite=JSON.stringify(site).replace(/</g,'\u003c');
  return HOME_PAGE.replace('__RUNTIME_SITE_DATA__',serializedSite);
}
