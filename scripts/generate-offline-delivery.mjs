const ORIGIN = {lat:52.96328, lon:55.928612, name:'Мелеуз'};
const ROAD_LIMIT_KM = 200;
const QUERY_RADIUS_M = 205000;
const RATE = 90;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const OSRM_ENDPOINT = 'https://router.project-osrm.org';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value || '')
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g,'е')
  .replace(/[^а-яa-z0-9]/gi,'');

function timeoutSignal(ms) {
  return typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
}

function pointOf(element) {
  const lat = Number(element?.lat ?? element?.center?.lat);
  const lon = Number(element?.lon ?? element?.center?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? {lat,lon} : null;
}

function kindLabel(place) {
  return ({city:'город',town:'город / посёлок',village:'село / деревня',hamlet:'деревня / хутор'})[place] || 'населённый пункт';
}

function secondaryFor(tags, distanceKm) {
  const district = String(tags?.['addr:district'] || tags?.['is_in:district'] || tags?.['addr:county'] || '').trim();
  const base = kindLabel(String(tags?.place || ''));
  const distance = Number.isFinite(distanceKm) ? `${distanceKm} км от Мелеуза` : '';
  return [district, base, distance].filter(Boolean).join(' · ');
}

async function fetchOverpass() {
  const query = `[out:json][timeout:180];
nwr["place"~"^(city|town|village|hamlet)$"]["name"](around:${QUERY_RADIUS_M},${ORIGIN.lat},${ORIGIN.lon});
out center tags;`;
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'KuznechnyDvorikOfflineDelivery/1.0'},
        body:new URLSearchParams({data:query}),
        signal:timeoutSignal(190000)
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const data = await response.json();
      const raw = Array.isArray(data?.elements) ? data.elements : [];
      if (!raw.length) throw new Error('Overpass returned no settlements');
      return raw;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Overpass unavailable');
}

function dedupePlaces(elements) {
  const places = [];
  const byIdentity = new Map();
  for (const element of elements) {
    const point = pointOf(element);
    const name = String(element?.tags?.name || '').trim();
    if (!point || !name) continue;
    const key = [
      normalize(name),
      Math.round(point.lat * 1000),
      Math.round(point.lon * 1000)
    ].join('|');
    if (byIdentity.has(key)) continue;
    const row = {
      osmType:String(element.type || ''),
      osmId:Number(element.id) || 0,
      name,
      place:String(element?.tags?.place || ''),
      lat:point.lat,
      lon:point.lon,
      tags:element.tags || {}
    };
    byIdentity.set(key,row);
    places.push(row);
  }
  return places;
}

async function osrmTable(chunk) {
  const coords = [
    `${ORIGIN.lon},${ORIGIN.lat}`,
    ...chunk.map(item => `${item.lon},${item.lat}`)
  ].join(';');
  const url = `${OSRM_ENDPOINT}/table/v1/driving/${coords}?sources=0&annotations=distance`;
  const response = await fetch(url, {
    headers:{'user-agent':'KuznechnyDvorikOfflineDelivery/1.0'},
    signal:timeoutSignal(60000)
  });
  if (!response.ok) throw new Error(`OSRM table HTTP ${response.status}`);
  const data = await response.json();
  const distances = data?.distances?.[0];
  if (!Array.isArray(distances)) throw new Error('OSRM table returned no distances');
  return distances.slice(1);
}

async function osrmRoute(item) {
  const url = `${OSRM_ENDPOINT}/route/v1/driving/${ORIGIN.lon},${ORIGIN.lat};${item.lon},${item.lat}?overview=false&alternatives=false&steps=false`;
  const response = await fetch(url, {
    headers:{'user-agent':'KuznechnyDvorikOfflineDelivery/1.0'},
    signal:timeoutSignal(45000)
  });
  if (!response.ok) throw new Error(`OSRM route HTTP ${response.status}`);
  const data = await response.json();
  return Number(data?.routes?.[0]?.distance) || 0;
}

async function routeAll(places, onProgress = () => {}) {
  const routed = [];
  const batchSize = 70;
  for (let offset = 0; offset < places.length; offset += batchSize) {
    const chunk = places.slice(offset, offset + batchSize);
    let distances = null;
    try {
      distances = await osrmTable(chunk);
    } catch {
      distances = await Promise.all(chunk.map(async item => {
        try { return await osrmRoute(item); } catch { return 0; }
      }));
    }
    chunk.forEach((item,index) => {
      const meters = Number(distances?.[index]) || 0;
      if (meters <= 0) return;
      const distanceKm = Math.ceil(meters / 1000);
      if (distanceKm > ROAD_LIMIT_KM) return;
      routed.push({
        name:item.name,
        label:item.name,
        secondary:secondaryFor(item.tags,distanceKm),
        price:distanceKm * RATE,
        distanceKm,
        lat:+item.lat.toFixed(6),
        lon:+item.lon.toFixed(6),
        place:item.place,
        source:'osrm'
      });
    });
    onProgress(Math.min(offset + chunk.length, places.length), places.length, routed.length);
    await sleep(180);
  }
  return routed;
}

function mergeManual(routed, baseDelivery) {
  const manual = Array.isArray(baseDelivery?.destinations) ? baseDelivery.destinations : [];
  const map = new Map();
  const duplicates = new Map();

  for (const item of routed) {
    const key = normalize(item.name);
    if (!key) continue;
    const arr = duplicates.get(key) || [];
    arr.push(item);
    duplicates.set(key,arr);
  }

  // Keep every routed settlement. Duplicate names get a stable label while preserving
  // the original name for search.
  for (const [key,items] of duplicates) {
    items.sort((a,b)=>(a.distanceKm-b.distanceKm)||a.lat-b.lat||a.lon-b.lon);
    items.forEach((item,index) => {
      const id = items.length === 1 ? key : `${key}#${index+1}`;
      map.set(id,item);
    });
  }

  // Existing hand-maintained prices are authoritative and override generated prices.
  for (const item of manual) {
    const name = String(item?.name || '').trim();
    const key = normalize(name);
    if (!key) continue;
    const matches = [...map.entries()].filter(([,value]) => normalize(value.name) === key);
    if (matches.length === 1) {
      const [id,generated] = matches[0];
      map.set(id,{...generated,...item,name,label:item.label || name,source:'manual'});
    } else if (matches.length > 1) {
      // A manual ambiguous name cannot safely override several villages. Keep it as an
      // extra exact choice rather than guessing which settlement was intended.
      map.set(`manual:${key}`,{...item,name,label:item.label || name,source:'manual'});
    } else {
      map.set(`manual:${key}`,{...item,name,label:item.label || name,source:'manual'});
    }
  }

  const destinations = [...map.values()];
  if (!destinations.some(item => normalize(item.name) === normalize('Мелеуз'))) {
    destinations.push({name:'Мелеуз',label:'Мелеуз',secondary:'город · 0 км от Мелеуза',price:0,distanceKm:0,lat:ORIGIN.lat,lon:ORIGIN.lon,place:'city',source:'manual'});
  }
  destinations.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru') || (Number(a.distanceKm)||9999)-(Number(b.distanceKm)||9999));
  return destinations;
}

export async function generateOfflineDeliveryGrid(baseDelivery, {log=console.log} = {}) {
  const startedAt = new Date().toISOString();
  const base = JSON.parse(JSON.stringify(baseDelivery || {}));
  try {
    log('Offline delivery: loading settlements around Meleuz…');
    const elements = await fetchOverpass();
    const places = dedupePlaces(elements);
    log(`Offline delivery: ${places.length} settlement objects found; routing…`);
    const routed = await routeAll(places,(done,total,kept)=>{
      if (done === total || done % 350 === 0) log(`Offline delivery: routed ${done}/${total}, within 200 km: ${kept}`);
    });
    const destinations = mergeManual(routed,base);
    return {
      delivery:{
        ...base,
        updatedAt:new Date().toISOString().slice(0,10),
        fallbackRatePerKm:RATE,
        origin:{...ORIGIN},
        destinations
      },
      meta:{
        ok:true,
        generatedAt:new Date().toISOString(),
        startedAt,
        roadLimitKm:ROAD_LIMIT_KM,
        queryRadiusM:QUERY_RADIUS_M,
        ratePerKm:RATE,
        osmObjects:places.length,
        routedWithinLimit:routed.length,
        finalDestinations:destinations.length,
        sources:['OpenStreetMap Overpass','OSRM']
      }
    };
  } catch (error) {
    const destinations = Array.isArray(base.destinations) ? base.destinations : [];
    log(`Offline delivery: generation failed, using current table (${error?.message || error})`);
    return {
      delivery:base,
      meta:{
        ok:false,
        generatedAt:new Date().toISOString(),
        startedAt,
        roadLimitKm:ROAD_LIMIT_KM,
        ratePerKm:RATE,
        finalDestinations:destinations.length,
        error:String(error?.message || error)
      }
    };
  }
}
