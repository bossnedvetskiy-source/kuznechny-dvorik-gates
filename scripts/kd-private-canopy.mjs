// Private runtime preparation; no business rates and no network endpoint.
// Use the same legacy calculation in an isolated Node VM. Only customer
// amounts are returned. Geometry rules remain from the shared legacy engine.
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeCanopyInput} from '../surveyor-app/v2-canopy-input.js';
const sandbox={window:{}};
vm.createContext(sandbox);
for(const path of ['../naves/geometry.js','../naves/pricing.js']){
 const url=new URL(path,import.meta.url);
 vm.runInContext(fs.readFileSync(url,'utf8'),sandbox,{filename:url.pathname});
}
const G=sandbox.window.TrussGeometry,C=sandbox.window.CanopyPricing;
export const CANOPY_RATE_KEYS=Object.freeze(['tube25','tube20','tube30','tube25web','tube40x20','tube80','tube40x40','poly','connector','endProfile','weld4m','mountCover','mountNoCover','postConcrete','postPlate','paint','markup','wire','discs','ownerMount','profnastil','separateMarkup']);
export function privateCanopyQuote(input,bundle,{installationScope}={}){
 if(bundle?.kind!=='canopy'||bundle.approved!==true||bundle.policy!=='legacy-canopy-installed-v1'||typeof bundle.revision!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(bundle.revision))throw Error('Нет утверждённой модели стоимости навеса');
 // Legacy calculation always charges mounting. Do not quietly sell a
 // supply-only kit under that formula. Explicit scope is required.
 if(installationScope!=='included')throw Error('Уточните монтаж: расчёт комплекта без монтажа пока не утверждён');
 const {configuration,raw}=normalizeCanopyInput(input);
 if(!configuration.postsNeeded&&Number(configuration.existingPosts)!==0)throw Error('Уточните существующие опоры');
 const rates={};
 for(const k of CANOPY_RATE_KEYS){
  const v=bundle.rates?.[k];
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000000)throw Error('Нет подтверждённого тарифа: '+k);
  rates[k]=v;
 }
 if(rates.markup>1000||rates.separateMarkup>1000)throw Error('Проверьте наценку');
 raw.trussCount=C.autoTrussCount(raw.lengthM);
 const g=G.compute(raw);
 if(!g.ok)throw Error(g.errors.join(' '));
 const c=C.compute(raw,g,rates);
 if(raw.existingPosts>c.totalPosts||c.postLen>6)throw Error('Уточните опоры');
 if(c.warnings.length)throw Error(c.warnings.join(' '));
 const total=Math.round(c.priceNoDelivery);
 const installation=Math.round((c.mount+c.postMount)*(1+rates.markup/100));
 const product=total-installation;
 if(!Number.isSafeInteger(total)||total<=0||product<0||installation<0)throw Error('Некорректная сумма');
 return {version:1,kind:'canopy',tariffRevision:bundle.revision,configuration,installationScope,prices:{product,installation,total},deliveryPending:true,engineeringPending:true,canIssue:false,canReleaseProduction:false};
}
