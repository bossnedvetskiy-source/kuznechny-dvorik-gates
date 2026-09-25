import {readFile, writeFile} from 'node:fs/promises';

const ORIGIN={lat:52.96328,lon:55.928612};
const RADIUS_M=260000;
const OVERPASS_ENDPOINTS=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const normalize=value=>String(value||'')
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g,'е')
  .replace(/[^а-яa-z0-9]/gi,'');

const cleanExisting=value=>String(value||'')
  .split('·')
  .map(part=>part.trim())
  .filter(part=>part
    && !/^(?:город|город\s*\/\s*пос[её]лок|пос[её]лок|село\s*\/\s*деревня|деревня\s*\/\s*хутор|насел[её]нный пункт)$/iu.test(part)
    && !/^\d+\s*км\s*от\s*Мелеуза$/iu.test(part))
  .join(', ')
  .trim();

const timeoutSignal=ms=>typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(ms):undefined;

async function fetchBoundaries(){
  const query=`[out:json][timeout:180];
(
  rel["boundary"="administrative"]["admin_level"~"^(4|6|8)$"](around:${RADIUS_M},${ORIGIN.lat},${ORIGIN.lon});
);
out body geom;`;
  let lastError=null;
  for(const endpoint of OVERPASS_ENDPOINTS){
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{
          'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent':'KuznechnyDvorikOfflineAddressEnricher/1.0'
        },
        body:new URLSearchParams({data:query}),
        signal:timeoutSignal(190000)
      });
      if(!response.ok)throw new Error(`Overpass HTTP ${response.status}`);
      const data=await response.json();
      const elements=Array.isArray(data?.elements)?data.elements:[];
      if(!elements.length)throw new Error('Overpass returned no administrative boundaries');
      return elements;
    }catch(error){lastError=error}
  }
  throw lastError||new Error('Overpass unavailable');
}

function relationName(element){
  return String(element?.tags?.['name:ru']||element?.tags?.name||'').trim();
}

function areaSegments(element){
  const segments=[];
  for(const member of element?.members||[]){
    if(member?.type!=='way'||!Array.isArray(member.geometry)||member.geometry.length<2)continue;
    const points=member.geometry
      .map(point=>({lat:Number(point?.lat),lon:Number(point?.lon)}))
      .filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon));
    if(points.length<2)continue;
    for(let i=1;i<points.length;i+=1)segments.push([points[i-1],points[i]]);
  }
  return segments;
}

function bboxFor(segments){
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
  for(const [a,b] of segments){
    for(const p of [a,b]){
      if(p.lat<minLat)minLat=p.lat;if(p.lat>maxLat)maxLat=p.lat;
      if(p.lon<minLon)minLon=p.lon;if(p.lon>maxLon)maxLon=p.lon;
    }
  }
  return {minLat,maxLat,minLon,maxLon};
}

function contains(area,point){
  const b=area.bbox;
  if(point.lat<b.minLat||point.lat>b.maxLat||point.lon<b.minLon||point.lon>b.maxLon)return false;
  let inside=false;
  const y=point.lat,x=point.lon;
  for(const [a,bp] of area.segments){
    const y1=a.lat,y2=bp.lat,x1=a.lon,x2=bp.lon;
    const crosses=(y1>y)!==(y2>y);
    if(!crosses)continue;
    const xAt=x1+(x2-x1)*(y-y1)/(y2-y1);
    if(x<xAt)inside=!inside;
  }
  return inside;
}

function administrativeAreas(elements){
  const areas=[];
  for(const element of elements){
    const name=relationName(element);
    const level=Number(element?.tags?.admin_level);
    if(!name||![4,6,8].includes(level))continue;
    if(level!==4&&!/(?:район|округ|муниципал)/iu.test(name))continue;
    const segments=areaSegments(element);
    if(!segments.length)continue;
    areas.push({name,level,segments,bbox:bboxFor(segments)});
  }
  return areas;
}

function chooseArea(areas,point,level){
  const matches=areas.filter(area=>area.level===level&&contains(area,point));
  if(!matches.length)return null;
  matches.sort((a,b)=>{
    const aDistrict=/(?:район|округ|муниципал)/iu.test(a.name)?0:1;
    const bDistrict=/(?:район|округ|муниципал)/iu.test(b.name)?0:1;
    return aDistrict-bDistrict||a.name.length-b.name.length||a.name.localeCompare(b.name,'ru');
  });
  return matches[0];
}

function existingDistrict(row){
  const value=cleanExisting(row?.secondary);
  const match=value.match(/([^,]*(?:район|округ|муниципал)[^,]*)/iu);
  return String(match?.[1]||'').trim();
}

function existingRegion(row){
  const value=cleanExisting(row?.secondary);
  const match=value.match(/([^,]*(?:республика|область|край)[^,]*)/iu);
  return String(match?.[1]||'').trim();
}

const source=JSON.parse(await readFile('offline-delivery-200km.json','utf8'));
const rows=Array.isArray(source?.destinations)?source.destinations:[];
if(rows.length<1000)throw new Error(`Offline settlement database unexpectedly small: ${rows.length}`);

console.log(`Loading administrative boundaries for ${rows.length} settlements…`);
const areas=administrativeAreas(await fetchBoundaries());
const regions=areas.filter(area=>area.level===4);
const districts=areas.filter(area=>area.level===6||area.level===8);
console.log(`Administrative boundaries loaded: regions=${regions.length}, districts=${districts.length}`);

let enriched=0,missingDistrict=0,missingRegion=0,noCoordinates=0;
for(const row of rows){
  const lat=Number(row?.lat),lon=Number(row?.lon);
  let district=existingDistrict(row);
  let region=existingRegion(row);

  if(Number.isFinite(lat)&&Number.isFinite(lon)){
    const point={lat,lon};
    if(!district){
      district=chooseArea(districts,point,6)?.name||chooseArea(districts,point,8)?.name||'';
      if(district)enriched+=1;
    }
    if(!region)region=chooseArea(regions,point,4)?.name||'';
  }else{
    noCoordinates+=1;
  }

  const parts=[];
  for(const value of [district,region]){
    if(value&&!parts.some(existing=>normalize(existing)===normalize(value)))parts.push(value);
  }
  row.secondary=parts.join(', ');
  row.label=[String(row.name||'').trim(),...parts].filter(Boolean).join(', ');
  row.query=[String(row.name||'').trim(),...parts,'Россия'].filter(Boolean).join(', ');

  if(!district&&!['city','town'].includes(String(row.place||'')))missingDistrict+=1;
  if(!region)missingRegion+=1;
}

source.meta={
  ...(source.meta||{}),
  addressEnrichedAt:new Date().toISOString(),
  administrativeBoundarySource:'OpenStreetMap Overpass',
  addressRows:rows.length,
  addressRowsEnriched:enriched,
  addressRowsWithoutCoordinates:noCoordinates,
  addressRowsMissingDistrict:missingDistrict,
  addressRowsMissingRegion:missingRegion
};

await writeFile('offline-delivery-200km.json',JSON.stringify(source), 'utf8');
console.log(JSON.stringify({
  rows:rows.length,enriched,noCoordinates,missingDistrict,missingRegion
},null,2));

if(missingDistrict>100)throw new Error(`Too many settlements still lack district: ${missingDistrict}`);
